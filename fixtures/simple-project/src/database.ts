export interface DbRecord {
  id: string;
}

// Leaf module: no internal imports.
export function query<T extends DbRecord>(table: string, id: string): T | null {
  return null;
}
