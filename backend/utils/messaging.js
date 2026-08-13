import { getMessaging } from 'firebase-admin/messaging';
import User from '../models/User.js';

/**
 * Send an FCM notification to an array of user IDs.
 * @param {Array<String>} userIds - Array of MongoDB User ObjectIDs.
 * @param {String} title - Notification title.
 * @param {String} body - Notification body.
 * @param {Object} data - Optional extra data payload.
 */
export const sendNotificationToUsers = async (userIds, title, body, data = {}) => {
  try {
    if (!userIds || userIds.length === 0) return;

    // Fetch the users to get their FCM tokens
    const users = await User.find({ _id: { $in: userIds } }).lean();
    
    // Extract all valid tokens
    let tokens = [];
    users.forEach((user) => {
      if (Array.isArray(user.fcmTokens) && user.fcmTokens.length > 0) {
        tokens.push(...user.fcmTokens);
      }
    });

    if (tokens.length === 0) {
      console.log(`No FCM tokens found for users.`);
      return;
    }

    // Deduplicate tokens
    tokens = [...new Set(tokens)];

    const message = {
      notification: {
        title,
        body,
      },
      data,
      tokens,
    };

    const response = await getMessaging().sendEachForMulticast(message);
    console.log(`FCM Multicast sent: ${response.successCount} successes, ${response.failureCount} failures`);
  } catch (err) {
    console.error('Error sending FCM notification:', err);
  }
};
