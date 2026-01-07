import { model, Schema } from "mongoose";

const NotificationSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "user", index: true },
    channel: { type: String, enum: ["web", "email", "mobile"], default: "web" },
    type: {
      type: String,
      enum: [
        "task_assigned",
        "task_due",
        "task_deadline_soon",
        "comment_mention",
        "sprint_status",
        "ai_alert",
        "task_comment",
        "task_updated",
        "task_status_changed",
        "subtask_updated",
        "attachment_added",
        "attachment_removed",
      ],
      index: true,
      required: true,
    },
    payload: Schema.Types.Mixed,
    isRead: { type: Boolean, default: false, index: true },
    readAt: Date,
  },
  { timestamps: true }
);

NotificationSchema.index(
  { user: 1, type: 1, "payload.taskId": 1, "payload.noticeDate": 1 },
  { unique: true, partialFilterExpression: { type: "task_deadline_soon" } }
);

export const NotificationModel = model("notification", NotificationSchema);