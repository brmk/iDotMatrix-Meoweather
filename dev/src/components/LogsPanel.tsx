import type { LogEntry, LogsSnapshot } from '@src/log-store';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

const CLIENT_CAP = 1000;
const INITIAL_LIMIT = 200;
const ROW_HEIGHT = 56;
const OVERSCAN = 8;
const META_REFRESH_MS = 30_000;

type FilterMode = 'all' | 'error';

interface LogMeta {
  oldestId: number | null;
  newestId: number | null;
  size: number;
  droppedCount: number;
}

function trimEntries(entries: LogEntry[]): LogEntry[] {
  return entries.length > CLIENT_CAP ? entries.slice(-CLIENT_CAP) : entries;
}

function mergeEntries(current: LogEntry[], incoming: LogEntry[]): LogEntry[] {
  if (!incoming.length) return current;
  const seen = new Set(current.map((entry) => entry.id));
  const merged = [...current];
  for (const entry of incoming) {
    if (seen.has(entry.id)) continue;
    seen.add(entry.id);
    merged.push(entry);
  }
  merged.sort((a, b) => a.id - b.id);
  return trimEntries(merged);
}

function formatTime(ts: string): string {
  const date = new Date(ts);
  if (Number.isNaN(date.getTime())) return ts;
  return date.toLocaleTimeString([], { hour12: false });
}

function buttonStyle(active: boolean) {
  return {
    background: active ? '#1d3a28' : '#161616',
    color: active ? '#a9f5c8' : '#a7a7a7',
    border: `1px solid ${active ? '#3b9162' : '#303030'}`,
    padding: '4px 10px',
    fontFamily: 'monospace',
    fontSize: 11,
    cursor: 'pointer',
  } as const;
}

