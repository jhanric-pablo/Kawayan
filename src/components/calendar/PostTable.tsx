import React from 'react';
import { Sparkles } from 'lucide-react';
import { FacebookGlyph, InstagramGlyph } from '../SocialAccounts';
import { StatusBadge } from './TimelinePostCard';
import type { TimelineCardItem } from './mapCalendarEvents';

interface Props {
  month: Date;
  items: TimelineCardItem[];
  selectedPostId?: string | null;
  onOpenPost: (item: TimelineCardItem) => void;
  onOpenIdea: (item: TimelineCardItem) => void;
}

const GLYPH: Record<string, React.FC<{ className?: string }>> = { facebook: FacebookGlyph, instagram: InstagramGlyph };
const NAME: Record<string, string> = { facebook: 'Facebook', instagram: 'Instagram' };

/** The calendar's List view (mockup .tbl): post, when, channels, status and reach, one row per post or idea. */
const PostTable: React.FC<Props> = ({ month, items, selectedPostId, onOpenPost, onOpenIdea }) => {
  if (!items.length) {
    return (
      <div className="grid justify-items-center gap-1 px-6 py-14 text-center">
        <p className="font-semibold">Nothing planned for {month.toLocaleDateString('en-PH', { month: 'long', year: 'numeric' })}</p>
        <p className="max-w-sm text-xs text-(--fg-muted)">Click a day in Month view, or use Plan month to draft the whole month.</p>
      </div>
    );
  }
  const when = (item: TimelineCardItem) => {
    const d = new Date(month.getFullYear(), month.getMonth(), item.day);
    return `${d.toLocaleDateString('en-PH', { weekday: 'short', month: 'short', day: 'numeric' })}${item.time ? ` · ${item.time}` : ''}`;
  };

  return (
    <div className="scroll-x">
      <table className="kw-tbl">
        <thead>
          <tr>
            <th scope="col">Post</th>
            <th scope="col">When</th>
            <th scope="col">Channels</th>
            <th scope="col">Status</th>
            <th scope="col" className="text-right">Reach</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const open = () => (item.post ? onOpenPost(item) : onOpenIdea(item));
            const selected = !!item.post && item.post.id === selectedPostId;
            return (
              <tr key={item.key} onClick={open} className={selected ? 'is-selected' : undefined}>
                <td>
                  <button type="button" className="flex min-h-9 items-center gap-2.5 text-left" onClick={(e) => { e.stopPropagation(); open(); }} aria-pressed={selected || undefined}>
                    {item.imageUrl ? (
                      <img src={item.imageUrl} alt="" loading="lazy" className="h-[30px] w-[30px] shrink-0 rounded-md object-cover" />
                    ) : (
                      <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-md bg-(--muted) text-(--fg-muted)"><Sparkles className="h-3.5 w-3.5" aria-hidden /></span>
                    )}
                    <span className={item.status === 'idea' ? 'text-(--fg-muted)' : 'font-medium'}>{item.title}</span>
                  </button>
                </td>
                <td className="mono whitespace-nowrap text-(--fg-muted)">{when(item)}</td>
                <td>
                  <div className="flex flex-wrap gap-1">
                    {item.platforms?.length ? (
                      item.platforms.map((pl) => {
                        const Glyph = GLYPH[pl];
                        return (
                          <span key={pl} className="badge">
                            {Glyph && <Glyph className="h-3 w-3" />} {NAME[pl] ?? pl}
                          </span>
                        );
                      })
                    ) : (
                      <span className="text-xs text-(--fg-muted)">—</span>
                    )}
                  </div>
                </td>
                <td>
                  {item.held ? (
                    <span className="badge badge-red"><span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden />Held</span>
                  ) : (
                    <StatusBadge status={item.status} />
                  )}
                </td>
                <td className="mono text-right">{item.post?.viralityScore ?? '—'}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PostTable;
