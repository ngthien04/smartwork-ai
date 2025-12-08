import { Router } from 'express';
import mongoose from 'mongoose';
import authMid from '../middleware/auth.mid.js';
import { BAD_REQUEST, UNAUTHORIZED } from '../constants/httpStatus.js';
import { ChatSessionModel } from '../models/chatSession.js';

import {
  AIInsightModel,
  TaskModel,
  ProjectModel,
  UserModel,
  ActivityModel,
  LabelModel,
  TeamModel,
} from '../models/index.js';

import { chat as openaiChat } from '../ai/openai.service.js';
import { suggestChecklistAndEstimate } from '../ai/suggestTask.js';
import { analyzeTaskPriority } from '../ai/analyzePriority.js';
import { detectIntentAndTaskFull } from '../ai/taskDraft.js';

const router = Router();

const handler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const isValidId = (id) => mongoose.isValidObjectId(id);
const toId = (v) => {
  if (!v) return null;
  if (v instanceof mongoose.Types.ObjectId) return v;
  const s = String(v);
  if (!mongoose.isValidObjectId(s)) return null;
  return new mongoose.Types.ObjectId(s);
};



async function handleCreateTaskFromDraft(req, t, intentResult) {
  let replyText = '';
  let createdTask = null;

  const teamId = await resolveTeamIdSmart(req, t);
  if (!teamId) {
    const tn = t?.teamName ? ` "${t.teamName}"` : '';
    return {
      replyText: `Mình chưa xác định được team${tn} hoặc bạn chưa thuộc team này, nên chưa thể tạo task.`,
      createdTask,
      teamId: null,
      projectId: null,
    };
  }

  const projectId = await resolveProjectId({ teamId, projectName: t.projectName });

  const labelIds = await upsertLabelsByNames({
    teamId,
    projectId,
    names: t.labelNames || [],
  });

  const assigneeIdsByEmail = await resolveUsersByEmails({ emails: t.assigneeEmails || [] });
  const nameResolve = await resolveAssigneesByNamesStrict({
    names: t.assigneeNames || [],
    teamId,
  });

  // enforce strict nếu có assigneeNames
  if ((t.assigneeNames || []).length) {
    if (nameResolve.missingNames.length) {
      return {
        replyText: `Không tìm thấy người "${nameResolve.missingNames.join(
          '", "'
        )}" trong team "${t.teamName || 'được chọn'}". Bạn kiểm tra lại tên giúp mình nha.`,
        createdTask: null,
        teamId,
        projectId,
      };
    }
    if (nameResolve.ambiguous.length) {
      const lines = [];
      for (const a of nameResolve.ambiguous) {
        lines.push(`Mình thấy "${a.input}" có nhiều người trùng tên, bạn muốn giao cho ai?`);
        a.candidates.slice(0, 5).forEach((c, idx) => {
          lines.push(`- ${idx + 1}) ${c.name}${c.email ? ` (${c.email})` : ''}`);
        });
      }
      return { replyText: lines.join('\n'), createdTask: null, teamId, projectId };
    }
  }

  const assigneeIds = Array.from(
    new Set([...assigneeIdsByEmail.map(String), ...nameResolve.matched.map(String)])
  ).map(toId);

  const watcherIdsByEmail = await resolveUsersByEmails({ emails: t.watcherEmails || [] });
  const watcherNameResolve = await resolveAssigneesByNamesStrict({
    names: t.watcherNames || [],
    teamId,
  });
  const watcherIds = Array.from(
    new Set([...watcherIdsByEmail.map(String), ...watcherNameResolve.matched.map(String)])
  ).map(toId);

  const team = await TeamModel.findById(teamId, { settings: 1, name: 1 }).lean();
  const defaultStatus = team?.settings?.defaultTaskStatus || 'todo';
  const defaultPriority = team?.settings?.defaultTaskPriority || 'normal';

  const payload = {
    team: teamId,
    project: projectId || undefined,

    title: String(t.title).trim(),
    description: t.description ? String(t.description) : '',

    type: t.type || 'task',
    status: t.status || defaultStatus,
    priority: t.priority || defaultPriority,

    reporter: req.user.id,
    assignees: assigneeIds,
    watchers: watcherIds,
    labels: labelIds,

    dueDate: parseDateMaybe(t.dueDate) || undefined,
    startDate: parseDateMaybe(t.startDate) || undefined,

    estimate: typeof t.estimate === 'number' ? t.estimate : undefined,
    storyPoints: typeof t.storyPoints === 'number' ? t.storyPoints : undefined,

    checklist: Array.isArray(t.checklist)
      ? t.checklist
          .slice(0, 5)
          .map((x) => ({ content: String(x?.content || '').trim() }))
          .filter((x) => x.content)
      : [],
  };

  createdTask = await TaskModel.create(payload);

  replyText =
    intentResult?.reply ||
    `Đã tạo task "${payload.title}"` +
      `${team?.name ? ` trong team "${team.name}"` : ''}` +
      `${projectId ? ' trong project được chỉ định' : ''}.`;

  return { replyText, createdTask, teamId, projectId };
}


