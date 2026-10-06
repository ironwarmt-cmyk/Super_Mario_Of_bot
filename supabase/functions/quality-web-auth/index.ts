import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(status:number, data:unknown){
  return new Response(JSON.stringify(data),{
    status,
    headers:{"content-type":"application/json","cache-control":"no-store"}
  });
}

async function syntheticId(userId:string){
  const bytes = new TextEncoder().encode(userId);
  const digest = new Uint8Array(await crypto.subtle.digest("SHA-256", bytes));
  let value = 0n;
  // 6 digest bytes = at most 2^48-1; with the negative namespace
  // the synthetic id always stays well inside JavaScript's safe-integer range.
  for(let i=0;i<6;i++) value=(value<<8n)+BigInt(digest[i]);
  return -(1000000000000000n + value);
}

Deno.serve(async (req:Request)=>{
  if(req.method!=="POST") return json(405,{ok:false,error:"Method not allowed"});
  const authorization=req.headers.get("authorization")||"";
  if(!authorization.toLowerCase().startsWith("bearer ")) return json(401,{ok:false,error:"Authentication required"});

  const userClient=createClient(SUPABASE_URL,ANON_KEY,{global:{headers:{Authorization:authorization}}});
  const {data:{user},error:userError}=await userClient.auth.getUser();
  if(userError||!user?.id||!user.email) return json(401,{ok:false,error:"Invalid web session"});

  const admin=createClient(SUPABASE_URL,SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
  const email=user.email.trim().toLowerCase();

  const {data:current,error:currentError}=await admin
    .from("quality_web_identities")
    .select("auth_user_id,telegram_user_id,email,linked_at")
    .eq("auth_user_id",user.id)
    .maybeSingle();
  if(currentError) return json(500,{ok:false,error:currentError.message});

  if(current){
    let target=Number(current.telegram_user_id);
    if(target<0){
      const {data:positive}=await admin
        .from("quality_customer_profiles")
        .select("telegram_user_id")
        .gt("telegram_user_id",0)
        .ilike("email",email)
        .order("updated_at",{ascending:false})
        .limit(1)
        .maybeSingle();
      if(positive?.telegram_user_id){
        target=Number(positive.telegram_user_id);
        const {error:updateError}=await admin
          .from("quality_web_identities")
          .update({telegram_user_id:target,email,last_seen_at:new Date().toISOString()})
          .eq("auth_user_id",user.id);
        if(updateError) return json(500,{ok:false,error:updateError.message});
      }else{
        await admin.from("quality_web_identities").update({email,last_seen_at:new Date().toISOString()}).eq("auth_user_id",user.id);
      }
    }else{
      await admin.from("quality_web_identities").update({email,last_seen_at:new Date().toISOString()}).eq("auth_user_id",user.id);
    }
    return json(200,{ok:true,data:{telegram_user_id:target,email,linked_telegram:target>0}});
  }

  const {data:positive}=await admin
    .from("quality_customer_profiles")
    .select("telegram_user_id")
    .gt("telegram_user_id",0)
    .ilike("email",email)
    .order("updated_at",{ascending:false})
    .limit(1)
    .maybeSingle();

  let telegramUserId=positive?.telegram_user_id ? Number(positive.telegram_user_id) : null;

  if(!telegramUserId){
    telegramUserId=Number(await syntheticId(user.id));
    const {error:tgError}=await admin.from("telegram_users").upsert({
      telegram_user_id:telegramUserId,
      language_code:"pl",
      locale:"pl",
      updated_at:new Date().toISOString()
    },{onConflict:"telegram_user_id"});
    if(tgError) return json(500,{ok:false,error:tgError.message});
  }

  const now=new Date().toISOString();
  const {error:linkError}=await admin.from("quality_web_identities").insert({
    auth_user_id:user.id,
    telegram_user_id:telegramUserId,
    email,
    linked_at:now,
    last_seen_at:now
  });
  if(linkError) return json(500,{ok:false,error:linkError.message});

  if(telegramUserId>0){
    await admin.from("quality_customer_profiles").update({email_verified_at:now,updated_at:now}).eq("telegram_user_id",telegramUserId);
  }

  return json(200,{ok:true,data:{telegram_user_id:telegramUserId,email,linked_telegram:telegramUserId>0}});
});
