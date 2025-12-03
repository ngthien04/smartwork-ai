import { fetcher } from '@/api/fetcher';
import type { EventItem, ApiResponse } from '@/types';

export const calendarServices = {
  
  getEvents: async (from: string, to: string): Promise<ApiResponse<EventItem[]>> => {
    const { data } = await fetcher.get('/events', {
      params: { from, to }
    });
    return data;
  },

  
  createEvent: async (eventData: Partial<EventItem>): Promise<ApiResponse<EventItem>> => {
    const { data } = await fetcher.post('/events', eventData);
    return data;
  },

  
  updateEvent: async (id: string, eventData: Partial<EventItem>): Promise<ApiResponse<EventItem>> => {
    const { data } = await fetcher.put(`/events/${id}`, eventData);
    return data;
  },

  
  removeEvent: async (id: string): Promise<ApiResponse<void>> => {
    const { data } = await fetcher.delete(`/events/${id}`);
    return data;
  },

  
  aiSuggest: async (payload: {
    tasks: any[];
    slots: { start: string; end: string }[];
  }): Promise<ApiResponse<any[]>> => {
    const { data } = await fetcher.post('/events/ai-suggest', payload);
    return data;
  },

  
  syncGoogleCalendar: async (): Promise<ApiResponse<void>> => {
    const { data } = await fetcher.post('/calendar/sync/google');
    return data;
  },

  
  syncMicrosoftCalendar: async (): Promise<ApiResponse<void>> => {
    const { data } = await fetcher.post('/calendar/sync/microsoft');
    return data;
  },
};