function escapeRegex(str = '') {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseDateMaybe(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function parsePaging(q) {
  const page = Math.max(1, Number(q.page || 1));
  const limit = Math.max(1, Math.min(100, Number(q.limit || 20)));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

async function recordActivity({ team, actor, verb, targetType, targetId, metadata }) {
  try {
    await ActivityModel.create({ team, actor, verb, targetType, targetId, metadata });
  } catch {}
}

/** =======================
 * TEAM RESOLVE (theo TeamModel.members / leaders)
 * ======================= */
async function getUserTeamIds(userId) {
  const uid = toId(userId);
  if (!uid) return [];
  const teams = await TeamModel.find(
    {
      isDeleted: false,
      $or: [{ leaders: uid }, { 'members.user': uid }],
    },
    { _id: 1 }
  ).lean();
  return teams.map((t) => t._id).filter(Boolean);
}

async function resolveTeamIdSmart(req, taskDraft) {
  const userId = req.user.id;
  const myTeamIds = await getUserTeamIds(userId);
  if (myTeamIds.length === 1) return myTeamIds[0];

  // 1) ưu tiên teamName
  const teamName = taskDraft?.teamName ? String(taskDraft.teamName).trim() : '';
  if (teamName && myTeamIds.length) {
    const safe = escapeRegex(teamName);
    const team = await TeamModel.findOne({
      _id: { $in: myTeamIds },
      isDeleted: false,
      name: new RegExp(safe, 'i'),
    }).lean();
    if (team?._id) return team._id;
  }

  // 2) suy ra từ projectName
  const projectName = taskDraft?.projectName ? String(taskDraft.projectName).trim() : '';
  if (projectName && myTeamIds.length) {
    const safe = escapeRegex(projectName);
    const proj = await ProjectModel.findOne({
      team: { $in: myTeamIds },
      name: new RegExp(safe, 'i'),
    }).lean();
    if (proj?.team) return proj.team;
  }

  return null;
}

async function resolveProjectId({ teamId, projectName }) {
  if (!teamId || !projectName) return null;
  const safe = escapeRegex(projectName);
  const proj = await ProjectModel.findOne({
    team: toId(teamId),
    name: new RegExp(safe, 'i'),
  }).lean();
  return proj?._id || null;
}

/** =======================
 * USER RESOLVE: email / name (trong team)
 * - Chống nhầm: trả { matched, missingNames, ambiguous }
 * ======================= */
async function resolveUsersByEmails({ emails = [] }) {
  const cleaned = Array.from(
    new Set(emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean))
  );
  if (!cleaned.length) return [];
  const users = await UserModel.find({ email: { $in: cleaned } }, { _id: 1 }).lean();
  return users.map((u) => u._id).filter(Boolean);
}


async function getAllowedUserIdsInTeam(teamId) {
  const tid = toId(teamId);
  if (!tid) return [];
  const team = await TeamModel.findById(tid, { members: 1, leaders: 1 }).lean();
  if (!team) return [];

  const memberIds = (team.members || []).map((m) => m.user).filter(Boolean);
  const leaderIds = (team.leaders || []).filter(Boolean);

  return Array.from(new Set([...memberIds.map(String), ...leaderIds.map(String)]))
    .map(toId)
    .filter(Boolean);
}

async function resolveAssigneesByNamesStrict({ names = [], teamId }) {
  const cleaned = Array.from(new Set(names.map((n) => String(n).trim()).filter(Boolean)));
  if (!cleaned.length) {
    return { matched: [], missingNames: [], ambiguous: [] };
  }
  if (!teamId) {
    return { matched: [], missingNames: cleaned, ambiguous: [] };
  }

  const allowedIds = await getAllowedUserIdsInTeam(teamId);
  if (!allowedIds.length) {
    return { matched: [], missingNames: cleaned, ambiguous: [] };
  }

  const matched = [];
  const missingNames = [];
  const ambiguous = [];

  for (const name of cleaned) {
    // match name trong allowedIds
    const users = await UserModel.find(
      {
        _id: { $in: allowedIds },
        name: new RegExp(escapeRegex(name), 'i'),
      },
      { _id: 1, name: 1, email: 1 }
    )
      .limit(10)
      .lean();

    if (!users.length) {
      missingNames.push(name);
      continue;
    }
    if (users.length > 1) {
      ambiguous.push({
        input: name,
        candidates: users.map((u) => ({
          id: String(u._id),
          name: u.name || '',
          email: u.email || '',
        })),
      });
      continue;
    }

    matched.push(users[0]._id);
  }

  return { matched, missingNames, ambiguous };
}

/** =======================
 * LABEL UPSERT (theo names)
 * ======================= */
async function upsertLabelsByNames({ teamId, projectId, names = [] }) {
  const safeNames = Array.from(new Set(names.map((s) => String(s).trim()).filter(Boolean)));
  if (!safeNames.length) return [];

  const found = await LabelModel.find({
    name: { $in: safeNames },
    ...(teamId ? { team: toId(teamId) } : {}),
    ...(projectId ? { project: toId(projectId) } : {}),
  }).lean();

  const foundMap = new Map(found.map((d) => [d.name.toLowerCase(), d]));
  const toCreate = safeNames.filter((n) => !foundMap.has(n.toLowerCase()));

  if (toCreate.length) {
    const docs = await LabelModel.insertMany(
      toCreate.map((name) => ({
        name,
        team: teamId ? toId(teamId) : undefined,
        project: projectId ? toId(projectId) : undefined,
        color: '#F87171',
      })),
      { ordered: false }
    );
    docs.forEach((d) => foundMap.set(d.name.toLowerCase(), d));
  }

  return safeNames
    .map((n) => foundMap.get(n.toLowerCase()))
    .filter(Boolean)
    .map((d) => d._id);
}

async function getOrCreateChatSession({ userId, teamId }) {
  const cond = {
    user: toId(userId),
    isDeleted: false,
    ...(teamId ? { team: toId(teamId) } : { team: { $exists: false } }),
  };

  let session = await ChatSessionModel.findOne(cond).sort('-updatedAt');
  if (!session) {
    session = await ChatSessionModel.create({
      user: toId(userId),
      ...(teamId ? { team: toId(teamId) } : {}),
      messages: [],
      lastMessageAt: new Date(),
    });
  }
  return session;
}

function toClientMessages(session, limit = 50) {
  return (session.messages || []).slice(-limit).map((m) => ({
    role: m.role,
    content: m.content,
    createdAt: m.createdAt,
  }));
}

// GET /ai/chat/history
router.get(
  '/chat/history',
  authMid,
  handler(async (req, res) => {
    const teamId = req.query.team && isValidId(req.query.team) ? req.query.team : null;
    const session = await getOrCreateChatSession({ userId: req.user.id, teamId });
    res.send({ messages: toClientMessages(session, 50) });
  })
);

// DELETE /ai/chat/history
router.delete(
  '/chat/history',
  authMid,
  handler(async (req, res) => {
    const teamId = req.query.team && isValidId(req.query.team) ? req.query.team : null;
    const session = await getOrCreateChatSession({ userId: req.user.id, teamId });
    session.messages = [];
    session.lastMessageAt = new Date();
    await session.save();
    res.send({ ok: true });
  })
);

// POST /ai/chat/message
router.post(
  '/chat/message',
  authMid,
  handler(async (req, res) => {
    const { content, team } = req.body || {};
    const text = String(content || '').trim();
    if (!text) return res.status(BAD_REQUEST).send('Missing content');

    const teamId = team && isValidId(team) ? team : null;
    const session = await getOrCreateChatSession({ userId: req.user.id, teamId });

    // lưu message user
    session.messages.push({ role: 'user', content: text, createdAt: new Date() });

    // Gọi lại AI: ở đây reuse luôn route cũ /ai/chat bằng cách gọi function nội bộ thì khó
    // nên đơn giản: gọi detectIntent + (nếu muốn) bạn copy block create task của bạn vào đây.
    const todayISO = new Date().toISOString().slice(0, 10);

    let intentResult = null;
    let replyText = '';

    try {
      intentResult = await detectIntentAndTaskFull({ utterance: text, todayISO });
    } catch {
      intentResult = null;
    }

    let createdTask = null;

    if (intentResult?.intent === 'create_task' && intentResult?.task?.title) {
      const t = intentResult.task;
      const out = await handleCreateTaskFromDraft(req, t, intentResult);
      replyText = out.replyText;
      createdTask = out.createdTask;
    }

    // fallback chat (chỉ khi KHÔNG tạo task)
    if (!replyText) {
      replyText =
        intentResult?.reply ||
        (await openaiChat({
          system:
            'You are a helpful assistant inside a task management app. Hãy trả lời ngắn gọn, thân thiện, ưu tiên tiếng Việt nếu người dùng dùng tiếng Việt.',
          user: text,
          model: 'gpt-4o-mini',
        }));
    }

    // lưu assistant
    session.messages.push({
      role: 'assistant',
      content: replyText,
      createdAt: new Date(),
      meta: {
        intent: intentResult?.intent || null,
        createdTaskId: createdTask?._id || null,
        taskDraft: intentResult?.task || null,
      },
    });

    session.lastMessageAt = new Date();
    await session.save();

    res.send({
      reply: replyText,
      meta: {
        intent: intentResult?.intent || null,
        createdTaskId: createdTask?._id || null,
        taskDraft: intentResult?.task || null,
      },
      messages: toClientMessages(session, 50),
    });
  })
);


/** =========================
 * POST /ai/chat
 * ========================= */
router.post(
  '/chat',
  authMid,
  handler(async (req, res) => {
    const { messages, prompt, system } = req.body || {};

    let userContent = '';
    if (Array.isArray(messages) && messages.length) {
      const lastUser = [...messages].reverse().find((m) => m.role === 'user');
      userContent = lastUser?.content || messages[messages.length - 1].content || '';
    } else if (prompt) {
      userContent = String(prompt);
    }

    if (!userContent.trim()) return res.status(BAD_REQUEST).send('Missing user message');

    const todayISO = new Date().toISOString().slice(0, 10);

    let intentResult = null;
    let createdTask = null;
    let replyText = '';

    try {
      intentResult = await detectIntentAndTaskFull({ utterance: userContent, todayISO });
    } catch (err) {
      console.error('detectIntentAndTaskFull error:', err);
      intentResult = null;
    }

    if (intentResult?.intent === 'create_task' && intentResult?.task?.title) {
      const t = intentResult.task;

      // 1) Resolve team
      const teamId = await resolveTeamIdSmart(req, t);
      if (!teamId) {
        const tn = t?.teamName ? ` "${t.teamName}"` : '';
        replyText = `Mình chưa xác định được team${tn} hoặc bạn chưa thuộc team này, nên chưa thể tạo task.`;
      } else {
        // 2) Resolve project (trong team)
        const projectId = await resolveProjectId({ teamId, projectName: t.projectName });

        // 3) Resolve labels
        const labelIds = await upsertLabelsByNames({
          teamId,
          projectId,
          names: t.labelNames || [],
        });

        // 4) Resolve assignees (email + name strict)
        const assigneeIdsByEmail = await resolveUsersByEmails({ emails: t.assigneeEmails || [] });
        const nameResolve = await resolveAssigneesByNamesStrict({
          names: t.assigneeNames || [],
          teamId,
        });

        // Nếu user có chỉ định assignee theo tên => enforce strict
        if ((t.assigneeNames || []).length) {
          if (nameResolve.missingNames.length) {
            replyText = `Không tìm thấy người "${nameResolve.missingNames.join(
              '", "'
            )}" trong team "${t.teamName || 'được chọn'}". Bạn kiểm tra lại tên giúp mình nha.`;
          } else if (nameResolve.ambiguous.length) {
            const lines = [];
            for (const a of nameResolve.ambiguous) {
              lines.push(`Mình thấy "${a.input}" có nhiều người trùng tên, bạn muốn giao cho ai?`);
              a.candidates.slice(0, 5).forEach((c, idx) => {
                lines.push(`- ${idx + 1}) ${c.name}${c.email ? ` (${c.email})` : ''}`);
              });
            }
            replyText = lines.join('\n');
          }
        }

        // Nếu chưa có replyText nghĩa là assignee OK (hoặc user không chỉ định assigneeNames)
        if (!replyText) {
          const assigneeIds = Array.from(
            new Set([
              ...assigneeIdsByEmail.map(String),
              ...nameResolve.matched.map(String),
            ])
          ).map(toId);

          // watchers (optional): xử lý giống assignee nhưng không enforce strict
          const watcherIdsByEmail = await resolveUsersByEmails({ emails: t.watcherEmails || [] });
          const watcherNameResolve = await resolveAssigneesByNamesStrict({
            names: t.watcherNames || [],
            teamId,
          });

          const watcherIds = Array.from(
            new Set([
              ...watcherIdsByEmail.map(String),
              ...watcherNameResolve.matched.map(String),
            ])
          ).map(toId);

          // defaults từ team settings (bonus)
          const team = await TeamModel.findById(teamId, { settings: 1, name: 1 }).lean();
          const defaultStatus = team?.settings?.defaultTaskStatus || 'todo';
          const defaultPriority = team?.settings?.defaultTaskPriority || 'normal';

          const payload = {
            team: teamId,
            project: projectId || undefined,

            title: String(t.title).trim(),
            description: t.description ? String(t.description) : '',

            type: t.type || 'task',
            status: t.status || defaultStatus,
            priority: t.priority || defaultPriority,

            reporter: req.user.id,
            assignees: assigneeIds,
            watchers: watcherIds,
            labels: labelIds,

            dueDate: parseDateMaybe(t.dueDate) || undefined,
            startDate: parseDateMaybe(t.startDate) || undefined,

            estimate: typeof t.estimate === 'number' ? t.estimate : undefined,
            storyPoints: typeof t.storyPoints === 'number' ? t.storyPoints : undefined,

            checklist: Array.isArray(t.checklist)
              ? t.checklist
                  .slice(0, 5)
                  .map((x) => ({ content: String(x?.content || '').trim() }))
                  .filter((x) => x.content)
              : [],
          };

          createdTask = await TaskModel.create(payload);

          replyText =
            intentResult.reply ||
            `Đã tạo task "${payload.title}"` +
              `${team?.name ? ` trong team "${team.name}"` : ''}` +
              `${projectId ? ' trong project được chỉ định' : ''}.`;
        }
      }
    }

    // fallback chat
    if (!replyText) {
      replyText =
        intentResult?.reply ||
        (await openaiChat({
          system:
            system ||
            'You are a helpful assistant inside a task management app. Hãy trả lời ngắn gọn, thân thiện, ưu tiên tiếng Việt nếu người dùng dùng tiếng Việt.',
          user: userContent,
          model: 'gpt-4o-mini',
        }));
    }

    res.send({
      message: replyText,
      meta: {
        intent: intentResult?.intent || null,
        createdTaskId: createdTask?._id || null,
        taskDraft: intentResult?.task || null,
      },
    });
  })
);

/** =========================
 * POST /ai/plan
 * ========================= */
router.post(
  '/plan',
  authMid,
  handler(async (req, res) => {
    const { goal, constraints = {} } = req.body || {};
    if (!goal || !String(goal).trim()) return res.status(BAD_REQUEST).send('Thiếu goal để lập kế hoạch');

    const baseTitle = 'Kế hoạch: ' + String(goal).slice(0, 50);
    const ai = await suggestChecklistAndEstimate({ title: baseTitle, description: goal });

    const tasks = (ai.checklist || []).map((item, idx) => ({
      title: item.content || `Sub-task #${idx + 1}`,
      description: ai.notes || goal,
      priority: ai.priority || 'normal',
      estimateHours: ai.estimateHours || 2,
      order: idx,
    }));

    res.send({ goal, constraints, tasks });
  })
);

/** =========================
 * POST /ai/tasks/:taskId/priority
 * ========================= */
router.post(
  '/tasks/:taskId/priority',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    if (!isValidId(taskId)) return res.status(BAD_REQUEST).send('TaskId không hợp lệ');

    const task = await TaskModel.findById(taskId).populate('team').lean();
    if (!task) return res.status(404).send('Task không tồn tại');

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

    res.send({ analysis, insight: { ...insight.toObject(), id: insight._id } });
  })
);

