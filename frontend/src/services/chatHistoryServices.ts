import api from './api';

export type ChatMsg = {
  role: 'user' | 'assistant';
  content: string;
  createdAt: string;
};

export const chatHistoryServices = {
  async getHistory(params?: { team?: string }) {
    const res = await api.get<{ messages: ChatMsg[] }>('/ai/chat/history', { params });
    return res.data?.messages ?? [];
  },

  async sendMessage(payload: { content: string; team?: string }) {
    const res = await api.post<{
      reply: string;
      meta?: any;
      messages: ChatMsg[];
    }>('/ai/chat/message', payload);
    return res.data;
  },

  async clearHistory(params?: { team?: string }) {
    await api.delete('/ai/chat/history', { params });
  },
};