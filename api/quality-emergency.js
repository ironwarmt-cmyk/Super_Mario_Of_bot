import { resolveQualityIdentity } from "../lib/quality-auth.js";
import {
  createQualityEmergencyEvidenceUrl,
  getQualityEmergencyAudit,
  saveQualityEmergencyAudit
} from "../lib/db.js";

function json(res,status,data){return res.status(status).json(data)}

function extractResponseText(payload){
  const parts=[];
  for(const item of payload?.output||[]){
    if(item?.type!=="message")continue;
    for(const p of item?.content||[]){
      if(p?.type==="output_text"&&p?.text)parts.push(p.text);
    }
  }
  return parts.join("\n").trim();
}

function cleanJsonText(text){
  const raw=String(text||"").trim();
  const fenced=/^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(raw);
  return fenced?fenced[1].trim():raw;
}

function analysisPrompt({standard,version,auditDate,context}){
  return `You are the Emergency Audit Support analyst for a food-industry Quality Assurance application.
The user's audit is imminent. Analyze ONLY the supplied evidence and the user's stated context.
Standard: ${standard}
Applicable version / transition note: ${version}
Audit date: ${auditDate||"not specified"}
User context: ${context||"none"}

Rules:
- Treat this as pre-audit readiness support, not certification and not a guarantee of audit outcome.
- Identify evidence gaps, contradictions, obsolete records, weak implementation, missing verification, and auditor follow-up questions.
- Prioritize issues that could plausibly become major/high-risk findings, then medium, then low.
- Separate "document exists" from "implemented and evidenced".
- For current external requirements, prefer official sources when web search is used.
- Do not invent clause numbers if uncertain.
- Give corrective actions that can realistically be completed before the audit.
- Return VALID JSON ONLY with this structure:
{
 "summary":"...",
 "risk_level":"RED|AMBER|GREEN",
 "readiness_delta": -20,
 "findings":[
   {"severity":"CRITICAL|HIGH|MEDIUM|LOW","area":"...","issue":"...","evidence":"...","action":"...","owner_hint":"...","deadline_hint":"D-1"}
 ],
 "missing_evidence":["..."],
 "auditor_questions":["..."],
 "next_steps":["..."]
}
readiness_delta must be between -30 and 10.`;
}

async function callAI({standard,version,auditDate,context,imageData,fileUrl,fileName}){
  const key=process.env.OPENAI_API_KEY;
  if(!key)throw new Error("OPENAI_API_KEY is not configured");
  const model=process.env.OPENAI_QUALITY_MODEL||"gpt-6.1-sol";
  const content=[{type:"input_text",text:analysisPrompt({standard,version,auditDate,context})}];
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
  const r=await fetch("https://api.openai.com/v1/responses",{
    method:"POST",
    headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},
    body:JSON.stringify({
      model,
      input:[{role:"user",content}],
      tools:[{type:"web_search"}],
      tool_choice:"auto",
      max_output_tokens:2600,
      store:false
    })
  });
  const payload=await r.json();
  if(!r.ok)throw new Error(payload?.error?.message||`OpenAI request failed with HTTP ${r.status}`);
  const raw=extractResponseText(payload);
  let result;
  try{result=JSON.parse(cleanJsonText(raw))}catch{result={summary:raw,risk_level:"AMBER",readiness_delta:0,findings:[],missing_evidence:[],auditor_questions:[],next_steps:[]}}
  const delta=Math.max(-30,Math.min(10,Number(result?.readiness_delta||0)));
  return {
    ...result,
    readiness_delta:delta,
    model:payload?.model||model,
    analyzed_at:new Date().toISOString()
  };
}

export default async function handler(req,res){
  const identity=await resolveQualityIdentity(req);
  if(!identity?.telegramUserId)return json(res,401,{ok:false,error:"Sign in to Quality Assurance Support."});
  const userId=Number(identity.telegramUserId);
  if(!Number.isSafeInteger(userId)||userId===0)return json(res,401,{ok:false,error:"Invalid Quality account."});

  try{
    if(req.method==="GET"){
      return json(res,200,{ok:true,data:await getQualityEmergencyAudit(userId)});
    }
    if(req.method!=="POST")return json(res,405,{ok:false,error:"Method not allowed"});
    const action=String(req.body?.action||"");
    if(action==="save"){
      return json(res,200,{ok:true,data:await saveQualityEmergencyAudit(userId,req.body?.payload||{})});
    }
    if(action==="analyze"){
      const standard=String(req.body?.standard||"");
      const version=String(req.body?.version||"");
      const auditDate=String(req.body?.audit_date||"");
      const context=String(req.body?.context||"").slice(0,5000);
      const mode=String(req.body?.mode||"");
      let fileUrl=null;
      let fileName=null;
      let imageData=null;
      if(mode==="document"){
        const path=String(req.body?.path||"");
        fileName=String(req.body?.file_name||"evidence");
        const signed=await createQualityEmergencyEvidenceUrl(userId,path);
        fileUrl=signed?.signed_url||null;
        if(!fileUrl)throw new Error("Could not create a private evidence URL");
      }else if(mode==="screen"){
        imageData=String(req.body?.image_data||"");
      }else if(mode!=="text"){
        return json(res,400,{ok:false,error:"Invalid analysis mode"});
      }
      const analysis=await callAI({standard,version,auditDate,context,imageData,fileUrl,fileName});
      return json(res,200,{ok:true,analysis});
    }
    return json(res,400,{ok:false,error:"Unknown action"});
  }catch(error){
    console.error("quality_emergency_error",error);
    const msg=error instanceof Error?error.message:"Emergency Audit error";
    return json(res,/OPENAI_API_KEY/.test(msg)?503:500,{ok:false,error:msg});
  }
}
