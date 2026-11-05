import React from 'react';
import { createPortal } from 'react-dom';
import { X, ArrowUpRight, CreditCard, Landmark, Heart, Receipt, ShieldCheck } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { giveUrl, myGivingUrl, type GiveMethod } from '../lib/giving';

interface GiveModuleProps {
  isOpen: boolean;
  onClose: () => void;
}

const MAIL_ADDRESS = 'Kira-Kitukutwe Trading Center, Wakiso District, Uganda';

const METHODS: Array<{ id: GiveMethod; title: string; note: string; icon: React.ReactNode; tint: string }> = [
  {
    id: 'card',
    title: 'Card or Apple Pay',
    note: 'Weekly or monthly available',
    icon: <CreditCard size={20} />,
    tint: 'bg-burgundy/10 text-burgundy',
  },
  {
    id: 'bank',
    title: 'Bank account',
    note: 'Lowest fee',
    icon: <Landmark size={20} />,
    tint: 'bg-gold/15 text-burgundy',
  },
  {
    id: 'zelle',
    title: 'Zelle',
    note: 'From your bank app',
    icon: <span className="font-black text-sm">Z</span>,
    tint: 'bg-purple-50 text-purple-700',
  },
  {
    id: 'cashapp',
    title: 'Cash App',
    note: '$awcgiveplus',
    icon: <span className="font-black text-lg">$</span>,
    tint: 'bg-green-50 text-green-700',
  },
  {
    id: 'venmo',
    title: 'Venmo',
    note: 'Church business profile',
    icon: <span className="font-black text-sm">V</span>,
    tint: 'bg-sky-50 text-sky-700',
  },
];

export const GiveModule: React.FC<GiveModuleProps> = ({ isOpen, onClose }) => {
  const logGivingIntent = async (type: string) => {
    try {
      await supabase.from('giving_intent').insert([{ intent_type: type, timestamp: new Date().toISOString() }]);
    } catch {
      // giving_intent table may not exist — non-critical, safe to ignore
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-labelledby="give-title"
    >
      <div className="bg-eggshell w-full max-w-[500px] rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-500 flex flex-col max-h-[90vh]">
        <div className="p-6 bg-burgundy text-white relative">
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="w-12 h-12 bg-gold rounded-xl flex items-center justify-center mb-4 shadow-lg rotate-3">
            <Heart size={24} fill="#1d372c" className="text-burgundy" />
          </div>
          <h2 id="give-title" className="text-2xl font-bold">Give to PLCC</h2>
          <p className="text-red-100/80 text-sm mt-1">Tithes &amp; offerings, with a receipt for every gift.</p>
        </div>

        <div className="p-6 overflow-y-auto no-scrollbar space-y-5">
          <a
            href={giveUrl()}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => void logGivingIntent('tithe')}
            className="flex items-center justify-between gap-3 w-full bg-burgundy text-white px-5 py-4 rounded-2xl shadow-lg shadow-burgundy/20 active:scale-[0.98] transition-transform"
          >
            <span>
              <span className="block text-base font-bold">Give now</span>
              <span className="block text-xs text-white/75">Opens the church's secure giving page</span>
            </span>
            <ArrowUpRight size={22} className="shrink-0" />
          </a>

          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-2">Or choose how to give</p>
            <div className="grid gap-2">
              {METHODS.map((m) => (
                <a
                  key={m.id}
                  href={giveUrl(m.id)}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => void logGivingIntent(`tithe_${m.id}`)}
                  className="bg-white px-4 py-3 rounded-2xl border border-gray-100 flex items-center gap-4 hover:shadow-md active:scale-[0.99] transition-all"
                >
                  <span className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${m.tint}`}>{m.icon}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-bold text-[#1A1A1A] text-sm">{m.title}</span>
                    <span className="block text-xs text-gray-500">{m.note}</span>
                  </span>
                  <ArrowUpRight size={18} className="text-gray-400 shrink-0" />
                </a>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-3 leading-relaxed">
              Zelle, Cash App and Venmo give you a short code to put in the note, so Finance can match your gift and send
              your receipt.
            </p>
          </div>

          <a
            href={myGivingUrl()}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 bg-white px-4 py-3 rounded-2xl border border-gold/30"
          >
            <Receipt size={20} className="text-burgundy shrink-0" />
            <span className="flex-1">
              <span className="block text-sm font-bold text-[#1A1A1A]">My giving &amp; receipts</span>
              <span className="block text-xs text-gray-500">See past gifts and download statements</span>
            </span>
            <ArrowUpRight size={18} className="text-gray-400 shrink-0" />
          </a>

          <div className="text-center text-xs text-gray-500 space-y-1">
            <p>
              Mail checks to <span className="font-bold text-gray-600">{MAIL_ADDRESS}</span>
            </p>
            <p className="flex items-center justify-center gap-1.5">
              <ShieldCheck size={14} /> Card and bank details are handled by Stripe, never stored by the church.
            </p>
          </div>

          <div className="border-t border-gray-200 pt-4 text-xs text-gray-500 leading-relaxed">
            <p className="font-semibold text-gray-600">Already give through Vanco?</p>
            <p>
              Your recurring gift keeps working.{' '}
              <a
                href="https://secure.myvanco.com/YKB0/campaign/C-1218F?access=tile_direct"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => void logGivingIntent('vanco_manage')}
                className="text-burgundy font-semibold underline underline-offset-2"
              >
                Manage it on Vanco
              </a>
              . Text giving: 855-625-4703.
            </p>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};
