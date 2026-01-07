import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { TaskModel } from '../models/task.js';
import { SubtaskModel } from '../models/subtask.js';
import { CommentModel } from '../models/comment.js';
import { LabelModel } from '../models/label.js';
import { AttachmentModel } from '../models/attachment.js';
import { ActivityModel } from '../models/activity.js';
import { UserModel } from '../models/users.js';
import { NotificationModel } from '../models/notification.js';

import multer from 'multer';
import { configCloudinary } from '../config/cloudinary.config.js';

const cloudinary = configCloudinary();
const isValidId = (id) => mongoose.isValidObjectId(id);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024, 
  },
  fileFilter: (req, file, cb) => {
    const ok =
      /^image\//.test(file.mimetype) ||
      file.mimetype === 'application/pdf' ||
      file.mimetype === 'application/octet-stream';
    cb(ok ? null : new Error('Unsupported file type'), ok);
  },
});


function uploadToCloudinary(
  buffer,
  { folder, filename, resource_type = 'auto' } = {}
) {
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
      },
    );
    stream.end(buffer);
  });
}




async function createNotificationsForUsers(userIds, { type, payload }) {
  if (!Array.isArray(userIds) || !userIds.length) return;

  const docs = userIds.map((uid) => ({
    user: new mongoose.Types.ObjectId(String(uid)),
    channel: 'web',
    type,
    payload: payload ?? {},
  }));

  try {
    await NotificationModel.insertMany(docs, { ordered: false });
  } catch (e) {
    console.warn('[notification insert error]', e?.message || e);
  }
}


function getTaskParticipantUserIds(task) {
  const ids = new Set();

  if (Array.isArray(task.assignees)) {
    for (const u of task.assignees) {
      const id = typeof u === 'object' ? u._id : u;
      if (id) {
        ids.add(String(id));
      }
    }
  }

  if (task.reporter) {
    ids.add(String(task.reporter));
  }

  return Array.from(ids);
}


async function notifyTaskParticipants(task, type, extraPayload = {}) {
  const participantIds = getTaskParticipantUserIds(task);
  if (!participantIds.length) return;

  try {
    await createNotificationsForUsers(participantIds, {
      type,
      payload: {
        taskId: task._id,
        taskTitle: task.title,
        ...extraPayload,
      },
    });
  } catch (e) {
    console.warn('[notifyTaskParticipants error]', e?.message || e);
  }
}



const router = Router();
const handler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

function toObjectId(id) {
  return typeof id === 'string' ? new mongoose.Types.ObjectId(id) : id;
}

async function recordActivity({
  team,
  actor,
  verb,
  targetType,
  targetId,
  metadata,
}) {
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

    const filter = {};

    
    const user = await UserModel.findById(req.user.id, {
      roles: 1,
      isAdmin: 1,
    }).lean();
    const teamIds = (user?.roles || [])
      .map((r) => r.team)
      .filter(Boolean)
      .map((id) => toObjectId(id));

    let team = teamQuery;

    
    if (team) {
      const requestedTeamId = toObjectId(team);

      if (!user?.isAdmin) {
        const canAccess = teamIds.some(
          (tId) => String(tId) === String(requestedTeamId),
        );
        if (!canAccess) {
          return res.status(UNAUTHORIZED).send('Không có quyền xem team này');
        }
      }

      filter.team = requestedTeamId;
    } else {
      
      if (!user?.isAdmin) {
        
        if (!teamIds.length) {
          return res.send({
            page: Number(page) || 1,
            limit: Number(size || limit) || 20,
            total: 0,
            items: [],
          });
        }

        filter.team = { $in: teamIds };
      }
      
    }

    if (project) filter.project = toObjectId(project);
    if (sprint) filter.sprint = toObjectId(sprint);
    if (assignee) filter.assignees = toObjectId(assignee);
    if (status) filter.status = { $in: String(status).split(',') };
    if (priority) filter.priority = { $in: String(priority).split(',') };
    if (includeDeleted !== 'true') filter.isDeleted = { $ne: true };

    if (q) {
      filter.$text = { $search: q };
    }

    const pageNum = Number(page) || 1;
    const limitNum = Number(size || limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const [items, total] = await Promise.all([
      TaskModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(limitNum)
        .populate('project', 'name key')
        .populate('sprint', 'name status startDate endDate')
        .populate('assignees', 'name email avatarUrl')
        .populate('labels')
        .lean(),
      TaskModel.countDocuments(filter),
    ]);

    res.send({
      page: pageNum,
      limit: limitNum,
      total,
      items,
    });
  }),
);

