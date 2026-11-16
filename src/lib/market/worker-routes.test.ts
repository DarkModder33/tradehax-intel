import { describe, expect, it } from "vitest";
import { barsPayload } from "../../../worker/src/market";

describe("worker market routes", () => {
  it("refuses bars without Alpaca keys and rejects an unknown timeframe", async () => {
    const previousKey = process.env.ALPACA_KEY_ID;
    const previousSecret = process.env.ALPACA_SECRET;
    delete process.env.ALPACA_KEY_ID;
    delete process.env.ALPACA_SECRET;
    expect(await barsPayload("SPY", "1Day", "100")).toMatchObject({ status: 503 });
    expect((await barsPayload("SPY", "2Day", "10")).status).toBe(400);
    if (previousKey) process.env.ALPACA_KEY_ID = previousKey;
    if (previousSecret) process.env.ALPACA_SECRET = previousSecret;
  });
});
