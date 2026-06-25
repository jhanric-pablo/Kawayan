import React, { useState, useEffect } from 'react';
import { BrandProfile, User } from '../types';
import { Save, User as UserIcon, MessageCircle, Target, Briefcase, Moon, Sun, Monitor, ArrowLeft, Lock, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { paymentService, Wallet } from '../services/paymentService';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { ValidationService } from '../services/validationService';
import { useOrganicDialog } from './OrganicDialog';

interface Props {
  profile?: BrandProfile | null;
  user: User | null;
  onProfileUpdate: (p: BrandProfile) => void;
  onUserUpdate: (u: User) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onClose?: () => void;
}

const Settings: React.FC<Props> = ({ profile, user, onProfileUpdate, onUserUpdate, darkMode, toggleDarkMode, onClose }) => {
  const dialog = useOrganicDialog();
  const [formData, setFormData] = useState<BrandProfile>({
    userId: user?.id || '',
    businessName: profile?.businessName || '',
    industry: profile?.industry || '',
    targetAudience: profile?.targetAudience || '',
    brandVoice: profile?.brandVoice || '',
    keyThemes: profile?.keyThemes || '',
    brandColors: profile?.brandColors && profile?.brandColors.length > 0 
      ? profile.brandColors 
      : ['#10b981', '#3b82f6', '#f59e0b']
  });
  
  // Account State
  const [accountForm, setAccountForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });

  // Billing State
  const [wallet, setWallet] = useState<Wallet | null>(null);

  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');
  const [validationErrors, setValidationErrors] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'billing'>(user?.role === 'support' ? 'account' : 'profile');
  const [dbService] = useState(() => new UniversalDatabaseService());

  useEffect(() => {
    if (profile) {
      setFormData({
        ...profile,
        brandColors: profile.brandColors && profile.brandColors.length > 0 
          ? profile.brandColors 
          : ['#10b981', '#3b82f6', '#f59e0b']
      });
    }
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'billing') {
      paymentService.getWalletData().then(setWallet);
    }
  }, [activeTab]);

  const handleChange = (field: keyof BrandProfile, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await onProfileUpdate(formData);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (error) {
      console.error("Failed to save settings:", error);
      await dialog.alert("Failed to save settings. Please try again.");
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setValidationErrors([]);
    
    if (!user) return;

    // Validate Password Strength
    const passwordValidation = ValidationService.validatePassword(accountForm.newPassword);
    if (!passwordValidation.isValid) {
      setValidationErrors(passwordValidation.errors);
      return;
    }

    if (accountForm.newPassword !== accountForm.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    if (!accountForm.currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    try {
        // Verify current password via login check
        const loginCheck = await dbService.loginUser(user.email, accountForm.currentPassword);
        if (!loginCheck) {
             setError("Current password is incorrect.");
             return;
        }

        // Update to new password
        await dbService.updateUserPassword(user.id, accountForm.newPassword);
        
        setSaved(true);
        setAccountForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
        setTimeout(() => setSaved(false), 2000);
        
    } catch (e: any) {
        setError(e.message || "Failed to update password");
    }
  };

  const handleCancelSubscription = async () => {
    const confirmed = await dialog.confirm("Are you sure you want to cancel your Pro plan? You will lose access to premium features at the end of the billing cycle.");
    if (confirmed) {
      await paymentService.cancelSubscription();
      const updated = await paymentService.getWalletData();
      setWallet(updated);
    }
  };

  const handleUpgrade = async () => {
    if (!wallet) return;
    const cost = 499;
    if (wallet.balance < cost) {
      await dialog.alert("Insufficient balance. Please top up in the Billing section.");
      return;
    }

    const confirmed = await dialog.confirm(`Upgrade to PRO for ₱${cost}/mo?`);
    if (confirmed) {
      try {
        await paymentService.purchaseSubscription('PRO', cost);
        const updated = await paymentService.getWalletData();
        setWallet(updated);
        await dialog.alert({ message: "Upgrade Successful! Welcome to Pro.", title: "Welcome to Pro" });
      } catch (e: any) {
        await dialog.alert(e.message);
      }
    }
  };

  const handleDownloadInvoices = async () => {
    if (!wallet || wallet.transactions.length === 0) {
      await dialog.alert("No transactions found.");
      return;
    }
    const headers = "Date,ID,Description,Status,Amount\n";
    const rows = wallet.transactions.map(t => 
      `${new Date(t.date).toLocaleDateString()},${t.id},"${t.description}",${t.status},${t.type === 'CREDIT' ? '+' : '-'}₱${t.amount}`
    ).join("\n");
    
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kawayan_Invoices_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3">
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 rounded-xl hover:bg-[#273338]/5 dark:hover:bg-[#2B5748]/50 text-slate-400 transition"
              title="Go Back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="font-display text-3xl text-slate-900 dark:text-white">Settings</h1>
            <p className="text-slate-400 text-sm mt-0.5">Manage your brand preferences and experience.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-3">
           <div className="bg-white dark:bg-[#2B5748]/40 rounded-2xl border border-[#273338]/10 dark:border-[#9CB080]/20 p-3">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-2 px-2">Preferences</p>
              <nav className="space-y-0.5">
                 {user?.role !== 'support' && (
                   <button 
                     onClick={() => setActiveTab('profile')}
                     className={`w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl transition ${activeTab === 'profile' ? '' : 'text-slate-500 dark:text-slate-400 hover:bg-[#273338]/5 dark:hover:bg-[#2B5748]/50'}`}
                     style={activeTab === 'profile' ? { background: 'rgba(43, 87, 72,0.08)', color: '#2B5748' } : {}}
                   >
                     Brand Profile
                   </button>
                 )}
                 <button 
                   onClick={() => setActiveTab('account')}
                   className={`w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl transition ${activeTab === 'account' ? '' : 'text-slate-500 dark:text-slate-400 hover:bg-[#273338]/5 dark:hover:bg-[#2B5748]/50'}`}
                   style={activeTab === 'account' ? { background: 'rgba(43, 87, 72,0.08)', color: '#2B5748' } : {}}
                 >
                   Account
                 </button>
                 {user?.role !== 'support' && (
                   <button 
                     onClick={() => setActiveTab('billing')}
                     className={`w-full text-left px-3 py-2.5 text-sm font-semibold rounded-xl transition ${activeTab === 'billing' ? '' : 'text-slate-500 dark:text-slate-400 hover:bg-[#273338]/5 dark:hover:bg-[#2B5748]/50'}`}
                     style={activeTab === 'billing' ? { background: 'rgba(43, 87, 72,0.08)', color: '#2B5748' } : {}}
                   >
                     Billing
                   </button>
                 )}
              </nav>
           </div>

           {/* Theme Toggle Card */}
           <div className="bg-white dark:bg-[#2B5748]/40 rounded-2xl border border-[#273338]/10 dark:border-[#9CB080]/20 p-5">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-3">Appearance</p>
              <div className="flex gap-1.5 p-1 bg-[#273338]/5 dark:bg-[#273338] rounded-xl border border-[#273338]/10 dark:border-[#9CB080]/20">
                 <button 
                   onClick={() => darkMode && toggleDarkMode()} 
                   className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${!darkMode ? 'bg-white shadow-sm text-slate-800 dark:text-slate-800' : 'text-slate-400 hover:text-slate-600'}`}
                 >
                   <Sun className="w-3.5 h-3.5"/> Light
                 </button>
                 <button 
                   onClick={() => !darkMode && toggleDarkMode()}
                   className={`flex-1 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition ${darkMode ? 'bg-slate-700 shadow-sm text-white' : 'text-slate-400 hover:text-slate-700'}`}
                 >
                   <Moon className="w-3.5 h-3.5"/> Dark
                 </button>
              </div>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-2">
           {activeTab === 'profile' && (
             <form onSubmit={handleSaveProfile} className="bg-white dark:bg-[#2B5748]/40 rounded-xl shadow-sm border border-slate-200 dark:border-[#9CB080]/20 p-6 sm:p-8 space-y-6">
                
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-[#9CB080]/20">
                   <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <UserIcon className="w-5 h-5"/>
                   </div>
                   <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Brand Identity</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">This info guides the AI to write like you.</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Business Name</label>
                      <input 
                        type="text" 
                        value={formData.businessName}
                        onChange={(e) => handleChange('businessName', e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-white dark:bg-[#273338] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                      />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2"><Briefcase className="w-3 h-3"/> Industry</label>
                         <input 
                           type="text" 
                           value={formData.industry}
                           onChange={(e) => handleChange('industry', e.target.value)}
                           className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-white dark:bg-[#273338] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                         />
                      </div>
                      <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2"><Target className="w-3 h-3"/> Target Audience</label>
                         <input 
                           type="text" 
                           value={formData.targetAudience}
                           onChange={(e) => handleChange('targetAudience', e.target.value)}
                           className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-white dark:bg-[#273338] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                         />
                      </div>
                   </div>

                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2"><MessageCircle className="w-3 h-3"/> Brand Voice</label>
                      <input 
                        type="text" 
                        value={formData.brandVoice}
                        onChange={(e) => handleChange('brandVoice', e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-white dark:bg-[#273338] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                        placeholder="e.g. Fun, Professional, Friendly"
                      />
                   </div>

                   {/* Brand Colors & Contact */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Brand Colors (Hex)</label>
                         <div className="flex gap-2">
                           {[0,1,2].map(i => {
                             // Ensure we have a valid color string for this index
                             const currentColor = (formData.brandColors && formData.brandColors[i]) || '#10b981';
                             return (
                               <div key={i} className="flex items-center gap-1">
                                 <input 
                                   type="color"
                                   value={currentColor}
                                   onChange={(e) => {
                                     const newColors = [...(formData.brandColors || ['#10b981', '#3b82f6', '#f59e0b'])];
                                     // Fill slots if they don't exist
                                     while (newColors.length <= i) newColors.push('#000000');
                                     newColors[i] = e.target.value;
                                     handleChange('brandColors', newColors);
                                   }}
                                   className="w-8 h-8 rounded cursor-pointer border-0 p-0 overflow-hidden"
                                 />
                               </div>
                             );
                           })}
                         </div>
                      </div>
                      <div className="space-y-2">
                         <input 
                           type="email" 
                           value={formData.contactEmail || ''}
                           onChange={(e) => handleChange('contactEmail', e.target.value)}
                           placeholder="Contact Email"
                           className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-white dark:bg-[#273338] text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                         />
                         <input 
                           type="tel" 
                           value={formData.contactPhone || ''}
                           onChange={(e) => handleChange('contactPhone', e.target.value)}
                           placeholder="Contact Phone"
                           className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-white dark:bg-[#273338] text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                         />
                      </div>
                   </div>

                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Content Themes (Topics)</label>
                      <textarea 
                        value={formData.keyThemes}
                        onChange={(e) => handleChange('keyThemes', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-white dark:bg-[#273338] text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none"
                      />
                   </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-[#9CB080]/20 flex justify-end">
                   <button 
                     type="submit"
                     className={`px-6 py-2.5 rounded-full font-bold text-sm flex items-center gap-2 transition-all hover:scale-105 active:scale-95 text-white ${saved ? 'bg-[#2B5748]/90' : 'bg-[#2B5748]'}`}
                     style={{ boxShadow: '0 4px 16px -4px rgba(43, 87, 72,0.35)' }}
                   >
                     {saved ? 'Changes Saved!' : 'Save Changes'} <Save className="w-4 h-4"/>
                   </button>
                </div>
             </form>
           )}

           {activeTab === 'account' && (
             <form onSubmit={handleUpdatePassword} className="bg-white dark:bg-[#2B5748]/40 rounded-xl shadow-sm border border-slate-200 dark:border-[#9CB080]/20 p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-[#9CB080]/20">
                   <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg">
                      <Lock className="w-5 h-5"/>
                   </div>
                   <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Security & Login</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Update your account credentials.</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Email Address</label>
                      <input 
                        type="email" 
                        value={user?.email || ''} 
                        disabled
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-slate-100 dark:bg-[#273338] text-slate-500 dark:text-slate-400 cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
                   </div>

                   <hr className="border-slate-100 dark:border-[#9CB080]/20 my-4"/>

                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
                      <input 
                        type="password" 
                        value={accountForm.currentPassword}
                        onChange={(e) => setAccountForm({...accountForm, currentPassword: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-slate-50 dark:bg-[#273338] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                      <input 
                        type="password" 
                        value={accountForm.newPassword}
                        onChange={(e) => setAccountForm({...accountForm, newPassword: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-slate-50 dark:bg-[#273338] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
                      <input 
                        type="password" 
                        value={accountForm.confirmPassword}
                        onChange={(e) => setAccountForm({...accountForm, confirmPassword: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-[#9CB080]/20 bg-slate-50 dark:bg-[#273338] text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                   </div>
                </div>

                {validationErrors.length > 0 && (
                  <div className="bg-rose-50 dark:bg-rose-900/20 p-3 rounded-lg border border-rose-100 dark:border-rose-900/30">
                    <div className="flex items-center gap-2 text-rose-600 dark:text-rose-400 text-sm font-bold mb-1">
                      <AlertTriangle className="w-4 h-4" /> Password Requirements:
                    </div>
                    <ul className="list-disc list-inside text-xs text-rose-500 dark:text-rose-300 space-y-1">
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {error && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4"/> {error}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 dark:border-[#9CB080]/20 flex justify-end">
                   <button 
                     type="submit"
                     className={`px-6 py-2.5 rounded-lg font-bold text-white flex items-center gap-2 transition ${saved ? 'bg-green-600' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                   >
                     {saved ? 'Updated!' : 'Update Password'} <Save className="w-4 h-4"/>
                   </button>
                </div>
             </form>
           )}

           {activeTab === 'billing' && wallet && (
             <div className="bg-white dark:bg-[#2B5748]/40 rounded-xl shadow-sm border border-slate-200 dark:border-[#9CB080]/20 p-6 sm:p-8 space-y-6 animate-in fade-in">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-[#9CB080]/20">
                   <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <CreditCard className="w-5 h-5"/>
                   </div>
                   <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Subscription Status</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Manage your plan and billing details.</p>
                   </div>
                </div>

                <div className="bg-slate-50 dark:bg-[#273338] rounded-xl p-6 border border-slate-200 dark:border-[#9CB080]/20">
                   <div className="flex justify-between items-start">
                      <div>
                         <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Current Plan</p>
                         <h2 className="text-2xl font-black text-slate-900 dark:text-white flex items-center gap-2">
                           {wallet.subscription} 
                           {wallet.subscription === 'PRO' && <span className="bg-emerald-100 dark:bg-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs px-2 py-1 rounded-full font-bold">ACTIVE</span>}
                         </h2>
                         <p className="text-sm text-slate-500 dark:text-slate-400 mt-2">
                           {wallet.subscription === 'FREE' ? 'Upgrade to Pro for more features.' : 'Next billing date: Feb 14, 2026'}
                         </p>
                      </div>
                      <div className="text-right">
                         <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-1">Wallet Balance</p>
                         <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">₱{wallet.balance.toFixed(2)}</p>
                      </div>
                   </div>

                   {wallet.subscription === 'PRO' && (
                     <div className="mt-6 pt-6 border-t border-slate-200 dark:border-[#9CB080]/20">
                       <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-2">Plan Benefits</h4>
                       <ul className="space-y-2 mb-6">
                         <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><CheckCircle className="w-4 h-4 text-emerald-500"/> 16 Auto-Generated Posts</li>
                         <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><CheckCircle className="w-4 h-4 text-emerald-500"/> Advanced Analytics</li>
                         <li className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300"><CheckCircle className="w-4 h-4 text-emerald-500"/> Priority Support</li>
                       </ul>
                       <button 
                         onClick={handleCancelSubscription}
                         className="text-rose-600 hover:text-rose-700 text-sm font-medium hover:underline"
                       >
                         Cancel Subscription
                       </button>
                     </div>
                   )}
                </div>

                <div className="flex justify-end gap-3">
                   {wallet.subscription === 'FREE' && (
                     <button 
                       onClick={handleUpgrade}
                       className="px-4 py-2 rounded-full font-bold text-sm text-white transition-all hover:scale-105 active:scale-95 bg-[#2B5748]"
                      style={{ boxShadow: '0 4px 16px -4px rgba(43, 87, 72,0.35)' }}
                     >
                       Upgrade to Pro
                     </button>
                   )}
                   <button 
                     onClick={handleDownloadInvoices}
                     className="px-4 py-2 border border-slate-200 dark:border-[#9CB080]/20 text-slate-600 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-[#2B5748]/50 transition"
                   >
                     View Invoices
                   </button>
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default Settings;