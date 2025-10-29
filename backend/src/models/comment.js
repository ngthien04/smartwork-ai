import { model, Schema } from "mongoose";

const CommentSchema = new Schema(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: "task",
      required: true,
      index: true,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: "user",
      required: true,
      index: true,
    },
    content: { type: String, required: true },
    mentions: [{ type: Schema.Types.ObjectId, ref: "user" }],
    isEdited: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const CommentModel = model("comment", CommentSchema);
