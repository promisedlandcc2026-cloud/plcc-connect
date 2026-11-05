import { formatRsvpBy, isRsvpClosed } from '../lib/holidayRsvps';
import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Calendar, MapPin, CheckCircle2, Info, Clock, ExternalLink } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { formatEventDateTime } from '../lib/events';
import type { ChurchEvent } from '../types';
import { fetchMyEventAttendanceStatus } from '../lib/attendanceHistoryClient';
import { ShareToAwcChatButton } from './ShareToAwcChatButton';

interface EventDetailModuleProps {
    isOpen: boolean;
    onClose: () => void;
    event: ChurchEvent | null;
}

export const EventDetailModule: React.FC<EventDetailModuleProps> = ({ isOpen, onClose, event }) => {
    const [checkedIn, setCheckedIn] = useState(false);

    useEffect(() => {
        if (!isOpen || !event?.id) {
            setCheckedIn(false);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const { data } = await supabase.auth.getSession();
                if (!data.session) return;
                const status = await fetchMyEventAttendanceStatus(String(event.id));
                if (!cancelled) setCheckedIn(status.checkedIn);
            } catch {
                /* optional status */
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isOpen, event?.id]);

    if (!isOpen || !event) return null;

    const whenLabel = event.starts_at
        ? formatEventDateTime(event.starts_at, event.end_time)
        : event.date || 'Date TBA';

    const showRsvp = Boolean(event.rsvp_enabled && event.rsvp_url);
    const rsvpClosed = isRsvpClosed(event.rsvp_close_at);

    return createPortal(
        <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-md">
            <div className="bg-eggshell w-full max-w-[450px] rounded-t-[32px] sm:rounded-[32px] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
                <div className="relative flex-shrink-0 bg-[#1A1A1A]">
                    {event.image_url ? (
                        <img
                            src={event.image_url}
                            alt={event.title}
                            className="w-full h-auto max-h-[55vh] object-contain bg-[#1A1A1A]"
                        />
                    ) : (
                        <div className="h-28 bg-gradient-to-br from-burgundy to-burgundy-dark" />
                    )}

                    <button
                        onClick={onClose}
                        className="absolute top-4 right-4 p-2 min-w-[44px] min-h-[44px] bg-black/40 rounded-full text-white hover:bg-black/60 transition-colors z-10 flex items-center justify-center"
                        aria-label="Close"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="flex-grow overflow-y-auto no-scrollbar p-6 space-y-6">
                    <div className="flex items-start gap-3">
                        <div className="w-12 h-12 bg-gold rounded-2xl flex items-center justify-center shadow-lg rotate-3 shrink-0">
                            <Calendar size={24} className="text-burgundy" />
                        </div>
                        <div className="min-w-0 pt-1">
                            <h2 className="text-xl font-bold text-[#1A1A1A] leading-tight">{event.title}</h2>
                            <p className="text-gray-500 text-xs uppercase tracking-widest font-bold mt-0.5">
                                Event Details
                            </p>
                        </div>
                    </div>

                    {checkedIn && (
                        <div className="rounded-2xl bg-emerald-50 border border-emerald-200 px-4 py-3 flex items-center gap-3">
                            <CheckCircle2 size={20} className="text-emerald-700 shrink-0" />
                            <p className="text-sm font-bold text-emerald-900">
                                You’re checked in for this event.
                            </p>
                        </div>
                    )}

                    <div className="space-y-4">
                        <div className="flex items-start gap-4">
                            <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-burgundy shadow-sm border border-gray-100 flex-shrink-0">
                                <Clock size={18} />
                            </div>
                            <div>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">When</p>
                                <p className="text-sm font-bold text-[#1A1A1A]">{whenLabel}</p>
                            </div>
                        </div>

                        {event.location && (
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-burgundy shadow-sm border border-gray-100 flex-shrink-0">
                                    <MapPin size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Where</p>
                                    <p className="text-sm font-bold text-[#1A1A1A]">{event.location}</p>
                                </div>
                            </div>
                        )}

                        {event.description && (
                            <div className="flex items-start gap-4">
                                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-burgundy shadow-sm border border-gray-100 flex-shrink-0">
                                    <Info size={18} />
                                </div>
                                <div>
                                    <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">About</p>
                                    <p className="text-xs text-gray-600 leading-relaxed font-medium">{event.description}</p>
                                </div>
                            </div>
                        )}
                    </div>

                    {showRsvp && (
                        <>
                            <div className="h-px bg-gray-100 w-full" />
                            <div className="space-y-4">
                                <div className="text-center space-y-1">
                                    <h3 className="font-bold text-[#1A1A1A] font-serif">Ready to Join Us?</h3>
                                    <p className="text-xs text-gray-500 font-medium leading-relaxed px-2">
                                        Sign up on our official page — tell us how many are coming and any details we need.
                                    </p>
                                </div>
                                {rsvpClosed ? (
                                    <p className="w-full min-h-[56px] rounded-2xl bg-gray-100 text-gray-600 font-bold flex items-center justify-center text-sm">
                                        RSVP closed — ask a leader if you still need a seat
                                    </p>
                                ) : (
                                    <>
                                        <a
                                            href={event.rsvp_url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full min-h-[60px] bg-burgundy text-white rounded-2xl font-bold flex items-center justify-center gap-2 shadow-xl hover:bg-burgundy-dark active:scale-95 transition-all"
                                        >
                                            RSVP <ExternalLink size={18} />
                                        </a>
                                        {event.rsvp_close_at ? (
                                            <p className="text-center text-xs font-semibold text-gray-500">
                                                RSVP by {formatRsvpBy(event.rsvp_close_at)}
                                            </p>
                                        ) : null}
                                    </>
                                )}
                            </div>
                        </>
                    )}
                    <ShareToAwcChatButton kind="event" id={event.id ? String(event.id) : null} />
                </div>
            </div>
        </div>,
        document.body
    );
};
