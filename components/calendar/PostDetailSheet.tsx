import React, { useRef } from 'react';
import { Dialog } from '@base-ui/react/dialog';
import { CalendarClock, CheckCircle2, CircleX, ExternalLink, Loader2, PencilLine, RotateCcw, Sparkles, X } from 'lucide-react';
import clsx from 'clsx';
import { BrandProfile, GeneratedPost } from '../../types';
import type { SocialPlatform } from '../../services/socialService';
import { PLATFORM_LABEL, clockTime } from '../../utils/workspaceFeed';
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
}

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-PH', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });

/** Slide-over with a post's details, a platform preview and what happened to it so far. */
const PostDetailSheet: React.FC<Props> = ({ post, profile, platforms, scheduledAt, queuedAt, failed, publishing, onClose, onEdit, onRetry }) => {
  // Keep the last post on screen while the sheet slides out.
  const last = useRef(post);
  if (post) last.current = post;
  const p = last.current;


  if (!p) return null;

  const status: CardStatus = failed ? 'failed' : p.status === 'Published' ? 'published' : p.status === 'Scheduled' ? 'scheduled' : 'draft';
  const channelText = platforms.map((x) => PLATFORM_LABEL[x]).join(' + ') || 'your pages';

  const log = [
    ...(p.history || []).map((v) => ({ at: v.createdAt, Icon: Sparkles, tone: 'text-[var(--fg-muted)]', text: 'Caption rewritten with AI' })),
    queuedAt && { at: queuedAt, Icon: CalendarClock, tone: 'text-amber-500', text: scheduledAt ? `Queued for ${channelText} · goes out ${when(scheduledAt)}` : `Sent to ${channelText}` },
    p.status === 'Published' && { at: p.publishedAt, Icon: CheckCircle2, tone: 'text-brand', text: `Published to ${channelText}` },
    failed && { at: undefined, Icon: CircleX, tone: 'text-red-500', text: 'Publishing failed. The post went back to drafts.' },
  ]
    .filter((e): e is { at: string | undefined; Icon: typeof Sparkles; tone: string; text: string } => !!e)
    .sort((a, b) => (a.at ?? '9').localeCompare(b.at ?? '9'));

  const dateLabel = new Date(`${p.date}T12:00:00`).toLocaleDateString('en-PH', { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <Dialog.Root open={!!post} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-[100] bg-black/40 backdrop-blur-[2px] transition-opacity duration-300 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
        <Dialog.Popup className="fixed inset-y-0 right-0 z-[101] flex w-full max-w-[440px] flex-col border-l border-[var(--border-strong)] bg-[var(--card)] text-[var(--fg)] shadow-2xl outline-none transition-transform duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] data-[ending-style]:translate-x-full data-[starting-style]:translate-x-full motion-reduce:transition-none">
          <header className="flex items-start gap-3 border-b border-[var(--border)] px-5 py-4">
            <div className="min-w-0 flex-1">
              <div className="mb-1.5 flex items-center gap-2">
                <StatusBadge status={status} time={clockTime(scheduledAt)} />
                <span className="text-xs text-[var(--fg-muted)]">{dateLabel}</span>
              </div>
              <Dialog.Title className="text-base font-bold leading-snug">{p.topic}</Dialog.Title>
            </div>
            <Dialog.Close aria-label="Close" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]">
              <X className="h-4 w-4" />
            </Dialog.Close>
          </header>

          <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
            <section aria-label="Preview">
              <PhonePreview key={p.id} businessName={profile.businessName} caption={p.caption} imageUrl={p.imageUrl} defaultPlatform={platforms[0]} />
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">Details</h3>
              <dl className="grid grid-cols-[112px_1fr] gap-x-3 gap-y-2 text-[13px]">
                <dt className="text-[var(--fg-muted)]">Channels</dt>
                <dd>{status === 'draft' ? 'Not sent yet' : channelText}</dd>
                {scheduledAt && (
                  <>
                    <dt className="text-[var(--fg-muted)]">Scheduled</dt>
                    <dd>{when(scheduledAt)}</dd>
                  </>
                )}
                {p.publishedAt && (
                  <>
                    <dt className="text-[var(--fg-muted)]">Published</dt>
                    <dd>{when(p.publishedAt)}</dd>
                  </>
                )}
                <dt className="text-[var(--fg-muted)]">Format</dt>
                <dd>{p.format || 'Image'}</dd>
                {p.viralityScore != null && (
                  <>
                    <dt className="text-[var(--fg-muted)]">Reach score</dt>
                    <dd>
                      <b className="tabular-nums">{p.viralityScore}</b>/100
                      {p.viralityReason && <span className="mt-0.5 block text-xs text-[var(--fg-muted)]">{p.viralityReason}</span>}
                    </dd>
                  </>
                )}
                <dt className="text-[var(--fg-muted)]">AI rewrites</dt>
                <dd>{p.regenCount} of 2 used</dd>
              </dl>
            </section>

            <section>
              <h3 className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-[var(--fg-subtle)]">Execution log</h3>
              {log.length ? (
                <ol className="relative space-y-3 border-l border-[var(--border-strong)] pl-4">
                  {log.map((e, i) => (
                    <li key={i} className="relative text-[13px]">
                      <span className="absolute -left-[25px] top-0 grid h-[18px] w-[18px] place-items-center rounded-full bg-[var(--card)]">
                        <e.Icon className={clsx('h-3.5 w-3.5', e.tone)} strokeWidth={2} aria-hidden />
                      </span>
                      <p className="leading-snug">{e.text}</p>
                      {e.at && <p className="text-[11px] text-[var(--fg-subtle)]">{when(e.at)}</p>}
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-[13px] text-[var(--fg-muted)]">Draft saved. It hasn’t been scheduled yet.</p>
              )}
            </section>
          </div>

          <footer className="flex flex-wrap justify-end gap-2 border-t border-[var(--border)] px-5 py-3">
            {p.externalLink && (
              <a href={p.externalLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost btn-sm">
                <ExternalLink className="h-4 w-4" aria-hidden /> View live post
              </a>
            )}
            <button type="button" onClick={() => onEdit(p)} className={clsx('btn btn-sm', failed ? 'btn-glass' : 'btn-primary')}>
              <PencilLine className="h-4 w-4" aria-hidden /> {failed ? 'Reschedule' : 'Edit in studio'}
            </button>
            {failed && (
              <button type="button" onClick={() => onRetry(p)} disabled={publishing} className="btn btn-primary btn-sm">
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <RotateCcw className="h-4 w-4" aria-hidden />} Retry now
              </button>
            )}
          </footer>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  );
};

export default PostDetailSheet;
