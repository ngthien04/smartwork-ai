import type { ID, TeamRole, TaskStatus, Priority } from "./common";
import type { User } from "./user";

export interface Team {
  _id?: ID;
  id: ID;
  name: string;
  slug: string;
  description?: string;
  leaders?: Array<ID | User>;
  members?: Array<{
    user: ID | User;
    role: TeamRole;
    joinedAt: string;
  }>;
  settings?: {
    defaultTaskStatus?: TaskStatus;
    defaultTaskPriority?: Priority;
  };
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
