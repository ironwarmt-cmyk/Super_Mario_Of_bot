export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      service: "Super_Mario_Official_bot",
      tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN)
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({
      ok: false,
      error: "Method not allowed"
    });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: "TELEGRAM_BOT_TOKEN is not configured"
    });
  }

  return res.status(200).json({ ok: true });
}
