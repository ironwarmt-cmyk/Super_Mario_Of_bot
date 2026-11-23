// Kolejka zadań VIP: dokumenty dedykowane i odpowiedzi Quality Copilota pisze Bielik na telefonie. Autor: MT
// Klient od razu dostaje komunikat "w przygotowaniu", a po zakończeniu powiadomienie (Telegram / aplikacja).
// Limit czasu dla Bielika liczony jest z historii: średnia + 2 odchylenia standardowe z ostatnich 50 zadań danego rodzaju.
// Po przekroczeniu limitu zadanie przejmuje AI w chmurze, żeby nic nie utknęło.
import { askPhone } from "./bielik.js";
import { DOC_TYPES, clip, briefFor, companyOf, OUTLINE_PROMPT, SECTION_PROMPT, parseJson, isUsable, cloudDocument, buildDocx, fileNameFor } from "./company-docs.js";
import { createQualityJob, listQualityJobs, getQualityJob, claimQualityJob, saveQualityJob, qualityJobStats, getQualityMembership, useQualityCustomDoc, listQualityAssistantMessages, saveQualityAssistantMessage } from "./db.js";
import { buildQualityAgentInstructions } from "./quality-agents.js";
import { sendMessage } from "./telegram.js";

const PUBLIC_URL = (process.env.QUALITY_PUBLIC_URL || "https://qasupport.jembezpiecznie.com").replace(/\/$/, "");
const MIN_SAMPLES = 5;                                  // poniżej tej liczby pomiarów używamy wartości startowych
const DEFAULT_LIMIT = { document: 20 * 60, answer: 3 * 60 };
const FLOOR = { document: 5 * 60, answer: 60 };          // limit nigdy krótszy niż
const CAP = { document: 60 * 60, answer: 15 * 60 };      // limit nigdy dłuższy niż
const STEP_MAX_MS = 50000;                              // jedno wywołanie telefonu (funkcja Vercel ma 60 s)

export const NOTICE = {
  document: "Twój dokument jest w przygotowaniu. Nasz Copilot opracowuje go dla Twojej firmy i powiadomi Cię, gdy skończy. Możesz zamknąć tę stronę – gotowy plik znajdziesz w „Moich dokumentach”.",
  answer: "Twoja odpowiedź jest w przygotowaniu. Nasz Copilot powiadomi Cię, gdy skończy – odpowiedź pojawi się w tej rozmowie.",
};

/** Limit czasu (s): średnia + 2σ z historii Bielika, min. 1,25 × średnia, w granicach FLOOR..CAP. */
export function limitFor(kind, s) {
  if (!s || s.n < MIN_SAMPLES) return DEFAULT_LIMIT[kind];
  const raw = Math.max(s.mean + 2 * s.sd, s.mean * 1.25);
  return Math.round(Math.min(CAP[kind], Math.max(FLOOR[kind], raw)));
}
/** Szacowany czas dla klienta (s): średnia, gdy jest dość pomiarów. */
export const etaFor = (kind, s) => (s && s.n >= MIN_SAMPLES ? s.mean : null);

const isVip = (m) => m && m.status === "active" && (!m.period_end || Date.parse(m.period_end) > Date.now()) && Number(m.quality_plans?.tier_rank) === 3;

// ---------- Przyjęcie zamówienia ----------

export async function enqueueDocument({ telegramUserId, unlimited, input }) {
  const company = companyOf(input);
  const type = String(input.doc_type || "");
  const typeLabel = DOC_TYPES[type];
  const topic = clip(input.topic, 300);
  if (!company.name || !typeLabel || !topic) return { status: 400, body: { ok: false, error: "Podaj nazwę firmy, rodzaj dokumentu i temat." } };

  if (!unlimited) {
    const m = await getQualityMembership(telegramUserId);
    if (!isVip(m)) return { status: 402, body: { ok: false, code: "plan", error: "Dokumenty przygotowane pod Twoją firmę są w pakiecie VIP. W Twoim pakiecie masz gotowe wzory dokumentów w Bibliotece." } };
    const limit = Number(m.quality_plans?.included_custom_docs || 0);
    const pending = (await listQualityJobs(telegramUserId, "document", 50) || []).filter((j) => j.status === "queued" || j.status === "working").length;
    if (Number(m.custom_docs_used || 0) + pending >= limit) return { status: 429, body: { ok: false, code: "limit", error: `Wykorzystano ${limit} dokumentów w tym okresie (wliczając dokumenty w przygotowaniu).` } };
  }

  const clean = { doc_type: type, standard: clip(input.standard, 80), topic, details: clip(input.details, 2500), company_name: company.name, company_address: company.address, company_profile: company.profile, products: company.products, processes: company.processes, size: company.size, _unlimited: Boolean(unlimited) };
  const job = await createQualityJob(telegramUserId, "document", `${typeLabel.split(" (")[0]}: ${topic}`, clean);
  const stats = await qualityJobStats().catch(() => null);
  return { status: 202, body: { ok: true, queued: true, job, notice: NOTICE.document, eta_seconds: etaFor("document", stats?.document) } };
}

