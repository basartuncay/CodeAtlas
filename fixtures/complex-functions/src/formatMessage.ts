export function formatMessage(user: { name: string } | null, count: number): string {
  const label = count === 1 ? 'item' : 'items';
  const displayName = user?.name ?? 'Guest';
  return `${displayName} has ${count} ${label}`;
}
