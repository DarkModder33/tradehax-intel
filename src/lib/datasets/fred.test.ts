import { describe, expect, it } from "vitest";
import { appendPc, assembleCurve, parseFredCsv } from "./fred";

describe("FRED and put-call history", () => {
  it("treats a dot as missing and builds the curve", () => {
    const points = parseFredCsv("DATE,DGS10\n2026-11-13,4.1\n2026-11-14,.\n");
    expect(points).toEqual([
      { date: "2026-11-13", value: 4.1 },
      { date: "2026-11-14", value: null },
    ]);
    const curve = assembleCurve({ DGS2: 4, DGS10: 4.2 });
    expect(curve.find((point) => point.tenor === "DGS3MO")?.value).toBeNull();
    expect(curve.find((point) => point.tenor === "DGS10")?.value).toBe(4.2);
    expect(appendPc([{ date: "2026-11-13", total: 0.8 }], [{ date: "2026-11-13", total: 0.9 }, { date: "2026-11-14", total: 0.7 }])).toEqual([
      { date: "2026-11-13", total: 0.9 },
      { date: "2026-11-14", total: 0.7 },
    ]);
  });
});
