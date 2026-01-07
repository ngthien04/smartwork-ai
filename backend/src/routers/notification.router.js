import { Router } from "express";
import mongoose from "mongoose";
import authMid from "../middleware/auth.mid.js";
import { BAD_REQUEST, UNAUTHORIZED } from "../constants/httpStatus.js";

import { NotificationModel } from "../models/notification.js";
import { UserModel } from "../models/users.js";
import dayjs from "dayjs";
import { TaskModel } from "../models/task.js";

const router = Router();
const handler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);
const isValidId = (id) => mongoose.isValidObjectId(id);
const toId = (v) => new mongoose.Types.ObjectId(String(v));

function parsePaging(q) {
  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.max(1, Math.min(100, Number(q.limit || 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

function buildQuery(qs) {
  const q = {};
  if (qs.user && isValidId(qs.user)) q.user = toId(qs.user);
  if (qs.type) q.type = String(qs.type);
  if (qs.channel) q.channel = String(qs.channel);
  if (qs.isRead === "1" || qs.isRead === "true") q.isRead = true;
  if (qs.isRead === "0" || qs.isRead === "false") q.isRead = false;
  if (qs.from || qs.to) {
    q.createdAt = {};
    if (qs.from) q.createdAt.$gte = new Date(qs.from);
    if (qs.to) q.createdAt.$lte = new Date(qs.to);
  }
  return q;
}

export async function ensureDeadlineNotificationsForUser(
  userId,
  { days = 3 } = {}
) {
  const uid = toId(userId);
  const uidStr = String(userId);

  const today = dayjs().startOf("day");
  const noticeDate = today.format("YYYY-MM-DD");
  const to = today.add(days, "day").endOf("day").toDate();

  const tasks = await TaskModel.find(
    {
      isDeleted: { $ne: true },
      status: { $ne: "done" },
      dueDate: { $exists: true, $ne: null, $lte: to },
      $or: [
        { assignees: uid },
        { assignees: uidStr },
        { reporter: uid },
        { reporter: uidStr },
      ],
    },
    { title: 1, dueDate: 1, priority: 1, project: 1, team: 1 }
  ).lean();

  if (!tasks.length) return;

  const existing = await NotificationModel.find(
    {
      user: uid,
      type: "task_deadline_soon",
      "payload.noticeDate": noticeDate,
      "payload.taskId": { $in: tasks.map((t) => String(t._id)) },
    },
    { "payload.taskId": 1 }
  ).lean();

  const existedTaskIds = new Set(
    existing.map((n) => String(n.payload?.taskId))
  );

  const docs = [];
  for (const t of tasks) {
    const taskId = String(t._id);
    if (existedTaskIds.has(taskId)) continue;

    const due = dayjs(t.dueDate);
    const daysLeft = due.startOf("day").diff(today, "day"); // 0..days

    if (daysLeft < 0 || daysLeft > days) continue;

    docs.push({
      user: uid,
      channel: "web",
      type: "task_deadline_soon",
      payload: {
        noticeDate,
        taskId,
        taskTitle: t.title,
        dueDate: due.toISOString(),
        daysLeft,
        priority: t.priority || "normal",
        projectId: t.project ? String(t.project) : null,
        teamId: t.team ? String(t.team) : null,
      },
    });
  }

  if (!docs.length) return;

  try {
    await NotificationModel.insertMany(docs, { ordered: false });
  } catch (e) {
    if (e?.code !== 11000)
      console.warn("[deadline noti insert error]", e?.message || e);
  }
}

router.get(
  "/",
  authMid,
  handler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const q = buildQuery(req.query);

    if (!req.user?.isAdmin) q.user = toId(req.user.id);

    const [items, total] = await Promise.all([
      NotificationModel.find(q)
        .sort("-createdAt")
        .skip(skip)
        .limit(limit)
        .lean(),
      NotificationModel.countDocuments(q),
    ]);

    res.send({ page, limit, total, items });
  })
);

router.get(
  "/unread-count",
  authMid,
  handler(async (req, res) => {
    await ensureDeadlineNotificationsForUser(req.user.id, { days: 3 });

    const q = buildQuery(req.query);
    q.isRead = false;

    if (!req.user?.isAdmin) q.user = toId(req.user.id);

    const count = await NotificationModel.countDocuments(q);
    res.send({ unread: count });
  })
);

router.get(
  "/:id",
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(BAD_REQUEST).send("Invalid notification id");

    const doc = await NotificationModel.findById(id).lean();
    if (!doc) return res.status(404).send("Notification không tồn tại");

    if (!req.user?.isAdmin && String(doc.user) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send("Không có quyền xem thông báo này");
    }

    res.send(doc);
  })
);

