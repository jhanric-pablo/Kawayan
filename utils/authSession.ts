const JWT_KEY = 'kawayan_jwt';
const SESSION_KEY = 'kawayan_session';
export const VERIF_CACHE_KEY = 'kawayan_verif_status';

export function getStoredToken(): string | null {
  return localStorage.getItem(JWT_KEY);
}

export function readCachedUser(): import('../types').User | null {
  try {
    const session = localStorage.getItem(SESSION_KEY);
    return session ? JSON.parse(session) : null;
  } catch {
    return null;
  }
}

export function getStoredUserId(): string | null {
  const parsed = readCachedUser();
  return parsed?.id ?? (parsed as { userId?: string } | null)?.userId ?? null;
}

export function clearAuthSession(): void {
  localStorage.removeItem(JWT_KEY);
  localStorage.removeItem(SESSION_KEY);
  localStorage.removeItem(VERIF_CACHE_KEY);
}

export function hasAuthSession(): boolean {
  return !!(getStoredToken() && getStoredUserId());
}

export function cacheVerificationStatus(status: string, rejectionReason?: string): void {
  try {
    localStorage.setItem(VERIF_CACHE_KEY, JSON.stringify({ status, rejectionReason }));
  } catch {
    /* ignore */
  }
}

export function readCachedVerificationStatus(): { status: string; rejectionReason?: string } | null {
  try {
    const raw = localStorage.getItem(VERIF_CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Retry a fetch when the backend is still starting (common on rapid refresh). */
export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries = 2,
  delayMs = 350
): Promise<Response> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init);
    } catch (error) {
      lastError = error;
      if (attempt < retries) await sleep(delayMs);
    }
  }
  throw lastError;
}

/** Decode JWT exp claim without verifying signature (client-side expiry hint only). */
export function isStoredTokenExpired(): boolean {
  const token = getStoredToken();
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
    if (!payload.exp) return true;
    return payload.exp * 1000 <= Date.now();
  } catch {
    return true;
  }
}

export function isAuthResponse(status: number): boolean {
  return status === 401 || status === 403;
}

/** Trim + lowercase for consistent login/register lookups. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Remove sensitive fields before persisting user in the browser. */
export function sanitizeUserForSession<T extends { passwordHash?: string }>(user: T): Omit<T, 'passwordHash'> {
  const { passwordHash: _, ...safe } = user;
  return safe;
}
