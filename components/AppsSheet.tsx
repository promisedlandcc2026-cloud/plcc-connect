/**
 * "Apps" in the bottom bar: jump between PLCC apps with the same sign-in
 * (Ka Link opens already signed in). During a call the other app opens in a new
 * tab so the call keeps going.
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { ExternalLink, Loader2, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { awcChatSignedInUrl, AWC_CHAT_ORIGIN } from '../lib/awcChatMove';
import { AWC_ONE_URL } from '../lib/awcOneLink';
import { canOpenVaultStaffLink, VAULT_PUBLIC_ORIGIN } from '../lib/staffVaultAccess';
import { isCallActive } from '../lib/staleBuild';

function go(url: string) {
  if (isCallActive()) window.open(url, '_blank', 'noopener');
  else window.location.href = url;
}

export const AppsSheet: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const { identity } = useAuth();
  const [opening, setOpening] = useState(false);
  const apps: Array<{ label: string; note: string; open: () => void | Promise<void> }> = [
    {
      label: 'PLCC Ka Link',
      note: 'Chats, messages, calls and prayer rooms',
      open: async () => {
        setOpening(true);
        const url = await awcChatSignedInUrl('/community/chat').catch(() => `${AWC_CHAT_ORIGIN}/community/chat`);
        go(url);
        setOpening(false);
      },
    },
    ...(canOpenVaultStaffLink(identity?.role)
      ? [{ label: 'PLCC Canaan', note: 'Staff and leadership tools', open: () => go(VAULT_PUBLIC_ORIGIN) }]
      : []),
    { label: 'All PLCC apps', note: 'The PLCC ONE home screen', open: () => go(AWC_ONE_URL) },
  ];
  return createPortal(
    <div className="fixed inset-0 z-[470] bg-black/40 flex items-end justify-center" onClick={onClose}>
      <div
        className="w-full max-w-[500px] bg-[#FBF7EE] rounded-t-3xl shadow-2xl pb-[max(1rem,env(safe-area-inset-bottom))]"
        role="dialog"
        aria-modal="true"
        aria-label="Other PLCC apps"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-1">
          <p className="text-lg font-bold text-[#12301f]">PLCC apps</p>
          <button type="button" onClick={onClose} className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#5B6658]" aria-label="Close">
            <X size={20} />
          </button>
        </div>
        <p className="px-5 pb-3 text-sm text-[#5B6658]">Same sign-in everywhere. During a call they open in a new tab, so your call keeps going.</p>
        <ul>
          {apps.map((a) => (
            <li key={a.label}>
              <button
                type="button"
                onClick={() => void a.open()}
                disabled={opening}
                className="w-full flex items-center justify-between gap-3 px-5 min-h-[64px] border-t border-[#E7DDC7] text-left active:bg-black/[0.03] disabled:opacity-60"
              >
                <span>
                  <span className="block font-bold text-[#12301f]">{a.label}</span>
                  <span className="block text-xs text-[#5B6658]">{a.note}</span>
                </span>
                {opening && a.label === 'PLCC Ka Link' ? (
                  <Loader2 size={18} className="animate-spin text-[#1d372c] shrink-0" aria-hidden />
                ) : (
                  <ExternalLink size={18} className="text-[#1d372c] shrink-0" aria-hidden />
                )}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>,
    document.body
  );
};
