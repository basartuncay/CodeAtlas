import { query } from './database';

export interface User {
  id: string;
  name: string;
}

export function getUser(id: string): User | null {
  return query<User>('users', id);
}
