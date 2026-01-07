import api from "./api";

export type TaskDeadlineEvent = {
  id: string;
  title: string;
  dueDate: string;
  priority?: "low" | "normal" | "high" | "urgent";
  status?: string;
  projectName?: string;
  teamName?: string;
};

export const taskCalendarServices = {
  getTaskDeadlines(fromIso: string, toIso: string) {
    return api.get<TaskDeadlineEvent[]>("/tasks/deadlines", {
      params: { from: fromIso, to: toIso },
    });
  },
};
