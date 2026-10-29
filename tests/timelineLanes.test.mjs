/**
 * Self-check for which timeline lane each post and idea lands in.
 * Run: npx tsx tests/timelineLanes.test.mjs
 */
import assert from 'node:assert/strict';
import { bucketByLane } from '../src/components/calendar/mapCalendarEvents.ts';

const month = new Date(2026, 9, 1); // October 2026
const post = (id, date, status) => ({ id, userId: 'u1', date, topic: id, caption: '', imagePrompt: '', status, regenCount: 0, history: [] });
const fb = { id: 'fb1', platform: 'facebook', username: 'cafe', isActive: true };
const ig = { id: 'ig1', platform: 'instagram', username: 'cafe', isActive: true };
const lanesOf = (cells, id) => [...cells].filter(([, items]) => items.some((i) => i.post?.id === id)).map(([k]) => k).sort();

// 1. Drafts haven't gone anywhere: plan lane, even with channels connected.
{
  const { cells } = bucketByLane([post('d', '2026-10-05', 'Draft')], [], month, {}, [fb, ig], []);
  assert.deepEqual(lanesOf(cells, 'd'), ['plan:5']);
}

// 2. A scheduled post goes to the channels recorded for it, with its clock time.
{
  const channels = { s: { platforms: ['instagram'], at: '2026-10-16T09:00:00' } };
  const { cells } = bucketByLane([post('s', '2026-10-16', 'Scheduled')], [], month, channels, [fb, ig], []);
  assert.deepEqual(lanesOf(cells, 's'), ['instagram:16']);
  assert.equal(cells.get('instagram:16')[0].status, 'scheduled');
  assert.match(cells.get('instagram:16')[0].time, /9:00/);
}

// 3. No record (published from another browser): every connected channel, the composer's default.
{
  const { cells } = bucketByLane([post('p', '2026-10-12', 'Published')], [], month, {}, [fb, ig], []);
  assert.deepEqual(lanesOf(cells, 'p'), ['facebook:12', 'instagram:12']);
}

// 4. ...and with nothing connected it falls back to the plan lane rather than vanishing.
{
  const { cells } = bucketByLane([post('p', '2026-10-12', 'Published')], [], month, {}, [], []);
  assert.deepEqual(lanesOf(cells, 'p'), ['plan:12']);
}

// 5. A failed post is a Draft again, but it stays in its channel lane, flagged.
{
  const channels = { f: { platforms: ['facebook'] } };
  const { cells } = bucketByLane([post('f', '2026-10-13', 'Draft')], [], month, channels, [fb, ig], ['f']);
  assert.deepEqual(lanesOf(cells, 'f'), ['facebook:13']);
  assert.equal(cells.get('facebook:13')[0].status, 'failed');
}

// 6. Other months are ignored; an idea shows only on a day without a post.
{
  const ideas = [
    { day: 5, title: 'taken', topic: 't', format: 'Image' },
    { day: 6, title: 'free', topic: 't', format: 'Video' },
  ];
  const posts = [post('d', '2026-10-05', 'Draft'), post('nov', '2026-11-05', 'Draft')];
  const { cells, laneCount } = bucketByLane(posts, ideas, month, {}, [], []);
  assert.equal(lanesOf(cells, 'nov').length, 0);
  assert.deepEqual(cells.get('plan:6').map((i) => [i.status, i.title]), [['idea', 'free']]);
  assert.equal(laneCount.get('plan'), 2); // the draft + the free idea
}

console.log('timelineLanes: all checks passed');
