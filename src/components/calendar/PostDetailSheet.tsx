import React, { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '../ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import {
  BarChart3, CalendarClock, CalendarX, Check, CheckCircle2, CircleX, Copy, CopyPlus, Ellipsis, ExternalLink, Image as ImageIcon, Link2,
  Loader2, PencilLine, RotateCcw, Smartphone, Sparkles, TriangleAlert, X,
} from 'lucide-react';
import clsx from 'clsx';
import { BrandProfile, GeneratedPost } from '../../types';
import type { SocialPlatform } from '../../services/socialService';
import { PLATFORM_LABEL, clockTime } from '../../utils/workspaceFeed';
import { FacebookGlyph, InstagramGlyph } from '../SocialAccounts';
import { useToast } from '../ui/Toast';
import PhonePreview from './PhonePreview';
import { CardStatus, StatusBadge } from './TimelinePostCard';

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
  /** Wide screens: render as a panel beside the calendar instead of a sheet. */
  inline?: boolean;
  /** Pages of a scheduled post that lost access: the post is held until they're reconnected. */
  heldPlatforms?: string[];
  /** A full rewrite is running for this post. */
  regenerating?: boolean;
  /** Draft: schedule it to every connected page at the suggested time. */
  onApprove?: (post: GeneratedPost) => void;
  /** Draft: new caption, score and image from the same idea (uses one of the post's rewrites). */
  onRegenerate?: (post: GeneratedPost) => void;
  onReconnect?: (platform: string) => void;
  onDuplicate?: (post: GeneratedPost) => void;
  /** Scheduled: take it off the pages' queue and back to Draft. */
  onUnschedule?: (post: GeneratedPost) => void;
  onOpenInsights?: () => void;
}

const MAX_VERSIONS = 3; // the first draft + 2 rewrites

const todayYmd = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

const GLYPH: Record<string, React.FC<{ className?: string }>> = { facebook: FacebookGlyph, instagram: InstagramGlyph };

const Section: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({ title, action, children }) => (
  <section>
    <div className="mb-2 flex items-center gap-2">
      <h3 className="eyebrow text-(--fg-muted)">{title}</h3>
      <span className="ml-auto">{action}</span>
    </div>
    {children}
  </section>
);

/**
 * What opens when you click a post (mockup .detail): the image, title, when, status, a held alert,
 * the pages, the caption and its version, the reach score, then the actions for its status.
 * History and the phone preview stay one tap away.
 */
