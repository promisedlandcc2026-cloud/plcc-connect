
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Send, MessageSquare, ShieldCheck, HeartPulse } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { submitPrayer, PrayerSubmitError, type PrayerSubmitStatus, type PrayerShareWith } from '../lib/prayerClient';

interface PrayerModuleProps {
  isOpen: boolean;
  onClose: () => void;
}

type DoneKey = PrayerSubmitStatus | 'Intercessors';

const SHARE_CHOICES: { value: PrayerShareWith; label: string; hint: string }[] = [
  { value: 'wall', label: '🙏 Prayer Wall + Intercessors', hint: 'The church stands in agreement, and the Intercessors pray over it.' },
  { value: 'intercessors', label: '🤝 Intercessors only', hint: 'Private. Not on the Prayer Wall. Only the Intercessors and the Pastor see it.' },
  { value: 'pastor', label: '🔒 Pastor only', hint: 'Only the Pastor sees it.' },
];

const DONE_TEXT: Record<DoneKey, { title: string; body: string }> = {
  Published: {
    title: 'Your prayer is on the wall',
    body: 'The church family can now stand in agreement with you. We believe in the power of prayer and are standing in faith with you.',
  },
  Confidential: {
    title: 'Sent privately to the Pastor',
    body: 'Only the Pastor and prayer team will see this request. We are standing in faith with you.',
  },
  Intercessors: {
    title: 'Sent privately to the Intercessors',
    body: 'The PLCC Intercessors will pray over your request. It is not on the Prayer Wall. We are standing in faith with you.',
  },
  Vetting: {
    title: 'We are praying for you!',
    body: 'Our prayer team has your request. A church leader will add it to the Prayer Wall soon.',
  },
};

