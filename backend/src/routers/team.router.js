import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import adminMid from '../middleware/admin.mid.js'; 
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { TeamModel } from '../models/team.js';
import { UserModel } from '../models/users.js';
import { InviteModel } from '../models/invite.js';
import { ActivityModel } from '../models/activity.js';

import { ProjectModel } from '../models/project.js';
import { TaskModel } from '../models/task.js';


import { sendWelcomeEmail } from '../helpers/mail.helper.js';


const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

const toId = (v) => new mongoose.Types.ObjectId(String(v));

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

function ensureMemberRole(teamDoc, userId) {
  const found = teamDoc.members?.find((m) => String(m.user) === String(userId));
  return found?.role || null;
}

function isTeamMember(teamDoc, user) {
  if (user?.isAdmin) return true; 
  return teamDoc.members?.some((m) => String(m.user) === String(user.id));
}

function isLeaderOrAdmin(teamDoc, user) {
  if (user?.isAdmin) return true;
  const role = ensureMemberRole(teamDoc, user.id);
  return role === 'leader' || role === 'admin';
}

function canInvite(teamDoc, user) {
  
  return isLeaderOrAdmin(teamDoc, user);
}



router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { q, page = 1, limit = 20, sort = '-updatedAt' } = req.query;

    const filter = {
      'members.user': toId(req.user.id),
      isDeleted: { $ne: true },
    };
    if (q) filter.name = { $regex: String(q), $options: 'i' };

    const skip = (Number(page) - 1) * Number(limit);
    const [items, total] = await Promise.all([
      TeamModel.find(filter).sort(sort).skip(skip).limit(Number(limit)).lean(),
      TeamModel.countDocuments(filter),
    ]);

    res.send({ page: Number(page), limit: Number(limit), total, items });
  })
);


router.get(
  '/:teamId',
  authMid,
  handler(async (req, res) => {
    const { teamId } = req.params;
    const team = await TeamModel.findById(teamId).lean();
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    const isMember = team.members?.some(
      (m) => String(m.user) === String(req.user.id)
    );
    const isGlobalAdmin = req.user.isAdmin === true; 

    if (!isMember && !isGlobalAdmin) {
      return res.status(UNAUTHORIZED).send('Bạn không thuộc team này');
    }

    res.send(team);
  })
);



router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { name, slug, description } = req.body || {};
    if (!name || !slug) return res.status(BAD_REQUEST).send('Thiếu name/slug');

    
    const team = await TeamModel.create({
      name: name.trim(),
      slug: String(slug).toLowerCase().trim(),
      description,
      leaders: [req.user.id],
      members: [{ user: req.user.id, role: 'leader', joinedAt: new Date() }],
      settings: {},
    });

    
    await UserModel.findByIdAndUpdate(req.user.id, {
      $addToSet: { roles: { team: team._id, role: 'leader' } },
    });

    await recordActivity({
      team: team._id,
      actor: req.user.id,
      verb: 'team_created',
      targetType: 'team',
      targetId: team._id,
      metadata: { name: team.name },
    });

    res.status(201).send(team);
  })
);



router.put(
  '/:teamId',
  authMid,
  handler(async (req, res) => {
    const { teamId } = req.params;
    const team = await TeamModel.findById(teamId);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    if (!isLeaderOrAdmin(team, req.user)) {
      return res.status(UNAUTHORIZED).send('Chỉ leader/admin mới được cập nhật team');
    }

    const { name, description, settings } = req.body || {};
    const updates = {};
    if (typeof name !== 'undefined') updates.name = String(name).trim();
    if (typeof description !== 'undefined') updates.description = description;
    if (settings && typeof settings === 'object') updates.settings = settings;

    await TeamModel.findByIdAndUpdate(teamId, updates);
    const after = await TeamModel.findById(teamId).lean();

    await recordActivity({
      team: team._id,
      actor: req.user.id,
      verb: 'team_updated',
      targetType: 'team',
      targetId: team._id,
      metadata: { updates },
    });

    res.send(after);
  })
);



