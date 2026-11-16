import { upcomingFomc } from "@/lib/market/fomc";

export function FomcList() {
  const meetings = upcomingFomc("2026-11-16");
  return (
    <section className="rounded-xl bg-card/70 px-3 py-2 ring-1 ring-foreground/10">
      <h2 className="text-sm font-medium">FOMC, Federal Reserve calendar</h2>
      <ul className="mt-2 text-sm">
        {meetings.map((meeting) => (
          <li key={meeting.ends}>{meeting.ends}{meeting.note ? ` · ${meeting.note}` : ""}</li>
        ))}
      </ul>
    </section>
  );
}
