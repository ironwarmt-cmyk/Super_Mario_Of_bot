// ============================================================
//  QASUPPORT – społeczność na Telegramie, zarządzana przez @MT_Social_Control_bot
//  Wejście: /api/community?mode=...  (rewrite do /api/telegram?channel=community)
//  Tryby (?mode=):
//    status  – (strona/portal, Bearer) pakiet, nick i grupy zalogowanego użytkownika
//    link    – (strona/portal, Bearer) jednorazowy link do bota, który łączy konto z Telegramem
//    webhook – aktualizacje od Telegrama (wiadomości, prośby o dołączenie)
//    sweep   – codzienny cron: pilnuje, żeby każdy był tylko w grupach swojego pakietu
//    setup   – jednorazowo: zapis hasha tokenu, webhook i komendy bota
// ============================================================
import crypto from "node:crypto";
import { resolveQualityIdentity } from "./quality-auth.js";
import { PUBLIC_URL, SITE_URL } from "./brand.js";

const BOT_USERNAME = "MT_Social_Control_bot";
const EDGE_URL = "https://ixivedtgqgryawxsxnqd.supabase.co/functions/v1/quality-community-db";
const WEBHOOK_BASE = (process.env.PUBLIC_BASE_URL || "https://supermarioofbot-iron-war.vercel.app").replace(/\/$/, "");
const ALLOWED_ORIGINS = [SITE_URL, "https://www.jembezpiecznie.com", PUBLIC_URL];

export const TIERS = {
  regular: { rank: 0, label: "FREE",  dot: "⚪", title: "QASUPPORT Społeczność" },
  basic:   { rank: 1, label: "BASIC", dot: "🟢", title: "QASUPPORT BASIC" },
  pro:     { rank: 2, label: "PRO",   dot: "🔵", title: "QASUPPORT PRO" },
  vip:     { rank: 3, label: "VIP",   dot: "🟣", title: "QASUPPORT VIP" }
};

// Wątki tematyczne tworzone automatycznie w każdej grupie (forum).
export const TOPICS = {
  regular: [
    ["welcome", "👋 Powitalnia", "Przedstaw się. Bot wita tu każdego nowego członka."],
    ["news", "📢 Ogłoszenia", "Nowości QASUPPORT i Jem Bezpiecznie. Piszą tylko administratorzy."],
    ["alerts", "🚨 Alerty GIS i wycofania", "Wycofania z rynku i ostrzeżenia GIS, opracowane przez agenta."],
    ["general", "💬 Pytania ogólne", "Pytania o bezpieczeństwo żywności i etykiety."],
    ["game", "🎮 Myszka Audytorka", "Wyniki, porady i wyzwania z gry audytowej."]
  ],
  basic: [
    ["welcome", "👋 Powitalnia BASIC", "Start w grupie BASIC."],
    ["docs", "📄 Dokumenty i wzory", "Praca z dokumentami z biblioteki BASIC."],
    ["haccp", "🧪 HACCP w praktyce", "Analiza zagrożeń, CCP, GMP/GHP."],
    ["training", "🎓 Szkolenia podstawowe", "Pytania do szkoleń z Akademii Jakości."],
    ["qa", "❓ Pytania BASIC", "Pytania do społeczności i moderatorów."]
  ],
  pro: [
    ["welcome", "👋 Powitalnia PRO", "Start w grupie PRO."],
    ["brcgs", "🏆 BRCGS", "Wymagania BRCGS Food Safety, interpretacje, przygotowanie."],
    ["ifs", "🛡 IFS Food", "Wymagania IFS, KO, scoring."],
    ["audits", "🔍 Audyty i niezgodności", "Przebieg audytów, typowe niezgodności, odwołania."],
    ["capa", "🛠 CAPA", "Analiza przyczyn i działania korygujące."],
    ["suppliers", "🤝 Dostawcy i reklamacje", "Ocena dostawców, reklamacje klientów."],
    ["labels", "🏷 Etykiety i prawo", "Rozporządzenie 1169/2011, oświadczenia, dodatki."]
  ],
  vip: [
    ["welcome", "👋 Powitalnia VIP", "Start w strefie VIP."],
    ["expert", "💎 Strefa ekspercka", "Scenariusze eksperckie i trudne przypadki."],
    ["playbook", "📘 Quality Manager Playbook", "Praca z playbookiem VIP."],
    ["cases", "🧭 Konsultacje i case study", "Omówienia przypadków z zakładów."],
    ["emergency", "🚑 Emergency – audyt za chwilę", "Szybka pomoc przed audytem."],
    ["briefs", "📈 Briefy branżowe", "Zmiany w prawie i standardach, trendy."]
  ]
};

