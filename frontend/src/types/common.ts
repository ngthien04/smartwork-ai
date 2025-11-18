export type ID = string;

export type Priority = "low" | "normal" | "high" | "urgent";

export type TaskStatus =
  | "backlog"
  | "todo"
  | "in_progress"
  | "review"
  | "blocked"
  | "done";

export type TaskType = "task" | "bug" | "story" | "epic";

export type TeamRole = "leader" | "admin" | "member";

export type SprintStatus = "planned" | "active" | "completed" | "cancelled";

export type ReminderMethod = "web" | "email" | "mobile";

export type AIInsightKind =
  | "priority_suggestion"
  | "risk_warning"
  | "timeline_prediction"
  | "workload_balance";

export type StorageProvider = "local" | "s3" | "gcs" | "azure" | "cloudinary";

export type AuthProvider = "password" | "google" | "github" | "microsoft";

export type IntegrationProvider =
  | "slack"
  | "github"
  | "gitlab"
  | "notion"
  | "google_calendar"
  | "zapier";

export type NotificationChannel = "web" | "email" | "mobile";

export type NotificationType =
  | "task_assigned"
  | "task_due"
  | "comment_mention"
  | "sprint_status"
  | "ai_alert";

// API Response

export interface ApiResponse<T> {
  data: T;
  message?: string;
  success: boolean;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  data?: T[]; 
  size?: number; 
}

// Functions 
export function normalizeId<T extends { _id?: ID; id?: ID }>(item: T): ID {
  return item.id || item._id || "";
}

export function ensureId<T extends { _id?: ID; id?: ID }>(
  item: T
): T & { id: ID; _id: ID } {
  const id = normalizeId(item);
  return { ...item, id, _id: id } as T & { id: ID; _id: ID };
}
