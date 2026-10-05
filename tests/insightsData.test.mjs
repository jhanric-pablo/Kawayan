/**
 * Self-check for the Insights demo data, comparison and CSV export.
 * Run: npx tsx tests/insightsData.test.mjs
 */
import assert from 'node:assert/strict';
import {
  dailyHistory, combineHistories, periods, summarize, postStats, postsInPeriod, comparePosts, toCsv,
} from '../utils/insightsData.ts';

const today = new Date(2026, 9, 6, 15); // 6 Oct 2026, mid-afternoon

// 1. Seeded: same account → same numbers; another account → different ones.
{
  const a = dailyHistory('KWYN-1', 'facebook', today);
  assert.deepEqual(a, dailyHistory('KWYN-1', 'facebook', today));
  assert.notDeepEqual(a.at(-1), dailyHistory('KWYN-2', 'facebook', today).at(-1));
  assert.equal(a.at(-1).date, '2026-10-06'); // the history ends today
}

// 2. A date keeps its values as days pass, and "followers now" doesn't depend on the range picked.
{
  const fb = dailyHistory('KWYN-1', 'facebook', today);
  const tomorrow = dailyHistory('KWYN-1', 'facebook', new Date(2026, 9, 7, 9));
  assert.deepEqual(tomorrow.at(-2), fb.at(-1));
  const followersFor = (days) => summarize(...Object.values(periods(fb, days)))[0].current;
  assert.equal(followersFor(7), followersFor(30));
  assert.equal(followersFor(30), followersFor(90));
}

// 3. Previous vs current: windows don't overlap and the change is (current - previous) / previous.
{
  const all = combineHistories(dailyHistory('KWYN-1', 'facebook', today), dailyHistory('KWYN-1', 'instagram', today));
  const { current, previous } = periods(all, 30);
  assert.equal(current.length, 30);
  assert.equal(previous.length, 30);
  assert.ok(previous.at(-1).date < current[0].date);
  const [followers, reach, , rate] = summarize(current, previous);
  assert.equal(followers.current, current.at(-1).followers);
  assert.equal(followers.previous, previous.at(-1).followers);
  const reachNow = current.reduce((s, d) => s + d.reach, 0);
  const reachThen = previous.reduce((s, d) => s + d.reach, 0);
  assert.equal(reach.current, reachNow);
  assert.ok(Math.abs(reach.change - (reachNow - reachThen) / reachThen) < 1e-12);
  assert.ok(rate.points && Math.abs(rate.change - (rate.current - rate.previous)) < 1e-12);
}

// 4. Too few real posts → examples fill in; enough real posts → only real ones.
{
  const post = (id, date) => ({ id, date, topic: id, caption: 'x' });
  const few = postsInPeriod([post('a', '2026-10-01')], 'KWYN-1', 30, 'all', today);
  assert.ok(few.some((p) => p.example) && few.some((p) => p.id === 'a'));
  const many = postsInPeriod(['a', 'b', 'c'].map((id) => post(id, '2026-10-02')), 'KWYN-1', 30, 'all', today);
  assert.ok(many.every((p) => !p.example) && many.length === 3);
  const outside = postsInPeriod([post('old', '2026-08-01')], 'KWYN-1', 30, 'all', today);
  assert.ok(!outside.some((p) => p.id === 'old'));
  const igOnly = postsInPeriod([], 'KWYN-1', 30, 'instagram', today);
  assert.ok(igOnly.length >= 2 && igOnly.every((p) => p.platform === 'instagram'));
}

// 5. Comparison: highest engagement rate wins; ties share a metric.
{
  const a = { ...postStats({ id: 'a', date: '2026-10-01', topic: 'A', caption: '' }), engagementRate: 4.1, reach: 900 };
  const b = { ...a, id: 'b', engagementRate: 6.3, reach: 500 };
  const c = { ...a, id: 'c', engagementRate: 6.3, reach: 700 };
  const { winner, best, wins } = comparePosts([a, b, c]);
  assert.equal(winner.id, 'c'); // tie on rate, more reach
  assert.deepEqual(best.engagementRate, ['b', 'c']);
  assert.deepEqual(best.reach, ['a']);
  assert.ok(wins('a') >= 1);
}

// 6. CSV: quotes, commas and newlines escaped; formula-looking text neutralised; numbers untouched.
{
  const csv = toCsv([['Caption', 'Reach'], ['Sale, today "only"\nlast day', -5], ['=HYPERLINK("x")', 10]]);
  assert.ok(csv.startsWith('﻿'));
  const lines = csv.slice(1).split('\r\n');
  assert.equal(lines[1], '"Sale, today ""only""\nlast day",-5');
  assert.equal(lines[2], `"'=HYPERLINK(""x"")",10`);
}

console.log('insightsData: all checks passed');
