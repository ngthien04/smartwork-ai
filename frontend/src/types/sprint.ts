import type { ID, SprintStatus } from "./common";
import type { Team } from "./team";
import type { Project } from "./project";

export interface Sprint {
  _id?: ID;
  id: ID;
  team?: ID | Team;
  project: ID | Project;
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  status?: SprintStatus;
  createdAt?: string;
  updatedAt?: string;
}
