// src/routers/aiInsight.router.js
import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middlewares/auth.mid.js';
import { LabelModel } from '../models/index.js';
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
// body (optional): {
//   apply?: {
//     priority?: "low"|"normal"|"high"|"urgent",
//     dueDate?: string | Date,
//     labelIds?: string[],
//     labelNames?: string[],   // sẽ upsert theo team/project
//     projectId?: string       // nếu task không có project mà bạn muốn gán labelNames
//   }
// }
router.post(
  '/:id/accept',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid insight id');

    const insight = await AIInsightModel.findById(id);
    if (!insight) return res.status(404).send('Insight không tồn tại');

    if (!(await canManageInsight(req.user, insight))) {
      return res.status(UNAUTHORIZED).send('Không có quyền accept insight này');
    }

    // Đánh dấu accept
    insight.acceptedBy = toId(req.user.id);
    insight.acceptedAt = new Date();
    await insight.save();

    // Nếu insight liên quan task thì thử apply thay đổi
    let appliedPatch = null;
    let updatedTask = null;

    if (insight.task) {
      const task = await TaskModel.findById(insight.task).lean();
      if (!task) return res.status(404).send('Task không tồn tại');

      // Chuẩn bị patch từ body.apply nếu có
      const explicit = await buildExplicitPatch(req.body?.apply, { task, teamId: insight.team });

      // Nếu không có patch tường minh -> thử auto apply theo kind + message
      const auto = explicit || (await buildAutoPatchFromInsight(insight, task));

      if (auto && Object.keys(auto).length) {
        // Nếu có labelNames, upsert sang labelIds
        if (auto.labelNames?.length) {
          const projId = task.project || req.body?.apply?.projectId || null;
          const labelIds = await upsertLabelsByNames({
            teamId: insight.team,
            projectId: projId,
            names: auto.labelNames,
          });
          auto.labelIds = [...new Set([...(auto.labelIds || []), ...labelIds.map(String)])];
          delete auto.labelNames;
        }

        // Chuẩn hoá patch để update Task
        const update = {};
        const metadata = {};

        if (auto.priority) {
          update.priority = auto.priority;
          metadata.priority = auto.priority;
        }
        if (auto.dueDate) {
          update.dueDate = new Date(auto.dueDate);
          metadata.dueDate = update.dueDate;
        }
        if (auto.labelIds?.length) {
          // gộp với labels hiện có (unique)
          const current = (task.labels || []).map(String);
          const merged = Array.from(new Set([...current, ...auto.labelIds.map(String)])).map(toId);
          update.labels = merged;
          metadata.labelIds = merged.map(String);
        }

        if (Object.keys(update).length) {
          updatedTask = await TaskModel.findByIdAndUpdate(task._id, { $set: update }, { new: true }).lean();
          appliedPatch = metadata;

          await recordActivity({
            team: insight.team,
            actor: req.user.id,
            verb: 'ai_insight_applied',
            targetType: 'task',
            targetId: task._id,
            metadata: { insightId: insight._id, ...metadata },
          });
        }
      }
    }

    // Log accept
    await recordActivity({
      team: insight.team,
      actor: req.user.id,
      verb: 'ai_insight_accepted',
      targetType: insight.task ? 'task' : 'team',
      targetId: insight.task || insight.team,
      metadata: { insightId: insight._id, applied: !!appliedPatch },
    });

    // Trả về insight + (tuỳ chọn) task đã update
    const populated = await AIInsightModel.findById(insight._id)
      .populate('acceptedBy', 'name email avatarUrl')
      .populate('task', 'title status project team priority dueDate labels')
      .lean();

    res.send({ insight: populated, appliedPatch, task: updatedTask || null });
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

// Patch tường minh từ body
async function buildExplicitPatch(apply, ctx) {
  if (!apply) return null;
  const out = {};

  if (apply.priority && ['low','normal','high','urgent'].includes(apply.priority)) {
    out.priority = apply.priority;
  }
  if (apply.dueDate) {
    const d = new Date(apply.dueDate);
    if (!isNaN(d)) out.dueDate = d;
  }
  if (Array.isArray(apply.labelIds) && apply.labelIds.length) {
    out.labelIds = apply.labelIds.filter(mongoose.isValidObjectId).map(String);
  }
  if (Array.isArray(apply.labelNames) && apply.labelNames.length) {
    out.labelNames = apply.labelNames.map(s => String(s).trim()).filter(Boolean);
  }
  return Object.keys(out).length ? out : null;
}

// Auto suy đoán dựa trên kind + message (rule đơn giản, có thể nâng cấp tuỳ ý)
async function buildAutoPatchFromInsight(insight, task) {
  const { kind, message = '' } = insight;
  const out = {};

  // priority_suggestion → tìm priority trong message, ví dụ: "priority=high"
  if (kind === 'priority_suggestion') {
    const m = /priority\s*=\s*(low|normal|high|urgent)/i.exec(message);
    if (m) out.priority = m[1].toLowerCase();
  }

  // risk_warning → thêm label "risk"
  if (kind === 'risk_warning') {
    out.labelNames = [...(out.labelNames || []), 'risk'];
  }

  // timeline_prediction → tìm date trong message (yyyy-mm-dd)
  if (kind === 'timeline_prediction') {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(message);
    if (m) out.dueDate = m[1];
  }

  // workload_balance → gắn label "workload"
  if (kind === 'workload_balance') {
    out.labelNames = [...(out.labelNames || []), 'workload'];
  }

  return Object.keys(out).length ? out : null;
}

// Tạo/tìm label theo tên, trả về mảng ObjectId
async function upsertLabelsByNames({ teamId, projectId, names = [] }) {
  const safeNames = Array.from(new Set(names.map((s) => String(s).trim()).filter(Boolean)));
  if (!safeNames.length) return [];

  // Mặc định gắn theo team; nếu có projectId thì set chung (tuỳ thiết kế index unique của bạn)
  const found = await LabelModel.find({
    name: { $in: safeNames },
    ...(teamId ? { team: toId(teamId) } : {}),
    ...(projectId ? { project: toId(projectId) } : {}),
  }).lean();

  const foundMap = new Map(found.map((d) => [d.name.toLowerCase(), d]));
  const toCreate = safeNames.filter((n) => !foundMap.has(n.toLowerCase()));

  if (toCreate.length) {
    const docs = await LabelModel.insertMany(
      toCreate.map((name) => ({
        name,
        team: teamId ? toId(teamId) : undefined,
        project: projectId ? toId(projectId) : undefined,
        color: '#F87171', // đỏ nhạt mặc định; có thể random/tuỳ biến
      })),
      { ordered: false }
    );
    docs.forEach((d) => foundMap.set(d.name.toLowerCase(), d));
  }

  return safeNames
    .map((n) => foundMap.get(n.toLowerCase()))
    .filter(Boolean)
    .map((d) => d._id);
}

export default router;