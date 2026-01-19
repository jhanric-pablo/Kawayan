import React, { useState } from 'react';
import { User, ViewState } from '../types';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { LogIn, UserPlus, AlertCircle, LayoutDashboard } from 'lucide-react';

interface Props {
  onLogin: (user: User) => void;
  onNavigate: (view: ViewState) => void;
  isAdminLogin?: boolean;
  initialIsSignUp?: boolean;
}

const Login: React.FC<Props> = ({ onLogin, onNavigate, isAdminLogin = false, initialIsSignUp = false }) => {
  const [isSignUp, setIsSignUp] = useState(initialIsSignUp);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [dbService] = useState(() => new UniversalDatabaseService());

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    const trimmedEmail = email.trim();
    const trimmedBusinessName = businessName.trim();

    try {
      console.log('Login attempt:', { email: trimmedEmail, isSignUp, isAdminLogin });

      if (!trimmedEmail || !password) {
        setError("Email and password are required");
        return;
      }

      if (isSignUp && !isAdminLogin) {
        if (!trimmedBusinessName || trimmedBusinessName.length < 2) {
          setError("Business name must be at least 2 characters long");
          return;
        }

        const newUser = await dbService.createUser(trimmedEmail, password, 'user', trimmedBusinessName);
        
        if (newUser) {
          console.log('User created successfully:', newUser.email);
          onLogin(newUser);
        } else {
          setError("Registration failed. Email might be taken.");
        }
      } else {
        // Login
        const result = await dbService.loginUser(trimmedEmail, password);
        
        if (result && result.user) {
          console.log('Login successful:', result.user.email);
          
          if (isAdminLogin && result.user.role !== 'admin') {
             setError("Access denied. Admin only.");
             await dbService.logoutUser();
          } else {
             onLogin(result.user);
          }
        } else {
          setError("Invalid credentials.");
        }
      }
    } catch (error: any) {
      console.error('Login/Signup error:', error);
      setError(error.message || "An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center px-4 animate-in fade-in duration-500">
      <div className="bg-white dark:bg-slate-850 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-800 max-w-md w-full relative overflow-hidden transition-colors">
        
        {/* Decor */}
        <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-600"></div>

        <div className="text-center mb-8">
           <div className="inline-flex p-3 bg-emerald-50 dark:bg-emerald-900/30 rounded-full text-emerald-600 dark:text-emerald-400 mb-4">
              {isAdminLogin ? <LayoutDashboard className="w-8 h-8"/> : <LogIn className="w-8 h-8" />}
           </div>
           <h1 className="text-2xl font-bold text-slate-800 dark:text-white">
             {isAdminLogin ? 'Admin Portal' : (isSignUp ? 'Create Account' : 'Welcome Back')}
           </h1>
           <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">
             {isAdminLogin ? 'Secure access for staff only.' : 'Manage your SME social media with AI.'}
           </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {isSignUp && !isAdminLogin && (
            <div>
              <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Business Name</label>
              <input 
                type="text" 
                required 
                className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                placeholder="e.g. Aling Nena's"
                value={businessName}
                onChange={(e) => setBusinessName(e.target.value)}
              />
            </div>
          )}
          
          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Email Address</label>
            <input 
              type="email" 
              required 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 uppercase mb-1">Password</label>
            <input 
              type="password" 
              required 
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg border border-rose-100 dark:border-rose-900/30">
              <AlertCircle className="w-4 h-4" /> {error}
            </div>
          )}

          <button 
            type="submit"
            disabled={isLoading}
            className={`w-full py-4 rounded-xl font-bold text-white shadow-lg transition transform hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              isAdminLogin ? 'bg-slate-800 hover:bg-slate-900' : 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-200 dark:shadow-none'
            }`}
          >
            {isLoading ? 'Processing...' : (isSignUp && !isAdminLogin ? 'Sign Up Free' : 'Login')}
          </button>
        </form>

        {!isAdminLogin && (
          <div className="mt-6 text-center">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-sm text-slate-500 dark:text-slate-400 hover:text-emerald-600 dark:hover:text-emerald-400 font-medium flex items-center justify-center gap-2 mx-auto"
            >
              {isSignUp ? 'Already have an account? Login' : 'New here? Create an account'} 
              {!isSignUp && <UserPlus className="w-4 h-4" />}
            </button>
          </div>
        )}
        
        {isAdminLogin && (
          <div className="mt-6 text-center">
             <button onClick={() => onNavigate(ViewState.LOGIN)} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 transition">Back to User Login</button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Login;
