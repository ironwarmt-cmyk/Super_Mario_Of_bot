// tiktok-autopost: te same treści co na Instagramie, na TikToku @jembezpiecznie (oficjalne Content Posting API, 0 zł).
// Sterowanie z bota MT Social na Telegramie (/tt, /tt_polacz, /tt_teraz).
// Filmy idą BEZ lektora jako szkic do skrzynki TikToka (inbox upload): API nie pozwala dołączyć dźwięku z biblioteki
// TikToka, więc popularny dźwięk wybiera się w aplikacji przy publikacji szkicu. Bot wysyła na Telegram gotowy opis.
//   plan   – pozycja dnia z planu 30-dniowego: rolka albo post zdjęciowy jako filmik (ig/tiktok/plan-dNN.mp4)
//   recall – filmik karty wycofania (tt_video), najwyżej MAX_RECALLS dziennie (TikTok: max 5 szkiców na dobę)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const API = "https://open.tiktokapis.com/v2";
const PLAN_URL = "https://qasupport.jembezpiecznie.com/ig/plan.json";
const NOTIFY_API = "https://qasupport.jembezpiecznie.com/api/community?mode=ig_notify";
const AUTH_FN = "https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/tiktok-auth";
const STORE = `${Deno.env.get("SUPABASE_URL")}/storage/v1/object/public/ig`;
const MAX_RECALLS = 3;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const warsawDate = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const appSecret = async (which: string) => (await db.rpc("tiktok_app_secret", { which })).data as string;
let botSecret = "";
async function notify(items: unknown[]) {
  if (!botSecret || !items.length) return;
  await fetch(NOTIFY_API, { method: "POST", headers: { "content-type": "application/json", "x-bot-secret": botSecret }, body: JSON.stringify({ items }), signal: AbortSignal.timeout(30000) }).catch(() => {});
}

