import React, { useEffect, useRef, useState } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost, PostVersion } from '../../types';
import type { SocialAccount } from '../../services/socialService';
import type { CaptionRewrite } from '../../services/aiService';
import {
  X, RefreshCcw, Loader2, Upload, Image as ImageIcon, Send, Facebook, Instagram, Scissors, Smile, Briefcase, Megaphone, Languages, Hash, ArrowUp, ArrowUpRight, Undo2, Check, ChevronDown, CalendarClock, Zap, ExternalLink, PencilLine, CircleAlert, Clock, Globe, AudioLines,
} from 'lucide-react';
import { KawayanMark } from '../KawayanLogo';
import TextareaAutosize from 'react-textarea-autosize';
import clsx from 'clsx';
import PhonePreview from './PhonePreview';
import { StatusBadge } from './TimelinePostCard';
import { normalizeFormat } from '../../services/validationService';
import { useFocusTrap } from '../../utils/useFocusTrap';
import { phDatesInMonth } from '../../utils/phCalendar';
import { ProgressBar } from '../ui/progress-bar';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
// react-day-picker + date-fns load only when the date popover opens.
const DayCalendar = React.lazy(() => import('../ui/calendar').then((m) => ({ default: m.Calendar })));
import { Switch } from '../ui/switch';

/* ── Shared looks ── */

/** The frameless writing surface: one hairline, emerald when focused. */
const FIELD =
  'rounded-xl border border-(--border) bg-[color-mix(in_srgb,var(--bg-alt)_60%,transparent)] transition-colors focus-within:border-(--green) focus-within:ring-2 focus-within:ring-(--ring)';
const CHIP =
  'inline-flex items-center gap-1.5 rounded-md border border-(--border) bg-(--card) px-2.5 py-1.5 text-xs font-semibold text-(--fg-muted) transition-colors hover:border-(--border-strong) hover:text-(--fg) disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5';
export const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-lg bg-(--primary-accent) px-4 py-2.5 text-sm font-semibold text-(--primary-accent-fg) transition-colors hover:bg-(--primary-accent-hover) disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4';
const LABEL = 'eyebrow text-(--fg-subtle)';

/* ── AI helpers ── */

const QUICK_EDITS: { label: string; Icon: React.ElementType; instruction: string }[] = [
  { label: 'Shorter', Icon: Scissors, instruction: 'Make it noticeably shorter, about half the length, keeping the main message and the hashtags.' },
  { label: 'More playful', Icon: Smile, instruction: 'Make it more playful: light Pinoy humor, punchier lines and a few fitting emojis.' },
  { label: 'More polished', Icon: Briefcase, instruction: 'Make it more polished and professional: clearer sentences, fewer emojis, no slang.' },
  { label: 'Add a call to action', Icon: Megaphone, instruction: 'End with a clear, friendly call to action (order, message us, or visit) that fits the post.' },
  { label: 'More Taglish', Icon: Languages, instruction: 'Use more natural Taglish, mixing Tagalog and English the way young Filipinos text.' },
  { label: 'Fresh hashtags', Icon: Hash, instruction: 'Keep the text the same but replace the hashtags with 3 to 5 better, specific, local ones.' },
];

const MAX_REWRITES = 2; // full regenerations per post (ContentCalendar enforces it too)
const IG_CAPTION_LIMIT = 2200;

const scoreWord = (s: number) => (s >= 75 ? 'Strong' : s >= 50 ? 'Promising' : 'Needs work');


/* ── Scheduling helpers ── */

// ponytail: fixed PH engagement peaks, not learned from the account's own data; swap in
// real per-account timing once live analytics exist.
const SUGGESTED_TIMES = [
  { time: '12:00', label: 'Lunch break' },
  { time: '18:00', label: 'After work' },
  { time: '20:00', label: 'Prime time', best: true },
];

const to12h = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`;
};
const pad = (n: number) => String(n).padStart(2, '0');
const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';
const isoToday = () => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const isPast = (date: string, time: string) => new Date(`${date}T${time}:00`).getTime() <= Date.now() + 5 * 60_000;
const longDate = (date: string) =>
  new Date(`${date}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });

const PlatformIcon: React.FC<{ platform: string; className?: string }> = ({ platform, className = 'w-3.5 h-3.5' }) =>
  platform === 'facebook' ? <Facebook className={className} style={{ color: '#1877F2' }} /> : <Instagram className={className} style={{ color: '#E1306C' }} />;

type SaveState = 'saved' | 'dirty' | 'saving' | 'error';
type Snapshot = Pick<GeneratedPost, 'caption' | 'viralityScore' | 'viralityReason'>;
const snapOf = (p: GeneratedPost) => JSON.stringify([p.caption, p.imagePrompt, p.viralityScore, p.history?.map((h) => h.caption)]);

/**
 * PostComposer: the post studio.
 *
 * Left: the brief (or, once drafted, the caption with an AI co-writer, the visual, the score
 * and earlier versions). Right: the post in a phone, per platform. Bottom: where and when,
 * paired with the publish button. Drafts save themselves; every network/AI call is delegated
 * to ContentCalendar.
 */
interface Props {
  open: boolean;
  selectedDay: number | null;
  currentDate: Date;
  profile: BrandProfile;
  posts: GeneratedPost[];
  ideas: ContentIdea[];
  generatedContent: GeneratedPost | null;
  setGeneratedContent: React.Dispatch<React.SetStateAction<GeneratedPost | null>>;
  generatingPost: boolean;
  loadingImage: boolean;
  addOnPrice: number;
  /** The plan's posts for this month are used up: new posts are paid extras. */
  limitReached: boolean;
  planPostCount: number;
  walletBalance: number | null;
  accounts: SocialAccount[] | null;
  accountsError: string;
  publishing: boolean;
  onClose: () => void;
  onGeneratePost: (idea: ContentIdea) => void;
  /** Pays for an extra post from the wallet and writes it; resolves to an error message or null. */
  onAddOn: (day: number, topic: string) => Promise<string | null>;
  onOpenBilling: () => void;
  onGenerateImage: () => void;
  onRewriteCaption: (caption: string, instruction: string) => Promise<CaptionRewrite | null>;
  onAutosave: (post: GeneratedPost) => Promise<void>;
  /** A photo picked with "Upload photo" or dropped on the preview. */
  onPhotoFile: (file: File) => void;
  onPublish: (accountIds: string[], scheduledFor?: string) => Promise<void>;
  onOpenSocial: () => void;
  /** 'page': the Post studio page (inline, three columns) instead of the dialog. Same logic. */
  variant?: 'modal' | 'page';
  /** Page: move a draft to another date (one post per day, as on the calendar). */
  onMoveDate?: (post: GeneratedPost, date: string) => void;
  /** Page: a page that lost access (Reconnect badge). */
  onReconnect?: (platform: string) => void;
}

