import React, { useState } from 'react';
import { BrandProfile } from '../types';
import { ArrowRight, Store, Users, MessageCircle, PenTool, Check } from 'lucide-react';

interface Props {
  onComplete: (profile: BrandProfile) => void;
}

const BrandSurvey: React.FC<Props> = ({ onComplete }) => {
  const [step, setStep] = useState(1);
  const [profile, setProfile] = useState<BrandProfile>({
    businessName: '',
    industry: '',
    targetAudience: '',
    brandVoice: 'Friendly & Approachable',
    keyThemes: ''
  });

  const handleNext = () => {
    if (step < 4) setStep(step + 1);
    else onComplete(profile);
  };

  const handleChange = (field: keyof BrandProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const tones = [
    { label: 'Professional & Trustworthy', desc: 'Corporate, serious, expert' },
    { label: 'Makulit & Fun (Kwelang Pinoy)', desc: 'Meme-style, energetic, relatable' },
    { label: 'Inspirational (Hugot)', desc: 'Emotional, motivational, deep' },
    { label: 'Premium & Minimalist', desc: 'Sleek, high-end, few words' },
    { label: 'Friendly Tita', desc: 'Caring, warm, gossipy but nice' }
  ];

  return (
    <div className="max-w-3xl mx-auto">
       {/* Progress Header */}
      <div className="mb-8 flex flex-col items-center">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Setup Your Brand</h2>
        <p className="text-slate-500 dark:text-slate-400 mb-6">Let's tailor Kawayan AI to your business.</p>
        <div className="w-full h-1 bg-slate-200 dark:bg-slate-800 rounded-full overflow-hidden max-w-sm">
           <div 
             className="h-full bg-emerald-500 transition-all duration-500 ease-out" 
             style={{ width: `${(step / 4) * 100}%` }}
           />
        </div>
      </div>

      {/* Card Container */}
      <div className="bg-white dark:bg-slate-850 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 p-8 min-h-[420px] relative overflow-hidden transition-colors">
        
        {/* Animated Background Blob */}
        <div className="absolute -top-20 -right-20 w-64 h-64 bg-emerald-50 dark:bg-emerald-900/10 rounded-full blur-3xl opacity-50 pointer-events-none"></div>

        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-emerald-100 dark:bg-emerald-900/30 rounded-xl text-emerald-600 dark:text-emerald-400">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Business Basics</h3>
                <p className="text-sm text-slate-400">What is your business called?</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <label className="block">
                <span className="text-slate-700 dark:text-slate-300 font-semibold mb-2 block">Business Name</span>
                <input
                  type="text"
                  className="w-full px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition text-lg"
                  placeholder="e.g., Aling Nena's Pastries"
                  value={profile.businessName}
                  onChange={(e) => handleChange('businessName', e.target.value)}
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-slate-700 dark:text-slate-300 font-semibold mb-2 block">Industry / Niche</span>
                <input
                  type="text"
                  className="w-full px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition text-lg"
                  placeholder="e.g., Food & Beverage, Fashion, Hardware"
                  value={profile.industry}
                  onChange={(e) => handleChange('industry', e.target.value)}
                />
              </label>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
             <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 dark:bg-blue-900/30 rounded-xl text-blue-600 dark:text-blue-400">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Target Audience</h3>
                <p className="text-sm text-slate-400">Who are we talking to?</p>
              </div>
            </div>
            <label className="block">
              <textarea
                className="w-full px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition h-48 resize-none text-lg leading-relaxed"
                placeholder="e.g., Gen Z students in Manila, Working Moms looking for quick meals, titas of Manila..."
                value={profile.targetAudience}
                onChange={(e) => handleChange('targetAudience', e.target.value)}
                autoFocus
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
             <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-purple-100 dark:bg-purple-900/30 rounded-xl text-purple-600 dark:text-purple-400">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Brand Voice</h3>
                <p className="text-sm text-slate-400">How should your brand sound?</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tones.map((t) => (
                <button
                  key={t.label}
                  onClick={() => handleChange('brandVoice', t.label)}
                  className={`p-4 rounded-2xl border text-left transition-all relative group ${
                    profile.brandVoice === t.label
                      ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20 ring-2 ring-emerald-500 ring-opacity-20'
                      : 'border-slate-100 dark:border-slate-800 hover:border-emerald-300 dark:hover:border-emerald-700 hover:shadow-md'
                  }`}
                >
                  <div className={`font-bold transition-colors ${profile.brandVoice === t.label ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-800 dark:text-slate-200 group-hover:text-emerald-700 dark:group-hover:text-emerald-400'}`}>{t.label}</div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.desc}</div>
                  {profile.brandVoice === t.label && (
                    <div className="absolute top-4 right-4 bg-emerald-500 rounded-full p-1 text-white">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
             <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-100 dark:bg-orange-900/30 rounded-xl text-orange-600 dark:text-orange-400">
                <PenTool className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-white">Content Themes</h3>
                <p className="text-sm text-slate-400">Key topics you want to cover.</p>
              </div>
            </div>
            <label className="block">
              <textarea
                className="w-full px-5 py-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500 outline-none transition h-48 resize-none text-lg leading-relaxed"
                placeholder="e.g., Product launches, Behind the scenes, Customer testimonials, Funny memes..."
                value={profile.keyThemes}
                onChange={(e) => handleChange('keyThemes', e.target.value)}
                autoFocus
              />
            </label>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-between items-center px-2">
        <button
          onClick={() => step > 1 && setStep(step - 1)}
          className={`text-slate-400 dark:text-slate-500 font-medium hover:text-slate-600 dark:hover:text-slate-300 transition ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          Back
        </button>
        <button
          onClick={handleNext}
          disabled={!profile.businessName && step === 1}
          className="flex items-center gap-2 bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700 text-white px-8 py-4 rounded-full font-bold transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
        >
          {step === 4 ? 'Finish Setup' : 'Next Step'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};

export default BrandSurvey;
