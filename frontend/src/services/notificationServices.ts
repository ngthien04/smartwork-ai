import api from './api';

export type NotificationType =
  | 'task_assigned'
  | 'task_due'
  | 'comment_mention'
  | 'sprint_status'
  | 'ai_alert'
  | 'task_comment'
  | 'task_updated'
  | 'task_status_changed'
  | 'subtask_updated'
  | 'attachment_added'
  | 'attachment_removed';


export interface Notification {
  _id: string;
  user: string | { _id: string; name: string; email?: string };
  channel: 'web' | 'email' | 'mobile';
  type: NotificationType;
  payload?: any;
  isRead: boolean;
  createdAt: string;
  readAt?: string;
}

export interface NotificationListResponse {
  page: number;
  limit: number;
  total: number;
  items: Notification[];
}

const notificationServices = {
  list(params?: { page?: number; limit?: number; type?: string }) {
    return api.get<NotificationListResponse>('/notifications', { params });
  },

  unreadCount() {
    return api.get<{ unread: number }>('/notifications/unread-count');
  },

  markRead(id: string) {
    return api.put<Notification>(`/notifications/${id}/read`);
  },

  markAllRead(before?: string) {
    // before: ISO date (optional)
    return api.post<{ matched: number; modified: number }>(
      '/notifications/mark-all-read',
      before ? { before } : {},
    );
  },

  remove(id: string) {
    return api.delete(`/notifications/${id}`);
  },
};

export default notificationServices;
