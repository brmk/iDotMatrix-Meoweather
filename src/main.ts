import { fetchWeather } from "./weather/index.js";
import { renderToPng } from "./render/index.js";
import { sendToPanel } from "./transport/index.js";
import { config } from "./config.js";

async function tick(): Promise<void> {
  const snapshot = await fetchWeather();
  console.log(
    `[${new Date().toISOString()}] weather code=${snapshot.weatherCode} temp=${snapshot.temperature}°C isDay=${snapshot.isDay}`
  );
  const png = renderToPng(snapshot);
  const brightness = snapshot.isDay ? config.dayBrightness : config.nightBrightness;
  await sendToPanel(png, brightness);
  console.log(`[${new Date().toISOString()}] panel updated (brightness=${brightness}%)`);
}

function safeTick(): void {
  tick().catch((err) => console.error("tick failed:", err));
}

async function run(): Promise<void> {
  console.log(
    `Starting — interval ${config.intervalMs / 1000}s, sidecar ${config.sidecarUrl}`
  );

  safeTick();
  setInterval(safeTick, config.intervalMs);
}

run().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
