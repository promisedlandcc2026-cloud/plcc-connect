/**
 * The signed-in member's own membership QR, for a leader to scan at check-in.
 * Mirrors PLCC Canaan components/points/MyPassQrModal.tsx. The pass comes from
 * Vault (member-pass) through Connect's bridge — Connect never mints or signs it.
 * Black-on-white with the screen kept awake so a scanner reads it quickly.
 */
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import QRCode from 'react-qr-code';
import { Link } from 'react-router-dom';
import { ChevronRight, QrCode, X } from 'lucide-react';
import { fetchMemberPass } from '../../lib/checkinPointsClient';
import { useScreenWakeLock } from '../../lib/useScreenWakeLock';

type Props = { open: boolean; onClose: () => void };

export const MyPassQrModal: React.FC<Props> = ({ open, onClose }) => {
  const [qrPayload, setQrPayload] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useScreenWakeLock(open);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    setError('');
    void (async () => {
      try {
        const pass = await fetchMemberPass();
        if (cancelled) return;
        setQrPayload(pass.qrPayload);
        setAccessCode(pass.accessCode || '');
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error && err.message ? err.message : 'Could not load your membership pass.');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/65 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="my-pass-title"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-3xl max-w-sm w-full shadow-2xl overflow-hidden text-[#1A1A1A]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <QrCode className="w-4 h-4 text-burgundy" aria-hidden />
            <h3 id="my-pass-title" className="font-black text-sm text-[#0d1a14]">
              My PLCC Card
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-800 rounded-lg hover:bg-gray-100"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 text-center space-y-4">
          <p className="text-sm text-gray-700">
            Show this to a leader. They scan it and you earn your points.
          </p>

          {loading && <p className="text-xs text-gray-500">Loading your code…</p>}
          {error && (
            <p role="alert" className="text-sm font-semibold text-red-700">
              {error}
            </p>
          )}

          {qrPayload && (
            <div className="p-4 bg-white rounded-2xl border border-gray-200 inline-block">
              <QRCode value={qrPayload} size={220} level="M" fgColor="#000000" bgColor="#FFFFFF" />
            </div>
          )}

          {accessCode && (
            <div className="bg-gray-100 py-3 px-6 rounded-2xl inline-block">
              <p className="text-xs uppercase font-black text-gray-600 mb-1 tracking-widest">
                Backup code
              </p>
              <p className="text-3xl font-black text-[#0d1a14] tracking-[0.2em] font-mono">{accessCode}</p>
            </div>
          )}

          <p className="text-xs text-gray-500">Turn your screen brightness up if it doesn’t scan.</p>
          <Link
            to="/card"
            onClick={onClose}
            className="inline-flex min-h-[44px] items-center justify-center gap-1 text-sm font-bold text-burgundy"
          >
            Open my full PLCC Card
            <ChevronRight size={16} aria-hidden />
          </Link>
        </div>
      </div>
    </div>,
    document.body
  );
};
