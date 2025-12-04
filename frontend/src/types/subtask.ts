import type { ID } from './common';
import type { Task } from './task';
import type { User } from './user';

export interface Subtask {
  _id?: ID;
  id: ID;
  parentTask: ID | Task;
  title: string;
  isDone: boolean;
  assignee?: ID | User;
  order?: number;
  doneAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
