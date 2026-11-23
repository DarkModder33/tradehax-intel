import { adsenseConfig, loadAffiliates, newsletterUrl, type AffiliateLink } from "@/lib/monetization/slots";

export function AdSlot() {
  const ads = adsenseConfig();
  if (!ads) return null;
  return (
    <ins
      className="adsbygoogle"
      style={{ display: "block" }}
      data-ad-client={ads.client}
      data-ad-slot={ads.slot}
      data-ad-format="auto"
      data-full-width-responsive="true"
    />
  );
}

export function Newsletter() {
  const action = newsletterUrl();
  if (!action) return null;
  return (
    <form action={action} method="post" className="flex flex-col gap-2 rounded-xl bg-card/70 px-3 py-3 ring-1 ring-foreground/10 sm:flex-row sm:items-end">
      <label className="text-sm">
        Email
        <input name="email" type="email" required autoComplete="email" className="mt-1 block h-10 w-full rounded-md bg-background px-2 sm:w-64" />
      </label>
      <button type="submit" className="h-10 rounded-full bg-foreground px-3 text-sm text-background">Send the desk note</button>
    </form>
  );
}

export function AffiliateBlock({ links = loadAffiliates() }: { links?: AffiliateLink[] }) {
  if (!links.length) return null;
  return (
    <aside className="max-w-3xl text-sm">
      <p className="text-[11px] tracking-[0.14em] text-gold uppercase">Sponsored</p>
      <ul className="mt-1">
        {links.map((link) => (
          <li key={link.href}>
            <a href={link.href} rel="sponsored nofollow">{link.label}</a>
          </li>
        ))}
      </ul>
      <p className="mt-1 text-xs text-muted-foreground">Affiliate links. TradeHax may earn a commission. Not a recommendation.</p>
    </aside>
  );
}
