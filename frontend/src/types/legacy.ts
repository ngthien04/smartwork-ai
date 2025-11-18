import type { ID } from "./common";

export interface Note {
  id: ID;
  title: string;
  content: string;
  tags?: string[];
  createdAt: string;
  updatedAt: string;
}

export interface ChatMessage {
  id: ID;
  role: "user" | "assistant" | "system";
  content: string;
  createdAt: string;
}

export interface EventItem {
  id: ID;
  title: string;
  start: string;
  end: string;
  location?: string;
  noteIdRef?: ID;
}

export interface UIState {
  themeMode: "light" | "dark";
  sidebarCollapsed: boolean;
  commandPaletteOpen: boolean;
  loadingGlobal: boolean;
}

export interface ChatState {
  messages: ChatMessage[];
  isStreaming: boolean;
  currentThreadId: string | null;
}

export interface RootState {
  auth: import("./user").AuthState;
  ui: UIState;
  chat: ChatState;
}
