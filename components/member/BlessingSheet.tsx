import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Send } from 'lucide-react';
import { ModalShell } from '../ui/ModalShell';
import { openDirectMessage, sendChatMessage } from '../../lib/communityChatClient';
import { CommunityChatError } from '../../lib/communityChatTypes';
import { rememberDmRecent } from '../../lib/dmRecents';
import {
  blessingTemplate,
  celebrationEmoji,
  celebrationTitle,
  defaultOccasion,
  whenLabel,
  type BlessingOccasion,
  type Celebration,
} from '../../lib/blessings';

const OCCASIONS: { id: BlessingOccasion; label: string }[] = [
  { id: 'birthday', label: '🎂 Birthday' },
  { id: 'wedding', label: '💍 Wedding' },
  { id: 'other', label: '✨ Other' },
];

/**
 * "Send a blessing" — pick the occasion, edit the starter message, and send it
 * as a private message in Community chat.
 */
export const BlessingSheet: React.FC<{ celebration: Celebration | null; onClose: () => void }> = ({ celebration, onClose }) => {
  const [occasion, setOccasion] = useState<BlessingOccasion>('birthday');
  const [text, setText] = useState('');
  const [edited, setEdited] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sentChannel, setSentChannel] = useState<string | null>(null);

  useEffect(() => {
    if (!celebration) return;
    const first = defaultOccasion(celebration);
    setOccasion(first);
    setText(blessingTemplate(first, celebration.displayName, { otherLabel: celebration.anniversaryLabel, daysAway: celebration.daysAway }));
    setEdited(false);
    setError(null);
    setSentChannel(null);
    setSending(false);
  }, [celebration]);

  if (!celebration) return null;

  const pick = (next: BlessingOccasion) => {
    setOccasion(next);
    if (!edited || window.confirm('Replace your message with a new starter message?')) {
      setText(blessingTemplate(next, celebration.displayName, { otherLabel: celebration.anniversaryLabel, daysAway: celebration.daysAway }));
      setEdited(false);
    }
  };

  const send = async () => {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    setError(null);
    try {
      const { channel } = await openDirectMessage(celebration.partnerUserId);
      await sendChatMessage(channel.id, content);
      rememberDmRecent({
        channelId: channel.id,
        partner: { id: celebration.partnerUserId, name: celebration.displayName, avatarUrl: celebration.avatarUrl },
      });
      setSentChannel(channel.id);
    } catch (err) {
      setError(err instanceof CommunityChatError ? err.message : 'Your blessing could not be sent. Please try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <ModalShell
      isOpen
      onClose={onClose}
      title={`Bless ${celebration.displayName}`}
      subtitle={`${celebrationTitle(celebration)} · ${whenLabel(celebration.daysAway)}`}
      icon={<span className="text-3xl" aria-hidden>{celebrationEmoji(celebration)}</span>}
    >
      <div className="p-5 space-y-4 overflow-y-auto">
        {sentChannel ? (
          <div className="text-center space-y-3 py-4">
            <p className="text-5xl" aria-hidden>💌</p>
            <p className="font-display text-xl font-bold text-ink">Blessing sent!</p>
            <p className="text-sm text-gray-600">It's in your private messages with {celebration.displayName}.</p>
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button type="button" onClick={onClose} className="min-h-[48px] rounded-2xl border-2 border-gray-200 bg-white font-bold text-ink">
                Done
              </button>
              <Link
                to={`/community/chat/${sentChannel}`}
                state={{ partnerName: celebration.displayName, isDm: true }}
                onClick={onClose}
                className="min-h-[48px] rounded-2xl bg-burgundy text-white font-bold inline-flex items-center justify-center"
              >
                Open chat
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2" role="group" aria-labelledby="blessing-occasion">
              <p id="blessing-occasion" className="text-xs font-black uppercase tracking-widest text-gold-ink">What are you celebrating?</p>
              <div className="grid grid-cols-3 gap-2">
                {OCCASIONS.map((o) => (
                  <button
                    key={o.id}
                    type="button"
                    aria-pressed={occasion === o.id}
                    onClick={() => pick(o.id)}
                    className={`min-h-[48px] rounded-xl border-2 px-2 text-sm font-bold ${
                      occasion === o.id ? 'border-burgundy bg-burgundy text-white' : 'border-gray-200 bg-white text-ink'
                    }`}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="block space-y-1">
              <span className="text-xs font-black uppercase tracking-widest text-gold-ink">Your message</span>
              <textarea
                value={text}
                onChange={(e) => { setText(e.target.value); setEdited(true); }}
                rows={5}
                maxLength={1000}
                className="w-full rounded-xl bg-white border border-gray-200 px-3 py-3 text-base leading-relaxed text-ink outline-none focus:ring-2 focus:ring-gold/40"
              />
              <span className="block text-xs text-gray-500">Only {celebration.displayName} will see this. Make it your own!</span>
            </label>

            {error ? <p className="rounded-xl bg-red-50 border border-red-100 p-3 text-sm font-semibold text-red-700">{error}</p> : null}

            <button
              type="button"
              onClick={() => void send()}
              disabled={sending || !text.trim()}
              className="w-full min-h-[52px] rounded-2xl bg-burgundy text-white font-bold inline-flex items-center justify-center gap-2 disabled:opacity-60"
            >
              <Send size={16} aria-hidden />
              {sending ? 'Sending…' : 'Send blessing'}
            </button>
          </>
        )}
      </div>
    </ModalShell>
  );
};
