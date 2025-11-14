import { model, Schema } from "mongoose";

const TeamSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      lowercase: true,
      unique: true,
      index: true,
    },
    description: String,
    leaders: [{ type: Schema.Types.ObjectId, ref: "user"}],
    members: [
      {
        user: { type: Schema.Types.ObjectId, ref: "user"},
        role: {
          type: String,
          enum: ["leader", "admin", "member"],
          default: "member",
        },
        joinedAt: { type: Date, default: Date.now },
      },
    ],
    settings: {
      defaultTaskStatus: { type: String, default: "todo" },
      defaultTaskPriority: { type: String, default: "normal" },
    },
    isDeleted: { type: Boolean, default: false },
    deletedAt: Date,
  },
  { timestamps: true }
);

TeamSchema.index({ "members.user": 1 });

export const TeamModel = model("team", TeamSchema);
