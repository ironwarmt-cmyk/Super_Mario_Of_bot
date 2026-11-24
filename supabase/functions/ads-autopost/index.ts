// ads-autopost: reklamy pakietów Jem Bezpiecznie (Basic, PRO, Premium, Firma) na Instagramie, Facebooku i TikToku.
// Media: qasupport.jembezpiecznie.com/ig/ads/ (repo Super_Mario_Of_bot, public/ig/ads, manifest.json).
// Tryby (body.mode):
//   check  – sprawdź dostęp (konto IG, strona Facebook, TikTok)
//   queue  – opublikuj następną pozycję z kolejki „start” (dzień startu: filmy + karuzele na 3 platformach)
//   daily  – karuzela dnia (pakiety po kolei) na IG, FB i TikToku
//   dry    – pokaż kolejkę i karuzelę dnia bez publikowania
// Każda publikacja najwyżej raz (ig_autopost_log, klucz ads:...). Autoryzacja jak ig-autopost (x-autopost-key). Autor: MT
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const IG = "17841452533483595"; // jem_bezpiecznie
const GRAPH = "https://graph.facebook.com/v23.0";
const TT = "https://open.tiktokapis.com/v2";
const MANIFEST = ["https://qasupport.jembezpiecznie.com/ig/ads/manifest.json", "https://supermarioofbot-iron-war.vercel.app/ig/ads/manifest.json"];
const NOTIFY_API = "https://qasupport.jembezpiecznie.com/api/community?mode=ig_notify";
const PRIVACY_ORDER = ["PUBLIC_TO_EVERYONE", "MUTUAL_FOLLOW_FRIENDS", "FOLLOWER_OF_CREATOR", "SELF_ONLY"];
const UNAUDITED = /unaudited_client/i;
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const warsawDate = () => new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Warsaw" }).format(new Date());
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
let botSecret = "";
async function notify(items: unknown[]) {
  if (!botSecret || !items.length) return;
  await fetch(NOTIFY_API, { method: "POST", headers: { "content-type": "application/json", "x-bot-secret": botSecret }, body: JSON.stringify({ items }), signal: AbortSignal.timeout(30000) }).catch(() => {});
}
async function manifest() {
  let last: unknown = null;
  for (const u of MANIFEST) {
    try { const r = await fetch(u + "?v=" + Date.now(), { signal: AbortSignal.timeout(15000) }); if (r.ok) return await r.json(); last = new Error("manifest HTTP " + r.status); } catch (e) { last = e; }
  }
  throw last instanceof Error ? last : new Error("manifest niedostępny");
}

