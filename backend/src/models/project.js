import { model, Schema } from "mongoose";

const ProjectSchema = new Schema(
  {
    team: {
      type: Schema.Types.ObjectId,
      ref: "team",
      required: true,
      index: true,
    },
    name: { type: String, required: true, trim: true },
    key: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    }, 
    description: String,
    lead: { type: Schema.Types.ObjectId, ref: "user", index: true },
    isArchived: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

ProjectSchema.index({ team: 1, key: 1 }, { unique: true });

export const ProjectModel = model("project", ProjectSchema);
