import React, { useCallback, useEffect, useState } from 'react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { REPORT_EVENT, type ReportRequest } from '../../lib/report';
import ReportForm from './ReportForm';

async function getAccessToken(): Promise<string | null> {
  if (!isSupabaseConfigured) return null;
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token && token.split('.').length === 3 ? token : null;
  } catch {
    return null;
  }
}

/** Sends a report through the Connect → Canaan bridge (/api/report). */
export async function sendReport(payload: Record<string, unknown>): Promise<void> {
  const token = await getAccessToken();
  if (!token) throw new Error('Please sign in to send a report.');
  let res: Response;
  try {
    res = await fetch('/api/report', {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });
  } catch {
    throw new Error('No connection. Your report is still here, so you can try again.');
  }
  const data = (await res.json().catch(() => null)) as { ok?: boolean; message?: string } | null;
  if (!res.ok || !data?.ok) {
    throw new Error(data?.message || 'We couldn’t send your report. Please try again.');
  }
}

/** Mounted once in App. Listens for openReport() calls. */
export const ReportHost: React.FC = () => {
  const [request, setRequest] = useState<ReportRequest | null>(null);
  const [openKey, setOpenKey] = useState(0);

  useEffect(() => {
    const onOpen = (e: Event) => {
      const detail = (e as CustomEvent<ReportRequest>).detail;
      if (!detail) return;
      setRequest(detail);
      setOpenKey((k) => k + 1);
    };
    window.addEventListener(REPORT_EVENT, onOpen);
    return () => window.removeEventListener(REPORT_EVENT, onOpen);
  }, []);

  const close = useCallback(() => setRequest(null), []);

  if (!request) return null;
  return <ReportForm key={openKey} request={request} sourceApp="connect" send={sendReport} onClose={close} />;
};

export default ReportHost;
