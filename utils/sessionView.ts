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
    const raw = sessionStorage.getItem(VIEW_STORAGE_KEY);
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
    sessionStorage.setItem(VIEW_STORAGE_KEY, view);
  } catch {
    /* private browsing */
  }
};

export const clearStoredView = (): void => {
  try {
    sessionStorage.removeItem(VIEW_STORAGE_KEY);
  } catch {
    /* private browsing */
  }
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
