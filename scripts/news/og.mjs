import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import React from "react";
import satori from "satori";
import { Resvg } from "@resvg/resvg-js";

const root = process.cwd();
const fontPath = path.join(root, "scripts", "news", "fonts", "LiberationSans-Regular.ttf");
const source = path.resolve(process.env.NEWS_FILE ?? path.join(root, "content", "news", "stories.json"));
const outDir = path.join(root, "public", "news", "og");

function card(story) {
  const spark = Array.isArray(story.spark) ? story.spark.slice(0, 12) : [];
  const min = spark.length ? Math.min(...spark) : 0;
  const max = spark.length ? Math.max(...spark) : 1;
  const span = max - min || 1;
  const bars = spark.map((value, index) => React.createElement("div", {
    key: String(index),
    style: {
      width: "16px",
      height: `${Math.round(16 + ((value - min) / span) * 56)}px`,
      background: value >= 0 ? "#d6b25e" : "#c46b5a",
    },
  }));
  return React.createElement(
    "div",
    { style: { width: "1200px", height: "630px", background: "#14160f", color: "#f3efe4", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "56px", fontFamily: "Liberation Sans" } },
    React.createElement("div", { style: { display: "flex", fontSize: "24px", letterSpacing: "4px", color: "#d6b25e" } }, "TRADEHAX"),
    React.createElement("div", { style: { display: "flex", fontSize: "56px", lineHeight: 1.15 } }, story.headline),
    React.createElement("div", { style: { display: "flex", fontSize: "28px", color: "#c9c2b2" } }, story.dek),
    React.createElement("div", { style: { display: "flex", alignItems: "flex-end", height: "80px", gap: "8px" } }, bars),
  );
}

try {
  const font = await readFile(fontPath);
  const payload = JSON.parse(await readFile(source, "utf8"));
  await mkdir(outDir, { recursive: true });
  let written = 0;
  for (const story of payload.stories ?? []) {
    try {
      const svg = await satori(card(story), {
        width: 1200,
        height: 630,
        fonts: [{ name: "Liberation Sans", data: font, weight: 400, style: "normal" }],
      });
      const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } }).render().asPng();
      await writeFile(path.join(outDir, `${story.slug}.png`), png);
      written += 1;
    } catch (error) {
      console.error(`og: ${story.slug} skipped: ${error instanceof Error ? error.message : error}`);
    }
  }
  console.log(`og: ${written} images`);
} catch (error) {
  console.error(`og: ${error instanceof Error ? error.message : error}`);
}
