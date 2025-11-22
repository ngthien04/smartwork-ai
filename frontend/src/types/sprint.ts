export type SprintStatus = 'planned' | 'active' | 'completed' | 'cancelled';

export interface Sprint {
  _id: string;
  team: string | { _id: string; name: string };
  project: string | { _id: string; name: string; key?: string };
  name: string;
  goal?: string;
  startDate?: string;
  endDate?: string;
  status: SprintStatus;
  createdAt?: string;
  updatedAt?: string;
}
