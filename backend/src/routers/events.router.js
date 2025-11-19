// src/routers/events.router.js
import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { TaskModel } from '../models/task.js';

const router = Router();
const handler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const toId = (v) => new mongoose.Types.ObjectId(String(v));

router.get(
  '/',
  authMid,
  handler(async (req, res) => {
    const { from, to, team, project } = req.query;

    const match = { isDeleted: { $ne: true } };
    if (from || to) {
      match.dueDate = {};
      if (from) match.dueDate.$gte = new Date(from);
      if (to) match.dueDate.$lte = new Date(to);
    }
    if (team) match.team = toId(team);
    if (project) match.project = toId(project);

    const tasks = await TaskModel.find(match)
      .select('title dueDate project team')
      .lean();

    // Tạm trả về kiểu "events = tasks"
    const events = tasks.map((t) => ({
      id: t._id,
      title: t.title,
      date: t.dueDate,
      project: t.project,
      team: t.team,
    }));

    res.send({ items: events });
  })
);

export default router;