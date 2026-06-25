import React, { useEffect, useState } from 'react';
import { 
  Users, RefreshCcw, ExternalLink, Heart, 
  Image as ImageIcon, UserPlus, Zap, BarChart3,
  Facebook, Instagram, MessageCircle, X, Eye, 
  UserMinus, MousePointer2, TrendingUp
} from 'lucide-react';
import { socialService, SocialPlatformData } from '../services/socialService';
import { useOrganicDialog } from './OrganicDialog';

const InsightsDashboard: React.FC = () => {
  const dialog = useOrganicDialog();
  const [loading, setLoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [targetPlatform, setTargetPlatform] = useState<'facebook' | 'instagram' | 'tiktok' | null>(null);
  const [modalUsername, setModalUsername] = useState('');
  const [platformData, setPlatformData] = useState<SocialPlatformData[]>([]);

  useEffect(() => {
    loadData();
    
    const handleMessage = (event: MessageEvent) => {
      if (event.data.type === 'KAWAYAN_STATS_UPDATED_CLIENT') {
        const stats = event.data.data;
        socialService.updateStats(stats.platform, stats);
        loadData();
        setLoading(false);
        setShowSyncModal(false);
        setModalUsername('');
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const loadData = async () => {
    const data: SocialPlatformData[] = [];
    const status = await socialService.fetchConnectionStatus();
    const platforms: ('facebook' | 'instagram' | 'tiktok')[] = ['facebook', 'instagram', 'tiktok'];
    
    for (const p of platforms) {
      if (status[p]) {
        const insights = await socialService.getInsights(p);
        if (insights) data.push(insights);
      }
    }
    setPlatformData(data);
  };

  const openSyncModal = (platform: 'facebook' | 'instagram' | 'tiktok') => {
    const existing = platformData.find(p => p.platform === platform);
    if (existing && existing.username) {
        // If already connected, just sync directly without modal
        handleSync(platform, existing.username);
    } else {
        setTargetPlatform(platform);
        setShowSyncModal(true);
    }
  };

  const handleSync = async (platform: 'facebook' | 'instagram' | 'tiktok', username: string) => {
    setLoading(true);
    await socialService.connectAccount(platform, username);
    window.postMessage({
      type: 'KAWAYAN_UPDATE_STATS',
      platform: platform,
      username: username
    }, '*');
  };

  const handleDisconnect = async (platform: string) => {
    const confirmed = await dialog.confirm(`Disconnect ${platform}?`);
    if (confirmed) {
      await socialService.disconnectAccount(platform);
      loadData();
    }
  };

  const MetricBox = ({ label, value, icon: Icon, color }: any) => (
    <div className="bg-[#FFFFFF] dark:bg-[#273338]/40 p-3 rounded-2xl border border-[#2B5748] dark:border-[#9CB080]/20 flex flex-col items-center justify-center text-center hover:border-[#2B5748]/30 transition-colors">
      <div className={`${color} mb-1`}>
        <Icon className="w-4 h-4" />
      </div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-tight mb-1">{label}</p>
      <p className="text-lg font-black text-slate-900 dark:text-white leading-none">
        {typeof value === 'number' ? value.toLocaleString() : value || '0'}
      </p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto py-10 px-4 space-y-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="w-2 h-2 rounded-full animate-pulse-dot" style={{ background: "#2B5748" }}></span>
            <span className="text-xs font-bold uppercase tracking-widest text-slate-400">Live Analytics</span>
          </div>
          <h1 className="font-display text-4xl text-slate-900 dark:text-white">Social Insights</h1>
          <p className="text-slate-400 text-sm">Automated data sync via Kawayan Extension.</p>
        </div>

        <div className="flex bg-white dark:bg-[#2B5748]/40 p-1.5 rounded-2xl border border-[#273338]/10 dark:border-[#9CB080]/20 gap-1.5">
            {[
              { id: 'facebook', icon: Facebook, hoverBg: '#1877F2' },
              { id: 'instagram', icon: Instagram, hoverBg: '#dc2743' },
              { id: 'tiktok', icon: MessageCircle, hoverBg: '#000000' }
            ].map((p) => (
              <button 
                key={p.id}
                onClick={() => openSyncModal(p.id as any)}
                className="p-3 rounded-xl text-slate-400 hover:text-white bg-[#273338]/5 dark:bg-[#273338] hover:bg-slate-800 flex items-center gap-2 font-bold text-sm transition-all"
              >
                <p.icon className="w-4 h-4" />
                <span className="hidden sm:inline text-xs capitalize">+ {p.id}</span>
              </button>
            ))}
        </div>
      </div>

      {/* Main Stats Display */}
      <div className="grid grid-cols-1 gap-6">
        {platformData.length === 0 ? (
          <div className="py-28 text-center bg-white dark:bg-[#2B5748]/40/40 rounded-[2rem] border border-dashed border-[#2B5748] dark:border-[#9CB080]/20">
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4 bg-[#2B5748]/10 border border-[#2B5748]">
              <BarChart3 className="w-7 h-7" style={{ color: '#2B5748' }} />
            </div>
            <h3 className="font-display text-xl text-slate-400 dark:text-slate-500">No Channels Connected</h3>
            <p className="text-slate-400 text-sm mt-1.5">Select a platform above to start syncing your data.</p>
          </div>
        ) : (
          platformData.map((data) => (
            <div key={data.platform} className="bg-white dark:bg-[#2B5748]/40 rounded-3xl border border-[#273338]/10 dark:border-[#9CB080]/20 overflow-hidden">
              {/* Signature top bar */}
              <div className="h-1" style={{ background: data.platform === 'facebook' ? '#1877F2' : data.platform === 'instagram' ? 'linear-gradient(90deg, #f09433, #dc2743, #bc1888)' : '#000' }}></div>
              <div className="flex flex-col lg:flex-row">
                {/* Header Sidebar */}
                <div className="lg:w-56 p-6 flex flex-col justify-between items-center text-center border-b lg:border-b-0 lg:border-r border-[#273338]/10 dark:border-[#9CB080]/20 bg-[#FFFFFF] dark:bg-[#273338]">
                  <div className="space-y-3">
                    <div className={`p-4 rounded-2xl mx-auto w-fit shadow-lg ${
                      data.platform === 'facebook' ? 'bg-[#1877F2]' : 
                      data.platform === 'instagram' ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]' : 
                      'bg-black'
                    } text-white`}>
                      {data.platform === 'facebook' ? <Facebook className="w-7 h-7" /> : 
                       data.platform === 'instagram' ? <Instagram className="w-7 h-7" /> : 
                       <MessageCircle className="w-7 h-7" />}
                    </div>
                    <div>
                      <h3 className="font-display text-xl text-slate-900 dark:text-white capitalize">{data.platform}</h3>
                      <p className="text-xs font-bold" style={{ color: '#2B5748' }}>@{data.username}</p>
                    </div>
                  </div>

                  <div className="w-full space-y-1.5 mt-6">
                    <button 
                      onClick={() => handleSync(data.platform as any, data.username || '')}
                      className="w-full py-2.5 bg-white dark:bg-[#2B5748]/50 border border-[#273338]/10 dark:border-[#9CB080]/20 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-200 hover:border-[#2B5748] transition-all flex items-center justify-center gap-2"
                      style={{ ...(loading ? {} : {}) }}
                    >
                      <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <button 
                      onClick={() => handleDisconnect(data.platform)}
                      className="w-full py-2 text-xs font-medium text-slate-300 dark:text-slate-600 hover:text-rose-500 transition-colors"
                    >
                      Disconnect
                    </button>
                  </div>
                </div>

                {/* Detailed Metrics Grid */}
                <div className="flex-1 p-6 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
                  <MetricBox label="Followers" value={data.followers} icon={Users} color="text-indigo-500" />
                  
                  {data.platform === 'facebook' && (
                    <>
                      <MetricBox label="Views" value={(data as any).views} icon={Eye} color="text-[#2B5748]" />
                      <MetricBox label="Viewers" value={(data as any).viewers} icon={Users} color="text-blue-500" />
                      <MetricBox label="Interactions" value={(data as any).interactions} icon={Heart} color="text-rose-500" />
                      <MetricBox label="Visits" value={(data as any).visits} icon={MousePointer2} color="text-amber-500" />
                      <MetricBox label="Follows" value={(data as any).follows} icon={UserPlus} color="text-cyan-500" />
                      <MetricBox label="Unfollows" value={(data as any).unfollows} icon={UserMinus} color="text-slate-400" />
                      <MetricBox label="Net Follows" value={(data as any).netFollows} icon={TrendingUp} color="text-[#2B5748]" />
                    </>
                  )}

                  {data.platform === 'instagram' && (
                    <>
                      <MetricBox label="Following" value={data.following} icon={UserPlus} color="text-purple-500" />
                      <MetricBox label="Posts" value={(data as any).posts} icon={ImageIcon} color="text-orange-500" />
                    </>
                  )}

                  {data.platform === 'tiktok' && (
                    <>
                      <MetricBox label="Likes" value={data.likes} icon={Heart} color="text-rose-500" />
                      <MetricBox label="Following" value={data.following} icon={UserPlus} color="text-purple-500" />
                    </>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Sync Modal */}
      {showSyncModal && (
        <div className="fixed inset-0 bg-[#273338]/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#2B5748]/40 w-full max-w-sm rounded-3xl p-8 relative border border-[#273338]/10 dark:border-[#9CB080]/20" style={{ boxShadow: '0 24px 60px -12px rgba(0,0,0,0.25)' }}>
            {/* Green top bar */}
            <div className="absolute top-0 left-0 w-full h-1 rounded-t-3xl bg-[#2B5748]"></div>
            <button 
              onClick={() => setShowSyncModal(false)}
              className="absolute top-5 right-5 p-1.5 text-slate-400 hover:bg-[#273338]/5 dark:hover:bg-[#2B5748]/50 rounded-full transition"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className={`w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white shadow-xl ${
                targetPlatform === 'facebook' ? 'bg-[#1877F2]' : 
                targetPlatform === 'instagram' ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]' : 
                'bg-black'
              }`}>
                {targetPlatform === 'facebook' ? <Facebook className="w-8 h-8" /> : 
                 targetPlatform === 'instagram' ? <Instagram className="w-8 h-8" /> : 
                 <MessageCircle className="w-8 h-8" />}
              </div>
              <h2 className="font-display text-2xl text-slate-900 dark:text-white capitalize">Connect {targetPlatform}</h2>
              <p className="text-slate-400 text-sm mt-1">Enter your handle to begin syncing.</p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 font-semibold">@</span>
                <input 
                  type="text" 
                  autoFocus
                  value={modalUsername}
                  onChange={(e) => setModalUsername(e.target.value)}
                  placeholder="username"
                  className="w-full pl-9 pr-5 py-4 bg-[#273338]/5 dark:bg-[#273338] border border-[#273338]/10 dark:border-[#9CB080]/20 rounded-2xl text-base font-semibold outline-none"
                  onKeyDown={(e) => e.key === 'Enter' && handleSync(targetPlatform!, modalUsername)}
                />
              </div>
              <button 
                onClick={() => handleSync(targetPlatform!, modalUsername)}
                className="w-full py-4 rounded-full font-bold text-base text-white transition-all hover:scale-105 active:scale-95 bg-[#2B5748]"
                style={{ boxShadow: '0 4px 20px -4px rgba(43, 87, 72,0.35)' }}
              >
                Start Data Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed inset-0 bg-[#273338]/70 backdrop-blur-sm z-[110] flex flex-col items-center justify-center text-white">
           <div className="w-16 h-16 rounded-full flex items-center justify-center shadow-accent mb-5 bg-[#2B5748]">
              <RefreshCcw className="w-8 h-8 text-white animate-spin" />
           </div>
           <p className="font-display text-2xl text-white">Syncing Live Data...</p>
           <p className="text-slate-400 mt-2 text-sm">The extension is working its magic.</p>
        </div>
      )}
    </div>
  );
};

export default InsightsDashboard;
