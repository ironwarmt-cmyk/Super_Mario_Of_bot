import crypto from "node:crypto";
import {
  getQualityPlan,
  getQualityProduct,
  getQualityTokenPack,
  validateQualityCheckoutConsent
} from "../lib/db.js";

function safeEqualHex(a,b){const aa=Buffer.from(String(a||""),"hex");const bb=Buffer.from(String(b||""),"hex");return Boolean(aa.length&&aa.length===bb.length&&crypto.timingSafeEqual(aa,bb));}
function verifyTelegramInitData(initData,botToken){
  if(!initData||!botToken)return null;
  const p=new URLSearchParams(initData);const hash=p.get("hash");if(!hash)return null;
  const authDate=Number(p.get("auth_date")||0),now=Math.floor(Date.now()/1000);
  if(!authDate||now-authDate>86400||authDate>now+60)return null;
  const entries=[...p.entries()].filter(([k])=>k!=="hash").sort(([a],[b])=>a.localeCompare(b));
  const check=entries.map(([k,v])=>`${k}=${v}`).join("\n");
  const secret=crypto.createHmac("sha256","WebAppData").update(botToken).digest();
  const expected=crypto.createHmac("sha256",secret).update(check).digest("hex");
  if(!safeEqualHex(hash,expected))return null;
  try{return JSON.parse(p.get("user")||"null")}catch{return null}
}
async function createInvoice(token,payload){
  const r=await fetch(`https://api.telegram.org/bot${token}/createInvoiceLink`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});
  const d=await r.json();if(!r.ok||!d?.ok||!d?.result)throw new Error(d?.description||"Could not create Telegram invoice");return d.result;
}
export default async function handler(req,res){
  if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
  const token=process.env.TELEGRAM_BOT_TOKEN;
  const user=verifyTelegramInitData(String(req.headers["x-telegram-init-data"]||req.body?.initData||""),token);
  if(!user?.id)return res.status(401).json({ok:false,error:"Open checkout from Telegram."});
  const kind=String(req.body?.kind||"");const reference=String(req.body?.reference||"").toLowerCase();const consentToken=String(req.body?.consent_token||"");
  try{
    let purchaseKind,invoice;
    if(kind==="plan"){
      const p=await getQualityPlan(reference);if(!p?.active||!p?.checkout_enabled||!p?.price_stars)return res.status(404).json({ok:false,error:"Plan unavailable"});
      purchaseKind="plan";
      const consent=await validateQualityCheckoutConsent(user.id,consentToken,purchaseKind,p.slug);if(!consent)return res.status(403).json({ok:false,error:"Required legal consents are missing"});
      const title=String(p.name_pl||p.name_en||"Quality Plan").slice(0,32);
      invoice=await createInvoice(token,{title,description:`Quality Assurance Support — ${title}. Cena referencyjna: ${Number(p.display_price_pln).toFixed(2)} PLN / miesiąc.`,payload:`qa_plan:${p.slug}`,currency:"XTR",prices:[{label:title,amount:Number(p.price_stars)}],subscription_period:2592000});
    }else if(kind==="product"){
      const p=await getQualityProduct(reference);if(!p?.standalone_purchase_enabled||!p?.standalone_price_stars)return res.status(404).json({ok:false,error:"Product unavailable"});
      purchaseKind=p.product_type==="training"?"training":"digital_product";
      const consent=await validateQualityCheckoutConsent(user.id,consentToken,purchaseKind,p.slug);if(!consent)return res.status(403).json({ok:false,error:"Required legal consents are missing"});
      const title=String(p.name_pl||p.name_en||"Quality product").slice(0,32);
      invoice=await createInvoice(token,{title,description:`Quality Assurance Support — ${title}. Cena referencyjna: ${Number(p.standalone_price_pln||0).toFixed(2)} PLN.`,payload:`qa_product:${p.slug}`,currency:"XTR",prices:[{label:title,amount:Number(p.standalone_price_stars)}]});
    }else if(kind==="token"){
      const pack=await getQualityTokenPack(Number(reference));if(!pack?.price_stars)return res.status(404).json({ok:false,error:"Token pack unavailable"});
      purchaseKind="token";
      const consent=await validateQualityCheckoutConsent(user.id,consentToken,purchaseKind,String(pack.tokens));if(!consent)return res.status(403).json({ok:false,error:"Required legal consents are missing"});
      const title=`${pack.tokens} Quality Tokens`.slice(0,32);
      invoice=await createInvoice(token,{title,description:`${pack.tokens} tokenów do wykorzystania w Quality Assurance Support.`,payload:`qa_token:${pack.tokens}`,currency:"XTR",prices:[{label:`${pack.tokens} tokenów`,amount:Number(pack.price_stars)}]});
    }else return res.status(400).json({ok:false,error:"Invalid purchase kind"});
    return res.status(200).json({ok:true,invoice_link:invoice,purchase_kind:purchaseKind});
  }catch(e){return res.status(500).json({ok:false,error:e instanceof Error?e.message:"Checkout failed"})}
}
