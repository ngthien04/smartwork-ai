import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { SubtaskModel } from '../models/subtask.js';
import { TaskModel } from '../models/task.js';
import { ActivityModel } from '../models/activity.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toId = (v) => new mongoose.Types.ObjectId(String(v));
const isValidId = (id) => mongoose.isValidObjectId(id);

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

async function canManageSubtasks(user, taskDoc) {
  if (!taskDoc) return false;
  if (user?.isAdmin) return true;
  const uid = String(user.id);
  const isReporter = String(taskDoc.reporter || '') === uid;
  const isAssignee = (taskDoc.assignees || []).some((a) => String(a) === uid);
  return isReporter || isAssignee;
}

router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { parentTask, page = 1, limit = 50 } = req.query;
    if (!parentTask || !isValidId(parentTask)) return res.status(BAD_REQUEST).send('Missing/invalid parentTask');

    const taskDoc = await TaskModel.findById(parentTask).lean();
    if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

    const p = Math.max(1, Number(page));
    const l = Math.max(1, Math.min(200, Number(limit)));
    const skip = (p - 1) * l;

    const [items, total] = await Promise.all([
      SubtaskModel.find({ parentTask: toId(parentTask) })
        .populate('assignee', 'name email avatarUrl')
        .sort({ order: 1, createdAt: 1 })
        .skip(skip)
        .limit(l)
        .lean(),
      SubtaskModel.countDocuments({ parentTask: toId(parentTask) }),
    ]);

    res.send({ page: p, limit: l, total, items });
  })
);

router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { parentTask, title, assignee, order = 0 } = req.body || {};
    if (!parentTask || !isValidId(parentTask)) return res.status(BAD_REQUEST).send('Missing/invalid parentTask');
    if (!title) return res.status(BAD_REQUEST).send('Missing title');

    const taskDoc = await TaskModel.findById(parentTask).lean();
    if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

    if (!(await canManageSubtasks(req.user, taskDoc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền tạo subtask cho task này');
    }

    const payload = {
      parentTask: toId(parentTask),
      title: String(title).trim(),
      order: Number(order) || 0,
    };
    if (assignee && isValidId(assignee)) payload.assignee = toId(assignee);

    const sub = await SubtaskModel.create(payload);

    await recordActivity({
      team: taskDoc.team,
      actor: req.user.id,
      verb: 'subtask_created',
      targetType: 'task',
      targetId: taskDoc._id,
      metadata: { subtaskId: sub._id },
    });

    const populated = await SubtaskModel.findById(sub._id)
      .populate('assignee', 'name email avatarUrl')
      .lean();

    res.status(201).send(populated);
  })
);

router.put(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid subtask id');

    const sub = await SubtaskModel.findById(id);
    if (!sub) return res.status(404).send('Subtask không tồn tại');

    const taskDoc = await TaskModel.findById(sub.parentTask).lean();
    if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

    if (!(await canManageSubtasks(req.user, taskDoc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền sửa subtask này');
    }

    const { title, isDone, assignee, order } = req.body || {};
    if (title != null) sub.title = String(title).trim();
    if (typeof isDone === 'boolean') sub.isDone = isDone;
    if (assignee) {
      if (!isValidId(assignee)) return res.status(BAD_REQUEST).send('Invalid assignee');
      sub.assignee = toId(assignee);
    }
    if (order != null) sub.order = Number(order) || 0;

    await sub.save();

    await recordActivity({
      team: taskDoc.team,
      actor: req.user.id,
      verb: 'subtask_updated',
      targetType: 'task',
      targetId: taskDoc._id,
      metadata: { subtaskId: sub._id },
    });

    const updated = await SubtaskModel.findById(sub._id)
      .populate('assignee', 'name email avatarUrl')
      .lean();

    res.send(updated);
  })
);


router.patch(
  '/:id/toggle',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid subtask id');

    const sub = await SubtaskModel.findById(id);
    if (!sub) return res.status(404).send('Subtask không tồn tại');

    const taskDoc = await TaskModel.findById(sub.parentTask).lean();
    if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

    if (!(await canManageSubtasks(req.user, taskDoc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền thao tác subtask này');
    }

    sub.isDone = !sub.isDone;
    await sub.save();

    await recordActivity({
      team: taskDoc.team,
      actor: req.user.id,
      verb: 'subtask_toggled',
      targetType: 'task',
      targetId: taskDoc._id,
      metadata: { subtaskId: sub._id, isDone: sub.isDone },
    });

    const updated = await SubtaskModel.findById(sub._id)
      .populate('assignee', 'name email avatarUrl')
      .lean();

    res.send(updated);
  })
);


router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid subtask id');

    const sub = await SubtaskModel.findById(id);
    if (!sub) return res.status(404).send('Subtask không tồn tại');

    const taskDoc = await TaskModel.findById(sub.parentTask).lean();
    if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

    if (!(await canManageSubtasks(req.user, taskDoc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền xoá subtask này');
    }

    await SubtaskModel.deleteOne({ _id: id });

    await recordActivity({
      team: taskDoc.team,
      actor: req.user.id,
      verb: 'subtask_deleted',
      targetType: 'task',
      targetId: taskDoc._id,
      metadata: { subtaskId: id },
    });

    res.send();
  })
);


router.post(
  '/reorder',
  authMid,
  handler(async (req, res) => {
    const { parentTask, orders } = req.body || {};
    if (!parentTask || !isValidId(parentTask)) return res.status(BAD_REQUEST).send('Missing/invalid parentTask');
    if (!Array.isArray(orders) || orders.length === 0) return res.status(BAD_REQUEST).send('Missing orders');

    const taskDoc = await TaskModel.findById(parentTask).lean();
    if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

    if (!(await canManageSubtasks(req.user, taskDoc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền sắp xếp subtask cho task này');
    }

    const ops = orders
      .filter((x) => x?.id && isValidId(x.id))
      .map((x) => ({
        updateOne: {
          filter: { _id: toId(x.id), parentTask: toId(parentTask) },
          update: { $set: { order: Number(x.order) || 0 } },
        },
      }));

    if (!ops.length) return res.status(BAD_REQUEST).send('No valid items to reorder');

    await SubtaskModel.bulkWrite(ops);

    await recordActivity({
      team: taskDoc.team,
      actor: req.user.id,
      verb: 'subtasks_reordered',
      targetType: 'task',
      targetId: taskDoc._id,
      metadata: { count: ops.length },
    });

    const items = await SubtaskModel.find({ parentTask: toId(parentTask) })
      .populate('assignee', 'name email avatarUrl')
      .sort({ order: 1, createdAt: 1 })
      .lean();

    res.send({ parentTask, items });
  })
);

export default router;