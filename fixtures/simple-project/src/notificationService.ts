import { getUser } from './userService';

export function notifyUser(userId: string, message: string): void {
  const user = getUser(userId);
  if (user) {
    console.log(`Notifying ${user.name}: ${message}`);
  }
}
