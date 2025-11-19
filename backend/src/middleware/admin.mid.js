import { UNAUTHORIZED } from '../constants/httpStatus.js';

export default function adminMid(req, res, next) {
  // authMid phải chạy trước => req.user đã có
  if (!req.user) {
    return res.status(UNAUTHORIZED).send('Unauthenticated');
  }

  // Dùng flag isAdmin từ token (tính từ roles lúc login)
  if (!req.user.isAdmin) {
    return res.status(UNAUTHORIZED).send('Admin only');
  }

  next();
}