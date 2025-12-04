import api from './api';

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

export interface SprintListResponse {
  page: number;
  limit: number;
  total: number;
  items: Sprint[];
}

export interface SprintListParams {
  project?: string;
  team?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

const sprintServices = {
  list(params?: SprintListParams) {
    return api.get<SprintListResponse>('/sprints', { params });
  },

  get(id: string) {
    return api.get<Sprint>(`/sprints/${id}`);
  },

  create(data: {
    project: string;
    name: string;
    goal?: string;
    startDate?: string | Date;
    endDate?: string | Date;
    status?: SprintStatus;
  }) {
    return api.post<Sprint>('/sprints', data);
  },

  update(
    id: string,
    data: Partial<{
      name: string;
      goal: string;
      startDate: string | Date;
      endDate: string | Date;
      status: SprintStatus;
    }>,
  ) {
    return api.put<Sprint>(`/sprints/${id}`, data);
  },

  remove(id: string) {
    return api.delete(`/sprints/${id}`);
  },

  start(id: string) {
    return api.post<Sprint>(`/sprints/${id}/start`);
  },

  complete(id: string) {
    return api.post<Sprint>(`/sprints/${id}/complete`);
  },

  cancel(id: string) {
    return api.post<Sprint>(`/sprints/${id}/cancel`);
  },
};

export default sprintServices;
