import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { ActivityModel, UserModel } from '../models/index.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const isValidId = (id) => mongoose.isValidObjectId(id);
const toId = (v) => new mongoose.Types.ObjectId(String(v));

async function userHasAnyRoleInTeam(userId, teamId) {
  if (!teamId) return false;
  const ok = await UserModel.exists({
    _id: userId,
    roles: { $elemMatch: { team: toId(teamId) } },
  });
  return !!ok;
}
async function canViewTeam(user, teamId) {
  if (user?.isAdmin) return true;
  return userHasAnyRoleInTeam(user.id, teamId);
}
async function canManageTeam(user, teamId) {
  if (user?.isAdmin) return true;
  const ok = await UserModel.exists({
    _id: user.id,
    roles: { $elemMatch: { team: toId(teamId), role: { $in: ['leader', 'admin'] } } },
  });
  return !!ok;
}

function parsePaging(q) {
  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.max(1, Math.min(100, Number(q.limit || 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
function buildQuery(qs) {
  const q = {};
  if (qs.team && isValidId(qs.team)) q.team = toId(qs.team);
  if (qs.actor && isValidId(qs.actor)) q.actor = toId(qs.actor);
  if (qs.targetType) q.targetType = String(qs.targetType);
  if (qs.targetId && isValidId(qs.targetId)) q.targetId = toId(qs.targetId);
  if (qs.verb) q.verb = String(qs.verb);
  if (qs.from || qs.to) {
    q.createdAt = {};
    if (qs.from) q.createdAt.$gte = new Date(qs.from);
    if (qs.to) q.createdAt.$lte = new Date(qs.to);
  }
  return q;
}

router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const q = buildQuery(req.query);

    if (q.team) {
      const ok = await canViewTeam(req.user, q.team);
      if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xem hoạt động của team này');
    } else if (!req.user?.isAdmin) {
      const me = await UserModel.findById(req.user.id, { roles: 1 }).lean();
      const teamIds = (me?.roles || []).map((r) => r.team).filter(Boolean);
      if (!teamIds.length) return res.send({ page, limit, total: 0, items: [] });
      q.team = { $in: teamIds };
    }

    const [items, total] = await Promise.all([
      ActivityModel.find(q)
        .populate('actor', 'name email avatarUrl')
        .sort('-createdAt')
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityModel.countDocuments(q),
    ]);

    res.send({ page, limit, total, items });
  })
);

router.get(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid activity id');

    const doc = await ActivityModel.findById(id)
      .populate('actor', 'name email avatarUrl')
      .lean();
    if (!doc) return res.status(404).send('Activity không tồn tại');

    const ok = await canViewTeam(req.user, doc.team);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xem activity này');

    res.send(doc);
  })
);

router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid activity id');

    const doc = await ActivityModel.findById(id).lean();
    if (!doc) return res.status(404).send('Activity không tồn tại');

    const ok = await canManageTeam(req.user, doc.team);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xoá activity này');

    await ActivityModel.deleteOne({ _id: id });
    res.send();
  })
);

export default router;