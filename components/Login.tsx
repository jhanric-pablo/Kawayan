import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { User, ViewState } from '../types';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { ValidationService } from '../services/validationService';
import { TOS_VERSION } from '../constants/termsOfService';
import TermsOfServiceModal from './TermsOfServiceModal';
import {
  ArrowRight, X, Mail, Lock, Building2, MapPin, Phone, Eye, EyeOff,
  ShieldCheck, Wand2, Share2, CalendarCheck, UploadCloud, Check,
} from 'lucide-react';
import './auth/authScreen.css';

interface Props {
  onLogin: (user: User) => void | Promise<void>;
  onNavigate: (view: ViewState) => void;
  isAdminLogin?: boolean;
  initialIsSignUp?: boolean;
  darkMode?: boolean;
  toggleTheme?: () => void;
}

const AUTH_FEATURES = [
  { Icon: Wand2, title: 'Taglish captions in one click', desc: 'AI that writes like a Filipino shop owner — hugot, diskarte and all.' },
  { Icon: Share2, title: 'Preview for FB, IG & TikTok', desc: 'See every post exactly as it lands on each platform before you publish.' },
  { Icon: CalendarCheck, title: 'A month of posts, auto-planned', desc: 'Turn one strategy line into a full calendar of dated, scheduled content.' },
];

function passwordStrength(pw: string): { score: number; label: string } {
  if (!pw) return { score: 0, label: '' };
  let s = 0;
  if (pw.length >= 8) s += 1;
  if (pw.length >= 12) s += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s += 1;
  if (/\d/.test(pw)) s += 1;
  if (/[^A-Za-z0-9]/.test(pw)) s += 1;
  const score = Math.max(1, Math.min(4, s));
  return { score, label: ['', 'Weak', 'Fair', 'Good', 'Strong'][score] };
}

/* Honest, on-brand cycling line — the kinds of shops Kawayan is built for. */
const BUILT_FOR = [
  'sari-sari stores',
  'panaderias',
  'milk tea kiosks',
  'carinderias',
  'barbershops',
  'ukay boutiques',
  'hardware stores',
  'plant shops',
];

const BuiltForTicker: React.FC = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % BUILT_FOR.length), 2600);
    return () => clearInterval(t);
  }, []);
  return <span key={i} className="af-today__line">{BUILT_FOR[i]}</span>;
};

/* Module-level so the input never remounts (keeps focus while typing). */
interface FieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  autoComplete?: string;
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  trailing?: React.ReactNode;
  icon?: React.ReactNode;
}

const Field: React.FC<FieldProps> = ({ id, label, value, onChange, type = 'text', required, autoComplete, inputMode, trailing, icon }) => (
  <div className={`af-field${icon ? ' af-field--icon' : ''}`}>
    {icon && <span className="af-field__icon" aria-hidden="true">{icon}</span>}
    <input
      id={id}
      className="af-input"
      type={type}
      value={value}
      onChange={onChange}
      placeholder=" "
      required={required}
      autoComplete={autoComplete}
      inputMode={inputMode}
    />
    <label htmlFor={id} className="af-label">{label}</label>
    {trailing && <div className="af-trailing">{trailing}</div>}
    <span className="af-underline" aria-hidden="true" />
  </div>
);

