import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createDelayedLoadingController,
  DELAYED_LOADER_THRESHOLD_MS,
  trackDelayedLoading,
  type TimerDriver,
} from './delayedLoader.ts';

function createFakeTimers() {
  let now = 0;
  let nextId = 1;
  const tasks = new Map<number, { runAt: number; fn: () => void }>();

  const driver: TimerDriver = {
    setTimeout: (fn, ms) => {
      const id = nextId++;
      tasks.set(id, { runAt: now + ms, fn });
      return id as unknown as ReturnType<typeof setTimeout>;
    },
    clearTimeout: (handle) => {
      if (handle === null) return;
      tasks.delete(handle as unknown as number);
    },
  };

  const advanceBy = (ms: number) => {
    const target = now + ms;
    while (true) {
      let nextEntry: [number, { runAt: number; fn: () => void }] | null = null;
      for (const entry of tasks.entries()) {
        if (entry[1].runAt <= target) {
          if (!nextEntry || entry[1].runAt < nextEntry[1].runAt) {
            nextEntry = entry;
          }
        }
      }
      if (!nextEntry) break;
      const [id, item] = nextEntry;
      tasks.delete(id);
      now = item.runAt;
      item.fn();
    }
    now = target;
  };

  return {
    driver,
    advanceBy,
    pendingCount: () => tasks.size,
  };
}

test('THRESHOLD is strictly 5000 ms', () => {
  assert.equal(DELAYED_LOADER_THRESHOLD_MS, 5000);
});

test('startLoadingWith5SecDelay cancels cleanly when finishLoading runs before 5000ms', () => {
  const fake = createFakeTimers();
  const ctrl = createDelayedLoadingController(5000, fake.driver);

  let shownCount = 0;
  let hiddenCount = 0;

  ctrl.startLoadingWith5SecDelay(() => {
    shownCount += 1;
  });

  fake.advanceBy(4999);
  assert.equal(shownCount, 0);

  ctrl.finishLoading(() => {
    hiddenCount += 1;
  });
  assert.equal(hiddenCount, 1);
  assert.equal(fake.pendingCount(), 0);

  // Advancing well past 5000ms never triggers the cancelled timer
  fake.advanceBy(10000);
  assert.equal(shownCount, 0);
});

test('startLoadingWith5SecDelay shows at 5000ms and hides on finishLoading', () => {
  const fake = createFakeTimers();
  const ctrl = createDelayedLoadingController(5000, fake.driver);

  let visible = false;
  ctrl.startLoadingWith5SecDelay(() => {
    visible = true;
  });

  fake.advanceBy(4999);
  assert.equal(visible, false);

  fake.advanceBy(1);
  assert.equal(visible, true);

  ctrl.finishLoading(() => {
    visible = false;
  });
  assert.equal(visible, false);
});

test('fast task (< 5s) never activates global delayed loader', () => {
  const fake = createFakeTimers();
  const ctrl = createDelayedLoadingController(5000, fake.driver);

  const token = ctrl.beginTask('تحميل سريع');
  fake.advanceBy(2400);
  assert.equal(ctrl.getSnapshot().visible, false);

  ctrl.endTask(token);
  assert.equal(ctrl.getSnapshot().visible, false);

  fake.advanceBy(6000);
  assert.equal(ctrl.getSnapshot().visible, false);
});

test('slow task (>= 5s) reveals truck loader at 5000ms and stays visible until completion', () => {
  const fake = createFakeTimers();
  const ctrl = createDelayedLoadingController(5000, fake.driver);

  const states: boolean[] = [];
  const unsub = ctrl.subscribe((snap) => {
    states.push(snap.visible);
  });

  const token = ctrl.beginTask('جاري سحب البيانات الثقيلة...');
  fake.advanceBy(4500);
  assert.equal(ctrl.getSnapshot().visible, false);

  fake.advanceBy(500);
  assert.equal(ctrl.getSnapshot().visible, true);
  assert.equal(ctrl.getSnapshot().label, 'جاري سحب البيانات الثقيلة...');

  fake.advanceBy(3000);
  assert.equal(ctrl.getSnapshot().visible, true);

  ctrl.endTask(token);
  assert.equal(ctrl.getSnapshot().visible, false);
  assert.deepEqual(states, [false, true, false]);
  unsub();
});

test('concurrent tasks keep timer & visibility accurate until all active operations complete', () => {
  const fake = createFakeTimers();
  const ctrl = createDelayedLoadingController(5000, fake.driver);

  const t1 = ctrl.beginTask('عملية أولى');
  fake.advanceBy(1500);
  const t2 = ctrl.beginTask('عملية ثانية');

  // First finishes early at 2000ms, second is still active
  fake.advanceBy(500);
  ctrl.endTask(t1);
  assert.equal(ctrl.getSnapshot().visible, false);
  assert.equal(ctrl.getSnapshot().activeCount, 1);

  // Reaches 5000ms overall -> reveals because second task is still running
  fake.advanceBy(3000);
  assert.equal(ctrl.getSnapshot().visible, true);

  // Hides once the remaining task completes
  ctrl.endTask(t2);
  assert.equal(ctrl.getSnapshot().visible, false);
  assert.equal(ctrl.getSnapshot().activeCount, 0);
});

test('trackDelayedLoading resolves value and cleans up even on rejection', async () => {
  const ok = await trackDelayedLoading(async () => 'done', 'اختبار');
  assert.equal(ok, 'done');

  await assert.rejects(
    trackDelayedLoading(async () => {
      throw new Error('boom');
    }, 'اختبار خطأ'),
    /boom/
  );
});