/** =========================
 * INSIGHTS: /ai/insights/*
 * ========================= */

async function userHasAnyRoleInTeam(userId, teamId) {
  if (!teamId) return false;

  const team = await TeamModel.findOne({
    _id: toId(teamId),
    isDeleted: false,
    $or: [{ leaders: toId(userId) }, { 'members.user': toId(userId) }],
  }).lean();

  return !!team;
}

async function userCanManageTeam(userId, teamId) {
  if (!teamId) return false;

  const team = await TeamModel.findOne({
    _id: toId(teamId),
    isDeleted: false,
    $or: [
      { leaders: toId(userId) },
      { members: { $elemMatch: { user: toId(userId), role: { $in: ['leader', 'admin'] } } } },
    ],
  }).lean();

  return !!team;
}

async function canViewInsight(user, doc) {
  if (user?.isAdmin) return true;
  return userHasAnyRoleInTeam(user.id, doc.team);
}
async function canManageInsight(user, doc) {
  if (user?.isAdmin) return true;
  return userCanManageTeam(user.id, doc.team);
}

function buildQuery(qs) {
  const q = {};
  if (qs.team && isValidId(qs.team)) q.team = toId(qs.team);
  if (qs.task && isValidId(qs.task)) q.task = toId(qs.task);
  if (qs.kind) q.kind = String(qs.kind);

  if (qs.status) {
    switch (qs.status) {
      case 'pending':
        q.acceptedAt = { $exists: false };
        q.dismissedAt = { $exists: false };
        break;
      case 'accepted':
        q.acceptedAt = { $exists: true };
        break;
      case 'dismissed':
        q.dismissedAt = { $exists: true };
        break;
    }
  }

  if (qs.from || qs.to) {
    q.createdAt = {};
    if (qs.from) q.createdAt.$gte = new Date(qs.from);
    if (qs.to) q.createdAt.$lte = new Date(qs.to);
  }

  if (qs.scoreMin != null || qs.scoreMax != null) {
    q.score = {};
    if (qs.scoreMin != null) q.score.$gte = Number(qs.scoreMin);
    if (qs.scoreMax != null) q.score.$lte = Number(qs.scoreMax);
  }

  return q;
}

