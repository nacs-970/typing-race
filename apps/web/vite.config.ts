import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compression from "vite-plugin-compression";
import { promises as fs } from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import tailwindcss from "@tailwindcss/vite";

/**
 * Dev proxy: browser hits Vite on :5173; WS upgrades are forwarded to
 * Bun on :8080. Same for /api/* HTTP. This keeps the SPA single-origin
 * during development and matches what Phase 5/6 will do in prod behind Fly.
 *
 * Production build: vite-plugin-compression emits .gz siblings. The plugin's
 * built-in brotli pass shares a module-level mtimeCache between instances,
 * so a second `compression({ algorithm: "brotliCompress" })` invocation
 * silently skips. We generate .br siblings manually via Node's
 * zlib.brotliCompress from the plugin's `success` hook (the hook signature
 * is `() => void` so we capture `outDir` in a closure).
 *
 * Hono's serveStatic picks up `.gz` / `.br` siblings when `precompressed: true`
 * and the client's Accept-Encoding advertises gzip / br support.
 */
const COMPRESSIBLE = /\.(js|mjs|json|css|html|svg)$/i;
const MIN_SIZE = 1025;

async function writeBrotliSiblings(outDir: string): Promise<void> {
  async function walk(dir: string): Promise<string[]> {
    const out: string[] = [];
    for (const entry of await fs.readdir(dir, { withFileTypes: true })) {
      const p = path.join(dir, entry.name);
      if (entry.isDirectory()) out.push(...(await walk(p)));
      else out.push(p);
    }
    return out;
  }

  const files = await walk(outDir);
  for (const file of files) {
    if (!COMPRESSIBLE.test(file)) continue;
    if (file.endsWith(".gz") || file.endsWith(".br")) continue;
    const buf = await fs.readFile(file);
    if (buf.byteLength < MIN_SIZE) continue;
    const compressed = await new Promise<Buffer>((resolve, reject) =>
      zlib.brotliCompress(
        buf,
        {
          params: {
            [zlib.constants.BROTLI_PARAM_QUALITY]: zlib.constants.BROTLI_MAX_QUALITY,
          },
        },
        (err, result) => (err ? reject(err) : resolve(result)),
      ),
    );
    await fs.writeFile(`${file}.br`, compressed);
  }
}

export default defineConfig(({ command }) => {
  // outDir is captured from the resolved config so the success hook has it
  // without the plugin passing it through. In dev (no build) we still set up
  // compression() to avoid branching — `enforce: "post"` and `apply: "build"`
  // (plugin-internal) skip it for the dev server.
  let resolvedOutDir = path.resolve(process.cwd(), "dist");

  const brotliPlugin = {
    name: "typing-race:brotli-siblings",
    apply: "build" as const,
    enforce: "post" as const,
    configResolved(cfg: import("vite").ResolvedConfig) {
      resolvedOutDir = path.isAbsolute(cfg.build.outDir)
        ? cfg.build.outDir
        : path.resolve(cfg.root, cfg.build.outDir);
    },
    async writeBundle() {
      // writeBundle (not closeBundle) — Vite calls writeBundle AFTER asset
      // files have been flushed to disk; closeBundle fires before. Reading
      // outDir in closeBundle would race against Vite's writer and fail with
      // ENOENT on a cold build.
      await writeBrotliSiblings(resolvedOutDir);
    },
  };

  return {
    plugins: [
      react(),
      tailwindcss(),
      brotliPlugin,
      compression({
        algorithm: "gzip",
        ext: ".gz",
        success: () => {
          // gzip pass finished; brotli siblings are emitted by brotliPlugin
          // above via closeBundle (which Vite calls in plugin order — gzip is
          // post-hook, brotli is its own plugin, both run on bundle close).
        },
      }),
    ],
    server: {
      port: 5173,
      strictPort: true,
      proxy: {
        "/api": {
          target: "http://localhost:8080",
          changeOrigin: true,
          ws: false,
        },
        "/health": {
          target: "http://localhost:8080",
          changeOrigin: true,
          ws: false,
        },
        "/ws": {
          target: "ws://localhost:8080",
          ws: true,
          changeOrigin: true,
        },
      },
    },
    build: {
      outDir: "dist",
      sourcemap: true,
    },
  };
});