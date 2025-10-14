import {model, Schema} from 'mongoose';

const LabelSchema = new Schema (
    {
        team: {type: Schema.Type.ObjectId, ref: 'team', index: true},
        name: { type: String, required: true, trim: true },
        color: { type: String, default: '#cccccc' },
    },
    { timestamps: true }
);

LabelSchema.index({ team: 1, name: 1 }, { unique: true });
export const LabelModel = model('label', LabelSchema);