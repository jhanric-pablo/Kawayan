import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, MessageSquare, Moon, PanelLeft, Plus, Search, Sun, TriangleAlert, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/tooltip';
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
import { KawayanMark } from '../KawayanLogo';
import { useFocusTrap } from '../../utils/useFocusTrap';

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
  /** `date` lets the calendar jump to the post's month before opening it. */
  onOpenPost: (postId: string, date?: string) => void;
  /** Theme toggle in the top bar (same handler as Settings › Appearance). */
  darkMode?: boolean;
  onToggleTheme?: () => void;
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
    <div className="relative w-[200px] lg:w-[240px]" onBlur={(e) => !e.currentTarget.contains(e.relatedTarget) && setOpen(false)}>
      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--fg-muted)" strokeWidth={1.75} aria-hidden />
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
        className="h-[34px] w-full rounded-lg border border-(--border) bg-(--card) pl-9 pr-3 text-ui text-(--fg) outline-hidden transition-colors placeholder:text-(--fg-muted) hover:border-(--border-strong)"
      />
      {open && needle && (
        <div
          id="kw-post-search"
          onMouseDown={(e) => e.preventDefault()}
          className="absolute right-0 top-full z-50 mt-2 w-[min(92vw,340px)] rounded-xl border border-(--border) bg-(--card) p-1 shadow-lg"
        >
          {hits.length ? (
            hits.map((p) => (
              <button key={p.id} type="button" onClick={() => pick(p)} className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left hover:bg-(--bg-alt) focus-visible:bg-(--bg-alt)">
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
                ) : (
                  <span className="h-8 w-8 shrink-0 rounded-md bg-(--bg-alt)" aria-hidden />
                )}
                <span className="min-w-0">
                  <span className="block truncate text-ui font-medium text-(--fg)">{p.topic}</span>
                  <span className="mono block text-xs text-(--fg-muted)">
                    {new Date(`${p.date}T12:00:00`).toLocaleDateString('en-PH', { month: 'short', day: 'numeric', year: 'numeric' })} · {p.status}
                  </span>
                </span>
              </button>
            ))
          ) : (
            <p className="px-3 py-2.5 text-sm text-(--fg-muted)">No posts match “{q.trim()}”.</p>
          )}
        </div>
      )}
    </div>
  );
};

/** Signed-in app frame: grey sidebar (a slide-in drawer on phones), then the page in a rounded inset panel. */
/**
 * Names an icon-only (collapsed) sidebar item. Expanded sidebars show the text, so the tip stays hidden there.
 * A real tooltip rather than `title`: native ones can stay stuck on screen after a click re-renders the page.
 */
const SideTip: React.FC<{ label: string; show: boolean; children: React.ReactElement }> = ({ label, show, children }) => (
  <Tooltip>
    <TooltipTrigger render={children} />
    <TooltipContent side="right" sideOffset={10} className={clsx('font-medium', !show && 'hidden')}>{label}</TooltipContent>
  </Tooltip>
);

/** Sidebar groups: what you make, then your account. */
const ACCOUNT_VIEWS = new Set<ViewState>([ViewState.SOCIAL, ViewState.BILLING, ViewState.SETTINGS]);

const MOD_KEY = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.userAgent) ? '⌘' : 'Ctrl';

const ENGINE_DOT = { ok: 'bg-(--success)', warn: 'bg-(--amber)', down: 'bg-(--danger)', idle: 'bg-(--fg-subtle)' };

