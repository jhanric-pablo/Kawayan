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
import {
  hasPersistedSession,
  readStoredView,
  writeStoredView,
  clearStoredView,
  readThemeFromSession,
} from './utils/sessionView';
import { LayoutDashboard, LogOut, Lock, ArrowRight, Settings as SettingsIcon, BarChart3, CreditCard, MessageSquare } from 'lucide-react';

const App: React.FC = () => {
  const dialog = useOrganicDialog();
  const [isHydrating, setIsHydrating] = useState(() => hasPersistedSession());
  const [view, setView] = useState<ViewState>(() => {
    if (hasPersistedSession()) {
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
          clearStoredView();
          setView(ViewState.LANDING);
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
    
    // Set theme from user preference (DB Priority)
    if (loggedInUser.theme === 'dark') {
      setDarkMode(true);
    } else {
      setDarkMode(false);
    }
    
    if (loggedInUser.role === 'admin') {
      navigateView(ViewState.ADMIN_DASHBOARD);
    } else if (loggedInUser.role === 'support') {
      navigateView(initialView || readStoredView() || ViewState.SUPPORT_DASHBOARD);
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

  return (
    <div className="min-h-screen flex flex-col bg-white dark:bg-[#273338] transition-colors font-sans text-[#273338] dark:text-white">
      {/* Navigation */}
      <nav className="bg-white/90 dark:bg-[#273338]/90 backdrop-blur-lg border-b border-[#273338]/10 dark:border-[#9CB080]/20 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14">
            {/* Brand */}
            <div className="flex items-center cursor-pointer gap-2.5" onClick={() => navigateView(isLoggedIn ? ViewState.CALENDAR : ViewState.LANDING)}>
               <img src="/logo.png" alt="Kawayan Logo" className="w-7 h-7 rounded-lg" />
               <span className="font-display text-xl text-[#273338] dark:text-white">Kawayan<span className="text-[#2B5748] dark:text-[#9CB080]">.</span></span>
               {user?.role === 'admin' && (
                 <span className="ml-1 px-2 py-0.5 rounded text-[10px] uppercase font-bold text-white" style={{ background: '#273338' }}>Admin</span>
               )}
            </div>
            
            <div className="flex items-center gap-2">
              {isLoggedIn ? (
                <>
                  {view === ViewState.CALENDAR && (
                     <div className="hidden md:flex items-center gap-1.5 text-slate-400 dark:text-slate-500 text-xs font-medium mr-2">
                       <LayoutDashboard className="w-3.5 h-3.5" />
                       {user?.businessName}
                     </div>
                  )}
                  
                  {user?.role !== 'admin' && (
                    <div className="flex items-center bg-[#273338]/5 dark:bg-[#2B5748]/40 p-1 rounded-2xl border border-[#273338]/10 dark:border-[#9CB080]/20">
                      {[
                        { id: ViewState.SUPPORT_DASHBOARD, label: 'Support', icon: MessageSquare, roles: ['support'] },
                        { id: ViewState.INSIGHTS, label: 'Insights', icon: BarChart3, roles: ['user'] },
                        { id: ViewState.BILLING, label: 'Billing', icon: CreditCard, roles: ['user'] },
                        { id: ViewState.SETTINGS, label: 'Settings', icon: SettingsIcon, roles: ['user', 'support'] },
                      ].filter(item => item.roles.includes(user?.role || '')).map((item) => (
                        <button 
                          key={item.id}
                          onClick={() => navigateView(item.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all duration-200 text-[11px] font-bold uppercase tracking-wider ${
                            view === item.id 
                              ? 'bg-white dark:bg-[#2B5748]/50 shadow-sm' 
                              : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'
                          }`}
                          style={view === item.id ? { color: '#2B5748' } : {}}
                        >
                          <item.icon className="w-3.5 h-3.5" />
                          <span className={`${view === item.id ? 'inline' : 'hidden'} lg:inline`}>{item.label}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="h-5 w-px bg-[#2B5748]/20 dark:bg-[#2B5748]/50 mx-1"></div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/10 transition-all text-[11px] font-bold uppercase tracking-widest"
                  >
                    <LogOut className="w-3.5 h-3.5" /> <span>Out</span>
                  </button>
                </>
              ) : (
                view === ViewState.LANDING && (
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => navigateView(ViewState.LOGIN)}
                      className="text-slate-500 dark:text-slate-400 font-semibold hover:text-slate-800 dark:hover:text-white transition px-3 py-1.5 text-sm rounded-xl hover:bg-slate-100 dark:hover:bg-[#2B5748]/50"
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => navigateView(ViewState.SIGNUP)}
                      className="organic-btn-primary px-6 py-2 rounded-full font-bold text-sm transition hover:scale-105 active:scale-95 flex items-center gap-1.5"
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

      {/* Main Content */}
      <main className={`flex-grow ${view === ViewState.LOGIN || view === ViewState.SIGNUP || view === ViewState.ADMIN_LOGIN ? 'flex items-center justify-center' : ''}`}>
        <div className={`w-full ${view === ViewState.LANDING ? '' : (view === ViewState.CALENDAR ? 'max-w-full mx-auto py-4 px-2 sm:px-4 lg:px-6' : (view === ViewState.ADMIN_DASHBOARD || view === ViewState.SETTINGS ? 'max-w-[1600px] mx-auto py-6 px-4 sm:px-6 lg:px-8' : 'w-full'))}`}>
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
                    return (user && user.role === 'admin') ? <AdminDashboard darkMode={darkMode} toggleTheme={() => updateTheme(!darkMode)} /> : <div className="text-center p-10">Access Denied</div>;
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
      {(view === ViewState.LANDING) && (
        <footer className="bg-white dark:bg-[#273338] border-t border-[#273338]/10 dark:border-[#9CB080]/20 py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-center md:text-left">
              <span className="font-display text-base text-[#273338] dark:text-white">Kawayan<span className="text-[#2B5748] dark:text-[#9CB080]">.</span></span>
              <span className="text-slate-300 dark:text-slate-700">|</span>
              <p className="text-slate-400 text-xs">&copy; 2025 Kawayan AI. Built for Philippine SMEs.</p>
            </div>
            
            <div className="flex gap-6 text-xs text-slate-400 dark:text-slate-500">
               <a href="#" className="hover:text-slate-700 dark:hover:text-slate-300 transition">Privacy</a>
               <a href="#" className="hover:text-slate-700 dark:hover:text-slate-300 transition">Terms</a>
               <a href="#" className="hover:text-slate-700 dark:hover:text-slate-300 transition">Contact</a>
            </div>

            {!user && view !== ViewState.ADMIN_LOGIN && (
               <button 
                 onClick={() => navigateView(ViewState.ADMIN_LOGIN)} 
                 className="text-xs text-slate-200 dark:text-slate-800 hover:text-slate-400 transition flex items-center gap-1"
               >
                 <Lock className="w-3 h-3"/>
               </button>
            )}
          </div>
        </footer>
      )}
    </div>
  );
};

export default App;