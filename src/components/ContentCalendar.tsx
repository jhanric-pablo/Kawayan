import React, { useState, useEffect, useMemo, useRef } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost } from '../types';
import { generateContentPlan, generatePostCaptionAndImagePrompt, generateImageFromPrompt, rewriteCaption } from '../services/aiService';
import UniversalDatabaseService from '../services/universalDatabaseService';
import { paymentService } from '../services/paymentService';
import { socialService, SocialAccount, SocialPlatform } from '../services/socialService';
import {
  ChevronLeft, ChevronRight, Layers, ArrowRight
} from 'lucide-react';
import ChannelTimelineTrack from './calendar/ChannelTimelineTrack';
import AgendaView from './calendar/AgendaView';
import MonthGrid from './calendar/MonthGrid';
import Segmented from './calendar/Segmented';
import { AnimatePresence, LazyMotion, MotionConfig, domMax, m } from 'motion/react';
import PostDetailSheet from './calendar/PostDetailSheet';
import { StatusBadge } from './calendar/TimelinePostCard';
import { buildCalendarItems, monthItems } from './calendar/mapCalendarEvents';
import PostComposer from './calendar/PostComposer';
import PlanningModal from './calendar/PlanningModal';
import UpNext from './calendar/UpNext';
import { useOrganicDialog } from './OrganicDialog';
import { useToast } from './ui/Toast';
import { normalizeFormat } from '../services/validationService';
import { FEED_EVENT, PostChannels, failedPostsKey, platformsFor, postChannelsKey, readStored } from '../utils/workspaceFeed';
import { storePostImage } from '../utils/postImage';
import {
  countPostsInMonth,
  getBatchLimitForSubscription,
  isAtTierLimit,
  normalizeIdeasToBatchCount,
  getScheduleDayRange,
  TIER_LIMIT_TITLE,
  ADDON_POST_PRICE_PHP,
} from '../utils/tierLimits';

interface Props {
  profile: BrandProfile;
  userId: string;
  /** Opens the Social page, where Facebook and Instagram get connected. */
  onOpenSocial: () => void;
  onOpenBilling: () => void;
  /** A request from the app shell (Create post, a search hit, a notification), run once data is loaded. */
  intent?: CalendarIntent | null;
  onIntentDone?: () => void;
}

/** `date` (YYYY-MM-DD) lets the calendar switch to the post's month first; it only loads one month at a time. */
export type CalendarIntent = { type: 'compose' } | { type: 'open'; postId: string; date?: string };

const announceFeedChange = () => window.dispatchEvent(new Event(FEED_EVENT));

type CalendarView = 'month' | 'timeline' | 'list';
const VIEW_KEY = 'kawayan_calendar_view';

