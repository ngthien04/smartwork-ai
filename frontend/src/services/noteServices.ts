// src/services/noteServices.ts
import { fetcher } from '@/api/fetcher';
import type { Note, PaginatedResponse, ApiResponse } from '@/types';

export const noteServices = {
  // Lấy danh sách notes với filter
  list: async (params?: {
    q?: string;
    tag?: string;
    page?: number;
    size?: number;
  }): Promise<PaginatedResponse<Note>> => {
    const { data } = await fetcher.get('/notes', { params });
    return data;
  },

  // Tạo note mới
  create: async (noteData: Partial<Note>): Promise<ApiResponse<Note>> => {
    const { data } = await fetcher.post('/notes', noteData);
    return data;
  },

  // Cập nhật note
  update: async (id: string, noteData: Partial<Note>): Promise<ApiResponse<Note>> => {
    const { data } = await fetcher.put(`/notes/${id}`, noteData);
    return data;
  },

  // Xóa note
  remove: async (id: string): Promise<ApiResponse<void>> => {
    const { data } = await fetcher.delete(`/notes/${id}`);
    return data;
  },

  // AI tóm tắt note
  aiSummarize: async (id: string): Promise<ApiResponse<{ summary: string; checklist: string[] }>> => {
    const { data } = await fetcher.post(`/notes/${id}/ai-summarize`);
    return data;
  },

  // Tìm kiếm trong nội dung notes
  search: async (query: string): Promise<ApiResponse<Note[]>> => {
    const { data } = await fetcher.get('/notes/search', { params: { q: query } });
    return data;
  },
};
