import React, { useRef, useState } from 'react';
import { User, ViewState } from '../types';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { ValidationService } from '../services/validationService';
import { TOS_VERSION } from '../constants/termsOfService';
import TermsOfServiceModal from './TermsOfServiceModal';
import { LogIn, UserPlus, AlertCircle, LayoutDashboard, Sun, Moon, Upload, FileText, X, ArrowRight, Sparkles, Shield, TrendingUp } from 'lucide-react';

interface Props {
  onLogin: (user: User) => void;
  onNavigate: (view: ViewState) => void;
  isAdminLogin?: boolean;
  initialIsSignUp?: boolean;
  darkMode?: boolean;
  toggleTheme?: () => void;
}

const Login: React.FC<Props> = ({
  onLogin,
  onNavigate,
  isAdminLogin = false,
  initialIsSignUp = false,
  darkMode = false,
  toggleTheme
}) => {
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [businessAddress, setBusinessAddress] = useState('');
  const [businessPhone, setBusinessPhone] = useState('');
  const [document, setDocument] = useState<File | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [showTermsModal, setShowTermsModal] = useState(false);
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

    const trimmedEmail = email.trim();
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
            onLogin(result.user);
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

  const inputClass = `
    w-full px-4 py-3 rounded-xl border text-sm font-medium
    bg-white/70 dark:bg-[#1a2b26]/60
    border-[#2B5748]/15 dark:border-[#9CB080]/15
    text-[#1A2B26] dark:text-[#E8F0EC]
    placeholder-[#1A2B26]/35 dark:placeholder-[#E8F0EC]/30
    focus:outline-none focus:border-[#2B5748] dark:focus:border-[#9CB080]
    focus:ring-0 focus:bg-white dark:focus:bg-[#1a2b26]/80
    transition-all duration-200
  `.trim();

  const labelClass = "block text-[11px] font-bold uppercase tracking-widest mb-1.5 text-[#1A2B26]/50 dark:text-[#E8F0EC]/45";

  const features = [
    { icon: <Sparkles className="w-4 h-4" />, text: "AI-powered content creation" },
    { icon: <TrendingUp className="w-4 h-4" />, text: "Multi-platform analytics" },
    { icon: <Shield className="w-4 h-4" />, text: "Business verified security" },
  ];

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}>

      {/* Background blobs */}
      <div className="absolute top-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-[0.06] blur-[100px] bg-[#2B5748] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full opacity-[0.05] blur-[80px] bg-[#9CB080] pointer-events-none" />
      <div className="absolute top-[40%] left-[30%] w-[300px] h-[300px] rounded-full opacity-[0.04] blur-[70px] bg-[#618764] pointer-events-none" />

      {/* Theme toggle */}
      {toggleTheme && (
        <button
          onClick={toggleTheme}
          className="absolute top-5 right-5 p-2.5 rounded-xl glass transition z-20"
          title={darkMode ? "Light mode" : "Dark mode"}
        >
          {darkMode
            ? <Sun className="w-4 h-4 text-[#9CB080]" />
            : <Moon className="w-4 h-4 text-[#2B5748]" />}
        </button>
      )}

      <div className="w-full max-w-4xl animate-scale-in">
        {/* Main container — split layout */}
        <div className="flex rounded-2xl overflow-hidden"
          style={{ boxShadow: 'var(--shadow-xl)' }}>

          {/* ── Left brand panel (hidden on mobile) ───────────────── */}
          {!isAdminLogin && (
            <div className="hidden md:flex flex-col justify-between w-[42%] shrink-0 relative p-10 overflow-hidden"
              style={{ background: 'linear-gradient(160deg, #2B5748 0%, #1A3D30 100%)' }}>

              {/* Dot pattern overlay */}
              <div className="absolute inset-0 dot-pattern-dark opacity-40" />

              {/* Floating accent blobs */}
              <div className="absolute top-[-40px] right-[-40px] w-64 h-64 rounded-full opacity-10 blur-3xl bg-[#9CB080]" />
              <div className="absolute bottom-[-20px] left-[-20px] w-48 h-48 rounded-full opacity-10 blur-3xl bg-[#618764]" />

              <div className="relative z-10">
                {/* Logo */}
                <div className="flex items-center gap-2.5 mb-10">
                  <img src="/logo.png" alt="Kawayan AI" className="w-9 h-9 rounded-xl object-contain" />
                  <span className="text-white font-bold text-lg tracking-tight">Kawayan AI</span>
                </div>

                {/* Headline */}
                <div>
                  <h1 className="font-display text-3xl text-white leading-tight mb-3">
                    {isSignUp ? 'Grow your business with AI' : 'Welcome back to Kawayan'}
                  </h1>
                  <p className="text-white/60 text-sm leading-relaxed">
                    {isSignUp
                      ? 'Join Filipino SMEs using AI-powered content to reach more customers.'
                      : 'Your AI-powered marketing platform for Philippine small businesses.'}
                  </p>
                </div>

                {/* Feature list */}
                <div className="mt-8 space-y-3.5">
                  {features.map((f, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'rgba(156,176,128,0.18)' }}>
                        <span className="text-[#9CB080]">{f.icon}</span>
                      </div>
                      <span className="text-white/75 text-sm">{f.text}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottom badge */}
              <div className="relative z-10">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-full text-xs text-white/60"
                  style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)' }}>
                  <span className="w-1.5 h-1.5 rounded-full bg-[#9CB080] animate-pulse-dot" />
                  Made for Philippine MSMEs
                </div>
              </div>
            </div>
          )}

          {/* ── Right form panel ──────────────────────────────────── */}
          <div className="flex-1 bg-white dark:bg-[#111E18] p-8 md:p-10 overflow-y-auto max-h-[90vh]">

            {/* Header */}
            <div className="mb-8">
              {/* Mobile logo */}
              <div className="flex items-center gap-2 mb-6 md:hidden">
                <img src="/logo.png" alt="Kawayan AI" className="w-8 h-8 rounded-xl object-contain" />
                <span className="font-bold text-[#2B5748] dark:text-[#9CB080] text-lg">Kawayan AI</span>
              </div>

              <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(43,87,72,0.1)' }}>
                  {isAdminLogin
                    ? <LayoutDashboard className="w-5 h-5 text-[#2B5748]" />
                    : isSignUp
                      ? <UserPlus className="w-5 h-5 text-[#2B5748]" />
                      : <LogIn className="w-5 h-5 text-[#2B5748]" />}
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#1A2B26] dark:text-[#E8F0EC] tracking-tight">
                    {isAdminLogin ? 'Staff Portal' : isSignUp ? 'Create Account' : 'Sign In'}
                  </h2>
                  <p className="text-sm text-[#1A2B26]/45 dark:text-[#E8F0EC]/40 mt-0.5">
                    {isAdminLogin
                      ? 'Admin and support team sign-in.'
                      : isSignUp
                        ? 'Start your free MSME marketing journey.'
                        : 'Welcome back! Sign in to continue.'}
                  </p>
                </div>
              </div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {isSignUp && !isAdminLogin && (
                <>
                  <div>
                    <label className={labelClass}>Business Name</label>
                    <input
                      type="text"
                      required
                      className={inputClass}
                      placeholder="e.g. Aling Nena's Lutong Bahay"
                      value={businessName}
                      onChange={(e) => setBusinessName(e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className={labelClass}>Business Address</label>
                      <input
                        type="text"
                        required
                        className={inputClass}
                        placeholder="e.g. 123 Rizal St., Parañaque"
                        value={businessAddress}
                        onChange={(e) => setBusinessAddress(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Contact Number</label>
                      <input
                        type="tel"
                        required
                        className={inputClass}
                        placeholder="09XX-XXX-XXXX"
                        value={businessPhone}
                        onChange={(e) => setBusinessPhone(e.target.value)}
                      />
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className={labelClass}>Email Address</label>
                <input
                  type="email"
                  required
                  className={inputClass}
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>

              <div>
                <label className={labelClass}>Password</label>
                <input
                  type="password"
                  required
                  className={inputClass}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>

              {/* Document upload */}
              {isSignUp && !isAdminLogin && (
                <div>
                  <label className={labelClass}>
                    Business Document <span className="text-rose-400 normal-case font-normal tracking-normal">* required</span>
                  </label>
                  <p className="text-xs text-[#1A2B26]/40 dark:text-[#E8F0EC]/35 mb-2">
                    Mayor's Permit, DTI, or SEC Registration (JPG, PNG, PDF — max 5MB)
                  </p>

                  {document ? (
                    <div className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                      style={{ background: 'rgba(43,87,72,0.05)', borderColor: 'rgba(43,87,72,0.18)' }}>
                      <FileText className="w-4.5 h-4.5 shrink-0 text-[#2B5748]" />
                      <span className="text-sm text-[#1A2B26] dark:text-[#E8F0EC] flex-1 truncate font-medium">{document.name}</span>
                      <button
                        type="button"
                        onClick={() => { setDocument(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                        className="p-1 rounded-lg hover:bg-[#2B5748]/10 transition"
                      >
                        <X className="w-3.5 h-3.5 text-[#1A2B26]/40" />
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-5 rounded-xl border-2 border-dashed flex flex-col items-center gap-2 transition-all group"
                      style={{ borderColor: 'rgba(43,87,72,0.22)' }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = '#2B5748')}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = 'rgba(43,87,72,0.22)')}
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(43,87,72,0.08)' }}>
                        <Upload className="w-4 h-4 text-[#2B5748]/60 group-hover:text-[#2B5748] transition-colors" />
                      </div>
                      <span className="text-xs font-semibold text-[#1A2B26]/40 group-hover:text-[#2B5748] dark:text-[#E8F0EC]/35 transition-colors">
                        Click to upload document
                      </span>
                    </button>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.pdf"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                </div>
              )}

              {/* TOS acceptance */}
              {isSignUp && !isAdminLogin && (
                <div className="rounded-xl p-4" style={{ background: 'rgba(43,87,72,0.05)', border: '1px solid rgba(43,87,72,0.12)' }}>
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={acceptedTerms}
                      onChange={(e) => setAcceptedTerms(e.target.checked)}
                      className="mt-0.5 w-4 h-4 accent-[#2B5748] cursor-pointer"
                    />
                    <span className="text-xs text-[#1A2B26]/65 dark:text-[#E8F0EC]/60 leading-relaxed">
                      I have read and agree to the{' '}
                      <button
                        type="button"
                        onClick={(e) => { e.preventDefault(); setShowTermsModal(true); }}
                        className="font-semibold text-[#2B5748] dark:text-[#9CB080] underline hover:no-underline"
                      >
                        Terms of Service
                      </button>
                      {' '}and{' '}
                      <a
                        href="/privacy.html"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-semibold text-[#2B5748] dark:text-[#9CB080] underline hover:no-underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Privacy Policy
                      </a>
                      . Business verification is required before full platform access.
                    </span>
                  </label>
                  {!acceptedTerms && (
                    <button
                      type="button"
                      onClick={() => setShowTermsModal(true)}
                      className="mt-2 ml-7 text-[11px] font-bold text-[#2B5748] dark:text-[#9CB080] flex items-center gap-1 hover:underline"
                    >
                      Read full Terms of Service <ArrowRight className="w-3 h-3" />
                    </button>
                  )}
                </div>
              )}

              {/* Validation errors */}
              {validationErrors.length > 0 && (
                <div className="rounded-xl p-3.5" style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.18)' }}>
                  <div className="flex items-center gap-2 text-[#C0392B] text-xs font-bold mb-1.5">
                    <AlertCircle className="w-3.5 h-3.5" /> Password Requirements:
                  </div>
                  <ul className="list-disc list-inside text-xs text-[#C0392B]/80 space-y-0.5">
                    {validationErrors.map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Error message */}
              {error && (
                <div className="flex items-center gap-2.5 text-sm rounded-xl p-3.5"
                  style={{ background: 'rgba(192,57,43,0.06)', border: '1px solid rgba(192,57,43,0.18)', color: '#C0392B' }}>
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </div>
              )}

              {/* Submit */}
              <button
                type="submit"
                disabled={isLoading || (isSignUp && !isAdminLogin && !acceptedTerms)}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white flex items-center justify-center gap-2 transition-all"
                style={{
                  background: isAdminLogin
                    ? 'linear-gradient(135deg, #1A2B26, #273338)'
                    : 'linear-gradient(135deg, #2B5748, #3A7362)',
                  boxShadow: isAdminLogin
                    ? '0 4px 20px -4px rgba(26,43,38,0.4)'
                    : '0 4px 20px -4px rgba(43,87,72,0.4), inset 0 1px 0 rgba(255,255,255,0.12)',
                  opacity: (isLoading || (isSignUp && !isAdminLogin && !acceptedTerms)) ? 0.5 : 1,
                  cursor: (isLoading || (isSignUp && !isAdminLogin && !acceptedTerms)) ? 'not-allowed' : 'pointer',
                }}
                onMouseEnter={e => {
                  if (!e.currentTarget.disabled) e.currentTarget.style.transform = 'translateY(-1px)';
                }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; }}
              >
                {isLoading ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Processing...
                  </>
                ) : (
                  <>
                    {isSignUp && !isAdminLogin ? 'Create Account & Submit for Verification' : 'Sign In'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            {/* Footer links */}
            {!isAdminLogin && (
              <div className="mt-6 pt-5 border-t border-[#2B5748]/08 dark:border-[#9CB080]/08 text-center">
                <button
                  onClick={() => {
                    setIsSignUp(!isSignUp);
                    setError('');
                    setValidationErrors([]);
                    setAcceptedTerms(false);
                  }}
                  className="text-sm font-medium text-[#1A2B26]/50 dark:text-[#E8F0EC]/45 hover:text-[#2B5748] dark:hover:text-[#9CB080] transition-colors"
                >
                  {isSignUp
                    ? 'Already have an account? Sign in'
                    : 'No account yet? Create one free →'}
                </button>
              </div>
            )}

            {isAdminLogin && (
              <div className="mt-6 pt-5 border-t border-[#2B5748]/08 dark:border-[#9CB080]/08 text-center">
                <button
                  onClick={() => onNavigate(ViewState.LOGIN)}
                  className="text-xs text-[#1A2B26]/40 dark:text-[#E8F0EC]/35 hover:text-[#2B5748] dark:hover:text-[#9CB080] transition-colors"
                >
                  ← Back to User Login
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <TermsOfServiceModal
        open={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        requireScrollToAccept={!acceptedTerms}
        onAccept={!acceptedTerms ? () => setAcceptedTerms(true) : undefined}
      />
    </div>
  );
};

export default Login;
