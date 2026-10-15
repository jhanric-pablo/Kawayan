import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { MessageSquare, Plus, Search, TriangleAlert, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Tooltip } from '@base-ui/react/tooltip';
import { GeneratedPost, User, ViewState } from '../../types';
import UniversalDatabaseService from '../../services/universalDatabaseService';
import { socialService, SocialAccount } from '../../services/socialService';
import { paymentService } from '../../services/paymentService';
import { SubscriptionTier, countPostsInMonth, getBatchLimitForSubscription } from '../../utils/tierLimits';
import { HELP_EVENT } from '../../utils/usePhone';
import {
  FEED_EVENT, PLATFORM_LABEL, PostChannels, WorkspaceFeed, failedPostsKey, postChannelsKey, readStored,
} from '../../utils/workspaceFeed';
import { useToast } from '../ui/Toast';
import NotificationCenter from './NotificationCenter';
import AccountMenu from '../AccountMenu';
import HelpPanel from '../HelpPanel';
import '../appShell.css';

export interface NavItem {
  id: ViewState;
  label: string;
  icon: LucideIcon;
}

interface Props {
  user: User;
  view: ViewState;
  navItems: NavItem[];
  phone: boolean;
  /** Account actions; App owns sign-out, switching, Settings and Billing. */
  account: { onSignOut: () => void; onSwitchAccount?: () => void; onSettings?: () => void; onBilling?: () => void };
  onNavigate: (view: ViewState) => void;
  onHome: () => void;
  onCreatePost: () => void;
  onOpenPost: (postId: string) => void;
  children: React.ReactNode;
}

/**
 * Posts, accounts and stored failures for search, the notification center and channel warnings.
 * The calendar keeps its own copy; this one refetches on FEED_EVENT.
 */
function useWorkspaceFeed(userId?: string): WorkspaceFeed {
  const db = useMemo(() => new UniversalDatabaseService(), []);
  const [posts, setPosts] = useState<GeneratedPost[]>([]);
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [accountsState, setAccountsState] = useState<WorkspaceFeed['accountsState']>('loading');
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!userId) return;
    let live = true;
    db.getUserPosts(userId).then((p) => live && setPosts(p)).catch(() => undefined);
    socialService
      .listAccounts()
      .then((a) => {
        if (!live) return;
        setAccounts(a);
        setAccountsState('ok');
      })
      .catch(() => {
        if (!live) return;
        setAccounts([]);
        setAccountsState('error');
      });
    return () => {
      live = false;
    };
  }, [db, userId, tick]);

  useEffect(() => {
    window.addEventListener(FEED_EVENT, reload);
    return () => window.removeEventListener(FEED_EVENT, reload);
  }, [reload]);

  return {
    posts,
    accounts,
    accountsState,
    failedIds: userId ? readStored<string[]>(failedPostsKey(userId), []) : [],
    channels: userId ? readStored<PostChannels>(postChannelsKey(userId), {}) : {},
    reload,
  };
}

