import { model, Schema } from "mongoose";

const SubtaskSchema = new Schema(
  {
    parentTask: {
      type: Schema.Types.ObjectId,
      ref: "task",
      required: true,
      index: true,
    },
    title: { type: String, required: true },
    isDone: { type: Boolean, default: false },
    assignee: { type: Schema.Types.ObjectId, ref: "user" },
    order: { type: Number, default: 0 },
  },
  { timestamps: true }
);

SubtaskSchema.index({ parentTask: 1, order: 1 });

export const SubtaskModel = model("subtask", SubtaskSchema);
