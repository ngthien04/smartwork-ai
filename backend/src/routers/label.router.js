// src/routers/label.router.js
import { Router } from 'express';
import mongoose from 'mongoose';

import authMid from '../middleware/auth.mid.js';
import adminMid from '../middleware/admin.mid.js';
import { BAD_REQUEST } from '../constants/httpStatus.js';

import { LabelModel } from '../models/label.js';
import { ActivityModel } from '../models/activity.js';

const router = Router();
const handler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const toId = (v) => new mongoose.Types.ObjectId(String(v));

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

// GET /api/labels
// Query: team (bắt buộc), project?, q, page, limit, sort
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, project, q, page = 1, limit = 20, sort = 'name' } = req.query;

    if (!team) return res.status(BAD_REQUEST).send('Missing team');

    const filter = { team: toId(team) };
    if (project) filter.project = toId(project);
    if (q) filter.name = { $regex: String(q), $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      LabelModel.find(filter).sort(sort).skip(skip).limit(Number(limit)).lean(),
      LabelModel.countDocuments(filter),
    ]);

    res.send({
      page: Number(page),
      limit: Number(limit),
      total,
      items,
    });
  }),
);

// GET /api/labels/:labelId
router.get(
  '/:labelId',
  authMid,
  handler(async (req, res) => {
    const { labelId } = req.params;
    const label = await LabelModel.findById(labelId).lean();
    if (!label) return res.status(404).send('Label không tồn tại');
    res.send(label);
  })
);

// POST /api/labels  (admin)
// body: { team, project?, name, color?, description? }
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const {
      team,
      project,
      name,
      color = '#cccccc',
      description,
    } = req.body || {};
    if (!team || !name) return res.status(BAD_REQUEST).send('Thiếu team/name');

    try {
      const label = await LabelModel.create({
        team: toId(team),
        project: project ? toId(project) : undefined,
        name: String(name).trim(),
        color,
        description,
      });

      await recordActivity({
        team: label.team,
        actor: req.user.id,
        verb: 'label_created',
        targetType: 'label',
        targetId: label._id,
        metadata: { name: label.name },
      });
      return res.status(201).send(label);
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(BAD_REQUEST).send('Label đã tồn tại trong team (và project) này');
      }
      throw e;
    }
  }),
);

// PUT /api/labels/:labelId  (admin)
// body: { name?, color?, description? }
router.put(
  '/:labelId',
  authMid,
  handler(async (req, res) => {
    const { labelId } = req.params;
    const { name, color, description } = req.body || {};

    const updates = {};
    if (typeof name !== 'undefined') updates.name = String(name).trim();
    if (typeof color !== 'undefined') updates.color = String(color);
    if (typeof description !== 'undefined') updates.description = String(description);

    try {
      const before = await LabelModel.findById(labelId);
      if (!before) return res.status(404).send('Label không tồn tại');

      await LabelModel.findByIdAndUpdate(labelId, updates);
      const after = await LabelModel.findById(labelId).lean();

      await recordActivity({
        team: before.team,
        actor: req.user.id,
        verb: 'label_updated',
        targetType: 'label',
        targetId: before._id,
        metadata: { updates },
      });

      return res.send(after);
    } catch (e) {
      if (e?.code === 11000) {
        return res.status(BAD_REQUEST).send('Tên label đã tồn tại trong team (và project) này');
      }
      throw e;
    }
  }),
);


// DELETE /api/labels/:labelId  (admin)
// - Xoá nhãn: KHÔNG xoá khỏi task ở đây để an toàn (tuỳ policy).
//   Bạn có thể viết thêm job gỡ label khỏi Task nếu cần.
router.delete(
  '/:labelId',
  authMid,
  handler(async (req, res) => {
    const { labelId } = req.params;

    const lab = await LabelModel.findById(labelId);
    if (!lab) return res.status(404).send('Label không tồn tại');

    await LabelModel.deleteOne({ _id: lab._id });

    await recordActivity({
      team: lab.team,
      actor: req.user.id,
      verb: 'label_deleted',
      targetType: 'label',
      targetId: lab._id,
      metadata: { name: lab.name },
    });

    return res.send();
  })
);

export default router;