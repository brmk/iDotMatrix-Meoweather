import { existsSync, readFileSync } from 'node:fs';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { dirname, extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { controlState } from './control-state.js';
import type { BrightnessConfig, NightHours, PowerSchedule } from './control-state.js';
import { saveRuntimeConfig } from './runtime-config.js';
import type { PetBehavior } from './render/pet/types.js';
import type { WeatherSnapshot } from './weather/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const UI_DIR = resolve(__dirname, '..', 'dist-dev');

const BEHAVIOR_DUR: Record<string, number> = {
  walk: 0,
  sit: 60,
  lie: 80,
  jump: 8,
  perch: 12,
  dream: 120,
  burp: 12,
  poo: 10,
};

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
  if (controlState.currentFrame) {
    res.write(`data: ${controlState.currentFrame}\n\n`);
  }
  const sub = (frame: string) => {
    try {
      res.write(`data: ${frame}\n\n`);
    } catch {
      controlState.frameSubs.delete(sub);
    }
  };
  controlState.frameSubs.add(sub);
  req.on('close', () => controlState.frameSubs.delete(sub));
}

function routeLogs(req: IncomingMessage, res: ServerResponse): void {
  sseStart(res);
  for (const line of controlState.logLines) {
    res.write(`data: ${JSON.stringify(line)}\n\n`);
  }
  const sub = (line: string) => {
    try {
      res.write(`data: ${JSON.stringify(line)}\n\n`);
    } catch {
      controlState.logSubs.delete(sub);
    }
  };
  controlState.logSubs.add(sub);
  req.on('close', () => controlState.logSubs.delete(sub));
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
      dur: BEHAVIOR_DUR[behavior] ?? 60,
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
  const candidate = path === '/' ? 'index.html' : path.slice(1);
  if (serveFile(res, resolve(UI_DIR, candidate))) return;
  if (serveFile(res, resolve(UI_DIR, 'index.html'))) return;
  res.writeHead(404);
  res.end('UI not built — run: npm run build:ui');
}

// ---- Dispatcher ----

function dispatchGet(req: IncomingMessage, res: ServerResponse, path: string): void {
  if (path === '/api/health') return routeHealth(res);
  if (path === '/api/state') return routeState(req, res);
  if (path === '/api/frame') return routeFrame(req, res);
  if (path === '/api/logs') return routeLogs(req, res);
  return routeStatic(res, path);
}

async function dispatchPost(req: IncomingMessage, res: ServerResponse, path: string): Promise<void> {
  if (path === '/api/control/behavior') return routeControlBehavior(req, res);
  if (path === '/api/control/brightness') return routeControlBrightness(req, res);
  if (path === '/api/control/night-hours') return routeControlNightHours(req, res);
  if (path === '/api/control/power-schedule') return routeControlPowerSchedule(req, res);
  if (path === '/api/control/weather') return routeControlWeather(req, res);
  if (path === '/api/control/weather/clear') {
    controlState.weatherOverride = null;
    controlState.weatherDirty = true;
    json(res, 200, { ok: true });
    return;
  }
  json(res, 404, { error: 'not found' });
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const path = new URL(req.url ?? '/', 'http://localhost').pathname;
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

  if (method === 'GET') return dispatchGet(req, res, path);
  if (method === 'POST') return dispatchPost(req, res, path);
  json(res, 404, { error: 'not found' });
}

export function startControlServer(port = 3000): void {
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