export const PrayerModule: React.FC<PrayerModuleProps> = ({ isOpen, onClose }) => {
  const { memberAccessState, identity } = useAuth();
  const isMember = memberAccessState === 'approved_member';
  const memberName = (identity?.name || '').trim() || 'Member';

  const [doneStatus, setDoneStatus] = useState<DoneKey | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    request: '',
    shareWith: 'wall' as PrayerShareWith,
    anonymous: false,
    website: '',
  });

  if (!isOpen) return null;

  const close = () => {
    setDoneStatus(null);
    setError(null);
    onClose();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const status = await submitPrayer({
        content: formData.request,
        shareWith: formData.shareWith,
        anonymous: formData.anonymous,
        name: formData.name,
        website: formData.website,
        asMember: isMember,
      });
      setDoneStatus(status === 'Confidential' && formData.shareWith === 'intercessors' ? 'Intercessors' : status);
      setFormData({ name: '', request: '', shareWith: 'wall', anonymous: false, website: '' });
    } catch (err) {
      // Keep what they wrote so they can try again.
      setError(err instanceof PrayerSubmitError ? err.message : 'We couldn’t send your prayer request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (doneStatus) {
    const text = DONE_TEXT[doneStatus];
    // Portal to <body> so the bottom menu bar never covers the buttons.
    return createPortal(
      <div className="fixed inset-0 z-[400] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
        <div className="bg-white w-full max-w-[400px] rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-300" role="status">
          <div className="w-20 h-20 bg-burgundy rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <HeartPulse size={40} className="text-gold" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">{text.title}</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">{text.body}</p>
          <button
            onClick={close}
            className="w-full h-14 bg-burgundy text-white rounded-2xl font-bold shadow-lg hover:bg-burgundy-dark transition-all"
          >
            Amen
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div className="fixed inset-0 z-[400] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="bg-eggshell w-full max-w-[450px] rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-500 flex flex-col max-h-[90vh]">
        <div className="p-6 bg-gold text-[#1A1A1A] relative">
          <button onClick={close} aria-label="Close" className="absolute top-4 right-4 p-2 bg-black/10 rounded-full hover:bg-black/20 transition-colors">
            <X size={20} />
          </button>
          <div className="w-12 h-12 bg-burgundy rounded-xl flex items-center justify-center mb-4 shadow-lg -rotate-3">
            <MessageSquare size={24} className="text-gold" />
          </div>
          <h2 className="text-2xl font-bold">Prayer Request</h2>
          <p className="text-burgundy text-xs uppercase tracking-widest font-black mt-1">Let us carry your burden</p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto no-scrollbar">
          <p className="text-sm text-gray-600 leading-relaxed">
            "Again I say unto you, That if two of you shall agree on earth as touching any thing that they shall ask, it shall be done for them of my Father which is in heaven." <span className="font-bold">— Matt 18:19</span>
          </p>

          <div className="space-y-4">
            {isMember ? (
              <p className="text-sm text-gray-600">
                Posting as <span className="font-bold text-[#1A1A1A]">{formData.anonymous ? 'Anonymous' : memberName}</span>
              </p>
            ) : (
              <div className="space-y-1">
                <label htmlFor="prayer-name" className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">Your Name</label>
                <input
                  id="prayer-name"
                  required
                  maxLength={80}
                  placeholder="Full Name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full h-12 bg-white border border-gray-100 rounded-xl px-4 text-sm focus:ring-2 focus:ring-gold transition-all outline-none"
                />
              </div>
            )}
            <div className="space-y-1">
              <label htmlFor="prayer-request" className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">Your Request</label>
              <textarea
                id="prayer-request"
                required
                rows={4}
                maxLength={2000}
                placeholder="How can we pray for you today?"
                value={formData.request}
                onChange={(e) => setFormData({ ...formData, request: e.target.value })}
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gold transition-all outline-none resize-none"
              />
            </div>

            {/* Hidden from people; bots fill it in. */}
            <input
              type="text"
              name="website"
              tabIndex={-1}
              autoComplete="off"
              aria-hidden="true"
              value={formData.website}
              onChange={(e) => setFormData({ ...formData, website: e.target.value })}
              className="hidden"
            />

            <div className="space-y-2" role="radiogroup" aria-label="Who should pray">
              <p className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">Who should pray</p>
              {SHARE_CHOICES.map((c) => (
                <label
                  key={c.value}
                  htmlFor={`share-${c.value}`}
                  className={`flex items-start gap-3 p-4 rounded-2xl border cursor-pointer transition-colors ${
                    formData.shareWith === c.value ? 'border-burgundy bg-burgundy/5' : 'border-gray-100 bg-gray-50'
                  }`}
                >
                  <input
                    type="radio"
                    id={`share-${c.value}`}
                    name="prayer-share"
                    value={c.value}
                    checked={formData.shareWith === c.value}
                    onChange={() => setFormData({ ...formData, shareWith: c.value, anonymous: c.value === 'pastor' ? false : formData.anonymous })}
                    className="mt-0.5 w-4 h-4 accent-[#1d372c]"
                  />
                  <span>
                    <span className="block text-sm font-bold text-[#1A1A1A]">{c.label}</span>
                    <span className="block text-xs text-gray-500 leading-snug">{c.hint}</span>
                  </span>
                </label>
              ))}
              {isMember && formData.shareWith !== 'pastor' && (
                <label htmlFor="anonymous" className="flex items-center gap-3 p-4 bg-gray-50 rounded-2xl border border-gray-100 cursor-pointer">
                  <input
                    type="checkbox"
                    id="anonymous"
                    checked={formData.anonymous}
                    onChange={(e) => setFormData({ ...formData, anonymous: e.target.checked })}
                    className="w-4 h-4 accent-[#1d372c]"
                  />
                  <span className="text-xs text-gray-600 font-medium">Don't show my name</span>
                </label>
              )}
            </div>

            <p className="text-xs text-gray-500 leading-relaxed">
              {formData.shareWith === 'pastor'
                ? 'Only the Pastor and prayer team will see this.'
                : formData.shareWith === 'intercessors'
                  ? 'The PLCC Intercessors will pray over it privately. It will not be on the Prayer Wall.'
                  : isMember
                    ? 'Your prayer goes on the Prayer Wall right away, and the PLCC Intercessors will pray over it.'
                    : 'The PLCC Intercessors will pray over it, and a church leader will add it to the wall. Members who sign in post right away.'}
            </p>
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-burgundy bg-burgundy/5 border border-burgundy/15 rounded-xl px-4 py-3">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-[60px] bg-burgundy text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-burgundy-dark active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                {formData.shareWith === 'pastor'
                  ? 'Send to the Pastor'
                  : formData.shareWith === 'intercessors'
                    ? 'Send to the Intercessors'
                    : isMember
                      ? 'Post to the Prayer Wall'
                      : 'Send Request'}{' '}
                <Send size={18} />
              </>
            )}
          </button>

          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 uppercase tracking-widest font-bold pb-4">
            <ShieldCheck size={12} />
            Secure & Private
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
};
