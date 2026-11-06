import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Clock, Ellipsis, ExternalLink, Image as ImageIcon, PanelRight, PencilLine, RotateCcw, Type, Video, CircleDashed } from 'lucide-react';
import clsx from 'clsx';
import type { CardStatus, TimelineCardItem } from './mapCalendarEvents';

export type { CardStatus, TimelineCardItem };

const BADGE: Record<CardStatus, string> = {
  idea: 'border-dashed border-(--border) bg-(--muted) text-(--fg-muted)',
  draft: 'border-dashed border-(--border-strong) bg-(--card) text-(--fg)',
  scheduled: 'border-(--border) bg-(--card) text-(--fg)',
  published: 'border-transparent bg-(--muted) text-(--fg-muted)',
  failed: 'border-[color-mix(in_srgb,var(--danger)_35%,transparent)] bg-[color-mix(in_srgb,var(--danger)_7%,var(--card))] text-(--danger)',
};
// Every Kawayan draft waits for the owner, so drafts read as "Pending approval" everywhere.
const LABEL: Record<CardStatus, string> = { idea: 'Idea', draft: 'Pending approval', scheduled: 'Scheduled', published: 'Posted', failed: 'Failed' };

export const StatusBadge: React.FC<{ status: CardStatus; time?: string; className?: string }> = ({ status, time, className }) => (
  <span className={clsx('inline-flex h-[22px] items-center gap-1.5 whitespace-nowrap rounded-full border px-2 text-xs font-medium', BADGE[status], className)}>
    {(status === 'published' || status === 'failed') && <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />}
    {status === 'scheduled' && time && <Clock className="h-3 w-3 text-(--fg-muted)" strokeWidth={2} aria-hidden />}
    {status === 'scheduled' && time ? <span className="mono">{time}</span> : LABEL[status]}
  </span>
);

const FORMAT_ICON: Record<string, React.ElementType> = { Image: ImageIcon, Video, Text: Type };

interface Props {
  item: TimelineCardItem;
  onOpen: () => void;
  onEdit?: () => void;
  onRetry?: () => void;
}

/** A post (or idea) sitting in its channel lane: thumbnail, headline, status and actions. */
const TimelinePostCard: React.FC<Props> = ({ item, onOpen, onEdit, onRetry }) => {
  const failed = item.status === 'failed';
  const FormatIcon = item.status === 'idea' ? CircleDashed : FORMAT_ICON[item.format || 'Image'] || ImageIcon;
  const link = item.post?.externalLink;

  return (
    <div
      className={clsx(
        'kw-pop relative z-10 rounded-lg border p-1.5 transition-[background-color,transform] duration-150 ease-[cubic-bezier(0.2,0.8,0.2,1)] hover:bg-(--muted) motion-reduce:transform-none',
        item.status === 'idea'
          ? 'border-dashed border-(--border) bg-(--muted)'
          : item.status === 'draft'
            ? 'border-dashed border-(--border-strong) bg-(--card)'
            : item.status === 'published'
              ? 'border-transparent bg-(--green-soft)'
              : 'border-(--border) bg-(--card)',
        failed && 'border-[color-mix(in_srgb,var(--danger)_45%,transparent)]',
      )}
    >
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-2 rounded-md text-left" title={item.title}>
        {item.imageUrl ? (
          <img decoding="async" src={item.imageUrl} alt="" loading="lazy" className="h-8 w-8 shrink-0 rounded object-cover" />
        ) : (
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded bg-(--muted) text-(--fg-muted)">
            <FormatIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
        )}
        <span className="line-clamp-2 min-w-0 text-xs font-medium leading-[1.3] text-(--fg)">{item.title}</span>
      </button>

      <div className="mt-1.5 flex items-center gap-1">
        <StatusBadge status={item.status} time={item.time} />
        {failed && onRetry && (
          <button type="button" onClick={onRetry} className="inline-flex min-h-6 items-center gap-0.5 rounded px-1 text-xs font-medium text-(--danger) hover:underline">
            <RotateCcw className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden /> Retry
          </button>
        )}
        {item.post && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${item.title}`}
              className="ml-auto grid h-6 w-6 place-items-center rounded text-(--fg-muted) hover:bg-(--muted) hover:text-(--fg) data-popup-open:bg-(--muted)"
            >
              <Ellipsis className="h-3.5 w-3.5" strokeWidth={2} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="min-w-[176px]">
              <DropdownMenuItem onClick={onOpen}>
                <PanelRight className="text-(--fg-muted)" aria-hidden /> View details
              </DropdownMenuItem>
              {onEdit && (
                <DropdownMenuItem onClick={onEdit}>
                  <PencilLine className="text-(--fg-muted)" aria-hidden /> Edit in studio
                </DropdownMenuItem>
              )}
              {failed && onRetry && (
                <DropdownMenuItem onClick={onRetry}>
                  <RotateCcw className="text-(--fg-muted)" aria-hidden /> Retry now
                </DropdownMenuItem>
              )}
              {link && (
                <DropdownMenuItem onClick={() => window.open(link, '_blank', 'noopener')}>
                  <ExternalLink className="text-(--fg-muted)" aria-hidden /> View live post
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
};

export default TimelinePostCard;
