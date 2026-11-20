// tiktok-auth: jednorazowe połączenie konta TikTok @jembezpiecznie z botem MT Social (link z komendy /tt_polacz).
//   GET ?start=<token>  -> przekierowanie do logowania TikTok (token jednorazowy, jego sha256 w tiktok_auth.start_hash)
//   GET ?code=&state=   -> wymiana kodu na tokeny i zapis w tiktok_auth (tylko service_role)
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const REDIRECT = "https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/tiktok-auth";
const NOTIFY_API = "https://qasupport.jembezpiecznie.com/api/community?mode=ig_notify";
const SCOPES = "user.info.basic,video.upload,video.publish";
// Supabase podaje HTML z funkcji jako zwykły tekst, więc wynik pokazuje strona na qasupport.
const page = (title: string, text: string, _s = 200) => Response.redirect(
  `https://qasupport.jembezpiecznie.com/tiktok/?s=${title.startsWith("TikTok połączony") ? "ok" : "err"}&m=${encodeURIComponent(title + ": " + text)}`, 302);

async function sha256Hex(v: string) {
  const d = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(v));
  return Array.from(new Uint8Array(d)).map((b) => b.toString(16).padStart(2, "0")).join("");
}
const secret = async (which: string) => (await db.rpc("tiktok_app_secret", { which })).data as string;

Deno.serve(async (req) => {
  const u = new URL(req.url);
  const { data: row } = await db.from("tiktok_auth").select("*").eq("id", "main").maybeSingle();
  const start = u.searchParams.get("start");
  if (start) {
    if (!row?.start_hash || (await sha256Hex(start)) !== row.start_hash) return page("Link nieaktualny", "Ten link do połączenia TikToka jest nieprawidłowy albo został już użyty. Wpisz /tt_polacz w bocie, aby dostać nowy.", 403);
    const state = crypto.randomUUID();
    await db.from("tiktok_auth").update({ state, updated_at: new Date().toISOString() }).eq("id", "main");
    const auth = new URL("https://www.tiktok.com/v2/auth/authorize/");
    auth.searchParams.set("client_key", await secret("key"));
    auth.searchParams.set("scope", SCOPES);
    auth.searchParams.set("response_type", "code");
    auth.searchParams.set("redirect_uri", REDIRECT);
    auth.searchParams.set("state", state);
    return Response.redirect(auth.toString(), 302);
  }
  const code = u.searchParams.get("code"), state = u.searchParams.get("state");
  if (u.searchParams.get("error")) return page("Nie połączono", "TikTok zwrócił błąd: " + (u.searchParams.get("error_description") || u.searchParams.get("error"))!.replace(/[<>&]/g, ""), 400);
  if (!code || !state || !row?.state || state !== row.state) return page("Nie połączono", "Brak kodu logowania albo link wygasł. Wpisz /tt_polacz w bocie, aby dostać nowy.", 400);
  const r = await fetch("https://open.tiktokapis.com/v2/oauth/token/", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_key: await secret("key"), client_secret: await secret("secret"), code, grant_type: "authorization_code", redirect_uri: REDIRECT }),
  });
  const t = await r.json().catch(() => ({}));
  if (!r.ok || !t.access_token) return page("Nie połączono", "Wymiana kodu nie powiodła się: " + String(t.error_description || t.error || r.status).replace(/[<>&]/g, ""), 400);
  const now = Date.now();
  await db.from("tiktok_auth").update({
    open_id: t.open_id, access_token: t.access_token, refresh_token: t.refresh_token, scope: t.scope,
    access_expires_at: new Date(now + (t.expires_in || 86400) * 1000).toISOString(),
    refresh_expires_at: new Date(now + (t.refresh_expires_in || 31536000) * 1000).toISOString(),
    start_hash: null, state: null, updated_at: new Date().toISOString(),
  }).eq("id", "main");
  const { data: cfg } = await db.from("platform_config").select("value").eq("key", "bot_auth").maybeSingle();
  const bs = cfg?.value?.secret_hash || "";
  if (bs) await fetch(NOTIFY_API, { method: "POST", headers: { "content-type": "application/json", "x-bot-secret": bs }, body: JSON.stringify({ items: [{ kind: "info", text: "✅ TikTok połączony. Codziennie o 11:00 opublikuję film z planu, a wycofania o 9, 14 i 19 – z polskim lektorem. Każdą publikację zgłoszę tutaj." }] }) }).catch(() => {});
  return page("TikTok połączony ✅", "Gotowe. Bot będzie codziennie sam publikował filmy z polskim lektorem na TikToku. Możesz zamknąć tę stronę.");
});
