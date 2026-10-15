import React, { useEffect, useRef, useState } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost, PostVersion } from '../../types';
import type { SocialAccount } from '../../services/socialService';
import type { CaptionRewrite } from '../../services/aiService';
import {
  X, RefreshCcw, Loader2, Upload, Image as ImageIcon, Send, Facebook, Instagram, Scissors, Smile, Briefcase, Megaphone,
  Languages, Hash, ArrowUp, ArrowUpRight, Undo2, Check, ChevronDown, CalendarClock, Zap, ExternalLink, PencilLine,
  CircleAlert, History, Clock, Globe, AudioLines, Sparkles,
} from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import clsx from 'clsx';
import FormatPicker, { PostFormat } from './FormatPicker';
import PhonePreview from './PhonePreview';
import { StatusBadge } from './TimelinePostCard';
import { normalizeFormat } from '../../services/validationService';

/* ── Shared looks ── */

const CARD = 'rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4';
const CARD_HEAD = 'mb-3 flex items-center justify-between gap-2 text-[13px] font-semibold text-[var(--fg)]';
/** The frameless writing surface: one hairline, emerald when focused. */
const FIELD =
  'rounded-xl border border-[var(--border)] bg-[color-mix(in_srgb,var(--bg-alt)_60%,transparent)] transition-colors focus-within:border-brand focus-within:ring-2 focus-within:ring-[var(--ring)]';
const CHIP =
  'inline-flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-alt)] px-3 py-1.5 text-xs font-semibold text-[var(--fg-muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--fg)] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-3.5 [&_svg]:w-3.5';
export const PRIMARY_BTN =
  'inline-flex items-center justify-center gap-2 rounded-full bg-[var(--primary-accent)] px-5 py-2.5 text-sm font-semibold text-[var(--primary-accent-fg)] transition-colors hover:bg-[var(--primary-accent-hover)] disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:h-4 [&_svg]:w-4';
const LABEL = 'text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--fg-subtle)]';

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

const ScoreRing: React.FC<{ score: number }> = ({ score }) => {
  const r = 26;
  const c = 2 * Math.PI * r;
  const color = score >= 75 ? 'var(--primary)' : score >= 50 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="relative h-16 w-16 shrink-0">
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90" aria-hidden>
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border-strong)" strokeWidth="6" />
        <circle
          cx="32" cy="32" r={r} fill="none" stroke={color} strokeWidth="6" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)}
          className="transition-[stroke-dashoffset] duration-500"
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center font-display text-lg font-bold">{score}</span>
    </div>
  );
};

