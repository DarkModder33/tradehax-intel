/** Close before an event date to the close `horizon` sessions later, as a percent. */
export function realizedMove(closes: { date: string; close: number }[], eventDate: string, horizon = 1): number | null {
  const index = closes.findIndex((point) => point.date >= eventDate);
  if (index <= 0 || index - 1 + horizon >= closes.length) return null;
  const before = closes[index - 1].close;
  const after = closes[index - 1 + horizon].close;
  if (!before) return null;
  return after / before - 1;
}
