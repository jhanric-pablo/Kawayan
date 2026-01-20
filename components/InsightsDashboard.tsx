import React, { useEffect, useState } from 'react';
import { Users, Link as LinkIcon, RefreshCcw, Trash2, ExternalLink, Heart, Image as ImageIcon, UserPlus } from 'lucide-react';
import { socialService, SocialPlatformData } from '../services/socialService';

const InsightsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [platformData, setPlatformData] = useState<SocialPlatformData[]>([]);

  useEffect(() => {
    loadData();
    
    // Listener for Extension Updates
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'KAWAYAN_STATS_UPDATED_CLIENT') {
        const stats = event.data.data;
        console.log("React received updated stats from Extension:", stats);
        
        // Persist to storage so it survives reload
        socialService.updateStats(stats.platform, stats);

        setPlatformData(prev => {
           // Update the specific platform data
           // We need to preserve the username if it's not in the update (usually scraper doesn't return username, just stats)
           const existing = prev.find(p => p.platform === stats.platform);
           const filtered = prev.filter(p => p.platform !== stats.platform);
           
           return [...filtered, {
             platform: stats.platform,
             connected: true,
             username: existing?.username, // Preserve username
             followers: stats.followers,
             following: stats.following,
             likes: stats.likes, // TikTok
             posts: stats.posts, // Instagram
             engagement: stats.engagement || 0,
             reach: stats.reach || 0 // FB
           } as any];
        });
        
        alert(`Stats updated successfully for ${stats.platform}!`);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadData = async () => {
    setLoading(true);
    const data: SocialPlatformData[] = [];
    
    // Fetch stored connections
    const status = socialService.getConnectionStatus();
    
    if (status.facebook) {
      const fb = await socialService.getInsights('facebook');
      if (fb) data.push(fb);
    }
    if (status.instagram) {
      const ig = await socialService.getInsights('instagram');
      if (ig) data.push(ig);
    }
    if (status.tiktok) {
      const tt = await socialService.getInsights('tiktok');
      if (tt) data.push(tt);
    }
    setPlatformData(data);
    setLoading(false);
  };

  const handleConnect = async (platform: 'facebook' | 'instagram' | 'tiktok') => {
    const username = prompt(`Enter your ${platform} username/handle:`);
    if (!username) return;

    try {
      setLoading(true);
      await socialService.connectAccount(platform, username);
      await loadData();
    } catch (error) {
      console.error('Failed to connect:', error);
      alert('Failed to connect. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (window.confirm(`Disconnect ${platform}?`)) {
      await socialService.disconnectAccount(platform);
      await loadData();
    }
  };

  const handleUpdateStats = (platform: string, username?: string) => {
    if ((platform === 'instagram' || platform === 'tiktok') && !username) {
        alert("Username is missing. Please reconnect.");
        return;
    }

    // Trigger Extension
    window.postMessage({
      type: 'KAWAYAN_UPDATE_STATS',
      platform: platform,
      username: username
    }, '*');
  };

  const renderPlatformCard = (platform: 'facebook' | 'instagram' | 'tiktok') => {
    const data = platformData.find(p => p.platform === platform);
    const isConnected = !!data;
    
    let colorClass = '';
    let icon = null;
    
    if (platform === 'facebook') {
        colorClass = 'bg-[#1877F2]';
        icon = <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>;
    } else if (platform === 'instagram') {
        colorClass = 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]';
        icon = <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6 text-white"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>;
    } else {
        colorClass = 'bg-black';
        icon = <svg viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6 text-white"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>;
    }

    return (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden flex flex-col h-full">
            {/* Header */}
            <div className={`p-4 flex justify-between items-start ${colorClass} bg-opacity-10 dark:bg-opacity-20`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-xl shadow-lg ${colorClass}`}>
                        {icon}
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 dark:text-white capitalize">{platform}</h3>
                        {isConnected ? (
                            <a href="#" className="text-xs text-slate-500 dark:text-slate-300 hover:underline flex items-center gap-1">
                                @{data.username} <ExternalLink className="w-3 h-3"/>
                            </a>
                        ) : (
                            <span className="text-xs text-slate-400">Not Connected</span>
                        )}
                    </div>
                </div>
                {isConnected && (
                    <button onClick={() => handleDisconnect(platform)} className="text-slate-400 hover:text-rose-500 transition">
                        <Trash2 className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Stats Body */}
            <div className="p-6 flex-1">
                {isConnected ? (
                    <div className="grid grid-cols-2 gap-6">
                        <div className="space-y-1">
                            <p className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1"><Users className="w-3 h-3"/> Followers</p>
                            <p className="text-2xl font-black text-slate-900 dark:text-white">{data.followers.toLocaleString()}</p>
                        </div>
                        
                        {platform === 'facebook' && (
                            <div className="space-y-1">
                                <p className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1"><Users className="w-3 h-3"/> Reach</p>
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{(data.reach as any || 0).toLocaleString()}</p>
                            </div>
                        )}

                        {platform === 'instagram' && (
                            <>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1"><UserPlus className="w-3 h-3"/> Following</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{(data.following || 0).toLocaleString()}</p>
                                </div>
                                <div className="space-y-1 mt-4">
                                    <p className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1"><ImageIcon className="w-3 h-3"/> Posts</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{(data as any).posts || 0}</p>
                                </div>
                            </>
                        )}

                        {platform === 'tiktok' && (
                            <>
                                <div className="space-y-1">
                                    <p className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1"><Heart className="w-3 h-3"/> Likes</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{(data.likes || 0).toLocaleString()}</p>
                                </div>
                                <div className="space-y-1 mt-4">
                                    <p className="text-xs text-slate-500 uppercase font-bold flex items-center gap-1"><UserPlus className="w-3 h-3"/> Following</p>
                                    <p className="text-2xl font-black text-slate-900 dark:text-white">{(data.following || 0).toLocaleString()}</p>
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-center text-slate-400 space-y-2 py-8">
                        <LinkIcon className="w-12 h-12 opacity-20" />
                        <p className="text-sm">Connect account to view stats</p>
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-850">
                {isConnected ? (
                    <button 
                        onClick={() => handleUpdateStats(platform, data.username)}
                        className="w-full py-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 rounded-lg text-sm font-bold text-slate-700 dark:text-white hover:bg-emerald-50 dark:hover:bg-emerald-900/30 hover:border-emerald-200 hover:text-emerald-700 transition flex items-center justify-center gap-2 shadow-sm"
                    >
                        <RefreshCcw className="w-4 h-4" /> Update via Extension
                    </button>
                ) : (
                    <button 
                        onClick={() => handleConnect(platform)}
                        className="w-full py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-lg text-sm font-bold hover:opacity-90 transition shadow-lg"
                    >
                        Connect {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </button>
                )}
            </div>
        </div>
    );
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div>
           <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Social Insights</h1>
           <p className="text-slate-500 dark:text-slate-400 mt-1">Manage and track your connected pages directly.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {renderPlatformCard('facebook')}
            {renderPlatformCard('instagram')}
            {renderPlatformCard('tiktok')}
        </div>

        <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-xl flex items-start gap-3 border border-blue-100 dark:border-blue-800">
            <div className="p-2 bg-blue-100 dark:bg-blue-800 rounded-lg text-blue-600 dark:text-blue-300">
                <RefreshCcw className="w-5 h-5" />
            </div>
            <div>
                <h4 className="font-bold text-slate-800 dark:text-white text-sm">How "Update via Extension" works</h4>
                <p className="text-xs text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    Clicking the update button will briefly open the platform's official page in a new tab. 
                    Our secure extension will scrape the latest stats from your <b>logged-in session</b> and automatically update this dashboard.
                    Make sure you are logged in to the respective platforms in this browser.
                </p>
            </div>
        </div>
    </div>
  );
};

export default InsightsDashboard;