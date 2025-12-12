import React, { useState } from 'react';
import { BrandProfile } from '../types';
import { ArrowRight, Store, Users, MessageCircle, PenTool } from 'lucide-react';

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

  return (
    <div className="max-w-2xl mx-auto p-6 bg-white rounded-2xl shadow-xl border border-slate-100">
      <div className="mb-8 text-center">
        <h2 className="text-3xl font-bold text-slate-800 mb-2">Setup Your Brand Profile</h2>
        <p className="text-slate-500">Let's tailor the AI to your Filipino business.</p>
        <div className="flex justify-center mt-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className={`h-2 w-16 rounded-full transition-all ${i <= step ? 'bg-emerald-500' : 'bg-slate-200'}`} />
          ))}
        </div>
      </div>

      <div className="min-h-[300px]">
        {step === 1 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
            <div className="flex items-center gap-3 mb-4">
              <Store className="w-6 h-6 text-emerald-600" />
              <h3 className="text-xl font-semibold">Business Basics</h3>
            </div>
            <label className="block mb-4">
              <span className="text-slate-700 font-medium">Business Name</span>
              <input
                type="text"
                className="mt-1 block w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                placeholder="e.g., Aling Nena's Pastries"
                value={profile.businessName}
                onChange={(e) => handleChange('businessName', e.target.value)}
              />
            </label>
            <label className="block">
              <span className="text-slate-700 font-medium">Industry / Niche</span>
              <input
                type="text"
                className="mt-1 block w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition"
                placeholder="e.g., Food & Beverage, Fashion, Hardware"
                value={profile.industry}
                onChange={(e) => handleChange('industry', e.target.value)}
              />
            </label>
          </div>
        )}

        {step === 2 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="flex items-center gap-3 mb-4">
              <Users className="w-6 h-6 text-emerald-600" />
              <h3 className="text-xl font-semibold">Target Audience</h3>
            </div>
            <label className="block">
              <span className="text-slate-700 font-medium">Who are your customers?</span>
              <textarea
                className="mt-1 block w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition h-32 resize-none"
                placeholder="e.g., Gen Z students in Manila, Working Moms looking for quick meals, titas of Manila..."
                value={profile.targetAudience}
                onChange={(e) => handleChange('targetAudience', e.target.value)}
              />
            </label>
          </div>
        )}

        {step === 3 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="flex items-center gap-3 mb-4">
              <MessageCircle className="w-6 h-6 text-emerald-600" />
              <h3 className="text-xl font-semibold">Brand Voice (Tone)</h3>
            </div>
            <p className="text-sm text-slate-500 mb-4">How should your brand sound to Filipinos?</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {['Professional & Trustworthy', 'Makulit & Fun (Kwelang Pinoy)', 'Inspirational (Hugot)', 'Premium & Minimalist', 'Friendly Tita'].map((tone) => (
                <button
                  key={tone}
                  onClick={() => handleChange('brandVoice', tone)}
                  className={`p-4 rounded-xl border text-left transition-all ${
                    profile.brandVoice === tone
                      ? 'border-emerald-500 bg-emerald-50 text-emerald-700 ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                  }`}
                >
                  {tone}
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 4 && (
          <div className="animate-in fade-in slide-in-from-right-4 duration-300">
             <div className="flex items-center gap-3 mb-4">
              <PenTool className="w-6 h-6 text-emerald-600" />
              <h3 className="text-xl font-semibold">Content Themes</h3>
            </div>
            <label className="block">
              <span className="text-slate-700 font-medium">What key topics do you want to post about?</span>
              <textarea
                className="mt-1 block w-full px-4 py-3 rounded-lg border border-slate-300 focus:ring-2 focus:ring-emerald-500 focus:border-transparent outline-none transition h-32 resize-none"
                placeholder="e.g., Product launches, Behind the scenes, Customer testimonials, Funny memes..."
                value={profile.keyThemes}
                onChange={(e) => handleChange('keyThemes', e.target.value)}
              />
            </label>
          </div>
        )}
      </div>

      <div className="mt-8 flex justify-end">
        <button
          onClick={handleNext}
          disabled={!profile.businessName && step === 1}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-8 py-3 rounded-full font-semibold transition-all shadow-lg shadow-emerald-200 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {step === 4 ? 'Finish Setup' : 'Next Step'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};

export default BrandSurvey;
