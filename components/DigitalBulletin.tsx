import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Book, ListChecks, Clock, Activity, RotateCcw, ChevronRight } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { getCurrentSermon, Sermon } from '../data';
import { getTodaysWord, type TodaysWordEntry, churchDateKey } from '../lib/todaysWord';

interface ServiceSegment {
  id: number;
  time: string;
  label: string;
  startTimeInMinutes: number;
}

type AdminInspiration = { text: string; reference: string };

export const DigitalBulletin: React.FC = () => {
  const [activeSegmentIndex, setActiveSegmentIndex] = useState<number>(-1);
  const [isManualMode, setIsManualMode] = useState(false);
  const [isServiceLive, setIsServiceLive] = useState(false);
  const [todaySermon, setTodaySermon] = useState<Sermon>(getCurrentSermon());
  const [adminInspiration, setAdminInspiration] = useState<AdminInspiration | null>(null);
  const [loading, setLoading] = useState(true);

  const localWord = useMemo<TodaysWordEntry>(() => getTodaysWord(), []);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Latest Sermon
        const { data: sermonData, error: sermonError } = await supabase
          .from('sermons')
          .select('*')
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (!sermonError && sermonData) {
          setTodaySermon({
            ...sermonData,
            outline: typeof sermonData.outline === 'string' ? JSON.parse(sermonData.outline) : sermonData.outline
          });
        }

        // 2. Optional admin override for today's church calendar date
        const { data: inspoData, error: inspoError } = await supabase
          .from('daily_inspiration')
          .select('text, reference')
          .eq('publish_date', churchDateKey())
          .maybeSingle();

        if (!inspoError && inspoData?.text) {
          setAdminInspiration(inspoData);
        }
      } catch (err) {
        console.error('Error fetching bulletin data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const sundaySchedule: ServiceSegment[] = [
    { id: 1, time: '10:30 AM', label: 'Opening Prayer & Worship', startTimeInMinutes: 630 },
    { id: 2, time: '10:55 AM', label: 'Welcome & Announcements', startTimeInMinutes: 655 },
    { id: 3, time: '11:10 AM', label: 'Tithes & Offerings', startTimeInMinutes: 670 },
    { id: 4, time: '11:25 AM', label: 'The Spoken Word', startTimeInMinutes: 685 },
    { id: 5, time: '12:15 PM', label: 'Altar Call & Benediction', startTimeInMinutes: 735 },
  ];

  const wednesdaySchedule: ServiceSegment[] = [
    { id: 1, time: '7:30 PM', label: 'Mid-Week Praise', startTimeInMinutes: 1170 },
    { id: 2, time: '7:50 PM', label: 'Bible Study / Word', startTimeInMinutes: 1190 },
    { id: 3, time: '8:45 PM', label: 'Intercessory Prayer', startTimeInMinutes: 1245 },
    { id: 4, time: '9:15 PM', label: 'Benediction', startTimeInMinutes: 1275 },
  ];

  const currentSchedule = new Date().getDay() === 3 ? wednesdaySchedule : sundaySchedule;

  const updateFromClock = useCallback(() => {
    if (isManualMode) return;

    const now = new Date();
    const day = now.getDay();
    const currentTimeInMinutes = now.getHours() * 60 + now.getMinutes();

    let schedule: ServiceSegment[] = [];
    let endTime = 0;

    if (day === 0) {
      schedule = sundaySchedule;
      endTime = 750;
    } else if (day === 3) {
      schedule = wednesdaySchedule;
      endTime = 1290;
    }

    const live = schedule.length > 0 &&
      currentTimeInMinutes >= schedule[0].startTimeInMinutes &&
      currentTimeInMinutes <= endTime;

    setIsServiceLive(live);

    if (live) {
      let foundIndex = -1;
      for (let i = schedule.length - 1; i >= 0; i--) {
        if (currentTimeInMinutes >= schedule[i].startTimeInMinutes) {
          foundIndex = i;
          break;
        }
      }
      setActiveSegmentIndex(foundIndex);
    } else {
      setActiveSegmentIndex(-1);
    }
  }, [isManualMode, sundaySchedule, wednesdaySchedule]);

  useEffect(() => {
    updateFromClock();
    const timer = setInterval(updateFromClock, 10000);
    return () => clearInterval(timer);
  }, [updateFromClock]);

  const handleSegmentClick = (index: number) => {
    setActiveSegmentIndex(index);
    setIsManualMode(true);
    setIsServiceLive(true);
  };

  const resetToClock = () => {
    setIsManualMode(false);
    // Explicitly trigger update after state change
    setTimeout(updateFromClock, 0);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between px-1">
        <div className="flex flex-col">
          <h2 className="text-xl font-bold text-[#1A1A1A]">Digital Bulletin</h2>
          <div className="flex items-center gap-1 mt-0.5">
            <span className={`text-xs font-bold uppercase tracking-widest ${isManualMode ? 'text-gold' : 'text-gray-500'}`}>
              {isManualMode ? '● Manual Sync' : '● Auto Time'}
            </span>
            {isManualMode && (
              <button onClick={resetToClock} className="ml-2 text-xs text-burgundy font-black uppercase flex items-center gap-0.5 hover:underline">
                <RotateCcw size={8} /> Reset Sync
              </button>
            )}
          </div>
        </div>

        {isServiceLive && (
          <div className="bg-burgundy text-white px-3 py-1 rounded-full flex items-center gap-1.5 shadow-lg shadow-burgundy/20">
            <Activity size={12} className="animate-pulse" />
            <span className="text-xs font-black uppercase tracking-widest">Live</span>
          </div>
        )}
      </div>

      <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex items-start gap-3 transition-all hover:border-gold/30">
        <div className="bg-gold/10 p-2 rounded-lg text-burgundy shrink-0 mt-0.5">
          <Book size={18} />
        </div>
        <div className="w-full min-w-0 space-y-1 animate-in fade-in duration-500">
          <p className="text-xs font-black text-gray-500 uppercase tracking-tighter">Today's Word</p>
          {loading ? (
            <div className="space-y-1.5 pt-0.5">
              <div className="h-4 w-28 bg-gray-100 animate-pulse rounded" />
              <div className="h-3 w-full max-w-[16rem] bg-gray-50 animate-pulse rounded" />
              <div className="h-3 w-40 bg-gray-50 animate-pulse rounded" />
            </div>
          ) : adminInspiration ? (
            <>
              <p className="text-sm font-bold text-[#1A1A1A] leading-snug">{adminInspiration.text}</p>
              {adminInspiration.reference ? (
                <p className="text-xs font-semibold text-burgundy/80">{adminInspiration.reference}</p>
              ) : null}
            </>
          ) : localWord ? (
            <>
              <p className="text-sm font-bold text-[#1A1A1A] leading-snug">{localWord.word}</p>
              <p className="text-xs text-gray-600 leading-relaxed">{localWord.meaning}</p>
              <p className="text-xs text-gray-500 italic leading-relaxed">
                “{localWord.verse}”
                <span className="not-italic font-semibold text-burgundy/70"> — {localWord.reference}</span>
              </p>
            </>
          ) : (
            <p className="text-xs font-bold text-[#1A1A1A]">
              {todaySermon.scripture || 'Come expectant — God still speaks.'}
            </p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-[32px] p-2 border border-gray-100 shadow-sm overflow-hidden">
        <div className="p-4 space-y-1">
          {currentSchedule.map((item, idx) => {
            const isActive = activeSegmentIndex === idx;
            const isDone = activeSegmentIndex > idx;

            return (
              <button
                key={item.id}
                onClick={() => handleSegmentClick(idx)}
                className={`w-full flex items-center gap-4 p-4 rounded-2xl transition-all duration-300 text-left relative group
                  ${isActive ? 'bg-burgundy shadow-xl shadow-burgundy/20 translate-x-1' : 'hover:bg-gray-50'}
                `}
              >
                <div className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all
                  ${isActive ? 'bg-white border-white' :
                    isDone ? 'bg-gold border-gold' : 'bg-gray-50 border-gray-100'}
                `}>
                  {isDone ? (
                    <ListChecks size={14} className="text-white" />
                  ) : isActive ? (
                    <Activity size={14} className="text-burgundy animate-pulse" />
                  ) : (
                    <Clock size={12} className="text-gray-500" />
                  )}
                </div>

                <div className="flex flex-col flex-1">
                  <span className={`text-xs font-black uppercase tracking-widest transition-colors
                    ${isActive ? 'text-white/70' : isDone ? 'text-gold-ink' : 'text-gray-500'}
                  `}>
                    {item.time}
                  </span>
                  <span className={`text-sm font-bold transition-colors
                    ${isActive ? 'text-white' : isDone ? 'text-gray-500 line-through decoration-[#C9A35A]/60' : 'text-gray-600'}
                  `}>
                    {item.label}
                  </span>
                </div>

                {isActive && (
                  <div className="absolute right-4 animate-in fade-in slide-in-from-right-2">
                    <ChevronRight size={16} className="text-white/40" />
                  </div>
                )}
              </button>
            );
          })}
        </div>

        <div className="px-6 py-4 bg-gray-50/50 border-t border-gray-50 flex items-center justify-between">
          <p className="text-xs text-gray-500 font-medium italic">
            Tap a section to sync manually if service is running late.
          </p>
        </div>
      </div>
    </div>
  );
};
