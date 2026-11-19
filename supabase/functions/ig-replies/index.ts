// ig-replies: odpowiedzi na komentarze pod postami @jem_bezpiecznie (Windsor.ai) z zachętą do jembezpiecznie.com.
// Uruchamia go pg_cron. body: { dry?: true, days?: number, max?: number }
// Autoryzacja: nagłówek x-autopost-key = sha256(klucza Windsor z Vault), jak w ig-autopost. Autor: MT
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const ACCOUNT = "17841452533483595"; // jem_bezpiecznie
const OWN = "jem_bezpiecznie";
const REPLY_API = "https://qasupport.jembezpiecznie.com/api/jb-igreply";
const NOTIFY_API = "https://qasupport.jembezpiecznie.com/api/community?mode=ig_notify";
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function mcp(key: string, session: string | null, body: unknown) {
  const headers: Record<string, string> = { authorization: `Bearer ${key}`, "content-type": "application/json", accept: "application/json, text/event-stream" };
  if (session) headers["mcp-session-id"] = session;
  const r = await fetch("https://mcp.windsor.ai/", { method: "POST", headers, body: JSON.stringify(body), signal: AbortSignal.timeout(120000) });
  const text = await r.text();
  const sid = r.headers.get("mcp-session-id") || session;
  const msgs = text.split("\n").filter((l) => l.startsWith("data:")).map((l) => { try { return JSON.parse(l.slice(5)); } catch { return null; } }).filter(Boolean);
  if (!msgs.length && text.trim().startsWith("{")) msgs.push(JSON.parse(text));
  if (!r.ok) throw new Error(`windsor http ${r.status}: ${text.slice(0, 300)}`);
  return { sid, msg: msgs.find((m: any) => m.id !== undefined) };
}