// ---------- Meta Graph (token systemowy JB Social) ----------
async function userToken() {
  const { data } = await db.from("platform_config").select("value").eq("key", "ig_token").maybeSingle();
  const t = (data?.value as any)?.token as string | undefined;
  if (!t) throw new Error("brak tokenu Graph (ig_token)");
  return t;
}
async function gGet(tok: string, path: string) {
  const r = await fetch(`${GRAPH}/${path}`, { headers: { authorization: `Bearer ${tok}` }, signal: AbortSignal.timeout(30000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("graph: " + (d?.error?.message || r.status));
  return d;
}
async function gPost(tok: string, path: string, params: Record<string, unknown>) {
  const r = await fetch(`${GRAPH}/${path}`, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json" }, body: JSON.stringify(params), signal: AbortSignal.timeout(120000) });
  const d = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error("graph: " + (d?.error?.message || r.status));
  return d;
}
async function igReady(tok: string, id: string, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const d = await gGet(tok, `${id}?fields=status_code`);
    if (d.status_code === "FINISHED") return;
    if (d.status_code === "ERROR" || d.status_code === "EXPIRED") throw new Error(`graph: kontener ${d.status_code}`);
    await sleep(3000);
  }
  throw new Error("graph: kontener nie jest gotowy");
}
// Strona Facebook połączona z kontem Instagram (token strony z /me/accounts).
async function fbPage() {
  const { data } = await db.from("platform_config").select("value").eq("key", "fb_page").maybeSingle();
  const v = data?.value as any;
  if (v?.id && v?.token) return v as { id: string; name: string; token: string };
  const tok = await userToken();
  const acc = await gGet(tok, "me/accounts?fields=id,name,access_token,instagram_business_account&limit=50");
  const pages = acc.data || [];
  const page = pages.find((p: any) => p.instagram_business_account?.id === IG) || pages[0];
  if (!page) throw new Error("token nie ma dostępu do żadnej strony Facebook (potrzebne pages_manage_posts i strona przypisana do aplikacji JB Social)");
  const val = { id: page.id, name: page.name, token: page.access_token };
  await db.from("platform_config").upsert({ key: "fb_page", value: val });
  return val;
}

async function igReel(ad: any) {
  const tok = await userToken();
  const c = await gPost(tok, `${IG}/media`, { media_type: "REELS", video_url: ad.video, caption: ad.caption_video, share_to_feed: true, cover_url: ad.cover });
  await igReady(tok, c.id, 45);
  const p = await gPost(tok, `${IG}/media_publish`, { creation_id: c.id });
  return `IG rolka ${p.id}`;
}
async function igCarousel(ad: any) {
  const tok = await userToken();
  const kids: string[] = [];
  for (const url of ad.slides) { const c = await gPost(tok, `${IG}/media`, { image_url: url, is_carousel_item: true }); kids.push(c.id); }
  for (const k of kids) await igReady(tok, k, 15);
  const box = await gPost(tok, `${IG}/media`, { media_type: "CAROUSEL", children: kids.join(","), caption: ad.caption_carousel });
  await igReady(tok, box.id, 15);
  const p = await gPost(tok, `${IG}/media_publish`, { creation_id: box.id });
  return `IG karuzela ${p.id}`;
}
async function fbVideo(ad: any) {
  const pg = await fbPage();
  const d = await gPost(pg.token, `${pg.id}/videos`, { file_url: ad.video, description: ad.caption_video, title: ad.title });
  return `FB film ${d.id}`;
}
async function fbAlbum(ad: any) {
  const pg = await fbPage();
  const ids: string[] = [];
  for (const url of ad.slides) { const ph = await gPost(pg.token, `${pg.id}/photos`, { url, published: false }); ids.push(ph.id); }
  const d = await gPost(pg.token, `${pg.id}/feed`, { message: ad.caption_carousel, attached_media: ids.map((id) => ({ media_fbid: id })) });
  return `FB karuzela zdjęć ${d.id}`;
}

// ---------- TikTok (Content Posting API, te same tokeny co tiktok-autopost) ----------
const appSecret = async (which: string) => (await db.rpc("tiktok_app_secret", { which })).data as string;
async function ttToken() {
  const { data: a } = await db.from("tiktok_auth").select("*").eq("id", "main").maybeSingle();
  if (!a?.refresh_token) throw new Error("TikTok niepołączony – /tt_polacz w bocie");
  if (a.access_token && Date.parse(a.access_expires_at) - Date.now() > 10 * 60000) return { tok: a.access_token as string, scope: String(a.scope || "") };
  const r = await fetch(`${TT}/oauth/token/`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: await appSecret("key"), client_secret: await appSecret("secret"), grant_type: "refresh_token", refresh_token: a.refresh_token }) });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.access_token) throw new Error("TikTok token: " + (t.error_description || t.error || r.status));
  const now = Date.now();
  await db.from("tiktok_auth").update({ access_token: t.access_token, refresh_token: t.refresh_token || a.refresh_token,
    access_expires_at: new Date(now + (t.expires_in || 86400) * 1000).toISOString(),
    refresh_expires_at: new Date(now + (t.refresh_expires_in || 31536000) * 1000).toISOString(), updated_at: new Date().toISOString() }).eq("id", "main");
  return { tok: t.access_token as string, scope: String(a.scope || "") };
}
async function tt(path: string, tok: string, body: unknown) {
  const r = await fetch(TT + path, { method: "POST", headers: { authorization: `Bearer ${tok}`, "content-type": "application/json; charset=UTF-8" }, body: JSON.stringify(body) });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || (j.error?.code && j.error.code !== "ok")) throw new Error(`TikTok ${path}: ${j.error?.code || r.status} ${j.error?.message || ""}`.trim());
  return j.data;
}
async function ttPrivacy(tok: string, scope: string) {
  if (!scope.includes("video.publish")) return "";
  const info = await tt("/post/publish/creator_info/query/", tok, {});
  const o: string[] = info.privacy_level_options || [];
  return PRIVACY_ORDER.find((p) => o.includes(p)) || "SELF_ONLY";
}
async function ttVideo(ad: any, url = ad.video, what = "film") {
  const { tok, scope } = await ttToken();
  let privacy = await ttPrivacy(tok, scope);
  const bytes = new Uint8Array(await (await fetch(url, { signal: AbortSignal.timeout(60000) })).arrayBuffer());
  const source_info = { source: "FILE_UPLOAD", video_size: bytes.length, chunk_size: bytes.length, total_chunk_count: 1 };
  let init: any = null;
  if (privacy) {
    try {
      init = await tt("/post/publish/video/init/", tok, { post_info: { title: ad.caption_tt.slice(0, 2200), privacy_level: privacy, disable_comment: false, disable_duet: false, disable_stitch: false, video_cover_timestamp_ms: 1500, brand_organic_toggle: true }, source_info });
    } catch (e) { if (!UNAUDITED.test(String((e as Error).message))) throw e; privacy = ""; }
  }
  if (!init) init = await tt("/post/publish/inbox/video/init/", tok, { source_info });
  const up = await fetch(init.upload_url, { method: "PUT", headers: { "content-type": "video/mp4", "content-range": `bytes 0-${bytes.length - 1}/${bytes.length}` }, body: bytes });
  if (!up.ok) throw new Error("TikTok upload: " + up.status);
  return `TikTok ${privacy ? what + " " + privacy : "szkic (" + what + ") w skrzynce"} ${init.publish_id}`;
}
async function ttPhoto(ad: any) {
  const { tok, scope } = await ttToken();
  let privacy = await ttPrivacy(tok, scope);
  const body = (d: boolean) => ({
    post_info: { title: ad.title.slice(0, 90), description: ad.caption_tt.slice(0, 4000), disable_comment: false, auto_add_music: true, brand_organic_toggle: true, ...(d ? { privacy_level: privacy } : {}) },
    source_info: { source: "PULL_FROM_URL", photo_cover_index: 0, photo_images: ad.slides },
    post_mode: d ? "DIRECT_POST" : "MEDIA_UPLOAD", media_type: "PHOTO",
  });
  let init: any;
  try {
    try { init = await tt("/post/publish/content/init/", tok, body(Boolean(privacy))); }
    catch (e) { if (!privacy || !UNAUDITED.test(String((e as Error).message))) throw e; privacy = ""; init = await tt("/post/publish/content/init/", tok, body(false)); }
  } catch (e) {
    // Bez weryfikacji domeny w TikToku posty zdjęciowe nie przechodzą – wtedy karuzela jako film-pokaz slajdów.
    if (/url_ownership_unverified/i.test(String((e as Error).message)) && ad.slideshow) return ttVideo(ad, ad.slideshow, "karuzela (pokaz slajdów)");
    throw e;
  }
  return `TikTok ${privacy ? "karuzela " + privacy : "szkic karuzeli w skrzynce"} ${init.publish_id}`;
}

