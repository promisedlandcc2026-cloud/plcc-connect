import { parseBearerAuthorization } from './_utils/memberIdentity.js';
import { parseVaultApiOrigin } from './_utils/vaultOrigin.js';

/** Narrow member-only bridge. The client cannot choose the upstream or staff scope. */
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET','POST'].includes(req.method)) return res.status(405).json({ok:false,error:'Method not allowed.'});
  const auth = parseBearerAuthorization(req.headers?.authorization);
  if (!auth.ok) return res.status(401).json({ok:false,error:'Please sign in again.'});
  const origin = parseVaultApiOrigin(process.env.VAULT_API_ORIGIN, {allowHttpLocal:process.env.NODE_ENV !== 'production'});
  if (!origin.ok) return res.status(503).json({ok:false,error:'Pastor’s Office is not configured yet.'});
  const url = new URL('/api/vault', origin.origin);
  url.searchParams.set('resource','pastors-office-requests');
  let body;
  if (req.method === 'GET') {
    const scope = String(req.query?.scope || 'mine');
    if (!['mine','available'].includes(scope)) return res.status(400).json({ok:false,error:'Invalid request view.'});
    url.searchParams.set('scope',scope);
  } else {
    const raw = req.body;
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return res.status(400).json({ok:false,error:'Invalid request.'});
    if (raw.action === 'submit') body = {action:'submit',officeId:raw.officeId,category:raw.category,preferredStart:raw.preferredStart,timeZone:raw.timeZone,contactPreference:raw.contactPreference,message:raw.message};
    else if (raw.action === 'cancel') body = {action:'cancel',requestId:raw.requestId,version:raw.version};
    else return res.status(400).json({ok:false,error:'Invalid action.'});
    if (JSON.stringify(body).length > 3000) return res.status(413).json({ok:false,error:'Request is too large.'});
  }
  try {
    const response = await fetch(url, {method:req.method,headers:{Accept:'application/json',Authorization:`Bearer ${auth.token}`,...(body ? {'Content-Type':'application/json'} : {})},...(body ? {body:JSON.stringify(body)} : {}),signal:AbortSignal.timeout(12000)});
    const data = await response.json().catch(()=>null);
    if (!response.ok || data?.ok !== true) return res.status([400,401,403,409,429].includes(response.status)?response.status:503).json({ok:false,error:response.status===409?'The request changed. Please refresh and try again.':'Could not complete your request. Please try again.'});
    if (req.method === 'POST') return res.status(200).json({ok:true,...(typeof data.requestId==='string'?{requestId:data.requestId}:{})});
    if (req.query?.scope === 'available') return res.status(200).json({ok:true,offices:(Array.isArray(data.offices)?data.offices:[]).map(o=>({id:o.id,pastorName:o.pastorName}))});
    const requests=(Array.isArray(data.requests)?data.requests:[]).map(r=>({id:r.id,office_id:r.office_id,category:r.category,preferred_start:r.preferred_start,preferred_zone:r.preferred_zone,status:r.status,version:r.version,created_at:r.created_at,pastoral_appointments:(Array.isArray(r.pastoral_appointments)?r.pastoral_appointments:r.pastoral_appointments ? [r.pastoral_appointments] : []).map(a=>({starts_at:a.starts_at,ends_at:a.ends_at,display_zone:a.display_zone,status:a.status}))}));
    return res.status(200).json({ok:true,requests});
  } catch { return res.status(503).json({ok:false,error:'Pastor’s Office is temporarily unavailable.'}); }
}
