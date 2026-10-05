import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost, PostVersion } from '../../types';
import type { SocialAccount } from '../../services/socialService';
import type { CaptionRewrite } from '../../services/aiService';
import {
  X, Wand2, RefreshCcw, Loader2, Upload, Image as ImageIcon, Sparkles, Heart, MessageCircle, Send, MoreHorizontal,
  Plus, ThumbsUp, Globe, Bookmark, Music2, Facebook, Instagram, Share2, Scissors, Smile, Briefcase, Megaphone,
  Languages, Hash, ArrowUp, Undo2, Check, ChevronDown, CalendarClock, Zap, ExternalLink, PencilLine, CircleAlert,
  History, Clock,
} from 'lucide-react';
import './postComposer.css';
import './kawayanCalendar.css';
import './studio.css';

type PreviewPlatform = 'instagram' | 'facebook' | 'tiktok';

const TikTokGlyph: React.FC<{ className?: string }> = ({ className }) => (
  <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
  </svg>
);

const PREVIEW_PLATFORMS: { id: PreviewPlatform; label: string; Icon: React.ComponentType<{ className?: string }> }[] = [
  { id: 'instagram', label: 'Instagram', Icon: Instagram },
  { id: 'facebook', label: 'Facebook', Icon: Facebook },
  { id: 'tiktok', label: 'TikTok', Icon: TikTokGlyph },
];

const PreviewTabs: React.FC<{ value: PreviewPlatform; onChange: (p: PreviewPlatform) => void }> = ({ value, onChange }) => (
  <div className="kw-pv-tabs" role="tablist" aria-label="Preview platform">
    {PREVIEW_PLATFORMS.map((p) => (
      <button
        key={p.id}
        type="button"
        role="tab"
        aria-selected={value === p.id}
        className={`kw-pv-tabs__btn kw-pv-tabs__btn--${p.id}${value === p.id ? ' is-active' : ''}`}
        onClick={() => onChange(p.id)}
      >
        <p.Icon className="w-3.5 h-3.5" />
        <span>{p.label}</span>
      </button>
    ))}
  </div>
);

