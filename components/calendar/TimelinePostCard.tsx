import React from 'react';
import { Menu } from '@base-ui/react/menu';
import { Clock, Ellipsis, ExternalLink, Image as ImageIcon, PanelRight, PencilLine, RotateCcw, Sparkles, Type, Video } from 'lucide-react';
import clsx from 'clsx';
import type { CardStatus, TimelineCardItem } from './mapCalendarEvents';

export type { CardStatus, TimelineCardItem };

const BADGE: Record<CardStatus, string> = {
  idea: 'border-dashed border-[var(--border-strong)] text-[var(--fg-muted)]',
  draft: 'border-[var(--border)] bg-[var(--bg-alt)] text-[var(--fg-muted)]',
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

const MENU_ITEM =
  'flex w-full cursor-default items-center gap-2 rounded-md px-2.5 py-1.5 text-[13px] text-[var(--fg)] outline-none data-[highlighted]:bg-[var(--bg-alt)]';

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
          ? 'border-dashed border-[var(--border-strong)] bg-[var(--bg-alt)]'
          : 'border-[var(--border)] bg-[var(--card)] hover:border-[var(--border-strong)]',
        failed && 'border-red-500/40 ring-1 ring-red-500/60',
      )}
    >
      <button type="button" onClick={onOpen} className="flex w-full items-start gap-2 rounded-md text-left" title={item.title}>
        {item.imageUrl ? (
          <img src={item.imageUrl} alt="" loading="lazy" className="h-9 w-9 shrink-0 rounded-md object-cover" />
        ) : (
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-[var(--bg-alt)] text-[var(--fg-subtle)]">
            <FormatIcon className="h-4 w-4" strokeWidth={1.75} aria-hidden />
          </span>
        )}
        <span className="line-clamp-2 min-w-0 text-[12px] font-semibold leading-[1.3] text-[var(--fg)]">{item.title}</span>
      </button>

      <div className="mt-1.5 flex items-center gap-1">
        <StatusBadge status={item.status} time={item.time} />
        {failed && onRetry && (
          <button type="button" onClick={onRetry} className="inline-flex items-center gap-0.5 rounded px-1 text-[10.5px] font-bold text-red-600 hover:underline dark:text-red-300">
            <RotateCcw className="h-2.5 w-2.5" strokeWidth={2.5} aria-hidden /> Retry
          </button>
        )}
        {item.post && (
          <Menu.Root>
            <Menu.Trigger
              aria-label={`Actions for ${item.title}`}
              className="ml-auto grid h-5 w-5 place-items-center rounded text-[var(--fg-subtle)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)] data-[popup-open]:bg-[var(--bg-alt)]"
            >
              <Ellipsis className="h-3.5 w-3.5" strokeWidth={2} />
            </Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner side="bottom" align="end" sideOffset={4} className="z-[95]">
                <Menu.Popup className="min-w-[176px] origin-[var(--transform-origin)] rounded-lg border border-[var(--border-strong)] bg-[var(--card)] p-1 shadow-lg transition-[transform,opacity] duration-150 data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0">
                  <Menu.Item className={MENU_ITEM} onClick={onOpen}>
                    <PanelRight className="h-3.5 w-3.5 text-[var(--fg-muted)]" aria-hidden /> View details
                  </Menu.Item>
                  {onEdit && (
                    <Menu.Item className={MENU_ITEM} onClick={onEdit}>
                      <PencilLine className="h-3.5 w-3.5 text-[var(--fg-muted)]" aria-hidden /> Edit in studio
                    </Menu.Item>
                  )}
                  {failed && onRetry && (
                    <Menu.Item className={MENU_ITEM} onClick={onRetry}>
                      <RotateCcw className="h-3.5 w-3.5 text-[var(--fg-muted)]" aria-hidden /> Retry now
                    </Menu.Item>
                  )}
                  {link && (
                    <Menu.Item className={MENU_ITEM} onClick={() => window.open(link, '_blank', 'noopener')}>
                      <ExternalLink className="h-3.5 w-3.5 text-[var(--fg-muted)]" aria-hidden /> View live post
                    </Menu.Item>
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        )}
      </div>
    </div>
  );
};

export default TimelinePostCard;
