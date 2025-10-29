import { model, Schema } from "mongoose";

const SprintSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: "team", index: true },
    project: { type: Schema.Types.ObjectId, ref: "project", index: true },
    name: { type: String, required: true },
    goal: String,
    startDate: Date,
    endDate: Date,
    status: {
      type: String,
      enum: ["planned", "active", "completed", "cancelled"],
      default: "planned",
    },
  },
  { timestamps: true }
);

SprintSchema.index({ project: 1, startDate: 1 });


export const SprintModel = model('sprint', SprintSchema);