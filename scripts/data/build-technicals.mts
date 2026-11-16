import { writeFile } from "node:fs/promises";
import { DEFAULT_UNIVERSE } from "../../src/lib/live/universe.ts";
import { parseYahooChart, toYahooSymbol } from "../../src/lib/market/yahoo.ts";
import { technicalsFromBars } from "../../src/lib/screener/technicals.ts";

const rows: Record<string, ReturnType<typeof technicalsFromBars>> = {};
const errors: string[] = [];
for (const symbol of DEFAULT_UNIVERSE) {
  try {
    const yahoo = toYahooSymbol(symbol);
    const response = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=1d&range=2y`, {
      headers: { "user-agent": "Mozilla/5.0" },
    });
    if (!response.ok) throw new Error(String(response.status));
    rows[symbol] = technicalsFromBars(parseYahooChart(await response.json(), symbol).bars);
    process.stdout.write(".");
  } catch (error) {
    errors.push(`${symbol}: ${error instanceof Error ? error.message : error}`);
    process.stdout.write("x");
  }
}
const payload = {
  meta: {
    asOf: new Date().toISOString(),
    source: "Yahoo daily bars",
    rows: Object.keys(rows).length,
    delay: "delayed",
    unavailable: Object.keys(rows).length === 0,
    coverage: Object.keys(rows).length / DEFAULT_UNIVERSE.length,
    note: "Technicals for the liquid universe. Other screener names stay null until the worker publishes a full file.",
  },
  rows,
  errors,
};
await writeFile("public/data/technicals.json", JSON.stringify(payload));
console.log(`\n${Object.keys(rows).length} symbols`);
