export type PanelKind = "loading" | "empty" | "error" | "unavailable";

export function panelCopy(kind: PanelKind, detail?: string): { title: string; body: string } {
  if (kind === "loading") return { title: "Loading", body: detail || "Reading the source." };
  if (kind === "empty") return { title: "Nothing matched", body: detail || "The source answered, and the filter matched no rows." };
  if (kind === "unavailable") return { title: "Unavailable", body: detail || "This source did not answer. Nothing was filled in." };
  return { title: "Error", body: detail || "The request failed." };
}

export function PanelState({ kind, detail, onRetry }: { kind: PanelKind; detail?: string; onRetry?: () => void }) {
  const copy = panelCopy(kind, detail);
  return (
    <div className="rounded-xl border border-border bg-card/60 px-4 py-6" role="status">
      <div className="mb-3 h-3 w-24 animate-pulse rounded bg-foreground/10" />
      <p className="text-sm font-medium">{copy.title}</p>
      <p className="mt-1 text-sm text-muted-foreground">{copy.body}</p>
      {onRetry ? (
        <button type="button" className="mt-3 h-9 rounded-full px-3 text-xs" onClick={onRetry}>
          Retry
        </button>
      ) : null}
    </div>
  );
}
