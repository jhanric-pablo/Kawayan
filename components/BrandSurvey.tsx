import React, { useState } from 'react';
import { BrandProfile } from '../types';
import { ArrowRight, ArrowLeft, Store, Users, MessageCircle, PenTool, Check, Sparkles } from 'lucide-react';

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
    { label: 'Friendly Tita', desc: 'Caring, warm, gossipy but nice' },
  ];

  const steps = [
    { num: 1, icon: Store, label: 'Business' },
    { num: 2, icon: Users, label: 'Audience' },
    { num: 3, icon: MessageCircle, label: 'Voice' },
    { num: 4, icon: PenTool, label: 'Themes' },
  ];

  const inputClass = `
    w-full px-4 py-3 rounded-xl border text-sm
    bg-white/70 dark:bg-[#111E18]/60
    border-[#2B5748]/15 dark:border-[#9CB080]/15
    text-[#1A2B26] dark:text-[#E8F0EC]
    placeholder-[#1A2B26]/35 dark:placeholder-[#E8F0EC]/25
    focus:outline-none focus:border-[#2B5748] dark:focus:border-[#9CB080]
    focus:ring-0 focus:bg-white dark:focus:bg-[#111E18]/80
    transition-all duration-200
  `.trim();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: 'var(--bg)' }}>
      {/* Background blobs */}
      <div className="fixed top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-[0.05] blur-[100px] bg-[#2B5748] pointer-events-none" />
      <div className="fixed bottom-[10%] left-[-5%] w-[400px] h-[400px] rounded-full opacity-[0.04] blur-[80px] bg-[#9CB080] pointer-events-none" />

      <div className="w-full max-w-2xl animate-scale-in">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-4 text-xs font-semibold"
            style={{ background: 'rgba(43,87,72,0.09)', border: '1px solid rgba(43,87,72,0.14)', color: '#2B5748' }}>
            <Sparkles className="w-3.5 h-3.5" />
            Brand DNA Setup
          </div>
          <h1 className="font-display text-3xl font-bold mb-2" style={{ color: 'var(--fg)' }}>
            Let's set up your brand
          </h1>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            This helps Kawayan AI create content that truly sounds like you.
          </p>
        </div>

        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((s, i) => {
            const Icon = s.icon;
            const done = s.num < step;
            const active = s.num === step;
            return (
              <React.Fragment key={s.num}>
                <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl transition-all text-xs font-semibold ${
                  active ? 'text-white' : done ? 'text-[#2B5748]' : ''
                }`}
                  style={{
                    background: active
                      ? 'linear-gradient(135deg, #2B5748, #3A7362)'
                      : done ? 'rgba(43,87,72,0.1)' : 'rgba(26,43,38,0.05)',
                    color: active ? 'white' : done ? '#2B5748' : 'var(--fg-subtle)',
                    boxShadow: active ? '0 4px 12px -3px rgba(43,87,72,0.35)' : undefined,
                  }}>
                  {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                  <span className="hidden sm:inline">{s.label}</span>
                </div>
                {i < steps.length - 1 && (
                  <div className="w-8 h-px" style={{ background: done ? '#2B5748' : 'var(--border)' }} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Progress bar */}
        <div className="h-1 w-full rounded-full mb-8 overflow-hidden" style={{ background: 'var(--border)' }}>
          <div
            className="h-full rounded-full transition-all duration-500 ease-out"
            style={{ width: `${(step / 4) * 100}%`, background: 'linear-gradient(90deg, #2B5748, #3A7362)' }}
          />
        </div>

        {/* Card */}
        <div className="glass-card p-8 md:p-10" style={{ minHeight: '360px' }}>

          {step === 1 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-3.5 mb-7">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(43,87,72,0.1)' }}>
                  <Store className="w-5 h-5 text-[#2B5748]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Business Basics</h2>
                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Tell us about your business</p>
                </div>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--fg-subtle)' }}>Business Name</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="e.g., Aling Nena's Pastries"
                    value={profile.businessName}
                    onChange={(e) => handleChange('businessName', e.target.value)}
                    autoFocus
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--fg-subtle)' }}>Industry / Niche</label>
                  <input
                    type="text"
                    className={inputClass}
                    placeholder="e.g., Food & Beverage, Fashion, Hardware"
                    value={profile.industry}
                    onChange={(e) => handleChange('industry', e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-3.5 mb-7">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(43,87,72,0.1)' }}>
                  <Users className="w-5 h-5 text-[#2B5748]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Target Audience</h2>
                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Who are your ideal customers?</p>
                </div>
              </div>
              <textarea
                className={`${inputClass} h-44 resize-none rounded-xl`}
                placeholder="e.g., Gen Z students in Manila, Working Moms looking for quick meals, titas of Manila..."
                value={profile.targetAudience}
                onChange={(e) => handleChange('targetAudience', e.target.value)}
                autoFocus
              />
            </div>
          )}

          {step === 3 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-3.5 mb-7">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(43,87,72,0.1)' }}>
                  <MessageCircle className="w-5 h-5 text-[#2B5748]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Brand Voice</h2>
                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>How should your brand sound?</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {tones.map((t) => {
                  const active = profile.brandVoice === t.label;
                  return (
                    <button
                      key={t.label}
                      onClick={() => handleChange('brandVoice', t.label)}
                      className="p-4 rounded-xl border text-left transition-all relative"
                      style={{
                        background: active ? 'rgba(43,87,72,0.07)' : 'var(--card)',
                        borderColor: active ? '#2B5748' : 'var(--border)',
                        boxShadow: active ? '0 0 0 2px rgba(43,87,72,0.15)' : undefined,
                      }}
                    >
                      <div className="text-sm font-semibold mb-0.5" style={{ color: active ? '#2B5748' : 'var(--fg)' }}>
                        {t.label}
                      </div>
                      <div className="text-xs" style={{ color: 'var(--fg-muted)' }}>{t.desc}</div>
                      {active && (
                        <div className="absolute top-3 right-3 w-5 h-5 rounded-full flex items-center justify-center bg-[#2B5748]">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 4 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-3.5 mb-7">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(43,87,72,0.1)' }}>
                  <PenTool className="w-5 h-5 text-[#2B5748]" />
                </div>
                <div>
                  <h2 className="text-lg font-bold" style={{ color: 'var(--fg)' }}>Content Themes</h2>
                  <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Key topics you want to cover</p>
                </div>
              </div>
              <textarea
                className={`${inputClass} h-44 resize-none rounded-xl`}
                placeholder="e.g., Product launches, Behind the scenes, Customer testimonials, Funny memes..."
                value={profile.keyThemes}
                onChange={(e) => handleChange('keyThemes', e.target.value)}
                autoFocus
              />
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex justify-between items-center mt-6">
          <button
            onClick={() => step > 1 && setStep(step - 1)}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
              step === 1 ? 'opacity-0 pointer-events-none' : ''
            }`}
            style={{ color: 'var(--fg-muted)', border: '1.5px solid var(--border)' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--border-strong)'; e.currentTarget.style.color = 'var(--fg)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-muted)'; }}
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>

          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map(n => (
              <div key={n} className="w-2 h-2 rounded-full transition-all"
                style={{ background: n <= step ? '#2B5748' : 'var(--border)' }} />
            ))}
          </div>

          <button
            onClick={handleNext}
            disabled={step === 1 && !profile.businessName.trim()}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'linear-gradient(135deg, #2B5748, #3A7362)',
              boxShadow: '0 4px 16px -4px rgba(43,87,72,0.4)',
            }}
            onMouseEnter={e => { if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
          >
            {step === 4 ? 'Finish Setup' : 'Next Step'}
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrandSurvey;
