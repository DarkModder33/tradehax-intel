// Bundles src/server.ts and the shared ../src/lib modules into dist/server.mjs so worker/ can be deployed alone.
// Run from the repo root with esbuild available: npx esbuild is enough (node worker/build.mjs).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const srcDir = fileURLToPath(new URL("../src/", import.meta.url));

await build({
  entryPoints: [new URL("./src/server.ts", import.meta.url).pathname],
  outfile: new URL("./dist/server.mjs", import.meta.url).pathname,
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  tsconfig: new URL("../tsconfig.json", import.meta.url).pathname,
  logLevel: "info",
  plugins: [
    {
      name: "at-alias",
      setup(bundle) {
        bundle.onResolve({ filter: /^@\// }, (args) => {
          const base = path.join(srcDir, args.path.slice(2));
          const hit = [base, `${base}.ts`, `${base}.tsx`, `${base}.mjs`, path.join(base, "index.ts")].find((file) => fs.existsSync(file) && fs.statSync(file).isFile());
          return hit ? { path: hit } : { errors: [{ text: `Cannot resolve ${args.path}` }] };
        });
      },
    },
  ],
});
