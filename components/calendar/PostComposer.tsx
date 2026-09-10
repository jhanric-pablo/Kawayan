import React, { useEffect, useMemo, useRef, useState } from 'react';
import { BrandProfile, ContentIdea, GeneratedPost } from '../../types';
import {
  X, Wand2, RefreshCcw, Loader2, Flame, Upload, Image as ImageIcon,
  Save, CalendarCheck, Share2, Sparkles, Heart, MessageCircle, Send, MoreHorizontal, History, Plus,
  ThumbsUp, Globe, Bookmark, Music2, Facebook, Instagram,
} from 'lucide-react';
import './postComposer.css';
import './kawayanCalendar.css';

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
            <span className="kw-pv-fb__sub">Sponsored · <Globe className="w-3 h-3" /></span>
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
          <span className="kw-pv-ig__sub">Sponsored</span>
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
        <p className="kw-pv-ig__time">2 hours ago</p>
      </div>
    </div>
  );
};

/**
 * PostComposer — the content-creation "studio".
 *
 * Replaces the old right-hand slide-out panel with a centred, two-pane dialog:
 *   • left  → editor controls (generate, caption, image, virality, history)
 *   • right → a live, read-only social-post preview
 *
 * This is a UI/UX shell only — every action is delegated straight back to the
 * handlers that already live in ContentCalendar; nothing about the data flow,
 * AI generation, pricing, saving, scheduling or posting changes.
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
  onClose: () => void;
  onGeneratePost: (idea: ContentIdea) => void;
  onAddOn: (day: number) => void;
  onGenerateImage: () => void;
  onSavePost: (post?: GeneratedPost) => void | Promise<void>;
  onSchedule: () => void | Promise<void>;
  onPhotoUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onPostNow: () => void;
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
  generatedContent,
  setGeneratedContent,
  generatingPost,
  loadingImage,
  addOnPrice,
  photoInputRef,
  onClose,
  onGeneratePost,
  onAddOn,
  onGenerateImage,
  onSavePost,
  onSchedule,
  onPhotoUpload,
  onPostNow,
}) => {
  const [showHistory, setShowHistory] = useState(false);
  const [previewPlatform, setPreviewPlatform] = useState<PreviewPlatform>('instagram');
  const dialogRef = useRef<HTMLDivElement>(null);

  // Stable fake engagement number (was recomputed on every keystroke before).
  const fakeLikes = useMemo(() => Math.floor(Math.random() * 500) + 10, [generatedContent?.id]);

  // Esc to close + lock background scroll while open.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialogRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) setShowHistory(false);
  }, [open]);

  if (!open || selectedDay == null) return null;

  const currentPost = posts.find((p) => new Date(p.date).getDate() === selectedDay);
  const currentIdea = ideas.find((i) => i.day === selectedDay);
  const heading = currentPost?.topic || currentIdea?.title || 'Create Post';
  const dateLabel = new Date(currentDate.getFullYear(), currentDate.getMonth(), selectedDay).toLocaleDateString('default', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
  const statusLabel = generatedContent?.status || 'New';
  const score = generatedContent?.viralityScore || 0;

  const runGenerate = () => {
    const idea = currentIdea;
    const fallbackIdea: ContentIdea = { day: selectedDay, title: 'Custom Post', topic: 'General Update', format: 'Image' };
    onGeneratePost(idea || fallbackIdea);
  };

  const initials = profile.businessName.substring(0, 2).toUpperCase();

  /* ── Live preview (read-only, platform-accurate mirror of the editor state) ── */
  const previewBlock = (
    <>
      <PreviewTabs value={previewPlatform} onChange={setPreviewPlatform} />
      <PostPreview
        platform={previewPlatform}
        businessName={profile.businessName}
        initials={initials}
        caption={generatedContent?.caption}
        imageUrl={generatedContent?.imageUrl}
        likes={fakeLikes}
        loadingImage={loadingImage}
      />
    </>
  );

  return (
    <div className="kw-composer-overlay" role="presentation">
      <div className="kw-composer-backdrop" onClick={onClose} aria-hidden="true" />

      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Compose post for ${dateLabel}`}
        tabIndex={-1}
        className="kw-composer"
      >
        {/* ── Top bar ── */}
        <header className="kw-composer__bar">
          <div className="flex items-center gap-3 min-w-0">
            <span className="kw-composer__date">{dateLabel}</span>
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-[var(--fg)] truncate leading-tight" title={heading}>
                {heading}
              </h2>
              <span className={STATUS_STYLE[statusLabel] || STATUS_STYLE.New}>{statusLabel}</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={runGenerate}
              disabled={generatingPost}
              className="kw-composer__generate"
            >
              {generatingPost ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : generatedContent ? (
                <RefreshCcw className="w-3.5 h-3.5" />
              ) : (
                <Wand2 className="w-3.5 h-3.5" />
              )}
              {generatedContent ? 'Rewrite' : 'AI Draft'}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close composer"
              className="kw-composer__close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </header>

        {/* ── Body ── */}
        <div className="kw-composer__body">
          {/* Editor pane */}
          <div className="kw-composer__editor">
            {!generatedContent ? (
              <div className="kw-composer__start">
                <div className="kw-composer__start-icon">
                  <Sparkles className="w-8 h-8 text-white" />
                </div>
                <h3 className="font-display text-xl text-[var(--fg)]">Let&apos;s make something</h3>
                <p className="text-sm text-[var(--fg-muted)] max-w-sm mt-1.5 leading-relaxed">
                  {currentIdea
                    ? `Idea for this day: “${currentIdea.topic}”`
                    : 'Generate a Taglish caption + visual for this day, or bring your own.'}
                </p>
                <button type="button" onClick={runGenerate} disabled={generatingPost} className="kw-composer__start-cta">
                  {generatingPost ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                  {generatingPost ? 'Generating…' : 'Generate with AI'}
                </button>
                <button
                  type="button"
                  onClick={() => onAddOn(selectedDay)}
                  className="kw-composer__start-secondary"
                >
                  <Plus className="w-3.5 h-3.5" /> Buy single post · ₱{addOnPrice}
                </button>
              </div>
            ) : (
              <>
                {/* Virality */}
                <section className="kw-composer__card">
                  <div className="flex items-center justify-between mb-2">
                    <span className="kw-composer__label">
                      <Flame className="w-3.5 h-3.5 text-[var(--primary)]" /> Virality potential
                    </span>
                    <span className="text-lg font-black text-[var(--primary)]">{score}/100</span>
                  </div>
                  <div className="kw-composer__meter">
                    <div className="kw-composer__meter-fill" style={{ width: `${score}%` }} />
                  </div>
                  {generatedContent.viralityReason && (
                    <p className="text-xs text-[var(--fg-muted)] italic mt-2.5 leading-relaxed">
                      “{generatedContent.viralityReason}”
                    </p>
                  )}
                </section>

                {/* Caption */}
                <section>
                  <label className="kw-composer__label mb-1.5" htmlFor="kw-caption">
                    <MessageCircle className="w-3.5 h-3.5 text-[var(--primary)]" /> Caption
                  </label>
                  <textarea
                    id="kw-caption"
                    className="kw-composer__textarea"
                    rows={6}
                    value={generatedContent.caption}
                    onChange={(e) => setGeneratedContent({ ...generatedContent, caption: e.target.value })}
                    placeholder="Write your Taglish caption…"
                  />
                </section>

                {/* Visual */}
                <section>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="kw-composer__label">
                      <ImageIcon className="w-3.5 h-3.5 text-[var(--primary)]" /> Visual
                    </span>
                    <button
                      type="button"
                      onClick={onGenerateImage}
                      disabled={loadingImage}
                      className="kw-composer__mini-btn"
                    >
                      {loadingImage ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCcw className="w-3 h-3" />}
                      {generatedContent.imageUrl ? 'Regenerate' : 'Generate'}
                    </button>
                  </div>
                  <textarea
                    className="kw-composer__textarea kw-composer__textarea--sm"
                    rows={2}
                    value={generatedContent.imagePrompt}
                    onChange={(e) => setGeneratedContent({ ...generatedContent, imagePrompt: e.target.value })}
                    placeholder="Describe the image you want…"
                  />
                  <button type="button" onClick={() => photoInputRef.current?.click()} className="kw-composer__dropzone">
                    <Upload className="w-4 h-4 text-[var(--primary)]" />
                    <span className="text-xs font-medium text-[var(--fg)]">Upload your own photo</span>
                    <span className="text-[10px] text-[var(--fg-subtle)]">JPG / PNG · replaces the AI visual</span>
                  </button>
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={onPhotoUpload}
                  />
                </section>

                {/* History */}
                {generatedContent.history && generatedContent.history.length > 0 && (
                  <section>
                    <button
                      type="button"
                      onClick={() => setShowHistory((v) => !v)}
                      className="kw-composer__label kw-composer__history-toggle"
                    >
                      <History className="w-3.5 h-3.5 text-[var(--primary)]" />
                      {generatedContent.history.length} previous version{generatedContent.history.length === 1 ? '' : 's'}
                      <span className="ml-auto text-[var(--fg-subtle)]">{showHistory ? 'Hide' : 'Show'}</span>
                    </button>
                    {showHistory && (
                      <div className="space-y-2 mt-2">
                        {generatedContent.history.map((h, i) => (
                          <div key={i} className="kw-composer__history-item">
                            <span className="blur-[3px] opacity-60 select-none">{h.caption.substring(0, 64)}…</span>
                            <span className="kw-composer__history-tag">Archived</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </section>
                )}

                {/* Preview on small screens */}
                <section className="lg:hidden">
                  <span className="kw-composer__label mb-2">
                    <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" /> Preview
                  </span>
                  {previewBlock}
                </section>
              </>
            )}
          </div>

          {/* Preview pane (desktop) */}
          <aside className="kw-composer__preview">
            <span className="kw-composer__label mb-3">
              <Sparkles className="w-3.5 h-3.5 text-[var(--primary)]" /> Live preview
            </span>
            {previewBlock}
          </aside>
        </div>

        {/* ── Footer ── */}
        <footer className="kw-composer__footer">
          <button
            type="button"
            onClick={() => onSavePost()}
            disabled={!generatedContent}
            className="kw-composer__footer-btn kw-composer__footer-btn--ghost"
          >
            <Save className="w-4 h-4" /> Save draft
          </button>
          <button
            type="button"
            disabled={!generatedContent || generatedContent.status === 'Scheduled'}
            onClick={onSchedule}
            className={`kw-composer__footer-btn ${
              generatedContent?.status === 'Scheduled'
                ? 'kw-composer__footer-btn--done'
                : 'kw-composer__footer-btn--soft'
            }`}
          >
            <CalendarCheck className="w-4 h-4" />
            {generatedContent?.status === 'Scheduled' ? 'Scheduled' : 'Schedule'}
          </button>
          <button
            type="button"
            onClick={onPostNow}
            disabled={!generatedContent}
            className="kw-composer__footer-btn kw-composer__footer-btn--primary"
          >
            <Share2 className="w-4 h-4" /> Post now
          </button>
        </footer>
      </div>
    </div>
  );
};

export default PostComposer;
