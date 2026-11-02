/**
 * Self-check for the screen ↔ address mapping behind Back/Forward and deep links.
 * Run: npx tsx tests/viewPaths.test.mjs
 */
import assert from 'node:assert/strict';
import { VIEW_PATHS, viewFromPath } from '../src/utils/sessionView.ts';
import { ViewState } from '../src/types.ts';

// Every screen has its own address, and the address leads back to it.
const paths = Object.values(VIEW_PATHS);
assert.equal(new Set(paths).size, paths.length, 'two screens share an address');
for (const view of Object.values(ViewState)) {
  assert.ok(VIEW_PATHS[view], `${view} has no address`);
  assert.equal(viewFromPath(VIEW_PATHS[view]), view);
}

// Trailing slashes are forgiven; unknown addresses are not guessed.
assert.equal(viewFromPath('/insights/'), ViewState.INSIGHTS);
assert.equal(viewFromPath('/'), ViewState.LANDING);
assert.equal(viewFromPath(''), ViewState.LANDING);
assert.equal(viewFromPath('/nope'), null);
assert.equal(viewFromPath('/calendar/extra'), null);

console.log('viewPaths: ok');
