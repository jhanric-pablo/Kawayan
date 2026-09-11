import React, { useState, useEffect, useRef } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost } from '../types';
import { generateContentPlan, generatePostCaptionAndImagePrompt, generateImageFromPrompt, getTrendingTopicsPH } from '../services/geminiService';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { paymentService } from '../services/paymentService';
import {
  LayoutList, LayoutGrid, ChevronLeft, ChevronRight, X, Layers
} from 'lucide-react';
import KawayanCalendar from './calendar/KawayanCalendar';
import PostComposer from './calendar/PostComposer';
import PlanningModal from './calendar/PlanningModal';
import { useOrganicDialog } from './OrganicDialog';
import { useToast } from './ui/Toast';
import {
  countPostsInMonth,
  getBatchLimitForSubscription,
  isAtTierLimit,
  normalizeIdeasToBatchCount,
  getScheduleDayRange,
  TIER_LIMIT_MESSAGE,
  TIER_LIMIT_TITLE,
  ADDON_POST_PRICE_PHP,
} from '../utils/tierLimits';

interface Props {
  profile: BrandProfile;
  userId: string;
}

// Layout: full-screen calendar + sliding right preview panel

const ContentCalendar: React.FC<Props> = ({ profile, userId }) => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [batchStrategy, setBatchStrategy] = useState('');
  const [showBatchIdeas, setShowBatchIdeas] = useState(false);
  const [planningOpen, setPlanningOpen] = useState(false); // collapsible AI planning panel (UI only)
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
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    // Trending topics come from the (sometimes slow / offline) AI proxy — never
    // let it block the calendar. Fire it separately, apply whenever it lands.
    getTrendingTopicsPH(profile.industry)
      .then(setTrendingTopics)
      .catch(() => undefined);

    // Posts + saved plan are what the calendar actually renders — load them
    // independently so one failing does not blank the other.
    const [postsRes, planRes] = await Promise.allSettled([
      dbService.getUserPosts(userId),
      dbService.getPlan(userId, monthName),
    ]);

    if (postsRes.status === 'fulfilled') {
      setPosts(postsRes.value);
    } else {
      console.error('Error loading posts:', postsRes.reason);
      toast.error('Could not load your calendar — retrying may help.');
    }

    if (planRes.status === 'fulfilled' && planRes.value) {
      const range = getScheduleDayRange(currentDate);
      const normalized = normalizeIdeasToBatchCount(
        planRes.value,
        Math.max(planRes.value.length, 1),
        range
      );
      setIdeas(normalized);
      if (normalized.length > 0) setShowBatchIdeas(true);
    } else if (planRes.status === 'fulfilled') {
      setIdeas([]);
    }

    setCalendarDataVersion((v) => v + 1);
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
      setPlanningOpen(true);
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

    const cost = ADDON_POST_PRICE_PHP;
    const topic = await dialog.prompt({
      title: `Single Post Add-on · ₱${cost}`,
      message: `Add a standalone post to this date (₱${cost}). Describe your topic:`,
      placeholder: 'e.g. Weekend promo, new menu item…',
    });
    if (!topic) return;

    const confirmed = await dialog.confirm({
      title: `Confirm ₱${cost} Add-on`,
      message: `Purchase this single post add-on for ₱${cost.toLocaleString()}? The amount will be deducted from your wallet balance.`,
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
         await dialog.alert({ message: `Purchase successful! Your ₱${cost} add-on post is ready in the preview panel.`, title: 'Add-on Purchased' });
         
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
      // Cache-busting query param only makes sense for real URLs (Pollinations fallback);
      // a data: URL is already unique per generation and a query string corrupts it.
      const imageUrl = base.startsWith('data:') ? base : `${base}${base.includes('?') ? '&' : '?'}seed=${Date.now()}`;
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
      await persistPost(target);
      if (!postToSave) toast.success('Draft saved');
    } catch (error) {
      console.error('Error saving post:', error);
      toast.error('Could not save the post — please retry.');
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

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  const STATUS_LEGEND: { key: string; label: string }[] = [
    { key: 'idea', label: 'Idea' },
    { key: 'draft', label: 'Draft' },
    { key: 'scheduled', label: 'Scheduled' },
    { key: 'published', label: 'Published' },
  ];

  return (
    <div className="relative w-full flex flex-col gap-4 pb-16 font-sans text-[var(--fg)]">

      {/* Post Modal */}
      {showPostModal && (
        <div className="kw-overlay" onClick={() => setShowPostModal(false)}>
          <div className="kw-sheet p-6 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-5">
              <h3 className="font-display text-lg font-bold text-[var(--fg)]">Post to…</h3>
              <button onClick={() => setShowPostModal(false)} className="rounded-lg p-1.5 text-[var(--fg-muted)] hover:text-[var(--fg)] hover:bg-[var(--bg-alt)] transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              <button
                onClick={() => handlePostNow('tiktok')}
                className="w-full flex items-center gap-4 p-3.5 rounded-xl border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-alt)] transition-colors group"
              >
                <div className="w-10 h-10 bg-black rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z"/></svg>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-[var(--fg)]">TikTok</span>
                  <span className="text-xs text-[var(--fg-muted)]">Auto-fill caption supported</span>
                </div>
              </button>

              <button 
                onClick={() => handlePostNow('facebook')}
                className="w-full flex items-center gap-4 p-3.5 rounded-xl border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-alt)] transition-colors group"
              >
                <div className="w-10 h-10 bg-[#1877F2] rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-[var(--fg)]">Facebook</span>
                  <span className="text-xs text-[var(--fg-muted)]">Opens Creator Studio</span>
                </div>
              </button>

              <button 
                onClick={() => handlePostNow('instagram')}
                className="w-full flex items-center gap-4 p-3.5 rounded-xl border border-[var(--border)] hover:border-[var(--border-strong)] hover:bg-[var(--bg-alt)] transition-colors group"
              >
                <div className="w-10 h-10 bg-gradient-to-tr from-[#f09433] via-[#dc2743] to-[#bc1888] rounded-full flex items-center justify-center text-white shrink-0 group-hover:scale-110 transition">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"></rect><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"></path><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"></line></svg>
                </div>
                <div className="text-left">
                  <span className="block font-bold text-[var(--fg)]">Instagram</span>
                  <span className="text-xs text-[var(--fg-muted)]">Opens Create Post</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────  Calendar workspace (primary)  ───────────── */}
      <section className="w-full rounded-2xl border border-[var(--border)] bg-[var(--card)] shadow-sm p-3 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="font-display text-xl sm:text-2xl font-bold text-[var(--fg)] tracking-tight mr-1">
              {monthLabel}
            </h1>
            <div className="flex items-center rounded-lg border border-[var(--border-strong)] overflow-hidden">
              <button
                type="button"
                aria-label="Previous month"
                className="p-2 text-[var(--fg-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-alt)] transition-colors"
                onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="px-2.5 py-1.5 text-xs font-semibold text-[var(--fg-muted)] hover:text-[var(--primary)] border-x border-[var(--border-strong)] hover:bg-[var(--bg-alt)] transition-colors"
                onClick={() => setCurrentDate(new Date())}
              >
                Today
              </button>
              <button
                type="button"
                aria-label="Next month"
                className="p-2 text-[var(--fg-muted)] hover:text-[var(--primary)] hover:bg-[var(--bg-alt)] transition-colors"
                onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="relative group hidden sm:block">
              <input
                type="text"
                value={dateInputValue}
                onChange={(e) => setDateInputValue(e.target.value)}
                onBlur={handleDateInputBlur}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                placeholder="Jump to date…"
                aria-label="Jump to date"
                className="text-sm text-[var(--fg-muted)] bg-[var(--bg-alt)] border border-[var(--border-strong)] rounded-lg px-3 py-1.5 w-36 outline-none focus:ring-2 focus:ring-[rgba(43,87,72,0.18)] focus:border-[var(--primary)] placeholder:text-[var(--fg-subtle)]"
              />
              <div className="absolute opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-[var(--kw-forest)] text-white text-[10px] px-2 py-1 rounded-lg -bottom-9 left-0 whitespace-nowrap pointer-events-none z-50 shadow-lg">
                Try &quot;Jan 2026&quot;, &quot;12/25/25&quot;, or &quot;2026&quot;
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-[var(--primary)] bg-[rgba(43,87,72,0.08)] dark:bg-[rgba(156,176,128,0.12)] px-2.5 py-1 rounded-full">
              {monthlyPostCount}/{batchPostCount} this month
            </span>
            <div className="flex gap-0.5 p-0.5 bg-[var(--bg-alt)] rounded-lg border border-[var(--border-strong)]">
              <button
                onClick={() => setViewMode('grid')}
                aria-pressed={viewMode === 'grid'}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-[var(--card)] shadow-sm text-[var(--primary)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
                title="Month grid"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-pressed={viewMode === 'list'}
                className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-[var(--card)] shadow-sm text-[var(--primary)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]'}`}
                title="Month list"
              >
                <LayoutList className="w-4 h-4" />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setPlanningOpen(true)}
              className="btn btn-primary btn-sm"
              title="AI content planning"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Plan month</span>
              {ideas.length > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.1rem] h-[1.1rem] px-1 rounded-full bg-white/25 text-[10px] font-black">
                  {ideas.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <KawayanCalendar
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

        <div className="flex flex-wrap items-center justify-between gap-3 mt-3 pt-3 border-t border-[var(--border)]">
          <div className="kw-cal-legend">
            {STATUS_LEGEND.map((s) => (
              <span key={s.key} className="kw-cal-legend__item">
                <span className={`kw-cal-legend__dot kw-cal-legend__dot--${s.key}`} />
                {s.label}
              </span>
            ))}
          </div>
          <p className="text-xs text-[var(--fg-muted)] hidden md:block">
            Click a day to preview, draft, or add a ₱{ADDON_POST_PRICE_PHP} single post
          </p>
        </div>
      </section>

      {/* ── AI content-planning dialog (opened from the toolbar) ── */}
      <PlanningModal
        open={planningOpen}
        onClose={() => setPlanningOpen(false)}
        monthLabel={monthLabel}
        planLabel={subscription === 'PRO' || subscription === 'ENTERPRISE' ? 'Pro' : 'Trial'}
        batchPostCount={batchPostCount}
        monthlyPostCount={monthlyPostCount}
        trialLimitReached={trialLimitReached}
        batchStrategy={batchStrategy}
        onStrategyChange={setBatchStrategy}
        loadingPlan={loadingPlan}
        batchProgress={batchProgress}
        ideas={ideas}
        showBatchIdeas={showBatchIdeas}
        onToggleIdeas={() => setShowBatchIdeas((v) => !v)}
        onGeneratePlan={handleGeneratePlan}
        onBatchGenerate={handleBatchGenerate}
        onUpdateIdea={handleUpdateIdea}
        onOpenDay={handleDayClick}
      />

      {/* ── Post creation studio ── */}
      <PostComposer
        open={selectedDay !== null}
        selectedDay={selectedDay}
        currentDate={currentDate}
        profile={profile}
        posts={posts}
        ideas={ideas}
        generatedContent={generatedContent}
        setGeneratedContent={setGeneratedContent}
        generatingPost={generatingPost}
        loadingImage={loadingImage}
        addOnPrice={ADDON_POST_PRICE_PHP}
        photoInputRef={photoInputRef}
        onClose={handleClosePanel}
        onGeneratePost={handleGeneratePost}
        onAddOn={handleAddOn}
        onGenerateImage={handleGenerateImage}
        onSavePost={handleSavePost}
        onPhotoUpload={handlePhotoUpload}
        onPostNow={() => { if (generatedContent) setShowPostModal(true); }}
        onSchedule={async () => {
          if (generatedContent) {
            const updated = { ...generatedContent, status: 'Scheduled' as const };
            await handleSavePost(updated);
            toast.success('Post scheduled 🚀');
          }
        }}
      />

    </div>
  );
};

export default ContentCalendar;