async function windsorSession(key: string) {
  const init = await mcp(key, null, { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26", capabilities: {}, clientInfo: { name: "ig-replies", version: "1" } } });
  await mcp(key, init.sid, { jsonrpc: "2.0", method: "notifications/initialized" }).catch(() => {});
  let n = 10;
  return async (name: string, args: Record<string, unknown>) => {
    const res = await mcp(key, init.sid, { jsonrpc: "2.0", id: n++, method: "tools/call", params: { name, arguments: args } });
    const m: any = res.msg;
    if (!m) throw new Error("windsor: brak odpowiedzi");
    if (m.error) throw new Error("windsor: " + JSON.stringify(m.error).slice(0, 400));
    const text = (m.result?.content || []).map((c: any) => c.text || "").join("\n");
    if (m.result?.isError) throw new Error("windsor: " + text.slice(0, 400));
    return { text, structured: m.result?.structuredContent };
  };
}

function rowsFrom(out: { text: string; structured?: any }): any[] {
  const pick = (v: any): any[] | null => {
    if (Array.isArray(v)) return v;
    if (v && typeof v === "object") for (const k of ["data", "rows", "result"]) { const r = pick(v[k]); if (r) return r; }
    return null;
  };
  const s = pick(out.structured);
  if (s) return s;
  try { return pick(JSON.parse(out.text)) || []; } catch { return []; }
}

let lastRaw = "";
async function readComments(call: Awaited<ReturnType<typeof windsorSession>>, days: number) {
  const args = { connector: "instagram", accounts: [ACCOUNT], fields: ["comment_id", "comment_text", "comment_username", "comment_timestamp", "comment_parent_id", "media_id", "media_caption"], date_preset: `last_${days}dT`, reasoning: "odpowiedzi na komentarze pod postami" };
  for (let i = 0; i < 4; i++) {
    const out = await call("get_data", args);
    if (/"status"\s*:\s*"pending"/.test(out.text) || out.structured?.status === "pending") continue; // ten sam call kontynuuje pobieranie
    if (/reads are paused|not your real numbers/i.test(out.text)) throw new Error("Windsor wstrzymał odczyt danych (plan Free: 1 konto).");
    const rows = rowsFrom(out);
    lastRaw = rows.length ? "" : (out.text || JSON.stringify(out.structured || {})).slice(0, 600);
    return rows;
  }
  throw new Error("Windsor: dane jeszcze się pobierają");
}

async function notify(secret: string, items: any[]) {
  if (!items.length || !secret) return;
  await fetch(NOTIFY_API, { method: "POST", headers: { "content-type": "application/json", "x-bot-secret": secret }, body: JSON.stringify({ items }), signal: AbortSignal.timeout(30000) }).catch(() => {});
}

async function igConfig() {
  const { data } = await db.from("platform_config").select("value").eq("key", "ig_replies").maybeSingle();
  return (data?.value || {}) as { paused?: boolean };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const key = (await db.rpc("ig_windsor_key")).data as string | null;
  const { data: cfg } = await db.from("platform_config").select("value").eq("key", "bot_auth").maybeSingle();
  const secret = cfg?.value?.secret_hash || "";
  const viaCron = Boolean(key) && req.headers.get("x-autopost-key") === (await sha256Hex(key!));
  const viaBot = Boolean(secret) && req.headers.get("x-bot-secret") === secret;
  if (!key || (!viaCron && !viaBot)) return json({ ok: false, error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const action = String(body.action || "run");
  try {
    if (action === "pause" || action === "resume") {
      await db.from("platform_config").upsert({ key: "ig_replies", value: { paused: action === "pause" } }, { onConflict: "key" });
      return json({ ok: true, paused: action === "pause" });
    }
    if (action === "status") {
      const today = new Date().toISOString().slice(0, 10);
      const [{ count: total }, { count: todayCount }, { data: last }, conf] = await Promise.all([
        db.from("ig_reply_log").select("comment_id", { count: "exact", head: true }).eq("status", "replied"),
        db.from("ig_reply_log").select("comment_id", { count: "exact", head: true }).eq("status", "replied").gte("created_at", today),
        db.from("ig_reply_log").select("username,comment,status,created_at").order("created_at", { ascending: false }).limit(5),
        igConfig()
      ]);
      return json({ ok: true, status: { paused: Boolean(conf.paused), total: total || 0, today: todayCount || 0, last: last || [] } });
    }
    if (action === "claim") {
      const cid = String(body.comment_id || "");
      if (!/^\d{5,30}$/.test(cid)) return json({ ok: false, error: "comment_id" }, 400);
      if ((await igConfig()).paused) return json({ ok: true, claimed: false, paused: true });
      const { error } = await db.from("ig_reply_log").insert({ comment_id: cid, media_id: body.media_id || null, username: body.username || null, comment: String(body.comment || "").slice(0, 2000), status: "started" });
      return json({ ok: true, claimed: !error });
    }
    if (action === "done") {
      const cid = String(body.comment_id || "");
      if (body.status === "error") await db.from("ig_reply_log").delete().eq("comment_id", cid);
      else await db.from("ig_reply_log").update({ status: body.status === "replied" ? "replied" : "skipped", reply: body.reply || null, updated_at: new Date().toISOString() }).eq("comment_id", cid);
      return json({ ok: true });
    }
    const call = await windsorSession(key);
    if (action === "hide" || action === "delete") {
      const cid = String(body.comment_id || "");
      if (!/^\d{5,30}$/.test(cid)) return json({ ok: false, error: "comment_id" }, 400);
      await call("execute_action", { connector: "instagram", account: ACCOUNT, action: action === "hide" ? "hide_comment" : "delete_comment", params: { comment_id: cid } });
      await db.from("ig_reply_log").update({ status: action === "hide" ? "hidden" : "deleted", updated_at: new Date().toISOString() }).eq("comment_id", cid);
      return json({ ok: true });
    }
    if (action !== "run") return json({ ok: false, error: "action" }, 400);
    const dry = body.dry === true;
    if (!dry && !body.force && (await igConfig()).paused) return json({ ok: true, paused: true });
    const days = Math.min(30, Math.max(1, Number(body.days || 30)));
    const max = Math.min(20, Math.max(1, Number(body.max || 8)));
    const rows = await readComments(call, days);
    const comments = rows.filter((r: any) => r.comment_id && r.comment_text && String(r.comment_username || "").toLowerCase() !== OWN);
    const ids = comments.map((c: any) => String(c.comment_id));
    const { data: done } = ids.length ? await db.from("ig_reply_log").select("comment_id").in("comment_id", ids) : { data: [] as any[] };
    const seen = new Set((done || []).map((d: any) => d.comment_id));
    const todo = comments.filter((c: any) => !seen.has(String(c.comment_id)))
      .sort((a: any, b: any) => String(a.comment_timestamp).localeCompare(String(b.comment_timestamp))).slice(0, max);
    const results: any[] = [];
    const report: any[] = [];
    for (const c of todo) {
      const cid = String(c.comment_id);
      const base = { comment_id: cid, username: c.comment_username || "", comment: c.comment_text };
      const r = await fetch(REPLY_API, { method: "POST", headers: { "content-type": "application/json", "x-bot-secret": secret }, body: JSON.stringify({ comment: c.comment_text, username: c.comment_username || "", caption: c.media_caption || "" }), signal: AbortSignal.timeout(40000) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { results.push({ comment_id: cid, error: `reply api ${r.status}` }); continue; }
      if (!j.reply) {
        if (!dry) { await db.from("ig_reply_log").insert({ comment_id: cid, media_id: c.media_id || null, username: c.comment_username || null, comment: c.comment_text, status: "skipped" }); report.push({ ...base, skipped: true }); }
        results.push({ comment_id: cid, skipped: true });
        continue;
      }
      if (dry) { results.push({ comment_id: cid, comment: c.comment_text, reply: j.reply }); continue; }
      const { error: insErr } = await db.from("ig_reply_log").insert({ comment_id: cid, media_id: c.media_id || null, username: c.comment_username || null, comment: c.comment_text, reply: j.reply, status: "started" });
      if (insErr) { results.push({ comment_id: cid, skipped: "już obsłużony" }); continue; }
      try {
        const out = await call("execute_action", { connector: "instagram", account: ACCOUNT, action: "reply_to_comment", params: { comment_id: cid, message: j.reply } });
        await db.from("ig_reply_log").update({ status: "replied", result: { text: out.text.slice(0, 500) }, updated_at: new Date().toISOString() }).eq("comment_id", cid);
        results.push({ comment_id: cid, replied: true });
        report.push({ ...base, reply: j.reply, replied: true });
      } catch (e) {
        await db.from("ig_reply_log").delete().eq("comment_id", cid); // następny przebieg spróbuje ponownie
        results.push({ comment_id: cid, error: String((e as Error).message).slice(0, 300) });
      }
    }
    await notify(secret, report);
    return json({ ok: true, found: comments.length, new: todo.length, results, ...(dry && !rows.length ? { raw: lastRaw } : {}) });
  } catch (e) {
    return json({ ok: false, error: String((e as Error).message).slice(0, 400) }, 500);
  }
});
