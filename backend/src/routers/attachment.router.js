import { Router } from 'express';
import mongoose from 'mongoose';
import multer from 'multer';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { AttachmentModel, TaskModel, ActivityModel, UserModel } from '../models/index.js';
import { configCloudinary } from '../config/cloudinary.config.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isValidId = (id) => mongoose.isValidObjectId(id);
const toId = (v) => new mongoose.Types.ObjectId(String(v));

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

// Multer: lưu vào memory để up stream lên Cloudinary
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
});

// Quyền xem theo team của task (member trở lên)
async function canViewTask(user, taskDoc) {
  if (!taskDoc) return false;
  if (user?.isAdmin) return true;
  const hasRole = await UserModel.exists({
    _id: user.id,
    roles: { $elemMatch: { team: taskDoc.team } },
  });
  return !!hasRole;
}

// Quyền thao tác: admin, reporter, hoặc assignee của task
async function canManageTask(user, taskDoc) {
  if (!taskDoc) return false;
  if (user?.isAdmin) return true;
  const uid = String(user.id);
  const isReporter = String(taskDoc.reporter || '') === uid;
  const isAssignee = (taskDoc.assignees || []).some((a) => String(a) === uid);
  return isReporter || isAssignee;
}

/**
 * GET /api/attachments?task=&page=&limit=
 */
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { task, page = 1, limit = 20 } = req.query;

    const p = Math.max(1, Number(page));
    const l = Math.max(1, Math.min(100, Number(limit)));
    const skip = (p - 1) * l;

    const q = {};
    if (task) {
      if (!isValidId(task)) return res.status(BAD_REQUEST).send('Invalid task id');
      q.task = toId(task);

      const taskDoc = await TaskModel.findById(task).lean();
      if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

      const can = await canViewTask(req.user, taskDoc);
      if (!can) return res.status(UNAUTHORIZED).send('Không có quyền xem file của task này');
    } else if (!req.user?.isAdmin) {
      // nếu không truyền task: giới hạn theo các team user thuộc
      const me = await UserModel.findById(req.user.id, { roles: 1 }).lean();
      const teamIds = (me?.roles || []).map((r) => r.team).filter(Boolean);
      if (!teamIds.length) return res.send({ page: p, limit: l, total: 0, items: [] });

      // find tasks theo teamIds rồi lấy attachment theo các task đó
      const taskIds = await TaskModel.find({ team: { $in: teamIds } }, { _id: 1 }).lean();
      q.task = { $in: taskIds.map((t) => t._id) };
    }

    const [items, total] = await Promise.all([
      AttachmentModel.find(q)
        .populate('uploadedBy', 'name email avatarUrl')
        .populate('task', 'title status project team')
        .sort('-createdAt')
        .skip(skip)
        .limit(l)
        .lean(),
      AttachmentModel.countDocuments(q),
    ]);

    res.send({ page: p, limit: l, total, items });
  })
);

/**
 * GET /api/attachments/:id
 */
router.get(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid attachment id');

    const doc = await AttachmentModel.findById(id)
      .populate('uploadedBy', 'name email avatarUrl')
      .populate('task', 'title status project team')
      .lean();
    if (!doc) return res.status(404).send('Attachment không tồn tại');

    // kiểm tra quyền xem theo task
    if (doc.task) {
      const taskDoc = await TaskModel.findById(doc.task._id || doc.task).lean();
      const can = await canViewTask(req.user, taskDoc);
      if (!can) return res.status(UNAUTHORIZED).send('Không có quyền xem file này');
    }

    res.send(doc);
  })
);

/**
 * POST /api/attachments  (upload 1 file)
 * form-data: file=<binary> , task?=<taskId>
 */
