import { model, Schema } from "mongoose";

const AttachmentSchema = new Schema(
  {
    task: { type: Schema.Types.ObjectId, ref: "task", index: true },
    uploadedBy: { type: Schema.Types.ObjectId, ref: "user", index: true },
    name: String,
    mimeType: String,
    size: Number,
    storage: {
      provider: {
        type: String,
        enum: ["local", "s3", "gcs", "azure"],
        default: "local",
      },
      key: String, 
      url: String, 
    },
  },
  { timestamps: true }
);

export const AttachmentModel = model("attachment", AttachmentSchema);
