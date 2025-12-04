import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST } from '../constants/httpStatus.js';

import { suggestChecklistAndEstimate, detectIntentAndTask } from '../ai/suggestTask.js';
import { analyzeTaskPriority } from '../ai/analyzePriority.js';
import { AIInsightModel } from '../models/aiInsight.js';
import { TaskModel } from '../models/task.js';
import { ProjectModel } from '../models/project.js';
import { chat as openaiChat } from '../ai/openai.service.js';
import {UserModel} from '../models/index.js';

const router = Router();

const handler =
  (fn) =>
  (req, res, next) =>
    Promise.resolve(fn(req, res, next)).catch(next);


function escapeRegex(str = '') {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

router.post(
  '/chat',
  authMid,
  handler(async (req, res) => {
    const { messages, prompt, system } = req.body || {};

    let userContent = '';
    if (Array.isArray(messages) && messages.length) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      userContent =
        lastUser?.content || messages[messages.length - 1].content || '';
    } else if (prompt) {
      userContent = String(prompt);
    }

    if (!userContent.trim()) {
      return res.status(BAD_REQUEST).send('Missing user message');
    }

    let intentResult = null;
    let createdTask = null;
    let replyText = '';

    try {
      intentResult = await detectIntentAndTask({ utterance: userContent });
    } catch (err) {
      console.error('detectIntentAndTask error:', err);
      intentResult = null;
    }

    if (
      intentResult &&
      intentResult.intent === 'create_task' &&
      intentResult.task &&
      intentResult.task.title
    ) {
      const t = intentResult.task;

      const me = await UserModel.findById(req.user.id, { roles: 1 }).lean();
      let teamId =
        me?.roles?.length && me.roles[0].team ? me.roles[0].team : null;

      let projectId = null;
      if (t.projectName) {
        const safe = String(t.projectName).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const cond = { name: new RegExp(safe, 'i') };
        if (teamId) cond.team = teamId;

        const proj = await ProjectModel.findOne(cond).lean();
        if (proj) {
          projectId = proj._id;
          if (!teamId && proj.team) teamId = proj.team;
        }
      }

      if (!teamId) {
        console.warn('Không xác định được teamId, bỏ qua việc tạo task.');
      } else {
        const payload = {
          team: teamId,
          project: projectId || undefined,
          title: t.title,
          description: t.description || '',
          priority: t.priority || 'normal',
          status: 'todo',
        };

        if (t.dueDate) {
          const d = new Date(t.dueDate);
          if (!isNaN(d)) {
            payload.dueDate = d;
          }
        }

        createdTask = await TaskModel.create(payload);

        replyText =
          intentResult.reply ||
          `Đã tạo task "${payload.title}"${projectId ? ' trong project được chỉ định' : ''}.`;
      }
      console.log('intentResult =', intentResult);
    }

    if (!replyText) {
      if (intentResult?.reply) {
        replyText = intentResult.reply;
      } else {
        replyText = await openaiChat({
          system:
            system ||
            'You are a helpful assistant inside a task management app. Hãy trả lời ngắn gọn, thân thiện, ưu tiên tiếng Việt nếu người dùng dùng tiếng Việt.',
          user: userContent,
          model: 'gpt-4o-mini',
        });
      }
    }

    res.send({
      message: replyText,
      meta: {
        intent: intentResult?.intent || null,
        createdTaskId: createdTask?._id || null,
        taskDraft: intentResult?.task || null,
      },
    });
  }),
);


router.post(
  '/plan',
  authMid,
  handler(async (req, res) => {
    const { goal, constraints = {} } = req.body || {};
    if (!goal || !String(goal).trim()) {
      return res.status(BAD_REQUEST).send('Thiếu goal để lập kế hoạch');
    }

    const baseTitle = 'Kế hoạch: ' + String(goal).slice(0, 50);

    const ai = await suggestChecklistAndEstimate({
      title: baseTitle,
      description: goal,
    });

    const tasks = (ai.checklist || []).map((item, idx) => ({
      title: item.content || `Sub-task #${idx + 1}`,
      description: ai.notes || goal,
      priority: ai.priority || 'normal',
      estimateHours: ai.estimateHours || 2,
      order: idx,
    }));

    res.send({ goal, constraints, tasks });
  }),
);

router.post(
  '/tasks/:taskId/priority',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;

    if (!mongoose.isValidObjectId(taskId)) {
      return res.status(BAD_REQUEST).send('TaskId không hợp lệ');
    }

    const task = await TaskModel.findById(taskId)
      .populate('team')
      .lean();

    if (!task) {
      return res.status(404).send('Task không tồn tại');
    }

    const analysis = await analyzeTaskPriority({
      title: task.title,
      description: task.description || '',
      dueDate: task.dueDate,
      currentStatus: task.status,
    });

    const messageLines = [
      `priority = ${analysis.priority}`,
      `riskScore = ${analysis.riskScore}`,
      '',
      'Lý do:',
      ...(analysis.reasons || []).map((r) => `- ${r}`),
    ];

    const insight = await AIInsightModel.create({
      team: task.team,
      task: task._id,
      kind: 'priority_suggestion',
      message: messageLines.join('\n'),
      score: analysis.riskScore,
    });

    const plain = insight.toObject();
    plain.id = plain._id;

    res.send({ analysis, insight: plain });
  }),
);

export default router;