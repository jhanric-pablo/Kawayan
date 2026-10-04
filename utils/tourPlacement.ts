/**
 * Placement math for the spotlight tour popover.
 * Pure — no DOM, no React — so it can be asserted in tests/tourPlacement.test.mjs.
 */

export interface Rect { top: number; left: number; width: number; height: number; }
export interface Size { width: number; height: number; }

export interface Placement {
  top: number;
  left: number;
  side: 'top' | 'bottom' | 'center';
}

/**
 * Sit the popover below the anchor when there's room, flip above when there
 * isn't, and clamp it inside the viewport either way. A null anchor (the
 * welcome and finish steps) centres it.
 */
export function placePopover(
  target: Rect | null,
  popover: Size,
  viewport: Size,
  gutter = 12
): Placement {
  if (!target) {
    return {
      top: Math.max(gutter, (viewport.height - popover.height) / 2),
      left: Math.max(gutter, (viewport.width - popover.width) / 2),
      side: 'center',
    };
  }

  const below = target.top + target.height + gutter;
  const above = target.top - popover.height - gutter;
  // Prefer below; flip only when it would overflow AND above actually fits.
  const fitsBelow = below + popover.height + gutter <= viewport.height;
  const side: 'top' | 'bottom' = fitsBelow || above < gutter ? 'bottom' : 'top';

  const top = side === 'bottom'
    ? Math.min(below, Math.max(gutter, viewport.height - popover.height - gutter))
    : above;

  // Centre on the anchor, then clamp into the viewport.
  const centred = target.left + target.width / 2 - popover.width / 2;
  const maxLeft = Math.max(gutter, viewport.width - popover.width - gutter);
  const left = Math.min(Math.max(centred, gutter), maxLeft);

  return { top, left, side };
}
