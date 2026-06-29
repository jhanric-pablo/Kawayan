import { ViewState } from '../types';

export const VIEW_STORAGE_KEY = 'kawayan_active_view';

export const hasPersistedSession = (): boolean => {
  try {
    return !!(localStorage.getItem('kawayan_jwt') || localStorage.getItem('kawayan_session'));
  } catch {
    return false;
  }
};

export const readStoredView = (): ViewState | null => {
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
    ViewState.INSIGHTS,
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
