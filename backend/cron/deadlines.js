import cron from 'node-cron';
import Task from '../models/Task.js';
import { sendNotificationToUsers } from '../utils/messaging.js';
import { startOfDay, endOfDay, addDays } from 'date-fns';

// Run every day at 8:00 AM
export const startDeadlineCron = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('Running daily deadline cron job...');
    try {
      const tomorrowStart = startOfDay(addDays(new Date(), 1));
      const tomorrowEnd = endOfDay(addDays(new Date(), 1));

      const dueTomorrowTasks = await Task.find({
        dueDate: {
          $gte: tomorrowStart,
          $lte: tomorrowEnd,
        },
        status: { $ne: 'completed' },
        isDeleted: false,
      }).lean();

      if (dueTomorrowTasks.length === 0) {
        console.log('No tasks due tomorrow.');
        return;
      }

      console.log(`Found ${dueTomorrowTasks.length} tasks due tomorrow.`);

      for (const task of dueTomorrowTasks) {
        if (task.assignees && task.assignees.length > 0) {
          await sendNotificationToUsers(
            task.assignees,
            'Task Due Tomorrow',
            `Reminder: The task "${task.title}" is due tomorrow.`,
            { taskId: task._id.toString() }
          );
        }
      }
    } catch (error) {
      console.error('Error in deadline cron job:', error);
    }
  });
};
