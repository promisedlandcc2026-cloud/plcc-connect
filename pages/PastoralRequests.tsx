import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { getValidAccessToken } from '../lib/authAccessToken';
type Office = { id: string; pastorName: string };
type Request = { id:string; category:string; status:string; version:number; preferred_start:string; pastoral_appointments?: {starts_at:string; ends_at:string; status:string}[] };
async function api(path: string, body?: object) {
  const token = await getValidAccessToken();
  if (!token) throw new Error('Please sign in again.');
  const res = await fetch(`/api/pastoral-requests${path}`, { method:body?'POST':'GET', headers:{Authorization:`Bearer ${token}`,...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}) });
  const data = await res.json().catch(()=>null);
  if (!res.ok || !data?.ok) throw new Error(data?.error || 'Please try again.');
  return data;
}
/** Reject nonexistent or ambiguous browser-local times instead of guessing at DST changes. */
function localInstant(value: string): string | null {
  const m=/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!m) return null;
  const d=new Date(value); if (!Number.isFinite(d.getTime())) return null;
  const same = (x: Date) => x.getFullYear()===Number(m[1]) && x.getMonth()+1===Number(m[2]) && x.getDate()===Number(m[3]) && x.getHours()===Number(m[4]) && x.getMinutes()===Number(m[5]);
  if (!same(d) || [30,60,90,120].some(minutes => same(new Date(d.getTime()-minutes*60000)) || same(new Date(d.getTime()+minutes*60000)))) return null;
  return d.toISOString();
}
export function PastoralRequests() {
  const [offices,setOffices]=useState<Office[]>([]), [requests,setRequests]=useState<Request[]>([]);
  const [office,setOffice]=useState(''), [category,setCategory]=useState('appointment'), [preferred,setPreferred]=useState(''), [contact,setContact]=useState('app'), [message,setMessage]=useState('');
  const [reminders,setReminders]=useState(true),[reminderHours,setReminderHours]=useState(24);
  const [busy,setBusy]=useState(false),[error,setError]=useState(''),[notice,setNotice]=useState('');
  const zone=Intl.DateTimeFormat().resolvedOptions().timeZone || 'Africa/Kampala';
  async function load() { try { const [a,b,c]=await Promise.all([api('?scope=available'),api('?scope=mine'),api('?scope=preferences')]); setOffices(a.offices || []); setRequests(b.requests || []);setReminders(c.preferences.reminders_enabled);setReminderHours(c.preferences.reminder_hours); setError(''); } catch(e:any){setError(e.message);} }
  useEffect(()=>{void load()},[]);
  async function submit(e:React.FormEvent) { e.preventDefault();const instant=localInstant(preferred);if(!instant){setError('Please choose a valid, unambiguous local time.');return;}setBusy(true);setError('');setNotice('');try{await api('',{action:'submit',officeId:office,category,preferredStart:instant,timeZone:zone,contactPreference:contact,message});setMessage('');setPreferred('');setNotice('Your request was submitted.');await load()}catch(err:any){setError(err.message)}finally{setBusy(false)} }
  async function cancel(r:Request){if(!window.confirm('Cancel this request?'))return;setBusy(true);try{await api('',{action:'cancel',requestId:r.id,version:r.version});setNotice('Your request was cancelled.');await load()}catch(err:any){setError(err.message)}finally{setBusy(false)}}
  async function requestReschedule(r:Request){setBusy(true);setError('');try{await api('',{action:'request_reschedule',requestId:r.id,version:r.version});setNotice('Your request to reschedule was sent. Your current appointment remains confirmed until a new time is proposed.');await load()}catch(err:any){setError(err.message)}finally{setBusy(false)}}
  async function savePreferences(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{await api('',{action:'set_preferences',remindersEnabled:reminders,reminderHours});setNotice('Reminder preferences saved.')}catch(err:any){setError(err.message)}finally{setBusy(false)}}
  return <main className="px-4 py-6 pb-28 text-[#10213b]"><Link to="/me" className="text-sm underline">← More</Link><h1 className="mt-4 font-serif text-3xl font-bold">Pastor’s Office</h1><p className="mt-2 text-sm">Request an appointment and check your updates here.</p>
    {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-red-800">{error}</p>}{notice && <p role="status" className="mt-4 rounded-xl bg-green-50 p-3 text-green-800">{notice}</p>}
    <form onSubmit={submit} className="mt-5 space-y-4 rounded-2xl border border-[#d4dbe5] bg-white p-5"><h2 className="font-bold text-lg">Request an appointment</h2>
      <label className="block text-sm font-semibold">Pastor<select required value={office} onChange={e=>setOffice(e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="">Choose a pastor</option>{offices.map(o=><option key={o.id} value={o.id}>{o.pastorName}</option>)}</select></label>
      <label className="block text-sm font-semibold">Request type<select value={category} onChange={e=>setCategory(e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="appointment">Pastoral appointment</option><option value="counseling">Counseling</option><option value="baptism">Baptism consultation</option></select></label>
      <label className="block text-sm font-semibold">Preferred date and time<input required type="datetime-local" value={preferred} onChange={e=>setPreferred(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label><p className="text-xs">Shown in your device’s time zone: {zone}. Your time is a preference, not a confirmed booking.</p>
      <label className="block text-sm font-semibold">Contact preference<select value={contact} onChange={e=>setContact(e.target.value)} className="mt-1 w-full rounded-lg border p-3"><option value="app">In app</option><option value="phone">Phone</option><option value="email">Email</option></select></label>
      <label className="block text-sm font-semibold">Brief message (optional)<textarea maxLength={500} value={message} onChange={e=>setMessage(e.target.value)} className="mt-1 w-full rounded-lg border p-3" /></label><p className="text-xs">Please don’t include private counseling details here.</p><button disabled={busy||!office} className="w-full rounded-lg bg-[#092c50] p-3 font-semibold text-white disabled:opacity-50">Submit request</button>
    </form><form onSubmit={savePreferences} className="mt-5 rounded-xl border bg-white p-4"><h2 className="font-bold">Appointment reminders</h2><p className="mt-1 text-xs">Coming soon: automatic reminders and email notifications are not available yet.</p><label className="mt-3 flex items-center gap-2 text-sm"><input type="checkbox" checked={reminders} onChange={e=>setReminders(e.target.checked)}/> Notify me in the app</label><label className="mt-3 block text-sm">Hours before appointment <input type="number" min={1} max={168} value={reminderHours} onChange={e=>setReminderHours(Number(e.target.value))} className="ml-2 w-20 rounded border p-2"/></label><button disabled={busy} className="mt-3 rounded border px-3 py-2 text-sm">Save preferences</button></form><section className="mt-6"><h2 className="font-serif text-2xl font-bold">My requests</h2>{requests.length===0&&<p className="mt-3 text-sm">No requests to show.</p>}{requests.map(r=><article key={r.id} className="mt-3 rounded-xl border bg-white p-4"><h3 className="font-semibold capitalize">{r.category}</h3><p className="mt-1 text-sm capitalize">{r.status.replace(/_/g,' ')}</p><p className="mt-1 text-sm">Preferred: {new Date(r.preferred_start).toLocaleString(undefined,{timeZone:zone,timeZoneName:'short'})}</p>{r.pastoral_appointments?.[0]&&<p className="mt-1 text-sm">Appointment: {new Date(r.pastoral_appointments[0].starts_at).toLocaleString(undefined,{timeZone:zone,timeZoneName:'short'})}</p>}{r.status==='confirmed'&&<button type="button" disabled={busy} onClick={()=>void requestReschedule(r)} className="mt-3 mr-4 text-sm underline">Request a new time</button>}{['requested','proposed','awaiting_approval','confirmed','reschedule_requested'].includes(r.status)&&<button type="button" disabled={busy} onClick={()=>void cancel(r)} className="mt-3 text-sm underline">Cancel request</button>}</article>)}</section>
  </main>;
}
