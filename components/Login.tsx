import React, { useRef, useState } from 'react';
import { User, ViewState } from '../types';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { ValidationService } from '../services/validationService';
import { LogIn, UserPlus, AlertCircle, LayoutDashboard, Sun, Moon, Upload, FileText, X } from 'lucide-react';

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

        // 1. Create the user account
        const newUser = await dbService.createUser(trimmedEmail, password, 'user', trimmedBusinessName);

        if (!newUser) {
          setError("Registration failed. Please try again.");
          setIsLoading(false);
          return;
        }

        // 2. Submit verification document via FormData
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
          if (isAdminLogin && result.user.role !== 'admin') {
            setError("Access denied. Admin only.");
            await dbService.logoutUser();
          } else {
            onLogin(result.user);
          }
        }
      }
    } catch (err: any) {
      console.error('Login/Signup error:', err);
      setError(err.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 py-8">
      <div className="absolute w-[480px] h-[480px] rounded-full blur-[150px] opacity-[0.04] bg-[#2B5748] pointer-events-none"></div>

      <div className="bg-white dark:bg-[#273338] rounded-[2rem] rounded-tl-[4rem] rounded-br-[4rem] border border-[#2B5748] dark:border-[#9CB080]/20 max-w-lg w-full relative overflow-hidden transition-all duration-500 hover:-translate-y-1" style={{ boxShadow: '0 16px 48px -12px rgba(43, 87, 72,0.1)' }}>
        
        <div className="h-1.5 w-full bg-[#2B5748]"></div>

        <div className="p-8">
          {toggleTheme && (
            <button 
              onClick={toggleTheme}
              className="absolute top-6 right-6 p-2 rounded-full text-slate-400 hover:bg-slate-100 dark:hover:bg-[#2B5748]/50 transition z-10"
              title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
            >
              {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          )}

          <div className="text-center mb-8">
            <div className="inline-flex p-3 rounded-full mb-4 bg-[#2B5748]/10">
              <div style={{ color: '#2B5748' }}>
                {isAdminLogin ? <LayoutDashboard className="w-7 h-7"/> : <LogIn className="w-7 h-7" />}
              </div>
            </div>
            <h1 className="font-display text-2xl text-slate-800 dark:text-white">
              {isAdminLogin ? 'Admin Portal' : (isSignUp ? 'Create Account' : 'Welcome Back')}
            </h1>
            <p className="text-slate-400 dark:text-slate-500 text-sm mt-2">
              {isAdminLogin ? 'Secure access for authorized staff only.' : 'Manage your SME social media with AI.'}
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isSignUp && !isAdminLogin && (
              <>
                {/* Business Name */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Business Name</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-5 py-3 rounded-full border border-[#2B5748] dark:border-[#9CB080]/20 bg-white/50 dark:bg-[#273338] text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-[#2B5748]/30"
                    placeholder="e.g. Aling Nena's Lutong Bahay"
                    value={businessName}
                    onChange={(e) => setBusinessName(e.target.value)}
                  />
                </div>

                {/* Business Address */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Business Address</label>
                  <input 
                    type="text" 
                    required 
                    className="w-full px-5 py-3 rounded-full border border-[#2B5748] dark:border-[#9CB080]/20 bg-white/50 dark:bg-[#273338] text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-[#2B5748]/30"
                    placeholder="e.g. 123 Rizal St., Parañaque City"
                    value={businessAddress}
                    onChange={(e) => setBusinessAddress(e.target.value)}
                  />
                </div>

                {/* Business Phone */}
                <div>
                  <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Business Phone / Contact Number</label>
                  <input 
                    type="tel" 
                    required 
                    className="w-full px-5 py-3 rounded-full border border-[#2B5748] dark:border-[#9CB080]/20 bg-white/50 dark:bg-[#273338] text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-[#2B5748]/30"
                    placeholder="e.g. 09XX-XXX-XXXX"
                    value={businessPhone}
                    onChange={(e) => setBusinessPhone(e.target.value)}
                  />
                </div>
              </>
            )}
            
            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Email Address</label>
              <input 
                type="email" 
                required 
                className="w-full px-5 py-3 rounded-full border border-[#2B5748] dark:border-[#9CB080]/20 bg-white/50 dark:bg-[#273338] text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-[#2B5748]/30"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">Password</label>
              <input 
                type="password" 
                required 
                className="w-full px-5 py-3 rounded-full border border-[#2B5748] dark:border-[#9CB080]/20 bg-white/50 dark:bg-[#273338] text-slate-900 dark:text-white text-sm outline-none focus:ring-2 focus:ring-[#2B5748]/30"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {/* Document Upload — signup only */}
            {isSignUp && !isAdminLogin && (
              <div>
                <label className="block text-[11px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1.5">
                  Business Registration Document <span className="text-rose-400">*</span>
                </label>
                <p className="text-[11px] text-slate-400 mb-2">Upload your Mayor's Permit, DTI, or SEC Registration (JPG, PNG, or PDF — max 5MB)</p>

                {document ? (
                  <div className="flex items-center gap-3 p-3 rounded-full border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-900/20">
                    <FileText className="w-5 h-5 shrink-0" style={{ color: '#2B5748' }} />
                    <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 truncate">{document.name}</span>
                    <button
                      type="button"
                      onClick={() => { setDocument(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}
                      className="p-1 rounded-full hover:bg-emerald-100 dark:hover:bg-emerald-800 transition"
                    >
                      <X className="w-3.5 h-3.5 text-slate-400" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 rounded-full border-2 border-dashed border-[#2B5748] dark:border-[#9CB080]/20 flex flex-col items-center gap-2 hover:border-[#2B5748] dark:hover:border-[#2B5748] transition-all group"
                  >
                    <Upload className="w-5 h-5 text-slate-300 group-hover:text-[#2B5748] transition-colors" />
                    <span className="text-xs text-slate-400 group-hover:text-[#2B5748] transition-colors font-medium">Click to upload document</span>
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

            {validationErrors.length > 0 && (
              <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs font-bold mb-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Password Requirements:
                </div>
                <ul className="list-disc list-inside text-xs text-rose-500 dark:text-rose-300 space-y-0.5">
                  {validationErrors.map((err, i) => (
                    <li key={i}>{err}</li>
                  ))}
                </ul>
              </div>
            )}

            {error && (
              <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-xs bg-rose-50 dark:bg-rose-900/20 p-3 rounded-xl border border-rose-100 dark:border-rose-900/30">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
              </div>
            )}

            <button 
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 rounded-full font-bold text-sm text-white transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              style={isAdminLogin
                ? { background: '#273338', boxShadow: '0 4px 16px -4px rgba(44,44,36,0.3)' }
                : { background: '#2B5748', boxShadow: '0 4px 20px -4px rgba(43, 87, 72,0.35)' }
              }
            >
              {isLoading ? 'Processing...' : (isSignUp && !isAdminLogin ? 'Create Account & Submit for Verification' : 'Sign In')}
            </button>
          </form>

          {!isAdminLogin && (
            <div className="mt-6 text-center">
              <button 
                onClick={() => { setIsSignUp(!isSignUp); setError(''); setValidationErrors([]); }}
                className="text-sm text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 font-medium flex items-center justify-center gap-2 mx-auto"
              >
                {isSignUp ? 'Already have an account? Sign in' : 'No account yet? Create one free'} 
                {!isSignUp && <UserPlus className="w-4 h-4" />}
              </button>
            </div>
          )}
          
          {isAdminLogin && (
            <div className="mt-6 text-center">
              <button onClick={() => onNavigate(ViewState.LOGIN)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">← Back to User Login</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Login;