const Login: React.FC<Props> = ({
  onLogin,
  onNavigate,
  isAdminLogin = false,
  initialIsSignUp = false,
  darkMode = false,
  toggleTheme,
}) => {
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [document, setDocument] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [legalDoc, setLegalDoc] = useState<'terms' | 'privacy' | null>(null);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dbService] = useState(() => new UniversalDatabaseService());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      setError('Only JPG, PNG, or PDF files are accepted.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File must be smaller than 5MB.');
      return;
    }
    setError('');
    setDocument(file);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors([]);
    setIsLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedBusinessName = businessName.trim();

    try {
      if (!trimmedEmail || !password) {
        setError("Email and password are required");
        setIsLoading(false);
        return;
      }

      if (isSignUp && !isAdminLogin) {
        const passwordValidation = ValidationService.validatePassword(password);
        if (!passwordValidation.isValid) {
          setValidationErrors(passwordValidation.errors);
          setIsLoading(false);
          return;
        }

        if (!trimmedBusinessName || trimmedBusinessName.length < 2) {
          setError("Business name must be at least 2 characters long");
          setIsLoading(false);
          return;
        }

        if (!businessAddress.trim()) {
          setError("Business address is required");
          setIsLoading(false);
          return;
        }

        if (!businessPhone.trim()) {
          setError("Business phone / contact number is required");
          setIsLoading(false);
          return;
        }

        if (!document) {
          setError("Please upload a business registration document (Mayor's Permit, DTI, or SEC Registration).");
          setIsLoading(false);
          return;
        }

        if (!acceptedTerms) {
          setError('You must read and accept the Terms of Service before creating an account.');
          setIsLoading(false);
          return;
        }

        const newUser = await dbService.createUser(
          trimmedEmail,
          password,
          'user',
          trimmedBusinessName,
          { acceptedTerms: true, termsVersion: TOS_VERSION }
        );

        if (!newUser) {
          setError("Registration failed. Please try again.");
          setIsLoading(false);
          return;
        }

        const formData = new FormData();
        formData.append('userId', newUser.id);
        formData.append('businessAddress', businessAddress.trim());
        formData.append('businessPhone', businessPhone.trim());
        formData.append('document', document);

        const token = localStorage.getItem('kawayan_jwt');
        const verifRes = await fetch('/api/verification/submit', {
          method: 'POST',
          headers: token ? { Authorization: `Bearer ${token}` } : {},
          body: formData,
        });

        if (!verifRes.ok) {
          console.warn('Verification doc upload failed (non-fatal):', await verifRes.text());
        }

        onLogin({ ...newUser, verificationStatus: 'pending' });
      } else {
        const result = await dbService.loginUser(trimmedEmail, password);

        if (result && result.user) {
          if (isAdminLogin && result.user.role !== 'admin' && result.user.role !== 'support') {
            setError("Access denied. Use the main Login page for SME accounts.");
            await dbService.logoutUser();
          } else {
            await onLogin(result.user);
          }
        } else {
          setError("Invalid email or password.");
        }
      }
    } catch (err: any) {
      console.error('Login/Signup error:', err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Bumps on every Sign in ⇄ Create switch so the light-sweep animation replays.
  const [flip, setFlip] = useState<{ seq: number; dir: 'fwd' | 'back' }>({ seq: 0, dir: 'fwd' });

  const switchMode = (next: boolean) => {
    if (next !== isSignUp) setFlip((f) => ({ seq: f.seq + 1, dir: next ? 'fwd' : 'back' }));
    setIsSignUp(next);
    setError('');
    setValidationErrors([]);
    setAcceptedTerms(false);
  };

  // Sliding underline indicator for the Sign in / Create account tabs
  const tabsRef = useRef<HTMLDivElement>(null);
  const [ink, setInk] = useState({ left: 0, width: 0 });

  useLayoutEffect(() => {
    if (isAdminLogin) return;
    const measure = () => {
      const active = tabsRef.current?.querySelector<HTMLElement>('button.is-active');
      if (active) setInk({ left: active.offsetLeft, width: active.offsetWidth });
    };
    measure();
    window.addEventListener('resize', measure);
    // `document` is shadowed by local state in this component — reach the real one via window
    const fonts = (window.document as Document & { fonts?: { ready?: Promise<unknown> } }).fonts;
    fonts?.ready?.then(measure).catch(() => undefined);
    return () => window.removeEventListener('resize', measure);
  }, [isSignUp, isAdminLogin]);

  const editorialKey = isAdminLogin ? 'admin' : isSignUp ? 'signup' : 'signin';

  const headline = isAdminLogin
    ? ['Staff', 'console.']
    : isSignUp
      ? ['Set up shop', 'in minutes.']
      : ['Back to', 'business.'];

  const sub = isAdminLogin
    ? 'Admin and support access only.'
    : isSignUp
      ? 'Create your account, attach your business permit for verification, and start planning content today.'
      : 'Sign in to your Kawayan workspace — your calendar, drafts and analytics are right where you left them.';

  const submitDisabled = isLoading || (isSignUp && !isAdminLogin && !acceptedTerms);
  const strength = passwordStrength(password);

  return (
    <div className={`af-screen${isSignUp && !isAdminLogin ? ' is-signup' : ''}`}>
      <div className="af-spine" aria-hidden="true" />

      <div className="af-grid">
        {flip.seq > 0 && !isAdminLogin && (
          <span key={flip.seq} className={`af-sweep af-sweep--${flip.dir}`} aria-hidden="true" />
        )}

        <button type="button" className="af-back" onClick={() => onNavigate(ViewState.LANDING)}>
          ← Kawayan
        </button>
        {toggleTheme && (
          <button type="button" className="af-theme" onClick={toggleTheme}>
            {darkMode ? 'Light' : 'Dark'}
          </button>
        )}

        {/* ── Brand panel ── */}
        <div className="af-editorial">
          <span className="af-panel-grid" aria-hidden="true" />
          <span className="af-editorial__wash" aria-hidden="true" />
          <span className="af-orb af-orb--1" aria-hidden="true" />
          <span className="af-orb af-orb--2" aria-hidden="true" />

          <button type="button" className="af-brand" onClick={() => onNavigate(ViewState.LANDING)} title="Back to home">
            <img src="/logo.png" alt="" />
            <span>Kawayan AI</span>
          </button>

          <div className="af-lede" key={editorialKey}>
            <h1 className="af-headline">
              {headline.map((line) => <span key={line}>{line}</span>)}
            </h1>
            <hr className="af-rule" />
            <p className="af-sub">{sub}</p>
          </div>

          {!isAdminLogin && (
            <div className="af-feats">
              {AUTH_FEATURES.map((f) => (
                <div className="af-feat" key={f.title}>
                  <span className="af-feat__ico"><f.Icon /></span>
                  <div>
                    <h4>{f.title}</h4>
                    <p>{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {!isAdminLogin && (
            <div className="af-proof">
              <span className="af-proof__avs" aria-hidden="true"><i /><i /><i /><i /></span>
              <span className="af-proof__txt"><b>1,000+ Filipino shops</b> already plan with Kawayan.</span>
            </div>
          )}
          {!isAdminLogin && (
            <p className="af-today">
              <span className="af-today__k">Built for</span>
              <BuiltForTicker />
            </p>
          )}
        </div>

        {/* ── Form ── */}
        <div className="af-formwrap">
          <div className="af-formcard">
            {!isAdminLogin ? (
              <div className="af-tabs" ref={tabsRef}>
                <button type="button" className={!isSignUp ? 'is-active' : ''} onClick={() => switchMode(false)}>
                  Sign in
                </button>
                <button type="button" className={isSignUp ? 'is-active' : ''} onClick={() => switchMode(true)}>
                  Create account
                </button>
                <span
                  className="af-tabs__ink"
                  aria-hidden="true"
                  style={{ transform: `translateX(${ink.left}px)`, width: ink.width || undefined }}
                />
              </div>
            ) : (
              <p className="af-formcard__title">Staff sign-in</p>
            )}

            <form onSubmit={handleSubmit} className="af-form">
              {isSignUp && !isAdminLogin && (
                <div className="af-grp af-reveal">
                  <Field
                    id="af-biz"
                    label="Business name"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                    required
                    autoComplete="organization"
                    icon={<Building2 />}
                  />
                  <div className="af-two">
                    <Field
                      id="af-addr"
                      label="Business address"
                      value={businessAddress}
                      onChange={(e) => setBusinessAddress(e.target.value)}
                      required
                      autoComplete="street-address"
                      icon={<MapPin />}
                    />
                    <Field
                      id="af-phone"
                      label="Contact number"
                      type="tel"
                      inputMode="tel"
                      value={businessPhone}
                      onChange={(e) => setBusinessPhone(e.target.value)}
                      required
                      autoComplete="tel"
                      icon={<Phone />}
                    />
                  </div>
                </div>
              )}

              <Field
                id="af-email"
                label="Email address"
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
                icon={<Mail />}
              />

              <Field
                id="af-pw"
                label="Password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                icon={<Lock />}
                trailing={
                  <button
                    type="button"
                    className="af-show"
                    tabIndex={-1}
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    {showPassword ? <EyeOff /> : <Eye />}
                  </button>
                }
              />

              {isSignUp && !isAdminLogin && password && (
                <div className="af-strength" data-score={strength.score}>
                  <div className="af-strength__bars">
                    {[0, 1, 2, 3].map((i) => (
                      <span key={i} className={i < strength.score ? 'is-on' : ''} />
                    ))}
                  </div>
                  <span className="af-strength__label">{strength.label}</span>
                </div>
              )}

              {isSignUp && !isAdminLogin && (
                <div className="af-reveal" style={{ animationDelay: '60ms' }}>
                <div className="af-doc">
                  <span className="af-doc__label"><ShieldCheck className="w-3 h-3" /> Business permit</span>
                  {document ? (
                    <div className="af-doc__chip">
                      <Check className="af-doc__ok" />
                      <span>{document.name}</span>
                      <button
                        type="button"
                        aria-label="Remove file"
                        onClick={() => { setDocument(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="af-doc__add" onClick={() => fileInputRef.current?.click()}>
                      <UploadCloud /> Attach Mayor&apos;s Permit / DTI / SEC
                    </button>
                  )}
                  <p className="af-doc__hint">JPG, PNG or PDF · max 5&nbsp;MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    hidden
                    onChange={handleFileChange}
                  />
                </div>
                </div>
              )}

              {isSignUp && !isAdminLogin && (
                <label className="af-tos af-reveal" style={{ animationDelay: '120ms' }}>
                  <input
                    type="checkbox"
                    checked={acceptedTerms}
                    onChange={(e) => setAcceptedTerms(e.target.checked)}
                  />
                  <span>
                    I agree to the{' '}
                    <button type="button" onClick={(e) => { e.preventDefault(); setLegalDoc('terms'); }}>
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button type="button" onClick={(e) => { e.preventDefault(); setLegalDoc('privacy'); }}>
                      Privacy Policy
                    </button>
                    . Verification is required before full platform access.
                  </span>
                </label>
              )}

              {validationErrors.length > 0 && (
                <div className="af-error">
                  <strong>Password needs</strong>
                  <ul>
                    {validationErrors.map((err, i) => <li key={i}>{err}</li>)}
                  </ul>
                </div>
              )}

              {error && <div className="af-error">{error}</div>}

              <button type="submit" className="af-submit" disabled={submitDisabled}>
                <span>
                  {isLoading
                    ? 'Just a sec…'
                    : isSignUp && !isAdminLogin
                      ? 'Create account'
                      : 'Sign in'}
                </span>
                {!isLoading && <ArrowRight className="w-4 h-4" />}
              </button>

              <p className="af-trust">
                <ShieldCheck />
                {isAdminLogin
                  ? 'Staff access is logged and monitored.'
                  : isSignUp
                    ? 'Encrypted end-to-end. Manual verification keeps Kawayan spam-free.'
                    : 'Encrypted end-to-end. No credit card needed to start.'}
              </p>
            </form>

            {isAdminLogin && (
              <button type="button" className="af-alt" onClick={() => onNavigate(ViewState.LOGIN)}>
                ← Back to user login
              </button>
            )}
          </div>
        </div>
      </div>

      <TermsOfServiceModal
        open={legalDoc !== null}
        doc={legalDoc ?? 'terms'}
        onClose={() => setLegalDoc(null)}
        onSwitchDoc={(d) => setLegalDoc(d)}
        requireScrollToAccept={legalDoc === 'terms' && !acceptedTerms}
        onAccept={legalDoc === 'terms' && !acceptedTerms ? () => setAcceptedTerms(true) : undefined}
      />
    </div>
  );
};

export default Login;
