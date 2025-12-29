import { Router } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { TeamModel } from '../models/team.js';
import { InviteModel } from '../models/invite.js';
import { UserModel } from '../models/users.js';
import { ActivityModel } from '../models/activity.js';

import { sendTeamInviteEmail } from '../helpers/mail.helper.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const toId = (v) => new mongoose.Types.ObjectId(String(v));
const isValidId = (id) => mongoose.isValidObjectId(String(id));

function makeToken() {
  return crypto.randomBytes(24).toString('hex');
}

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

function ensureMemberRole(teamDoc, userId) {
  const found = teamDoc.members?.find((m) => String(m.user) === String(userId));
  return found?.role || null;
}
function isLeaderOrAdmin(teamDoc, user) {
  if (user?.isAdmin) return true;
  const role = ensureMemberRole(teamDoc, user.id);
  return role === 'leader' || role === 'admin';
}

function normEmail(email) {
  return String(email || '').toLowerCase().trim();
}

function buildInviteLinks(token) {
  const APP_URL = process.env.APP_URL || 'http://localhost:3000';
  return {
    acceptUrl: `${APP_URL}/invites/accept?token=${encodeURIComponent(token)}`,
    declineUrl: `${APP_URL}/invites/decline?token=${encodeURIComponent(token)}`,
  };
}

// --------------------------------------------------
// GET /invites?team=...
// --------------------------------------------------
router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (team && isValidId(team)) filter.team = toId(team);

    // nếu không phải admin thì chỉ cho xem invites của team mình thuộc về
    if (!req.user?.isAdmin) {
      const myTeamIds = await TeamModel.find(
        { isDeleted: false, 'members.user': toId(req.user.id) },
        { _id: 1 }
      ).lean();

      const allowed = myTeamIds.map((t) => t._id);
      filter.team = filter.team ? filter.team : { $in: allowed };
      if (filter.team && filter.team.$in && !filter.team.$in.length) {
        return res.send({ page: Number(page), limit: Number(limit), total: 0, items: [] });
      }
    }

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      InviteModel.find(filter).sort('-createdAt').skip(skip).limit(Number(limit)).lean(),
      InviteModel.countDocuments(filter),
    ]);

    res.send({ page: Number(page), limit: Number(limit), total, items });
  })
);

// --------------------------------------------------
// GET /invites/token/:token (preview)
// --------------------------------------------------
router.get(
  '/token/:token',
  authMid,
  handler(async (req, res) => {
    const { token } = req.params;
    const invite = await InviteModel.findOne({ token })
      .populate('team', 'name slug')
      .lean();

    if (!invite) return res.status(404).send('Invite không tồn tại');
    if (invite.expiresAt < new Date()) return res.status(BAD_REQUEST).send('Invite đã hết hạn');

    // chỉ cho xem nếu email đúng hoặc admin hoặc leader/admin của team
    const meEmail = normEmail(req.user?.email);
    if (!req.user?.isAdmin && meEmail !== normEmail(invite.email)) {
      const team = await TeamModel.findById(invite.team?._id || invite.team).lean();
      if (!team) return res.status(404).send('Team không tồn tại');
      if (!isLeaderOrAdmin(team, req.user)) {
        return res.status(UNAUTHORIZED).send('Không có quyền xem invite này');
      }
    }

    res.send(invite);
  })
);

