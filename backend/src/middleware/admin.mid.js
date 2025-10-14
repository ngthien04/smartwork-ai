import { UNAUTHORIZED } from '../constants/httpStatus.js';
import authMid from './auth.mid.js';

const adminMid = (req, res, next) => {
  if (!req.user || !req.user.isAdmin) {
    return res.status(UNAUTHORIZED).send('Admin access required');
  }
  next();
};

export default [authMid, adminMid];