router.post(
  '/',
  authMid,
  upload.single('file'),
  handler(async (req, res) => {
    const file = req.file;
    const { task } = req.body || {};
    if (!file) return res.status(BAD_REQUEST).send('Missing file');

    let taskDoc = null;
    if (task) {
      if (!isValidId(task)) return res.status(BAD_REQUEST).send('Invalid task id');
      taskDoc = await TaskModel.findById(task).lean();
      if (!taskDoc || taskDoc.isDeleted) return res.status(404).send('Task không tồn tại');

      const can = await canManageTask(req.user, taskDoc);
      if (!can) return res.status(UNAUTHORIZED).send('Không có quyền upload file cho task này');
    } else if (!req.user?.isAdmin) {
      return res.status(BAD_REQUEST).send('Thiếu task');
    }

    // Upload lên Cloudinary
    const cloud = configCloudinary();

    const uploadToCloudinary = (buffer, filename, mimetype) =>
      new Promise((resolve, reject) => {
        const stream = cloud.uploader.upload_stream(
          {
            folder: 'smartwork-ai/attachments',
            resource_type: 'auto',
            public_id: undefined, // để Cloudinary tự tạo
            use_filename: true,
            unique_filename: true,
            overwrite: false,
          },
          (err, result) => {
            if (err) return reject(err);
            resolve(result);
          }
        );
        stream.end(buffer);
      });

    const result = await uploadToCloudinary(file.buffer, file.originalname, file.mimetype);

    const doc = await AttachmentModel.create({
      task: task ? toId(task) : undefined,
      uploadedBy: toId(req.user.id),
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storage: {
        provider: 'cloudinary', // nhớ thêm vào enum như lưu ý ở trên
        key: result.public_id,  // dùng public_id để xoá sau này
        url: result.secure_url, // URL xem file
      },
    });

    // Activity
    if (taskDoc) {
      await recordActivity({
        team: taskDoc.team,
        actor: req.user.id,
        verb: 'attachment_uploaded',
        targetType: 'task',
        targetId: taskDoc._id,
        metadata: { attachmentId: doc._id, name: file.originalname },
      });
    }

    const populated = await AttachmentModel.findById(doc._id)
      .populate('uploadedBy', 'name email avatarUrl')
      .lean();

    res.status(201).send(populated);
  })
);

/**
 * DELETE /api/attachments/:id  (xoá DB + Cloudinary)
 */
router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid attachment id');

    const doc = await AttachmentModel.findById(id).lean();
    if (!doc) return res.status(404).send('Attachment không tồn tại');

    let taskDoc = null;
    if (doc.task) {
      taskDoc = await TaskModel.findById(doc.task).lean();
      if (!taskDoc) return res.status(404).send('Task không tồn tại');
      const can = await canManageTask(req.user, taskDoc);
      if (!can) return res.status(UNAUTHORIZED).send('Không có quyền xoá file này');
    } else if (!req.user?.isAdmin && String(doc.uploadedBy) !== String(req.user.id)) {
      // file không gắn task: chỉ admin hoặc chính chủ được xoá
      return res.status(UNAUTHORIZED).send('Không có quyền xoá file này');
    }

    // Xoá trên Cloudinary (nếu là cloudinary)
    try {
      if (doc.storage?.provider === 'cloudinary' && doc.storage.key) {
        const cloud = configCloudinary();
        await cloud.uploader.destroy(doc.storage.key, { resource_type: 'image' }); // hoặc 'raw' tùy loại
        // Với video/pdf có thể cần resource_type: 'video' hoặc 'raw'
      }
    } catch (e) {
      // không chặn xoá DB nếu Cloudinary lỗi; tuỳ bạn muốn strict thì throw
      console.warn('[attachment] cloudinary destroy error:', e?.message || e);
    }

    await AttachmentModel.deleteOne({ _id: id });

    if (taskDoc) {
      await recordActivity({
        team: taskDoc.team,
        actor: req.user.id,
        verb: 'attachment_deleted',
        targetType: 'task',
        targetId: taskDoc._id,
        metadata: { attachmentId: id, name: doc.name },
      });
    }

    res.send();
  })
);

export default router;