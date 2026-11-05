import React, { lazy } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationsProvider } from './context/NotificationsContext';
import BirthdayPopup from './components/BirthdayPopup';
import { SeasonThemeProvider } from './components/season/SeasonThemeProvider';
import { HuddleLiveProvider } from './context/HuddleLiveContext';
import { MemberGate } from './components/auth/MemberGate';
import { LazyRoute } from './components/routing/LazyRoute';
import { ArkHandoff } from './components/routing/ArkHandoff';
import { Home } from './components/Home';
import { WelcomeSplash } from './pages/WelcomeSplash';
import { AWCAssistant } from './components/AWCAssistant';
import { BottomNav } from './components/BottomNav';
import { MemberNav } from './components/MemberNav';
import {
  shouldHideAssistant,
  shouldHidePublicBottomNav,
  shouldShowMemberNav,
} from './lib/memberShell';

const MemberSignIn = lazy(() =>
  import('./pages/MemberSignIn').then((m) => ({ default: m.MemberSignIn }))
);
import SsoHandoff from './pages/SsoHandoff';
import { OpenAwcChat } from './components/routing/OpenAwcChat';
import { CHAT_MOVED } from './lib/awcChatMove';
const AuthCallback = lazy(() =>
  import('./pages/AuthCallback').then((m) => ({ default: m.AuthCallback }))
);
const IntercessorsPrayerWatchPage = lazy(() =>
  import('./pages/IntercessorsPrayerWatch').then((m) => ({ default: m.IntercessorsPrayerWatchPage }))
);
const InstallGuidePage = lazy(() =>
  import('./pages/InstallGuide').then((m) => ({ default: m.InstallGuidePage }))
);
const MemberAccount = lazy(() =>
  import('./pages/MemberAccount').then((m) => ({ default: m.MemberAccount }))
);
const CommunityProvidersLayout = lazy(() =>
  import('./pages/CommunityProvidersLayout').then((m) => ({
    default: m.CommunityProvidersLayout,
  }))
);
const CommunityFeedPage = lazy(() =>
  import('./pages/CommunityFeed').then((m) => ({ default: m.CommunityFeedPage }))
);
const CommunityPostPage = lazy(() =>
  import('./pages/CommunityPost').then((m) => ({ default: m.CommunityPostPage }))
);
const CommunityChatPage = lazy(() =>
  import('./pages/CommunityChat').then((m) => ({ default: m.CommunityChatPage }))
);
const CommunityChatRoomPage = lazy(() =>
  import('./pages/CommunityChatRoom').then((m) => ({ default: m.CommunityChatRoomPage }))
);
const MemberNotificationsPage = lazy(() =>
  import('./pages/MemberNotifications').then((m) => ({
    default: m.MemberNotificationsPage,
  }))
);
const MemberPrayerPage = lazy(() =>
  import('./pages/MemberPrayer').then((m) => ({ default: m.MemberPrayerPage }))
);
const MemberEventsPage = lazy(() =>
  import('./pages/MemberEvents').then((m) => ({ default: m.MemberEventsPage }))
);
const MemberMorePage = lazy(() =>
  import('./pages/MemberMore').then((m) => ({ default: m.MemberMorePage }))
);
const MemberMinistriesPage = lazy(() =>
  import('./pages/MemberMinistries').then((m) => ({ default: m.MemberMinistriesPage }))
);
const MemberMinistryHubPage = lazy(() =>
  import('./pages/MemberMinistryHub').then((m) => ({ default: m.MemberMinistryHubPage }))
);
const MemberServePage = lazy(() =>
  import('./pages/MemberServe').then((m) => ({ default: m.MemberServePage }))
);
const MemberServeMyPage = lazy(() =>
  import('./pages/MemberServeMy').then((m) => ({ default: m.MemberServeMyPage }))
);
const MemberServeDetailPage = lazy(() =>
  import('./pages/MemberServeDetail').then((m) => ({ default: m.MemberServeDetailPage }))
);
const MemberSundayPage = lazy(() =>
  import('./pages/MemberSunday').then((m) => ({ default: m.MemberSundayPage }))
);
const MemberDailyPage = lazy(() =>
  import('./pages/MemberDaily').then((m) => ({ default: m.MemberDailyPage }))
);
const MemberBiblePage = lazy(() =>
  import('./pages/MemberBible').then((m) => ({ default: m.MemberBiblePage }))
);
const MemberGalleryPage = lazy(() =>
  import('./pages/MemberGallery').then((m) => ({ default: m.MemberGalleryPage }))
);
const MemberNotesPage = lazy(() =>
  import('./pages/MemberNotes').then((m) => ({ default: m.MemberNotesPage }))
);
const MemberNoteNewPage = lazy(() =>
  import('./pages/MemberNoteEditor').then((m) => ({ default: m.MemberNoteNewPage }))
);
const MemberStudyGuidePage = lazy(() =>
  import('./pages/MemberStudyGuide').then((m) => ({ default: m.MemberStudyGuidePage }))
);
const MemberNoteEditPage = lazy(() =>
  import('./pages/MemberNoteEditor').then((m) => ({ default: m.MemberNoteEditPage }))
);
const MemberCardPage = lazy(() =>
  import('./pages/MemberCard').then((m) => ({ default: m.MemberCardPage }))
);
const MemberFamilyPage = lazy(() =>
  import('./pages/MemberFamily').then((m) => ({ default: m.MemberFamilyPage }))
);
const FamilyHuddleJoinPage = lazy(() =>
  import('./pages/FamilyHuddleJoin').then((m) => ({ default: m.FamilyHuddleJoinPage }))
);
const MemberDependentCardPage = lazy(() =>
  import('./pages/MemberDependentCard').then((m) => ({ default: m.MemberDependentCardPage }))
);
const MemberKidsViewPage = lazy(() => import('./pages/MemberKidsView'));
const MemberKidsPlansPage = lazy(() =>
  import('./pages/MemberKidsPlans').then((m) => ({ default: m.MemberKidsPlansPage }))
);
const MemberAttendanceHistoryPage = lazy(() =>
  import('./pages/MemberAttendanceHistory').then((m) => ({
    default: m.MemberAttendanceHistoryPage,
  }))
);
const MemberProfilePage = lazy(() =>
  import('./pages/MemberProfile').then((m) => ({
    default: m.MemberProfilePage,
  }))
);
const ScanInPage = lazy(() =>
  import('./pages/ScanIn').then((m) => ({
    default: m.ScanInPage,
  }))
);
const MemberDirectoryPage = lazy(() =>
  import('./pages/MemberDirectory').then((m) => ({
    default: m.MemberDirectoryPage,
  }))
);

