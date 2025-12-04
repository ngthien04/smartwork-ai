
import api from './api';

export type AIPlanPayload = {
  goal: string;
  constraints?: {
    deadline?: string;
    maxTasks?: number;
  };
};

export type AIPlannedTask = {
  title: string;
  description?: string;
  priority?: 'low' | 'normal' | 'high' | 'urgent';
  estimateHours?: number;
  order?: number;
};

export const aiServices = {
  
  planner(payload: AIPlanPayload) {
    
    return api.post<{ goal: string; tasks: AIPlannedTask[] }>(
      '/ai/plan',
      payload,
    );
  },

  
  analyzeTaskPriority(taskId: string) {
    return api.post(`/ai/tasks/${taskId}/priority`);
  },

  
  
  async chat(payload: any): Promise<string> {
    const res = await api.post('/ai/chat', payload);
    
    return res.data?.message ?? '';
  },

  
  async *chatStream(payload: any): AsyncGenerator<string> {
    const text = await aiServices.chat(payload);
    yield text; 
  },

  acceptInsight(id: string, apply?: any) {
    return api.post(`/ai-insights/${id}/accept`, apply ? { apply } : {});
  },

  dismissInsight(id: string) {
    return api.post(`/ai-insights/${id}/dismiss`);
  },
};