const PostDetailSheet: React.FC<Props> = ({
  post, profile, platforms, scheduledAt, queuedAt, failed, publishing, onClose, onEdit, onRetry, onMove, inline = false,
  heldPlatforms = [], regenerating = false, onApprove, onRegenerate, onReconnect, onDuplicate, onUnschedule, onOpenInsights,
}) => {
  const toast = useToast();
  const [phoneView, setPhoneView] = useState(false);
  const [moving, setMoving] = useState(false);
  // Keep the last post on screen while the sheet slides out.
  const last = useRef(post);
  if (post && post !== last.current) {
    last.current = post;
  }
  const p = last.current;
  const closeAll = () => { setPhoneView(false); setMoving(false); onClose(); };
  useEffect(() => {
    if (!inline || !post) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !document.querySelector('[role="dialog"], [role="menu"]') && closeAll();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inline, post]);
  useEffect(() => setMoving(false), [post?.id]);
  if (!p) return null;
  if (inline && !post) return null;

  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
  const held = p.status === 'Scheduled' && heldPlatforms.length > 0;
  const status: CardStatus = failed ? 'failed' : p.status === 'Published' ? 'published' : p.status === 'Scheduled' ? 'scheduled' : 'draft';
  const canMove = !!onMove && (status === 'draft' || status === 'failed');
  const channelText = platforms.map((x) => PLATFORM_LABEL[x]).join(' + ') || 'your pages';
  const dateLabel = new Date(`${p.date}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = clockTime(scheduledAt);
  const version = Math.min(MAX_VERSIONS, (p.history?.length || 0) + 1);
  const rewritesLeft = Math.max(0, MAX_VERSIONS - 1 - (p.regenCount || 0));
  const lostPages = heldPlatforms.length ? heldPlatforms : [];

  const log = [
    ...(p.history || []).map((v) => ({ at: v.createdAt, Icon: Sparkles, tone: 'text-(--fg-muted)', text: 'Caption rewritten with AI' })),
    queuedAt && { at: queuedAt, Icon: CalendarClock, tone: 'text-(--amber)', text: scheduledAt ? `Queued for ${channelText}, goes out ${when(scheduledAt)}` : `Sent to ${channelText}` },
    p.status === 'Published' && { at: p.publishedAt, Icon: CheckCircle2, tone: 'text-(--green-ink)', text: `Published to ${channelText}` },
    failed && { at: undefined, Icon: CircleX, tone: 'text-(--danger)', text: 'Publishing failed. The post went back to drafts.' },
  ]
    .filter((e): e is { at: string | undefined; Icon: typeof Sparkles; tone: string; text: string } => !!e)
    .sort((a, b) => (a.at ?? '9').localeCompare(b.at ?? '9'));

  const copyCaption = async () => {
    try {
      await navigator.clipboard.writeText(p.caption || '');
      toast.success('Caption copied');
    } catch {
      toast.error('Could not copy. Select the caption and copy it yourself.');
    }
  };

  const statusBadge = held ? (
    <span className="badge badge-red shrink-0"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Held</span>
  ) : (
    <StatusBadge status={status} time={time} className="shrink-0" />
  );

  /* ── Actions by status (mockup .d-acts): the green one first, full width ── */
  const btn = 'btn btn-outline btn-sm';
  const moveBtn = canMove && (
    <button type="button" onClick={() => setMoving((v) => !v)} className={btn} aria-expanded={moving}>
      <CalendarClock className="h-4 w-4" aria-hidden /> Move date
    </button>
  );
  let actions: React.ReactNode;
  if (held || (failed && lostPages.length)) {
    actions = (
      <>
        {onReconnect && (
          <button type="button" className="btn btn-primary btn-sm col-span-2" onClick={() => onReconnect(lostPages[0])}>
            <Link2 className="h-4 w-4" aria-hidden /> Reconnect {PLATFORM_LABEL[lostPages[0] as SocialPlatform] ?? 'page'}
          </button>
        )}
        {held ? (
          onUnschedule && (
            <button type="button" className={btn} onClick={() => onUnschedule(p)} disabled={publishing}>
              <CalendarX className="h-4 w-4" aria-hidden /> Unschedule
            </button>
          )
        ) : moveBtn}
        {held ? (
          <button type="button" className={btn} onClick={() => onEdit(p)}><PencilLine className="h-4 w-4" aria-hidden /> Edit</button>
        ) : (
          <button type="button" className={btn} onClick={() => onRetry(p)} disabled={publishing}>
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />} Retry
          </button>
        )}
      </>
    );
  } else if (failed) {
    actions = (
      <>
        <button type="button" className="btn btn-primary btn-sm col-span-2" onClick={() => onRetry(p)} disabled={publishing}>
          {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />} Retry now
        </button>
        {moveBtn}
        <button type="button" className={btn} onClick={() => onEdit(p)}><PencilLine className="h-4 w-4" aria-hidden /> Edit</button>
      </>
    );
  } else if (status === 'published') {
    actions = (
      <>
        {p.externalLink ? (
          <a className="btn btn-primary btn-sm col-span-2" href={p.externalLink} target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" aria-hidden /> View on {PLATFORM_LABEL[platforms[0]] ?? 'Facebook'}
          </a>
        ) : (
          <button type="button" className="btn btn-primary btn-sm col-span-2" onClick={() => onEdit(p)}>
            <PencilLine className="h-4 w-4" aria-hidden /> Open in studio
          </button>
        )}
        {onOpenInsights && (
          <button type="button" className={btn} onClick={onOpenInsights}><BarChart3 className="h-4 w-4" aria-hidden /> Insights</button>
        )}
        {onDuplicate && (
          <button type="button" className={btn} onClick={() => onDuplicate(p)}><CopyPlus className="h-4 w-4" aria-hidden /> Duplicate</button>
        )}
      </>
    );
  } else if (status === 'scheduled') {
    actions = (
      <>
        <button type="button" className="btn btn-primary btn-sm col-span-2" onClick={() => onEdit(p)}>
          <PencilLine className="h-4 w-4" aria-hidden /> Edit post
        </button>
        {onUnschedule && (
          <button
            type="button"
            className={btn}
            onClick={() => onUnschedule(p)}
            disabled={publishing}
            title="Moving a scheduled post takes it off the queue first. It comes back as a draft you can move."
          >
            <CalendarClock className="h-4 w-4" aria-hidden /> Move date
          </button>
        )}
        {onUnschedule && (
          <button type="button" className={btn} onClick={() => onUnschedule(p)} disabled={publishing}>
            <CalendarX className="h-4 w-4" aria-hidden /> Unschedule
          </button>
        )}
      </>
    );
  } else {
    actions = (
      <>
        {onApprove && (
          <button type="button" className="btn btn-primary btn-sm col-span-2" onClick={() => onApprove(p)} disabled={publishing || regenerating}>
            {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Check className="h-4 w-4" aria-hidden />} Approve and schedule
          </button>
        )}
        <button type="button" className={btn} onClick={() => onEdit(p)}><PencilLine className="h-4 w-4" aria-hidden /> Edit</button>
        {onRegenerate ? (
          <button
            type="button"
            className={btn}
            onClick={() => onRegenerate(p)}
            disabled={regenerating || rewritesLeft === 0}
            title={rewritesLeft === 0 ? 'Both rewrites are used. You can still edit it by hand.' : `${rewritesLeft} rewrite${rewritesLeft > 1 ? 's' : ''} left`}
          >
            {regenerating ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />} Regenerate
          </button>
        ) : moveBtn}
        {onRegenerate && moveBtn}
      </>
    );
  }

  const bodyEl = (
    <div className="flex-1 overflow-y-auto">
      {phoneView ? (
        <div className="flex justify-center border-b border-(--border) bg-(--muted) px-4 py-5">
          <PhonePreview key={p.id} businessName={profile.businessName} caption={p.caption} imageUrl={p.imageUrl} defaultPlatform={platforms[0] === 'instagram' ? 'instagram' : 'facebook'} tabs={['facebook', 'instagram']} />
        </div>
      ) : p.imageUrl ? (
        <img src={p.imageUrl} alt={`Post image for ${p.topic}`} className="aspect-4/3 w-full border-b border-(--border) object-cover" />
      ) : (
        <div className="grid aspect-4/3 w-full place-items-center border-b border-(--border) bg-(--muted) text-(--fg-muted)">
          <ImageIcon className="h-7 w-7" aria-hidden />
        </div>
      )}

      <div className="space-y-4 px-4 py-4">
        <div className="flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            {inline ? (
              <h2 id="kw-detail-title" className="text-[17px] font-semibold leading-snug tracking-tight">{p.topic}</h2>
            ) : null}
            <p className="mono text-ui text-(--fg-muted)">{dateLabel}{time && status !== 'draft' ? ` · ${time}` : ''}</p>
          </div>
          {statusBadge}
        </div>

        {(held || failed) && (
          <div className="kw-alert" role="alert">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              {held
                ? `${lostPages.map((x) => PLATFORM_LABEL[x as SocialPlatform] ?? x).join(' and ')} access expired, so this post is held.`
                : lostPages.length
                  ? `${lostPages.map((x) => PLATFORM_LABEL[x as SocialPlatform] ?? x).join(' and ')} access expired, so this post didn’t go out.`
                  : 'This post didn’t go out and went back to drafts.'}
            </span>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5" aria-label="Pages">
          {status === 'draft' ? (
            <span className="badge badge-dashed">Not scheduled yet</span>
          ) : (
            (platforms.length ? platforms : (['facebook'] as SocialPlatform[])).map((pl) => {
              const Glyph = GLYPH[pl];
              return (
                <span key={pl} className={clsx('badge', heldPlatforms.includes(pl) && 'badge-red')}>
                  {Glyph && <Glyph className="h-3 w-3" />} {PLATFORM_LABEL[pl]}
                </span>
              );
            })
          )}
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs text-(--fg-muted)">
            <span>Caption</span>
            <span className="mono">Version {version} of {MAX_VERSIONS}</span>
          </div>
          <div className="relative rounded-[10px] border border-(--border) bg-(--muted) px-3 py-3">
            <p className="whitespace-pre-wrap pr-8 text-sm leading-relaxed text-(--fg)">{p.caption || 'No caption yet.'}</p>
            {p.caption && (
              <button type="button" onClick={copyCaption} aria-label="Copy caption" className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-md text-(--fg-muted) hover:bg-(--card) hover:text-(--fg)">
                <Copy className="h-3.5 w-3.5" aria-hidden />
              </button>
            )}
          </div>
        </div>

        {p.viralityScore != null && (
          <div>
            <div className="mb-1.5 flex justify-between text-ui">
              <span>Reach score</span>
              <b className="mono font-medium">{p.viralityScore} / 100</b>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]">
              <div className="h-full rounded-full bg-(--green)" style={{ width: `${Math.min(100, p.viralityScore)}%` }} />
            </div>
            {p.viralityReason && <p className="mt-1.5 text-xs leading-relaxed text-(--fg-muted)">{p.viralityReason}</p>}
          </div>
        )}

        <hr className="border-(--border)" />

        <div className="grid grid-cols-2 gap-2">{actions}</div>

        {moving && canMove && (
          <div className="flex items-center gap-2 rounded-lg border border-(--border) bg-(--muted) px-3 py-2.5">
            <label htmlFor="pds-move" className="text-ui font-medium">Move to</label>
            <input
              id="pds-move"
              key={p.date}
              type="date"
              defaultValue={p.date}
              min={todayYmd()}
              autoFocus
              // Typing a year passes through dates like 0002-11-03; only act once it's a real, future date.
              onChange={(e) => e.target.value >= todayYmd() && e.target.value !== p.date && onMove!(p, e.target.value)}
              className="input h-9 max-w-44 py-1"
            />
            <button type="button" onClick={() => setMoving(false)} className="btn btn-ghost btn-sm ml-auto">Cancel</button>
          </div>
        )}

        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setPhoneView((v) => !v)} className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-(--fg) underline-offset-2 hover:underline">
            {phoneView ? <><ImageIcon className="h-3.5 w-3.5" aria-hidden /> Show image</> : <><Smartphone className="h-3.5 w-3.5" aria-hidden /> Preview on phone</>}
          </button>
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More actions" className="btn btn-ghost btn-sm ml-auto w-8 px-0">
              <Ellipsis className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={copyCaption} disabled={!p.caption}>
                <Copy className="text-(--fg-muted)" aria-hidden /> Copy caption
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => onEdit(p)}>
                <PencilLine className="text-(--fg-muted)" aria-hidden /> Open in studio
              </DropdownMenuItem>
              {p.externalLink && (
                <DropdownMenuItem onClick={() => window.open(p.externalLink, '_blank', 'noopener')}>
                  <ExternalLink className="text-(--fg-muted)" aria-hidden /> View live post
                </DropdownMenuItem>
              )}
              {onDuplicate && status !== 'published' && (
                <DropdownMenuItem onClick={() => onDuplicate(p)}>
                  <CopyPlus className="text-(--fg-muted)" aria-hidden /> Duplicate
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <Section title="History">
          {log.length ? (
            <ol className="space-y-2.5">
              {log.map((e, i) => (
                <li key={i} className="flex gap-2.5 text-ui">
                  <e.Icon className={clsx('mt-0.5 h-3.5 w-3.5 shrink-0', e.tone)} strokeWidth={2} aria-hidden />
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
        </Section>
      </div>
    </div>
  );

  if (inline) {
    return (
      <aside className="kw-detail card" aria-labelledby="kw-detail-title">
        <button type="button" onClick={closeAll} aria-label="Close details" className="absolute right-2 top-2 z-1 grid h-9 w-9 place-items-center rounded-lg bg-(--card)/90 text-(--fg) shadow-xs hover:bg-(--muted)">
          <X className="h-4 w-4" aria-hidden />
        </button>
        {bodyEl}
      </aside>
    );
  }

  return (
    <Sheet open={!!post} onOpenChange={(open) => { if (!open) closeAll(); }}>
      <SheetContent side={phone ? 'bottom' : 'right'} className={clsx('w-full gap-0', phone ? 'max-h-[88vh] rounded-t-2xl' : 'sm:max-w-[440px]')}>
        {phone && <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-(--border-strong)" aria-hidden />}
        <SheetHeader className="border-b border-border px-4 py-3.5 pr-12">
          <SheetTitle className="font-sans text-[17px] font-semibold leading-snug tracking-tight">{p.topic}</SheetTitle>
        </SheetHeader>
        {bodyEl}
      </SheetContent>
    </Sheet>
  );
};

export default PostDetailSheet;
