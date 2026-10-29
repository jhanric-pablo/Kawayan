/**
 * Self-check for the admin dispatch table built from audit logs.
 * Run: npx tsx tests/adminJobs.test.mjs
 */
import assert from 'node:assert/strict';
import { buildJobs } from '../src/utils/adminJobs.ts';

const who = 'Kapebara Café <owner@kapebara.ph> (id:u1)';
const log = (id, action, details, timestamp) => ({ id, user_id: 'u1', action, details, timestamp });
const now = new Date('2026-10-15T12:00:00Z'); // 8 PM in Manila

// 1. "Post now" is a success; tenant, topic, platforms and handles come out of the line.
{
  const [job] = buildJobs([log('1', 'publish_post', `${who} published "Pumpkin spice latte is back" to facebook @kapebaracafe, instagram @kapebara.ph (post:p1)`, '2026-10-12T01:00:00')], now);
  assert.equal(job.status, 'success');
  assert.deepEqual(job.tenant, { name: 'Kapebara Café', email: 'owner@kapebara.ph' });
  assert.equal(job.topic, 'Pumpkin spice latte is back');
  assert.deepEqual(job.platforms, [{ platform: 'facebook', handle: '@kapebaracafe' }, { platform: 'instagram', handle: '@kapebara.ph' }]);
  assert.equal(job.postId, 'p1');
  assert.equal(job.scheduledFor, undefined);
}

// 2. Scheduled with no outcome yet: still ahead in its own time zone → scheduled; already past → awaiting.
{
  const jobs = buildJobs([
    log('2', 'schedule_post', `${who} scheduled for 2026-10-15T21:00:00 (Asia/Manila) "Later tonight" to instagram @kapebara.ph (post:p2)`, '2026-10-15T01:00:00'),
    log('3', 'schedule_post', `${who} scheduled for 2026-10-15T19:00:00 (Asia/Manila) "Earlier tonight" to instagram @kapebara.ph (post:p3)`, '2026-10-15T00:00:00'),
  ], now);
  assert.equal(jobs.find((j) => j.id === '2').status, 'scheduled');
  assert.equal(jobs.find((j) => j.id === '3').status, 'awaiting');
  assert.equal(jobs.find((j) => j.id === '2').timezone, 'Asia/Manila');
}

// 3. A logged outcome wins, but only one logged after the job (a reschedule after a failure starts over).
{
  const jobs = buildJobs([
    log('4', 'schedule_post', `${who} scheduled for 2026-10-13T18:00:00 (Asia/Manila) "Halloween contest" to instagram @kapebara.ph (post:p4)`, '2026-10-12T00:00:00'),
    log('5', 'post_failed', `${who} — scheduled post "Halloween contest" failed to publish and went back to Draft (post:p4)`, '2026-10-13T11:00:00'),
    log('6', 'schedule_post', `${who} scheduled for 2026-10-20T18:00:00 (Asia/Manila) "Halloween contest" to instagram @kapebara.ph (post:p4)`, '2026-10-14T00:00:00'),
    log('7', 'post_published', `${who} — scheduled post "Weekend promo" went live (post:p9)`, '2026-10-14T02:00:00'),
    log('8', 'schedule_post', `${who} scheduled for 2026-10-14T09:00:00 (Asia/Manila) "Weekend promo" to facebook @kapebaracafe (post:p9)`, '2026-10-13T00:00:00'),
  ], now);
  assert.equal(jobs.find((j) => j.id === '4').status, 'failed');
  assert.equal(jobs.find((j) => j.id === '6').status, 'scheduled');
  assert.equal(jobs.find((j) => j.id === '8').status, 'success');
  assert.deepEqual(jobs.map((j) => j.id), ['6', '8', '4']); // newest first; outcome lines aren't jobs
}

// 4. Older lines without a post tag still parse; unrelated or malformed lines are skipped.
{
  const jobs = buildJobs([
    log('9', 'schedule_post', `id:u1 scheduled for 2026-10-01T09:00:00 (Asia/Manila) "Quote "inside" topic" to facebook @x`, '2026-09-30T00:00:00'),
    log('10', 'login', 'User logged in', '2026-10-01T00:00:00'),
    log('11', 'publish_post', 'garbled', '2026-10-01T00:00:00'),
  ], now);
  assert.equal(jobs.length, 1);
  assert.equal(jobs[0].topic, 'Quote "inside" topic');
  assert.deepEqual(jobs[0].tenant, { name: 'id:u1', email: '' });
  assert.equal(jobs[0].status, 'awaiting');
}

console.log('adminJobs: all checks passed');
