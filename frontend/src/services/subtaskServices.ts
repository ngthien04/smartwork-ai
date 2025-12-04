import api from './api';
import type { Subtask } from '@/types/subtask';

export interface SubtaskListResponse {
  page: number;
  limit: number;
  total: number;
  items: Subtask[];
}

const subtaskServices = {
  
  list(params: { parentTask: string; page?: number; limit?: number }) {
    return api.get<SubtaskListResponse>('/subtasks', { params });
  },

  
  create(payload: { parentTask: string; title: string; assignee?: string; order?: number }) {
    return api.post<Subtask>('/subtasks', payload);
  },

  
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

  
  toggle(id: string) {
    return api.patch<Subtask>(`/subtasks/${id}/toggle`);
  },

  

  
  remove(id: string) {
    return api.delete(`/subtasks/${id}`);
  },

  
  reorder(parentTask: string, orders: { id: string; order: number }[]) {
    return api.post<{ parentTask: string; items: Subtask[] }>('/subtasks/reorder', {
      parentTask,
      orders,
    });
  },
};

export default subtaskServices;
export type { Subtask };
