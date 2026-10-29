import React from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import { Clock, Ellipsis, ExternalLink, Image as ImageIcon, PanelRight, PencilLine, RotateCcw, Sparkles, Type, Video } from 'lucide-react';
import clsx from 'clsx';
import type { CardStatus, TimelineCardItem } from './mapCalendarEvents';

export type { CardStatus, TimelineCardItem };

const BADGE: Record<CardStatus, string> = {
  idea: 'border-dashed border-(--border-strong) text-(--fg-muted)',
  draft: 'border-(--border) bg-(--bg-alt) text-(--fg-muted)',
  scheduled: 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300',
  published: 'border-badge-border bg-badge text-badge-text',
  failed: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/40 dark:text-red-300',
};
const LABEL: Record<CardStatus, string> = { idea: 'Idea', draft: 'Draft', scheduled: 'Scheduled', published: 'Posted', failed: 'Failed' };

export const StatusBadge: React.FC<{ status: CardStatus; time?: string; className?: string }> = ({ status, time, className }) => (
  <span className={clsx('inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-1.5 py-px text-[10.5px] font-semibold leading-4', BADGE[status], className)}>
    {status === 'scheduled' && time && <Clock className="h-2.5 w-2.5" strokeWidth={2.25} aria-hidden />}
    {status === 'scheduled' && time ? time : LABEL[status]}
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
  const FormatIcon = item.status === 'idea' ? Sparkles : FORMAT_ICON[item.format || 'Image'] || ImageIcon;
  const link = item.post?.externalLink;

  return (
    <div
      className={clsx(
        'relative z-10 rounded-lg border p-1.5 shadow-xs transition-[border-color,transform,box-shadow] duration-150 hover:-translate-y-px hover:shadow-sm motion-reduce:transform-none',
        item.status === 'idea'
          ? 'border-dashed border-(--border-strong) bg-(--bg-alt)'
          : 'border-(--border) bg-(--card) hover:border-(--border-strong)',
        failed && 'border-red-500/40 ring-1 ring-red-500/60',
      )}
    >
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-2 rounded-md text-left" title={item.title}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-(--bg-alt) text-(--fg-subtle)">
            <FormatIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
        )}
        <span className="line-clamp-2 min-w-0 text-[12px] font-semibold leading-[1.3] text-(--fg)">{item.title}</span>
      </button>

      <div className="mt-1.5 flex items-center gap-1">
        <StatusBadge status={item.status} time={item.time} />
        {failed && onRetry && (
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-0.5 rounded px-1 text-[10.5px] font-bold text-red-600 hover:underline dark:text-red-300">
            <RotateCcw className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden /> Retry
          </button>
        )}
        {item.post && (
          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Actions for ${item.title}`}
              className="ml-auto grid h-5 w-5 place-items-center rounded text-(--fg-subtle) hover:bg-(--bg-alt) hover:text-(--fg) data-popup-open:bg-(--bg-alt)"
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