/** Narrates the first draft while it's made (caption, then image), so the wait reads as progress. */
const GeneratingSteps: React.FC = () => {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const a = setTimeout(() => setStep(1), 1200);
    const b = setTimeout(() => setStep(2), 9000);
    return () => {
      clearTimeout(a);
      clearTimeout(b);
    };
  }, []);
  const steps = ['Reading your brand profile', 'Writing a Taglish caption', 'Creating a matching visual'];
  return (
    <ol className="mt-5 space-y-2.5" aria-live="polite">
      {steps.map((s, i) => (
        <li
          key={s}
          className={clsx(
            'flex items-center gap-2.5 text-[13.5px] transition-colors',
            i < step ? 'text-[var(--fg-muted)]' : i === step ? 'font-semibold text-[var(--fg)]' : 'text-[var(--fg-subtle)]',
          )}
        >
          <span
            className={clsx(
              'grid h-5 w-5 place-items-center rounded-full border',
              i < step ? 'border-transparent bg-brand text-on-brand' : i === step ? 'border-[var(--primary)] text-[var(--primary)]' : 'border-[var(--border-strong)]',
            )}
          >
            {i < step ? <Check className="h-3 w-3" strokeWidth={3} /> : i === step ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          </span>
          {s}
        </li>
      ))}
    </ol>
  );
};

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
}) => {
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
  const [format, setFormat] = useState<PostFormat>('Image');
  const [extraBusy, setExtraBusy] = useState(false);
  const [extraError, setExtraError] = useState('');
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

  // Esc closes the open popover first, then the studio; background scroll is locked while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
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
    setFormat(idea?.format || 'Image');
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
    if (brief.trim().length < 3 || generatingPost || extraBusy) return;
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
    />
  );

  const saveIndicator = post && (
    <span className="inline-flex items-center gap-1 [&_svg]:h-3 [&_svg]:w-3" aria-live="polite">
      {saveState === 'saved' && <><Check /> Saved</>}
      {saveState === 'saving' && <><Loader2 className="animate-spin" /> Saving…</>}
      {saveState === 'dirty' && <><span className="h-1.5 w-1.5 rounded-full bg-amber-500" /> Unsaved changes</>}
      {saveState === 'error' && (
        <span className="inline-flex items-center gap-1 text-[var(--danger)]">
          <CircleAlert /> Couldn’t save
          <button type="button" onClick={save} className="font-bold underline">Retry</button>
        </span>
      )}
    </span>
  );

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center sm:p-6" role="presentation">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in motion-reduce:animate-none" onClick={close} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Compose post for ${dateLabel}`}
        tabIndex={-1}
        className="relative flex h-full w-full max-w-[1120px] flex-col overflow-hidden bg-[var(--bg)] text-[var(--fg)] outline-none animate-scale-in motion-reduce:animate-none sm:h-auto sm:max-h-[92vh] sm:rounded-2xl sm:border sm:border-[var(--border-strong)] sm:shadow-2xl"
      >
        {/* ── Header ── */}
        <header className="flex items-start gap-3 border-b border-[var(--border)] bg-[var(--card)] px-5 py-4 sm:px-6">
          <span className="mt-0.5 shrink-0 rounded-full border border-badge-border bg-badge px-2.5 py-1 text-xs font-bold text-badge-text">
            {dateLabel}
          </span>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-bold leading-snug" title={heading}>{heading}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[var(--fg-muted)]">
              {post ? (
                <StatusBadge status={isPublished ? 'published' : isScheduled ? 'scheduled' : 'draft'} />
              ) : (
                <span className="rounded-full border border-dashed border-[var(--border-strong)] px-1.5 text-[10.5px] font-semibold leading-4">New</span>
              )}
              {post?.format && <span>{normalizeFormat(post.format)} post</span>}
              {profile.brandVoice && (
                <span className="inline-flex items-center gap-1" title={profile.targetAudience ? `Written for ${profile.targetAudience}` : undefined}>
                  <AudioLines className="h-3.5 w-3.5 text-[var(--primary)]" aria-hidden />
                  Tuned to: <b className="font-semibold text-[var(--fg)]">{profile.brandVoice}</b>
                </span>
              )}
              {saveIndicator}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close composer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* ── Body: studio | phone ── */}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-h-0 space-y-4 overflow-y-auto px-5 py-5 sm:px-6">
            {!post ? (
              <form onSubmit={submitBrief} aria-busy={generatingPost || extraBusy}>
                <p className="text-xs font-semibold text-[var(--fg-muted)]">{currentIdea ? `From your ${monthName} plan` : `${dateLabel} · nothing planned yet`}</p>
                <h3 className="mb-4 mt-1 font-display text-2xl font-bold tracking-tight">
                  {limitReached ? `You’ve used all ${planPostCount} posts for ${monthName}` : 'What should this post say?'}
                </h3>
                {limitReached && <p className="-mt-2 mb-4 text-sm text-[var(--fg-muted)]">Add this one as an extra post for ₱{addOnPrice}, paid from your wallet.</p>}

                <div className={clsx(FIELD, 'p-4')}>
                  <TextareaAutosize
                    className="block w-full resize-none bg-transparent text-[15px] leading-relaxed outline-none placeholder:text-[var(--fg-subtle)]"
                    minRows={4}
                    maxRows={12}
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

                {!limitReached && (
                  <div className="mt-4 flex flex-wrap items-center gap-3">
                    <span className={LABEL}>Format</span>
                    <FormatPicker value={format} onChange={setFormat} disabled={generatingPost} />
                  </div>
                )}

                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <button
                    type="submit"
                    disabled={brief.trim().length < 3 || generatingPost || extraBusy}
                    className="inline-flex items-center gap-2 rounded-full border border-brand/50 bg-brand/10 px-4 py-2 text-sm font-semibold text-[var(--primary)] transition-colors hover:bg-brand/20 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {generatingPost || extraBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    {limitReached ? (extraBusy ? 'Paying…' : `Pay ₱${addOnPrice} and draft it`) : generatingPost ? 'Drafting…' : 'Draft with AI'}
                    <span className="ml-1 inline-flex gap-0.5 opacity-70" aria-hidden>
                      <kbd className="rounded border border-brand/40 px-1 font-sans text-[10.5px]">{MOD_KEY}</kbd>
                      <kbd className="rounded border border-brand/40 px-1 font-sans text-[10.5px]">↵</kbd>
                    </span>
                  </button>
                </div>

                {generatingPost ? (
                  <GeneratingSteps />
                ) : limitReached ? (
                  <p
                    id="ps-brief-msg"
                    className={clsx('mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] [&_button]:font-semibold [&_button]:text-[var(--primary)] [&_button:hover]:underline', extraError ? 'text-[var(--danger)]' : 'text-[var(--fg-muted)]')}
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
                  <p id="ps-brief-msg" className="mt-4 text-[13px] text-[var(--fg-muted)]">
                    Kawayan writes the caption, scores it and makes a matching image. About 20 seconds.
                  </p>
                )}
              </form>
            ) : (
              <>
                {isPublished && (
                  <p className="flex flex-wrap items-center gap-2 rounded-xl border border-brand/30 bg-brand/10 px-4 py-2.5 text-[13px] text-[var(--fg)]">
                    <Check className="h-4 w-4 text-[var(--primary)]" /> This post is live, so editing is turned off.
                    {post.externalLink && (
                      <a href={post.externalLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[var(--primary)] hover:underline">
                        View post <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    )}
                  </p>
                )}
                {isScheduled && (
                  <p className="flex items-center gap-2 rounded-xl border border-amber-300/40 bg-amber-50 px-4 py-2.5 text-[13px] text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300">
                    <Clock className="h-4 w-4 shrink-0" /> Scheduled for {longDate(post.date)}. Edits here don’t change the copy already queued.
                  </p>
                )}

                {/* Caption + AI co-writer */}
                <section className={CARD}>
                  <div className={CARD_HEAD}>
                    <label htmlFor="ps-caption-text">Caption</label>
                    {counts && (
                      <span className={clsx('text-xs font-normal tabular-nums', counts.chars > IG_CAPTION_LIMIT ? 'text-[var(--danger)]' : 'text-[var(--fg-subtle)]')}>
                        {counts.chars.toLocaleString()} / {IG_CAPTION_LIMIT.toLocaleString()} · {counts.tags} hashtag{counts.tags === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <div className={clsx(FIELD, 'relative')}>
                    <textarea
                      id="ps-caption-text"
                      rows={7}
                      value={post.caption}
                      readOnly={isPublished || !!busyLabel}
                      onChange={(e) => setGeneratedContent({ ...post, caption: e.target.value })}
                      placeholder="Write your Taglish caption…"
                      className="block min-h-[168px] w-full resize-y bg-transparent p-4 text-[14.5px] leading-relaxed outline-none placeholder:text-[var(--fg-subtle)]"
                    />
                    {busyLabel && (
                      <div className="absolute inset-0 grid place-items-center rounded-xl bg-[color-mix(in_srgb,var(--card)_78%,transparent)] text-sm font-semibold" aria-live="polite">
                        <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin text-[var(--primary)]" /> {busyLabel}</span>
                      </div>
                    )}
                  </div>

                  {lastEdit && !busyLabel && (
                    <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-[var(--fg-muted)]">
                      <Check className="h-3.5 w-3.5 text-[var(--primary)]" />
                      <span>{lastEdit.label}</span>
                      {lastEdit.delta != null && lastEdit.delta !== 0 && (
                        <span className={clsx('rounded-full px-1.5 font-semibold', lastEdit.delta > 0 ? 'bg-brand/15 text-[var(--primary)]' : 'bg-red-500/10 text-[var(--danger)]')}>
                          Score {lastEdit.delta > 0 ? '+' : '−'}{Math.abs(lastEdit.delta)}
                        </span>
                      )}
                      {undoStack.length > 0 && (
                        <button type="button" onClick={undo} className="ml-auto inline-flex items-center gap-1 font-semibold text-[var(--fg)] hover:underline">
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
                        <PencilLine className="h-4 w-4 shrink-0 text-[var(--fg-subtle)]" aria-hidden />
                        <input
                          value={ask}
                          onChange={(e) => setAsk(e.target.value)}
                          maxLength={200}
                          disabled={!!aiBusy}
                          placeholder="Tell Kawayan what to change, e.g. “mention our 20% weekend promo”"
                          aria-label="Tell Kawayan what to change"
                          className="min-w-0 flex-1 bg-transparent py-1.5 text-[13.5px] outline-none placeholder:text-[var(--fg-subtle)]"
                        />
                        <button type="submit" disabled={!ask.trim() || !!aiBusy} aria-label="Rewrite with this instruction" className={clsx(PRIMARY_BTN, 'h-8 w-8 p-0')}>
                          <ArrowUp />
                        </button>
                      </form>
                    </div>
                  )}
                </section>

                <div className="grid gap-4 md:grid-cols-2">
                  {/* Visual */}
                  <section className={CARD}>
                    <div className={CARD_HEAD}><span>Visual</span></div>
                    <div className="relative aspect-square overflow-hidden rounded-xl bg-[var(--bg-alt)]">
                      {post.imageUrl ? (
                        <img src={post.imageUrl} alt="Post visual" className="h-full w-full object-cover" />
                      ) : (
                        <ImageIcon className="absolute inset-0 m-auto h-8 w-8 text-[var(--fg-subtle)]" aria-hidden />
                      )}
                      {loadingImage && (
                        <span className="absolute inset-0 grid place-items-center bg-black/45 text-sm font-semibold text-white">
                          <span className="inline-flex items-center gap-2"><Loader2 className="h-4 w-4 animate-spin" /> Creating a new visual…</span>
                        </span>
                      )}
                    </div>
                    {!isPublished && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <button type="button" className={CHIP} onClick={onGenerateImage} disabled={loadingImage}>
                          <RefreshCcw /> {post.imageUrl ? 'New image' : 'Create image'}
                        </button>
                        <button type="button" className={CHIP} onClick={() => photoInputRef.current?.click()}>
                          <Upload /> Upload photo
                        </button>
                        <button type="button" className={CHIP} onClick={() => setShowPrompt((v) => !v)} aria-expanded={showPrompt}>
                          <PencilLine /> Prompt <ChevronDown className={clsx('transition-transform', showPrompt && 'rotate-180')} />
                        </button>
                      </div>
                    )}
                    {showPrompt && (
                      <div className="mt-3">
                        <div className={FIELD}>
                          <textarea
                            rows={3}
                            value={post.imagePrompt}
                            onChange={(e) => setGeneratedContent({ ...post, imagePrompt: e.target.value })}
                            aria-label="Image prompt"
                            className="block w-full resize-y bg-transparent p-3 text-[13px] outline-none"
                          />
                        </div>
                        <span className="mt-1.5 block text-xs text-[var(--fg-muted)]">Describe the picture in English. “New image” uses this.</span>
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
                  </section>

                  {/* Score, start over, versions */}
                  <div className="space-y-4">
                    <section className={CARD}>
                      <div className={CARD_HEAD}>
                        <span>Virality score</span>
                        <span className="text-xs font-semibold text-[var(--primary)]">{scoreWord(score)}</span>
                      </div>
                      <div className="flex items-center gap-4">
                        <ScoreRing score={score} />
                        <p className="text-[13px] leading-relaxed text-[var(--fg-muted)]">{post.viralityReason || 'Kawayan’s AI rates how likely the caption is to get shared.'}</p>
                      </div>
                    </section>

                    {!isPublished && (
                      <section className={clsx(CARD, 'flex flex-wrap items-center justify-between gap-3')}>
                        <div className="text-[13px]">
                          <b className="block font-semibold">Start over</b>
                          <span className="text-[var(--fg-muted)]">New caption, score and visual from the same idea.</span>
                        </div>
                        <button
                          type="button"
                          className={CHIP}
                          onClick={() => {
                            setRedoing(true);
                            runGenerate();
                          }}
                          disabled={generatingPost || rewritesLeft === 0}
                        >
                          {redoing ? <Loader2 className="animate-spin" /> : <Zap />}
                          {rewritesLeft === 0 ? 'No rewrites left' : `New version · ${rewritesLeft} left`}
                        </button>
                      </section>
                    )}

                    {post.history?.length > 0 && (
                      <section className={CARD}>
                        <div className={CARD_HEAD}>
                          <span className="inline-flex items-center gap-1.5"><History className="h-4 w-4 text-[var(--fg-muted)]" /> Earlier versions</span>
                        </div>
                        <div className="space-y-2">
                          {post.history.map((v, i) => (
                            <div key={`${v.createdAt}-${i}`} className="rounded-xl bg-[var(--bg-alt)] p-3 text-[13px]">
                              <p className="line-clamp-3 text-[var(--fg-muted)]">{v.caption}</p>
                              <div className="mt-2 flex items-center justify-between">
                                {v.viralityScore != null && <span className="text-xs font-semibold">Score {v.viralityScore}</span>}
                                {!isPublished && (
                                  <button type="button" onClick={() => restoreVersion(i)} className="text-xs font-semibold text-[var(--primary)] hover:underline">Use this</button>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </section>
                    )}
                  </div>
                </div>
              </>
            )}

            <details className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 lg:hidden">
              <summary className="cursor-pointer text-[13px] font-semibold">Preview on Instagram, Facebook and TikTok</summary>
              <div className="mt-4">{preview}</div>
            </details>
          </div>

          <aside className="hidden min-h-0 flex-col items-center gap-3 overflow-y-auto border-l border-[var(--border)] bg-[var(--bg-alt)] px-6 py-5 lg:flex">
            <span className={clsx(LABEL, 'self-start')}>Live preview</span>
            {preview}
          </aside>
        </div>

        {/* ── Where + when, paired with publish ── */}
        <footer className="flex flex-wrap items-center gap-3 border-t border-[var(--border)] bg-[var(--card)] px-5 py-3 sm:px-6">
          <p className="hidden text-xs text-[var(--fg-muted)] md:block">
            {post ? 'Drafts save as you type.' : 'Draft the post, then pick where and when it goes out.'}
          </p>
          {isPublished ? (
            <div className="ml-auto flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--primary)]"><Check className="h-4 w-4" /> Published</span>
              {post?.externalLink && (
                <a className="btn btn-outline btn-sm" href={post.externalLink} target="_blank" rel="noreferrer">
                  View post <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ) : isScheduled ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-amber-700 dark:text-amber-300">
              <CalendarClock className="h-4 w-4" /> Scheduled for {longDate(post!.date)}
            </span>
          ) : (
            <div className="relative ml-auto flex items-stretch" ref={planRef}>
              <button
                type="button"
                onClick={() => setPlanOpen((v) => !v)}
                disabled={!post}
                aria-expanded={planOpen}
                aria-haspopup="dialog"
                className="flex items-center gap-2.5 rounded-l-full border border-r-0 border-[var(--border-strong)] bg-[var(--bg-alt)] py-1.5 pl-3 pr-3 text-left transition-colors hover:bg-[var(--card-hover)] disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex -space-x-1" aria-hidden>
                  {chosenAccounts.length > 0
                    ? chosenAccounts.map((a) => (
                        <span key={a.id} className="grid h-6 w-6 place-items-center rounded-full bg-[var(--card)] ring-2 ring-[var(--bg-alt)]">
                          <PlatformIcon platform={a.platform} />
                        </span>
                      ))
                    : <span className="grid h-6 w-6 place-items-center rounded-full bg-[var(--card)]"><Globe className="h-3.5 w-3.5 text-[var(--fg-muted)]" /></span>}
                </span>
                <span className="min-w-0">
                  <b className="block max-w-[180px] truncate text-[13px] font-semibold">{whereLabel}</b>
                  <small className="block text-[11px] text-[var(--fg-muted)]">{whenLabel}</small>
                </span>
                <ChevronDown className={clsx('h-4 w-4 text-[var(--fg-muted)] transition-transform', planOpen && 'rotate-180')} />
              </button>

              <button type="button" className={clsx(PRIMARY_BTN, 'rounded-l-none')} onClick={publish} disabled={ctaDisabled}>
                {publishing ? <Loader2 className="animate-spin" /> : mode === 'now' ? <Send /> : <CalendarClock />}
                {publishing ? 'Sending…' : ctaLabel}
                {!publishing && mode === 'schedule' && accounts?.length !== 0 && <ArrowUpRight />}
              </button>

              {planOpen && post && (
                <div
                  role="dialog"
                  aria-label="Where and when to post"
                  className="absolute bottom-[calc(100%+10px)] right-0 z-10 w-[min(92vw,360px)] space-y-4 rounded-2xl border border-[var(--border-strong)] bg-[var(--card)] p-4 shadow-xl"
                >
                  <div className="grid grid-cols-2 gap-1 rounded-full bg-[var(--bg-alt)] p-1" role="radiogroup" aria-label="When">
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
                          mode === value ? 'bg-[var(--card)] text-[var(--fg)] shadow-sm ring-1 ring-[var(--border-strong)]' : 'text-[var(--fg-muted)] hover:text-[var(--fg)]',
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" /> {label}
                      </button>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <span className={LABEL}>Post to</span>
                    {accounts === null ? (
                      <span className="flex items-center gap-1.5 text-xs text-[var(--fg-muted)]"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading your pages…</span>
                    ) : accounts.length === 0 ? (
                      <div className="space-y-2 text-[13px] text-[var(--fg-muted)]">
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
                                'flex w-full items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-[13px] transition-colors',
                                on ? 'border-brand/50 bg-brand/10' : 'border-[var(--border)] hover:border-[var(--border-strong)]',
                              )}
                            >
                              <PlatformIcon platform={a.platform} className="h-4 w-4" />
                              <span className="flex-1 font-medium">@{a.username}</span>
                              {!a.isActive && <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-300">Needs reconnecting</span>}
                              <span className={clsx('grid h-4 w-4 place-items-center rounded border', on ? 'border-transparent bg-brand text-on-brand' : 'border-[var(--border-strong)]')}>
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
                                time === s.time ? 'border-brand/60 bg-brand/10' : 'border-[var(--border)] hover:border-[var(--border-strong)]',
                              )}
                            >
                              <b className="block text-[13px] font-semibold">{to12h(s.time)}</b>
                              <small className="block text-[11px] text-[var(--fg-muted)]">{past ? 'Passed' : s.label}</small>
                              {s.best && !past && (
                                <em className="absolute right-1.5 top-1.5 rounded-full bg-brand px-1.5 text-[9.5px] font-bold not-italic text-on-brand">Best</em>
                              )}
                            </button>
                          );
                        })}
                      </div>
                      <label className="flex items-center gap-2 text-[13px] text-[var(--fg-muted)]">
                        <Clock className="h-4 w-4" /> Other time
                        <input
                          type="time"
                          value={time}
                          onChange={(e) => e.target.value && setTime(e.target.value)}
                          className="ml-auto rounded-lg border border-[var(--border)] bg-[var(--bg-alt)] px-2 py-1 text-[var(--fg)] outline-none focus:border-brand"
                        />
                      </label>
                      {!timeOk && <p className="text-xs font-semibold text-[var(--danger)]">That time has passed. Pick a later one.</p>}
                      <p className="text-xs text-[var(--fg-subtle)]">Suggested times are when Filipino audiences are usually online. All times are in your local time zone.</p>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--fg-muted)]">Goes out as soon as you press Post now.</p>
                  )}
                  {!canSchedule && <p className="text-xs text-[var(--fg-muted)]">This day has passed, so the post can only go out now.</p>}
                </div>
              )}
            </div>
          )}
        </footer>
      </div>
    </div>
  );
};

export default PostComposer;
