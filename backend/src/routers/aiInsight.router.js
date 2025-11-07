// src/routers/aiInsight.router.js
import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middlewares/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { AIInsightModel, TaskModel, ProjectModel, UserModel, ActivityModel } from '../models/index.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isValidId = (id) => mongoose.isValidObjectId(id);
const toId = (v) => new mongoose.Types.ObjectId(String(v));

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

// ---- permission helpers ------------------------------------------------------
async function userHasAnyRoleInTeam(userId, teamId) {
  if (!teamId) return false;
  const exists = await UserModel.exists({
    _id: userId,
    roles: { $elemMatch: { team: toId(teamId) } },
  });
  return !!exists;
}
async function userCanManageTeam(userId, teamId) {
  const exists = await UserModel.exists({
    _id: userId,
    roles: { $elemMatch: { team: toId(teamId), role: { $in: ['owner', 'admin'] } } },
  });
  return !!exists;
}
async function canViewInsight(user, doc) {
  if (user?.isAdmin) return true;
  return userHasAnyRoleInTeam(user.id, doc.team);
}
async function canManageInsight(user, doc) {
  if (user?.isAdmin) return true;
  return userCanManageTeam(user.id, doc.team);
}

// ---- query builder -----------------------------------------------------------
function buildQuery(qs) {
  const q = {};
  if (qs.team && isValidId(qs.team)) q.team = toId(qs.team);
  if (qs.task && isValidId(qs.task)) q.task = toId(qs.task);
  if (qs.kind) q.kind = String(qs.kind);

  if (qs.status) {
    switch (qs.status) {
      case 'pending':
        q.acceptedAt = { $exists: false };
        q.dismissedAt = { $exists: false };
        break;
      case 'accepted':
        q.acceptedAt = { $exists: true };
        break;
      case 'dismissed':
        q.dismissedAt = { $exists: true };
        break;
    }
  }
  if (qs.from || qs.to) {
    q.createdAt = {};
    if (qs.from) q.createdAt.$gte = new Date(qs.from);
    if (qs.to) q.createdAt.$lte = new Date(qs.to);
  }
  if (qs.scoreMin != null || qs.scoreMax != null) {
    q.score = {};
    if (qs.scoreMin != null) q.score.$gte = Number(qs.scoreMin);
    if (qs.scoreMax != null) q.score.$lte = Number(qs.scoreMax);
  }
  return q;
}
function parsePaging(q) {
  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.max(1, Math.min(100, Number(q.limit || 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// GET /api/ai-insights?team=&task=&kind=&status=&from=&to=&scoreMin=&scoreMax=&page=&limit=&populate=1
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const q = buildQuery(req.query);
    const populate = req.query.populate === '1' || req.query.populate === 'true';

    // Nếu không phải admin và không lọc theo team,
    // giới hạn theo các team user đang thuộc
    if (!req.user?.isAdmin && !q.team) {
      const me = await UserModel.findById(req.user.id, { roles: 1 }).lean();
      const teamIds = (me?.roles || []).map((r) => r.team).filter(Boolean);
      if (!teamIds.length) return res.send({ page, limit, total: 0, items: [] });
      q.team = { $in: teamIds };
    }

    const cur = AIInsightModel.find(q).sort('-createdAt').skip(skip).limit(limit);
    if (populate) {
      cur.populate('task', 'title status project team')
         .populate('acceptedBy', 'name email avatarUrl')
         .populate('dismissedBy', 'name email avatarUrl');
    }
    const [items, total] = await Promise.all([cur.lean(), AIInsightModel.countDocuments(q)]);
    res.send({ page, limit, total, items });
  })
);

// GET /api/ai-insights/:id
router.get(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid insight id');

    const doc = await AIInsightModel.findById(id)
      .populate('task', 'title status project team')
      .populate('acceptedBy', 'name email avatarUrl')
      .populate('dismissedBy', 'name email avatarUrl')
      .lean();
    if (!doc) return res.status(404).send('Insight không tồn tại');

    if (!(await canViewInsight(req.user, doc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền xem insight này');
    }
    res.send(doc);
  })
);

// POST /api/ai-insights { team?, task?, kind, message, score? }
// - nếu có task ⇒ team lấy theo task.project.team
// - yêu cầu: user là admin hoặc có role trong team
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, task, kind, message, score } = req.body || {};
    if (!kind) return res.status(BAD_REQUEST).send('Missing kind');
    if (!message) return res.status(BAD_REQUEST).send('Missing message');

    let teamId = team && isValidId(team) ? toId(team) : null;

    if (task) {
      if (!isValidId(task)) return res.status(BAD_REQUEST).send('Invalid task id');
      const t = await TaskModel.findById(task).lean();
      if (!t || t.isDeleted) return res.status(404).send('Task không tồn tại');
      // project -> team
      const proj = await ProjectModel.findById(t.project).lean();
      teamId = proj?.team || t.team || teamId; // fallback
    }

    if (!teamId) return res.status(BAD_REQUEST).send('Không xác định được team cho insight');

    const can = req.user?.isAdmin || (await userHasAnyRoleInTeam(req.user.id, teamId));
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền tạo insight cho team này');

    const doc = await AIInsightModel.create({
      team: teamId,
      task: task ? toId(task) : undefined,
      kind,
      message,
      score: score != null ? Number(score) : undefined,
    });

    await recordActivity({
      team: teamId,
      actor: req.user.id,
      verb: 'ai_insight_created',
      targetType: doc.task ? 'task' : 'team',
      targetId: doc.task || teamId,
      metadata: { insightId: doc._id, kind },
    });

    const populated = await AIInsightModel.findById(doc._id)
      .populate('task', 'title status project team')
      .lean();
    res.status(201).send(populated);
  })
);

