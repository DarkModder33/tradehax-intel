import { describe, expect, it } from "vitest";
import { usEquitySession } from "./session";

describe("usEquitySession", () => {
  it("is open during regular hours on a weekday", () => {
    // Friday 13 Nov 2026, 15:00 America/New_York (EST, UTC-5).
    expect(usEquitySession(new Date("2026-11-13T20:00:00Z")).status).toBe("open");
  });

  it("is closed before the bell, after the close, and on Sunday", () => {
    expect(usEquitySession(new Date("2026-11-13T14:29:00Z")).status).toBe("closed");
    expect(usEquitySession(new Date("2026-11-13T14:30:00Z")).status).toBe("open");
    expect(usEquitySession(new Date("2026-11-13T21:00:00Z")).status).toBe("closed");
    expect(usEquitySession(new Date("2026-11-15T15:00:00Z")).status).toBe("closed");
    expect(usEquitySession(new Date("2026-11-15T15:00:00Z")).label).toBe("US market closed");
  });
});
