import { getMessaging } from 'firebase-admin/messaging'
import User from '../models/User.js'

export const collectUserTokens = (users = []) => {
  const seen = new Set()

  for (const user of users) {
    const rawTokens = Array.isArray(user?.fcmTokens) ? user.fcmTokens : []
    for (const token of rawTokens) {
      if (typeof token !== 'string') continue
      const cleanToken = token.trim()
      if (!cleanToken || seen.has(cleanToken)) continue
      seen.add(cleanToken)
    }
  }

  return [...seen]
}

export const getChangedAssigneeIds = (previousIds = [], nextIds = []) => {
  const previousSet = new Set(previousIds.map((id) => String(id)))
  const nextSet = new Set(nextIds.map((id) => String(id)))
  return [...nextSet].filter((id) => !previousSet.has(id))
}

export const getDueSoonTaskIds = (tasks = [], now = new Date()) => {
  const next24Hours = 24 * 60 * 60 * 1000

  return tasks
    .filter((task) => task?.dueDate)
    .filter((task) => {
      const dueDate = new Date(task.dueDate)
      if (Number.isNaN(dueDate.getTime())) return false
      const diff = dueDate.getTime() - now.getTime()
      return diff > 0 && diff <= next24Hours
    })
    .map((task) => String(task._id))
}

export const sendMulticastNotification = async ({ userIds = [], title, body, data = {} }) => {
  if (!title || !body) {
    throw new Error('Notification title and body are required')
  }

  const users = await User.find({ _id: { $in: userIds } }).select('fcmTokens').lean()
  const tokens = collectUserTokens(users)

  if (!tokens.length) {
    return { successCount: 0, failureCount: 0, tokens: [] }
  }

  const payload = {
    tokens,
    notification: { title, body },
    data: Object.fromEntries(
      Object.entries(data).map(([key, value]) => [key, String(value)]),
    ),
  }

  const response = await getMessaging().sendEachForMulticast(payload)
  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
    tokens,
  }
}

export const sendAssignmentNotification = async (task, assigneeIds = []) => {
  if (!task || !Array.isArray(assigneeIds) || !assigneeIds.length) return null

  return sendMulticastNotification({
    userIds: assigneeIds,
    title: 'New task assigned',
    body: `You were assigned: ${task.title}`,
    data: {
      taskId: String(task._id),
      type: 'task_assigned',
    },
  })
}

export const sendDeadlineReminderNotification = async (task, assigneeIds = []) => {
  if (!task || !Array.isArray(assigneeIds) || !assigneeIds.length) return null

  return sendMulticastNotification({
    userIds: assigneeIds,
    title: 'Deadline alert',
    body: `${task.title} is due soon. Please review it before the deadline.`,
    data: {
      taskId: String(task._id),
      type: 'deadline_reminder',
    },
  })
}
