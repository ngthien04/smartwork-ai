import { model, Schema } from 'mongoose';

const LabelSchema = new Schema(
  {
    team: { type: Schema.Types.ObjectId, ref: 'team', index: true },
    project: { type: Schema.Types.ObjectId, ref: 'project', index: true },
    name: { type: String, required: true, trim: true },
    color: { type: String, default: '#999999' },
    description: { type: String },
  },
  { timestamps: true }
);

LabelSchema.index({ team: 1, project: 1, name: 1 }, { unique: true });

export const LabelModel = model('label', LabelSchema);
