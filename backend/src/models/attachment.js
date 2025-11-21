// src/models/attachment.js
import { model, Schema } from 'mongoose';

const AttachmentSchema = new Schema(
  {
    task: {
      type: Schema.Types.ObjectId,
      ref: 'task',
      index: true,
    },
    
    subtask: {
      type: Schema.Types.ObjectId,
      ref: 'subtask',
      default: null,
      index: true,
    },
    uploadedBy: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
    },
    name: String,
    mimeType: String,
    size: Number,
    storage: {
      provider: String,
      key: String,
      url: String,
    },
  },
  { timestamps: true },
);

export const AttachmentModel = model('attachment', AttachmentSchema);
