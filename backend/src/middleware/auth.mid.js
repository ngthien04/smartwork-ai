import { verify } from 'jsonwebtoken';
import { UNAUTHORIZED } from '../constants/httpStatus.js';

const authMid = (req, res, next) => {
  const token =
    req.headers['authorization']?.split(' ')[1] || 
    req.headers['access_token'];

  if (!token) return res.status(UNAUTHORIZED).send('Missing token');

  try {
    const decoded = verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    next(); 
  } catch (error) {
    return res.status(UNAUTHORIZED).send('Invalid or expired token');
  }
};

export default authMid;
