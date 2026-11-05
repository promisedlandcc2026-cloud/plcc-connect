import React, { useCallback, useEffect, useId, useState } from 'react';
import {
  Check,
  ChevronRight,
  Copy,
  Loader2,
  Smartphone,
  X,
} from 'lucide-react';
import QRCode from 'react-qr-code';
import {
  confirmMfaEnroll,
  listMfaFactors,
  removeMfaFactor,
  startMfaEnroll,
  type MfaEnrollStart,
  type MfaFactor,
} from '../../lib/authSecurity';
import { Button } from '../ui/Button';

/**
 * Phone-first 2-Step Auth (TOTP) for Connect Account.
 * Talks to shared Supabase Auth — no Vault bridge. Passkeys are not offered on Connect
 * (sibling Vercel hosts cannot share a WebAuthn RP ID with Vault).
 */
export const AccountSecuritySection: React.FC = () => {
  const mfaCodeId = useId();
  const [panelOpen, setPanelOpen] = useState(false);
  const [mfaFactors, setMfaFactors] = useState<MfaFactor[]>([]);
  const [statusLoading, setStatusLoading] = useState(true);
  const [panelLoading, setPanelLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mfaEnroll, setMfaEnroll] = useState<MfaEnrollStart | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [secretCopied, setSecretCopied] = useState(false);

  const refreshStatus = useCallback(async () => {
    setStatusLoading(true);
    try {
      setMfaFactors(await listMfaFactors());
    } catch {
      /* Non-blocking badge — panel open will surface errors */
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshStatus();
  }, [refreshStatus]);

  const openPanel = async () => {
    setPanelOpen(true);
    setError(null);
    setMfaEnroll(null);
    setMfaCode('');
    setPanelLoading(true);
    try {
      setMfaFactors(await listMfaFactors());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load security settings');
    } finally {
      setPanelLoading(false);
    }
  };

  const closePanel = () => {
    if (busy) return;
    setPanelOpen(false);
    setError(null);
    setMfaEnroll(null);
    setMfaCode('');
    void refreshStatus();
  };

  const handleStartMfa = async () => {
    setBusy(true);
    setError(null);
    try {
      setMfaEnroll(await startMfaEnroll('PLCC-Connect'));
      setMfaCode('');
      setSecretCopied(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not start 2-step setup');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmMfa = async () => {
    if (!mfaEnroll || mfaCode.trim().length < 6) return;
    setBusy(true);
    setError(null);
    try {
      await confirmMfaEnroll(mfaEnroll.factorId, mfaCode);
      setMfaEnroll(null);
      setMfaCode('');
      setMfaFactors(await listMfaFactors());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'That code did not work');
    } finally {
      setBusy(false);
    }
  };

  const handleRemoveMfa = async (id: string) => {
    if (!window.confirm('Turn off 2-step authentication for this authenticator?')) return;
    setBusy(true);
    setError(null);
    try {
      await removeMfaFactor(id);
      setMfaFactors(await listMfaFactors());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not turn off 2-step');
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-2xl bg-eggshell border border-gray-100 p-4 text-left space-y-3">
      <div>
        <p className="text-xs font-black uppercase tracking-widest text-burgundy">
          Security
        </p>
        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
          One PLCC account works everywhere. For extra protection, turn on 2-Step Auth with an
          authenticator app. (The code we email you to sign in is separate.)
        </p>
      </div>

      <button
        type="button"
        onClick={() => void openPanel()}
        className="w-full text-left rounded-2xl border border-gray-100 bg-white hover:border-burgundy/20 p-4 transition-colors min-h-[72px] flex items-center gap-3"
        data-account-security="mfa"
      >
        <div className="w-10 h-10 rounded-xl bg-burgundy/10 text-burgundy flex items-center justify-center shrink-0">
          <Smartphone size={18} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1A1A1A]">2-Step Auth</p>
          <p className="text-xs text-gray-500">Authenticator app codes</p>
        </div>
        <span
          className={`shrink-0 text-xs font-black uppercase tracking-wider px-2 py-1 rounded-lg border ${
            statusLoading
              ? 'text-gray-500 bg-gray-50 border-gray-100'
              : mfaFactors.length > 0
                ? 'text-green-700 bg-green-50 border-green-100'
                : 'text-gray-500 bg-gray-50 border-gray-100'
          }`}
        >
          {statusLoading ? '…' : mfaFactors.length > 0 ? 'Connected' : 'Not set up'}
        </span>
        <ChevronRight size={18} className="text-gray-500 shrink-0" aria-hidden />
      </button>

      {panelOpen ? (
        <div
          className="fixed inset-0 z-[300] flex items-end sm:items-center justify-center bg-black/50 p-0 sm:p-4"
          role="presentation"
          onClick={closePanel}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="2-Step Auth"
            className="w-full sm:max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-xl border border-gray-100 max-h-[85vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
              <div>
                <p className="text-xs font-black uppercase tracking-widest text-gray-500">
                  Security
                </p>
                <h3 className="text-lg font-bold text-[#1A1A1A]">2-Step Auth</h3>
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={closePanel}
                className="min-h-[44px] min-w-[44px] rounded-xl text-gray-500 hover:text-burgundy hover:bg-gray-50 flex items-center justify-center"
                aria-label="Close"
              >
                <X size={20} aria-hidden />
              </button>
            </div>

            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {error ? (
                <p className="text-sm text-red-800 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
                  {error}
                </p>
              ) : null}

              {panelLoading ? (
                <div className="flex justify-center py-12 text-burgundy">
                  <Loader2 className="animate-spin" size={28} aria-hidden />
                </div>
              ) : (
                <>
                  <p className="text-sm text-gray-600 leading-relaxed">
                    Use Google Authenticator, Authy, or similar. This is optional extra protection —
                    not the same as the email sign-in code.
                  </p>
                  {mfaFactors.length > 0 && !mfaEnroll ? (
                    <ul className="space-y-2">
                      {mfaFactors.map((f) => (
                        <li
                          key={f.id}
                          className="flex items-center justify-between gap-3 rounded-2xl border border-green-100 bg-green-50/60 px-4 py-3"
                        >
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-[#1A1A1A] truncate">
                              {f.friendly_name || 'Authenticator app'}
                            </p>
                            <p className="text-xs text-green-700 font-medium">Connected</p>
                          </div>
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => void handleRemoveMfa(f.id)}
                            className="text-xs font-black uppercase tracking-widest text-red-600 px-3 min-h-[44px] rounded-xl hover:bg-white"
                          >
                            Turn off
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : null}

                  {mfaEnroll ? (
                    <div className="space-y-4">
                      <p className="text-sm text-gray-600 text-center leading-relaxed">
                        Open your authenticator app → Add account → Scan QR code.
                      </p>
                      <div className="flex justify-center bg-white border border-gray-100 rounded-2xl p-4">
                        <QRCode
                          value={mfaEnroll.uri}
                          size={192}
                          level="M"
                          bgColor="#FFFFFF"
                          fgColor="#0d1a14"
                          title="Scan with Google Authenticator or Authy"
                        />
                      </div>
                      <div className="rounded-2xl bg-eggshell border border-gray-100 px-4 py-3 space-y-2">
                        <p className="text-xs font-black uppercase tracking-widest text-gray-500 text-center">
                          Or type this key
                        </p>
                        <p className="font-mono text-sm text-[#1A1A1A] text-center tracking-wider break-all">
                          {mfaEnroll.secretFormatted}
                        </p>
                        <button
                          type="button"
                          onClick={async () => {
                            try {
                              await navigator.clipboard.writeText(mfaEnroll.secret);
                              setSecretCopied(true);
                              window.setTimeout(() => setSecretCopied(false), 2000);
                            } catch {
                              setError('Could not copy. Select the key and copy it manually.');
                            }
                          }}
                          className="w-full min-h-[44px] rounded-xl border border-gray-200 bg-white text-xs font-black uppercase tracking-widest text-[#1A1A1A] flex items-center justify-center gap-2"
                        >
                          {secretCopied ? (
                            <Check size={14} className="text-green-600" aria-hidden />
                          ) : (
                            <Copy size={14} aria-hidden />
                          )}
                          {secretCopied ? 'Copied' : 'Copy key'}
                        </button>
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor={mfaCodeId}
                          className="block text-xs font-black uppercase tracking-widest text-gray-500"
                        >
                          6-digit code
                        </label>
                        <input
                          id={mfaCodeId}
                          type="text"
                          inputMode="numeric"
                          autoComplete="one-time-code"
                          maxLength={8}
                          value={mfaCode}
                          onChange={(e) =>
                            setMfaCode(e.target.value.replace(/[^\d]/g, '').slice(0, 8))
                          }
                          disabled={busy}
                          className="w-full min-h-[52px] px-4 rounded-2xl border border-gray-200 bg-white text-center text-2xl tracking-[0.35em] font-bold focus:outline-none focus:ring-2 focus:ring-burgundy/30"
                          placeholder="••••••"
                        />
                      </div>
                      <Button
                        type="button"
                        fullWidth
                        className="min-h-[52px]"
                        disabled={busy || mfaCode.length < 6}
                        onClick={() => void handleConfirmMfa()}
                      >
                        {busy ? <Loader2 size={18} className="animate-spin" /> : null}
                        Confirm & connect
                      </Button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          setMfaEnroll(null);
                          setMfaCode('');
                        }}
                        className="w-full min-h-[44px] text-sm font-bold text-gray-500"
                      >
                        Cancel setup
                      </button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      fullWidth
                      className="min-h-[52px]"
                      disabled={busy}
                      onClick={() => void handleStartMfa()}
                    >
                      {busy ? (
                        <Loader2 size={18} className="animate-spin" aria-hidden />
                      ) : (
                        <Smartphone size={18} aria-hidden />
                      )}
                      {mfaFactors.length > 0 ? 'Add another authenticator' : 'Set up 2-Step Auth'}
                    </Button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
};
