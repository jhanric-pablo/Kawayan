import React, { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, Check, CheckCircle2, KeyRound, MessageCircle, Palette, PlayCircle, ShieldCheck, Store, X } from 'lucide-react';
import { BrandProfile, User } from '../types';
import { INDUSTRY_OPTIONS, isLegacyIndustry } from '../constants/industries';
import { BRAND_VOICES, isCustomVoice } from '../constants/brandVoices';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { ValidationService } from '../services/validationService';
import PasswordMeter from './auth/PasswordMeter';
import { useToast } from './ui/Toast';
import './settings.css';

interface Props {
  profile?: BrandProfile | null;
  user: User | null;
  onProfileUpdate: (p: BrandProfile) => void;
  onUserUpdate: (u: User) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  /** Re-runs the onboarding walkthrough. Absent for non-'user' roles. */
  onReplayTour?: () => void;
  onClose?: () => void;
}

type Tab = 'business' | 'voice' | 'security' | 'appearance';

const NAV: { group: string; items: { id: Tab; label: string; Icon: React.ElementType; brand?: boolean }[] }[] = [
  {
    group: 'Brand',
    items: [
      { id: 'business', label: 'Business', Icon: Store, brand: true },
      { id: 'voice', label: 'Voice & audience', Icon: MessageCircle, brand: true },
    ],
  },
  {
    group: 'Account',
    items: [
      { id: 'security', label: 'Login & security', Icon: KeyRound },
      { id: 'appearance', label: 'Appearance', Icon: Palette },
    ],
  },
];

const DEFAULT_COLORS = ['#10b981', '#3b82f6', '#f59e0b'];
const COLOR_NAMES = ['Primary', 'Secondary', 'Accent'];

const toForm = (profile: BrandProfile | null | undefined, user: User | null): BrandProfile => ({
  ...(profile || { industry: '', targetAudience: '', brandVoice: '', keyThemes: '' }),
  userId: user?.id || profile?.userId || '',
  // The verified name on the user record always wins over the brand-profile copy.
  businessName: user?.businessName || profile?.businessName || '',
  brandColors: profile?.brandColors?.length ? profile.brandColors : DEFAULT_COLORS,
});

const splitThemes = (s: string) => s.split(',').map((t) => t.trim()).filter(Boolean);

