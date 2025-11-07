import { Router } from 'express';
import authMid from '../middlewares/auth.mid.js';
import mongoose from 'mongoose';

import { suggestChecklistAndEstimate } from '../ai/suggestTask.js';
import { analyzeTaskPriority } from '../ai/analyzePriority.js';
import { summarizeComments, summarizeActivity } from '../ai/summary.js';
import { generateTitleFromDescription } from '../ai/generateTitle.js';

import { AIInsightModel, TaskModel, ProjectModel } from '../models/index.js';

const router = Router();
const handler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
const toId = (v) => new mongoose.Types.ObjectId(String(v));
const isValidId = (id) => mongoose.isValidObjectId(id);

const KIND = {
  PRIORITY: 'priority_suggestion',
  RISK: 'risk_warning',
  TIMELINE: 'timeline_prediction',
  WORKLOAD: 'workload_balance',
};

// POST /api/ai/suggest-task  body: { title, description, taskId?, saveInsight? }
router.post(
  '/suggest-task',
  authMid,
  handler(async (req, res) => {
    const { title, description, taskId, saveInsight } = req.body || {};
    if (!title) return res.status(400).send('Missing title');

    const result = await suggestChecklistAndEstimate({ title, description });

    if (saveInsight && taskId && isValidId(taskId)) {
      const t = await TaskModel.findById(taskId).lean();
      let teamId = t?.team;
      if (!teamId && t?.project) {
        const p = await ProjectModel.findById(t.project).lean();
        teamId = p?.team;
      }
      if (teamId) {
        await AIInsightModel.create({
          team: teamId,
          task: toId(taskId),
          kind: KIND.PRIORITY,
          message: `Checklist/estimate/priority gợi ý cho task "${title}".`,
          score: undefined,
        });
      }
    }

    res.send(result);
  })
);

// POST /api/ai/analyze-priority  body: { title, description, dueDate?, currentStatus?, taskId?, saveInsight? }
router.post(
  '/analyze-priority',
  authMid,
  handler(async (req, res) => {
    const { title, description, dueDate, currentStatus, taskId, saveInsight } = req.body || {};
    if (!title) return res.status(400).send('Missing title');

    const result = await analyzeTaskPriority({ title, description, dueDate, currentStatus });

    if (saveInsight && taskId && isValidId(taskId)) {
      const t = await TaskModel.findById(taskId).lean();
      let teamId = t?.team;
      if (!teamId && t?.project) {
        const p = await ProjectModel.findById(t.project).lean();
        teamId = p?.team;
      }
      if (teamId) {
        await AIInsightModel.create({
          team: teamId,
          task: toId(taskId),
          kind: KIND.RISK,
          message: `Phân tích ưu tiên/rủi ro: priority=${result.priority}, riskScore=${result.riskScore}`,
          score: result.riskScore ?? undefined,
        });
      }
    }

    res.send(result);
  })
);

// POST /api/ai/summary  body: { comments?, activities? }
router.post(
  '/summary',
  authMid,
  handler(async (req, res) => {
    const { comments = [], activities = [] } = req.body || {};
    const out = {};
    if (comments.length) out.comments = await summarizeComments(comments);
    if (activities.length) out.activities = await summarizeActivity(activities);
    if (!comments.length && !activities.length) return res.status(400).send('Missing comments or activities');
    res.send(out);
  })
);

// POST /api/ai/generate-title  body: { description }
router.post(
  '/generate-title',
  authMid,
  handler(async (req, res) => {
    const { description } = req.body || {};
    if (!description) return res.status(400).send('Missing description');

    const result = await generateTitleFromDescription({ description });
    res.send(result);
  })
);

export default router;