const ContentCalendar: React.FC<Props> = ({ profile, userId, onOpenSocial, onOpenBilling, intent, onIntentDone }) => {
  const dialog = useOrganicDialog();
  const toast = useToast();
  // Month grid first; the choice is remembered on this device.
  const [viewMode, setViewModeState] = useState<CalendarView>(() => {
    try {
      const v = localStorage.getItem(VIEW_KEY);
      return v === 'timeline' || v === 'list' ? v : 'month';
    } catch {
      return 'month';
    }
  });
  const setViewMode = (v: CalendarView) => {
    setViewModeState(v);
    try { localStorage.setItem(VIEW_KEY, v); } catch { /* private mode */ }
  };
  const [channelFilter, setChannelFilter] = useState<'facebook' | 'instagram' | null>(null);
  // Layout only: at 1280px and up the post details sit beside the calendar instead of in a sheet.
  const [wideScreen, setWideScreen] = useState(() => typeof window !== 'undefined' && window.matchMedia('(min-width: 1280px)').matches);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const onChange = () => setWideScreen(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);
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
    setDateInputValue('');
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
      setDateInputValue('');
    } else {
      // Invalid, revert to current
      setDateInputValue('');
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
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [dataLoaded, setDataLoaded] = useState(false); // first load done; the timeline shows a skeleton until then
  const [loadedMonth, setLoadedMonth] = useState<string | null>(null); // "YYYY-MM" whose posts are in `posts`
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  // Scheduled posts that failed to publish come back as Drafts; remember which, so "Up next" can flag them.
  const failedKey = failedPostsKey(userId);
  const [failedIds, setFailedIds] = useState<string[]>(() => readStored<string[]>(failedKey, []));
  // Which channels each post went to, for the timeline lanes.
  const [postChannels, setPostChannels] = useState<PostChannels>(() => readStored<PostChannels>(postChannelsKey(userId), {}));
  // The post shown in the details sheet.
  const [sheetPostId, setSheetPostId] = useState<string | null>(null);
  const [calendarDataVersion, setCalendarDataVersion] = useState(0);
  const [subscription, setSubscription] = useState<'FREE' | 'PRO' | 'ENTERPRISE'>('FREE');

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

  // How many ideas "Plan month" makes: the owner picks, up to posts left and open days left
  // (days from today on with no post). Defaults to the most that fits.
  const scheduleRange = getScheduleDayRange(currentDate);
  const takenDays = new Set(Object.keys(postStatusByDay).map(Number));
  let openDayCount = 0;
  for (let d = scheduleRange.minDay; d <= scheduleRange.maxDay; d++) if (!takenDays.has(d)) openDayCount++;
  const maxPlanCount = Math.min(Math.max(0, batchPostCount - monthlyPostCount), openDayCount);
  const [planCountChoice, setPlanCountChoice] = useState<number | null>(null);
  const planCount = Math.min(planCountChoice ?? maxPlanCount, maxPlanCount);
  useEffect(() => setPlanCountChoice(null), [monthPrefix]);

  const showTierLimitDialog = async () => {
    const upgrade = await dialog.confirm({
      title: TIER_LIMIT_TITLE,
      message: `You've used all ${batchPostCount} posts for this month. Pro gives you 16 a month, or add single posts for ₱${ADDON_POST_PRICE_PHP} each from the post studio.`,
      confirmLabel: 'See Pro plan',
    });
    if (upgrade) onOpenBilling();
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

  // The calendar only ever shows one month, so it only loads that month's posts.
  const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
  const lastMonth = useRef(monthKey);
  const slide = monthKey === lastMonth.current ? 0 : monthKey > lastMonth.current ? 1 : -1;
  useEffect(() => { lastMonth.current = monthKey; }, [monthKey]);

  const refreshPostsFromDb = async () => {
    const savedPosts = await dbService.getUserPosts(userId, monthKey);
    setPosts(savedPosts);
    setCalendarDataVersion((v) => v + 1);
    return savedPosts;
  };

  useEffect(() => {
    paymentService.getWalletData()
      .then((w) => {
        setSubscription(w.subscription);
        setWalletBalance(w.balance);
      })
      .catch(() => setSubscription('FREE'));
  }, []);

  useEffect(() => {
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentDate]);

  const loadData = async () => {
    const monthName = currentDate.toLocaleString('default', { month: 'long' });

    // Posts + saved plan are what the calendar actually renders — load them
    // independently so one failing does not blank the other.
    const [postsRes, planRes] = await Promise.allSettled([
      dbService.getUserPosts(userId, monthKey),
      dbService.getPlan(userId, monthName),
    ]);

    if (postsRes.status === 'fulfilled') {
      setPosts(postsRes.value);
    } else {
      console.error('Error loading posts:', postsRes.reason);
      toast.error('Could not load your calendar — retrying may help.');
    }

    if (planRes.status === 'fulfilled' && planRes.value) {
      // Ideas keep their day. Ones whose day already passed this month just drop out of view
      // (they used to be pushed onto the last days, flooding the end of the month). One per day.
      const { minDay, maxDay } = getScheduleDayRange(currentDate);
      const seen = new Set<number>();
      setIdeas(
        planRes.value
          .map((i) => ({ ...i, format: normalizeFormat(i.format) }))
          .filter((i) => i.day >= minDay && i.day <= maxDay && !seen.has(i.day) && seen.add(i.day)),
      );
    } else if (planRes.status === 'fulfilled') {
      setIdeas([]);
    }

    setCalendarDataVersion((v) => v + 1);
    setDataLoaded(true);
    setLoadedMonth(monthKey);
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
      if (planCount === 0) {
        toast.info(maxPlanCount === 0 && openDayCount === 0 ? 'No open days left this month. Plan next month instead.' : 'No posts left in your plan this month.');
        return;
      }
      let newIdeas = await generateContentPlan(profile, monthName, planCount, batchStrategy);
      newIdeas = normalizeIdeasToBatchCount(newIdeas, planCount, scheduleRange, takenDays);
      setIdeas(newIdeas);
      setPlanningOpen(true);
      await dbService.savePlan(userId, monthName, newIdeas);
    } catch (e: any) {
      if (e.message.includes('quota')) {
        toast.error("Kawayan's AI has used up today's free allowance. Please try again later.");
      } else {
        toast.error('Could not plan the month. Please try again.');
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
  const ideaSaveTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  const handleUpdateIdea = (index: number, field: keyof ContentIdea, value: string | number) => {
    setIdeas((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], [field]: value };
      clearTimeout(ideaSaveTimer.current);
      ideaSaveTimer.current = setTimeout(() => persistIdeas(next).catch(() => undefined), 700);
      return next;
    });
  };

  const handleDeleteIdea = (index: number) => {
    clearTimeout(ideaSaveTimer.current); // a pending edit save would bring the idea back
    const next = ideas.filter((_, i) => i !== index);
    setIdeas(next);
    persistIdeas(next).catch(() => toast.error('Could not save the plan. Please try again.'));
  };

  // ── Moving content to another day: drag on the timeline, or "Move to" in the post sheet ──
  const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const dayLabel = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

  /** Drafts only: scheduled posts are already queued on Facebook/Instagram with their time. */
  const movePost = async (post: GeneratedPost, date: string, isUndo = false) => {
    if (date === post.date) return;
    if (post.status !== 'Draft') {
      toast.error(post.status === 'Scheduled'
        ? 'Scheduled posts are already queued on your pages, so they keep their time.'
        : 'Published posts stay on the day they went out.');
      return;
    }
    if (!isUndo && date < ymd(new Date())) { toast.error('Pick today or a later day.'); return; }
    // One post per day: check the target month (it may not be the one on screen).
    const sameMonth = date.slice(0, 7) === monthKey;
    const pool = sameMonth ? posts : await dbService.getUserPosts(userId, date.slice(0, 7));
    const clash = pool.find((p) => p.id !== post.id && p.date === date);
    if (clash) { toast.error(`${dayLabel(date)} already has a post (“${clash.topic}”). Pick another day.`); return; }
    if (
      !isUndo &&
      !(await dialog.confirm({
        title: 'Move this post?',
        message: `“${post.topic}” will move from ${dayLabel(post.date)} to ${dayLabel(date)}.`,
        confirmLabel: 'Move post',
      }))
    ) {
      return;
    }

    const moved = { ...post, date };
    try {
      await dbService.savePost(moved);
    } catch (e: any) {
      toast.error(/already has a post/.test(e?.message) ? e.message : 'Could not move the post. Please try again.');
      return;
    }
    if (sameMonth) mergePostIntoState(moved);
    else {
      setPosts((prev) => prev.filter((p) => p.id !== post.id));
      setCalendarDataVersion((v) => v + 1);
    }
    announceFeedChange();
    if (!isUndo) toast.toast(`Moved to ${dayLabel(date)}`, { variant: 'success', action: { label: 'Undo', onClick: () => movePost(moved, post.date, true) } });
  };

  const moveIdea = (index: number, day: number) => {
    const from = ideas[index]?.day;
    if (from == null || from === day) return;
    const date = ymd(new Date(currentDate.getFullYear(), currentDate.getMonth(), day));
    if (date < ymd(new Date())) { toast.error('Pick today or a later day.'); return; }
    handleUpdateIdea(index, 'day', day);
    // Undo sets the day straight back (handleUpdateIdea works on the latest list, not this render's).
    toast.toast(`Idea moved to ${dayLabel(date)}`, { variant: 'success', action: { label: 'Undo', onClick: () => handleUpdateIdea(index, 'day', from) } });
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
          toast.info('This post has used both of its rewrites. You can still edit it by hand.');
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
        toast.error("Kawayan's AI has used up today's free allowance. Please try again later.");
      } else {
        toast.error('Could not write the post. Please try again.');
      }
    } finally {
      setGeneratingPost(false);
    }
  };

  const handleBatchGenerate = async () => {
    const pending = pendingIdeas();

    if (!ideas.length) {
      toast.info('Plan the month first to get content ideas.');
      return;
    }

    const remaining = getBatchLimitForSubscription(subscription) - monthlyPostCount;
    if (remaining <= 0) {
      await showTierLimitDialog();
      return;
    }

    if (!pending.length) {
      toast.info('Every idea already has a post this month.');
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
        toast.error(`Kawayan's AI has used up today's free allowance. ${created} post${created === 1 ? '' : 's'} were saved before it stopped.`);
      } else {
        toast.error(`Batch create stopped. ${created} post${created === 1 ? '' : 's'} were saved.`);
      }
    } finally {
      setLoadingPlan(false);
      setBatchProgress(null);
      setCreatingDay(null);
    }
  };

  // An extra post beyond the plan: paid from the wallet, then written like any other post.
  // Returns an error message for the studio to show next to the form, or null on success.
  const handleAddOn = async (day: number, topic: string): Promise<string | null> => {
    const cost = ADDON_POST_PRICE_PHP;
    try {
      await paymentService.makePayment(cost, `Extra post: ${topic}`);
    } catch (e: any) {
      return e.message || 'Payment failed.';
    }
    setWalletBalance((b) => (b == null ? b : b - cost));
    const newIdea: ContentIdea = { day, title: 'Extra post', topic, format: 'Image' };
    const updatedIdeas = [...ideas, newIdea];
    setIdeas(updatedIdeas);
    dbService.savePlan(userId, currentDate.toLocaleString('default', { month: 'long' }), updatedIdeas).catch(() => undefined);
    toast.success(`Paid ₱${cost} from your wallet. Writing your extra post…`);
    setGeneratingPost(true);
    try {
      const post = await createPostFromIdea(newIdea, `addon-${Date.now()}`);
      setGeneratedContent(post);
      await persistPost(post);
    } catch {
      toast.error('Paid, but the post could not be written. Press “Write it with AI” to try again.');
    } finally {
      setGeneratingPost(false);
    }
    return null;
  };

  // Opens any post in the studio, switching the calendar to its month first.
  const openPost = (post: GeneratedPost) => {
    const [y, m, d] = post.date.split('-').map(Number);
    if (y !== currentDate.getFullYear() || m - 1 !== currentDate.getMonth()) setCurrentDate(new Date(y, m - 1, 1));
    setGeneratedContent(post);
    setSelectedDay(d);
  };

  const handleGenerateImage = async () => {
    if (!generatedContent) return;
    setLoadingImage(true);
    try {
      const base = await generateImageFromPrompt(generatedContent.imagePrompt + IMAGE_PROMPT_SUFFIX);
      if (!base) {
        toast.error('Could not create the image. Please try again.');
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
      toast.error('Could not create the image. Please try again.');
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

  // Connected pages: for the timeline lanes, and fetched again each time the composer opens.
  const composerOpen = selectedDay !== null;
  useEffect(() => {
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

  const publishPost = async (post: GeneratedPost, accountIds: string[], scheduledFor?: string, saveFirst = false) => {
    setPublishing(true);
    try {
      if (saveFirst) await persistPost(post); // publish the latest edits, not the last saved copy
      const updated = await socialService.publish(post.id, accountIds, scheduledFor);
      mergePostIntoState(updated);
      const platforms = [...new Set((socialAccounts || []).filter((a) => accountIds.includes(a.id)).map((a) => a.platform))];
      const channels = { ...postChannels, [post.id]: { platforms, at: scheduledFor, queuedAt: new Date().toISOString() } };
      setPostChannels(channels);
      try {
        localStorage.setItem(postChannelsKey(userId), JSON.stringify(channels));
      } catch {
        /* private mode */
      }
      announceFeedChange();
      const when = scheduledFor
        ? new Date(scheduledFor).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
        : '';
      const link = updated.externalLink;
      if (updated.status === 'Published') {
        toast.toast('Posted. It’s live now.', { variant: 'success', action: link ? { label: 'View post', onClick: () => window.open(link, '_blank', 'noopener') } : undefined });
      } else {
        toast.success(`Scheduled for ${when}`);
      }
    } catch (e: any) {
      toast.error(e.message || 'Could not publish the post.');
    } finally {
      setPublishing(false);
    }
  };

  const handlePublish = async (accountIds: string[], scheduledFor?: string) => {
    if (generatedContent) await publishPost(generatedContent, accountIds, scheduledFor, true);
  };

  // A post that failed to go out: publish it now to the same channels.
  const retryPost = async (post: GeneratedPost) => {
    const platforms = platformsFor(post, postChannels, socialAccounts || []);
    const accountIds = (socialAccounts || []).filter((a) => a.isActive && platforms.includes(a.platform)).map((a) => a.id);
    if (!accountIds.length) {
      toast.error('None of this post’s pages are connected. Reconnect them first.');
      onOpenSocial();
      return;
    }
    await publishPost(post, accountIds);
  };

  const handleDisconnect = async (account: SocialAccount) => {
    const ok = await dialog.confirm(
      `Disconnect @${account.username}? Posts scheduled to this ${account.platform} account will no longer be published.`
    );
    if (!ok) return;
    try {
      await socialService.disconnect(account.id);
      toast.success(`@${account.username} disconnected`);
      setSocialAccounts(await socialService.listAccounts());
      announceFeedChange();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  // Details sheet → studio.
  const editPost = (post: GeneratedPost) => {
    setSheetPostId(null);
    openPost(post);
  };

  // Scheduled posts publish on Zernio's side; pull their results back when the calendar opens.
  useEffect(() => {
    socialService.sync()
      .then(({ published, failed, failedIds: newlyFailed = [] }) => {
        if (newlyFailed.length) setFailedIds((ids) => [...new Set([...ids, ...newlyFailed])]);
        if (!published && !failed) return;
        refreshPostsFromDb();
        if (published) toast.success(`${published} scheduled post${published > 1 ? 's' : ''} went live`);
        if (failed) {
          toast.toast(`${failed} scheduled post${failed > 1 ? 's' : ''} failed to publish and went back to Draft`, {
            variant: 'error',
            action: { label: 'Review', onClick: () => setSheetPostId(newlyFailed[0]) },
          });
        }
      })
      .catch(() => undefined); // social posting not set up yet: nothing to sync
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Forget failures once the post is rescheduled, published or deleted.
  useEffect(() => {
    if (!dataLoaded) return;
    const still = failedIds.filter((id) => posts.some((p) => p.id === id && p.status === 'Draft'));
    if (still.length !== failedIds.length) setFailedIds(still);
    try {
      const json = JSON.stringify(still);
      if (localStorage.getItem(failedKey) !== json) {
        localStorage.setItem(failedKey, json);
        announceFeedChange();
      }
    } catch {
      /* private mode */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts, failedIds, dataLoaded]);

  // The sidebar's quota and the shell's search follow posts being created or deleted.
  useEffect(() => {
    if (dataLoaded) announceFeedChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts.length]);

  // Shell requests: "Create post" opens the next free day from today; search and notifications open a post.
  useEffect(() => {
    if (!intent || !loadedMonth) return;
    // Act on the month the request is about; switch to it first and come back once its posts load.
    const now = new Date();
    const target = intent.type === 'compose'
      ? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
      : intent.date?.slice(0, 7) ?? loadedMonth;
    if (target !== loadedMonth) {
      if (target !== monthKey) setCurrentDate(new Date(Number(target.slice(0, 4)), Number(target.slice(5, 7)) - 1, 1));
      return;
    }
    if (intent.type === 'compose') {
      const today = now;
      const y = today.getFullYear();
      const m = today.getMonth();
      const taken = new Set(posts.filter((p) => p.date.startsWith(`${y}-${String(m + 1).padStart(2, '0')}-`)).map((p) => Number(p.date.slice(8, 10))));
      let day = today.getDate();
      while (taken.has(day) && day < new Date(y, m + 1, 0).getDate()) day++;
      if (taken.has(day)) day = today.getDate();
      setGeneratedContent(posts.find((p) => p.date === `${y}-${String(m + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`) ?? null);
      setSelectedDay(day);
    } else {
      setSheetPostId(intent.postId);
    }
    onIntentDone?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [intent, loadedMonth]);

  const agendaItems = useMemo(() => buildCalendarItems(posts, ideas, currentDate), [posts, ideas, currentDate, calendarDataVersion]);
  const monthData = useMemo(
    () => monthItems(posts, ideas, currentDate, postChannels, socialAccounts || [], failedIds, channelFilter),
    [posts, ideas, currentDate, postChannels, socialAccounts, failedIds, channelFilter, calendarDataVersion],
  );
  const sheetPost = posts.find((p) => p.id === sheetPostId) ?? null;

  const handlePhotoFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      const imageUrl = await storePostImage(reader.result);
      setGeneratedContent((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, imageUrl };
        persistPost(updated).catch((err) => console.error('Failed to persist uploaded photo:', err));
        return updated;
      });
    };
    reader.readAsDataURL(file);
  };

  const monthLabel = currentDate.toLocaleString('default', { month: 'long', year: 'numeric' });
  // Wide screens show the selected post in a panel beside the calendar; smaller ones use the sheet.
  const sideDetail = wideScreen && !!sheetPost;
  const onCurrentMonth = currentDate.getFullYear() === new Date().getFullYear() && currentDate.getMonth() === new Date().getMonth();
  const now = new Date();
  const isPastMonth = currentDate.getFullYear() * 12 + currentDate.getMonth() < now.getFullYear() * 12 + now.getMonth();
  // A month with nothing in it gets the planner pitch right on the timeline.
  const showEmptyCta = dataLoaded && viewMode !== 'list' && !isPastMonth && monthlyPostCount === 0 && ideas.length === 0 && !loadingPlan;

  return (
    <MotionConfig reducedMotion="user">
    <LazyMotion features={domMax}>
    <div className="relative w-full flex flex-col gap-5 pb-16 font-sans text-(--fg)">

      {dataLoaded && <UpNext posts={posts} failedIds={failedIds} onOpen={openPost} onPlan={() => setPlanningOpen(true)} />}

      <div className={sideDetail ? 'kw-work' : undefined}>
      {/* ─────────────  Channel timeline (primary)  ───────────── */}
      <section className="card w-full min-w-0 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-(--border) px-3 py-3 sm:px-3.5">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="relative mr-1 grid overflow-hidden text-base font-semibold tracking-tight text-(--fg) sm:text-lg">
              <AnimatePresence mode="popLayout" initial={false} custom={slide}>
                <m.span
                  key={monthLabel}
                  custom={slide}
                  variants={{
                    enter: (d: number) => ({ y: d >= 0 ? 18 : -18, opacity: 0 }),
                    center: { y: 0, opacity: 1 },
                    exit: (d: number) => ({ y: d >= 0 ? -18 : 18, opacity: 0 }),
                  }}
                  initial="enter"
                  animate="center"
                  exit="exit"
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  className="col-start-1 row-start-1 whitespace-nowrap"
                >
                  {monthLabel}
                </m.span>
              </AnimatePresence>
            </h1>
            <div className="flex items-center gap-1.5" data-tour="month-nav">
              <button
                type="button"
                aria-label="Previous month"
                className="btn btn-outline btn-sm w-8 px-0!"
                onClick={() => setCurrentDate(prev => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {/* Jumps back to the current month: quiet when you're already there, highlighted when you've moved away. */}
              <button
                type="button"
                disabled={onCurrentMonth}
                title={onCurrentMonth ? 'You’re on this month' : `Back to ${new Date().toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}`}
                className={`btn btn-outline btn-sm ${onCurrentMonth ? 'cursor-default! text-(--fg-muted)' : ''}`}
                onClick={() => setCurrentDate(new Date())}
              >
                {onCurrentMonth ? 'Today' : 'Back to today'}
              </button>
              <button
                type="button"
                aria-label="Next month"
                className="btn btn-outline btn-sm w-8 px-0!"
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
                placeholder="Jump to…"
                aria-label="Jump to date"
                className="h-8 w-28 rounded-lg border border-(--border) bg-(--card) px-2.5 text-ui text-(--fg) shadow-xs outline-hidden placeholder:text-(--fg-muted)"
              />
              <div className="absolute opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity duration-200 bg-(--fg) text-(--bg) text-xs px-2 py-1 rounded-md -bottom-9 left-0 whitespace-nowrap pointer-events-none z-50 shadow-lg">
                Try &quot;Jan 2026&quot;, &quot;12/25/25&quot;, or &quot;2026&quot;
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="kw-usage w-full sm:w-auto lg:hidden">
              <span className="kw-usage__bar" aria-hidden>
                <b style={{ width: `${Math.min(100, (monthlyPostCount / Math.max(batchPostCount, 1)) * 100)}%` }} />
              </span>
              {monthlyPostCount} of {batchPostCount} posts used
              {subscription === 'FREE' && (
                <button type="button" onClick={onOpenBilling}>· Pro gives 16</button>
              )}
            </span>
            {viewMode === 'month' && (socialAccounts?.length ?? 0) > 0 && (
              <Segmented id="channel" label="Show posts for" value={channelFilter} onChange={(v) => setChannelFilter(v as typeof channelFilter)} options={[[null, 'All'], ['facebook', 'Facebook'], ['instagram', 'Instagram']] as const} />
            )}
            <span data-tour="calendar-views" className="inline-flex"><Segmented id="view" label="Calendar view" value={viewMode} onChange={setViewMode} options={[['month', 'Month'], ['timeline', 'Timeline'], ['list', 'List']] as const} /></span>
            <button
              type="button"
              data-tour="plan-month"
              onClick={() => setPlanningOpen(true)}
              className="btn btn-primary btn-sm"
              aria-label="Plan month"
            >
              <Layers className="w-4 h-4" />
              <span className="hidden sm:inline">Plan month</span>
              {ideas.length > 0 && (
                <span className="mono text-xs opacity-80">
                  {ideas.length}
                </span>
              )}
            </button>
          </div>
        </div>

        <div data-tour="calendar-grid" className="relative overflow-hidden">
          <AnimatePresence mode="wait" initial={false} custom={slide}>
          <m.div
            key={`${viewMode}:${monthKey}`}
            custom={slide}
            variants={{
              enter: (d: number) => ({ opacity: 0, x: d * 36, y: d ? 0 : 8 }),
              center: { opacity: 1, x: 0, y: 0 },
              exit: (d: number) => ({ opacity: 0, x: d * -36, y: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.22, ease: [0.2, 0.8, 0.2, 1] }}
          >
          {viewMode === 'month' && dataLoaded ? (
            <MonthGrid
              currentDate={currentDate}
              byDay={monthData.byDay}
              unsent={monthData.unsent}
              postsLimitText={<><b className="font-semibold text-(--fg) tabular-nums">{monthlyPostCount}</b> of {batchPostCount} posts this month</>}
              onOpenPost={(post) => setSheetPostId(post.id)}
              onOpenDay={handleDayClick}
              onMovePost={(post, day) => movePost(post, ymd(new Date(currentDate.getFullYear(), currentDate.getMonth(), day)))}
              onMoveIdea={moveIdea}
              hideTray={!!sideDetail}
            />
          ) : viewMode === 'timeline' || !dataLoaded ? (
            <ChannelTimelineTrack
              currentDate={currentDate}
              posts={posts}
              ideas={ideas}
              accounts={socialAccounts}
              channels={postChannels}
              failedIds={failedIds}
              loading={!dataLoaded}
              onOpenPost={(post) => setSheetPostId(post.id)}
              onEditPost={openPost}
              onRetryPost={retryPost}
              onOpenDay={handleDayClick}
              onConnect={onOpenSocial}
              onDisconnect={handleDisconnect}
              onManageAccounts={onOpenSocial}
              onMovePost={(post, day) => movePost(post, ymd(new Date(currentDate.getFullYear(), currentDate.getMonth(), day)))}
              onMoveIdea={moveIdea}
            />
          ) : (
            <div className="p-3 sm:p-5">
              <AgendaView items={agendaItems} currentDate={currentDate} selectedDay={selectedDay} onDayClick={handleDayClick} />
            </div>
          )}
          </m.div>
          </AnimatePresence>
          {showEmptyCta && (
            <div className="kw-empty-cta">
              <div className="kw-empty-cta__card">
                <b>Your {currentDate.toLocaleDateString('en-PH', { month: 'long' })} is empty.</b>
                <button type="button" onClick={() => setPlanningOpen(true)} className="btn btn-primary">
                  Plan {batchPostCount} posts in 15 seconds <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-(--border) px-3 py-2.5 sm:px-3.5">
          <div className="flex flex-wrap items-center gap-1.5" aria-label="Status key">
            {(['idea', 'draft', 'scheduled', 'published', 'failed'] as const).map((s) => <StatusBadge key={s} status={s} />)}
          </div>
          <p className="text-xs text-(--fg-muted) hidden md:block">
            Click a post for details, or an empty slot to write one.
          </p>
        </div>
      </section>

      {sideDetail && sheetPost && (
        <PostDetailSheet
          inline
          post={sheetPost}
          profile={profile}
          platforms={platformsFor(sheetPost, postChannels, socialAccounts || [])}
          scheduledAt={postChannels[sheetPost.id]?.at}
          queuedAt={postChannels[sheetPost.id]?.queuedAt}
          failed={sheetPost.status === 'Draft' && failedIds.includes(sheetPost.id)}
          publishing={publishing}
          onClose={() => setSheetPostId(null)}
          onEdit={editPost}
          onRetry={retryPost}
          onMove={(post, date) => {
            setSheetPostId(null);
            movePost(post, date);
          }}
        />
      )}
      </div>

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
        planCount={planCount}
        maxPlanCount={maxPlanCount}
        openDayCount={openDayCount}
        onPlanCountChange={setPlanCountChoice}
        onPlanNextMonth={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))}
        createCount={createCount}
        scheduleRange={getScheduleDayRange(currentDate)}
        paused={selectedDay !== null}
        onOpenBilling={onOpenBilling}
        onGeneratePlan={handleGeneratePlan}
        onBatchGenerate={handleBatchGenerate}
        onUpdateIdea={handleUpdateIdea}
        onDeleteIdea={handleDeleteIdea}
        onOpenDay={handleDayClick}
        posts={posts}
        accounts={socialAccounts}
        channels={postChannels}
        failedIds={failedIds}
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
        limitReached={trialLimitReached}
        planPostCount={batchPostCount}
        walletBalance={walletBalance}
        onOpenBilling={onOpenBilling}
        onClose={handleClosePanel}
        onGeneratePost={handleGeneratePost}
        onAddOn={handleAddOn}
        onGenerateImage={handleGenerateImage}
        onPhotoFile={handlePhotoFile}
        onRewriteCaption={handleRewriteCaption}
        onAutosave={handleAutosave}
        accounts={socialAccounts}
        accountsError={socialError}
        publishing={publishing}
        onPublish={handlePublish}
        onOpenSocial={onOpenSocial}
      />

      {/* ── Post details (from a timeline card, search or a notification) ── */}
      <PostDetailSheet
        post={wideScreen ? null : sheetPost}
        profile={profile}
        platforms={sheetPost ? platformsFor(sheetPost, postChannels, socialAccounts || []) : []}
        scheduledAt={sheetPost ? postChannels[sheetPost.id]?.at : undefined}
        queuedAt={sheetPost ? postChannels[sheetPost.id]?.queuedAt : undefined}
        failed={!!sheetPost && sheetPost.status === 'Draft' && failedIds.includes(sheetPost.id)}
        publishing={publishing}
        onClose={() => setSheetPostId(null)}
        onEdit={editPost}
        onRetry={retryPost}
        onMove={(post, date) => {
          // Close the sheet so the confirm dialog isn't stuck behind it.
          setSheetPostId(null);
          movePost(post, date);
        }}
      />
    </div>
    </LazyMotion>
    </MotionConfig>
  );
};

export default ContentCalendar;
