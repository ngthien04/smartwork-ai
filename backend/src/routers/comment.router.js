import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { CommentModel } from '../models/comment.js';
import { TaskModel } from '../models/task.js';
import { ActivityModel } from '../models/activity.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toId = (v) => new mongoose.Types.ObjectId(String(v));

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

// GET /api/comments?task=<taskId>&page=&limit=
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { task, page = 1, limit = 20 } = req.query;
    if (!task) return res.status(BAD_REQUEST).send('Missing task');

    const taskDoc = await TaskModel.findById(task).lean();
    if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      CommentModel.find({ task: toId(task) })
        .populate('author', 'name email avatarUrl')
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      CommentModel.countDocuments({ task: toId(task) }),
    ]);

    res.send({ page: Number(page), limit: Number(limit), total, items });
  })
);

// POST /api/comments  (create comment)
// body: { task, content, mentions?[] }
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { task, content, mentions = [] } = req.body || {};
    if (!task || !content) return res.status(BAD_REQUEST).send('Thiếu task/content');

    const taskDoc = await TaskModel.findById(task).lean();
    if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

    const cmt = await CommentModel.create({
      task,
      author: req.user.id,
      content,
      mentions: mentions.map(toId),
    });

    await recordActivity({
      team: taskDoc.team,
      actor: req.user.id,
      verb: 'comment_created',
      targetType: 'task',
      targetId: taskDoc._id,
      metadata: { commentId: cmt._id },
    });

    const populated = await CommentModel.findById(cmt._id)
      .populate('author', 'name email avatarUrl')
      .lean();

    res.status(201).send(populated);
  })
);

// PUT /api/comments/:commentId  (edit comment)
// body: { content }
// chỉ cho phép tác giả hoặc admin
router.put(
  '/:commentId',
  authMid,
  handler(async (req, res) => {
    const { commentId } = req.params;
    const { content } = req.body || {};
    if (!content) return res.status(BAD_REQUEST).send('Missing content');

    const cmt = await CommentModel.findById(commentId);
    if (!cmt) return res.status(404).send('Comment không tồn tại');

    const task = await TaskModel.findById(cmt.task).lean();
    if (!task) return res.status(404).send('Task không tồn tại');

    // chỉ cho author hoặc admin
    if (!req.user.isAdmin && String(cmt.author) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền sửa comment này');
    }

    cmt.content = content;
    cmt.edited = true;
    cmt.editedAt = new Date();
    await cmt.save();

    await recordActivity({
      team: task.team,
      actor: req.user.id,
      verb: 'comment_edited',
      targetType: 'task',
      targetId: task._id,
      metadata: { commentId: cmt._id },
    });

    const updated = await CommentModel.findById(cmt._id)
      .populate('author', 'name email avatarUrl')
      .lean();
    res.send(updated);
  })
);

// DELETE /api/comments/:commentId  (delete comment)
// chỉ author hoặc admin
router.delete(
  '/:commentId',
  authMid,
  handler(async (req, res) => {
    const { commentId } = req.params;
    const cmt = await CommentModel.findById(commentId);
    if (!cmt) return res.status(404).send('Comment không tồn tại');

    const task = await TaskModel.findById(cmt.task).lean();
    if (!task) return res.status(404).send('Task không tồn tại');

    if (!req.user.isAdmin && String(cmt.author) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền xoá comment này');
    }

    await CommentModel.deleteOne({ _id: commentId });

    await recordActivity({
      team: task.team,
      actor: req.user.id,
      verb: 'comment_deleted',
      targetType: 'task',
      targetId: task._id,
      metadata: { commentId },
    });

    res.send();
  })
);

export default router;