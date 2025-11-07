import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { ReminderModel } from '../models/reminder.js';
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

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}
function parsePaging({ page = 1, limit = 20 }) {
  const p = Math.max(1, Number(page));
  const l = Math.max(1, Math.min(100, Number(limit)));
  return { page: p, limit: l, skip: (p - 1) * l };
}

router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { user, task, status, from, to } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    const q = {};
    if (user && isValidId(user)) q.user = toId(user);
    if (task && isValidId(task)) q.task = toId(task);

    if (from || to) {
      q.fireAt = {};
      if (from) q.fireAt.$gte = new Date(from);
      if (to) q.fireAt.$lte = new Date(to);
    }

    switch (status) {
      case 'pending':
        q.sentAt = { $exists: false };
        q.cancelledAt = { $exists: false };
        break;
      case 'sent':
        q.sentAt = { $exists: true };
        break;
      case 'cancelled':
        q.cancelledAt = { $exists: true };
        break;
    }

    if (!req.user?.isAdmin) {
      q.user = toId(req.user.id);
    }

    const [items, total] = await Promise.all([
      ReminderModel.find(q)
        .populate('user', 'name email avatarUrl')
        .populate('task', 'title status project team')
        .sort('fireAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      ReminderModel.countDocuments(q),
    ]);

    res.send({ page, limit, total, items });
  })
);

router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { task, user, fireAt, method = 'web' } = req.body || {};
    if (!fireAt) return res.status(BAD_REQUEST).send('Thiếu fireAt');

    const ownerId = user ? toId(user) : toId(req.user.id);
    if (user && !req.user.isAdmin && String(ownerId) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không được tạo nhắc việc cho người khác');
    }

    if (task) {
      const taskDoc = await TaskModel.findById(task).lean();
      if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');
    }

    const doc = await ReminderModel.create({
      user: ownerId,
      task: task ? toId(task) : undefined,
      fireAt: new Date(fireAt),
      method,
    });

    if (task) {
      const t = await TaskModel.findById(task).lean();
      if (t) {
        await recordActivity({
          team: t.team,
          actor: req.user.id,
          verb: 'reminder_created',
          targetType: 'task',
          targetId: t._id,
          metadata: { reminderId: doc._id, method },
        });
      }
    }

    const populated = await ReminderModel.findById(doc._id)
      .populate('user', 'name email avatarUrl')
      .populate('task', 'title status project team')
      .lean();

    res.status(201).send(populated);
  })
);


router.put(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Reminder id không hợp lệ');

    const rmd = await ReminderModel.findById(id);
    if (!rmd) return res.status(404).send('Reminder không tồn tại');

    if (!req.user.isAdmin && String(rmd.user) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền sửa reminder này');
    }

    const update = {};
    if (req.body.fireAt) update.fireAt = new Date(req.body.fireAt);
    if (req.body.method) update.method = req.body.method;
    if (req.body.task) {
      const taskDoc = await TaskModel.findById(req.body.task).lean();
      if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');
      update.task = toId(req.body.task);
    }

    const updated = await ReminderModel.findByIdAndUpdate(id, { $set: update }, { new: true })
      .populate('user', 'name email avatarUrl')
      .populate('task', 'title status project team')
      .lean();

    if (updated?.task) {
      const t = await TaskModel.findById(updated.task).lean();
      if (t) {
        await recordActivity({
          team: t.team,
          actor: req.user.id,
          verb: 'reminder_edited',
          targetType: 'task',
          targetId: t._id,
          metadata: { reminderId: updated._id },
        });
      }
    }

    res.send(updated);
  })
);

router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Reminder id không hợp lệ');

    const rmd = await ReminderModel.findById(id);
    if (!rmd) return res.status(404).send('Reminder không tồn tại');

    if (!req.user.isAdmin && String(rmd.user) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền xoá reminder này');
    }

    await ReminderModel.deleteOne({ _id: id });

    if (rmd.task) {
      const t = await TaskModel.findById(rmd.task).lean();
      if (t) {
        await recordActivity({
          team: t.team,
          actor: req.user.id,
          verb: 'reminder_deleted',
          targetType: 'task',
          targetId: t._id,
          metadata: { reminderId: id },
        });
      }
    }

    res.send();
  })
);

router.post(
  '/:id/cancel',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Reminder id không hợp lệ');

    const rmd = await ReminderModel.findById(id);
    if (!rmd) return res.status(404).send('Reminder không tồn tại');

    if (!req.user.isAdmin && String(rmd.user) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền thao tác reminder này');
    }

    rmd.cancelledAt = new Date();
    await rmd.save();

    if (rmd.task) {
      const t = await TaskModel.findById(rmd.task).lean();
      if (t) {
        await recordActivity({
          team: t.team,
          actor: req.user.id,
          verb: 'reminder_cancelled',
          targetType: 'task',
          targetId: t._id,
          metadata: { reminderId: rmd._id },
        });
      }
    }

    const populated = await ReminderModel.findById(rmd._id)
      .populate('user', 'name email avatarUrl')
      .populate('task', 'title status project team')
      .lean();

    res.send(populated);
  })
);


router.post(
  '/:id/mark-sent',
  authMid,
  handler(async (req, res) => {
    if (!req.user.isAdmin) return res.status(UNAUTHORIZED).send('Chỉ admin được phép đánh dấu đã gửi');

    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Reminder id không hợp lệ');

    const rmd = await ReminderModel.findByIdAndUpdate(
      id,
      { $set: { sentAt: new Date() } },
      { new: true }
    )
      .populate('user', 'name email avatarUrl')
      .populate('task', 'title status project team')
      .lean();

    if (!rmd) return res.status(404).send('Reminder không tồn tại');

    if (rmd.task) {
      const t = await TaskModel.findById(rmd.task).lean();
      if (t) {
        await recordActivity({
          team: t.team,
          actor: req.user.id,
          verb: 'reminder_mark_sent',
          targetType: 'task',
          targetId: t._id,
          metadata: { reminderId: rmd._id },
        });
      }
    }

    res.send(rmd);
  })
);

export default router;