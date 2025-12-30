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

import { triageBuglist } from '../ai/triageBugList.js';
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

async function userHasAnyRoleInTeam(userId, teamId) {
  if (!teamId) return false;
  const ok = await UserModel.exists({
    _id: userId,
    roles: { $elemMatch: { team: toId(teamId) } },
  });
  return !!ok;
}

function isStale(createdAt, days = 3) {
  if (!createdAt) return true;
  const ms = Date.now() - new Date(createdAt).getTime();
  return ms > days * 24 * 60 * 60 * 1000;
}

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

// POST /ai/tasks/:taskId/priority
router.post(
  '/tasks/:taskId/priority',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    if (!isValidId(taskId)) return res.status(400).send('Invalid taskId');

    const task = await TaskModel.findById(taskId).lean();
    if (!task) return res.status(404).send('Task không tồn tại');

    const latestInsight = await AIInsightModel.findOne({ task: task._id, kind:'priority_suggestion', dismissedAt: { $exists:false } })
      .sort({ createdAt: -1 })
      .lean();

    if (latestInsight) {
      const analysis =
        latestInsight.metadata?.analysis ||
        parseAnalysisFromLegacyMessage(latestInsight.message);

      return res.send({
        cached: true,
        insight: latestInsight,
        analysis,
      });
    }

    // 3️⃣ Chưa có → gọi AI
    const analysis = await analyzeTaskPriority({
      title: task.title,
      description: task.description,
      dueDate: task.dueDate,
      currentStatus: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      assigneeCount: task.assignees?.length || 0,
      labelNames: [],
    });

    const insight = await AIInsightModel.create({
      team: task.team,
      task: task._id,
      kind: 'priority_suggestion',

      message: [
        `priority = ${analysis.priority}`,
        `riskScore = ${analysis.riskScore}`,
        `confidence = ${analysis.confidence}`,
        '',
        'Lý do:',
        ...(analysis.reasons || []).map((r) => `- ${r}`),
        '',
        'Gợi ý hành động:',
        ...(analysis.recommendedActions || []).map((a) => `- ${a}`),
      ].join('\n'),

      score: analysis.riskScore,

      metadata: {
        analysis,
        source: 'analyzeTaskPriority',
      },
    });

    res.send({
      cached: false,
      insight,
      analysis,
    });
  })
);

router.get(
  '/tasks/:taskId/priority/latest',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    if (!isValidId(taskId)) return res.status(BAD_REQUEST).send('TaskId không hợp lệ');

    const task = await TaskModel.findById(taskId, { team: 1 }).lean();
    if (!task) return res.status(404).send('Task không tồn tại');

    const can = req.user?.isAdmin || (await userHasAnyRoleInTeam(req.user.id, task.team));
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền');

    const latest = await AIInsightModel.findOne({
      task: toId(taskId),
      kind: 'priority_suggestion',
      isDeleted: { $ne: true },
    })
      .sort('-createdAt')
      .lean();

    res.send({ insight: latest || null });
  })
);

