export interface LayoutPanel {
  id: string;
  cols: number;
  rows: number;
}

export interface SavedLayout {
  name: string;
  panels: LayoutPanel[];
}

export function encodeLayout(layout: SavedLayout): string {
  const json = JSON.stringify(layout);
  return btoa(json).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export function decodeLayout(raw: string): SavedLayout | null {
  try {
    const padded = raw.replace(/-/g, "+").replace(/_/g, "/");
    const parsed = JSON.parse(atob(padded + "=".repeat((4 - (padded.length % 4)) % 4))) as SavedLayout;
    if (!parsed || !Array.isArray(parsed.panels)) return null;
    return {
      name: parsed.name || "shared",
      panels: parsed.panels.filter((panel) => panel && typeof panel.id === "string").map((panel) => ({
        id: panel.id,
        cols: panel.cols === 2 ? 2 : 1,
        rows: panel.rows === 2 ? 2 : 1,
      })),
    };
  } catch {
    return null;
  }
}
