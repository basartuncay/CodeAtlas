import { getUser } from './userService';
import { getOrder } from './orderService';

export function getOrderWithUser(orderId: string, userId: string) {
  const order = getOrder(orderId);
  const user = getUser(userId);
  return { order, user };
}
