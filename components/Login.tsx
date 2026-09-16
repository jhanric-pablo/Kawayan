import React, { useEffect, useRef, useState } from 'react';
import { User, ViewState } from '../types';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { ValidationService } from '../services/validationService';
import { TOS_VERSION } from '../constants/termsOfService';
import TermsOfServiceModal from './TermsOfServiceModal';
import AuthShell from './auth/AuthShell';
import AuthField from './auth/AuthField';
import AuthTabs from './auth/AuthTabs';
import StepProgress from './auth/StepProgress';
import PasswordMeter from './auth/PasswordMeter';
import {
  ArrowRight, X, Mail, Lock, Building2, MapPin, Phone, Eye, EyeOff,
  ShieldCheck, UploadCloud, Check, Sparkles, Wallet,
} from 'lucide-react';

interface Props {
  onLogin: (user: User) => void | Promise<void>;
  onNavigate: (view: ViewState) => void;
  isAdminLogin?: boolean;
  initialIsSignUp?: boolean;
  darkMode?: boolean;
  toggleTheme?: () => void;
}

const SIGNUP_STEPS = ['Your account', 'Your business', 'Verification'];

/* Honest, on-brand cycling line — the kinds of shops Kawayan is built for. */
const BUILT_FOR = [
  'sari-sari stores', 'panaderias', 'milk tea kiosks', 'carinderias',
  'barbershops', 'ukay boutiques', 'hardware stores', 'plant shops',
];

const BuiltForTicker: React.FC = () => {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % BUILT_FOR.length), 2600);
    return () => clearInterval(t);
  }, []);
  return (
    <span className="ax__built">
      <b>Built for</b>
      <span key={i} className="ax__built-line">{BUILT_FOR[i]}</span>
    </span>
  );
};

