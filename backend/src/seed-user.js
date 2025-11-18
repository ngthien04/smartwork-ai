import 'dotenv/config';
import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from './config/database.config.js';
import { UserModel, TeamModel } from './models/index.js';
import bcrypt from 'bcrypt';

(async () => {
  await connectMongo();

  console.log('✅ Connected to MongoDB');

  // Xoá user/team cũ nếu trùng email
  await UserModel.deleteOne({ email: 'admin@gmail.com' });

  // Tạo team mẫu (nếu chưa có)
  let team = await TeamModel.findOne({ name: 'SmartWork Dev Team' });
  if (!team) {
    team = await TeamModel.create({ name: 'SmartWork Dev Team' });
    console.log('👥 Team created:', team.name);
  }

  // Tạo user admin
  const password = '123456';
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await UserModel.create({
    name: 'Admin User',
    email: 'admin@gmail.com',
    avatarUrl: 'https://i.pravatar.cc/150?u=admin',
    passwordHash,
    roles: [
      {
        team: team._id,
        role: 'admin',
      },
    ],
    preferences: {
      locale: 'vi-VN',
      timezone: 'Asia/Ho_Chi_Minh',
    },
  });

  console.log('👤 User created:');
  console.log({
    email: user.email,
    password: password,
    team: team.name,
  });

  await disconnectMongo();
  console.log('🔌 Done & disconnected');
})();