const AppShell: React.FC<{ hasSeenSplash: boolean; onSplashComplete: () => void }> = ({
  hasSeenSplash,
  onSplashComplete,
}) => {
  const location = useLocation();
  const { memberAccessState } = useAuth();
  const isApprovedMember = memberAccessState === 'approved_member';
  const isWelcomeScreen =
    location.pathname === '/welcome' || (location.pathname === '/' && !hasSeenSplash);

  const hidePublicBottomNav = shouldHidePublicBottomNav(location.pathname, {
    isWelcomeScreen,
    isApprovedMember,
    hasSeenSplash,
  });
  const hideAssistant = shouldHideAssistant(location.pathname, { isWelcomeScreen });
  const showMemberNav = shouldShowMemberNav(location.pathname, {
    isApprovedMember,
    hasSeenSplash,
  });

  return (
    <div className={`min-h-screen ${location.pathname === '/intercessors' ? 'max-w-[1200px]' : 'max-w-[500px]'} mx-auto bg-eggshell shadow-[0_0_0_1px_rgba(0,0,0,0.04),0_12px_40px_rgba(0,0,0,0.06)] flex flex-col relative`}>
      {isApprovedMember && hasSeenSplash && <BirthdayPopup />}
      <Routes>
        <Route
          path="/"
          element={hasSeenSplash ? <Home /> : <WelcomeSplash onEnter={onSplashComplete} />}
        />
        <Route path="/welcome" element={<WelcomeSplash onEnter={onSplashComplete} />} />
        <Route
          path="/install"
          element={
            <LazyRoute label="Loading the steps…" sectionLabel="install guide">
              <InstallGuidePage />
            </LazyRoute>
          }
        />
        <Route
          path="/sign-in"
          element={
            <LazyRoute label="Loading sign-in…" sectionLabel="sign-in">
              <MemberSignIn />
            </LazyRoute>
          }
        />
        <Route path="/auth/sso" element={<SsoHandoff fallback="/" signInPath="/sign-in" seenKeys={['awc_seen_splash']} />} />
        <Route
          path="/auth/callback"
          element={
            <LazyRoute label="Finishing sign-in…" sectionLabel="sign-in">
              <AuthCallback />
            </LazyRoute>
          }
        />
        <Route
          path="/account"
          element={
            <MemberGate>
              <LazyRoute label="Loading your account…" sectionLabel="account">
                <MemberAccount />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/community"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Community…" sectionLabel="Community">
                <CommunityProvidersLayout />
              </LazyRoute>
            </MemberGate>
          }
        >
          <Route
            index
            element={
              <LazyRoute label="Loading Community…" sectionLabel="Community">
                <CommunityFeedPage />
              </LazyRoute>
            }
          />
          <Route
            path="post/:postId"
            element={
              <LazyRoute label="Loading post…" sectionLabel="Community post">
                <CommunityPostPage />
              </LazyRoute>
            }
          />
          <Route
            path="chat"
            element={
              CHAT_MOVED ? <OpenAwcChat /> : (
              <LazyRoute label="Loading Chat…" sectionLabel="Community chat">
                <CommunityChatPage />
              </LazyRoute>
              )
            }
          />
          <Route
            path="chat/:channelId"
            element={
              CHAT_MOVED ? <OpenAwcChat /> : (
              <LazyRoute label="Loading Chat…" sectionLabel="Community chat">
                <CommunityChatRoomPage />
              </LazyRoute>
              )
            }
          />
        </Route>
        <Route
          path="/notifications"
          element={
            <MemberGate>
              <LazyRoute label="Loading notifications…" sectionLabel="notifications">
                <MemberNotificationsPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/prayer"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Prayer…" sectionLabel="Prayer">
                <MemberPrayerPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/intercessors"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Opening the Prayer Watch…" sectionLabel="Prayer Watch">
                <IntercessorsPrayerWatchPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/events"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Events…" sectionLabel="Events">
                <MemberEventsPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/me"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Me…" sectionLabel="Me">
                <MemberMorePage />
              </LazyRoute>
            </MemberGate>
          }
        />
        {/* Old "More" tab links keep working. */}
        <Route path="/more" element={<Navigate to="/me" replace />} />
        <Route
          path="/ministries"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Ministries…" sectionLabel="Ministries">
                <MemberMinistriesPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/ministries/:slug"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading ministry hub…" sectionLabel="Ministry hub">
                <MemberMinistryHubPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/serve"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Serve…" sectionLabel="Serve">
                <MemberServePage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/serve/my"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading My Serving…" sectionLabel="My Serving">
                <MemberServeMyPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/serve/:id"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Serve opportunity…" sectionLabel="Serve">
                <MemberServeDetailPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/sunday"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Sunday Mode…" sectionLabel="Sunday Mode">
                <MemberSundayPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/daily"
          element={
            <MemberGate>
              <LazyRoute label="Opening today’s devotional…" sectionLabel="Daily">
                <MemberDailyPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/bible"
          element={
            <MemberGate>
              <LazyRoute label="Opening the Bible…" sectionLabel="Bible">
                <MemberBiblePage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/gallery"
          element={
            <MemberGate>
              <LazyRoute label="Opening the gallery…" sectionLabel="Gallery">
                <MemberGalleryPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/notes"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading your notes…" sectionLabel="Notes & Journal">
                <MemberNotesPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/notes/new"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading note editor…" sectionLabel="Notes & Journal">
                <MemberNoteNewPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/notes/guide/:token"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Opening study guide…" sectionLabel="Notes & Journal">
                <MemberStudyGuidePage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/notes/:id"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading note…" sectionLabel="Notes & Journal">
                <MemberNoteEditPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/card"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Preparing your PLCC card…" sectionLabel="My PLCC Card">
                <MemberCardPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/family"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading your family…" sectionLabel="My Family">
                <MemberFamilyPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/family/huddle/join"
          element={
            <LazyRoute label="Opening Family Huddle…" sectionLabel="Family Huddle">
              <FamilyHuddleJoinPage />
            </LazyRoute>
          }
        />
        <Route
          path="/family/card/:cardRef"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading child card…" sectionLabel="Child PLCC Card">
                <MemberDependentCardPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/family/kids/:cardRef"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Kids View…" sectionLabel="Kids View">
                <MemberKidsViewPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/kids-plans"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading Kids Plans…" sectionLabel="Kids Plans">
                <MemberKidsPlansPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/my-attendance"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading attendance…" sectionLabel="My Attendance">
                <MemberAttendanceHistoryPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/profile"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading your profile…" sectionLabel="My Profile">
                <MemberProfilePage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/directory"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Loading directory…" sectionLabel="Directory">
                <MemberDirectoryPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        <Route
          path="/scan-in"
          element={
            <MemberGate requireAccess="approved_member">
              <LazyRoute label="Opening the scanner…" sectionLabel="Check in">
                <ScanInPage />
              </LazyRoute>
            </MemberGate>
          }
        />
        {/* Keep public home for unknown paths — do not force auth */}
        <Route path="/ark" element={<ArkHandoff />} />
        <Route path="/ark/*" element={<ArkHandoff />} />
        <Route path="*" element={<Home />} />
      </Routes>

      {!hidePublicBottomNav && <BottomNav />}
      {!hideAssistant && <AWCAssistant showLauncher={!isApprovedMember} />}
      {showMemberNav && <MemberNav />}
    </div>
  );
};

const App: React.FC = () => {
  const [hasSeenSplash, setHasSeenSplash] = React.useState(
    () => localStorage.getItem('awc_seen_splash') === 'true'
  );

  return (
    <BrowserRouter>
      <AuthProvider>
        <SeasonThemeProvider>
          <NotificationsProvider>
            <HuddleLiveProvider>
              <AppShell
                hasSeenSplash={hasSeenSplash}
                onSplashComplete={() => setHasSeenSplash(true)}
              />
            </HuddleLiveProvider>
          </NotificationsProvider>
        </SeasonThemeProvider>
      </AuthProvider>
    </BrowserRouter>
  );
};

export default App;
