// src/types/ai.ts
import type { ID, Priority, AIInsightKind } from "./common";
import type { Team } from "./team";
import type { Task } from "./task";
import type { User } from "./user";
import type { ChatMessage } from "./legacy";

export interface AIInsight {
  _id?: ID;
  id: ID;
  team: ID | Team;
  task?: ID | Task;
  kind: AIInsightKind;
  message: string;
  score?: number;
  acceptedBy?: ID | User;
  acceptedAt?: string;
  dismissedBy?: ID | User;
  dismissedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

// AI service contracts

export interface AIChatRequest {
  threadId?: string;
  messages: ChatMessage[];
}

export interface AIChatResponse {
  reply: string;
  threadId: string;
}

export interface AISummarizeRequest {
  text: string;
}

export interface AISummarizeResponse {
  summary: string;
  checklist?: string[];
}

export interface AIPlannerRequest {
  goal: string;
  constraints?: {
    deadline?: string;
    priority?: Priority;
    tags?: string[];
  };
}

export interface AIPlannerResponse {
  tasks: Partial<Task>[];
  timeline?: string;
}

