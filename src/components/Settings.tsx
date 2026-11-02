import React, { useEffect, useState } from 'react';
import { RadioGroup } from '@base-ui/react/radio-group';
import { Radio } from '@base-ui/react/radio';
import { AlertTriangle, CreditCard, Download, Eye, Link2, Lock, MapPin, MessageSquare, Moon, PlayCircle, ShieldCheck, Trash2, X } from 'lucide-react';
import clsx from 'clsx';
import { BrandProfile, User } from '../types';
import { BRAND_VOICES, isCustomVoice } from '../constants/brandVoices';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { ValidationService } from '../services/validationService';
import PasswordMeter from './auth/PasswordMeter';
import { useToast } from './ui/Toast';
import { AccessibilityOptions } from './AccessibilityWidget';
import SettingsAppearance from './SettingsAppearance';
import { LockedValue, SettingRow, SettingsSection } from './settings/SettingsParts';
import VoicePreview from './settings/VoicePreview';
import SocialAccounts from './SocialAccounts';
import { socialService } from '../services/socialService';
import { paymentService, Wallet } from '../services/paymentService';
import { supportService } from '../services/supportService';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from './ui/dialog';
import type { ThemePref } from '../utils/sessionView';
import IndustryPicker from './forms/IndustryPicker';

interface Props {
  profile?: BrandProfile | null;
  user: User | null;
  onProfileUpdate: (p: BrandProfile) => void;
  onUserUpdate: (u: User) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  /** Re-runs the onboarding walkthrough. Absent for non-'user' roles. */
  onReplayTour?: () => void;
  /** Light / Dark / System. When given, Appearance offers System too. */
  themePref?: ThemePref;
  onChooseTheme?: (pref: ThemePref) => void;
  /** Payments & plans → the Plan and billing page. */
  onOpenBilling?: () => void;
  /** Called after the owner deletes their account (signs out). */
  onAccountDeleted?: () => void;
  /** Section to open on arrival, e.g. 'channels'. */
  initialSection?: string;
}

