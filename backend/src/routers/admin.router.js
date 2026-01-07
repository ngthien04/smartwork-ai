import { Router } from 'express';
import authMid from '../middleware/auth.mid.js';
import adminMid from '../middleware/admin.mid.js';
import { UserModel } from '../models/users.js';
import { TeamModel } from '../models/team.js';
import { PaymentModel } from '../models/payment.js';

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

// -----------------------------
// PLAN / SUBSCRIPTION ANALYTICS
// -----------------------------

// GET /api/admin/plans/summary
// Thống kê tổng quan về gói & doanh thu
router.get(
  '/plans/summary',
  authMid,
  adminMid,
  handler(async (req, res) => {
    const now = new Date();

    const [teamsByPlan, activePremium, paymentsByStatus, revenueAgg] = await Promise.all([
      TeamModel.aggregate([
        { $match: { isDeleted: { $ne: true } } },
        {
          $group: {
            _id: '$plan',
            count: { $sum: 1 },
          },
        },
      ]),
      TeamModel.countDocuments({
        isDeleted: { $ne: true },
        plan: 'PREMIUM',
        $or: [{ planExpiredAt: { $gt: now } }, { planExpiredAt: { $exists: false } }],
      }),
      PaymentModel.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]),
      PaymentModel.aggregate([
        { $match: { status: 'SUCCESS' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
          },
        },
      ]),
    ]);

    const planStats = {
      totalTeams: teamsByPlan.reduce((acc, item) => acc + (item.count || 0), 0),
      freeTeams: teamsByPlan.find((i) => i._id === 'FREE')?.count || 0,
      premiumTeams: teamsByPlan.find((i) => i._id === 'PREMIUM')?.count || 0,
      activePremiumTeams: activePremium,
    };

    const revenueStats = {
      totalRevenue: revenueAgg[0]?.totalRevenue || 0,
      totalPayments: paymentsByStatus.reduce((acc, item) => acc + (item.count || 0), 0),
      successPayments: paymentsByStatus.find((i) => i._id === 'SUCCESS')?.count || 0,
      failedPayments: paymentsByStatus.find((i) => i._id === 'FAILED')?.count || 0,
      pendingPayments: paymentsByStatus.find((i) => i._id === 'PENDING')?.count || 0,
    };

    res.send({
      planStats,
      revenueStats,
    });
  })
);

// GET /api/admin/plans/teams - danh sách team & gói đang dùng
router.get(
  '/plans/teams',
  authMid,
  adminMid,
  handler(async (req, res) => {
    const { page = 1, limit = 50, plan } = req.query;

    const filter = { isDeleted: { $ne: true } };
    if (plan && (plan === 'FREE' || plan === 'PREMIUM')) {
      filter.plan = plan;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      TeamModel.find(filter)
        .select('name slug plan planExpiredAt createdAt updatedAt')
        .sort('-updatedAt')
        .skip(skip)
        .limit(Number(limit))
        .lean(),
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

// GET /api/admin/plans/payments - danh sách thanh toán gói PREMIUM
router.get(
  '/plans/payments',
  authMid,
  adminMid,
  handler(async (req, res) => {
    const { page = 1, limit = 50, status } = req.query;

    const filter = {};
    if (status) {
      filter.status = status;
    }

    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      PaymentModel.find(filter)
        .populate('team', 'name slug plan planExpiredAt')
        .sort('-createdAt')
        .skip(skip)
        .limit(Number(limit))
        .lean(),
      PaymentModel.countDocuments(filter),
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

