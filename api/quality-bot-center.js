import { resolveQualityIdentity } from "../lib/quality-auth.js";

const ENDPOINTS = {
  marioHealth: "https://mario-t-market-control-production.up.railway.app/health",
  marioReview: "https://mario-t-market-control-production.up.railway.app/management-review",
  andyHealth: "https://andy-b-quality-control-production.up.railway.app/health",
  andyCapa: "https://andy-b-quality-control-production.up.railway.app/coverage-capa",
  andyProfessor: "https://andy-b-quality-control-production.up.railway.app/professor-quality",
  andySignals: "https://andy-b-quality-control-production.up.railway.app/worker-signals/status",
  andyProgram: "https://andy-b-quality-control-production.up.railway.app/research-program/1m-14d",
  professorHealth: "https://crypto-360-paper-lab-production.up.railway.app/professor/health",
  professorSoak: "https://crypto-360-paper-lab-production.up.railway.app/professor/soak",
  professorSources: "https://crypto-360-paper-lab-production.up.railway.app/professor/source-coverage",
  swarmHealth: "https://swarm-paper-runner-production.up.railway.app/health"
};

async function readJson(url){
  try{
    const r=await fetch(url,{headers:{"user-agent":"quality-bot-center/1.0"},signal:AbortSignal.timeout(7000)});
    const body=await r.json().catch(()=>null);
    return {ok:r.ok,http:r.status,body};
  }catch(error){
    return {ok:false,http:0,error:String(error),body:null};
  }
}

function serviceState(x){
  if(!x?.ok) return "DOWN";
  if(x.body?.ok===false) return "DEGRADED";
  return "OK";
}

function pct(n,d){
  return d>0 ? Math.max(0,Math.min(100,Math.round((n/d)*1000)/10)) : 0;
}

export default async function handler(req,res){
  if(req.method!=="GET") return res.status(405).json({ok:false,error:"Method not allowed"});
  const identity=await resolveQualityIdentity(req);
  if(!identity?.telegramUserId) return res.status(401).json({ok:false,error:"Sign in to Quality Hub first."});

  const names=Object.keys(ENDPOINTS);
  const values=await Promise.all(names.map(k=>readJson(ENDPOINTS[k])));
  const data=Object.fromEntries(names.map((k,i)=>[k,values[i]]));

  const soak=data.professorSoak.body||{};
  const source=data.professorSources.body||{};
  const capa=data.andyCapa.body||{};
  const profQ=data.andyProfessor.body||{};
  const signals=data.andySignals.body||{};
  const review=data.marioReview.body||{};
  const program=data.andyProgram.body||{};

  const services={
    mario:serviceState(data.marioHealth),
    andy:serviceState(data.andyHealth),
    professor:serviceState(data.professorHealth),
    workers:serviceState(data.swarmHealth)
  };

  const down=Object.entries(services).filter(([,v])=>v==="DOWN").map(([k])=>k);
  const soakPct=pct(Number(soak.elapsedMs||0),Number(soak.targetMs||0));
  const soakComplete=String(soak.status||"").toUpperCase()==="COMPLETED" || soakPct>=100;
  const sourceGate=String(profQ.sourceCoverageGate||source.sourceCoverageGate||"UNKNOWN");
  const strategic=String(review.strategicStatus||"UNKNOWN");

  let decision="GO_PAPER";
  let decisionReason="Warunki badawcze spełnione.";
  if(down.length){
    decision="STOP";
    decisionReason="Niedostępne usługi: "+down.join(", ");
  }else if(!soakComplete || sourceGate!=="CLOSED" || strategic==="OFF_COURSE" || String(capa.status||"").toUpperCase()==="OPEN"){
    decision="HOLD";
    const reasons=[];
    if(!soakComplete) reasons.push("soak 24 h w toku");
    if(sourceGate!=="CLOSED") reasons.push("coverage gate "+sourceGate);
    if(strategic==="OFF_COURSE") reasons.push("management review OFF_COURSE");
    if(String(capa.status||"").toUpperCase()==="OPEN") reasons.push("CAPA otwarta");
    decisionReason=reasons.join(" • ")||"Warunki jakościowe niezamknięte.";
  }

  return res.status(200).json({
    ok:true,
    generatedAt:new Date().toISOString(),
    mode:"research-paper-only",
    decision,
    decisionReason,
    services,
    soak:{
      status:soak.status||"UNKNOWN",
      progressPct:soakPct,
      elapsedMs:Number(soak.elapsedMs||0),
      targetMs:Number(soak.targetMs||0),
      persistentRestarts:Number(soak.persistentRestarts||0),
      reconnects:Number(soak.reconnects||0),
      events:Number(soak.events||0),
      cycles:Number(soak.cycles||0),
      passNow:Boolean(soak.passNow)
    },
    sourceCoverage:{
      gate:sourceGate,
      qualified:Number(source.qualified||source.counts?.QUALIFIED||0),
      partial:Number(source.partial||source.counts?.PARTIAL||0),
      unqualified:Number(source.unqualified||source.counts?.UNQUALIFIED||0)
    },
    capa:{
      status:capa.status||"UNKNOWN",
      id:capa.id||null,
      rootCause:capa.rootCause||null,
      correctiveAction:capa.correctiveAction||null,
      effectiveness:capa.effectiveness||null
    },
    signals:{
      queued:Number(signals.queued||0),
      received:Number(signals.audit?.received||0),
      rejected:Number(signals.audit?.rejected||0),
      duplicates:Number(signals.audit?.duplicates||0),
      forwarded:Number(signals.audit?.forwarded||0),
      lastAggregationAt:signals.audit?.lastAggregationAt||null,
      lastBatch:signals.audit?.lastBatch||null
    },
    researchProgram:{
      id:program.program?.id||null,
      title:program.program?.title||"1 000 000 w 14 dni ze 100 zł",
      status:program.program?.status||"UNKNOWN",
      deliveryStatus:program.delivery?.status||"UNKNOWN",
      paperOnly:true
    },
    managementReview:{
      status:review.status||"UNKNOWN",
      strategicStatus:strategic,
      blockers:Array.isArray(review.blockers)?review.blockers:[],
      actions:Array.isArray(review.actions)?review.actions:[]
    }
  });
}
