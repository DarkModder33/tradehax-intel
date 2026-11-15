export interface MonthStat {
  month: number;
  average: number;
  median: number;
  min: number;
  max: number;
  positive: number;
  samples: number;
}

export function monthlyReturns(points: { date: string; close: number }[]): MonthStat[] {
  const grouped = new Map<number, number[]>();
  for (let i = 1; i < points.length; i++) {
    const previous = points[i - 1];
    const current = points[i];
    if (previous.close <= 0) continue;
    const month = Number(current.date.slice(5, 7));
    const change = current.close / previous.close - 1;
    const bucket = grouped.get(month) ?? [];
    bucket.push(change);
    grouped.set(month, bucket);
  }
  return Array.from({ length: 12 }, (_, index) => {
    const month = index + 1;
    const values = (grouped.get(month) ?? []).slice().sort((a, b) => a - b);
    if (values.length === 0) return { month, average: 0, median: 0, min: 0, max: 0, positive: 0, samples: 0 };
    const average = values.reduce((sum, value) => sum + value, 0) / values.length;
    const median = values.length % 2 ? values[(values.length - 1) / 2] : (values[values.length / 2 - 1] + values[values.length / 2]) / 2;
    return {
      month,
      average,
      median,
      min: values[0],
      max: values[values.length - 1],
      positive: values.filter((value) => value > 0).length / values.length,
      samples: values.length,
    };
  });
}
