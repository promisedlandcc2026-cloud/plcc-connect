/**
 * Listen — reads a chapter aloud with the phone's built-in voice (Web Speech API),
 * one verse at a time so the reader can follow along. No account or download needed.
 */
export const speechSupported = (): boolean =>
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const en = voices.filter((v) => /^en(-|_|$)/i.test(v.lang));
  return (
    en.find((v) => /natural|enhanced|premium/i.test(v.name)) ||
    en.find((v) => v.localService && /en-US/i.test(v.lang)) ||
    en.find((v) => /en-US/i.test(v.lang)) ||
    en[0]
  );
}

export type Reading = { stop: () => void };

/**
 * Speaks `verses` from index `startAt`. Calls onVerse(n) as each verse starts and onEnd()
 * when finished or stopped. Returns a handle to stop early.
 */
export function readAloud(
  intro: string,
  verses: { n: number; text: string }[],
  startAt: number,
  onVerse: (n: number | null) => void,
  onEnd: () => void
): Reading {
  const synth = window.speechSynthesis;
  let stopped = false;
  synth.cancel();
  const voice = pickVoice();

  const speak = (text: string, onDone: () => void, onStart?: () => void) => {
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.lang = voice?.lang || 'en-US';
    u.rate = 0.95;
    u.onstart = () => onStart?.();
    u.onend = () => onDone();
    u.onerror = () => onDone();
    synth.speak(u);
  };

  const next = (i: number) => {
    if (stopped) return;
    if (i >= verses.length) {
      onVerse(null);
      onEnd();
      return;
    }
    speak(verses[i].text, () => next(i + 1), () => onVerse(verses[i].n));
  };

  if (startAt === 0 && intro) speak(intro, () => next(0));
  else next(startAt);

  return {
    stop: () => {
      if (stopped) return;
      stopped = true;
      synth.cancel();
      onVerse(null);
      onEnd();
    },
  };
}