router.get(
  '/deadlines',
  authMid,
  handler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;
    if (!from || !to || isNaN(from) || isNaN(to)) {
      return res.status(400).send('Invalid from/to');
    }

    // lấy teamIds giống logic ở GET /
    const user = await UserModel.findById(req.user.id, {
      roles: 1,
      isAdmin: 1,
    }).lean();

    const teamIds = (user?.roles || [])
      .map((r) => r.team)
      .filter(Boolean)
      .map((id) => toObjectId(id));

    const teamQuery = req.query.team;
    const filter = {
      isDeleted: { $ne: true },
      dueDate: { $exists: true, $gte: from, $lte: to },
    };

    if (teamQuery) {
      const requestedTeamId = toObjectId(teamQuery);
      if (!user?.isAdmin) {
        const canAccess = teamIds.some((tId) => String(tId) === String(requestedTeamId));
        if (!canAccess) return res.status(UNAUTHORIZED).send('Không có quyền xem team này');
      }
      filter.team = requestedTeamId;
    } else {
      if (!user?.isAdmin) {
        if (!teamIds.length) return res.send([]);
        filter.team = { $in: teamIds };
      }
    }

    const tasks = await TaskModel.find(
      filter,
      { title: 1, dueDate: 1, priority: 1, status: 1, project: 1, team: 1 }
    )
      .populate('project', 'name')
      .populate('team', 'name')
      .lean();

    res.send(
      tasks.map((t) => ({
        id: String(t._id),
        title: t.title,
        dueDate: t.dueDate,
        priority: t.priority,
        status: t.status,
        projectName: t.project?.name || '',
        teamName: t.team?.name || '',
      }))
    );
  })
);

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
            select: 'name email avatarUrl',
          },
        ],
      })
      .lean();

    if (!task || task.isDeleted) {
      return res.status(404).send('Task không tồn tại');
    }

    
    if (!req.user?.isAdmin) {
      const user = await UserModel.findById(req.user.id, { roles: 1 }).lean();
      const teamIds = (user?.roles || [])
        .map((r) => String(r.team))
        .filter(Boolean);

      if (!teamIds.includes(String(task.team))) {
        return res
          .status(UNAUTHORIZED)
          .send('Không có quyền truy cập task này');
      }
    }

    res.send(task);
  }),
);





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
      dueDate,
      startDate,
      estimate,
      storyPoints,
    } = req.body || {};

    if (!team || !title)
      return res.status(BAD_REQUEST).send('Thiếu team/title');

    
    let rawLabels = req.body?.labels ?? [];

    
    if (typeof rawLabels === 'string') {
      
      try {
        const parsed = JSON.parse(rawLabels);
        rawLabels = parsed;
      } catch {
        
        rawLabels = rawLabels
          .replace(/[\[\]'"]/g, '') 
          .split(/[, ]+/)
          .filter(Boolean);
      }
    }

    
    if (!Array.isArray(rawLabels)) {
      rawLabels = [rawLabels];
    }

    
    const labels = rawLabels
      .map((v) => String(v).trim())
      .filter((id) => mongoose.isValidObjectId(id))        
      .map((id) => new mongoose.Types.ObjectId(id));
    
    console.log('Labels to save:', labels);

    
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

    
    try {
      const assigneeIds = (assignees || [])
        .map((u) => (typeof u === 'object' ? u._id : u))
        .filter((id) => id);

      if (assigneeIds.length) {
        await createNotificationsForUsers(assigneeIds, {
          type: 'task_assigned',
          payload: {
            taskId: doc._id,
            taskTitle: doc.title,
            projectId: doc.project || null,
            createdById: req.user.id,
            createdByName: req.user.name,
          },
        });
      }
    } catch (e) {
      console.warn('[task created noti error]', e?.message || e);
    }

    res.status(201).send(doc);
  }),
);





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
    if (!before || before.isDeleted)
      return res.status(404).send('Task không tồn tại');

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

    
    await notifyTaskParticipants(after, 'task_updated', { updates });

    res.send(after);
  }),
);





