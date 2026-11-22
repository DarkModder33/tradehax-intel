import { describe, expect, it } from "vitest";
import { barsToRecords, notebookRoundTrip } from "./th-bridge";

describe("python lab bridge", () => {
  it("serializes bars and round-trips a notebook", () => {
    const records = barsToRecords([{ time: Date.parse("2026-11-16T00:00:00Z"), open: 1, high: 2, low: 0.5, close: 1.5, volume: 10 }]);
    expect(records[0].close).toBe(1.5);
    expect(records[0].time).toContain("2026-11-16");
    const notebook = { id: "sma", title: "SMA cross", cells: ["print(1)"] };
    expect(notebookRoundTrip(notebook)).toEqual(notebook);
  });
});