/** Copilot: najpierw krótka próba u Bielika (sync). Gdy telefon nie zdąży, zadanie idzie do kolejki. */
export async function answerOrQueue({ telegramUserId, specialist, locale, message, history, syncMs = 18000 }) {
  const job = await createQualityJob(telegramUserId, "answer", clip(message, 120), { specialist, locale, message });
  const out = await askPhone(answerPrompt(specialist, locale, history, message), { timeoutMs: syncMs });
  if (out && out.text.length > 20) {
    await saveQualityAssistantMessage(telegramUserId, specialist, "assistant", out.text, { engine: "bielik", job_id: job.id });
    await saveQualityJob(job.id, { status: "done", engine: "bielik", result: { text: out.text }, finished_at: new Date().toISOString(), notified_at: new Date().toISOString() });
    return { queued: false, answer: out.text, engine: "bielik" };
  }
  const stats = await qualityJobStats().catch(() => null);
  return { queued: true, job_id: job.id, notice: NOTICE.answer, eta_seconds: etaFor("answer", stats?.answer) };
}

function answerPrompt(specialist, locale, history, message) {
  const past = (history || []).slice(-8).filter((m) => m.content !== message)
    .map((m) => `${m.role === "assistant" ? "Copilot" : "Klient"}: ${clip(m.content, 1200)}`).join("\n");
  return `${buildQualityAgentInstructions(specialist, locale || "pl")}\n\nOdpowiadasz klientowi pakietu VIP. Odpowiedz konkretnie, po ${locale === "en" ? "angielsku" : "polsku"}, bez wymyślania przepisów i numerów norm, których nie jesteś pewien.` +
    (past ? `\n\nDotychczasowa rozmowa:\n${past}` : "") + `\n\nPytanie klienta:\n${message}`;
}

// ---------- Lista, status, plik ----------

export async function jobsFor(telegramUserId, kind) {
  const [jobs, stats] = await Promise.all([listQualityJobs(telegramUserId, kind, 20), qualityJobStats().catch(() => null)]);
  return { jobs: jobs || [], eta_seconds: { document: etaFor("document", stats?.document), answer: etaFor("answer", stats?.answer) } };
}

export async function jobFile(telegramUserId, jobId) {
  const job = await getQualityJob(telegramUserId, jobId);
  if (!job || job.kind !== "document") return { status: 404, body: { ok: false, error: "Nie znaleziono dokumentu." } };
  if (job.status !== "done" || !job.result?.doc) return { status: 409, body: { ok: false, error: "Dokument jest jeszcze w przygotowaniu." } };
  const { doc } = job.result;
  const buf = await buildDocx(doc, companyOf(job.input), { typeLabel: DOC_TYPES[job.input.doc_type] || "Dokument", date: job.result.date });
  return { status: 200, body: { ok: true, file_name: fileNameFor(doc, job.input.topic), file_base64: Buffer.from(buf).toString("base64"), title: doc.title, code: doc.code } };
}

// ---------- Worker (cron co minutę) ----------

export async function processJobs({ cloudAnswer, budgetMs = 50000 }) {
  const deadline = Date.now() + budgetMs, done = [], skip = [];
  while (deadline - Date.now() > 15000) {
    const claimed = await claimQualityJob(skip, 75).catch(() => null);
    if (!claimed?.job) break;
    const { job, stats } = claimed;
    try {
      const r = await stepJob(job, stats, deadline, cloudAnswer);
      done.push({ id: job.id, ...r });
      if (r.waiting) skip.push(job.id);            // telefon nie odpowiedział – spróbujemy w kolejnej minucie
    } catch (e) {
      skip.push(job.id);
      const attempts = Number(job.attempts || 0) + 1;
      const failed = attempts >= 5;
      await saveQualityJob(job.id, { attempts, error: clip(e?.message || e, 300), ...(failed ? { status: "failed", finished_at: new Date().toISOString() } : {}) }).catch(() => {});
      if (failed) await notify(job, false).catch(() => {});
      done.push({ id: job.id, error: clip(e?.message || e, 120) });
    }
  }
  return done;
}

async function stepJob(job, stats, deadline, cloudAnswer) {
  const limit = job.limit_seconds || limitFor(job.kind, stats);
  const ageSec = (Date.now() - Date.parse(job.created_at)) / 1000;
  const useCloud = ageSec > limit;
  const timeoutMs = Math.min(STEP_MAX_MS, deadline - Date.now() - 2000);
  return job.kind === "answer" ? stepAnswer(job, limit, useCloud, timeoutMs, cloudAnswer) : stepDocument(job, limit, useCloud, timeoutMs);
}

