import api from './api';

export type CalendarEvent = {
  _id: string;
  title: string;
  description?: string;
  location?: string;
  start: string; // ISO
  end: string;   // ISO
  allDay?: boolean;
  color?: string;
  createdAt?: string;
  updatedAt?: string;
};

export const calendarServices = {
  // GET /events?start&end
  getEvents(startIso: string, endIso: string) {
    return api.get<CalendarEvent[]>('/events', {
      params: { start: startIso, end: endIso },
    });
  },

  createEvent(payload: {
    title: string;
    start: string;
    end: string;
    location?: string;
    description?: string;
    allDay?: boolean;
    color?: string;
  }) {
    return api.post<CalendarEvent>('/events', payload);
  },

  updateEvent(id: string, payload: Partial<{
    title: string;
    start: string;
    end: string;
    location: string;
    description: string;
    allDay: boolean;
    color: string;
  }>) {
    return api.put<CalendarEvent>(`/events/${id}`, payload);
  },

  removeEvent(id: string) {
    return api.delete(`/events/${id}`);
  },
};
