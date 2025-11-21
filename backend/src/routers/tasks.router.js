import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import adminMid from '../middleware/admin.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { TaskModel } from '../models/task.js';
import { SubtaskModel } from '../models/subtask.js';
import { CommentModel } from '../models/comment.js';
import { LabelModel } from '../models/label.js';
import { AttachmentModel } from '../models/attachment.js';
import { ActivityModel } from '../models/activity.js';
import { UserModel } from '../models/users.js';


import multer from 'multer';
import { configCloudinary } from '../config/cloudinary.config.js'; 
const cloudinary = configCloudinary();
const isValidId = (id) => mongoose.isValidObjectId(id);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, // 20MB
  },
  fileFilter: (req, file, cb) => {
    const ok =
      /^image\//.test(file.mimetype) ||                 
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/octet-stream';     
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});

// Helper upload buffer lên Cloudinary qua stream
function uploadToCloudinary(buffer, { folder, filename, resource_type = 'auto' } = {}) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: filename, 
        resource_type,       
      },
      (err, result) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
    stream.end(buffer);
  });
}

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

function toObjectId(id) {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {} 
}

router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const {
      project,
      sprint,
      assignee,
      status,
      priority,
      q,
      page = 1,
      limit = 20,
      size,
      sort = '-createdAt',
      includeDeleted = 'false',
      team: teamQuery,
    } = req.query;

    let team = teamQuery;

    if (!team) {
      const user = await UserModel.findById(req.user.id, { roles: 1 }).lean();
      const firstTeam = user?.roles?.[0]?.team;
      if (firstTeam) {
        team = String(firstTeam);
      }
    }

    // ---- build filter ----
    const filter = {};
    if (team) filter.team = toObjectId(team);
    if (project) filter.project = toObjectId(project);
    if (sprint) filter.sprint = toObjectId(sprint);
    if (assignee) filter.assignees = toObjectId(assignee);
    if (status) filter.status = { $in: String(status).split(',') };
    if (priority) filter.priority = { $in: String(priority).split(',') };
    if (includeDeleted !== 'true') filter.isDeleted = { $ne: true };

    if (q) {
      filter.$text = { $search: q };
    }

    // ---- paging: ưu tiên size nếu có ----
    const pageNum = Number(page) || 1;
    const limitNum = Number(size || limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      TaskModel.find(filter).sort(sort).skip(skip).limit(limitNum).lean(),
      TaskModel.countDocuments(filter),
    ]);

    res.send({
      page: pageNum,
      limit: limitNum,
      total,
      items,
    });
  })
);


// GET /tasks/:taskId
router.get(
  '/:taskId',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;

    const task = await TaskModel.findById(taskId)
      .populate('assignees', 'name email avatarUrl')
      .populate('reporter', 'name email avatarUrl')
      .populate('labels')
      .populate({
        path: 'attachments',
        populate: [
          {
            path: 'subtask',
            select: 'title',              
          },
          {
            path: 'uploadedBy',
            select: 'name email avatarUrl' // nếu muốn show ai upload
          },
        ],
      })
      .lean();

    if (!task || task.isDeleted) {
      return res.status(404).send('Task không tồn tại');
    }

    res.send(task);
  }),
);

//POST /tasks  (create)
//body: { team, project?, sprint?, title, description?, type?, status?, priority?, assignees[], labels[], dueDate?, estimate?, storyPoints? }
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const {
      team,
      project,
      sprint,
      title,
      description,
      type = 'task',
      status = 'todo',
      priority = 'normal',
      assignees = [],
      labels = [],
      dueDate,
      startDate,
      estimate,
      storyPoints,
    } = req.body || {};

    if (!team || !title) return res.status(BAD_REQUEST).send('Thiếu team/title');

    const doc = await TaskModel.create({
      team,
      project,
      sprint,
      title,
      description,
      type,
      status,
      priority,
      reporter: req.user.id,
      assignees,
      labels,
      dueDate,
      startDate,
      estimate,
      storyPoints,
    });

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'created',
      targetType: 'task',
      targetId: doc._id,
      metadata: { title: doc.title },
    });

    res.status(201).send(doc);
  })
);