// POST /ai/tasks/:taskId/priority/analyze
// body: { force?: boolean }
router.post(
  '/tasks/:taskId/priority/analyze',
  authMid,
  handler(async (req, res) => {
    const { taskId } = req.params;
    if (!isValidId(taskId)) return res.status(BAD_REQUEST).send('TaskId không hợp lệ');

    const force = Boolean(req.body?.force);

    const task = await TaskModel.findById(taskId)
      .populate('team')
      .populate('labels') // để lấy labelNames
      .lean();

    if (!task) return res.status(404).send('Task không tồn tại');

    // quyền: user phải thuộc team task
    const can = req.user?.isAdmin || (await userHasAnyRoleInTeam(req.user.id, task.team?._id || task.team));
    if (!can) return res.status(UNAUTHORIZED).send('Không có quyền');

    const teamId = task.team?._id || task.team;

    // lấy insight mới nhất để cache
    const latest = await AIInsightModel.findOne({
      task: toId(taskId),
      kind: 'priority_suggestion',
      isDeleted: { $ne: true },
    })
      .sort('-createdAt')
      .lean();

    // nếu không force và latest còn mới -> trả lại
    if (!force && latest && !isStale(latest.createdAt, 3)) {
      return res.send({ analysis: latest?.metadata?.analysis || null, insight: { ...latest, id: latest._id }, reused: true });
    }

    // build input cho AI (dựa vào schema bạn đã có)
    const labelNames = Array.isArray(task.labels)
      ? task.labels.map((lb) => lb?.name).filter(Boolean)
      : [];

    const analysis = await analyzeTaskPriority({
      title: task.title,
      description: task.description || '',
      dueDate: task.dueDate,
      currentStatus: task.status,
      createdAt: task.createdAt,
      updatedAt: task.updatedAt,
      assigneeCount: Array.isArray(task.assignees) ? task.assignees.length : 0,
      labelNames,
    });

    const suggestPatch = {};
    if (analysis?.priority) suggestPatch.priority = analysis.priority;

    const suggestLabelNames = [];
    if (typeof analysis?.riskScore === 'number' && analysis.riskScore >= 0.75) {
      suggestLabelNames.push('risk');
    }

    const messageLines = [
      `priority = ${analysis.priority}`,
      `riskScore = ${analysis.riskScore}`,
      '',
      'Lý do:',
      ...(analysis.reasons || []).map((r) => `- ${r}`),
    ];

    const insight = await AIInsightModel.create({
      team: teamId,
      task: task._id,
      kind: 'priority_suggestion',
      message: messageLines.join('\n'),
      score: analysis.riskScore,
      metadata: {
        suggestPatch,
        suggestLabelNames,
        analysis,
        source: 'analyzeTaskPriority',
      },
    });

    res.send({
      analysis,
      insight: { ...insight.toObject(), id: insight._id },
      reused: false,
    });
  })
);

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

router.post(
  '/triage/bugs',
  authMid,
  handler(async (req, res) => {
    const buglist = String(req.body?.buglist || '').trim();
    if (!buglist) return res.status(BAD_REQUEST).send('Thiếu buglist');

    const context = req.body?.context || {};

    const out = await triageBuglist({
      buglist,
      // nếu bạn muốn dùng context trong prompt thì sửa triageBuglist để nhận context
      // hoặc map sang teamName/productArea/releaseDate ở đây
      teamName: context?.teamName,
      productArea: context?.productArea,
      releaseDate: context?.releaseDate,
    });

    // ---- normalize items ----
    const items = Array.isArray(out?.items) ? out.items : [];
    const safeItems = items.map((it, idx) => ({
      title: String(it?.title || '').trim(),
      description: it?.description ? String(it.description) : '',
      severity: ['S1', 'S2', 'S3', 'S4'].includes(it?.severity) ? it.severity : 'S4',
      priority: ['urgent', 'high', 'normal', 'low'].includes(it?.priority) ? it.priority : 'normal',
      order: Number.isFinite(Number(it?.order)) ? Number(it.order) : idx + 1,
      confidence: Math.max(0, Math.min(1, Number(it?.confidence ?? 0))),
      rationale: Array.isArray(it?.rationale) ? it.rationale.map(String).slice(0, 6) : [],
      suggestedLabels: Array.isArray(it?.suggestedLabels) ? it.suggestedLabels.map(String).slice(0, 10) : [],
    }));

    // ---- compute summary from items (source of truth) ----
    const bySeverity = { S1: 0, S2: 0, S3: 0, S4: 0 };
    const byPriority = { urgent: 0, high: 0, normal: 0, low: 0 };

    for (const it of safeItems) {
      bySeverity[it.severity] += 1;
      byPriority[it.priority] += 1;
    }

    // topRisks: ưu tiên item severity cao + confidence cao
    const topRisks = safeItems
      .slice()
      .sort((a, b) => {
        const sevRank = { S1: 4, S2: 3, S3: 2, S4: 1 };
        const pa = sevRank[a.severity] || 1;
        const pb = sevRank[b.severity] || 1;
        if (pb !== pa) return pb - pa;
        return (b.confidence || 0) - (a.confidence || 0);
      })
      .slice(0, 5)
      .map((it) => `${it.severity}/${it.priority}: ${it.title}`);

    res.send({
      summary: {
        total: safeItems.length,
        bySeverity,
        byPriority,
        topRisks,
      },
      items: safeItems,
    });
  })
);
export default router;