
import React, { useState, useEffect } from 'react';
import { MessageSquare, Heart, Shield, Loader2, RefreshCcw, X, PenLine } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { supabasePublic } from '../lib/supabasePublic';
import { isPublicPrayerRow } from '../lib/memberHomeData';
import { PrayerModule } from './PrayerModule';

interface PrayerRequest {
    id: string;
    member_name: string;
    content: string; // Changed from 'request' to match DB
    is_confidential: boolean;
    /** Set when the Intercessors marked it Prayed in the Prayer Watch. */
    intercessor_prayed_at?: string | null;
    created_at: string;
    agreements?: number;
}

export const PrayerWall: React.FC = () => {
    const [requests, setRequests] = useState<PrayerRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [selectedPrayer, setSelectedPrayer] = useState<PrayerRequest | null>(null);
    const [agreedIds, setAgreedIds] = useState<Set<string>>(new Set());
    const [processingIds, setProcessingIds] = useState<Set<string>>(new Set());
    const [isPrayerModuleOpen, setIsPrayerModuleOpen] = useState(false);
    const [fetchError, setFetchError] = useState<string | null>(null);

    const fetchPrayers = async (silent = false) => {
        if (!silent) setLoading(true);
        setFetchError(null);
        try {
            // Match Vault WALL + RLS: public rows are status=Published.
            // Do not require is_confidential=false — Vault-approved rows often leave it null,
            // and PostgREST .eq(false) drops nulls (empty Connect wall).
            const { data, error } = await supabasePublic
                .from('prayer_requests')
                .select('*')
                .eq('status', 'Published')
                .order('created_at', { ascending: false })
                .limit(40);

            if (error) throw error;
            setRequests((data || []).filter(isPublicPrayerRow) as PrayerRequest[]);
        } catch (err) {
            console.error('Error fetching prayers:', err);
            const msg = err && typeof err === 'object' && 'message' in err
                ? String((err as { message?: string }).message || '')
                : '';
            if (/permission denied|42501/i.test(msg)) {
                setFetchError('Prayer wall access is not enabled yet. Ask an admin to run the prayer SELECT grant.');
            } else {
                setFetchError('Could not load prayer requests. Pull to refresh or try again.');
            }
            setRequests([]);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchPrayers();
        // Load local agreements
        const saved = localStorage.getItem('awc_agreed_prayers');
        if (saved) setAgreedIds(new Set(JSON.parse(saved)));
    }, []);

    const handleRefresh = () => {
        setRefreshing(true);
        fetchPrayers(true);
    };

    const getAgreements = (prayer: PrayerRequest) => {
        if (!prayer) return 0;
        return Math.max(prayer.agreements || 0, (prayer as any).prayed_count || 0);
    };

    const handleAgree = async (e: React.MouseEvent, prayer: PrayerRequest) => {
        e.stopPropagation();
        if (!prayer?.id || processingIds.has(prayer.id)) return;

        const isAgreed = agreedIds.has(prayer.id);

        if (navigator.vibrate) navigator.vibrate(50);

        // Optimistic UI update
        const currentCount = getAgreements(prayer);
        const newCount = isAgreed ? Math.max(0, currentCount - 1) : currentCount + 1;

        setProcessingIds(prev => new Set(prev).add(prayer.id));

        // 1. Update the requests list (Source of Truth)
        setRequests(prev => prev.map(p => p.id === prayer.id ? { ...p, agreements: newCount, prayed_count: newCount } : p));

        // 2. Update selected prayer if modal is open - directly sync with new data
        if (selectedPrayer?.id === prayer.id) {
            setSelectedPrayer(prev => prev ? { ...prev, agreements: newCount, prayed_count: newCount } : null);
        }

        // 3. Update local state and storage
        setAgreedIds(prev => {
            const updated = new Set(prev);
            if (isAgreed) {
                updated.delete(prayer.id);
            } else {
                updated.add(prayer.id);
            }
            localStorage.setItem('awc_agreed_prayers', JSON.stringify(Array.from(updated)));
            return updated;
        });

        try {
            if (isAgreed) {
                await supabase
                    .from('prayer_requests')
                    .update({ agreements: newCount, prayed_count: newCount })
                    .eq('id', prayer.id);
            } else {
                const { error } = await supabase.rpc('increment_agreements', { request_id: prayer.id });

                if (error) {
                    console.warn('[PrayerWall] RPC failed, falling back to direct update:', error);
                    await supabase
                        .from('prayer_requests')
                        .update({ agreements: newCount, prayed_count: newCount })
                        .eq('id', prayer.id);
                }
            }
        } catch (err) {
            console.error('[PrayerWall] Critical error persisting agreement:', err);
        } finally {
            setProcessingIds(prev => {
                const next = new Set(prev);
                next.delete(prayer.id);
                return next;
            });
        }
    };

    const getTimeAgo = (date: string) => {
        const now = new Date();
        const then = new Date(date);
        const diffInMs = now.getTime() - then.getTime();
        const diffInMins = Math.floor(diffInMs / (1000 * 60));
        const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
        const diffInDays = Math.floor(diffInMs / (1000 * 60 * 60 * 24));

        if (diffInMins < 60) return `${diffInMins}m ago`;
        if (diffInHours < 24) return `${diffInHours}h ago`;
        return `${diffInDays}d ago`;
    };

    return (
        <>
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex min-w-0 items-center gap-3">
                    <div>
                        <h2 className="font-display text-[24px] font-bold tracking-tight text-[#F4ECDB]">Prayer Wall</h2>
                        <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#F4ECDB]/85">Standing in agreement</p>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={loading || refreshing}
                    aria-label="Refresh prayer requests"
                    className={`h-11 w-11 inline-flex items-center justify-center bg-white rounded-xl border border-gray-100 shadow-sm text-gray-500 hover:text-burgundy transition-all active:scale-95 ${refreshing ? 'animate-spin' : ''}`}
                >
                    <RefreshCcw size={16} aria-hidden />
                </button>
                <button
                    onClick={() => setIsPrayerModuleOpen(true)}
                    className="tribes-gold-btn flex shrink-0 items-center gap-1.5 whitespace-nowrap min-h-[44px] px-4 rounded-full text-[15px] font-bold active:scale-95 transition-all"
                >
                    <PenLine size={16} aria-hidden /> Add a prayer
                </button>
            </div>

            <div className="relative">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-16 rounded-[24px] border border-dashed border-[#D9B45E]/40">
                        <Loader2 size={32} className="text-gold animate-spin mb-4" />
                        <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">Loading Requests...</p>
                    </div>
                ) : requests.length > 0 ? (
                    <div className="flex flex-col gap-4">
                        {requests.map((prayer) => (
                            <div key={prayer.id} className="tribes-ticket-shadow">
                            <div
                                role="button"
                                tabIndex={0}
                                onClick={() => setSelectedPrayer(prayer)}
                                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedPrayer(prayer); } }}
                                className="tribes-ticket cursor-pointer px-6 pb-4 pt-6 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-[#E4C36A]"
                            >
                                <div className="flex items-start gap-4">
                                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#0B3322] font-display text-[22px] font-bold text-[#F6E7B8] ring-1 ring-[#C9A35A]/70">
                                        {(prayer.member_name || 'A').charAt(0).toUpperCase()}
                                    </div>
                                    <div className="min-w-0 flex-1 border-l border-[#C9A35A]/60 pl-4">
                                        <p className="text-[13px] font-medium text-[#3F5246]">
                                            {prayer.member_name ? <span className="font-bold text-[#0E2A1C]">{prayer.member_name} · </span> : null}
                                            {getTimeAgo(prayer.created_at)}
                                        </p>
                                        <p className="mt-1 text-[15px] leading-snug text-[#0E2A1C] line-clamp-4">{prayer.content}</p>
                                        {prayer.intercessor_prayed_at && (
                                            <p className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-[12px] font-bold text-emerald-800">
                                                🙏 Prayed for by the Intercessors
                                            </p>
                                        )}
                                    </div>
                                </div>
                                <div className="mt-4 flex items-center justify-between border-t border-[#C9A35A]/45 pt-3">
                                    <div className="flex items-center gap-2 text-[12px] font-bold uppercase tracking-[0.22em] text-[#0E2A1C]">
                                        <Shield size={14} className="text-[#B8893A]" aria-hidden /> Public request
                                    </div>
                                    <button
                                        type="button"
                                        onClick={(e) => handleAgree(e, prayer)}
                                        disabled={processingIds.has(prayer.id)}
                                        aria-label={agreedIds.has(prayer.id) ? 'You are standing in agreement' : 'Stand in agreement'}
                                        className={`flex min-h-[40px] items-center gap-1.5 rounded-full border px-4 text-[15px] font-bold transition-all active:scale-95 ${
                                            agreedIds.has(prayer.id)
                                                ? 'border-[#0B3322] bg-[#0B3322] text-[#F6E7B8]'
                                                : 'border-[#0E2A1C]/60 bg-transparent text-[#0E2A1C]'
                                        }`}
                                    >
                                        {processingIds.has(prayer.id) ? (
                                            <Loader2 size={15} className="animate-spin" />
                                        ) : (
                                            <Heart size={16} fill={agreedIds.has(prayer.id) ? 'currentColor' : 'none'} />
                                        )}
                                        {getAgreements(prayer)}
                                    </button>
                                </div>
                            </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-12 bg-white rounded-[32px] border border-dashed border-gray-200 px-6">
                        <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-500">
                            <MessageSquare size={24} />
                        </div>
                        {fetchError ? (
                            <>
                                <p className="text-xs font-bold text-burgundy uppercase tracking-widest">Couldn’t Load Prayers</p>
                                <p className="text-xs text-gray-500 mt-2 leading-relaxed">{fetchError}</p>
                                <button
                                    type="button"
                                    onClick={handleRefresh}
                                    className="mt-4 text-xs font-black uppercase tracking-widest text-burgundy underline"
                                >
                                    Try again
                                </button>
                            </>
                        ) : (
                            <>
                                <p className="text-xs font-bold text-gray-500 uppercase tracking-widest">No Public Requests Yet</p>
                                <p className="text-xs text-gray-500 mt-1">Be the first to share a prayer!</p>
                            </>
                        )}
                    </div>
                )}

                {/* Subtle Side Gradients for Scroll */}
                <div className="absolute top-0 right-0 bottom-4 w-12 bg-gradient-to-l from-[#F7F1E5] to-transparent pointer-events-none z-10 hidden sm:block"></div>
                <div className="absolute top-0 left-0 bottom-4 w-12 bg-gradient-to-r from-[#F7F1E5] to-transparent pointer-events-none z-10 hidden sm:block"></div>
            </div>

            {/* Detail Modal */}
            {selectedPrayer && (
                <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-md px-4 animate-in fade-in duration-200" onClick={() => setSelectedPrayer(null)}>
                    <div
                        className="bg-white w-full max-w-[400px] rounded-[32px] p-8 shadow-2xl relative animate-in zoom-in-95 duration-200"
                        onClick={e => e.stopPropagation()}
                    >
                        <button
                            onClick={() => setSelectedPrayer(null)}
                            className="absolute top-4 right-4 p-2 bg-gray-50 rounded-full hover:bg-gray-100 transition-colors"
                        >
                            <X size={20} className="text-gray-500" />
                        </button>

                        <div className="flex items-center gap-3 mb-6">
                            <div className="w-12 h-12 bg-burgundy rounded-2xl flex items-center justify-center text-gold font-black text-lg shadow-lg rotate-3">
                                {(selectedPrayer.member_name || 'A').charAt(0).toUpperCase()}
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-[#1A1A1A]">{selectedPrayer.member_name}</h3>
                                <p className="text-xs text-gray-500">{getTimeAgo(selectedPrayer.created_at)}</p>
                            </div>
                        </div>

                        <div className="bg-eggshell p-6 rounded-2xl border border-burgundy/10 mb-8 max-h-[40vh] overflow-y-auto">
                            <p className="text-[#1A1A1A] leading-relaxed italic font-medium">
                                "{selectedPrayer.content}"
                            </p>
                            {selectedPrayer.intercessor_prayed_at && (
                                <p className="mt-4 inline-flex items-center gap-1 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-1 text-xs font-bold text-emerald-700">
                                    🙏 Prayed for by the Intercessors
                                </p>
                            )}
                        </div>

                        <div className="flex items-center justify-between">
                            <p className="text-xs font-bold uppercase tracking-widest text-burgundy">
                                {getAgreements(selectedPrayer)} Standing in Agreement
                            </p>
                            <button
                                onClick={(e) => handleAgree(e, selectedPrayer)}
                                disabled={processingIds.has(selectedPrayer.id)}
                                className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all shadow-lg active:scale-95
                                    ${agreedIds.has(selectedPrayer.id)
                                        ? 'bg-burgundy text-white hover:bg-burgundy-dark'
                                        : 'bg-white text-burgundy border border-burgundy/10 hover:bg-burgundy/5'}`}
                            >
                                {processingIds.has(selectedPrayer.id) ? (
                                    <Loader2 size={18} className="animate-spin" />
                                ) : (
                                    <Heart size={18} fill={agreedIds.has(selectedPrayer.id) ? "currentColor" : "none"} />
                                )}
                                {agreedIds.has(selectedPrayer.id) ? 'Agreed' : 'I Agree'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>

        <PrayerModule isOpen={isPrayerModuleOpen} onClose={() => { setIsPrayerModuleOpen(false); fetchPrayers(true); }} />
        </>
    );
};
