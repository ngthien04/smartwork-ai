// src/services/noteServices.ts
import api from './api';

export type NotePayload = {
  title: string;
  content: string;
  tags?: string[] | string; // chấp nhận cả array hoặc "a,b,c"
};

const baseUrl = '/notes'; 

export const noteServices = {
  list(params?: { q?: string }) {
    // => gọi GET /api/notes?q=...
    return api.get(baseUrl, { params });
  },

  create(data: NotePayload) {
    // => POST /api/notes
    return api.post(baseUrl, data);
  },

  update(id: string, data: Partial<NotePayload>) {
    // => PUT /api/notes/:id
    return api.put(`${baseUrl}/${id}`, data);
  },

  remove(id: string) {
    // => DELETE /api/notes/:id
    return api.delete(`${baseUrl}/${id}`);
  },

  aiSummarize(id: string) {
    // => POST /api/notes/:id/ai/summary
    return api.post(`${baseUrl}/${id}/ai/summary`);
  },
};
