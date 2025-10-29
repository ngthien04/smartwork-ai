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

const generateTokenResponse = (user) => {
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      isAdmin: !!user.isAdmin,
    },
    process.env.JWT_SECRET,
    { expiresIn: '15d' }
  );

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    address: user.address,
    isAdmin: !!user.isAdmin,
    avatarUrl: user.avatarUrl,
    token,
  };
};

export default authMid;
