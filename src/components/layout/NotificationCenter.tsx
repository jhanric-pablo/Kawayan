import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '../ui/popover';
import { Tabs } from '@base-ui/react/tabs';
import { Bell, BellOff, CheckCircle2, CircleX, MessageSquare, PencilLine, ShieldCheck, TriangleAlert, Wallet } from 'lucide-react';
import type { Transaction } from '../../services/paymentService';
import type { Ticket } from '../../types';
import clsx from 'clsx';
import { socialService, SocialPlatform } from '../../services/socialService';
import { getStoredToken } from '../../utils/authSession';
import { PLATFORM_LABEL, WorkspaceFeed, platformsFor, readStored, timeAgo } from '../../utils/workspaceFeed';
import { useToast } from '../ui/Toast';

type Tone = 'security' | 'warning' | 'critical' | 'success';

interface Entry {
  key: string;
  Icon: React.ElementType;
  tone: Tone;
  title: string;
  body: string;
  time?: number;
  thumb?: string;
  action?: { label: string; onClick: () => void };
}

const TONE: Record<Tone, string> = {
  security: 'bg-(--muted) text-(--fg)',
  warning: 'bg-(--amber-soft) text-(--amber)',
  critical: 'bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] text-(--danger)',
  success: 'bg-(--green-soft) text-(--green-ink)',
};

/** When this browser's session began: the stored token's issue time. */
const signedInAt = () => {
  try {
    return JSON.parse(atob(getStoredToken()!.split('.')[1].replace(/-/g, '+').replace(/_/g, '/'))).iat * 1000;
  } catch {
    return undefined;
  }
};

const device = () => {
  const ua = navigator.userAgent;
  const browser = /Edg\//.test(ua) ? 'Edge' : /Chrome\//.test(ua) ? 'Chrome' : /Firefox\//.test(ua) ? 'Firefox' : /Safari\//.test(ua) ? 'Safari' : 'A browser';
  const os = /iPhone|iPad/.test(ua) ? 'iOS' : /Android/.test(ua) ? 'Android' : /Mac OS X/.test(ua) ? 'macOS' : /Windows/.test(ua) ? 'Windows' : /Linux/.test(ua) ? 'Linux' : '';
  return os ? `${browser} on ${os}` : browser;
};

const Row: React.FC<{ entry: Entry; fresh?: boolean }> = ({ entry: e, fresh }) => (
  <li className="flex items-start gap-3 border-b border-(--border) px-3.5 py-3 last:border-b-0 hover:bg-(--muted)">
    <span className={clsx('grid h-[30px] w-[30px] shrink-0 place-items-center rounded-lg', TONE[e.tone])}>
      <e.Icon className="h-4 w-4" strokeWidth={2} aria-hidden />
    </span>
    <div className="min-w-0 flex-1">
      <p className="flex items-center gap-1.5 text-ui font-medium text-(--fg)">
        {e.title}
        {fresh && <span className="h-[7px] w-[7px] rounded-full bg-(--green)" aria-label="New" />}
      </p>
      <p className="truncate text-xs text-(--fg-muted)">{e.body}</p>
      <div className="mt-1 flex items-center gap-2">
        {e.time && <span className="mono text-xs text-(--fg-muted)">{timeAgo(e.time)}</span>}
        {e.action && (
          <button type="button" onClick={e.action.onClick} className="text-xs font-medium text-(--fg) underline underline-offset-2 hover:text-(--green-ink)">
            {e.action.label}
          </button>
        )}
      </div>
    </div>
    {e.thumb && <img src={e.thumb} alt="" loading="lazy" className="h-10 w-10 shrink-0 rounded-md border border-(--border) object-cover" />}
  </li>
);

