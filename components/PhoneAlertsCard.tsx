import React, { useCallback, useEffect, useState } from 'react';
import { BellRing, BellOff, Check } from 'lucide-react';
import { Card } from './ui/Card';
import { Button, ButtonLink } from './ui/Button';
import { useAuth } from '../context/AuthContext';
import {
  dismissNudge,
  getAlertsState,
  nudgeDismissed,
  sendTestAlert,
  turnOffAlerts,
  turnOnAlerts,
  updateAlertTopics,
  type AlertsState,
  type AlertTopic,
} from '../lib/phoneAlerts';

const TOPICS: { key: AlertTopic; label: string; hint: string; locked?: boolean }[] = [
  { key: 'church', label: 'Church alerts', hint: "We're live, events, Vault News", locked: true },
  { key: 'prayer', label: 'Prayer requests', hint: 'When someone shares a prayer request' },
  { key: 'community', label: 'My community', hint: 'Mentions, replies, huddles, PLCC Bucks' },
  { key: 'daily', label: 'Morning devotional', hint: 'Today’s devotional at 7 AM' },
];

/**
 * Turn phone alerts on or off.
 *  variant="full"  — Me page: always shown, with choices.
 *  variant="nudge" — Home: a short invitation, only until alerts are on or "Not now".
 */
export const PhoneAlertsCard: React.FC<{ variant?: 'full' | 'nudge' }> = ({ variant = 'full' }) => {
  const { user } = useAuth();
  const [state, setState] = useState<AlertsState | null>(null);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const [hidden, setHidden] = useState(() => variant === 'nudge' && nudgeDismissed());

  const refresh = useCallback(() => {
    getAlertsState()
      .then(setState)
      .catch(() => setState({ kind: 'not-set-up' }));
  }, []);

  useEffect(() => {
    if (!user || hidden) return;
    refresh();
  }, [user, hidden, refresh]);

  if (!user || hidden || !state) return null;
  if (variant === 'nudge' && !(state.kind === 'off' || state.kind === 'needs-install')) return null;
  if (state.kind === 'signed-out' || (variant === 'full' && state.kind === 'not-set-up')) return null;

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNote(null);
    try {
      await fn();
    } catch (err) {
      setNote({ ok: false, text: err instanceof Error ? err.message : 'Something went wrong. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const turnOn = () =>
    run(async () => {
      const next = await turnOnAlerts();
      setState(next);
      if (next.kind === 'on') setNote({ ok: true, text: "Alerts are on. We'll let you know when we go live." });
    });

  const title = (
    <h2 className="flex items-center gap-2 font-display text-[20px] font-bold text-ink">
      <BellRing className="h-5 w-5 text-burgundy" aria-hidden />
      Phone alerts
    </h2>
  );

  let content: React.ReactNode;
  if (state.kind === 'needs-install') {
    content = (
      <>
        <p className="text-[15px] text-ink-soft">
          Get a ping when service goes live, plus event reminders and church news. On iPhone, first add PLCC Connect to your Home Screen,
          then open it from there and tap “Turn on alerts.”
        </p>
        <ButtonLink to="/install" size="lg" fullWidth>
          Show me how
        </ButtonLink>
      </>
    );
  } else if (state.kind === 'unsupported') {
    content = <p className="text-[15px] text-ink-soft">This browser can’t show alerts. Try Chrome or Safari on your phone.</p>;
  } else if (state.kind === 'not-set-up') {
    return null;
  } else if (state.kind === 'blocked') {
    content = (
      <p className="text-[15px] text-ink-soft">
        Alerts are blocked for PLCC Connect. To allow them, open your phone’s <b>Settings</b>, find <b>PLCC Connect</b> (or your browser),
        tap <b>Notifications</b>, and turn them on. Then come back here.
      </p>
    );
  } else if (state.kind === 'off') {
    content = (
      <>
        <p className="text-[15px] text-ink-soft">
          Get a ping when service goes live, event reminders like “RSVP closes Friday,” and new Vault News. Free — no text messages.
        </p>
        <Button size="lg" fullWidth disabled={busy} onClick={() => void turnOn()}>
          <BellRing className="h-5 w-5" aria-hidden />
          {busy ? 'Turning on…' : 'Turn on alerts'}
        </Button>
        {variant === 'nudge' ? (
          <Button
            variant="ghost"
            fullWidth
            onClick={() => {
              dismissNudge();
              setHidden(true);
            }}
          >
            Not now
          </Button>
        ) : null}
      </>
    );
  } else {
    const on = new Set<AlertTopic>(state.topics);
    content = (
      <>
        <p className="flex items-center gap-2 text-[15px] font-semibold text-green-700">
          <Check className="h-5 w-5" aria-hidden /> Alerts are on for this phone
        </p>
        <fieldset className="space-y-2">
          <legend className="sr-only">Which alerts</legend>
          {TOPICS.map((t) => (
            <label key={t.key} className="flex items-start gap-3 rounded-xl border border-gray-100 p-3">
              <input
                type="checkbox"
                className="mt-1 h-6 w-6 accent-[#1d372c]"
                checked={on.has(t.key)}
                disabled={busy || t.locked}
                onChange={(e) =>
                  void run(async () => {
                    const next = new Set<AlertTopic>(on);
                    if (e.target.checked) next.add(t.key);
                    else next.delete(t.key);
                    setState(await updateAlertTopics([...next]));
                  })
                }
              />
              <span>
                <span className="block text-[16px] font-semibold text-ink">{t.label}</span>
                <span className="block text-sm text-ink-soft">{t.hint}</span>
              </span>
            </label>
          ))}
        </fieldset>
        <div className="flex flex-col gap-2">
          <Button
            variant="secondary"
            size="lg"
            fullWidth
            disabled={busy}
            onClick={() =>
              void run(async () => {
                const n = await sendTestAlert();
                setNote(n ? { ok: true, text: 'Test alert sent. It should arrive in a few seconds.' } : { ok: false, text: 'No alert went out. Try turning alerts off and on.' });
              })
            }
          >
            Send me a test alert
          </Button>
          <Button
            variant="subtle"
            fullWidth
            disabled={busy}
            onClick={() =>
              void run(async () => {
                setState(await turnOffAlerts());
                setNote({ ok: true, text: 'Alerts are off for this phone.' });
              })
            }
          >
            <BellOff className="h-4 w-4" aria-hidden />
            Turn off alerts
          </Button>
        </div>
      </>
    );
  }

  return (
    <Card as="section" className="space-y-3" aria-label="Phone alerts">
      {title}
      {content}
      {note ? (
        <p role="status" className={`text-sm font-semibold ${note.ok ? 'text-green-700' : 'text-red-700'}`}>
          {note.text}
        </p>
      ) : null}
    </Card>
  );
};
