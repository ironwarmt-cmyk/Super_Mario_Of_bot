export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const chatgptProjectUrl = String(
    process.env.CHATGPT_PROJECT_URL || ""
  ).trim();

  return res.status(200).json({
    ok: true,
    qualityCopilot: {
      provider: "OpenAI",
      apiConfigured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_QUALITY_MODEL || "gpt-6.1-sol"
    },
    chatgptProjectUrl:
      /^https:\/\/chatgpt\.com\//i.test(chatgptProjectUrl)
        ? chatgptProjectUrl
        : null
  });
}