/** Search every post by topic or caption; a hit opens it on the timeline. */
const PostSearch: React.FC<{ posts: GeneratedPost[]; onOpen: (postId: string) => void; onFocus: () => void }> = ({ posts, onOpen, onFocus }) => {
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(false);
  const needle = q.trim().toLowerCase();
  const hits = needle
    ? posts.filter((p) => `${p.topic} ${p.caption}`.toLowerCase().includes(needle)).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8)
    : [];
  const pick = (post: GeneratedPost) => {
    onOpen(post.id);
    setQ('');
    setOpen(false);
  };

  return (
    <div className="relative w-full max-w-sm" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fg-subtle)]" strokeWidth={1.75} aria-hidden />
      <input
        type="search"
        value={q}
        placeholder="Search posts…"
        aria-label="Search posts"
        aria-expanded={open && !!needle}
        aria-controls="kw-post-search"
        onFocus={() => {
          setOpen(true);
          onFocus();
        }}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') setOpen(false);
          if (e.key === 'Enter' && hits[0]) pick(hits[0]);
        }}
        className="h-9 w-full rounded-full border border-[var(--border)] bg-[var(--card)] pl-9 pr-3 text-sm text-[var(--fg)] outline-none transition-colors placeholder:text-[var(--fg-subtle)] hover:border-[var(--border-strong)] focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--ring)]"
      />
      {open && needle && (
        <div
          id="kw-post-search"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-50 mt-2 rounded-xl border border-[var(--border-strong)] bg-[var(--card)] p-1 shadow-xl"
        >
          {hits.length ? (
            hits.map((p) => (
              <button key={p.id} type="button" onClick={() => pick(p)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-[var(--bg-alt)] focus-visible:bg-[var(--bg-alt)]">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-md bg-[var(--bg-alt)]" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-[13px] font-semibold text-[var(--fg)]">{p.topic}</span>
                  <span className="block text-[11px] text-[var(--fg-muted)]">
                    {new Date(`${p.date}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {p.status}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-sm text-[var(--fg-muted)]">No posts match “{q.trim()}”.</p>
          )}
        </div>
      )}
    </div>
  );
};

/** Signed-in app frame: sidebar (tab bar on phones), top bar, channel warnings, then the page. */
/**
 * Names the icon-only sidebar (below lg). Wide sidebars show the text, so the tip stays hidden there.
 * A real tooltip rather than `title`: native ones can stay stuck on screen after a click re-renders the page.
 */
const SideTip: React.FC<{ label: string; children: React.ReactElement }> = ({ label, children }) => (
  <Tooltip.Root>
    <Tooltip.Trigger render={children} />
    <Tooltip.Portal>
      <Tooltip.Positioner side="right" sideOffset={10} className="z-[95] lg:hidden">
        <Tooltip.Popup className="rounded-md bg-[var(--fg)] px-2 py-1 text-xs font-semibold text-[var(--bg)] shadow-lg transition-opacity duration-150 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
          {label}
        </Tooltip.Popup>
      </Tooltip.Positioner>
    </Tooltip.Portal>
  </Tooltip.Root>
);

const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

const ENGINE_DOT = { ok: 'bg-[var(--success)]', warn: 'bg-amber-500', down: 'bg-[var(--danger)]', idle: 'bg-[var(--fg-subtle)]' };

const DashboardLayout: React.FC<Props> = ({ user, view, navItems, phone, account, onNavigate, onHome, onCreatePost, onOpenPost, children }) => {
  const toast = useToast();
  const isUser = user.role === 'user';
  const feed = useWorkspaceFeed(isUser ? user.id : undefined);
  const [noticeHidden, setNoticeHidden] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [plan, setPlan] = useState<SubscriptionTier | null>(null);
  const expired = feed.accounts.filter((a) => !a.isActive);

  useEffect(() => {
    if (!isUser) return;
    paymentService.getWalletData().then((w) => setPlan(w.subscription)).catch(() => setPlan('FREE'));
  }, [isUser]);

  // Help opens from the sidebar, ⌘K / Ctrl+K anywhere, or the phone account menu (HELP_EVENT).
  useEffect(() => {
    if (!isUser) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setHelpOpen((o) => !o);
      }
    };
    const onHelp = () => setHelpOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener(HELP_EVENT, onHelp);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener(HELP_EVENT, onHelp);
    };
  }, [isUser]);

  // Posting engine = Zernio via /api/social: reachable, and whether the pages can still publish.
  const engine =
    feed.accountsState === 'loading' ? { tone: 'idle' as const, label: 'Checking engine…' }
    : feed.accountsState === 'error' ? { tone: 'down' as const, label: 'Posting engine offline' }
    : feed.accounts.length === 0 ? { tone: 'idle' as const, label: 'No pages connected' }
    : expired.length ? { tone: 'warn' as const, label: 'Engine needs attention' }
    : { tone: 'ok' as const, label: 'Engine active' };
  const used = countPostsInMonth(feed.posts, new Date());
  const limit = getBatchLimitForSubscription(plan ?? 'FREE');

  // Fixed bars (toasts, support tray, save bars) read this class to clear the phone tab bar.
  useEffect(() => {
    document.body.classList.toggle('has-tabbar', phone);
    return () => document.body.classList.remove('has-tabbar');
  }, [phone]);

  const reconnect = () => socialService.connect(expired[0].platform).catch((e: any) => toast.error(e.message));
  const navButton = (item: NavItem) => ({
    type: 'button' as const,
    'data-tour': `nav-${item.label.toLowerCase()}`,
    'aria-current': view === item.id ? ('page' as const) : undefined,
    onClick: () => onNavigate(item.id),
  });

  return (
    <div className="flex min-h-screen">
      {!phone && (
        <aside className="sticky top-0 z-40 flex h-screen w-[68px] shrink-0 flex-col border-r border-[var(--border)] bg-[var(--card)] lg:w-60">
          <button type="button" onClick={onHome} className="flex h-14 shrink-0 items-center gap-2.5 px-[18px] lg:px-5" aria-label="Kawayan home">
            <img src="/logo.png" alt="" className="h-8 w-8 rounded-xl object-contain" />
            <span className="hidden font-display text-lg font-bold text-[var(--fg)] lg:inline">
              Kawayan<span className="text-[var(--primary)]">.</span>
            </span>
          </button>
          <nav aria-label="Main" className="flex flex-1 flex-col gap-0.5 px-2.5 py-3 lg:px-3">
            <p className="hidden px-2.5 pb-2 text-[10.5px] font-bold uppercase tracking-[0.1em] text-[var(--fg-subtle)] lg:block">Workspace</p>
            {navItems.map((item) => {
              const active = view === item.id;
              return (
                <SideTip key={item.id} label={item.label}>
                  <button
                    {...navButton(item)}
                    aria-label={item.label}
                    className={clsx(
                      'relative flex h-10 items-center justify-center gap-3 rounded-lg px-2.5 text-[13.5px] font-semibold transition-colors lg:justify-start',
                      active
                        ? 'bg-brand/10 text-[var(--primary)]'
                        : 'text-[var(--fg-muted)] hover:bg-[var(--bg-alt)] hover:text-[var(--fg)]',
                    )}
                  >
                    {active && <span className="absolute -left-2.5 bottom-2 top-2 w-[3px] rounded-r-full bg-brand lg:-left-3" aria-hidden />}
                    <item.icon className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                    <span className="hidden lg:inline">{item.label}</span>
                  </button>
                </SideTip>
              );
            })}
          </nav>

          {/* Dock: engine + quota, help, account */}
          <div className="space-y-2 border-t border-[var(--border)] p-2.5 lg:space-y-2.5 lg:p-3">
            {isUser && (
              <SideTip label={`${engine.label} · ${used} of ${limit} posts used`}>
                <div className="rounded-lg border border-[var(--border)] bg-[var(--bg)] p-2.5">
                  <p className="flex items-center justify-center gap-2 text-[12px] font-semibold text-[var(--fg)] lg:justify-start">
                    <span className="relative flex h-2 w-2 shrink-0" aria-hidden>
                      {(engine.tone === 'ok' || engine.tone === 'warn') && (
                        <span className={clsx('absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 motion-reduce:hidden', ENGINE_DOT[engine.tone])} />
                      )}
                      <span className={clsx('relative inline-flex h-2 w-2 rounded-full', ENGINE_DOT[engine.tone])} />
                    </span>
                    <span className="hidden truncate lg:inline">{engine.label}</span>
                    <span className="sr-only lg:hidden">{engine.label}</span>
                  </p>
                  <div className="mt-2 hidden lg:block">
                    <p className="mb-1.5 flex justify-between text-[11px] text-[var(--fg-muted)]">
                      <span><b className="font-semibold text-[var(--fg)] tabular-nums">{used}</b> of {limit} posts used</span>
                      <span>{new Date().toLocaleDateString('en-PH', { month: 'short' })}</span>
                    </p>
                    <div className="h-1.5 overflow-hidden rounded-full bg-[var(--bg-alt)]" role="progressbar" aria-label="Posts used this month" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
                      <div className="h-full rounded-full bg-[var(--primary)] transition-[width] duration-500" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
                    </div>
                  </div>
                </div>
              </SideTip>
            )}

            {isUser && (
              <SideTip label={`Ask AI / Help (${MOD_KEY}K)`}>
                <button
                  type="button"
                  data-tour="help-button"
                  onClick={() => setHelpOpen((o) => !o)}
                  aria-expanded={helpOpen}
                  aria-label="Ask AI / Help"
                  className="flex h-9 w-full items-center justify-center gap-2.5 rounded-lg px-2.5 text-[13px] font-semibold text-[var(--fg-muted)] transition-colors hover:bg-[var(--bg-alt)] hover:text-[var(--fg)] aria-expanded:bg-[var(--bg-alt)] aria-expanded:text-[var(--fg)] lg:justify-start"
                >
                  <MessageSquare className="h-[18px] w-[18px] shrink-0" strokeWidth={1.75} aria-hidden />
                  <span className="hidden flex-1 text-left lg:inline">Ask AI / Help</span>
                  <kbd className="hidden rounded border border-[var(--border)] bg-[var(--bg)] px-1.5 font-sans text-[10.5px] font-semibold text-[var(--fg-subtle)] lg:inline">
                    {MOD_KEY}K
                  </kbd>
                </button>
              </SideTip>
            )}
          </div>
        </aside>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-40 flex h-14 shrink-0 items-center gap-2 border-b border-[var(--border)] bg-[color-mix(in_srgb,var(--card)_88%,transparent)] px-3 backdrop-blur-md sm:gap-3 sm:px-6">
          {phone && (
            <button type="button" onClick={onHome} aria-label="Kawayan home">
              <img src="/logo.png" alt="" className="h-8 w-8 rounded-xl object-contain" />
            </button>
          )}
          {isUser && !phone ? (
            <PostSearch posts={feed.posts} onOpen={onOpenPost} onFocus={feed.reload} />
          ) : (
            <h2 className="text-sm font-semibold text-[var(--fg)]">{navItems.find((i) => i.id === view)?.label}</h2>
          )}
          <div className="ml-auto flex items-center gap-2">
            {isUser && (
              <>
                <button type="button" onClick={() => onNavigate(ViewState.SOCIAL)} className="btn btn-glass btn-sm hidden lg:inline-flex">
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden /> Connect platform
                </button>
                <button type="button" onClick={onCreatePost} className="btn btn-primary btn-sm" aria-label="Create post">
                  <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  <span className="hidden sm:inline">Create post</span>
                </button>
                <NotificationCenter userId={user.id} feed={feed} onOpenPost={onOpenPost} />
              </>
            )}
            <AccountMenu user={user} plan={plan} {...account} showHelp={phone && isUser} />
          </div>
        </header>

        {isUser && expired.length > 0 && !noticeHidden && view !== ViewState.SOCIAL && (
          <div
            role="alert"
            className="mx-2 mt-4 flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-300 sm:mx-4 lg:mx-6"
          >
            <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <p className="min-w-0 flex-1 text-[13px] leading-snug">
              <b className="font-semibold">Warning:</b> Kawayan lost access to{' '}
              {expired.map((a) => `${PLATFORM_LABEL[a.platform]} (@${a.username})`).join(' and ')}. Reauthorize to prevent publishing delays.
            </p>
            <button
              type="button"
              onClick={reconnect}
              className="rounded-full bg-amber-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-700 dark:bg-amber-400 dark:text-amber-950 dark:hover:bg-amber-300"
            >
              Reconnect now
            </button>
            <button type="button" aria-label="Dismiss" onClick={() => setNoticeHidden(true)} className="grid h-7 w-7 place-items-center rounded-full hover:bg-amber-100 dark:hover:bg-amber-900/40">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}

        <main className="min-w-0 flex-1">{children}</main>
      </div>

      {isUser && <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />}

      {phone && (
        <nav className="kw-tabbar" aria-label="Main">
          {navItems.map((item) => (
            <button key={item.id} {...navButton(item)}>
              <item.icon aria-hidden />
              <span>{item.label}</span>
            </button>
          ))}
        </nav>
      )}
    </div>
  );
};

export default DashboardLayout;
