// creator-platform-gw: brama przed creator-platform-db. Akcje obsługiwane tutaj (konta ze strony mają ujemne ID),
// resztę przekazuje bez zmian do creator-platform-db / quality-usage. Autor: MT
import { createClient } from "npm:@supabase/supabase-js@2.117.2";

const BASE = "https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1";
const SPECIALISTS = new Set(["brc","ifs","haccp","complaints","capa","audit","documents","suppliers","traceability","labelling","change","management","legal","other"]);
const OWN = new Set(["save_quality_assistant_message", "use_quality_custom_doc", "create_quality_job", "list_quality_jobs", "get_quality_job", "claim_quality_job", "save_quality_job", "quality_job_stats"]);
const json = (d: unknown, s = 200) => new Response(JSON.stringify(d), { status: s, headers: { "Content-Type": "application/json" } });

function admin() {
  let key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const raw = Deno.env.get("SUPABASE_SECRET_KEYS");
  if (raw) { try { key = JSON.parse(raw).default || key; } catch { /* */ } }
  return createClient(Deno.env.get("SUPABASE_URL")!, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

// Czas wykonania przez Bielika z ostatnich 50 zakończonych zadań danego rodzaju: n, średnia, odchylenie (sekundy).
async function stats(db: any, kind: string) {
  const { data } = await db.from("quality_jobs").select("created_at,finished_at").eq("kind", kind).eq("status", "done").eq("engine", "bielik")
    .not("finished_at", "is", null).order("finished_at", { ascending: false }).limit(50);
  const t = (data || []).map((r: any) => (Date.parse(r.finished_at) - Date.parse(r.created_at)) / 1000).filter((x: number) => x > 0);
  const n = t.length, mean = n ? t.reduce((a: number, b: number) => a + b, 0) / n : 0;
  const sd = n > 1 ? Math.sqrt(t.reduce((a: number, b: number) => a + (b - mean) ** 2, 0) / (n - 1)) : 0;
  return { n, mean: Math.round(mean), sd: Math.round(sd), max: n ? Math.round(Math.max(...t)) : 0 };
}

const LIST = "id,kind,status,title,engine,limit_seconds,created_at,finished_at,error";

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed" }, 405);
  const raw = await req.text();
  let body: any = {};
  try { body = JSON.parse(raw); } catch { /* */ }
  const forward = (fn: string) => fetch(`${BASE}/${fn}`, { method: "POST", headers: { "content-type": "application/json", "x-bot-secret": req.headers.get("x-bot-secret") || "" }, body: raw });

  if (body?.action === "count_quality_assistant_user_messages") return forward("quality-usage");
  if (!OWN.has(body?.action)) return forward("creator-platform-db");

  const db = admin();
  const { data: cfg } = await db.from("platform_config").select("value").eq("key", "bot_auth").maybeSingle();
  const sup = req.headers.get("x-bot-secret") || "";
  if (!sup || sup !== cfg?.value?.secret_hash) return json({ ok: false, error: "Unauthorized" }, 401);
  const uid = Number(body?.telegram_user_id);
  const now = new Date().toISOString();
  const validUser = Number.isSafeInteger(uid) && uid !== 0;

  if (body.action === "use_quality_custom_doc") {
    const limit = Number(body?.limit || 0);
    if (!validUser || !(limit > 0)) return json({ ok: false, error: "Invalid request" }, 400);
    const { data: m, error: e1 } = await db.from("quality_memberships").select("custom_docs_used").eq("telegram_user_id", uid).maybeSingle();
    if (e1) return json({ ok: false, error: e1.message }, 500);
    const used = Number(m?.custom_docs_used || 0);
    if (used >= limit) return json({ ok: false, error: "Limit exhausted" }, 429);
    const { data, error } = await db.from("quality_memberships").update({ custom_docs_used: used + 1, updated_at: now })
      .eq("telegram_user_id", uid).eq("custom_docs_used", used).select("custom_docs_used").maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, data: data || { custom_docs_used: used + 1 } });
  }

  if (body.action === "create_quality_job") {
    const kind = String(body?.kind || "");
    if (!validUser || !["document", "answer"].includes(kind)) return json({ ok: false, error: "Invalid request" }, 400);
    const input = body?.input && typeof body.input === "object" ? body.input : {};
    if (JSON.stringify(input).length > 20000) return json({ ok: false, error: "Input too long" }, 413);
    const { count } = await db.from("quality_jobs").select("id", { count: "exact", head: true }).eq("telegram_user_id", uid).in("status", ["queued", "working"]);
    if ((count || 0) >= 5) return json({ ok: false, error: "Masz już 5 zadań w przygotowaniu. Poczekaj, aż się zakończą." }, 429);
    const { data, error } = await db.from("quality_jobs").insert({ telegram_user_id: uid, kind, title: String(body?.title || "").slice(0, 200), input, limit_seconds: Number(body?.limit_seconds) || null }).select(LIST).single();
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, data });
  }

  if (body.action === "list_quality_jobs") {
    if (!validUser) return json({ ok: false, error: "Invalid user" }, 400);
    let q = db.from("quality_jobs").select(LIST).eq("telegram_user_id", uid).order("created_at", { ascending: false }).limit(Math.min(50, Number(body?.limit) || 20));
    if (body?.kind) q = q.eq("kind", String(body.kind));
    const { data, error } = await q;
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, data: data || [] });
  }

  if (body.action === "get_quality_job") {
    if (!validUser || !body?.job_id) return json({ ok: false, error: "Invalid request" }, 400);
    const { data, error } = await db.from("quality_jobs").select("*").eq("id", String(body.job_id)).eq("telegram_user_id", uid).maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, data });
  }

  if (body.action === "quality_job_stats") {
    return json({ ok: true, data: { document: await stats(db, "document"), answer: await stats(db, "answer") } });
  }

  // Worker: bierze najstarsze otwarte zadanie bez blokady i blokuje je na czas jednego kroku.
  if (body.action === "claim_quality_job") {
    const lockSec = Math.min(120, Math.max(30, Number(body?.lock_seconds) || 75));
    const skip: string[] = Array.isArray(body?.skip) ? body.skip.map(String).slice(0, 20) : [];
    for (let i = 0; i < 3; i++) {
      let q = db.from("quality_jobs").select("*").in("status", ["queued", "working"]).or(`locked_until.is.null,locked_until.lt.${now}`).order("created_at", { ascending: true }).limit(1);
      if (skip.length) q = q.not("id", "in", `(${skip.join(",")})`);
      const { data: job, error } = await q.maybeSingle();
      if (error) return json({ ok: false, error: error.message }, 500);
      if (!job) return json({ ok: true, data: null });
      const until = new Date(Date.now() + lockSec * 1000).toISOString();
      let upd = db.from("quality_jobs").update({ locked_until: until, status: "working", updated_at: now }).eq("id", job.id);
      upd = job.locked_until ? upd.eq("locked_until", job.locked_until) : upd.is("locked_until", null);
      const { data: got } = await upd.select("*").maybeSingle();
      if (got) return json({ ok: true, data: { job: got, stats: await stats(db, got.kind) } });
    }
    return json({ ok: true, data: null });
  }

  if (body.action === "save_quality_job") {
    if (!body?.job_id) return json({ ok: false, error: "Invalid request" }, 400);
    const p = body?.patch || {};
    const allowed: Record<string, unknown> = { updated_at: now, locked_until: p.keep_lock ? undefined : null };
    for (const k of ["status", "title", "state", "result", "engine", "attempts", "limit_seconds", "error", "notified_at", "finished_at"]) if (k in p) allowed[k] = p[k];
    if (allowed.locked_until === undefined) delete allowed.locked_until;
    if (p.status && !["queued", "working", "done", "failed"].includes(p.status)) return json({ ok: false, error: "Invalid status" }, 400);
    const { data, error } = await db.from("quality_jobs").update(allowed).eq("id", String(body.job_id)).select(LIST).maybeSingle();
    if (error) return json({ ok: false, error: error.message }, 500);
    return json({ ok: true, data });
  }

  const specialist = String(body?.specialist || "").toLowerCase();
  const role = body?.role === "assistant" ? "assistant" : body?.role === "user" ? "user" : "";
  const content = String(body?.content || "").trim();
  if (!validUser) return json({ ok: false, error: "Invalid user" }, 400);
  if (!SPECIALISTS.has(specialist)) return json({ ok: false, error: "Invalid specialist" }, 400);
  if (!role) return json({ ok: false, error: "Invalid message role" }, 400);
  if (!content) return json({ ok: false, error: "Message content is required" }, 400);
  if (content.length > 20000) return json({ ok: false, error: "Message is too long" }, 413);
  const source_meta = body?.source_meta && typeof body.source_meta === "object" ? body.source_meta : {};
  const { data, error } = await db.from("quality_assistant_messages").insert({ telegram_user_id: uid, specialist, role, content, source_meta }).select().single();
  if (error) return json({ ok: false, error: error.message }, 500);
  return json({ ok: true, data });
});
