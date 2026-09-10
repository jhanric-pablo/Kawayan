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

  const tabs = [
    ...(user?.role !== 'support' ? [{ id: 'profile' as const, label: 'Brand Profile' }] : []),
    { id: 'account' as const, label: 'Account' },
    ...(user?.role !== 'support' ? [{ id: 'billing' as const, label: 'Billing' }] : []),
  ];

  const fieldLabel = 'block text-sm font-semibold mb-1.5';
  const labelStyle = { color: 'var(--fg)' };

  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in">

      <div className="page-head">
        <div className="flex items-center gap-3">
          {onClose && (
            <button
              onClick={onClose}
              className="btn btn-ghost btn-sm !p-2"
              title="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
          )}
          <div>
            <h1 className="page-head__title">Settings</h1>
            <p className="page-head__sub">Manage your brand preferences and experience.</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Navigation Sidebar */}
        <div className="md:col-span-1 space-y-3">
           <div className="surface p-3">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-2 px-2" style={{ color: 'var(--fg-subtle)' }}>Preferences</p>
              <nav className="space-y-0.5">
                 {tabs.map((t) => (
                   <button
                     key={t.id}
                     onClick={() => setActiveTab(t.id)}
                     className={`w-full text-left px-3 py-2.5 text-sm font-semibold rounded-[var(--r)] transition ${activeTab === t.id ? 'nav-item-active' : 'btn-ghost'}`}
                   >
                     {t.label}
                   </button>
                 ))}
              </nav>
           </div>

           {/* Theme Toggle Card */}
           <div className="surface p-5">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] mb-3" style={{ color: 'var(--fg-subtle)' }}>Appearance</p>
              <div className="flex gap-1 p-1 rounded-[var(--r)] border" style={{ background: 'var(--bg-alt)', borderColor: 'var(--border)' }}>
                 <button
                   onClick={() => darkMode && toggleDarkMode()}
                   className="flex-1 py-2 rounded-[var(--r-sm)] text-xs font-bold flex items-center justify-center gap-1.5 transition"
                   style={!darkMode
                     ? { background: 'var(--card)', boxShadow: 'var(--shadow-xs)', color: 'var(--fg)' }
                     : { color: 'var(--fg-subtle)' }}
                 >
                   <Sun className="w-3.5 h-3.5"/> Light
                 </button>
                 <button
                   onClick={() => !darkMode && toggleDarkMode()}
                   className="flex-1 py-2 rounded-[var(--r-sm)] text-xs font-bold flex items-center justify-center gap-1.5 transition"
                   style={darkMode
                     ? { background: 'var(--card)', boxShadow: 'var(--shadow-xs)', color: 'var(--fg)' }
                     : { color: 'var(--fg-subtle)' }}
                 >
                   <Moon className="w-3.5 h-3.5"/> Dark
                 </button>
              </div>
           </div>
        </div>

        {/* Main Content Area */}
        <div className="md:col-span-2">
           {activeTab === 'profile' && (
             <form onSubmit={handleSaveProfile} className="surface p-6 sm:p-8 space-y-6">

                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                   <div className="w-10 h-10 rounded-[var(--r)] flex items-center justify-center shrink-0" style={{ background: 'var(--kw-green-pale)', color: 'var(--primary)' }}>
                      <UserIcon className="w-5 h-5"/>
                   </div>
                   <div>
                      <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--fg)' }}>Brand identity</h3>
                      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>This info guides the AI to write like you.</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <div>
                      <label className={fieldLabel} style={labelStyle}>Business name</label>
                      <input
                        type="text"
                        value={formData.businessName}
                        onChange={(e) => handleChange('businessName', e.target.value)}
                        className="input"
                      />
                   </div>

                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                         <label className={`${fieldLabel} flex items-center gap-2`} style={labelStyle}><Briefcase className="w-3.5 h-3.5"/> Industry</label>
                         <input
                           type="text"
                           value={formData.industry}
                           onChange={(e) => handleChange('industry', e.target.value)}
                           className="input"
                         />
                      </div>
                      <div>
                         <label className={`${fieldLabel} flex items-center gap-2`} style={labelStyle}><Target className="w-3.5 h-3.5"/> Target audience</label>
                         <input
                           type="text"
                           value={formData.targetAudience}
                           onChange={(e) => handleChange('targetAudience', e.target.value)}
                           className="input"
                         />
                      </div>
                   </div>

                   <div>
                      <label className={`${fieldLabel} flex items-center gap-2`} style={labelStyle}><MessageCircle className="w-3.5 h-3.5"/> Brand voice</label>
                      <input
                        type="text"
                        value={formData.brandVoice}
                        onChange={(e) => handleChange('brandVoice', e.target.value)}
                        className="input"
                        placeholder="e.g. Fun, Professional, Friendly"
                      />
                   </div>

                   {/* Brand Colors & Contact */}
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                         <label className={fieldLabel} style={labelStyle}>Brand colors (hex)</label>
                         <div className="flex gap-2">
                           {[0,1,2].map(i => {
                             const currentColor = (formData.brandColors && formData.brandColors[i]) || '#10b981';
                             return (
                               <div key={i} className="flex items-center gap-1">
                                 <input
                                   type="color"
                                   value={currentColor}
                                   onChange={(e) => {
                                     const newColors = [...(formData.brandColors || ['#10b981', '#3b82f6', '#f59e0b'])];
                                     while (newColors.length <= i) newColors.push('#000000');
                                     newColors[i] = e.target.value;
                                     handleChange('brandColors', newColors);
                                   }}
                                   className="w-9 h-9 rounded-[var(--r-sm)] cursor-pointer border p-0 overflow-hidden"
                                   style={{ borderColor: 'var(--border-strong)' }}
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
                           placeholder="Contact email"
                           className="input"
                         />
                         <input
                           type="tel"
                           value={formData.contactPhone || ''}
                           onChange={(e) => handleChange('contactPhone', e.target.value)}
                           placeholder="Contact phone"
                           className="input"
                         />
                      </div>
                   </div>

                   <div>
                      <label className={fieldLabel} style={labelStyle}>Content themes (topics)</label>
                      <textarea
                        value={formData.keyThemes}
                        onChange={(e) => handleChange('keyThemes', e.target.value)}
                        rows={4}
                        className="input resize-none"
                      />
                   </div>
                </div>

                <div className="pt-4 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                   <button type="submit" className="btn btn-primary">
                     {saved ? 'Changes saved' : 'Save changes'} <Save className="w-4 h-4"/>
                   </button>
                </div>
             </form>
           )}

           {activeTab === 'account' && (
             <form onSubmit={handleUpdatePassword} className="surface p-6 sm:p-8 space-y-6">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                   <div className="w-10 h-10 rounded-[var(--r)] flex items-center justify-center shrink-0" style={{ background: 'var(--kw-green-pale)', color: 'var(--primary)' }}>
                      <Lock className="w-5 h-5"/>
                   </div>
                   <div>
                      <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--fg)' }}>Security &amp; login</h3>
                      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Update your account credentials.</p>
                   </div>
                </div>

                <div className="space-y-4">
                   <div>
                      <label className={fieldLabel} style={labelStyle}>Email address</label>
                      <input
                        type="email"
                        value={user?.email || ''}
                        disabled
                        className="input opacity-60 cursor-not-allowed"
                      />
                      <p className="text-xs mt-1" style={{ color: 'var(--fg-subtle)' }}>Email cannot be changed.</p>
                   </div>

                   <hr className="divider my-4"/>

                   <div>
                      <label className={fieldLabel} style={labelStyle}>Current password</label>
                      <input
                        type="password"
                        value={accountForm.currentPassword}
                        onChange={(e) => setAccountForm({...accountForm, currentPassword: e.target.value})}
                        className="input"
                      />
                   </div>
                   <div>
                      <label className={fieldLabel} style={labelStyle}>New password</label>
                      <input
                        type="password"
                        value={accountForm.newPassword}
                        onChange={(e) => setAccountForm({...accountForm, newPassword: e.target.value})}
                        className="input"
                      />
                   </div>
                   <div>
                      <label className={fieldLabel} style={labelStyle}>Confirm new password</label>
                      <input
                        type="password"
                        value={accountForm.confirmPassword}
                        onChange={(e) => setAccountForm({...accountForm, confirmPassword: e.target.value})}
                        className="input"
                      />
                   </div>
                </div>

                {validationErrors.length > 0 && (
                  <div className="p-3 rounded-[var(--r)] border" style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--danger) 24%, transparent)' }}>
                    <div className="flex items-center gap-2 text-sm font-bold mb-1" style={{ color: 'var(--danger)' }}>
                      <AlertTriangle className="w-4 h-4" /> Password requirements
                    </div>
                    <ul className="list-disc list-inside text-xs space-y-1" style={{ color: 'var(--danger)' }}>
                      {validationErrors.map((err, i) => (
                        <li key={i}>{err}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {error && (
                  <div className="p-3 rounded-[var(--r)] text-sm flex items-center gap-2 border" style={{ background: 'color-mix(in srgb, var(--danger) 8%, transparent)', borderColor: 'color-mix(in srgb, var(--danger) 24%, transparent)', color: 'var(--danger)' }}>
                    <AlertTriangle className="w-4 h-4"/> {error}
                  </div>
                )}

                <div className="pt-4 border-t flex justify-end" style={{ borderColor: 'var(--border)' }}>
                   <button type="submit" className="btn btn-primary">
                     {saved ? 'Updated' : 'Update password'} <Save className="w-4 h-4"/>
                   </button>
                </div>
             </form>
           )}

           {activeTab === 'billing' && wallet && (
             <div className="surface p-6 sm:p-8 space-y-6 animate-fade-in">
                <div className="flex items-center gap-3 pb-4 border-b" style={{ borderColor: 'var(--border)' }}>
                   <div className="w-10 h-10 rounded-[var(--r)] flex items-center justify-center shrink-0" style={{ background: 'var(--kw-green-pale)', color: 'var(--primary)' }}>
                      <CreditCard className="w-5 h-5"/>
                   </div>
                   <div>
                      <h3 className="font-display text-lg font-semibold" style={{ color: 'var(--fg)' }}>Subscription status</h3>
                      <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>Manage your plan and billing details.</p>
                   </div>
                </div>

                <div className="rounded-[var(--r-lg)] p-6 border" style={{ background: 'var(--bg-alt)', borderColor: 'var(--border)' }}>
                   <div className="flex justify-between items-start gap-3">
                      <div>
                         <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-1" style={{ color: 'var(--fg-muted)' }}>Current plan</p>
                         <h2 className="font-display text-2xl font-semibold flex items-center gap-2" style={{ color: 'var(--fg)' }}>
                           {wallet.subscription}
                           {wallet.subscription === 'PRO' && <span className="badge badge-green">Active</span>}
                         </h2>
                         <p className="text-sm mt-2" style={{ color: 'var(--fg-muted)' }}>
                           {wallet.subscription === 'FREE' ? 'Upgrade to Pro for more features.' : 'Next billing date: Feb 14, 2026'}
                         </p>
                      </div>
                      <div className="text-right shrink-0">
                         <p className="text-[11px] font-bold uppercase tracking-[0.1em] mb-1" style={{ color: 'var(--fg-muted)' }}>Wallet balance</p>
                         <p className="font-display text-xl font-semibold" style={{ color: 'var(--primary)' }}>₱{wallet.balance.toFixed(2)}</p>
                      </div>
                   </div>

                   {wallet.subscription === 'PRO' && (
                     <div className="mt-6 pt-6 border-t" style={{ borderColor: 'var(--border)' }}>
                       <h4 className="text-sm font-bold mb-2" style={{ color: 'var(--fg)' }}>Plan benefits</h4>
                       <ul className="space-y-2 mb-6">
                         {['16 auto-generated posts', 'Advanced analytics', 'Priority support'].map((b) => (
                           <li key={b} className="flex items-center gap-2 text-sm" style={{ color: 'var(--fg-muted)' }}>
                             <CheckCircle className="w-4 h-4" style={{ color: 'var(--success)' }}/> {b}
                           </li>
                         ))}
                       </ul>
                       <button onClick={handleCancelSubscription} className="btn btn-danger btn-sm">
                         Cancel subscription
                       </button>
                     </div>
                   )}
                </div>

                <div className="flex justify-end gap-3">
                   {wallet.subscription === 'FREE' && (
                     <button onClick={handleUpgrade} className="btn btn-primary">
                       Upgrade to Pro
                     </button>
                   )}
                   <button onClick={handleDownloadInvoices} className="btn btn-outline">
                     View invoices
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