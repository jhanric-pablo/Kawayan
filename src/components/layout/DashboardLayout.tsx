import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight, MessageSquare, Moon, Plus, Search, Sun, TriangleAlert, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import clsx from 'clsx';
import { GeneratedPost, User, ViewState } from '../../types';
import UniversalDatabaseService from '../../services/universalDatabaseService';
import { socialService, SocialAccount } from '../../services/socialService';
import { paymentService } from '../../services/paymentService';
import { SubscriptionTier, countPostsInMonth, getBatchLimitForSubscription } from '../../utils/tierLimits';
import { HELP_EVENT } from '../../utils/usePhone';
import { Sidebar, SidebarProvider, useSidebar } from '../ui/sidebar';
import { useIsMobile } from '@/hooks/use-mobile';
import { TOUR_OPEN_EVENT } from '../tour/SpotlightTour';
import { MOD_KEY, SideTip, SideToggle, SidebarBridge, useSideOpen } from './shellSidebar';
import {
  FEED_EVENT, PLATFORM_LABEL, PostChannels, WorkspaceFeed, failedPostsKey, postChannelsKey, readStored,
} from '../../utils/workspaceFeed';
import { useToast } from '../ui/Toast';
import NotificationCenter from './NotificationCenter';
import AccountMenu from '../AccountMenu';
const HelpPanel = React.lazy(() => import('../HelpPanel'));
import '../appShell.css';
import { KawayanMark } from '../KawayanLogo';
import type { ThemePref } from '../../utils/sessionView';
import { Transaction } from '../../services/paymentService';
import { supportService } from '../../services/supportService';
import type { Ticket } from '../../types';

export interface NavItem {
  id: ViewState;
  label: string;
  icon: LucideIcon;
  /** Sidebar group: "Plan" (making posts) or "Account". */
  group?: string;
  /** Walkthrough anchor (data-tour). */
  tour?: string;
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
  /** Appearance choice for the account menu (Light / Dark / System). */
  themePref?: ThemePref;
  onChooseTheme?: (pref: ThemePref) => void;
  onReplayTour?: () => void;
  /** Opens a ticket on the Help desk page (notifications). */
  onOpenTicket?: (ticketId: string) => void;
  /** Brand profile name (falls back to the account's business name). */
  businessName?: string;
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
        id="kw-post-search-input"
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
        className="h-[34px] w-full rounded-lg border border-(--border) bg-(--card) pl-9 pr-12 text-ui text-(--fg) outline-hidden transition-colors placeholder:text-(--fg-muted) hover:border-(--border-strong)"
      />
      <kbd className="kw-kbd pointer-events-none absolute right-2 top-1/2 -translate-y-1/2" aria-hidden>{MOD_KEY}K</kbd>
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
                  <img decoding="async" loading="lazy" src={p.imageUrl} alt="" className="h-8 w-8 shrink-0 rounded-md object-cover" />
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
/** Sidebar groups: what you make, then your account. */
const ACCOUNT_VIEWS = new Set<ViewState>([ViewState.SOCIAL, ViewState.BILLING, ViewState.SETTINGS]);


const ENGINE_DOT = { ok: 'bg-(--success)', warn: 'bg-(--amber)', down: 'bg-(--danger)', idle: 'bg-(--fg-subtle)' };

const DashboardLayout: React.FC<Props> = ({ user, view, navItems, phone, account, onNavigate, onHome, onCreatePost, onOpenPost, darkMode, onToggleTheme, themePref, onChooseTheme, onReplayTour, onOpenTicket, businessName, children }) => {
  const toast = useToast();
  const isUser = user.role === 'user';
  const feed = useWorkspaceFeed(isUser ? user.id : undefined);
  const openPost = (postId: string) => onOpenPost(postId, feed.posts.find((p) => p.id === postId)?.date);
  const [noticeHidden, setNoticeHidden] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpEverOpened, setHelpEverOpened] = useState(false);
  useEffect(() => {
    if (helpOpen) setHelpEverOpened(true);
  }, [helpOpen]);
  const [plan, setPlan] = useState<SubscriptionTier | null>(null);
  const [payments, setPayments] = useState<Transaction[]>([]);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const expired = feed.accounts.filter((a) => !a.isActive);

  useEffect(() => {
    if (!isUser) return;
    paymentService
      .getWalletData()
      .then((w) => {
        setPlan(w.subscription);
        setPayments(w.transactions || []);
      })
      .catch(() => setPlan('FREE'));
    supportService.getAllTickets().then(setTickets).catch(() => undefined);
  }, [isUser]);

