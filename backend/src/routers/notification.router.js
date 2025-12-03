import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { NotificationModel } from '../models/notification.js';
import { UserModel } from '../models/users.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isValidId = (id) => mongoose.isValidObjectId(id);
const toId = (v) => new mongoose.Types.ObjectId(String(v));

function parsePaging(q) {
  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.max(1, Math.min(100, Number(q.limit || 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildQuery(qs) {
  const q = {};
  if (qs.user && isValidId(qs.user)) q.user = toId(qs.user);
  if (qs.type) q.type = String(qs.type);
  if (qs.channel) q.channel = String(qs.channel);
  if (qs.isRead === '1' || qs.isRead === 'true') q.isRead = true;
  if (qs.isRead === '0' || qs.isRead === 'false') q.isRead = false;
  if (qs.from || qs.to) {
    q.createdAt = {};
    if (qs.from) q.createdAt.$gte = new Date(qs.from);
    if (qs.to) q.createdAt.$lte = new Date(qs.to);
  }
  return q;
}

/**
 * GET /api/notifications
 * Query: user?, type?, channel?, isRead?=1|0, from?, to?, page?, limit?
 * - Non-admin: luôn giới hạn theo user hiện tại (bỏ qua query.user nếu có)
 */
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const q = buildQuery(req.query);

    if (!req.user?.isAdmin) {
      q.user = toId(req.user.id);
    } else if (!q.user) {
      
    }

    const [items, total] = await Promise.all([
      NotificationModel.find(q).sort('-createdAt').skip(skip).limit(limit).lean(),
      NotificationModel.countDocuments(q),
    ]);

    res.send({ page, limit, total, items });
  })
);

/**
 * GET /api/notifications/unread-count
 * Query: user?, type?, channel?
 * - Non-admin: chỉ đếm của bản thân
 */
router.get(
  '/unread-count',
  authMid,
  handler(async (req, res) => {
    const q = buildQuery(req.query);
    q.isRead = false;

    if (!req.user?.isAdmin) {
      q.user = toId(req.user.id);
    } else if (!q.user) {
      
    }

    const count = await NotificationModel.countDocuments(q);
    res.send({ unread: count });
  })
);

/**
 * GET /api/notifications/:id
 */
router.get(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid notification id');

    const doc = await NotificationModel.findById(id).lean();
    if (!doc) return res.status(404).send('Notification không tồn tại');

    if (!req.user?.isAdmin && String(doc.user) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền xem thông báo này');
    }

    res.send(doc);
  })
);

/**
 * POST /api/notifications
 * body: { user?, channel='web', type, payload? }
 * - Non-admin: chỉ tạo cho chính mình (bỏ qua body.user)
 */
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { user, channel = 'web', type, payload } = req.body || {};
    if (!type) return res.status(BAD_REQUEST).send('Missing type');

    let userId = req.user.id;
    if (req.user?.isAdmin && user && isValidId(user)) {
      const exists = await UserModel.exists({ _id: toId(user) });
      if (!exists) return res.status(404).send('User không tồn tại');
      userId = user;
    }

    const doc = await NotificationModel.create({
      user: toId(userId),
      channel,
      type,
      payload: payload ?? {},
    });

    const populated = await NotificationModel.findById(doc._id).lean();
    res.status(201).send(populated);
  })
);

/**
 * PUT /api/notifications/:id/read    (đánh dấu đã đọc)
 */
router.put(
  '/:id/read',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid notification id');

    const doc = await NotificationModel.findById(id);
    if (!doc) return res.status(404).send('Notification không tồn tại');

    if (!req.user?.isAdmin && String(doc.user) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền thao tác thông báo này');
    }

    if (!doc.isRead) {
      doc.isRead = true;
      doc.readAt = new Date();
      await doc.save();
    }

    res.send(doc.toObject());
  })
);

/**
 * PUT /api/notifications/:id/unread  (đánh dấu chưa đọc)
 */
router.put(
  '/:id/unread',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid notification id');

    const doc = await NotificationModel.findById(id);
    if (!doc) return res.status(404).send('Notification không tồn tại');

    if (!req.user?.isAdmin && String(doc.user) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền thao tác thông báo này');
    }

    if (doc.isRead) {
      doc.isRead = false;
      doc.readAt = undefined;
      await doc.save();
    }

    res.send(doc.toObject());
  })
);

/**
 * POST /api/notifications/mark-all-read
 * body: { before?, types?[], channels?[] }
 * - Đánh dấu tất cả thông báo của current user (hoặc user chỉ định nếu admin)
 *   là đã đọc, với filter tuỳ chọn.
 * Query: user? (admin-only)
 */
router.post(
  '/mark-all-read',
  authMid,
  handler(async (req, res) => {
    const { before, types, channels } = req.body || {};
    const q = { isRead: false };

    
    if (req.user?.isAdmin && req.query.user && isValidId(req.query.user)) {
      q.user = toId(req.query.user);
    } else {
      q.user = toId(req.user.id);
    }

    if (before) q.createdAt = { $lte: new Date(before) };
    if (Array.isArray(types) && types.length) q.type = { $in: types.map(String) };
    if (Array.isArray(channels) && channels.length) q.channel = { $in: channels.map(String) };

    const result = await NotificationModel.updateMany(q, { $set: { isRead: true, readAt: new Date() } });
    res.send({ matched: result.matchedCount ?? result.n, modified: result.modifiedCount ?? result.nModified });
  })
);

/**
 * DELETE /api/notifications/:id
 * - chỉ chủ sở hữu hoặc admin
 */
router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid notification id');

    const doc = await NotificationModel.findById(id).lean();
    if (!doc) return res.status(404).send('Notification không tồn tại');

    if (!req.user?.isAdmin && String(doc.user) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền xoá thông báo này');
    }

    await NotificationModel.deleteOne({ _id: id });
    res.send();
  })
);

export default router;