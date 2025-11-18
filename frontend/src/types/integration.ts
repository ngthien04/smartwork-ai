import type { ID, IntegrationProvider } from "./common";
import type { Team } from "./team";

export interface Integration {
  _id?: ID;
  id: ID;
  team: ID | Team;
  provider: IntegrationProvider;
  config?: Record<string, unknown>;
  isActive?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

