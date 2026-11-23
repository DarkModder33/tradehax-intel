import { AlertTriangle, CloudOff, Inbox } from "lucide-react";

export type PanelKind = "loading" | "empty" | "error" | "unavailable";

export function panelCopy(kind: PanelKind, detail?: string): { title: string; body: string } {
  if (kind === "loading") return { title: "Loading", body: detail || "Reading the source." };
  if (kind === "empty") return { title: "Nothing matched", body: detail || "The source answered, and the filter matched no rows." };
  if (kind === "unavailable") return { title: "Unavailable", body: detail || "This source did not answer. Nothing was filled in." };
  return { title: "Error", body: detail || "The request failed." };
}

/** Placeholder rows shaped like a table while data loads. */
export function SkeletonRows({ rows = 6 }: { rows?: number }) {
  return (
    <div className="flex flex-col gap-2" aria-hidden="true">
      {Array.from({ length: rows }, (_, index) => (
        <div key={index} className="flex gap-3">
          <div className="h-4 w-20 animate-pulse rounded bg-white/[0.06]" />
          <div className="h-4 flex-1 animate-pulse rounded bg-white/[0.04]" style={{ maxWidth: `${60 + ((index * 37) % 35)}%` }} />
          <div className="ml-auto h-4 w-16 animate-pulse rounded bg-white/[0.06]" />
        </div>
      ))}
    </div>
  );
}

export function PanelState({ kind, detail, onRetry }: { kind: PanelKind; detail?: string; onRetry?: () => void }) {
  const copy = panelCopy(kind, detail);
  if (kind === "loading") {
    return (
      <div className="surface px-4 py-5" role="status">
        <p className="sr-only">{copy.title}. {copy.body}</p>
        <SkeletonRows rows={5} />
        <p className="mt-4 text-xs text-muted-foreground">{copy.body}</p>
      </div>
    );
  }
  const Icon = kind === "empty" ? Inbox : kind === "unavailable" ? CloudOff : AlertTriangle;
  return (
    <div className="surface flex flex-col items-center px-4 py-10 text-center" role="status">
      <span className="flex size-10 items-center justify-center rounded-full border border-white/10 bg-white/[0.04]">
        <Icon className={kind === "error" ? "size-4 text-bearish" : "size-4 text-muted-foreground"} />
      </span>
      <p className="mt-3 text-sm font-medium">{copy.title}</p>
      <p className="mt-1 max-w-md text-sm text-muted-foreground">{copy.body}</p>
      {onRetry ? (
        <button type="button" className="mt-4 h-9 rounded-full border border-white/15 px-4 text-xs font-medium hover:border-white/30" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
