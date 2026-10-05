import React, { useState, useEffect, useRef } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost } from '../types';
import { generateContentPlan, generatePostCaptionAndImagePrompt, generateImageFromPrompt, getTrendingTopicsPH, rewriteCaption } from '../services/aiService';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { paymentService } from '../services/paymentService';
import { socialService, SocialAccount } from '../services/socialService';
import {
  LayoutList, LayoutGrid, ChevronLeft, ChevronRight, Layers
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
  /** Opens the Social page, where Facebook and Instagram get connected. */
  onOpenSocial: () => void;
  onOpenBilling: () => void;
}

// Layout: full-screen calendar + sliding right preview panel

const ContentCalendar: React.FC<Props> = ({ profile, userId, onOpenSocial, onOpenBilling }) => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [batchStrategy, setBatchStrategy] = useState('');
  const [planningOpen, setPlanningOpen] = useState(false); // collapsible AI planning panel (UI only)
  const [currentDate, setCurrentDate] = useState(new Date()); 
  const [dateInputValue, setDateInputValue] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);
  const [creatingDay, setCreatingDay] = useState<number | null>(null);
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
  const [socialAccounts, setSocialAccounts] = useState<SocialAccount[] | null>(null);
  const [socialError, setSocialError] = useState('');
  const [publishing, setPublishing] = useState(false);
  // The post as it is now, for handlers that finish after a slow AI call.
  const contentRef = useRef<GeneratedPost | null>(null);
  contentRef.current = generatedContent;
  const [loadingImage, setLoadingImage] = useState(false);
  const [trendingTopics, setTrendingTopics] = useState<string[]>([]);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [calendarDataVersion, setCalendarDataVersion] = useState(0);
  const [subscription, setSubscription] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('FREE');
  const photoInputRef = useRef<HTMLInputElement>(null);

  const batchPostCount = getBatchLimitForSubscription(subscription);
  const monthlyPostCount = countPostsInMonth(posts, currentDate);
  const trialLimitReached = isAtTierLimit(subscription, monthlyPostCount);

  // Each day's post status this month (date strings, so no time-zone shift), for the planner.
  const monthPrefix = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-`;
  const postStatusByDay: Record<number, GeneratedPost['status']> = {};
  posts.forEach((p) => {
    if (p.date.startsWith(monthPrefix)) postStatusByDay[Number(p.date.slice(8, 10))] = p.status;
  });

  // The ideas a batch run would turn into posts: exactly the ones on screen that are still
  // ahead, have no post yet, and one per day.
  const pendingIdeas = () => {
    const { minDay, maxDay } = getScheduleDayRange(currentDate);
    const seenDays = new Set<number>();
    return ideas.filter((idea) => {
      if (idea.day < minDay || idea.day > maxDay || postStatusByDay[idea.day] || seenDays.has(idea.day)) return false;
      seenDays.add(idea.day);
      return true;
    });
  };
  const createCount = Math.min(pendingIdeas().length, Math.max(0, batchPostCount - monthlyPostCount));

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
    } else if (planRes.status === 'fulfilled') {
      setIdeas([]);
    }

    setCalendarDataVersion((v) => v + 1);
  };

  const handleGeneratePlan = async () => {
    if (
      ideas.length > 0 &&
      !(await dialog.confirm({
        title: 'Re-plan the month?',
        message: 'This replaces your current ideas, including any edits. Posts you already created stay on the calendar.',
        confirmLabel: 'Re-plan',
      }))
    ) {
      return;
    }
    setLoadingPlan(true);
    try {
      const monthName = currentDate.toLocaleString('default', { month: 'long' });
      let newIdeas = await generateContentPlan(profile, monthName, batchPostCount, batchStrategy);
      newIdeas = normalizeIdeasToBatchCount(newIdeas, batchPostCount, getScheduleDayRange(currentDate));
      setIdeas(newIdeas);
      setPlanningOpen(true);
      await dbService.savePlan(userId, monthName, newIdeas);
    } catch (e: any) {
      if (e.message.includes('quota')) {
        await dialog.alert("Kawayan's AI has used up today's free allowance. Please try again later.");
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

  // Idea edits save once typing pauses, not once per keystroke.
  const ideaSaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const handleUpdateIdea = (index: number, field: keyof ContentIdea, value: string | number) => {
    setIdeas((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      clearTimeout(ideaSaveTimer.current);
      ideaSaveTimer.current = setTimeout(() => persistIdeas(next).catch(() => undefined), 700);
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
        const replacedVersion = {
          caption: generatedContent.caption,
          imagePrompt: generatedContent.imagePrompt,
          viralityScore: generatedContent.viralityScore,
          viralityReason: generatedContent.viralityReason,
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
          history: [...(generatedContent.history || []), replacedVersion],
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
        await dialog.alert("Kawayan's AI has used up today's free allowance. Please try again later.");
      } else {
        await dialog.alert(`Failed to generate content. Please try again.\n\nError: ${e.message}`);
      }
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleBatchGenerate = async () => {
    const pending = pendingIdeas();

    if (!ideas.length) {
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
        setCreatingDay(idea.day);

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

      toast.success(`Created ${created} post${created === 1 ? '' : 's'}. They're drafts on your calendar.`);
      await refreshPostsFromDb();
    } catch (e: any) {
      if (e.message?.includes('quota')) {
        await dialog.alert(`Kawayan's AI has used up today's free allowance. ${created} post${created === 1 ? '' : 's'} were saved before it stopped.`);
      } else {
        await dialog.alert(`Batch generation stopped. ${created} post${created === 1 ? '' : 's'} were saved.\n\nError: ${e.message}`);
      }
    } finally {
      setLoadingPlan(false);
      setBatchProgress(null);
      setCreatingDay(null);
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
      const latest = contentRef.current;
      if (!latest || latest.id !== generatedContent.id) return; // the composer moved on to another post
      const updated: GeneratedPost = { ...latest, imageUrl };
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

  // The composer saves edits on its own; this writes without pushing the saved copy back
  // into the editor, so typing that happened during the save isn't overwritten.
  const handleAutosave = async (post: GeneratedPost) => {
    await dbService.savePost(post);
    setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
    setCalendarDataVersion((v) => v + 1);
  };

  const handleRewriteCaption = async (caption: string, instruction: string) => {
    try {
      return await rewriteCaption(profile, caption, instruction);
    } catch (e: any) {
      toast.error(
        e.message?.includes('quota')
          ? "Kawayan's AI has used up today's free allowance. Please try again later."
          : 'Could not rewrite the caption. Please try again.',
      );
      return null;
    }
  };

  // Connected pages, fetched each time the composer opens.
  const composerOpen = selectedDay !== null;
  useEffect(() => {
    if (!composerOpen) return;
    let cancelled = false;
    setSocialError('');
    socialService
      .listAccounts()
      .then((accounts) => !cancelled && setSocialAccounts(accounts))
      .catch((e: any) => {
        if (cancelled) return;
        setSocialAccounts([]);
        setSocialError(e.message);
      });
    return () => {
      cancelled = true;
    };
  }, [composerOpen]);

  const handlePublish = async (accountIds: string[], scheduledFor?: string) => {
    if (!generatedContent) return;
    setPublishing(true);
    try {
      await persistPost(generatedContent); // publish the latest edits, not the last saved copy
      const updated = await socialService.publish(generatedContent.id, accountIds, scheduledFor);
      mergePostIntoState(updated);
      const when = scheduledFor
        ? new Date(scheduledFor).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '';
      toast.success(updated.status === 'Published' ? 'Posted. It’s live now.' : `Scheduled for ${when}`);
    } catch (e: any) {
      toast.error(e.message || 'Could not publish the post.');
    } finally {
      setPublishing(false);
    }
  };

  // Scheduled posts publish on Zernio's side; pull their results back when the calendar opens.
  useEffect(() => {
    socialService.sync()
      .then(({ published, failed }) => {
        if (!published && !failed) return;
        refreshPostsFromDb();
        if (published) toast.success(`${published} scheduled post${published > 1 ? 's' : ''} went live`);
        if (failed) toast.error(`${failed} scheduled post${failed > 1 ? 's' : ''} failed to publish and went back to Draft`);
      })
      .catch(() => undefined); // social posting not set up yet: nothing to sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              data-tour="plan-month"
              onClick={() => setPlanningOpen(true)}
              className="btn btn-primary btn-lg"
              title="AI content planning"
            >
              <Layers className="w-[1.15rem] h-[1.15rem]" />
              <span className="hidden sm:inline">Plan month</span>
              {ideas.length > 0 && (
                <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.35rem] h-[1.35rem] px-1 rounded-full bg-white/25 text-[11px] font-black">
                  {ideas.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div data-tour="calendar-grid">
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
        </div>

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
        creatingDay={creatingDay}
        ideas={ideas}
        postStatusByDay={postStatusByDay}
        createCount={createCount}
        scheduleRange={getScheduleDayRange(currentDate)}
        paused={selectedDay !== null}
        onOpenBilling={onOpenBilling}
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
        onPhotoUpload={handlePhotoUpload}
        onRewriteCaption={handleRewriteCaption}
        onAutosave={handleAutosave}
        accounts={socialAccounts}
        accountsError={socialError}
        publishing={publishing}
        onPublish={handlePublish}
        onOpenSocial={onOpenSocial}
      />

    </div>
  );
};

export default ContentCalendar;
