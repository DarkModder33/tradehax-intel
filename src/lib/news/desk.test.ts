import { describe, expect, it } from "vitest";
import { buildDeskStories, moverCandidates, substance } from "../../../scripts/news/desk.mjs";

function series(closes: number[], start = "2026-06-01", volume = 1_000_000, lastVolume = volume) {
  const out = [];
  let day = Date.parse(`${start}T12:00:00Z`);
  for (let i = 0; i < closes.length; i++) {
    while ([0, 6].includes(new Date(day).getUTCDay())) day += 86_400_000;
    out.push({ date: new Date(day).toISOString().slice(0, 10), close: closes[i], volume: i === closes.length - 1 ? lastVolume : volume });
    day += 86_400_000;
  }
  return out;
}

const flat = (n: number, value: number) => Array.from({ length: n }, (_, i) => value + (i % 2 ? 0.2 : -0.2));
const now = "2026-11-23T22:00:00Z";

describe("desk stories", () => {
  const nvda = series([...flat(124, 150), 125.53, 165.05], "2026-06-01", 1_000_000, 2_700_000);
  const smh = series([...flat(124, 400), 400.06, 460.1], "2026-06-01");
  const spy = series([...flat(124, 700), 689.81, 722.29], "2026-06-01");
  const lastDay = nvda.at(-1)!.date;

  it("only flags real movers", () => {
    expect(moverCandidates({ NVDA: nvda, SPY: spy, SMH: smh }).map((row) => row.sym)).toEqual(["NVDA", "SPY"]);
  });

  it("writes a mover story with a why, context, a table and things to watch", () => {
    const stories = buildDeskStories({ bars: { NVDA: nvda, SMH: smh, SPY: spy }, headlines: { NVDA: [{ title: "Nvidia stock climbs as board reinstates CEO", publisher: "Yahoo Finance" }] }, asOf: now }, { now });
    const story = stories.find((item) => item?.id === `NVDA|mover|${lastDay}`)!;
    expect(story.headline).toMatch(/^Nvidia shares surge 31\.5%, their biggest one-day gain/);
    expect(story.lede).toContain("Yahoo Finance reported");
    expect(story.sections[0].paragraphs[0]).toMatch(/semiconductors \(SMH\)/);
    expect(story.table.rows.length).toBeGreaterThanOrEqual(5);
    expect(story.watch.length).toBeGreaterThanOrEqual(2);
    expect(story.body.join(" ")).not.toMatch(/reads .* The figure comes from/);
  });

  it("refuses thin stories", () => {
    expect(substance({ lede: "Short.", table: { rows: [] }, watch: [], sections: [] })).toEqual(expect.arrayContaining(["thin lede", "table under minimum rows", "not enough to watch", "no context"]));
  });

  it("recaps earnings against the implied move with the history table", () => {
    const earnings = {
      rows: [
        { sym: "WMT", reportDate: "2026-11-19", beforeDate: "2026-11-18", afterDate: "2026-11-20", closeBefore: 127.36, closeAfter: 127.95, realized: 0.0046, implied: 0.062, surprisePct: 1.56, impliedSource: "Alpaca option bars" },
        { sym: "WMT", reportDate: "2026-08-20", realized: -0.093, implied: 0.05, surprisePct: 11 },
        { sym: "WMT", reportDate: "2026-05-21", realized: -0.081, implied: 0.045, surprisePct: 1.5 },
      ],
      upcoming: [],
    };
    const [story] = (buildDeskStories({ earnings, bars: {}, asOf: now }, { now }) as NonNullable<ReturnType<typeof buildDeskStories>[number]>[]);
    expect(story.headline).toBe("Walmart moves just 0.5% on earnings, well inside the 6.2% options priced");
    expect(story.table.rows).toHaveLength(3);
    expect(story.lede).toContain("options sellers kept the premium");
  });
});
