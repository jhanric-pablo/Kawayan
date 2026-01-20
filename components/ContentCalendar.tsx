import React, { useState, useEffect } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost } from '../types';
import { generateContentPlan, generatePostCaptionAndImagePrompt, generateImageFromPrompt, getTrendingTopicsPH } from '../services/geminiService';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { paymentService } from '../services/paymentService';
import { 
  Loader2, Plus, Wand2, Image as ImageIcon, RefreshCcw, Flame, 
  ThumbsUp, MessageCircle, Share2, MoreHorizontal, LayoutList, LayoutGrid, 
  Save, Check, ChevronLeft, ChevronRight, Maximize2, Columns, Minimize2, X
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
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [dateInputValue, setDateInputValue] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [dbService] = useState(() => new UniversalDatabaseService());

  useEffect(() => {
    // Sync input value when currentDate changes (e.g. via navigation buttons)
    setDateInputValue(currentDate.toLocaleString('default', { month: 'long', year: 'numeric' }));
  }, [currentDate]);

  const parseSmartDate = (input: string) => {
    // Clean input: replace commas/slashes with spaces, remove extra spaces
    let clean = input.replace(/[,/]/g, ' ').replace(/\s+/g, ' ').trim();
    
    // Handle 4-digit year only "2026"
    if (/^\d{4}$/.test(clean)) {
      return { date: new Date(parseInt(clean), 0, 1), isSpecific: false };
    }

    // Heuristic: Check for Month Name + Day + Optional Year (e.g. "Jan 12 26", "feb 2")
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthMatch = months.findIndex(m => clean.toLowerCase().startsWith(m));
    
    if (monthMatch !== -1) {
       // Found a month name start
       const parts = clean.split(' ');
       const yearPart = parts.find(p => /^\d{4}$/.test(p) || /^\d{2}$/.test(p) && parseInt(p) > 31);
       const dayPart = parts.find(p => /^\d{1,2}$/.test(p) && p !== yearPart);
       
       let year = yearPart ? (yearPart.length === 2 ? 2000 + parseInt(yearPart) : parseInt(yearPart)) : currentDate.getFullYear();
       let day = dayPart ? parseInt(dayPart) : 1;
       
       // Clamp day
       const maxDay = new Date(year, monthMatch + 1, 0).getDate();
       day = Math.min(day, maxDay);
       
       return { date: new Date(year, monthMatch, day), isSpecific: !!dayPart };
    }

    // Try standard parsing
    const parsed = new Date(clean);
    if (!isNaN(parsed.getTime())) {
      // Determine if specific day was likely intended
      const hasDay = /\d{1,2}/.test(clean.replace(/\d{4}/, '')); 
      return { date: parsed, isSpecific: hasDay };
    }
    return null;
  };

  const handleDateInputBlur = () => {
    const result = parseSmartDate(dateInputValue);
    if (result) {
      // Valid date found
      setCurrentDate(result.date);
      if (result.isSpecific) {
        setSelectedDay(result.date.getDate());
        // Switch to split view if picking a specific day
        if (layoutMode === 'calendar') setLayoutMode('split');
      }
      // Auto-correct the text to standard format
      setDateInputValue(result.date.toLocaleString('default', { month: 'long', year: 'numeric' }));
    } else {
      // Invalid, revert to current
      setDateInputValue(currentDate.toLocaleString('default', { month: 'long', year: 'numeric' }));
    }
  };
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [generatingPost, setGeneratingPost] = useState(false);
  const [generatedContent, setGeneratedContent] = useState<GeneratedPost | null>(null);
  const [showPostModal, setShowPostModal] = useState(false);
  const [loadingImage, setLoadingImage] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const loadData = async () => {
    try {
      console.log('Loading calendar data for user:', userId);
      const trends = await getTrendingTopicsPH(profile.industry);
      setTrendingTopics(trends);
      
      const savedPosts = await dbService.getUserPosts(userId);
      setPosts(savedPosts);

      const monthName = currentDate.toLocaleString('default', { month: 'long' });
      const savedPlan = await dbService.getPlan(userId, monthName);
      if (savedPlan) {
        setIdeas(savedPlan);
      } else {
        setIdeas([]);
      }
      
      console.log('Loaded posts:', savedPosts.length);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    }
  };

  const handleGeneratePlan = async () => {
    setLoadingPlan(true);
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    const newIdeas = await generateContentPlan(profile, monthName);
    setIdeas(newIdeas);
    await dbService.savePlan(userId, monthName, newIdeas);
    setLoadingPlan(false);
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    // Auto switch to split if in calendar mode to show editor
    if (layoutMode === 'calendar') setLayoutMode('split');
    
    const existingPost = posts.find(p => {
       const d = new Date(p.date);
       return d.getDate() === day && 
              d.getMonth() === currentDate.getMonth() &&
              d.getFullYear() === currentDate.getFullYear();
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
      
      const newPostVersion = {
        caption: result.caption,
        imagePrompt: result.imagePrompt,
        viralityScore: result.viralityScore,
        createdAt: new Date().toISOString()
      };

      setGeneratedContent(prev => {
        if (prev && prev.id) {
           // Regeneration Logic
           if (prev.regenCount >= 2) {
             alert("Regeneration Limit Reached (Max 2). Please use the current version.");
             return prev;
           }
           
           return {
             ...prev,
             caption: result.caption,
             imagePrompt: result.imagePrompt,
             viralityScore: result.viralityScore,
             viralityReason: result.viralityReason,
             regenCount: prev.regenCount + 1,
             history: [...(prev.history || []), newPostVersion]
           };
        } else {
           // New Post
           // Use Local Date Formatting instead of UTC to prevent "jumps"
           const localDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(idea.day).padStart(2, '0')}`;
           
           return {
            id: Date.now().toString(),
            userId,
            date: localDate,
            topic: idea.topic,
            caption: result.caption,
            imagePrompt: result.imagePrompt,
            viralityScore: result.viralityScore,
            viralityReason: result.viralityReason,
            status: 'Draft',
            format: idea.format,
            regenCount: 0,
            history: []
          };
        }
      });
    } catch (e) {
      alert("Failed to generate content. Please try again.");
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleBatchGenerate = async () => {
    if (!ideas.length) return;
    setLoadingPlan(true); // Reuse loading state
    
    // Simulate batch generation for all ideas
    // In a real app, this would be a single API call
    for (const idea of ideas) {
       // Skip if post exists
       const exists = posts.find(p => {
          const d = new Date(p.date);
          return d.getDate() === idea.day && d.getMonth() === currentDate.getMonth();
       });
       if (exists) continue;

       await handleGeneratePost(idea);
       // Small delay to prevent rate limits in simulation
       await new Promise(r => setTimeout(r, 500));
    }
    setLoadingPlan(false);
    alert("Batch Generation Complete!");
  };

  const handleAddOn = async (day: number) => {
    const cost = 150;
    const topic = prompt("Enter topic for this extra post:");
    if (!topic) return;

    const confirm = window.confirm(`Purchase 'Add-on' post for ₱${cost}? This will be deducted from your wallet balance.`);
    if (confirm) {
       try {
         await paymentService.makePayment(cost, `Add-on Post: ${topic}`);
         
         const newIdea: ContentIdea = { day, title: "Add-on Post", topic, format: 'Image' };
         const updatedIdeas = [...ideas, newIdea];
         setIdeas(updatedIdeas);
         
         // Save plan update to DB
         const monthName = currentDate.toLocaleString('default', { month: 'long' });
         await dbService.savePlan(userId, monthName, updatedIdeas);
         
         // Start AI generation
         handleGeneratePost(newIdea);
         alert("Purchase Successful! AI is drafting your post...");
         
       } catch (e: any) {
         alert(e.message || "Payment failed. Please ensure you have enough balance in your wallet.");
       }
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

  const handleSavePost = async (postToSave?: GeneratedPost) => {
    const target = postToSave || generatedContent;
    if (target) {
      try {
        console.log('Saving post:', target.id, target.status);
        await dbService.savePost(target);
        
        // Update both the list and the active editor state
        setPosts(prev => {
          const idx = prev.findIndex(p => p.id === target.id);
          if (idx >= 0) {
            const newPosts = [...prev];
            newPosts[idx] = target;
            return newPosts;
          }
          return [...prev, target];
        });

        if (generatedContent && generatedContent.id === target.id) {
          setGeneratedContent(target);
        }

        console.log('Post saved successfully');
        if (!postToSave) alert("Post Saved to Database!");
      } catch (error) {
        console.error('Error saving post:', error);
        alert("Failed to save post. Please try again.");
      }
    }
  };

  const downloadImage = async (url: string, filename: string) => {
    try {
      // If it's base64, we can download directly
      if (url.startsWith('data:')) {
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        return;
      }

      // Try fetching for blob (works if CORS allowed)
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);
    } catch (e) {
      console.warn("Direct download failed, opening in new tab", e);
      window.open(url, '_blank');
    }
  };

  const handlePostNow = async (platform: 'tiktok' | 'facebook' | 'instagram') => {
    if (!generatedContent) return;
    
    // 1. Force save to DB and State first so it exists in the calendar
    await handleSavePost(generatedContent);

    // 2. Trigger Download
    if (generatedContent.imageUrl) {
      const filename = `kawayan_${platform}_${generatedContent.date}_${Date.now()}.png`;
      downloadImage(generatedContent.imageUrl, filename);
    }

    // 3. Send Message to Extension
    window.postMessage({
      type: 'KAWAYAN_POST_REQUEST',
      data: {
        id: generatedContent.id, // Pass ID for tracking
        title: generatedContent.topic, // Pass topic as title
        caption: generatedContent.caption,
        imageUrl: generatedContent.imageUrl,
        platform: platform
      }
    }, '*');
    
    setShowPostModal(false);
  };

  // Listen for Post Success from Extension
  useEffect(() => {
    const handleExtensionMessage = async (event: MessageEvent) => {
      if (event.data.type === 'KAWAYAN_POST_SUCCESS_CLIENT') {
        const { postId, platform, link } = event.data.data;
        console.log("Received post success from extension:", postId, platform, link);
        
        setPosts(currentPosts => {
          const postIndex = currentPosts.findIndex(p => p.id === postId);
          
          // If for some reason it's not in the list, we can't update it easily here 
          // without the full object, but handlePostNow ensures it's there.
          if (postIndex !== -1) {
            const updatedPost = { 
              ...currentPosts[postIndex], 
              status: 'Published' as const,
              publishedAt: new Date().toISOString(),
              externalLink: link 
            };
            
            // Update DB
            dbService.savePost(updatedPost).catch(e => console.error("Failed to update post status in DB", e));
            
            // If this is the currently viewed post, update the editor too
            if (generatedContent && generatedContent.id === postId) {
              setGeneratedContent(updatedPost);
            }

            const newPosts = [...currentPosts];
            newPosts[postIndex] = updatedPost;
            return newPosts;
          }
          return currentPosts;
        });
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, [generatedContent, dbService]);

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
         // p.date is YYYY-MM-DD
         const [y, m, d] = p.date.split('-').map(Number);
         return d === day && 
                (m - 1) === currentDate.getMonth() && 
                y === currentDate.getFullYear();
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
                {(post.status === 'Scheduled' || post.status === 'Published') && <Check className="w-3 h-3 inline mr-1"/>}
                {post.topic}
             </div>
          ) : idea ? (
            <div className="mt-1 p-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-900/20 border border-indigo-100 dark:border-indigo-800 text-[10px] text-indigo-700 dark:text-indigo-300 font-medium truncate opacity-80 group-hover:opacity-100">
               {idea.format}: {idea.title}
            </div>
          ) : null}

          {!post && !idea && (
             <div 
               className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 cursor-pointer"
               onClick={(e) => {
                 e.stopPropagation();
                 handleAddOn(day);
               }}
             >
                <div className="bg-emerald-50 dark:bg-emerald-900/30 p-1.5 rounded-full text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 transition">
                  <Plus className="w-4 h-4" />
                </div>
             </div>
          )}
        </div>
      );
    }
    
    return slots;
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] gap-6">
      
      {/* Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 w-full max-w-sm shadow-2xl border border-slate-200 dark:border-slate-700">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-slate-900 dark:text-white">Post to...</h3>
              <button onClick={() => setShowPostModal(false)} className="p-1 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition">
                <X className="w-5 h-5 text-slate-500" />
              </button>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => handlePostNow('tiktok')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition group"
              >
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-slate-900 dark:text-white">TikTok</span>
                  <span className="text-xs text-slate-500">Auto-fill caption supported</span>
                </div>
              </button>

              <button 
                onClick={() => handlePostNow('facebook')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition group"
              >
                <div className="w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-slate-900 dark:text-white">Facebook</span>
                  <span className="text-xs text-slate-500">Opens Creator Studio</span>
                </div>
              </button>

              <button 
                onClick={() => handlePostNow('instagram')}
                className="w-full flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700 transition group"
              >
                <div className="w-10 h-10 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-slate-900 dark:text-white">Instagram</span>
                  <span className="text-xs text-slate-500">Opens Create Post</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 flex-1 overflow-hidden">
        
        {/* LEFT: Calendar Grid or List */}
        <div className={`flex flex-col bg-white dark:bg-slate-800 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-700 overflow-hidden transition-all duration-300 ${layoutMode === 'calendar' ? 'xl:col-span-12' : layoutMode === 'split' ? 'xl:col-span-7' : 'hidden'}`}>
          {/* Calendar Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-850">
             <div className="flex items-center gap-2">
               <div className="relative group">
                 <input 
                   type="text" 
                   value={dateInputValue}
                   onChange={(e) => setDateInputValue(e.target.value)}
                   onBlur={handleDateInputBlur}
                   onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                   placeholder="Jump to date..."
                   className="text-lg font-bold text-slate-800 dark:text-white bg-transparent border-b border-dashed border-slate-300 dark:border-slate-600 hover:border-emerald-500 focus:border-emerald-500 focus:ring-0 p-0 w-48 transition-colors outline-none placeholder:font-normal placeholder:text-slate-400"
                 />
                 <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity bg-black text-white text-[10px] px-2 py-1 rounded -bottom-8 left-0 whitespace-nowrap pointer-events-none z-50">
                    Try "Jan 2026", "12/25/25", or just "2026"
                 </div>
               </div>
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
                Auto-Plan
              </button>
              <button 
                onClick={handleBatchGenerate}
                disabled={loadingPlan || ideas.length === 0}
                className="text-xs flex items-center gap-2 bg-indigo-600 border border-indigo-600 text-white font-bold hover:bg-indigo-700 px-3 py-2 rounded-lg transition shadow-sm"
              >
                {loadingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                Batch Create
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
                  <h3 
                    className="text-sm font-bold text-slate-900 dark:text-white truncate max-w-[200px]"
                    title={posts.find(p => new Date(p.date).getDate() === selectedDay)?.topic || ideas.find(i => i.day === selectedDay)?.title || "Create Post"}
                  >
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

                         {/* Version History (Blurred) */}
                         {generatedContent.history && generatedContent.history.length > 0 && (
                           <div className="mb-6">
                             <p className="text-xs font-bold text-slate-400 uppercase mb-2">Previous Versions</p>
                             <div className="space-y-2">
                               {generatedContent.history.map((h, i) => (
                                 <div key={i} className="p-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg relative overflow-hidden group">
                                    <div className="blur-[3px] opacity-50 select-none text-xs text-slate-800 dark:text-slate-300">
                                      {h.caption.substring(0, 50)}...
                                    </div>
                                    <div className="absolute inset-0 flex items-center justify-center bg-white/10 dark:bg-black/10 opacity-0 group-hover:opacity-100 transition">
                                       <span className="text-[10px] font-bold bg-slate-900 text-white px-2 py-1 rounded">Archived</span>
                                    </div>
                                 </div>
                               ))}
                             </div>
                           </div>
                         )}
                         
                         <div className="mb-6 p-4 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-500 dark:text-slate-400">
                            <p className="font-bold mb-2 uppercase text-[10px] flex justify-between items-center">
                               <span>Image Prompt Used:</span>
                               <span className="text-[9px] font-normal opacity-50 italic">Editable</span>
                            </p>
                            <textarea 
                               className="w-full bg-slate-50 dark:bg-slate-900 border-none rounded-lg p-2 text-xs italic opacity-80 focus:opacity-100 focus:ring-1 focus:ring-emerald-500 transition-all resize-none text-slate-600 dark:text-slate-300"
                               rows={3}
                               value={generatedContent.imagePrompt}
                               onChange={(e) => setGeneratedContent({...generatedContent, imagePrompt: e.target.value})}
                               placeholder="Describe the image you want..."
                            />
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
                    onClick={() => handleSavePost()}
                    disabled={!generatedContent}
                    className="flex-1 py-3 rounded-xl border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-slate-700 transition text-sm flex items-center justify-center gap-2"
                 >
                   <Save className="w-4 h-4"/> Save Draft
                 </button>
                 <button 
                   disabled={!generatedContent || generatedContent.status === 'Scheduled'}
                   className={`flex-1 py-3 rounded-xl font-semibold transition text-sm shadow-lg disabled:opacity-50 disabled:cursor-not-allowed ${
                     generatedContent?.status === 'Scheduled' 
                       ? 'bg-emerald-100 text-emerald-800 cursor-default'
                       : 'bg-slate-900 dark:bg-emerald-600 text-white hover:bg-slate-800 dark:hover:bg-emerald-700'
                   }`}
                   onClick={() => {
                     if(generatedContent) {
                       const updated = {...generatedContent, status: 'Scheduled' as const};
                       handleSavePost(updated);
                       alert("Post Scheduled Successfully! 🚀");
                     }
                   }}
                 >
                   {generatedContent?.status === 'Scheduled' ? 'Scheduled' : 'Schedule'}
                 </button>
                 <button 
                    onClick={() => {
                      if (!generatedContent) return;
                      // Open modal instead of sending message directly
                      setShowPostModal(true);
                    }}
                    disabled={!generatedContent}
                    className="flex-1 py-3 rounded-xl border border-indigo-200 bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300 font-semibold hover:bg-indigo-100 dark:hover:bg-indigo-900/40 transition text-sm flex items-center justify-center gap-2"
                 >
                   <Share2 className="w-4 h-4"/> Post Now
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