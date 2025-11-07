import 'dotenv/config';
import mongoose from 'mongoose';
import { TaskModel } from './models/task.js';

import { model, Schema } from 'mongoose';

// Dummy models để seed nếu chưa có
const UserModel = mongoose.models.user || model('user', new Schema({ name: String, email: String }));
const TeamModel = mongoose.models.team || model('team', new Schema({ name: String }));
const ProjectModel = mongoose.models.project || model('project', new Schema({ name: String, team: { type: Schema.Types.ObjectId, ref: 'team' } }));

async function main() {
  await mongoose.connect(process.env.MONGO_URI);
  console.log('✅ Connected to MongoDB');

  // Xoá dữ liệu cũ
  await Promise.all([
    TaskModel.deleteMany({}),
    UserModel.deleteMany({}),
    TeamModel.deleteMany({}),
    ProjectModel.deleteMany({}),
  ]);

  console.log('🧹 Old data cleared');

  // Seed teams
  const teams = await TeamModel.insertMany([
    { name: 'SmartWork Dev Team' },
    { name: 'AI Research Team' },
  ]);
  console.log('👥 Teams created:', teams.map((t) => t.name));

  // Seed users
  const users = await UserModel.insertMany([
    { name: 'Reece Brown', email: 'reece@example.com' },
    { name: 'Alice Nguyen', email: 'alice@example.com' },
    { name: 'Bob Tran', email: 'bob@example.com' },
  ]);
  console.log('👤 Users created:', users.map((u) => u.name));

  // Seed projects
  const projects = await ProjectModel.insertMany([
    { name: 'SmartWork Backend', team: teams[0]._id },
    { name: 'AI Task Optimizer', team: teams[1]._id },
  ]);
  console.log('📁 Projects created:', projects.map((p) => p.name));

  // Seed tasks
  const now = new Date();
  const tasks = await TaskModel.insertMany([
    {
      team: teams[0]._id,
      project: projects[0]._id,
      title: 'Build API endpoints for tasks',
      description: 'Implement CRUD routes for task management',
      type: 'task',
      status: 'in_progress',
      priority: 'high',
      reporter: users[0]._id,
      assignees: [users[1]._id],
      watchers: [users[2]._id],
      dueDate: new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000),
      startDate: now,
      estimate: 8,
      checklist: [
        { content: 'Design API structure', done: true },
        { content: 'Implement POST /tasks', done: true },
        { content: 'Implement GET /tasks', done: false },
      ],
      ai: { riskScore: 0.25 },
    },
    {
      team: teams[0]._id,
      project: projects[0]._id,
      title: 'Fix login bug',
      description: 'Resolve issue where JWT not refreshing properly',
      type: 'bug',
      status: 'todo',
      priority: 'urgent',
      reporter: users[1]._id,
      assignees: [users[2]._id],
      dueDate: new Date(now.getTime() + 2 * 24 * 60 * 60 * 1000),
      estimate: 3,
      ai: { riskScore: 0.5 },
    },
    {
      team: teams[1]._id,
      project: projects[1]._id,
      title: 'Train task priority model',
      description: 'Build ML model to predict task priority',
      type: 'story',
      status: 'backlog',
      priority: 'normal',
      reporter: users[0]._id,
      assignees: [users[1]._id],
      estimate: 13,
      storyPoints: 5,
      ai: { riskScore: 0.7, predictedDueDate: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
    },
  ]);

  console.log('✅ Tasks created:', tasks.map((t) => t.title));

  console.log('🌱 Seeding completed!');
  await mongoose.disconnect();
  console.log('🔌 Disconnected');
}

main().catch((err) => {
  console.error('❌ Seed error:', err);
  process.exit(1);
});