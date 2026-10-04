(()=>{
const PLAN_RANK={free:0,regular:0,basic:1,pro:2,vip:3};
let currentPlan="free";
let dashboard=null;
let planResolved=false;

const esc=(v="")=>String(v).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]));
const rank=p=>PLAN_RANK[String(p||"free").toLowerCase()]??0;

function injectShell(){
  if(document.getElementById("qa-experience-shell"))return;
  const root=document.createElement("div");
  root.id="qa-experience-shell";
  root.innerHTML=`
    <button class="qa-feedback-fab" id="qaFeedbackFab" type="button" aria-label="Zgłoś problem lub pomysł">✦ Feedback</button>
    <div class="qa-modal-backdrop" id="qaFeedbackBackdrop" hidden>
      <div class="qa-modal" role="dialog" aria-modal="true" aria-labelledby="qaFeedbackTitle">
        <button class="qa-modal-close" id="qaFeedbackClose" type="button">×</button>
        <div class="qa-kicker">QUALITY ASSURANCE SUPPORT</div>
        <h3 id="qaFeedbackTitle">Zgłoś problem albo pomysł</h3>
        <select id="qaFeedbackCategory">
          <option value="technical">Problem techniczny</option>
          <option value="payment">Płatność / dostęp</option>
          <option value="content">Treść / szkolenie / dokument</option>
          <option value="idea">Pomysł na ulepszenie</option>
          <option value="other">Inne</option>
        </select>
        <input id="qaFeedbackSubject" maxlength="180" placeholder="Krótki temat">
        <textarea id="qaFeedbackMessage" maxlength="5000" placeholder="Co kliknąłeś? Co miało się wydarzyć? Co wydarzyło się naprawdę?"></textarea>
        <div class="qa-modal-actions">
          <button class="qa-btn ghost" id="qaFeedbackCancel" type="button">Anuluj</button>
          <button class="qa-btn" id="qaFeedbackSend" type="button">Wyślij</button>
        </div>
        <div class="qa-feedback-status" id="qaFeedbackStatus"></div>
      </div>
    </div>
    <div class="qa-error-drawer" id="qaErrorDrawer" hidden>
      <div>
        <div class="qa-kicker">DIAGNOSTYKA</div>
        <b id="qaErrorTitle">Coś poszło nie tak</b>
        <div class="qa-error-copy" id="qaErrorCopy"></div>
        <div class="qa-error-meta" id="qaErrorMeta"></div>
      </div>
      <div class="qa-error-actions">
        <button type="button" id="qaErrorRetry">Spróbuj ponownie</button>
        <button type="button" id="qaErrorReport">Zgłoś</button>
        <button type="button" id="qaErrorClose">×</button>
      </div>
    </div>
    <div class="qa-ambient" id="qaAmbient" aria-label="Ambient Quality Arcade">
      <div class="qa-ambient-head"><span id="qaAmbientLabel">QUALITY PULSE</span><button id="qaMotionToggle" type="button">◉</button></div>
      <canvas id="qaAmbientCanvas" width="248" height="144"></canvas>
    </div>`;
  document.body.appendChild(root);

  const backdrop=document.getElementById("qaFeedbackBackdrop");
  const open=()=>{backdrop.hidden=false;document.getElementById("qaFeedbackMessage").focus()};
  const close=()=>{backdrop.hidden=true};
  document.getElementById("qaFeedbackFab").onclick=open;
  document.getElementById("qaFeedbackClose").onclick=close;
  document.getElementById("qaFeedbackCancel").onclick=close;
  backdrop.addEventListener("click",e=>{if(e.target===backdrop)close()});
  document.getElementById("qaFeedbackSend").onclick=sendFeedback;
  document.getElementById("qaErrorClose").onclick=()=>document.getElementById("qaErrorDrawer").hidden=true;
  document.getElementById("qaErrorRetry").onclick=()=>location.reload();
  document.getElementById("qaErrorReport").onclick=()=>{
    open();
    const msg=document.getElementById("qaFeedbackMessage");
    const meta=document.getElementById("qaErrorMeta").textContent;
    msg.value="Błąd aplikacji\n"+meta+"\n\nCo robiłem: ";
  };
  startAmbient();
}