router.put(
  '/:taskId/status',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { status } = req.body || {};
    if (!status) return res.status(BAD_REQUEST).send('Missing status');

    const t = await TaskModel.findByIdAndUpdate(
      taskId,
      { status },
      { new: true },
    );
    if (!t) return res.status(404).send('Task không tồn tại');

    await recordActivity({
      team: t.team,
      actor: req.user.id,
      verb: 'moved',
      targetType: 'task',
      targetId: t._id,
      metadata: { status },
    });

    await notifyTaskParticipants(t, 'task_status_changed', { status });

    res.send(t);
  }),
);





router.put(
  '/:taskId/assign',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { assignees = [] } = req.body || {};

    const t = await TaskModel.findByIdAndUpdate(
      taskId,
      { assignees },
      { new: true },
    );
    if (!t) return res.status(404).send('Task không tồn tại');

    await recordActivity({
      team: t.team,
      actor: req.user.id,
      verb: 'assigned',
      targetType: 'task',
      targetId: t._id,
      metadata: { assignees },
    });

    await notifyTaskParticipants(t, 'task_assigned', { assignees });

    res.send(t);
  }),
);





router.post(
  '/:taskId/comments',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { content, mentions = [] } = req.body || {};
    if (!content) return res.status(BAD_REQUEST).send('Missing content');

    const task = await TaskModel.findById(taskId).lean();
    if (!task || task.isDeleted)
      return res.status(404).send('Task không tồn tại');

    const cmt = await CommentModel.create({
      task: taskId,
      author: req.user.id,
      content,
      mentions,
    });

    await recordActivity({
      team: task.team,
      actor: req.user.id,
      verb: 'commented',
      targetType: 'task',
      targetId: task._id,
      metadata: { commentId: cmt._id },
    });

    
    await notifyTaskParticipants(task, 'task_comment', {
      commentId: cmt._id,
      commentPreview: content.slice(0, 120),
      authorId: req.user.id,
      authorName: req.user.name,
    });

    
    if (Array.isArray(mentions) && mentions.length) {
      const mentionedIds = mentions
        .map((m) => String(m))
        .filter((id) => id && id !== String(req.user.id)); 

      if (mentionedIds.length) {
        await createNotificationsForUsers(mentionedIds, {
          type: 'comment_mention',
          payload: {
            taskId: task._id,
            taskTitle: task.title,
            commentId: cmt._id,
            commentPreview: content.slice(0, 120),
            authorId: req.user.id,
            authorName: req.user.name,
          },
        });
      }
    }

    res.status(201).send(cmt);
  }),
);




router.post(
  '/:taskId/subtasks',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { title, assignee, order = 0 } = req.body || {};
    if (!title) return res.status(BAD_REQUEST).send('Missing title');

    const exists = await TaskModel.exists({
      _id: taskId,
      isDeleted: { $ne: true },
    });
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

    await notifyTaskParticipants(task, 'subtask_updated', {
      action: 'created',
      subtaskId: st._id,
      title,
    });

    res.status(201).send(st);
  }),
);




router.put(
  '/:taskId/subtasks/:subtaskId',
  authMid,
  handler(async (req, res) => {
    const { taskId, subtaskId } = req.params;

    const updates = {};
    for (const k of ['title', 'isDone', 'assignee', 'order']) {
      if (typeof req.body?.[k] !== 'undefined') updates[k] = req.body[k];
    }
    if (
      Object.prototype.hasOwnProperty.call(updates, 'isDone') &&
      updates.isDone === true
    ) {
      updates.doneAt = new Date();
    }

    const st = await SubtaskModel.findOneAndUpdate(
      { _id: subtaskId, parentTask: taskId },
      updates,
      { new: true },
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

    await notifyTaskParticipants(task, 'subtask_updated', {
      action: 'updated',
      subtaskId: st._id,
      updates,
    });

    res.send(st);
  }),
);


router.delete(
  '/:taskId',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;

    const t = await TaskModel.findById(taskId).lean();
    if (!t) return res.status(404).send('Task không tồn tại');

    const userId = String(req.user?.id);

    // lấy role theo team từ DB (đừng tin token)
    const me = await UserModel.findById(req.user.id, { roles: 1, isAdmin: 1 }).lean();
    const teamRole =
      me?.roles?.find((r) => r?.team && String(r.team) === String(t.team))?.role || null;

    const isGlobalAdmin = !!me?.isAdmin;
    const isReporter = t.reporter && String(t.reporter) === userId;
    const isTeamLeaderOrAdmin = teamRole === 'leader' || teamRole === 'admin';

    // ===== DEBUG (xong rồi bạn có thể xoá log) =====
    console.log('[DELETE TASK DEBUG]', {
      taskId,
      taskTeam: String(t.team),
      userId,
      isGlobalAdmin,
      teamRole,
      isReporter,
      allow: isGlobalAdmin || isReporter || isTeamLeaderOrAdmin,
    });

    if (!isGlobalAdmin && !isReporter && !isTeamLeaderOrAdmin) {
      return res.status(401).send('Không có quyền xoá task này');
    }

    await TaskModel.updateOne(
      { _id: t._id },
      { $set: { isDeleted: true, deletedAt: new Date() } }
    );

    return res.send({ ok: true });
  }),
);