async function stepAnswer(job, limit, useCloud, timeoutMs, cloudAnswer) {
  const { specialist, locale, message } = job.input;
  const history = await listQualityAssistantMessages(job.telegram_user_id, specialist).catch(() => []);
  let text = "", engine = "bielik", sources = [];
  if (!useCloud) {
    const out = await askPhone(answerPrompt(specialist, locale, history, message), { timeoutMs });
    if (!out || out.text.length <= 20) { await saveQualityJob(job.id, { limit_seconds: limit, attempts: Number(job.attempts || 0) + 1 }); return { waiting: "bielik" }; }
    text = out.text;
  } else {
    const ai = await cloudAnswer({ specialist, locale, history: history.filter((m) => m.content !== message), message });
    text = ai.text; sources = ai.sources || []; engine = "cloud";
  }
  await saveQualityAssistantMessage(job.telegram_user_id, specialist, "assistant", text, { engine, job_id: job.id, sources });
  await saveQualityJob(job.id, { status: "done", engine, limit_seconds: limit, result: { text }, finished_at: new Date().toISOString() });
  await notify(job, true);
  return { done: engine };
}

async function stepDocument(job, limit, useCloud, timeoutMs) {
  const brief = briefFor(job.input);
  const state = job.state || {};
  let doc = null, engine = "bielik";

  if (useCloud) {
    doc = await cloudDocument(brief, Math.min(50000, timeoutMs));
    engine = "cloud";
    if (!isUsable(doc)) throw new Error("Dokument z chmury niekompletny");
  } else if (!state.outline) {
    const out = await askPhone(OUTLINE_PROMPT(brief), { timeoutMs });
    let outline = null;
    try { outline = out && parseJson(out.text); } catch { outline = null; }
    if (!outline?.sections?.length) { await saveQualityJob(job.id, { limit_seconds: limit, attempts: Number(job.attempts || 0) + 1 }); return { waiting: "bielik:outline" }; }
    outline.sections = outline.sections.slice(0, 10).map((s) => ({ heading: clip(s.heading || s, 160) }));
    await saveQualityJob(job.id, { limit_seconds: limit, title: clip(`${outline.code || ""} ${outline.title || job.title}`, 200), state: { outline, filled: [] } });
    return { step: "outline" };
  } else {
    const { outline } = state, filled = state.filled || [];
    const i = filled.length;
    if (i < outline.sections.length) {
      const heading = outline.sections[i].heading;
      const out = await askPhone(SECTION_PROMPT(brief, outline, heading), { timeoutMs });
      let sec = null;
      try { sec = out && parseJson(out.text); } catch { sec = null; }
      if (!sec || !(sec.paragraphs?.length || sec.steps?.length || sec.table?.columns?.length)) { await saveQualityJob(job.id, { attempts: Number(job.attempts || 0) + 1 }); return { waiting: `bielik:section ${i + 1}` }; }
      filled.push({ heading, paragraphs: sec.paragraphs || [], steps: sec.steps || [], ...(sec.table?.columns?.length ? { table: sec.table } : {}) });
      if (filled.length < outline.sections.length) { await saveQualityJob(job.id, { state: { outline, filled } }); return { step: `section ${filled.length}/${outline.sections.length}` }; }
    }
    doc = { ...outline, sections: filled };
    if (!isUsable(doc)) throw new Error("Dokument od Bielika niekompletny");
  }

  // Zakończenie: zużycie limitu VIP dopiero teraz, zapis wyniku, powiadomienie.
  if (!job.input._unlimited) {
    const m = await getQualityMembership(job.telegram_user_id).catch(() => null);
    const lim = Number(m?.quality_plans?.included_custom_docs || 0);
    if (lim > 0) await useQualityCustomDoc(job.telegram_user_id, lim).catch(() => null);
  }
  const date = new Date().toLocaleDateString("pl-PL", { timeZone: "Europe/Warsaw" });
  const title = clip(`${doc.code || ""} ${doc.title || job.title}`, 200);
  await saveQualityJob(job.id, { status: "done", engine, title, limit_seconds: limit, result: { doc, date }, finished_at: new Date().toISOString() });
  await notify({ ...job, title }, true);
  return { done: engine };
}

async function notify(job, ok) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const uid = Number(job.telegram_user_id);
  if (token && uid > 0) {
    const isDoc = job.kind === "document";
    const url = isDoc ? `${PUBLIC_URL}/quality/documents/` : `${PUBLIC_URL}/quality/assistant/?specialist=${encodeURIComponent(job.input?.specialist || "other")}`;
    const text = ok
      ? (isDoc ? `📄 <b>Twój dokument jest gotowy</b>\n${esc(job.title)}\n\nPobierzesz go w „Moich dokumentach”.` : `💬 <b>Quality Copilot odpowiedział</b>\nNa pytanie: ${esc(job.title)}`)
      : `⚠️ Nie udało się przygotować: ${esc(job.title)}. Limit nie został pobrany – spróbuj ponownie.`;
    await sendMessage(token, uid, text, { inline_keyboard: [[{ text: isDoc ? "Otwórz Moje dokumenty" : "Otwórz rozmowę", url }]] }).catch(() => {});
  }
  // Konta ze strony (ujemne ID): strona sama sprawdza status i pokazuje powiadomienie w przeglądarce.
  await saveQualityJob(job.id, { notified_at: new Date().toISOString() }).catch(() => {});
}

const esc = (s) => String(s || "").replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));
