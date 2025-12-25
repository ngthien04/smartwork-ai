import api from './api';

export type AIStatusItem = {
  key: 'overdue' | 'urgent' | 'blocked' | 'unassigned' | 'overloaded' | 'ok';
  text: string;
  count?: number;
};

export const aiStatusServices = {
  async getStatus(params?: { team?: string; project?: string; limit?: number }) {
    const res = await api.get<{ items: AIStatusItem[] }>('/ai/status', { params });
    return res.data?.items ?? [];
  },
};