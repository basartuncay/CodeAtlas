export function retryWithLogging(fn: () => number, attempts: number): number {
  const logError = (err: unknown): void => {
    if (err instanceof Error) {
      console.error(err.message);
    }
  };

  for (let i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (err) {
      logError(err);
    }
  }
  return -1;
}
