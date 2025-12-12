import React, { useState } from 'react';
import { ViewState, BrandProfile } from './types';
import BrandSurvey from './components/BrandSurvey';
import ContentCalendar from './components/ContentCalendar';
import AdminDashboard from './components/AdminDashboard';
import { LayoutDashboard, Calendar, ShieldCheck, UserCircle, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [view, setView] = useState<ViewState>(ViewState.LANDING);
  const [brandProfile, setBrandProfile] = useState<BrandProfile | null>(null);

  const handleSurveyComplete = (profile: BrandProfile) => {
    setBrandProfile(profile);
    setView(ViewState.CALENDAR);
  };

  const renderContent = () => {
    switch (view) {
      case ViewState.LANDING:
        return (
          <div className="flex flex-col items-center justify-center min-h-[80vh] text-center px-4">
             <div className="bg-emerald-100 p-4 rounded-full mb-6">
                <LayoutDashboard className="w-12 h-12 text-emerald-600" />
             </div>
             <h1 className="text-5xl font-extrabold text-slate-900 mb-6 tracking-tight">
               Kawayan <span className="text-emerald-600">AI</span>
             </h1>
             <p className="text-xl text-slate-600 max-w-2xl mb-10 leading-relaxed">
               The intelligent content engine designed for <span className="font-semibold text-slate-800">Philippine MSMEs</span>. 
               Automate your social media with culturally resonant Taglish content.
             </p>
             <div className="flex gap-4">
               <button 
                 onClick={() => setView(ViewState.SURVEY)}
                 className="bg-emerald-600 text-white px-8 py-4 rounded-full font-bold text-lg hover:bg-emerald-700 transition shadow-lg hover:shadow-emerald-200"
               >
                 Get Started (SME)
               </button>
               <button 
                 onClick={() => setView(ViewState.ADMIN)}
                 className="bg-white text-slate-700 border border-slate-200 px-8 py-4 rounded-full font-bold text-lg hover:bg-slate-50 transition shadow-sm"
               >
                 Admin Login
               </button>
             </div>
             <p className="mt-8 text-sm text-slate-400">Powered by Google Gemini 2.5</p>
          </div>
        );
      case ViewState.SURVEY:
        return <BrandSurvey onComplete={handleSurveyComplete} />;
      case ViewState.CALENDAR:
        return brandProfile ? <ContentCalendar profile={brandProfile} /> : <div>Error: No Profile</div>;
      case ViewState.ADMIN:
        return <AdminDashboard />;
      default:
        return <div>Unknown View</div>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Navigation */}
      <nav className="bg-white border-b border-slate-100 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center cursor-pointer" onClick={() => setView(ViewState.LANDING)}>
               <span className="text-2xl font-bold text-slate-800">Kawayan<span className="text-emerald-500">.</span></span>
            </div>
            {view !== ViewState.LANDING && (
              <div className="flex items-center space-x-4">
                {view === ViewState.CALENDAR && (
                   <button onClick={() => setView(ViewState.CALENDAR)} className="flex items-center gap-2 text-slate-600 hover:text-emerald-600 px-3 py-2 rounded-md transition font-medium text-sm bg-slate-50">
                     <Calendar className="w-4 h-4" /> Calendar
                   </button>
                )}
                {view === ViewState.ADMIN && (
                   <span className="flex items-center gap-2 text-rose-600 bg-rose-50 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                     <ShieldCheck className="w-3 h-3" /> Admin Mode
                   </span>
                )}
                <div className="h-6 w-px bg-slate-200"></div>
                <button 
                  onClick={() => {
                    setView(ViewState.LANDING);
                    setBrandProfile(null);
                  }}
                  className="text-slate-400 hover:text-slate-600 transition"
                >
                  <LogOut className="w-5 h-5" />
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-grow bg-slate-50">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8 h-full">
          {renderContent()}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-slate-100 py-6">
        <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
          &copy; 2025 Kawayan AI. Designed for Philippine SMEs.
        </div>
      </footer>
    </div>
  );
};

export default App;