router.post(
  "/",
  authMid,
  handler(async (req, res) => {
    const { user, channel = "web", type, payload } = req.body || {};
    if (!type) return res.status(BAD_REQUEST).send("Missing type");

    let userId = req.user.id;
    if (req.user?.isAdmin && user && isValidId(user)) {
      const exists = await UserModel.exists({ _id: toId(user) });
      if (!exists) return res.status(404).send("User không tồn tại");
      userId = user;
    }

    const doc = await NotificationModel.create({
      user: toId(userId),
      channel,
      type,
      payload: payload ?? {},
    });

    const populated = await NotificationModel.findById(doc._id).lean();
    res.status(201).send(populated);
  })
);

router.put(
  "/:id/read",
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(BAD_REQUEST).send("Invalid notification id");

    const doc = await NotificationModel.findById(id);
    if (!doc) return res.status(404).send("Notification không tồn tại");

    if (!req.user?.isAdmin && String(doc.user) !== String(req.user.id)) {
      return res
        .status(UNAUTHORIZED)
        .send("Không có quyền thao tác thông báo này");
    }

    if (!doc.isRead) {
      doc.isRead = true;
      doc.readAt = new Date();
      await doc.save();
    }

    res.send(doc.toObject());
  })
);

router.put(
  "/:id/unread",
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(BAD_REQUEST).send("Invalid notification id");

    const doc = await NotificationModel.findById(id);
    if (!doc) return res.status(404).send("Notification không tồn tại");

    if (!req.user?.isAdmin && String(doc.user) !== String(req.user.id)) {
      return res
        .status(UNAUTHORIZED)
        .send("Không có quyền thao tác thông báo này");
    }

    if (doc.isRead) {
      doc.isRead = false;
      doc.readAt = undefined;
      await doc.save();
    }

    res.send(doc.toObject());
  })
);

router.post(
  "/mark-all-read",
  authMid,
  handler(async (req, res) => {
    const { before, types, channels } = req.body || {};
    const q = { isRead: false };

    if (req.user?.isAdmin && req.query.user && isValidId(req.query.user)) {
      q.user = toId(req.query.user);
    } else {
      q.user = toId(req.user.id);
    }

    if (before) q.createdAt = { $lte: new Date(before) };
    if (Array.isArray(types) && types.length)
      q.type = { $in: types.map(String) };
    if (Array.isArray(channels) && channels.length)
      q.channel = { $in: channels.map(String) };

    const result = await NotificationModel.updateMany(q, {
      $set: { isRead: true, readAt: new Date() },
    });
    res.send({
      matched: result.matchedCount ?? result.n,
      modified: result.modifiedCount ?? result.nModified,
    });
  })
);

router.delete(
  "/:id",
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id))
      return res.status(BAD_REQUEST).send("Invalid notification id");

    const doc = await NotificationModel.findById(id).lean();
    if (!doc) return res.status(404).send("Notification không tồn tại");

    if (!req.user?.isAdmin && String(doc.user) !== String(req.user.id)) {
      return res.status(UNAUTHORIZED).send("Không có quyền xoá thông báo này");
    }

    await NotificationModel.deleteOne({ _id: id });
    res.send();
  })
);

export default router;
