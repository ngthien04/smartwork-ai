import jwt from 'jsonwebtoken';
import { UNAUTHORIZED } from '../constants/httpStatus.js';

export default function authMid(req, res, next) {
  const authHeader = req.headers.authorization || req.headers.Authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(UNAUTHORIZED).send('Missing or invalid Authorization header');
  }

  const token = authHeader.substring('Bearer '.length).trim();
  if (!token) {
    return res.status(UNAUTHORIZED).send('Missing token');
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      id: decoded.id,
      email: decoded.email,
      name: decoded.name,
      isAdmin: !!decoded.isAdmin,
      roles: decoded.roles || [],
    };

    next();
  } catch (e) {
    console.error('[authMid] JWT error:', e?.message || e);
    return res.status(UNAUTHORIZED).send('Invalid or expired token');
  }
}
