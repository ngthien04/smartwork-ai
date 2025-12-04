import { Schema, model } from 'mongoose';

const NoteSchema = new Schema(
  {
    owner: {
      type: Schema.Types.ObjectId,
      ref: 'user',
      required: true,
      index: true,
    },

    title: {
      type: String,
      required: true,
      trim: true,
    },

    content: {
      type: String,
      default: '',
    },

    // tags dạng ["work", "idea", ...]
    tags: [
      {
        type: String,
        trim: true,
      },
    ],

    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  { timestamps: true },
);

NoteSchema.index({ title: 'text', content: 'text', tags: 'text' });
NoteSchema.index({ owner: 1, createdAt: -1 });

export const NoteModel = model('note', NoteSchema);
