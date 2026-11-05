import React, { useState, useEffect } from 'react';
import { PenLine, Mail, BookOpen, CheckCircle2, Heart, RotateCcw, Book, Info, ScrollText } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentSermon, Sermon } from '../data';
import { churchDateKey, getTodaysWord } from '../lib/todaysWord';

export const SermonNotes: React.FC = () => {
  const [todaySermon, setTodaySermon] = useState<Sermon>(getCurrentSermon());
  const [dailyInspiration, setDailyInspiration] = useState<{ text: string, reference: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notes, setNotes] = useState('');
  const [blanks, setBlanks] = useState<Record<number, string>>({});
  const [amenCount, setAmenCount] = useState(0);
  const [showAmenHeart, setShowAmenHeart] = useState(false);
  const [isResetting, setIsResetting] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Latest Sermon
        const today = churchDateKey();
        const { data: sermonData, error: sermonError } = await supabase
          .from('sermons')
          .select('*')
          .lte('date', today)
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!sermonError && sermonData) {
          setTodaySermon({
            ...sermonData,
            outline: typeof sermonData.outline === 'string' ? JSON.parse(sermonData.outline) : sermonData.outline
          });
        }

        // 2. Admin daily inspiration, else shared Today's Word
        const { data: inspoData, error: inspoError } = await supabase
          .from('daily_inspiration')
          .select('text, reference')
          .eq('publish_date', today)
          .maybeSingle();

        if (!inspoError && inspoData?.text) {
          setDailyInspiration(inspoData);
        } else {
          const word = getTodaysWord();
          setDailyInspiration({
            text: `“${word.verse}”`,
            reference: `${word.word} · ${word.reference}`,
          });
        }
      } catch (err) {
        console.error('Error fetching sermon notes data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  // Use a derived key for storage based on sermon date
  const noteKey = `awc_notes_${todaySermon.date}`;
  const blankKey = `awc_blanks_${todaySermon.date}`;

  // Load state from localStorage on mount or sermon change
  useEffect(() => {
    const savedNotes = localStorage.getItem(noteKey);
    const savedBlanks = localStorage.getItem(blankKey);

    setNotes(savedNotes || '');
    setBlanks(savedBlanks ? JSON.parse(savedBlanks) : {});
  }, [noteKey, blankKey]);

  const handleBlankChange = (id: number, val: string) => {
    setBlanks(prev => {
      const updated = { ...prev, [id]: val };
      localStorage.setItem(blankKey, JSON.stringify(updated));
      return updated;
    });
  };

  const handleAmen = () => {
    setAmenCount(prev => prev + 1);
    setShowAmenHeart(true);
    setTimeout(() => setShowAmenHeart(false), 1000);
    if (navigator.vibrate) navigator.vibrate(50);
  };

  const handleReset = () => {
    if (window.confirm('Would you like to clear your personal notes and fill-in-the-blanks for this message? This cannot be undone.')) {
      setIsResetting(true);

      // Clear LocalStorage
      localStorage.removeItem(noteKey);
      localStorage.removeItem(blankKey);

      // Clear State with functional updates to ensure re-render
      setNotes('');
      setBlanks({});

      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate([30, 10, 30]);

      // Clear visual resetting state after animation
      setTimeout(() => {
        setIsResetting(false);
      }, 600);
    }
  };

  return (
    <div className={`space-y-4 transition-all duration-500 ${isResetting ? 'opacity-30 scale-[0.98] blur-[2px]' : ''}`}>
      <div className="flex items-center justify-between px-1">
        <h2 className="text-xl font-bold text-[#1A1A1A] flex items-center gap-2">
          <PenLine size={20} className="text-burgundy" /> Message Guide
        </h2>
        <button
          onClick={handleReset}
          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-gray-100 text-gray-500 hover:text-burgundy hover:border-burgundy/30 transition-all text-xs font-black uppercase tracking-widest active:scale-90 shadow-sm group"
          aria-label="Clear all notes"
        >
          <RotateCcw size={14} className={`transition-transform duration-500 ${isResetting ? 'animate-spin' : 'group-hover:rotate-[-45deg]'}`} />
          Reset Notes
        </button>
      </div>

      <div className="bg-burgundy rounded-[40px] p-7 shadow-2xl relative overflow-hidden border-t-4 border-gold/30">
        <ScrollText className="absolute -right-8 -bottom-8 text-white/5 rotate-[-15deg]" size={200} />

        <div className="relative z-10 space-y-7">
          <div className="border-b border-white/10 pb-6">
            <span className="inline-block px-3 py-1 bg-gold text-burgundy text-xs font-black uppercase tracking-[0.2em] rounded-full mb-3 shadow-lg">
              Today's Word
            </span>
            <h3 className="text-white font-bold text-2xl leading-tight mb-4">
              {dailyInspiration ? dailyInspiration.text : todaySermon.title}
            </h3>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2 bg-white/10 border border-white/10 px-4 py-2 rounded-2xl backdrop-blur-sm">
                <Book size={16} className="text-gold" />
                <div className="flex flex-col">
                  <span className="text-white text-xs font-bold leading-none">
                    {dailyInspiration ? dailyInspiration.reference : todaySermon.book}
                  </span>
                  <span className="text-gold-light text-xs font-black uppercase tracking-widest mt-0.5">
                    {dailyInspiration ? 'Holy Scripture' : `Reference • ${todaySermon.version}`}
                  </span>
                </div>
              </div>

              {!dailyInspiration && (
                <div className="bg-gold/10 px-3 py-2 rounded-2xl flex flex-col">
                  <span className="text-gold text-xs font-black uppercase tracking-widest leading-none">{todaySermon.scripture}</span>
                  <span className="text-white/40 text-xs font-bold uppercase mt-1">Verse(s)</span>
                </div>
              )}

              <div className="ml-auto">
                <p className="text-white/80 text-xs font-bold uppercase tracking-widest text-right">Speaker</p>
                <p className="text-white text-xs font-bold">{todaySermon.speaker}</p>
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse"></div>
                <p className="text-xs text-gold font-black uppercase tracking-[0.2em]">Study Outline</p>
              </div>
              <span className="text-xs text-white/75 font-bold italic tracking-wide">KJV Translation Used</span>
            </div>

            {loading ? (
              <div className="py-10 flex flex-col items-center justify-center gap-4">
                <div className="w-8 h-8 border-2 border-gold/30 border-t-[#C9A35A] rounded-full animate-spin" />
                <p className="text-xs text-gold font-black uppercase tracking-widest">Retrieving Today's Message...</p>
              </div>
            ) : (
              todaySermon.outline.map((point) => (
                <div key={point.id} className="bg-white/5 border border-white/10 rounded-3xl p-5 transition-all hover:bg-white/10 group/point relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-1 h-full bg-gold opacity-0 group-hover/point:opacity-100 transition-opacity"></div>
                  <p className="text-white/90 text-base leading-relaxed mb-4 font-medium italic">
                    {point.text.split('________').map((part, i, arr) => (
                      <React.Fragment key={i}>
                        {part}
                        {i !== arr.length - 1 && (
                          <input
                            type="text"
                            value={blanks[point.id] || ''}
                            onChange={(e) => handleBlankChange(point.id, e.target.value)}
                            placeholder="..."
                            className={`mx-1 bg-transparent border-b-2 border-gold text-gold text-center w-28 outline-none placeholder:text-gold/20 transition-all focus:w-36 font-black py-0.5
                              ${blanks[point.id]?.toLowerCase().trim() === point.missingWord.toLowerCase() ? 'border-green-400 text-green-400' : ''}
                            `}
                          />
                        )}
                      </React.Fragment>
                    ))}
                  </p>
                  {blanks[point.id]?.toLowerCase().trim() === point.missingWord.toLowerCase() && (
                    <div className="flex items-center gap-1.5 text-xs text-green-400 font-black uppercase tracking-widest animate-in fade-in zoom-in duration-300">
                      <CheckCircle2 size={12} fill="currentColor" className="text-white" /> Scripture Verified
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

          <div className="pt-2">
            <div className="flex items-center gap-2 mb-3">
              <Info size={14} className="text-gold" />
              <p className="text-xs text-gold font-black uppercase tracking-[0.2em]">Personal Notes</p>
            </div>
            <textarea
              value={notes}
              onChange={(e) => {
                const val = e.target.value;
                setNotes(val);
                localStorage.setItem(noteKey, val);
              }}
              placeholder="Record what the Lord is revealing to you..."
              className="w-full h-40 bg-white/10 border border-white/20 rounded-3xl p-5 text-white placeholder:text-white/20 text-sm focus:outline-none focus:ring-2 focus:ring-gold/30 transition-all resize-none shadow-inner leading-relaxed"
            />
          </div>

          <div className="flex gap-4">
            <button
              onClick={handleAmen}
              className="relative flex-[2] h-16 bg-white text-burgundy rounded-2xl font-black text-xs flex items-center justify-center gap-3 active:scale-95 transition-all shadow-2xl overflow-hidden group"
            >
              <Heart size={20} fill={amenCount > 0 ? "#1d372c" : "none"} className={`transition-transform ${showAmenHeart ? "animate-bounce" : "group-hover:scale-110"}`} />
              DIGITAL AMEN {amenCount > 0 && <span className="bg-burgundy text-white px-2 py-0.5 rounded-full ml-1">{amenCount}</span>}
              {showAmenHeart && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <Heart size={60} className="text-burgundy/10 animate-out fade-out zoom-out duration-700" fill="currentColor" />
                </div>
              )}
            </button>
            <button
              onClick={() => {
                const mailBody = `PLCC Message Notes\n\nTitle: ${todaySermon.title}\nScripture: ${todaySermon.scripture} (${todaySermon.book} • ${todaySermon.version})\n\nMy Reflection:\n${notes}\n\nFilled Blanks:\n${Object.entries(blanks).map(([id, val]) => `Point ${id}: ${val}`).join('\n')}`;
                window.location.href = `mailto:?subject=PLCC Sermon Notes: ${todaySermon.title}&body=${encodeURIComponent(mailBody)}`;
              }}
              className="flex-1 h-16 bg-gold text-[#1A1A1A] rounded-2xl font-black text-xs flex items-center justify-center gap-2 active:scale-95 transition-all shadow-xl uppercase tracking-tighter"
            >
              <Mail size={18} /> Email
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
