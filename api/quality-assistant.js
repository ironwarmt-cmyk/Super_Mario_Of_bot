import { getVercelOidcToken } from "@vercel/oidc";
import { resolveQualityIdentity } from "../lib/quality-auth.js";
import {
  getUserProfile,
  getQualityAssistantStatus,
  startQualityAssistantSession,
  heartbeatQualityAssistantSession,
  stopQualityAssistantSession,
  listQualityAssistantMessages,
  saveQualityAssistantMessage,
  createQualityEmergencyEvidenceUrl,
  reserveQualityEmergencyAi,
  settleQualityEmergencyAi
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

async function aiTransport(requestedModel=null) {
  const openaiKey=String(process.env.OPENAI_API_KEY||"").trim();
  if(openaiKey){
    const directModel=String(requestedModel||process.env.OPENAI_QUALITY_MODEL||"gpt-5.6-sol").replace(/^openai\//,"");
    return {
      provider:"openai",
      url:"https://api.openai.com/v1/responses",
      token:openaiKey,
      model:directModel
    };
  }

  const explicitGatewayToken=String(process.env.AI_GATEWAY_API_KEY||process.env.VERCEL_OIDC_TOKEN||"").trim();
  if(explicitGatewayToken){
    return {
      provider:"vercel-ai-gateway",
      url:"https://ai-gateway.vercel.sh/v1/responses",
      token:explicitGatewayToken,
      model:String(requestedModel||process.env.OPENAI_QUALITY_MODEL_GATEWAY||"openai/gpt-5.6-sol")
    };
  }

  try {
    const oidcToken=String(await getVercelOidcToken()||"").trim();
    if(oidcToken){
      return {
        provider:"vercel-ai-gateway-oidc",
        url:"https://ai-gateway.vercel.sh/v1/responses",
        token:oidcToken,
        model:String(requestedModel||process.env.OPENAI_QUALITY_MODEL_GATEWAY||"openai/gpt-5.6-sol")
      };
    }
  } catch (error) {
    console.error("quality_ai_oidc_unavailable",error instanceof Error?error.message:error);
  }

  throw new Error("QUALITY_AI_UNAVAILABLE");
}

async function postAIResponse(body,{allowWebSearch=true,model=null}={}) {
  const transport=await aiTransport(model);
  const requestBody={...body,model:transport.model};
  if(allowWebSearch){
    requestBody.tools=[{type:"web_search"}];
    requestBody.tool_choice="auto";
  }

  async function send(payload){
    const response=await fetch(transport.url,{
      method:"POST",
      headers:{
        Authorization:`Bearer ${transport.token}`,
        "Content-Type":"application/json"
      },
      body:JSON.stringify(payload),
      signal:AbortSignal.timeout(55000)
    });
    const data=await response.json().catch(()=>({}));
    return {response,data};
  }

  let attempt=await send(requestBody);
  if(
    !attempt.response.ok &&
    allowWebSearch &&
    transport.provider.startsWith("vercel-ai-gateway") &&
    [400,404,422].includes(attempt.response.status)
  ){
    const withoutTools={...requestBody};
    delete withoutTools.tools;
    delete withoutTools.tool_choice;
    attempt=await send(withoutTools);
  }

  if(!attempt.response.ok){
    throw new Error(
      attempt.data?.error?.message ||
      attempt.data?.message ||
      `AI request failed with HTTP ${attempt.response.status}`
    );
  }

  return {
    payload:attempt.data,
    provider:transport.provider,
    model:attempt.data?.model||transport.model
  };
}

function emergencyModel(profile="evidence"){
  return ["red_team","auditor"].includes(String(profile||"").toLowerCase())
    ? "openai/gpt-5.6-sol"
    : "openai/gpt-5.6-luna";
}

function estimateEmergencyProviderCostGrosz(model,inputTokens,outputTokens){
  const key=String(model||"").toLowerCase();
  let inputPerM=5,outputPerM=25;
  if(key.includes("gpt-5.6-luna")){inputPerM=0.20;outputPerM=1.20;}
  else if(key.includes("gpt-5.6-sol")){inputPerM=4;outputPerM=20;}
  else if(key.includes("gpt-6-luna")){inputPerM=0.10;outputPerM=0.50;}
  else if(key.includes("gpt-6-sol")){inputPerM=2;outputPerM=10;}

  const tokenUsd=(Math.max(0,inputTokens)/1_000_000)*inputPerM+
    (Math.max(0,outputTokens)/1_000_000)*outputPerM;
  const webSearchUsd=0.01;
  const usdPln=Math.max(3,Number(process.env.QUALITY_AI_USD_PLN_RATE||4.25));
  const safetyFactor=1.15;
  return Math.max(5,Math.ceil((tokenUsd+webSearchUsd)*usdPln*100*safetyFactor));
}

function mimeFromName(name=""){
  const lower=String(name).toLowerCase();
  if(lower.endsWith(".pdf"))return "application/pdf";
  if(lower.endsWith(".docx"))return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if(lower.endsWith(".xlsx"))return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if(lower.endsWith(".csv"))return "text/csv";
  if(lower.endsWith(".txt"))return "text/plain";
  if(lower.endsWith(".png"))return "image/png";
  if(lower.endsWith(".webp"))return "image/webp";
  if(lower.endsWith(".jpg")||lower.endsWith(".jpeg"))return "image/jpeg";
  return "application/octet-stream";
}

async function privateEvidenceInput(fileUrl,fileName){
  const response=await fetch(fileUrl,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error("Nie udało się odczytać prywatnego pliku do analizy.");
  const bytes=Buffer.from(await response.arrayBuffer());
  if(bytes.length>12*1024*1024){
    throw new Error("Plik jest zbyt duży do analizy AI. Maksymalnie 12 MB.");
  }
  const mime=String(response.headers.get("content-type")||"").split(";")[0]||mimeFromName(fileName);
  const dataUrl=`data:${mime};base64,${bytes.toString("base64")}`;
  return {mime,dataUrl};
}

async function callEmergencyAI({ standard, version, auditDate, context, imageData, fileUrl, fileName, profile }) {
  const content=[{type:"input_text",text:emergencyInstructions({standard,version,auditDate,context})}];

  if(imageData){
    if(!/^data:image\/(png|jpeg|jpg|webp);base64,/i.test(imageData))throw new Error("Nieprawidłowy obraz ekranu.");
    if(imageData.length>7_000_000)throw new Error("Zrzut ekranu jest zbyt duży do analizy.");
    content.push({type:"input_image",image_url:imageData,detail:"high"});
  }

  if(fileUrl){
    const evidence=await privateEvidenceInput(fileUrl,fileName);
    if(evidence.mime.startsWith("image/")){
      content.push({type:"input_image",image_url:evidence.dataUrl,detail:"high"});
    }else{
      content.push({
        type:"input_file",
        filename:String(fileName||"evidence").slice(0,180),
        file_data:evidence.dataUrl
      });
    }
  }

  const requestedModel=emergencyModel(profile);
  const ai=await postAIResponse({
    input:[{role:"user",content}],
    max_output_tokens:2600,
    store:false
  },{allowWebSearch:true,model:requestedModel});

  const raw=extractResponseText(ai.payload);
  if(!raw)throw new Error("AI nie zwróciło wyniku analizy.");
  let result;
  try{
    result=JSON.parse(cleanEmergencyJson(raw));
  }catch{
    result={summary:raw,risk_level:"AMBER",readiness_delta:0,findings:[],missing_evidence:[],auditor_questions:[],next_steps:[]};
  }

  return {
    ...result,
    readiness_delta:Math.max(-30,Math.min(10,Number(result?.readiness_delta||0))),
    model:ai.model,
    provider:ai.provider,
    analyzed_at:new Date().toISOString(),
    sources:extractSources(ai.payload),
    _usage:{
      input_tokens:Number(ai.payload?.usage?.input_tokens||0),
      output_tokens:Number(ai.payload?.usage?.output_tokens||0),
      estimated_provider_cost_grosz:estimateEmergencyProviderCostGrosz(
        ai.model,
        Number(ai.payload?.usage?.input_tokens||0),
        Number(ai.payload?.usage?.output_tokens||0)
      )
    }
  };
}

async function callQualityAI({ specialist, locale, history, message }) {
  const internalKnowledge = await loadQualityKnowledge(specialist);
  const instructions =
    buildQualityAgentInstructions(specialist, locale) +
    "\n\nINTERNAL IMPLEMENTATION KNOWLEDGE\n" +
    "Use the following project material as internal implementation context. It is not proof that an external legal or certification requirement is current; verify current external requirements with official sources when live search is available.\n\n" +
    internalKnowledge;

  const ai=await postAIResponse({
    instructions,
    input:historyAsInput(history,message),
    max_output_tokens:2200,
    store:false
  },{allowWebSearch:true});

  const text=extractResponseText(ai.payload);
  if(!text)throw new Error("AI nie zwróciło odpowiedzi.");

  return {
    text,
    sources:extractSources(ai.payload),
    model:ai.model,
    provider:ai.provider
  };
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return json(res, 200, {
      ok: true,
      service: "Quality specialist assistant",
      aiConfigured: Boolean(process.env.OPENAI_API_KEY || process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL),
      aiProvider: process.env.OPENAI_API_KEY ? "openai" : (process.env.AI_GATEWAY_API_KEY || process.env.VERCEL_OIDC_TOKEN ? "vercel-ai-gateway" : (process.env.VERCEL ? "vercel-ai-gateway-oidc" : "unavailable"))
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
      const profile=String(req.body?.profile||"evidence").slice(0,40);
      let imageData=null,fileUrl=null,fileName=null,reservation=null;

      if(!["document","screen","text"].includes(mode)){
        return json(res,400,{ok:false,error:"Invalid Emergency analysis mode"});
      }

      try{
        reservation=await reserveQualityEmergencyAi(user.id,mode);

        if(mode==="document"){
          const path=String(req.body?.path||"");
          fileName=String(req.body?.file_name||"evidence").slice(0,180);
          const signed=await createQualityEmergencyEvidenceUrl(user.id,path);
          fileUrl=signed?.signed_url||null;
          if(!fileUrl)throw new Error("Could not create a private evidence URL");
        } else if(mode==="screen"){
          imageData=String(req.body?.image_data||"");
        }

        const analysis=await callEmergencyAI({
          standard,version,auditDate,context,imageData,fileUrl,fileName,profile
        });

        const usage=analysis?._usage||{};
        const budget=await settleQualityEmergencyAi(reservation.usage_id,{
          model:analysis.model||"",
          input_tokens:Number(usage.input_tokens||0),
          output_tokens:Number(usage.output_tokens||0),
          estimated_provider_cost_grosz:Number(usage.estimated_provider_cost_grosz||0),
          success:true
        });
        delete analysis._usage;

        return json(res,200,{ok:true,analysis,ai_budget:budget});
      }catch(error){
        if(reservation?.usage_id){
          await settleQualityEmergencyAi(reservation.usage_id,{
            model:"",
            input_tokens:0,
            output_tokens:0,
            estimated_provider_cost_grosz:0,
            success:false
          }).catch(()=>{});
        }
        throw error;
      }
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
          model: answer.model,
          provider: answer.provider
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
      /Emergency package required|Emergency AI budget exhausted/i.test(message)
        ? 402
        : /membership|required|included|allowance|exhausted/i.test(message)
          ? 403
        : /QUALITY_AI_UNAVAILABLE/i.test(message)
          ? 503
          : 500;

    const publicMessage=/Emergency package required/i.test(message)
      ? "Do analizy AI wymagany jest aktywny pakiet Emergency Support — 7 dni."
      : /Emergency AI budget exhausted/i.test(message)
        ? "Budżet AI w tym pakiecie został wykorzystany. Możesz dokupić kolejny 7-dniowy pakiet."
        : /QUALITY_AI_UNAVAILABLE/i.test(message)
          ? "Analiza AI nie jest jeszcze aktywna po stronie serwera."
          : /valid credit card|billing|free credits/i.test(message)
            ? "Analiza AI oczekuje na aktywację rozliczeń usługi AI po stronie administratora."
            : message;
    return json(res, status, { ok: false, error: publicMessage });
  }
}
