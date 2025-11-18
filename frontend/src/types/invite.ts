import type { ID, TeamRole } from "./common";
import type { Team } from "./team";
import type { User } from "./user";

export interface Invite {
  _id?: ID;
  id: ID;
  team: ID | Team;
  email: string;
  role: TeamRole;
  token: string;
  expiresAt: string;
  acceptedBy?: ID | User;
  acceptedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

