import { model, Schema } from "mongoose";

const ReminderSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: "user", index: true },
    task: { type: Schema.Types.ObjectId, ref: "task", index: true },
    fireAt: { type: Date, required: true, index: true },
    method: { type: String, enum: ["web", "email", "mobile"], default: "web" },
    sentAt: Date,
    cancelledAt: Date,
  },
  { timestamps: true }
);

export const ReminderModel = model("reminder", ReminderSchema);
