import React, { useState, useEffect, useRef } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost } from '../types';
import { generateContentPlan, generatePostCaptionAndImagePrompt, generateImageFromPrompt, getTrendingTopicsPH } from '../services/geminiService';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { paymentService } from '../services/paymentService';
import { 
  Loader2, Wand2, Image as ImageIcon, RefreshCcw, Flame, 
  ThumbsUp, MessageCircle, Share2, MoreHorizontal, LayoutList, LayoutGrid, 
  Save, ChevronLeft, ChevronRight, X, Upload, Layers
} from 'lucide-react';
import ScheduleXCalendarView from './calendar/ScheduleXCalendarView';
import { useOrganicDialog } from './OrganicDialog';
import {
  countPostsInMonth,
  getBatchLimitForSubscription,
  isAtTierLimit,
  normalizeIdeasToBatchCount,
  getScheduleDayRange,
  TIER_LIMIT_MESSAGE,
  TIER_LIMIT_TITLE,
} from '../utils/tierLimits';

interface Props {
  profile: BrandProfile;
  userId: string;
}

// Layout: full-screen calendar + sliding right preview panel

const ContentCalendar: React.FC<Props> = ({ profile, userId }) => {
  const dialog = useOrganicDialog();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [batchStrategy, setBatchStrategy] = useState('');
  const [showBatchIdeas, setShowBatchIdeas] = useState(false);
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [dateInputValue, setDateInputValue] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
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
  const [calendarDataVersion, setCalendarDataVersion] = useState(0);
  const [subscription, setSubscription] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('FREE');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const batchPostCount = getBatchLimitForSubscription(subscription);
  const monthlyPostCount = countPostsInMonth(posts, currentDate);
  const trialLimitReached = isAtTierLimit(subscription, monthlyPostCount);

  const showTierLimitDialog = async () => {
    await dialog.alert({
      title: TIER_LIMIT_TITLE,
      message: `${TIER_LIMIT_MESSAGE}\n\nVisit Billing to upgrade your plan.`,
    });
  };

  const guardNewPostCreation = async (): Promise<boolean> => {
    if (!isAtTierLimit(subscription, countPostsInMonth(posts, currentDate))) {
      return true;
    }
    await showTierLimitDialog();
    return false;
  };

  const IMAGE_PROMPT_SUFFIX = ', high quality, professional photography style, 4k';

  const postExistsForDay = (day: number, source: GeneratedPost[] = posts) =>
    source.some((p) => {
      const d = new Date(p.date);
      return (
        d.getDate() === day &&
        d.getMonth() === currentDate.getMonth() &&
        d.getFullYear() === currentDate.getFullYear()
      );
    });

  const createPostFromIdea = async (idea: ContentIdea, id: string): Promise<GeneratedPost> => {
    const result = await generatePostCaptionAndImagePrompt(profile, idea.topic);
    const imageUrl = await generateImageFromPrompt(result.imagePrompt + IMAGE_PROMPT_SUFFIX);
    const localDate = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(idea.day).padStart(2, '0')}`;

    return {
      id,
      userId,
      date: localDate,
      topic: idea.topic,
      caption: result.caption,
      imagePrompt: result.imagePrompt,
      imageUrl: imageUrl || undefined,
      viralityScore: result.viralityScore,
      viralityReason: result.viralityReason,
      status: 'Draft',
      format: idea.format,
      regenCount: 0,
      history: [],
    };
  };

  const mergePostIntoState = (target: GeneratedPost) => {
    setPosts((prev) => {
      const idx = prev.findIndex((p) => p.id === target.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = target;
        return next;
      }
      return [...prev, target];
    });
    setGeneratedContent((prev) => (prev?.id === target.id ? target : prev));
    setCalendarDataVersion((v) => v + 1);
  };

  const persistPost = async (target: GeneratedPost) => {
    try {
      await dbService.savePost(target);
      mergePostIntoState(target);
    } catch (error: any) {
      const msg = String(error?.message || error);
      if (msg.includes('TIER_LIMIT') || msg.includes('403')) {
        await showTierLimitDialog();
        throw error;
      }
      throw error;
    }
  };

  const refreshPostsFromDb = async () => {
    const savedPosts = await dbService.getUserPosts(userId);
    setPosts(savedPosts);
    setCalendarDataVersion((v) => v + 1);
    return savedPosts;
  };

  useEffect(() => {
    paymentService.getWalletData()
      .then((w) => setSubscription(w.subscription))
      .catch(() => setSubscription('FREE'));
  }, []);

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
        const range = getScheduleDayRange(currentDate);
        const normalized = normalizeIdeasToBatchCount(
          savedPlan,
          Math.max(savedPlan.length, 1),
          range
        );
        setIdeas(normalized);
        if (normalized.length > 0) setShowBatchIdeas(true);
      } else {
        setIdeas([]);
      }
      
      console.log('Loaded posts:', savedPosts.length);
      setCalendarDataVersion((v) => v + 1);
    } catch (error) {
      console.error('Error loading calendar data:', error);
    }
  };

  const handleGeneratePlan = async () => {
    setLoadingPlan(true);
    try {
      const monthName = currentDate.toLocaleString('default', { month: 'long' });
      let newIdeas = await generateContentPlan(profile, monthName, batchPostCount);
      if (batchStrategy.trim()) {
        newIdeas = newIdeas.map((idea) => ({
          ...idea,
          topic: `${batchStrategy.trim()} — ${idea.topic}`,
        }));
      }
      newIdeas = normalizeIdeasToBatchCount(newIdeas, batchPostCount, getScheduleDayRange(currentDate));
      setIdeas(newIdeas);
      setShowBatchIdeas(true);
      await dbService.savePlan(userId, monthName, newIdeas);
    } catch (e: any) {
      if (e.message.includes('quota')) {
        await dialog.alert("You have exceeded your daily quota for the Gemini API. Please wait for it to reset or upgrade to a paid plan.");
      } else {
        await dialog.alert(`Failed to generate content plan. Please try again.\n\nError: ${e.message}`);
      }
    } finally {
      setLoadingPlan(false);
    }
  };

  const persistIdeas = async (updated: ContentIdea[]) => {
    const monthName = currentDate.toLocaleString('default', { month: 'long' });
    await dbService.savePlan(userId, monthName, updated);
  };

  const handleUpdateIdea = (index: number, field: keyof ContentIdea, value: string | number) => {
    setIdeas((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      persistIdeas(next).catch(() => undefined);
      return next;
    });
  };

  const handleClosePanel = () => {
    setSelectedDay(null);
  };

  const handleDayClick = (day: number) => {
    setSelectedDay(day);
    
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
      const sameDayAsEditor =
        generatedContent &&
        new Date(generatedContent.date).getDate() === idea.day &&
        new Date(generatedContent.date).getMonth() === currentDate.getMonth() &&
        new Date(generatedContent.date).getFullYear() === currentDate.getFullYear();

      if (sameDayAsEditor && generatedContent.id) {
        if (generatedContent.regenCount >= 2) {
          await dialog.alert('Regeneration Limit Reached (Max 2). Please use the current version.');
          return;
        }

        const result = await generatePostCaptionAndImagePrompt(profile, idea.topic);
        const imageUrl = await generateImageFromPrompt(result.imagePrompt + IMAGE_PROMPT_SUFFIX);
        const newPostVersion = {
          caption: result.caption,
          imagePrompt: result.imagePrompt,
          viralityScore: result.viralityScore,
          createdAt: new Date().toISOString(),
        };

        const updated: GeneratedPost = {
          ...generatedContent,
          caption: result.caption,
          imagePrompt: result.imagePrompt,
          imageUrl: imageUrl || generatedContent.imageUrl,
          viralityScore: result.viralityScore,
          viralityReason: result.viralityReason,
          regenCount: generatedContent.regenCount + 1,
          history: [...(generatedContent.history || []), newPostVersion],
        };
        setGeneratedContent(updated);
        await persistPost(updated);
        return;
      }

      const isNewPostForDay = !postExistsForDay(idea.day);
      if (isNewPostForDay && !(await guardNewPostCreation())) {
        return;
      }

      const post = await createPostFromIdea(idea, Date.now().toString());
      setGeneratedContent(post);
      await persistPost(post);
    } catch (e: any) {
      if (e.message?.includes('TIER_LIMIT')) return;
      if (e.message.includes('quota')) {
        await dialog.alert('You have exceeded your daily quota for the Gemini API. Please wait for it to reset or upgrade to a paid plan.');
      } else {
        await dialog.alert(`Failed to generate content. Please try again.\n\nError: ${e.message}`);
      }
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleBatchGenerate = async () => {
    const scheduleRange = getScheduleDayRange(currentDate);
    const ideasToRun = normalizeIdeasToBatchCount(ideas, batchPostCount, scheduleRange);
    const seenDays = new Set<number>();
    const pending = ideasToRun.filter((idea) => {
      if (idea.day < scheduleRange.minDay || idea.day > scheduleRange.maxDay) return false;
      if (postExistsForDay(idea.day)) return false;
      if (seenDays.has(idea.day)) return false;
      seenDays.add(idea.day);
      return true;
    });

    if (!ideasToRun.length) {
      await dialog.alert({ message: 'Plan the month first to get content ideas.', title: 'No Ideas' });
      return;
    }

    const remaining = getBatchLimitForSubscription(subscription) - monthlyPostCount;
    if (remaining <= 0) {
      await showTierLimitDialog();
      return;
    }

    if (!pending.length) {
      await dialog.alert({ message: 'Every batch slot already has a saved post for this month.', title: 'Nothing to Generate' });
      return;
    }

    const cappedPending = pending.slice(0, remaining);

    setLoadingPlan(true);
    setBatchProgress({ current: 0, total: cappedPending.length });

    let created = 0;

    try {
      for (let i = 0; i < cappedPending.length; i++) {
        const idea = cappedPending[i];
        setBatchProgress({ current: i, total: cappedPending.length });

        const post = await createPostFromIdea(idea, `${Date.now()}-${idea.day}-${i}`);
        await persistPost(post);
        created++;

        if (selectedDay === idea.day) {
          setGeneratedContent(post);
        }

        setBatchProgress({ current: i + 1, total: cappedPending.length });

        if (i < cappedPending.length - 1) {
          await new Promise((r) => setTimeout(r, 400));
        }
      }

      await dialog.alert({
        message: `Created ${created} post${created === 1 ? '' : 's'} with AI captions and images. They're saved as drafts on your calendar.`,
        title: 'Batch Complete',
      });
      await refreshPostsFromDb();
    } catch (e: any) {
      if (e.message?.includes('quota')) {
        await dialog.alert('You have exceeded your daily quota for the Gemini API. Partial batch may have been saved.');
      } else {
        await dialog.alert(`Batch generation stopped. ${created} post${created === 1 ? '' : 's'} were saved.\n\nError: ${e.message}`);
      }
    } finally {
      setLoadingPlan(false);
      setBatchProgress(null);
    }
  };

  const handleAddOn = async (day: number) => {
    if (postExistsForDay(day)) {
      handleDayClick(day);
      return;
    }

    const cost = 1.5;
    const topic = await dialog.prompt({
      title: 'Single Post Add-on · $1.50',
      message: 'Add a standalone post to this date ($1.50). Describe your topic:',
      placeholder: 'e.g. Weekend promo, new menu item…',
    });
    if (!topic) return;

    const confirmed = await dialog.confirm({
      title: 'Confirm $1.50 Add-on',
      message: `Purchase this single post add-on for $${cost.toFixed(2)}? The amount will be deducted from your wallet balance.`,
    });
    if (confirmed) {
       try {
         await paymentService.makePayment(cost, `Add-on Post: ${topic}`);
         
         const newIdea: ContentIdea = { day, title: "Add-on Post", topic, format: 'Image' };
         const updatedIdeas = [...ideas, newIdea];
         setIdeas(updatedIdeas);
         
         const monthName = currentDate.toLocaleString('default', { month: 'long' });
         await dbService.savePlan(userId, monthName, updatedIdeas);
         
         setSelectedDay(day);
         const post = await createPostFromIdea(newIdea, `addon-${Date.now()}`);
         setGeneratedContent(post);
         await persistPost(post);
         await dialog.alert({ message: 'Purchase successful! Your $1.50 add-on post is ready in the preview panel.', title: 'Add-on Purchased' });
         
       } catch (e: any) {
         if (e.message?.includes('TIER_LIMIT')) return;
         await dialog.alert(e.message || "Payment failed. Please ensure you have enough balance in your wallet.");
       }
    }
  };

  const handleGenerateImage = async () => {
    if (!generatedContent) return;
    setLoadingImage(true);
    try {
      const base = await generateImageFromPrompt(generatedContent.imagePrompt + IMAGE_PROMPT_SUFFIX);
      if (!base) {
        await dialog.alert('Failed to generate image. Please try again.');
        return;
      }
      const imageUrl = `${base}${base.includes('?') ? '&' : '?'}seed=${Date.now()}`;
      const updated: GeneratedPost = { ...generatedContent, imageUrl };
      setGeneratedContent(updated);
      if (updated.id) {
        await persistPost(updated);
      }
    } catch (e: any) {
      await dialog.alert(`Failed to regenerate image.\n\nError: ${e.message || 'Unknown error'}`);
    } finally {
      setLoadingImage(false);
    }
  };

  const handleSavePost = async (postToSave?: GeneratedPost) => {
    const target = postToSave || generatedContent;
    if (!target) return;
    try {
      console.log('Saving post:', target.id, target.status);
      await persistPost(target);
      console.log('Post saved successfully');
      if (!postToSave) await dialog.alert({ message: 'Post Saved to Database!', title: 'Saved' });
    } catch (error) {
      console.error('Error saving post:', error);
      await dialog.alert('Failed to save post. Please try again.');
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
            setCalendarDataVersion((v) => v + 1);
            return newPosts;
          }
          return currentPosts;
        });
      }
    };

    window.addEventListener('message', handleExtensionMessage);
    return () => window.removeEventListener('message', handleExtensionMessage);
  }, [generatedContent, dbService]);

  const handleMonthChange = (date: Date) => {
    setCurrentDate(date);
  };

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      setGeneratedContent((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, imageUrl: reader.result as string };
        persistPost(updated).catch((err) => console.error('Failed to persist uploaded photo:', err));
        return updated;
      });
    };
    reader.readAsDataURL(file);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  return (
    <div className="relative w-full min-h-[85vh] flex flex-col gap-6 font-sans text-[#273338] dark:text-white organic-calendar-root">
      
      {/* Post Modal */}
      {showPostModal && (
        <div className="fixed inset-0 bg-[#273338]/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#FFFFFF] dark:bg-[#273338] rounded-tl-[2.5rem] rounded-br-[2.5rem] rounded-[1.5rem] p-6 w-full max-w-sm shadow-float border border-[#273338]/10 dark:border-[#9CB080]/20">
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-display text-xl font-bold text-[#273338] dark:text-white">Post to...</h3>
              <button onClick={() => setShowPostModal(false)} className="rounded-full p-2 hover:bg-slate-900/5 dark:hover:bg-white/5 transition-colors">
                <X className="w-5 h-5 text-[#273338] dark:text-white" />
              </button>
            </div>
            
            <div className="space-y-3">
              <button 
                onClick={() => handlePostNow('tiktok')}
                className="w-full flex items-center gap-4 p-4 rounded-[1.5rem] border border-[#273338]/10 dark:border-[#9CB080]/20 hover:bg-[#273338]/5 dark:hover:bg-white/5 transition-all duration-300 group"
              >
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-[#273338] dark:text-white">TikTok</span>
                  <span className="text-xs text-[#273338]/70 dark:text-white/60">Auto-fill caption supported</span>
                </div>
              </button>

              <button 
                onClick={() => handlePostNow('facebook')}
                className="w-full flex items-center gap-4 p-4 rounded-[1.5rem] border border-[#273338]/10 dark:border-[#9CB080]/20 hover:bg-[#273338]/5 dark:hover:bg-white/5 transition-all duration-300 group"
              >
                <div className="w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-[#273338] dark:text-white">Facebook</span>
                  <span className="text-xs text-[#273338]/70 dark:text-white/60">Opens Creator Studio</span>
                </div>
              </button>

              <button 
                onClick={() => handlePostNow('instagram')}
                className="w-full flex items-center gap-4 p-4 rounded-[1.5rem] border border-[#273338]/10 dark:border-[#9CB080]/20 hover:bg-[#273338]/5 dark:hover:bg-white/5 transition-all duration-300 group"
              >
                <div className="w-10 h-10 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-[#273338] dark:text-white">Instagram</span>
                  <span className="text-xs text-[#273338]/70 dark:text-white/60">Opens Create Post</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch ideation — fluid organic strip */}
      <section className="w-full rounded-[2rem] bg-[#FFFFFF]/90 dark:bg-[#273338]/40 p-6 sm:p-8 shadow-soft backdrop-blur-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-[#2B5748]/15 dark:bg-[#9CB080]/15 flex items-center justify-center">
              <Layers className="w-5 h-5 text-[#2B5748] dark:text-[#9CB080]" />
            </div>
            <div>
              <h2 className="font-display text-lg font-bold text-[#273338] dark:text-white">
                {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })} Content Strategy
              </h2>
              <p className="text-xs text-[#273338]/70 dark:text-white/60">
                {subscription === 'PRO' || subscription === 'ENTERPRISE' ? 'Pro' : 'Trial'} plan · batch up to{' '}
                <span className="font-semibold text-[#2B5748] dark:text-[#9CB080]">{batchPostCount} posts</span>
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[#2B5748] dark:text-[#9CB080] bg-[#2B5748]/10 dark:bg-[#9CB080]/10 px-3 py-1.5 rounded-full">
            {monthlyPostCount}/{batchPostCount} posts this month
          </span>
        </div>

        {trialLimitReached && (
          <p className="text-xs text-[#2B5748] dark:text-[#9CB080] bg-[#2B5748]/8 dark:bg-[#9CB080]/10 border border-[#2B5748]/20 dark:border-[#9CB080]/20 rounded-full px-4 py-2 mb-3 transition-all duration-300">
            Trial limit reached for this month. Upgrade to Pro to keep creating.
          </p>
        )}

        <label className="block text-xs font-bold uppercase tracking-wider text-[#273338]/80 dark:text-white/70 mb-2">
          Describe this month&apos;s overall content strategy
        </label>
        <textarea
          value={batchStrategy}
          onChange={(e) => setBatchStrategy(e.target.value)}
          placeholder='e.g. "Holiday Sale Promotion" or "Local organic bakery items launch"'
          rows={2}
          className="w-full rounded-[1rem] border border-[#273338]/10 dark:border-[#9CB080]/20 bg-white dark:bg-[#273338] px-4 py-3 text-sm text-[#273338] dark:text-white placeholder:text-[#273338]/40 dark:placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#618764]/40 resize-none font-[Nunito,Quicksand,sans-serif]"
        />

        <div className="flex flex-wrap gap-2 mt-4">
          <button
            onClick={handleGeneratePlan}
            disabled={loadingPlan}
            className="text-xs flex items-center gap-1.5 bg-white dark:bg-[#273338] border border-[#273338]/10 dark:border-[#9CB080]/20 text-[#273338] dark:text-white font-bold hover:bg-[#9CB080]/10 dark:hover:bg-white/5 px-4 py-2 rounded-full transition-all duration-300 disabled:opacity-60"
          >
            {loadingPlan ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
            Plan Month
          </button>
          <button
            onClick={handleBatchGenerate}
            disabled={loadingPlan || ideas.length === 0 || trialLimitReached}
            className="text-xs flex items-center gap-2 text-white font-bold px-5 py-2.5 rounded-full transition-all duration-300 disabled:opacity-60 shadow-accent-sm organic-btn-primary"
          >
            {loadingPlan ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                {batchProgress
                  ? `Generating ${batchProgress.current}/${batchProgress.total}…`
                  : 'Starting batch…'}
              </>
            ) : (
              <>
                <Wand2 className="w-3.5 h-3.5" />
                Batch Create {batchPostCount} Posts
              </>
            )}
          </button>
          {ideas.length > 0 && (
            <button
              type="button"
              onClick={() => setShowBatchIdeas((v) => !v)}
              className="text-xs flex items-center gap-1.5 text-[#2B5748] dark:text-[#9CB080] font-bold px-4 py-2 rounded-full border border-[#2B5748] dark:border-[#9CB080] hover:bg-[#2B5748]/5 dark:hover:bg-[#9CB080]/10 transition-all"
            >
              {showBatchIdeas ? 'Hide' : 'Review'} {ideas.length} Ideas
            </button>
          )}
        </div>

        {/* Live editable batch idea cards */}
        {showBatchIdeas && ideas.length > 0 && (
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {ideas.map((idea, index) => (
              <div
                key={`${idea.day}-${index}`}
                className="rounded-[1rem] border border-[#273338]/10 dark:border-[#9CB080]/20 bg-[#273338]/[0.03] dark:bg-white/[0.04] p-3 space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#2B5748] dark:text-[#9CB080]">
                    Day {idea.day}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleDayClick(idea.day)}
                    className="text-[10px] font-semibold text-[#618764] hover:underline"
                  >
                    Open
                  </button>
                </div>
                <input
                  value={idea.title}
                  onChange={(e) => handleUpdateIdea(index, 'title', e.target.value)}
                  className="w-full text-xs font-semibold bg-transparent border-b border-dashed border-[#273338]/20 dark:border-[#9CB080]/30 pb-1 text-[#273338] dark:text-white focus:outline-none"
                  placeholder="Heading"
                />
                <textarea
                  value={idea.topic}
                  onChange={(e) => handleUpdateIdea(index, 'topic', e.target.value)}
                  rows={2}
                  className="w-full text-xs bg-white/60 dark:bg-[#273338]/80 border border-[#273338]/10 dark:border-[#9CB080]/20 rounded-lg p-2 text-[#273338] dark:text-white resize-none focus:outline-none focus:ring-1 focus:ring-[#618764]/40"
                  placeholder="Topic / angle"
                />
                <select
                  value={idea.format}
                  onChange={(e) => handleUpdateIdea(index, 'format', e.target.value)}
                  className="w-full text-[10px] font-bold uppercase tracking-wide bg-transparent border border-[#273338]/10 dark:border-[#9CB080]/20 rounded-full px-2 py-1 text-[#273338] dark:text-white"
                >
                  <option value="Image">Image</option>
                  <option value="Video">Video</option>
                  <option value="Carousel">Carousel</option>
                  <option value="Text">Text</option>
                </select>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Full-screen calendar workspace */}
      <section className="w-full flex-1 flex flex-col min-h-[85vh] organic-calendar-canvas rounded-[2rem] overflow-hidden">
        <div className="flex flex-wrap gap-3 justify-between items-center mb-4 px-2 sm:px-4 pt-2">
          <div className="flex items-center gap-2">
            <div className="relative group">
              <input
                type="text"
                value={dateInputValue}
                onChange={(e) => setDateInputValue(e.target.value)}
                onBlur={handleDateInputBlur}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                placeholder="Jump to date..."
                className="font-display text-lg text-[#273338] dark:text-white bg-transparent border-b border-dashed border-[#2B5748] dark:border-[#9CB080]/40 p-0 w-44 outline-none placeholder:font-normal placeholder:text-[#273338]/50 dark:placeholder:text-white/40"
                style={{ boxShadow: 'none' }}
              />
              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[#273338] text-white text-[10px] px-2 py-1 rounded-full -bottom-8 left-0 whitespace-nowrap pointer-events-none z-50">
                Try &quot;Jan 2026&quot;, &quot;12/25/25&quot;, or &quot;2026&quot;
              </div>
            </div>
            <div className="flex gap-1 ml-1">
              <button
                type="button"
                aria-label="Previous month"
                className="rounded-full p-2 text-[#2B5748] dark:text-[#9CB080] hover:bg-[#2B5748]/10 dark:hover:bg-[#9CB080]/10 transition-all duration-300 hover:scale-110 active:scale-95"
                onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <ChevronLeft className="w-4 h-4"/>
              </button>
              <button
                type="button"
                aria-label="Next month"
                className="rounded-full p-2 text-[#2B5748] dark:text-[#9CB080] hover:bg-[#2B5748]/10 dark:hover:bg-[#9CB080]/10 transition-all duration-300 hover:scale-110 active:scale-95"
                onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <ChevronRight className="w-4 h-4"/>
              </button>
            </div>
            <div className="flex gap-0.5 ml-1 p-1 bg-[#273338]/5 dark:bg-white/5 rounded-full border border-[#273338]/10 dark:border-[#9CB080]/20">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded-full transition-all duration-300 ${viewMode === 'grid' ? 'bg-white dark:bg-[#2B5748]/50 shadow-sm text-[#2B5748] dark:text-[#9CB080]' : 'text-[#273338] dark:text-white/70'}`}
                title="Month grid"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded-full transition-all duration-300 ${viewMode === 'list' ? 'bg-white dark:bg-[#2B5748]/50 shadow-sm text-[#2B5748] dark:text-[#9CB080]' : 'text-[#273338] dark:text-white/70'}`}
                title="Month list"
              >
                <LayoutList className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
          <p className="text-[11px] font-medium text-[#618764] dark:text-[#9CB080]/80 max-w-sm text-right hidden sm:block">
            Click any day to preview or generate · use <span className="font-bold text-[#2B5748] dark:text-[#9CB080]">ADD</span> on empty cells for $1.50 add-on
          </p>
        </div>

        <div className="flex-1 min-h-0 px-1 sm:px-2 pb-4">
        <ScheduleXCalendarView
          currentDate={currentDate}
          posts={posts}
          ideas={ideas}
          selectedDay={selectedDay}
          viewMode={viewMode}
          calendarDataVersion={calendarDataVersion}
          onDayClick={handleDayClick}
          onMonthChange={handleMonthChange}
          onAddOn={handleAddOn}
        />
        </div>
      </section>

      {/* Dim backdrop when preview drawer is open */}
      {selectedDay !== null && (
        <button
          type="button"
          aria-label="Close preview"
          className="fixed inset-0 bg-[#273338]/25 dark:bg-black/40 z-40 transition-opacity duration-300 backdrop-blur-[2px]"
          onClick={handleClosePanel}
        />
      )}

      {/* Sliding right preview panel */}
      <div
        className={`fixed top-0 right-0 h-full w-full sm:w-[450px] bg-[#FFFFFF] dark:bg-[#273338] border-l border-slate-900/10 dark:border-[#9CB080]/20 p-8 shadow-float z-50 transition-transform duration-300 flex flex-col ${
          selectedDay !== null ? 'translate-x-0' : 'translate-x-full pointer-events-none'
        }`}
        aria-hidden={selectedDay === null}
      >
        {selectedDay !== null && (
          <>
            <div className="flex justify-between items-start mb-6 shrink-0 gap-4">
              <div className="min-w-0">
                <span className="text-[10px] font-bold uppercase tracking-widest text-[#2B5748] dark:text-[#9CB080]">
                  {currentDate.toLocaleString('default', { month: 'long' })} {selectedDay}
                </span>
                <h3
                  className="font-display text-xl font-bold text-[#273338] dark:text-white truncate mt-1"
                  title={posts.find(p => new Date(p.date).getDate() === selectedDay)?.topic || ideas.find(i => i.day === selectedDay)?.title || 'Create Post'}
                >
                  {posts.find(p => new Date(p.date).getDate() === selectedDay)?.topic || ideas.find(i => i.day === selectedDay)?.title || 'Create Post'}
                </h3>
              </div>
              <button
                type="button"
                onClick={handleClosePanel}
                className="rounded-full p-3 bg-[#2B5748]/8 dark:bg-white/8 hover:bg-[#2B5748]/15 dark:hover:bg-white/12 border border-[#2B5748]/20 dark:border-[#9CB080]/30 transition-all duration-300 hover:scale-105 active:scale-95 shrink-0"
                aria-label="Close preview panel"
              >
                <X className="w-6 h-6 text-[#2B5748] dark:text-[#9CB080]" />
              </button>
            </div>

            <div className="flex justify-end mb-4 shrink-0">
              <button
                className="text-white text-xs px-4 py-2 rounded-full font-bold transition-all duration-300 hover:scale-105 active:scale-95 flex items-center gap-1.5 disabled:opacity-60 disabled:transform-none shadow-accent-sm organic-btn-primary"
                onClick={() => {
                  const idea = ideas.find(i => i.day === selectedDay);
                  const fallbackIdea: ContentIdea = { day: selectedDay, title: 'Custom Post', topic: 'General Update', format: 'Image' };
                  handleGeneratePost(idea || fallbackIdea);
                }}
                disabled={generatingPost}
              >
                {generatingPost ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : (generatedContent ? <><RefreshCcw className="w-3 h-3"/> Rewrite</> : <><Wand2 className="w-3 h-3"/> AI Draft</>)}
              </button>
            </div>

            <div className="flex-1 overflow-y-auto -mx-2 px-2">
              {!generatedContent ? (
                <div className="flex flex-col items-center justify-center min-h-[40vh] text-center p-4">
                  <div className="w-16 h-16 rounded-full flex items-center justify-center mb-4 shadow-accent organic-btn-primary">
                    <Wand2 className="w-8 h-8 text-white" />
                  </div>
                  <h4 className="font-display text-lg text-[#273338] dark:text-white">Ready to create?</h4>
                  <p className="text-[#273338]/70 dark:text-white/60 text-sm max-w-[260px] mt-2 leading-relaxed">
                    {ideas.find(i => i.day === selectedDay)
                      ? `Idea: "${ideas.find(i => i.day === selectedDay)?.topic}"`
                      : "Hit 'AI Draft' to generate Taglish content for this day."}
                    <span className="block mt-2 text-[11px] text-[#618764] dark:text-[#9CB080]/70">
                      Empty days show an <span className="font-semibold">ADD</span> pill ($1.50 single-post add-on).
                    </span>
                  </p>
                </div>
              ) : (
                <div className="w-full max-w-sm mx-auto space-y-6 pb-6">
                  <div className="bg-white/80 dark:bg-white/5 rounded-[2rem] p-4 shadow-soft border border-[#273338]/10 dark:border-[#9CB080]/20">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-[#273338]/70 dark:text-white/60 uppercase flex items-center gap-1">
                        <Flame className="w-3 h-3 text-[#2B5748] dark:text-[#9CB080]"/> Virality Potential
                      </span>
                      <span className={`text-lg font-black ${
                        (generatedContent.viralityScore || 0) > 75 ? 'text-[#2B5748] dark:text-[#9CB080]' :
                        (generatedContent.viralityScore || 0) > 50 ? 'text-[#2B5748]' : 'text-[#273338]/50 dark:text-white/50'
                      }`}>
                        {generatedContent.viralityScore}/100
                      </span>
                    </div>
                    <div className="w-full bg-[#9CB080]/30 dark:bg-[#2B5748]/50 rounded-full h-2 mb-3">
                      <div
                        className={`h-2 rounded-full transition-all duration-1000 ${
                          (generatedContent.viralityScore || 0) > 75 ? 'bg-gradient-to-r from-[#2B5748] to-[#273338]' : 'bg-gradient-to-r from-[#9CB080] to-[#2B5748]'
                        }`}
                        style={{ width: `${generatedContent.viralityScore}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#273338]/80 dark:text-white/70 italic leading-relaxed">
                      &ldquo;{generatedContent.viralityReason}&rdquo;
                    </p>
                  </div>

                  {generatedContent.history && generatedContent.history.length > 0 && (
                    <div>
                      <p className="text-xs font-bold text-[#273338]/70 dark:text-white/60 uppercase mb-2">Previous Versions</p>
                      <div className="space-y-2">
                        {generatedContent.history.map((h, i) => (
                          <div key={i} className="p-3 bg-white/80 dark:bg-white/5 border border-[#273338]/10 dark:border-[#9CB080]/20 rounded-[1rem] relative overflow-hidden group">
                            <div className="blur-[3px] opacity-50 select-none text-xs text-[#273338] dark:text-white/70">
                              {h.caption.substring(0, 50)}...
                            </div>
                            <div className="absolute inset-0 flex items-center justify-center bg-white/10 dark:bg-black/10 opacity-0 group-hover:opacity-100 transition-all duration-300">
                              <span className="text-[10px] font-bold bg-[#273338] text-white px-2 py-1 rounded-full">Archived</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="p-4 rounded-[2rem] bg-white/80 dark:bg-white/5 border border-[#273338]/10 dark:border-[#9CB080]/20 text-xs text-[#273338]/70 dark:text-white/60">
                    <p className="font-bold mb-2 uppercase text-[10px] flex justify-between items-center">
                      <span>Image Prompt Used:</span>
                      <span className="text-[9px] font-normal opacity-50 italic">Editable</span>
                    </p>
                    <textarea
                      className="w-full bg-[#9CB080]/20 dark:bg-[#273338] border-none rounded-[1rem] p-3 text-xs italic focus:ring-1 focus:ring-[#2B5748] dark:focus:ring-[#9CB080] transition-all resize-none text-[#273338] dark:text-white"
                      rows={3}
                      value={generatedContent.imagePrompt}
                      onChange={(e) => setGeneratedContent({...generatedContent, imagePrompt: e.target.value})}
                      placeholder="Describe the image you want..."
                    />
                  </div>

                  <div>
                    <p className="text-xs font-bold text-[#273338]/70 dark:text-white/60 uppercase mb-2 tracking-wider">Your Photo</p>
                    <button
                      type="button"
                      onClick={() => photoInputRef.current?.click()}
                      className="w-full py-5 rounded-[1.5rem] border-2 border-dashed border-[#2B5748] dark:border-[#9CB080] bg-white/40 dark:bg-white/5 flex flex-col items-center gap-2 hover:bg-[#2B5748]/5 dark:hover:bg-[#9CB080]/10 transition-all duration-300 group"
                    >
                      <Upload className="w-5 h-5 text-[#2B5748] dark:text-[#9CB080]" />
                      <span className="text-xs text-[#273338] dark:text-white font-medium">
                        Drop or click to upload your photo
                      </span>
                      <span className="text-[10px] text-[#273338]/50 dark:text-white/40">JPG or PNG · replaces AI visual</span>
                    </button>
                    <input
                      ref={photoInputRef}
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                    />
                  </div>

                  <div className="bg-white dark:bg-black rounded-[2rem] border-[6px] border-[#273338] dark:border-[#9CB080]/30 shadow-float overflow-hidden relative mx-auto w-full">
                    <div className="h-6 bg-[#273338] w-full flex justify-between px-6 items-center">
                      <div className="w-12 h-3 bg-black dark:bg-[#2B5748]/40 rounded-full" />
                      <div className="flex gap-1">
                        <div className="w-3 h-3 bg-[#273338] rounded-full" />
                        <div className="w-3 h-3 bg-[#273338] rounded-full" />
                      </div>
                    </div>

                    <div className="p-3 border-b border-[#9CB080]/30 flex items-center gap-3 bg-white dark:bg-black">
                      <div className="w-8 h-8 rounded-full bg-[#2B5748]/15 flex items-center justify-center text-[#2B5748] dark:text-[#9CB080] font-bold text-xs border border-[#273338]/10 dark:border-[#9CB080]/20">
                        {profile.businessName.substring(0,2).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="text-xs font-bold text-[#273338] dark:text-white">{profile.businessName}</p>
                        <p className="text-[10px] text-[#273338]/50 dark:text-white/50">Sponsored · Kawayan AI</p>
                      </div>
                      <MoreHorizontal className="w-4 h-4 text-[#273338] dark:text-white/60" />
                    </div>

                    <div className="aspect-square bg-[#9CB080]/20 dark:bg-[#273338] relative overflow-hidden">
                      {generatedContent.imageUrl ? (
                        <div className="w-full h-full overflow-hidden relative">
                          <img
                            key={generatedContent.imageUrl}
                            src={generatedContent.imageUrl}
                            alt="Post visual"
                            className="w-full h-full object-cover"
                          />
                          {loadingImage && (
                            <div className="absolute inset-0 bg-[#273338]/40 flex items-center justify-center">
                              <Loader2 className="w-8 h-8 animate-spin text-white" />
                            </div>
                          )}
                          <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                            <button
                              type="button"
                              onClick={handleGenerateImage}
                              disabled={loadingImage}
                              className="rounded-full px-3 py-1.5 text-xs font-bold border border-[#2B5748] dark:border-[#9CB080] text-[#2B5748] dark:text-[#9CB080] bg-white/95 dark:bg-[#273338]/95 backdrop-blur-sm flex items-center gap-1.5 hover:bg-[#2B5748]/5 dark:hover:bg-[#9CB080]/10 transition-all disabled:opacity-60 shadow-soft"
                            >
                              {loadingImage ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <RefreshCcw className="w-3 h-3" />
                              )}
                              Regenerate Image
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center">
                          <ImageIcon className="w-8 h-8 text-[#2B5748] dark:text-[#9CB080] mb-2" />
                          <p className="text-xs text-[#273338]/60 dark:text-white/50 mb-4 line-clamp-3">{generatedContent.imagePrompt}</p>
                          <button
                            type="button"
                            onClick={handleGenerateImage}
                            disabled={loadingImage}
                            className="organic-btn-primary text-xs px-4 py-2 rounded-full flex items-center gap-2"
                          >
                            {loadingImage ? <Loader2 className="w-3 h-3 animate-spin"/> : <Wand2 className="w-3 h-3"/>}
                            Generate Visual
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="p-3 flex justify-between items-center text-[#273338] dark:text-white/70 bg-white dark:bg-black">
                      <div className="flex gap-4">
                        <ThumbsUp className="w-5 h-5" />
                        <MessageCircle className="w-5 h-5" />
                        <Share2 className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="px-3 pb-6 bg-white dark:bg-black">
                      <p className="text-sm text-[#273338] dark:text-white font-bold mb-1">{Math.floor(Math.random() * 500) + 10} likes</p>
                      <div className="text-xs text-[#273338] dark:text-white/90 leading-relaxed whitespace-pre-wrap">
                        <span className="font-bold mr-1">{profile.businessName}</span>
                        <textarea
                          className="w-full bg-transparent border-none p-0 resize-none focus:ring-0 text-[#273338] dark:text-white"
                          rows={4}
                          value={generatedContent.caption}
                          onChange={(e) => setGeneratedContent({...generatedContent, caption: e.target.value})}
                        />
                      </div>
                      <p className="text-[10px] text-[#273338]/50 dark:text-white/40 mt-2 uppercase">View all comments</p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 mt-4 border-t border-[#273338]/10 dark:border-[#9CB080]/20 flex gap-3 shrink-0">
              <button
                onClick={() => handleSavePost()}
                disabled={!generatedContent}
                className="flex-1 py-3 rounded-full border border-[#273338]/10 dark:border-[#9CB080]/20 text-[#273338] dark:text-white font-semibold hover:bg-[#9CB080]/10 dark:hover:bg-white/5 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Save className="w-4 h-4"/> Save Draft
              </button>
              <button
                disabled={!generatedContent || generatedContent.status === 'Scheduled'}
                className={`flex-1 py-3 rounded-full font-semibold transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed ${
                  generatedContent?.status === 'Scheduled'
                    ? 'bg-[#2B5748]/15 text-[#2B5748] dark:text-[#9CB080] cursor-default'
                    : 'organic-btn-primary'
                }`}
                onClick={async () => {
                  if (generatedContent) {
                    const updated = {...generatedContent, status: 'Scheduled' as const};
                    await handleSavePost(updated);
                    await dialog.alert({ message: 'Post Scheduled Successfully! 🚀', title: 'Scheduled' });
                  }
                }}
              >
                {generatedContent?.status === 'Scheduled' ? 'Scheduled' : 'Schedule'}
              </button>
              <button
                onClick={() => {
                  if (!generatedContent) return;
                  setShowPostModal(true);
                }}
                disabled={!generatedContent}
                className="flex-1 py-3 rounded-full border border-[#2B5748]/40 dark:border-[#9CB080]/40 bg-[#2B5748]/10 dark:bg-[#9CB080]/10 text-[#2B5748] dark:text-[#9CB080] font-semibold hover:bg-[#2B5748]/20 dark:hover:bg-[#9CB080]/20 transition-all text-sm flex items-center justify-center gap-2 disabled:opacity-50"
              >
                <Share2 className="w-4 h-4"/> Post Now
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ContentCalendar;