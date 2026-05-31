import { describe, expect, it } from 'vitest';
import { createLogStore } from './log-store.js';

describe('log-store', () => {
  it('assigns monotonic ids in append order', () => {
    const store = createLogStore();
    const first = store.append({ ts: '2026-05-31T10:00:00.000Z', level: 'info', source: 'app', message: 'one' });
    const second = store.append({ ts: '2026-05-31T10:00:01.000Z', level: 'error', source: 'app', message: 'two' });

    expect(first.id).toBe(1);
    expect(second.id).toBe(2);
    expect(store.list().items.map((entry) => entry.id)).toEqual([1, 2]);
  });

  it('drops the oldest entries when the count cap is exceeded', () => {
    const store = createLogStore({ maxEntries: 2, maxBytes: 10_000 });
    store.append({ ts: '2026-05-31T10:00:00.000Z', level: 'info', source: 'app', message: 'one' });
    store.append({ ts: '2026-05-31T10:00:01.000Z', level: 'info', source: 'app', message: 'two' });
    store.append({ ts: '2026-05-31T10:00:02.000Z', level: 'info', source: 'app', message: 'three' });

    const snapshot = store.list();
    expect(snapshot.items.map((entry) => entry.message)).toEqual(['two', 'three']);
    expect(snapshot.oldestId).toBe(2);
    expect(snapshot.droppedCount).toBe(1);
    expect(snapshot.size).toBe(2);
  });

  it('drops oversized history by payload bytes', () => {
    const store = createLogStore({ maxEntries: 10, maxBytes: 220 });
    store.append({ ts: '2026-05-31T10:00:00.000Z', level: 'info', source: 'app', message: 'a'.repeat(120) });
    store.append({ ts: '2026-05-31T10:00:01.000Z', level: 'info', source: 'app', message: 'b'.repeat(120) });

    const snapshot = store.list();
    expect(snapshot.items).toHaveLength(1);
    expect(snapshot.items[0]?.message).toBe('b'.repeat(120));
    expect(snapshot.droppedCount).toBe(1);
  });

  it('lists records after a cursor and honors limit', () => {
    const store = createLogStore();
    for (const message of ['one', 'two', 'three']) {
      store.append({ ts: '2026-05-31T10:00:00.000Z', level: 'info', source: 'app', message });
    }

    const snapshot = store.list({ afterId: 1, limit: 1 });
    expect(snapshot.items.map((entry) => entry.message)).toEqual(['two']);
    expect(snapshot.resetRequired).toBe(false);
  });

  it('requests a reset when the cursor predates retained history', () => {
    const store = createLogStore({ maxEntries: 2, maxBytes: 10_000 });
    store.append({ ts: '2026-05-31T10:00:00.000Z', level: 'info', source: 'app', message: 'one' });
    store.append({ ts: '2026-05-31T10:00:01.000Z', level: 'info', source: 'app', message: 'two' });
    store.append({ ts: '2026-05-31T10:00:02.000Z', level: 'info', source: 'app', message: 'three' });

    const snapshot = store.list({ afterId: 0, limit: 2 });
    expect(snapshot.resetRequired).toBe(true);
    expect(snapshot.items.map((entry) => entry.message)).toEqual(['two', 'three']);
  });
});