const Login: React.FC<Props> = ({
  onLogin,
  onNavigate,
  isAdminLogin = false,
  initialIsSignUp = false,
  darkMode = false,
  toggleTheme,
}) => {
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [step, setStep] = useState(0);
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
  const [forgotMode, setForgotMode] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');
  const [forgotLink, setForgotLink] = useState('');
  const [forgotLoading, setForgotLoading] = useState(false);
  const [dbService] = useState(() => new UniversalDatabaseService());
  const fileInputRef = useRef<HTMLInputElement>(null);

  const clearMessages = () => { setError(''); setValidationErrors([]); };

  const switchMode = (next: boolean) => {
    setIsSignUp(next);
    setStep(0);
    setAcceptedTerms(false);
    clearMessages();
  };

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

  /** Gate each wizard step so problems surface where they're fixable. */
  const validateStep = (s: number): boolean => {
    clearMessages();
    if (s === 0) {
      if (!email.trim() || !password) { setError('Email and password are required'); return false; }
      const v = ValidationService.validatePassword(password);
      if (!v.isValid) { setValidationErrors(v.errors); return false; }
      return true;
    }
    if (s === 1) {
      if (businessName.trim().length < 2) { setError('Business name must be at least 2 characters long'); return false; }
      if (!businessAddress.trim()) { setError('Business address is required'); return false; }
      if (!businessPhone.trim()) { setError('Business phone / contact number is required'); return false; }
      return true;
    }
    if (!document) { setError("Please upload a business registration document (Mayor's Permit, DTI, or SEC Registration)."); return false; }
    if (!acceptedTerms) { setError('You must read and accept the Terms of Service before creating an account.'); return false; }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Sign-up: advance through the wizard until the last step.
    if (isSignUp && !isAdminLogin && step < SIGNUP_STEPS.length - 1) {
      if (validateStep(step)) setStep((s) => s + 1);
      return;
    }

    clearMessages();
    setIsLoading(true);

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedBusinessName = businessName.trim();

    try {
      if (!trimmedEmail || !password) {
        setError('Email and password are required');
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
          setError('Business name must be at least 2 characters long');
          setIsLoading(false);
          return;
        }
        if (!businessAddress.trim()) {
          setError('Business address is required');
          setIsLoading(false);
          return;
        }
        if (!businessPhone.trim()) {
          setError('Business phone / contact number is required');
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
          setError('Registration failed. Please try again.');
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
            setError('Access denied. Use the main Login page for SME accounts.');
            await dbService.logoutUser();
          } else {
            await onLogin(result.user);
          }
        } else {
          setError('Invalid email or password.');
        }
      }
    } catch (err: any) {
      console.error('Login/Signup error:', err);
      setError(err.message || 'An error occurred. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotMsg('');
    setForgotLink('');
    setForgotLoading(true);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotEmail.trim().toLowerCase() }),
        signal: controller.signal,
      });
      const data = await res.json();
      setForgotMsg(data.message || 'If that email exists, a reset link has been sent.');
      if (data.devResetUrl) setForgotLink(data.devResetUrl);
    } catch (err: any) {
      setForgotMsg(err?.name === 'AbortError' ? 'Request timed out. Please try again.' : 'Network error. Please try again.');
    } finally {
      clearTimeout(timeout);
      setForgotLoading(false);
    }
  };

  const eyeToggle = (
    <button
      type="button"
      className="ax-eye"
      tabIndex={-1}
      onClick={() => setShowPassword((s) => !s)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
    >
      {showPassword ? <EyeOff /> : <Eye />}
    </button>
  );

  const messages = (
    <>
      {validationErrors.length > 0 && (
        <div className="ax-error">
          <strong>Password needs</strong>
          <ul>{validationErrors.map((err, i) => <li key={i}>{err}</li>)}</ul>
        </div>
      )}
      {error && <div className="ax-error">{error}</div>}
    </>
  );

  /* ── Heading copy per mode ── */
  const heading = forgotMode
    ? { eyebrow: 'Account recovery', title: <>Reset your <em>password.</em></>, sub: 'We’ll email you a secure link to set a new one.' }
    : isAdminLogin
      ? { eyebrow: 'Staff access', title: <>Staff <em>console.</em></>, sub: 'Admin and support accounts only. Access is logged and monitored.' }
      : isSignUp
        ? { eyebrow: 'Free to start', title: <>Set up shop <em>in minutes.</em></>, sub: 'Three quick steps — account, business details, then verification.' }
        : { eyebrow: 'Welcome back', title: <>Back to <em>business.</em></>, sub: 'Your calendar, drafts and analytics are right where you left them.' };

  // Staff sign-in gets none of the customer-facing conversion signals.
  const footer = isAdminLogin ? (
    <div className="ax__foot">
      <span className="ax__foot-item"><ShieldCheck /> Access is logged and monitored</span>
    </div>
  ) : (
    <>
      <div className="ax__foot">
        <span className="ax__foot-item"><ShieldCheck /> Encrypted end-to-end</span>
        <span className="ax__foot-item"><Check /> Manual business verification</span>
        <span className="ax__foot-item"><Wallet /> No credit card to start</span>
      </div>
      <BuiltForTicker />
    </>
  );

  return (
    <AuthShell
      onBack={() => onNavigate(ViewState.LANDING)}
      eyebrow={heading.eyebrow}
      title={heading.title}
      subtitle={heading.sub}
      darkMode={darkMode}
      toggleTheme={toggleTheme}
      footer={footer}
    >
      {/* ── Forgot password ── */}
      {forgotMode ? (
        <form onSubmit={handleForgot} className="ax-form">
          <AuthField
            id="af-forgot-email"
            label="Email address"
            type="email"
            inputMode="email"
            value={forgotEmail}
            onChange={(e) => setForgotEmail(e.target.value)}
            required
            autoFocus
            autoComplete="email"
            icon={<Mail />}
          />

          {forgotMsg && <div className="ax-error">{forgotMsg}</div>}
          {forgotLink && (
            <div className="ax-error">
              Dev link (no mailer configured): <a href={forgotLink}>{forgotLink}</a>
            </div>
          )}

          <div className="ax-actions">
            <button type="submit" className="ax-btn ax-btn--primary" disabled={forgotLoading}>
              <span>{forgotLoading ? 'Sending…' : 'Send reset link'}</span>
              {!forgotLoading && <ArrowRight />}
            </button>
          </div>

          <button
            type="button"
            className="ax-link"
            onClick={() => { setForgotMode(false); setForgotMsg(''); setForgotLink(''); }}
          >
            ← Back to sign in
          </button>
        </form>
      ) : (
        <>
          {!isAdminLogin && <AuthTabs isSignUp={isSignUp} onChange={switchMode} />}
          {isSignUp && !isAdminLogin && <StepProgress steps={SIGNUP_STEPS} current={step} />}

          <form onSubmit={handleSubmit} className="ax-form">
            {/* Step 1 — account (also the whole form for sign-in / admin) */}
            {(!isSignUp || isAdminLogin || step === 0) && (
              <>
                <AuthField
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
                <AuthField
                  id="af-pw"
                  label="Password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete={isSignUp ? 'new-password' : 'current-password'}
                  icon={<Lock />}
                  trailing={eyeToggle}
                />
                {isSignUp && !isAdminLogin && <PasswordMeter password={password} />}
              </>
            )}

            {/* Step 2 — business details */}
            {isSignUp && !isAdminLogin && step === 1 && (
              <>
                <AuthField
                  id="af-biz"
                  label="Business name"
                  value={businessName}
                  onChange={(e) => setBusinessName(e.target.value)}
                  required
                  autoFocus
                  autoComplete="organization"
                  icon={<Building2 />}
                />
                <AuthField
                  id="af-addr"
                  label="Business address"
                  value={businessAddress}
                  onChange={(e) => setBusinessAddress(e.target.value)}
                  required
                  autoComplete="street-address"
                  icon={<MapPin />}
                />
                <AuthField
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
              </>
            )}

            {/* Step 3 — permit + terms */}
            {isSignUp && !isAdminLogin && step === 2 && (
              <>
                <div className="ax-doc">
                  <span className="ax-doc__label"><ShieldCheck /> Business permit</span>
                  {document ? (
                    <div className="ax-doc__chip">
                      <Check className="ax-doc__ok" />
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
                    <button type="button" className="ax-doc__add" onClick={() => fileInputRef.current?.click()}>
                      <UploadCloud /> Attach Mayor&apos;s Permit / DTI / SEC
                    </button>
                  )}
                  <p className="ax-doc__hint">JPG, PNG or PDF · max 5&nbsp;MB</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    hidden
                    onChange={handleFileChange}
                  />
                </div>

                <label className="ax-tos">
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
              </>
            )}

            {messages}

            <div className="ax-actions">
              {isSignUp && !isAdminLogin && step > 0 && (
                <button
                  type="button"
                  className="ax-btn ax-btn--ghost"
                  onClick={() => { clearMessages(); setStep((s) => s - 1); }}
                >
                  Back
                </button>
              )}
              <button type="submit" className="ax-btn ax-btn--primary" disabled={isLoading}>
                <span>
                  {isLoading
                    ? 'Just a sec…'
                    : isSignUp && !isAdminLogin
                      ? (step < SIGNUP_STEPS.length - 1 ? 'Continue' : 'Create account')
                      : 'Sign in'}
                </span>
                {!isLoading && <ArrowRight />}
              </button>
            </div>

            {!isSignUp && !isAdminLogin && (
              <button
                type="button"
                className="ax-link"
                onClick={() => { setForgotMode(true); setForgotEmail(email); clearMessages(); }}
              >
                Forgot password?
              </button>
            )}

            {isAdminLogin && (
              <button type="button" className="ax-link" onClick={() => onNavigate(ViewState.LOGIN)}>
                ← Back to user login
              </button>
            )}

            <p className="ax-note">
              <Sparkles />
              {isAdminLogin
                ? 'Staff access is logged and monitored.'
                : isSignUp
                  ? 'Manual verification keeps Kawayan spam-free.'
                  : 'Encrypted end-to-end. No credit card needed to start.'}
            </p>
          </form>
        </>
      )}

      <TermsOfServiceModal
        open={legalDoc !== null}
        doc={legalDoc ?? 'terms'}
        onClose={() => setLegalDoc(null)}
        onSwitchDoc={(d) => setLegalDoc(d)}
        requireScrollToAccept={legalDoc === 'terms' && !acceptedTerms}
        onAccept={legalDoc === 'terms' && !acceptedTerms ? () => setAcceptedTerms(true) : undefined}
      />
    </AuthShell>
  );
};

export default Login;