const rank = (t) => TIERS[t]?.rank ?? 0;
const token = () => process.env.MT_SOCIAL_BOT_TOKEN || "";
const sha = (v) => crypto.createHash("sha256").update(v).digest("hex");
export function memberTag(tier, nick) {
  // Tag członka w Telegramie: max 16 znaków, bez emoji, np. "VIP Mario".
  return `${TIERS[tier]?.label || "FREE"} ${String(nick || "").replace(/\p{Extended_Pictographic}/gu, "")}`.trim().slice(0, 16);
}

async function edge(action, payload = {}) {
  const r = await fetch(EDGE_URL, {
    method: "POST",
    headers: { "content-type": "application/json", "x-community-secret": sha(token()) },
    body: JSON.stringify({ action, ...payload }),
    signal: AbortSignal.timeout(8000)
  });
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d.ok) { const e = new Error(d.error || `HTTP ${r.status}`); e.status = r.status; throw e; }
  return d.data;
}

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${token()}/${method}`, {
    method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body || {}),
    signal: AbortSignal.timeout(8000)
  });
  const d = await r.json().catch(() => ({}));
  if (!d.ok) throw new Error(`${method}: ${d.description || r.status}`);
  return d.result;
}
const say = (chat_id, text, extra = {}) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...extra }).catch((e) => console.error(e.message));
const esc = (s = "") => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function cors(req, res) {
  const origin = req.headers.origin || "";
  if (ALLOWED_ORIGINS.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "content-type, authorization");
    res.setHeader("Access-Control-Max-Age", "600");
  }
}

// ---------------- grupy i zaproszenia ----------------
async function sendInvites(chatId, member) {
  const groups = (await edge("list_groups")).filter((g) => g.telegram_chat_id && rank(g.tier) <= rank(member.tier))
    .sort((a, b) => rank(a.tier) - rank(b.tier));
  const t = TIERS[member.tier] || TIERS.regular;
  if (!groups.length) {
    return say(chatId, `${t.dot} Twój pakiet: <b>${t.label}</b>, nick: <b>${esc(member.nickname)}</b>.\n\nGrupy są właśnie przygotowywane. Dam ci znać, gdy ruszą.`);
  }
  const rows = [];
  for (const g of groups) {
    try {
      const link = await tg("createChatInviteLink", {
        chat_id: g.telegram_chat_id, creates_join_request: true,
        name: `${member.nickname}`.slice(0, 32), expire_date: Math.floor(Date.now() / 1000) + 3600
      });
      rows.push([{ text: `${TIERS[g.tier].dot} ${TIERS[g.tier].title}`, url: link.invite_link }]);
    } catch (e) { console.error("invite", g.tier, e.message); }
  }
  return say(chatId,
    `${t.dot} Pakiet: <b>${t.label}</b> · nick: <b>${esc(member.nickname)}</b>\n\n` +
    `Masz dostęp do ${groups.length === 1 ? "tej grupy" : "tych grup"}. Kliknij i poproś o dołączenie, a ja od razu cię wpuszczę i nadam tag <b>${esc(memberTag(member.tier, member.nickname))}</b>.\n` +
    `Linki są ważne godzinę. Nowe dostaniesz komendą /grupy.`,
    { reply_markup: { inline_keyboard: rows } });
}

async function applyTag(chatId, userId, tier, nick) {
  try { await tg("setChatMemberTag", { chat_id: chatId, user_id: userId, tag: memberTag(tier, nick) }); }
  catch (e) { console.error("tag", e.message); }
}

async function setupGroup(msg, tier) {
  const chat = msg.chat;
  const topics = {};
  if (chat.is_forum) {
    for (const [key, name, desc] of TOPICS[tier]) {
      try {
        const topic = await tg("createForumTopic", { chat_id: chat.id, name });
        topics[key] = topic.message_thread_id;
        const m = await tg("sendMessage", { chat_id: chat.id, message_thread_id: topic.message_thread_id, text: `${name}\n\n${desc}` });
        await tg("pinChatMessage", { chat_id: chat.id, message_id: m.message_id, disable_notification: true }).catch(() => {});
      } catch (e) { console.error("topic", name, e.message); }
    }
  }
  await edge("set_group", { tier, telegram_chat_id: chat.id, title: chat.title || TIERS[tier].title, topics });
  return say(chat.id,
    `Ta grupa to teraz <b>${TIERS[tier].title}</b> (${TIERS[tier].dot} ${TIERS[tier].label}).\n` +
    (chat.is_forum ? `Utworzyłem wątki: ${TOPICS[tier].map((x) => x[1]).join(", ")}.` :
      "Włącz w ustawieniach grupy „Tematy” (Topics) i wpisz komendę jeszcze raz, żeby utworzyć wątki."));
}

// ---------------- obsługa aktualizacji ----------------
async function onPrivate(msg) {
  const chatId = msg.chat.id, userId = msg.from.id;
  const text = String(msg.text || "").trim();
  const [cmdRaw, ...args] = text.split(/\s+/);
  const cmd = cmdRaw.startsWith("/") ? cmdRaw.split("@")[0].toLowerCase() : "";

  if (cmd === "/start" && /^[a-f0-9]{24}$/.test(args[0] || "")) {
    try {
      const { member } = await edge("consume_link_token", { token: args[0], telegram_user_id: userId });
      if (!member.nickname) {
        return say(chatId, "Konto QASUPPORT połączone ✅\n\nWybierz <b>nick</b>, pod którym będą cię widzieć inni członkowie (2–10 znaków: litery, cyfry, spacja, kropka, myślnik). Napisz go teraz w wiadomości.");
      }
      return sendInvites(chatId, member);
    } catch (e) {
      return say(chatId, `Link wygasł albo był już użyty. Zaloguj się na <a href="${SITE_URL}/#portal">jembezpiecznie.com</a> i kliknij jeszcze raz „Dołącz do grupy”.`);
    }
  }

  const member = await edge("get_member", { telegram_user_id: userId }).catch(() => null);
  if (!member) {
    return say(chatId,
      "Cześć! Jestem botem społeczności <b>QASUPPORT</b>.\n\n" +
      `Żeby dołączyć do grupy: zaloguj się w portalu na <a href="${SITE_URL}/#portal">jembezpiecznie.com</a> (albo załóż darmowe konto) i kliknij „Dołącz do grupy na Telegramie”. Sprawdzę twój pakiet i wpuszczę cię do właściwych grup.`);
  }

  if (member.state === "await_nick" && !cmd) {
    try {
      const updated = await edge("set_nickname", { telegram_user_id: userId, nickname: text });
      return sendInvites(chatId, { ...updated, tier: member.tier });
    } catch (e) {
      return say(chatId, e.status === 409 ? "Ten nick jest już zajęty. Wybierz inny." : "Nick musi mieć 2–10 znaków: litery, cyfry, spacja, kropka lub myślnik. Spróbuj jeszcze raz.");
    }
  }

  if (cmd === "/nick") {
    const nick = args.join(" ");
    try {
      const updated = await edge("set_nickname", { telegram_user_id: userId, nickname: nick });
      for (const c of member.joined_chats || []) await applyTag(c, userId, member.tier, updated.nickname);
      return say(chatId, `Nowy nick: <b>${esc(updated.nickname)}</b>. Tag w grupach: <b>${esc(memberTag(member.tier, updated.nickname))}</b>.`);
    } catch (e) {
      return say(chatId, e.status === 409 ? "Ten nick jest już zajęty." : "Użycie: /nick NowyNick (2–10 znaków).");
    }
  }

  if (cmd === "/grupy" || cmd === "/status" || cmd === "/start") return sendInvites(chatId, member);

  return say(chatId,
    "Komendy:\n/grupy – linki do twoich grup\n/status – twój pakiet i tag\n/nick NowyNick – zmiana nicku\n\n" +
    `Zmiana pakietu: portal na <a href="${SITE_URL}/#portal">jembezpiecznie.com</a>. Po zakupie wpisz /grupy.`);
}

async function onJoinRequest(req) {
  const chatId = req.chat.id, userId = req.from.id;
  const groups = await edge("list_groups");
  const group = groups.find((g) => Number(g.telegram_chat_id) === Number(chatId));
  const member = await edge("get_member", { telegram_user_id: userId }).catch(() => null);
  const dm = req.user_chat_id || userId;
  if (!group) return;
  if (!member || !member.nickname || rank(member.tier) < rank(group.tier)) {
    await tg("declineChatJoinRequest", { chat_id: chatId, user_id: userId }).catch(() => {});
    return say(dm, member
      ? `Grupa <b>${TIERS[group.tier].title}</b> jest dla pakietu ${TIERS[group.tier].label} i wyższych. Twój pakiet: ${TIERS[member.tier].label}. Zmienisz go w portalu na <a href="${SITE_URL}/#portal">jembezpiecznie.com</a>.`
      : `Najpierw połącz konto: portal na <a href="${SITE_URL}/#portal">jembezpiecznie.com</a> → „Dołącz do grupy na Telegramie”.`);
  }
  await tg("approveChatJoinRequest", { chat_id: chatId, user_id: userId });
  await applyTag(chatId, userId, member.tier, member.nickname);
  const joined = Array.from(new Set([...(member.joined_chats || []).map(Number), Number(chatId)]));
  await edge("set_joined", { telegram_user_id: userId, joined_chats: joined }).catch(() => {});
  const t = TIERS[member.tier];
  const thread = group.topics?.welcome;
  await say(chatId, `Witamy <b>${esc(member.nickname)}</b> ${t.dot} ${t.label} 👋`, thread ? { message_thread_id: thread } : {});
}

async function onGroupMessage(msg) {
  const text = String(msg.text || "").trim();
  const m = text.match(/^\/ustaw(?:@\w+)?\s+(free|regular|basic|pro|vip)$/i);
  if (!m) return;
  const isAdmin = await edge("is_admin", { telegram_user_id: msg.from.id }).catch(() => false);
  if (!isAdmin) return;
  const tier = m[1].toLowerCase() === "free" ? "regular" : m[1].toLowerCase();
  return setupGroup(msg, tier);
}

// ---------------- codzienne sprzątanie ----------------
async function sweep() {
  const groups = (await edge("list_groups")).filter((g) => g.telegram_chat_id);
  const members = await edge("list_members_for_sweep");
  let removed = 0, retagged = 0;
  for (const m of members) {
    const joined = [];
    for (const g of groups) {
      let status = "left";
      try { status = (await tg("getChatMember", { chat_id: g.telegram_chat_id, user_id: m.telegram_user_id })).status; } catch { /* brak */ }
      if (!["member", "restricted"].includes(status)) { if (["administrator", "creator"].includes(status)) joined.push(Number(g.telegram_chat_id)); continue; }
      if (rank(g.tier) > rank(m.tier)) {
        await tg("banChatMember", { chat_id: g.telegram_chat_id, user_id: m.telegram_user_id, until_date: Math.floor(Date.now() / 1000) + 60 }).catch(() => {});
        await tg("unbanChatMember", { chat_id: g.telegram_chat_id, user_id: m.telegram_user_id, only_if_banned: true }).catch(() => {});
        removed++;
      } else {
        joined.push(Number(g.telegram_chat_id));
        if (m.previous_tier !== m.tier) { await applyTag(g.telegram_chat_id, m.telegram_user_id, m.tier, m.nickname); retagged++; }
      }
    }
    await edge("set_joined", { telegram_user_id: m.telegram_user_id, joined_chats: joined }).catch(() => {});
    if (m.previous_tier !== m.tier) {
      const t = TIERS[m.tier];
      await say(m.telegram_user_id, rank(m.tier) > rank(m.previous_tier)
        ? `Twój pakiet to teraz ${t.dot} <b>${t.label}</b>. Wpisz /grupy, żeby dołączyć do nowych grup.`
        : `Twój pakiet zmienił się na ${t.dot} <b>${t.label}</b>. Dostęp do grup wyższych pakietów został zamknięty. Przedłużysz go w portalu na ${SITE_URL}.`);
    }
  }
  return { checked: members.length, removed, retagged };
}

// ---------------- handler ----------------
export async function communityHandler(req, res) {
  cors(req, res);
  if (req.method === "OPTIONS") return res.status(204).end();
  const mode = String(req.query?.mode || "");
  if (!token()) return res.status(503).json({ ok: false, error: "MT_SOCIAL_BOT_TOKEN is not configured" });

  try {
    if (mode === "status" || mode === "link") {
      if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
      const identity = await resolveQualityIdentity(req);
      if (!identity?.telegramUserId) return res.status(401).json({ ok: false, error: "Zaloguj się do QASUPPORT." });
      const data = await edge(mode === "link" ? "create_link_token" : "member_status", { web_user_id: identity.telegramUserId });
      const out = { ok: true, email: identity.email || null, tier: data.tier, label: TIERS[data.tier].label, period_end: data.period_end,
        nickname: data.member?.nickname || null, groups_joined: (data.member?.joined_chats || []).length };
      if (mode === "link") out.url = `https://t.me/${BOT_USERNAME}?start=${data.token}`;
      return res.status(200).json(out);
    }

    if (mode === "webhook") {
      if (req.headers["x-telegram-bot-api-secret-token"] !== sha(token()).slice(0, 64)) return res.status(401).json({ ok: false });
      const u = req.body || {};
      if (u.message?.chat?.type === "private") await onPrivate(u.message);
      else if (u.message && ["group", "supergroup"].includes(u.message.chat?.type)) await onGroupMessage(u.message);
      else if (u.chat_join_request) await onJoinRequest(u.chat_join_request);
      return res.status(200).json({ ok: true });
    }

    if (mode === "sweep") {
      const secret = process.env.CRON_SECRET;
      const okCron = secret ? req.headers.authorization === `Bearer ${secret}` : /vercel-cron/i.test(req.headers["user-agent"] || "");
      if (!okCron) return res.status(401).json({ ok: false });
      return res.status(200).json({ ok: true, ...(await sweep()) });
    }

    if (mode === "setup") {
      const boot = await fetch(EDGE_URL, { method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "bootstrap", bot_token: token() }) }).then((r) => r.json()).catch((e) => ({ ok: false, error: e.message }));
      const hook = await tg("setWebhook", {
        url: `${WEBHOOK_BASE}/api/telegram?channel=community&mode=webhook`, secret_token: sha(token()).slice(0, 64),
        allowed_updates: ["message", "chat_join_request"], drop_pending_updates: false
      });
      await tg("setMyCommands", { commands: [
        { command: "grupy", description: "Linki do twoich grup" },
        { command: "status", description: "Twój pakiet i tag" },
        { command: "nick", description: "Zmiana nicku" }
      ] });
      await tg("setMyDescription", { description: "Bot społeczności QASUPPORT. Sprawdza pakiet (FREE, BASIC, PRO, VIP), nadaje nick i tag oraz wpuszcza do właściwych grup." }).catch(() => {});
      return res.status(200).json({ ok: true, database: boot.ok ? "ok" : boot.error, webhook: hook });
    }

    return res.status(400).json({ ok: false, error: "Unknown mode" });
  } catch (e) {
    console.error("community", mode, e.message);
    return res.status(mode === "webhook" ? 200 : 500).json({ ok: false, error: e.message });
  }
}
