
import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { TeamModel } from '../models/team.js';
import { InviteModel } from '../models/invite.js';
import { UserModel } from '../models/users.js';
import { ActivityModel } from '../models/activity.js';

const router = Router();
const handler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const toId = (v) => new mongoose.Types.ObjectId(String(v));

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

function isMember(teamDoc, userId) {
  return teamDoc.members?.some((m) => String(m.user) === String(userId));
}


router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, page = 1, limit = 20 } = req.query;

    const filter = {};
    if (team) filter.team = toId(team);

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      InviteModel.find(filter).sort('-createdAt').skip(skip).limit(Number(limit)).lean(),
      InviteModel.countDocuments(filter),
    ]);

    res.send({ page: Number(page), limit: Number(limit), total, items });
  })
);


router.get(
  '/token/:token',
  authMid,
  handler(async (req, res) => {
    const { token } = req.params;
    const invite = await InviteModel.findOne({ token })
      .populate('team', 'name')
      .lean();

    if (!invite) return res.status(404).send('Invite không tồn tại');
    if (invite.expiresAt < new Date()) {
      return res.status(BAD_REQUEST).send('Invite đã hết hạn');
    }

    res.send(invite);
  })
);


router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, email, role = 'member', expiresInDays = 7 } = req.body || {};
    if (!team || !email) return res.status(BAD_REQUEST).send('Thiếu team/email');

    const teamDoc = await TeamModel.findById(team);
    if (!teamDoc || teamDoc.isDeleted) {
      return res.status(404).send('Team không tồn tại');
    }

    
    const isTeamMember = isMember(teamDoc, req.user.id);
    const isGlobalAdmin = req.user.isAdmin === true;
    if (!isTeamMember && !isGlobalAdmin) {
      return res
        .status(UNAUTHORIZED)
        .send('Bạn không thuộc team này, không thể mời thành viên');
    }

    const token =
      Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(
      Date.now() + Number(expiresInDays) * 24 * 3600 * 1000
    );

    const invite = await InviteModel.create({
      team: teamDoc._id,
      email: String(email).toLowerCase().trim(),
      role,
      token,
      expiresAt,
    });

    await recordActivity({
      team: teamDoc._id,
      actor: req.user.id,
      verb: 'invite_created',
      targetType: 'team',
      targetId: teamDoc._id,
      metadata: { email: invite.email, role },
    });

    

    res.status(201).send({
      _id: invite._id,
      token: invite.token,
      expiresAt: invite.expiresAt,
      role: invite.role,
      email: invite.email,
    });
  })
);

router.post(
  '/accept',
  authMid,
  handler(async (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.status(BAD_REQUEST).send('Thiếu token');

    const invite = await InviteModel.findOne({ token });
    if (!invite) return res.status(404).send('Invite không hợp lệ');
    if (invite.expiresAt < new Date()) {
      return res.status(BAD_REQUEST).send('Invite đã hết hạn');
    }

    const team = await TeamModel.findById(invite.team);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    const me = await UserModel.findById(req.user.id);
    if (!me) return res.status(404).send('User không tồn tại');

    if (
      String(me.email).toLowerCase().trim() !==
      String(invite.email).toLowerCase().trim()
    ) {
      return res
        .status(BAD_REQUEST)
        .send('Email của bạn không khớp email trong lời mời');
    }

    
    const alreadyMember = team.members?.some(
      (m) => String(m.user) === String(me._id),
    );
    if (!alreadyMember) {
      team.members.push({
        user: me._id,
        role: invite.role,
        joinedAt: new Date(),
      });
      await team.save();
    }

    
    const hasRole = me.roles?.some(
      (r) => String(r.team) === String(team._id),
    );
    if (!hasRole) {
      me.roles = [...(me.roles || []), { team: team._id, role: invite.role }];
      await me.save();
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

    res.send({ ok: true, team });
  })
);


router.delete(
  '/:inviteId',
  authMid,
  handler(async (req, res) => {
    const { inviteId } = req.params;

    const invite = await InviteModel.findById(inviteId);
    if (!invite) return res.status(404).send('Invite không tồn tại');


    
    await invite.deleteOne();

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


router.get(
  '/mine',
  authMid,
  handler(async (req, res) => {
    const emailNorm = String(req.user.email || '').toLowerCase().trim();
    if (!emailNorm) return res.status(BAD_REQUEST).send('User không có email');

    const now = new Date();

    const items = await InviteModel.find({
      email: emailNorm,
      cancelledAt: { $exists: false },
      acceptedAt: { $exists: false },
      expiresAt: { $gt: now },
    })
      .populate('team', 'name slug')
      .lean();

    res.send({ items });
  })
);

export default router;