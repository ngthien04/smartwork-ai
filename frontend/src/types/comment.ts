import type { ID } from './common';
import type { User } from './user';
import type { Task } from './task';

export interface Comment {
  _id?: ID;
  id: ID;
  task: ID | Task;
  author: ID | User;
  content: string;
  mentions?: Array<ID | User>;
  isEdited?: boolean;
  edited?: boolean;
  editedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