const Settings: React.FC<Props> = ({ profile, user, onProfileUpdate, darkMode, toggleDarkMode, onReplayTour, onClose }) => {
  const toast = useToast();
  const [dbService] = useState(() => new UniversalDatabaseService());
  const isSupport = user?.role === 'support';
  const nav = NAV.map((g) => ({ ...g, items: g.items.filter((i) => !(isSupport && i.brand)) })).filter((g) => g.items.length);
  const [tab, setTab] = useState<Tab>(isSupport ? 'security' : 'business');

  // ── Sliding highlight behind the active nav item (vertical rail on desktop, tab strip on phones) ──
  const navRef = useRef<HTMLElement>(null);
  const [ink, setInk] = useState<React.CSSProperties>({ opacity: 0 });
  useLayoutEffect(() => {
    const navEl = navRef.current;
    if (!navEl) return;
    const place = () => {
      const active = navEl.querySelector<HTMLElement>('[aria-current="page"]');
      if (active) setInk({ top: active.offsetTop, left: active.offsetLeft, width: active.offsetWidth, height: active.offsetHeight });
    };
    place();
    const observer = new ResizeObserver(place);
    observer.observe(navEl);
    return () => observer.disconnect();
  }, [tab]);

  // ── Brand profile (Business + Voice tabs share one draft and one save bar) ──
  const [brand, setBrand] = useState<BrandProfile>(() => toForm(profile, user));
  const [brandDirty, setBrandDirty] = useState(false);
  const [brandSaving, setBrandSaving] = useState(false);
  const [themeDraft, setThemeDraft] = useState('');

  // Pick up a profile that arrives after mount, without clobbering unsaved edits.
  const [syncedProfile, setSyncedProfile] = useState(profile);
  if (profile !== syncedProfile) {
    setSyncedProfile(profile);
    if (!brandDirty) setBrand(toForm(profile, user));
  }

  const setBrandField = (field: keyof BrandProfile, value: any) => {
    setBrand((prev) => ({ ...prev, [field]: value }));
    setBrandDirty(true);
  };

  const setColor = (i: number, value: string) => {
    const colors = [...(brand.brandColors || DEFAULT_COLORS)];
    colors[i] = value;
    setBrandField('brandColors', colors);
  };

  const themes = splitThemes(brand.keyThemes);
  const addTheme = (raw: string) => {
    const t = raw.replace(/,/g, '').trim();
    setThemeDraft('');
    if (t && !themes.some((x) => x.toLowerCase() === t.toLowerCase())) setBrandField('keyThemes', [...themes, t].join(', '));
  };
  const removeTheme = (i: number) => setBrandField('keyThemes', themes.filter((_, j) => j !== i).join(', '));

  const discardBrand = () => {
    setBrand(toForm(profile, user));
    setThemeDraft('');
    setBrandDirty(false);
  };

  const saveBrand = async () => {
    // A theme typed but not yet turned into a tag still counts.
    const draft = themeDraft.replace(/,/g, '').trim();
    const toSave = draft && !themes.some((x) => x.toLowerCase() === draft.toLowerCase())
      ? { ...brand, keyThemes: [...themes, draft].join(', ') }
      : brand;
    setBrandSaving(true);
    try {
      await onProfileUpdate(toSave);
      setBrand(toSave);
      setThemeDraft('');
      setBrandDirty(false);
      toast.success('Brand profile saved');
    } catch {
      toast.error('Could not save your brand profile. Please try again.');
    } finally {
      setBrandSaving(false);
    }
  };

  // ── Password ──
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<string[]>([]);
  const [pwSaving, setPwSaving] = useState(false);

  const updatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    const strength = ValidationService.validatePassword(pw.next);
    if (!strength.isValid) return setPwErrors(strength.errors);
    if (pw.next !== pw.confirm) return setPwErrors(['The new passwords don’t match.']);
    setPwErrors([]);
    setPwSaving(true);
    try {
      // loginUser throws "Invalid credentials" on a wrong password rather than returning null.
      const ok = await dbService.loginUser(user.email, pw.current).catch(() => null);
      if (!ok) {
        setPwErrors(['Your current password is incorrect.']);
        return;
      }
      await dbService.updateUserPassword(user.id, pw.next);
      setPw({ current: '', next: '', confirm: '' });
      toast.success('Password updated');
    } catch (err: any) {
      setPwErrors([err.message || 'Could not update your password.']);
    } finally {
      setPwSaving(false);
    }
  };

  const displayName = user?.businessName || user?.email || 'Your account';
  const voices = isCustomVoice(brand.brandVoice)
    ? [{ label: brand.brandVoice, desc: 'Your current voice' }, ...BRAND_VOICES]
    : BRAND_VOICES;

  const panelHead = (title: string, sub: string) => (
    <div className="st-panel__head">
      <h2>{title}</h2>
      <p>{sub}</p>
    </div>
  );

  return (
    <div className="st animate-fade-in">
      <div className="st-head">
        {onClose && (
          <button onClick={onClose} className="btn btn-ghost btn-sm !p-2" title="Go back" aria-label="Go back">
            <ArrowLeft className="w-5 h-5" />
          </button>
        )}
        <div>
          <h1>Settings</h1>
          <p>Manage your brand, login and preferences.</p>
        </div>
      </div>

      <div className="st-shell surface">
        <aside className="st-rail">
          <div className="st-me">
            <div className="st-me__avatar" aria-hidden>{displayName[0]?.toUpperCase()}</div>
            <div className="min-w-0">
              <div className="st-me__name">{displayName}</div>
              {user?.businessName && <div className="st-me__email">{user.email}</div>}
            </div>
          </div>

          <nav ref={navRef} className="st-nav" aria-label="Settings sections">
            <span className="st-nav__ink" style={ink} aria-hidden />
            {nav.map((g) => (
              <React.Fragment key={g.group}>
                <div className="st-nav__group">{g.group}</div>
                {g.items.map(({ id, label, Icon, brand: isBrand }) => (
                  <button
                    key={id}
                    type="button"
                    className="st-nav__item"
                    aria-current={tab === id ? 'page' : undefined}
                    onClick={() => setTab(id)}
                  >
                    <Icon /> {label}
                    {isBrand && brandDirty && <span className="st-nav__dot" title="Unsaved changes" />}
                  </button>
                ))}
              </React.Fragment>
            ))}
          </nav>
        </aside>

        <div className="st-main">
          {tab === 'business' && (
            <div key="business" className="st-panel">
              {panelHead('Business', 'The details Kawayan uses to introduce your brand.')}
              <div className="st-stack">
                <div>
                  <label className="st-label" htmlFor="st-biz">Business name</label>
                  <div className="st-locked">
                    <input id="st-biz" className="input" value={brand.businessName} readOnly aria-describedby="st-biz-hint" />
                    <span className="st-badge"><ShieldCheck /> Verified</span>
                  </div>
                  <p id="st-biz-hint" className="st-hint">From your approved business documents. Contact support to change it.</p>
                </div>

                <div>
                  <label className="st-label" htmlFor="st-industry">Industry</label>
                  <select id="st-industry" className="input" value={brand.industry} onChange={(e) => setBrandField('industry', e.target.value)}>
                    <option value="" disabled>Select an industry…</option>
                    {isLegacyIndustry(brand.industry) && <option value={brand.industry}>{brand.industry}</option>}
                    {INDUSTRY_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </div>

                <div className="st-row2">
                  <div>
                    <label className="st-label" htmlFor="st-email">Contact email</label>
                    <input id="st-email" type="email" className="input" placeholder="hello@yourshop.ph" value={brand.contactEmail || ''} onChange={(e) => setBrandField('contactEmail', e.target.value)} />
                  </div>
                  <div>
                    <label className="st-label" htmlFor="st-phone">Contact number</label>
                    <input id="st-phone" type="tel" className="input" placeholder="0917 123 4567" value={brand.contactPhone || ''} onChange={(e) => setBrandField('contactPhone', e.target.value)} />
                  </div>
                </div>

                <fieldset>
                  <legend className="st-label">Brand colors</legend>
                  <div className="st-swatches">
                    {COLOR_NAMES.map((name, i) => {
                      const color = brand.brandColors?.[i] || DEFAULT_COLORS[i];
                      return (
                        <label key={name} className="st-swatch">
                          <input type="color" value={color} onChange={(e) => setColor(i, e.target.value)} aria-label={`${name} brand color`} />
                          <span className="st-swatch__chip" style={{ background: color }} />
                          <span>
                            <span className="st-swatch__name">{name}</span>
                            <span className="st-swatch__hex">{color}</span>
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </fieldset>
              </div>
            </div>
          )}

          {tab === 'voice' && (
            <div key="voice" className="st-panel">
              {panelHead('Voice & audience', 'How your captions sound and who they speak to.')}
              <div className="st-stack">
                <div>
                  <span className="st-label" id="st-voice-label">Brand voice</span>
                  <div className="st-voices" role="radiogroup" aria-labelledby="st-voice-label">
                    {voices.map((v) => {
                      const active = brand.brandVoice === v.label;
                      return (
                        <button
                          key={v.label}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className="st-voice"
                          onClick={() => setBrandField('brandVoice', v.label)}
                        >
                          <div className="st-voice__t">{v.label}</div>
                          <div className="st-voice__d">{v.desc}</div>
                          <span className="st-voice__check">{active && <Check />}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="st-label" htmlFor="st-audience">Target audience</label>
                  <input id="st-audience" className="input" placeholder="e.g. Working moms in Quezon City" value={brand.targetAudience} onChange={(e) => setBrandField('targetAudience', e.target.value)} />
                </div>

                <div>
                  <label className="st-label" htmlFor="st-themes">Content themes</label>
                  <div className="st-tags" onClick={() => document.getElementById('st-themes')?.focus()}>
                    {themes.map((t, i) => (
                      <span key={t} className="st-tag">
                        {t}
                        <button type="button" aria-label={`Remove ${t}`} onClick={(e) => { e.stopPropagation(); removeTheme(i); }}>
                          <X />
                        </button>
                      </span>
                    ))}
                    <input
                      id="st-themes"
                      value={themeDraft}
                      placeholder={themes.length ? 'Add another…' : 'e.g. Promos, Behind the scenes'}
                      onChange={(e) => {
                        if (e.target.value.includes(',')) addTheme(e.target.value);
                        else setThemeDraft(e.target.value);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); addTheme(themeDraft); }
                        else if (e.key === 'Backspace' && !themeDraft && themes.length) removeTheme(themes.length - 1);
                      }}
                      onBlur={() => themeDraft && addTheme(themeDraft)}
                    />
                  </div>
                  <p className="st-hint">Press Enter or a comma after each topic.</p>
                </div>
              </div>
            </div>
          )}

          {tab === 'security' && (
            <form key="security" className="st-panel" onSubmit={updatePassword}>
              {panelHead('Login & security', 'Your sign-in email and password.')}
              <div className="st-stack">
                <div>
                  <label className="st-label" htmlFor="st-login">Email</label>
                  <div className="st-locked">
                    <input id="st-login" className="input" value={user?.email || ''} readOnly aria-describedby="st-login-hint" />
                  </div>
                  <p id="st-login-hint" className="st-hint">You sign in with this email. It can't be changed.</p>
                </div>

                <div>
                  <label className="st-label" htmlFor="st-pw-current">Current password</label>
                  <input id="st-pw-current" type="password" autoComplete="current-password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} />
                </div>
                <div className="st-row2">
                  <div>
                    <label className="st-label" htmlFor="st-pw-new">New password</label>
                    <input id="st-pw-new" type="password" autoComplete="new-password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                    <div className="mt-2"><PasswordMeter password={pw.next} /></div>
                  </div>
                  <div>
                    <label className="st-label" htmlFor="st-pw-confirm">Confirm new password</label>
                    <input id="st-pw-confirm" type="password" autoComplete="new-password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                  </div>
                </div>

                {pwErrors.length > 0 && (
                  <ul className="st-errors" role="alert">
                    {pwErrors.map((err) => <li key={err}>{err}</li>)}
                  </ul>
                )}

                <div>
                  <button type="submit" disabled={pwSaving || !pw.current || !pw.next || !pw.confirm} className="btn btn-primary">
                    {pwSaving ? 'Updating…' : 'Update password'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {tab === 'appearance' && (
            <div key="appearance" className="st-panel">
              {panelHead('Appearance', 'How Kawayan looks on this device.')}
              <div className="st-stack">
                <div>
                  <span className="st-label" id="st-theme-label">Theme</span>
                  <div className="st-themes" role="radiogroup" aria-labelledby="st-theme-label">
                    {[{ dark: false, label: 'Light' }, { dark: true, label: 'Dark' }].map(({ dark, label }) => {
                      const active = darkMode === dark;
                      return (
                        <button
                          key={label}
                          type="button"
                          role="radio"
                          aria-checked={active}
                          className="st-theme"
                          onClick={() => !active && toggleDarkMode()}
                        >
                          <div className={`st-theme__art st-theme__art--${dark ? 'dark' : 'light'}`} aria-hidden>
                            <div className="st-theme__side">
                              <i className="is-accent" style={{ height: 6, width: '70%' }} />
                              <i style={{ height: 5 }} />
                              <i style={{ height: 5, width: '80%' }} />
                              <i style={{ height: 5, width: '60%' }} />
                            </div>
                            <div className="st-theme__body">
                              <i style={{ height: 7, width: '45%' }} />
                              <i style={{ height: 5 }} />
                              <i style={{ height: 5, width: '85%' }} />
                              <i className="is-accent" style={{ height: 12, width: '35%', marginTop: 'auto', borderRadius: 4 }} />
                            </div>
                          </div>
                          <div className="st-theme__foot">
                            {label}
                            {active && <CheckCircle2 />}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {onReplayTour && (
                  <div className="st-row">
                    <div>
                      <div className="st-row__t">Product walkthrough</div>
                      <div className="st-row__d">A quick tour of the calendar, insights, social accounts and billing.</div>
                    </div>
                    <button type="button" onClick={onReplayTour} className="btn btn-outline btn-sm">
                      <PlayCircle className="w-3.5 h-3.5" /> Replay tour
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}

          {brandDirty && (
            <div className="st-savebar" role="status">
              <span className="st-savebar__msg">Unsaved changes</span>
              <button type="button" className="btn btn-ghost btn-sm st-savebar__discard" onClick={discardBrand} disabled={brandSaving}>
                Discard
              </button>
              <button type="button" className="btn btn-primary btn-sm" onClick={saveBrand} disabled={brandSaving}>
                {brandSaving ? 'Saving…' : 'Save changes'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
