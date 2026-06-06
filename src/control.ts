import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { config } from './config.js';
import type { BrightnessConfig, NightHours, PowerSchedule } from './control-state.js';
import { controlState } from './control-state.js';
import { logStore } from './log-store.js';
import { getActive } from './render/pet/active.js';
import type { PetBehavior } from './render/pet/types.js';
import { saveRuntimeConfig } from './runtime-config.js';
import type { WeatherSnapshot } from './weather/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_DIR = resolve(__dirname, '..', 'dist-dev');
const LOG_STREAM_HEARTBEAT_MS = 15_000;

function getBehaviorDur(behavior: string): number {
  if (behavior === 'walk') return 0;
  const t = getActive().behavior.day.transitions[behavior as PetBehavior];
  return t ? Math.round((t.minDuration + t.maxDuration) / 2) : 60;
}

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.json': 'application/json',
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString();
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

function json(res: ServerResponse, status: number, data: unknown): void {
  res.writeHead(status, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(JSON.stringify(data));
}

function sseStart(res: ServerResponse): void {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive',
    'Access-Control-Allow-Origin': '*',
  });
}

function sseEvent(res: ServerResponse, event: string | null, data?: unknown): void {
  if (event) res.write(`event: ${event}\n`);
  if (data !== undefined) res.write(`data: ${JSON.stringify(data)}\n`);
  res.write('\n');
}

function serveFile(res: ServerResponse, filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    const data = readFileSync(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath)] ?? 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(data);
    return true;
  } catch {
    return false;
  }
}

function currentHealth() {
  const pet = controlState.pet;
  const snap = controlState.weatherOverride ?? controlState.snapshot;
  return {
    ok: true,
    behavior: pet?.behavior ?? null,
    tick: controlState.tick,
    weatherCode: snap?.weatherCode ?? null,
    temperature: snap?.temperature ?? null,
    isDay: snap?.isDay ?? null,
    humidity: snap?.humidity ?? null,
    windSpeed: snap?.windSpeed ?? null,
    weatherOverride: controlState.weatherOverride !== null,
    brightness: controlState.brightness,
    nightHours: controlState.nightHours,
    powerSchedule: controlState.powerSchedule,
    matrixPaused: controlState.matrixPaused,
  };
}

// ---- Route handlers ----

function routeHealth(res: ServerResponse): void {
  json(res, 200, currentHealth());
}

function routeState(req: IncomingMessage, res: ServerResponse): void {
  sseStart(res);
  const send = () => {
    try {
      res.write(`data: ${JSON.stringify(currentHealth())}\n\n`);
    } catch {
      /* client disconnected */
    }
  };
  send();
  const interval = setInterval(send, 1000);
  req.on('close', () => clearInterval(interval));
}

function routeFrame(req: IncomingMessage, res: ServerResponse): void {
  sseStart(res);
  // Frame data is raw base64 — write directly without JSON.stringify.
  const writeFrame = (frame: string) => res.write(`data: ${frame}\n\n`);
  if (controlState.currentFrame) writeFrame(controlState.currentFrame);
  const sub = (frame: string) => {
    try {
      writeFrame(frame);
    } catch {
      controlState.frameSubs.delete(sub);
    }
  };
  controlState.frameSubs.add(sub);
  req.on('close', () => controlState.frameSubs.delete(sub));
}

