import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ViewState, BrandProfile, User, VerificationStatus } from './types';
import BrandSurvey from './components/BrandSurvey';
import ContentCalendar from './components/ContentCalendar';
import AdminDashboard from './components/AdminDashboard';
import Login from './components/Login';
import LandingPage from './components/LandingPage';
import Settings from './components/Settings';
import SupportWidget from './components/SupportWidget';
import InsightsDashboard from './components/InsightsDashboard';
import Billing from './components/Billing';
import SupportDashboard from './components/SupportDashboard';
import DemoPage from './components/DemoPage';
import VerificationStatusScreen from './components/VerificationStatus';
import AppHydrationLoader from './components/AppHydrationLoader';
import { useOrganicDialog } from './components/OrganicDialog';
import UniversalDatabaseService from './services/universalDatabaseService';
import { supportRealtime } from './services/supportRealtime';
import {
  hasPersistedSession,
  readStoredView,
  writeStoredView,
  clearStoredView,
  readThemeFromSession,
  resolveViewForRole,
  getHomeViewForRole,
} from './utils/sessionView';
import { LayoutDashboard, LogOut, Lock, ArrowRight, Settings as SettingsIcon, BarChart3, CreditCard, MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  const dialog = useOrganicDialog();
  const [isHydrating, setIsHydrating] = useState(() => hasPersistedSession());
  const [view, setView] = useState<ViewState>(() => {
    if (hasPersistedSession()) {
      // Restore last view immediately so there's no flash on refresh
      return readStoredView() ?? ViewState.CALENDAR;
    }
    return ViewState.LANDING;
  });
  const [user, setUser] = useState<User | null>(null);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [darkMode, setDarkMode] = useState(() => readThemeFromSession());
  const [dbService] = useState(() => new UniversalDatabaseService());
  const [verifStatus, setVerifStatus] = useState<VerificationStatus>('none');
  const [verifRejectionReason, setVerifRejectionReason] = useState<string | undefined>();

  const navigateView = (next: ViewState) => {
    setView(next);
    writeStoredView(next);
  };

  useEffect(() => {
    console.log('Initializing Kawayan AI App...');

    const initApp = async () => {
      const shouldHydrate = hasPersistedSession();
      if (shouldHydrate) setIsHydrating(true);

      let restoredUser: User | null = null;

      try {
        const urlParams = new URLSearchParams(window.location.search);
        const isPaymentSuccess = urlParams.get('success') === 'true';

        let currentUser = await dbService.getCurrentUserAsync();
        if (!currentUser) {
          currentUser = dbService.getCurrentUser();
        }

        if (currentUser) {
          restoredUser = currentUser;
          console.log('Found existing session for user:', currentUser.email);
          supportRealtime.connect();
          if (currentUser.theme === 'dark') {
            setDarkMode(true);
          } else if (currentUser.theme === 'light') {
            setDarkMode(false);
          }
          const restoredView = readStoredView();
          await handleLogin(
            currentUser,
            isPaymentSuccess ? ViewState.BILLING : restoredView ?? undefined
          );
        }

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
        if (!restoredUser) {
          // If there was a stored JWT/session but it's expired or invalid,
          // send the user to LOGIN (not LANDING) so they can sign back in.
          if (hasPersistedSession()) {
            clearStoredView();
            setView(ViewState.LOGIN);
          } else {
            clearStoredView();
            setView(ViewState.LANDING);
          }
        }
        setIsHydrating(false);
      }
    };

    initApp();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Update HTML class for dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogin = async (loggedInUser: User, initialView?: ViewState) => {
    setUser(loggedInUser);
    supportRealtime.connect();
    
    // Set theme from user preference (DB Priority)
    if (loggedInUser.theme === 'dark') {
      setDarkMode(true);
    } else {
      setDarkMode(false);
    }
    
    if (loggedInUser.role === 'admin') {
      navigateView(resolveViewForRole('admin', initialView || readStoredView()));
    } else if (loggedInUser.role === 'support') {
      navigateView(resolveViewForRole('support', initialView || readStoredView()));
    } else {
      // Fetch verification status
      try {
        const verif = await dbService.getVerificationStatus(loggedInUser.id);
        const vStatus: VerificationStatus = verif?.status ?? 'none';
        setVerifStatus(vStatus);
        setVerifRejectionReason(verif?.rejectionReason);

        // Block access if not verified
        if (vStatus !== 'verified') {
          navigateView(ViewState.VERIFICATION);
          return;
        }
      } catch (e) {
        console.warn('Could not fetch verification status:', e);
      }

      // Verified — check if user has a brand profile
      try {
        const profile = await dbService.getProfile(loggedInUser.id);
        if (profile) {
          setBrandProfile(profile);
          navigateView(initialView || readStoredView() || ViewState.CALENDAR);
        } else {
          navigateView(ViewState.SURVEY);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        navigateView(ViewState.SURVEY);
      }
    }
  };

  const handleLogout = async () => {
    await dbService.logoutUser();
    supportRealtime.disconnect();
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

  const handleSurveyComplete = async (profileData: BrandProfile) => {
    if (!user) return;
    const newProfile = { ...profileData, userId: user.id };
    try {
      await dbService.saveProfile(newProfile);
      setBrandProfile(newProfile);
      navigateView(ViewState.CALENDAR);
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

  const authViews = [ViewState.LOGIN, ViewState.SIGNUP, ViewState.ADMIN_LOGIN];
  const isAuthView = authViews.includes(view);

  return (
    <div className="min-h-screen flex flex-col transition-colors font-sans" style={{ background: 'var(--bg)', color: 'var(--fg)' }}>
      {/* ── Navigation ────────────────────────────────────────────── */}
      {!isAuthView && (
      <nav className="glass-panel sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-15" style={{ height: '3.75rem' }}>

            {/* Brand */}
            <div
              className="flex items-center gap-2.5 cursor-pointer select-none"
              onClick={() => navigateView(isLoggedIn && user ? getHomeViewForRole(user.role) : ViewState.LANDING)}
            >
              <img src="/logo.png" alt="Kawayan" className="w-8 h-8 rounded-xl object-contain" />
              <span className="font-display text-xl font-bold" style={{ color: 'var(--fg)' }}>
                Kawayan<span style={{ color: 'var(--kw-green)' }}>.</span>
              </span>
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
                  {/* Business name chip (calendar view) */}
                  {view === ViewState.CALENDAR && user?.businessName && (
                    <div className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium mr-1"
                      style={{ background: 'var(--muted)', color: 'var(--fg-muted)' }}>
                      <LayoutDashboard className="w-3.5 h-3.5" />
                      {user.businessName}
                    </div>
                  )}

                  {/* Role-based nav pills */}
                  {user?.role !== 'admin' && (
                    <div className="flex items-center p-1 rounded-2xl gap-0.5"
                      style={{ background: 'rgba(43,87,72,0.06)', border: '1px solid rgba(43,87,72,0.1)' }}>
                      {[
                        { id: ViewState.SUPPORT_DASHBOARD, label: 'Support', icon: MessageSquare, roles: ['support'] },
                        { id: ViewState.INSIGHTS, label: 'Insights', icon: BarChart3, roles: ['user'] },
                        { id: ViewState.BILLING, label: 'Billing', icon: CreditCard, roles: ['user'] },
                        { id: ViewState.SETTINGS, label: 'Settings', icon: SettingsIcon, roles: ['user', 'support'] },
                      ].filter(item => item.roles.includes(user?.role || '')).map((item) => (
                        <button
                          key={item.id}
                          onClick={() => navigateView(item.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                            view === item.id ? 'nav-item-active' : ''
                          }`}
                          style={view !== item.id ? { color: 'var(--fg-muted)' } : {}}
                        >
                          <item.icon className="w-3.5 h-3.5" />
                          <span className={`${view === item.id ? 'inline' : 'hidden'} lg:inline`}>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="w-px h-5 mx-1" style={{ background: 'var(--border-strong)' }} />

                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all"
                    style={{ color: 'var(--fg-muted)' }}
                    onMouseEnter={e => { e.currentTarget.style.color = '#C0392B'; e.currentTarget.style.background = 'rgba(192,57,43,0.06)'; }}
                    onMouseLeave={e => { e.currentTarget.style.color = 'var(--fg-muted)'; e.currentTarget.style.background = ''; }}
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </>
              ) : (
                view === ViewState.LANDING && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => navigateView(ViewState.LOGIN)}
                      className="px-4 py-2 rounded-xl text-sm font-semibold transition-all"
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
      <main className="flex-grow">
        <div className={`w-full ${
          isAuthView ? 'min-h-[calc(100vh-0px)]' :
          view === ViewState.LANDING ? '' :
          view === ViewState.CALENDAR ? 'max-w-full mx-auto py-4 px-2 sm:px-4 lg:px-6' :
          (view === ViewState.ADMIN_DASHBOARD || view === ViewState.SETTINGS) ? 'max-w-[1600px] mx-auto py-6 px-4 sm:px-6 lg:px-8' :
          'max-w-[1400px] mx-auto py-6 px-4 sm:px-6 lg:px-8'
        }`}>
          {isHydrating ? (
            <AppHydrationLoader />
          ) : (
          <Routes>
            <Route path="*" element={
              (() => {
                switch (view) {
                  case ViewState.LANDING:
                    return <LandingPage onNavigate={navigateView} />;
                  case ViewState.LOGIN:
                    return <Login onLogin={handleLogin} onNavigate={navigateView} darkMode={darkMode} toggleTheme={() => updateTheme(!darkMode)} />;
                  case ViewState.SIGNUP:
                    return <Login onLogin={handleLogin} onNavigate={navigateView} initialIsSignUp={true} darkMode={darkMode} toggleTheme={() => updateTheme(!darkMode)} />;
                  case ViewState.ADMIN_LOGIN:
                    return <Login onLogin={handleLogin} onNavigate={navigateView} isAdminLogin={true} darkMode={darkMode} toggleTheme={() => updateTheme(!darkMode)} />;
                  case ViewState.VERIFICATION:
                    return (
                      <VerificationStatusScreen
                        status={verifStatus}
                        rejectionReason={verifRejectionReason}
                        businessName={user?.businessName}
                        onLogout={handleLogout}
                        onResubmit={handleVerifResubmit}
                      />
                    );
                  case ViewState.SURVEY:
                    return <BrandSurvey onComplete={handleSurveyComplete} />;
                  case ViewState.CALENDAR:
                    if (user?.role === 'support') {
                      return (
                        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-10 animate-fade-in">
                          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2" style={{ background: 'rgba(43,87,72,0.1)' }}>
                            <MessageSquare className="w-7 h-7 text-[#2B5748]" />
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
                    return (user && brandProfile) ? <ContentCalendar profile={brandProfile} userId={user.id} /> : <AppHydrationLoader />;
                  case ViewState.SETTINGS:
                    return (user?.role === 'support' || brandProfile) ? <Settings profile={brandProfile} user={user} onProfileUpdate={handleProfileUpdate} onUserUpdate={handleUserUpdate} darkMode={darkMode} toggleDarkMode={() => updateTheme(!darkMode)} onClose={() => navigateView(user?.role === 'support' ? ViewState.SUPPORT_DASHBOARD : ViewState.CALENDAR)} /> : <AppHydrationLoader />;
                  case ViewState.INSIGHTS:
                    return <InsightsDashboard />;
                  case ViewState.BILLING:
                    return <Billing />;
                  case ViewState.SUPPORT_DASHBOARD:
                    return <SupportDashboard />;
                  case ViewState.DEMO:
                    return <DemoPage onNavigate={navigateView} />;
                  case ViewState.ADMIN_DASHBOARD:
                    return (user && user.role === 'admin') ? <AdminDashboard darkMode={darkMode} toggleTheme={() => updateTheme(!darkMode)} /> : (
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
          )}
        </div>
      </main>

      {isLoggedIn && user?.role === 'user' && <SupportWidget />}

      {/* Footer */}
      {view === ViewState.LANDING && (
        <footer className="mt-auto py-7 border-t" style={{ borderColor: 'var(--border)', background: 'var(--bg)' }}>
          <div className="max-w-7xl mx-auto px-6 flex flex-col sm:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2.5">
              <img src="/logo.png" alt="Kawayan" className="w-6 h-6 rounded-lg opacity-80" />
              <span className="font-display text-sm font-bold" style={{ color: 'var(--fg)' }}>
                Kawayan<span style={{ color: 'var(--kw-green)' }}>.</span>
              </span>
              <span className="text-xs" style={{ color: 'var(--fg-subtle)' }}>© 2025 Built for Philippine MSMEs</span>
            </div>
            <div className="flex items-center gap-5 text-xs" style={{ color: 'var(--fg-muted)' }}>
              <a href="/privacy.html" target="_blank" className="hover:text-[#2B5748] transition-colors">Privacy</a>
              <a href="/terms.html" target="_blank" className="hover:text-[#2B5748] transition-colors">Terms</a>
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