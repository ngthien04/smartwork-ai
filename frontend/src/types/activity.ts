import type { ID } from "./common";
import type { Team } from "./team";
import type { User } from "./user";

export type ActivityTargetType = "task" | "project" | "comment" | "sprint" | "label";

export interface Activity {
  _id?: ID;
  id: ID;
  team: ID | Team;
  actor: ID | User;
  verb: string;
  targetType: ActivityTargetType;
  targetId: ID;
  metadata?: Record<string, unknown>;
  createdAt?: string;
  updatedAt?: string;
}

