// src/services/taskServices.ts
import api from './api';
import type { RcFile } from 'antd/es/upload/interface';

// Các params filter khi list task
export interface TaskListParams {
  team?: string;
  project?: string;
  sprint?: string;
  assignee?: string;
  status?: string;   // ví dụ: "todo,in_progress"
  priority?: string; // ví dụ: "high,urgent"
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;     // mặc định backend: -createdAt
}

export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

// ---- Attachment type (map với AttachmentModel) ----
export interface AttachmentStorage {
  provider: string;
  key?: string;
  url?: string;
}

// thêm gần đầu file
export interface UploadAttachmentOptions {
  folder?: string;
  filename?: string;
  subtaskId?: string;  // 🌟 thêm field này
}


export interface Attachment {
  _id: string;
  task: string;
  uploadedBy: string | {
    _id: string;
    name: string;
    email?: string;
    avatarUrl?: string;
  };
  name: string;
  mimeType?: string;
  size?: number;
  storage?: AttachmentStorage;
  createdAt?: string;
  updatedAt?: string;
}

// Shape cơ bản cho task backend trả về
export interface Task {
  _id: string;
  team: string;
  project?: string | any;
  sprint?: string | any;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees?: any[];
  labels?: any[];
  dueDate?: string;
  startDate?: string;
  estimate?: number;
  storyPoints?: number;
  attachments?: Attachment[]; // <--- THÊM
  createdAt: string;
  updatedAt: string;
}

// Payload tạo task
export interface CreateTaskPayload {
  team: string;
  project?: string;
  sprint?: string;
  title: string;
  description?: string;
  type?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignees?: string[];
  labels?: string[];
  dueDate?: string;    // ISO string
  startDate?: string;  // ISO string
  estimate?: number;
  storyPoints?: number;
}

// update chung
export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  type?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project?: string;
  sprint?: string;
  assignees?: string[];
  labels?: string[];
  dueDate?: string;
  startDate?: string;
  estimate?: number;
  timeSpent?: number;
  storyPoints?: number;
  ai?: any;
}

export interface TaskOverviewResponse {
  byStatus: Array<{ _id: TaskStatus; count: number }>;
  byAssignee: Array<{ _id: string | null; count: number }>;
  overdue: number;
}

const taskServices = {
  // GET /api/tasks
  list(params: TaskListParams) {
    return api.get<{ items: Task[]; total: number; page: number; limit: number }>(
      '/tasks',
      { params },
    );
  },

  // GET /api/tasks/:taskId
  getById(taskId: string) {
    return api.get<Task>(`/tasks/${taskId}`);
  },

  // POST /api/tasks
  create(payload: CreateTaskPayload) {
    return api.post<Task>('/tasks', payload);
  },

  // PUT /api/tasks/:taskId
  update(taskId: string, payload: UpdateTaskPayload) {
    return api.put<Task>(`/tasks/${taskId}`, payload);
  },

  // PUT /api/tasks/:taskId/status
  updateStatus(taskId: string, status: TaskStatus) {
    return api.put<Task>(`/tasks/${taskId}/status`, { status });
  },

  // PUT /api/tasks/:taskId/assign
  updateAssignees(taskId: string, assignees: string[]) {
    return api.put<Task>(`/tasks/${taskId}/assign`, { assignees });
  },

  // DELETE /api/tasks/:taskId
  delete(taskId: string) {
    return api.delete(`/tasks/${taskId}`);
  },

  // GET /api/tasks/stats/overview
  getOverview(params: { team: string; project?: string; sprint?: string }) {
    return api.get<TaskOverviewResponse>('/tasks/stats/overview', { params });
  },

  // ========= ATTACHMENTS =========
  // POST /api/tasks/:taskId/attachments/upload (Cloudinary)
  uploadAttachment(
    taskId: string,
    file: File | Blob,
    options: UploadAttachmentOptions = {},
  ) {
    const formData = new FormData();
    formData.append('file', file);

    if (options.folder) {
      formData.append('folder', options.folder);
    }
    if (options.filename) {
      formData.append('filename', options.filename);
    }
    if (options.subtaskId) {
      formData.append('subtaskId', options.subtaskId); // 🌟 cái này quan trọng
    }

    return api.post(`/tasks/${taskId}/attachments/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  // (Optional) POST /api/tasks/:taskId/attachments - nếu muốn tạo metadata thủ công
  createAttachment(taskId: string, payload: {
    name: string;
    mimeType?: string;
    size?: number;
    storage?: any;
  }) {
    return api.post(`/tasks/${taskId}/attachments`, payload);
  },

  // DELETE /api/tasks/:taskId/attachments/:attachmentId
  deleteAttachment(taskId: string, attachmentId: string) {
    return api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
  },
};

export default taskServices;
