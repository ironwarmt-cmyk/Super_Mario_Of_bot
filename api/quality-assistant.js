import { resolveQualityIdentity } from "../lib/quality-auth.js";
import {
  getUserProfile,
  getQualityAssistantStatus,
  startQualityAssistantSession,
  heartbeatQualityAssistantSession,
  stopQualityAssistantSession,
  listQualityAssistantMessages,
  saveQualityAssistantMessage,
  createQualityEmergencyEvidenceUrl
} from "../lib/db.js";
import {
  QUALITY_AGENT_SPECIALISTS,
  buildQualityAgentInstructions,
  agentDisplayName
} from "../lib/quality-agents.js";
import { loadQualityKnowledge } from "../lib/quality-knowledge.js";

function json(res, status, data) {
  return res.status(status).json(data);
}

function specialistKey(value) {
  const key = String(value || "").toLowerCase();
  return QUALITY_AGENT_SPECIALISTS[key] ? key : "other";
}

function extractResponseText(payload) {
  const texts = [];
  for (const item of payload?.output || []) {
    if (item?.type !== "message") continue;
    for (const part of item?.content || []) {
      if (part?.type === "output_text" && part?.text) {
        texts.push(part.text);
      }
    }
  }
  return texts.join("\n\n").trim();
}

function extractSources(payload) {
  const seen = new Set();
  const sources = [];
  for (const item of payload?.output || []) {
    for (const part of item?.content || []) {
      for (const annotation of part?.annotations || []) {
        const citation =
          annotation?.type === "url_citation"
            ? annotation
            : annotation?.url_citation;
        const url = citation?.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        sources.push({
          title: citation?.title || url,
          url
        });
        if (sources.length >= 8) return sources;
      }
    }
  }
  return sources;
}

function historyAsInput(history, userMessage) {
  const items = [];
  for (const msg of history.slice(-16)) {
    items.push({
      role: msg.role === "assistant" ? "assistant" : "user",
      content: msg.content
    });
  }
  items.push({ role: "user", content: userMessage });
  return items;
}

function cleanEmergencyJson(text) {
  const raw=String(text||"").trim();
  const fenced=/^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw);
  return fenced?fenced[1].trim():raw;
}

function emergencyInstructions({ standard, version, auditDate, context }) {
  return `You are the Emergency Audit Support analyst for a food-industry Quality Assurance application.
Audit timing is urgent.
Standard: ${standard}
Applicable version / transition note: ${version}
Audit date: ${auditDate||"not specified"}
Site context: ${context||"none"}

Rules:
- This is pre-audit readiness support, not certification and not a guarantee of outcome.
- Analyze ONLY the supplied evidence plus current official requirements found through web search.
- Separate "document exists" from "implemented and evidenced".
- Identify contradictions, obsolete records, missing verification, weak effectiveness checks and likely auditor follow-up.
- Prioritize CRITICAL/HIGH issues that could materially threaten audit outcome.
- Do not invent clause numbers. If uncertain, describe the requirement without a clause number.
- Prefer official standard-owner sources for current requirements.
- Actions must be realistic before the stated audit date.
Return VALID JSON ONLY:
{
 "summary":"...",
 "risk_level":"RED|AMBER|GREEN",
 "readiness_delta":0,
 "findings":[{"severity":"CRITICAL|HIGH|MEDIUM|LOW","area":"...","issue":"...","evidence":"...","action":"...","owner_hint":"...","deadline_hint":"D-1"}],
 "missing_evidence":["..."],
 "auditor_questions":["..."],
 "next_steps":["..."]
}
readiness_delta must be between -30 and 10.`;
}

