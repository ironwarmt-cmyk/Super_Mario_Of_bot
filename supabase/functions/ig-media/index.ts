// ig-media: podpisane adresy do wgrania plików Instagram do publicznego bucketu "ig".
// Autoryzacja: nagłówek x-ig-secret = platform_config.ig_upload_secret.secret
import { createClient } from "jsr:@supabase/supabase-js@2";

const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
const json = (b: unknown, s = 200) => new Response(JSON.stringify(b), { status: s, headers: { "content-type": "application/json" } });
const SAFE = /^(daily\/\d{4}-\d{2}-\d{2}\/[a-z0-9._-]{1,120}|recall\/[a-z0-9._-]{1,120})$/;

Deno.serve(async (req) => {
  if (req.method !== "POST") return json({ ok: false, error: "method" }, 405);
  const { data: cfg } = await db.from("platform_config").select("value").eq("key", "ig_upload_secret").maybeSingle();
  const secret = (cfg?.value as { secret?: string } | null)?.secret;
  if (!secret || req.headers.get("x-ig-secret") !== secret) return json({ ok: false, error: "unauthorized" }, 401);
  const body = await req.json().catch(() => ({}));
  if (body.action === "sign") {
    const paths: string[] = Array.isArray(body.paths) ? body.paths.slice(0, 30) : [];
    const out: Record<string, unknown> = {};
    for (const p of paths) {
      if (!SAFE.test(p)) { out[p] = { error: "bad path" }; continue; }
      const { data, error } = await db.storage.from("ig").createSignedUploadUrl(p, { upsert: true });
      out[p] = error ? { error: error.message } : { url: data.signedUrl, token: data.token };
    }
    return json({ ok: true, uploads: out });
  }
  if (body.action === "cleanup") {
    const keepDays = Math.max(3, Number(body.keep_days) || 10);
    const cutoff = new Date(Date.now() - keepDays * 864e5).toISOString().slice(0, 10);
    const { data: dirs } = await db.storage.from("ig").list("daily", { limit: 1000 });
    const removed: string[] = [];
    for (const d of dirs ?? []) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(d.name) || d.name >= cutoff) continue;
      const { data: files } = await db.storage.from("ig").list(`daily/${d.name}`, { limit: 100 });
      const paths = (files ?? []).map((f) => `daily/${d.name}/${f.name}`);
      if (paths.length) { await db.storage.from("ig").remove(paths); removed.push(d.name); }
    }
    return json({ ok: true, removed });
  }
  return json({ ok: false, error: "action" }, 400);
});
