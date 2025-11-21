// src/types/attachment.ts
import type { ID } from './common';
import type { Task } from './task';
import type { Subtask } from './subtask';
import type { User } from './user';

export interface Attachment {
  _id?: ID;
  id: ID;
  task?: ID | Task;
  subtask?: ID | Subtask;     // 🌟 NEW
  uploadedBy: ID | User;
  name: string;
  mimeType?: string;
  size?: number;
  storage?: {
    provider: string;
    key?: string;
    url?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}
