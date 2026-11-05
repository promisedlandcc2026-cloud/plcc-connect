
import React, { useState } from 'react';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export const ConnectCard: React.FC = () => {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState('');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('loading');
    
    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name') as string,
      email: formData.get('email') as string,
      phone: formData.get('phone') as string,
      message: formData.get('message') as string,
      created_at: new Date().toISOString()
    };

    try {
      const { error } = await supabase
        .from('connect_cards')
        .insert([data]);

      if (error) throw error;
      
      setStatus('success');
    } catch (err: any) {
      console.error('Submission error:', err);
      setErrorMessage(err.message || 'Failed to submit. Please try again.');
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div 
        role="alert" 
        aria-live="assertive"
        className="bg-burgundy text-white p-8 rounded-2xl text-center shadow-xl animate-in fade-in zoom-in duration-300 focus:outline-none"
        tabIndex={-1}
      >
        <div className="flex justify-center mb-4">
          <CheckCircle2 size={48} className="text-gold" aria-hidden="true" />
        </div>
        <h3 className="text-xl font-bold mb-2">Thanks for connecting!</h3>
        <p className="text-sm text-red-100/80">Someone from PLCC will reach out to you soon.</p>
        <button 
          onClick={() => setStatus('idle')} 
          className="mt-6 text-xs font-bold text-gold uppercase tracking-widest underline focus:outline-none focus:ring-2 focus:ring-white rounded p-1"
          aria-label="Submit another connect card"
        >
          Submit Another
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-bold text-[#1A1A1A]">Connect Card</h2>
        <p className="text-xs text-gray-500 mt-1 uppercase tracking-tight font-medium">We'd love to know you're here</p>
      </div>

      {status === 'error' && (
        <div className="mb-4 p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle size={14} />
          {errorMessage}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-4">
          <div>
            <label htmlFor="name" className="sr-only">Your Name</label>
            <input 
              id="name"
              name="name"
              required 
              placeholder="Your Name" 
              className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-burgundy/20 transition-all"
            />
          </div>
          
          <div>
            <label htmlFor="email" className="sr-only">Email Address</label>
            <input 
              id="email"
              name="email"
              required 
              type="email" 
              placeholder="Email Address" 
              autoComplete="email"
              className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-burgundy/20 transition-all"
            />
          </div>

          <div>
            <label htmlFor="phone" className="sr-only">Phone Number (Optional)</label>
            <input 
              id="phone"
              name="phone"
              type="tel" 
              placeholder="Phone Number (Optional)" 
              autoComplete="tel"
              className="w-full h-12 bg-gray-50 border border-gray-100 rounded-xl px-4 text-sm focus:outline-none focus:ring-2 focus:ring-burgundy/20 transition-all"
            />
          </div>

          <div>
            <label htmlFor="message" className="sr-only">Message</label>
            <textarea 
              id="message"
              name="message"
              rows={3} 
              placeholder="How can we connect with you? (Prayer, Baptism, Membership...)" 
              className="w-full bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-burgundy/20 transition-all resize-none"
            ></textarea>
          </div>
        </div>

        <button 
          type="submit"
          disabled={status === 'loading'}
          className="w-full h-[54px] bg-burgundy text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg active:scale-[0.98] transition-all disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-burgundy focus:ring-offset-2"
          aria-label={status === 'loading' ? 'Submitting form' : 'Submit Connect Card'}
        >
          {status === 'loading' ? (
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" role="status" aria-label="Loading"></div>
          ) : (
            <>Submit Card <Send size={18} aria-hidden="true" /></>
          )}
        </button>
      </form>
    </div>
  );
};
