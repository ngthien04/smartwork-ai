import api from './api';
import type { Label } from './labelServices';


export type TaskStatus = 'backlog' | 'todo' | 'in_progress' | 'done';
export type TaskPriority = 'low' | 'normal' | 'high' | 'urgent';

export interface TaskListParams {
  team?: string;
  project?: string;
  sprint?: string | null;
  assignee?: string;
  status?: string;   
  priority?: string; 
  q?: string;
  page?: number;
  limit?: number;
  sort?: string;     
}


export interface AttachmentStorage {
  provider: string;
  key?: string;
  url?: string;
}

export interface UploadAttachmentOptions {
  folder?: string;
  filename?: string;
  subtaskId?: string;  
}

export interface Attachment {
  _id: string;
  task: string;
  uploadedBy:
    | string
    | {
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


export interface Task {
  _id: string;
  team: string;
  project?: string | any;
  sprint?: string | any | null;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: TaskPriority;
  assignees?: any[];
  labels?: Array<string | Label>;
  dueDate?: string;
  startDate?: string;
  estimate?: number;
  storyPoints?: number;
  attachments?: Attachment[];
  createdAt: string;
  updatedAt: string;
}



export interface CreateTaskPayload {
  team: string;
  project?: string;
  sprint?: string | null; 
  title: string;
  description?: string;
  type?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  assignees?: string[];
  labels?: string[];
  dueDate?: string;    
  startDate?: string;  
  estimate?: number;
  storyPoints?: number;
}

export interface UpdateTaskPayload {
  title?: string;
  description?: string;
  type?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  project?: string;
  sprint?: string | null;
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
  
  list(params: TaskListParams) {
    return api.get<{ items: Task[]; total: number; page: number; limit: number }>(
      '/tasks',
      { params },
    );
  },

  
  getById(taskId: string) {
    return api.get<Task>(`/tasks/${taskId}`);
  },

  
  create(payload: CreateTaskPayload) {
    return api.post<Task>('/tasks', payload);
  },

  
  update(taskId: string, payload: UpdateTaskPayload) {
    return api.put<Task>(`/tasks/${taskId}`, payload);
  },

  
  updateStatus(taskId: string, status: TaskStatus) {
    return api.put<Task>(`/tasks/${taskId}/status`, { status });
  },

  
  updateAssignees(taskId: string, assignees: string[]) {
    return api.put<Task>(`/tasks/${taskId}/assign`, { assignees });
  },

  
  delete(taskId: string) {
    return api.delete(`/tasks/${taskId}`);
  },

  
  getOverview(params: { team: string; project?: string; sprint?: string | null }) {
    return api.get<TaskOverviewResponse>('/tasks/stats/overview', { params });
  },

  

  
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
      formData.append('subtaskId', options.subtaskId);
    }

    return api.post(`/tasks/${taskId}/attachments/upload`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  
  createAttachment(
    taskId: string,
    payload: {
      name: string;
      mimeType?: string;
      size?: number;
      storage?: any;
    },
  ) {
    return api.post(`/tasks/${taskId}/attachments`, payload);
  },

  
  deleteAttachment(taskId: string, attachmentId: string) {
    return api.delete(`/tasks/${taskId}/attachments/${attachmentId}`);
  },

  setLabels(taskId: string, labelIds: string[]) {
    return api.post(`/tasks/${taskId}/labels`, { labels: labelIds });
  },
};

export default taskServices;
