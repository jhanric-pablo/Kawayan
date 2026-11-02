import React, { useEffect, useRef, useState } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost, PostVersion } from '../../types';
import type { SocialAccount } from '../../services/socialService';
import type { CaptionRewrite } from '../../services/aiService';
import {
  X, RefreshCcw, Loader2, Upload, Image as ImageIcon, Send, Facebook, Instagram, Scissors, Smile, Briefcase, Megaphone,
  Languages, Hash, ArrowUp, ArrowUpRight, Undo2, Check, ChevronDown, CalendarClock, Zap, ExternalLink, PencilLine,
  CircleAlert, Clock, Globe, AudioLines, Sparkles,
} from 'lucide-react';
import TextareaAutosize from 'react-textarea-autosize';
import clsx from 'clsx';
import { m } from 'motion/react';
import FormatPicker, { PostFormat } from './FormatPicker';
import PhonePreview from './PhonePreview';
import { StatusBadge } from './TimelinePostCard';
import { normalizeFormat } from '../../services/validationService';
import { useFocusTrap } from '../../utils/useFocusTrap';

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

type StepState = 'active' | 'done' | 'locked';

/** One of the studio's three steps (Idea, Caption, Image): a numbered header, then its tools. */
const Step: React.FC<{ n: number; title: string; state: StepState; summary?: React.ReactNode; action?: React.ReactNode; children?: React.ReactNode }> = ({
  n, title, state, summary, action, children,
}) => (
  <section className={clsx('rounded-xl border bg-(--card)', state === 'locked' ? 'border-dashed border-(--border)' : 'border-(--border)')}>
    <div className="flex items-center gap-3 px-4 py-3">
      <span
        className={clsx(
          'mono grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-medium',
          state === 'done' ? 'bg-(--green) text-(--green-fg)' : state === 'active' ? 'bg-(--fg) text-(--bg)' : 'bg-(--muted) text-(--fg-muted)',
        )}
      >
        {state === 'done' ? <Check className="h-3.5 w-3.5" strokeWidth={3} aria-hidden /> : n}
      </span>
      <h3 className={clsx('shrink-0 text-ui font-semibold', state === 'locked' && 'text-(--fg-subtle)')}>{title}</h3>
      {summary && <span className="min-w-0 truncate text-xs text-(--fg-muted)">{summary}</span>}
      {action && <span className="ml-auto shrink-0">{action}</span>}
    </div>
    {children && (
      // Unfolds when a step opens (e.g. once the AI has written the caption).
      <m.div
        initial={{ y: -4, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.24, ease: [0.2, 0.8, 0.2, 1] }}
        className="overflow-hidden"
      >
        <div className="border-t border-(--border) px-4 py-4">{children}</div>
      </m.div>
    )}
  </section>
);

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
            'flex items-center gap-2.5 text-ui transition-colors',
            i < step ? 'text-(--fg-muted)' : i === step ? 'font-semibold text-(--fg)' : 'text-(--fg-subtle)',
          )}
        >
          <span
            className={clsx(
              'grid h-5 w-5 place-items-center rounded-full border',
              i < step ? 'border-transparent bg-(--green) text-(--green-fg)' : i === step ? 'border-(--fg) text-(--fg)' : 'border-(--border-strong)',
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
                    {!limitReached && <FormatPicker value={format} onChange={setFormat} disabled={generatingPost} />}
                    <button
                      type="submit"
                      disabled={brief.trim().length < 3 || generatingPost || extraBusy}
                      className={clsx(PRIMARY_BTN, 'ml-auto')}
                    >
                      {generatingPost || extraBusy ? <Loader2 className="animate-spin" /> : <Sparkles />}
                      {limitReached ? (extraBusy ? 'Paying…' : `Pay ₱${addOnPrice} and draft it`) : generatingPost ? 'Drafting…' : 'Draft with AI'}
                      <span className="ml-1 hidden gap-0.5 opacity-70 sm:inline-flex" aria-hidden>
                        <kbd className="rounded border border-white/30 px-1 font-sans text-xs">{MOD_KEY}</kbd>
                        <kbd className="rounded border border-white/30 px-1 font-sans text-xs">↵</kbd>
                      </span>
                    </button>
                  </div>
                  {generatingPost ? (
                    <GeneratingSteps />
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
                      <img src={post.imageUrl} alt="Post visual" className="h-full w-full object-cover" />
                    ) : (
                      <ImageIcon className="absolute inset-0 m-auto h-7 w-7 text-(--fg-subtle)" aria-hidden />
                    )}
                    {loadingImage && (
                      <span className="absolute inset-0 grid place-items-center bg-black/45 text-white">
                        <Loader2 className="h-5 w-5 animate-spin" aria-label="Creating a new image" />
                      </span>
                    )}
                  </div>
                  {!isPublished && (
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap gap-1.5">
                        <button type="button" className={CHIP} onClick={onGenerateImage} disabled={loadingImage}>
                          <RefreshCcw /> {post.imageUrl ? 'Try another image' : 'Create image'}
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
                    <span className="mt-1.5 block text-xs text-(--fg-muted)">Describe the picture in English. “Try another image” uses this.</span>
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
                {post.imageUrl ? <img src={post.imageUrl} alt="Post visual" className="h-full w-full object-cover" /> : <ImageIcon className="absolute inset-0 m-auto h-8 w-8 text-(--fg-muted)" aria-hidden />}
                {loadingImage && (
                  <span className="absolute inset-0 grid place-items-center bg-black/45 text-white"><Loader2 className="h-6 w-6 animate-spin" aria-label="Creating a new image" /></span>
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
                      <button type="button" className="btn btn-outline btn-sm flex-1" onClick={onGenerateImage} disabled={loadingImage}><RefreshCcw className="h-4 w-4" /> New image</button>
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
        {/* ── Header ── */}
        <header className="flex items-start gap-3 border-b border-(--border) bg-(--card) px-5 py-4 sm:px-6">
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-lg font-semibold leading-snug" title={heading}>{heading}</h2>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-(--fg-muted)">
              {post ? (
                <StatusBadge status={isPublished ? 'published' : isScheduled ? 'scheduled' : 'draft'} />
              ) : (
                <span className="badge badge-dashed">New</span>
              )}
              <span className="font-semibold text-(--fg)">{dateLabel}</span>
              {currentIdea && !post && <span>From your {monthName} plan</span>}
              {post?.format && <span>{normalizeFormat(post.format)} post</span>}
              {profile.brandVoice && (
                <span className="inline-flex items-center gap-1" title={profile.targetAudience ? `Written for ${profile.targetAudience}` : undefined}>
                  <AudioLines className="h-3.5 w-3.5 text-(--primary)" aria-hidden />
                  Tuned to: <b className="font-semibold text-(--fg)">{profile.brandVoice}</b>
                </span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close composer"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-md text-(--fg-muted) transition-colors hover:bg-(--bg-alt) hover:text-(--fg)"
          >
            <X className="h-5 w-5" />
          </button>
        </header>

        {/* ── Body: three steps | phone ── */}
        <div className="grid min-h-0 flex-1 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-h-0 space-y-3 overflow-y-auto bg-(--bg) px-5 py-5 sm:px-6">
            {isPublished && post && (
              <p className="flex flex-wrap items-center gap-2 rounded-lg border border-(--green) bg-(--green-soft) px-4 py-2.5 text-ui text-(--fg)">
                <Check className="h-4 w-4 text-(--primary)" /> This post is live, so editing is turned off.
                {post.externalLink && (
                  <a href={post.externalLink} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-medium text-(--fg) underline underline-offset-2 hover:text-(--green-ink)">
                    View post <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                )}
              </p>
            )}
            {isScheduled && post && (
              <p className="flex items-center gap-2 rounded-lg border border-transparent bg-(--amber-soft) px-4 py-2.5 text-ui text-(--amber)">
                <Clock className="h-4 w-4 shrink-0" /> Scheduled for {longDate(post.date)}. Edits here don’t change the copy already queued.
              </p>
            )}

            {/* 1 · Idea */}
            {!post ? (
              <Step n={1} title={limitReached ? `You’ve used all ${planPostCount} posts for ${monthName}` : 'What should this post say?'} state="active">
                {briefForm}
              </Step>
            ) : (
              <Step
                n={1}
                title="Idea"
                state="done"
                summary={`${post.topic}${post.format ? ` · ${normalizeFormat(post.format)}` : ''}`}
                action={
                  !isPublished && (
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
                  )
                }
              />
            )}

            {/* 2 · Caption */}
            {!post ? (
              <Step n={2} title="Caption" state="locked" summary="Kawayan writes this from your idea." />
            ) : (
              <Step
                n={2}
                title="Caption"
                state="done"
                action={
                  counts && (
                    <span className={clsx('text-xs tabular-nums', counts.chars > IG_CAPTION_LIMIT ? 'text-(--danger)' : 'text-(--fg-subtle)')}>
                      {counts.chars.toLocaleString()} / {IG_CAPTION_LIMIT.toLocaleString()} · {counts.tags} hashtag{counts.tags === 1 ? '' : 's'}
                    </span>
                  )
                }
              >
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
                              <button type="button" onClick={() => restoreVersion(i)} className="text-xs font-medium text-(--fg) underline underline-offset-2 hover:text-(--green-ink)">Use this</button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </details>
                )}
              </Step>
            )}

            {/* 3 · Image */}
            {!post ? (
              <Step n={3} title="Image" state="locked" summary="Made to match the caption, or upload your own photo." />
            ) : (
              <Step n={3} title="Image" state={post.imageUrl ? 'done' : 'active'}>
                {imageTools}
              </Step>
            )}

            <details className="rounded-xl border border-(--border) bg-(--card) p-4 lg:hidden">
              <summary className="cursor-pointer text-ui font-semibold">Preview on Facebook and Instagram</summary>
              <div className="mt-4 flex justify-center">{preview}</div>
            </details>
          </div>

          <aside className="hidden min-h-0 flex-col items-center overflow-y-auto border-l border-(--border) bg-(--bg-alt) px-5 py-5 lg:flex">
            {preview}
            <p className="mt-3 text-center text-xs text-(--fg-subtle)">Preview only. Reactions show up after it posts.</p>
          </aside>
        </div>

        {/* ── Where + when, paired with publish ── */}
        <footer className="flex flex-wrap items-center gap-3 border-t border-(--border) bg-(--card) px-5 py-3 sm:px-6">
          <p className="text-xs text-(--fg-muted)">
            {post ? saveIndicator : 'Draft the post first, then pick where and when it goes out.'}
          </p>
          {isPublished ? (
            <div className="ml-auto flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-(--primary)"><Check className="h-4 w-4" /> Published</span>
              {post?.externalLink && (
                <a className="btn btn-outline btn-sm" href={post.externalLink} target="_blank" rel="noreferrer">
                  View post <ExternalLink className="h-3.5 w-3.5" />
                </a>
              )}
            </div>
          ) : isScheduled ? (
            <span className="ml-auto inline-flex items-center gap-1.5 text-sm font-semibold text-(--amber)">
              <CalendarClock className="h-4 w-4" /> Scheduled for {longDate(post!.date)}
            </span>
          ) : accounts && accounts.length === 0 ? (
            <div className="ml-auto flex flex-wrap items-center gap-3">
              <span className="text-xs text-(--fg-muted)">{post ? 'Connect a page to publish. Your draft is saved.' : 'Connect a page to publish.'}</span>
              <button type="button" className="btn btn-glass btn-sm" onClick={onOpenSocial}>Connect a page</button>
            </div>
          ) : !post ? null : (
            <div className="relative ml-auto flex items-stretch" ref={planRef}>
              <button
                type="button"
                onClick={() => setPlanOpen((v) => !v)}
                disabled={!post}
                aria-expanded={planOpen}
                aria-haspopup="dialog"
                className="flex items-center gap-2.5 rounded-l-lg border border-r-0 border-(--border-strong) bg-(--bg-alt) py-1.5 pl-3 pr-3 text-left transition-colors hover:bg-(--card-hover) disabled:cursor-not-allowed disabled:opacity-60"
              >
                <span className="flex -space-x-1" aria-hidden>
                  {chosenAccounts.length > 0
                    ? chosenAccounts.map((a) => (
                        <span key={a.id} className="grid h-6 w-6 place-items-center rounded-full bg-(--card) ring-2 ring-(--bg-alt)">
                          <PlatformIcon platform={a.platform} />
                        </span>
                      ))
                    : <span className="grid h-6 w-6 place-items-center rounded-full bg-(--card)"><Globe className="h-3.5 w-3.5 text-(--fg-muted)" /></span>}
                </span>
                <span className="min-w-0">
                  <b className="block max-w-[180px] truncate text-ui font-semibold">{whereLabel}</b>
                  <small className="block text-xs text-(--fg-muted)">{whenLabel}</small>
                </span>
                <ChevronDown className={clsx('h-4 w-4 text-(--fg-muted) transition-transform', planOpen && 'rotate-180')} />
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
                  className="absolute bottom-[calc(100%+10px)] right-0 z-10 w-[min(92vw,360px)] space-y-4 rounded-xl border border-(--border) bg-(--card) p-4 shadow-lg"
                >
                  {whereWhen}
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
