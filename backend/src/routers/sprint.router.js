// src/routers/sprint.router.js
import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { SprintModel } from '../models/sprint.js';
import { ProjectModel } from '../models/project.js';
import { UserModel } from '../models/users.js';
import { ActivityModel } from '../models/activity.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isValidId = (id) => mongoose.isValidObjectId(id);
const toId = (v) => new mongoose.Types.ObjectId(String(v));

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

/** Quyền theo project/team */
async function canViewProject(user, project) {
  if (!project) return false;
  if (user?.isAdmin) return true;
  // cho phép member trở lên xem sprint
  const hasRole = await UserModel.exists({
    _id: user.id,
    roles: { $elemMatch: { team: project.team } },
  });
  return !!hasRole;
}
async function canManageProject(user, project) {
  if (!project) return false;
  if (user?.isAdmin) return true;
  const isLead = String(project.lead || '') === String(user.id);
  if (isLead) return true;
  const canTeamManage = await UserModel.exists({
    _id: user.id,
    roles: { $elemMatch: { team: project.team, role: { $in: ['leader', 'admin'] } } },
  });
  return !!canTeamManage;
}

/** Helpers chung */
function parsePaging(query) {
  const page = Math.max(1, Number(query.page || 1));
  const limit = Math.max(1, Math.min(100, Number(query.limit || 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
function sanitizeDates(obj) {
  if (obj.startDate) obj.startDate = new Date(obj.startDate);
  if (obj.endDate) obj.endDate = new Date(obj.endDate);
  return obj;
}

/**
 * GET /api/sprints?project=&team=&status=&from=&to=&page=&limit=
 * - nếu truyền project → lọc theo project
 * - nếu truyền team   → lọc theo team (join qua project)
 * - from/to: lọc theo startDate
 */
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { project, team, status, from, to } = req.query;
    const { page, limit, skip } = parsePaging(req.query);

    const match = {};
    if (status) match.status = status;
    if (from || to) {
      match.startDate = {};
      if (from) match.startDate.$gte = new Date(from);
      if (to) match.startDate.$lte = new Date(to);
    }

    // build pipeline để filter theo team qua project nếu cần
    const pipeline = [];

    if (project && isValidId(project)) {
      match.project = toId(project);
    }

    if (team && isValidId(team)) {
      // join project để lọc team
      pipeline.push(
        { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'project' } },
        { $unwind: '$project' },
        { $match: { 'project.team': toId(team) } }
      );
    }

    // quyền xem: cần có quyền với project (nếu truyền project), nếu không truyền -> lọc tất cả project user có role
    if (project && isValidId(project)) {
      const proj = await ProjectModel.findById(project).lean();
      if (!proj || proj.isDeleted) return res.status(404).send('Project không tồn tại');
      const ok = await canViewProject(req.user, proj);
      if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xem sprint của project này');
    } else if (!req.user?.isAdmin) {
      // hạn chế theo các team mà user có role nếu không truyền project/team
      const user = await UserModel.findById(req.user.id, { roles: 1 }).lean();
      const teamIds = (user?.roles || []).map((r) => r.team).filter(Boolean);
      if (teamIds.length) {
        pipeline.push(
          { $lookup: { from: 'projects', localField: 'project', foreignField: '_id', as: 'project' } },
          { $unwind: '$project' },
          { $match: { 'project.team': { $in: teamIds } } }
        );
      } else {
        // user không thuộc team nào → trả rỗng
        return res.send({ page, limit, total: 0, items: [] });
      }
    }

    if (Object.keys(match).length) pipeline.push({ $match: match });
    pipeline.push({ $sort: { startDate: 1, createdAt: 1 } });
    pipeline.push({ $skip: skip }, { $limit: limit });

    // count total
    const countPipeline = pipeline
      .filter((stg) => !('$skip' in stg) && !('$limit' in stg))
      .concat([{ $count: 'total' }]);

    const [itemsAgg, totalAgg] = await Promise.all([
      SprintModel.aggregate(pipeline),
      SprintModel.aggregate(countPipeline),
    ]);

    // populate nhẹ project để trả về thông tin
    const projectIds = [...new Set(itemsAgg.map((x) => String(x.project)))].map((id) => toId(id));
    const projects = await ProjectModel.find({ _id: { $in: projectIds } }, { name: 1, key: 1, team: 1 }).lean();
    const projectMap = new Map(projects.map((p) => [String(p._id), p]));
    const items = itemsAgg.map((x) => ({
      ...x,
      project: projectMap.get(String(x.project)) || x.project,
    }));

    const total = totalAgg[0]?.total || 0;
    res.send({ page, limit, total, items });
  })
);

/**
 * GET /api/sprints/:id
 */
router.get(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid sprint id');

    const doc = await SprintModel.findById(id).lean();
    if (!doc) return res.status(404).send('Sprint không tồn tại');

    const proj = await ProjectModel.findById(doc.project).lean();
    if (!proj) return res.status(404).send('Project không tồn tại');

    const ok = await canViewProject(req.user, proj);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xem sprint này');

    res.send(doc);
  })
);

