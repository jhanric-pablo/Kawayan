import React, { useState } from 'react';
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from '../ui/popover';
import { Tabs } from '@base-ui/react/tabs';
import { Bell, BellOff, CheckCircle2, CircleX, ShieldCheck, TriangleAlert } from 'lucide-react';
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

const TAB =
  'relative z-1 flex h-10 items-center gap-1.5 px-2 text-ui font-medium text-(--fg-muted) outline-hidden hover:text-(--fg) focus-visible:text-(--fg) data-active:text-(--fg)';

/** Bell + popover: system alerts (security, channel access, failed posts) and a publishing history. */
const NotificationCenter: React.FC<{ userId: string; feed: WorkspaceFeed; onOpenPost: (postId: string) => void }> = ({ userId, feed, onOpenPost }) => {
  const toast = useToast();
  const seenKey = `kawayan_notif_seen_${userId}`;
  const [seenAt, setSeenAt] = useState(() => readStored<number>(seenKey, 0));
  const [open, setOpen] = useState(false);

  const go = (postId: string) => {
    setOpen(false);
    onOpenPost(postId);
  };
  const reconnect = (platform: SocialPlatform) => socialService.connect(platform).catch((e: any) => toast.error(e.message));

  const alerts: Entry[] = [
    ...feed.accounts
      .filter((a) => !a.isActive)
      .map((a): Entry => ({
        key: `acct-${a.id}`,
        Icon: TriangleAlert,
        tone: 'warning',
        title: `${PLATFORM_LABEL[a.platform]} access expired`,
        body: `@${a.username} needs reauthorizing before scheduled posts can go out.`,
        action: { label: 'Fix now', onClick: () => reconnect(a.platform) },
      })),
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
    { key: 'session', Icon: ShieldCheck, tone: 'security', title: 'Signed in on this device', body: device(), time: signedInAt() },
  ];

  const history: Entry[] = feed.posts
    .filter((p) => p.status === 'Published')
    .map((p): Entry => {
      const where = platformsFor(p, feed.channels, feed.accounts).map((x) => PLATFORM_LABEL[x]).join(' + ');
      return {
        key: p.id,
        Icon: CheckCircle2,
        tone: 'success',
        title: where ? `Published to ${where}` : 'Published',
        body: p.topic,
        time: Date.parse(p.publishedAt || `${p.date}T12:00:00`),
        thumb: p.imageUrl,
        action: { label: 'View', onClick: () => go(p.id) },
      };
    })
    .sort((a, b) => (b.time ?? 0) - (a.time ?? 0))
    .slice(0, 20);

  const issues = alerts.filter((a) => a.action).length;
  const unread = issues + history.filter((h) => (h.time ?? 0) > seenAt).length;

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (next) {
      feed.reload();
    } else {
      const now = Date.now();
      setSeenAt(now);
      try {
        localStorage.setItem(seenKey, String(now));
      } catch {
        /* private mode */
      }
    }
  };

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger
        aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
        data-tour="notifications"
        className="relative grid h-9 w-9 place-items-center rounded-lg text-(--fg) transition-colors hover:bg-(--muted) data-popup-open:bg-(--muted)"
      >
        <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
        {unread > 0 && (
          <span className="mono absolute -right-1 -top-1 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-(--green) px-1 text-2xs font-medium text-(--green-fg) ring-2 ring-(--bg)">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-[min(92vw,380px)] gap-0 overflow-hidden rounded-xl p-0">
        <div className="flex items-center justify-between px-3.5 pb-1 pt-3">
          <PopoverTitle className="font-sans text-[15px] font-semibold tracking-tight">Notifications</PopoverTitle>
          {issues === 0 && (
            <span className="badge badge-green">
              <span className="h-1.5 w-1.5 rounded-full bg-(--green)" aria-hidden /> All systems healthy
            </span>
          )}
        </div>
        <Tabs.Root defaultValue="alerts">
          <Tabs.List className="relative flex gap-2 border-b border-(--border) px-3">
            <Tabs.Tab value="alerts" className={TAB}>
              System alerts
              {issues > 0 && <span className="mono rounded-full bg-[color-mix(in_srgb,var(--danger)_10%,transparent)] px-1.5 text-2xs font-medium text-(--danger)">{issues}</span>}
            </Tabs.Tab>
            <Tabs.Tab value="history" className={TAB}>History log</Tabs.Tab>
            <Tabs.Indicator className="absolute -bottom-px left-0 h-0.5 w-(--active-tab-width) translate-x-(--active-tab-left) rounded-full bg-(--fg) transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.2,1)]" />
          </Tabs.List>
          <Tabs.Panel value="alerts" className="max-h-[min(60vh,420px)] overflow-y-auto outline-hidden">
            <ul>{alerts.map((e) => <Row key={e.key} entry={e} />)}</ul>
          </Tabs.Panel>
          <Tabs.Panel value="history" className="max-h-[min(60vh,420px)] overflow-y-auto outline-hidden">
            {history.length ? (
              <ul>{history.map((e) => <Row key={e.key} entry={e} fresh={(e.time ?? 0) > seenAt} />)}</ul>
            ) : (
              <div className="grid justify-items-center gap-2 px-6 py-10 text-center">
                <BellOff className="h-6 w-6 text-(--fg-subtle)" strokeWidth={1.75} aria-hidden />
                <p className="text-sm font-semibold">Nothing published yet</p>
                <p className="text-xs text-(--fg-muted)">Posts that go live on your pages will be logged here.</p>
              </div>
            )}
          </Tabs.Panel>
        </Tabs.Root>
      </PopoverContent>
    </Popover>
  );
};

export default NotificationCenter;
