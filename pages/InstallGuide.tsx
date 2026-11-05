import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Check,
  EllipsisVertical,
  Menu,
  MoreHorizontal,
  Share,
  Smartphone,
  SquarePlus,
} from 'lucide-react';
import {
  detectInstallPlatform,
  isRunningInstalled,
  markInstalled,
} from '../lib/installPrompt';

type Phone = 'iphone' | 'android';
type IosBar = 'dots' | 'share' | 'ipad';
type Photo = { src: string; alt: string };
type Step = { say: React.ReactNode; more?: React.ReactNode; photos?: Photo[]; note?: string };

const PHOTO = {
  safari: { src: '/install/safari-icon.webp', alt: 'A pen pointing at the Safari compass icon on the home screen' },
  openButton: { src: '/install/open-button.webp', alt: 'The gold Open PLCC Connect button on the church website' },
  shareIpad: { src: '/install/share-button-ipad.webp', alt: 'A pen pointing at the Share button at the top right of Safari on an iPad' },
  viewMore: { src: '/install/view-more.webp', alt: 'The Share menu, with a pen pointing at View More' },
  addToHome: { src: '/install/add-to-home-screen.webp', alt: 'The longer Share menu with Add to Home Screen at the bottom of the list' },
  tapAdd: { src: '/install/tap-add.webp', alt: 'The Add to Home Screen screen with Open as Web App on and a pen pointing at Add' },
  androidChrome: { src: '/install/android-chrome-icon.webp', alt: 'A pen pointing at the Chrome app icon on an Android home screen' },
  androidOpenButton: { src: '/install/android-open-button.webp', alt: 'The gold Open PLCC Connect button on the church website in Chrome' },
  androidDots: { src: '/install/android-menu-dots.webp', alt: 'A pen pointing at the three dots menu in Chrome' },
  androidInstallDialog: { src: '/install/android-install-dialog.webp', alt: 'The Install and create shortcut box with a pen pointing at Install' },
  androidInstall: { src: '/install/android-install-shortcut.webp', alt: "Chrome's menu with a pen pointing at Install and create shortcut" },
} satisfies Record<string, Photo>;

const IPAD_PHOTO_NOTE = 'Photo taken on an iPad. On an iPhone this menu looks the same.';
type AndroidBrowser = 'chrome' | 'samsung';

/** A button drawn the way it looks on the phone. */
const Chip: React.FC<{ icon?: React.ReactNode; children?: React.ReactNode; label?: string }> = ({
  icon,
  children,
  label,
}) => (
  <span
    className="inline-flex items-center gap-1.5 align-middle whitespace-nowrap rounded-lg border-2 border-ink bg-eggshell px-2 py-0.5 text-[15px] font-extrabold"
    aria-label={label}
  >
    {icon}
    {children}
  </span>
);

const Steps: React.FC<{ steps: Step[] }> = ({ steps }) => (
  <ol className="flex flex-col gap-3">
    {steps.map((s, i) => (
      <li key={i} className="grid grid-cols-[44px_1fr] gap-3 items-start rounded-2xl bg-white border border-black/10 p-4 shadow-card">
        <span className="w-11 h-11 rounded-full bg-gold text-ink font-black text-xl flex items-center justify-center" aria-hidden>
          {i + 1}
        </span>
        <div className="min-w-0 flex flex-col gap-1">
          <p className="text-[19px] font-bold leading-snug text-ink">
            <span className="sr-only">Step {i + 1}: </span>
            {s.say}
          </p>
          {s.more && <p className="text-base text-ink-muted leading-snug">{s.more}</p>}
          {s.photos?.map((ph) => (
            <img
              key={ph.src}
              src={ph.src}
              alt={ph.alt}
              loading="lazy"
              decoding="async"
              className="mt-2 w-full max-w-full rounded-xl border border-black/10"
            />
          ))}
          {s.photos && s.note && <p className="text-xs text-ink-soft">{s.note}</p>}
        </div>
      </li>
    ))}
  </ol>
);

