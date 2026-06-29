import React, { useEffect, useState, useMemo } from 'react';
import { 
  Users, RefreshCcw, ExternalLink, Heart, 
  Image as ImageIcon, UserPlus, Zap, BarChart3,
  Facebook, Instagram, MessageCircle, X, Eye, 
  UserMinus, MousePointer2, TrendingUp, DollarSign
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { socialService, SocialPlatformData } from '../services/socialService';
import { paymentService } from '../services/paymentService';
import { useOrganicDialog } from './OrganicDialog';

const InsightsDashboard: React.FC = () => {
  const dialog = useOrganicDialog();
  const [loading, setLoading] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [targetPlatform, setTargetPlatform] = useState<'facebook' | 'instagram' | 'tiktok' | null>(null);
  const [modalUsername, setModalUsername] = useState('');
  const [platformData, setPlatformData] = useState<SocialPlatformData[]>([]);
  const [walletSpend, setWalletSpend] = useState(0);

  const chartColors = ['#2B5748', '#618764', '#9CB080', '#1877F2', '#dc2743'];

  const engagementChartData = useMemo(() => {
    return platformData.map((data) => {
      const d = data as Record<string, number | string | undefined>;
      const reach =
        Number(d.views || 0) +
        Number(d.interactions || 0) +
        Number(d.likes || 0) +
        Number(d.followers || 0);
      return {
        name: String(data.platform).charAt(0).toUpperCase() + String(data.platform).slice(1),
        reach,
        followers: Number(d.followers || 0),
      };
    });
  }, [platformData]);

  const totalReach = useMemo(
    () => engagementChartData.reduce((sum, row) => sum + row.reach, 0),
    [engagementChartData]
  );

  const estimatedDigitalValue = totalReach * 0.05;
  const digitalRoiPercent =
    walletSpend > 0
      ? Math.round(((estimatedDigitalValue - walletSpend) / walletSpend) * 100)
      : totalReach > 0
        ? 100
        : 0;

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

    try {
      const wallet = await paymentService.getWalletData();
      const spend = wallet.transactions
        .filter((t) => t.type === 'DEBIT' && t.status === 'COMPLETED')
        .reduce((sum, t) => sum + t.amount, 0);
      setWalletSpend(spend);
    } catch {
      setWalletSpend(0);
    }
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
    <div className="stat-card flex flex-col items-center text-center">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center mb-2 ${color.replace('text-', 'bg-').replace('-500', '-500/10').replace('-400', '-400/10')}`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-label mb-1" style={{ color: 'var(--fg-subtle)' }}>{label}</p>
      <p className="text-xl font-bold" style={{ color: 'var(--fg)' }}>
        {typeof value === 'number' ? value.toLocaleString() : value || '0'}
      </p>
    </div>
  );

  return (
    <div className="max-w-6xl mx-auto py-8 px-2 space-y-8 animate-fade-in">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-5">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full animate-pulse-dot bg-[#2B5748]" />
            <span className="text-label" style={{ color: 'var(--fg-subtle)' }}>Growth Analytics</span>
          </div>
          <h1 className="text-2xl font-bold mb-1" style={{ color: 'var(--fg)' }}>Growth Insights Dashboard</h1>
          <p className="text-sm" style={{ color: 'var(--fg-muted)' }}>
            Engagement metrics, visual charts, and digital ROI via the Kawayan Extension.
          </p>
        </div>

        <div className="flex p-1.5 rounded-2xl gap-1.5"
          style={{ background: 'var(--bg-alt)', border: '1px solid var(--border)' }}>
          {[
            { id: 'facebook', icon: Facebook },
            { id: 'instagram', icon: Instagram },
            { id: 'tiktok', icon: MessageCircle }
          ].map((p) => (
            <button
              key={p.id}
              onClick={() => openSyncModal(p.id as any)}
              className="p-2.5 rounded-xl text-sm font-semibold flex items-center gap-2 transition-all"
              style={{ color: 'var(--fg-muted)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'var(--card)'; e.currentTarget.style.color = 'var(--fg)'; e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = ''; e.currentTarget.style.color = 'var(--fg-muted)'; e.currentTarget.style.boxShadow = ''; }}
            >
              <p.icon className="w-4 h-4" />
              <span className="hidden sm:inline text-xs capitalize">+ {p.id}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ROI + Chart */}
      {platformData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="card p-6">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: 'rgba(43,87,72,0.1)' }}>
                <DollarSign className="w-4 h-4 text-[#2B5748]" />
              </div>
              <h2 className="font-bold" style={{ color: 'var(--fg)' }}>Digital ROI</h2>
            </div>
            <p className={`text-4xl font-bold ${digitalRoiPercent >= 0 ? 'text-[#2B5748]' : 'text-red-500'}`}>
              {digitalRoiPercent >= 0 ? '+' : ''}{digitalRoiPercent}%
            </p>
            <p className="text-xs mt-2 leading-relaxed" style={{ color: 'var(--fg-muted)' }}>
              Estimated value ₱{estimatedDigitalValue.toLocaleString(undefined, { maximumFractionDigits: 0 })} from {totalReach.toLocaleString()} reach units vs ₱{walletSpend.toLocaleString()} spend.
            </p>
          </div>
          <div className="card lg:col-span-2 p-6" style={{ height: '280px' }}>
            <h2 className="font-bold mb-4" style={{ color: 'var(--fg)' }}>Engagement by Channel</h2>
            <ResponsiveContainer width="100%" height="82%">
              <BarChart data={engagementChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                <XAxis dataKey="name" tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--fg-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: '12px', border: '1px solid var(--border)', background: 'var(--glass-bg)', backdropFilter: 'blur(16px)' }} />
                <Bar dataKey="reach" radius={[8, 8, 0, 0]}>
                  {engagementChartData.map((_, i) => (
                    <Cell key={i} fill={chartColors[i % chartColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Platform Cards */}
      <div className="space-y-5">
        {platformData.length === 0 ? (
          <div className="card py-24 text-center border-2 border-dashed">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4"
              style={{ background: 'rgba(43,87,72,0.1)' }}>
              <BarChart3 className="w-7 h-7 text-[#2B5748]" />
            </div>
            <h3 className="text-lg font-bold mb-2" style={{ color: 'var(--fg-muted)' }}>No Channels Connected</h3>
            <p className="text-sm" style={{ color: 'var(--fg-subtle)' }}>
              Select a platform above to start syncing your data.
            </p>
          </div>
        ) : (
          platformData.map((data) => (
            <div key={data.platform} className="card overflow-hidden">
              <div className="h-1" style={{ background: data.platform === 'facebook' ? '#1877F2' : data.platform === 'instagram' ? 'linear-gradient(90deg, #f09433, #dc2743, #bc1888)' : '#000' }} />
              <div className="flex flex-col lg:flex-row">
                <div className="lg:w-52 p-6 flex flex-col justify-between items-center text-center border-b lg:border-b-0 lg:border-r"
                  style={{ borderColor: 'var(--border)', background: 'var(--bg-alt)' }}>
                  <div className="space-y-3">
                    <div className={`p-4 rounded-2xl mx-auto w-fit text-white ${
                      data.platform === 'facebook' ? 'bg-[#1877F2]' :
                      data.platform === 'instagram' ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]' :
                      'bg-black'
                    }`}
                      style={{ boxShadow: 'var(--shadow-md)' }}>
                      {data.platform === 'facebook' ? <Facebook className="w-6 h-6" /> :
                       data.platform === 'instagram' ? <Instagram className="w-6 h-6" /> :
                       <MessageCircle className="w-6 h-6" />}
                    </div>
                    <div>
                      <h3 className="font-bold capitalize" style={{ color: 'var(--fg)' }}>{data.platform}</h3>
                      <p className="text-xs font-semibold text-[#2B5748]">@{data.username}</p>
                    </div>
                  </div>
                  <div className="w-full space-y-2 mt-5">
                    <button
                      onClick={() => handleSync(data.platform as any, data.username || '')}
                      className="w-full py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                      style={{ background: 'var(--card)', border: '1px solid var(--border)', color: 'var(--fg-muted)' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = '#2B5748'; e.currentTarget.style.color = '#2B5748'; }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--fg-muted)'; }}>
                      <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
                    </button>
                    <button
                      onClick={() => handleDisconnect(data.platform)}
                      className="w-full py-1.5 text-xs font-medium transition-colors"
                      style={{ color: 'var(--fg-subtle)' }}
                      onMouseEnter={e => e.currentTarget.style.color = '#C0392B'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--fg-subtle)'}>
                      Disconnect
                    </button>
                  </div>
                </div>

                <div className="flex-1 p-5 grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
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
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in"
          style={{ background: 'rgba(13,26,21,0.8)', backdropFilter: 'blur(12px)' }}>
          <div className="glass-card w-full max-w-sm p-8 animate-scale-in">
            <div className="h-1 absolute top-0 left-0 right-0 rounded-t-[var(--r-lg)] bg-[#2B5748]" />
            <button
              onClick={() => setShowSyncModal(false)}
              className="absolute top-4 right-4 p-1.5 rounded-xl transition"
              style={{ color: 'var(--fg-muted)' }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--border)'}
              onMouseLeave={e => e.currentTarget.style.background = ''}>
              <X className="w-4 h-4" />
            </button>

            <div className="text-center mb-6">
              <div className={`w-14 h-14 rounded-2xl mx-auto mb-4 flex items-center justify-center text-white ${
                targetPlatform === 'facebook' ? 'bg-[#1877F2]' :
                targetPlatform === 'instagram' ? 'bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888]' :
                'bg-black'
              }`}
                style={{ boxShadow: 'var(--shadow-md)' }}>
                {targetPlatform === 'facebook' ? <Facebook className="w-7 h-7" /> :
                 targetPlatform === 'instagram' ? <Instagram className="w-7 h-7" /> :
                 <MessageCircle className="w-7 h-7" />}
              </div>
              <h2 className="text-xl font-bold capitalize" style={{ color: 'var(--fg)' }}>Connect {targetPlatform}</h2>
              <p className="text-sm mt-1" style={{ color: 'var(--fg-muted)' }}>Enter your handle to begin syncing.</p>
            </div>

            <div className="space-y-3">
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 font-semibold" style={{ color: 'var(--fg-muted)' }}>@</span>
                <input
                  type="text"
                  autoFocus
                  value={modalUsername}
                  onChange={(e) => setModalUsername(e.target.value)}
                  placeholder="username"
                  className="w-full pl-9 pr-5 py-3.5 rounded-xl border text-sm font-medium focus:outline-none"
                  style={{ background: 'var(--bg-alt)', borderColor: 'var(--border-strong)', color: 'var(--fg)' }}
                  onKeyDown={(e) => e.key === 'Enter' && handleSync(targetPlatform!, modalUsername)}
                />
              </div>
              <button
                onClick={() => handleSync(targetPlatform!, modalUsername)}
                className="w-full py-3.5 rounded-xl font-bold text-sm text-white"
                style={{ background: 'linear-gradient(135deg, #2B5748, #3A7362)', boxShadow: '0 4px 16px -4px rgba(43,87,72,0.35)' }}>
                Start Data Sync
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-[110] flex flex-col items-center justify-center animate-fade-in"
          style={{ background: 'rgba(13,26,21,0.85)', backdropFilter: 'blur(16px)' }}>
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
            style={{ background: 'rgba(43,87,72,0.3)', boxShadow: '0 8px 32px rgba(43,87,72,0.3)' }}>
            <RefreshCcw className="w-8 h-8 text-[#9CB080] animate-spin" />
          </div>
          <p className="font-display text-xl text-white">Syncing Live Data...</p>
          <p className="text-sm mt-2 text-white/50">The extension is working its magic.</p>
        </div>
      )}
    </div>
  );
};

export default InsightsDashboard;
