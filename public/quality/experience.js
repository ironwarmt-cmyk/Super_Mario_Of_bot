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
    <nav class="qa-dock" aria-label="Nawigacja Quality">
      <a href="/app" data-dock="hub"><span>⌂</span><small>Hub</small></a>
      <a href="/quality/training/" data-dock="academy"><span>▣</span><small>Akademia</small></a>
      <a href="/quality/game/" data-dock="game"><span>🐭</span><small>Audyt</small></a>
      <a href="/quality/assistant/?specialist=other" data-dock="copilot"><span>✦</span><small>Copilot</small></a>
      <a href="/quality/account/" data-dock="account"><span>◎</span><small id="qaDockPlan">FREE</small></a>
    </nav>
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
`;
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
  const dockPlan=document.getElementById("qaDockPlan");if(dockPlan)dockPlan.textContent=currentPlan.toUpperCase();
  const path=location.pathname;
  document.querySelectorAll(".qa-dock a").forEach(a=>a.classList.remove("active"));
  const target=path.includes("/training")?"academy":path.includes("/game")?"game":path.includes("/assistant")?"copilot":path.includes("/account")?"account":"hub";
  document.querySelector('.qa-dock [data-dock="'+target+'"]')?.classList.add("active");
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