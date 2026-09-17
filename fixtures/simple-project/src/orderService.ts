import { query } from './database';

export interface Order {
  id: string;
  userId: string;
  total: number;
}

export function getOrder(id: string): Order | null {
  return query<Order>('orders', id);
}
