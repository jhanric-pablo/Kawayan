/**
 * The admin dispatch table, rebuilt from the audit trail. Every publish and schedule already
 * writes one line there (server.js /api/social/publish), and /api/social/sync adds the outcome
 * of each scheduled post, both tagged "(post:<id>)" so they can be matched up.
 */

export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  details?: string | null;
  timestamp: string;
}

export type JobStatus = 'success' | 'failed' | 'scheduled' | 'awaiting';

export interface DispatchJob {
  /** The audit entry's id: the job id an operator can search for. */
  id: string;
  userId: string;
  tenant: { name: string; email: string };
  platforms: { platform: string; handle: string }[];
  topic: string;
  /** Wall-clock time in `timezone` ("YYYY-MM-DDTHH:mm:ss"); absent for "post now". */
  scheduledFor?: string;
  timezone?: string;
  loggedAt: string;
  postId?: string;
  status: JobStatus;
}

// Supabase returns timestamptz values with no UTC marker (e.g. "2026-09-16T16:40:30.69"),
// so `new Date(...)` misreads them as local time instead of UTC. Force UTC before parsing.
export const parseUtc = (iso: string): Date => new Date(/[Zz]|[+-]\d\d:\d\d$/.test(iso) ? iso : `${iso}Z`);

export const timeAgo = (iso: string): string => {
  const s = Math.floor((Date.now() - parseUtc(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  return parseUtc(iso).toLocaleDateString();
};

// `<who> published|scheduled for <time> (<tz>) "<topic>" to <platform @handle, …> [(post:<id>)]`
const JOB_RE = /^(.*?) (published|scheduled for (\S+) \(([^)]+)\)) "([\s\S]*)" to (.+?)(?: \(post:([^)]+)\))?$/;
const WHO_RE = /^(.*?) <([^>]*)>/;
const POST_RE = /\(post:([^)]+)\)$/;

/** "Now" as wall-clock time in `tz`, comparable with a parsed `scheduledFor`. */
const nowIn = (tz: string, now: Date) => {
  try {
    return new Date(now.toLocaleString('en-US', { timeZone: tz }));
  } catch {
    return now;
  }
};

export function buildJobs(logs: AuditLog[], now = new Date()): DispatchJob[] {
  // Outcomes per post, so a job only takes an outcome logged after it (a reschedule starts over).
  const outcomes = new Map<string, { at: number; status: JobStatus }[]>();
  for (const log of logs) {
    if (log.action !== 'post_published' && log.action !== 'post_failed') continue;
    const postId = POST_RE.exec(log.details || '')?.[1];
    if (!postId) continue;
    const list = outcomes.get(postId) ?? [];
    list.push({ at: parseUtc(log.timestamp).getTime(), status: log.action === 'post_published' ? 'success' : 'failed' });
    outcomes.set(postId, list);
  }

  const jobs: DispatchJob[] = [];
  for (const log of logs) {
    if (log.action !== 'publish_post' && log.action !== 'schedule_post') continue;
    const m = JOB_RE.exec(log.details || '');
    if (!m) continue;
    const [, who, , scheduledFor, timezone, topic, where, postId] = m;
    const w = WHO_RE.exec(who);
    const loggedAt = parseUtc(log.timestamp).getTime();

    let status: JobStatus;
    if (log.action === 'publish_post') status = 'success';
    else {
      const outcome = postId
        ? (outcomes.get(postId) ?? []).filter((o) => o.at >= loggedAt).sort((a, b) => a.at - b.at)[0]
        : undefined;
      status = outcome?.status ?? (new Date(scheduledFor) > nowIn(timezone, now) ? 'scheduled' : 'awaiting');
    }

    jobs.push({
      id: log.id,
      userId: log.user_id,
      tenant: { name: w ? w[1] : who, email: w ? w[2] : '' },
      platforms: where.split(', ').map((s) => {
        const [platform, handle = ''] = s.split(' ');
        return { platform, handle };
      }),
      topic,
      scheduledFor: log.action === 'schedule_post' ? scheduledFor : undefined,
      timezone: log.action === 'schedule_post' ? timezone : undefined,
      loggedAt: log.timestamp,
      postId,
      status,
    });
  }
  return jobs.sort((a, b) => parseUtc(b.loggedAt).getTime() - parseUtc(a.loggedAt).getTime());
}