//PUT /tasks/:taskId (update general fields)
router.put(
  '/:taskId',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const allowed = [
      'title',
      'description',
      'type',
      'status',
      'priority',
      'project',
      'sprint',
      'assignees',
      'labels',
      'dueDate',
      'startDate',
      'estimate',
      'timeSpent',
      'storyPoints',
      'ai',
    ];

    const updates = {};
    for (const k of allowed) {
      if (typeof req.body?.[k] !== 'undefined') updates[k] = req.body[k];
    }

    const before = await TaskModel.findById(taskId);
    if (!before || before.isDeleted) return res.status(404).send('Task không tồn tại');

    await TaskModel.findByIdAndUpdate(taskId, updates);
    await recordActivity({
      team: before.team,
      actor: req.user.id,
      verb: 'updated',
      targetType: 'task',
      targetId: before._id,
      metadata: { updates },
    });

    const after = await TaskModel.findById(taskId).lean();
    res.send(after);
  })
);

//PUT /tasks/:taskId/status  (change status quickly)
//body: { status }
router.put(
  '/:taskId/status',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body || {};
    if (!status) return res.status(BAD_REQUEST).send('Missing status');

    const t = await TaskModel.findByIdAndUpdate(taskId, { status }, { new: true });
    if (!t) return res.status(404).send('Task không tồn tại');

    await recordActivity({
      team: t.team,
      actor: req.user.id,
      verb: 'moved',
      targetType: 'task',
      targetId: t._id,
      metadata: { status },
    });

    res.send(t);
  })
);

//PUT /tasks/:taskId/assign  (assign or replace assignees)
//body: { assignees: [] }
router.put(
  '/:taskId/assign',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { assignees = [] } = req.body || {};

    const t = await TaskModel.findByIdAndUpdate(taskId, { assignees }, { new: true });
    if (!t) return res.status(404).send('Task không tồn tại');

    await recordActivity({
      team: t.team,
      actor: req.user.id,
      verb: 'assigned',
      targetType: 'task',
      targetId: t._id,
      metadata: { assignees },
    });

    res.send(t);
  })
);

// POST /tasks/:taskId/comments  (add a comment)
// body: { content, mentions?[] }
router.post(
  '/:taskId/comments',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { content, mentions = [] } = req.body || {};
    if (!content) return res.status(BAD_REQUEST).send('Missing content');

    const exists = await TaskModel.exists({ _id: taskId, isDeleted: { $ne: true } });
    if (!exists) return res.status(404).send('Task không tồn tại');

    const cmt = await CommentModel.create({
      task: taskId,
      author: req.user.id,
      content,
      mentions,
    });

    const task = await TaskModel.findById(taskId).lean();
    await recordActivity({
      team: task.team,
      actor: req.user.id,
      verb: 'commented',
      targetType: 'task',
      targetId: task._id,
      metadata: { commentId: cmt._id },
    });

    res.status(201).send(cmt);
  })
);

// POST /tasks/:taskId/subtasks  (create subtask)
// body: { title, assignee?, order? }
router.post(
  '/:taskId/subtasks',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { title, assignee, order = 0 } = req.body || {};
    if (!title) return res.status(BAD_REQUEST).send('Missing title');

    const exists = await TaskModel.exists({ _id: taskId, isDeleted: { $ne: true } });
    if (!exists) return res.status(404).send('Task không tồn tại');

    const st = await SubtaskModel.create({
      parentTask: taskId,
      title,
      assignee,
      order,
    });

    const task = await TaskModel.findById(taskId).lean();
    await recordActivity({
      team: task.team,
      actor: req.user.id,
      verb: 'subtask_created',
      targetType: 'task',
      targetId: task._id,
      metadata: { subtaskId: st._id, title },
    });

    res.status(201).send(st);
  })
);

