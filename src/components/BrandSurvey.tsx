import React, { useState } from 'react';
import { BrandProfile } from '../types';
import { Store, Users, MessageCircle, PenTool, Check, Sparkles, Lock } from 'lucide-react';
import { INDUSTRY_OPTIONS, isLegacyIndustry } from '../constants/industries';
import { BRAND_VOICES } from '../constants/brandVoices';
import Stepper, { Step } from './ui/Stepper';
import './onboarding.css';

interface Props {
  onComplete: (profile: BrandProfile) => void;
  /** The verified business name from the user record; not editable here. */
  businessName?: string;
}

const BrandSurvey: React.FC<Props> = ({ onComplete, businessName = '' }) => {
  const [profile, setProfile] = useState<BrandProfile>({
    businessName,
    industry: '',
    targetAudience: '',
    brandVoice: 'Friendly & Approachable',
    keyThemes: ''
  });

  const handleChange = (field: keyof BrandProfile, value: string) => {
    setProfile(prev => ({ ...prev, [field]: value }));
  };

  const sectionHead = (Icon: React.ElementType, title: string, sub: string) => (
    <div className="bs-sec-head">
      <div className="bs-sec-head__ico"><Icon /></div>
      <div>
        <h2>{title}</h2>
        <p>{sub}</p>
      </div>
    </div>
  );

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

          <div className="bs-card">
            <Stepper
              onComplete={() => onComplete(profile)}
              /* Business name is read-only, so industry is the only step-1 input to gate on. */
              canAdvance={(i) => i !== 0 || !!profile.industry.trim()}
              nextLabel="Continue"
              finishLabel="Finish setup"
            >
              <Step label="Business">
                {sectionHead(Store, 'Business Basics', 'Tell us about your business')}
                <div className="space-y-5">
                  <div>
                    <label className="bs-label">Business Name</label>
                    {/* Verified identity from sign-up — shown, not edited, so the
                        brand profile can never drift from the approved name. */}
                    <input
                      type="text"
                      className="input"
                      value={profile.businessName}
                      readOnly
                      aria-describedby="bs-bizname-hint"
                    />
                    <p id="bs-bizname-hint" className="bs-hint">
                      <Lock className="w-3 h-3" /> From your verified business registration. Contact support to change it.
                    </p>
                  </div>
                  <div>
                    <label className="bs-label" htmlFor="bs-industry">Industry / Niche</label>
                    <select
                      id="bs-industry"
                      className="input"
                      value={profile.industry}
                      onChange={(e) => handleChange('industry', e.target.value)}
                      autoFocus
                    >
                      <option value="" disabled>Select an industry…</option>
                      {isLegacyIndustry(profile.industry) && (
                        <option value={profile.industry}>{profile.industry}</option>
                      )}
                      {INDUSTRY_OPTIONS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </Step>

              <Step label="Audience">
                {sectionHead(Users, 'Target Audience', 'Who are your ideal customers?')}
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
              </Step>

              <Step label="Voice">
                {sectionHead(MessageCircle, 'Brand Voice', 'How should your brand sound?')}
                <div className="bs-voice">
                  {BRAND_VOICES.map((t) => {
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
              </Step>

              <Step label="Themes">
                {sectionHead(PenTool, 'Content Themes', 'Key topics you want to cover')}
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
              </Step>
            </Stepper>
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