router.get(
  '/insights',
  authMid,
  handler(async (req, res) => {
    const { page, limit, skip } = parsePaging(req.query);
    const q = buildQuery(req.query);
    const populate = req.query.populate === '1' || req.query.populate === 'true';

    if (!req.user?.isAdmin && !q.team) {
      const myTeamIds = await getUserTeamIds(req.user.id);
      if (!myTeamIds.length) return res.send({ page, limit, total: 0, items: [] });
      q.team = { $in: myTeamIds.map(toId) };
    }

    const cur = AIInsightModel.find(q).sort('-createdAt').skip(skip).limit(limit);
    if (populate) {
      cur
        .populate('task', 'title status project team priority dueDate labels')
        .populate('acceptedBy', 'name email avatarUrl')
        .populate('dismissedBy', 'name email avatarUrl');
    }

    const [items, total] = await Promise.all([cur.lean(), AIInsightModel.countDocuments(q)]);
    res.send({ page, limit, total, items });
  })
);

router.get(
  '/insights/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid insight id');

    const doc = await AIInsightModel.findById(id)
      .populate('task', 'title status project team priority dueDate labels')
      .populate('acceptedBy', 'name email avatarUrl')
      .populate('dismissedBy', 'name email avatarUrl')
      .lean();

    if (!doc) return res.status(404).send('Insight không tồn tại');
    if (!(await canViewInsight(req.user, doc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền xem insight này');
    }

    res.send(doc);
  })
);

