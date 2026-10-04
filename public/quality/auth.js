(()=> {
  const STORAGE_KEY="quality_web_session_v3";
  const tg=window.Telegram?.WebApp;
  const initData=tg?.initData||"";

  function read(){
    try{return JSON.parse(localStorage.getItem(STORAGE_KEY)||"null")}catch{return null}
  }
  function write(value){
    try{value?localStorage.setItem(STORAGE_KEY,JSON.stringify(value)):localStorage.removeItem(STORAGE_KEY)}catch{}
  }
  function save(payload){
    if(!payload?.access_token)return null;
    const session={
      access_token:payload.access_token,
      refresh_token:payload.refresh_token||"",
      expires_at:Math.floor(Date.now()/1000)+Number(payload.expires_in||3600),
      user:payload.user||null
    };
    write(session);
    return session;
  }
  async function proxy(action,payload={}){
    const controller=new AbortController();
    const timer=setTimeout(()=>controller.abort(),12000);
    try{
      const r=await fetch("/api/quality-account?mode=web-auth",{
        method:"POST",
        headers:{"content-type":"application/json"},
        body:JSON.stringify({action,...payload}),
        signal:controller.signal
      });
      const d=await r.json().catch(()=>({ok:false,error:"Invalid server response"}));
      if(!r.ok||!d.ok)return {data:null,error:{message:d.error||("HTTP "+r.status),code:d.code||String(r.status)}};
      return {data:d.data,error:null};
    }catch(e){
      const timeout=e?.name==="AbortError";
      return {data:null,error:{message:timeout?"Serwer logowania nie odpowiedział w ciągu 12 sekund. Spróbuj ponownie.":"Brak połączenia z serwerem logowania.",code:timeout?"timeout":"network"}};
    }finally{
      clearTimeout(timer);
    }
  }
  function consumeRedirect(){
    const p=new URLSearchParams((location.hash||"").replace(/^#/,""));
    if(!p.get("access_token"))return;
    save({
      access_token:p.get("access_token"),
      refresh_token:p.get("refresh_token"),
      expires_in:p.get("expires_in")
    });
    history.replaceState(null,"",location.pathname+location.search);
  }
  consumeRedirect();

  async function session(){
    let s=read();
    if(!s?.access_token)return null;
    if(Number(s.expires_at||0)<=Math.floor(Date.now()/1000)+60){
      if(!s.refresh_token){write(null);return null}
      const x=await proxy("refresh",{refresh_token:s.refresh_token});
      if(x.error){write(null);return null}
      s=save(x.data);
    }
    return s;
  }

  const auth={
    async signInWithPassword({email,password}){
      const x=await proxy("sign_in",{email,password});
      if(x.error)return x;
      return {data:{session:save(x.data),user:x.data?.user||null},error:null};
    },
    async signUp({email,password,options={}}){
      const x=await proxy("sign_up",{email,password,redirect_to:options.emailRedirectTo||""});
      if(x.error)return x;
      return {data:{...x.data,session:save(x.data)},error:null};
    },
    async resend({email,options={}}){
      return proxy("resend",{email,redirect_to:options.emailRedirectTo||""});
    },
    async signOut(){write(null);return {error:null}},
    async getSession(){return {data:{session:await session()},error:null}}
  };

  async function headers(extra={}){
    if(initData)return {...extra,"x-telegram-init-data":initData};
    const s=await session();
    return s?.access_token?{...extra,authorization:"Bearer "+s.access_token}:extra;
  }
  async function isAuthenticated(){return Boolean(initData||await session())}

  window.QualityAuth={
    auth,
    client:()=>({auth}),
    session,
    headers,
    isAuthenticated,
    requireAuth:async(next=location.pathname+location.search)=>{
      if(await isAuthenticated())return true;
      location.href="/quality/login/?next="+encodeURIComponent(next);
      return false;
    },
    signOut:async()=>{await auth.signOut();location.href="/quality/login/"},
    telegram:{active:Boolean(initData),initData}
  };
})();