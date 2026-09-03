import { defineConfig, loadEnv } from "vite";
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
        (err, res) => (err ? reject(err) : resolve(res)),
      ),
    );
    await fs.writeFile(`${file}.br`, compressed);
  }
}

export default defineConfig(({ mode }) => {
  const rootDir = path.resolve(import.meta.dirname, "../../");
  const env = loadEnv(mode, rootDir, "");
  const serverPort = env.PORT || "8080";
  const serverTarget = env.VITE_SERVER_URL || `http://localhost:${serverPort}`;
  const wsTarget = serverTarget.replace(/^http/, "ws");

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
      await writeBrotliSiblings(resolvedOutDir);
    },
  };

  return {
    envDir: rootDir,
    plugins: [
      react(),
      tailwindcss(),
      brotliPlugin,
      compression({
        algorithm: "gzip",
        ext: ".gz",
      }),
    ],
    server: {
      host: env.VITE_HOST === "false" ? false : true,
      port: Number(env.VITE_PORT || 5173),
      strictPort: true,
      proxy: {
        "/api": {
          target: serverTarget,
          changeOrigin: true,
          ws: false,
        },
        "/health": {
          target: serverTarget,
          changeOrigin: true,
          ws: false,
        },
        "/ws": {
          target: wsTarget,
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