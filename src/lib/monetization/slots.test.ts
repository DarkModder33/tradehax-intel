import { describe, expect, it } from "vitest";
import { adsTxtLine, adsenseConfig, affiliateLinks, gscToken, newsletterUrl } from "./slots";

describe("monetization slots", () => {
  it("stays off until each value is set", () => {
    expect(adsenseConfig({})).toBeNull();
    expect(adsenseConfig({ NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-1" })).toBeNull();
    expect(adsenseConfig({ NEXT_PUBLIC_ADSENSE_CLIENT: "ca-pub-1", NEXT_PUBLIC_ADSENSE_SLOT: "2" })).toEqual({ client: "ca-pub-1", slot: "2" });
    expect(adsTxtLine("")).toBeNull();
    expect(adsTxtLine("ca-pub-123")).toBe("google.com, pub-123, DIRECT, f08c47fec0942fa0\n");
    expect(newsletterUrl({})).toBeNull();
    expect(newsletterUrl({ NEXT_PUBLIC_NEWSLETTER_URL: "https://example.com/join" })).toBe("https://example.com/join");
    expect(gscToken({})).toBeNull();
    expect(affiliateLinks([])).toEqual([]);
    expect(affiliateLinks([{ href: "http://insecure.example", label: "No" }, { href: "https://broker.example/join", label: "Broker" }])).toEqual([
      { href: "https://broker.example/join", label: "Broker" },
    ]);
  });
});