function parseIntParam(value: string | null): number | undefined {
  if (value === null || value.trim() === '') return undefined;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function routeLogsSnapshot(res: ServerResponse, url: URL): void {
  const afterId = parseIntParam(url.searchParams.get('after'));
  const limit = parseIntParam(url.searchParams.get('limit'));
  json(res, 200, logStore.list({ afterId, limit }));
}

function routeLogsStream(req: IncomingMessage, res: ServerResponse, url: URL, heartbeatMs = LOG_STREAM_HEARTBEAT_MS): void {
  sseStart(res);

  const afterId = parseIntParam(url.searchParams.get('after'));
  const snapshot = logStore.list({ afterId, limit: 1 });
  if (snapshot.resetRequired) {
    sseEvent(res, 'reset');
  }

  const unsubscribe = logStore.subscribe((entry) => {
    try {
      sseEvent(res, null, entry);
    } catch {
      unsubscribe();
    }
  });

  const heartbeat = setInterval(() => {
    try {
      res.write(': heartbeat\n\n');
    } catch {
      unsubscribe();
      clearInterval(heartbeat);
    }
  }, heartbeatMs);

  req.on('close', () => {
    unsubscribe();
    clearInterval(heartbeat);
  });
}

async function routeControlBehavior(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  try {
    const { behavior } = JSON.parse(body) as { behavior: string };
    if (!behavior || typeof behavior !== 'string') {
      json(res, 400, { error: 'behavior required' });
      return;
    }
    controlState.behaviorOverride = {
      behavior: behavior as PetBehavior,
      dur: getBehaviorDur(behavior),
    };
    json(res, 200, { ok: true });
  } catch {
    json(res, 400, { error: 'invalid JSON' });
  }
}

async function routeControlBrightness(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  try {
    const { day, night } = JSON.parse(body) as BrightnessConfig;
    if (typeof day !== 'number' || typeof night !== 'number') {
      json(res, 400, { error: 'day and night brightness required' });
      return;
    }
    controlState.brightness = {
      day: Math.max(0, Math.min(100, Math.round(day))),
      night: Math.max(0, Math.min(100, Math.round(night))),
    };
    saveRuntimeConfig({ brightness: controlState.brightness });
    json(res, 200, { ok: true });
  } catch {
    json(res, 400, { error: 'invalid JSON' });
  }
}

async function routeControlNightHours(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  try {
    const data = JSON.parse(body) as NightHours | null;
    if (data === null) {
      controlState.nightHours = null;
    } else {
      const { from, to } = data;
      if (typeof from !== 'number' || typeof to !== 'number') {
        json(res, 400, { error: 'from and to hours required' });
        return;
      }
      controlState.nightHours = { from: Math.round(from) % 24, to: Math.round(to) % 24 };
    }
    saveRuntimeConfig({ nightHours: controlState.nightHours });
    json(res, 200, { ok: true });
  } catch {
    json(res, 400, { error: 'invalid JSON' });
  }
}

async function routeControlPause(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  try {
    const { paused } = JSON.parse(body) as { paused: boolean };
    if (typeof paused !== 'boolean') {
      json(res, 400, { error: 'paused (boolean) required' });
      return;
    }
    controlState.matrixPaused = paused;
    if (paused) {
      // Disconnect BLE so another client (e.g. local dev machine) can connect.
      fetch(`${config.sidecarUrl}/ble/disconnect`, { method: 'POST' }).catch(() => {
        /* ignore */
      });
    } else {
      // Tell the sidecar to forget its last frame so the next send is a full repaint.
      // The sidecar will reconnect automatically on the first /display request.
      fetch(`${config.sidecarUrl}/reset-frame`, { method: 'POST' }).catch(() => {
        /* ignore */
      });
    }
    json(res, 200, { ok: true });
  } catch {
    json(res, 400, { error: 'invalid JSON' });
  }
}

async function routeControlPowerSchedule(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  try {
    const data = JSON.parse(body) as PowerSchedule | null;
    if (data === null) {
      controlState.powerSchedule = null;
    } else {
      const { offFrom, offTo } = data;
      if (typeof offFrom !== 'number' || typeof offTo !== 'number') {
        json(res, 400, { error: 'offFrom and offTo hours required' });
        return;
      }
      controlState.powerSchedule = { offFrom: Math.round(offFrom) % 24, offTo: Math.round(offTo) % 24 };
    }
    saveRuntimeConfig({ powerSchedule: controlState.powerSchedule });
    json(res, 200, { ok: true });
  } catch {
    json(res, 400, { error: 'invalid JSON' });
  }
}

async function routeControlWeather(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await readBody(req);
  try {
    const data = JSON.parse(body) as WeatherSnapshot | null;
    controlState.weatherOverride = data ? { ...data, fetchedAt: new Date() } : null;
    controlState.weatherDirty = true;
    json(res, 200, { ok: true });
  } catch {
    json(res, 400, { error: 'invalid JSON' });
  }
}

function routeStatic(res: ServerResponse, path: string): void {
  if (process.env.NODE_ENV === 'development') {
    res.writeHead(404);
    res.end('Dev mode: open the Vite dev server instead');
    return;
  }
  const candidate = path === '/' ? 'index.html' : path.slice(1);
  if (serveFile(res, resolve(UI_DIR, candidate))) return;
  if (serveFile(res, resolve(UI_DIR, 'index.html'))) return;
  res.writeHead(404);
  res.end('UI not built — run: npm run build:ui');
}

// ---- Dispatcher ----

async function proxySidecar(res: ServerResponse, sidePath: string, method: 'GET' | 'POST', body?: unknown): Promise<void> {
  try {
    const init: RequestInit = { method };
    if (body !== undefined) {
      init.body = JSON.stringify(body);
      init.headers = { 'Content-Type': 'application/json' };
    }
    const r = await fetch(`${config.sidecarUrl}${sidePath}`, init);
    const data: unknown = await r.json();
    json(res, r.ok ? 200 : 502, data);
  } catch {
    json(res, 503, { error: 'sidecar unavailable' });
  }
}

function dispatchGet(req: IncomingMessage, res: ServerResponse, url: URL, heartbeatMs: number): void {
  const path = url.pathname;
  if (path === '/api/health') return routeHealth(res);
  if (path === '/api/state') return routeState(req, res);
  if (path === '/api/frame') return routeFrame(req, res);
  if (path === '/api/logs') return routeLogsSnapshot(res, url);
  if (path === '/api/logs/stream') return routeLogsStream(req, res, url, heartbeatMs);
  if (path.startsWith('/api/sidecar/')) {
    const sidePath = '/' + path.slice('/api/sidecar/'.length);
    proxySidecar(res, sidePath, 'GET').catch(() => json(res, 503, { error: 'sidecar unavailable' }));
    return;
  }
  return routeStatic(res, path);
}

async function dispatchPost(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  if (path === '/api/control/behavior') return routeControlBehavior(req, res);
  if (path === '/api/control/brightness') return routeControlBrightness(req, res);
  if (path === '/api/control/night-hours') return routeControlNightHours(req, res);
  if (path === '/api/control/pause') return routeControlPause(req, res);
  if (path === '/api/control/power-schedule') return routeControlPowerSchedule(req, res);
  if (path === '/api/control/weather') return routeControlWeather(req, res);
  if (path === '/api/control/weather/clear') {
    controlState.weatherOverride = null;
    controlState.weatherDirty = true;
    json(res, 200, { ok: true });
    return;
  }
  if (path.startsWith('/api/sidecar/')) {
    const sidePath = '/' + path.slice('/api/sidecar/'.length);
    const body = await readBody(req);
    const parsed = body ? (JSON.parse(body) as unknown) : undefined;
    return proxySidecar(res, sidePath, 'POST', parsed);
  }
  json(res, 404, { error: 'not found' });
}

export function createRequestHandler(options: { logStreamHeartbeatMs?: number } = {}) {
  const heartbeatMs = options.logStreamHeartbeatMs ?? LOG_STREAM_HEARTBEAT_MS;

  return async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    const path = url.pathname;
    const method = req.method ?? 'GET';

    if (method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST',
        'Access-Control-Allow-Headers': 'Content-Type',
      });
      res.end();
      return;
    }

    if (method === 'GET') return dispatchGet(req, res, url, heartbeatMs);
    if (method === 'POST') return dispatchPost(req, res, path);
    json(res, 404, { error: 'not found' });
  };
}

export function startControlServer(port = 3000): void {
  const handleRequest = createRequestHandler();
  const server = createServer((req, res) => {
    handleRequest(req, res).catch((err: unknown) => {
      console.error('control server error:', err);
      if (!res.headersSent) {
        res.writeHead(500);
        res.end('Internal error');
      }
    });
  });

  server.listen(port, '0.0.0.0', () => {
    console.log(`[control] listening on :${port}`);
  });
}
