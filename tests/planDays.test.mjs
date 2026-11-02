/**
 * Self-check for placing a month plan on the calendar: one idea per open day, never stacked.
 * Run: npx tsx tests/planDays.test.mjs
 */
import assert from 'node:assert/strict';
import { normalizeIdeasToBatchCount } from '../src/utils/tierLimits.ts';

const idea = (day, title = `Idea ${day}`) => ({ day, title, topic: title, format: 'Image' });
const days = (list) => list.map((i) => i.day);
const unique = (list) => new Set(days(list)).size === list.length;

// The 29th of a 31-day month, 8 ideas asked for: only 3 open days, so only 3 ideas, one each.
let out = normalizeIdeasToBatchCount([1, 5, 9, 13, 17, 21, 25, 28].map((d) => idea(d)), 8, { minDay: 29, maxDay: 31 });
assert.deepEqual(days(out), [29, 30, 31]);

// A day that already has a post never gets an idea.
out = normalizeIdeasToBatchCount([idea(29), idea(30), idea(31)], 3, { minDay: 29, maxDay: 31 }, new Set([30]));
assert.deepEqual(days(out), [29, 31]);

// Ideas keep their own open day; clashing ones move to free days, spread out, no duplicates.
out = normalizeIdeasToBatchCount([idea(3), idea(3), idea(3), idea(20)], 4, { minDay: 1, maxDay: 28 });
assert.ok(unique(out), 'no two ideas on one day');
assert.ok(days(out).includes(3) && days(out).includes(20));

// Fewer ideas than asked: padded with variations, still one per day.
out = normalizeIdeasToBatchCount([idea(10)], 4, { minDay: 1, maxDay: 28 });
assert.equal(out.length, 4);
assert.ok(unique(out));

// Nothing open, or nothing asked for: no ideas.
assert.deepEqual(normalizeIdeasToBatchCount([idea(31)], 3, { minDay: 31, maxDay: 31 }, new Set([31])), []);
assert.deepEqual(normalizeIdeasToBatchCount([idea(5)], 0, { minDay: 1, maxDay: 28 }), []);

console.log('planDays: ok');
