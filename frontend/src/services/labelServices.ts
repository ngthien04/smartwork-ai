import api from './api';

export interface Label {
  _id: string;
  team: string;
  project?: string;
  name: string;
  color?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface LabelListParams {
  team: string;
  project?: string;
  q?: string;
  page?: number;
  limit?: number;
  sort?: string; 
}

export interface CreateLabelPayload {
  team: string;
  project?: string;
  name: string;
  color?: string;
  description?: string;
}

export interface UpdateLabelPayload {
  name?: string;
  color?: string;
  description?: string;
}

const labelServices = {
  list(params: LabelListParams) {
    return api.get<{ items: Label[]; total: number; page: number; limit: number }>(
      '/labels',
      { params },
    );
  },

  getById(labelId: string) {
    return api.get<Label>(`/labels/${labelId}`);
  },

  create(payload: CreateLabelPayload) {
    return api.post<Label>('/labels', payload);
  },

  update(labelId: string, payload: UpdateLabelPayload) {
    return api.put<Label>(`/labels/${labelId}`, payload);
  },

  remove(labelId: string) {
    return api.delete(`/labels/${labelId}`);
  },
};

export default labelServices;
