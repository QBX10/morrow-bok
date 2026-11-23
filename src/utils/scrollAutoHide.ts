export interface TopBarScrollVisibilityInput {
  enabled: boolean;
  currentY: number;
  prevY: number;
  wasHidden: boolean;
  pointerNearTop: boolean;
  hasActiveOverlayOrFocusInHeader: boolean;
}

/**
 * Unified scroll-direction visibility rule for the TopBar:
 * - Always visible near top (currentY <= 36px), when hovering top edge, or while typing in header search/menu.
 * - Scroll DOWN past threshold (currentY > 64 && delta > 5) => hide smoothly.
 * - Scroll UP immediately (delta < -3) => reveal immediately & smoothly.
 * - Minor jitter (-3 <= delta <= 5) => preserve previous state to prevent flicker.
 */
export function computeTopBarScrollHidden(input: TopBarScrollVisibilityInput): boolean {
  const {
    enabled,
    currentY,
    prevY,
    wasHidden,
    pointerNearTop,
    hasActiveOverlayOrFocusInHeader,
  } = input;

  if (!enabled || pointerNearTop || hasActiveOverlayOrFocusInHeader) {
    return false;
  }

  const safeY = Math.max(0, currentY);
  if (safeY <= 36) {
    return false;
  }

  const delta = safeY - Math.max(0, prevY);
  if (delta < -3) {
    return false;
  }
  if (delta > 5 && safeY > 64) {
    return true;
  }

  return wasHidden;
}
