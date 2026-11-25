import assert from 'node:assert/strict';
import test from 'node:test';
import { computeBottomNavCarrierStyle } from './CosmosBottomNav.tsx';

test('computeBottomNavCarrierStyle aligns RTL 4 tabs mathematically with translate3d and zero layout properties', () => {
  for (let idx = 0; idx < 4; idx += 1) {
    const style = computeBottomNavCarrierStyle({
      activeIndex: idx,
      totalItems: 4,
      isRtl: true,
      reducedMotion: false,
    });
    assert.equal(style.width, '25%');
    assert.equal(style.right, 0);
    assert.equal(style.left, undefined);
    assert.equal(style.transform, `translate3d(${-idx * 100}%, 0, 0)`);
    assert.equal(style.willChange, 'transform');
    assert.match(String(style.transition), /cubic-bezier\(0\.22,\s*1,\s*0\.36,\s*1\)/);
  }
});

test('computeBottomNavCarrierStyle handles LTR direction and clamped indices safely', () => {
  const first = computeBottomNavCarrierStyle({
    activeIndex: -5,
    totalItems: 4,
    isRtl: false,
    reducedMotion: true,
  });
  assert.equal(first.left, 0);
  assert.equal(first.right, undefined);
  assert.equal(first.transform, 'translate3d(0%, 0, 0)');
  assert.equal(first.transition, 'none');

  const last = computeBottomNavCarrierStyle({
    activeIndex: 99,
    totalItems: 4,
    isRtl: false,
    reducedMotion: false,
  });
  assert.equal(last.transform, 'translate3d(300%, 0, 0)');
});