/**
 * POST /api/sprints  { project, name, goal?, startDate?, endDate?, status? }
 */
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { project, name, goal, startDate, endDate, status } = req.body || {};
    if (!project || !isValidId(project)) return res.status(BAD_REQUEST).send('Missing/invalid project');
    if (!name) return res.status(BAD_REQUEST).send('Missing name');

    const proj = await ProjectModel.findById(project).lean();
    if (!proj || proj.isDeleted) return res.status(404).send('Project không tồn tại');

    const can = await canManageProject(req.user, proj);
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền tạo sprint cho project này');

    const doc = await SprintModel.create(
      sanitizeDates({ project: toId(project), team: proj.team, name, goal, startDate, endDate, status })
    );

    await recordActivity({
      team: proj.team,
      actor: req.user.id,
      verb: 'sprint_created',
      targetType: 'project',
      targetId: proj._id,
      metadata: { sprintId: doc._id },
    });

    res.status(201).send(doc);
  })
);

/**
 * PUT /api/sprints/:id  { name?, goal?, startDate?, endDate?, status? }
 */
router.put(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid sprint id');

    const doc = await SprintModel.findById(id);
    if (!doc) return res.status(404).send('Sprint không tồn tại');

    const proj = await ProjectModel.findById(doc.project).lean();
    if (!proj) return res.status(404).send('Project không tồn tại');

    const can = await canManageProject(req.user, proj);
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền sửa sprint này');

    const update = sanitizeDates({
      name: req.body?.name,
      goal: req.body?.goal,
      startDate: req.body?.startDate,
      endDate: req.body?.endDate,
      status: req.body?.status,
    });

    Object.keys(update).forEach((k) => update[k] == null && delete update[k]);

    const updated = await SprintModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();

    await recordActivity({
      team: proj.team,
      actor: req.user.id,
      verb: 'sprint_updated',
      targetType: 'project',
      targetId: proj._id,
      metadata: { sprintId: updated._id },
    });

    res.send(updated);
  })
);

/**
 * DELETE /api/sprints/:id
 */
router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid sprint id');

    const doc = await SprintModel.findById(id).lean();
    if (!doc) return res.status(404).send('Sprint không tồn tại');

    const proj = await ProjectModel.findById(doc.project).lean();
    if (!proj) return res.status(404).send('Project không tồn tại');

    const can = await canManageProject(req.user, proj);
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền xoá sprint này');

    await SprintModel.deleteOne({ _id: id });

    await recordActivity({
      team: proj.team,
      actor: req.user.id,
      verb: 'sprint_deleted',
      targetType: 'project',
      targetId: proj._id,
      metadata: { sprintId: id },
    });

    res.send();
  })
);

/**
 * POST /api/sprints/:id/start  (đặt status=active, set startDate nếu chưa có)
 */
router.post(
  '/:id/start',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid sprint id');

    const doc = await SprintModel.findById(id);
    if (!doc) return res.status(404).send('Sprint không tồn tại');

    const proj = await ProjectModel.findById(doc.project).lean();
    if (!proj) return res.status(404).send('Project không tồn tại');

    const can = await canManageProject(req.user, proj);
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền thao tác sprint này');

    doc.status = 'active';
    if (!doc.startDate) doc.startDate = new Date();
    await doc.save();

    await recordActivity({
      team: proj.team,
      actor: req.user.id,
      verb: 'sprint_started',
      targetType: 'project',
      targetId: proj._id,
      metadata: { sprintId: doc._id },
    });

    res.send(doc.toObject());
  })
);

/**
 * POST /api/sprints/:id/complete  (status=completed, set endDate nếu chưa có)
 */
router.post(
  '/:id/complete',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid sprint id');

    const doc = await SprintModel.findById(id);
    if (!doc) return res.status(404).send('Sprint không tồn tại');

    const proj = await ProjectModel.findById(doc.project).lean();
    if (!proj) return res.status(404).send('Project không tồn tại');

    const can = await canManageProject(req.user, proj);
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền thao tác sprint này');

    doc.status = 'completed';
    if (!doc.endDate) doc.endDate = new Date();
    await doc.save();

    await recordActivity({
      team: proj.team,
      actor: req.user.id,
      verb: 'sprint_completed',
      targetType: 'project',
      targetId: proj._id,
      metadata: { sprintId: doc._id },
    });

    res.send(doc.toObject());
  })
);

/**
 * POST /api/sprints/:id/cancel  (status=cancelled)
 */
router.post(
  '/:id/cancel',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid sprint id');

    const doc = await SprintModel.findById(id);
    if (!doc) return res.status(404).send('Sprint không tồn tại');

    const proj = await ProjectModel.findById(doc.project).lean();
    if (!proj) return res.status(404).send('Project không tồn tại');

    const can = await canManageProject(req.user, proj);
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền thao tác sprint này');

    doc.status = 'cancelled';
    await doc.save();

    await recordActivity({
      team: proj.team,
      actor: req.user.id,
      verb: 'sprint_cancelled',
      targetType: 'project',
      targetId: proj._id,
      metadata: { sprintId: doc._id },
    });

    res.send(doc.toObject());
  })
);

export default router;