async function sendFeedback(){
  const status=document.getElementById("qaFeedbackStatus");
  const btn=document.getElementById("qaFeedbackSend");
  const category=document.getElementById("qaFeedbackCategory").value;
  const subject=document.getElementById("qaFeedbackSubject").value.trim()||"Feedback z aplikacji";
  const message=document.getElementById("qaFeedbackMessage").value.trim();
  if(message.length<5){status.textContent="Opisz problem lub pomysł trochę dokładniej.";return}
  btn.disabled=true;status.textContent="Wysyłam…";
  try{
    if(!window.QualityAuth||!(await window.QualityAuth.isAuthenticated())){
      status.innerHTML='Aby zapisać feedback na koncie, <a href="/login?next='+encodeURIComponent(location.pathname+location.search)+'">zaloguj się</a>.';
      return;
    }
    const headers=await window.QualityAuth.headers({"content-type":"application/json"});
    const r=await fetch("/api/quality-support",{method:"POST",headers,body:JSON.stringify({
      category,subject,
      message:message+"\n\n[auto] ekran: "+location.pathname+" · plan: "+currentPlan+" · build: "+(document.body?.dataset?.build||"n/a")
    })});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.ok)throw new Error(d.error||("HTTP "+r.status));
    status.textContent="Zapisane. Dziękujemy — zgłoszenie trafiło do kolejki.";
    document.getElementById("qaFeedbackMessage").value="";
    document.getElementById("qaFeedbackSubject").value="";
  }catch(e){status.textContent="Nie udało się wysłać: "+String(e?.message||e)}
  finally{btn.disabled=false}
}

function showDiagnostic({title="Coś poszło nie tak",message="Operacja nie została wykonana.",meta=""}={}){
  injectShell();
  const d=document.getElementById("qaErrorDrawer");
  document.getElementById("qaErrorTitle").textContent=title;
  document.getElementById("qaErrorCopy").textContent=message;
  document.getElementById("qaErrorMeta").textContent=meta;
  d.hidden=false;
}

function upgradeModal(required,feature){
  injectShell();
  const backdrop=document.getElementById("qaFeedbackBackdrop");
  const modal=backdrop.querySelector(".qa-modal");
  const original=modal.innerHTML;
  modal.innerHTML=`
    <button class="qa-modal-close" id="qaUpgradeClose" type="button">×</button>
    <div class="qa-kicker">ODKRYJ WIĘCEJ</div>
    <h3>${esc(feature||"Ta funkcja")} jest w pakiecie ${esc(required.toUpperCase())}</h3>
    <p class="qa-upgrade-copy">Widzisz ten moduł celowo — możesz sprawdzić, co zyskasz po przejściu na wyższy plan.</p>
    <div class="qa-upgrade-sheen"><span>✦</span><b>${esc(required.toUpperCase())}</b><span>✦</span></div>
    <a class="qa-btn qa-upgrade-btn" href="/app#plans">Zobacz pakiety</a>
  `;
  backdrop.hidden=false;
  const restore=()=>{backdrop.hidden=true;modal.innerHTML=original;injectModalBindings()};
  document.getElementById("qaUpgradeClose").onclick=restore;
  backdrop.onclick=e=>{if(e.target===backdrop)restore()};
}

function injectModalBindings(){
  const fab=document.getElementById("qaFeedbackFab"),backdrop=document.getElementById("qaFeedbackBackdrop");
  if(!fab||!backdrop)return;
  fab.onclick=()=>backdrop.hidden=false;
  const close=()=>backdrop.hidden=true;
  document.getElementById("qaFeedbackClose")?.addEventListener("click",close);
  document.getElementById("qaFeedbackCancel")?.addEventListener("click",close);
  document.getElementById("qaFeedbackSend")?.addEventListener("click",sendFeedback);
}

function applyPlan(plan,data){
  currentPlan=String(plan||"free").toLowerCase();
  dashboard=data||dashboard;
  document.body.dataset.plan=currentPlan;
  document.documentElement.dataset.plan=currentPlan;
  document.querySelectorAll("[data-required-plan]").forEach(el=>{
    const needed=String(el.dataset.requiredPlan||"basic").toLowerCase();
    const locked=rank(currentPlan)<rank(needed);
    el.classList.toggle("qa-locked",locked);
    let badge=el.querySelector(":scope > .qa-lock-badge");
    if(locked&&!badge){
      badge=document.createElement("div");
      badge.className="qa-lock-badge";
      badge.textContent="✦ "+needed.toUpperCase();
      el.prepend(badge);
    }
    if(!locked&&badge)badge.remove();
    if(locked&&!el.dataset.qaLockBound){
      el.dataset.qaLockBound="1";
      el.addEventListener("click",e=>{
        const interactive=e.target.closest("a,button");
        if(interactive){
          e.preventDefault();
          e.stopPropagation();
        }
        upgradeModal(needed,el.dataset.feature||el.querySelector("b,h3,h4")?.textContent||"Moduł");
      });
    }
  });
  document.querySelectorAll("[data-current-plan]").forEach(el=>el.textContent=currentPlan.toUpperCase());
  window.dispatchEvent(new CustomEvent("qa:plan",{detail:{plan:currentPlan,rank:rank(currentPlan),dashboard}}));
}

async function resolvePlan(){
  let plan="free",data=null;
  try{
    if(window.QualityAuth&&await window.QualityAuth.isAuthenticated()){
      const headers=await window.QualityAuth.headers({"content-type":"application/json"});
      const r=await fetch("/api/quality-account?mode=dashboard",{method:"POST",headers,body:"{}"});
      data=await r.json().catch(()=>null);
      if(r.ok&&data?.ok)plan=data.membership?.plan?.slug||"free";
    }
  }catch(e){}
  planResolved=true;
  applyPlan(plan,data);
  return {plan,data};
}

