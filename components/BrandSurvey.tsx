import React, { useState } from 'react';
import { BrandProfile } from '../types';
import { ArrowRight, ArrowLeft, Store, Users, MessageCircle, PenTool, Check, Sparkles } from 'lucide-react';
import './onboarding.css';

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

  const sections = [
    { icon: Store, title: 'Business Basics', sub: 'Tell us about your business' },
    { icon: Users, title: 'Target Audience', sub: 'Who are your ideal customers?' },
    { icon: MessageCircle, title: 'Brand Voice', sub: 'How should your brand sound?' },
    { icon: PenTool, title: 'Content Themes', sub: 'Key topics you want to cover' },
  ];
  const SectionIcon = sections[step - 1].icon;

  const industrySuggestions = ['Food & Beverage', 'Fashion & Apparel', 'Beauty & Wellness', 'Hardware & Home', 'Services'];
  const audienceSuggestions = ['Gen Z students', 'Working moms', 'Titas of Manila', 'Small business owners', 'OFW families'];
  const themeSuggestions = ['Product launches', 'Behind the scenes', 'Customer testimonials', 'Promos & sales', 'Tips & how-tos', 'Memes'];

  const appendTag = (field: keyof BrandProfile, tag: string) => {
    setProfile(prev => {
      const current = (prev[field] || '').trim();
      if (current.toLowerCase().includes(tag.toLowerCase())) return prev;
      return { ...prev, [field]: current ? `${current}, ${tag}` : tag };
    });
  };

  // ── live preview copy keyed to the chosen brand voice ──
  const previewPost = (() => {
    const name = profile.businessName.trim() || 'your brand';
    switch (profile.brandVoice) {
      case 'Professional & Trustworthy':
        return `Introducing the latest from ${name}. Crafted with care, built to deliver. Learn more today.`;
      case 'Makulit & Fun (Kwelang Pinoy)':
        return `GRABE guys, may bago na naman kami sa ${name}! 🤯 Type mo? Comment ng "AKO NA" 👇`;
      case 'Inspirational (Hugot)':
        return `Sa bawat simula, may kwento. ${name} is here for yours. Keep going. ✨`;
      case 'Premium & Minimalist':
        return `${name}. Less, but better.`;
      case 'Friendly Tita':
        return `Anak, tara na! Bagong labas sa ${name} — subukan mo, promise sulit. 💚`;
      default:
        return `Hi there! Something new just dropped at ${name} — come check it out. 😊`;
    }
  })();

  const themeTags = profile.keyThemes.split(',').map(t => t.trim()).filter(Boolean).slice(0, 4);

  return (
    <div className="ob-screen">
      <div className="ob-orb ob-orb--1" />
      <div className="ob-orb ob-orb--2" />

      <div className="ob-inner bs-wrap">
        {/* ─────────── main column ─────────── */}
        <div>
          <div className="bs-head">
            <span className="bs-eyebrow"><Sparkles /> Brand DNA Setup</span>
            <h1>Let&apos;s set up your brand</h1>
            <p>This helps Kawayan AI create content that truly sounds like you.</p>
          </div>

          {/* stepper */}
          <div className="bs-steps">
            {steps.map((s) => {
              const Icon = s.icon;
              const done = s.num < step;
              const active = s.num === step;
              return (
                <div key={s.num} className={`bs-step${active ? ' is-active' : done ? ' is-done' : ''}`}>
                  {done ? <Check /> : <Icon />}
                  <span className="bs-step__label">{s.label}</span>
                </div>
              );
            })}
          </div>

          {/* progress */}
          <div className="bs-progress">
            <b style={{ width: `${(step / 4) * 100}%` }} />
          </div>

          {/* card */}
          <div className="bs-card">
            <div className="bs-slide" key={step}>
              <div className="bs-sec-head">
                <div className="bs-sec-head__ico"><SectionIcon /></div>
                <div>
                  <h2>{sections[step - 1].title}</h2>
                  <p>{sections[step - 1].sub}</p>
                </div>
              </div>

              {step === 1 && (
                <div className="space-y-5">
                  <div>
                    <label className="bs-label">Business Name</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Aling Nena's Pastries"
                      value={profile.businessName}
                      onChange={(e) => handleChange('businessName', e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div>
                    <label className="bs-label">Industry / Niche</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g., Food & Beverage, Fashion, Hardware"
                      value={profile.industry}
                      onChange={(e) => handleChange('industry', e.target.value)}
                    />
                    <div className="bs-chips">
                      {industrySuggestions.map((s) => (
                        <button
                          type="button"
                          key={s}
                          className={`bs-chip${profile.industry.trim().toLowerCase() === s.toLowerCase() ? ' is-active' : ''}`}
                          onClick={() => handleChange('industry', s)}
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {step === 2 && (
                <div>
                  <label className="bs-label">Describe your audience</label>
                  <textarea
                    className="input h-40 resize-none"
                    placeholder="e.g., Gen Z students in Manila, working moms looking for quick meals, titas of Manila..."
                    value={profile.targetAudience}
                    onChange={(e) => handleChange('targetAudience', e.target.value)}
                    autoFocus
                  />
                  <div className="bs-chips">
                    {audienceSuggestions.map((s) => (
                      <button type="button" key={s} className="bs-chip" onClick={() => appendTag('targetAudience', s)}>
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {step === 3 && (
                <div className="bs-voice">
                  {tones.map((t) => {
                    const active = profile.brandVoice === t.label;
                    return (
                      <button
                        key={t.label}
                        type="button"
                        onClick={() => handleChange('brandVoice', t.label)}
                        className={`bs-voice__opt${active ? ' is-active' : ''}`}
                      >
                        <div className="bs-voice__t">{t.label}</div>
                        <div className="bs-voice__d">{t.desc}</div>
                        {active && <span className="bs-voice__check"><Check /></span>}
                      </button>
                    );
                  })}
                </div>
              )}

              {step === 4 && (
                <div>
                  <label className="bs-label">Key content themes</label>
                  <textarea
                    className="input h-40 resize-none"
                    placeholder="e.g., Product launches, behind the scenes, customer testimonials, funny memes..."
                    value={profile.keyThemes}
                    onChange={(e) => handleChange('keyThemes', e.target.value)}
                    autoFocus
                  />
                  <div className="bs-chips">
                    {themeSuggestions.map((s) => (
                      <button type="button" key={s} className="bs-chip" onClick={() => appendTag('keyThemes', s)}>
                        + {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* navigation */}
            <div className="bs-nav">
              <button
                type="button"
                onClick={() => step > 1 && setStep(step - 1)}
                className={`btn btn-outline ${step === 1 ? 'opacity-0 pointer-events-none' : ''}`}
              >
                <ArrowLeft className="w-4 h-4" /> Back
              </button>

              <div className="bs-dots">
                {[1, 2, 3, 4].map((n) => (
                  <i key={n} className={`${n <= step ? 'is-on' : ''} ${n === step ? 'is-cur' : ''}`} />
                ))}
              </div>

              <button
                type="button"
                onClick={handleNext}
                disabled={step === 1 && !profile.businessName.trim()}
                className="btn btn-primary"
              >
                {step === 4 ? 'Finish Setup' : 'Next Step'}
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* ─────────── live preview ─────────── */}
        <aside className="bs-preview">
          <div className="bs-preview__label"><b /> Live preview</div>
          <div className="bs-preview__card">
            <div className="bs-preview__top">
              <div className="bs-preview__logo">
                {(profile.businessName.trim()[0] || 'K').toUpperCase()}
              </div>
              <div>
                <div className="bs-preview__name">{profile.businessName.trim() || 'Your Business'}</div>
                <div className="bs-preview__ind">{profile.industry.trim() || 'Your industry'}</div>
              </div>
            </div>

            <div className="bs-preview__row">
              <span className="bs-preview__tag">{profile.brandVoice}</span>
              {themeTags.map((t) => (
                <span key={t} className="bs-preview__tag">{t}</span>
              ))}
            </div>

            <div className="bs-preview__post">
              <div className="bs-preview__post-k">Sample caption</div>
              <div className="bs-preview__post-t">{previewPost}</div>
            </div>

            <div className="bs-preview__foot">
              {profile.targetAudience.trim()
                ? `Speaking to: ${profile.targetAudience.trim().slice(0, 70)}${profile.targetAudience.trim().length > 70 ? '…' : ''}`
                : 'Add your audience to sharpen the tone'}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};

export default BrandSurvey;
