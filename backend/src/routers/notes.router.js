import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST } from '../constants/httpStatus.js';
import { NoteModel } from '../models/note.js';

const router = Router();

const handler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

/**
 * Helper: chuẩn hoá tags
 * - nếu string: "a,b,c" -> ["a", "b", "c"]
 * - nếu array: dùng luôn
 */
function normalizeTags(raw) {
  if (!raw) return [];

  
  if (Array.isArray(raw)) {
    return raw
      .map((t) => String(t).trim())
      .filter(Boolean);
  }

  
  if (typeof raw === 'string') {
    return raw
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  
  return [String(raw).trim()].filter(Boolean);
}




router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { q } = req.query;

    const filter = {
      owner: req.user.id,
      isDeleted: { $ne: true },
    };

    if (q && String(q).trim()) {
      const text = String(q).trim();
      
      filter.$or = [
        { title: new RegExp(text, 'i') },
        { content: new RegExp(text, 'i') },
        { tags: new RegExp(text, 'i') },
      ];
    }

    const docs = await NoteModel.find(filter)
      .sort('-updatedAt')
      .lean();

    
    const items = docs.map((n) => ({
      ...n,
      id: n._id,
    }));

    res.send(items);
  }),
);





router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { title, content = '', tags } = req.body || {};

    if (!title || !String(title).trim()) {
      return res.status(BAD_REQUEST).send('Thiếu tiêu đề ghi chú');
    }

    const normalizedTags = normalizeTags(tags);

    const doc = await NoteModel.create({
      owner: req.user.id,
      title: String(title).trim(),
      content: String(content || ''),
      tags: normalizedTags,
    });

    const plain = doc.toObject();
    plain.id = plain._id;

    res.status(201).send(plain);
  }),
);





router.put(
  '/:noteId',
  authMid,
  handler(async (req, res) => {
    const { noteId } = req.params;

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(BAD_REQUEST).send('ID ghi chú không hợp lệ');
    }

    const updates = {};
    if (typeof req.body?.title !== 'undefined') {
      updates.title = String(req.body.title || '').trim();
    }
    if (typeof req.body?.content !== 'undefined') {
      updates.content = String(req.body.content || '');
    }
    if (typeof req.body?.tags !== 'undefined') {
      updates.tags = normalizeTags(req.body.tags);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(BAD_REQUEST).send('Không có dữ liệu cập nhật');
    }

    const doc = await NoteModel.findOneAndUpdate(
      { _id: noteId, owner: req.user.id, isDeleted: { $ne: true } },
      updates,
      { new: true },
    ).lean();

    if (!doc) {
      return res.status(404).send('Ghi chú không tồn tại');
    }

    doc.id = doc._id;

    res.send(doc);
  }),
);




router.delete(
  '/:noteId',
  authMid,
  handler(async (req, res) => {
    const { noteId } = req.params;

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(BAD_REQUEST).send('ID ghi chú không hợp lệ');
    }

    const note = await NoteModel.findOne({
      _id: noteId,
      owner: req.user.id,
      isDeleted: { $ne: true },
    });

    if (!note) {
      return res.status(404).send('Ghi chú không tồn tại');
    }

    note.isDeleted = true;
    await note.save();

    res.send();
  }),
);




router.post(
  '/:noteId/ai/summary',
  authMid,
  handler(async (req, res) => {
    const { noteId } = req.params;

    if (!mongoose.isValidObjectId(noteId)) {
      return res.status(BAD_REQUEST).send('ID ghi chú không hợp lệ');
    }

    const note = await NoteModel.findOne({
      _id: noteId,
      owner: req.user.id,
      isDeleted: { $ne: true },
    }).lean();

    if (!note) {
      return res.status(404).send('Ghi chú không tồn tại');
    }

    const content = String(note.content || '');
    let summary = content;

    if (content.length > 300) {
      summary = content.slice(0, 280) + '...';
    }

    
    res.send({
      noteId,
      summary,
    });
  }),
);

export default router;
