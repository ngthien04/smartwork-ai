// src/services/taskServices.ts
import { fetcher } from '@/api/fetcher';
import type { Task, PaginatedResponse, ApiResponse } from '@/types';

export const taskServices = {
  // Lấy danh sách tasks với filter
  list: async (params?: {
    status?: string;
    q?: string;
    tag?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResponse<Task>> => {
    const { data } = await fetcher.get('/tasks', { params });
    return data;
  },

  // Tạo task mới
  create: async (taskData: Partial<Task>): Promise<ApiResponse<Task>> => {
    const { data } = await fetcher.post('/tasks', taskData);
    return data;
  },

  // Cập nhật task
  update: async (id: string, taskData: Partial<Task>): Promise<ApiResponse<Task>> => {
    const { data } = await fetcher.put(`/tasks/${id}`, taskData);
    return data;
  },

  // Xóa task
  remove: async (id: string): Promise<ApiResponse<void>> => {
    const { data } = await fetcher.delete(`/tasks/${id}`);
    return data;
  },

  // Sắp xếp lại tasks (cho drag & drop)
  reorder: async (id: string, newOrder: number): Promise<ApiResponse<void>> => {
    const { data } = await fetcher.post(`/tasks/${id}/reorder`, { order: newOrder });
    return data;
  },

  // Cập nhật status của task
  updateStatus: async (id: string, status: Task['status']): Promise<ApiResponse<Task>> => {
    const { data } = await fetcher.patch(`/tasks/${id}/status`, { status });
    return data;
  },

  // Tạo nhiều tasks cùng lúc
  createBatch: async (tasks: Partial<Task>[]): Promise<ApiResponse<Task[]>> => {
    const { data } = await fetcher.post('/tasks/batch', { tasks });
    return data;
  },
};
