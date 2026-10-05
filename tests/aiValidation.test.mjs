/**
 * Self-check: AI content ideas with free-form formats are kept, not dropped.
 * Run: npx tsx tests/aiValidation.test.mjs
 */
import assert from 'node:assert/strict';
import { normalizeFormat, ValidationService } from '../services/validationService.ts';

assert.equal(normalizeFormat('Reel'), 'Video');
assert.equal(normalizeFormat('IGTV'), 'Video');
assert.equal(normalizeFormat('Carousel Image'), 'Carousel');
assert.equal(normalizeFormat('Text post'), 'Text');
assert.equal(normalizeFormat('Story Highlights'), 'Image');
assert.equal(normalizeFormat(undefined), 'Image');

const ideas = ValidationService.validateContentIdeas([
  { day: 5, title: '2-for-1 Pandesal sa Umaga! 🎉', topic: 'Family promo', format: 'Carousel Image' },
  { day: 8, title: 'Tita Lola’s Secret', topic: 'Behind the scenes', format: 'Reel' },
  { day: 40, title: 'Bad day', topic: 'x', format: 'Image' }, // out of range: still dropped
]);
assert.deepEqual(ideas.map((i) => [i.day, i.format]), [[5, 'Carousel'], [8, 'Video']]);

console.log('aiValidation: all checks passed');
