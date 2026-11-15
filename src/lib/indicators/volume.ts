/** Latest volume divided by the average of the previous `lookback` bars. */
export function volumeRatio(volumes: number[], lookback = 20): number | null {
  if (volumes.length < lookback + 1) return null;
  const prior = volumes.slice(-lookback - 1, -1);
  const average = prior.reduce((sum, value) => sum + value, 0) / prior.length;
  if (average <= 0) return null;
  return volumes[volumes.length - 1] / average;
}