// --------------------------------------------------
// POST /invites  { team, email, role, expiresInDays }
// -> create invite + send mailjet
// --------------------------------------------------
router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, email, role = 'member', expiresInDays = 7 } = req.body || {};
    if (!team || !email) return res.status(BAD_REQUEST).send('Thiếu team/email');
    if (!isValidId(team)) return res.status(BAD_REQUEST).send('team không hợp lệ');

    const teamDoc = await TeamModel.findById(team);
    if (!teamDoc || teamDoc.isDeleted) return res.status(404).send('Team không tồn tại');

    // ✅ chỉ leader/admin (hoặc global admin)
    if (!isLeaderOrAdmin(teamDoc, req.user)) {
      return res.status(UNAUTHORIZED).send('Chỉ leader/admin mới được mời thành viên');
    }

    const inviteEmail = normEmail(email);
    if (!inviteEmail) return res.status(BAD_REQUEST).send('Email không hợp lệ');

    // nếu user đã tồn tại và đã là member => block
    const existingUser = await UserModel.findOne({ email: inviteEmail }).lean();
    if (existingUser) {
      const isInTeam = teamDoc.members?.some((m) => String(m.user) === String(existingUser._id));
      if (isInTeam) return res.status(BAD_REQUEST).send('User này đã ở trong team');
    }

    const now = new Date();

    // reuse pending invite chưa hết hạn
    let invite = await InviteModel.findOne({
      team: teamDoc._id,
      email: inviteEmail,
      status: 'pending',
      expiresAt: { $gt: now },
    });

    if (!invite) {
      invite = await InviteModel.create({
        team: teamDoc._id,
        email: inviteEmail,
        role,
        token: makeToken(),
        expiresAt: new Date(Date.now() + Number(expiresInDays) * 24 * 3600 * 1000),
        status: 'pending',
        invitedBy: toId(req.user.id),
      });
    } else {
      // update role nếu muốn
      invite.role = role;
      invite.invitedBy = toId(req.user.id);
      await invite.save();
    }

    const { acceptUrl, declineUrl } = buildInviteLinks(invite.token);

    const rs = await sendTeamInviteEmail({
      to: inviteEmail,
      inviterName: req.user?.name || req.user?.email || '',
      teamName: teamDoc.name,
      role: invite.role,
      acceptUrl,
      declineUrl,
    });
    console.log('MAILJET_INVITE_RESULT', JSON.stringify(rs, null, 2));

    await recordActivity({
      team: teamDoc._id,
      actor: req.user.id,
      verb: 'invite_created',
      targetType: 'team',
      targetId: teamDoc._id,
      metadata: { email: inviteEmail, role: invite.role },
    });

    // ✅ professional: không trả token ra UI
    res.status(201).send({ ok: true, expiresAt: invite.expiresAt });
  })
);

// --------------------------------------------------
// POST /invites/accept  { token }
// --------------------------------------------------
router.post(
  '/accept',
  authMid,
  handler(async (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.status(BAD_REQUEST).send('Thiếu token');

    const invite = await InviteModel.findOne({ token });
    if (!invite) return res.status(404).send('Invite không hợp lệ');

    const now = new Date();
    if (invite.expiresAt < now) return res.status(BAD_REQUEST).send('Invite đã hết hạn');

    if (invite.status === 'accepted') {
      return res.send({ ok: true, status: 'accepted', teamId: String(invite.team) });
    }
    if (invite.status === 'declined') return res.status(BAD_REQUEST).send('Invite đã bị từ chối');
    if (invite.status === 'cancelled') return res.status(BAD_REQUEST).send('Invite đã bị huỷ');

    const teamDoc = await TeamModel.findById(invite.team);
    if (!teamDoc || teamDoc.isDeleted) return res.status(404).send('Team không tồn tại');

    const me = await UserModel.findById(req.user.id);
    if (!me) return res.status(404).send('User không tồn tại');

    if (normEmail(me.email) !== normEmail(invite.email)) {
      return res.status(BAD_REQUEST).send('Email của bạn không khớp email trong lời mời');
    }

    // add/update member
    const exists = teamDoc.members?.some((m) => String(m.user) === String(me._id));
    if (!exists) {
      teamDoc.members = teamDoc.members || [];
      teamDoc.members.push({ user: me._id, role: invite.role, joinedAt: new Date() });
      await teamDoc.save();
    } else {
      await TeamModel.updateOne(
        { _id: teamDoc._id, 'members.user': me._id },
        { $set: { 'members.$.role': invite.role } }
      );
    }

    // sync roles in UserModel (bạn đang dùng)
    const hasRole = me.roles?.some((r) => String(r.team) === String(teamDoc._id));
    if (!hasRole) {
      me.roles = [...(me.roles || []), { team: teamDoc._id, role: invite.role }];
      await me.save();
    } else {
      await UserModel.updateOne(
        { _id: me._id, 'roles.team': teamDoc._id },
        { $set: { 'roles.$.role': invite.role } }
      );
    }

    invite.status = 'accepted';
    invite.acceptedBy = me._id;
    invite.acceptedAt = new Date();
    await invite.save();

    await recordActivity({
      team: teamDoc._id,
      actor: me._id,
      verb: 'invite_accepted',
      targetType: 'team',
      targetId: teamDoc._id,
      metadata: { email: invite.email, role: invite.role },
    });

    res.send({ ok: true, status: 'accepted', teamId: String(teamDoc._id) });
  })
);

