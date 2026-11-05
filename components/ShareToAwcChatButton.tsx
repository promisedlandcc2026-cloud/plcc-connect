import React, { useState } from 'react';
import { Loader2, MessageCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { awcChatShareUrl } from '../lib/awcChatMove';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Members only: post this event / Serve need into an PLCC Chat room as a card. */
export const ShareToAwcChatButton: React.FC<{ kind: 'event' | 'serve'; id: string | null | undefined; className?: string }> = ({
  kind,
  id,
  className = '',
}) => {
  const { memberAccessState } = useAuth();
  const [busy, setBusy] = useState(false);
  if (memberAccessState !== 'approved_member' || !id || !UUID_RE.test(String(id))) return null;
  return (
    <button
      type="button"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        try {
          window.location.assign(await awcChatShareUrl(kind, String(id)));
        } finally {
          window.setTimeout(() => setBusy(false), 8000);
        }
      }}
      className={`w-full min-h-[52px] rounded-2xl border-2 border-burgundy text-burgundy bg-white font-bold flex items-center justify-center gap-2 active:scale-95 transition-transform disabled:opacity-60 ${className}`}
    >
      {busy ? <Loader2 size={18} className="animate-spin" aria-hidden /> : <MessageCircle size={18} aria-hidden />}
      Share to PLCC Chat
    </button>
  );
};
