export interface WalkForwardFold {
  train: number[];
  test: number[];
}

/**
 * Expanding walk-forward splits.
 * A train index is purged when its label window [i, i+horizon] overlaps the
 * test block, and an embargo of `embargo` bars is dropped after the test block.
 */
export function walkForwardFolds(
  length: number,
  options: { horizon: number; minTrain?: number; testSize?: number; embargo?: number },
): WalkForwardFold[] {
  const horizon = Math.max(1, options.horizon);
  const embargo = options.embargo ?? horizon;
  const minTrain = options.minTrain ?? Math.max(40, horizon * 5);
  const testSize = options.testSize ?? Math.max(10, horizon * 3);
  const folds: WalkForwardFold[] = [];
  let testStart = minTrain;
  while (testStart + testSize + horizon < length) {
    const testEnd = testStart + testSize;
    const blockedFrom = testStart;
    const blockedTo = testEnd + embargo;
    const train: number[] = [];
    for (let index = 0; index < testStart; index += 1) {
      const labelEnd = index + horizon;
      if (labelEnd >= blockedFrom && index <= blockedTo) continue;
      train.push(index);
    }
    const test: number[] = [];
    for (let index = testStart; index < testEnd; index += 1) test.push(index);
    if (train.length >= minTrain / 2 && test.length > 0) folds.push({ train, test });
    testStart += testSize;
  }
  return folds;
}
