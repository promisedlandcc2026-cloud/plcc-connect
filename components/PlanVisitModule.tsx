import React, { useState } from 'react';
import { UserPlus, Clock, MapPin, CheckCircle2, Star, Church } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { CHURCH_INFO } from '../data';
import { ModalShell } from './ui/ModalShell';
import { Button } from './ui/Button';

interface PlanVisitModuleProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PlanVisitModule: React.FC<PlanVisitModuleProps> = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    visitorName: '',
    preferredDate: '',
    familySize: 'Just me',
    email: '',
    phone: '',
    notes: '',
  });

  const resetAndClose = () => {
    setStep(1);
    setError('');
    setFormData({
      visitorName: '',
      preferredDate: '',
      familySize: 'Just me',
      email: '',
      phone: '',
      notes: '',
    });
    onClose();
  };

  const handleComplete = async () => {
    setLoading(true);
    setError('');
    try {
      const { error: insertError } = await supabase.from('visit_registrations').insert([
        {
          visitor_name: formData.visitorName,
          preferred_date: formData.preferredDate,
          family_size: formData.familySize,
          email: formData.email || null,
          phone: formData.phone || null,
          notes: formData.notes || null,
        },
      ]);

      if (insertError) throw insertError;
      setStep(3);
    } catch (err) {
      console.error('Error registering visit:', err);
      setError('Something went wrong. Please try again or call the church office.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ModalShell
      isOpen={isOpen}
      onClose={resetAndClose}
      title="Plan Your Visit"
      subtitle="We can’t wait to meet you"
      icon={
        <div className="w-11 h-11 bg-burgundy rounded-2xl flex items-center justify-center">
          <UserPlus size={22} className="text-gold" aria-hidden />
        </div>
      }
    >
      {step === 1 && (
        <div className="space-y-5">
          <p className="text-[13px] text-gray-600 leading-relaxed">
            Come as you are. Here’s what a typical visit looks like — then tell us when you’re
            coming so we can welcome you well.
          </p>

          <ul className="space-y-2.5">
            {[
              {
                title: 'Passionate worship',
                desc: 'A spirit-filled musical experience.',
                icon: <Star className="text-gold" size={16} aria-hidden />,
              },
              {
                title: 'Relevant messages',
                desc: 'Practical teaching from the Word.',
                icon: <Church className="text-burgundy" size={16} aria-hidden />,
              },
              {
                title: 'PLCC Kids',
                desc: 'Safe and fun environment for children.',
                icon: <CheckCircle2 className="text-burgundy" size={16} aria-hidden />,
              },
            ].map((item) => (
              <li key={item.title} className="flex gap-3 items-start">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white border border-gray-100">
                  {item.icon}
                </span>
                <div className="min-w-0 pt-0.5">
                  <p className="text-sm font-bold text-[#1A1A1A]">{item.title}</p>
                  <p className="text-xs text-gray-500 leading-relaxed">{item.desc}</p>
                </div>
              </li>
            ))}
          </ul>

          <div className="rounded-2xl border border-burgundy/10 bg-burgundy/[0.04] px-4 py-3.5 space-y-2.5">
            <div className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-burgundy">
              <Clock size={14} aria-hidden /> Service times
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white px-3 py-2.5 border border-gray-100 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Sunday</p>
                <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">10:30 AM</p>
              </div>
              <div className="rounded-xl bg-white px-3 py-2.5 border border-gray-100 text-center">
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Wednesday</p>
                <p className="text-sm font-bold text-[#1A1A1A] mt-0.5">7:30 PM</p>
              </div>
            </div>
          </div>

          <Button fullWidth onClick={() => setStep(2)} className="min-h-[52px]">
            Continue to register
          </Button>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          {[
            { label: 'Your name', key: 'visitorName', type: 'text', placeholder: 'Full name', required: true },
            { label: 'Email', key: 'email', type: 'email', placeholder: 'you@email.com', required: false },
            { label: 'Phone', key: 'phone', type: 'tel', placeholder: '(508) 555-0100', required: false },
            { label: 'Preferred date', key: 'preferredDate', type: 'date', placeholder: '', required: true },
          ].map((field) => (
            <div key={field.key} className="space-y-1.5">
              <label className="text-xs font-black uppercase tracking-widest text-gray-500">
                {field.label}
                {field.required ? '' : ' (optional)'}
              </label>
              <input
                required={field.required}
                type={field.type}
                placeholder={field.placeholder}
                value={formData[field.key as keyof typeof formData]}
                onChange={(e) => setFormData({ ...formData, [field.key]: e.target.value })}
                className="w-full min-h-[48px] bg-white border border-gray-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-burgundy/20 focus:border-burgundy"
              />
            </div>
          ))}
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500">
              Party size
            </label>
            <select
              value={formData.familySize}
              onChange={(e) => setFormData({ ...formData, familySize: e.target.value })}
              className="w-full min-h-[48px] bg-white border border-gray-200 rounded-xl px-4 text-sm outline-none focus:ring-2 focus:ring-burgundy/20 focus:border-burgundy"
            >
              <option>Just me</option>
              <option>2 People</option>
              <option>3-4 People</option>
              <option>5+ People</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-black uppercase tracking-widest text-gray-500">
              Notes (optional)
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Anything we should know before your visit?"
              className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-burgundy/20 focus:border-burgundy resize-none min-h-[72px]"
            />
          </div>

          {error ? <p className="text-xs text-red-600 font-semibold text-center">{error}</p> : null}

          <div className="flex gap-2 pt-1">
            <Button variant="secondary" onClick={() => setStep(1)} className="flex-1 min-h-[52px]">
              Back
            </Button>
            <Button
              onClick={handleComplete}
              disabled={loading || !formData.visitorName || !formData.preferredDate}
              className="flex-[1.4] min-h-[52px]"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                "I'm coming"
              )}
            </Button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="text-center space-y-5 py-2">
          <div className="w-16 h-16 bg-gold/90 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle2 size={32} className="text-[#1A1A1A]" aria-hidden />
          </div>
          <div>
            <h3 className="text-xl font-bold text-[#1A1A1A]">See you soon</h3>
            <p className="text-[13px] text-gray-500 mt-2 leading-relaxed px-2">
              We’ve noted your visit. Stop by the New Here booth when you arrive — we’d love to
              greet you.
            </p>
          </div>
          <div className="p-4 bg-white rounded-2xl border border-gray-100 flex items-start gap-3 text-left">
            <MapPin className="text-burgundy shrink-0 mt-0.5" size={18} aria-hidden />
            <p className="text-xs text-gray-600 leading-relaxed">
              <span className="font-bold text-[#1A1A1A]">{CHURCH_INFO.name}</span>
              <br />
              {CHURCH_INFO.address}
            </p>
          </div>
          <Button variant="dark" fullWidth onClick={resetAndClose} className="min-h-[52px]">
            Done
          </Button>
        </div>
      )}
    </ModalShell>
  );
};
