import type {
  ID,
  NotificationChannel,
  NotificationType,
} from "./common";
import type { User } from "./user";

export interface Notification {
  _id?: ID;
  id: ID;
  user: ID | User;
  channel?: NotificationChannel;
  type: NotificationType;
  payload?: Record<string, unknown>;
  isRead?: boolean;
  readAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