export default function LogsPanel() {
  const [entries, setEntries] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [paused, setPaused] = useState(false);
  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [query, setQuery] = useState('');
  const [newCount, setNewCount] = useState(0);
  const [queuedCount, setQueuedCount] = useState(0);
  const [meta, setMeta] = useState<LogMeta>({
    oldestId: null,
    newestId: null,
    size: 0,
    droppedCount: 0,
  });
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const entriesRef = useRef<LogEntry[]>([]);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const atBottomRef = useRef(true);
  const pausedRef = useRef(false);
  const shouldStickRef = useRef(false);
  const lastSeenIdRef = useRef(0);
  const pendingRef = useRef<LogEntry[]>([]);

  const applySnapshot = useCallback((snapshot: LogsSnapshot, replace: boolean): void => {
    setMeta({
      oldestId: snapshot.oldestId,
      newestId: snapshot.newestId,
      size: snapshot.size,
      droppedCount: snapshot.droppedCount,
    });

    setEntries((current) => {
      const next = replace || snapshot.resetRequired ? trimEntries(snapshot.items) : mergeEntries(current, snapshot.items);
      entriesRef.current = next;
      return next;
    });

    const newestId = snapshot.newestId ?? 0;
    if (atBottomRef.current) {
      lastSeenIdRef.current = newestId;
      setNewCount(0);
      shouldStickRef.current = true;
    } else {
      const visibleNew = entriesRef.current.filter((entry) => entry.id > lastSeenIdRef.current).length;
      setNewCount(visibleNew + pendingRef.current.length);
    }
  }, []);

  const refreshSnapshot = useCallback(
    async (replace: boolean, afterId?: number): Promise<void> => {
      const params = new URLSearchParams();
      params.set('limit', String(INITIAL_LIMIT));
      if (afterId !== undefined) params.set('after', String(afterId));

      const response = await fetch(`/api/logs?${params.toString()}`);
      if (!response.ok) throw new Error(`snapshot ${response.status}`);
      const snapshot = (await response.json()) as LogsSnapshot;
      applySnapshot(snapshot, replace);
    },
    [applySnapshot],
  );

  const flushPending = useCallback((stickToBottom: boolean): void => {
    if (!pendingRef.current.length) {
      if (stickToBottom) {
        shouldStickRef.current = true;
        setNewCount(0);
      }
      return;
    }

    const incoming = pendingRef.current;
    pendingRef.current = [];
    setQueuedCount(0);

    setEntries((current) => {
      const next = mergeEntries(current, incoming);
      entriesRef.current = next;
      return next;
    });

    const newestId = incoming.at(-1)?.id ?? lastSeenIdRef.current;
    if (stickToBottom) {
      lastSeenIdRef.current = newestId;
      setNewCount(0);
      shouldStickRef.current = true;
    } else {
      const visibleNew = entriesRef.current.filter((entry) => entry.id > lastSeenIdRef.current).length;
      setNewCount(visibleNew);
    }
  }, []);

  useEffect(() => {
    let disposed = false;
    let currentSource: EventSource | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let metaTimer: ReturnType<typeof setInterval> | null = null;

    const connect = async () => {
      try {
        await refreshSnapshot(true);
      } catch {
        if (!disposed) setConnected(false);
      }

      if (disposed) return;

      const afterId = entriesRef.current.at(-1)?.id ?? 0;
      currentSource = new EventSource(`/api/logs/stream?after=${afterId}`);
      currentSource.onopen = () => setConnected(true);
      currentSource.onerror = () => {
        setConnected(false);
        currentSource?.close();
        if (!reconnectTimer && !disposed) {
          reconnectTimer = setTimeout(() => {
            reconnectTimer = null;
            connect().catch(() => undefined);
          }, 1500);
        }
      };
      currentSource.onmessage = (event) => {
        try {
          const entry = JSON.parse(event.data as string) as LogEntry;
          setMeta((current) => ({
            ...current,
            newestId: entry.id,
            oldestId: current.oldestId ?? entry.id,
            size: Math.min(Math.max(current.size + 1, entriesRef.current.length + pendingRef.current.length + 1), 5000),
          }));

          if (pausedRef.current) {
            pendingRef.current = trimEntries([...pendingRef.current, entry]);
            setQueuedCount(pendingRef.current.length);
            setNewCount(entriesRef.current.filter((item) => item.id > lastSeenIdRef.current).length + pendingRef.current.length);
            return;
          }

          setEntries((current) => {
            const next = mergeEntries(current, [entry]);
            entriesRef.current = next;
            return next;
          });

          if (atBottomRef.current) {
            lastSeenIdRef.current = entry.id;
            setNewCount(0);
            shouldStickRef.current = true;
          } else {
            setNewCount((count) => count + 1);
          }
        } catch {
          /* ignore malformed event */
        }
      };
      currentSource.addEventListener('reset', () => {
        refreshSnapshot(true).catch(() => setConnected(false));
      });
    };

    connect().catch(() => setConnected(false));
    metaTimer = setInterval(() => {
      const newestId = entriesRef.current.at(-1)?.id;
      refreshSnapshot(false, newestId).catch(() => undefined);
    }, META_REFRESH_MS);

    return () => {
      disposed = true;
      currentSource?.close();
      if (reconnectTimer) clearTimeout(reconnectTimer);
      if (metaTimer) clearInterval(metaTimer);
    };
  }, [refreshSnapshot]);

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    pausedRef.current = paused;
    if (!paused) flushPending(atBottomRef.current);
  }, [flushPending, paused]);

  useEffect(() => {
    const node = scrollerRef.current;
    if (!node) return;

    const syncViewport = () => setViewportHeight(node.clientHeight);
    syncViewport();
    window.addEventListener('resize', syncViewport);
    return () => window.removeEventListener('resize', syncViewport);
  }, []);

  useEffect(() => {
    if (!shouldStickRef.current) return;
    const node = scrollerRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
    shouldStickRef.current = false;
  }, [entries]);

  const filteredEntries = useMemo(() => {
    const lowered = query.trim().toLowerCase();
    return entries.filter((entry) => {
      if (filterMode === 'error' && entry.level !== 'error') return false;
      if (!lowered) return true;
      return entry.message.toLowerCase().includes(lowered);
    });
  }, [entries, filterMode, query]);

  const totalHeight = filteredEntries.length * ROW_HEIGHT;
  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - OVERSCAN);
  const endIndex = Math.min(filteredEntries.length, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + OVERSCAN);
  const visibleEntries = filteredEntries.slice(startIndex, endIndex);

  const unreadLabel = newCount > 0 ? `${newCount} new` : queuedCount > 0 ? `${queuedCount} queued` : '';

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: '#0d0d0d',
        color: '#b6b6b6',
        fontFamily: 'monospace',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #1e1e1e',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          flexWrap: 'wrap',
          fontSize: 11,
        }}
      >
        <span style={{ color: connected ? '#4a8' : '#a44' }}>{connected ? '● connected' : '● disconnected'}</span>
        <span>App logs only</span>
        <span>buffer {meta.size}</span>
        <span>dropped {meta.droppedCount}</span>
        <span>
          window {entries.length}/{CLIENT_CAP}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button style={buttonStyle(paused)} onClick={() => setPaused((value) => !value)}>
            {paused ? 'Resume live' : 'Pause live'}
          </button>
          {unreadLabel && (
            <button
              style={buttonStyle(true)}
              onClick={() => {
                flushPending(true);
              }}
            >
              {unreadLabel}
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          padding: '8px 12px',
          borderBottom: '1px solid #161616',
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          flexWrap: 'wrap',
          fontSize: 11,
        }}
      >
        <button style={buttonStyle(filterMode === 'all')} onClick={() => setFilterMode('all')}>
          All
        </button>
        <button style={buttonStyle(filterMode === 'error')} onClick={() => setFilterMode('error')}>
          Errors
        </button>
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="filter message…"
          style={{
            background: '#121212',
            color: '#d0d0d0',
            border: '1px solid #2b2b2b',
            padding: '5px 8px',
            minWidth: 220,
            fontFamily: 'monospace',
            fontSize: 11,
          }}
        />
        <span style={{ color: '#666' }}>{filteredEntries.length} shown</span>
      </div>

      <div
        ref={scrollerRef}
        onScroll={(event) => {
          const node = event.currentTarget;
          setScrollTop(node.scrollTop);
          setViewportHeight(node.clientHeight);
          const atBottom = node.scrollHeight - node.scrollTop - node.clientHeight < 12;
          atBottomRef.current = atBottom;
          if (atBottom) {
            lastSeenIdRef.current = entriesRef.current.at(-1)?.id ?? lastSeenIdRef.current;
            setNewCount(pendingRef.current.length);
          }
        }}
        style={{
          flex: 1,
          overflow: 'auto',
          position: 'relative',
          padding: '0 12px',
        }}
      >
        <div style={{ height: totalHeight || ROW_HEIGHT, position: 'relative' }}>
          {visibleEntries.map((entry, index) => {
            const actualIndex = startIndex + index;
            return (
              <div
                key={entry.id}
                style={{
                  position: 'absolute',
                  top: actualIndex * ROW_HEIGHT,
                  left: 0,
                  right: 0,
                  height: ROW_HEIGHT - 1,
                  borderBottom: '1px solid #151515',
                  padding: '6px 10px',
                  overflow: 'hidden',
                  color: entry.level === 'error' ? '#ec8e8e' : '#98c79d',
                  background: entry.level === 'error' ? 'rgba(90, 24, 24, 0.18)' : 'transparent',
                }}
              >
                <div style={{ display: 'flex', gap: 10, fontSize: 10, color: '#707070', marginBottom: 4 }}>
                  <span>{formatTime(entry.ts)}</span>
                  <span>{entry.level}</span>
                </div>
                <div
                  style={{
                    whiteSpace: 'pre-wrap',
                    lineHeight: 1.35,
                    fontSize: 11,
                    display: '-webkit-box',
                    WebkitLineClamp: 2,
                    WebkitBoxOrient: 'vertical',
                    overflow: 'hidden',
                  }}
                  title={entry.message}
                >
                  {entry.message}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
