import assert from 'node:assert/strict';
import test from 'node:test';
import { computeTopBarScrollHidden } from './scrollAutoHide.ts';

test('TopBar auto-hide hides smoothly when scrolling down past 64px', () => {
  const hidden = computeTopBarScrollHidden({
    enabled: true,
    currentY: 120,
    prevY: 80,
    wasHidden: false,
    pointerNearTop: false,
    hasActiveOverlayOrFocusInHeader: false,
  });
  assert.equal(hidden, true);
});

test('TopBar auto-hide reveals immediately when scrolling up even 5px', () => {
  const hidden = computeTopBarScrollHidden({
    enabled: true,
    currentY: 315,
    prevY: 320,
    wasHidden: true,
    pointerNearTop: false,
    hasActiveOverlayOrFocusInHeader: false,
  });
  assert.equal(hidden, false);
});

test('TopBar stays visible near top of page (<= 36px) or when pointer nears top', () => {
  assert.equal(
    computeTopBarScrollHidden({
      enabled: true,
      currentY: 28,
      prevY: 60,
      wasHidden: true,
      pointerNearTop: false,
      hasActiveOverlayOrFocusInHeader: false,
    }),
    false
  );

  assert.equal(
    computeTopBarScrollHidden({
      enabled: true,
      currentY: 420,
      prevY: 410,
      wasHidden: true,
      pointerNearTop: true,
      hasActiveOverlayOrFocusInHeader: false,
    }),
    false
  );
});

test('TopBar ignores micro-jitter and preserves state when disabled', () => {
  assert.equal(
    computeTopBarScrollHidden({
      enabled: true,
      currentY: 202,
      prevY: 200,
      wasHidden: true,
      pointerNearTop: false,
      hasActiveOverlayOrFocusInHeader: false,
    }),
    true
  );

  assert.equal(
    computeTopBarScrollHidden({
      enabled: false,
      currentY: 500,
      prevY: 100,
      wasHidden: false,
      pointerNearTop: false,
      hasActiveOverlayOrFocusInHeader: false,
    }),
    false
  );
});
