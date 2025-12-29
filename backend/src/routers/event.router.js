import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';
import { EventModel } from '../models/event.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const toId = (v) => new mongoose.Types.ObjectId(String(v));
const isValidId = (id) => mongoose.isValidObjectId(String(id));

function parseDate(x) {
  const d = new Date(x);
  return isNaN(d.getTime()) ? null : d;
}

// --------------------------------------------------
// GET /events?start=ISO&end=ISO
// -> trả events của user trong range (giống fetch calendar)
// --------------------------------------------------
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { start, end } = req.query;

    const startDate = parseDate(start);
    const endDate = parseDate(end);

    if (!startDate || !endDate) {
      return res.status(BAD_REQUEST).send('Thiếu start/end (ISO date)');
    }
    if (startDate > endDate) {
      return res.status(BAD_REQUEST).send('start phải <= end');
    }

    const ownerId = toId(req.user.id);

    // overlap logic: event giao nhau với range
    // (start < rangeEnd) AND (end > rangeStart)
    const items = await EventModel.find({
      owner: ownerId,
      isDeleted: { $ne: true },
      start: { $lt: endDate },
      end: { $gt: startDate },
    })
      .sort({ start: 1 })
      .lean();

    res.send(items);
  })
);

// --------------------------------------------------
// POST /events
// body: { title, start, end, location?, description?, allDay?, color? }
// --------------------------------------------------
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { title, start, end, location = '', description = '', allDay = false, color } = req.body || {};

    if (!title || !String(title).trim()) return res.status(BAD_REQUEST).send('Thiếu title');

    const startDate = parseDate(start);
    const endDate = parseDate(end);
    if (!startDate || !endDate) return res.status(BAD_REQUEST).send('start/end không hợp lệ');
    if (startDate >= endDate) return res.status(BAD_REQUEST).send('end phải > start');

    const created = await EventModel.create({
      title: String(title).trim(),
      start: startDate,
      end: endDate,
      location,
      description,
      allDay: !!allDay,
      color: color || undefined,
      owner: toId(req.user.id),
    });

    res.status(201).send(created);
  })
);

// --------------------------------------------------
// PUT /events/:id
// --------------------------------------------------
router.put(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('id không hợp lệ');

    const doc = await EventModel.findById(id);
    if (!doc || doc.isDeleted) return res.status(404).send('Event không tồn tại');

    // chỉ owner mới sửa được
    if (String(doc.owner) !== String(req.user.id)) return res.status(UNAUTHORIZED).send('Không có quyền sửa event');

    const { title, start, end, location, description, allDay, color } = req.body || {};

    if (typeof title !== 'undefined') {
      if (!String(title).trim()) return res.status(BAD_REQUEST).send('title không hợp lệ');
      doc.title = String(title).trim();
    }

    if (typeof start !== 'undefined') {
      const d = parseDate(start);
      if (!d) return res.status(BAD_REQUEST).send('start không hợp lệ');
      doc.start = d;
    }

    if (typeof end !== 'undefined') {
      const d = parseDate(end);
      if (!d) return res.status(BAD_REQUEST).send('end không hợp lệ');
      doc.end = d;
    }

    if (doc.start >= doc.end) return res.status(BAD_REQUEST).send('end phải > start');

    if (typeof location !== 'undefined') doc.location = location;
    if (typeof description !== 'undefined') doc.description = description;
    if (typeof allDay !== 'undefined') doc.allDay = !!allDay;
    if (typeof color !== 'undefined') doc.color = color;

    await doc.save();
    res.send(doc);
  })
);

// --------------------------------------------------
// DELETE /events/:id  (soft delete)
// --------------------------------------------------
router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('id không hợp lệ');

    const doc = await EventModel.findById(id);
    if (!doc || doc.isDeleted) return res.status(404).send('Event không tồn tại');

    if (String(doc.owner) !== String(req.user.id)) return res.status(UNAUTHORIZED).send('Không có quyền xoá event');

    doc.isDeleted = true;
    doc.deletedAt = new Date();
    await doc.save();

    res.send({ ok: true });
  })
);

export default router;