router.put(
  '/:teamId/archive',
  authMid,
  handler(async (req, res) => {
    const { teamId } = req.params;
    const { isArchived = true } = req.body || {};
    const team = await TeamModel.findById(teamId);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    if (!isLeaderOrAdmin(team, req.user)) {
      return res.status(UNAUTHORIZED).send('Chỉ leader/admin mới được archive team');
    }

    team.isArchived = !!isArchived;
    await team.save();

    await recordActivity({
      team: team._id,
      actor: req.user.id,
      verb: isArchived ? 'team_archived' : 'team_unarchived',
      targetType: 'team',
      targetId: team._id,
      metadata: {},
    });

    res.send(team);
  })
);


router.delete(
  '/:teamId',
  authMid,
  handler(async (req, res) => {
    const { teamId } = req.params;
    const team = await TeamModel.findById(teamId);
    if (!team) return res.status(404).send('Team không tồn tại');

    const role = ensureMemberRole(team, req.user.id);
    if (role !== 'leader') {
      return res.status(UNAUTHORIZED).send('Chỉ leader được xoá team');
    }

    const now = new Date();

    
    team.isDeleted = true;
    team.deletedAt = now;
    await team.save();

    
    await ProjectModel.updateMany(
      { team: team._id, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
          isArchived: true, 
        },
      },
    );

    
    await TaskModel.updateMany(
      { team: team._id, isDeleted: { $ne: true } },
      {
        $set: {
          isDeleted: true,
          deletedAt: now,
        },
      },
    );

    await recordActivity({
      team: team._id,
      actor: req.user.id,
      verb: 'team_deleted',
      targetType: 'team',
      targetId: team._id,
      metadata: {},
    });

    res.send();
  })
);


router.get(
  '/:teamId/members',
  authMid,
  handler(async (req, res) => {
    const { teamId } = req.params;
    const team = await TeamModel.findById(teamId)
      .populate('members.user', 'name email avatarUrl')
      .lean();

    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    const isMember = team.members?.some((m) => String(m.user._id || m.user) === String(req.user.id));
    if (!isMember) return res.status(UNAUTHORIZED).send('Bạn không thuộc team này');

    res.send(team.members);
  })
);



router.post(
  '/:teamId/members',
  authMid,
  handler(async (req, res) => {
    const { teamId } = req.params;
    const { userId, role = 'member' } = req.body || {};

    const team = await TeamModel.findById(teamId);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');
    if (!isLeaderOrAdmin(team, req.user)) {
      return res.status(UNAUTHORIZED).send('Chỉ leader/admin mới thêm thành viên');
    }
    if (!userId) return res.status(BAD_REQUEST).send('Thiếu userId');

    const user = await UserModel.findById(userId);
    if (!user) return res.status(404).send('User không tồn tại');

    
    const exists = team.members?.some((m) => String(m.user) === String(userId));
    if (!exists) {
      team.members.push({ user: user._id, role, joinedAt: new Date() });
      await team.save();
    } else {
      
      await TeamModel.updateOne(
        { _id: team._id, 'members.user': user._id },
        { $set: { 'members.$.role': role } }
      );
    }

    
    const hasRole = user.roles?.some((r) => String(r.team) === String(team._id));
    if (!hasRole) {
      user.roles = [...(user.roles || []), { team: team._id, role }];
      await user.save();
    } else {
      await UserModel.updateOne(
        { _id: user._id, 'roles.team': team._id },
        { $set: { 'roles.$.role': role } }
      );
    }

    await recordActivity({
      team: team._id,
      actor: req.user.id,
      verb: exists ? 'member_role_changed' : 'member_added',
      targetType: 'team',
      targetId: team._id,
      metadata: { userId: user._id, role },
    });

    const updated = await TeamModel.findById(teamId).populate('members.user', 'name email avatarUrl').lean();
    res.send(updated.members);
  })
);



