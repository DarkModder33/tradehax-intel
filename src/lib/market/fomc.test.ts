import { describe, expect, it } from "vitest";
import { FOMC_MEETINGS, upcomingFomc } from "./fomc";
import { realizedMove } from "@/lib/options/realized";

describe("FOMC and realized earnings moves", () => {
  it("keeps the published 2026 and 2027 decision dates", () => {
    expect(FOMC_MEETINGS.filter((meeting) => meeting.ends.startsWith("2026"))).toHaveLength(8);
    expect(FOMC_MEETINGS.filter((meeting) => meeting.ends.startsWith("2027"))).toHaveLength(8);
    expect(upcomingFomc("2026-11-16")[0].ends).toBe("2026-12-09");
  });

  it("measures the close-to-close move after a report date", () => {
    const move = realizedMove(
      [
        { date: "2026-11-12", close: 100 },
        { date: "2026-11-13", close: 110 },
      ],
      "2026-11-13",
    );
    expect(move).toBeCloseTo(0.1);
  });
});
