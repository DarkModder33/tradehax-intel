import { describe, expect, it } from "vitest";
import { barsPayload } from "./market.ts";

describe("worker bars route", () => {
  it("refuses bars when Alpaca is not configured and rejects a bad timeframe", async () => {
    const previousKey = process.env.ALPACA_KEY_ID;
    const previousSecret = process.env.ALPACA_SECRET;
    delete process.env.ALPACA_KEY_ID;
    delete process.env.ALPACA_SECRET;
    const missing = await barsPayload("SPY", "1Day", "100");
    expect(missing.status).toBe(503);
    expect(missing.body).toMatchObject({ source: "unavailable" });
    const bad = await barsPayload("SPY", "2Day", "100");
    expect(bad.status).toBe(400);
    if (previousKey) process.env.ALPACA_KEY_ID = previousKey;
    if (previousSecret) process.env.ALPACA_SECRET = previousSecret;
  });
});
