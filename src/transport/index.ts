import { config } from '../config.js';

export async function sendToPanel(png: Buffer, brightness: number): Promise<void> {
  const form = new FormData();
  form.append('file', new Blob([new Uint8Array(png)], { type: 'image/png' }), 'frame.png');
  form.append('brightness', String(brightness));

  const res = await fetch(`${config.sidecarUrl}/display`, {
    method: 'POST',
    body: form,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Sidecar /display failed: HTTP ${res.status} ${text}`);
  }
}