const RUN: Record<string, (ad: any) => Promise<string>> = { ig_reel: igReel, ig_carousel: igCarousel, fb_video: fbVideo, fb_album: fbAlbum, tt_video: (ad: any) => ttVideo(ad), tt_photo: ttPhoto };
const LABEL: Record<string, string> = { ig_reel: "Instagram – rolka", ig_carousel: "Instagram – karuzela", fb_video: "Facebook – film", fb_album: "Facebook – karuzela zdjęć", tt_video: "TikTok – film", tt_photo: "TikTok – karuzela zdjęć" };

async function once(key: string, kind: string, ad: any) {
  const { error } = await db.from("ig_autopost_log").insert({ key, kind: "ads", request: { kind, ad: ad.id }, status: "started" });
  if (error) return { key, skipped: "już było" };
  try {
    const text = await RUN[kind](ad);
    await db.from("ig_autopost_log").update({ status: "published", result: { text }, updated_at: new Date().toISOString() }).eq("key", key);
    await notify([{ kind: "ads", what: `${LABEL[kind]} · reklama ${ad.name}`, title: ad.title, caption: text }]);
    return { key, published: text };
  } catch (e) {
    const msg = String((e as Error).message).slice(0, 400);
    await db.from("ig_autopost_log").delete().eq("key", key);
    await db.from("ig_autopost_log").upsert({ key: `error:${key}:${Date.now()}`, kind: "error", request: { kind, ad: ad.id }, status: "error", result: { error: msg } });
    await notify([{ kind: "ads", error: msg, what: `${LABEL[kind]} · reklama ${ad.name}` }]);
    return { key, error: msg };
  }
}