/** Read-only, platform-accurate mock of the post as it would appear on the network. */
const PostPreview: React.FC<{
  platform: PreviewPlatform;
  businessName: string;
  initials: string;
  caption?: string;
  imageUrl?: string;
  likes: number;
  loadingImage: boolean;
}> = ({ platform, businessName, initials, caption, imageUrl, likes, loadingImage }) => {
  const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : `${n}`);
  const comments = Math.max(1, Math.round(likes / 12));
  const shares = Math.max(1, Math.round(likes / 30));
  const handle = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourbusiness';

  const media = (
    <div className="kw-pv__media">
      {imageUrl ? (
        <>
          <img key={imageUrl} src={imageUrl} alt="Post visual" />
          {loadingImage && (
            <div className="kw-pv__media-load">
              <Loader2 className="w-7 h-7 animate-spin text-white" />
            </div>
          )}
        </>
      ) : (
        <div className="kw-pv__media-empty">
          <ImageIcon className="w-7 h-7" />
          <span>Visual appears here</span>
        </div>
      )}
    </div>
  );

  const captionNode = caption ? <>{caption}</> : <span className="kw-pv__ph">Your caption will show here…</span>;

  if (platform === 'facebook') {
    return (
      <div className="kw-pv kw-pv--fb">
        <div className="kw-pv-fb__head">
          <span className="kw-pv-fb__avatar">{initials}</span>
          <div className="kw-pv-fb__meta">
            <span className="kw-pv-fb__name">{businessName}</span>
            <span className="kw-pv-fb__sub">Just now · <Globe className="w-3 h-3" /></span>
          </div>
          <MoreHorizontal className="w-4 h-4" />
        </div>
        <p className="kw-pv-fb__caption">{captionNode}</p>
        {media}
        <div className="kw-pv-fb__stats">
          <span className="kw-pv-fb__reacts">
            <span className="kw-pv-fb__r kw-pv-fb__r--like"><ThumbsUp className="w-2.5 h-2.5" /></span>
            <span className="kw-pv-fb__r kw-pv-fb__r--love"><Heart className="w-2.5 h-2.5" /></span>
            <span className="kw-pv-fb__rc">{fmt(likes)}</span>
          </span>
          <span>{fmt(comments)} comments · {fmt(shares)} shares</span>
        </div>
        <div className="kw-pv-fb__bar">
          <button type="button"><ThumbsUp className="w-4 h-4" /> Like</button>
          <button type="button"><MessageCircle className="w-4 h-4" /> Comment</button>
          <button type="button"><Share2 className="w-4 h-4" /> Share</button>
        </div>
      </div>
    );
  }

  if (platform === 'tiktok') {
    return (
      <div className="kw-pv kw-pv--tt">
        {media}
        <div className="kw-pv-tt__scrim" />
        <div className="kw-pv-tt__rail">
          <span className="kw-pv-tt__avatar">{initials}<span className="kw-pv-tt__plus">+</span></span>
          <span className="kw-pv-tt__act"><Heart className="w-7 h-7" /><b>{fmt(likes)}</b></span>
          <span className="kw-pv-tt__act"><MessageCircle className="w-7 h-7" /><b>{fmt(comments)}</b></span>
          <span className="kw-pv-tt__act"><Bookmark className="w-7 h-7" /><b>{fmt(Math.round(likes / 6))}</b></span>
          <span className="kw-pv-tt__act"><Share2 className="w-7 h-7" /><b>{fmt(shares)}</b></span>
          <span className="kw-pv-tt__disc">{initials}</span>
        </div>
        <div className="kw-pv-tt__info">
          <p className="kw-pv-tt__name">@{handle}</p>
          <p className="kw-pv-tt__caption">{captionNode}</p>
          <p className="kw-pv-tt__music"><Music2 className="w-3.5 h-3.5" /> original sound — {businessName}</p>
        </div>
      </div>
    );
  }

  // Instagram
  return (
    <div className="kw-pv kw-pv--ig">
      <div className="kw-pv-ig__head">
        <span className="kw-pv-ig__ring"><span className="kw-pv-ig__avatar">{initials}</span></span>
        <div className="kw-pv-ig__meta">
          <span className="kw-pv-ig__name">{handle}</span>
        </div>
        <MoreHorizontal className="w-4 h-4" />
      </div>
      {media}
      <div className="kw-pv-ig__actions">
        <Heart className="w-6 h-6" />
        <MessageCircle className="w-6 h-6" />
        <Send className="w-6 h-6" />
        <Bookmark className="w-6 h-6 kw-pv-ig__save" />
      </div>
      <div className="kw-pv-ig__body">
        <p className="kw-pv-ig__likes">{fmt(likes)} likes</p>
        <p className="kw-pv-ig__caption">
          <span className="kw-pv-ig__name">{handle}</span> {captionNode}
        </p>
        <p className="kw-pv-ig__more">View all {fmt(comments)} comments</p>
        <p className="kw-pv-ig__time">Just now</p>
      </div>
    </div>
  );
};

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
  return (
    <div className={`ps-ring ps-ring--${score >= 75 ? 'high' : score >= 50 ? 'mid' : 'low'}`}>
      <svg viewBox="0 0 64 64" aria-hidden>
        <circle cx="32" cy="32" r={r} className="ps-ring__track" />
        <circle cx="32" cy="32" r={r} className="ps-ring__fill" strokeDasharray={c} strokeDashoffset={c * (1 - score / 100)} />
      </svg>
      <span className="ps-ring__num">{score}</span>
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
    <ol className="ps-steps" aria-live="polite">
      {steps.map((s, i) => (
        <li key={s} className={i < step ? 'is-done' : i === step ? 'is-active' : ''}>
          <span className="ps-steps__dot">{i < step ? <Check /> : i === step ? <Loader2 className="animate-spin" /> : null}</span>
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
 * Left: the caption with an AI co-writer (one-tap edits, free-text asks, undo, re-scoring),
 * the visual, the score and earlier versions. Right: a live platform preview. Bottom: the
 * publish bar, where a "where and when" popover picks pages and a suggested time.
 * Drafts save themselves; every network/AI call is delegated to ContentCalendar.
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
  photoInputRef: React.RefObject<HTMLInputElement | null>;
  accounts: SocialAccount[] | null;
  accountsError: string;
  publishing: boolean;
  onClose: () => void;
  onGeneratePost: (idea: ContentIdea) => void;
  onAddOn: (day: number) => void;
  onGenerateImage: () => void;
  onRewriteCaption: (caption: string, instruction: string) => Promise<CaptionRewrite | null>;
  onAutosave: (post: GeneratedPost) => Promise<void>;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPublish: (accountIds: string[], scheduledFor?: string) => Promise<void>;
  onOpenSocial: () => void;
}

const STATUS_STYLE: Record<string, string> = {
  Draft: 'kw-chip-status kw-chip-status--draft',
  Scheduled: 'kw-chip-status kw-chip-status--scheduled',
  Published: 'kw-chip-status kw-chip-status--published',
  New: 'kw-chip-status kw-chip-status--idea',
};

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
  photoInputRef,
  accounts,
  accountsError,
  publishing,
  onClose,
  onGeneratePost,
  onAddOn,
  onGenerateImage,
  onRewriteCaption,
  onAutosave,
  onPhotoUpload,
  onPublish,
  onOpenSocial,
}) => {
  const [previewPlatform, setPreviewPlatform] = useState<PreviewPlatform>('instagram');
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
  const dialogRef = useRef<HTMLDivElement>(null);
  const planRef = useRef<HTMLDivElement>(null);

  const fakeLikes = useMemo(() => Math.floor(Math.random() * 500) + 10, [post?.id]);

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

  useEffect(() => {
    if (accounts) setChosen(accounts.map((a) => a.id));
  }, [accounts]);

  useEffect(() => {
    if (!generatingPost) setRedoing(false);
  }, [generatingPost]);

  if (!open || selectedDay == null) return null;

  const currentPost = posts.find((p) => new Date(p.date).getDate() === selectedDay);
  const currentIdea = ideas.find((i) => i.day === selectedDay);
  const heading = post?.topic || currentPost?.topic || currentIdea?.title || 'New post';
  const dateLabel = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay).toLocaleDateString('en-PH', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const statusLabel = post?.status || 'New';
  const isPublished = post?.status === 'Published';
  const isScheduled = post?.status === 'Scheduled';
  const initials = profile.businessName.substring(0, 2).toUpperCase();
  const rewritesLeft = Math.max(0, MAX_REWRITES - (post?.regenCount || 0));

  const runGenerate = () => {
    onGeneratePost(currentIdea || { day: selectedDay, title: 'Custom Post', topic: 'General Update', format: 'Image' });
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
    accounts === null ? 'Loading pages…' : accounts.length === 0 ? 'No pages connected' : chosenAccounts.length === 0 ? 'No page picked' : chosenAccounts.map((a) => (a.platform === 'facebook' ? 'Facebook' : 'Instagram')).join(' + ');
  const whenLabel = mode === 'now' ? 'Right away' : post ? `${longDate(post.date)} · ${to12h(time)}` : '';

  const publish = () => {
    if (!post) return;
    if (accounts && accounts.length === 0) return onOpenSocial();
    setPlanOpen(false);
    onPublish(chosen, mode === 'schedule' ? `${post.date}T${time}:00` : undefined);
  };

  const ctaDisabled = !post || publishing || accounts === null || (accounts.length > 0 && (chosen.length === 0 || !timeOk));
  const ctaLabel =
    accounts && accounts.length === 0 ? 'Connect a page' : mode === 'now' ? 'Post now' : `Schedule · ${to12h(time)}`;

  const busyLabel = aiBusy ? `Rewriting: ${aiBusy}` : redoing && generatingPost ? 'Writing a new version…' : null;
  const counts = post ? { chars: [...post.caption].length, tags: (post.caption.match(/#[\p{L}\p{N}_]+/gu) || []).length } : null;
  const score = post?.viralityScore ?? 0;

  /* ── Pieces ── */
  const previewBlock = (
    <>
      <PreviewTabs value={previewPlatform} onChange={setPreviewPlatform} />
      <PostPreview
        platform={previewPlatform}
        businessName={profile.businessName}
        initials={initials}
        caption={post?.caption}
        imageUrl={post?.imageUrl}
        likes={fakeLikes}
        loadingImage={loadingImage}
      />
    </>
  );

  const saveIndicator = post && (
    <span className={`ps-save ps-save--${saveState}`} aria-live="polite">
      {saveState === 'saved' && <><Check /> Saved</>}
      {saveState === 'saving' && <><Loader2 className="animate-spin" /> Saving…</>}
      {saveState === 'dirty' && <><i /> Unsaved changes</>}
      {saveState === 'error' && (
        <>
          <CircleAlert /> Couldn’t save
          <button type="button" onClick={save}>Retry</button>
        </>
      )}
    </span>
  );

  return (
    <div className="kw-composer-overlay" role="presentation">
      <div className="kw-composer-backdrop" onClick={close} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Compose post for ${dateLabel}`}
        tabIndex={-1}
        className="kw-composer ps"
      >
        {/* ── Header ── */}
        <header className="ps-head">
          <span className="ps-head__date">{dateLabel}</span>
          <div className="ps-head__title">
            <h2 title={heading}>{heading}</h2>
            <div className="ps-head__meta">
              <span className={STATUS_STYLE[statusLabel] || STATUS_STYLE.New}>{statusLabel}</span>
              {post?.format && <span className="ps-head__format">{post.format} post</span>}
              {saveIndicator}
            </div>
          </div>
          <button type="button" onClick={close} aria-label="Close composer" className="kw-composer__close">
            <X className="w-5 h-5" />
          </button>
        </header>

        {/* ── Body ── */}
        <div className="ps-body">
          <div className="ps-main">
            {!post ? (
              <div className="ps-start">
                {generatingPost ? (
                  <>
                    <span className="ps-start__icon is-busy"><Sparkles /></span>
                    <h3>Kawayan is drafting your post</h3>
                    <p>This takes about 20 seconds.</p>
                    <GeneratingSteps />
                  </>
                ) : (
                  <>
                    <span className="ps-start__icon"><Sparkles /></span>
                    <h3>{currentIdea ? 'Ready when you are' : 'Nothing planned for this day yet'}</h3>
                    {currentIdea ? (
                      <div className="ps-brief">
                        <span className="ps-brief__k">From your monthly plan</span>
                        <b>{currentIdea.title}</b>
                        <p>{currentIdea.topic}</p>
                        <span className="ps-brief__tag">{currentIdea.format} post</span>
                      </div>
                    ) : (
                      <p>Kawayan can write a Taglish caption and make a matching visual for this day.</p>
                    )}
                    <button type="button" onClick={runGenerate} className="ps-start__cta">
                      <Wand2 className="w-4 h-4" /> Write it with AI
                    </button>
                    <span className="ps-start__note">Caption, virality score and visual in one go.</span>
                    <button type="button" onClick={() => onAddOn(selectedDay)} className="ps-start__addon">
                      <Plus className="w-3.5 h-3.5" /> Or buy a single extra post · ₱{addOnPrice}
                    </button>
                  </>
                )}
              </div>
            ) : (
              <>
                {isPublished && (
                  <p className="ps-note ps-note--live">
                    <Check /> This post is live, so editing is turned off.
                    {post.externalLink && (
                      <a href={post.externalLink} target="_blank" rel="noreferrer">View post <ExternalLink /></a>
                    )}
                  </p>
                )}
                {isScheduled && (
                  <p className="ps-note">
                    <Clock /> Scheduled for {longDate(post.date)}. Edits here don’t change the copy already queued.
                  </p>
                )}

                {/* Caption + AI co-writer */}
                <section className={`ps-card ps-caption${busyLabel ? ' is-busy' : ''}`}>
                  <div className="ps-card__head">
                    <label htmlFor="ps-caption-text">Caption</label>
                    {counts && (
                      <span className={`ps-count${counts.chars > IG_CAPTION_LIMIT ? ' is-over' : ''}`}>
                        {counts.chars.toLocaleString()} / {IG_CAPTION_LIMIT.toLocaleString()} · {counts.tags} hashtag{counts.tags === 1 ? '' : 's'}
                      </span>
                    )}
                  </div>
                  <div className="ps-caption__field">
                    <textarea
                      id="ps-caption-text"
                      rows={7}
                      value={post.caption}
                      readOnly={isPublished || !!busyLabel}
                      onChange={(e) => setGeneratedContent({ ...post, caption: e.target.value })}
                      placeholder="Write your Taglish caption…"
                    />
                    {busyLabel && (
                      <div className="ps-caption__busy" aria-live="polite">
                        <Sparkles /> {busyLabel}
                      </div>
                    )}
                  </div>

                  {lastEdit && !busyLabel && (
                    <div className="ps-change">
                      <Check className="ps-change__ok" />
                      <span>{lastEdit.label}</span>
                      {lastEdit.delta != null && lastEdit.delta !== 0 && (
                        <span className={`ps-change__delta ${lastEdit.delta > 0 ? 'is-up' : 'is-down'}`}>
                          Score {lastEdit.delta > 0 ? '+' : '−'}{Math.abs(lastEdit.delta)}
                        </span>
                      )}
                      {undoStack.length > 0 && (
                        <button type="button" onClick={undo} className="ps-change__undo">
                          <Undo2 /> Undo
                        </button>
                      )}
                    </div>
                  )}

                  {!isPublished && (
                    <div className="ps-ai">
                      <div className="ps-ai__chips" role="group" aria-label="Quick AI edits">
                        {QUICK_EDITS.map(({ label, Icon, instruction }) => (
                          <button key={label} type="button" disabled={!!aiBusy} onClick={() => runEdit(label, instruction)}>
                            {aiBusy === label ? <Loader2 className="animate-spin" /> : <Icon />} {label}
                          </button>
                        ))}
                      </div>
                      <form className="ps-ai__ask" onSubmit={submitAsk}>
                        <Sparkles aria-hidden />
                        <input
                          value={ask}
                          onChange={(e) => setAsk(e.target.value)}
                          maxLength={200}
                          disabled={!!aiBusy}
                          placeholder="Tell Kawayan what to change, e.g. “mention our 20% weekend promo”"
                          aria-label="Tell Kawayan what to change"
                        />
                        <button type="submit" disabled={!ask.trim() || !!aiBusy} aria-label="Rewrite with this instruction">
                          <ArrowUp />
                        </button>
                      </form>
                    </div>
                  )}
                </section>

                <div className="ps-row">
                  {/* Visual */}
                  <section className="ps-card ps-visual">
                    <div className="ps-card__head">
                      <span>Visual</span>
                    </div>
                    <div className={`ps-visual__frame${loadingImage ? ' is-busy' : ''}`}>
                      {post.imageUrl ? <img src={post.imageUrl} alt="Post visual" /> : <ImageIcon className="ps-visual__empty" />}
                      {loadingImage && <span className="ps-visual__busy"><Loader2 className="animate-spin" /> Creating a new visual…</span>}
                    </div>
                    {!isPublished && (
                      <div className="ps-visual__actions">
                        <button type="button" onClick={onGenerateImage} disabled={loadingImage}>
                          <RefreshCcw /> {post.imageUrl ? 'New image' : 'Create image'}
                        </button>
                        <button type="button" onClick={() => photoInputRef.current?.click()}>
                          <Upload /> Upload photo
                        </button>
                        <button type="button" onClick={() => setShowPrompt((v) => !v)} aria-expanded={showPrompt}>
                          <PencilLine /> Prompt <ChevronDown className={showPrompt ? 'is-flipped' : ''} />
                        </button>
                      </div>
                    )}
                    {showPrompt && (
                      <div className="ps-visual__prompt">
                        <textarea
                          rows={3}
                          value={post.imagePrompt}
                          onChange={(e) => setGeneratedContent({ ...post, imagePrompt: e.target.value })}
                          aria-label="Image prompt"
                        />
                        <span>Describe the picture in English. “New image” uses this.</span>
                      </div>
                    )}
                    <input ref={photoInputRef} type="file" accept=".jpg,.jpeg,.png,.webp" className="hidden" onChange={onPhotoUpload} />
                  </section>

                  {/* Score + versions */}
                  <div className="ps-side">
                    <section className="ps-card ps-score">
                      <div className="ps-card__head">
                        <span>Virality score</span>
                        <span className="ps-score__word">{scoreWord(score)}</span>
                      </div>
                      <div className="ps-score__body">
                        <ScoreRing score={score} />
                        <p>{post.viralityReason || 'Kawayan’s AI rates how likely the caption is to get shared.'}</p>
                      </div>
                    </section>

                    {!isPublished && (
                      <section className="ps-card ps-redo">
                        <div>
                          <b>Start over</b>
                          <span>New caption, score and visual from the same idea.</span>
                        </div>
                        <button
                          type="button"
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
                      <section className="ps-card ps-versions">
                        <div className="ps-card__head">
                          <span><History /> Earlier versions</span>
                        </div>
                        {post.history.map((v, i) => (
                          <div key={`${v.createdAt}-${i}`} className="ps-version">
                            <p>{v.caption}</p>
                            <div>
                              {v.viralityScore != null && <span className="ps-version__score">{v.viralityScore}</span>}
                              {!isPublished && (
                                <button type="button" onClick={() => restoreVersion(i)}>Use this</button>
                              )}
                            </div>
                          </div>
                        ))}
                      </section>
                    )}
                  </div>
                </div>

                <details className="ps-mpreview">
                  <summary>Preview on Instagram, Facebook and TikTok</summary>
                  {previewBlock}
                </details>
              </>
            )}
          </div>

          <aside className="ps-rail">
            <span className="ps-rail__label">Live preview</span>
            {previewBlock}
          </aside>
        </div>

        {/* ── Publish bar ── */}
        <footer className="ps-foot">
          {isPublished ? (
            <div className="ps-foot__state">
              <span className="ps-foot__live"><Check /> Published</span>
              {post?.externalLink && (
                <a className="btn btn-outline btn-sm" href={post.externalLink} target="_blank" rel="noreferrer">
                  View post <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          ) : isScheduled ? (
            <div className="ps-foot__state">
              <span className="ps-foot__queued"><CalendarClock /> Scheduled for {longDate(post!.date)}</span>
            </div>
          ) : (
            <div className="ps-foot__publish" ref={planRef}>
              <button
                type="button"
                className="ps-plan"
                onClick={() => setPlanOpen((v) => !v)}
                disabled={!post}
                aria-expanded={planOpen}
                aria-haspopup="dialog"
              >
                <span className="ps-plan__avatars" aria-hidden>
                  {chosenAccounts.length > 0
                    ? chosenAccounts.map((a) => <span key={a.id}><PlatformIcon platform={a.platform} /></span>)
                    : <span><Globe className="w-3.5 h-3.5" /></span>}
                </span>
                <span className="ps-plan__text">
                  <b>{whereLabel}</b>
                  <small>{whenLabel}</small>
                </span>
                <ChevronDown className={`ps-plan__chev${planOpen ? ' is-flipped' : ''}`} />
              </button>

              <button type="button" className="ps-cta" onClick={publish} disabled={ctaDisabled}>
                {publishing ? <Loader2 className="w-4 h-4 animate-spin" /> : mode === 'now' ? <Send className="w-4 h-4" /> : <CalendarClock className="w-4 h-4" />}
                {publishing ? 'Sending…' : ctaLabel}
              </button>

              {planOpen && post && (
                <div className="ps-pop" role="dialog" aria-label="Where and when to post">
                  <div className="ps-seg" role="radiogroup" aria-label="When">
                    <button type="button" role="radio" aria-checked={mode === 'schedule'} disabled={!canSchedule} onClick={() => setMode('schedule')}>
                      <CalendarClock /> Schedule
                    </button>
                    <button type="button" role="radio" aria-checked={mode === 'now'} onClick={() => setMode('now')}>
                      <Send /> Post now
                    </button>
                  </div>

                  <div className="ps-pop__sec">
                    <span className="ps-pop__label">Post to</span>
                    {accounts === null ? (
                      <span className="ps-pop__muted"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading your pages…</span>
                    ) : accounts.length === 0 ? (
                      <div className="ps-pop__empty">
                        <span>{accountsError || 'Connect your Facebook Page or Instagram account first.'}</span>
                        <button type="button" className="btn btn-outline btn-sm" onClick={onOpenSocial}>Connect a page</button>
                      </div>
                    ) : (
                      <div className="ps-pop__accounts">
                        {accounts.map((a) => {
                          const on = chosen.includes(a.id);
                          return (
                            <button
                              key={a.id}
                              type="button"
                              role="checkbox"
                              aria-checked={on}
                              className={on ? 'is-on' : ''}
                              onClick={() => setChosen((ids) => (on ? ids.filter((id) => id !== a.id) : [...ids, a.id]))}
                            >
                              <PlatformIcon platform={a.platform} className="w-4 h-4" />
                              <span>@{a.username}</span>
                              <i>{on && <Check />}</i>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {mode === 'schedule' ? (
                    <div className="ps-pop__sec">
                      <span className="ps-pop__label">Time on {longDate(post.date)}</span>
                      <div className="ps-slots">
                        {SUGGESTED_TIMES.map((s) => {
                          const past = isPast(post.date, s.time);
                          return (
                            <button key={s.time} type="button" aria-pressed={time === s.time} disabled={past} onClick={() => setTime(s.time)}>
                              <b>{to12h(s.time)}</b>
                              <small>{past ? 'Passed' : s.label}</small>
                              {s.best && !past && <em>Best</em>}
                            </button>
                          );
                        })}
                      </div>
                      <label className="ps-custom">
                        <Clock /> Other time
                        <input type="time" value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
                      </label>
                      {!timeOk && <span className="ps-pop__warn">That time has passed. Pick a later one.</span>}
                      <span className="ps-pop__muted">Suggested times are when Filipino audiences are usually online. All times are in your local time zone.</span>
                    </div>
                  ) : (
                    <p className="ps-pop__muted ps-pop__sec">Goes out as soon as you press Post now.</p>
                  )}
                  {!canSchedule && <span className="ps-pop__muted">This day has passed, so the post can only go out now.</span>}
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
