import { createServer, type Server } from 'node:http';
import { afterEach, describe, expect, it } from 'vitest';
import { createRequestHandler } from './control.js';
import { logStore } from './log-store.js';

async function startTestServer(heartbeatMs = 20): Promise<{ server: Server; baseUrl: string }> {
  const handler = createRequestHandler({ logStreamHeartbeatMs: heartbeatMs });
  const server = createServer((req, res) => {
    handler(req, res).catch((err: unknown) => {
      res.writeHead(500);
      res.end(String(err));
    });
  });

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  if (!address || typeof address === 'string') throw new Error('failed to bind test server');
  return { server, baseUrl: `http://127.0.0.1:${address.port}` };
}

async function closeServer(server: Server): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
}

async function readUntil(response: Response, matcher: string): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error('missing response body');
  const decoder = new TextDecoder();
  let text = '';

  while (!text.includes(matcher)) {
    const result = await reader.read();
    text += decoder.decode(result.value ?? new Uint8Array(), { stream: !result.done });
    if (result.done) break;
  }

  await reader.cancel();
  return text;
}

const servers: Server[] = [];

afterEach(async () => {
  while (servers.length) {
    const server = servers.pop();
    if (server) await closeServer(server);
  }
});

describe('control log endpoints', () => {
  it('returns bounded log snapshots as JSON', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    const beforeId = logStore.snapshotMeta().newestId ?? 0;
    logStore.append({
      ts: '2026-05-31T10:00:00.000Z',
      level: 'info',
      source: 'app',
      message: 'snapshot-test-entry',
    });

    const response = await fetch(`${baseUrl}/api/logs?after=${beforeId}&limit=1`);
    expect(response.ok).toBe(true);

    const json = (await response.json()) as {
      items: Array<{ message: string }>;
      resetRequired: boolean;
      size: number;
    };

    expect(json.items).toHaveLength(1);
    expect(json.items[0]?.message).toBe('snapshot-test-entry');
    expect(json.resetRequired).toBe(false);
    expect(json.size).toBeGreaterThan(0);
  });

  it('streams appended log entries over SSE', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    const afterId = logStore.snapshotMeta().newestId ?? 0;
    const response = await fetch(`${baseUrl}/api/logs/stream?after=${afterId}`);
    expect(response.ok).toBe(true);

    logStore.append({
      ts: '2026-05-31T10:00:00.000Z',
      level: 'info',
      source: 'app',
      message: 'stream-test-entry',
    });

    const chunk = await readUntil(response, '"message":"stream-test-entry"');
    expect(chunk).toContain('data:');
    expect(chunk).toContain('"message":"stream-test-entry"');
  });

  it('emits heartbeat comments on idle streams', async () => {
    const { server, baseUrl } = await startTestServer(15);
    servers.push(server);

    const afterId = logStore.snapshotMeta().newestId ?? 0;
    const response = await fetch(`${baseUrl}/api/logs/stream?after=${afterId}`);
    expect(response.ok).toBe(true);

    const chunk = await readUntil(response, ': heartbeat');
    expect(chunk).toContain(': heartbeat');
  });

  it('emits a reset event for stale stream cursors', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    logStore.append({
      ts: '2026-05-31T10:00:00.000Z',
      level: 'info',
      source: 'app',
      message: 'reset-test-entry',
    });

    const response = await fetch(`${baseUrl}/api/logs/stream?after=-1`);
    expect(response.ok).toBe(true);

    const chunk = await readUntil(response, 'event: reset');
    expect(chunk).toContain('event: reset');
  });
});