async function callEmergencyAI({ standard, version, auditDate, context, imageData, fileUrl, fileName }) {
  const apiKey=process.env.OPENAI_API_KEY;
  if(!apiKey)throw new Error("OPENAI_API_KEY is not configured");
  const model=process.env.OPENAI_QUALITY_MODEL||"gpt-6.1-sol";
  const content=[{type:"input_text",text:emergencyInstructions({standard,version,auditDate,context})}];
  if(imageData){
    if(!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageData))throw new Error("Invalid screen image");
    if(imageData.length>7_000_000)throw new Error("Screen capture is too large");
    content.push({type:"input_image",image_url:imageData,detail:"high"});
  }
  if(fileUrl){
    const lower=String(fileName||"").toLowerCase();
    if(/\.(png|jpe?g|webp)$/.test(lower)){
      content.push({type:"input_image",image_url:fileUrl,detail:"high"});
    }else{
      content.push({type:"input_file",file_url:fileUrl,filename:String(fileName||"evidence")});
    }
  }
  const response=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{Authorization:`Bearer ${apiKey}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      model,
      input:[{role:"user",content}],
      tools:[{type:"web_search"}],
      tool_choice:"auto",
      max_output_tokens:2600,
      store:false
    })
  });
  const payload=await response.json();
  if(!response.ok)throw new Error(payload?.error?.message||`OpenAI request failed with HTTP ${response.status}`);
  const raw=extractResponseText(payload);
  let result;
  try{result=JSON.parse(cleanEmergencyJson(raw))}catch{
    result={summary:raw,risk_level:"AMBER",readiness_delta:0,findings:[],missing_evidence:[],auditor_questions:[],next_steps:[]};
  }
  return {
    ...result,
    readiness_delta:Math.max(-30,Math.min(10,Number(result?.readiness_delta||0))),
    model:payload?.model||model,
    analyzed_at:new Date().toISOString(),
    sources:extractSources(payload)
  };
}

async function callQualityAI({ specialist, locale, history, message }) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured");
  }

  const model = process.env.OPENAI_QUALITY_MODEL || "gpt-6.1-sol";
  const internalKnowledge = await loadQualityKnowledge(specialist);
  const instructions =
    buildQualityAgentInstructions(specialist, locale) +
    "\n\nINTERNAL IMPLEMENTATION KNOWLEDGE\n" +
    "Use the following project material as internal implementation context. It is not proof that an external legal or certification requirement is current; verify current external requirements with official sources.\n\n" +
    internalKnowledge;

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model,
      instructions,
      input: historyAsInput(history, message),
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      max_output_tokens: 2200,
      store: false
    })
  });

  const payload = await response.json();

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        `OpenAI request failed with HTTP ${response.status}`
    );
  }

  const text = extractResponseText(payload);
  if (!text) throw new Error("AI returned an empty response");

  return {
    text,
    sources: extractSources(payload),
    model: payload?.model || model
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      service: "Quality specialist assistant",
      aiConfigured: Boolean(process.env.OPENAI_API_KEY)
    });
  }

  if (req.method !== "POST") {
    return json(res, 405, { ok: false, error: "Method not allowed" });
  }

  const identity = await resolveQualityIdentity(req);
  if (!identity?.telegramUserId) {
    return json(res, 401, {
      ok: false,
      error: "Sign in to Quality Assurance Support to use the assistant."
    });
  }
  const user = identity.user || { id: identity.telegramUserId };

  const action = String(req.body?.action || "status");
  const specialist = specialistKey(req.body?.specialist);

  try {
    if (action === "emergency_analyze") {
      const standard=String(req.body?.standard||"").slice(0,160);
      const version=String(req.body?.version||"").slice(0,200);
      const auditDate=String(req.body?.audit_date||"").slice(0,20);
      const context=String(req.body?.context||"").slice(0,5000);
      const mode=String(req.body?.mode||"");
      let imageData=null,fileUrl=null,fileName=null;

      if(mode==="document"){
        const path=String(req.body?.path||"");
        fileName=String(req.body?.file_name||"evidence").slice(0,180);
        const signed=await createQualityEmergencyEvidenceUrl(user.id,path);
        fileUrl=signed?.signed_url||null;
        if(!fileUrl)throw new Error("Could not create a private evidence URL");
      } else if(mode==="screen"){
        imageData=String(req.body?.image_data||"");
      } else if(mode!=="text"){
        return json(res,400,{ok:false,error:"Invalid Emergency analysis mode"});
      }

      const analysis=await callEmergencyAI({standard,version,auditDate,context,imageData,fileUrl,fileName});
      return json(res,200,{ok:true,analysis});
    }

    if (action === "status") {
      const [profile, status, history] = await Promise.all([
        getUserProfile(user.id),
        getQualityAssistantStatus(user.id),
        listQualityAssistantMessages(user.id, specialist)
      ]);

      return json(res, 200, {
        ok: true,
        profile,
        specialist,
        specialistName: agentDisplayName(
          specialist,
          profile?.locale || "pl"
        ),
        status,
        history
      });
    }

    if (action === "start") {
      const status = await startQualityAssistantSession(
        user.id,
        specialist
      );
      return json(res, 200, { ok: true, specialist, status });
    }

    if (action === "heartbeat") {
      const status = await heartbeatQualityAssistantSession(user.id);
      return json(res, 200, { ok: true, specialist, status });
    }

    if (action === "stop") {
      const status = await stopQualityAssistantSession(user.id);
      return json(res, 200, { ok: true, specialist, status });
    }

    if (action === "message") {
      const message = String(req.body?.message || "").trim();
      if (!message) {
        return json(res, 400, { ok: false, error: "Message is required" });
      }

      const before = await heartbeatQualityAssistantSession(user.id);
      if (
        before?.session?.status !== "active" ||
        before?.session?.specialist !== specialist
      ) {
        return json(res, 409, {
          ok: false,
          error: "Start this specialist session first."
        });
      }

      if (Number(before?.remaining_seconds || 0) <= 0) {
        return json(res, 402, {
          ok: false,
          error: "Assistant allowance exhausted."
        });
      }

      const [profile, history] = await Promise.all([
        getUserProfile(user.id),
        listQualityAssistantMessages(user.id, specialist)
      ]);

      await saveQualityAssistantMessage(
        user.id,
        specialist,
        "user",
        message
      );

      const answer = await callQualityAI({
        specialist,
        locale: profile?.locale || "pl",
        history,
        message
      });

      await saveQualityAssistantMessage(
        user.id,
        specialist,
        "assistant",
        answer.text,
        {
          sources: answer.sources,
          model: answer.model
        }
      );

      const after = await heartbeatQualityAssistantSession(user.id);

      return json(res, 200, {
        ok: true,
        specialist,
        answer: answer.text,
        sources: answer.sources,
        status: after
      });
    }

    return json(res, 400, { ok: false, error: "Unknown action" });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Assistant error";

    const status =
      /membership|required|included|allowance|exhausted/i.test(message)
        ? 403
        : /OPENAI_API_KEY/i.test(message)
          ? 503
          : 500;

    return json(res, status, { ok: false, error: message });
  }
}