router.post(
  '/:taskId/labels',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { labels = [] } = req.body || {};

    if (!Array.isArray(labels))
      return res.status(BAD_REQUEST).send('labels must be array');
    const ids = labels.map(toObjectId);

    const t = await TaskModel.findById(taskId);
    if (!t || t.isDeleted) return res.status(404).send('Task không tồn tại');

    if (ids.length) {
      const count = await LabelModel.countDocuments({
        _id: { $in: ids },
        team: t.team,
      });
      if (count !== ids.length)
        return res.status(BAD_REQUEST).send('Label không hợp lệ');
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
  }),
);




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

    await notifyTaskParticipants(t, 'attachment_added', {
      attachmentId: att._id,
      name,
    });

    res.status(201).send(att);
  }),
);




router.post(
  '/:taskId/attachments/upload',
  authMid,
  upload.single('file'),
  handler(async (req, res) => {
    const { taskId } = req.params;
    const { subtaskId } = req.body || {};
    const file = req.file;

    if (!file) return res.status(BAD_REQUEST).send('Missing file');

    const task = await TaskModel.findById(taskId);
    if (!task || task.isDeleted) {
      return res.status(404).send('Task không tồn tại');
    }

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

    const result = await uploadToCloudinary(file.buffer, {
      folder: 'smartwork/attachments',
      filename: undefined,
      resource_type: 'auto',
    });

    const att = await AttachmentModel.create({
      task: task._id,
      subtask: subtaskDoc ? subtaskDoc._id : null,
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

    await TaskModel.findByIdAndUpdate(task._id, {
      $addToSet: { attachments: att._id },
    });

    const populated = await AttachmentModel.findById(att._id)
      .populate('subtask', 'title')
      .populate('uploadedBy', 'name email avatarUrl')
      .lean();

    await notifyTaskParticipants(task, 'attachment_added', {
      attachmentId: att._id,
      name: file.originalname,
    });

    res.status(201).send(populated);
  }),
);




router.delete(
  '/:taskId/attachments/:attachmentId',
  authMid,
  handler(async (req, res) => {
    const { taskId, attachmentId } = req.params;

    const att = await AttachmentModel.findOne({
      _id: attachmentId,
      task: taskId,
    });
    if (!att) return res.status(404).send('Attachment không tồn tại');

    if (
      !req.user.isAdmin &&
      String(att.uploadedBy) !== String(req.user.id)
    ) {
      return res.status(UNAUTHORIZED).send('Không có quyền xoá tệp này');
    }

    if (att.storage?.provider === 'cloudinary' && att.storage?.key) {
      try {
        await cloudinary.uploader.destroy(att.storage.key, {
          resource_type: 'auto',
        });
      } catch (e) {
        console.warn('[cloudinary destroy failed]', e?.message || e);
      }
    }

    await AttachmentModel.deleteOne({ _id: attachmentId });
    await TaskModel.findByIdAndUpdate(taskId, {
      $pull: { attachments: att._id },
    });

    const task = await TaskModel.findById(taskId).lean();
    await recordActivity({
      team: task.team,
      actor: req.user.id,
      verb: 'attachment_removed',
      targetType: 'task',
      targetId: task._id,
      metadata: { attachmentId },
    });

    await notifyTaskParticipants(task, 'attachment_removed', {
      attachmentId,
    });

    return res.send();
  }),
);




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
  }),
);




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
        {
          $unwind: { path: '$assignees', preserveNullAndEmptyArrays: true },
        },
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
  }),
);

export default router;