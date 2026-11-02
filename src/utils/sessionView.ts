import { ViewState } from '../types';

export const VIEW_STORAGE_KEY = 'kawayan_active_view';

export const hasPersistedSession = (): boolean => {
  try {
    return !!(localStorage.getItem('kawayan_jwt') || localStorage.getItem('kawayan_session'));
  } catch {
    return false;
  }
};

/** Each screen's address, so Back/Forward work and screens can be linked to. */
export const VIEW_PATHS: Record<ViewState, string> = {
  [ViewState.LANDING]: '/',
  [ViewState.LOGIN]: '/login',
  [ViewState.SIGNUP]: '/signup',
  [ViewState.ADMIN_LOGIN]: '/admin-portal',
  [ViewState.RESET_PASSWORD]: '/reset-password',
  [ViewState.VERIFICATION]: '/verification',
  [ViewState.SURVEY]: '/setup',
  [ViewState.CALENDAR]: '/calendar',
  [ViewState.SETTINGS]: '/settings',
  [ViewState.INSIGHTS]: '/insights',
  [ViewState.SOCIAL]: '/social',
  [ViewState.BILLING]: '/billing',
  [ViewState.SUPPORT_DASHBOARD]: '/support',
  [ViewState.ADMIN_DASHBOARD]: '/admin',
  [ViewState.PLANNER]: '/planner',
  [ViewState.STUDIO]: '/studio',
  [ViewState.HELP]: '/help',
};

/** Screens that read the query string on arrival (payment, social and reset-email returns). */
export const VIEWS_KEEPING_QUERY = new Set<ViewState>([ViewState.BILLING, ViewState.SOCIAL, ViewState.RESET_PASSWORD]);

/** Legal pages, readable by anyone at any time (not part of the screen flow). */
export const LEGAL_PATHS: Record<string, 'terms' | 'privacy' | undefined> = { '/terms': 'terms', '/privacy': 'privacy' };

export const PUBLIC_VIEWS = new Set<ViewState>([ViewState.LANDING, ViewState.LOGIN, ViewState.SIGNUP, ViewState.ADMIN_LOGIN]);

export const viewFromPath = (pathname: string): ViewState | null => {
  const path = pathname.replace(/\/+$/, '') || '/';
  const hit = (Object.entries(VIEW_PATHS) as [ViewState, string][]).find(([, p]) => p === path);
  return hit ? hit[0] : null;
};

export const readStoredView = (): ViewState | null => {
  // An address like /insights wins over the remembered screen; "/" means "wherever I was".
  const fromUrl = typeof window !== 'undefined' ? viewFromPath(window.location.pathname) : null;
  if (fromUrl && fromUrl !== ViewState.LANDING) return fromUrl;
  try {
    // Try localStorage first (survives hard refreshes + tab closes)
    const raw = localStorage.getItem(VIEW_STORAGE_KEY)
      ?? sessionStorage.getItem(VIEW_STORAGE_KEY);
    if (raw && Object.values(ViewState).includes(raw as ViewState)) {
      return raw as ViewState;
    }
  } catch {
    /* private browsing */
  }
  return null;
};

const NON_APP_VIEWS = new Set<ViewState>([
  ViewState.LANDING,
  ViewState.LOGIN,
  ViewState.SIGNUP,
  ViewState.ADMIN_LOGIN,
]);

/** Stored view safe to restore after login or session refresh (never auth/marketing screens). */
export const readRestorableView = (role?: string): ViewState | null => {
  const stored = readStoredView();
  if (!stored || NON_APP_VIEWS.has(stored)) return null;
  if (role) return resolveViewForRole(role, stored);
  return stored;
};

export const writeStoredView = (view: ViewState): void => {
  try {
    localStorage.setItem(VIEW_STORAGE_KEY, view);
    sessionStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    /* private browsing */
  }
};

export const clearStoredView = (): void => {
  try {
    localStorage.removeItem(VIEW_STORAGE_KEY);
    sessionStorage.removeItem(VIEW_STORAGE_KEY);
  } catch {
    /* private browsing */
  }
};

/** Default landing view after login for each role */
export const getHomeViewForRole = (role: string): ViewState => {
  if (role === 'admin') return ViewState.ADMIN_DASHBOARD;
  if (role === 'support') return ViewState.SUPPORT_DASHBOARD;
  return ViewState.CALENDAR;
};

const VIEWS_BY_ROLE: Record<string, ViewState[]> = {
  admin: [ViewState.ADMIN_DASHBOARD],
  support: [ViewState.SUPPORT_DASHBOARD, ViewState.SETTINGS],
  user: [
    ViewState.CALENDAR,
    ViewState.PLANNER,
    ViewState.STUDIO,
    ViewState.HELP,
    ViewState.INSIGHTS,
    ViewState.SOCIAL,
    ViewState.BILLING,
    ViewState.SETTINGS,
    ViewState.VERIFICATION,
    ViewState.SURVEY,
  ],
};

/** Restore a stored view only if the role is allowed to see it */
export const resolveViewForRole = (role: string, preferred?: ViewState | null): ViewState => {
  const home = getHomeViewForRole(role);
  if (!preferred) return home;
  const allowed = VIEWS_BY_ROLE[role] ?? VIEWS_BY_ROLE.user;
  return allowed.includes(preferred) ? preferred : home;
};

export const readThemeFromSession = (): boolean => {
  try {
    const session = localStorage.getItem('kawayan_session');
    if (session) return JSON.parse(session).theme === 'dark';
  } catch {
    /* ignore */
  }
  return false;
};

/** Appearance choice. 'system' is kept on this device; Light and Dark are also saved to the account. */
export type ThemePref = 'light' | 'dark' | 'system';
const THEME_PREF_KEY = 'kawayan_theme_pref';
export const readThemePref = (): ThemePref | null => {
  try {
    return localStorage.getItem(THEME_PREF_KEY) === 'system' ? 'system' : null;
  } catch {
    return null;
  }
};
export const writeThemePref = (pref: ThemePref): void => {
  try {
    if (pref === 'system') localStorage.setItem(THEME_PREF_KEY, 'system');
    else localStorage.removeItem(THEME_PREF_KEY);
  } catch {
    /* private mode */
  }
};
