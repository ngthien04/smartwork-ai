import { Schema, model } from 'mongoose';

const EventSchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    description: { type: String, default: '' },
    location: { type: String, default: '' },

    start: { type: Date, required: true, index: true },
    end: { type: Date, required: true, index: true },

    allDay: { type: Boolean, default: false },
    color: { type: String, default: '#1677ff' }, // antd blue default

    // “owner” của event (giống calendar cá nhân)
    owner: { type: Schema.Types.ObjectId, ref: 'user', required: true, index: true },

    // (optional) share/attendees giống GG calendar (để sẵn, chưa dùng cũng ok)
    attendees: [{ type: Schema.Types.ObjectId, ref: 'user' }],

    isDeleted: { type: Boolean, default: false, index: true },
    deletedAt: { type: Date },
  },
  { timestamps: true }
);

// Query theo owner + time range sẽ rất nhiều -> index compound
EventSchema.index({ owner: 1, start: 1 });
EventSchema.index({ owner: 1, end: 1 });

export const EventModel = model('event', EventSchema);