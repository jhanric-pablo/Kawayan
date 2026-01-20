import React, { useEffect, useState } from 'react';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, Users, Eye, MousePointer, Share2, Activity, Link as LinkIcon, AlertCircle, Loader2, Download, Trash2, X } from 'lucide-react';
import { socialService, SocialPlatformData } from '../services/socialService';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { GeneratedPost } from '../types';

const InsightsDashboard: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [connections, setConnections] = useState<{facebook: boolean, instagram: boolean, tiktok: boolean}>({facebook: false, instagram: false, tiktok: false});
  const [platformData, setPlatformData] = useState<SocialPlatformData[]>([]);
  const [dbService] = useState(() => new UniversalDatabaseService());
  
  // Data for Charts
  const [postData, setPostData] = useState<GeneratedPost[]>([]);
  const [topicData, setTopicData] = useState<{name: string, value: number}[]>([]);
  const [activityData, setActivityData] = useState<{name: string, posts: number, projectedReach: number}[]>([]);
  const [totalReach, setTotalReach] = useState(0);

  // Modals
  const [showManageModal, setShowManageModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    
    // Social Connections
    const status = socialService.getConnectionStatus();
    setConnections(status);

    const data: SocialPlatformData[] = [];
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

    // Internal Post Data
    const currentUser = dbService.getCurrentUser();
    const posts = currentUser ? await dbService.getUserPosts(currentUser.id) : [];
    setPostData(posts);

    // Aggregate Topics
    const topics: Record<string, number> = {};
    posts.forEach((p: GeneratedPost) => {
      const t = p.topic || 'General';
      topics[t] = (topics[t] || 0) + 1;
    });
    setTopicData(Object.keys(topics).map(key => ({ name: key, value: topics[key] })).slice(0, 5));

    // Aggregate Activity
    const activity: Record<string, {posts: number, reach: number}> = {};
    let reachSum = 0;

    posts.forEach((p: GeneratedPost) => {
      const date = new Date(p.date);
      const key = date.toLocaleString('default', { month: 'short' });
      if (!activity[key]) activity[key] = { posts: 0, reach: 0 };
      
      activity[key].posts += 1;
      const estimatedReach = (p.viralityScore || 50) * 12; 
      activity[key].reach += estimatedReach;
      reachSum += estimatedReach;
    });

    const sortedMonths = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setActivityData(Object.keys(activity)
      .sort((a, b) => sortedMonths.indexOf(a) - sortedMonths.indexOf(b))
      .map(key => ({
        name: key,
        posts: activity[key].posts,
        projectedReach: activity[key].reach
      }))
    );
    setTotalReach(reachSum);

    setLoading(false);
  };

  const handleConnect = async (platform: 'facebook' | 'instagram' | 'tiktok') => {
    try {
      await socialService.connectAccount(platform);
      // The user is redirected, so we don't need to manually update state here.
    } catch (error) {
      console.error('Failed to connect:', error);
    }
  };

  const handleDisconnect = async (platform: string) => {
    if (window.confirm(`Are you sure you want to disconnect ${platform}? You will lose access to its insights.`)) {
      await socialService.disconnectAccount(platform);
      await loadData();
    }
  };

  const handleExport = () => {
    const headers = "Month,Posts,Projected Reach\n";
    const rows = activityData.map(d => `${d.name},${d.posts},${d.projectedReach}`).join("\n");
    const blob = new Blob([headers + rows], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kawayan_Insights_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  // EMPTY STATE
  if (!connections.facebook && !connections.instagram && !connections.tiktok) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] space-y-6 text-center animate-in fade-in">
        <div className="p-6 bg-slate-100 dark:bg-slate-800 rounded-full">
          <LinkIcon className="w-12 h-12 text-slate-400" />
        </div>
        <div className="max-w-md">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Connect Your Channels</h2>
          <p className="text-slate-500 dark:text-slate-400 mt-2">
            To view real insights, you need to connect your social media accounts. We use the official Graph API to fetch your data securely.
          </p>
        </div>
        <div className="flex flex-wrap justify-center gap-4">
          <button 
            onClick={() => handleConnect('facebook')}
            className="flex items-center gap-2 bg-[#1877F2] text-white px-6 py-3 rounded-xl font-bold hover:bg-blue-700 transition shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Connect Facebook
          </button>
          <button 
            onClick={() => handleConnect('instagram')}
            className="flex items-center gap-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white px-6 py-3 rounded-xl font-bold hover:opacity-90 transition shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Connect Instagram
          </button>
          <button 
            onClick={() => handleConnect('tiktok')}
            className="flex items-center gap-2 bg-black text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-900 transition shadow-lg hover:shadow-xl hover:-translate-y-1"
          >
            Connect TikTok
          </button>
        </div>
        <p className="text-xs text-slate-400 mt-4 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> No data is stored on our servers. Read our Privacy Policy.
        </p>
      </div>
    );
  }

  // Aggregate Data for Charts
  const totalFollowers = platformData.reduce((acc, curr) => acc + curr.followers, 0);
  const avgEngagement = (platformData.reduce((acc, curr) => acc + curr.engagement, 0) / (platformData.length || 1)).toFixed(1);
  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ec4899', '#8b5cf6'];

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
      
      {/* Manage Connections Modal */}
      {showManageModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
           <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-md shadow-2xl">
              <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-lg dark:text-white">Manage Connections</h3>
                <button onClick={() => setShowManageModal(false)}><X className="w-5 h-5 text-slate-400"/></button>
              </div>
              <div className="space-y-3">
                 {Object.entries(connections).map(([platform, isConnected]) => (
                   <div key={platform} className="flex justify-between items-center p-3 bg-slate-50 dark:bg-slate-900 rounded-lg border border-slate-100 dark:border-slate-700">
                      <div className="flex items-center gap-3">
                         <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-slate-300'}`}></div>
                         <span className="capitalize font-medium text-slate-700 dark:text-slate-200">{platform}</span>
                      </div>
                      {isConnected ? (
                        <button onClick={() => handleDisconnect(platform)} className="text-xs text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-900/20 px-2 py-1 rounded transition flex items-center gap-1">
                          <Trash2 className="w-3 h-3" /> Disconnect
                        </button>
                      ) : (
                        <button onClick={() => { setShowManageModal(false); handleConnect(platform as any); }} className="text-xs text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 px-2 py-1 rounded transition">
                          Connect
                        </button>
                      )}
                   </div>
                 ))}
              </div>
           </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-4">
        <div>
           <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Performance Overview</h1>
           <p className="text-slate-500 dark:text-slate-400 mt-1">Real-time data from connected APIs.</p>
        </div>
        <div className="flex gap-2">
           <button onClick={() => setShowManageModal(true)} className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-200 dark:hover:bg-slate-600 transition">
             Manage Connections
           </button>
           <button onClick={handleExport} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition shadow-sm flex items-center gap-2">
             <Download className="w-4 h-4" /> Export Report
           </button>
        </div>
      </div>

      {/* KPI Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
         {[
           { label: 'Total Audience', value: totalFollowers.toLocaleString(), icon: Users, color: 'text-blue-500', bg: 'bg-blue-50 dark:bg-blue-900/20' },
           { label: 'Avg Engagement', value: `${avgEngagement}%`, icon: MousePointer, color: 'text-purple-500', bg: 'bg-purple-50 dark:bg-purple-900/20' },
           { label: 'Connected', value: platformData.length.toString(), icon: LinkIcon, color: 'text-emerald-500', bg: 'bg-emerald-50 dark:bg-emerald-900/20' },
           { label: 'Health', value: 'Good', icon: Activity, color: 'text-orange-500', bg: 'bg-orange-50 dark:bg-orange-900/20' },
         ].map((stat, i) => (
           <div key={i} className="bg-white dark:bg-slate-800 p-6 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm">
              <div className="flex justify-between items-start mb-4">
                 <div className={`p-3 rounded-lg ${stat.bg} ${stat.color}`}>
                    <stat.icon className="w-5 h-5" />
                 </div>
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white">{stat.value}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium uppercase tracking-wider mt-1">{stat.label}</p>
           </div>
         ))}
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Reach Projection */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
           <h3 className="font-bold text-slate-800 dark:text-white mb-6 flex items-center gap-2">
             <TrendingUp className="w-5 h-5 text-emerald-500" /> Projected Monthly Reach
           </h3>
           <div className="h-80 w-full">
             <ResponsiveContainer width="100%" height="100%">
               <AreaChart data={activityData}>
                 <defs>
                   <linearGradient id="colorReach" x1="0" y1="0" x2="0" y2="1">
                     <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                     <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                   </linearGradient>
                 </defs>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.5} />
                 <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                 <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} />
                 <Tooltip contentStyle={{borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                 <Area type="monotone" dataKey="projectedReach" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorReach)" />
               </AreaChart>
             </ResponsiveContainer>
           </div>
        </div>

        {/* Topic Distribution */}
        <div className="bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm">
           <h3 className="font-bold text-slate-800 dark:text-white mb-6">Top Content Themes</h3>
           <div className="h-80 w-full flex items-center justify-center">
             {topicData.length > 0 ? (
               <ResponsiveContainer width="100%" height="100%">
                 <PieChart>
                   <Pie
                     data={topicData}
                     cx="50%"
                     cy="50%"
                     innerRadius={60}
                     outerRadius={100}
                     fill="#8884d8"
                     paddingAngle={5}
                     dataKey="value"
                   >
                     {topicData.map((entry, index) => (
                       <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                     ))}
                   </Pie>
                   <Tooltip />
                 </PieChart>
               </ResponsiveContainer>
             ) : (
               <div className="text-slate-400 text-sm">No posts generated yet.</div>
             )}
           </div>
           <div className="flex flex-wrap justify-center gap-4 mt-4">
              {topicData.map((entry, index) => (
                <div key={index} className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
                  <div className="w-3 h-3 rounded-full" style={{backgroundColor: COLORS[index % COLORS.length]}}></div>
                  {entry.name}
                </div>
              ))}
           </div>
        </div>

      </div>
    </div>
  );
};

export default InsightsDashboard;

