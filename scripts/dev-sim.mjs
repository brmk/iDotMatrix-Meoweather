import * as esbuild from "esbuild";

const ctx = await esbuild.context({
  entryPoints: ["src/browser-bundle.ts"],
  bundle: true,
  format: "iife",
  globalName: "SimLib",
  outfile: "dev/render.js",
  // Injected into render.js: listens to esbuild's SSE endpoint and reloads on rebuild
  banner: {
    js: `new EventSource('/esbuild').addEventListener('change', () => location.reload());`,
  },
});

await ctx.watch();
const { host, port } = await ctx.serve({ servedir: "dev", port: 8766 });
console.log(`Simulator → http://localhost:${port}/simulator.html`);