const Toggle: React.FC<{
  options: { id: string; label: React.ReactNode }[];
  value: string;
  onChange: (id: string) => void;
  label: string;
}> = ({ options, value, onChange, label }) => (
  <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
    {options.map((o) => (
      <button
        key={o.id}
        type="button"
        aria-pressed={value === o.id}
        onClick={() => onChange(o.id)}
        className={`min-h-[44px] px-4 rounded-full border inline-flex items-center gap-2 text-[15px] font-bold transition-colors ${
          value === o.id
            ? 'border-burgundy bg-burgundy/10 text-burgundy'
            : 'border-black/15 bg-white text-ink'
        }`}
      >
        {o.label}
      </button>
    ))}
  </div>
);

const SAFARI_FIRST: Step = {
  say: (
    <>
      Open <b>plcc-connect.vercel.app</b> in <b>Safari</b>.
    </>
  ),
  more: (
    <>
      Safari is the blue compass app. If this page opened inside WhatsApp or Facebook, tap{' '}
      <b>Open in Safari</b> or the compass icon first.
    </>
  ),
};

const ADD_ICON = <SquarePlus size={18} aria-hidden />;

/**
 * Public step-by-step guide: add PLCC Connect to an iPhone or Android home screen.
 * Linked from the install prompt, the Welcome screen and the Me tab; safe to share as /install.
 */
