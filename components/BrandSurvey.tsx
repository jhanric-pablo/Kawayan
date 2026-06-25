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
    <div className="max-w-3xl mx-auto py-10">
       {/* Progress Header */}
      <div className="mb-8 flex flex-col items-center">
        <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-mono font-bold uppercase tracking-[0.15em] mb-4 border border-[#2B5748] bg-[#2B5748]/10 text-[#2B5748]">
          <span className="w-1.5 h-1.5 rounded-full animate-pulse-dot inline-block" style={{ background: "#2B5748" }}></span>
          Step {step} of 4
        </span>
        <h2 className="font-display text-4xl text-[#273338] dark:text-white mb-2 text-center">Setup Your Brand</h2>
        <p className="text-[#273338] dark:text-slate-400 mb-6 text-sm text-center">Let's tailor Kawayan AI to your business with organic detail.</p>
        <div className="w-full h-1.5 bg-[#9CB080] dark:bg-[#2B5748]/40 rounded-full overflow-hidden max-w-sm">
           <div 
             className="h-full rounded-full transition-all duration-500 ease-out" 
             style={{ width: `${(step / 4) * 100}%`, background: '#2B5748' }}
           />
        </div>
      </div>

      {/* Card Container - Handcrafted River Stone with Asymmetric Borders */}
      <div className="bg-white dark:bg-[#273338] rounded-[2.5rem] rounded-tl-[5rem] rounded-br-[5rem] border border-[#2B5748] dark:border-slate-850 p-10 min-h-[440px] relative overflow-hidden transition-all duration-300 hover:shadow-accent" style={{ boxShadow: '0 16px 48px -12px rgba(43, 87, 72,0.08)' }}>
        
        {/* Ambient glow wash circles */}
        <div className="absolute -top-20 -right-20 w-72 h-72 rounded-full blur-3xl opacity-20 pointer-events-none bg-[#9CB080] dark:bg-[#2B5748]/5"></div>

        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-8 duration-500">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[#2B5748]/10 dark:bg-[#2B5748]/20 text-[#2B5748]">
                <Store className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-2xl text-[#273338] dark:text-white">Business Basics</h3>
                <p className="text-sm text-[#273338]">What is your business called?</p>
              </div>
            </div>
            
            <div className="space-y-6">
              <label className="block">
                <span className="text-[11px] font-bold text-[#273338] uppercase tracking-wider mb-2 block">Business Name</span>
                <input
                  type="text"
                  className="w-full px-5 py-4 rounded-full border border-[#2B5748] dark:border-[#9CB080]/20 bg-white/50 dark:bg-[#273338] text-[#273338] dark:text-white outline-none text-base focus:ring-2 focus:ring-[#2B5748]/30"
                  placeholder="e.g., Aling Nena's Pastries"
                  value={profile.businessName}
                  onChange={(e) => handleChange('businessName', e.target.value)}
                  autoFocus
                />
              </label>
              <label className="block">
                <span className="text-[11px] font-bold text-[#273338] uppercase tracking-wider mb-2 block">Industry / Niche</span>
                <input
                  type="text"
                  className="w-full px-5 py-4 rounded-full border border-[#2B5748] dark:border-[#9CB080]/20 bg-white/50 dark:bg-[#273338] text-[#273338] dark:text-white outline-none text-base focus:ring-2 focus:ring-[#2B5748]/30"
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
             <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[#2B5748]/10 dark:bg-[#2B5748]/20 text-[#2B5748]">
                <Users className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-2xl text-[#273338] dark:text-white">Target Audience</h3>
                <p className="text-sm text-[#273338]">Who are we talking to?</p>
              </div>
            </div>
            <label className="block">
              <textarea
                className="w-full px-6 py-5 rounded-[2rem] border border-[#2B5748] dark:border-[#9CB080]/20 bg-white/50 dark:bg-[#273338] text-[#273338] dark:text-white outline-none h-48 resize-none text-base leading-relaxed focus:ring-2 focus:ring-[#2B5748]/30"
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
             <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[#2B5748]/10 dark:bg-[#2B5748]/20 text-[#2B5748]">
                <MessageCircle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-2xl text-[#273338] dark:text-white">Brand Voice</h3>
                <p className="text-sm text-[#273338]">How should your brand sound?</p>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {tones.map((t) => (
                <button
                  key={t.label}
                  onClick={() => handleChange('brandVoice', t.label)}
                  className={`p-5 rounded-2xl border text-left transition-all relative group hover:-translate-y-0.5 hover:rotate-[0.5deg] ${
                    profile.brandVoice === t.label
                      ? 'border-[#2B5748]'
                      : 'border-[#2B5748] dark:border-[#9CB080]/20 hover:border-[#273338]/10 hover:shadow-sm'
                  }`}
                  style={profile.brandVoice === t.label ? { background: 'rgba(43, 87, 72,0.07)' } : {}}
                >
                  <div className={`text-sm font-bold transition-colors ${profile.brandVoice === t.label ? 'text-[#2B5748]' : 'text-slate-700 dark:text-slate-200'}`}>{t.label}</div>
                  <div className="text-xs text-[#273338] mt-1">{t.desc}</div>
                  {profile.brandVoice === t.label && (
                    <div className="absolute top-4 right-4 rounded-full p-1 text-white bg-[#2B5748]">
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
             <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-full flex items-center justify-center bg-[#2B5748]/10 dark:bg-[#2B5748]/20 text-[#2B5748]">
                <PenTool className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-display text-2xl text-[#273338] dark:text-white">Content Themes</h3>
                <p className="text-sm text-[#273338]">Key topics you want to cover.</p>
              </div>
            </div>
            <label className="block">
              <textarea
                className="w-full px-6 py-5 rounded-[2rem] border border-[#2B5748] dark:border-[#9CB080]/20 bg-white/50 dark:bg-[#273338] text-[#273338] dark:text-white outline-none h-48 resize-none text-base leading-relaxed focus:ring-2 focus:ring-[#2B5748]/30"
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
          className={`text-[#273338] font-semibold hover:text-[#273338] dark:hover:text-white transition text-sm flex items-center gap-1 ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          ← Back
        </button>
        <button
          onClick={handleNext}
          disabled={!profile.businessName && step === 1}
          className="flex items-center gap-2 px-8 py-3.5 rounded-full font-bold text-white bg-[#2B5748] transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none text-sm"
          style={{ boxShadow: '0 8px 24px -6px rgba(43, 87, 72,0.3)' }}
        >
          {step === 4 ? 'Finish Setup' : 'Next Step'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default BrandSurvey;
