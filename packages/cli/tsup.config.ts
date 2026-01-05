import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node18",
  platform: "node",
  bundle: true,
  splitting: false,
  clean: true,
  dts: true,
  sourcemap: false,
  // Bundle all workspace packages into the output
  noExternal: ["@vibecheck/schema", "@vibecheck/policy"],
  // Keep these as external (installed from npm)
  external: ["commander", "fast-glob", "ts-morph", "micromatch", "tar"],
  // The source file (src/index.ts) already has the shebang, so we don't need to add it here
});
