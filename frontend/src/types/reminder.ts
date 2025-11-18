import type { ID, ReminderMethod } from "./common";
import type { User } from "./user";
import type { Task } from "./task";

export interface Reminder {
  _id?: ID;
  id: ID;
  user: ID | User;
  task?: ID | Task;
  fireAt: string;
  method?: ReminderMethod;
  sentAt?: string;
  cancelledAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

