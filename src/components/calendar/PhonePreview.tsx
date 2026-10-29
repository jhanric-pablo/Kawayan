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
}

/** The post as it would look in each app, inside a phone. Read-only apart from photo drops. */
const PhonePreview: React.FC<Props> = ({ businessName, caption, imageUrl, loadingImage, defaultPlatform = 'instagram', onDropImage }) => {
  const [platform, setPlatform] = useState<PreviewPlatform>(defaultPlatform);
  const [dragging, setDragging] = useState(false);
  const likes = useMemo(() => Math.floor(Math.random() * 500) + 10, []);
  const comments = Math.max(1, Math.round(likes / 12));
  const shares = Math.max(1, Math.round(likes / 30));
  const handle = businessName.toLowerCase().replace(/[^a-z0-9]+/g, '') || 'yourbusiness';
  const initials = businessName.substring(0, 2).toUpperCase();
  const tiktok = platform === 'tiktok';

  const captionNode = caption ? (
    <span className="whitespace-pre-wrap wrap-break-word">{caption}</span>
  ) : (
    <span className="italic opacity-50">Your caption will show here…</span>
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
      className={clsx('overflow-hidden bg-zinc-100 dark:bg-zinc-900', tiktok ? 'absolute inset-0 bg-zinc-900' : 'relative aspect-square')}
    >
      {imageUrl ? (
        <img key={imageUrl} src={imageUrl} alt="Post visual" className="h-full w-full object-cover" />
      ) : (
        <div
          className={clsx(
            'absolute inset-2.5 grid place-content-center justify-items-center gap-1.5 rounded-xl border-2 border-dashed text-center text-[11px] font-medium transition-colors',
            dragging ? 'border-brand bg-brand/10 text-brand' : 'border-zinc-300 text-zinc-400 dark:border-zinc-700 dark:text-zinc-500',
            tiktok && !dragging && 'border-zinc-700 text-zinc-500',
          )}
        >
          <ImagePlus className="h-6 w-6" strokeWidth={1.5} aria-hidden />
          {onDropImage ? 'Drop a photo here' : 'Visual appears here'}
        </div>
      )}
      {imageUrl && dragging && (
        <div className="absolute inset-0 grid place-items-center bg-brand/40 text-xs font-semibold text-white">Drop to replace</div>
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
        <Tabs.List aria-label="Preview platform" className="relative inline-flex rounded-full border border-(--border) bg-(--card) p-1">
          {TABS.map(({ id, label, Icon }) => (
            <Tabs.Tab
              key={id}
              value={id}
              className="relative z-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-(--fg-muted) outline-hidden transition-colors hover:text-(--fg) focus-visible:ring-2 focus-visible:ring-(--ring) data-active:text-(--fg)"
            >
              <Icon className="h-3.5 w-3.5" /> {label}
            </Tabs.Tab>
          ))}
          <Tabs.Indicator className="absolute left-(--active-tab-left) top-(--active-tab-top) h-(--active-tab-height) w-(--active-tab-width) rounded-full bg-(--bg-alt) ring-1 ring-(--border-strong) transition-[left,width] duration-200 ease-out motion-reduce:transition-none" />
        </Tabs.List>
      </Tabs.Root>

      {/* Phone */}
      <div className="w-[264px] shrink-0 rounded-[2.6rem] bg-zinc-900 p-[9px] shadow-[0_28px_70px_-24px_rgba(0,0,0,0.6)] ring-1 ring-zinc-700/70 dark:bg-zinc-950">
        <div
          className={clsx(
            'relative aspect-9/19 overflow-hidden rounded-[2.1rem] text-[12px] leading-snug',
            tiktok ? 'bg-black text-white' : 'bg-white text-zinc-900 dark:bg-black dark:text-zinc-100',
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
                <span className="grid h-7 w-7 place-items-center rounded-full bg-[linear-gradient(45deg,#f09433,#dc2743_50%,#bc1888)] p-[2px]">
                  <span className="grid h-full w-full place-items-center rounded-full bg-white text-[9px] font-bold text-zinc-900 ring-2 ring-white dark:bg-black dark:text-white dark:ring-black">{initials}</span>
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
                <p className="font-semibold">{fmt(likes)} likes</p>
                <p><span className="font-semibold">{handle}</span> {captionNode}</p>
                <p className="text-zinc-500">View all {fmt(comments)} comments</p>
                <p className="text-[10px] uppercase tracking-wide text-zinc-500">Just now</p>
              </div>
            </div>
          )}

          {platform === 'facebook' && (
            <div className="absolute inset-0 overflow-y-auto pt-9 scrollbar-none">
              <p className="px-3 pb-2 text-[22px] font-bold tracking-tight text-[#1877F2]">facebook</p>
              <div className="border-t-4 border-zinc-100 dark:border-zinc-900">
                <div className="flex items-center gap-2 px-3 py-2.5">
                  <span className="grid h-8 w-8 place-items-center rounded-full bg-[#1877F2] text-[10px] font-bold text-white">{initials}</span>
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
                <div className="flex items-center justify-between px-3 py-2 text-[11px] text-zinc-500">
                  <span className="flex items-center gap-1">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-[#1877F2] text-white"><ThumbsUp className="h-2.5 w-2.5" aria-hidden /></span>
                    <span className="-ml-1.5 grid h-4 w-4 place-items-center rounded-full bg-[#F33E58] text-white ring-2 ring-white dark:ring-black"><Heart className="h-2.5 w-2.5" fill="currentColor" aria-hidden /></span>
                    {fmt(likes)}
                  </span>
                  <span>{fmt(comments)} comments · {fmt(shares)} shares</span>
                </div>
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
                <span className="relative grid h-9 w-9 place-items-center rounded-full border-2 border-white bg-zinc-800 text-[10px] font-bold">
                  {initials}
                  <span className="absolute -bottom-2 grid h-4 w-4 place-items-center rounded-full bg-[#FE2C55] text-[11px] leading-none">+</span>
                </span>
                <span className="mt-1 flex flex-col items-center gap-0.5"><Heart className="h-6 w-6" fill="currentColor" aria-hidden />{fmt(likes)}</span>
                <span className="flex flex-col items-center gap-0.5"><MessageCircle className="h-6 w-6" fill="currentColor" aria-hidden />{fmt(comments)}</span>
                <span className="flex flex-col items-center gap-0.5"><Bookmark className="h-6 w-6" fill="currentColor" aria-hidden />{fmt(Math.round(likes / 6))}</span>
                <span className="flex flex-col items-center gap-0.5"><Share2 className="h-6 w-6" aria-hidden />{fmt(shares)}</span>
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