const PostComposer: React.FC<Props> = ({
  open,
  selectedDay,
  currentDate,
  profile,
  posts,
  ideas,
  generatedContent: post,
  setGeneratedContent,
  generatingPost,
  loadingImage,
  addOnPrice,
  limitReached,
  planPostCount,
  walletBalance,
  accounts,
  accountsError,
  publishing,
  onClose,
  onGeneratePost,
  onAddOn,
  onGenerateImage,
  onRewriteCaption,
  onAutosave,
  onPhotoFile,
  onPublish,
  onOpenSocial,
  onOpenBilling,
  variant = 'modal',
  onMoveDate,
  onReconnect,
}) => {
  const isPage = variant === 'page';
  const [aiBusy, setAiBusy] = useState<string | null>(null);
  const [ask, setAsk] = useState('');
  const [undoStack, setUndoStack] = useState<Snapshot[]>([]);
  const [lastEdit, setLastEdit] = useState<{ label: string; delta: number | null } | null>(null);
  const [showPrompt, setShowPrompt] = useState(false);
  const [redoing, setRedoing] = useState(false); // "New version" pressed (vs. the first draft still saving)
  const [saveState, setSaveState] = useState<SaveState>('saved');
  const [planOpen, setPlanOpen] = useState(false);
  const [mode, setMode] = useState<'schedule' | 'now'>('schedule');
  const [time, setTime] = useState('20:00');
  const [chosen, setChosen] = useState<string[]>([]);
  const [brief, setBrief] = useState(''); // what the post is about; also the paid extra post's topic
  // Every post is a caption plus an image, so there's no format to pick.
  const format: ContentIdea['format'] = 'Image';
  const [extraBusy, setExtraBusy] = useState(false);
  const [extraError, setExtraError] = useState('');
  const [dateOpen, setDateOpen] = useState(false);
  const [openSteps, setOpenSteps] = useState<string[]>(['caption', 'image']);
  // A post drafted while the dialog is open: show the progress list until its image is in.
  const [freshDraft, setFreshDraft] = useState(false);
  useEffect(() => {
    if (generatingPost) setFreshDraft(true);
  }, [generatingPost]);
  useEffect(() => {
    if (post?.imageUrl && !loadingImage) setFreshDraft(false);
  }, [post?.imageUrl, loadingImage]);
  // Caption and image open on their own once a draft arrives.
  useEffect(() => {
    if (post?.id) setOpenSteps(['caption', 'image']);
  }, [post?.id]);
  const dialogRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLDivElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);

  // Latest values for listeners and timers that outlive a render.
  const latest = useRef({ post, onClose, onAutosave, planOpen });
  useEffect(() => {
    latest.current = { post, onClose, onAutosave, planOpen };
  });

  /* ── Autosave: edits save themselves ~1s after typing stops ── */
  const baseline = useRef<{ id: string; snap: string } | null>(null);
  const snap = post ? snapOf(post) : '';
  useEffect(() => {
    if (!post) return;
    if (baseline.current?.id !== post.id) {
      baseline.current = { id: post.id, snap };
      setSaveState('saved');
      return;
    }
    if (snap === baseline.current.snap) {
      setSaveState('saved');
      return;
    }
    setSaveState('dirty');
    const timer = setTimeout(() => save(), 1100);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id, snap]);

  const save = () => {
    const target = latest.current.post;
    if (!target) return;
    const targetSnap = snapOf(target);
    setSaveState('saving');
    latest.current
      .onAutosave(target)
      .then(() => {
        if (baseline.current?.id === target.id) baseline.current.snap = targetSnap;
        const now = latest.current.post;
        setSaveState(now && snapOf(now) !== targetSnap ? 'dirty' : 'saved');
      })
      .catch(() => setSaveState('error'));
  };

  const close = () => {
    const current = latest.current.post;
    if (current && baseline.current?.id === current.id && snapOf(current) !== baseline.current.snap) {
      latest.current.onAutosave(current).catch(() => undefined); // keep edits made in the last second
    }
    latest.current.onClose();
  };

  useFocusTrap(dialogRef, open && !isPage);

  // Esc closes the open popover first, then the studio; background scroll is locked while open.
  useEffect(() => {
    if (!open || isPage) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // A confirm or menu stacked on top handles its own Escape.
      const target = e.target as Node;
      if (target !== document.body && !dialogRef.current?.contains(target)) return;
      if (latest.current.planOpen) setPlanOpen(false);
      else close();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (!planOpen) return;
    const onDown = (e: MouseEvent) => !planRef.current?.contains(e.target as Node) && setPlanOpen(false);
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [planOpen]);

  // A different post: fresh undo history, and the best time still open on its day.
  const canSchedule = !!post && post.date >= isoToday();
  useEffect(() => {
    setUndoStack([]);
    setLastEdit(null);
    setAsk('');
    setShowPrompt(false);
    setPlanOpen(false);
    if (!post) return;
    const slot = [...SUGGESTED_TIMES].sort((a, b) => Number(!!b.best) - Number(!!a.best)).find((s) => !isPast(post.date, s.time));
    setTime(slot?.time || '20:00');
    setMode(post.date >= isoToday() && slot ? 'schedule' : 'now');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post?.id]);

  // Pre-pick every page that can actually publish; one that lost access would fail the post.
  useEffect(() => {
    if (accounts) setChosen(accounts.filter((a) => a.isActive).map((a) => a.id));
  }, [accounts]);

  useEffect(() => {
    const idea = ideas.find((i) => i.day === selectedDay);
    setBrief(idea?.topic || '');
    setExtraError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDay]);

  useEffect(() => {
    if (!generatingPost) setRedoing(false);
  }, [generatingPost]);

  if (!open || selectedDay == null) return null;

  const ymd = `${currentDate.getFullYear()}-${pad(currentDate.getMonth() + 1)}-${pad(selectedDay)}`;
  const currentPost = posts.find((p) => p.date === ymd);
  const currentIdea = ideas.find((i) => i.day === selectedDay);
  const heading = post?.topic || currentPost?.topic || currentIdea?.title || 'New post';
  const dateLabel = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const monthName = currentDate.toLocaleDateString('en-PH', { month: 'long' });
  const isPublished = post?.status === 'Published';
  const isScheduled = post?.status === 'Scheduled';
  const rewritesLeft = Math.max(0, MAX_REWRITES - (post?.regenCount || 0));

  const runGenerate = () => {
    onGeneratePost({
      day: selectedDay,
      title: currentIdea?.title || 'Custom post',
      topic: brief.trim() || currentIdea?.topic || post?.topic || 'General update',
      format,
    });
  };

  const submitBrief = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (brief.trim().length === 0 || generatingPost || extraBusy) return;
    if (!limitReached) return runGenerate();
    setExtraBusy(true);
    setExtraError('');
    const error = await onAddOn(selectedDay, brief.trim());
    setExtraBusy(false);
    if (error) setExtraError(error);
  };

  /* ── AI co-writer ── */
  const runEdit = async (label: string, instruction: string) => {
    if (!post || aiBusy) return;
    const before: Snapshot = { caption: post.caption, viralityScore: post.viralityScore, viralityReason: post.viralityReason };
    setAiBusy(label);
    try {
      const result = await onRewriteCaption(post.caption, instruction);
      if (!result) return;
      setUndoStack((s) => [...s, before]);
      setGeneratedContent((prev) =>
        prev && prev.id === post.id
          ? {
              ...prev,
              caption: result.caption,
              viralityScore: result.viralityScore ?? prev.viralityScore,
              viralityReason: result.viralityReason ?? prev.viralityReason,
            }
          : prev,
      );
      const delta = result.viralityScore != null && before.viralityScore != null ? result.viralityScore - before.viralityScore : null;
      setLastEdit({ label, delta });
    } finally {
      setAiBusy(null);
    }
  };

  const submitAsk = (e: React.FormEvent) => {
    e.preventDefault();
    const text = ask.trim().slice(0, 200);
    if (!text) return;
    setAsk('');
    runEdit(`“${text.length > 38 ? `${text.slice(0, 38)}…` : text}”`, text);
  };

  const undo = () => {
    const snapBefore = undoStack[undoStack.length - 1];
    if (!snapBefore) return;
    setUndoStack((s) => s.slice(0, -1));
    setGeneratedContent((prev) => (prev ? { ...prev, ...snapBefore } : prev));
    setLastEdit(undoStack.length > 1 ? { label: 'Undid the last change', delta: null } : null);
  };

  const restoreVersion = (i: number) => {
    if (!post) return;
    const v = post.history[i];
    const current: PostVersion = {
      caption: post.caption,
      imagePrompt: post.imagePrompt,
      viralityScore: post.viralityScore,
      viralityReason: post.viralityReason,
      createdAt: new Date().toISOString(),
    };
    setGeneratedContent({
      ...post,
      caption: v.caption,
      imagePrompt: v.imagePrompt,
      viralityScore: v.viralityScore,
      viralityReason: v.viralityReason,
      history: post.history.map((h, j) => (j === i ? current : h)),
    });
    setUndoStack([]);
    setLastEdit({ label: 'Switched to an earlier version', delta: null });
  };

  /* ── Publishing ── */
  const chosenAccounts = (accounts || []).filter((a) => chosen.includes(a.id));
  const timeOk = mode === 'now' || (!!post && !isPast(post.date, time));
  const whereLabel =
    accounts === null ? 'Loading pages…' : accounts.length === 0 ? 'No pages connected' : chosenAccounts.length === 0 ? 'No page picked' : chosenAccounts.map((a) => (a.platform === 'facebook' ? 'Facebook Page' : 'Instagram')).join(' + ');
  const whenLabel = mode === 'now' ? 'Right away' : post ? `${longDate(post.date)} · ${to12h(time)}` : 'Draft the post first';

  const publish = () => {
    if (!post) return;
    if (accounts && accounts.length === 0) return onOpenSocial();
    setPlanOpen(false);
    onPublish(chosen, mode === 'schedule' ? `${post.date}T${time}:00` : undefined);
  };

  const ctaDisabled = !post || publishing || accounts === null || (accounts.length > 0 && (chosen.length === 0 || !timeOk));
  const ctaLabel =
    accounts && accounts.length === 0 ? 'Connect a page' : mode === 'now' ? 'Post now' : `Schedule • ${to12h(time)}`;

  const busyLabel = aiBusy ? `Rewriting: ${aiBusy}` : redoing && generatingPost ? 'Writing a new version…' : null;
  const counts = post ? { chars: [...post.caption].length, tags: (post.caption.match(/#[\p{L}\p{N}_]+/gu) || []).length } : null;
  const score = post?.viralityScore ?? 0;
  const canEditVisual = !!post && !isPublished;

  /* ── Pieces ── */
  const preview = (
    <PhonePreview
      key={post?.id ?? 'new'}
      businessName={profile.businessName}
      caption={post?.caption}
      imageUrl={post?.imageUrl}
      loadingImage={loadingImage}
      onDropImage={canEditVisual ? onPhotoFile : undefined}
      tabs={['facebook', 'instagram']}
      defaultPlatform="facebook"
    />
  );

  const saveIndicator = post && (
    <span className="inline-flex items-center gap-1 [&_svg]:h-3 [&_svg]:w-3" aria-live="polite">
      {saveState === 'saved' && <><Check /> Saved</>}
      {saveState === 'saving' && <><Loader2 className="animate-spin" /> Saving…</>}
      {saveState === 'dirty' && <><span className="h-1.5 w-1.5 rounded-full bg-(--amber)" /> Unsaved changes</>}
      {saveState === 'error' && (
        <span className="inline-flex items-center gap-1 text-(--danger)">
          <CircleAlert /> Couldn’t save
          <button type="button" onClick={save} className="font-semibold underline">Retry</button>
        </span>
      )}
    </span>
  );

  /* ── Pieces shared by the dialog and the Post studio page ── */
  const briefForm = (
<form onSubmit={submitBrief} aria-busy={generatingPost || extraBusy}>
                  {limitReached && <p className="mb-3 text-sm text-(--fg-muted)">Add this one as an extra post for ₱{addOnPrice}, paid from your wallet.</p>}
                  <div className={clsx(FIELD, 'p-3.5')}>
                    <TextareaAutosize
                      className="block w-full resize-none bg-transparent text-sm leading-relaxed outline-hidden placeholder:text-(--fg-subtle)"
                      minRows={3}
                      maxRows={10}
                      maxLength={400}
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitBrief();
                      }}
                      readOnly={generatingPost || extraBusy}
                      placeholder="e.g. Behind the scenes of our 5 AM bake, and 10% off pandesal this weekend"
                      aria-label="What the post is about"
                      aria-invalid={!!extraError}
                      aria-describedby="ps-brief-msg"
                    />
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-3">
                    <button
                      type="submit"
                      disabled={brief.trim().length === 0 || generatingPost || extraBusy}
                      className="btn btn-primary kw-draft-btn ml-auto"
                    >
                      {generatingPost || extraBusy ? <Loader2 className="animate-spin" /> : <KawayanMark size={16} />}
                      {limitReached ? (extraBusy ? 'Paying…' : `Pay ₱${addOnPrice} and draft it`) : generatingPost ? 'Drafting…' : 'Draft with AI'}
                      <span className="ml-1 hidden gap-0.5 opacity-70 sm:inline-flex" aria-hidden>
                        <kbd className="rounded border border-white/30 px-1 font-sans text-xs">{MOD_KEY}</kbd>
                        <kbd className="rounded border border-white/30 px-1 font-sans text-xs">↵</kbd>
                      </span>
                    </button>
                  </div>
                  {generatingPost ? (
                    <div className="mt-4"><GenerationProgress post={post} loadingImage={loadingImage} /></div>
                  ) : limitReached ? (
                    <p
                      id="ps-brief-msg"
                      className={clsx('mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-ui [&_button]:font-medium [&_button]:text-(--fg) [&_button]:underline [&_button]:underline-offset-2', extraError ? 'text-(--danger)' : 'text-(--fg-muted)')}
                      role={extraError ? 'alert' : undefined}
                    >
                      {extraError || (walletBalance != null ? `Wallet balance: ₱${walletBalance.toLocaleString('en-PH')}.` : 'Paid from your Kawayan wallet.')}
                      {(extraError || (walletBalance != null && walletBalance < addOnPrice)) && (
                        <button type="button" onClick={onOpenBilling}>Top up</button>
                      )}
                      {planPostCount < 16 && (
                        <button type="button" onClick={onOpenBilling}>Or upgrade to Pro for 16 posts a month</button>
                      )}
                    </p>
                  ) : (
                    <p id="ps-brief-msg" className="mt-3 text-xs text-(--fg-muted)">
                      Kawayan writes the caption, scores it and makes a matching image. About 20 seconds.
                    </p>
                  )}
                </form>
  );
  const captionEditor = post ? (
    <>
<div className={clsx(FIELD, 'relative')}>
                  <textarea
                    id="ps-caption-text"
                    rows={6}
                    value={post.caption}
                    readOnly={isPublished || !!busyLabel}
                    onChange={(e) => setGeneratedContent({ ...post, caption: e.target.value })}
                    placeholder="Write your Taglish caption…"
                    aria-label="Caption"
                    className="block min-h-[148px] w-full resize-y bg-transparent p-3.5 text-sm leading-relaxed outline-hidden placeholder:text-(--fg-subtle)"
                  />
                  {busyLabel && (
                    <div className="absolute inset-0 grid place-items-center rounded-xl bg-[color-mix(in_srgb,var(--card)_78%,transparent)] text-sm font-semibold" aria-live="polite">
                      <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-(--primary)" /> {busyLabel}</span>
                    </div>
                  )}
                </div>

                {lastEdit && !busyLabel && (
                  <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-(--fg-muted)">
                    <Check className="h-3.5 w-3.5 text-(--primary)" />
                    <span>{lastEdit.label}</span>
                    {lastEdit.delta != null && lastEdit.delta !== 0 && (
                      <span className={clsx('rounded-full px-1.5 font-semibold', lastEdit.delta > 0 ? 'bg-(--green-soft) text-(--primary)' : 'bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-(--danger)')}>
                        Score {lastEdit.delta > 0 ? '+' : '−'}{Math.abs(lastEdit.delta)}
                      </span>
                    )}
                    {undoStack.length > 0 && (
                      <button type="button" onClick={undo} className="ml-auto inline-flex items-center gap-1 font-semibold text-(--fg) hover:underline">
                        <Undo2 className="h-3.5 w-3.5" /> Undo
                      </button>
                    )}
                  </div>
                )}

                {!isPublished && (
                  <div className="mt-3 space-y-2.5">
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Quick AI edits">
                      {QUICK_EDITS.map(({ label, Icon, instruction }) => (
                        <button key={label} type="button" className={CHIP} disabled={!!aiBusy} onClick={() => runEdit(label, instruction)}>
                          {aiBusy === label ? <Loader2 className="animate-spin" /> : <Icon />} {label}
                        </button>
                      ))}
                    </div>
                    <form onSubmit={submitAsk} className={clsx(FIELD, 'flex items-center gap-2 py-1 pl-3 pr-1')}>
                      <PencilLine className="h-4 w-4 shrink-0 text-(--fg-subtle)" aria-hidden />
                      <input
                        value={ask}
                        onChange={(e) => setAsk(e.target.value)}
                        maxLength={200}
                        disabled={!!aiBusy}
                        placeholder="Tell Kawayan what to change, e.g. “mention our 20% weekend promo”"
                        aria-label="Tell Kawayan what to change"
                        className="min-w-0 flex-1 bg-transparent py-1.5 text-ui outline-hidden placeholder:text-(--fg-subtle)"
                      />
                      <button type="submit" disabled={!ask.trim() || !!aiBusy} aria-label="Rewrite with this instruction" className={clsx(PRIMARY_BTN, 'h-8 w-8 p-0')}>
                        <ArrowUp />
                      </button>
                    </form>
                  </div>
                )}
    </>
  ) : null;
  const scoreBox = post ? (
<div className="mt-3 flex items-start gap-3 rounded-lg bg-(--bg-alt) px-3 py-2.5">
                  <b className="text-xl tabular-nums leading-none">{score}</b>
                  <div className="min-w-0 flex-1">
                    <p className="flex justify-between text-xs font-semibold">
                      Reach score <span className={score >= 75 ? 'text-(--primary)' : score >= 50 ? 'text-(--amber)' : 'text-(--danger)'}>{scoreWord(score)}</span>
                    </p>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-(--border)">
                      <div className="h-full rounded-full bg-(--green)" style={{ width: `${score}%` }} />
                    </div>
                    {post.viralityReason && <p className="mt-1.5 text-xs leading-relaxed text-(--fg-muted)">{post.viralityReason}</p>}
                  </div>
                </div>
  ) : null;
  const imageTools = post ? (
    <>
<div className="flex flex-wrap items-start gap-4">
                  <div className="relative h-28 w-28 shrink-0 overflow-hidden rounded-lg border border-(--border) bg-(--bg-alt)">
                    {post.imageUrl ? (
                      <img decoding="async" src={post.imageUrl} alt="Post visual" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="absolute inset-0 m-auto h-7 w-7 text-(--fg-subtle)" aria-hidden />
                    )}
                    {loadingImage && (
                      <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">
                        <Loader2 className="h-5 w-5 animate-spin" aria-label="Creating a new image" />
                        <ProgressBar done={0} total={1} running partMs={15000} label="Creating the image" className="absolute inset-x-2 bottom-2" />
                      </span>
                    )}
                  </div>
                  {!isPublished && (
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" className={CHIP} onClick={onGenerateImage} disabled={loadingImage}>
                          <RefreshCcw /> {post.imageUrl ? 'Regenerate image' : 'Create image'}
                        </button>
                        <button type="button" className={CHIP} onClick={() => photoInputRef.current?.click()}>
                          <Upload /> Upload photo
                        </button>
                        <button type="button" className={CHIP} onClick={() => setShowPrompt((v) => !v)} aria-expanded={showPrompt}>
                          <PencilLine /> Describe it <ChevronDown className={clsx('transition-transform', showPrompt && 'rotate-180')} />
                        </button>
                      </div>
                      <p className="text-xs text-(--fg-muted)">You can also drop a photo onto the preview.</p>
                    </div>
                  )}
                </div>
                {showPrompt && (
                  <div className="mt-3">
                    <div className={FIELD}>
                      <textarea
                        rows={3}
                        value={post.imagePrompt}
                        onChange={(e) => setGeneratedContent({ ...post, imagePrompt: e.target.value })}
                        aria-label="Image description"
                        className="block w-full resize-y bg-transparent p-3 text-ui outline-hidden"
                      />
                    </div>
                    <span className="mt-1.5 block text-xs text-(--fg-muted)">Describe the picture in English. “Regenerate image” uses this.</span>
                  </div>
                )}
                <input
                  ref={photoInputRef}
                  type="file"
                  accept=".jpg,.jpeg,.png,.webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onPhotoFile(file);
                    e.target.value = '';
                  }}
                />
    </>
  ) : null;
  const whereWhen = post ? (
    <>
<div className="grid grid-cols-2 gap-1 rounded-full bg-(--bg-alt) p-1" role="radiogroup" aria-label="When">
                    {([
                      ['schedule', CalendarClock, 'Schedule', !canSchedule],
                      ['now', Send, 'Post now', false],
                    ] as const).map(([value, Icon, label, disabled]) => (
                      <button
                        key={value}
                        type="button"
                        role="radio"
                        aria-checked={mode === value}
                        disabled={disabled}
                        onClick={() => setMode(value)}
                        className={clsx(
                          'inline-flex items-center justify-center gap-1.5 rounded-full py-1.5 text-xs font-semibold transition-colors disabled:opacity-40',
                          mode === value ? 'bg-(--card) text-(--fg) shadow-sm ring-1 ring-(--border-strong)' : 'text-(--fg-muted) hover:text-(--fg)',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <span className={LABEL}>Post to</span>
                    {accounts === null ? (
                      <span className="flex items-center gap-1.5 text-xs text-(--fg-muted)"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your pages…</span>
                    ) : accounts.length === 0 ? (
                      <div className="space-y-2 text-ui text-(--fg-muted)">
                        <p>{accountsError || 'Connect your Facebook Page or Instagram account first.'}</p>
                        <button type="button" className="btn btn-outline btn-sm" onClick={onOpenSocial}>Connect a page</button>
                      </div>
                    ) : (
                      <div className="space-y-1.5">
                        {accounts.map((a) => {
                          const on = chosen.includes(a.id);
                          return (
                            <button
                              key={a.id}
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              onClick={() => setChosen((ids) => (on ? ids.filter((id) => id !== a.id) : [...ids, a.id]))}
                              className={clsx(
                                'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-ui transition-colors',
                                on ? 'border-(--green) bg-(--green-soft)' : 'border-(--border) hover:border-(--border-strong)',
                              )}
                            >
                              <PlatformIcon platform={a.platform} className="h-4 w-4" />
                              <span className="flex-1 font-medium">@{a.username}</span>
                              {!a.isActive && <span className="text-xs font-semibold text-(--amber)">Needs reconnecting</span>}
                              <span className={clsx('grid h-4 w-4 place-items-center rounded border', on ? 'border-transparent bg-(--green) text-(--green-fg)' : 'border-(--border-strong)')}>
                                {on && <Check className="h-3 w-3" strokeWidth={3} />}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {mode === 'schedule' ? (
                    <div className="space-y-2">
                      <span className={LABEL}>Time on {longDate(post.date)}</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {SUGGESTED_TIMES.map((s) => {
                          const past = isPast(post.date, s.time);
                          return (
                            <button
                              key={s.time}
                              type="button"
                              aria-pressed={time === s.time}
                              disabled={past}
                              onClick={() => setTime(s.time)}
                              className={clsx(
                                'relative rounded-xl border p-2 text-left transition-colors disabled:opacity-40',
                                time === s.time ? 'border-(--green) bg-(--green-soft)' : 'border-(--border) hover:border-(--border-strong)',
                              )}
                            >
                              <b className="block text-ui font-semibold">{to12h(s.time)}</b>
                              <small className="block text-xs text-(--fg-muted)">{past ? 'Passed' : s.label}</small>
                              {s.best && !past && (
                                <em className="absolute right-1.5 top-1.5 rounded-full bg-(--green-soft) px-1.5 text-xs font-medium not-italic text-(--green-ink)">Best</em>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <label className="flex items-center gap-2 text-ui text-(--fg-muted)">
                        <Clock className="h-4 w-4" /> Other time
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => e.target.value && setTime(e.target.value)}
                          className="ml-auto rounded-lg border border-(--border) bg-(--bg-alt) px-2 py-1 text-(--fg) outline-hidden focus:border-(--green)"
                        />
                      </label>
                      {!timeOk && <p className="text-xs font-semibold text-(--danger)">That time has passed. Pick a later one.</p>}
                      <p className="text-xs text-(--fg-subtle)">Suggested times are when Filipino audiences are usually online. All times are in your local time zone.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-(--fg-muted)">Goes out as soon as you press Post now.</p>
                  )}
                  {!canSchedule && <p className="text-xs text-(--fg-muted)">This day has passed, so the post can only go out now.</p>}
    </>
  ) : null;

  /* ── Post studio page (mockup APP.composer): image | caption | phone ── */
  if (isPage) {
    const versions = post ? [...(post.history || []), null] : [];
    const tags = post ? [...new Set(post.caption.match(/#[\p{L}\p{N}_]+/gu) || [])] : [];
    const statusLine = post
      ? [isPublished ? 'Posted' : isScheduled ? 'Scheduled' : 'Draft', longDate(post.date), !isPublished && mode === 'schedule' ? to12h(time) : null, chosenAccounts.length ? [...new Set(chosenAccounts.map((a) => (a.platform === 'facebook' ? 'Facebook' : 'Instagram')))].join(' and ') : null]
          .filter(Boolean)
          .join(' · ')
      : `New post · ${dateLabel}`;
    return (
      <div className="flex flex-col gap-5" ref={dialogRef}>
        <div className="kw-page-h">
          <div className="min-w-0">
            <button type="button" className="btn btn-ghost btn-sm -ml-2.5 mb-1" onClick={close}>← All drafts</button>
            <h1 className="truncate">{heading}</h1>
            <p>{statusLine}</p>
          </div>
          {post && !isPublished && (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-(--fg-muted)">{saveIndicator}</span>
              <button type="button" className="btn btn-outline" onClick={save} disabled={saveState === 'saving'}>Save draft</button>
              {!isScheduled && (
                accounts && accounts.length === 0 ? (
                  <button type="button" className="btn btn-primary" onClick={onOpenSocial}>Connect a page</button>
                ) : (
                  <button type="button" className="btn btn-primary" onClick={publish} disabled={ctaDisabled}>
                    {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : mode === 'now' ? <Send className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                    {publishing ? 'Sending…' : mode === 'now' ? 'Post now' : 'Approve and schedule'}
                  </button>
                )
              )}
            </div>
          )}
          {isPublished && post?.externalLink && (
            <a className="btn btn-outline" href={post.externalLink} target="_blank" rel="noreferrer">View post <ExternalLink className="h-3.5 w-3.5" /></a>
          )}
        </div>

        {isScheduled && post && (
          <p className="kw-alert kw-alert--warn"><Clock className="h-4 w-4 shrink-0" /> Scheduled for {longDate(post.date)}. Edits here don’t change the copy already queued.</p>
        )}

        {!post ? (
          <div className="kw-studio kw-studio--new">
            <section className="card">
              <div className="kw-card-h"><h3>{limitReached ? `You’ve used all ${planPostCount} posts for ${monthName}` : 'What should this post say?'}</h3></div>
              <div className="p-4">{briefForm}</div>
            </section>
            <div className="flex flex-col items-center gap-3">{preview}<p className="kw-hint text-center">Preview only. The real post may crop slightly.</p></div>
          </div>
        ) : (
          <div className="kw-studio">
            {/* Image */}
            <section className="card overflow-hidden" aria-label="Image">
              <div className="relative aspect-square bg-(--muted)">
                {post.imageUrl ? <img decoding="async" src={post.imageUrl} alt="Post visual" className="h-full w-full object-cover" /> : <ImageIcon className="absolute inset-0 m-auto h-8 w-8 text-(--fg-muted)" aria-hidden />}
                {loadingImage && (
                  <span className="absolute inset-0 grid place-items-center bg-black/45 text-white"><Loader2 className="h-6 w-6 animate-spin" aria-label="Creating a new image" /><ProgressBar done={0} total={1} running partMs={15000} label="Creating the image" className="absolute inset-x-4 bottom-4" /></span>
                )}
              </div>
              <div className="flex flex-col gap-3 p-4">
                <div className="flex items-center justify-between gap-2">
                  <span className="kw-hint">{post.imageUrl?.startsWith('data:') || post.imageUrl?.includes('/api/images') ? 'Image made by Kawayan AI or your photo' : 'Image made by Kawayan AI'}</span>
                  {post.history?.length > 0 && <span className="badge badge-sage mono">{post.history.length + 1} versions</span>}
                </div>
                {!isPublished && (
                  <>
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-outline btn-sm flex-1" onClick={onGenerateImage} disabled={loadingImage}><RefreshCcw className="h-4 w-4" /> {post.imageUrl ? 'Regenerate image' : 'Create image'}</button>
                      <button type="button" className="btn btn-outline btn-sm flex-1" onClick={() => photoInputRef.current?.click()}><Upload className="h-4 w-4" /> Upload my own photo</button>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm self-start" onClick={() => setShowPrompt((v) => !v)} aria-expanded={showPrompt}>
                      <PencilLine className="h-4 w-4" /> Describe the image <ChevronDown className={clsx('h-3.5 w-3.5 transition-transform', showPrompt && 'rotate-180')} />
                    </button>
                    {showPrompt && (
                      <div className={FIELD}>
                        <textarea rows={3} value={post.imagePrompt} onChange={(e) => setGeneratedContent({ ...post, imagePrompt: e.target.value })} aria-label="Image description" className="block w-full resize-y bg-transparent p-3 text-ui outline-hidden" />
                      </div>
                    )}
                  </>
                )}
                <input ref={photoInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; if (file) onPhotoFile(file); e.target.value = ''; }} />
              </div>
            </section>

            {/* Caption, score, when, where */}
            <section className="card" aria-label="Caption">
              <div className="kw-card-h">
                <h3>Caption</h3>
                {counts && <span className={clsx('mono text-xs', counts.chars > IG_CAPTION_LIMIT ? 'text-(--danger)' : 'text-(--fg-muted)')}>{counts.chars.toLocaleString()} / {IG_CAPTION_LIMIT.toLocaleString()}</span>}
              </div>
              <div className="flex flex-col gap-4 p-4">
                <div className="kw-vers" role="group" aria-label="Versions">
                  {Array.from({ length: MAX_REWRITES + 1 }, (_, i) => {
                    const isCurrent = i === versions.length - 1;
                    const isEarlier = i < versions.length - 1;
                    const isNext = i === versions.length;
                    const label = `Version ${i + 1}`;
                    if (isCurrent) return <button key={i} type="button" aria-pressed="true">{label}<small>{i === 0 ? 'Original' : 'Current'}</small></button>;
                    if (isEarlier) return <button key={i} type="button" aria-pressed="false" disabled={isPublished} onClick={() => restoreVersion(i)}>{label}<small>Earlier · use it</small></button>;
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed="false"
                        disabled={!isNext || isPublished || rewritesLeft === 0 || generatingPost}
                        onClick={() => { setRedoing(true); runGenerate(); }}
                        title="A new caption, score and image from the same idea"
                      >
                        {label}<small>{redoing && generatingPost && isNext ? 'Writing…' : isNext ? `${rewritesLeft} left` : 'Not used'}</small>
                      </button>
                    );
                  })}
                </div>
                {captionEditor}
                {tags.length > 0 && (
                  <div className="kw-field">
                    <span className="kw-label">Hashtags</span>
                    <div className="flex flex-wrap gap-1.5">{tags.map((t) => <span key={t} className="badge badge-sage">{t}</span>)}</div>
                  </div>
                )}
                {scoreBox}
                {!isPublished && !isScheduled && (
                  <>
                    <hr className="border-(--border)" />
                    <div className="kw-field">
                      <span className="kw-label" id="ps-when">When</span>
                      <div className="grid grid-cols-2 gap-2">
                        <input
                          type="date"
                          className="input"
                          aria-label="Date"
                          value={post.date}
                          min={isoToday()}
                          disabled={!onMoveDate}
                          onChange={(e) => e.target.value && e.target.value >= isoToday() && e.target.value !== post.date && onMoveDate?.(post, e.target.value)}
                        />
                        <input type="time" className="input" aria-label="Time" value={time} disabled={mode === 'now'} onChange={(e) => e.target.value && setTime(e.target.value)} />
                      </div>
                      <div className="kw-slots" role="group" aria-labelledby="ps-when">
                        {SUGGESTED_TIMES.map((sl) => {
                          const past = isPast(post.date, sl.time);
                          return (
                            <button key={sl.time} type="button" aria-pressed={mode === 'schedule' && time === sl.time} disabled={past} onClick={() => { setMode('schedule'); setTime(sl.time); }}>
                              <b>{sl.label}</b>{past ? 'Passed' : to12h(sl.time)}
                            </button>
                          );
                        })}
                      </div>
                      <label className="kw-check text-ui">
                        <input type="checkbox" checked={mode === 'now'} onChange={(e) => setMode(e.target.checked ? 'now' : 'schedule')} />
                        <span>Post right away instead</span>
                      </label>
                      {!timeOk && <p className="text-xs font-medium text-(--danger)">That time has passed. Pick a later one.</p>}
                      {!canSchedule && <p className="kw-hint">This day has passed, so the post can only go out now.</p>}
                    </div>
                    <div className="kw-field">
                      <span className="kw-label">Post to</span>
                      {accounts === null ? (
                        <span className="kw-hint">Loading your pages…</span>
                      ) : accounts.length === 0 ? (
                        <div className="flex flex-wrap items-center gap-2 text-ui text-(--fg-muted)">
                          {accountsError || 'Connect your Facebook Page or Instagram account first.'}
                          <button type="button" className="btn btn-outline btn-sm" onClick={onOpenSocial}>Connect a page</button>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2">
                          {accounts.map((a) => {
                            const on = chosen.includes(a.id);
                            return (
                              <div key={a.id} className="flex items-center justify-between gap-2">
                                <span className="flex min-w-0 items-center gap-2 text-ui">
                                  <PlatformIcon platform={a.platform} className="h-4 w-4" />
                                  <span className="truncate">{a.platform === 'facebook' ? a.displayName || `@${a.username}` : `@${a.username}`}</span>
                                  {!a.isActive && (
                                    <button type="button" className="badge badge-red" onClick={() => onReconnect?.(a.platform)}>Reconnect</button>
                                  )}
                                </span>
                                <button
                                  type="button"
                                  role="switch"
                                  aria-checked={on}
                                  aria-label={`Post to ${a.platform === 'facebook' ? 'Facebook' : 'Instagram'} @${a.username}`}
                                  className="kw-switch"
                                  onClick={() => setChosen((ids) => (on ? ids.filter((id) => id !== a.id) : [...ids, a.id]))}
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </section>

            {/* Phone */}
            <div className="flex flex-col items-center gap-3">
              {preview}
              <p className="kw-hint text-center">Preview only. The real post may crop slightly.</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  /* ── Dialog (mockup APP.composer): idea → caption + image (accordion) | phone; footer publishes ── */
  const ideaChips = ideaSuggestions(profile, currentDate, selectedDay, currentIdea?.title);
  const draftDisabled = brief.trim().length === 0 || generatingPost || extraBusy;
  const showProgress = generatingPost || (!!post && freshDraft && (loadingImage || !post.imageUrl));
  const pickDate = (d: Date | undefined) => {
    if (!d || !post) return;
    const next = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    setDateOpen(false);
    if (next !== post.date) onMoveDate?.(post, next);
  };

  return (
    <div className="fixed inset-0 z-90 flex items-center justify-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-black/45 animate-fade-in motion-reduce:animate-none" onClick={close} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Compose post for ${dateLabel}`}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[1120px] flex-col overflow-hidden bg-(--bg) text-(--fg) outline-hidden animate-scale-in motion-reduce:animate-none sm:h-auto sm:max-h-[92vh] sm:rounded-xl sm:border sm:border-(--border) sm:shadow-lg"
      >
        {/* ── Header: title, date and voice as small badges, close ── */}
        <header className="flex items-start gap-3 border-b border-(--border) bg-(--card) px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-snug" title={heading}>{post ? heading : 'New post'}</h2>
            <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
              {post && <StatusBadge status={isPublished ? 'published' : isScheduled ? 'scheduled' : 'draft'} />}
              <span className="badge"><CalendarClock className="h-3 w-3" aria-hidden /> {dateLabel}</span>
              {profile.brandVoice && (
                <span className="badge" title={profile.targetAudience ? `Written for ${profile.targetAudience}` : undefined}>
                  <AudioLines className="h-3 w-3" aria-hidden /> Tuned to: {profile.brandVoice}
                </span>
              )}
              {currentIdea && !post && <span className="badge badge-sage">From your {monthName} plan</span>}
              {post?.format && <span className="badge">{normalizeFormat(post.format)}</span>}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close composer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-(--fg-muted) transition-colors hover:bg-(--muted) hover:text-(--fg)"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* ── Body: idea, then caption + image | phone ── */}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 space-y-4 overflow-y-auto bg-(--bg) px-5 py-5 sm:px-6">
            {isPublished && post && (
              <p className="kw-alert kw-alert--ok">
                <Check className="h-4 w-4" /> This post is live, so editing is turned off.
                {post.externalLink && (
                  <a href={post.externalLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium underline underline-offset-2">
                    View post <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </p>
            )}
            {isScheduled && post && (
              <p className="kw-alert kw-alert--warn">
                <Clock className="h-4 w-4 shrink-0" /> Scheduled for {longDate(post.date)}. Edits here don’t change the copy already queued.
              </p>
            )}

            {/* Idea */}
            {!post ? (
              <section className="card p-4">
                <form onSubmit={submitBrief} aria-busy={generatingPost || extraBusy} className="grid gap-3">
                  {limitReached ? (
                    <p className="text-ui text-(--fg-muted)">You’ve used all {planPostCount} posts for {monthName}. Add this one as an extra post for ₱{addOnPrice}, paid from your wallet.</p>
                  ) : (
                    <label htmlFor="ps-brief" className="text-ui font-semibold">What should this post say?</label>
                  )}
                  <div className={clsx(FIELD, 'p-3')}>
                    <TextareaAutosize
                      id="ps-brief"
                      className="block w-full resize-none bg-transparent text-sm leading-relaxed outline-hidden placeholder:text-(--fg-subtle)"
                      minRows={3}
                      maxRows={10}
                      maxLength={400}
                      value={brief}
                      onChange={(e) => setBrief(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submitBrief();
                      }}
                      readOnly={generatingPost || extraBusy}
                      placeholder="e.g. Behind the scenes of our 5 AM bake, and 10% off pandesal this weekend"
                      aria-invalid={!!extraError}
                      aria-describedby="ps-brief-msg"
                    />
                  </div>
                  {ideaChips.length > 0 && (
                    <div className="flex flex-wrap gap-1.5" role="group" aria-label="Ideas">
                      {ideaChips.map((c) => (
                        <button key={c} type="button" className="kw-chip" onClick={() => setBrief(c)} disabled={generatingPost || extraBusy}>
                          {c}
                        </button>
                      ))}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    <p
                      id="ps-brief-msg"
                      className={clsx('min-w-0 flex-1 text-xs [&_button]:font-medium [&_button]:text-(--fg) [&_button]:underline [&_button]:underline-offset-2', extraError ? 'text-(--danger)' : 'text-(--fg-muted)')}
                      role={extraError ? 'alert' : undefined}
                    >
                      {limitReached ? (
                        <>
                          {extraError || (walletBalance != null ? `Wallet balance: ₱${walletBalance.toLocaleString('en-PH')}.` : 'Paid from your Kawayan wallet.')}{' '}
                          {(extraError || (walletBalance != null && walletBalance < addOnPrice)) && <button type="button" onClick={onOpenBilling}>Top up</button>}{' '}
                          {planPostCount < 16 && <button type="button" onClick={onOpenBilling}>Or upgrade to Pro for 16 posts a month</button>}
                        </>
                      ) : (
                        'Kawayan writes the caption, scores it and makes a matching image. About 20 seconds.'
                      )}
                    </p>
                    <button type="submit" disabled={draftDisabled} className="btn btn-primary kw-draft-btn">
                      {generatingPost || extraBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <KawayanMark size={16} />}
                      {limitReached ? (extraBusy ? 'Paying…' : `Pay ₱${addOnPrice} and draft it`) : generatingPost ? 'Drafting…' : 'Draft with AI'}
                      <span className="hidden gap-0.5 opacity-70 sm:inline-flex" aria-hidden>
                        <kbd className="rounded border border-current/30 px-1 font-sans text-xs">{MOD_KEY}</kbd>
                        <kbd className="rounded border border-current/30 px-1 font-sans text-xs">↵</kbd>
                      </span>
                    </button>
                  </div>
                </form>
              </section>
            ) : (
              <section className="card flex flex-wrap items-center gap-2 px-4 py-3">
                <Check className="h-4 w-4 text-(--green-ink)" aria-hidden />
                <span className="min-w-0 flex-1 truncate text-ui"><b className="font-semibold">Idea</b> <span className="text-(--fg-muted)">· {post.topic}</span></span>
                {!isPublished && (
                  <button
                    type="button"
                    className={CHIP}
                    onClick={() => {
                      setRedoing(true);
                      runGenerate();
                    }}
                    disabled={generatingPost || rewritesLeft === 0}
                    title="New caption, score and image from the same idea"
                  >
                    {redoing ? <Loader2 className="animate-spin" /> : <Zap />}
                    {rewritesLeft === 0 ? 'No rewrites left' : `Start over · ${rewritesLeft} left`}
                  </button>
                )}
              </section>
            )}

            {showProgress && <GenerationProgress post={post} loadingImage={loadingImage} />}

            {/* Caption + image: one quiet line before generation, an accordion after */}
            {!post ? (
              <p className="px-1 text-ui text-(--fg-muted)">The caption and image appear here once Kawayan drafts them. You can edit both.</p>
            ) : (
              <Accordion multiple value={openSteps} onValueChange={(v) => setOpenSteps(v as string[])} className="card overflow-hidden">
                <AccordionItem value="caption" className="border-(--border)">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="font-semibold">Caption</span>
                      {counts && (
                        <span className={clsx('text-xs font-normal tabular-nums', counts.chars > IG_CAPTION_LIMIT ? 'text-(--danger)' : 'text-(--fg-muted)')}>
                          {counts.chars.toLocaleString()} / {IG_CAPTION_LIMIT.toLocaleString()} · {counts.tags} hashtag{counts.tags === 1 ? '' : 's'}
                        </span>
                      )}
                      <span className={clsx("ml-auto mr-2 badge", score >= 75 && "badge-green")}>{score}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">
                    {captionEditor}
                    {scoreBox}
                    {post.history?.length > 0 && (
                      <details className="mt-3 text-ui">
                        <summary className="cursor-pointer text-xs font-semibold text-(--fg-muted) hover:text-(--fg)">Earlier versions ({post.history.length})</summary>
                        <div className="mt-2 space-y-2">
                          {post.history.map((v, i) => (
                            <div key={`${v.createdAt}-${i}`} className="rounded-lg border border-(--border) p-3">
                              <p className="line-clamp-3 text-(--fg-muted)">{v.caption}</p>
                              <div className="mt-2 flex items-center justify-between">
                                {v.viralityScore != null && <span className="text-xs font-semibold">Score {v.viralityScore}</span>}
                                {!isPublished && (
                                  <button type="button" onClick={() => restoreVersion(i)} className="text-xs font-medium underline underline-offset-2 hover:text-(--green-ink)">Use this</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </details>
                    )}
                  </AccordionContent>
                </AccordionItem>
                <AccordionItem value="image" className="border-(--border)">
                  <AccordionTrigger className="px-4 py-3 hover:no-underline">
                    <span className="flex flex-1 items-center gap-2">
                      <span className="font-semibold">Image</span>
                      <span className="text-xs font-normal text-(--fg-muted)">{loadingImage ? 'Making it…' : post.imageUrl ? 'Ready' : 'Not made yet'}</span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent className="px-4 pb-4">{imageTools}</AccordionContent>
                </AccordionItem>
              </Accordion>
            )}

            <details className="rounded-xl border border-(--border) bg-(--card) p-4 lg:hidden">
              <summary className="cursor-pointer text-ui font-semibold">Preview on Facebook and Instagram</summary>
              <div className="mt-4 flex justify-center">{preview}</div>
            </details>
          </div>

          <aside className="hidden min-h-0 flex-col items-center overflow-y-auto border-l border-(--border) bg-(--muted) px-5 py-5 lg:flex">
            {preview}
            <p className="mt-3 text-center text-xs text-(--fg-muted)">Preview only. Reactions show up after it posts.</p>
          </aside>
        </div>

        {/* ── Footer: channels, date + time, Schedule ── */}
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-(--border) bg-(--card) px-5 py-3 sm:px-6">
          {isPublished ? (
            <>
              <span className="text-xs text-(--fg-muted)">{saveIndicator}</span>
              <div className="ml-auto flex items-center gap-3">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--green-ink)"><Check className="h-4 w-4" /> Published</span>
                {post?.externalLink && (
                  <a className="btn btn-outline btn-sm" href={post.externalLink} target="_blank" rel="noreferrer">
                    View post <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </div>
            </>
          ) : isScheduled ? (
            <>
              <span className="text-xs text-(--fg-muted)">{saveIndicator}</span>
              <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-(--amber)">
                <CalendarClock className="h-4 w-4" /> Scheduled for {longDate(post!.date)}
              </span>
            </>
          ) : (
            <>
              {/* Channels */}
              <div className="flex flex-wrap items-center gap-3" role="group" aria-label="Post to">
                {accounts === null ? (
                  <span className="flex items-center gap-1.5 text-xs text-(--fg-muted)"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your pages…</span>
                ) : accounts.length === 0 ? (
                  <span className="text-xs text-(--fg-muted)">{accountsError || (post ? 'Connect a page to publish. Your draft is saved.' : 'No page connected yet.')}</span>
                ) : (
                  accounts.map((a) => {
                    const on = chosen.includes(a.id);
                    return (
                      <label key={a.id} className={clsx('flex items-center gap-2 text-ui', !a.isActive && 'text-(--fg-muted)')} title={!a.isActive ? 'Needs reconnecting' : undefined}>
                        <Switch
                          size="sm"
                          checked={on}
                          disabled={!post}
                          onCheckedChange={(v) => setChosen((ids) => (v ? [...ids, a.id] : ids.filter((id) => id !== a.id)))}
                          aria-label={`Post to @${a.username}`}
                        />
                        <PlatformIcon platform={a.platform} className="h-3.5 w-3.5" />
                        <span className="max-w-[9rem] truncate">@{a.username}</span>
                        {!a.isActive && <span className="badge badge-red">Reconnect</span>}
                      </label>
                    );
                  })
                )}
              </div>

              <div className="ml-auto flex flex-wrap items-center gap-2">
                {/* Date + time */}
                {post && accounts && accounts.length > 0 && (
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger className="btn btn-outline btn-sm" aria-label="Pick date and time">
                      <CalendarClock className="h-3.5 w-3.5" aria-hidden />
                      {mode === 'now' ? 'Right away' : `${longDate(post.date)} · ${to12h(time)}`}
                      <ChevronDown className="h-3.5 w-3.5 text-(--fg-muted)" aria-hidden />
                    </PopoverTrigger>
                    <PopoverContent side="top" align="end" className="w-auto gap-3 p-3">
                      <React.Suspense fallback={<div className="kw-skel h-[260px] w-[252px] rounded-lg" />}>
                      <DayCalendar
                        mode="single"
                        selected={new Date(`${post.date}T00:00:00`)}
                        onSelect={pickDate}
                        disabled={{ before: new Date(new Date().setHours(0, 0, 0, 0)) }}
                        defaultMonth={new Date(`${post.date}T00:00:00`)}
                      />
                      </React.Suspense>
                      {!onMoveDate && <p className="text-xs text-(--fg-muted)">Move the post on the calendar to change its day.</p>}
                      <div className="grid grid-cols-3 gap-1.5">
                        {SUGGESTED_TIMES.map((t) => {
                          const past = isPast(post.date, t.time);
                          return (
                            <button
                              key={t.time}
                              type="button"
                              aria-pressed={mode === 'schedule' && time === t.time}
                              disabled={past || !canSchedule}
                              onClick={() => { setMode('schedule'); setTime(t.time); }}
                              className={clsx('rounded-lg border px-2 py-1.5 text-left text-xs transition-colors disabled:opacity-40', mode === 'schedule' && time === t.time ? 'border-(--green) bg-(--green-soft)' : 'border-(--border) hover:border-(--border-strong)')}
                            >
                              <b className="block font-semibold">{to12h(t.time)}</b>
                              <span className="text-(--fg-muted)">{past ? 'Passed' : t.label}</span>
                            </button>
                          );
                        })}
                      </div>
                      <label className="flex items-center gap-2 text-xs text-(--fg-muted)">
                        <Clock className="h-3.5 w-3.5" /> Other time
                        <input
                          type="time"
                          value={time}
                          disabled={!canSchedule}
                          onChange={(e) => { if (e.target.value) { setMode('schedule'); setTime(e.target.value); } }}
                          className="ml-auto rounded-md border border-(--border) bg-(--card) px-2 py-1 text-(--fg)"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-xs">
                        <Switch size="sm" checked={mode === 'now'} onCheckedChange={(v) => setMode(v ? 'now' : 'schedule')} />
                        Post right away instead
                      </label>
                      {!canSchedule && <p className="text-xs text-(--fg-muted)">This day has passed, so the post can only go out now.</p>}
                      {!timeOk && <p className="text-xs font-semibold text-(--danger)">That time has passed. Pick a later one.</p>}
                    </PopoverContent>
                  </Popover>
                )}

                {accounts && accounts.length === 0 ? (
                  <button type="button" className="btn btn-outline btn-sm" onClick={onOpenSocial}>Connect a page</button>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm kw-draft-btn" onClick={publish} disabled={ctaDisabled}>
                    {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : mode === 'now' ? <Send className="h-3.5 w-3.5" /> : <CalendarClock className="h-3.5 w-3.5" />}
                    {publishing ? 'Sending…' : mode === 'now' ? 'Post now' : 'Schedule'}
                  </button>
                )}
              </div>
              {post && <span className="w-full text-xs text-(--fg-muted) sm:w-auto sm:order-first sm:basis-full">{saveIndicator}</span>}
            </>
          )}
        </footer>
      </div>
    </div>
  );
};

/** Upcoming idea chips: today's planned idea, Brand DNA themes, and PH dates from this day on. */
function ideaSuggestions(profile: BrandProfile, month: Date, day: number | null, planned?: string): string[] {
  const out: string[] = [];
  if (planned) out.push(planned);
  const from = day ?? 1;
  phDatesInMonth(month.getFullYear(), month.getMonth())
    .filter((d) => d.day >= from)
    .slice(0, 2)
    .forEach((d) => out.push(d.kind === 'payday' ? `Payday treat on the ${d.day}${d.day === 15 ? 'th' : ''}` : `${d.name} special`));
  profile.keyThemes
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 2)
    .forEach((t) => out.push(`${t[0].toUpperCase()}${t.slice(1)} post`));
  return [...new Set(out)].slice(0, 4);
}


/** Writing caption → Scoring → Making image, each ticked as it really finishes. */
const GenerationProgress: React.FC<{ post: GeneratedPost | null; loadingImage: boolean }> = ({ post, loadingImage }) => {
  const steps = [
    { label: 'Writing caption…', done: !!post?.caption },
    { label: 'Scoring…', done: post?.viralityScore != null },
    { label: 'Making image…', done: !!post?.imageUrl && !loadingImage },
  ];
  const current = steps.findIndex((s) => !s.done);
  return (
    <div className="card grid gap-3 px-4 py-3">
    <ProgressBar done={steps.filter((s) => s.done).length} total={steps.length} running partMs={9000} label="Drafting progress" />
    <ol className="grid gap-2" aria-live="polite" aria-label="Drafting steps">
      {steps.map((s, i) => (
        <li key={s.label} className={clsx('flex items-center gap-2.5 text-ui', s.done ? 'text-(--fg-muted)' : i === current ? 'font-medium text-(--fg)' : 'text-(--fg-subtle)')}>
          <span className={clsx('grid h-5 w-5 place-items-center rounded-full border', s.done ? 'border-transparent bg-(--green) text-(--green-fg)' : i === current ? 'border-(--fg)' : 'border-(--border-strong)')}>
            {s.done ? <Check className="h-3 w-3" strokeWidth={3} /> : i === current ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          </span>
          {s.done ? s.label.replace('…', '') : s.label}
        </li>
      ))}
    </ol>
    </div>
  );
};

export default PostComposer;