router.post(
  '/insights',
  authMid,
  handler(async (req, res) => {
    const { team, task, kind, message, score } = req.body || {};
    if (!kind) return res.status(BAD_REQUEST).send('Missing kind');
    if (!message) return res.status(BAD_REQUEST).send('Missing message');

    let teamId = team && isValidId(team) ? toId(team) : null;

    if (task) {
      if (!isValidId(task)) return res.status(BAD_REQUEST).send('Invalid task id');
      const t = await TaskModel.findById(task).lean();
      if (!t || t.isDeleted) return res.status(404).send('Task không tồn tại');
      teamId = t.team || teamId;
      if (!teamId && t.project) {
        const proj = await ProjectModel.findById(t.project).lean();
        teamId = proj?.team || teamId;
      }
    }

    if (!teamId) return res.status(BAD_REQUEST).send('Không xác định được team cho insight');

    const can = req.user?.isAdmin || (await userHasAnyRoleInTeam(req.user.id, teamId));
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền tạo insight cho team này');

    const doc = await AIInsightModel.create({
      team: teamId,
      task: task ? toId(task) : undefined,
      kind,
      message,
      score: score != null ? Number(score) : undefined,
    });

    await recordActivity({
      team: teamId,
      actor: req.user.id,
      verb: 'ai_insight_created',
      targetType: doc.task ? 'task' : 'team',
      targetId: doc.task || teamId,
      metadata: { insightId: doc._id, kind },
    });

    const populated = await AIInsightModel.findById(doc._id)
      .populate('task', 'title status project team priority dueDate labels')
      .lean();

    res.status(201).send(populated);
  })
);

