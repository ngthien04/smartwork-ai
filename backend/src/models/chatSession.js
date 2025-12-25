import { model, Schema } from 'mongoose';

const ChatMessageSchema = new Schema(
  {
    role: { type: String, enum: ['user', 'assistant'], required: true },
    content: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    meta: { type: Schema.Types.Mixed },
  },
  { _id: false }
);

const ChatSessionSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'user', required: true, index: true },
    team: { type: Schema.Types.ObjectId, ref: 'team', index: true }, // optional
    messages: { type: [ChatMessageSchema], default: [] },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

ChatSessionSchema.index({ user: 1, team: 1, isDeleted: 1 });

export const ChatSessionModel = model('chat_session', ChatSessionSchema);