const SECTIONS = [
  { id: 'business', label: 'Business', brand: true, icon: MapPin },
  { id: 'voice', label: 'Voice & audience', brand: true, icon: MessageSquare },
  { id: 'channels', label: 'Channels', brand: true, icon: Link2 },
  { id: 'appearance', label: 'Appearance', brand: false, icon: Moon },
  { id: 'security', label: 'Login & security', brand: false, icon: Lock },
  { id: 'payments', label: 'Payments & plans', brand: true, icon: CreditCard },
  { id: 'accessibility', label: 'Accessibility', brand: false, icon: Eye },
];
/** Sections that share the brand draft (an unsaved dot shows on them). */
const BRAND_DRAFT = new Set(['business', 'voice']);
const anchor = (id: string) => `settings-${id}`;

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
const smooth = () => (window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

/** Settings as one scrolling page of sections, with a section index that follows along. */
const Settings: React.FC<Props> = ({ profile, user, onProfileUpdate, darkMode, toggleDarkMode, onReplayTour, themePref, onChooseTheme, onOpenBilling, onAccountDeleted, initialSection }) => {
  const toast = useToast();
  const [dbService] = useState(() => new UniversalDatabaseService());
  const isSupport = user?.role === 'support';
  const sections = SECTIONS.filter((s) => !(isSupport && s.brand));

  // ── Section index: highlights the section in view; clicking scrolls to it ──
  const [active, setActive] = useState(sections.some((x) => x.id === initialSection) ? initialSection! : sections[0].id);
  useEffect(() => {
    if (!initialSection || !sections.some((x) => x.id === initialSection)) return;
    const t = window.setTimeout(() => document.getElementById(anchor(initialSection))?.scrollIntoView({ block: 'start' }), 60);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialSection]);

  // ── Channel problems (for the menu badge) and the wallet (Payments & plans) ──
  const [expiredCount, setExpiredCount] = useState(0);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  useEffect(() => {
    if (isSupport) return;
    let live = true;
    socialService.listAccounts().then((a) => live && setExpiredCount(a.filter((x) => !x.isActive).length)).catch(() => undefined);
    paymentService.getWalletData().then((w) => live && setWallet(w)).catch(() => undefined);
    return () => { live = false; };
  }, [isSupport]);

  // ── Your data: export everything as JSON; delete the account ──
  const [exporting, setExporting] = useState(false);
  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [posts, walletData, tickets] = await Promise.all([
        dbService.getUserPosts(user.id).catch(() => []),
        paymentService.getWalletData().catch(() => null),
        supportService.getAllTickets().catch(() => []),
      ]);
      const account: Record<string, unknown> = { ...user };
      delete account.password;
      const data = {
        exportedAt: new Date().toISOString(),
        account,
        brandProfile: profile ?? null,
        posts,
        wallet: walletData ? { balance: walletData.balance, currency: walletData.currency, subscription: walletData.subscription, transactions: walletData.transactions } : null,
        supportTickets: tickets,
      };
      const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `kawayan-my-data-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Your data is downloading');
    } catch {
      toast.error('Could not export your data. Please try again.');
    } finally {
      setExporting(false);
    }
  };
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteEmail, setDeleteEmail] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const deleteAccount = async () => {
    setDeleting(true);
    setDeleteError('');
    try {
      await dbService.deleteOwnAccount(deleteEmail.trim().toLowerCase());
      setDeleteOpen(false);
      toast.success('Your account was deleted');
      onAccountDeleted?.();
    } catch (e: any) {
      setDeleteError(e.message || 'Could not delete your account.');
    } finally {
      setDeleting(false);
    }
  };
  useEffect(() => {
    const els = sections.map((s) => document.getElementById(anchor(s.id))).filter((el): el is HTMLElement => !!el);
    const io = new IntersectionObserver(
      (entries) => {
        const hit = entries.find((e) => e.isIntersecting);
        if (hit) setActive(hit.target.id.replace('settings-', ''));
      },
      { rootMargin: '-25% 0px -65% 0px' },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSupport]);
  const go = (id: string) => {
    setActive(id);
    document.getElementById(anchor(id))?.scrollIntoView({ behavior: smooth(), block: 'start' });
  };

  // ── Brand profile (Business + Voice share one draft and one save bar) ──
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

  // ── Password (hidden behind "Change password" until needed) ──
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState({ current: '', next: '', confirm: '' });
  const [pwErrors, setPwErrors] = useState<string[]>([]);
  const [pwSaving, setPwSaving] = useState(false);

  const closePassword = () => {
    setPwOpen(false);
    setPw({ current: '', next: '', confirm: '' });
    setPwErrors([]);
  };

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
      closePassword();
      toast.success('Password updated');
    } catch (err: any) {
      setPwErrors([err.message || 'Could not update your password.']);
    } finally {
      setPwSaving(false);
    }
  };

  const voices = isCustomVoice(brand.brandVoice)
    ? [{ label: brand.brandVoice, desc: 'Your current voice' }, ...BRAND_VOICES]
    : BRAND_VOICES;

  return (
    <div className="max-w-4xl pb-28 animate-fade-in">
      <div className="page-head">
        <div>
          <h1 className="page-head__title">Settings</h1>
          <p className="page-head__sub">{isSupport ? 'Your sign-in and how Kawayan looks.' : 'Your business, voice, channels and account.'}</p>
        </div>
      </div>

      <div className="lg:grid lg:grid-cols-[200px_minmax(0,1fr)] lg:items-start lg:gap-7">
      {/* Section switcher: a tab row on small screens, a side menu on wide ones; follows the scroll */}
      <nav aria-label="Settings sections" className="sticky top-14 z-30 mb-6 overflow-x-auto border-b border-(--border) bg-(--bg) scrollbar-hide lg:top-[72px] lg:mb-0 lg:overflow-visible lg:border-0 lg:bg-transparent">
        <div className="flex gap-5 lg:flex-col lg:gap-px">
          {sections.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => go(s.id)}
              aria-current={active === s.id ? 'true' : undefined}
              className={clsx(
                '-mb-px flex min-h-11 items-center gap-1.5 whitespace-nowrap border-b-2 py-3 text-sm font-medium transition-colors',
                'lg:mb-0 lg:min-h-9 lg:rounded-lg lg:border lg:px-2.5 lg:py-0 lg:text-left',
                active === s.id
                  ? 'border-(--fg) text-(--fg) lg:border-(--border) lg:bg-(--card) lg:shadow-xs'
                  : 'border-transparent text-(--fg-muted) hover:text-(--fg) lg:text-(--fg) lg:hover:bg-[color-mix(in_srgb,var(--fg)_5%,transparent)]',
              )}
            >
              <s.icon className="hidden h-4 w-4 shrink-0 text-(--fg-muted) lg:block" aria-hidden />
              {s.label}
              {BRAND_DRAFT.has(s.id) && brandDirty && <span className="h-1.5 w-1.5 rounded-full bg-(--amber)" aria-label="Unsaved changes" />}
              {s.id === 'channels' && expiredCount > 0 && <span className="badge badge-red ml-auto px-1.5! py-0! text-[11px]" aria-label={`${expiredCount} channel problem${expiredCount > 1 ? 's' : ''}`}>{expiredCount}</span>}
            </button>
          ))}
        </div>
      </nav>

      <div>
        <div className="space-y-6">
          {!isSupport && (
            <SettingsSection id={anchor('business')} title="Business" description="The details Kawayan uses to introduce your brand.">
              <SettingRow label="Business name" hint="From your approved business documents. Contact support to change it.">
                <LockedValue
                  id="st-biz"
                  value={brand.businessName}
                  badge={<span className="badge badge-green shrink-0"><ShieldCheck className="h-3.5 w-3.5" aria-hidden /> Verified</span>}
                />
              </SettingRow>

              {user?.verificationStatus && user.verificationStatus !== 'none' && (
                <SettingRow label="Verification" hint="Approved permits unlock the full app.">
                  {user.verificationStatus === 'verified' ? (
                    <span className="badge badge-green"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Approved</span>
                  ) : user.verificationStatus === 'pending' ? (
                    <span className="badge badge-amber"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Waiting for review</span>
                  ) : (
                    <span className="badge badge-red"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Sent back</span>
                  )}
                </SettingRow>
              )}

              <SettingRow label="Industry" htmlFor="st-industry" hint="Shapes the topics and examples in your captions.">
                <IndustryPicker id="st-industry" value={brand.industry} onChange={(v) => setBrandField('industry', v)} />
              </SettingRow>

              {'city' in brand && (
                <SettingRow label="Where are you?" htmlFor="st-city" hint="Your city or area. Captions can mention nearby places and local events.">
                  <input id="st-city" className="input" placeholder="e.g. Parañaque City" value={brand.city || ''} onChange={(e) => setBrandField('city', e.target.value)} maxLength={120} />
                </SettingRow>
              )}

              <SettingRow label="Contact details" hint="Saved on your brand profile, so they’re in one place.">
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <label htmlFor="st-email" className="mb-1 block text-xs font-medium text-(--fg-muted)">Email</label>
                    <input id="st-email" type="email" className="input" placeholder="hello@yourshop.ph" value={brand.contactEmail || ''} onChange={(e) => setBrandField('contactEmail', e.target.value)} />
                  </div>
                  <div>
                    <label htmlFor="st-phone" className="mb-1 block text-xs font-medium text-(--fg-muted)">Mobile number</label>
                    <input id="st-phone" type="tel" className="input" placeholder="0917 123 4567" value={brand.contactPhone || ''} onChange={(e) => setBrandField('contactPhone', e.target.value)} />
                  </div>
                </div>
              </SettingRow>

              <SettingRow label="Brand colours" labelId="st-colors" hint="Your shop’s colours, saved with your brand profile.">
                <div className="flex flex-wrap gap-2" role="group" aria-labelledby="st-colors">
                  {COLOR_NAMES.map((name, i) => {
                    const color = brand.brandColors?.[i] || DEFAULT_COLORS[i];
                    return (
                      <label key={name} className="flex cursor-pointer items-center gap-2.5 rounded-lg border border-(--border) bg-(--card) py-1.5 pl-1.5 pr-3.5 shadow-xs hover:bg-(--muted) focus-within:ring-2 focus-within:ring-(--ring)">
                        <span className="relative h-8 w-8 overflow-hidden rounded-lg border border-(--border)" style={{ background: color }}>
                          <input type="color" value={color} onChange={(e) => setColor(i, e.target.value)} aria-label={`${name} brand colour`} className="absolute inset-0 cursor-pointer opacity-0" />
                        </span>
                        <span className="leading-tight">
                          <span className="block text-ui font-medium text-(--fg)">{name}</span>
                          <span className="mono block text-xs uppercase text-(--fg-muted)">{color}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </SettingRow>
            </SettingsSection>
          )}

          {!isSupport && (
            <SettingsSection id={anchor('voice')} title="Voice & audience" description="How your captions sound and who they speak to.">
              <SettingRow label="Brand voice" labelId="st-voice-label" hint="Pick one and the sample caption rewrites itself in that voice." wide>
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                  <RadioGroup
                    value={brand.brandVoice}
                    onValueChange={(v) => setBrandField('brandVoice', v as string)}
                    aria-labelledby="st-voice-label"
                    className="grid gap-2"
                  >
                    {voices.map((v) => (
                      <Radio.Root
                        key={v.label}
                        value={v.label}
                        className="group flex items-start gap-3 rounded-(--radius-md) border border-(--border-strong) bg-(--card) p-3 text-left outline-hidden hover:border-(--fg-subtle) focus-visible:ring-2 focus-visible:ring-(--ring) data-checked:border-(--primary) data-checked:bg-[color-mix(in_srgb,var(--primary)_6%,var(--card))]"
                      >
                        <span className="mt-0.5 grid h-4 w-4 shrink-0 place-items-center rounded-full border-2 border-(--border-strong) group-data-checked:border-(--primary)">
                          <span className="h-2 w-2 scale-0 rounded-full bg-(--primary) transition-transform group-data-checked:scale-100" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold text-(--fg)">{v.label}</span>
                          <span className="block text-ui text-(--fg-muted)">{v.desc}</span>
                        </span>
                      </Radio.Root>
                    ))}
                  </RadioGroup>
                  <div className="lg:self-start">
                    <VoicePreview voice={brand.brandVoice} businessName={brand.businessName} audience={brand.targetAudience} />
                  </div>
                </div>
              </SettingRow>

              {'language' in brand && (
                <SettingRow label="Language" labelId="st-lang-label" hint="Captions use this by default.">
                  <div className="kw-segpick kw-segpick--text max-w-sm" role="radiogroup" aria-labelledby="st-lang-label">
                    {(['Taglish', 'English', 'Filipino'] as const).map((l) => {
                      const on = (brand.language || 'Taglish') === l;
                      return (
                        <button key={l} type="button" role="radio" aria-checked={on} onClick={() => setBrandField('language', l)}>{l}</button>
                      );
                    })}
                  </div>
                </SettingRow>
              )}

              <SettingRow label="Target audience" htmlFor="st-audience" hint="Who your posts speak to. Be specific: place, age, what they care about.">
                <input id="st-audience" className="input" placeholder="e.g. Working moms in Quezon City" value={brand.targetAudience} onChange={(e) => setBrandField('targetAudience', e.target.value)} />
              </SettingRow>

              <SettingRow label="Content themes" htmlFor="st-themes" hint="Topics Kawayan rotates through. Press Enter or a comma after each one.">
                <div
                  className="flex min-h-11 flex-wrap items-center gap-1.5 rounded-(--radius-md) border border-(--border-strong) bg-(--card) px-2 py-1.5 focus-within:border-(--primary) focus-within:ring-3 focus-within:ring-(--ring)"
                  onClick={() => document.getElementById('st-themes')?.focus()}
                >
                  {themes.map((t, i) => (
                    <span key={t} className="inline-flex items-center gap-1 rounded-full bg-badge py-1 pl-2.5 pr-1 text-ui font-semibold text-badge-text">
                      {t}
                      <button type="button" aria-label={`Remove ${t}`} onClick={(e) => { e.stopPropagation(); removeTheme(i); }} className="grid h-5 w-5 place-items-center rounded-full hover:bg-black/10">
                        <X className="h-3 w-3" aria-hidden />
                      </button>
                    </span>
                  ))}
                  <input
                    id="st-themes"
                    value={themeDraft}
                    placeholder={themes.length ? 'Add another…' : 'e.g. Promos, Behind the scenes'}
                    className="min-w-32 flex-1 bg-transparent px-1 py-1 text-sm outline-hidden focus:shadow-none!"
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
              </SettingRow>
            </SettingsSection>
          )}

          {!isSupport && (
            <SettingsSection id={anchor('channels')} title="Channels" description="The pages Kawayan posts to, through Zernio.">
              <div className="p-4 sm:p-5">
                <SocialAccounts embedded />
              </div>
            </SettingsSection>
          )}

          <SettingsSection id={anchor('appearance')} title="Appearance" description="How Kawayan looks on this device.">
            <SettingRow label="Theme" labelId="st-theme-label" hint="Light and Dark are saved to your account, so they follow you. System follows this device." wide>
              <SettingsAppearance darkMode={darkMode} toggleDarkMode={toggleDarkMode} labelId="st-theme-label" themePref={themePref} onChooseTheme={onChooseTheme} />
            </SettingRow>
            {onReplayTour && (
              <SettingRow label="Product walkthrough" hint="About two minutes: your calendar, planning and writing posts, and your account pages.">
                <button type="button" onClick={onReplayTour} className="btn btn-outline">
                  <PlayCircle className="h-4 w-4" aria-hidden /> Replay tour
                </button>
              </SettingRow>
            )}
          </SettingsSection>

          <SettingsSection id={anchor('security')} title="Login & security" description="How you sign in to Kawayan.">
            <SettingRow label="Email" hint="You sign in with this email. It can’t be changed.">
              <LockedValue id="st-login" value={user?.email || ''} />
            </SettingRow>

            <SettingRow label="Password" hint={pwOpen ? 'At least 8 characters, with upper and lower case letters, a number and a symbol.' : 'Change it any time. You’ll stay signed in on this device.'}>
              {!pwOpen ? (
                <button type="button" onClick={() => setPwOpen(true)} className="btn btn-outline">Change password</button>
              ) : (
                <form onSubmit={updatePassword} className="grid gap-3 animate-fade-in">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--fg-muted)" htmlFor="st-pw-current">Current password</label>
                    <input id="st-pw-current" type="password" autoComplete="current-password" className="input" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} autoFocus />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--fg-muted)" htmlFor="st-pw-new">New password</label>
                    <input id="st-pw-new" type="password" autoComplete="new-password" className="input" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} />
                    <div className="mt-2"><PasswordMeter password={pw.next} /></div>
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-medium text-(--fg-muted)" htmlFor="st-pw-confirm">Confirm new password</label>
                    <input id="st-pw-confirm" type="password" autoComplete="new-password" className="input" value={pw.confirm} onChange={(e) => setPw({ ...pw, confirm: e.target.value })} />
                  </div>
                  {pwErrors.length > 0 && (
                    <ul className="space-y-0.5 rounded-(--radius-md) bg-[color-mix(in_srgb,var(--danger)_8%,transparent)] px-3 py-2 text-ui text-(--danger)" role="alert">
                      {pwErrors.map((err) => <li key={err}>{err}</li>)}
                    </ul>
                  )}
                  <div className="flex flex-wrap gap-2">
                    <button type="submit" disabled={pwSaving || !pw.current || !pw.next || !pw.confirm} className="btn btn-primary">
                      {pwSaving ? 'Updating…' : 'Update password'}
                    </button>
                    <button type="button" onClick={closePassword} className="btn btn-ghost">Cancel</button>
                  </div>
                </form>
              )}
            </SettingRow>
            {user?.role === 'user' && (
              <SettingRow label="Your data" hint="Download everything Kawayan keeps about you, or delete your account (Data Privacy Act, RA 10173).">
                <div className="flex flex-wrap gap-2">
                  <button type="button" className="btn btn-outline btn-sm" onClick={exportData} disabled={exporting}>
                    <Download className="h-3.5 w-3.5" aria-hidden /> {exporting ? 'Preparing…' : 'Export my data'}
                  </button>
                  <button type="button" className="btn btn-outline btn-sm text-(--danger)" onClick={() => { setDeleteEmail(''); setDeleteError(''); setDeleteOpen(true); }}>
                    <Trash2 className="h-3.5 w-3.5" aria-hidden /> Delete account
                  </button>
                </div>
              </SettingRow>
            )}
          </SettingsSection>

          {!isSupport && (
            <SettingsSection id={anchor('payments')} title="Payments & plans" description="Your plan and wallet. Payments and receipts are on Plan and billing.">
              <SettingRow label="Plan" hint="Change plans or buy extra posts on Plan and billing.">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="badge badge-green">{wallet ? (wallet.subscription === 'PRO' ? 'Pro' : wallet.subscription === 'ENTERPRISE' ? 'Enterprise' : 'Free Trial') : '—'}</span>
                  {onOpenBilling && <button type="button" className="btn btn-outline btn-sm" onClick={onOpenBilling}>Open Plan and billing</button>}
                </div>
              </SettingRow>
              <SettingRow label="Wallet balance" hint="For extra posts beyond your plan.">
                <p className="mono text-lg font-semibold">{wallet ? `₱${wallet.balance.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'}</p>
              </SettingRow>
            </SettingsSection>
          )}

          <SettingsSection id={anchor('accessibility')} title="Accessibility" description="Text size, contrast and motion. Saved in this browser.">
            <div className="p-3 sm:p-4"><AccessibilityOptions /></div>
          </SettingsSection>

        </div>
      </div>
      </div>

      <Dialog open={deleteOpen} onOpenChange={(o) => !deleting && setDeleteOpen(o)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><AlertTriangle className="h-4 w-4 text-(--danger)" aria-hidden /> Delete your account?</DialogTitle>
            <DialogDescription>
              This removes your account, brand profile, posts, wallet history and tickets for good. Posts already on Facebook or Instagram stay there. Export your data first if you want a copy.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-1.5">
            <label htmlFor="st-del-email" className="text-ui font-medium">Type your email to confirm</label>
            <input id="st-del-email" className="input" type="email" autoComplete="off" placeholder={user?.email} value={deleteEmail} onChange={(e) => setDeleteEmail(e.target.value)} />
            {deleteError && <p className="text-ui text-(--danger)" role="alert">{deleteError}</p>}
          </div>
          <DialogFooter>
            <button type="button" className="btn btn-ghost" onClick={() => setDeleteOpen(false)} disabled={deleting}>Keep my account</button>
            <button
              type="button"
              className="btn btn-primary bg-(--danger)! border-(--danger)!"
              onClick={deleteAccount}
              disabled={deleting || deleteEmail.trim().toLowerCase() !== (user?.email ?? '').toLowerCase()}
            >
              {deleting ? 'Deleting…' : 'Delete account'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Floating save bar, only while brand details have unsaved edits */}
      {brandDirty && (
        <div
          role="status"
          className="kw-savebar fixed inset-x-4 bottom-[calc(1rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-md items-center gap-2 rounded-xl border border-(--border) bg-(--card) py-2 pl-4 pr-2 shadow-lg animate-scale-in md:bottom-6"
        >
          <span className="h-2 w-2 shrink-0 rounded-full bg-(--amber)" aria-hidden />
          <span className="flex-1 text-sm font-medium text-(--fg)">Unsaved changes</span>
          <button type="button" className="btn btn-ghost btn-sm" onClick={discardBrand} disabled={brandSaving}>Discard</button>
          <button type="button" className="btn btn-primary btn-sm" onClick={saveBrand} disabled={brandSaving}>
            {brandSaving ? 'Saving…' : 'Save'}
          </button>
        </div>
      )}
    </div>
  );
};

export default Settings;