// Kolejka dnia startu: każda reklama jako film i jako karuzela na trzech platformach; jedna pozycja na przebieg.
async function queue(dry: boolean) {
  const m = await manifest();
  const items: { key: string; kind: string; ad: any }[] = [];
  for (const ad of m.ads) for (const kind of m.start_kinds) items.push({ key: `ads:start:${ad.id}:${kind}`, kind, ad });
  const { data: done } = await db.from("ig_autopost_log").select("key").like("key", "ads:start:%");
  const have = new Set((done || []).map((x: any) => x.key));
  // pozycje z błędem 3× pomijamy, żeby nie blokowały kolejki
  const { data: errs } = await db.from("ig_autopost_log").select("key").like("key", "error:ads:start:%");
  const fails: Record<string, number> = {};
  for (const e of errs || []) { const k = String(e.key).replace(/^error:/, "").replace(/:\d+$/, ""); fails[k] = (fails[k] || 0) + 1; }
  // Facebook: dopóki token nie ma dostępu do strony, pozycje FB czekają (dogonią, gdy dostęp się pojawi).
  const fbOk = await fbPage().then(() => true).catch(() => false);
  const next = items.find((i) => !have.has(i.key) && (fails[i.key] || 0) < 3 && (fbOk || !i.kind.startsWith("fb_")));
  if (dry) return { fb: fbOk, left: items.filter((i) => !have.has(i.key)).map((i) => i.key), next: next?.key || null };
  if (!next) return { done: true };
  return once(next.key, next.kind, next.ad);
}

// Karuzela dnia: pakiety po kolei (od dnia po starcie), na wszystkich platformach z manifest.daily_kinds.
async function daily(dry: boolean, only?: string) {
  const m = await manifest();
  const today = warsawDate();
  const n = Math.floor((Date.parse(today) - Date.parse(m.daily_from)) / 864e5);
  if (n < 0) return { skipped: "karuzele codzienne startują " + m.daily_from };
  const ad = m.ads[((n % m.ads.length) + m.ads.length) % m.ads.length];
  const kinds = (m.daily_kinds as string[]).filter((k) => !only || k === only);
  if (dry) return { ad: ad.id, kinds };
  if (kinds.some((k) => k.startsWith("fb_")) && !(await fbPage().then(() => true).catch(() => false))) return { ad: ad.id, skipped: "Facebook: brak dostępu do strony" };
  const out = [];
  for (const k of kinds) out.push(await once(`ads:daily:${today}:${k}`, k, ad));
  return { ad: ad.id, out };
}

async function check() {
  const out: Record<string, unknown> = {};
  try { const tok = await userToken(); out.ig = await gGet(tok, `${IG}?fields=username,media_count`); out.me = await gGet(tok, "me?fields=id,name"); out.perms = (await gGet(tok, "me/permissions")).data?.filter((p: any) => p.status === "granted").map((p: any) => p.permission); } catch (e) { out.ig_error = String((e as Error).message); }
  try { const p = await fbPage(); out.fb = { id: p.id, name: p.name }; } catch (e) { out.fb_error = String((e as Error).message); }
  try { const { scope } = await ttToken(); out.tt = { scope }; } catch (e) { out.tt_error = String((e as Error).message); }
  return out;
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
    if (body.mode === "check") return json({ ok: true, check: await check() });
    if (body.mode === "queue") return json({ ok: true, queue: await queue(dry) });
    if (body.mode === "daily") return json({ ok: true, daily: await daily(dry, body.only) });
    return json({ ok: false, error: "mode" }, 400);
  } catch (e) { return json({ ok: false, error: String((e as Error).message).slice(0, 400) }, 500); }
});
