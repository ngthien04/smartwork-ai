// src/routers/integration.router.js
import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middlewares/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { IntegrationModel, UserModel, ActivityModel } from '../models/index.js';

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
  const ok = await UserModel.exists({
    _id: userId,
    roles: { $elemMatch: { team: toId(teamId) } },
  });
  return !!ok;
}
async function userCanManageTeam(userId, teamId) {
  const ok = await UserModel.exists({
    _id: userId,
    roles: { $elemMatch: { team: toId(teamId), role: { $in: ['owner', 'admin'] } } },
  });
  return !!ok;
}
async function canViewIntegration(user, teamId) {
  if (user?.isAdmin) return true;
  return userHasAnyRoleInTeam(user.id, teamId);
}
async function canManageIntegration(user, teamId) {
  if (user?.isAdmin) return true;
  return userCanManageTeam(user.id, teamId);
}

// ---- helpers -----------------------------------------------------------------
function parsePaging(q) {
  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.max(1, Math.min(100, Number(q.limit || 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}
const PROVIDERS = ['slack', 'github', 'gitlab', 'notion', 'google_calendar', 'zapier'];
function assertProvider(p) {
  if (!PROVIDERS.includes(p)) {
    const e = new Error(`Invalid provider: ${p}`);
    e.statusCode = BAD_REQUEST;
    throw e;
  }
}

// GET /api/integrations?team=&provider=&active=1|0&page=&limit=
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const { team, provider, active } = req.query;

    const q = {};
    if (team && isValidId(team)) q.team = toId(team);
    if (provider) q.provider = String(provider);
    if (active === '1' || active === 'true') q.isActive = true;
    if (active === '0' || active === 'false') q.isActive = false;

    // quyền xem: nếu không phải admin thì yêu cầu có role trong team.
    if (!req.user?.isAdmin) {
      // nếu không truyền team, giới hạn theo các team của user
      if (!q.team) {
        const me = await UserModel.findById(req.user.id, { roles: 1 }).lean();
        const teamIds = (me?.roles || []).map((r) => r.team).filter(Boolean);
        if (!teamIds.length) return res.send({ page, limit, total: 0, items: [] });
        q.team = { $in: teamIds };
      } else {
        const ok = await canViewIntegration(req.user, q.team);
        if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xem integration của team này');
      }
    }

    const [items, total] = await Promise.all([
      IntegrationModel.find(q).sort('-updatedAt').skip(skip).limit(limit).lean(),
      IntegrationModel.countDocuments(q),
    ]);

    res.send({ page, limit, total, items });
  })
);

// GET /api/integrations/:id
router.get(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid integration id');

    const doc = await IntegrationModel.findById(id).lean();
    if (!doc) return res.status(404).send('Integration không tồn tại');

    const ok = await canViewIntegration(req.user, doc.team);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xem integration này');

    res.send(doc);
  })
);

// POST /api/integrations { team, provider, config?, isActive? }
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, provider, config, isActive } = req.body || {};
    if (!team || !isValidId(team)) return res.status(BAD_REQUEST).send('Missing/invalid team');
    if (!provider) return res.status(BAD_REQUEST).send('Missing provider');
    assertProvider(provider);

    const canManage = await canManageIntegration(req.user, team);
    if (!canManage) return res.status(UNAUTHORIZED).send('Không có quyền tạo integration cho team này');

    try {
      const doc = await IntegrationModel.create({
        team: toId(team),
        provider,
        config: config ?? {},
        isActive: typeof isActive === 'boolean' ? isActive : true,
      });

      await recordActivity({
        team: toId(team),
        actor: req.user.id,
        verb: 'integration_created',
        targetType: 'integration',
        targetId: doc._id,
        metadata: { provider },
      });

      res.status(201).send(doc);
    } catch (err) {
      // handle unique index (team+provider)
      if (err?.code === 11000) {
        return res.status(BAD_REQUEST).send('Integration của provider này đã tồn tại trong team');
      }
      throw err;
    }
  })
);

// PUT /api/integrations/:id  { config?, isActive? }
router.put(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid integration id');

    const doc = await IntegrationModel.findById(id);
    if (!doc) return res.status(404).send('Integration không tồn tại');

    const canManage = await canManageIntegration(req.user, doc.team);
    if (!canManage) return res.status(UNAUTHORIZED).send('Không có quyền sửa integration này');

    const update = {};
    if (req.body.config != null) update.config = req.body.config;
    if (typeof req.body.isActive === 'boolean') update.isActive = req.body.isActive;

    const updated = await IntegrationModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'integration_updated',
      targetType: 'integration',
      targetId: doc._id,
      metadata: {},
    });

    res.send(updated);
  })
);

// DELETE /api/integrations/:id
router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid integration id');

    const doc = await IntegrationModel.findById(id).lean();
    if (!doc) return res.status(404).send('Integration không tồn tại');

    const canManage = await canManageIntegration(req.user, doc.team);
    if (!canManage) return res.status(UNAUTHORIZED).send('Không có quyền xoá integration này');

    await IntegrationModel.deleteOne({ _id: id });

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'integration_deleted',
      targetType: 'integration',
      targetId: doc._id,
      metadata: { provider: doc.provider },
    });

    res.send();
  })
);

// POST /api/integrations/:id/enable
router.post(
  '/:id/enable',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid integration id');

    const doc = await IntegrationModel.findById(id);
    if (!doc) return res.status(404).send('Integration không tồn tại');

    const canManage = await canManageIntegration(req.user, doc.team);
    if (!canManage) return res.status(UNAUTHORIZED).send('Không có quyền thao tác integration này');

    if (!doc.isActive) {
      doc.isActive = true;
      await doc.save();
      await recordActivity({
        team: doc.team,
        actor: req.user.id,
        verb: 'integration_enabled',
        targetType: 'integration',
        targetId: doc._id,
        metadata: {},
      });
    }
    res.send(doc.toObject());
  })
);

// POST /api/integrations/:id/disable
router.post(
  '/:id/disable',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid integration id');

    const doc = await IntegrationModel.findById(id);
    if (!doc) return res.status(404).send('Integration không tồn tại');

    const canManage = await canManageIntegration(req.user, doc.team);
    if (!canManage) return res.status(UNAUTHORIZED).send('Không có quyền thao tác integration này');

    if (doc.isActive) {
      doc.isActive = false;
      await doc.save();
      await recordActivity({
        team: doc.team,
        actor: req.user.id,
        verb: 'integration_disabled',
        targetType: 'integration',
        targetId: doc._id,
        metadata: {},
      });
    }
    res.send(doc.toObject());
  })
);

export default router;