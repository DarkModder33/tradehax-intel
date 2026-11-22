import { describe, expect, it } from "vitest";
import { linePath } from "./theme";

describe("chart theme", () => {
  it("builds one path from the shared scale", () => {
    const path = linePath([1, 2, 3], 100, 40);
    expect(path.startsWith("M")).toBe(true);
    expect(path.split("L")).toHaveLength(3);
  });
});
