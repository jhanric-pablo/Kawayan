import React, { useState, useEffect } from 'react';
import { BrandProfile, User } from '../types';
import { Save, User as UserIcon, MessageCircle, Target, Briefcase, Moon, Sun, Monitor, ArrowLeft, Lock, CreditCard, AlertTriangle, CheckCircle } from 'lucide-react';
import { paymentService, Wallet } from '../services/paymentService';

interface Props {
  profile: BrandProfile;
  user: User | null;
  onProfileUpdate: (p: BrandProfile) => void;
  onUserUpdate: (u: User) => void;
  darkMode: boolean;
  toggleDarkMode: () => void;
  onClose?: () => void;
}

const Settings: React.FC<Props> = ({ profile, user, onProfileUpdate, onUserUpdate, darkMode, toggleDarkMode, onClose }) => {
  const [formData, setFormData] = useState<BrandProfile>(profile);
  
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
  const [activeTab, setActiveTab] = useState<'profile' | 'account' | 'billing'>('profile');

  useEffect(() => {
    setFormData(profile);
  }, [profile]);

  useEffect(() => {
    if (activeTab === 'billing') {
      paymentService.getWalletData().then(setWallet);
    }
  }, [activeTab]);

  const handleChange = (field: keyof BrandProfile, value: string) => {
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
      alert("Failed to save settings. Please try again.");
    }
  };

  const handleUpdatePassword = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    if (!user) return;

    if (accountForm.newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }

    if (accountForm.newPassword !== accountForm.confirmPassword) {
      setError("New passwords do not match.");
      return;
    }

    // Simulate password check (In real app, this goes to backend)
    // Here we just check if current password field is not empty as a basic check
    if (!accountForm.currentPassword) {
      setError("Please enter your current password.");
      return;
    }

    // Mock Update
    const updatedUser = { 
      ...user, 
      passwordHash: `client_${accountForm.newPassword}` // Update mock hash
    };
    
    onUserUpdate(updatedUser);
    setSaved(true);
    setAccountForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setTimeout(() => setSaved(false), 2000);
  };

  const handleCancelSubscription = async () => {
    if (window.confirm("Are you sure you want to cancel your Pro plan? You will lose access to premium features at the end of the billing cycle.")) {
      await paymentService.cancelSubscription();
      const updated = await paymentService.getWalletData();
      setWallet(updated);
    }
  };

  const handleUpgrade = async () => {
    if (!wallet) return;
    const cost = 499;
    if (wallet.balance < cost) {
      alert("Insufficient balance. Please top up in the Billing section.");
      return;
    }

    if (window.confirm(`Upgrade to PRO for ₱${cost}/mo?`)) {
      try {
        await paymentService.purchaseSubscription('PRO', cost);
        const updated = await paymentService.getWalletData();
        setWallet(updated);
        alert("Upgrade Successful! Welcome to Pro.");
      } catch (e: any) {
        alert(e.message);
      }
    }
  };

  const handleDownloadInvoices = () => {
    if (!wallet || wallet.transactions.length === 0) {
      alert("No transactions found.");
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
        <div className="flex items-center gap-4">
          {onClose && (
            <button 
              onClick={onClose}
              className="p-2 rounded-full hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-500 dark:text-slate-400 transition"
              title="Go Back"
            >
              <ArrowLeft className="w-6 h-6" />
            </button>
          )}
          <div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Settings</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage your brand preferences and app experience.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-4">
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-4">
              <h3 className="font-bold text-slate-800 dark:text-white mb-4 px-2">Preferences</h3>
              <nav className="space-y-1">
                 <button 
                   onClick={() => setActiveTab('profile')}
                   className={`w-full text-left px-3 py-2 font-medium rounded-lg transition ${activeTab === 'profile' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                 >
                   Brand Profile
                 </button>
                 <button 
                   onClick={() => setActiveTab('account')}
                   className={`w-full text-left px-3 py-2 font-medium rounded-lg transition ${activeTab === 'account' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                 >
                   Account
                 </button>
                 <button 
                   onClick={() => setActiveTab('billing')}
                   className={`w-full text-left px-3 py-2 font-medium rounded-lg transition ${activeTab === 'billing' ? 'bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'}`}
                 >
                   Billing
                 </button>
              </nav>
           </div>

           {/* Theme Toggle Card */}
           <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6">
              <h3 className="font-bold text-slate-800 dark:text-white mb-2">Appearance</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Choose your interface theme.</p>
              <div className="flex gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
                 <button 
                   onClick={() => darkMode && toggleDarkMode()} 
                   className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition ${!darkMode ? 'bg-white shadow text-slate-800' : 'text-slate-500 hover:text-slate-300'}`}
                 >
                   <Sun className="w-4 h-4"/> Light
                 </button>
                 <button 
                   onClick={() => !darkMode && toggleDarkMode()}
                   className={`flex-1 py-2 rounded-md text-sm font-medium flex items-center justify-center gap-2 transition ${darkMode ? 'bg-slate-700 shadow text-white' : 'text-slate-500 hover:text-slate-700'}`}
                 >
                   <Moon className="w-4 h-4"/> Dark
                 </button>
              </div>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-2">
           {activeTab === 'profile' && (
             <form onSubmit={handleSaveProfile} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6">
                
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
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
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                      />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2"><Briefcase className="w-3 h-3"/> Industry</label>
                         <input 
                           type="text" 
                           value={formData.industry}
                           onChange={(e) => handleChange('industry', e.target.value)}
                           className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                         />
                      </div>
                      <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2"><Target className="w-3 h-3"/> Target Audience</label>
                         <input 
                           type="text" 
                           value={formData.targetAudience}
                           onChange={(e) => handleChange('targetAudience', e.target.value)}
                           className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                         />
                      </div>
                   </div>

                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1 flex items-center gap-2"><MessageCircle className="w-3 h-3"/> Brand Voice</label>
                      <input 
                        type="text" 
                        value={formData.brandVoice}
                        onChange={(e) => handleChange('brandVoice', e.target.value)}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition"
                        placeholder="e.g. Fun, Professional, Friendly"
                      />
                   </div>

                   {/* Brand Colors & Contact */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                         <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Brand Colors (Hex)</label>
                         <div className="flex gap-2">
                           {[0,1,2].map(i => (
                             <div key={i} className="flex items-center gap-1">
                               <input 
                                 type="color"
                                 value={formData.brandColors?.[i] || '#000000'}
                                 onChange={(e) => {
                                   const newColors = [...(formData.brandColors || [])];
                                   newColors[i] = e.target.value;
                                   handleChange('brandColors', newColors as any);
                                 }}
                                 className="w-8 h-8 rounded cursor-pointer border-0 p-0"
                               />
                             </div>
                           ))}
                         </div>
                      </div>
                      <div className="space-y-2">
                         <input 
                           type="email" 
                           value={formData.contactEmail || ''}
                           onChange={(e) => handleChange('contactEmail', e.target.value)}
                           placeholder="Contact Email"
                           className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                         />
                         <input 
                           type="tel" 
                           value={formData.contactPhone || ''}
                           onChange={(e) => handleChange('contactPhone', e.target.value)}
                           placeholder="Contact Phone"
                           className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                         />
                      </div>
                   </div>

                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Content Themes (Topics)</label>
                      <textarea 
                        value={formData.keyThemes}
                        onChange={(e) => handleChange('keyThemes', e.target.value)}
                        rows={4}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-emerald-500 outline-none transition resize-none"
                      />
                   </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
                   <button 
                     type="submit"
                     className={`px-6 py-2.5 rounded-lg font-bold text-white flex items-center gap-2 transition transform active:scale-95 ${saved ? 'bg-green-600 hover:bg-green-700' : 'bg-slate-900 dark:bg-emerald-600 hover:bg-slate-800 dark:hover:bg-emerald-700'}`}
                   >
                     {saved ? 'Changes Saved!' : 'Save Changes'} <Save className="w-4 h-4"/>
                   </button>
                </div>
             </form>
           )}

           {activeTab === 'account' && (
             <form onSubmit={handleUpdatePassword} className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
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
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-100 dark:bg-slate-900 text-slate-500 dark:text-slate-400 cursor-not-allowed"
                      />
                      <p className="text-xs text-slate-400 mt-1">Email cannot be changed.</p>
                   </div>

                   <hr className="border-slate-100 dark:border-slate-700 my-4"/>

                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Current Password</label>
                      <input 
                        type="password" 
                        value={accountForm.currentPassword}
                        onChange={(e) => setAccountForm({...accountForm, currentPassword: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">New Password</label>
                      <input 
                        type="password" 
                        value={accountForm.newPassword}
                        onChange={(e) => setAccountForm({...accountForm, newPassword: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                   </div>
                   <div>
                      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-1">Confirm New Password</label>
                      <input 
                        type="password" 
                        value={accountForm.confirmPassword}
                        onChange={(e) => setAccountForm({...accountForm, confirmPassword: e.target.value})}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-slate-50 dark:bg-slate-900 text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                      />
                   </div>
                </div>

                {error && (
                  <div className="p-3 bg-rose-50 dark:bg-rose-900/20 text-rose-600 dark:text-rose-400 text-sm rounded-lg flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4"/> {error}
                  </div>
                )}

                <div className="pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
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
             <div className="bg-white dark:bg-slate-800 rounded-xl shadow-sm border border-slate-200 dark:border-slate-700 p-6 sm:p-8 space-y-6 animate-in fade-in">
                <div className="flex items-center gap-3 pb-4 border-b border-slate-100 dark:border-slate-700">
                   <div className="p-2 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400 rounded-lg">
                      <CreditCard className="w-5 h-5"/>
                   </div>
                   <div>
                      <h3 className="text-lg font-bold text-slate-900 dark:text-white">Subscription Status</h3>
                      <p className="text-sm text-slate-500 dark:text-slate-400">Manage your plan and billing details.</p>
                   </div>
                </div>

                <div className="bg-slate-50 dark:bg-slate-900 rounded-xl p-6 border border-slate-200 dark:border-slate-700">
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
                     <div className="mt-6 pt-6 border-t border-slate-200 dark:border-slate-700">
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
                       className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 transition"
                     >
                       Upgrade to Pro
                     </button>
                   )}
                   <button 
                     onClick={handleDownloadInvoices}
                     className="px-4 py-2 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 rounded-lg font-medium hover:bg-slate-50 dark:hover:bg-slate-700 transition"
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