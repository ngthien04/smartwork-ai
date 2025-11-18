import type {
  ID,
  Priority,
  TaskStatus,
  TaskType,
  StorageProvider,
} from "./common";
import type { Team } from "./team";
import type { Project } from "./project";
import type { User } from "./user";
import type { Sprint } from "./sprint";
import type { AIInsight } from "./ai";

// Forward type declarations
export interface Label {
  _id?: ID;
  id: ID;
  team?: ID | Team;
  project?: ID | Project;
  name: string;
  color?: string;
  description?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Attachment {
  _id?: ID;
  id: ID;
  task?: ID | Task;
  uploadedBy: ID | User;
  name: string;
  mimeType?: string;
  size?: number;
  storage?: {
    provider: StorageProvider;
    key?: string;
    url?: string;
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface Comment {
  _id?: ID;
  id: ID;
  task: ID | Task;
  author: ID | User;
  content: string;
  mentions?: Array<ID | User>;
  isEdited?: boolean;
  edited?: boolean;
  editedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Subtask {
  _id?: ID;
  id: ID;
  parentTask: ID | Task;
  title: string;
  isDone: boolean;
  assignee?: ID | User;
  order?: number;
  doneAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Task {
  _id?: ID;
  id: ID;
  team: ID | Team;
  project?: ID | Project;
  sprint?: ID | Sprint;
  title: string;
  description?: string;
  type?: TaskType;
  status: TaskStatus;
  priority?: Priority;
  reporter?: ID | User;
  assignees?: Array<ID | User>;
  watchers?: Array<ID | User>;
  labels?: Array<ID | Label>;
  tags?: string[];
  dueDate?: string;
  startDate?: string;
  estimate?: number;
  timeSpent?: number;
  storyPoints?: number;
  checklist?: Array<{
    _id?: ID;
    content: string;
    done: boolean;
    doneAt?: string;
  }>;
  attachments?: Array<ID | Attachment>;
  ai?: {
    riskScore?: number;
    predictedDueDate?: string;
    suggestions?: Array<ID | AIInsight>;
  };
  isDeleted?: boolean;
  deletedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}