// POST /api/ai-insights/:id/accept
router.post(
  '/:id/accept',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid insight id');

    const doc = await AIInsightModel.findById(id);
    if (!doc) return res.status(404).send('Insight không tồn tại');

    if (!(await canManageInsight(req.user, doc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền accept insight này');
    }

    doc.acceptedBy = toId(req.user.id);
    doc.acceptedAt = new Date();
    // Nếu muốn: doc.dismissedAt = undefined; doc.dismissedBy = undefined;
    await doc.save();

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'ai_insight_accepted',
      targetType: doc.task ? 'task' : 'team',
      targetId: doc.task || doc.team,
      metadata: { insightId: doc._id },
    });

    const populated = await AIInsightModel.findById(doc._id)
      .populate('acceptedBy', 'name email avatarUrl')
      .populate('task', 'title status project team')
      .lean();
    res.send(populated);
  })
);

// POST /api/ai-insights/:id/dismiss
router.post(
  '/:id/dismiss',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid insight id');

    const doc = await AIInsightModel.findById(id);
    if (!doc) return res.status(404).send('Insight không tồn tại');

    if (!(await canManageInsight(req.user, doc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền dismiss insight này');
    }

    doc.dismissedBy = toId(req.user.id);
    doc.dismissedAt = new Date();
    await doc.save();

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'ai_insight_dismissed',
      targetType: doc.task ? 'task' : 'team',
      targetId: doc.task || doc.team,
      metadata: { insightId: doc._id },
    });

    const populated = await AIInsightModel.findById(doc._id)
      .populate('dismissedBy', 'name email avatarUrl')
      .populate('task', 'title status project team')
      .lean();
    res.send(populated);
  })
);

// DELETE /api/ai-insights/:id
router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid insight id');

    const doc = await AIInsightModel.findById(id).lean();
    if (!doc) return res.status(404).send('Insight không tồn tại');

    const can = await canManageInsight(req.user, doc);
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền xoá insight này');

    await AIInsightModel.deleteOne({ _id: id });

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'ai_insight_deleted',
      targetType: doc.task ? 'task' : 'team',
      targetId: doc.task || doc.team,
      metadata: { insightId: id },
    });

    res.send();
  })
);

export default router;