/** Bell + popover: what needs the owner ("Needs you") and everything that happened ("All"). */
const NotificationCenter: React.FC<{
  userId: string;
  feed: WorkspaceFeed;
  onOpenPost: (postId: string) => void;
  /** Wallet transactions, for "Payment received". */
  payments?: Transaction[];
  /** The owner's support tickets, for "Support replied". */
  tickets?: Ticket[];
  onOpenTicket?: (ticketId: string) => void;
  onOpenSettings?: () => void;
}> = ({ userId, feed, onOpenPost, payments = [], tickets = [], onOpenTicket, onOpenSettings }) => {
  const toast = useToast();
  const seenKey = `kawayan_notif_seen_${userId}`;
  const [seenAt, setSeenAt] = useState(() => readStored<number>(seenKey, 0));
  const [open, setOpen] = useState(false);

  const go = (postId: string) => {
    setOpen(false);
    onOpenPost(postId);
  };
  const reconnect = (platform: SocialPlatform) => socialService.connect(platform).catch((e: any) => toast.error(e.message));
  const shortDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });
  const today = new Date().toISOString().slice(0, 10);

  // Scheduled posts going to a page that lost access are held until it's reconnected.
  const heldFor = (platform: SocialPlatform) =>
    feed.posts.filter((p) => p.status === 'Scheduled' && platformsFor(p, feed.channels, feed.accounts).includes(platform));
  const drafts = feed.posts.filter((p) => p.status === 'Draft' && p.date >= today && !feed.failedIds.includes(p.id)).sort((a, b) => a.date.localeCompare(b.date));

  const needs: Entry[] = [
    ...feed.accounts
      .filter((a) => !a.isActive)
      .map((a): Entry => {
        const held = heldFor(a.platform);
        return {
          key: `acct-${a.id}`,
          Icon: TriangleAlert,
          tone: 'critical',
          title: `${PLATFORM_LABEL[a.platform]} access expired`,
          body: held.length ? `${held[0].topic} on ${shortDate(held[0].date)}${held.length > 1 ? ` and ${held.length - 1} more` : ''} ${held.length > 1 ? 'are' : 'is'} held.` : `@${a.username} needs reauthorizing before scheduled posts can go out.`,
          action: { label: 'Fix now', onClick: () => reconnect(a.platform) },
        };
      }),
    ...feed.posts
      .filter((p) => p.status === 'Draft' && feed.failedIds.includes(p.id))
      .map((p): Entry => ({
        key: `fail-${p.id}`,
        Icon: CircleX,
        tone: 'critical',
        title: 'Post didn’t go out',
        body: p.topic,
        thumb: p.imageUrl,
        action: { label: 'Retry', onClick: () => go(p.id) },
      })),
    ...(drafts.length
      ? [{
          key: 'drafts',
          Icon: PencilLine,
          tone: 'security' as Tone,
          title: `${drafts.length} draft${drafts.length > 1 ? 's' : ''} need${drafts.length > 1 ? '' : 's'} approval`,
          body: `${drafts[0].topic} is due ${shortDate(drafts[0].date)}.`,
          action: { label: 'Review', onClick: () => go(drafts[0].id) },
        }]
      : []),
    ...tickets
      .filter((t) => t.status === 'Pending')
      .map((t): Entry => ({
        key: `ticket-${t.id}`,
        Icon: MessageSquare,
        tone: 'security',
        title: `${t.assigneeName ? t.assigneeName.split(' ')[0] : 'Support'} replied to #${t.ticketNum}`,
        body: t.subject,
        time: t.updatedAt ? Date.parse(t.updatedAt) : undefined,
        action: onOpenTicket ? { label: 'Open ticket', onClick: () => { setOpen(false); onOpenTicket(t.id); } } : undefined,
      })),
  ];

  const history: Entry[] = ([
    ...feed.posts
      .filter((p) => p.status === 'Published')
      .map((p): Entry => {
        const where = platformsFor(p, feed.channels, feed.accounts).map((x) => PLATFORM_LABEL[x]).join(' and ');
        return {
          key: p.id,
          Icon: CheckCircle2,
          tone: 'success',
          title: `${p.topic} was posted`,
          body: where || 'Published',
          time: Date.parse(p.publishedAt || `${p.date}T12:00:00`),
          thumb: p.imageUrl,
          action: { label: 'View', onClick: () => go(p.id) },
        };
      }),
    ...payments
      .filter((t) => t.status === 'COMPLETED' && t.type === 'CREDIT')
      .map((t): Entry => ({
        key: `pay-${t.id}`,
        Icon: Wallet,
        tone: 'success',
        title: `Payment received · ₱${Number(t.amount).toLocaleString('en-PH')}`,
        body: t.description,
        time: Date.parse(t.date),
      })),
    { key: 'session', Icon: ShieldCheck, tone: 'security' as Tone, title: 'Signed in on this device', body: device(), time: signedInAt() },
  ] as Entry[])
    .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
    .slice(0, 25);

  const all = [...needs, ...history];
  const issues = needs.length;
  const freshCount = history.filter((h) => (h.time ?? 0) > seenAt).length;
  const unread = issues + freshCount;

  const markRead = () => {
    const now = Date.now();
    setSeenAt(now);
    try {
      localStorage.setItem(seenKey, String(now));
    } catch {
      /* private mode */
    }
  };
  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) feed.reload();
  };

  const empty = (
    <div className="grid justify-items-center gap-2 px-6 py-10 text-center">
      <BellOff className="h-6 w-6 text-(--fg-muted)" strokeWidth={1.75} aria-hidden />
      <p className="text-sm font-semibold">You’re all caught up</p>
      <p className="text-xs text-(--fg-muted)">Expired pages, failed posts, drafts and support replies show up here.</p>
    </div>
  );

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        data-tour="notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-(--fg) transition-colors hover:bg-(--muted) data-popup-open:bg-(--muted)"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {unread > 0 && <span className="absolute right-[7px] top-[6px] h-2 w-2 rounded-full bg-(--green) ring-2 ring-(--bg)" aria-hidden />}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,380px)] gap-0 overflow-hidden rounded-xl p-0">
        <Tabs.Root defaultValue="needs">
          <div className="flex items-center justify-between gap-3 border-b border-(--border) px-3.5 py-2.5">
            <PopoverTitle className="font-sans text-[15px] font-semibold tracking-tight">Notifications</PopoverTitle>
            <Tabs.List className="kw-seg" aria-label="Show">
              <Tabs.Tab value="needs" className="data-active:bg-(--card) data-active:text-(--fg) data-active:shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                Needs you{issues > 0 && <span className="mono ml-1 text-(--danger)">{issues}</span>}
              </Tabs.Tab>
              <Tabs.Tab value="all" className="data-active:bg-(--card) data-active:text-(--fg) data-active:shadow-[0_1px_2px_rgba(0,0,0,0.08)]">All</Tabs.Tab>
            </Tabs.List>
          </div>
          <Tabs.Panel value="needs" className="max-h-[min(60vh,420px)] overflow-y-auto outline-hidden">
            {needs.length ? <ul>{needs.map((e) => <Row key={e.key} entry={e} fresh />)}</ul> : empty}
          </Tabs.Panel>
          <Tabs.Panel value="all" className="max-h-[min(60vh,420px)] overflow-y-auto outline-hidden">
            <ul>{all.map((e) => <Row key={e.key} entry={e} fresh={needs.includes(e) || (e.time ?? 0) > seenAt} />)}</ul>
          </Tabs.Panel>
        </Tabs.Root>
        <div className="flex items-center justify-between border-t border-(--border) px-2.5 py-2">
          <button type="button" className="btn btn-ghost btn-sm" onClick={markRead} disabled={freshCount === 0}>Mark all as read</button>
          {onOpenSettings && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setOpen(false); onOpenSettings(); }}>Settings</button>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
