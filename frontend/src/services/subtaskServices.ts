import api from './api';
import type { Subtask } from '@/types/subtask';

export interface SubtaskListResponse {
  page: number;
  limit: number;
  total: number;
  items: Subtask[];
}

const subtaskServices = {
  // GET /api/subtasks?parentTask=...
  list(params: { parentTask: string; page?: number; limit?: number }) {
    return api.get<SubtaskListResponse>('/subtasks', { params });
  },

  // POST /api/subtasks
  create(payload: { parentTask: string; title: string; assignee?: string; order?: number }) {
    return api.post<Subtask>('/subtasks', payload);
  },

  // PUT /api/subtasks/:id
  update(
    id: string,
    payload: {
      title?: string;
      isDone?: boolean;
      assignee?: string;
      order?: number;
    },
  ) {
    return api.put<Subtask>(`/subtasks/${id}`, payload);
  },

  // PATCH /api/subtasks/:id/toggle
  toggle(id: string) {
    return api.patch<Subtask>(`/subtasks/${id}/toggle`);
  },

  

  // DELETE /api/subtasks/:id
  remove(id: string) {
    return api.delete(`/subtasks/${id}`);
  },

  // POST /api/subtasks/reorder
  reorder(parentTask: string, orders: { id: string; order: number }[]) {
    return api.post<{ parentTask: string; items: Subtask[] }>('/subtasks/reorder', {
      parentTask,
      orders,
    });
  },
};

export default subtaskServices;
export type { Subtask };
