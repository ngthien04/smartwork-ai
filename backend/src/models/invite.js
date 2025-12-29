// models/invite.js
import { model, Schema } from 'mongoose';

const InviteSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: 'team', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true, index: true },

    role: { type: String, enum: ['leader', 'admin', 'member'], default: 'member' },

    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true, index: true },

    status: { type: String, enum: ['pending', 'accepted', 'declined', 'cancelled'], default: 'pending', index: true },

    invitedBy: { type: Schema.Types.ObjectId, ref: 'user' },

    acceptedBy: { type: Schema.Types.ObjectId, ref: 'user' },
    acceptedAt: Date,

    declinedBy: { type: Schema.Types.ObjectId, ref: 'user' },
    declinedAt: Date,

    cancelledBy: { type: Schema.Types.ObjectId, ref: 'user' },
    cancelledAt: Date,
  },
  { timestamps: true }
);

InviteSchema.index({ team: 1, email: 1, status: 1, expiresAt: -1 });

export const InviteModel = model('invite', InviteSchema);