//PUT /tasks/:taskId/subtasks/:subtaskId  (update subtask)
// body: { title?, isDone?, assignee?, order? }
router.put(
  '/:taskId/subtasks/:subtaskId',
  authMid,
  handler(async (req, res) => {
    const { taskId, subtaskId } = req.params;

    const updates = {};
    for (const k of ['title', 'isDone', 'assignee', 'order']) {
      if (typeof req.body?.[k] !== 'undefined') updates[k] = req.body[k];
    }
    if (Object.prototype.hasOwnProperty.call(updates, 'isDone') && updates.isDone === true) {
      updates.doneAt = new Date();
    }

    const st = await SubtaskModel.findOneAndUpdate(
      { _id: subtaskId, parentTask: taskId },
      updates,
      { new: true }
    );
    if (!st) return res.status(404).send('Subtask không tồn tại');

    const task = await TaskModel.findById(taskId).lean();
    await recordActivity({
      team: task.team,
      actor: req.user.id,
      verb: 'subtask_updated',
      targetType: 'task',
      targetId: task._id,
      metadata: { subtaskId: st._id, updates },
    });

    res.send(st);
  })
);

// DELETE /tasks/:taskId/subtasks/:subtaskId
router.delete(
  '/:taskId/subtasks/:subtaskId',
  authMid,
  handler(async (req, res) => {
    const { taskId, subtaskId } = req.params;

    const st = await SubtaskModel.findOneAndDelete({ _id: subtaskId, parentTask: taskId });
    if (!st) return res.status(404).send('Subtask không tồn tại');

    const task = await TaskModel.findById(taskId).lean();
    await recordActivity({
      team: task.team,
      actor: req.user.id,
      verb: 'subtask_deleted',
      targetType: 'task',
      targetId: task._id,
      metadata: { subtaskId },
    });

    res.send();
  })
);

// POST /tasks/:taskId/labels   (replace labels)
// body: { labels: [labelIds] }
router.post(
  '/:taskId/labels',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { labels = [] } = req.body || {};

    // xác thực id hợp lệ
    if (!Array.isArray(labels)) return res.status(BAD_REQUEST).send('labels must be array');
    const ids = labels.map(toObjectId);

    const t = await TaskModel.findById(taskId);
    if (!t || t.isDeleted) return res.status(404).send('Task không tồn tại');

    if (ids.length) {
      const count = await LabelModel.countDocuments({ _id: { $in: ids }, team: t.team });
      if (count !== ids.length) return res.status(BAD_REQUEST).send('Label không hợp lệ');
    }

    t.labels = ids;
    await t.save();

    await recordActivity({
      team: t.team,
      actor: req.user.id,
      verb: 'labels_set',
      targetType: 'task',
      targetId: t._id,
      metadata: { labels: ids },
    });

    res.send(t);
  })
);

// POST /tasks/:taskId/attachments
router.post(
  '/:taskId/attachments',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { name, mimeType, size, storage } = req.body || {};
    const t = await TaskModel.findById(taskId);
    if (!t || t.isDeleted) return res.status(404).send('Task không tồn tại');

    const att = await AttachmentModel.create({
      task: taskId,
      uploadedBy: req.user.id,
      name,
      mimeType,
      size,
      storage,
    });

    if (!t.attachments?.some((x) => String(x) === String(att._id))) {
      t.attachments = [...(t.attachments || []), att._id];
      await t.save();
    }

    await recordActivity({
      team: t.team,
      actor: req.user.id,
      verb: 'attachment_added',
      targetType: 'task',
      targetId: t._id,
      metadata: { attachmentId: att._id, name },
    });

    res.status(201).send(att);
  })
);

