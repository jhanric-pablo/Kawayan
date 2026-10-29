const TOUR_KEY = 'kawayan_tour_done';

/**
 * Which users have finished the walkthrough, stored per user id.
 *
 * The other localStorage keys in this app (kawayan_session, kawayan_active_view,
 * kawayan_verif_status) are browser-global, so two accounts sharing a browser
 * share them. The tour flag deliberately does not inherit that: a second person
 * signing up on the same machine should still get their walkthrough.
 *
 * Also deliberately not cleared by clearAuthSession() — logging out should not
 * re-arm the tour on the next login.
 */
function readDone(): string[] {
  try {
    const raw = localStorage.getItem(TOUR_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeDone(ids: string[]): void {
  try {
    localStorage.setItem(TOUR_KEY, JSON.stringify(ids));
  } catch {
    /* ignore — private mode / quota */
  }
}

export function isTourDone(userId: string): boolean {
  return readDone().includes(userId);
}

export function markTourDone(userId: string): void {
  const ids = readDone();
  if (!ids.includes(userId)) writeDone([...ids, userId]);
}

export function resetTour(userId: string): void {
  writeDone(readDone().filter((id) => id !== userId));
}
