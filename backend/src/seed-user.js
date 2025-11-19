import 'dotenv/config';
import mongoose from 'mongoose';
import { connectMongo, disconnectMongo } from './config/database.config.js';
import { UserModel } from './models/index.js';
import bcrypt from 'bcrypt';

(async () => {
  await connectMongo();

  console.log('✅ Connected to MongoDB');

  // Xoá toàn bộ users
  await UserModel.deleteMany({});
  console.log('🗑️ All users deleted');

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
        team: null,
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
  });

  await disconnectMongo();
  console.log('🔌 Done & disconnected');
})();