export const InstallGuidePage: React.FC = () => {
  const detected = detectInstallPlatform();
  const hash = typeof window !== 'undefined' ? window.location.hash.replace('#', '').toLowerCase() : '';
  const initialPhone: Phone =
    hash === 'android' || hash === 'iphone' ? (hash as Phone) : detected === 'android' ? 'android' : 'iphone';
  const isSamsung = typeof navigator !== 'undefined' && /SamsungBrowser/i.test(navigator.userAgent || '');

  const [phone, setPhone] = useState<Phone>(initialPhone);
  const isIpad =
    typeof navigator !== 'undefined' &&
    (/iPad/i.test(navigator.userAgent || '') || (/Macintosh/.test(navigator.userAgent || '') && navigator.maxTouchPoints > 1));
  const [iosBar, setIosBar] = useState<IosBar>(isIpad ? 'ipad' : 'dots');
  const [androidBrowser, setAndroidBrowser] = useState<AndroidBrowser>(isSamsung ? 'samsung' : 'chrome');
  const installed = isRunningInstalled();

  const iosDotsSteps: Step[] = [
    SAFARI_FIRST,
    {
      say: (
        <>
          Tap the three dots <Chip icon={<MoreHorizontal size={18} aria-hidden />} label="three dots button" /> at the
          bottom right.
        </>
      ),
      more: 'They sit next to the website address bar.',
    },
    {
      say: (
        <>
          Tap <Chip icon={<Share size={18} aria-hidden />}>Share</Chip>.
        </>
      ),
    },
    {
      say: (
        <>
          Scroll down and tap <Chip icon={ADD_ICON}>Add to Home Screen</Chip>.
        </>
      ),
      more: (
        <>
          Don't see it? Tap <b>View More</b> at the bottom of the list, then look again.
        </>
      ),
      photos: [PHOTO.viewMore, PHOTO.addToHome],
      note: IPAD_PHOTO_NOTE,
    },
    {
      say: (
        <>
          Leave <b>Open as Web App</b> switched on, then tap <b>Add</b> in the top right.
        </>
      ),
      photos: [PHOTO.tapAdd],
      note: IPAD_PHOTO_NOTE,
    },
  ];

  const iosShareSteps: Step[] = [
    SAFARI_FIRST,
    {
      say: (
        <>
          Tap the Share button <Chip icon={<Share size={18} aria-hidden />} label="Share button" /> at the bottom of the
          screen.
        </>
      ),
      more: "On an iPad, it's at the top right.",
    },
    {
      say: (
        <>
          Scroll down and tap <Chip icon={ADD_ICON}>Add to Home Screen</Chip>.
        </>
      ),
      more: (
        <>
          Don't see it? Tap <b>View More</b> at the bottom of the list, then look again.
        </>
      ),
      photos: [PHOTO.viewMore, PHOTO.addToHome],
      note: IPAD_PHOTO_NOTE,
    },
    { say: <>Tap <b>Add</b> in the top right.</>, photos: [PHOTO.tapAdd], note: IPAD_PHOTO_NOTE },
  ];

  const ipadSteps: Step[] = [
    {
      say: (
        <>
          Tap <b>Safari</b>, the blue compass.
        </>
      ),
      more: 'On most iPads it sits in the row of apps at the bottom of the screen.',
      photos: [PHOTO.safari],
    },
    {
      say: (
        <>
          Go to <b>plcc-connect.vercel.app</b>.
        </>
      ),
      more: (
        <>
          Type it in the address bar at the top, or tap the gold <b>Open PLCC Connect</b> button on the church
          website.
        </>
      ),
      photos: [PHOTO.openButton],
    },
    {
      say: (
        <>
          Tap the Share button <Chip icon={<Share size={18} aria-hidden />} label="Share button" /> at the{' '}
          <b>top right</b>.
        </>
      ),
      more: (
        <>
          It's next to the <b>+</b> button.
        </>
      ),
      photos: [PHOTO.shareIpad],
    },
    {
      say: (
        <>
          Tap <b>View More</b>.
        </>
      ),
      more: 'It has a small arrow pointing down.',
      photos: [PHOTO.viewMore],
    },
    {
      say: (
        <>
          Tap <Chip icon={ADD_ICON}>Add to Home Screen</Chip>.
        </>
      ),
      more: "It's at the bottom of the list.",
      photos: [PHOTO.addToHome],
    },
    {
      say: (
        <>
          Leave <b>Open as Web App</b> switched on, then tap <b>Add</b>.
        </>
      ),
      more: 'The blue Add button is at the top right.',
      photos: [PHOTO.tapAdd],
    },
  ];

  const chromeSteps: Step[] = [
    {
      say: (
        <>
          Tap <b>Chrome</b>, the round red, yellow and green app.
        </>
      ),
      more: (
        <>
          If this page opened inside WhatsApp or Facebook, tap the three dots there and choose <b>Open in Chrome</b>.
        </>
      ),
      photos: [PHOTO.androidChrome],
    },
    {
      say: (
        <>
          Go to <b>plcc-connect.vercel.app</b>.
        </>
      ),
      more: (
        <>
          Type it in the address bar at the top, or tap the gold <b>Open PLCC Connect</b> button on the church
          website.
        </>
      ),
      photos: [PHOTO.androidOpenButton],
    },
    {
      say: (
        <>
          Tap the three dots <Chip icon={<EllipsisVertical size={18} aria-hidden />} label="three dots menu" /> at the
          top right.
        </>
      ),
      more: (
        <>
          On some phones the three dots are at the bottom right instead. Check the address bar says{' '}
          <b>plcc-connect.vercel.app</b> first, so you add PLCC Connect and not the church website.
        </>
      ),
      photos: [PHOTO.androidDots],
    },
    {
      say: (
        <>
          Tap <Chip icon={<Smartphone size={18} aria-hidden />}>Install and create shortcut</Chip>.
        </>
      ),
      more: (
        <>
          Some phones call it <b>Add to home screen</b> or <b>Install app</b>. Any of these is right.
        </>
      ),
      photos: [PHOTO.androidInstall],
    },
    {
      say: (
        <>
          Tap <b>Install</b> (the top choice), then tap <b>Install</b> or <b>Add</b> again if it asks.
        </>
      ),
      more: (
        <>
          Don't pick <b>Create shortcut</b>. That only opens the website in Chrome. If it asks where to put it,
          choose <b>Add automatically</b>.
        </>
      ),
      photos: [PHOTO.androidInstallDialog],
      note: 'Your icon will be the PLCC Connect logo.',
    },
  ];

  const samsungSteps: Step[] = [
    { say: <>Open <b>plcc-connect.vercel.app</b> in <b>Samsung Internet</b>.</> },
    {
      say: (
        <>
          Tap the menu <Chip icon={<Menu size={18} aria-hidden />} label="menu button" /> at the bottom right.
        </>
      ),
    },
    { say: <>Tap <b>Add page to</b>, then tap <b>Home screen</b>.</> },
    { say: <>Tap <b>Add</b>.</> },
  ];

  const tabClass = (on: boolean) =>
    `min-h-[52px] rounded-full font-extrabold text-lg transition-colors ${
      on ? 'bg-gold text-ink' : 'bg-transparent text-ink'
    }`;

  return (
    <div className="min-h-screen bg-eggshell px-4 pt-[calc(1rem+env(safe-area-inset-top))] pb-[calc(3rem+env(safe-area-inset-bottom))]">
      <div className="max-w-[560px] mx-auto flex flex-col gap-6">
        <Link to="/" className="self-start inline-flex items-center gap-2 min-h-[44px] text-burgundy font-bold">
          <ArrowLeft size={18} aria-hidden /> Back to PLCC Connect
        </Link>

        <header className="flex flex-col gap-2">
          <p className="text-xs font-extrabold uppercase tracking-[0.14em] text-burgundy">Promised Land Christian Center</p>
          <h1 className="font-display text-[32px] leading-tight font-bold text-ink">Put PLCC Connect on your phone</h1>
          <p className="text-lg text-ink-muted">
            It takes about one minute. When you're done, PLCC Connect sits on your home screen like any other app.
          </p>
          <p className="rounded-2xl bg-burgundy/[0.07] px-4 py-3 text-base text-ink">
            <b className="text-burgundy">Good to know:</b> you won't find PLCC Connect in the App Store or Google Play.
            You add it straight from the website, using the steps below.
          </p>
        </header>

        {installed && (
          <p className="flex items-center gap-2 rounded-2xl bg-white border border-gold/40 p-4 font-bold text-ink">
            <Check size={20} className="text-gold-ink shrink-0" aria-hidden /> You're already using the app from your
            home screen. You're all set!
          </p>
        )}

        <div className="grid grid-cols-2 gap-1.5 rounded-full bg-white border border-black/10 p-1.5" role="tablist" aria-label="Choose your phone">
          <button type="button" role="tab" aria-selected={phone === 'iphone'} className={tabClass(phone === 'iphone')} onClick={() => setPhone('iphone')}>
            iPhone / iPad
          </button>
          <button type="button" role="tab" aria-selected={phone === 'android'} className={tabClass(phone === 'android')} onClick={() => setPhone('android')}>
            Android
          </button>
        </div>

        {phone === 'iphone' ? (
          <section className="flex flex-col gap-4" role="tabpanel" aria-label="iPhone steps">
            <div className="flex flex-col gap-2">
              <Toggle
                label="Which button does your Safari show?"
                value={iosBar}
                onChange={(id) => setIosBar(id as IosBar)}
                options={[
                  {
                    id: 'dots',
                    label: (
                      <>
                        I see three dots <Chip icon={<MoreHorizontal size={18} aria-hidden />} label="three dots button" />
                      </>
                    ),
                  },
                  {
                    id: 'share',
                    label: (
                      <>
                        I see a Share button <Chip icon={<Share size={18} aria-hidden />} label="Share button" />
                      </>
                    ),
                  },
                  { id: 'ipad', label: "I'm on an iPad" },
                ]}
              />
              <p className="text-[15px] text-ink-muted">
                {iosBar === 'ipad'
                  ? 'On an iPad, the Share button is at the top right of Safari. Each step has a photo.'
                  : (
                    <>
                      Look at the bottom of Safari. Newer iPhones show three dots{' '}
                      <Chip icon={<MoreHorizontal size={18} aria-hidden />} label="three dots button" />. Older ones show the
                      Share button <Chip icon={<Share size={18} aria-hidden />} label="Share button" />, a square with an
                      arrow pointing up.
                    </>
                  )}
              </p>
            </div>
            <Steps steps={iosBar === 'dots' ? iosDotsSteps : iosBar === 'share' ? iosShareSteps : ipadSteps} />
          </section>
        ) : (
          <section className="flex flex-col gap-4" role="tabpanel" aria-label="Android steps">
            <div className="flex flex-col gap-2">
              <Toggle
                label="Which browser are you using?"
                value={androidBrowser}
                onChange={(id) => setAndroidBrowser(id as AndroidBrowser)}
                options={[
                  { id: 'chrome', label: 'Chrome' },
                  { id: 'samsung', label: 'Samsung Internet' },
                ]}
              />
              <p className="text-[15px] text-ink-muted">
                Most Android phones use Chrome. Samsung phones may open links in Samsung Internet (a purple planet
                icon).
              </p>
            </div>
            <Steps steps={androidBrowser === 'chrome' ? chromeSteps : samsungSteps} />
          </section>
        )}

        <div className="flex items-center gap-3 rounded-2xl border-2 border-dashed border-gold bg-white p-4">
          <img src="/icon-192.png" alt="" className="w-14 h-14 rounded-2xl shrink-0" />
          <p className="font-bold text-ink">
            Done! Go to your home screen and tap the <b>PLCC Connect</b> icon to open it.
          </p>
        </div>

        {!installed && (
          <button
            type="button"
            onClick={() => markInstalled()}
            className="min-h-[48px] rounded-2xl border border-black/15 bg-white font-bold text-ink"
          >
            I've added it, stop reminding me
          </button>
        )}

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-2xl font-bold text-ink">Stuck?</h2>
          <details className="rounded-2xl bg-white border border-black/10 p-4">
            <summary className="cursor-pointer font-extrabold text-[17px] text-ink">I can't find "Add to Home Screen"</summary>
            <ul className="mt-2.5 list-disc pl-5 flex flex-col gap-1.5 text-base text-ink">
              <li>
                You are probably inside WhatsApp, Facebook or Instagram. Open the link in <b>Safari</b> (iPhone) or{' '}
                <b>Chrome</b> (Android) first.
              </li>
              <li>
                On iPhone, scroll all the way down the Share list and tap <b>View More</b>.
              </li>
              <li>On iPhone, make sure you're not in a Private tab. Private tabs have a dark address bar.</li>
            </ul>
          </details>
          <details className="rounded-2xl bg-white border border-black/10 p-4">
            <summary className="cursor-pointer font-extrabold text-[17px] text-ink">I added it, but I can't find the icon</summary>
            <ul className="mt-2.5 list-disc pl-5 flex flex-col gap-1.5 text-base text-ink">
              <li>Swipe left through your home screens. New icons go on the last page.</li>
              <li>
                iPhone: swipe down on the home screen and type <b>PLCC</b> to search.
              </li>
              <li>
                Android: swipe up to open all your apps and look for <b>PLCC Connect</b>.
              </li>
            </ul>
          </details>
          <details className="rounded-2xl bg-white border border-black/10 p-4">
            <summary className="cursor-pointer font-extrabold text-[17px] text-ink">Do I need a password?</summary>
            <p className="mt-2.5 text-base text-ink">
              Sign in once with the same email you use for PLCC Connect. After that, the icon opens PLCC Connect straight
              away.
            </p>
          </details>
          <details className="rounded-2xl bg-white border border-black/10 p-4">
            <summary className="cursor-pointer font-extrabold text-[17px] text-ink">Is it safe?</summary>
            <p className="mt-2.5 text-base text-ink">
              Yes. It is the same PLCC Connect website, with a shortcut on your phone. Nothing extra is downloaded, and
              you can remove it any time by pressing and holding the icon.
            </p>
          </details>
        </section>

        <p className="rounded-2xl bg-gold/15 p-4 text-base text-ink">
          <b>Helping someone else?</b> Send them <b>plcc-connect.vercel.app/install</b>. It opens these same steps.
        </p>
      </div>
    </div>
  );
};

export default InstallGuidePage;