async function buildExplicitPatch(apply) {
  if (!apply) return null;
  const out = {};

  if (apply.priority && ['low', 'normal', 'high', 'urgent'].includes(apply.priority)) {
    out.priority = apply.priority;
  }
  if (apply.dueDate) {
    const d = new Date(apply.dueDate);
    if (!isNaN(d)) out.dueDate = d;
  }
  if (Array.isArray(apply.labelIds) && apply.labelIds.length) {
    out.labelIds = apply.labelIds.filter(mongoose.isValidObjectId).map(String);
  }
  if (Array.isArray(apply.labelNames) && apply.labelNames.length) {
    out.labelNames = apply.labelNames.map((s) => String(s).trim()).filter(Boolean);
  }
  return Object.keys(out).length ? out : null;
}

async function buildAutoPatchFromInsight(insight) {
  const { kind, message = '' } = insight;
  const out = {};

  if (kind === 'priority_suggestion') {
    const m = /priority\s*=\s*(low|normal|high|urgent)/i.exec(message);
    if (m) out.priority = m[1].toLowerCase();
  }

  if (kind === 'risk_warning') {
    out.labelNames = [...(out.labelNames || []), 'risk'];
  }

  if (kind === 'timeline_prediction') {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(message);
    if (m) out.dueDate = m[1];
  }

  if (kind === 'workload_balance') {
    out.labelNames = [...(out.labelNames || []), 'workload'];
  }

  return Object.keys(out).length ? out : null;
}

