import { fetcher } from '@/api/fetcher';
import type { EventItem, ApiResponse } from '@/types';

export const calendarServices = {
  // Lấy events trong khoảng thời gian
  getEvents: async (from: string, to: string): Promise<ApiResponse<EventItem[]>> => {
    const { data } = await fetcher.get('/events', {
      params: { from, to }
    });
    return data;
  },

  // Tạo event mới
  createEvent: async (eventData: Partial<EventItem>): Promise<ApiResponse<EventItem>> => {
    const { data } = await fetcher.post('/events', eventData);
    return data;
  },

  // Cập nhật event
  updateEvent: async (id: string, eventData: Partial<EventItem>): Promise<ApiResponse<EventItem>> => {
    const { data } = await fetcher.put(`/events/${id}`, eventData);
    return data;
  },

  // Xóa event
  removeEvent: async (id: string): Promise<ApiResponse<void>> => {
    const { data } = await fetcher.delete(`/events/${id}`);
    return data;
  },

  // AI đề xuất lịch trình
  aiSuggest: async (payload: {
    tasks: any[];
    slots: { start: string; end: string }[];
  }): Promise<ApiResponse<any[]>> => {
    const { data } = await fetcher.post('/events/ai-suggest', payload);
    return data;
  },

  // Đồng bộ với Google Calendar (mock)
  syncGoogleCalendar: async (): Promise<ApiResponse<void>> => {
    const { data } = await fetcher.post('/calendar/sync/google');
    return data;
  },

  // Đồng bộ với Microsoft Calendar (mock)
  syncMicrosoftCalendar: async (): Promise<ApiResponse<void>> => {
    const { data } = await fetcher.post('/calendar/sync/microsoft');
    return data;
  },
};
