// src/middleware/auth.mid.js
import jwt from 'jsonwebtoken';
import { UNAUTHORIZED } from '../constants/httpStatus.js';

const REQUIRE_SECRET = () => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not set');
  }
};

const authMid = (req, res, next) => {
  const token =
    req.headers.authorization?.split(' ')[1] || // "Bearer <token>"
    req.headers['access_token'];

  if (!token) return res.status(UNAUTHORIZED).send('Missing token');

  try {
    REQUIRE_SECRET();
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // { id, email, isAdmin, iat, exp }
    next();
  } catch (error) {
    return res.status(UNAUTHORIZED).send('Invalid or expired token');
  }
};

const generateTokenResponse = (user) => {
  REQUIRE_SECRET();

  const payload = {
    id: user.id || String(user._id), // ưu tiên virtual id, fallback _id
    email: user.email,
    isAdmin: !!user.isAdmin,
  };

  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '15d' });

  return {
    id: payload.id,
    email: user.email,
    name: user.name,
    // address: user.address, // ⛔ schema không có, bỏ hoặc thêm vào schema
    isAdmin: !!user.isAdmin,
    avatarUrl: user.avatarUrl,
    token,
  };
};

export default authMid;
export { generateTokenResponse };