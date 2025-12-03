import api from './api';

export type NotePayload = {
  title: string;
  content: string;
  tags?: string[] | string;
};

export type Note = {
  id: string;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
};

export type NotesListResponse =
  | Note[]
  | { items: Note[]; total?: number; page?: number; limit?: number };

export type NotesListParams = {
  q?: string;
  page?: number;
  size?: number;
  limit?: number;
};

const baseUrl = '/notes'; 

export const noteServices = {
  list(params?: NotesListParams) {
    return api.get<NotesListResponse>(baseUrl, { params });
  },
  create(data: NotePayload) {
    return api.post(baseUrl, data);
  },
  update(id: string, data: Partial<NotePayload>) {
    return api.put(`${baseUrl}/${id}`, data);
  },
  remove(id: string) {
    return api.delete(`${baseUrl}/${id}`);
  },
  aiSummarize(id: string) {
    return api.post(`${baseUrl}/${id}/ai/summary`);
  },
};
