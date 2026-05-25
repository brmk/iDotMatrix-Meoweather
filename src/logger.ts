import { controlState } from './control-state.js';

const MAX_LINES = 200;

function pushLine(line: string): void {
  controlState.logLines.push(line);
  if (controlState.logLines.length > MAX_LINES) controlState.logLines.shift();
  for (const sub of controlState.logSubs) {
    try {
      sub(line);
    } catch {
      /* ignore disconnected subscriber */
    }
  }
}

// Intercept console.log and console.error so all process output is captured.
const origLog = console.log.bind(console);
const origError = console.error.bind(console);

console.log = (...args: unknown[]) => {
  const line = args.map(String).join(' ');
  origLog(line);
  pushLine(line);
};

console.error = (...args: unknown[]) => {
  const line = 'ERROR: ' + args.map(String).join(' ');
  origError(line);
  pushLine(line);
};
