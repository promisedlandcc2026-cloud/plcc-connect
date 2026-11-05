import React, { useEffect, useState } from 'react';
import { CheckCircle2, Loader2, Phone } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

/**
 * "Turn on text sign-in" — members who joined with email (or a password) confirm their
 * mobile number once with a texted code. After that, "Text me a code" on the sign-in
 * page works for them. Goes through /api/auth-phone (link-* actions) to the Vault, with
 * the member's own sign-in token; the number on the profile alone is never enough.
 */
type Status = { enabled: boolean; phone: string | null };

async function call(body: Record<string, unknown>): Promise<any> {
  if (!isSupabaseConfigured) throw new Error('Please sign in again to continue.');
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Please sign in again to continue.');
  let res: Response;
  try {
    res = await fetch('/api/auth-phone', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
      cache: 'no-store',
    });
  } catch {
    throw new Error('Could not reach PLCC. Check your connection and try again.');
  }
  const json: any = await res.json().catch(() => null);
  if (!res.ok) {
    throw new Error((json && (json.message || json.error)) || 'Text sign-in failed. Please try again.');
  }
  return json || {};
}

export const TextSignInSection: React.FC<{ defaultPhone?: string | null }> = ({ defaultPhone }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [unavailable, setUnavailable] = useState(false);
  const [phone, setPhone] = useState(String(defaultPhone || ''));
  const [code, setCode] = useState('');
  const [step, setStep] = useState<'idle' | 'code'>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [note, setNote] = useState('');

  useEffect(() => {
    let live = true;
    call({ action: 'link-status' })
      .then((s) => live && setStatus({ enabled: Boolean(s.enabled), phone: s.phone || null }))
      .catch(() => live && setUnavailable(true));
    return () => {
      live = false;
    };
  }, []);

  if (unavailable) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError('');
    setNote('');
    try {
      await fn();
    } catch (err: any) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const sendCode = () =>
    run(async () => {
      await call({ action: 'link-request', phone });
      setStep('code');
      setNote('Code sent. Check your texts.');
    });

  const confirm = () =>
    run(async () => {
      const out = await call({ action: 'link-verify', phone, code: code.replace(/\D/g, '') });
      setStatus({ enabled: true, phone: out.phone || null });
      setStep('idle');
      setCode('');
      setNote(out.message || 'Text sign-in is on.');
    });

  const turnOff = () =>
    run(async () => {
      await call({ action: 'unlink' });
      setStatus({ enabled: false, phone: null });
      setNote('Text sign-in is off. You can turn it back on any time.');
    });

  const big =
    'w-full min-h-[52px] rounded-2xl text-base font-bold flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50';

  return (
    <section
      id="text-sign-in"
      aria-labelledby="text-sign-in-heading"
      className="rounded-2xl bg-eggshell border border-gray-100 p-4 text-left space-y-3"
    >
      <div>
        <p id="text-sign-in-heading" className="text-xs font-black uppercase tracking-widest text-burgundy">
          Sign in by text
        </p>
        <p className="text-sm text-gray-600 mt-1 leading-relaxed">
          Get a 6-digit code by text instead of a password or email. Turn it on once with your mobile number.
        </p>
      </div>

      {!status ? (
        <p className="flex items-center gap-2 text-sm text-gray-500">
          <Loader2 className="animate-spin" size={16} aria-hidden /> Checking…
        </p>
      ) : status.enabled && step === 'idle' ? (
        <div className="space-y-3">
          <p className="flex items-center gap-2 rounded-2xl bg-emerald-50 px-4 py-3 text-base font-bold text-emerald-900">
            <CheckCircle2 size={20} className="shrink-0" aria-hidden /> On for {status.phone || 'your number'}
          </p>
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setPhone('');
              setCode('');
              setError('');
              setNote('');
              setStatus({ ...status, enabled: false });
            }}
            className={`${big} border-2 border-burgundy text-burgundy hover:bg-burgundy/5`}
          >
            Use a different number
          </button>
          <button type="button" disabled={busy} onClick={() => void turnOff()} className="w-full min-h-[44px] text-sm font-bold text-gray-500 underline underline-offset-2">
            Turn off text sign-in
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <label className="block">
            <span className="block text-sm font-bold text-gray-700 mb-1.5">Your mobile number</span>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="(508) 555-1234"
              className="w-full min-h-[52px] rounded-2xl border-2 border-gray-200 bg-white px-4 text-lg focus:border-burgundy focus:outline-none"
            />
          </label>
          {step === 'code' ? (
            <>
              <label className="block">
                <span className="block text-sm font-bold text-gray-700 mb-1.5">6-digit code from the text</span>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="w-full min-h-[56px] rounded-2xl border-2 border-gray-200 bg-white px-4 text-2xl text-center tracking-[0.4em] focus:border-burgundy focus:outline-none"
                />
              </label>
              <button
                type="button"
                disabled={busy || code.length !== 6}
                onClick={() => void confirm()}
                className={`${big} bg-burgundy text-white hover:opacity-95`}
              >
                {busy ? <Loader2 className="animate-spin" size={18} aria-hidden /> : null} Confirm and turn on
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void sendCode()}
                className={`${big} border-2 border-burgundy text-burgundy hover:bg-burgundy/5`}
              >
                Text me a new code
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={busy || phone.replace(/\D/g, '').length < 10}
              onClick={() => void sendCode()}
              className={`${big} bg-burgundy text-white hover:opacity-95`}
            >
              {busy ? <Loader2 className="animate-spin" size={18} aria-hidden /> : <Phone size={18} aria-hidden />} Turn on text sign-in
            </button>
          )}
        </div>
      )}

      {note ? (
        <p className="text-sm font-bold text-emerald-800" role="status">
          {note}
        </p>
      ) : null}
      {error ? (
        <p className="text-sm font-bold text-red-800 bg-red-50 border border-red-100 rounded-2xl px-4 py-3" role="alert">
          {error}
        </p>
      ) : null}
    </section>
  );
};
