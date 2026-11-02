import React, { useEffect, useRef, useState } from 'react';
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from '../ui/sheet';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import {
  CalendarClock, CheckCircle2, CircleX, Copy, Ellipsis, ExternalLink, Image as ImageIcon, Loader2, PencilLine, RotateCcw, Smartphone, Sparkles, X,
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
}

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
 * What opens when you click a post: when it goes out, to which pages and how each is doing,
 * then the image and caption, the reach score and its history. The phone mockup is one tap away.
 */
const PostDetailSheet: React.FC<Props> = ({ post, profile, platforms, scheduledAt, queuedAt, failed, publishing, onClose, onEdit, onRetry, onMove, inline = false }) => {
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
  if (!p) return null;
  if (inline && !post) return null;

  const phone = typeof window !== 'undefined' && window.matchMedia('(max-width: 639px)').matches;
  const status: CardStatus = failed ? 'failed' : p.status === 'Published' ? 'published' : p.status === 'Scheduled' ? 'scheduled' : 'draft';
  const canMove = !!onMove && (status === 'draft' || status === 'failed');
  const channelText = platforms.map((x) => PLATFORM_LABEL[x]).join(' + ') || 'your pages';
  const dateLabel = new Date(`${p.date}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' });
  const time = clockTime(scheduledAt);

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

  const bodyEl = (
        <div className="flex-1 space-y-5 overflow-y-auto px-5 py-5">
            <Section title="Goes out to">
              {status === 'draft' ? (
                <p className="rounded-lg border border-dashed border-(--border-strong) px-3 py-2.5 text-ui text-(--fg-muted)">
                  Not scheduled yet. Pick the pages and time in the studio.
                </p>
              ) : (
                <ul className="overflow-hidden rounded-lg border border-(--border)">
                  {(platforms.length ? platforms : (['facebook'] as SocialPlatform[])).map((pl, i) => {
                    const Glyph = GLYPH[pl];
                    return (
                      <li key={pl} className={clsx('flex items-center gap-2.5 px-3 py-2.5 text-ui', i > 0 && 'border-t border-(--border)')}>
                        {Glyph && <Glyph className="h-4 w-4" />}
                        <span className="font-medium">{PLATFORM_LABEL[pl]}</span>
                        <StatusBadge status={status} time={time} className="ml-auto" />
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>
  
            <Section
              title={phoneView ? 'Preview' : 'Post'}
              action={
                <button type="button" onClick={() => setPhoneView((v) => !v)} className="inline-flex min-h-8 items-center gap-1 text-xs font-medium text-(--fg) underline-offset-2 hover:underline">
                  {phoneView ? <><ImageIcon className="h-3.5 w-3.5" aria-hidden /> Show post</> : <><Smartphone className="h-3.5 w-3.5" aria-hidden /> Preview on phone</>}
                </button>
              }
            >
              {phoneView ? (
                <PhonePreview key={p.id} businessName={profile.businessName} caption={p.caption} imageUrl={p.imageUrl} defaultPlatform={platforms[0] === 'instagram' ? 'instagram' : 'facebook'} tabs={['facebook', 'instagram']} />
              ) : (
                <div className="space-y-3">
                  {p.imageUrl && <img src={p.imageUrl} alt="" className="aspect-4/3 w-full rounded-lg border border-(--border) object-cover" />}
                  <div className="relative rounded-[10px] border border-(--border) bg-(--muted) px-3 py-3">
                    <p className="whitespace-pre-wrap pr-8 text-ui leading-relaxed text-(--fg)">{p.caption || 'No caption yet.'}</p>
                    {p.caption && (
                      <button type="button" onClick={copyCaption} aria-label="Copy caption" className="absolute right-1.5 top-1.5 grid h-8 w-8 place-items-center rounded-md text-(--fg-muted) hover:bg-(--card) hover:text-(--fg)">
                        <Copy className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    )}
                  </div>
                </div>
              )}
            </Section>
  
            {p.viralityScore != null && (
              <Section title="Reach score">
                <div className="flex items-start gap-3">
                  <b className="mono text-xl font-medium leading-none">{p.viralityScore}</b>
                  <div className="min-w-0 flex-1">
                    <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]">
                      <div className="h-full rounded-full bg-(--green)" style={{ width: `${Math.min(100, p.viralityScore)}%` }} />
                    </div>
                    {p.viralityReason && <p className="mt-1.5 text-xs leading-relaxed text-(--fg-muted)">{p.viralityReason}</p>}
                  </div>
                </div>
              </Section>
            )}
  
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
  
    );
  const moveEl = (
    <>
        {moving && canMove && (
          <div className="flex items-center gap-2 border-t border-border bg-(--bg) px-5 py-3">
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

    </>
  );

  if (inline) {
    return (
      <aside className="kw-detail card" aria-labelledby="kw-detail-title">
        <button type="button" onClick={closeAll} aria-label="Close details" className="absolute right-2 top-2 z-1 grid h-9 w-9 place-items-center rounded-lg text-(--fg-muted) hover:bg-(--muted) hover:text-(--fg)">
          <X className="h-4 w-4" aria-hidden />
        </button>
        <div className="border-b border-border px-4 py-3.5 pr-12">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-(--fg-muted)">
            <StatusBadge status={status} time={time} />
            <span>{dateLabel}{time && status === 'scheduled' ? ` · ${time}` : ''}</span>
          </div>
          <h2 id="kw-detail-title" className="text-[17px] font-semibold leading-snug tracking-tight">{p.topic}</h2>
        </div>

        {bodyEl}
        {moveEl}
        <div className="flex flex-row flex-wrap items-center gap-2 border-t border-border px-4 py-3">
          <button type="button" onClick={() => onEdit(p)} className={clsx('btn btn-sm', failed ? 'btn-outline' : 'btn-primary')}>
            <PencilLine className="h-4 w-4" aria-hidden /> Edit
          </button>
          {canMove && !moving && (
            <button type="button" onClick={() => setMoving(true)} className="btn btn-outline btn-sm">
              <CalendarClock className="h-4 w-4" aria-hidden /> Reschedule
            </button>
          )}
          {failed && (
            <button type="button" onClick={() => onRetry(p)} disabled={publishing} className="btn btn-primary btn-sm">
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />} Retry now
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More actions" className="btn btn-outline btn-sm ml-auto w-8 px-0">
              <Ellipsis className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={copyCaption} disabled={!p.caption}>
                <Copy className="text-(--fg-muted)" aria-hidden /> Copy caption
              </DropdownMenuItem>
              {p.externalLink && (
                <DropdownMenuItem onClick={() => window.open(p.externalLink, '_blank', 'noopener')}>
                  <ExternalLink className="text-(--fg-muted)" aria-hidden /> View live post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </aside>
    );
  }

  return (
    <Sheet open={!!post} onOpenChange={(open) => { if (!open) closeAll(); }}>
      <SheetContent side={phone ? 'bottom' : 'right'} className={clsx('w-full gap-0', phone ? 'max-h-[88vh] rounded-t-2xl' : 'sm:max-w-[440px]')}>
        {phone && <span className="mx-auto mt-2 h-1 w-10 rounded-full bg-(--border-strong)" aria-hidden />}
        <SheetHeader className="border-b border-border px-5 py-4 pr-12">
          <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-(--fg-muted)">
            <StatusBadge status={status} time={time} />
            <span>{dateLabel}{time && status === 'scheduled' ? ` · ${time}` : ''}</span>
          </div>
          <SheetTitle className="font-sans text-[17px] font-semibold leading-snug tracking-tight">{p.topic}</SheetTitle>
        </SheetHeader>

        {bodyEl}
        {moveEl}
        <SheetFooter className="mt-0 flex-row flex-wrap items-center gap-2 border-t border-border px-5 py-3">
          <button type="button" onClick={() => onEdit(p)} className={clsx('btn btn-sm', failed ? 'btn-outline' : 'btn-primary')}>
            <PencilLine className="h-4 w-4" aria-hidden /> Edit
          </button>
          {canMove && !moving && (
            <button type="button" onClick={() => setMoving(true)} className="btn btn-outline btn-sm">
              <CalendarClock className="h-4 w-4" aria-hidden /> Reschedule
            </button>
          )}
          {failed && (
            <button type="button" onClick={() => onRetry(p)} disabled={publishing} className="btn btn-primary btn-sm">
              {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />} Retry now
            </button>
          )}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="More actions" className="btn btn-outline btn-sm ml-auto w-8 px-0">
              <Ellipsis className="h-4 w-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[180px]">
              <DropdownMenuItem onClick={copyCaption} disabled={!p.caption}>
                <Copy className="text-(--fg-muted)" aria-hidden /> Copy caption
              </DropdownMenuItem>
              {p.externalLink && (
                <DropdownMenuItem onClick={() => window.open(p.externalLink, '_blank', 'noopener')}>
                  <ExternalLink className="text-(--fg-muted)" aria-hidden /> View live post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default PostDetailSheet;
