import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import {
  BarChart3, CalendarClock, CalendarX, CheckCircle2, ChevronDown, ChevronLeft, ChevronRight, CircleX, Copy, CopyPlus, EllipsisVertical, ExternalLink,
  Image as ImageIcon, Link2, Loader2, Maximize2, PencilLine, RotateCcw, Smartphone, SquareCheck, TriangleAlert, X,
} from 'lucide-react';
import clsx from 'clsx';
import { BrandProfile, GeneratedPost } from '../../types';
import type { SocialPlatform } from '../../services/socialService';
import { PLATFORM_LABEL, clockTime } from '../../utils/workspaceFeed';
import { useFocusTrap } from '../../utils/useFocusTrap';
import { FacebookGlyph, InstagramGlyph } from '../SocialAccounts';
import { useToast } from '../ui/Toast';
import PhonePreview from './PhonePreview';
import type { CardStatus } from './TimelinePostCard';

interface Props {
  post: GeneratedPost | null;
  profile: BrandProfile;
  platforms: SocialPlatform[];
  /** Local schedule time and when it was queued, if sent from this browser. */
  scheduledAt?: string;
  queuedAt?: string;
  failed: boolean;
  publishing: boolean;
  onClose: () => void;
  onEdit: (post: GeneratedPost) => void;
  onRetry: (post: GeneratedPost) => void;
  /** Move a draft to another date (the keyboard and touch way to do what dragging does). */
  onMove?: (post: GeneratedPost, date: string) => void;
  /** Pages of a scheduled post that lost access: the post is held until they're reconnected. */
  heldPlatforms?: string[];
  /** A full rewrite is running for this post. */
  regenerating?: boolean;
  /** Draft: schedule it to every connected page at the suggested time (asks first). */
  onApprove?: (post: GeneratedPost) => void;
  /** Draft: new caption, score and image from the same idea (uses one of the post's rewrites). */
  onRegenerate?: (post: GeneratedPost) => void;
  onReconnect?: (platform: string) => void;
  onDuplicate?: (post: GeneratedPost) => void;
  /** Scheduled: take it off the pages' queue and back to Draft. */
  onUnschedule?: (post: GeneratedPost) => void;
  onOpenInsights?: () => void;
  /** Step through the calendar's posts without closing. */
  onPrev?: () => void;
  onNext?: () => void;
  /** Where this post sits in that order, e.g. 3 of 12. */
  position?: { index: number; total: number };
}

const MAX_VERSIONS = 3; // the first draft + 2 rewrites
const CLAMP_AT = 280; // characters before the caption folds behind See more

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const GLYPH: Record<string, React.FC<{ className?: string }>> = { facebook: FacebookGlyph, instagram: InstagramGlyph };

const scoreBand = (s: number) => (s >= 75 ? { label: 'Strong', tone: 'is-green' } : s >= 50 ? { label: 'Fair', tone: 'is-amber' } : { label: 'Weak', tone: 'is-red' });

/**
 * The post review modal: a sticky header (status, page, business), the post as it will look,
 * when it goes out, the AI's reach score, then a sticky footer with the actions for its status.
 * Approving only schedules (after a confirm); nothing posts on approval alone.
 */
