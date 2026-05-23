import { fetchWeather } from "./weather/index.js";
import { renderToFile } from "./render/index.js";

const snapshot = await fetchWeather();
console.log(
  `Weather: code=${snapshot.weatherCode}, temp=${snapshot.temperature}°C, isDay=${snapshot.isDay}`
);

renderToFile(snapshot, "out.png");
console.log("Wrote out.png — open it to verify the 32×32 rendering.");
