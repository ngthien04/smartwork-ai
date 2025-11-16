import { Router } from 'express';

import sprintRouter from './sprint.router.js';
import subtaskRouter from './subtask.router.js';
import reminderRouter from './reminder.router.js';
import webhookRouter from './webhook.router.js';
import teamRouter from './team.router.js';
import labelRouter from './label.router.js';
import projectRouter from './project.router.js';
import taskRouter from './tasks.router.js';
import userRouter from './users.router.js';
import commentRouter from './comment.router.js';
import inviteRouter from './invite.router.js';
import aiInsightRouter from './aiInsight.router.js';
import integrationRouter from './integration.router.js';
import attachmentRouter from './attachment.router.js';
import activityRouter from './activity.router.js';
import aiRouter from './ai.router.js';
import notificationRouter from './notification.router.js';


const api = Router();

api.use('/sprints', sprintRouter);
api.use('/subtasks', subtaskRouter);
api.use('/reminders', reminderRouter);
api.use('/webhooks', webhookRouter);
api.use('/teams', teamRouter);
api.use('/labels', labelRouter);
api.use('/projects', projectRouter);
api.use('/tasks', taskRouter);
api.use('/users', userRouter);
api.use('/comments', commentRouter);
api.use('/invites', inviteRouter);
api.use('/ai-insights', aiInsightRouter);
api.use('/integrations', integrationRouter);
api.use('/attachments', attachmentRouter);
api.use('/activities', activityRouter);
api.use('/ai', aiRouter);
api.use('/notifications', notificationRouter);

export default api;