import type { ID } from "./common";
import type { Team } from "./team";
import type { User } from "./user";

export interface Project {
  _id?: ID;
  id: ID;
  team: ID | Team;
  name: string;
  key: string;
  description?: string;
  lead?: ID | User;
  isArchived?: boolean;
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
