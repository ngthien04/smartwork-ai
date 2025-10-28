import { Router } from 'express';
import mongoose from 'mongoose';

import authMid from '../middlewares/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { InviteModel } from '../models/invite.js';
import { TeamModel } from '../models/team.js';
import { UserModel } from '../models/user.js';
import { ActivityModel } from '../models/activity.js';

import { sendEmail } from '../helpers/mail.helper.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const toId = (v) => new mongoose.Types.ObjectId(String(v));

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

function memberRole(teamDoc, userId) {
  return teamDoc.members?.find((m) => String(m.user) === String(userId))?.role || null;
}
function isOwnerOrAdmin(teamDoc, userId) {
  const r = memberRole(teamDoc, userId);
  return r === 'owner' || r === 'admin';
}

// GET /api/invites?team=<teamId>&page=&limit=
// Liệt kê invites của 1 team (chỉ member xem được; tạo/xoá cần owner/admin)
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, page = 1, limit = 20 } = req.query;
    if (!team) return res.status(BAD_REQUEST).send('Missing team');

    const teamDoc = await TeamModel.findById(team);
    if (!teamDoc || teamDoc.isDeleted) return res.status(404).send('Team không tồn tại');

    const isMember = teamDoc.members?.some((m) => String(m.user) === String(req.user.id));
    if (!isMember) return res.status(UNAUTHORIZED).send('Bạn không thuộc team này');

    const filter = { team: toId(team) };
    const skip = (Number(page) - 1) * Number(limit);

    const [items, total] = await Promise.all([
      InviteModel.find(filter).sort('-createdAt').skip(skip).limit(Number(limit)).lean(),
      InviteModel.countDocuments(filter),
    ]);

    res.send({ page: Number(page), limit: Number(limit), total, items });
  })
);

// GET /api/invites/token/:token   (preview/verify invite)
// Trả về thông tin cơ bản (team name, role, expiry) để FE hiện màn confirm
router.get(
  '/token/:token',
  authMid,
  handler(async (req, res) => {
    const { token } = req.params;
    const invite = await InviteModel.findOne({ token }).lean();
    if (!invite) return res.status(404).send('Invite không hợp lệ');

    const team = await TeamModel.findById(invite.team).lean();
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    const expired = invite.expiresAt < new Date();
    res.send({
      team: { id: team._id, name: team.name, slug: team.slug },
      email: invite.email,
      role: invite.role,
      expired,
      acceptedAt: invite.acceptedAt || null,
    });
  })
);

// POST /api/invites  (owner/admin)
// body: { team, email, role='member', expiresInDays=7, sendEmail=true }
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, email, role = 'member', expiresInDays = 7, sendEmail: shouldSend = true } = req.body || {};
    if (!team || !email) return res.status(BAD_REQUEST).send('Thiếu team/email');

    const teamDoc = await TeamModel.findById(team);
    if (!teamDoc || teamDoc.isDeleted) return res.status(404).send('Team không tồn tại');
    if (!isOwnerOrAdmin(teamDoc, req.user.id)) return res.status(UNAUTHORIZED).send('Chỉ owner/admin mới mời thành viên');

    const normEmail = String(email).toLowerCase().trim();

    if (teamDoc.members?.some((m) => String(m.userEmail)?.toLowerCase?.() === normEmail)) {
    }

    const existingUser = await UserModel.findOne({ email: normEmail }).lean();
    if (existingUser && teamDoc.members?.some((m) => String(m.user) === String(existingUser._id))) {
      return res.status(BAD_REQUEST).send('Người dùng đã nằm trong team');
    }

    const now = new Date();
    const expiresAt = new Date(now.getTime() + Number(expiresInDays) * 24 * 3600 * 1000);
    let invite = await InviteModel.findOne({ team: teamDoc._id, email: normEmail, acceptedAt: { $exists: false } });

    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    if (!invite) {
      invite = await InviteModel.create({
        team: teamDoc._id,
        email: normEmail,
        role,
        token,
        expiresAt,
      });
    } else {
      invite.role = role;
      invite.token = token;      
      invite.expiresAt = expiresAt;
      await invite.save();
    }

    // (tuỳ chọn) gửi email mời
    if (shouldSend) {
      try {
        const appUrl = process.env.APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
        const inviteUrl = `${appUrl}/invite/${invite.token}`;
        await sendEmail({
          to: normEmail,
          subject: `Mời tham gia team ${teamDoc.name}`,
          html: `
            <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
              <h3>Tham gia team <strong>${teamDoc.name}</strong></h3>
              <p>Bạn được mời với quyền: <b>${role}</b>.</p>
              <p><a href="${inviteUrl}">Nhấn vào đây để chấp nhận</a> (hết hạn lúc ${invite.expiresAt.toLocaleString()}).</p>
            </div>`,
          text: `Bạn được mời tham gia team ${teamDoc.name} với quyền ${role}. Link: ${inviteUrl}`,
        });
      } catch (e) {
        console.warn('[invite email failed]', e?.message || e);
      }
    }

    await recordActivity({
      team: teamDoc._id,
      actor: req.user.id,
      verb: 'invite_created',
      targetType: 'team',
      targetId: teamDoc._id,
      metadata: { email: normEmail, role },
    });

    res.status(201).send({ id: invite._id, token: invite.token, expiresAt: invite.expiresAt });
  })
);

