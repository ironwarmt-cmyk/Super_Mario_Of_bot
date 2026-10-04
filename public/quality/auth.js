(()=> {
  const SUPABASE_URL="https://ixivedtgqgryawxsxnqd.supabase.co";
  const SUPABASE_KEY="sb_publishable_4pWh6yauXpFbcTquaEvcsw_BAsUTu1Q";
  const tg=window.Telegram?.WebApp;
  const initData=tg?.initData||"";
  let client=null;

  function supabaseClient(){
    if(client) return client;
    if(!window.supabase?.createClient) return null;
    client=window.supabase.createClient(SUPABASE_URL,SUPABASE_KEY,{
      auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}
    });
    return client;
  }

  async function session(){
    const c=supabaseClient();
    if(!c) return null;
    const {data}=await c.auth.getSession();
    return data?.session||null;
  }

  async function headers(extra={}){
    if(initData) return {...extra,"x-telegram-init-data":initData};
    const s=await session();
    if(s?.access_token) return {...extra,Authorization:"Bearer "+s.access_token};
    return extra;
  }

  async function isAuthenticated(){
    if(initData) return true;
    return Boolean(await session());
  }

  async function requireAuth(next=location.pathname+location.search){
    if(await isAuthenticated()) return true;
    location.href="/quality/login/?next="+encodeURIComponent(next);
    return false;
  }

  async function signOut(){
    const c=supabaseClient();
    if(c) await c.auth.signOut();
    location.href="/quality/login/";
  }

  window.QualityAuth={
    client:supabaseClient,
    session,
    headers,
    isAuthenticated,
    requireAuth,
    signOut,
    telegram:initData?{active:true,initData}:{active:false,initData:""}
  };
})();