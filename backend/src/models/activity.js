import { model, Schema } from "mongoose";

const ActivitySchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: "team", index: true },
    actor: { type: Schema.Types.ObjectId, ref: "user", index: true },
    verb: { type: String, required: true }, // created, updated, commented, moved, etc.
    targetType: {
      type: String,
      enum: ["task", "project", "comment", "sprint", "label"],
      required: true,
    },
    targetId: { type: Schema.Types.ObjectId, required: true, index: true },
    metadata: Schema.Types.Mixed, // diff thay đổi, trường cụ thể
  },
  { timestamps: true }
);

ActivitySchema.index({ team: 1, targetType: 1, targetId: 1, createdAt: -1 });

export const ActivityModel = model("activity", ActivitySchema);
