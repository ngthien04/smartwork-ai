import { Router } from 'express';
import authMid from '../middleware/auth.mid.js';
import adminMid from '../middleware/admin.mid.js';
import { UserModel } from '../models/users.js';
import { TeamModel } from '../models/team.js';

const handler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const router = Router();

// GET /api/admin/users - danh sách user 
router.get(
  '/users',
  authMid,
  adminMid,
  handler(async (req, res) => {
    const { page = 1, limit = 50, q } = req.query;

    const filter = {};
    if (q) {
      filter.$or = [
        { name: { $regex: String(q), $options: 'i' } },
        { email: { $regex: String(q), $options: 'i' } },
      ];
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [rawItems, total] = await Promise.all([
      UserModel.find(filter)
        .select('-passwordHash')
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      UserModel.countDocuments(filter),
    ]);

    // flag isAdmin dựa trên roles 
    const items = rawItems.map((u) => ({
      ...u,
      isAdmin: Array.isArray(u.roles)
        ? u.roles.some((r) => r.role === 'admin')
        : false,
    }));

    res.send({
      page: Number(page),
      limit: Number(limit),
      total,
      items,
    });
  })
);

// GET /api/admin/teams - danh sách team 
router.get(
  '/teams',
  authMid,
  adminMid,
  handler(async (req, res) => {
    const { page = 1, limit = 50, q } = req.query;

    const filter = { isDeleted: { $ne: true } };
    if (q) {
      filter.name = { $regex: String(q), $options: 'i' };
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      TeamModel.find(filter).sort('-updatedAt').skip(skip).limit(Number(limit)).lean(),
      TeamModel.countDocuments(filter),
    ]);

    res.send({
      page: Number(page),
      limit: Number(limit),
      total,
      items,
    });
  })
);

export default router;


