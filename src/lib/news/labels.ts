/** Reader-facing names for each story type the engine writes. */
export const NEWS_TYPE_LABELS: Record<string, string> = {
  mover: "Top movers",
  rotation: "Sector rotation",
  short: "Short interest",
  ftd: "Fails-to-deliver",
  insider: "Insider buying",
  unusual: "Unusual options activity",
  earnings: "Earnings moves",
  macro: "Macro and rates",
  iv: "Implied volatility",
};

export function newsTypeLabel(type: string): string {
  return NEWS_TYPE_LABELS[type] ?? type.charAt(0).toUpperCase() + type.slice(1);
}
