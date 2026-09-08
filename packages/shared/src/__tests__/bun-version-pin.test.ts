import { describe, expect, it } from "bun:test";
import { join, resolve } from "node:path";

const repoRoot = resolve(import.meta.dir, "../../../..");

describe("Bun version pin drift guard", () => {
  it("pins .bun-version at repo root to 1.3.2", async () => {
    const bunVersionPath = join(repoRoot, ".bun-version");
    const content = await Bun.file(bunVersionPath).text();
    expect(content.trim()).toBe("1.3.2");
  });

  const dockerfiles = [
    "Dockerfile",
    "apps/web/Dockerfile",
    "apps/gateway/Dockerfile",
    "apps/engine/Dockerfile",
  ];

  for (const relPath of dockerfiles) {
    it(`pins ARG BUN_VERSION=1.3.2 in ${relPath}`, async () => {
      const filePath = join(repoRoot, relPath);
      const content = await Bun.file(filePath).text();
      expect(content).toMatch(/^ARG BUN_VERSION=1\.3\.2$/m);
    });
  }

  it("maintains expected engines.bun and packageManager in package.json", async () => {
    const pkgPath = join(repoRoot, "package.json");
    const raw = await Bun.file(pkgPath).text();
    const pkg = JSON.parse(raw);
    expect(pkg.engines?.bun).toBe(">=1.3.2 <1.5.0");
    expect(pkg.packageManager).toBe("bun@1.3.2");
  });
});
