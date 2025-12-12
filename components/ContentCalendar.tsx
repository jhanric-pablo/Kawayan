import React, { useState, useEffect } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost } from '../types';
import { generateContentPlan, generatePostCaptionAndImagePrompt, generateImageFromPrompt, getTrendingTopicsPH } from '../services/geminiService';
import { savePost, getUserPosts } from '../services/storage';
import { 
  Loader2, Plus, Wand2, Image as ImageIcon, RefreshCcw, Flame, 
  ThumbsUp, MessageCircle, Share2, MoreHorizontal, LayoutList, LayoutGrid, 
  Save, Check, ChevronLeft, ChevronRight, Maximize2, Columns, Minimize2
} from 'lucide-react';

interface Props {
  profile: BrandProfile;
  userId: string;
}

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Layout Modes: 
// 'split': Default sidebar + main content
// 'calendar': Full width calendar
// 'focus': Full width editor
type LayoutMode = 'split' | 'calendar' | 'focus';

const ContentCalendar: React.FC<Props> = ({ profile, userId }) => {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [layoutMode, setLayoutMode] = useState<LayoutMode>('split');
  const [currentDate, setCurrentDate] = useState(new Date(2025, 9, 1)); // Oct 2025 default
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedPost | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadData = async () => {
    const trends = await getTrendingTopicsPH();
    setTrendingTopics(trends);
    const savedPosts = getUserPosts(userId);
    setPosts(savedPosts);
  };

  const handleGeneratePlan = async () => {
    setLoadingPlan(true);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const newIdeas = await generateContentPlan(profile, monthName);
    setIdeas(newIdeas);
    setLoadingPlan(false);
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    // Auto switch to split if in calendar mode to show editor
    if (layoutMode === 'calendar') setLayoutMode('split');
    
    const existingPost = posts.find(p => {
       const d = new Date(p.date);
       return d.getDate() === day && d.getMonth() === currentDate.getMonth();
    });

    if (existingPost) {
      setGeneratedContent(existingPost);
    } else {
      if (generatedContent && new Date(generatedContent.date).getDate() !== day) {
        setGeneratedContent(null);
      }
    }
  };

  const handleGeneratePost = async (idea: ContentIdea) => {
    setGeneratingPost(true);
    try {
      const result = await generatePostCaptionAndImagePrompt(profile, idea.topic);
      const newPost: GeneratedPost = {
        id: Date.now().toString(),
        userId,
        date: new Date(currentDate.getFullYear(), currentDate.getMonth(), idea.day).toISOString().split('T')[0],
        topic: idea.topic,
        caption: result.caption,
        imagePrompt: result.imagePrompt,
        viralityScore: result.viralityScore,
        viralityReason: result.viralityReason,
        status: 'Draft',
        format: idea.format
      };
      setGeneratedContent(newPost);
    } catch (e) {
      alert("Failed to generate content. Please try again.");
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleGenerateImage = async () => {
    if (!generatedContent) return;
    setLoadingImage(true);
    const b64 = await generateImageFromPrompt(generatedContent.imagePrompt + ", high quality, professional photography style, 4k");
    if (b64) {
      setGeneratedContent({ ...generatedContent, imageUrl: b64 });
    } else {
      alert("Failed to generate image. Please try again.");
    }
    setLoadingImage(false);
  };

  const handleSavePost = () => {
    if (generatedContent) {
      savePost(generatedContent);
      setPosts(prev => {
        const idx = prev.findIndex(p => p.id === generatedContent.id);
        if (idx >= 0) {
          const newPosts = [...prev];
          newPosts[idx] = generatedContent;
          return newPosts;
        }
        return [...prev, generatedContent];
      });
      alert("Post Saved to Database!");
    }
  };

  // --- Calendar Grid Helpers ---
  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };
  
  const getFirstDayOfMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth(), 1).getDay();
  };

  const renderCalendarGrid = () => {
    const totalDays = getDaysInMonth(currentDate);
    const startDay = getFirstDayOfMonth(currentDate);
    const slots = [];

    // Empty slots
    for (let i = 0; i < startDay; i++) {
      slots.push(<div key={`empty-${i}`} className="h-24 bg-slate-50 dark:bg-slate-900 border-b border-r border-slate-100 dark:border-slate-800" />);
    }

    // Days
    for (let day = 1; day <= totalDays; day++) {
      const idea = ideas.find(i => i.day === day);
      const post = posts.find(p => {
         const d = new Date(p.date);
         return d.getDate() === day && d.getMonth() === currentDate.getMonth();
      });
      const isSelected = selectedDay === day;

      slots.push(
        <div 
          key={day}
          onClick={() => handleDayClick(day)}
          className={`h-28 border-b border-r border-slate-100 dark:border-slate-800 p-2 relative cursor-pointer hover:bg-emerald-50/30 dark:hover:bg-emerald-900/10 transition group ${isSelected ? 'bg-emerald-50 dark:bg-emerald-900/20 ring-inset ring-2 ring-emerald-500' : 'bg-white dark:bg-slate-850'}`}
        >
          <span className={`text-xs font-semibold ${isSelected ? 'text-emerald-700 dark:text-emerald-400' : 'text-slate-500 dark:text-slate-400'}`}>{day}</span>
          
          {post ? (
             <div className="mt-1 p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 border border-emerald-200 dark:border-emerald-800 text-[10px] text-emerald-800 dark:text-emerald-300 font-medium truncate shadow-sm">
                {post.status === 'Scheduled' && <Check className="w-3 h-3 inline mr-1"/>}
                {post.topic}
             </div>
          ) : idea ? (
            <div className="mt-1 p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 text-[10px] text-indigo-700 dark:text-indigo-300 font-medium truncate opacity-80 group-hover:opacity-100">
               {idea.format}: {idea.title}
            </div>
          ) : null}

          {!post && !idea && (
             <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100">
                <Plus className="w-5 h-5 text-slate-300 dark:text-slate-600" />
             </div>
          )}
        </div>
      );
    }
    
    return slots;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-6">
      
      {/* Top Bar: Trends & Controls */}
      <div className="flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center bg-white dark:bg-slate-800 p-4 rounded-xl border border-slate-200 dark:border-slate-700 shadow-sm transition-colors">
         <div className="flex items-center gap-3 w-full lg:w-auto overflow-hidden">
             <div className="flex flex-shrink-0 items-center gap-2 px-3 py-1.5 bg-orange-50 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full border border-orange-100 dark:border-orange-800 text-xs font-bold uppercase tracking-wider">
               <Flame className="w-3 h-3" /> Trending
             </div>
             <div className="flex gap-2 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
               {trendingTopics.map((t, i) => (
                 <span key={i} className="text-sm text-slate-600 dark:text-slate-300 font-medium whitespace-nowrap bg-slate-50 dark:bg-slate-700 px-2 py-1 rounded-md border border-slate-100 dark:border-slate-600">#{t.replace(/\s+/g, '')}</span>
               ))}
             </div>
         </div>
         <div className="flex items-center gap-2 flex-shrink-0 ml-auto lg:ml-0">
            {/* View Mode Grid/List */}
            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg mr-2">
              <button onClick={() => setViewMode('grid')} className={`p-1.5 rounded-md transition ${viewMode === 'grid' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}><LayoutGrid className="w-4 h-4" /></button>
              <button onClick={() => setViewMode('list')} className={`p-1.5 rounded-md transition ${viewMode === 'list' ? 'bg-white dark:bg-slate-600 shadow text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}><LayoutList className="w-4 h-4" /></button>
            </div>
            
            {/* Layout Toggles */}
            <div className="flex bg-slate-100 dark:bg-slate-700 p-1 rounded-lg">
               <button onClick={() => setLayoutMode('calendar')} title="Full Calendar" className={`p-1.5 rounded-md transition ${layoutMode === 'calendar' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}><Maximize2 className="w-4 h-4" /></button>
               <button onClick={() => setLayoutMode('split')} title="Split View" className={`p-1.5 rounded-md transition ${layoutMode === 'split' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}><Columns className="w-4 h-4" /></button>
               <button onClick={() => setLayoutMode('focus')} title="Focus Editor" className={`p-1.5 rounded-md transition ${layoutMode === 'focus' ? 'bg-white dark:bg-slate-600 shadow text-indigo-600 dark:text-indigo-400' : 'text-slate-400'}`}><Minimize2 className="w-4 h-4" /></button>
            </div>
         </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 overflow-hidden">
        
        {/* LEFT: Calendar Grid or List */}
        <div className={`flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 ${layoutMode === 'calendar' ? 'xl:col-span-12' : layoutMode === 'split' ? 'xl:col-span-7' : 'hidden'}`}>
          {/* Calendar Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
             <div className="flex items-center gap-2">
               <h2 className="text-lg font-bold text-slate-800 dark:text-white">{currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}</h2>
               <div className="flex gap-1 ml-4">
                  <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()-1)))}>
                    <ChevronLeft className="w-5 h-5"/>
                  </button>
                  <button className="p-1.5 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg text-slate-600 dark:text-slate-300 transition" onClick={() => setCurrentDate(new Date(currentDate.setMonth(currentDate.getMonth()+1)))}>
                    <ChevronRight className="w-5 h-5"/>
                  </button>
               </div>
             </div>
             <button 
                onClick={handleGeneratePlan}
                disabled={loadingPlan}
                className="text-xs flex items-center gap-2 bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-white font-bold hover:bg-slate-50 dark:hover:bg-slate-600 px-3 py-2 rounded-lg transition shadow-sm"
              >
                {loadingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                Auto-Plan Month
              </button>
          </div>

          {viewMode === 'grid' ? (
             <div className="flex-1 overflow-y-auto">
               <div className="grid grid-cols-7 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 sticky top-0 z-10">
                 {DAYS.map(d => <div key={d} className="py-2 text-center text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">{d}</div>)}
               </div>
               <div className="grid grid-cols-7">
                  {renderCalendarGrid()}
               </div>
             </div>
          ) : (
             <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {Array.from({length: getDaysInMonth(currentDate)}, (_, i) => i + 1).map(day => {
                   const idea = ideas.find(i => i.day === day);
                   const post = posts.find(p => new Date(p.date).getDate() === day);
                   if (!idea && !post) return null;
                   
                   return (
                     <div 
                        key={day} 
                        onClick={() => handleDayClick(day)}
                        className={`flex gap-4 p-4 rounded-xl border transition cursor-pointer ${selectedDay === day ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/10' : 'border-slate-100 dark:border-slate-700 hover:border-emerald-200 dark:hover:border-emerald-700'}`}
                     >
                        <div className="w-12 flex flex-col items-center justify-center bg-white dark:bg-slate-700 rounded-lg border border-slate-200 dark:border-slate-600 h-12 text-slate-800 dark:text-white">
                           <span className="text-xs text-slate-500 dark:text-slate-400 font-bold uppercase">{currentDate.toLocaleString('default', {month:'short'})}</span>
                           <span className="text-lg font-bold">{day}</span>
                        </div>
                        <div className="flex-1">
                           {post ? (
                              <div>
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 uppercase">{post.status}</span>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{post.topic}</h4>
                                 </div>
                                 <p className="text-sm text-slate-500 dark:text-slate-400 line-clamp-1">{post.caption}</p>
                              </div>
                           ) : (
                              <div>
                                 <div className="flex items-center gap-2 mb-1">
                                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-indigo-100 dark:bg-indigo-900/50 text-indigo-700 dark:text-indigo-300 uppercase">Idea</span>
                                    <h4 className="font-bold text-slate-800 dark:text-white">{idea?.title}</h4>
                                 </div>
                                 <p className="text-sm text-slate-500 dark:text-slate-400">{idea?.topic}</p>
                              </div>
                           )}
                        </div>
                     </div>
                   )
                })}
             </div>
          )}
        </div>

        {/* RIGHT: Editor & Preview */}
        <div className={`flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-xl border border-slate-200 dark:border-slate-700 overflow-hidden h-full transition-all duration-300 ${layoutMode === 'focus' ? 'xl:col-span-12' : layoutMode === 'split' ? 'xl:col-span-5' : 'hidden'}`}>
          {selectedDay ? (
            <div className="flex flex-col h-full">
              {/* Header */}
              <div className="p-4 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-850 flex justify-between items-center">
                <div>
                  <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">
                     {currentDate.toLocaleString('default', {month:'long'})} {selectedDay}
                  </span>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]">
                    {posts.find(p => new Date(p.date).getDate() === selectedDay)?.topic || ideas.find(i => i.day === selectedDay)?.title || "Create Post"}
                  </h3>
                </div>
                <button 
                  className="bg-emerald-600 text-white text-sm px-4 py-2 rounded-lg font-medium hover:bg-emerald-700 transition shadow-md shadow-emerald-200 dark:shadow-none flex items-center gap-2"
                  onClick={() => {
                     const idea = ideas.find(i => i.day === selectedDay);
                     const fallbackIdea: ContentIdea = { day: selectedDay, title: "Custom Post", topic: "General Update", format: "Image" };
                     handleGeneratePost(idea || fallbackIdea);
                  }}
                  disabled={generatingPost}
                >
                  {generatingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : (generatedContent ? <span className="flex items-center gap-1"><RefreshCcw className="w-3 h-3"/> Rewrite</span> : <span className="flex items-center gap-1"><Wand2 className="w-3 h-3"/> AI Draft</span>)}
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-0 bg-slate-100 dark:bg-slate-900 flex flex-col items-center">
                
                {!generatedContent ? (
                  <div className="flex flex-col items-center justify-center h-full text-center p-8">
                    <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-full flex items-center justify-center shadow-sm mb-4">
                      <Wand2 className="w-10 h-10 text-emerald-500" />
                    </div>
                    <h4 className="text-lg font-bold text-slate-800 dark:text-white">Ready to create?</h4>
                    <p className="text-slate-500 dark:text-slate-400 text-sm max-w-[250px] mt-2">
                       {ideas.find(i => i.day === selectedDay) 
                         ? `Idea: "${ideas.find(i => i.day === selectedDay)?.topic}"`
                         : "Select 'AI Draft' to generate content for this day."}
                    </p>
                  </div>
                ) : (
                  <div className={`w-full py-8 px-4 transition-all duration-300 ${layoutMode === 'focus' ? 'max-w-4xl grid grid-cols-2 gap-8' : 'max-w-sm'}`}>
                     
                     {/* Left Column (Focus Mode) - Editor controls */}
                     <div className={layoutMode === 'focus' ? 'order-2' : ''}>
                         {/* Virality Score */}
                         <div className="mb-6 bg-white dark:bg-slate-800 rounded-xl p-4 shadow-sm border border-slate-200 dark:border-slate-700">
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase flex items-center gap-1">
                                <Flame className="w-3 h-3 text-orange-500"/> Virality Potential
                              </span>
                              <span className={`text-lg font-black ${
                                (generatedContent.viralityScore || 0) > 75 ? 'text-emerald-600 dark:text-emerald-400' : 
                                (generatedContent.viralityScore || 0) > 50 ? 'text-orange-500' : 'text-slate-500 dark:text-slate-400'
                              }`}>
                                {generatedContent.viralityScore}/100
                              </span>
                            </div>
                            <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 mb-3">
                              <div 
                                className={`h-2 rounded-full transition-all duration-1000 ${
                                   (generatedContent.viralityScore || 0) > 75 ? 'bg-gradient-to-r from-emerald-400 to-emerald-600' : 'bg-gradient-to-r from-orange-300 to-orange-500'
                                }`} 
                                style={{ width: `${generatedContent.viralityScore}%` }}
                              />
                            </div>
                            <p className="text-xs text-slate-600 dark:text-slate-300 italic leading-relaxed">
                              "{generatedContent.viralityReason}"
                            </p>
                         </div>
                         
                         <div className="mb-6 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                            <p className="font-bold mb-1 uppercase text-[10px]">Image Prompt Used:</p>
                            <p className="italic opacity-70 mb-2">{generatedContent.imagePrompt}</p>
                         </div>
                     </div>

                     {/* Phone Preview */}
                     <div className={`${layoutMode === 'focus' ? 'order-1' : ''} bg-white dark:bg-black rounded-[2rem] border-[8px] border-slate-800 dark:border-slate-700 shadow-2xl overflow-hidden relative mx-auto w-full`}>
                        <div className="h-6 bg-slate-800 dark:bg-slate-900 w-full flex justify-between px-6 items-center">
                           <div className="w-12 h-3 bg-black dark:bg-slate-800 rounded-full" />
                           <div className="flex gap-1">
                             <div className="w-3 h-3 bg-slate-600 rounded-full" />
                             <div className="w-3 h-3 bg-slate-600 rounded-full" />
                           </div>
                        </div>

                        <div className="p-3 border-b border-slate-100 dark:border-slate-800 flex items-center gap-3 bg-white dark:bg-black">
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-bold text-xs border border-emerald-200 dark:border-emerald-800">
                             {profile.businessName.substring(0,2).toUpperCase()}
                          </div>
                          <div className="flex-1">
                             <p className="text-xs font-bold text-slate-900 dark:text-white">{profile.businessName}</p>
                             <p className="text-[10px] text-slate-500 dark:text-slate-400">Sponsored • Kawayan AI</p>
                          </div>
                          <MoreHorizontal className="w-4 h-4 text-slate-400" />
                        </div>

                        <div className="aspect-square bg-slate-100 dark:bg-slate-900 relative group">
                          {generatedContent.imageUrl ? (
                            <img src={generatedContent.imageUrl} alt="Generated" className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                               <ImageIcon className="w-8 h-8 text-slate-300 dark:text-slate-600 mb-2" />
                               <p className="text-xs text-slate-400 dark:text-slate-500 mb-4 line-clamp-3">{generatedContent.imagePrompt}</p>
                               <button 
                                 onClick={handleGenerateImage}
                                 disabled={loadingImage}
                                 className="bg-slate-800 text-white text-xs px-4 py-2 rounded-full flex items-center gap-2 hover:bg-slate-700 transition"
                               >
                                  {loadingImage ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>}
                                  Generate Visual
                               </button>
                            </div>
                          )}
                        </div>

                        <div className="p-3 flex justify-between items-center text-slate-700 dark:text-slate-300 bg-white dark:bg-black">
                          <div className="flex gap-4">
                             <ThumbsUp className="w-5 h-5" />
                             <MessageCircle className="w-5 h-5" />
                             <Share2 className="w-5 h-5" />
                          </div>
                        </div>

                        <div className="px-3 pb-6 bg-white dark:bg-black">
                          <p className="text-sm text-slate-900 dark:text-white font-bold mb-1">{Math.floor(Math.random() * 500) + 10} likes</p>
                          <div className="text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                             <span className="font-bold mr-1">{profile.businessName}</span>
                             {/* Editable Caption */}
                             <textarea 
                               className="w-full bg-transparent border-none p-0 resize-none focus:ring-0 text-slate-800 dark:text-slate-200"
                               rows={4}
                               value={generatedContent.caption}
                               onChange={(e) => setGeneratedContent({...generatedContent, caption: e.target.value})}
                             />
                          </div>
                          <p className="text-[10px] text-slate-400 mt-2 uppercase">View all comments</p>
                        </div>
                     </div>
                  </div>
                )}
              </div>

              {/* Footer Actions */}
              <div className="p-4 border-t border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 flex gap-3">
                 <button 
                    onClick={handleSavePost}
                    disabled={!generatedContent}
                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm flex items-center justify-center gap-2"
                 >
                   <Save className="w-4 h-4"/> Save Draft
                 </button>
                 <button 
                   disabled={!generatedContent}
                   className="flex-1 py-3 rounded-xl bg-slate-900 dark:bg-emerald-600 text-white font-semibold hover:bg-slate-800 dark:hover:bg-emerald-700 transition text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
                   onClick={() => {
                     if(generatedContent) {
                       setGeneratedContent({...generatedContent, status: 'Scheduled'});
                       handleSavePost();
                     }
                   }}
                 >
                   Schedule
                 </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-300 dark:text-slate-600 p-8 text-center bg-slate-50/50 dark:bg-slate-900/50">
              <Flame className="w-16 h-16 mb-4 opacity-20" />
              <h3 className="text-lg font-medium text-slate-400 dark:text-slate-500">No Date Selected</h3>
              <p className="text-sm max-w-xs mx-auto mt-2">Click a day on the calendar to start creating content.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ContentCalendar;