router.delete(
  '/:teamId/members/:userId',
  authMid,
  handler(async (req, res) => {
    const { teamId, userId } = req.params;
    const team = await TeamModel.findById(teamId);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    const isSelfRemove = String(req.user.id) === String(userId);

    
    
    
    if (isSelfRemove) {
      const myRole = ensureMemberRole(team, userId);

      
      if (myRole === 'leader') {
        const leaderCount = team.members.filter((m) => m.role === 'leader').length;
        if (leaderCount <= 1) {
          return res.status(BAD_REQUEST).send('Bạn là leader cuối cùng, không thể rời team');
        }
      }

      await TeamModel.updateOne(
        { _id: team._id },
        { $pull: { members: { user: toId(userId) } } }
      );
      await UserModel.updateOne(
        { _id: toId(userId) },
        { $pull: { roles: { team: team._id } } }
      );

      return res.send({ ok: true });
    }

    
    
    
    if (!isLeaderOrAdmin(team, req.user)) {
      return res.status(401).send('Chỉ leader/admin mới xoá thành viên');
    }

    const targetRole = ensureMemberRole(team, userId);
    if (targetRole === 'leader') {
      const leaderCount = team.members.filter((m) => m.role === 'leader').length;
      if (leaderCount <= 1) {
        return res.status(BAD_REQUEST).send('Không thể xoá leader cuối cùng');
      }
    }

    await TeamModel.updateOne(
      { _id: team._id },
      { $pull: { members: { user: toId(userId) } } }
    );
    await UserModel.updateOne(
      { _id: toId(userId) },
      { $pull: { roles: { team: team._id } } }
    );

    res.send({ ok: true });
  })
);



router.post(
  '/:teamId/invites',
  authMid,
  handler(async (req, res) => {
    const { teamId } = req.params;
    const { email, role = 'member', expiresInDays = 7 } = req.body || {};
    if (!email) return res.status(BAD_REQUEST).send('Thiếu email');

    const team = await TeamModel.findById(teamId);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    
    if (!canInvite(team, req.user)) {
      return res
        .status(UNAUTHORIZED)
        .send('Bạn phải là thành viên team mới được mời người khác');
    }

    const token = Math.random().toString(36).slice(2) + Date.now().toString(36);
    const expiresAt = new Date(Date.now() + Number(expiresInDays) * 24 * 3600 * 1000);

    const invite = await InviteModel.create({
      team: team._id,
      email: String(email).toLowerCase().trim(),
      role,
      token,
      expiresAt,
    });

    await recordActivity({
      team: team._id,
      actor: req.user.id,
      verb: 'invite_created',
      targetType: 'team',
      targetId: team._id,
      metadata: { email: invite.email, role },
    });

    res.status(201).send({ token, expiresAt });
  })
);

router.post(
  '/invites/accept',
  authMid,
  handler(async (req, res) => {
    const { token } = req.body || {};
    if (!token) return res.status(BAD_REQUEST).send('Thiếu token');

    const invite = await InviteModel.findOne({ token });
    if (!invite) return res.status(404).send('Invite không hợp lệ');
    if (invite.expiresAt < new Date()) return res.status(BAD_REQUEST).send('Invite đã hết hạn');

    const team = await TeamModel.findById(invite.team);
    if (!team || team.isDeleted) return res.status(404).send('Team không tồn tại');

    const me = await UserModel.findById(req.user.id);
    if (!me) return res.status(404).send('User không tồn tại');

    if (String(me.email).toLowerCase().trim() !== String(invite.email).toLowerCase().trim()) {
      return res.status(BAD_REQUEST).send('Email của bạn không khớp email lời mời');
    }

    const exists = team.members?.some((m) => String(m.user) === String(me._id));
    if (!exists) {
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

    await sendWelcomeEmail({ to: me.email, name: me.name });

    res.send({ ok: true });
  })
);


router.get('/slug/:slug', authMid, async (req, res) => {
  const { slug } = req.params;
  const teamDoc = await TeamModel.findOne({ slug, isDeleted: { $ne: true } }).lean();
  if (!teamDoc) return res.status(404).send('Team không tồn tại');
  res.send(teamDoc);
});

export default router;