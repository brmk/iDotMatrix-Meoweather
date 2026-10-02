import { createServer, type Server } from 'node:http';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createRequestHandler } from './control.js';
import { resetCustomization, saveCustomization } from './customization/index.js';
import { logStore } from './log-store.js';
import { setActiveCustomization } from './render/pet/active.js';

const _fakeCustomization = {
  schemaVersion: 1,
  palette: [
    { key: 'o', day: [255, 200, 100] },
    { key: 'g', day: [100, 200, 100] },
    { key: 's', day: [180, 120, 50] },
    { key: 'l', day: [255, 255, 200] },
    { key: 'r', day: [220, 80, 80] },
  ],
  sprites: {},
  behavior: {
    day: { initial: 'walk', transitions: {} },
    night: { initial: 'walk', transitions: {} },
  },
};

vi.mock('./customization/index.js', () => ({
  loadCustomization: vi.fn(() => structuredClone(_fakeCustomization)),
  saveCustomization: vi.fn(() => structuredClone(_fakeCustomization)),
  resetCustomization: vi.fn(() => structuredClone(_fakeCustomization)),
}));

vi.mock('./render/pet/active.js', () => ({
  getActive: vi.fn(() => ({
    behavior: { day: { transitions: {} }, night: { transitions: {} } },
  })),
  setActiveCustomization: vi.fn(),
  initActiveFromCustomization: vi.fn(),
}));

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

describe('control customization endpoints', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(saveCustomization).mockReturnValue(structuredClone(_fakeCustomization) as never);
    vi.mocked(resetCustomization).mockReturnValue(structuredClone(_fakeCustomization) as never);
  });

  it('GET /api/customization returns the current customization', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    const response = await fetch(`${baseUrl}/api/customization`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { schemaVersion: number };
    expect(body.schemaVersion).toBe(1);
  });

  it('GET /api/version returns app and schema versions', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    const response = await fetch(`${baseUrl}/api/version`);
    expect(response.status).toBe(200);
    const body = (await response.json()) as { app: string; schema: number };
    expect(typeof body.app).toBe('string');
    expect(body.schema).toBe(1);
  });

  it('PUT /api/customization saves and hot-swaps active customization', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    const patch = { palette: _fakeCustomization.palette };
    const response = await fetch(`${baseUrl}/api/customization`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(patch),
    });
    expect(response.status).toBe(200);
    expect(vi.mocked(saveCustomization)).toHaveBeenCalledOnce();
    expect(vi.mocked(setActiveCustomization)).toHaveBeenCalledOnce();
    const body = (await response.json()) as { schemaVersion: number };
    expect(body.schemaVersion).toBe(1);
  });

  it('PUT /api/customization returns 400 for invalid JSON', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    const response = await fetch(`${baseUrl}/api/customization`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: '{bad json',
    });
    expect(response.status).toBe(400);
    expect(vi.mocked(saveCustomization)).not.toHaveBeenCalled();
    expect(vi.mocked(setActiveCustomization)).not.toHaveBeenCalled();
  });

  it('PUT /api/customization returns 400 for non-object body', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    const response = await fetch(`${baseUrl}/api/customization`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: 'null',
    });
    expect(response.status).toBe(400);
    expect(vi.mocked(saveCustomization)).not.toHaveBeenCalled();
  });

  it('PUT /api/customization returns 400 without writing when validation fails', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    vi.mocked(saveCustomization).mockImplementationOnce(() => {
      throw new Error('saveCustomization: resulting value is invalid');
    });

    const response = await fetch(`${baseUrl}/api/customization`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ palette: [] }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as { error: string };
    expect(body.error).toContain('invalid');
    expect(vi.mocked(setActiveCustomization)).not.toHaveBeenCalled();
  });

  it('POST /api/customization/reset resets and hot-swaps', async () => {
    const { server, baseUrl } = await startTestServer();
    servers.push(server);

    const response = await fetch(`${baseUrl}/api/customization/reset`, { method: 'POST' });
    expect(response.status).toBe(200);
    expect(vi.mocked(resetCustomization)).toHaveBeenCalledOnce();
    expect(vi.mocked(setActiveCustomization)).toHaveBeenCalledOnce();
    const body = (await response.json()) as { schemaVersion: number };
    expect(body.schemaVersion).toBe(1);
  });
});