// POST /tasks/:taskId/attachments/upload
router.post(
  '/:taskId/attachments/upload',
  authMid,
  upload.single('file'),
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { subtaskId } = req.body || {};
    const file = req.file;

    if (!file) return res.status(BAD_REQUEST).send('Missing file');

    // Lấy task dạng document để chắc chắn tồn tại
    const task = await TaskModel.findById(taskId);
    if (!task || task.isDeleted) {
      return res.status(404).send('Task không tồn tại');
    }

    // Nếu có subtaskId thì validate subtask thuộc task này
    let subtaskDoc = null;
    if (subtaskId) {
      if (!isValidId(subtaskId)) {
        return res.status(BAD_REQUEST).send('Invalid subtaskId');
      }

      subtaskDoc = await SubtaskModel.findOne({
        _id: subtaskId,
        parentTask: task._id,
      }).lean();

      if (!subtaskDoc) {
        return res.status(BAD_REQUEST).send('Subtask không thuộc task này');
      }
    }

    // Upload lên Cloudinary
    const result = await uploadToCloudinary(file.buffer, {
      folder: 'smartwork/attachments',
      filename: undefined,
      resource_type: 'auto',
    });

    // Tạo attachment, gắn task + (optional) subtask
    const att = await AttachmentModel.create({
      task: task._id,
      subtask: subtaskDoc ? subtaskDoc._id : null,   // 👈 chỉ set 1 lần
      uploadedBy: req.user.id,
      name: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      storage: {
        provider: 'cloudinary',
        key: result.public_id,
        url: result.secure_url,
      },
    });

    // 👇 Quan trọng: add attachment vào task.attachments để populate được
    await TaskModel.findByIdAndUpdate(task._id, {
      $addToSet: { attachments: att._id },
    });

    const populated = await AttachmentModel.findById(att._id)
      .populate('subtask', 'title')
      .populate('uploadedBy', 'name email avatarUrl')
      .lean();

    res.status(201).send(populated);
  }),
);

// DELETE /tasks/:taskId/attachments/:attachmentId
router.delete(
  '/:taskId/attachments/:attachmentId',
  authMid,
  handler(async (req, res) => {
    const { taskId, attachmentId } = req.params;

    const att = await AttachmentModel.findOne({ _id: attachmentId, task: taskId });
    if (!att) return res.status(404).send('Attachment không tồn tại');

    if (!req.user.isAdmin && String(att.uploadedBy) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền xoá tệp này');
    }

    if (att.storage?.provider === 'cloudinary' && att.storage?.key) {
      try {
        await cloudinary.uploader.destroy(att.storage.key, { resource_type: 'auto' });
      } catch (e) {
        console.warn('[cloudinary destroy failed]', e?.message || e);
      }
    }

    await AttachmentModel.deleteOne({ _id: attachmentId });
    await TaskModel.findByIdAndUpdate(taskId, { $pull: { attachments: att._id } });

    // Activity
    const task = await TaskModel.findById(taskId).lean();
    await recordActivity({
      team: task.team,
      actor: req.user.id,
      verb: 'attachment_removed',
      targetType: 'task',
      targetId: task._id,
      metadata: { attachmentId },
    });

    return res.send();
  })
);

// DELETE /tasks/:taskId  
router.delete(
  '/:taskId',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const t = await TaskModel.findById(taskId);
    if (!t) return res.status(404).send('Task không tồn tại');

    if (!req.user.isAdmin && String(t.reporter) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send('Không có quyền xoá task này');
    }

    t.isDeleted = true;
    t.deletedAt = new Date();
    await t.save();

    await recordActivity({
      team: t.team,
      actor: req.user.id,
      verb: 'deleted',
      targetType: 'task',
      targetId: t._id,
      metadata: {},
    });

    res.send();
  })
);

// GET /tasks/stats/overview  
router.get(
  '/stats/overview',
  authMid,
  handler(async (req, res) => {
    const { team, project, sprint } = req.query;
    if (!team) return res.status(BAD_REQUEST).send('Missing team');

    const match = { team: toObjectId(team), isDeleted: { $ne: true } };
    if (project) match.project = toObjectId(project);
    if (sprint) match.sprint = toObjectId(sprint);

    const [byStatus, byAssignee, overdue] = await Promise.all([
      TaskModel.aggregate([
        { $match: match },
        { $group: { _id: '$status', count: { $sum: 1 } } },
      ]),
      TaskModel.aggregate([
        { $match: match },
        { $unwind: { path: '$assignees', preserveNullAndEmptyArrays: true } },
        { $group: { _id: '$assignees', count: { $sum: 1 } } },
      ]),
      TaskModel.countDocuments({
        ...match,
        dueDate: { $lt: new Date() },
        status: { $nin: ['done'] },
      }),
    ]);

    res.send({
      byStatus,
      byAssignee, 
      overdue,
    });
  })
);

export default router;