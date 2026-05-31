import { logStore } from './log-store.js';

function pushLine(level: 'info' | 'error', line: string): void {
  logStore.append({
    ts: new Date().toISOString(),
    level,
    source: 'app',
    message: line,
  });
}

// Intercept console.log and console.error so all process output is captured.
const origLog = console.log.bind(console);
const origError = console.error.bind(console);

console.log = (...args: unknown[]) => {
  const line = args.map(String).join(' ');
  origLog(line);
  pushLine('info', line);
};

console.error = (...args: unknown[]) => {
  const line = 'ERROR: ' + args.map(String).join(' ');
  origError(line);
  pushLine('error', line);
};
