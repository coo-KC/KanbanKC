import dotenv from 'dotenv';
import mongoose from 'mongoose';
import Task from './models/Task.js';
import User from './models/User.js';

dotenv.config();

const run = async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  
  const user = await User.findOne();
  if (!user) {
    console.log('No user found');
    process.exit(1);
  }

  try {
    const task = await Task.create({
      title: 'monu',
      description: undefined,
      priority: 'low',
      assignee: user._id,
      createdBy: user._id,
      sprintId: undefined,
      dueDate: new Date('2026-08-21'),
      tags: undefined,
    });
    console.log('Success:', task);
  } catch (e) {
    console.error('Error:', e.stack);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
};

run();
