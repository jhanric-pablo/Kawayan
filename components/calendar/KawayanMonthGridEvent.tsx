import React from 'react';
import { Check, Image as ImageIcon, Video, Images, Type, Sparkles } from 'lucide-react';

interface Props {
  calendarEvent: {
    title?: string;
    calendarId?: string;
    status?: string;
    kind?: string;
    format?: string;
    imageUrl?: string;
  };
}

const FORMAT_ICONS: Record<string, React.FC<{ className?: string }>> = {
  Image: ImageIcon,
  Video: Video,
  Carousel: Images,
  Text: Type,
};

const STATUS_META: Record<string, { label: string; modifier: string }> = {
  Draft: { label: 'Draft', modifier: 'draft' },
  Scheduled: { label: 'Scheduled', modifier: 'scheduled' },
  Published: { label: 'Published', modifier: 'published' },
};

/** Rich event card: thumbnail, status pill, format icon — Wabi-Sabi styling. */
const KawayanMonthGridEvent: React.FC<Props> = ({ calendarEvent }) => {
  const isPost = calendarEvent.calendarId === 'post' || calendarEvent.kind === 'post';
  const formatKey = calendarEvent.format || (isPost ? 'Image' : 'Idea');
  const FormatIcon = FORMAT_ICONS[formatKey] || (isPost ? ImageIcon : Sparkles);

  const statusMeta = isPost
    ? STATUS_META[calendarEvent.status || 'Draft'] || STATUS_META.Draft
    : { label: 'Idea', modifier: 'idea' };

  const isPublished = isPost && calendarEvent.status === 'Published';
  const hasThumb = Boolean(calendarEvent.imageUrl);

  return (
    <div
      className={`kawayan-sx-event-card transition-all duration-300 ease-out hover:-translate-y-0.5 hover:rotate-[0.5deg] ${
        isPost ? 'kawayan-sx-event-card--post' : 'kawayan-sx-event-card--idea'
      }`}
    >
      <div className="kawayan-sx-event-card__thumb" aria-hidden>
        {hasThumb ? (
          <img
            src={calendarEvent.imageUrl}
            alt=""
            className="kawayan-sx-event-card__img"
            loading="lazy"
          />
        ) : (
          <div className="kawayan-sx-event-card__placeholder">
            <FormatIcon className="kawayan-sx-event-card__format-icon" strokeWidth={2} />
          </div>
        )}
        {isPublished && (
          <span className="kawayan-sx-event-card__check">
            <Check strokeWidth={2.5} />
          </span>
        )}
      </div>

      <div className="kawayan-sx-event-card__body">
        <span className={`kawayan-sx-status kawayan-sx-status--${statusMeta.modifier}`}>
          {statusMeta.label}
        </span>
        <span className="kawayan-sx-event-card__title">{calendarEvent.title}</span>
        {formatKey && formatKey !== 'Idea' && (
          <span className="kawayan-sx-event-card__format">
            <FormatIcon className="kawayan-sx-event-card__format-inline" strokeWidth={2} />
            {formatKey}
          </span>
        )}
      </div>
    </div>
  );
};

export default KawayanMonthGridEvent;
