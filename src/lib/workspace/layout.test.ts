import { describe, expect, it } from "vitest";
import { decodeLayout, encodeLayout } from "./layout";

describe("workspace layout", () => {
  it("round-trips a named layout", () => {
    const layout = { name: "desk", panels: [{ id: "chart", cols: 2 as const, rows: 1 as const }, { id: "screener", cols: 1 as const, rows: 1 as const }] };
    expect(decodeLayout(encodeLayout(layout))).toEqual(layout);
    expect(decodeLayout("%%%")).toBeNull();
  });
});
