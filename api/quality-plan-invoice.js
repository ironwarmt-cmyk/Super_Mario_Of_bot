import purchaseHandler from "./quality-purchase-invoice.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ ok:false, error:"Method not allowed" });
  }

  req.body = {
    ...(req.body || {}),
    kind:"plan",
    reference:String(req.body?.slug || req.body?.reference || "").toLowerCase()
  };

  return purchaseHandler(req, res);
}
