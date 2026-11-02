import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Routes, Route, useLocation, useNavigate, useNavigationType } from 'react-router-dom';
import { ViewState, BrandProfile, User, VerificationStatus } from './types';
import BrandSurvey from './components/BrandSurvey';
import ContentCalendar, { CalendarIntent } from './components/ContentCalendar';
import DashboardLayout from './components/layout/DashboardLayout';
import { useToast } from './components/ui/Toast';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import ResetPassword from './components/auth/ResetPassword';
import LandingPage from './components/LandingPage';
import LandingNav from './components/landing/LandingNav';
import Settings from './components/Settings';
import AccessibilityWidget from './components/AccessibilityWidget';
import AccountMenu from './components/AccountMenu';
import { usePhone } from './utils/usePhone';
import InsightsDashboard from './components/InsightsDashboard';
import SocialAccounts from './components/SocialAccounts';
import Billing from './components/Billing';
import SupportDashboard from './components/SupportDashboard';
import VerificationStatusScreen from './components/VerificationStatus';
import LegalPage from './components/LegalPage';
import AppHydrationLoader from './components/AppHydrationLoader';
import SpotlightTour from './components/tour/SpotlightTour';
import { useOrganicDialog } from './components/OrganicDialog';
import UniversalDatabaseService from './services/universalDatabaseService';
import { supportRealtime } from './services/supportRealtime';
import { endStreamSession } from './services/supportChat';
import {
  hasPersistedSession,
  readRestorableView,
  writeStoredView,
  clearStoredView,
  readThemeFromSession,
  resolveViewForRole,
  getHomeViewForRole,
  VIEW_PATHS,
  VIEWS_KEEPING_QUERY,
  PUBLIC_VIEWS,
  LEGAL_PATHS,
  viewFromPath,
} from './utils/sessionView';
import { clearAuthSession, isStoredTokenExpired, readCachedUser, cacheVerificationStatus, readCachedVerificationStatus, getStoredToken } from './utils/authSession';
import { isTourDone, markTourDone } from './utils/tourState';
import { ChartGantt, Lock, ArrowRight, Settings as SettingsIcon, Share2, CreditCard, MessageSquare, BarChart3 } from 'lucide-react';
import KawayanLogo, { KAWAYAN_ICON } from './components/KawayanLogo';