  // ⌘K / Ctrl+K focuses post search (as in the mockup); Help opens from the sidebar, ⌘/ / Ctrl+/,
  // or the phone account menu (HELP_EVENT).
  useEffect(() => {
    if (!isUser) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        const box = document.getElementById('kw-post-search-input');
        if (box) box.focus();
        else setHelpOpen((o) => !o);
      }
      if ((e.metaKey || e.ctrlKey) && e.key === '/') {
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

  // Desktop: the top-bar toggle (or ⌘/Ctrl+B) collapses the sidebar to an icon rail; remembered on
  // this device. Phones (< 768px): the shadcn Sheet drawer.
  const isMobile = useIsMobile();
  const [sideOpen, chooseSideOpen] = useSideOpen();
  // The sidebar context lives inside the provider; this keeps a handle for closing the phone drawer.
  const sidebarRef = useRef<ReturnType<typeof useSidebar> | null>(null);
  const setDrawerOpen = (open: boolean) => sidebarRef.current?.setOpenMobile(open);
  useEffect(() => {
    const close = () => sidebarRef.current?.setOpenMobile(false);
    window.addEventListener(TOUR_OPEN_EVENT, close);
    return () => window.removeEventListener(TOUR_OPEN_EVENT, close);
  }, []);

  const reconnect = () => socialService.connect(expired[0].platform).catch((e: any) => toast.error(e.message));
  const navButton = (item: NavItem) => ({
    type: 'button' as const,
    'data-tour': item.tour ?? `nav-${item.label.toLowerCase()}`,
    'aria-current': view === item.id ? ('page' as const) : undefined,
    onClick: () => {
      setDrawerOpen(false);
      onNavigate(item.id);
    },
  });

  const current = navItems.find((i) => i.id === view) ?? (view === ViewState.SURVEY ? { label: 'Brand DNA' } : undefined);
  const narrow = !sideOpen && !isMobile; // icon-only sidebar
  const groupOf = (i: NavItem) => i.group ?? (ACCOUNT_VIEWS.has(i.id) ? 'Account' : 'Plan');
  const groups = [
    { label: isUser ? 'Plan' : 'Workspace', items: navItems.filter((i) => groupOf(i) !== 'Account') },
    { label: 'Account', items: navItems.filter((i) => groupOf(i) === 'Account') },
  ].filter((g) => g.items.length);
  const bizName = businessName || user.businessName || 'Kawayan';
  const initials = bizName.split(/\s+/).filter((w) => /^[\p{L}\p{N}]/u.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || 'K';
  const planLabel = plan === 'PRO' ? 'Pro plan' : plan === 'ENTERPRISE' ? 'Enterprise plan' : plan === 'FREE' ? 'Free plan' : '';
  // Badges: drafts waiting (Post studio) and channel problems (Settings).
  const today = new Date().toISOString().slice(0, 10);
  const draftsWaiting = feed.posts.filter((p) => p.status === 'Draft' && p.date >= today).length;
  const badgeFor = (id: ViewState): { n: number; danger?: boolean; label: string } | null => {
    if (!isUser) return null;
    if (id === ViewState.SETTINGS && expired.length) return { n: expired.length, danger: true, label: `${expired.length} channel problem${expired.length > 1 ? 's' : ''}` };
    if (id === ViewState.STUDIO && draftsWaiting) return { n: draftsWaiting, label: `${draftsWaiting} draft${draftsWaiting > 1 ? 's' : ''} waiting` };
    return null;
  };
  const now = new Date();
  const monthName = now.toLocaleDateString('en-PH', { month: 'long' });
  const resets = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString('en-PH', { month: 'short', day: 'numeric' });

  const sidebar = (
    <>
      <button type="button" onClick={() => { setDrawerOpen(false); onHome(); }} className="kw-side__biz" aria-label={`${bizName}, home`}>
        {isUser ? (
          <span className="kw-side__logo kw-side__logo--biz" aria-hidden>{initials}</span>
        ) : (
          <span className="kw-side__logo" aria-hidden><KawayanMark /></span>
        )}
        <span className="kw-side__label min-w-0 text-left">
          <b className="block truncate">{isUser ? bizName : user.businessName || 'Kawayan'}</b>
          <small className="block truncate">{isUser ? planLabel || 'Kawayan workspace' : user.role === 'support' ? 'Support' : 'Kawayan'}</small>
        </span>
      </button>

      <nav aria-label="Main" className="flex flex-col">
        {groups.map((g) => (
          <div key={g.label}>
            <p className="kw-side__grp">{g.label}</p>
            <div className="kw-side__menu">
              {g.items.map((item) => {
                const badge = badgeFor(item.id);
                return (
                  <SideTip key={item.id} label={badge ? `${item.label} · ${badge.label}` : item.label} show={narrow}>
                    <button {...navButton(item)} aria-label={badge ? `${item.label}, ${badge.label}` : item.label} className="kw-side__item">
                      <item.icon className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                      <span className="kw-side__label flex-1 text-left">{item.label}</span>
                      {badge && <span className={clsx('kw-side__badge', badge.danger && 'is-danger')} aria-hidden>{badge.n}</span>}
                    </button>
                  </SideTip>
                );
              })}
              {isUser && g.label === 'Account' && !navItems.some((i) => i.id === ViewState.HELP) && (
                <SideTip label={`Help desk (${MOD_KEY}/)`} show={narrow}>
                  <button
                    type="button"
                    data-tour="help-button"
                    onClick={() => { setDrawerOpen(false); setHelpOpen((o) => !o); }}
                    aria-expanded={helpOpen}
                    aria-label="Help desk"
                    className="kw-side__item"
                  >
                    <MessageSquare className="h-4 w-4 shrink-0" strokeWidth={2} aria-hidden />
                    <span className="kw-side__label flex-1 text-left">Help desk</span>
                  </button>
                </SideTip>
              )}
            </div>
          </div>
        ))}
      </nav>

      {/* Monthly post quota + posting engine */}
      {isUser && (
        <SideTip label={`${monthName} posts ${used} / ${limit} · ${engine.label}`} show={narrow}>
          <div className="kw-side__quota card" data-tour="posts-used">
            <p className="kw-side__label flex items-center justify-between gap-2 text-ui">
              <b className="font-medium text-(--fg)">{monthName} posts</b>
              <span className="mono text-(--fg-muted)">{used} / {limit}</span>
            </p>
            <div className="kw-side__label h-1.5 overflow-hidden rounded-full bg-[color-mix(in_srgb,var(--fg)_9%,transparent)]" role="progressbar" aria-label="Posts used this month" aria-valuemin={0} aria-valuemax={limit} aria-valuenow={used}>
              <div className="h-full rounded-full bg-(--green)" style={{ width: `${Math.min(100, (used / limit) * 100)}%` }} />
            </div>
            <p className="kw-side__label text-xs text-(--fg-muted)">Resets {resets}. Drafts count too.</p>
            <p className="flex items-center gap-2 text-xs text-(--fg-muted)">
              <span className={clsx('inline-flex h-2 w-2 shrink-0 rounded-full', ENGINE_DOT[engine.tone])} aria-hidden />
              <span className="kw-side__label truncate">{engine.label}</span>
              <span className="sr-only">{engine.label}</span>
            </p>
          </div>
        </SideTip>
      )}

      <div className={clsx('kw-side__me', !isUser && 'mt-auto')}>
        <AccountMenu
          user={user}
          plan={plan}
          {...account}
          placement="sidebar"
          onHelpDesk={isUser ? () => (navItems.some((i) => i.id === ViewState.HELP) ? onNavigate(ViewState.HELP) : setHelpOpen(true)) : undefined}
          onTour={onReplayTour}
          themePref={themePref}
          onChooseTheme={onChooseTheme}
        />
      </div>
    </>
  );

  return (
    <SidebarProvider
      open={sideOpen}
      onOpenChange={chooseSideOpen}
      className={clsx('kw-shell', narrow && 'is-collapsed', !isUser && 'kw-shell--staff')}
      style={{ '--sidebar-width': '248px', '--sidebar-width-icon': '64px' } as React.CSSProperties}
    >
      <SidebarBridge sidebarRef={sidebarRef} />
      <Sidebar collapsible="icon" className="border-r-0!" aria-label="Sidebar">
        <div className={clsx('kw-side', !isUser && 'kw-side--staff')}>{sidebar}</div>
      </Sidebar>

      <div className="kw-inset">
        <header className="kw-topbar">
          <SideToggle />
          <span className="kw-vr" aria-hidden />
          <nav aria-label="Breadcrumb" className="kw-crumb flex min-w-0">
            <span className="hidden truncate sm:inline">{isUser ? bizName : user.role === 'support' ? 'Support' : 'Kawayan'}</span>
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
                <NotificationCenter
                  userId={user.id}
                  feed={feed}
                  onOpenPost={openPost}
                  payments={payments}
                  tickets={tickets}
                  onOpenTicket={(id) => (navItems.some((i) => i.id === ViewState.HELP) ? (onOpenTicket ? onOpenTicket(id) : onNavigate(ViewState.HELP)) : setHelpOpen(true))}
                  onOpenSettings={() => onNavigate(ViewState.SETTINGS)}
                />
              </>
            )}
            {onToggleTheme && (
              <button type="button" className="kw-icon-btn" onClick={onToggleTheme} aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}>
                {darkMode ? <Sun className="h-4 w-4" strokeWidth={2} aria-hidden /> : <Moon className="h-4 w-4" strokeWidth={2} aria-hidden />}
              </button>
            )}
          </div>
        </header>

        {isUser && expired.length > 0 && !noticeHidden && view !== ViewState.SOCIAL && view !== ViewState.CALENDAR && (
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

      {/* Loaded on first open (it pulls in the chat client), then kept mounted so it can slide closed. */}
      {isUser && helpEverOpened && (
        <React.Suspense fallback={null}>
          <HelpPanel open={helpOpen} onClose={() => setHelpOpen(false)} />
        </React.Suspense>
      )}
    </SidebarProvider>
  );
};

export default DashboardLayout;