function startAmbient(){
  const canvas=document.getElementById("qaAmbientCanvas");
  if(!canvas)return;
  const ctx=canvas.getContext("2d");
  const reduced=matchMedia("(prefers-reduced-motion: reduce)").matches;
  let enabled=!reduced&&localStorage.getItem("qa_motion")!=="off";
  let mode=0,lastSwitch=performance.now(),raf=0;
  const paddle={y:52},ball={x:124,y:72,vx:1.65,vy:1.15};
  let pieces=Array.from({length:9},(_,i)=>({x:(i%6)*20+8,y:100-Math.floor(i/6)*16,w:16,h:12}));

  const toggle=document.getElementById("qaMotionToggle");
  const label=document.getElementById("qaAmbientLabel");
  function paintStatic(){
    ctx.clearRect(0,0,248,144);
    ctx.fillStyle="rgba(88,217,255,.15)";ctx.fillRect(0,0,248,144);
    ctx.fillStyle="#ff6fde";ctx.fillRect(18,110,20,14);ctx.fillRect(40,110,20,14);
    ctx.fillStyle="#58d9ff";ctx.fillRect(202,18,22,22);
  }
  function frame(t){
    if(!enabled){paintStatic();return}
    if(t-lastSwitch>18000){mode=1-mode;lastSwitch=t}
    ctx.clearRect(0,0,248,144);
    if(mode===0){
      label.textContent="QUALITY PONG";
      paddle.y=50+Math.sin(t/550)*28;
      ctx.fillStyle="rgba(88,217,255,.22)";ctx.fillRect(0,0,248,144);
      ctx.fillStyle="#58d9ff";ctx.fillRect(9,paddle.y,5,38);
      ctx.fillStyle="#ff5bd8";ctx.fillRect(234,144-paddle.y-38,5,38);
      ball.x+=ball.vx;ball.y+=ball.vy;
      if(ball.y<7||ball.y>137)ball.vy*=-1;
      if(ball.x<16||ball.x>232)ball.vx*=-1;
      ctx.beginPath();ctx.arc(ball.x,ball.y,5,0,Math.PI*2);ctx.fillStyle="#ffd36b";ctx.fill();
    }else{
      label.textContent="QUALITY BLOCKS";
      ctx.fillStyle="rgba(143,107,255,.14)";ctx.fillRect(0,0,248,144);
      const fall=(t/38)%130;
      ctx.fillStyle="#ff5bd8";ctx.fillRect(150,fall-20,17,17);ctx.fillRect(169,fall-20,17,17);ctx.fillRect(169,fall-1,17,17);
      pieces.forEach((p,i)=>{ctx.fillStyle=i%2?"#58d9ff":"#9a6bff";ctx.fillRect(p.x,p.y,p.w,p.h)});
    }
    raf=requestAnimationFrame(frame);
  }
  toggle.textContent=enabled?"◉":"○";
  toggle.onclick=()=>{
    enabled=!enabled;localStorage.setItem("qa_motion",enabled?"on":"off");toggle.textContent=enabled?"◉":"○";
    cancelAnimationFrame(raf); if(enabled)raf=requestAnimationFrame(frame);else paintStatic();
  };
  if(enabled)raf=requestAnimationFrame(frame);else paintStatic();
}

const nativeFetch=window.fetch.bind(window);
window.fetch=async(...args)=>{
  try{
    const r=await nativeFetch(...args);
    const url=typeof args[0]==="string"?args[0]:(args[0]?.url||"request");
    if(r.status>=500){
      showDiagnostic({title:"Serwer zgłosił błąd",message:"Ta operacja nie została wykonana. Możesz spróbować ponownie albo wysłać zgłoszenie.",meta:"HTTP "+r.status+" · "+url});
    }
    return r;
  }catch(e){
    showDiagnostic({title:"Brak połączenia",message:"Nie udało się połączyć z usługą. Sprawdź połączenie lub spróbuj ponownie.",meta:String(e?.message||e)});
    throw e;
  }
};

window.addEventListener("error",e=>{
  if(!e?.message)return;
  showDiagnostic({title:"Błąd interfejsu",message:"Aplikacja wykryła błąd na tym ekranie.",meta:e.message+" · "+(e.filename||location.pathname)+":"+String(e.lineno||"")});
});
window.addEventListener("unhandledrejection",e=>{
  showDiagnostic({title:"Operacja nie została zakończona",message:"Wystąpił nieobsłużony problem podczas wykonywania zadania.",meta:String(e.reason?.message||e.reason||"unknown")});
});

const ready=new Promise(resolve=>{
  const run=async()=>{injectShell();resolve(await resolvePlan())};
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",run,{once:true});else run();
});

window.QAExperience={
  ready,
  currentPlan:()=>currentPlan,
  planRank:()=>rank(currentPlan),
  dashboard:()=>dashboard,
  refreshPlan:resolvePlan,
  reportIssue:showDiagnostic,
  applyPlan
};
})();