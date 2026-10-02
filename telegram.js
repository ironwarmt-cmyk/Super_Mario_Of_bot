export default async function handler(req, res) {
  if (req.method === 'GET') {
    return res.status(200).json({
      ok: true,
      service: '@Super_Mario_Official_bot backend',
      tokenConfigured: Boolean(process.env.TELEGRAM_BOT_TOKEN)
    });
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET, POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return res.status(503).json({
      ok: false,
      error: 'TELEGRAM_BOT_TOKEN is not configured yet'
    });
  }

  const update = req.body || {};
  const message = update.message;

  if (message?.chat?.id) {
    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    const replyText = text === '/start'
      ? 'Cześć! Bot jest podłączony. Menu i kolejne funkcje dodamy w następnym kroku.'
      : 'Bot działa. Napisz /start.';

    const tgResp = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text: replyText })
    });

    if (!tgResp.ok) {
      const body = await tgResp.text();
      console.error('Telegram API error:', body);
    }
  }

  return res.status(200).json({ ok: true });
}
