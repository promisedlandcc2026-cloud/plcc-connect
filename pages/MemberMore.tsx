import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ListGroup, ListRow } from '../components/ui/ListRow';
import { GiveModule } from '../components/GiveModule';
import { ButtonLink } from '../components/ui/Button';
import { MyPointsCard } from '../components/points/MyPointsCard';
import { WalletCard } from '../components/sanctuary/WalletCard';
import { PhoneAlertsCard } from '../components/PhoneAlertsCard';
import {
  Bell,
  BookOpen,
  BookOpenText,
  CalendarCheck,
  CalendarHeart,
  ClipboardList,
  CreditCard,
  ExternalLink,
  Gamepad2,
  HandHeart,
  Images,
  Megaphone,
  MessageCircle,
  Settings,
  Smartphone,
  Sun,
  Tv,
  UserRound,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationsContext';
import { goToHomeSection } from '../lib/homeSectionNav';
import { canOpenVaultStaffLink, VAULT_PUBLIC_ORIGIN } from '../lib/staffVaultAccess';
import { isRunningInstalled } from '../lib/installPrompt';
import {
  prefetchAccountChunk,
  prefetchCardChunk,
  prefetchFamilyChunk,
  prefetchKidsPlansChunk,
  prefetchCommunityChatChunks,
  prefetchNotificationsChunk,
  prefetchServeChunks,
  prefetchSundayChunk,
  prefetchNotesChunks,
  prefetchBibleChunk,
  prefetchGalleryChunk,
  prefetchProfileChunk,
  prefetchDirectoryChunk,
} from '../lib/prefetchMemberChunks';

type MoreGroup = 'church' | 'mine' | 'account';

type MoreLink = { group: MoreGroup } & (
  | {
      kind: 'modal';
      modal: 'give';
      label: string;
      description: string;
      icon: LucideIcon;
    }
  | {
      kind: 'route';
      to: string;
      label: string;
      description: string;
      icon: LucideIcon;
      onPrefetch?: () => void;
      badge?: string;
    }
  | {
      kind: 'homeSection';
      sectionId: string;
      label: string;
      description: string;
      icon: LucideIcon;
    }
  | {
      kind: 'soon';
      label: string;
      description: string;
      icon: LucideIcon;
    }
  | {
      kind: 'external';
      href: string;
      label: string;
      description: string;
      icon: LucideIcon;
    }
);

/** Most-used first within each group (others keep their list order). */
const PRIORITY = ['Daily', 'Bible', 'My PLCC Card', 'Notes & Journal', 'Notifications', 'My Family', 'My Serving', 'My Attendance', 'Give', 'Watch', 'Sunday Mode'];
const rank = (label: string) => {
  const i = PRIORITY.indexOf(label);
  return i === -1 ? PRIORITY.length : i;
};

/** Emoji for each row in the Me menu (keyed by label). */
const MORE_EMOJI: Record<string, string> = {
  Chat: '💬',
  Notifications: '🔔',
  Gallery: '📸',
  Give: '💝',
  Watch: '📺',
  'Canaan News': '📰',
  Ministries: '⛪',
  'Sunday Mode': '☀️',
  Serve: '🤲',
  'My Serving': '🙌',
  'My PLCC Card': '🪪',
  'My Family': '👨‍👩‍👧‍👦',
  'My Attendance': '✅',
  'Kids Plans': '🧒',
  Daily: '🌅',
  Bible: '📖',
  'Notes & Journal': '📝',
  'PLCC Ark': '🚢',
  Directory: '📒',
  'Edit profile': '✏️',
  Settings: '⚙️',
  'Add to home screen': '📲',
  'Open PLCC Canaan': '🔐',
};

const GROUP_LABEL: Record<MoreGroup, string> = {
  mine: 'Mine',
  church: 'Church life',
  account: 'Account',
};

/**
 * Me tab (Phase 3) — was "More". Who you are, your points and PLCC Card,
 * then everything personal, church life, and account in grouped lists.
 * Served at /me; /more redirects here.
 *
 * Former note — Member More hub — Chat, Alerts, Account, Ministry Hubs, and home-section shortcuts.
 * Personal links: My PLCC Card, My Family, Notes & Journal, Profile.
 */
export const MemberMePage: React.FC = () => {
  const { identity } = useAuth();
  const { unreadBadge } = useNotifications();
  const location = useLocation();
  const navigate = useNavigate();
  const showVault = canOpenVaultStaffLink(identity?.role);

  const items: MoreLink[] = [
    {
      group: 'church',
      kind: 'route',
      to: '/community/chat',
      label: 'Chat',
      description: 'Community text channels',
      icon: MessageCircle,
      onPrefetch: prefetchCommunityChatChunks,
    },
    {
      group: 'mine',
      kind: 'route',
      to: '/notifications',
      label: 'Notifications',
      description: unreadBadge ? `${unreadBadge} unread` : 'Mentions and church updates',
      icon: Bell,
      onPrefetch: prefetchNotificationsChunk,
      badge: unreadBadge || undefined,
    },
    {
      group: 'church',
      kind: 'route',
      to: '/gallery',
      label: 'Gallery',
      description: 'Photos and videos from church life',
      icon: Images,
      onPrefetch: prefetchGalleryChunk,
    },
    {
      group: 'church',
      kind: 'modal',
      modal: 'give',
      label: 'Give',
      description: 'Support the ministry of PLCC',
      icon: Wallet,
    },
    {
      group: 'church',
      kind: 'homeSection',
      sectionId: 'watch-live',
      label: 'Watch',
      description: 'Livestream and recent messages',
      icon: Tv,
    },
    {
      group: 'church',
      kind: 'homeSection',
      sectionId: 'vault-news',
      label: 'Canaan News',
      description: 'Church news, celebrations, and sympathy',
      icon: Megaphone,
    },
    {
      group: 'church',
      kind: 'route',
      to: '/ministries',
      label: 'Ministries',
      description: 'Ministry hubs and teams',
      icon: Users,
    },
    {
      group: 'church',
      kind: 'route',
      to: '/sunday',
      label: 'Sunday Mode',
      description: 'Focused Sunday service experience',
      icon: Sun,
      onPrefetch: prefetchSundayChunk,
    },
    {
      group: 'church',
      kind: 'route',
      to: '/serve',
      label: 'Serve',
      description: 'Volunteer opportunities',
      icon: HandHeart,
      onPrefetch: prefetchServeChunks,
    },
    {
      group: 'mine',
      kind: 'route',
      to: '/serve/my',
      label: 'My Serving',
      description: 'Your Serve signups',
      icon: HandHeart,
      onPrefetch: prefetchServeChunks,
    },
    {
      group: 'mine',
      kind: 'route',
      to: '/card',
      label: 'My PLCC Card',
      description: 'Your card and check-in QR',
      icon: CreditCard,
      onPrefetch: prefetchCardChunk,
    },
    {
      group: 'mine',
      kind: 'route',
      to: '/family',
      label: 'My Family',
      description: 'Household, kids cards, and check-in codes',
      icon: CalendarHeart,
      onPrefetch: prefetchFamilyChunk,
    },
    {
      group: 'mine',
      kind: 'route',
      to: '/my-attendance',
      label: 'My Attendance',
      description: 'Your check-in history',
      icon: CalendarCheck,
    },
    {
      group: 'mine',
      kind: 'route',
      to: '/kids-plans',
      label: 'Kids Plans',
      description: 'Sunday classroom plans (read-only)',
      icon: ClipboardList,
      onPrefetch: prefetchKidsPlansChunk,
    },
    {
      group: 'mine',
      kind: 'route',
      to: '/daily',
      label: 'Daily',
      description: 'Today’s devotional, Psalms plan and daily pauses',
      icon: Sun,
    },
    {
      group: 'mine',
      kind: 'route',
      to: '/bible',
      label: 'Bible',
      description: 'Read, search, highlight and listen',
      icon: BookOpenText,
      onPrefetch: prefetchBibleChunk,
    },
    {
      group: 'mine',
      kind: 'route',
      to: '/notes',
      label: 'Notes & Journal',
      description: 'Sermon notes, prayers and answered prayers — private to you',
      icon: BookOpen,
      onPrefetch: prefetchNotesChunks,
    },
    ...(import.meta.env.VITE_ARK_ENABLED !== 'false'
      ? [
          {
            group: 'church' as const,
            kind: 'route' as const,
            to: '/ark',
            label: 'PLCC Ark',
            description: 'Retro games · earn PLCC Bucks',
            icon: Gamepad2,
          },
        ]
      : []),
    {
      group: 'church',
      kind: 'route',
      to: '/directory',
      label: 'Directory',
      description: 'Find members who opted in',
      icon: Users,
      onPrefetch: prefetchDirectoryChunk,
    },
    {
      group: 'account',
      kind: 'route',
      to: '/profile',
      label: 'Edit profile',
      description: 'Photo, contact, and directory privacy',
      icon: UserRound,
      onPrefetch: prefetchProfileChunk,
    },
    {
      group: 'account',
      kind: 'route',
      to: '/account',
      label: 'Settings',
      description: 'Sign out and session',
      icon: Settings,
      onPrefetch: prefetchAccountChunk,
    },
  ];

  if (!isRunningInstalled()) {
    items.push({
      group: 'account',
      kind: 'route',
      to: '/install',
      label: 'Add to home screen',
      description: 'Put PLCC Connect on your phone like an app',
      icon: Smartphone,
    });
  }

  if (showVault) {
    items.push({
      group: 'account',
      kind: 'external',
      href: VAULT_PUBLIC_ORIGIN,
      label: 'Open PLCC Canaan',
      description: 'Staff / leadership tools (separate app)',
      icon: ExternalLink,
    });
  }

  const [giveOpen, setGiveOpen] = useState(false);

  const row = (item: MoreLink) => {
    const key = `${item.kind}-${item.label}`;
    if (item.kind === 'route') {
      return (
        <ListRow
          key={key}
          to={item.to}
          title={item.label}
          subtitle={item.description}
          icon={item.icon} emoji={MORE_EMOJI[item.label]}
          badge={item.badge ? Number(item.badge) : null}
          onPrefetch={item.onPrefetch}
        />
      );
    }
    if (item.kind === 'external') {
      return (
        <ListRow key={key} href={item.href} title={item.label} subtitle={item.description} icon={item.icon} emoji={MORE_EMOJI[item.label]} />
      );
    }
    if (item.kind === 'modal') {
      return (
        <ListRow
          key={key}
          onClick={() => setGiveOpen(true)}
          title={item.label}
          subtitle={item.description}
          icon={item.icon} emoji={MORE_EMOJI[item.label]}
        />
      );
    }
    if (item.kind === 'homeSection') {
      return (
        <ListRow
          key={key}
          onClick={() => goToHomeSection(location.pathname, navigate, item.sectionId)}
          title={item.label}
          subtitle={item.description}
          icon={item.icon} emoji={MORE_EMOJI[item.label]}
        />
      );
    }
    return (
      <ListRow
        key={key}
        title={item.label}
        subtitle={item.description}
        icon={item.icon} emoji={MORE_EMOJI[item.label]}
        trailing={<span className="text-xs font-semibold text-gold-ink">Soon</span>}
      />
    );
  };

  const displayName = identity?.name?.trim() || 'Member';
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join('');

  return (
    <main className="flex-1 px-5 pt-6 pb-28">
      <h1 className="sr-only">Me</h1>
      <section aria-label="Your profile" className="mb-5 flex items-center gap-3.5">
        {identity?.avatarUrl ? (
          <img
            src={identity.avatarUrl}
            alt=""
            className="h-[58px] w-[58px] rounded-[20px] object-cover border border-burgundy/15"
          />
        ) : (
          <span
            className="h-[58px] w-[58px] rounded-[20px] bg-burgundy text-[#F2D98A] flex items-center justify-center font-display text-[22px] font-bold"
            aria-hidden
          >
            {initials || 'Me'}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="font-display text-[28px] leading-tight font-bold text-ink truncate">{displayName}</p>
          <p className="text-sm text-ink-soft">Promised Land Christian Center</p>
        </div>
        <ButtonLink to="/profile" variant="secondary" size="sm" className="rounded-full" onFocus={prefetchProfileChunk}>
          Edit
        </ButtonLink>
      </section>

      <section aria-label="My PLCC Card" className="mb-[18px]">
        <WalletCard fallbackName={displayName} />
      </section>

      <div className="mb-6">
        <MyPointsCard />
      </div>

      <div className="mb-6">
        <PhoneAlertsCard />
      </div>

      <div className="space-y-6">
        {(['mine', 'church', 'account'] as MoreGroup[]).map((group) => {
          const groupItems = items
            .map((item, index) => ({ item, index }))
            .filter(({ item }) => item.group === group)
            .sort((a, b) => rank(a.item.label) - rank(b.item.label) || a.index - b.index)
            .map(({ item }) => item);
          if (!groupItems.length) return null;
          return (
            <ListGroup key={group} label={GROUP_LABEL[group]}>
              {groupItems.map(row)}
            </ListGroup>
          );
        })}
      </div>

      <GiveModule isOpen={giveOpen} onClose={() => setGiveOpen(false)} />
    </main>
  );
};

/** Back-compat name (routes, prefetch, tests). */
export const MemberMorePage = MemberMePage;
