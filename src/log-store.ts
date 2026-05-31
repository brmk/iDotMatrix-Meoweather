export type LogLevel = 'info' | 'error';

export interface LogEntry {
  id: number;
  ts: string;
  level: LogLevel;
  source: 'app';
  message: string;
}

export interface LogsSnapshot {
  items: LogEntry[];
  oldestId: number | null;
  newestId: number | null;
  size: number;
  droppedCount: number;
  resetRequired: boolean;
}

export interface LogStoreMeta {
  oldestId: number | null;
  newestId: number | null;
  size: number;
  droppedCount: number;
}

interface LogStoreOptions {
  maxEntries?: number;
  maxBytes?: number;
}

interface ListOptions {
  afterId?: number;
  limit?: number;
}

type LogListener = (entry: LogEntry) => void;

const DEFAULT_MAX_ENTRIES = 5000;
const DEFAULT_MAX_BYTES = 2 * 1024 * 1024;
const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 1000;

function clampLimit(limit?: number): number {
  if (!Number.isFinite(limit)) return DEFAULT_LIMIT;
  return Math.max(1, Math.min(MAX_LIMIT, Math.floor(limit ?? DEFAULT_LIMIT)));
}

function entryBytes(entry: LogEntry): number {
  return Buffer.byteLength(JSON.stringify(entry), 'utf8');
}

export interface LogStore {
  append(entry: Omit<LogEntry, 'id'>): LogEntry;
  list(options?: ListOptions): LogsSnapshot;
  snapshotMeta(): LogStoreMeta;
  subscribe(listener: LogListener): () => void;
}

export function createLogStore(options: LogStoreOptions = {}): LogStore {
  const maxEntries = options.maxEntries ?? DEFAULT_MAX_ENTRIES;
  const maxBytes = options.maxBytes ?? DEFAULT_MAX_BYTES;

  let nextId = 1;
  let droppedCount = 0;
  let totalBytes = 0;

  const entries: LogEntry[] = [];
  const listeners = new Set<LogListener>();

  function trim(): void {
    while (entries.length > maxEntries || totalBytes > maxBytes) {
      const removed = entries.shift();
      if (!removed) break;
      totalBytes -= entryBytes(removed);
      droppedCount++;
    }
  }

  function snapshotMeta(): LogStoreMeta {
    return {
      oldestId: entries[0]?.id ?? null,
      newestId: entries.at(-1)?.id ?? null,
      size: entries.length,
      droppedCount,
    };
  }

  function list(options: ListOptions = {}): LogsSnapshot {
    const limit = clampLimit(options.limit);
    const meta = snapshotMeta();
    const afterId = options.afterId;

    if (!entries.length) {
      return { items: [], ...meta, size: meta.size, resetRequired: false };
    }

    if (afterId !== undefined && Number.isFinite(afterId)) {
      const oldestId = meta.oldestId ?? 0;
      if (afterId < oldestId - 1) {
        return {
          items: entries.slice(-limit),
          ...meta,
          size: meta.size,
          resetRequired: true,
        };
      }
      const nextItems = entries.filter((entry) => entry.id > afterId).slice(0, limit);
      return {
        items: nextItems,
        ...meta,
        size: meta.size,
        resetRequired: false,
      };
    }

    return {
      items: entries.slice(-limit),
      ...meta,
      size: meta.size,
      resetRequired: false,
    };
  }

  return {
    append(entryLike) {
      const entry: LogEntry = { ...entryLike, id: nextId++ };
      entries.push(entry);
      totalBytes += entryBytes(entry);
      trim();
      for (const listener of listeners) listener(entry);
      return entry;
    },
    list,
    snapshotMeta,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export const logStore = createLogStore();
