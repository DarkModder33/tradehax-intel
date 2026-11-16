import { describe, expect, it } from "vitest";
import { panelCopy } from "./panel-state";

describe("panel states", () => {
  it("has a distinct message for each kind", () => {
    const kinds = ["loading", "empty", "error", "unavailable"] as const;
    const titles = kinds.map((kind) => panelCopy(kind).title);
    expect(new Set(titles).size).toBe(4);
    expect(panelCopy("error", "Cboe timed out").body).toBe("Cboe timed out");
    expect(panelCopy("unavailable").body).toMatch(/Nothing was filled/);
  });
});