// Token ważny 24 h, odświeżany automatycznie (refresh token ważny rok i odnawiany przy każdym odświeżeniu).
async function token() {
  const { data: a } = await db.from("tiktok_auth").select("*").eq("id", "main").maybeSingle();
  if (!a?.refresh_token) throw new Error("TikTok niepołączony – wpisz /tt_polacz w bocie i zaloguj się raz");
  if (a.access_token && Date.parse(a.access_expires_at) - Date.now() > 10 * 60000) return a.access_token as string;
  const r = await fetch(`${API}/oauth/token/`, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: await appSecret("key"), client_secret: await appSecret("secret"), grant_type: "refresh_token", refresh_token: a.refresh_token }),
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.access_token) throw new Error("TikTok odświeżanie tokenu: " + (t.error_description || t.error || r.status));
  const now = Date.now();
  await db.from("tiktok_auth").update({
    access_token: t.access_token, refresh_token: t.refresh_token || a.refresh_token,
    access_expires_at: new Date(now + (t.expires_in || 86400) * 1000).toISOString(),
    refresh_expires_at: new Date(now + (t.refresh_expires_in || 31536000) * 1000).toISOString(), updated_at: new Date().toISOString(),
  }).eq("id", "main");
  return t.access_token as string;
}
async function tt(path: string, tok: string, body: unknown) {
  const r = await fetch(API + path, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j.error?.code && j.error.code !== "ok")) throw new Error(`TikTok ${path}: ${j.error?.code || r.status} ${j.error?.message || ""}`.trim());
  return j.data;
}
// Szkic do skrzynki TikToka (scope video.upload). Użytkownik dostaje powiadomienie w aplikacji, dodaje dźwięk i publikuje.
async function uploadDraft(videoUrl: string) {
  const tok = await token();
  const bytes = new Uint8Array(await (await fetch(videoUrl, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
  if (bytes.length < 1000) throw new Error("pusty plik wideo: " + videoUrl);
  const init = await tt("/post/publish/inbox/video/init/", tok, { source_info: { source: "FILE_UPLOAD", video_size: bytes.length, chunk_size: bytes.length, total_chunk_count: 1 } });
  const up = await fetch(init.upload_url, { method: "PUT", headers: { "content-type": "video/mp4", "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}` }, body: bytes });
  if (!up.ok) throw new Error("TikTok upload: " + up.status + " " + (await up.text()).slice(0, 200));
  return String(init.publish_id);
}

async function once(key: string, kind: string, request: Record<string, unknown>, title: string, video: string) {
  const { error } = await db.from("ig_autopost_log").insert({ key, kind, request, status: "started" });
  if (error) return { key, skipped: "już było" };
  try {
    const id = await uploadDraft(video);
    await db.from("ig_autopost_log").update({ status: "published", result: { text: `draft publish_id=${id}` }, updated_at: new Date().toISOString() }).eq("key", key);
    await notify([{ kind: "tt", video, title, what: kind === "tt_recall" ? "wycofanie" : "plan dnia" }]);
    return { key, draft: id };
  } catch (e) {
    const msg = String((e as Error).message).slice(0, 300);
    await db.from("ig_autopost_log").delete().eq("key", key);
    await db.from("ig_autopost_log").upsert({ key: `error:${key}:${Date.now()}`, kind: "error", request, status: "error", result: { error: msg } });
    await notify([{ kind: "tt", error: msg, what: kind === "tt_recall" ? "wycofanie" : "plan dnia" }]);
    return { key, error: msg };
  }
}

async function planPost(dry: boolean, force: boolean) {
  const plan = await fetch(PLAN_URL, { signal: AbortSignal.timeout(20000) }).then((r) => r.json());
  const today = warsawDate();
  if (!force && (plan.skip_dates || []).includes(today)) return { skipped: "dzień pominięty" };
  const days = Math.floor((Date.parse(today) - Date.parse(plan.start)) / 864e5);
  const day = ((days % plan.cycle) + plan.cycle) % plan.cycle + 1;
  const p = (plan.posts || []).find((x: any) => x.day === day);
  if (!p) return { skipped: `brak posta na dzień ${day}` };
  const video = p.type === "reel" ? p.video_url : `${STORE}/tiktok/plan-d${String(day).padStart(2, "0")}.mp4`;
  if (dry) return { day, video, title: p.caption };
  return once(`tt:plan:${today}${force ? ":" + Date.now() : ""}`, "tt_plan", { day, video }, p.caption, video);
}

function recallTitle(d: any) {
  return [`🚨 ${d.sev || "Wycofanie"} · ${d.date || ""}`, d.title, d.todo ? `✅ ${d.todo}` : "", "Wszystkie wycofania i darmowe konto: jembezpiecznie.com",
    "#bezpieczeństwożywności #jembezpiecznie #wycofania #GIS #żywność"].filter(Boolean).join("\n\n");
}
async function recallPost(dry: boolean) {
  const today = warsawDate();
  const { count } = await db.from("ig_autopost_log").select("key", { count: "exact", head: true }).eq("kind", "tt_recall").eq("status", "published").gte("created_at", today);
  if ((count || 0) >= MAX_RECALLS) return { skipped: "dzienny limit" };
  const since = new Date(Date.now() - 7 * 864e5).toISOString();
  const { data: reps } = await db.from("quality_market_reports").select("id,data").eq("status", "published").gte("published_at", since).order("published_at", { ascending: true }).limit(50);
  const { data: done } = await db.from("ig_autopost_log").select("key").like("key", "tt:recall:%");
  const posted = new Set((done || []).map((x: any) => x.key));
  const next = (reps || []).find((r: any) => r.data?.tt_video && !posted.has(`tt:recall:${r.id}`));
  if (!next) return { skipped: "brak nowych filmików wycofań" };
  if (dry) return { recall: next.id, video: next.data.tt_video, title: recallTitle(next.data) };
  return once(`tt:recall:${next.id}`, "tt_recall", { video: next.data.tt_video }, recallTitle(next.data), next.data.tt_video);
}

async function status() {
  const { data: a } = await db.from("tiktok_auth").select("open_id,refresh_token,refresh_expires_at,updated_at").eq("id", "main").maybeSingle();
  const connected = Boolean(a?.refresh_token);
  let name = "";
  if (connected) {
    try {
      const r = await fetch(`${API}/user/info/?fields=display_name`, { headers: { authorization: `Bearer ${await token()}` } });
      name = (await r.json())?.data?.user?.display_name || "";
    } catch { /* bez nazwy */ }
  }
  const { data: last } = await db.from("ig_autopost_log").select("key,kind,status,created_at,result").or("kind.in.(tt_plan,tt_recall),key.like.error:tt:%").order("created_at", { ascending: false }).limit(5);
  return { connected, name, refresh_expires_at: a?.refresh_expires_at || null, last: last || [] };
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  const key = (await db.rpc("ig_windsor_key")).data as string | null;
  const { data: cfg } = await db.from("platform_config").select("value").eq("key", "bot_auth").maybeSingle();
  botSecret = cfg?.value?.secret_hash || "";
  const viaCron = Boolean(key) && req.headers.get("x-autopost-key") === (await sha256Hex(key!));
  const viaBot = Boolean(botSecret) && req.headers.get("x-bot-secret") === botSecret;
  if (!viaCron && !viaBot) return json({ ok: false, error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  const dry = body.dry === true;
  try {
    if (body.mode === "plan") return json({ ok: true, plan: await planPost(dry, viaBot && body.force === true) });
    if (body.mode === "recall") return json({ ok: true, recall: await recallPost(dry) });
    if (body.mode === "status") return json({ ok: true, status: await status() });
    if (body.mode === "connect" && viaBot) {
      const t = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
      const { error } = await db.from("tiktok_auth").upsert({ id: "main", start_hash: await sha256Hex(t), updated_at: new Date().toISOString() }, { onConflict: "id" });
      if (error) throw error;
      return json({ ok: true, url: `${AUTH_FN}?start=${t}` });
    }
    return json({ ok: false, error: "mode" }, 400);
  } catch (e) { return json({ ok: false, error: String((e as Error).message).slice(0, 400) }, 500); }
});
