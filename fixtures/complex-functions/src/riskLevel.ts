export function riskLevel(score: number, isFlagged: boolean): string {
  if (score > 90 || isFlagged) {
    return 'critical';
  } else if (score > 70 && score <= 90) {
    return 'high';
  } else if (score > 40) {
    return 'medium';
  }
  return 'low';
}