// --------------------------------------------------
// POST /invites/decline  { token }
// --------------------------------------------------
router.post(
  '/decline',
  authMid,
  handler(async (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.status(BAD_REQUEST).send('Thiếu token');

    const invite = await InviteModel.findOne({ token });
    if (!invite) return res.status(404).send('Invite không hợp lệ');

    const now = new Date();
    if (invite.expiresAt < now) return res.status(BAD_REQUEST).send('Invite đã hết hạn');

    if (invite.status === 'declined') return res.send({ ok: true, status: 'declined' });
    if (invite.status === 'accepted') return res.status(BAD_REQUEST).send('Invite đã được chấp nhận');
    if (invite.status === 'cancelled') return res.status(BAD_REQUEST).send('Invite đã bị huỷ');

    const me = await UserModel.findById(req.user.id);
    if (!me) return res.status(404).send('User không tồn tại');

    if (normEmail(me.email) !== normEmail(invite.email)) {
      return res.status(BAD_REQUEST).send('Email của bạn không khớp email trong lời mời');
    }

    invite.status = 'declined';
    invite.declinedBy = me._id;
    invite.declinedAt = new Date();
    await invite.save();

    await recordActivity({
      team: invite.team,
      actor: me._id,
      verb: 'invite_declined',
      targetType: 'team',
      targetId: invite.team,
      metadata: { email: invite.email },
    });

    res.send({ ok: true, status: 'declined' });
  })
);

// --------------------------------------------------
// DELETE /invites/:inviteId  (cancel by leader/admin)
// --------------------------------------------------
router.delete(
  '/:inviteId',
  authMid,
  handler(async (req, res) => {
    const { inviteId } = req.params;
    if (!isValidId(inviteId)) return res.status(BAD_REQUEST).send('inviteId không hợp lệ');

    const invite = await InviteModel.findById(inviteId);
    if (!invite) return res.status(404).send('Invite không tồn tại');

    const teamDoc = await TeamModel.findById(invite.team);
    if (!teamDoc || teamDoc.isDeleted) return res.status(404).send('Team không tồn tại');

    if (!isLeaderOrAdmin(teamDoc, req.user)) {
      return res.status(UNAUTHORIZED).send('Chỉ leader/admin mới được huỷ lời mời');
    }

    // nếu đã accepted/declined thì không cho cancel (optional)
    if (invite.status !== 'pending') {
      return res.status(BAD_REQUEST).send('Invite không còn ở trạng thái pending');
    }

    invite.status = 'cancelled';
    invite.cancelledBy = toId(req.user.id);
    invite.cancelledAt = new Date();
    await invite.save();

    await recordActivity({
      team: invite.team,
      actor: req.user.id,
      verb: 'invite_cancelled',
      targetType: 'invite',
      targetId: invite._id,
      metadata: { email: invite.email, role: invite.role },
    });

    res.send({ ok: true });
  })
);

// --------------------------------------------------
// GET /invites/mine  (pending invites of my email)
// --------------------------------------------------
router.get(
  '/mine',
  authMid,
  handler(async (req, res) => {
    const emailNorm = normEmail(req.user.email);
    if (!emailNorm) return res.status(BAD_REQUEST).send('User không có email');

    const now = new Date();
    const items = await InviteModel.find({
      email: emailNorm,
      status: 'pending',
      expiresAt: { $gt: now },
    })
      .populate('team', 'name slug')
      .lean();

    res.send({ items });
  })
);

export default router;