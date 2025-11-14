import { Router } from 'express';
import mongoose from 'mongoose';

import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { TeamModel } from '../models/team.js';
import { ProjectModel } from '../models/project.js';
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

function memberRole(teamDoc, userId) {
  return teamDoc.members?.find((m) => String(m.user) === String(userId))?.role || null;
}
function isleaderOrAdmin(teamDoc, userId) {
  const r = memberRole(teamDoc, userId);
  return r === 'leader' || r === 'admin';
}


router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, q, isArchived, page = 1, limit = 20, sort = '-updatedAt' } = req.query;
    if (!team) return res.status(BAD_REQUEST).send('Missing team');

    const teamDoc = await TeamModel.findById(team);
    if (!teamDoc || teamDoc.isDeleted) return res.status(404).send('Team không tồn tại');

    const isMember = teamDoc.members?.some((m) => String(m.user) === String(req.user.id));
    if (!isMember) return res.status(UNAUTHORIZED).send('Bạn không thuộc team này');

    const filter = { team: toId(team), isDeleted: { $ne: true } };
    if (typeof isArchived !== 'undefined') filter.isArchived = String(isArchived) === 'true';
    if (q) {
      filter.$or = [
        { name: { $regex: String(q), $options: 'i' } },
        { key: { $regex: String(q), $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      ProjectModel.find(filter).sort(sort).skip(skip).limit(Number(limit)).lean(),
      ProjectModel.countDocuments(filter),
    ]);

    res.send({ page: Number(page), limit: Number(limit), total, items });
  })
);

router.get(
  '/:projectId',
  authMid,
  handler(async (req, res) => {
    const { projectId } = req.params;
    const proj = await ProjectModel.findById(projectId).lean();
    if (!proj || proj.isDeleted) return res.status(404).send('Project không tồn tại');

    const teamDoc = await TeamModel.findById(proj.team);
    const isMember = teamDoc?.members?.some((m) => String(m.user) === String(req.user.id));
    if (!teamDoc || !isMember) return res.status(UNAUTHORIZED).send('Bạn không thuộc team này');

    res.send(proj);
  })
);

// POST /api/projects   (leader/admin)
// body: { team, name, key, description?, lead? }
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, name, key, description, lead } = req.body || {};
    if (!team || !name || !key) return res.status(BAD_REQUEST).send('Thiếu team/name/key');

    const teamDoc = await TeamModel.findById(team);
    if (!teamDoc || teamDoc.isDeleted) return res.status(404).send('Team không tồn tại');
    if (!isleaderOrAdmin(teamDoc, req.user.id)) return res.status(UNAUTHORIZED).send('Chỉ leader/admin mới tạo project');

    try {
      const proj = await ProjectModel.create({
        team: teamDoc._id,
        name: String(name).trim(),
        key: String(key).trim().toUpperCase(),
        description,
        lead: lead ? toId(lead) : undefined,
      });

      await recordActivity({
        team: proj.team,
        actor: req.user.id,
        verb: 'project_created',
        targetType: 'project',
        targetId: proj._id,
        metadata: { name: proj.name, key: proj.key },
      });

      res.status(201).send(proj);
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(BAD_REQUEST).send('KEY đã tồn tại trong team này');
      }
      throw e;
    }
  })
);

router.put(
  '/:projectId',
  authMid,
  handler(async (req, res) => {
    const { projectId } = req.params;
    const proj = await ProjectModel.findById(projectId);
    if (!proj || proj.isDeleted) return res.status(404).send('Project không tồn tại');

    const teamDoc = await TeamModel.findById(proj.team);
    if (!isleaderOrAdmin(teamDoc, req.user.id)) {
      return res.status(UNAUTHORIZED).send('Chỉ leader/admin mới cập nhật project');
    }

    const { name, key, description, lead, isArchived } = req.body || {};
    const updates = {};
    if (typeof name !== 'undefined') updates.name = String(name).trim();
    if (typeof key !== 'undefined') updates.key = String(key).trim().toUpperCase();
    if (typeof description !== 'undefined') updates.description = description;
    if (typeof lead !== 'undefined') updates.lead = lead ? toId(lead) : null;
    if (typeof isArchived !== 'undefined') updates.isArchived = !!isArchived;

    try {
      await ProjectModel.findByIdAndUpdate(projectId, updates);
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(BAD_REQUEST).send('KEY đã tồn tại trong team này');
      }
      throw e;
    }

    const after = await ProjectModel.findById(projectId).lean();

    await recordActivity({
      team: proj.team,
      actor: req.user.id,
      verb: 'project_updated',
      targetType: 'project',
      targetId: proj._id,
      metadata: { updates },
    });

    res.send(after);
  })
);

router.put(
  '/:projectId/archive',
  authMid,
  handler(async (req, res) => {
    const { projectId } = req.params;
    const { isArchived = true } = req.body || {};

    const proj = await ProjectModel.findById(projectId);
    if (!proj || proj.isDeleted) return res.status(404).send('Project không tồn tại');

    const teamDoc = await TeamModel.findById(proj.team);
    if (!isleaderOrAdmin(teamDoc, req.user.id)) {
      return res.status(UNAUTHORIZED).send('Chỉ leader/admin mới archive project');
    }

    proj.isArchived = !!isArchived;
    await proj.save();

    await recordActivity({
      team: proj.team,
      actor: req.user.id,
      verb: isArchived ? 'project_archived' : 'project_unarchived',
      targetType: 'project',
      targetId: proj._id,
      metadata: {},
    });

    res.send(proj);
  })
);

// DELETE /api/projects/:projectId   (leader/admin) — soft delete
router.delete(
  '/:projectId',
  authMid,
  handler(async (req, res) => {
    const { projectId } = req.params;
    const proj = await ProjectModel.findById(projectId);
    if (!proj) return res.status(404).send('Project không tồn tại');

    const teamDoc = await TeamModel.findById(proj.team);
    if (!isleaderOrAdmin(teamDoc, req.user.id)) {
      return res.status(UNAUTHORIZED).send('Chỉ leader/admin mới xoá project');
    }

    proj.isDeleted = true;
    proj.deletedAt = new Date();
    await proj.save();

    await recordActivity({
      team: proj.team,
      actor: req.user.id,
      verb: 'project_deleted',
      targetType: 'project',
      targetId: proj._id,
      metadata: {},
    });

    res.send();
  })
);

router.get(
  '/:projectId/stats/overview',
  authMid,
  handler(async (req, res) => {
    const { projectId } = req.params;
    const proj = await ProjectModel.findById(projectId).lean();
    if (!proj || proj.isDeleted) return res.status(404).send('Project không tồn tại');

    const teamDoc = await TeamModel.findById(proj.team);
    const isMember = teamDoc?.members?.some((m) => String(m.user) === String(req.user.id));
    if (!teamDoc || !isMember) return res.status(UNAUTHORIZED).send('Bạn không thuộc team này');

    const match = { project: toId(projectId), isDeleted: { $ne: true } };

    const [byStatus, overdue] = await Promise.all([
      TaskModel.aggregate([{ $match: match }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
      TaskModel.countDocuments({ ...match, dueDate: { $lt: new Date() }, status: { $nin: ['done'] } }),
    ]);

    res.send({ byStatus, overdue });
  })
);

export default router;