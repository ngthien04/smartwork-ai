import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { OAuth2Client } from 'google-auth-library';

import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';
import { UserModel } from '../models/users.js';
import authMid from '../middleware/auth.mid.js';
import adminMid from '../middleware/admin.mid.js';

const handler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);

const client = process.env.GOOGLE_CLIENT_ID
  ? new OAuth2Client(process.env.GOOGLE_CLIENT_ID)
  : null;

const router = Router();

router.post(
  '/login',
  handler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(BAD_REQUEST).send('Email và mật khẩu là bắt buộc');
    }

    const emailNorm = String(email).toLowerCase().trim();
    const user = await UserModel.findOne({ email: emailNorm });
    if (!user || !user.passwordHash) {
      return res.status(BAD_REQUEST).send('Email hoặc mật khẩu không đúng');
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(BAD_REQUEST).send('Email hoặc mật khẩu không đúng');
    }

    return res.send(generateTokenResponse(user));
  })
);

router.post(
  '/register',
  handler(async (req, res) => {
    const { name, email, password } = req.body || {};
    if (!name || !email || !password) {
      return res.status(BAD_REQUEST).send('Thiếu name/email/password');
    }

    const emailNorm = String(email).toLowerCase().trim();
    const existed = await UserModel.findOne({ email: emailNorm });
    if (existed) {
      return res.status(BAD_REQUEST).send('Email đã tồn tại');
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const user = await UserModel.create({
      name,
      email: emailNorm,
      passwordHash,
      roles: [
        {
          team: null,       
          role: 'member',   
        },
      ],
    });

    return res.send(generateTokenResponse(user));
  })
);

router.get(
  '/getById/:userId',
  authMid,
  handler(async (req, res) => {
    const { userId } = req.params;

    if (!req.user.isAdmin && String(req.user.id) !== String(userId)) {
      return res.status(UNAUTHORIZED).send('Forbidden');
    }

    const user = await UserModel.findById(userId).select('-passwordHash').lean();
    if (!user) return res.status(404).send('User không tồn tại');

    return res.send(user);
  })
);

router.put(
  '/updateProfile',
  authMid,
  handler(async (req, res) => {
    const { name, avatarUrl, preferences } = req.body || {};

    const updates = {};
    if (typeof name !== 'undefined') updates.name = name;
    if (typeof avatarUrl !== 'undefined') updates.avatarUrl = avatarUrl;
    if (preferences && typeof preferences === 'object') updates.preferences = preferences;

    const user = await UserModel.findByIdAndUpdate(req.user.id, updates, { new: true });
    if (!user) return res.status(404).send('User không tồn tại');

    return res.send(generateTokenResponse(user));
  })
);

router.put(
  '/changePassword',
  authMid,
  handler(async (req, res) => {
    const { oldPassword, newPassword } = req.body || {};
    if (!oldPassword || !newPassword) {
      return res.status(BAD_REQUEST).send('Thiếu oldPassword/newPassword');
    }

    const user = await UserModel.findById(req.user.id);
    if (!user || !user.passwordHash) {
      return res.status(BAD_REQUEST).send('Tài khoản không hợp lệ');
    }

    const match = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!match) {
      return res.status(BAD_REQUEST).send('Mật khẩu cũ không đúng');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await user.save();

    return res.send(generateTokenResponse(user));
  })
);


router.put(
  '/update',
  adminMid,
  handler(async (req, res) => {
    const { id, name, email, avatarUrl, preferences } = req.body || {};
    if (!id) return res.status(BAD_REQUEST).send('Thiếu id');

    const updates = {};
    if (typeof name !== 'undefined') updates.name = name;
    if (typeof email !== 'undefined') updates.email = String(email).toLowerCase().trim();
    if (typeof avatarUrl !== 'undefined') updates.avatarUrl = avatarUrl;
    if (preferences && typeof preferences === 'object') updates.preferences = preferences;

    await UserModel.findByIdAndUpdate(id, updates);
    return res.send();
  })
);

router.post(
  '/google-login',
  handler(async (req, res) => {
    const { credential } = req.body || {};
    if (!credential || !client) {
      return res.status(BAD_REQUEST).send('Thiếu Google credential');
    }

    try {
      const ticket = await client.verifyIdToken({
        idToken: credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });

      const payload = ticket.getPayload();
      const { email, name, picture } = payload;

      // Debug: log payload để kiểm tra
      // console.log('[google-login] Google payload name:', name);
      // console.log('[google-login] Google payload email:', email);

      // tên được xử lý đúng UTF-8
      const userName = name ? String(name).trim() : undefined;
      
      // console.log('[google-login] Processed userName:', userName);

      const emailNorm = String(email).toLowerCase().trim();
      let user = await UserModel.findOne({ email: emailNorm });
      let isNewUser = false;

      if (!user) {
        // User mới - lần đầu đăng nhập Google
        isNewUser = true;
        user = await UserModel.create({
          name: userName,
          email: emailNorm,
          passwordHash: undefined, 
          avatarUrl: picture,
          authProviders: [{ provider: 'google', providerId: payload.sub }],
        });
        console.log('[google-login] Created new user with name:', user.name);
      } else {
        // User đã tồn tại - chỉ cập nhật nếu cần
        if (userName && (!user.name || user.name !== userName)) {
          user.name = userName;
          console.log('[google-login] Updated user name to:', user.name);
        }
        if (!user.avatarUrl && picture) {
          user.avatarUrl = picture;
        }
        await user.save();
        console.log('[google-login] Existing user name:', user.name);
      }

      const response = generateTokenResponse(user, isNewUser);
      console.log('[google-login] Response user name:', response.user.name, 'isNewUser:', isNewUser);
      return res.json(response);
    } catch (error) {
      console.error('[google-login] verify error:', error?.message || error);
      return res.status(BAD_REQUEST).send('Google login failed');
    }
  })
);

router.get('/me', authMid, handler(async (req, res) => {
  const user = await UserModel.findById(req.user.id).select('-passwordHash').lean();
  if (!user) return res.status(404).send('User không tồn tại');
  return res.send(user);
}));

function generateTokenResponse(user, isNewUser = false) {
  
  const roles = user.roles || [];
  const isAdmin = roles.some((r) => r.role === 'admin');

  const token = jwt.sign(
    {
      id: user._id,
      email: user.email,
      name: user.name,
      isAdmin,        
      roles,          
    },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  return {
    token,
    isNewUser, // Flag để frontend biết user có phải là user mới không
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl,
      preferences: user.preferences,
      roles,
      isAdmin,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    },
  };
}


export default router;