// POST /api/invites/accept   
// body: { token }
router.post(
  '/accept',
  authMid,
  handler(async (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.status(BAD_REQUEST).send('Thiếu token');

    const invite = await InviteModel.findOne({ token });
    if (!invite) return res.status(404).send('Invite không hợp lệ');
    if (invite.expiresAt < new Date()) return res.status(BAD_REQUEST).send('Invite đã hết hạn');
    if (invite.acceptedAt) return res.status(BAD_REQUEST).send('Invite đã được sử dụng');

    const team = await TeamModel.findById(invite.team);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    const me = await UserModel.findById(req.user.id);
    if (!me) return res.status(404).send('User không tồn tại');

    const myEmail = String(me.email).toLowerCase().trim();
    if (myEmail !== String(invite.email).toLowerCase().trim()) {
      return res.status(BAD_REQUEST).send('Email của bạn không khớp email lời mời');
    }

    const isMember = team.members?.some((m) => String(m.user) === String(me._id));
    if (!isMember) {
      team.members.push({ user: me._id, role: invite.role, joinedAt: new Date() });
      await team.save();
    } else {
      await TeamModel.updateOne(
        { _id: team._id, 'members.user': me._id },
        { $set: { 'members.$.role': invite.role } }
      );
    }

    const hasRole = me.roles?.some((r) => String(r.team) === String(team._id));
    if (!hasRole) {
      me.roles = [...(me.roles || []), { team: team._id, role: invite.role }];
      await me.save();
    } else {
      await UserModel.updateOne(
        { _id: me._id, 'roles.team': team._id },
        { $set: { 'roles.$.role': invite.role } }
      );
    }

    invite.acceptedBy = me._id;
    invite.acceptedAt = new Date();
    await invite.save();

    await recordActivity({
      team: team._id,
      actor: req.user.id,
      verb: 'invite_accepted',
      targetType: 'team',
      targetId: team._id,
      metadata: { userId: me._id, role: invite.role },
    });

    res.send({ ok: true });
  })
);

// POST /api/invites/:inviteId/resend  (owner/admin)
// Gửi lại email mời (giữ token hiện tại)
router.post(
  '/:inviteId/resend',
  authMid,
  handler(async (req, res) => {
    const { inviteId } = req.params;
    const invite = await InviteModel.findById(inviteId);
    if (!invite) return res.status(404).send('Invite không tồn tại');

    const team = await TeamModel.findById(invite.team);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');
    if (!isOwnerOrAdmin(team, req.user.id)) return res.status(UNAUTHORIZED).send('Chỉ owner/admin');

    try {
      const appUrl = process.env.APP_URL?.replace(/\/$/, '') || 'http://localhost:3000';
      const inviteUrl = `${appUrl}/invite/${invite.token}`;
      await sendEmail({
        to: invite.email,
        subject: `Mời tham gia team ${team.name} (resend)`,
        html: `
          <div style="font-family:system-ui,Segoe UI,Roboto,Arial">
            <h3>Tham gia team <strong>${team.name}</strong></h3>
            <p>Quyền: <b>${invite.role}</b>.</p>
            <p><a href="${inviteUrl}">Chấp nhận lời mời</a> (hết hạn: ${invite.expiresAt.toLocaleString()}).</p>
          </div>`,
        text: `Mời tham gia team ${team.name}, role ${invite.role}. Link: ${inviteUrl}`,
      });
    } catch (e) {
      console.warn('[invite resend email failed]', e?.message || e);
    }

    await recordActivity({
      team: team._id,
      actor: req.user.id,
      verb: 'invite_resent',
      targetType: 'team',
      targetId: team._id,
      metadata: { inviteId, email: invite.email },
    });

    res.send({ ok: true });
  })
);

// DELETE /api/invites/:inviteId  
router.delete(
  '/:inviteId',
  authMid,
  handler(async (req, res) => {
    const { inviteId } = req.params;
    const invite = await InviteModel.findById(inviteId);
    if (!invite) return res.status(404).send('Invite không tồn tại');

    const team = await TeamModel.findById(invite.team);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');
    if (!isOwnerOrAdmin(team, req.user.id)) return res.status(UNAUTHORIZED).send('Chỉ owner/admin');

    await InviteModel.deleteOne({ _id: invite._id });

    await recordActivity({
      team: team._id,
      actor: req.user.id,
      verb: 'invite_revoked',
      targetType: 'team',
      targetId: team._id,
      metadata: { inviteId, email: invite.email },
    });

    res.send();
  })
);

export default router;
