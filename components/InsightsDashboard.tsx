import React, { useEffect, useState } from 'react';
import { 
  Users, RefreshCcw, ExternalLink, Heart, 
  Image as ImageIcon, UserPlus, Zap, BarChart3,
  Facebook, Instagram, MessageCircle, X
} from 'lucide-react';
import { socialService, SocialPlatformData } from '../services/socialService';

const InsightsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [username, setUsername] = useState('');
  const [platformData, setPlatformData] = useState<SocialPlatformData[]>([]);

  useEffect(() => {
    loadData();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'KAWAYAN_STATS_UPDATED_CLIENT') {
        const stats = event.data.data;
        socialService.updateStats(stats.platform, stats);
        loadData(); // Reload from storage
        setLoading(false);
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadData = async () => {
    const data: SocialPlatformData[] = [];
    const status = socialService.getConnectionStatus();
    const platforms: ('facebook' | 'instagram' | 'tiktok')[] = ['facebook', 'instagram', 'tiktok'];
    
    for (const p of platforms) {
      if (status[p]) {
        const insights = await socialService.getInsights(p);
        if (insights) data.push(insights);
      }
    }
    setPlatformData(data);
  };

  const handleSync = async (platform: 'facebook' | 'instagram' | 'tiktok') => {
    if (!username.trim()) {
      alert("Please enter your username first!");
      return;
    }

    setLoading(true);
    
    // Connect locally
    await socialService.connectAccount(platform, username);
    
    // Trigger Extension
    window.postMessage({
      type: 'KAWAYAN_UPDATE_STATS',
      platform: platform,
      username: username
    }, '*');
  };

  const handleDisconnect = async (platform: string) => {
    await socialService.disconnectAccount(platform);
    loadData();
  };

  return (
    <div className="max-w-4xl mx-auto py-10 px-4 space-y-10 animate-in fade-in duration-500">
      <div className="text-center space-y-2">
        <h1 className="text-4xl font-black text-slate-900 dark:text-white">Social Insights</h1>
        <p className="text-slate-500">Sync your social media stats in one click using the Kawayan Extension.</p>
      </div>

      {/* Connection Box */}
      <div className="bg-white dark:bg-slate-800 p-8 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-bold text-slate-400 uppercase mb-2">Your Username / Handle</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. kawayan_cafe"
              className="w-full px-6 py-4 bg-slate-50 dark:bg-slate-900 border-2 border-slate-100 dark:border-slate-700 rounded-2xl text-xl font-bold focus:border-emerald-500 outline-none transition-all"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <button 
              onClick={() => handleSync('facebook')}
              disabled={loading}
              className="flex items-center justify-center gap-3 p-4 bg-[#1877F2] text-white rounded-2xl font-bold hover:opacity-90 transition shadow-lg disabled:opacity-50"
            >
              <Facebook className="w-5 h-5" /> Sync Facebook
            </button>
            <button 
              onClick={() => handleSync('instagram')}
              disabled={loading}
              className="flex items-center justify-center gap-3 p-4 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] text-white rounded-2xl font-bold hover:opacity-90 transition shadow-lg disabled:opacity-50"
            >
              <Instagram className="w-5 h-5" /> Sync Instagram
            </button>
            <button 
              onClick={() => handleSync('tiktok')}
              disabled={loading}
              className="flex items-center justify-center gap-3 p-4 bg-black text-white rounded-2xl font-bold hover:opacity-90 transition shadow-lg disabled:opacity-50"
            >
              <MessageCircle className="w-5 h-5" /> Sync TikTok
            </button>
          </div>
        </div>
      </div>

      {/* Results */}
      <div className="space-y-6">
        {platformData.length > 0 && (
          <h2 className="text-xl font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-emerald-500" /> Connected Channels
          </h2>
        )}

        <div className="grid grid-cols-1 gap-6">
          {platformData.map((data) => (
            <div key={data.platform} className="bg-white dark:bg-slate-800 p-6 rounded-3xl border border-slate-200 dark:border-slate-700 shadow-sm relative group">
              <button 
                onClick={() => handleDisconnect(data.platform)}
                className="absolute top-4 right-4 p-2 text-slate-300 hover:text-rose-500 transition"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="flex flex-col md:flex-row gap-8 items-center">
                <div className="flex items-center gap-4 min-w-[200px]">
                  <div className={`p-3 rounded-2xl ${
                    data.platform === 'facebook' ? 'bg-[#1877F2]' : 
                    data.platform === 'instagram' ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]' : 
                    'bg-black'
                  } text-white`}>
                    {data.platform === 'facebook' ? <Facebook className="w-6 h-6" /> : 
                     data.platform === 'instagram' ? <Instagram className="w-6 h-6" /> : 
                     <MessageCircle className="w-6 h-6" />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white capitalize">{data.platform}</h3>
                    <p className="text-xs text-slate-500">@{data.username}</p>
                  </div>
                </div>

                <div className="flex-1 grid grid-cols-2 sm:grid-cols-4 gap-4 w-full">
                  <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Followers</p>
                    <p className="text-xl font-black text-slate-900 dark:text-white">{data.followers.toLocaleString()}</p>
                  </div>
                  
                  {data.platform === 'facebook' && (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Views</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">{(data as any).views || 0}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Interactions</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">{(data as any).interactions || 0}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Visits</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">{(data as any).visits || 0}</p>
                      </div>
                    </>
                  )}

                  {data.platform === 'instagram' && (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Following</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">{data.following || 0}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Posts</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">{(data as any).posts || 0}</p>
                      </div>
                    </>
                  )}

                  {data.platform === 'tiktok' && (
                    <>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Likes</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">{data.likes || 0}</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-2xl text-center">
                        <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">Following</p>
                        <p className="text-xl font-black text-slate-900 dark:text-white">{data.following || 0}</p>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex flex-col items-center justify-center text-white">
           <Zap className="w-12 h-12 text-emerald-400 animate-pulse mb-4" />
           <p className="text-xl font-bold">Extension is Syncing...</p>
           <p className="text-slate-400 mt-2">Opening tab to scrape latest data.</p>
        </div>
      )}
    </div>
  );
};

export default InsightsDashboard;