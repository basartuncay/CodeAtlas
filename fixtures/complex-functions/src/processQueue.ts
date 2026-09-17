export function processQueue(items: number[]): number[] {
  const results: number[] = [];
  for (const item of items) {
    let value = item;
    while (value > 10) {
      value = value / 2;
    }
    switch (true) {
      case value < 0:
        results.push(0);
        break;
      case value === 0:
        results.push(0);
        break;
      default:
        results.push(value);
    }
  }
  return results;
}
