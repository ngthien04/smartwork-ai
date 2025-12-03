import { Router } from 'express';
import mongoose from 'mongoose';
import crypto from 'crypto';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';

import { WebhookModel } from '../models/webhook.js';
import { UserModel } from '../models/users.js'; 
import { ActivityModel } from '../models/activity.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toId = (v) => new mongoose.Types.ObjectId(String(v));

function isValidId(id) {
  return mongoose.isValidObjectId(id);
}

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

async function canManageTeam(user, teamId) {
  if (user?.isAdmin) return true;
  if (!teamId) return false;
  const found = await UserModel.exists({
    _id: user.id,
    roles: { $elemMatch: { team: toId(teamId), role: { $in: ['leader', 'admin'] } } },
  });
  return !!found;
}

function assertValidUrl(url) {
  try {
    const u = new URL(url);
    if (!['http:', 'https:'].includes(u.protocol)) throw new Error('Only http/https supported');
  } catch (e) {
    const msg = e?.message || 'Invalid URL';
    const err = new Error(`Invalid webhook url: ${msg}`);
    err.statusCode = BAD_REQUEST;
    throw err;
  }
}


function signBody(secret, body, timestamp) {
  if (!secret) return null;
  const h = crypto.createHmac('sha256', secret);
  h.update(`${timestamp}.${body}`);
  return `sha256=${h.digest('hex')}`;
}

const ALLOWED_EVENTS = [
  'task.created',
  'task.updated',
  'task.deleted',
  'comment.created',
  'comment.deleted',
  'reminder.created',
  'reminder.sent',
  'reminder.cancelled',
  'project.updated',
  'team.member.joined',
  'team.member.left',
];

function validateEvents(events) {
  if (!Array.isArray(events)) return true; 
  const invalid = events.filter((e) => typeof e !== 'string' || !ALLOWED_EVENTS.includes(e));
  if (invalid.length) {
    const err = new Error(`Invalid events: ${invalid.join(', ')}`);
    err.statusCode = BAD_REQUEST;
    throw err;
  }
  return true;
}

router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, active, page = 1, limit = 20 } = req.query;

    if (!req.user.isAdmin) {
      if (!team || !isValidId(team)) return res.status(BAD_REQUEST).send('Missing or invalid team');
      const ok = await canManageTeam(req.user, team);
      if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xem webhook của team này');
    }

    const q = {};
    if (team && isValidId(team)) q.team = toId(team);
    if (active === '1' || active === 'true') q.isActive = true;
    if (active === '0' || active === 'false') q.isActive = false;

    const p = Math.max(1, Number(page));
    const l = Math.max(1, Math.min(100, Number(limit)));
    const skip = (p - 1) * l;

    const [items, total] = await Promise.all([
      WebhookModel.find(q).sort('-createdAt').skip(skip).limit(l).lean(),
      WebhookModel.countDocuments(q),
    ]);

    res.send({ page: p, limit: l, total, items });
  })
);

router.get(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid webhook id');

    const doc = await WebhookModel.findById(id).lean();
    if (!doc) return res.status(404).send('Webhook không tồn tại');

    const ok = await canManageTeam(req.user, doc.team);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xem webhook này');

    res.send(doc);
  })
);

router.post(
  '/',
  authMid,
  handler(async (req, res) => {
    const { team, url, secret, events, isActive } = req.body || {};
    if (!team || !isValidId(team)) return res.status(BAD_REQUEST).send('Missing or invalid team');
    if (!url) return res.status(BAD_REQUEST).send('Missing url');

    const ok = await canManageTeam(req.user, team);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền tạo webhook cho team này');

    assertValidUrl(url);
    validateEvents(events);

    const doc = await WebhookModel.create({
      team: toId(team),
      url,
      secret,
      events: Array.isArray(events) ? events : [], 
      isActive: typeof isActive === 'boolean' ? isActive : true,
    });

    await recordActivity({
      team: toId(team),
      actor: req.user.id,
      verb: 'webhook_created',
      targetType: 'webhook',
      targetId: doc._id,
      metadata: { url },
    });

    res.status(201).send(doc);
  })
);

router.put(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid webhook id');

    const doc = await WebhookModel.findById(id);
    if (!doc) return res.status(404).send('Webhook không tồn tại');

    const ok = await canManageTeam(req.user, doc.team);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền sửa webhook này');

    const update = {};
    if (req.body.url) {
      assertValidUrl(req.body.url);
      update.url = req.body.url;
    }
    if (typeof req.body.secret === 'string') update.secret = req.body.secret;
    if (Array.isArray(req.body.events)) {
      validateEvents(req.body.events);
      update.events = req.body.events;
    }
    if (typeof req.body.isActive === 'boolean') update.isActive = req.body.isActive;

    const updated = await WebhookModel.findByIdAndUpdate(id, { $set: update }, { new: true }).lean();

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'webhook_updated',
      targetType: 'webhook',
      targetId: doc._id,
      metadata: {},
    });

    res.send(updated);
  })
);

router.delete(
  '/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid webhook id');

    const doc = await WebhookModel.findById(id);
    if (!doc) return res.status(404).send('Webhook không tồn tại');

    const ok = await canManageTeam(req.user, doc.team);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền xoá webhook này');

    await WebhookModel.deleteOne({ _id: id });

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'webhook_deleted',
      targetType: 'webhook',
      targetId: doc._id,
      metadata: { url: doc.url },
    });

    res.send();
  })
);

router.post(
  '/:id/rotate-secret',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid webhook id');

    const doc = await WebhookModel.findById(id);
    if (!doc) return res.status(404).send('Webhook không tồn tại');

    const ok = await canManageTeam(req.user, doc.team);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền thao tác webhook này');

    const newSecret = crypto.randomBytes(32).toString('hex');
    doc.secret = newSecret;
    await doc.save();

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'webhook_secret_rotated',
      targetType: 'webhook',
      targetId: doc._id,
      metadata: {},
    });

    res.send({ id: doc._id, secret: newSecret });
  })
);

router.post(
  '/:id/test',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid webhook id');

    const doc = await WebhookModel.findById(id).lean();
    if (!doc) return res.status(404).send('Webhook không tồn tại');

    const ok = await canManageTeam(req.user, doc.team);
    if (!ok) return res.status(UNAUTHORIZED).send('Không có quyền thao tác webhook này');

    const event = req.body?.event || 'webhook.test';
    const body = JSON.stringify({
      event,
      attempt: 1,
      deliveryId: crypto.randomUUID(),
      sentAt: new Date().toISOString(),
      payload: req.body?.payload || { hello: 'world' },
    });

    const ts = Math.floor(Date.now() / 1000).toString();
    const signature = signBody(doc.secret, body, ts);

    const headers = {
      'Content-Type': 'application/json',
      'User-Agent': 'smartwork-ai-webhook/1.0',
      'X-Webhook-Event': event,
      'X-Webhook-Timestamp': ts,
    };
    if (signature) headers['X-Webhook-Signature'] = signature;

    let status = 0;
    let text = '';
    try {
      const resp = await fetch(doc.url, { method: 'POST', headers, body });
      status = resp.status;
      text = await resp.text();
    } catch (e) {
      status = 0;
      text = e?.message || 'Network error';
    }

    if (status >= 200 && status < 300) {
      await WebhookModel.updateOne({ _id: id }, { $set: { lastDeliveredAt: new Date() } });
    }

    res.send({ ok: status >= 200 && status < 300, status, body, response: text });
  })
);

export default router;