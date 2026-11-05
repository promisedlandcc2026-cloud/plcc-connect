
import React, { useState, useEffect } from 'react';
import { X, Users, CheckCircle2, Send, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';

interface JoinTeamModuleProps {
  isOpen: boolean;
  onClose: () => void;
  /** Legacy name hint for default selection */
  initialMinistry?: string;
  /** When set, only show teams belonging to this ministry */
  ministryId?: string | null;
  onSubmitted?: () => void;
}

type TeamOption = {
  id: string;
  name: string;
  ministry_id?: string | null;
};

export const JoinTeamModule: React.FC<JoinTeamModuleProps> = ({
  isOpen,
  onClose,
  initialMinistry,
  ministryId = null,
  onSubmitted,
}) => {
  const { identity, user } = useAuth();
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSubmitted(false);
      setError(null);
      void fetchTeams();
    }
  }, [isOpen, ministryId]);

  const fetchTeams = async () => {
    try {
      let q = supabase.from('teams').select('id,name,ministry_id').order('name', { ascending: true });
      if (ministryId) q = q.eq('ministry_id', ministryId);
      const { data, error: fetchError } = await q;
      if (fetchError) throw fetchError;
      const rows = (data || []) as TeamOption[];
      setTeams(rows.filter((t) => t.id && t.name));
    } catch (err) {
      console.error('Error fetching teams:', err);
      setTeams([]);
      setError('Could not load teams for this ministry right now.');
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const formData = new FormData(e.currentTarget);
    const data = {
      name: formData.get('name'),
      email: formData.get('email'),
      team_id: formData.get('team'),
      experience: formData.get('experience'),
      created_at: new Date().toISOString(),
      status: 'new',
    };

    try {
      const { error: insertError } = await supabase.from('team_applications').insert([data]);
      if (insertError) throw insertError;
      setSubmitted(true);
      onSubmitted?.();
    } catch (err: unknown) {
      console.error('Application error:', err);
      const message = err instanceof Error ? err.message : 'Failed to submit application.';
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const defaultName = identity?.name || '';
  const defaultEmail = identity?.email || user?.email || '';

  if (submitted) {
    return (
      <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/60 backdrop-blur-md px-4">
        <div className="bg-white w-full max-w-[400px] rounded-[32px] p-8 text-center shadow-2xl animate-in zoom-in duration-300">
          <div className="w-20 h-20 bg-gold rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl">
            <CheckCircle2 size={40} className="text-burgundy" />
          </div>
          <h2 className="text-2xl font-bold text-[#1A1A1A] mb-2">Request received</h2>
          <p className="text-sm text-gray-500 mb-8 leading-relaxed">
            Thank you for your heart to serve. A ministry leader will review your request and follow
            up.
          </p>
          <button
            type="button"
            onClick={() => {
              setSubmitted(false);
              onClose();
            }}
            className="w-full h-14 bg-burgundy text-white rounded-2xl font-bold shadow-lg hover:bg-burgundy-dark transition-all"
          >
            Done
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[160] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md">
      <div className="bg-eggshell w-full max-w-[450px] rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl animate-in slide-in-from-bottom-full duration-500 flex flex-col max-h-[90vh]">
        <div className="p-6 bg-burgundy text-white relative">
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors"
          >
            <X size={20} />
          </button>
          <div className="w-12 h-12 bg-gold rounded-xl flex items-center justify-center mb-4 shadow-lg rotate-3">
            <Users size={24} className="text-burgundy" />
          </div>
          <h2 className="text-2xl font-bold">Request to join</h2>
          <p className="text-red-100/70 text-xs uppercase tracking-widest font-bold mt-1">
            {initialMinistry ? initialMinistry : 'Ministry team'}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5 overflow-y-auto no-scrollbar">
          {error ? (
            <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle size={14} />
              {error}
            </div>
          ) : null}

          <div className="space-y-4">
            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">
                Full Name
              </label>
              <input
                name="name"
                required
                defaultValue={defaultName}
                placeholder="Your Name"
                className="w-full h-12 bg-white border border-gray-100 rounded-xl px-4 text-sm focus:ring-2 focus:ring-gold transition-all outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">
                Email Address
              </label>
              <input
                name="email"
                required
                type="email"
                defaultValue={defaultEmail}
                placeholder="email@example.com"
                className="w-full h-12 bg-white border border-gray-100 rounded-xl px-4 text-sm focus:ring-2 focus:ring-gold transition-all outline-none"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">
                Select Your Team
              </label>
              {teams.length === 0 ? (
                <p className="text-sm text-gray-500 px-1 py-3">
                  No teams are listed for this ministry yet. Please contact church leadership.
                </p>
              ) : (
                <div className="grid grid-cols-1 gap-2">
                  {teams.map((team, idx) => (
                    <label
                      key={team.id}
                      className="relative flex items-center p-3 rounded-xl border border-gray-100 bg-white cursor-pointer hover:border-gold/50 transition-colors has-[:checked]:border-gold has-[:checked]:bg-gold/5"
                    >
                      <input
                        type="radio"
                        name="team"
                        value={team.id}
                        className="peer hidden"
                        defaultChecked={idx === 0}
                        required
                      />
                      <div className="flex items-center gap-3 w-full">
                        <div className="w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center text-burgundy">
                          <Users size={16} />
                        </div>
                        <span className="text-sm font-bold text-[#1A1A1A]">{team.name}</span>
                        <div className="ml-auto w-4 h-4 rounded-full border border-gray-200 flex items-center justify-center peer-checked:bg-gold peer-checked:border-gold">
                          <div className="w-1.5 h-1.5 rounded-full bg-white opacity-0 peer-checked:opacity-100" />
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-widest text-gray-500 ml-1">
                Experience (Optional)
              </label>
              <textarea
                name="experience"
                rows={2}
                placeholder="Tell us a little about your background..."
                className="w-full bg-white border border-gray-100 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-gold transition-all outline-none resize-none"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || teams.length === 0}
            className="w-full h-[60px] bg-burgundy text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-burgundy-dark active:scale-95 transition-all disabled:opacity-50"
          >
            {loading ? (
              <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            ) : (
              <>
                Submit request <Send size={18} />
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
};