router.post(
  '/insights/:id/accept',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid insight id');

    const insight = await AIInsightModel.findById(id);
    if (!insight) return res.status(404).send('Insight không tồn tại');

    if (!(await canManageInsight(req.user, insight))) {
      return res.status(UNAUTHORIZED).send('Không có quyền accept insight này');
    }

    insight.acceptedBy = toId(req.user.id);
    insight.acceptedAt = new Date();
    await insight.save();

    let appliedPatch = null;
    let updatedTask = null;

    if (insight.task) {
      const task = await TaskModel.findById(insight.task).lean();
      if (!task) return res.status(404).send('Task không tồn tại');

      const explicit = await buildExplicitPatch(req.body?.apply);
      const auto = explicit || (await buildAutoPatchFromInsight(insight));

      if (auto && Object.keys(auto).length) {
        if (auto.labelNames?.length) {
          const labelIds = await upsertLabelsByNames({
            teamId: insight.team,
            projectId: task.project || null,
            names: auto.labelNames,
          });
          auto.labelIds = [...new Set([...(auto.labelIds || []), ...labelIds.map(String)])];
          delete auto.labelNames;
        }

        const update = {};
        const metadata = {};

        if (auto.priority) {
          update.priority = auto.priority;
          metadata.priority = auto.priority;
        }
        if (auto.dueDate) {
          update.dueDate = new Date(auto.dueDate);
          metadata.dueDate = update.dueDate;
        }
        if (auto.labelIds?.length) {
          const current = (task.labels || []).map(String);
          const merged = Array.from(new Set([...current, ...auto.labelIds.map(String)])).map(toId);
          update.labels = merged;
          metadata.labelIds = merged.map(String);
        }

        if (Object.keys(update).length) {
          updatedTask = await TaskModel.findByIdAndUpdate(
            task._id,
            { $set: update },
            { new: true }
          ).lean();
          appliedPatch = metadata;

          await recordActivity({
            team: insight.team,
            actor: req.user.id,
            verb: 'ai_insight_applied',
            targetType: 'task',
            targetId: task._id,
            metadata: { insightId: insight._id, ...metadata },
          });
        }
      }
    }

    await recordActivity({
      team: insight.team,
      actor: req.user.id,
      verb: 'ai_insight_accepted',
      targetType: insight.task ? 'task' : 'team',
      targetId: insight.task || insight.team,
      metadata: { insightId: insight._id, applied: !!appliedPatch },
    });

    const populated = await AIInsightModel.findById(insight._id)
      .populate('acceptedBy', 'name email avatarUrl')
      .populate('task', 'title status project team priority dueDate labels')
      .lean();

    res.send({ insight: populated, appliedPatch, task: updatedTask || null });
  })
);

router.post(
  '/insights/:id/dismiss',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid insight id');

    const doc = await AIInsightModel.findById(id);
    if (!doc) return res.status(404).send('Insight không tồn tại');

    if (!(await canManageInsight(req.user, doc))) {
      return res.status(UNAUTHORIZED).send('Không có quyền dismiss insight này');
    }

    doc.dismissedBy = toId(req.user.id);
    doc.dismissedAt = new Date();
    await doc.save();

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'ai_insight_dismissed',
      targetType: doc.task ? 'task' : 'team',
      targetId: doc.task || doc.team,
      metadata: { insightId: doc._id },
    });

    const populated = await AIInsightModel.findById(doc._id)
      .populate('dismissedBy', 'name email avatarUrl')
      .populate('task', 'title status project team priority dueDate labels')
      .lean();

    res.send(populated);
  })
);

