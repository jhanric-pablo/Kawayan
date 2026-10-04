/**
 * Self-check for the spotlight tour's popover placement.
 * Run: node tests/tourPlacement.test.mjs
 *
 * No framework on purpose — this is the one runnable check guarding the only
 * non-trivial logic in the tour (flip + clamp), and it must stay cheap to run.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// tourPlacement.ts is plain TS with only type syntax; strip it so node can
// import it without a build step.
const here = dirname(fileURLToPath(import.meta.url));
const src = readFileSync(join(here, '..', 'utils', 'tourPlacement.ts'), 'utf8');
const js = src
  .replace(/export interface [\s\S]*?\n}\n/g, '')
  .replace(/: Rect \| null|: Size|: Placement|: 'top' \| 'bottom'|: number/g, '')
  .replace(/<Placement>|<'top' \| 'bottom'>/g, '');
const { placePopover } = await import(
  'data:text/javascript;base64,' + Buffer.from(js).toString('base64')
);

const VIEWPORT = { width: 1200, height: 800 };
const POPOVER = { width: 340, height: 200 };
const G = 12;

// 1. Room below → sits below, horizontally centred on the anchor.
{
  const anchor = { top: 100, left: 500, width: 120, height: 40 };
  const p = placePopover(anchor, POPOVER, VIEWPORT);
  assert.equal(p.side, 'bottom');
  assert.equal(p.top, 100 + 40 + G);
  assert.equal(p.left, 500 + 60 - 170); // anchor centre - half popover
}

// 2. Anchor near the bottom edge (the support bubble) → flips above.
{
  const anchor = { top: 720, left: 1100, width: 56, height: 56 };
  const p = placePopover(anchor, POPOVER, VIEWPORT);
  assert.equal(p.side, 'top');
  assert.equal(p.top, 720 - POPOVER.height - G);
}

// 3. Anchor hard against the left edge → clamped to the gutter, never negative.
{
  const anchor = { top: 100, left: 0, width: 40, height: 40 };
  const p = placePopover(anchor, POPOVER, VIEWPORT);
  assert.equal(p.left, G);
}

// 4. Anchor hard against the right edge → clamped so it stays on screen.
{
  const anchor = { top: 100, left: 1180, width: 20, height: 40 };
  const p = placePopover(anchor, POPOVER, VIEWPORT);
  assert.equal(p.left, VIEWPORT.width - POPOVER.width - G);
  assert.ok(p.left + POPOVER.width <= VIEWPORT.width);
}

// 5. No anchor → centred.
{
  const p = placePopover(null, POPOVER, VIEWPORT);
  assert.equal(p.side, 'center');
  assert.equal(p.left, (1200 - 340) / 2);
  assert.equal(p.top, (800 - 200) / 2);
}

// 6. Narrow phone viewport, popover wider than the screen → still pinned to the
//    gutter rather than flying off to a negative offset.
{
  const p = placePopover({ top: 50, left: 10, width: 60, height: 30 }, { width: 380, height: 220 }, { width: 390, height: 780 });
  assert.ok(p.left >= 0, `left should stay on screen, got ${p.left}`);
}

// 7. Anchor too tall to fit either way → stays below and clamped inside.
{
  const p = placePopover({ top: 0, left: 500, width: 100, height: 780 }, POPOVER, VIEWPORT);
  assert.ok(p.top + POPOVER.height <= VIEWPORT.height, 'popover must stay in the viewport');
}

console.log('tourPlacement: 7 checks passed');
