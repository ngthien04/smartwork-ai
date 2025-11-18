// src/services/aiServices.ts
import { fetcher } from '@/api/fetcher';
import type {
  AIChatRequest,
  AIChatResponse,
  AISummarizeRequest,
  AISummarizeResponse,
  AIPlannerRequest,
  AIPlannerResponse,
  AICalendarSuggestRequest,
  AICalendarSuggestResponse,
} from '@/types';

export const aiServices = {
  // Chat với AI
  chat: async (payload: AIChatRequest): Promise<AIChatResponse> => {
    const { data } = await fetcher.post('/ai/chat', payload);
    return data;
  },

  // Tóm tắt văn bản
  summarize: async (payload: AISummarizeRequest): Promise<AISummarizeResponse> => {
    const { data } = await fetcher.post('/ai/summarize', payload);
    return data;
  },

  // Lập kế hoạch từ mục tiêu
  planner: async (payload: AIPlannerRequest): Promise<AIPlannerResponse> => {
    const { data } = await fetcher.post('/ai/planner', payload);
    return data;
  },

  // Đề xuất lịch trình
  calendarSuggest: async (payload: AICalendarSuggestRequest): Promise<AICalendarSuggestResponse> => {
    const { data } = await fetcher.post('/ai/calendar-suggest', payload);
    return data;
  },

  // Stream chat (SSE)
  chatStream: async function* (payload: AIChatRequest) {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3001/api'}/ai/chat/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${localStorage.getItem('token')}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error('Failed to start chat stream');
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('No reader available');
    }

    const decoder = new TextDecoder();
    let buffer = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') return;
            
            try {
              const parsed = JSON.parse(data);
              yield parsed;
            } catch (e) {
              console.warn('Failed to parse SSE data:', data);
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  },
};