router.delete(
  '/insights/:id',
  authMid,
  handler(async (req, res) => {
    const { id } = req.params;
    if (!isValidId(id)) return res.status(BAD_REQUEST).send('Invalid insight id');

    const doc = await AIInsightModel.findById(id).lean();
    if (!doc) return res.status(404).send('Insight không tồn tại');

    const can = await canManageInsight(req.user, doc);
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền xoá insight này');

    await AIInsightModel.deleteOne({ _id: id });

    await recordActivity({
      team: doc.team,
      actor: req.user.id,
      verb: 'ai_insight_deleted',
      targetType: doc.task ? 'task' : 'team',
      targetId: doc.task || doc.team,
      metadata: { insightId: id },
    });

    res.send();
  })
);

// GET /ai/status?team=...&project=...&limit=5
router.get(
  '/status',
  authMid,
  handler(async (req, res) => {
    const limit = Math.max(1, Math.min(10, Number(req.query.limit || 5)));

    // optional filters
    const teamId =
      req.query.team && isValidId(req.query.team) ? toId(req.query.team) : null;
    const projectId =
      req.query.project && isValidId(req.query.project) ? toId(req.query.project) : null;

    // nếu FE chưa truyền team => lấy theo các team user thuộc về
    let teamIds = [];
    if (!teamId) {
      teamIds = await getUserTeamIds(req.user.id);
      if (!teamIds.length) return res.send({ items: [] });
    }

    const now = new Date();

    const base = {
      isDeleted: false,
      ...(teamId ? { team: teamId } : { team: { $in: teamIds } }),
      ...(projectId ? { project: projectId } : {}),
    };

    // chạy song song cho nhanh
    const [overdueCount, urgentCount, blockedCount, unassignedCount, workload] =
      await Promise.all([
        // 1) overdue tasks
        TaskModel.countDocuments({
          ...base,
          dueDate: { $exists: true, $lt: now },
          status: { $nin: ['done'] },
        }),

        // 2) urgent + not done
        TaskModel.countDocuments({
          ...base,
          priority: 'urgent',
          status: { $nin: ['done'] },
        }),

        // 3) blocked
        TaskModel.countDocuments({
          ...base,
          status: 'blocked',
        }),

        // 4) unassigned
        TaskModel.countDocuments({
          ...base,
          $or: [{ assignees: { $exists: false } }, { assignees: { $size: 0 } }],
          status: { $nin: ['done'] },
        }),

        // 5) top overloaded assignee (đang làm nhiều nhất)
        TaskModel.aggregate([
          { $match: { ...base, status: { $in: ['todo', 'in_progress', 'review', 'blocked'] } } },
          { $unwind: { path: '$assignees', preserveNullAndEmptyArrays: false } },
          { $group: { _id: '$assignees', count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 1 },
        ]),
      ]);

    // overloaded: nếu >=8 tasks thì báo
    let overloadedItem = null;
    if (Array.isArray(workload) && workload.length) {
      const top = workload[0];
      const count = Number(top?.count || 0);

      if (count >= 8 && isValidId(top?._id)) {
        const user = await UserModel.findById(top._id, { name: 1, email: 1 }).lean();
        const name = user?.name || user?.email || 'một thành viên';

        overloadedItem = {
          key: 'overloaded', // FE có thể click để lọc theo userId nếu bạn muốn
          count,
          text: `${name} đang được giao ${count} task đang mở — cân nhắc chia bớt.`,
          meta: { userId: String(top._id) }, // optional
        };
      }
    }

    // Build items
    const items = [];

    if (overdueCount > 0)
      items.push({
        key: 'overdue',
        count: overdueCount,
        text: `Có ${overdueCount} task quá hạn — ưu tiên xử lý hoặc dời deadline.`,
      });

    if (urgentCount > 0)
      items.push({
        key: 'urgent',
        count: urgentCount,
        text: `Có ${urgentCount} task priority "urgent" chưa xong — kiểm tra blockers.`,
      });

    if (blockedCount > 0)
      items.push({
        key: 'blocked',
        count: blockedCount,
        text: `Có ${blockedCount} task đang "blocked" — cần gỡ vướng sớm.`,
      });

    if (unassignedCount > 0)
      items.push({
        key: 'unassigned',
        count: unassignedCount,
        text: `Có ${unassignedCount} task chưa có assignee — nên phân công để tránh trôi.`,
      });

    if (overloadedItem) items.push(overloadedItem);

    // fallback
    if (!items.length) {
      items.push({
        key: 'ok',
        count: 0,
        text: 'Mọi thứ ổn — chưa thấy rủi ro nổi bật hôm nay.',
      });
    }

    res.send({ items: items.slice(0, limit) });
  })
);

export default router;