export function log(message: string, level: string): void {
  if (level === 'error') {
    console.error(message);
  } else {
    console.log(message);
  }
}
