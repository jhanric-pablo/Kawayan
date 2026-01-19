import React, { useState, useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { ViewState, BrandProfile, User } from './types';
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
import AuthCallback from './components/AuthCallback';
import UniversalDatabaseService from './services/universalDatabaseService';
import { LayoutDashboard, LogOut, Lock, ArrowRight, Settings as SettingsIcon, BarChart3, CreditCard } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.LANDING);
  const [user, setUser] = useState<User | null>(null);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [dbService] = useState(() => new UniversalDatabaseService());

  useEffect(() => {
    console.log('Initializing Kawayan AI App...');

    try {
      // Check for existing session on load
      const currentUser = dbService.getCurrentUser();
      if (currentUser) {
        console.log('Found existing session for user:', currentUser.email);
        handleLogin(currentUser);
      }
      
      // Check URL path or hash for admin back door
      const path = window.location.pathname;
      const hash = window.location.hash;
      
      if (hash === '#admin-portal' || path === '/admin-portal') {
        setView(ViewState.ADMIN_LOGIN);
      }

      // Check system preference for dark mode
      if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
         setDarkMode(true);
      }
    } catch (error) {
      console.error('Error initializing app:', error);
    }
  }, []);

  // Update HTML class for dark mode
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    
    // Set theme from user preference
    if (loggedInUser.theme === 'dark') {
      setDarkMode(true);
    } else {
      setDarkMode(false);
    }
    
    if (loggedInUser.role === 'admin') {
      setView(ViewState.ADMIN_DASHBOARD);
    } else if (loggedInUser.role === 'support') {
      setView(ViewState.SUPPORT_DASHBOARD);
    } else {
      // Check if user has a profile
      try {
        const profile = await dbService.getProfile(loggedInUser.id);
        if (profile) {
          setBrandProfile(profile);
          setView(ViewState.CALENDAR);
        } else {
          // No profile, go to survey
          setView(ViewState.SURVEY);
        }
      } catch (error) {
        console.error('Error fetching profile:', error);
        setView(ViewState.SURVEY);
      }
    }
  };

  const handleLogout = async () => {
    await dbService.logoutUser();
    setUser(null);
    setBrandProfile(null);
    setView(ViewState.LANDING);
  };

  const handleSurveyComplete = async (profileData: BrandProfile) => {
    if (!user) return;
    const newProfile = { ...profileData, userId: user.id };
    try {
      await dbService.saveProfile(newProfile);
      setBrandProfile(newProfile);
      setView(ViewState.CALENDAR);
    } catch (error) {
      console.error('Error saving profile:', error);
      alert('Failed to save profile. Please try again.');
    }
  };

  const handleProfileUpdate = async (profileData: BrandProfile) => {
    await dbService.saveProfile(profileData);
    setBrandProfile(profileData);
  };

  const handleUserUpdate = async (updatedUser: User) => {
    // Note: Password update would need special handling in backend
    // For now we just alert as this is a prototype
    alert("Profile updates are currently managed via account settings. Feature coming soon.");
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
    <div className="min-h-screen flex flex-col bg-slate-50 dark:bg-slate-900 transition-colors font-sans text-slate-900 dark:text-slate-100">
      {/* Navigation */}
      <nav className={`bg-white/80 dark:bg-slate-900/80 backdrop-blur-md border-b border-slate-100 dark:border-slate-800 sticky top-0 z-50 transition-all ${!isLoggedIn && view === ViewState.LANDING ? 'py-2' : ''}`}>
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setView(isLoggedIn ? ViewState.CALENDAR : ViewState.LANDING)}>
               <img src="/logo.png" alt="Kawayan Logo" className="w-8 h-8 mr-2 rounded-lg shadow-sm" />
               <span className="text-2xl font-extrabold text-slate-900 dark:text-white tracking-tight">Kawayan<span className="text-emerald-500">.</span></span>
               {user?.role === 'admin' && <span className="ml-2 px-2 py-0.5 bg-slate-800 text-white text-[10px] uppercase font-bold rounded">Admin</span>}
            </div>
            
            <div className="flex items-center space-x-4">
              {isLoggedIn ? (
                <>
                  {view === ViewState.CALENDAR && (
                     <div className="hidden md:flex items-center gap-2 text-slate-500 dark:text-slate-400 text-sm mr-4">
                       {user?.businessName}
                     </div>
                  )}
                  
                  {user?.role !== 'admin' && (
                    <>
                      <button 
                        onClick={() => setView(ViewState.INSIGHTS)}
                        className={`p-2 rounded-full transition ${view === ViewState.INSIGHTS ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        title="Insights"
                      >
                        <BarChart3 className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setView(ViewState.BILLING)}
                        className={`p-2 rounded-full transition ${view === ViewState.BILLING ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        title="Billing"
                      >
                        <CreditCard className="w-5 h-5" />
                      </button>
                      <button 
                        onClick={() => setView(ViewState.SETTINGS)}
                        className={`p-2 rounded-full transition ${view === ViewState.SETTINGS ? 'bg-slate-100 dark:bg-slate-800 text-emerald-600' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                        title="Settings"
                      >
                        <SettingsIcon className="w-5 h-5" />
                      </button>
                    </>
                  )}

                  <div className="h-6 w-px bg-slate-200 dark:bg-slate-700"></div>
                  <button 
                    onClick={handleLogout}
                    className="flex items-center gap-2 text-slate-400 hover:text-rose-600 transition text-sm font-medium"
                  >
                    <LogOut className="w-4 h-4" /> <span className="hidden md:inline">Logout</span>
                  </button>
                </>
              ) : (
                view === ViewState.LANDING && (
                  <div className="flex items-center gap-3">
                    <button 
                      onClick={() => setView(ViewState.LOGIN)}
                      className="text-slate-600 dark:text-slate-300 font-semibold hover:text-emerald-600 transition px-3 py-2 text-sm"
                    >
                      Login
                    </button>
                    <button 
                      onClick={() => setView(ViewState.SIGNUP)}
                      className="bg-slate-900 dark:bg-emerald-600 text-white px-5 py-2.5 rounded-full font-bold text-sm hover:bg-slate-800 dark:hover:bg-emerald-700 transition shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center gap-2"
                    >
                      Sign Up <ArrowRight className="w-4 h-4" />
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
        <div className={`w-full ${view === ViewState.CALENDAR || view === ViewState.ADMIN_DASHBOARD || view === ViewState.SETTINGS ? 'max-w-[1600px] mx-auto py-6 px-4 sm:px-6 lg:px-8' : 'w-full'}`}>
          <Routes>
            <Route path="/auth/callback/:platform" element={<AuthCallback />} />
            <Route path="*" element={
              (() => {
                switch (view) {
                  case ViewState.LANDING:
                    return <LandingPage onNavigate={setView} />;
                  case ViewState.LOGIN:
                    return <Login onLogin={handleLogin} onNavigate={setView} />;
                  case ViewState.SIGNUP:
                    return <Login onLogin={handleLogin} onNavigate={setView} initialIsSignUp={true} />;
                  case ViewState.ADMIN_LOGIN:
                    return <Login onLogin={handleLogin} onNavigate={setView} isAdminLogin={true} />;
                  case ViewState.SURVEY:
                    return <BrandSurvey onComplete={handleSurveyComplete} />;
                  case ViewState.CALENDAR:
                    return (user && brandProfile) ? <ContentCalendar profile={brandProfile} userId={user.id} /> : <div>Loading...</div>;
                  case ViewState.SETTINGS:
                    return (brandProfile) ? <Settings profile={brandProfile} user={user} onProfileUpdate={handleProfileUpdate} onUserUpdate={handleUserUpdate} darkMode={darkMode} toggleDarkMode={() => setDarkMode(!darkMode)} onClose={() => setView(ViewState.CALENDAR)} /> : <div>Loading...</div>;
                  case ViewState.INSIGHTS:
                    return <InsightsDashboard />;
                  case ViewState.BILLING:
                    return <Billing />;
                  case ViewState.SUPPORT_DASHBOARD:
                    return <SupportDashboard />;
                  case ViewState.ADMIN_DASHBOARD:
                    return (user && user.role === 'admin') ? <AdminDashboard /> : <div className="text-center p-10">Access Denied</div>;
                  default:
                    return <LandingPage onNavigate={setView} />;
                }
              })()
            } />
          </Routes>
        </div>
      </main>
      
      {isLoggedIn && user?.role === 'user' && <SupportWidget />}
      
      {/* Footer */}
      {(view === ViewState.LANDING) && (
        <footer className="bg-white dark:bg-slate-900 border-t border-slate-100 dark:border-slate-800 py-8 mt-auto">
          <div className="max-w-7xl mx-auto px-4 flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="text-center md:text-left">
              <span className="font-bold text-slate-800 dark:text-white">Kawayan AI</span>
              <p className="text-slate-400 text-sm mt-1">&copy; 2025 Kawayan AI. Designed for Philippine SMEs.</p>
            </div>
            
            <div className="flex gap-6 text-sm text-slate-500 dark:text-slate-400">
               <a href="#" className="hover:text-emerald-600 transition">Privacy</a>
               <a href="#" className="hover:text-emerald-600 transition">Terms</a>
               <a href="#" className="hover:text-emerald-600 transition">Contact</a>
            </div>

            {!user && view !== ViewState.ADMIN_LOGIN && (
               <button 
                 onClick={() => setView(ViewState.ADMIN_LOGIN)} 
                 className="text-xs text-slate-200 dark:text-slate-700 hover:text-slate-400 transition flex items-center gap-1"
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