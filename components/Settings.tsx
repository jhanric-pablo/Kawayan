import React, { useState, useEffect } from 'react';
import { BrandProfile } from '../types';
import { saveProfile } from '../services/storage';
import { Save, User, MessageCircle, Target, Briefcase, Moon, Sun, Monitor } from 'lucide-react';

interface Props {
  profile: BrandProfile;
  onProfileUpdate: (p: BrandProfile) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
}

const Settings: React.FC<Props> = ({ profile, onProfileUpdate, darkMode, toggleDarkMode }) => {
  const [formData, setFormData] = useState<BrandProfile>(profile);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  const handleChange = (field: keyof BrandProfile, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    saveProfile(formData);
    onProfileUpdate(formData);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage your brand preferences and app experience.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Navigation Sidebar (Visual only for now) */}
        <div className="md:col-span-1 space-y-4">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4 px-2">Preferences</h3>
              <nav className="space-y-1">
                 <button className="w-full text-left px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400 font-medium rounded-lg">Brand Profile</button>
                 <button className="w-full text-left px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition">Account</button>
                 <button className="w-full text-left px-3 py-2 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg transition">Billing</button>
              </nav>
           </div>

           {/* Theme Toggle Card */}
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-bold text-slate-800 dark:text-white mb-2">Appearance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Choose your interface theme.</p>
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                 <button 
                   onClick={() => !darkMode && toggleDarkMode()} 
                   className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition ${!darkMode ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   <Sun className="w-4 h-4"/> Light
                 </button>
                 <button 
                   onClick={() => darkMode && toggleDarkMode()}
                   className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition ${darkMode ? 'bg-slate-700 shadow text-white' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <Moon className="w-4 h-4"/> Dark
                 </button>
              </div>
           </div>
        </div>

        {/* Main Form */}
        <div className="md:col-span-2">
           <form onSubmit={handleSave} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6">
              
              <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
                 <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                    <User className="w-5 h-5"/>
                 </div>
                 <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">Brand Identity</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">This info guides the AI to write like you.</p>
                 </div>
              </div>

              <div className="space-y-4">
                 <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Business Name</label>
                    <input 
                      type="text" 
                      value={formData.businessName}
                      onChange={(e) => handleChange('businessName', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                    />
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                       <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2"><Briefcase className="w-3 h-3"/> Industry</label>
                       <input 
                         type="text" 
                         value={formData.industry}
                         onChange={(e) => handleChange('industry', e.target.value)}
                         className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                       />
                    </div>
                    <div>
                       <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2"><Target className="w-3 h-3"/> Target Audience</label>
                       <input 
                         type="text" 
                         value={formData.targetAudience}
                         onChange={(e) => handleChange('targetAudience', e.target.value)}
                         className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                       />
                    </div>
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2"><MessageCircle className="w-3 h-3"/> Brand Voice</label>
                    <input 
                      type="text" 
                      value={formData.brandVoice}
                      onChange={(e) => handleChange('brandVoice', e.target.value)}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                      placeholder="e.g. Fun, Professional, Friendly"
                    />
                 </div>

                 <div>
                    <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Content Themes (Topics)</label>
                    <textarea 
                      value={formData.keyThemes}
                      onChange={(e) => handleChange('keyThemes', e.target.value)}
                      rows={4}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none"
                    />
                 </div>
              </div>

              <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                 <button 
                   type="submit"
                   className={`px-6 py-2.5 rounded-lg font-bold text-white flex items-center gap-2 transition transform active:scale-95 ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700'}`}
                 >
                   {saved ? 'Changes Saved!' : 'Save Changes'} <Save className="w-4 h-4"/>
                 </button>
              </div>
           </form>
        </div>
      </div>
    </div>
  );
};

export default Settings;