const PostDetailSheet: React.FC<Props> = ({
  post, profile, platforms, scheduledAt, queuedAt, failed, publishing, onClose, onEdit, onRetry, onMove,
  heldPlatforms = [], regenerating = false, onApprove, onRegenerate, onReconnect, onDuplicate, onUnschedule, onOpenInsights,
  onPrev, onNext, position,
}) => {
  const toast = useToast();
  const boxRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const [phoneView, setPhoneView] = useState(false);
  const [moving, setMoving] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [zoom, setZoom] = useState(false);
  const open = !!post;
  useFocusTrap(boxRef, open);

  const closeAll = () => { setPhoneView(false); setMoving(false); setZoom(false); onClose(); };

  // A new post: fold the caption, drop the date picker, back to the top. The phone preview toggle stays.
  useEffect(() => {
    setMoving(false);
    setExpanded(false);
    setZoom(false);
    bodyRef.current?.scrollTo({ top: 0 });
  }, [post?.id]);

  // Focus the dialog when it opens, lock the page behind it, give focus back on close.
  useEffect(() => {
    if (!open) return;
    const before = document.activeElement as HTMLElement | null;
    boxRef.current?.focus();
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prevOverflow; before?.focus?.(); };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      // A confirm or menu on top handles its own keys.
      if (document.querySelector('.kw-overlay, [role="menu"]')) return;
      const typing = (e.target as HTMLElement)?.closest('input, textarea, select, [contenteditable="true"]');
      if (e.key === 'Escape') {
        if (zoom) setZoom(false);
        else closeAll();
      } else if (!typing && !zoom && e.key === 'ArrowLeft' && onPrev) onPrev();
      else if (!typing && !zoom && e.key === 'ArrowRight' && onNext) onNext();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, zoom, onPrev, onNext]);

  if (!post) return null;
  const p = post;

  const held = p.status === 'Scheduled' && heldPlatforms.length > 0;
  const status: CardStatus = failed ? 'failed' : p.status === 'Published' ? 'published' : p.status === 'Scheduled' ? 'scheduled' : 'draft';
  const canMove = !!onMove && (status === 'draft' || status === 'failed');
  const channelText = platforms.map((x) => PLATFORM_LABEL[x]).join(' + ') || 'No page connected';
  const dateLabel = new Date(`${p.date}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });
  const time = clockTime(scheduledAt);
  const version = Math.min(MAX_VERSIONS, (p.history?.length || 0) + 1);
  const rewritesLeft = Math.max(0, MAX_VERSIONS - 1 - (p.regenCount || 0));
  const lostPages = heldPlatforms;
  const lostText = lostPages.map((x) => PLATFORM_LABEL[x as SocialPlatform] ?? x).join(' and ');
  const caption = p.caption || '';
  const long = caption.length > CLAMP_AT;
  const prevScore = p.history?.length ? p.history[p.history.length - 1].viralityScore : undefined;

  const log = [
    ...(p.history || []).map((v) => ({ at: v.createdAt, Icon: PencilLine, tone: 'text-(--fg-muted)', text: 'Caption rewritten with AI' })),
    queuedAt && { at: queuedAt, Icon: CalendarClock, tone: 'text-(--info)', text: scheduledAt ? `Queued for ${channelText}, goes out ${when(scheduledAt)}` : `Sent to ${channelText}` },
    p.status === 'Published' && { at: p.publishedAt, Icon: CheckCircle2, tone: 'text-(--green-ink)', text: `Published to ${channelText}` },
    failed && { at: undefined, Icon: CircleX, tone: 'text-(--danger)', text: 'Publishing failed. The post went back to drafts.' },
  ]
    .filter((e): e is { at: string | undefined; Icon: typeof PencilLine; tone: string; text: string } => !!e)
    .sort((a, b) => (a.at ?? '9').localeCompare(b.at ?? '9'));

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(caption);
      toast.success('Caption copied');
    } catch {
      toast.error('Could not copy. Select the caption and copy it yourself.');
    }
  };

  /* ── Status: what the post needs, in one tone ── */
  const head = held
    ? { tone: 'is-red', Icon: TriangleAlert, text: 'Held' }
    : failed
      ? { tone: 'is-red', Icon: CircleX, text: 'Didn’t go out' }
      : status === 'published'
        ? { tone: 'is-done', Icon: CheckCircle2, text: 'Published' }
        : status === 'scheduled'
          ? { tone: 'is-brand', Icon: CalendarClock, text: 'Scheduled' }
          : { tone: 'is-amber', Icon: SquareCheck, text: 'Pending approval' };

  /* ── When it goes out ── */
  const schedule =
    status === 'published'
      ? { title: 'Published', text: p.publishedAt ? `${when(p.publishedAt)} on ${channelText}` : `${dateLabel} on ${channelText}` }
      : status === 'scheduled'
        ? { title: held ? 'Scheduled, but held' : 'Scheduled', text: `${dateLabel}${time ? ` at ${time}` : ''} on ${channelText}` }
        : status === 'failed'
          ? { title: 'Not scheduled', text: `Was set for ${dateLabel}. It’s back in drafts.` }
          : { title: 'Not scheduled yet', text: `Planned for ${dateLabel}. Approving schedules it at the suggested time, after you confirm.` };

  /* ── Actions: one primary on the right, quieter ones before it ── */
  const spin = <Loader2 className="h-4 w-4 animate-spin" aria-hidden />;
  let primary: React.ReactNode = null;
  let secondary: React.ReactNode = null;
  if (held || (failed && lostPages.length)) {
    primary = onReconnect && (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onReconnect(lostPages[0])}>
        <Link2 className="h-4 w-4" aria-hidden /> Reconnect {PLATFORM_LABEL[lostPages[0] as SocialPlatform] ?? 'page'}
      </button>
    );
    secondary = held
      ? onUnschedule && <button type="button" className="kw-pc__soft" onClick={() => onUnschedule(p)} disabled={publishing}><CalendarX className="h-4 w-4" aria-hidden /> Unschedule</button>
      : <button type="button" className="kw-pc__soft" onClick={() => onRetry(p)} disabled={publishing}>{publishing ? spin : <RotateCcw className="h-4 w-4" aria-hidden />} Retry</button>;
  } else if (failed) {
    primary = <button type="button" className="btn btn-primary btn-sm" onClick={() => onRetry(p)} disabled={publishing}>{publishing ? spin : <RotateCcw className="h-4 w-4" aria-hidden />} Retry now</button>;
  } else if (status === 'published') {
    primary = p.externalLink ? (
      <a className="btn btn-primary btn-sm" href={p.externalLink} target="_blank" rel="noreferrer"><ExternalLink className="h-4 w-4" aria-hidden /> View on {PLATFORM_LABEL[platforms[0]] ?? 'Facebook'}</a>
    ) : null;
    secondary = onOpenInsights && <button type="button" className="kw-pc__soft" onClick={onOpenInsights}><BarChart3 className="h-4 w-4" aria-hidden /> Insights</button>;
  } else if (status === 'scheduled') {
    secondary = onUnschedule && (
      <button type="button" className="kw-pc__soft" onClick={() => onUnschedule(p)} disabled={publishing} title="Takes it off the pages’ queue. It comes back as a draft you can edit or move.">
        <CalendarX className="h-4 w-4" aria-hidden /> Unschedule
      </button>
    );
  } else {
    primary = onApprove && (
      <button type="button" className="btn btn-primary btn-sm" onClick={() => onApprove(p)} disabled={publishing || regenerating} title="Schedules it to your connected pages. You confirm the time first.">
        {publishing ? spin : <SquareCheck className="h-4 w-4" aria-hidden />} Approve &amp; schedule
      </button>
    );
    secondary = onRegenerate && (
      <button
        type="button"
        className="kw-pc__soft"
        onClick={() => onRegenerate(p)}
        disabled={regenerating || rewritesLeft === 0}
        title={rewritesLeft === 0 ? 'Both rewrites are used. You can still edit it by hand.' : `New caption and image from the same idea. ${rewritesLeft} left.`}
      >
        {regenerating ? spin : <RotateCcw className="h-4 w-4" aria-hidden />} Regenerate
      </button>
    );
  }

  const initials = (profile.businessName || 'K').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
  const Glyph = GLYPH[platforms[0]];
  const band = p.viralityScore != null ? scoreBand(p.viralityScore) : null;

  return createPortal(
    <>
      <div className="kw-pd__scrim" onClick={closeAll} aria-hidden />
      <div
        ref={boxRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="kw-pd-title"
        tabIndex={-1}
        className="kw-pd"
      >
        {/* ── Header ── */}
        <header className="kw-pd__head">
          <span className="kw-pd__avatar" aria-hidden>
            {initials}
            {Glyph && <span className="kw-pd__glyph"><Glyph className="h-3.5 w-3.5" /></span>}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold leading-tight">{profile.businessName}</p>
            <p className="truncate text-xs text-(--fg-muted)">{channelText}</p>
          </div>
          <span className={clsx('kw-pd__status', head.tone)}>
            <head.Icon className="h-3.5 w-3.5" aria-hidden /> {head.text}
          </span>
          <button type="button" onClick={closeAll} aria-label="Close" className="kw-pd__close"><X className="h-4 w-4" aria-hidden /></button>
        </header>

        {/* ── Scrolling content ── */}
        <div ref={bodyRef} className="kw-pd__body">
          <h2 id="kw-pd-title" className="text-lg font-semibold leading-snug text-balance">{p.topic}</h2>

          {(held || failed) && (
            <div className="kw-alert mt-3" role="alert">
              <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              <span className="min-w-0 flex-1">
                {held
                  ? `${lostText} lost access. This post won’t go out until the page is reconnected.`
                  : lostPages.length
                    ? `${lostText} access expired, so this post didn’t go out.`
                    : 'This post didn’t go out and went back to drafts.'}
              </span>
            </div>
          )}

          <div className="kw-pd__grid">
            {/* The post as people will see it */}
            {phoneView ? (
              <div className="flex justify-center rounded-xl bg-(--muted) px-4 py-5">
                <PhonePreview key={p.id} businessName={profile.businessName} caption={p.caption} imageUrl={p.imageUrl} defaultPlatform={platforms[0] === 'instagram' ? 'instagram' : 'facebook'} tabs={['facebook', 'instagram']} />
              </div>
            ) : (
              <article className="kw-pd__post" aria-label="Post preview">
                <div className="kw-pd__caption">
                  <p className={clsx('whitespace-pre-wrap', long && !expanded && 'line-clamp-5')}>{caption || 'No caption yet.'}</p>
                  <div className="mt-1.5 flex items-center gap-3">
                    {long && (
                      <button type="button" className="text-ui font-medium text-(--fg-muted) hover:text-(--fg)" onClick={() => setExpanded((v) => !v)} aria-expanded={expanded}>
                        {expanded ? 'See less' : 'See more'}
                      </button>
                    )}
                    {caption && (
                      <button type="button" onClick={copyCaption} className="ml-auto inline-flex min-h-6 items-center gap-1.5 text-ui text-(--fg-muted) hover:text-(--fg)">
                        <Copy className="h-3.5 w-3.5" aria-hidden /> Copy
                      </button>
                    )}
                  </div>
                </div>
                {p.imageUrl ? (
                  <button type="button" className="kw-pd__img" onClick={() => setZoom(true)} aria-label="Enlarge image">
                    <img decoding="async" src={p.imageUrl} alt={`Post image for ${p.topic}`} />
                    <span className="kw-pd__zoom" aria-hidden><Maximize2 className="h-3.5 w-3.5" /></span>
                  </button>
                ) : (
                  <div className="grid aspect-[4/3] place-items-center bg-(--muted) text-(--fg-muted)"><ImageIcon className="h-6 w-6" aria-hidden /></div>
                )}
              </article>
            )}

            {/* Schedule, assessment, history */}
            <div className="kw-pd__side">
              <section className="kw-pd__sec">
                <h3 className="kw-pd__label">Schedule</h3>
                <p className="flex items-center gap-2 font-medium">
                  <span className={clsx('kw-pd__dot', head.tone)} aria-hidden /> {schedule.title}
                </p>
                <p className="mt-0.5 text-ui text-(--fg-muted)">{schedule.text}</p>
                {canMove && !moving && (
                  <button type="button" className="mt-2 inline-flex items-center gap-1.5 text-ui font-medium text-(--green-ink) hover:underline" onClick={() => setMoving(true)}>
                    <CalendarClock className="h-3.5 w-3.5" aria-hidden /> Change date
                  </button>
                )}
                {moving && canMove && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <label htmlFor="pds-move" className="sr-only">New date</label>
                    <input
                      id="pds-move"
                      key={p.date}
                      type="date"
                      defaultValue={p.date}
                      min={todayYmd()}
                      autoFocus
                      // Typing a year passes through dates like 0002-11-03; only act once it's a real, future date.
                      onChange={(e) => { if (e.target.value >= todayYmd() && e.target.value !== p.date) { onMove!(p, e.target.value); setMoving(false); } }}
                      className="input h-9 max-w-44 py-1"
                    />
                    <button type="button" onClick={() => setMoving(false)} className="btn btn-ghost btn-sm">Cancel</button>
                  </div>
                )}
              </section>

              {p.viralityScore != null && band && (
                <details className="kw-pd__sec kw-pd__assess" open>
                  <summary>
                    <h3 className="kw-pd__label">AI assessment</h3>
                    <ChevronDown className="kw-pd__chev h-4 w-4 text-(--fg-muted)" aria-hidden />
                  </summary>
                  <div className="flex items-baseline gap-2">
                    <b className="mono text-2xl font-semibold leading-none">{p.viralityScore}</b>
                    <span className="text-xs text-(--fg-muted)">/ 100 reach score</span>
                    <span className={clsx('kw-pd__band ml-auto', band.tone)}>{band.label}</span>
                  </div>
                  <div className="kw-pd__meter" aria-hidden><span style={{ width: `${Math.max(2, Math.min(100, p.viralityScore))}%` }} /></div>
                  {prevScore != null && prevScore !== p.viralityScore && (
                    <p className="mt-2 text-xs text-(--fg-muted)">
                      {p.viralityScore > prevScore ? 'Up' : 'Down'} {Math.abs(p.viralityScore - prevScore)} from the previous version ({prevScore}).
                    </p>
                  )}
                  {p.viralityReason ? (
                    <p className="mt-2 text-ui leading-relaxed">{p.viralityReason}</p>
                  ) : (
                    <p className="mt-2 text-ui text-(--fg-muted)">No notes came with this score.</p>
                  )}
                  <p className="mt-2 text-xs text-(--fg-muted)">An AI estimate from the caption and topic, not a guarantee of reach.</p>
                </details>
              )}

              <details className="kw-pd__sec kw-pd__assess">
                <summary>
                  <h3 className="kw-pd__label">History</h3>
                  <span className="mono ml-auto mr-1 text-xs text-(--fg-muted)">Version {version} of {MAX_VERSIONS}</span>
                  <ChevronDown className="kw-pd__chev h-4 w-4 text-(--fg-muted)" aria-hidden />
                </summary>
                {log.length ? (
                  <ol className="space-y-2.5 text-ui">
                    {log.map((e, i) => (
                      <li key={i} className="flex gap-2.5">
                        <e.Icon className={clsx('mt-0.5 h-3.5 w-3.5 shrink-0', e.tone)} aria-hidden />
                        <span className="min-w-0">
                          <span className="leading-snug">{e.text}</span>
                          {e.at && <span className="mono block text-xs text-(--fg-muted)">{when(e.at)}</span>}
                        </span>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-ui text-(--fg-muted)">
                    {status === 'draft' ? 'Draft saved. ' : 'Nothing recorded on this device yet. '}
                    {p.regenCount ? `${p.regenCount} of 2 AI rewrites used.` : 'No AI rewrites used yet.'}
                  </p>
                )}
              </details>
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="kw-pc__foot kw-pd__foot">
          {(onPrev || onNext) && (
            <div className="kw-pd__nav">
              <button type="button" className="kw-pc__icon" onClick={onPrev} disabled={!onPrev} aria-label="Previous post" title="Previous post (←)"><ChevronLeft className="h-4 w-4" aria-hidden /></button>
              {position && <span className="mono text-xs text-(--fg-muted)">{position.index} of {position.total}</span>}
              <button type="button" className="kw-pc__icon" onClick={onNext} disabled={!onNext} aria-label="Next post" title="Next post (→)"><ChevronRight className="h-4 w-4" aria-hidden /></button>
            </div>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More actions" className="kw-pc__icon ml-auto">
              <EllipsisVertical className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            {/* The footer sits at the bottom of the screen, so the menu opens upward into the modal. */}
            <DropdownMenuContent side="top" align="end" sideOffset={6} className="min-w-[190px]">
              <DropdownMenuItem onClick={() => setPhoneView((v) => !v)}>
                {phoneView ? <ImageIcon className="text-(--fg-muted)" aria-hidden /> : <Smartphone className="text-(--fg-muted)" aria-hidden />} {phoneView ? 'Show caption and image' : 'Preview on phone'}
              </DropdownMenuItem>
              {canMove && (
                <DropdownMenuItem onClick={() => setMoving(true)}>
                  <CalendarClock className="text-(--fg-muted)" aria-hidden /> Change date
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={copyCaption} disabled={!caption}>
                <Copy className="text-(--fg-muted)" aria-hidden /> Copy caption
              </DropdownMenuItem>
              {p.externalLink && (
                <DropdownMenuItem onClick={() => window.open(p.externalLink, '_blank', 'noopener')}>
                  <ExternalLink className="text-(--fg-muted)" aria-hidden /> View live post
                </DropdownMenuItem>
              )}
              {onDuplicate && status !== 'draft' && (
                <DropdownMenuItem onClick={() => onDuplicate(p)}>
                  <CopyPlus className="text-(--fg-muted)" aria-hidden /> Duplicate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
          <button type="button" onClick={() => onEdit(p)} className="kw-pc__soft"><PencilLine className="h-4 w-4" aria-hidden /> Edit</button>
          {secondary}
          {primary}
        </footer>
      </div>

      {zoom && p.imageUrl && (
        <div className="kw-pd__lightbox" onClick={() => setZoom(false)} role="presentation">
          <img src={p.imageUrl} alt={`Post image for ${p.topic}, enlarged`} />
          <button type="button" className="kw-pd__close kw-pd__close--light" aria-label="Close image" onClick={() => setZoom(false)}><X className="h-4 w-4" aria-hidden /></button>
        </div>
      )}
    </>,
    document.body,
  );
};

export default PostDetailSheet;
