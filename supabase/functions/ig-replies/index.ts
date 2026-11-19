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

const GRAPH = "https://graph.instagram.com/v23.0";
type Tok = { token: string; user_id?: string; expires_at?: string; refreshed_at?: string };
async function igToken(): Promise<Tok | null> {
  const { data } = await db.from("platform_config").select("value").eq("key", "ig_token").maybeSingle();
  const v = data?.value as Tok | undefined;
  if (!v?.token) return null;
  // odświeżenie długiego tokenu (ważny 60 dni) najwyżej raz na 5 dni
  if (!v.refreshed_at || Date.now() - Date.parse(v.refreshed_at) > 5 * 864e5) {
    try {
      const r = await fetch(`${GRAPH.replace("/v23.0", "")}/refresh_access_token?grant_type=ig_refresh_token&access_token=${encodeURIComponent(v.token)}`);
      const d = await r.json();
      if (r.ok && d.access_token) {
        const nv = { ...v, token: d.access_token, expires_at: new Date(Date.now() + Number(d.expires_in || 5184000) * 1000).toISOString(), refreshed_at: new Date().toISOString() };
        await db.from("platform_config").upsert({ key: "ig_token", value: nv }, { onConflict: "key" });
        return nv;
      }
    } catch { /* zostaje stary token */ }
  }
  return v;
}
async function graph(tok: string, path: string, init: RequestInit = {}) {
  const r = await fetch(`${GRAPH}/${path}`, { ...init, headers: { ...(init.headers || {}), authorization: `Bearer ${tok}`, "content-type": "application/json" }, signal: AbortSignal.timeout(20000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(d?.error?.message || `graph ${r.status}`);
  return d;
}
// Wszystkie komentarze (i odpowiedzi pod nimi) z ostatnich postów, prosto z Instagrama.
async function graphComments(tok: string, mediaLimit: number) {
  const media = await graph(tok, `me/media?fields=id,caption,comments_count&limit=${mediaLimit}`);
  const out: any[] = [];
  for (const m of media.data || []) {
    if (!Number(m.comments_count)) continue;
    const c = await graph(tok, `${m.id}/comments?fields=id,text,username,timestamp,replies{id,username}&limit=50`);
    for (const x of c.data || []) {
      const answered = (x.replies?.data || []).some((r: any) => String(r.username || "").toLowerCase() === OWN);
      out.push({ comment_id: x.id, comment_text: x.text, comment_username: x.username, comment_timestamp: x.timestamp, media_id: m.id, media_caption: m.caption || "", answered });
    }
  }
  return out;
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
      const tk = await igToken();
      return json({ ok: true, status: { paused: Boolean(conf.paused), total: total || 0, today: todayCount || 0, last: last || [], connected: Boolean(tk), expires_at: tk?.expires_at || null } });
    }
    if (action === "token_set") {
      const t = String(body.token || "");
      if (t.length < 20) return json({ ok: false, error: "token" }, 400);
      await db.from("platform_config").upsert({ key: "ig_token", value: { token: t, user_id: String(body.user_id || ""), username: String(body.username || ""), expires_at: body.expires_at || null, refreshed_at: new Date().toISOString() } }, { onConflict: "key" });
      return json({ ok: true });
    }
    if (action === "token_get") {
      const t = await igToken();
      return json({ ok: true, token: t?.token || null, user_id: t?.user_id || null, expires_at: t?.expires_at || null });
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
    const tok = await igToken();
    if (tok && (action === "hide" || action === "delete")) {
      const cid = String(body.comment_id || "");
      if (!/^\d{5,30}$/.test(cid)) return json({ ok: false, error: "comment_id" }, 400);
      if (action === "hide") await graph(tok.token, `${cid}`, { method: "POST", body: JSON.stringify({ hide: true }) });
      else await graph(tok.token, `${cid}`, { method: "DELETE" });
      await db.from("ig_reply_log").update({ status: action === "hide" ? "hidden" : "deleted", updated_at: new Date().toISOString() }).eq("comment_id", cid);
      return json({ ok: true });
    }
    const call = tok && action === "run" ? (null as any) : await windsorSession(key);
    if (action === "hide" || action === "delete") {
      const cid = String(body.comment_id || "");
      if (!/^\d{5,30}$/.test(cid)) return json({ ok: false, error: "comment_id" }, 400);
      await call("execute_action", { connector: "instagram", account: ACCOUNT, action: action === "hide" ? "hide_comment" : "delete_comment", params: { comment_id: cid } });
      await db.from("ig_reply_log").update({ status: action === "hide" ? "hidden" : "deleted", updated_at: new Date().toISOString() }).eq("comment_id", cid);
      return json({ ok: true });
    }
    if (action === "media") {
      const out = await call("get_data", { connector: "instagram", accounts: [ACCOUNT], fields: body.fields || ["media_id", "media_permalink", "media_comments_count", "media_type"], date_preset: "last_730dT", reasoning: "liczba komentarzy pod postami" });
      const rows = rowsFrom(out).filter((r: any) => Number(r.media_comments_count || 0) > 0);
      return json({ ok: true, media_with_comments: rows, raw: rows.length ? undefined : out.text.slice(0, 400) });
    }
    if (action !== "run") return json({ ok: false, error: "action" }, 400);
    const dry = body.dry === true;
    if (!dry && !body.force && (await igConfig()).paused) return json({ ok: true, paused: true });
    const days = Math.min(730, Math.max(1, Number(body.days || 30)));
    const max = Math.min(20, Math.max(1, Number(body.max || 8)));
    const rows = tok ? await graphComments(tok.token, Number(body.media || 50)) : await readComments(call, days);
    if (body.debug) return json({ ok: true, rows: rows.map((r: any) => ({ id: r.comment_id, user: r.comment_username, text: String(r.comment_text || "").slice(0, 80), ts: r.comment_timestamp, media: r.media_id, parent: r.comment_parent_id })) });
    const comments = rows.filter((r: any) => r.comment_id && r.comment_text && !r.answered && String(r.comment_username || "").toLowerCase() !== OWN);
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
        let info = "";
        if (tok) { const d = await graph(tok.token, `${cid}/replies`, { method: "POST", body: JSON.stringify({ message: j.reply }) }); info = `graph reply ${d.id || ""}`; }
        else { const out = await call("execute_action", { connector: "instagram", account: ACCOUNT, action: "reply_to_comment", params: { comment_id: cid, message: j.reply } }); info = out.text.slice(0, 500); }
        await db.from("ig_reply_log").update({ status: "replied", result: { text: info }, updated_at: new Date().toISOString() }).eq("comment_id", cid);
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