const DashboardLayout: React.FC<Props> = ({ user, view, navItems, phone, account, onNavigate, onHome, onCreatePost, onOpenPost, darkMode, onToggleTheme, children }) => {
  const toast = useToast();
  const isUser = user.role === 'user';
  const feed = useWorkspaceFeed(isUser ? user.id : undefined);
  const openPost = (postId: string) => onOpenPost(postId, feed.posts.find((p) => p.id === postId)?.date);
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

  // Desktop: the top-bar toggle collapses the sidebar to icons (starts collapsed on narrow tablets).
  const [collapsed, setCollapsed] = useState(() => typeof window !== 'undefined' && window.innerWidth < 1024);
  // Phones: the sidebar is a drawer.
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  useFocusTrap(drawerRef, phone && drawerOpen);
  useEffect(() => {
    if (!phone) setDrawerOpen(false);
  }, [phone]);
  useEffect(() => {
    if (!drawerOpen) return;
    drawerRef.current?.querySelector<HTMLElement>('[aria-current="page"], button')?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setDrawerOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [drawerOpen]);

  const reconnect = () => socialService.connect(expired[0].platform).catch((e: any) => toast.error(e.message));
  const navButton = (item: NavItem) => ({
    type: 'button' as const,
    'data-tour': `nav-${item.label.toLowerCase()}`,
    'aria-current': view === item.id ? ('page' as const) : undefined,
    onClick: () => {
      setDrawerOpen(false);
      onNavigate(item.id);
    },
  });

  const current = navItems.find((i) => i.id === view) ?? (view === ViewState.SURVEY ? { label: 'Brand DNA' } : undefined);
  const narrow = collapsed && !phone; // icon-only sidebar
  const groups = [
    { label: 'Workspace', items: navItems.filter((i) => !ACCOUNT_VIEWS.has(i.id)) },
    { label: 'Account', items: navItems.filter((i) => ACCOUNT_VIEWS.has(i.id)) },
  ].filter((g) => g.items.length);
  const initial = (user.businessName || user.email)[0]?.toUpperCase();

  const sidebar = (
    <>
      <button type="button" onClick={() => { setDrawerOpen(false); onHome(); }} className="kw-side__biz" aria-label="Kawayan home">
        <span className="kw-side__logo" aria-hidden><KawayanMark /></span>
        <span className="kw-side__label min-w-0 text-left">
          <b className="block truncate">{user.businessName || 'Kawayan'}</b>
          <small className="block truncate">{isUser ? 'Kawayan workspace' : user.role === 'support' ? 'Support' : 'Kawayan'}</small>
        </span>
      </button>

      <nav aria-label="Main" className="flex flex-col">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="kw-side__grp">{g.label}</p>
            <div className="kw-side__menu">
              {g.items.map((item) => (
                <SideTip key={item.id} label={item.label} show={narrow}>
                  <button {...navButton(item)} aria-label={item.label} className="kw-side__item">
                    <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="kw-side__label">{item.label}</span>
                  </button>
                </SideTip>
              ))}
              {isUser && g.label === 'Account' && (
                <SideTip label={`Ask AI / Help (${MOD_KEY}K)`} show={narrow}>
                  <button
                    type="button"
                    data-tour="help-button"
                    onClick={() => { setDrawerOpen(false); setHelpOpen((o) => !o); }}
                    aria-expanded={helpOpen}
                    aria-label="Ask AI / Help"
                    className="kw-side__item"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="kw-side__label flex-1 text-left">Ask AI / Help</span>
                    <kbd className="kw-side__label kw-kbd">{MOD_KEY}K</kbd>
                  </button>
                </SideTip>
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Monthly post quota + posting engine */}
      {isUser && (
        <SideTip label={`${engine.label} · ${used} of ${limit} posts used`} show={narrow}>
          <div className="kw-side__quota card" data-tour="posts-used">
            <p className="flex items-center gap-2 text-ui font-medium text-(--fg)">
              <span className={clsx('inline-flex h-2 w-2 shrink-0 rounded-full', ENGINE_DOT[engine.tone])} aria-hidden />
              <span className="kw-side__label truncate">{engine.label}</span>
              <span className="sr-only">{engine.label}</span>
            </p>
            <div className="kw-side__label">
              <p className="mb-1.5 flex justify-between text-xs text-(--fg-muted)">
                <span><b className="mono font-medium text-(--fg)">{used}</b> of <span className="mono">{limit}</span> posts used</span>
                <span className="mono">{new Date().toLocaleDateString('en-PH', { month: 'short' })}</span>
              </p>
              <div className="h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]" role="progressbar" aria-label="Posts used this month" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
                <div className="h-full rounded-full bg-(--green)" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
              </div>
            </div>
          </div>
        </SideTip>
      )}

      <div className={clsx('kw-side__me', !isUser && 'mt-auto')}>
        <AccountMenu user={user} plan={plan} {...account} placement="sidebar" />
      </div>
    </>
  );

  return (
    <div className={clsx('kw-shell', narrow && 'is-collapsed', !isUser && 'kw-shell--staff')}>
      {!phone && <aside className={clsx('kw-side', !isUser && 'kw-side--staff')}>{sidebar}</aside>}

      {phone && drawerOpen && (
        <div className="kw-drawer" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="kw-drawer__scrim" onClick={() => setDrawerOpen(false)} aria-hidden />
          <aside className={clsx('kw-side kw-drawer__panel', !isUser && 'kw-side--staff')} ref={drawerRef}>
            <button type="button" className="kw-drawer__close" onClick={() => setDrawerOpen(false)} aria-label="Close menu">
              <X className="h-4 w-4" aria-hidden />
            </button>
            {sidebar}
          </aside>
        </div>
      )}

      <div className="kw-inset">
        <header className="kw-topbar">
          <button
            type="button"
            className="kw-icon-btn"
            onClick={() => (phone ? setDrawerOpen(true) : setCollapsed((c) => !c))}
            aria-label={phone ? 'Open menu' : collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={phone ? drawerOpen : !collapsed}
          >
            <PanelLeft className="h-4 w-4" strokeWidth={2} aria-hidden />
          </button>
          <span className="kw-vr" aria-hidden />
          <nav aria-label="Breadcrumb" className="kw-crumb flex min-w-0">
            <span className="hidden truncate sm:inline">{isUser ? 'Workspace' : user.role === 'support' ? 'Support' : 'Kawayan'}</span>
            <ChevronRight className="hidden h-3.5 w-3.5 shrink-0 sm:inline" aria-hidden />
            <b className="truncate" aria-current="page">{current?.label}</b>
          </nav>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {isUser && !phone && <PostSearch posts={feed.posts} onOpen={openPost} onFocus={feed.reload} />}
            {isUser && (
              <>
                {feed.accountsState === 'ok' && feed.accounts.length === 0 && <button type="button" onClick={() => onNavigate(ViewState.SOCIAL)} className="btn btn-outline btn-sm hidden lg:inline-flex">
                  <Plus className="h-4 w-4" strokeWidth={2} aria-hidden /> Connect platform
                </button>}
                <button type="button" onClick={onCreatePost} className="btn btn-primary btn-sm" aria-label="Create post" data-tour="create-post">
                  <Plus className="h-4 w-4" strokeWidth={2.25} aria-hidden />
                  <span className="hidden sm:inline">Create post</span>
                </button>
                <NotificationCenter userId={user.id} feed={feed} onOpenPost={openPost} />
              </>
            )}
            {onToggleTheme && (
              <button type="button" className="kw-icon-btn" onClick={onToggleTheme} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                {darkMode ? <Sun className="h-4 w-4" strokeWidth={2} aria-hidden /> : <Moon className="h-4 w-4" strokeWidth={2} aria-hidden />}
              </button>
            )}
          </div>
        </header>

        {isUser && expired.length > 0 && !noticeHidden && view !== ViewState.SOCIAL && (
          <div role="alert" className="kw-alert kw-alert--warn mx-3 mt-4 sm:mx-6">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
            <p className="min-w-0 flex-1 leading-snug">
              <b className="font-semibold">Warning:</b> Kawayan lost access to{' '}
              {expired.map((a) => `${PLATFORM_LABEL[a.platform]} (@${a.username})`).join(' and ')}. Reauthorize to prevent publishing delays.
            </p>
            <button type="button" onClick={reconnect} className="btn btn-outline btn-sm">
              Reconnect now
            </button>
            <button type="button" aria-label="Dismiss" onClick={() => setNoticeHidden(true)} className="kw-icon-btn h-8! w-8!">
              <X className="h-3.5 w-3.5" aria-hidden />
            </button>
          </div>
        )}

        <main className="min-w-0 flex-1 text-sm">{children}</main>
      </div>

      {isUser && <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />}
    </div>
  );
};

export default DashboardLayout;
