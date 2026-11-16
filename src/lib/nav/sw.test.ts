import { mkdirSync, writeFileSync } from "node:fs";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { precacheList } from "../../../scripts/build/sw-manifest.mjs";

describe("service worker precache", () => {
  it("lists static chunks and the shell", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "sw-"));
    const chunk = path.join(dir, "_next", "static", "chunks");
    mkdirSync(chunk, { recursive: true });
    writeFileSync(path.join(chunk, "app.js"), "console.log(1)");
    expect(precacheList(dir)).toContain("/_next/static/chunks/app.js");
    expect(precacheList(dir)).toContain("/");
  });
});