const App: React.FC = () => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  const [isHydrating, setIsHydrating] = useState(false);
  const [view, setView] = useState<ViewState>(() => {
    if (hasPersistedSession()) {
      return readRestorableView() ?? ViewState.CALENDAR;
    }
    // Logged out: public pages open as addressed (/login, /signup); app pages ask to sign in first.
    const fromUrl = viewFromPath(window.location.pathname);
    if (fromUrl && PUBLIC_VIEWS.has(fromUrl)) return fromUrl;
    return fromUrl && fromUrl !== ViewState.RESET_PASSWORD ? ViewState.LOGIN : ViewState.LANDING;
  });
  const [user, setUser] = useState<User | null>(() => {
    if (!hasPersistedSession() || isStoredTokenExpired()) return null;
    return readCachedUser();
  });
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [darkMode, setDarkMode] = useState(() => readThemeFromSession());
  const [dbService] = useState(() => new UniversalDatabaseService());
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [verifStatus, setVerifStatus] = useState<VerificationStatus>('none');
  const [verifRejectionReason, setVerifRejectionReason] = useState<string | undefined>();
  const [tourOpen, setTourOpen] = useState(false);
  // True for the tour that follows brand setup: it greets by name and ends on "Plan my first month".
  const [tourFirstRun, setTourFirstRun] = useState(false);
  // Shell → calendar requests (Create post, search hits, notifications).
  const [calendarIntent, setCalendarIntent] = useState<CalendarIntent | null>(null);
  const loginInProgressRef = useRef(false);
  const sessionRestoredRef = useRef(false);
  const handleLoginRef = useRef<(user: User, initialView?: ViewState) => Promise<void>>(async () => {});
  const viewRef = useRef(view);

  const navigateView = (next: ViewState) => {
    setView(next);
    writeStoredView(next);
  };

  useEffect(() => { viewRef.current = view; }, [view]);

  // Keep the address bar in step with the screen. Start-up redirects and moves out of a
  // sign-in screen replace the history entry, so Back doesn't land on a page that bounces you.
  const location = useLocation();
  const navigate = useNavigate();
  // /terms and /privacy sit outside the screen state: anyone can open them, signed in or not.
  const legalDoc = LEGAL_PATHS[location.pathname];
  const navigationType = useNavigationType();
  const bootedRef = useRef(false); // false until the first click or key press: earlier moves are redirects
  const replaceNextRef = useRef(false);
  const prevViewRef = useRef(view);
  useEffect(() => {
    const done = () => { bootedRef.current = true; };
    window.addEventListener('pointerdown', done, { once: true, capture: true });
    window.addEventListener('keydown', done, { once: true, capture: true });
    return () => {
      window.removeEventListener('pointerdown', done, { capture: true });
      window.removeEventListener('keydown', done, { capture: true });
    };
  }, []);
  useEffect(() => {
    const path = VIEW_PATHS[view];
    const fromAuth = !PUBLIC_VIEWS.has(view) && (PUBLIC_VIEWS.has(prevViewRef.current) || prevViewRef.current === ViewState.RESET_PASSWORD);
    const replace = !bootedRef.current || fromAuth || replaceNextRef.current;
    prevViewRef.current = view;
    replaceNextRef.current = false;
    if (location.pathname === path || LEGAL_PATHS[location.pathname]) return;
    navigate({ pathname: path, search: VIEWS_KEEPING_QUERY.has(view) ? window.location.search : '' }, { replace });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  const continueAsUser = useCallback(async (loggedInUser: User, initialView?: ViewState) => {
    try {
      const profile = await dbService.getProfile(loggedInUser.id);
      if (profile) {
        setBrandProfile(profile);
        navigateView(initialView || readRestorableView('user') || ViewState.CALENDAR);
      } else {
        navigateView(ViewState.SURVEY);
      }
    } catch {
      // Couldn't reach the server: not a new account. Stay on their screen; it retries when it opens.
      toast.error('Couldn’t reach Kawayan just now. Your brand profile is safe. Refresh in a moment.');
      navigateView(initialView || readRestorableView('user') || ViewState.CALENDAR);
    }
  }, [dbService]);

  const handleLogin = useCallback(async (loggedInUser: User, initialView?: ViewState) => {
    loginInProgressRef.current = true;
    try {
      setUser(loggedInUser);
      supportRealtime.connect();

      if (loggedInUser.theme === 'dark') {
        setDarkMode(true);
      } else if (loggedInUser.theme === 'light') {
        setDarkMode(false);
      }

      if (loggedInUser.role === 'admin') {
        navigateView(resolveViewForRole('admin', initialView || readRestorableView('admin')));
        return;
      }

      if (loggedInUser.role === 'support') {
        navigateView(resolveViewForRole('support', initialView || readRestorableView('support')));
        return;
      }

      const verif = await dbService.getVerificationStatus(loggedInUser.id);

      if (verif?.status === 'auth_required') {
        clearAuthSession();
        setUser(null);
        navigateView(ViewState.LOGIN);
        return;
      }

      let vStatus: VerificationStatus;
      let rejectionReason: string | undefined;

      if (verif?.status === 'unavailable') {
        const cached = readCachedVerificationStatus();
        if (cached?.status) {
          vStatus = cached.status as VerificationStatus;
          rejectionReason = cached.rejectionReason;
        } else {
          const existingProfile = await dbService.getProfile(loggedInUser.id).catch(() => 'unknown' as const);
          // A profile only exists after approval; if it can't be checked, don't demote the account.
          vStatus = existingProfile ? 'verified' : 'pending';
        }
      } else {
        vStatus = (verif?.status as VerificationStatus) ?? 'none';
        rejectionReason = verif?.rejectionReason;
        cacheVerificationStatus(vStatus, rejectionReason);
      }

      setVerifStatus(vStatus);
      setVerifRejectionReason(rejectionReason);

      if (vStatus !== 'verified') {
        navigateView(ViewState.VERIFICATION);
        return;
      }

      await continueAsUser(loggedInUser, initialView);
      sessionRestoredRef.current = true;
    } finally {
      loginInProgressRef.current = false;
    }
  }, [continueAsUser, dbService]);

  handleLoginRef.current = handleLogin;

  // A login from the sign-in form (not a restored session) gets the island greeting.
  const handleFreshLogin = async (loggedInUser: User, initialView?: ViewState) => {
    await handleLogin(loggedInUser, initialView);
    const who = loggedInUser.role === 'admin' ? 'administrator' : loggedInUser.role === 'support' ? 'support staff' : loggedInUser.businessName || loggedInUser.email;
    toast.success(`Signed in as ${who}`);
  };

  useEffect(() => {
    console.log('Initializing Kawayan AI App...');

    let cancelled = false;

    const initApp = async () => {
      const shouldRestore = hasPersistedSession() && !isStoredTokenExpired();
      if (shouldRestore) setIsHydrating(true);

      let restoredUser: User | null = null;

      try {
        const urlParams = new URLSearchParams(window.location.search);

        // Password reset link: skip session restore, go straight to the form.
        const resetTok = urlParams.get('reset');
        if (resetTok) {
          setResetToken(resetTok);
          navigateView(ViewState.RESET_PASSWORD);
          setIsHydrating(false);
          return;
        }

        // Back from PayMongo checkout (paid or cancelled): Billing reads these params.
        const isPaymentSuccess = urlParams.get('success') === 'true' || urlParams.get('cancelled') === 'true';
        // Back from connecting a social account (see /api/social/connect).
        const isSocialReturn = urlParams.has('social');

        let currentUser = await dbService.getCurrentUserAsync();
        if (!currentUser) {
          currentUser = dbService.getCurrentUser();
        }

        if (currentUser && isStoredTokenExpired()) {
          clearAuthSession();
          currentUser = null;
          navigateView(ViewState.LANDING);
        } else if (currentUser && !getStoredToken()) {
          clearAuthSession();
          currentUser = null;
          navigateView(ViewState.LANDING);
        }

        if (cancelled || loginInProgressRef.current) return;

        if (currentUser) {
          restoredUser = currentUser;
          sessionRestoredRef.current = true;
          console.log('Found existing session for user:', currentUser.email);
          await handleLoginRef.current(
            currentUser,
            isPaymentSuccess ? ViewState.BILLING : isSocialReturn ? ViewState.SOCIAL : readRestorableView() ?? undefined
          );
        }

        if (cancelled) return;

        const path = window.location.pathname;
        const hash = window.location.hash;

        if (hash === '#admin-portal' || path === '/admin-portal') {
          navigateView(ViewState.ADMIN_LOGIN);
        }

        if (isPaymentSuccess) {
          console.log('Detected successful payment redirect');
          navigateView(ViewState.BILLING);
        }
      } catch (error) {
        console.error('Error initializing app:', error);
      } finally {
        setIsHydrating(false);

        if (cancelled || loginInProgressRef.current || sessionRestoredRef.current) return;

        const cached = readCachedUser();
        const tokenStillValid = !!getStoredToken() && !isStoredTokenExpired();

        if (cached && tokenStillValid) {
          sessionRestoredRef.current = true;
          void handleLoginRef.current(cached, readRestorableView() ?? undefined);
        }
      }
    };

    initApp();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogout = async () => {
    await dbService.logoutUser();
    supportRealtime.disconnect();
    endStreamSession();
    setUser(null);
    setBrandProfile(null);
    setVerifStatus('none');
    setVerifRejectionReason(undefined);
    clearStoredView();
    navigateView(ViewState.LANDING);
    setDarkMode(false);
  };

  // Called when a rejected user resubmits a new document
  const handleVerifResubmit = () => {
    setVerifStatus('pending');
    setVerifRejectionReason(undefined);
  };

  const handleSessionExpired = () => {
    clearAuthSession();
    setUser(null);
    setBrandProfile(null);
    setVerifStatus('none');
    setVerifRejectionReason(undefined);
    clearStoredView();
    navigateView(ViewState.LOGIN);
  };

  // Route a verified user onward. When they are sitting on the verification
  // screen this is invoked by that screen *after* its approval animation, so the
  // transition feels intentional instead of an abrupt jump.
  const handleVerified = useCallback(async () => {
    if (!user || user.role !== 'user') return;
    setVerifStatus('verified');
    setVerifRejectionReason(undefined);
    cacheVerificationStatus('verified', undefined);
    try {
      const profile = await dbService.getProfile(user.id);
      if (profile) {
        setBrandProfile(profile);
        // Never bounce back to the onboarding screens we're leaving.
        const restored = readRestorableView('user');
        const target = restored && restored !== ViewState.VERIFICATION && restored !== ViewState.SURVEY
          ? restored
          : ViewState.CALENDAR;
        navigateView(target);
      } else {
        navigateView(ViewState.SURVEY);
      }
    } catch {
      toast.error('Couldn’t reach Kawayan just now. Your brand profile is safe. Refresh in a moment.');
      navigateView(ViewState.CALENDAR);
    }
  }, [user, dbService]);

  const refreshVerificationStatus = async () => {
    if (!user || user.role !== 'user') return;
    try {
      const verif = await dbService.getVerificationStatus(user.id);
      if (verif?.status === 'auth_required') {
        handleSessionExpired();
        return;
      }
      const vStatus: VerificationStatus = (verif?.status as VerificationStatus) ?? 'none';
      setVerifStatus(vStatus);
      setVerifRejectionReason(verif?.rejectionReason);
      if (verif?.status && verif.status !== 'unavailable' && verif.status !== 'auth_required') {
        cacheVerificationStatus(vStatus, verif?.rejectionReason);
      }
      if (vStatus === 'verified') {
        // On the verification screen, let it play its approval animation and
        // call handleVerified when done. Anywhere else, route immediately.
        if (viewRef.current === ViewState.VERIFICATION) return;
        await handleVerified();
      }
    } catch (e) {
      console.warn('Could not refresh verification status:', e);
    }
  };

  useEffect(() => {
    if (!user || user.role !== 'user') return;

    const onVisibility = () => {
      if (document.visibilityState === 'visible' && isStoredTokenExpired()) {
        handleSessionExpired();
      }
    };

    const unsubVerif = supportRealtime.onVerificationUpdated(() => {
      refreshVerificationStatus();
    });

    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      unsubVerif();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, user?.role]);

  // Load brand profile when a verified user lands on app views without profile in state
  useEffect(() => {
    if (!user || user.role !== 'user' || brandProfile || verifStatus !== 'verified') return;
    const needsProfile = [
      ViewState.CALENDAR,
      ViewState.SETTINGS,
      ViewState.INSIGHTS,
      ViewState.SOCIAL,
      ViewState.BILLING,
    ].includes(view);
    if (!needsProfile) return;

    let cancelled = false;
    (async () => {
      try {
        const profile = await dbService.getProfile(user.id);
        if (!cancelled && profile) setBrandProfile(profile);
      } catch {
        /* the screen keeps its loader; continueAsUser already said what happened */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [user?.id, user?.role, brandProfile, verifStatus, view, dbService]);

  const handleSurveyComplete = async (profileData: BrandProfile) => {
    if (!user) return;
    const newProfile = { ...profileData, userId: user.id };
    try {
      await dbService.saveProfile(newProfile);
      setBrandProfile(newProfile);
      navigateView(ViewState.CALENDAR);
      // First time through onboarding: walk them around the calendar they just
      // landed on. Existing accounts are never ambushed — only this path and
      // the explicit replay in Settings open the tour.
      if (!isTourDone(user.id)) {
        setTourFirstRun(true);
        setTourOpen(true);
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      await dialog.alert('Failed to save profile. Please try again.');
    }
  };

  const handleProfileUpdate = async (profileData: BrandProfile) => {
    try {
      await dbService.saveProfile(profileData);
      // Re-fetch from DB to ensure we have exactly what was saved
      if (user) {
        const updated = await dbService.getProfile(user.id);
        if (updated) {
          setBrandProfile(updated);
          console.log('Profile state updated from DB after save');
        }
      }
    } catch (e) {
      console.error('Failed to sync profile update:', e);
    }
  };

  const handleUserUpdate = async (updatedUser: User) => {
    // Note: Password update would need special handling in backend
    // For now we just alert as this is a prototype
    await dialog.alert("Profile updates are currently managed via account settings. Feature coming soon.");
  };

  const updateTheme = async (newDarkMode: boolean) => {
    setDarkMode(newDarkMode);
    if (user) {
      try {
        await dbService.updateUserTheme(user.id, newDarkMode ? 'dark' : 'light');
        setUser({ ...user, theme: newDarkMode ? 'dark' : 'light' });
      } catch (error) {
        console.error('Failed to update theme in database:', error);
      }
    }
  };

  // Safe navigation guard for logged in users
  const isLoggedIn = user !== null;
  const phone = usePhone();
  const showNav = isLoggedIn && user?.role !== 'admin' && !(user?.role === 'user' && verifStatus !== 'verified');
  const navItems = [
    { id: ViewState.SUPPORT_DASHBOARD, label: 'Support', icon: MessageSquare, roles: ['support'] },
    { id: ViewState.CALENDAR, label: 'Timeline', icon: ChartGantt, roles: ['user'] },
    { id: ViewState.INSIGHTS, label: 'Insights', icon: BarChart3, roles: ['user'] },
    { id: ViewState.SOCIAL, label: 'Social', icon: Share2, roles: ['user'] },
    { id: ViewState.BILLING, label: 'Billing', icon: CreditCard, roles: ['user'] },
    { id: ViewState.SETTINGS, label: 'Settings', icon: SettingsIcon, roles: ['user', 'support'] },
  ].filter((item) => item.roles.includes(user?.role || ''));

  // A 'user' account that isn't verified yet must stay on the verification
  // screen — used by every user-clickable nav trigger (pills, brand mark).
  // Internal auth/logout/session-transition code calls navigateView directly,
  // since at those call sites `user`/`verifStatus` are stale closures mid-transition.
  const goTo = (next: ViewState) => {
    if (isLoggedIn && user?.role === 'user' && verifStatus !== 'verified' && next !== ViewState.VERIFICATION) {
      navigateView(ViewState.VERIFICATION);
      return;
    }
    navigateView(next);
  };

  // Back/Forward: show the screen for the new address, or the nearest one this person may see.
  const firstLocationRef = useRef(true);
  useEffect(() => {
    if (firstLocationRef.current) { firstLocationRef.current = false; return; }
    if (navigationType !== 'POP' || LEGAL_PATHS[location.pathname]) return;
    const wanted = viewFromPath(location.pathname) ?? ViewState.LANDING;
    if (wanted === viewRef.current) return;
    const target =
      !user ? (PUBLIC_VIEWS.has(wanted) ? wanted : ViewState.LOGIN)
      : wanted === ViewState.LANDING ? wanted
      : PUBLIC_VIEWS.has(wanted) ? getHomeViewForRole(user.role)
      : user.role === 'user' && verifStatus !== 'verified' ? ViewState.VERIFICATION
      : resolveViewForRole(user.role, wanted);
    if (target === viewRef.current) {
      navigate(VIEW_PATHS[target], { replace: true }); // not allowed there: stay put, fix the address
      return;
    }
    replaceNextRef.current = target !== wanted;
    navigateView(target);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.key]);

  // Replay from Settings: the tour's anchors live on the calendar, so go there
  // first. The view switch is synchronous, so the elements exist by the time
  // SpotlightTour measures them.
  const handleReplayTour = () => {
    goTo(ViewState.CALENDAR);
    setTourFirstRun(false);
    setTourOpen(true);
  };

  const closeTour = () => {
    setTourOpen(false);
    if (user) markTourDone(user.id);
  };

  const requestCalendar = (intent: CalendarIntent) => {
    setCalendarIntent(intent);
    goTo(ViewState.CALENDAR);
  };

  const authViews = [ViewState.LOGIN, ViewState.SIGNUP, ViewState.ADMIN_LOGIN, ViewState.RESET_PASSWORD];
  const isAuthView = authViews.includes(view);
  const blockForHydration = isHydrating && !isAuthView && view !== ViewState.LANDING;

  const accountActions = {
    onSignOut: handleLogout,
    onSwitchAccount: async () => {
      await handleLogout();
      navigateView(ViewState.LOGIN);
    },
    onSettings: showNav && (user?.role === 'user' || user?.role === 'support') ? () => goTo(ViewState.SETTINGS) : undefined,
    onBilling: showNav && user?.role === 'user' ? () => goTo(ViewState.BILLING) : undefined,
  };
  // The admin console brings its own top bar and sidebar, edge to edge.
  const adminConsole = user?.role === 'admin' && view === ViewState.ADMIN_DASHBOARD && !blockForHydration;
  const pageClass = `w-full ${
    isAuthView ? 'min-h-[calc(100vh-0px)]' :
    view === ViewState.LANDING ? '' :
    view === ViewState.CALENDAR ? 'py-6 px-2 sm:px-6 lg:px-8' :
    adminConsole || view === ViewState.SUPPORT_DASHBOARD ? '' :
    (view === ViewState.ADMIN_DASHBOARD || view === ViewState.SETTINGS) ? 'max-w-[1600px] mx-auto py-6 px-4 sm:px-6 lg:px-8' :
    'max-w-[1400px] mx-auto py-6 px-4 sm:px-6 lg:px-8'
  }`;

  const page = blockForHydration ? (
    <AppHydrationLoader />
  ) : (
    <Routes>
      <Route path="*" element={
        (() => {
          switch (view) {
            case ViewState.LANDING:
              return <LandingPage onNavigate={navigateView} />;
            case ViewState.LOGIN:
              return <Login onLogin={handleFreshLogin} onNavigate={navigateView} darkMode={darkMode} toggleTheme={() => updateTheme(!darkMode)} />;
            case ViewState.SIGNUP:
              return <Login onLogin={handleFreshLogin} onNavigate={navigateView} initialIsSignUp={true} darkMode={darkMode} toggleTheme={() => updateTheme(!darkMode)} />;
            case ViewState.ADMIN_LOGIN:
              return <Login onLogin={handleFreshLogin} onNavigate={navigateView} isAdminLogin={true} darkMode={darkMode} toggleTheme={() => updateTheme(!darkMode)} />;
            case ViewState.RESET_PASSWORD:
              return <ResetPassword token={resetToken} onNavigate={navigateView} />;
            case ViewState.VERIFICATION:
              return (
                <VerificationStatusScreen
                  userId={user?.id}
                  status={verifStatus}
                  rejectionReason={verifRejectionReason}
                  businessName={user?.businessName}
                  onLogout={handleLogout}
                  onResubmit={handleVerifResubmit}
                  onSessionExpired={handleSessionExpired}
                  onVerified={handleVerified}
                />
              );
            case ViewState.SURVEY:
              return <BrandSurvey onComplete={handleSurveyComplete} businessName={user?.businessName} />;
            case ViewState.CALENDAR:
              if (user?.role === 'support') {
                return (
                  <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-10 animate-fade-in">
                    <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2" style={{ background: 'rgba(43,87,72,0.1)' }}>
                      <MessageSquare className="w-7 h-7 text-emerald-500" />
                    </div>
                    <h2 className="text-xl font-bold" style={{ color: 'var(--fg)' }}>Support Dashboard</h2>
                    <p className="text-sm max-w-sm" style={{ color: 'var(--fg-muted)' }}>
                      The content calendar is for SME accounts. Open your Support Dashboard to manage tickets and calls.
                    </p>
                    <button
                      type="button"
                      onClick={() => navigateView(ViewState.SUPPORT_DASHBOARD)}
                      className="btn btn-primary mt-2"
                    >
                      Open Support Dashboard
                    </button>
                  </div>
                );
              }
              return (user && brandProfile) ? (
                <ContentCalendar profile={brandProfile} userId={user.id} onOpenSocial={() => navigateView(ViewState.SOCIAL)} onOpenBilling={() => navigateView(ViewState.BILLING)} intent={calendarIntent} onIntentDone={() => setCalendarIntent(null)} />
              ) : user ? (
                <AppHydrationLoader />
              ) : (
                <AppHydrationLoader />
              );
            case ViewState.SETTINGS:
              return (user?.role === 'support' || brandProfile) ? <Settings profile={brandProfile} user={user} onProfileUpdate={handleProfileUpdate} onUserUpdate={handleUserUpdate} darkMode={darkMode} toggleDarkMode={() => updateTheme(!darkMode)} onReplayTour={user?.role === 'user' ? handleReplayTour : undefined} /> : <AppHydrationLoader />;
            case ViewState.INSIGHTS:
              return user ? <InsightsDashboard userId={user.id} /> : <AppHydrationLoader />;
            case ViewState.SOCIAL:
              return <SocialAccounts />;
            case ViewState.BILLING:
              return <Billing />;
            case ViewState.SUPPORT_DASHBOARD:
              return <SupportDashboard />;
            case ViewState.ADMIN_DASHBOARD:
              return (user && user.role === 'admin') ? <AdminDashboard darkMode={darkMode} toggleTheme={() => updateTheme(!darkMode)} user={user} {...accountActions} /> : (
                <div className="flex items-center justify-center min-h-[60vh]">
                  <div className="text-center p-10">
                    <p className="font-semibold" style={{ color: 'var(--fg)' }}>Access Denied</p>
                  </div>
                </div>
              );
            default:
              return <LandingPage onNavigate={navigateView} />;
          }
        })()
      } />
    </Routes>
  );

  const accountMenu = user && <AccountMenu user={user} {...accountActions} />;

  if (legalDoc) {
    return (
      <>
        <LegalPage doc={legalDoc} onSwitch={(d) => navigate(`/${d}`)} onBack={() => navigate(VIEW_PATHS[view])} />
        {!isLoggedIn && <AccessibilityWidget />}
      </>
    );
  }

  return (
    <div className="min-h-screen flex flex-col transition-colors font-sans" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      {showNav && user ? (
        <DashboardLayout
          user={user}
          view={view}
          navItems={navItems}
          phone={phone}
          account={accountActions}
          onNavigate={goTo}
          onHome={() => goTo(getHomeViewForRole(user.role))}
          onCreatePost={() => requestCalendar({ type: 'compose' })}
          onOpenPost={(postId, date) => requestCalendar({ type: 'open', postId, date })}
        >
          <div className={pageClass}>{page}</div>
        </DashboardLayout>
      ) : (
      <>
      {/* ── Navigation ────────────────────────────────────────────── */}
      {!isAuthView && view === ViewState.LANDING && !isLoggedIn && (
        <LandingNav
          onNavigate={navigateView}
          darkMode={darkMode}
          toggleTheme={() => updateTheme(!darkMode)}
        />
      )}
      {!isAuthView && !adminConsole && !(view === ViewState.LANDING && !isLoggedIn) && (
      <nav className="glass-panel sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-15" style={{ height: '3.75rem' }}>

            {/* Brand */}
            <div
              className="flex items-center gap-2.5 cursor-pointer select-none"
              onClick={() => goTo(isLoggedIn && user ? getHomeViewForRole(user.role) : ViewState.LANDING)}
            >
              {/* Logged in, the nav pills need the room on a phone: the icon stands in for the wordmark. */}
              {isLoggedIn && <img src={KAWAYAN_ICON} alt="" className="w-8 h-8 sm:hidden" />}
              <KawayanLogo size={24} className={isLoggedIn ? 'hidden sm:inline-block' : ''} />
              {user?.role === 'admin' && (
                <span className="badge badge-green ml-1">Admin</span>
              )}
              {user?.role === 'support' && (
                <span className="badge badge-sage ml-1">Support</span>
              )}
            </div>

            {/* Nav items + actions */}
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  {accountMenu}
                </>
              ) : (
                view === ViewState.LANDING && (
                  <div className="flex items-center gap-2">
                    <div className="hidden md:flex items-center gap-1 mr-2">
                      <a
                        href="#features"
                        className="px-3 py-2 rounded-xl text-sm font-semibold transition"
                        style={{ color: 'var(--fg-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(43,87,72,0.07)'; e.currentTarget.style.color = 'var(--fg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--fg-muted)'; }}
                      >
                        Features
                      </a>
                      <a
                        href="#pricing"
                        className="px-3 py-2 rounded-xl text-sm font-semibold transition"
                        style={{ color: 'var(--fg-muted)' }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(43,87,72,0.07)'; e.currentTarget.style.color = 'var(--fg)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--fg-muted)'; }}
                      >
                        Pricing
                      </a>
                    </div>
                    <button
                      onClick={() => navigateView(ViewState.LOGIN)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition"
                      style={{ color: 'var(--fg-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(43,87,72,0.07)'; e.currentTarget.style.color = 'var(--fg)'; }}
                      onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--fg-muted)'; }}
                    >
                      Sign In
                    </button>
                    <button
                      onClick={() => navigateView(ViewState.SIGNUP)}
                      className="btn btn-primary flex items-center gap-1.5"
                    >
                      Get Started <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </nav>
      )}

      {/* ── Main Content ──────────────────────────────────────────── */}
      <main className="grow">
        <div className={pageClass}>{page}</div>
      </main>
      </>
      )}

      {/* Public pages keep the floating accessibility button; signed in, it's in Settings → Appearance. */}
      {!isLoggedIn && <AccessibilityWidget />}

      {/* Onboarding walkthrough — only on the calendar, where its anchors are. */}
      {isLoggedIn && user?.role === 'user' && verifStatus === 'verified' && view === ViewState.CALENDAR && (
        <SpotlightTour open={tourOpen} onClose={closeTour} firstRun={tourFirstRun} businessName={brandProfile?.businessName} />
      )}

      {/* Footer */}
      {view === ViewState.LANDING && (
        <footer className="mt-auto py-7 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5">
              <KawayanLogo size={24} />
              <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>© 2025 Built for Philippine MSMEs</span>
            </div>
            <div className="flex items-center gap-5 text-xs" style={{ color: 'var(--fg-muted)' }}>
              <button type="button" onClick={() => navigate('/privacy')} className="hover:text-emerald-500 transition-colors">Privacy</button>
              <button type="button" onClick={() => navigate('/terms')} className="hover:text-emerald-500 transition-colors">Terms</button>
              {!user && (
                <button
                  onClick={() => navigateView(ViewState.ADMIN_LOGIN)}
                  className="flex items-center gap-1 opacity-40 hover:opacity-70 transition-opacity"
                >
                  <Lock className="w-3 h-3" />
                </button>
              )}
            </div>
          </div>
        </footer>
      )}

    </div>
  );
};

export default App;
