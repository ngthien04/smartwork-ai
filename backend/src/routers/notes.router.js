import { Router } from 'express';
import authMid from '../middleware/auth.mid.js';

const router = Router();
const handler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// Tạm thời trả về list rỗng cho dashboard
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { page = 1, size = 10 } = req.query;
    res.send({
      page: Number(page),
      size: Number(size),
      total: 0,
      items: [],
    });
  })
);

export default router;