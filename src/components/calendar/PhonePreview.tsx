import React, { useMemo, useState } from 'react';
import { Tabs } from '@base-ui/react/tabs';
import {
  BatteryFull, Bookmark, Facebook, Globe, Heart, ImagePlus, Instagram, Loader2, MessageCircle, MoreHorizontal, Music2,
  Send, Share2, Signal, ThumbsUp, Wifi,
} from 'lucide-react';
import clsx from 'clsx';
import { TikTokGlyph } from '../SocialAccounts';

export type PreviewPlatform = 'instagram' | 'facebook' | 'tiktok';

const TABS: { id: PreviewPlatform; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { id: 'instagram', label: 'Instagram', Icon: Instagram },
  { id: 'facebook', label: 'Facebook', Icon: Facebook },
  { id: 'tiktok', label: 'TikTok', Icon: TikTokGlyph },
];

const PHOTO_TYPES = /^image\/(jpeg|png|webp)$/;
const fmt = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(1).replace(/\.0$/, '')}K` : `${n}`);

interface Props {
  businessName: string;
  caption?: string;
  imageUrl?: string;
  loadingImage?: boolean;
  defaultPlatform?: PreviewPlatform;
  /** When set, a photo dropped on the media area becomes the post's visual. */
  onDropImage?: (file: File) => void;
  /** Which app tabs to offer (inside Kawayan: only the ones it can post to). */
  tabs?: PreviewPlatform[];
  /** Show made-up likes and comments. Only for marketing samples, never on a real post. */
  sampleStats?: boolean;
}

/** The post as it would look in each app, inside a phone. Read-only apart from photo drops. */
const PhonePreview: React.FC<Props> = ({ businessName, caption, imageUrl, loadingImage, defaultPlatform = 'instagram', onDropImage, tabs, sampleStats = false }) => {
  const [platform, setPlatform] = useState<PreviewPlatform>(defaultPlatform);
  const [dragging, setDragging] = useState(false);
  const likes = useMemo(() => Math.floor(Math.random() * 500) + 10, []);
  const comments = Math.max(1, Math.round(likes / 12));
  const shares = Math.max(1, Math.round(likes / 30));
  const handle = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourbusiness';
  const initials = businessName.substring(0, 2).toUpperCase();
  const tiktok = platform === 'tiktok';

  // Empty: soft skeleton lines (opacity pulse only) instead of placeholder text.
  const captionNode = caption ? (
    <span className="whitespace-pre-wrap wrap-break-word">{caption}</span>
  ) : (
    <span className="mt-1 grid gap-1.5" aria-label="Your caption will show here">
      <span className="kw-skel h-2 w-full rounded-full" />
      <span className="kw-skel h-2 w-11/12 rounded-full" />
      <span className="kw-skel h-2 w-2/3 rounded-full" />
    </span>
  );

  const media = (
    <div
      onDragOver={onDropImage && ((e) => { e.preventDefault(); setDragging(true); })}
      onDragLeave={onDropImage && (() => setDragging(false))}
      onDrop={onDropImage && ((e) => {
        e.preventDefault();
        setDragging(false);
        const file = e.dataTransfer.files[0];
        if (file && PHOTO_TYPES.test(file.type)) onDropImage(file);
      })}
      className={clsx('overflow-hidden bg-(--muted)', tiktok ? 'absolute inset-0 bg-zinc-900' : 'relative aspect-square')}
    >
      {imageUrl ? (
        <img key={imageUrl} src={imageUrl} alt="Post visual" className="h-full w-full object-cover" />
      ) : (
        <div
          className={clsx(
            'absolute inset-0 grid place-content-center justify-items-center gap-1.5 text-center text-[11px] font-medium transition-colors',
            dragging ? 'bg-(--green-soft) text-(--green-ink) ring-2 ring-inset ring-(--green)' : 'kw-skel text-(--fg-subtle)',
          )}
        >
          <ImagePlus className="h-6 w-6 opacity-70" strokeWidth={1.5} aria-hidden />
          {onDropImage ? (dragging ? 'Drop to use this photo' : 'Image appears here, or drop a photo') : 'Image appears here'}
        </div>
      )}
      {imageUrl && dragging && (
        <div className="absolute inset-0 grid place-items-center bg-black/50 text-xs font-medium text-white">Drop to replace</div>
      )}
      {loadingImage && (
        <div className="absolute inset-0 grid place-items-center bg-black/45">
          <Loader2 className="h-7 w-7 animate-spin text-white" aria-label="Creating image" />
        </div>
      )}
    </div>
  );

  return (
    <div className="flex flex-col items-center gap-4">
      <Tabs.Root value={platform} onValueChange={(v) => setPlatform(v as PreviewPlatform)}>
        <Tabs.List aria-label="Preview platform" className="relative inline-flex gap-0.5 rounded-[9px] bg-(--muted) p-[3px]">
          {TABS.filter((t) => !tabs || tabs.includes(t.id)).map(({ id, label, Icon }) => (
            <Tabs.Tab
              key={id}
              value={id}
              className="relative z-1 inline-flex h-7 items-center gap-1.5 rounded-[7px] px-3 text-ui font-medium text-(--fg-muted) outline-hidden transition-colors hover:text-(--fg) focus-visible:ring-2 focus-visible:ring-(--ring) data-active:text-(--fg)"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Tabs.Tab>
          ))}
          <Tabs.Indicator className="absolute left-0 top-(--active-tab-top) h-(--active-tab-height) w-(--active-tab-width) translate-x-(--active-tab-left) rounded-[7px] bg-(--card) shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)] motion-reduce:transition-none" />
        </Tabs.List>
      </Tabs.Root>

      {/* Phone */}
      <div className="w-[264px] shrink-0 rounded-[30px] border border-(--border) bg-(--muted) p-[10px]">
        <div
          className={clsx(
            'relative aspect-9/19 overflow-hidden rounded-[22px] border border-(--border) text-[12px] leading-snug',
            tiktok ? 'bg-black text-white' : 'bg-(--card) text-(--fg)',
          )}
        >
          {/* Status bar + island */}
          <div className={clsx('absolute inset-x-0 top-0 z-20 flex h-9 items-center justify-between px-6 text-[11px] font-semibold', tiktok && 'text-white')}>
            <span>9:41</span>
            <span className="flex items-center gap-1" aria-hidden>
              <Signal className="h-3 w-3" strokeWidth={2.5} />
              <Wifi className="h-3 w-3" strokeWidth={2.5} />
              <BatteryFull className="h-3.5 w-3.5" strokeWidth={2} />
            </span>
          </div>
          <span className="absolute left-1/2 top-2 z-30 h-[22px] w-[80px] -translate-x-1/2 rounded-full bg-black ring-1 ring-zinc-800" aria-hidden />

          {platform === 'instagram' && (
            <div className="absolute inset-0 overflow-y-auto pt-9 scrollbar-none">
              <div className="flex items-center gap-3 px-3 pb-2">
                <span className="font-display text-[17px] font-semibold tracking-tight">Instagram</span>
                <Heart className="ml-auto h-5 w-5" strokeWidth={1.75} aria-hidden />
                <Send className="h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="flex items-center gap-2 border-t border-zinc-100 px-3 py-2 dark:border-zinc-900">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-(--border-strong) p-[2px]">
                  <span className="grid h-full w-full place-items-center rounded-full bg-white text-[9px] font-semibold text-zinc-900 ring-2 ring-white dark:bg-black dark:text-white dark:ring-black">{initials}</span>
                </span>
                <span className="font-semibold">{handle}</span>
                <MoreHorizontal className="ml-auto h-4 w-4" aria-hidden />
              </div>
              {media}
              <div className="flex items-center gap-3.5 px-3 pt-2.5">
                <Heart className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                <MessageCircle className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                <Send className="h-5 w-5" strokeWidth={1.75} aria-hidden />
                <Bookmark className="ml-auto h-5 w-5" strokeWidth={1.75} aria-hidden />
              </div>
              <div className="space-y-1 px-3 pb-5 pt-2">
                {sampleStats && <p className="font-semibold">{fmt(likes)} likes</p>}
                <p><span className="font-semibold">{handle}</span> {captionNode}</p>
                {sampleStats && <p className="text-zinc-500">View all {fmt(comments)} comments</p>}
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Just now</p>
              </div>
            </div>
          )}

          {platform === 'facebook' && (
            <div className="absolute inset-0 overflow-y-auto pt-9 scrollbar-none">
              <p className="px-3 pb-2 text-[20px] font-semibold tracking-tight">facebook</p>
              <div className="border-t-4 border-zinc-100 dark:border-zinc-900">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-(--green) text-[10px] font-semibold text-(--green-fg)">{initials}</span>
                  <div className="min-w-0">
                    <p className="truncate text-[12.5px] font-semibold">{businessName}</p>
                    <p className="flex items-center gap-1 text-[10.5px] text-zinc-500">
                      Just now · <Globe className="h-2.5 w-2.5" aria-hidden />
                    </p>
                  </div>
                  <MoreHorizontal className="ml-auto h-4 w-4 text-zinc-500" aria-hidden />
                </div>
                <p className="px-3 pb-2.5">{captionNode}</p>
                {media}
                {sampleStats && <div className="flex items-center justify-between px-3 py-2 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-(--fg) text-(--bg)"><ThumbsUp className="h-2.5 w-2.5" aria-hidden /></span>
                    <span className="-ml-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#F33E58] text-white ring-2 ring-white dark:ring-black"><Heart className="h-2.5 w-2.5" fill="currentColor" aria-hidden /></span>
                    {fmt(likes)}
                  </span>
                  <span>{fmt(comments)} comments · {fmt(shares)} shares</span>
                </div>}
                <div className="mx-3 flex justify-around border-t border-zinc-200 py-1.5 text-[11.5px] font-semibold text-zinc-500 dark:border-zinc-800">
                  <span className="flex items-center gap-1.5"><ThumbsUp className="h-4 w-4" aria-hidden /> Like</span>
                  <span className="flex items-center gap-1.5"><MessageCircle className="h-4 w-4" aria-hidden /> Comment</span>
                  <span className="flex items-center gap-1.5"><Share2 className="h-4 w-4" aria-hidden /> Share</span>
                </div>
              </div>
            </div>
          )}

          {tiktok && (
            <div className="absolute inset-0">
              {media}
              <div className="pointer-events-none absolute inset-0 bg-linear-to-b from-black/40 via-transparent to-black/75" />
              <p className="absolute inset-x-0 top-10 text-center text-[12.5px] font-semibold text-white/70">
                Following <span className="mx-1 text-white/40">|</span> <span className="text-white">For You</span>
              </p>
              <div className="absolute bottom-24 right-2.5 flex flex-col items-center gap-3.5 text-[10px] font-semibold">
                <span className="relative grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-zinc-800 text-[10px] font-semibold">
                  {initials}
                  <span className="absolute -bottom-2 grid h-4 w-4 place-items-center rounded-full bg-[#FE2C55] text-[11px] leading-none">+</span>
                </span>
                <span className="mt-1 flex flex-col items-center gap-0.5"><Heart className="h-6 w-6" fill="currentColor" aria-hidden />{sampleStats && fmt(likes)}</span>
                <span className="flex flex-col items-center gap-0.5"><MessageCircle className="h-6 w-6" fill="currentColor" aria-hidden />{sampleStats && fmt(comments)}</span>
                <span className="flex flex-col items-center gap-0.5"><Bookmark className="h-6 w-6" fill="currentColor" aria-hidden />{sampleStats && fmt(Math.round(likes / 6))}</span>
                <span className="flex flex-col items-center gap-0.5"><Share2 className="h-6 w-6" aria-hidden />{sampleStats && fmt(shares)}</span>
              </div>
              <div className="absolute inset-x-3 bottom-6 pr-12">
                <p className="mb-1 font-semibold">@{handle}</p>
                <p className="line-clamp-3 text-[11.5px] text-white/90">{captionNode}</p>
                <p className="mt-1.5 flex items-center gap-1 truncate text-[11px]"><Music2 className="h-3 w-3 shrink-0" aria-hidden /> original sound — {businessName}</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PhonePreview;
