import { model, Schema } from "mongoose";

const TaskSchema = new Schema(
  {
    team: {
      type: Schema.Types.ObjectId,
      ref: "team",
      required: true,
      index: true,
    },
    project: { type: Schema.Types.ObjectId, ref: "project", index: true },
    sprint: { type: Schema.Types.ObjectId, ref: "sprint", index: true },
    title: { type: String, required: true, trim: true, index: "text" },
    description: { type: String },
    type: {
      type: String,
      enum: ["task", "bug", "story", "epic"],
      default: "task",
      index: true,
    },
    status: {
      type: String,
      enum: ["backlog", "todo", "in_progress", "review", "blocked", "done"],
      default: "todo",
      index: true,
    },
    priority: {
      type: String,
      enum: ["low", "normal", "high", "urgent"],
      default: "normal",
      index: true,
    },
    reporter: { type: Schema.Types.ObjectId, ref: "user", index: true },
    assignees: [{ type: Schema.Types.ObjectId, ref: "user", index: true }],
    watchers: [{ type: Schema.Types.ObjectId, ref: "user" }],
    labels: [{ type: Schema.Types.ObjectId, ref: "label", index: true }],
    dueDate: Date,
    startDate: Date,
    estimate: { type: Number, min: 0 },
    timeSpent: { type: Number, min: 0, default: 0 },
    storyPoints: { type: Number, min: 0 },
    checklist: [
      {
        _id: { type: Schema.Types.ObjectId, auto: true },
        content: { type: String, required: true },
        done: { type: Boolean, default: false },
        doneAt: Date,
      },
    ],
    attachments: [{ type: Schema.Types.ObjectId, ref: "attachment" }],
    ai: {
      riskScore: { type: Number, min: 0, max: 1, default: 0 },
      predictedDueDate: Date,
      suggestions: [{ type: Schema.Types.ObjectId, ref: "ai_insight" }],
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

TaskSchema.index({ team: 1, project: 1, status: 1, priority: 1 });
TaskSchema.index({ assignees: 1, dueDate: 1 });
TaskSchema.index({ title: "text", description: "text" });

export const TaskModel = model("task", TaskSchema);
