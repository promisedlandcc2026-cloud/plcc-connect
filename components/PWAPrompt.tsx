import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { Check, EllipsisVertical, MoreHorizontal, Share, SquarePlus, X } from 'lucide-react';
import {
  canPromptNatively,
  detectInstallPlatform,
  isIosNonSafari,
  markInstallDismissed,
  markInstalled,
  promptNativeInstall,
  shouldAskToInstall,
  subscribeInstallPrompt,
} from '../lib/installPrompt';

/**
 * Asks visitors once to add PLCC Connect to their home screen.
 * "Not now" and "I've added it" are remembered, and it never shows inside the
 * installed app — see lib/installPrompt.ts.
 */
export const PWAPrompt: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [native, setNative] = useState(canPromptNatively());
  const platform = detectInstallPlatform();
  const iosNonSafari = isIosNonSafari();

  useEffect(() => {
    let alive = true;
    const check = () => {
      setNative(canPromptNatively());
      void shouldAskToInstall().then((ask) => {
        if (alive && !ask) setIsVisible(false);
      });
    };
    const unsubscribe = subscribeInstallPrompt(check);
    const timer = setTimeout(() => {
      void shouldAskToInstall().then((ask) => {
        if (alive && ask) setIsVisible(true);
      });
    }, 2500);
    return () => {
      alive = false;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);

  if (!isVisible) return null;

  const notNow = () => {
    markInstallDismissed();
    setIsVisible(false);
  };

  const addedIt = () => {
    markInstalled();
    setIsVisible(false);
  };

  const installNow = async () => {
    await promptNativeInstall();
    setIsVisible(false);
  };

  const showAndroidSteps = !native && platform === 'android';
  const showIosSteps = !native && platform === 'ios';

  // Portal to <body>: a transformed ancestor would otherwise break `fixed`.
  return createPortal(
    <div
      className="fixed inset-x-0 bottom-[calc(max(12px,env(safe-area-inset-bottom))+92px)] z-[120] flex justify-center px-3 animate-in slide-in-from-bottom-6 fade-in duration-500"
      role="dialog"
      aria-modal="false"
      aria-labelledby="awc-install-title"
    >
      <div className="w-full max-w-[476px] rounded-3xl bg-[#1A1A1A] border border-gold/30 shadow-2xl p-5 text-white relative">
        <button
          type="button"
          onClick={notNow}
          aria-label="Dismiss"
          className="absolute top-2 right-2 min-h-[44px] min-w-[44px] inline-flex items-center justify-center rounded-xl text-gray-300 hover:text-white"
        >
          <X size={20} aria-hidden />
        </button>

        <div className="flex items-center gap-3 pr-10">
          <img
            src="/icon-192.png"
            alt=""
            className="w-14 h-14 rounded-2xl shadow-lg ring-2 ring-gold/50 shrink-0"
          />
          <div>
            <p id="awc-install-title" className="text-base font-bold leading-snug">
              Get the PLCC Connect app
            </p>
            <p className="text-sm text-gray-300 leading-snug">
              Free · Opens from your home screen like any app
            </p>
          </div>
        </div>

        {native && (
          <p className="mt-4 text-sm text-gray-300">
            One tap adds PLCC Connect to your phone — no app store needed.
          </p>
        )}

        {showIosSteps && (
          <ol className="mt-4 space-y-2.5 text-sm text-gray-100">
            {iosNonSafari && (
              <li className="text-gold font-semibold">
                First open this page in Safari (the blue compass app). It's the easiest way.
              </li>
            )}
            <li className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-gold text-[#1A1A1A] text-xs font-black flex items-center justify-center shrink-0">1</span>
              <span>
                Tap <MoreHorizontal size={16} className="inline shrink-0 align-[-3px]" aria-label="three dots" /> at the bottom right, then{' '}
                <Share size={16} className="inline text-sky-400 shrink-0 align-[-3px]" aria-hidden /> <strong>Share</strong>
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-gold text-[#1A1A1A] text-xs font-black flex items-center justify-center shrink-0">2</span>
              <span>
                Scroll down, tap <strong>View More</strong> if needed, then{' '}
                <SquarePlus size={16} className="inline shrink-0 align-[-3px]" aria-hidden /> <strong>Add to Home Screen</strong>
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-gold text-[#1A1A1A] text-xs font-black flex items-center justify-center shrink-0">3</span>
              <span>Tap <strong>Add</strong> in the top right</span>
            </li>
            <li className="text-xs text-gray-400 pl-8">
              Older iPhone? Tap the <Share size={13} className="inline align-[-2px]" aria-hidden /> Share button at the bottom instead of the three dots.
            </li>
          </ol>
        )}

        {showAndroidSteps && (
          <ol className="mt-4 space-y-2.5 text-sm text-gray-100">
            <li className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-gold text-[#1A1A1A] text-xs font-black flex items-center justify-center shrink-0">1</span>
              Tap <EllipsisVertical size={16} className="shrink-0" aria-label="menu" /> in the top-right corner
            </li>
            <li className="flex items-center gap-2.5">
              <span className="w-6 h-6 rounded-full bg-gold text-[#1A1A1A] text-xs font-black flex items-center justify-center shrink-0">2</span>
              Tap <strong>Install and create shortcut</strong> (or <strong>Install app</strong> / <strong>Add to Home screen</strong>)
            </li>
          </ol>
        )}

        {(showIosSteps || showAndroidSteps) && (
          <Link
            to="/install"
            onClick={() => setIsVisible(false)}
            className="mt-3 inline-flex min-h-[44px] items-center text-sm font-bold text-gold underline underline-offset-4"
          >
            Show me step by step, with pictures of the buttons
          </Link>
        )}

        <div className="mt-5 flex gap-2.5">
          {native ? (
            <button
              type="button"
              onClick={() => void installNow()}
              className="flex-1 min-h-[48px] rounded-2xl bg-gold text-[#1A1A1A] font-black text-base"
            >
              Install app
            </button>
          ) : (
            <button
              type="button"
              onClick={addedIt}
              className="flex-1 min-h-[48px] rounded-2xl bg-gold text-[#1A1A1A] font-black text-base inline-flex items-center justify-center gap-2"
            >
              <Check size={18} aria-hidden /> I've added it
            </button>
          )}
          <button
            type="button"
            onClick={notNow}
            className="min-h-[48px] px-5 rounded-2xl border border-white/20 text-gray-200 font-bold text-base"
          >
            Not now
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
};
