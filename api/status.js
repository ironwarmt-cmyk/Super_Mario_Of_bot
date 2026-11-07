const auth = require('./_auth');
const TEAM = 'team_rebXDA1yHIAx9ucS943pCkg9';
const VPROJ = ['prj_hOPNJt9CUa6K5UeYEBGjLBUtbh8E','prj_PqZRH8MD2GpcH3XfgB9FP54tOVio','prj_G5NEXgLQCvEtCf8z5d7Agfj2Dmx1','prj_tlhUnuaaVMC9eZyURlJiNLphQHfW','prj_N5ZzzvkB0zN8gIFoCunw2iv1TW7I','prj_sGYkMNIZPgbfZV26mSfKyI8vS5Do'];
const RPROJ = ['d20405fe-71e8-4953-abba-47ffcaf54e2d','2b7499ad-f5aa-4456-8d6e-cc221967372d','38fcb959-d892-484f-8e50-36f0ece57150','3244073c-d35e-40ea-915c-0addd877dc18','eae48b25-2c9e-4355-ab04-b01994661956','a14f3a1b-0417-44e2-822c-7ceb55b17fdb','34c3eb2d-a5b2-4af0-b92c-f4fe19e480b7'];
const RAIL = 'https://backboard.railway.com/graphql/v2';
async function rq(query, variables){
  const r = await fetch(RAIL, { method:'POST', headers:{ 'content-type':'application/json', authorization:'Bearer ' + process.env.RAILWAY_TOKEN }, body: JSON.stringify({ query, variables }) });
  const j = await r.json().catch(()=>({}));
  if(!r.ok || j.errors) throw new Error((j.errors && j.errors[0] && j.errors[0].message) || ('HTTP ' + r.status));
  return j.data;
}
async function railwayProject(id){
  const d = await rq('query($id:String!){ project(id:$id){ services{ edges{ node{ id name } } } environments{ edges{ node{ id name } } } } }', { id });
  const svcs = d.project.services.edges.map(e=>e.node);
  const envs = d.project.environments.edges.map(e=>e.node);
  const env = envs.find(e=>e.name === 'production') || envs[0];
  if(!env || !svcs.length) return { services: svcs.map(s=>({ name:s.name, latestDeployment:null })) };
  const parts = svcs.map((s,i)=>`s${i}: deployments(first:1, input:{ projectId:${JSON.stringify(id)}, serviceId:${JSON.stringify(s.id)}, environmentId:${JSON.stringify(env.id)} }){ edges{ node{ status createdAt } } }`).join('\n');
  const dd = await rq(`query{ ${parts} }`, {});
  return { services: svcs.map((s,i)=>{ const n = dd['s'+i] && dd['s'+i].edges[0] && dd['s'+i].edges[0].node; return { name:s.name, latestDeployment: n ? { status:n.status, createdAt:n.createdAt } : null }; }) };
}
async function vercelProject(id){
  const r = await fetch(`https://api.vercel.com/v6/deployments?projectId=${id}&teamId=${TEAM}&target=production&limit=5`, { headers:{ authorization:'Bearer ' + process.env.VERCEL_TOKEN } });
  const j = await r.json().catch(()=>({}));
  if(!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status));
  return { deployments: (j.deployments || []).map(d=>({ state: d.state || d.readyState, created: d.created || d.createdAt, inspectorUrl: d.inspectorUrl })) };
}
module.exports = async (req, res) => {
  if(!auth(req, res)) return;
  const items = [], conn = {};
  const run = async (server, key, fn)=>{ try{ items.push({ key, ok:true, payload: await fn() }); return null; }catch(e){ items.push({ key, ok:false, error:String(e.message || e).slice(0,160) }); return String(e.message || e).slice(0,120); } };
  const tasks = [];
  if(process.env.VERCEL_TOKEN) tasks.push(Promise.all(VPROJ.map(id=>run('Vercel','v:'+id,()=>vercelProject(id)))).then(errs=>{ const bad = errs.filter(Boolean); conn.Vercel = bad.length === VPROJ.length ? { state:'warn', msg:'Vercel odrzucił zapytanie: ' + bad[0] } : { state:'ok' }; }));
  else conn.Vercel = { state:'off', msg:'Dodaj VERCEL_TOKEN w ustawieniach projektu na Vercelu.' };
  if(process.env.RAILWAY_TOKEN) tasks.push(Promise.all(RPROJ.map(id=>run('Railway','r:'+id,()=>railwayProject(id)))).then(errs=>{ const bad = errs.filter(Boolean); conn.Railway = bad.length === RPROJ.length ? { state:'warn', msg:'Railway odrzucił zapytanie: ' + bad[0] } : { state:'ok' }; }));
  else conn.Railway = { state:'off', msg:'Dodaj RAILWAY_TOKEN w ustawieniach projektu na Vercelu.' };
  conn.Gmail = { state:'off', msg:'Alerty Gmaila działają w wersji otwartej w Claude.' };
  await Promise.all(tasks);
  res.setHeader('content-type','application/json; charset=utf-8');
  res.setHeader('cache-control','private, no-store');
  res.end(JSON.stringify({ at: Date.now(), items, conn }));
};
