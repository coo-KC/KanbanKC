import express from 'express'
import mongoose from 'mongoose'
import Task from '../models/Task.js'
import User from '../models/User.js'
import ActivityLog from '../models/ActivityLog.js'
import { requireAdmin, requireEmployee } from '../middleware/rbac.js'
import { sendNotificationToUsers } from '../utils/messaging.js'

const router = express.Router()

const canModifyTask = async (requester, task) => {
  const role = requester.role
  if (!role) return false
  if (role === 'admin' || role === 'cgrade') return true
  if (role === 'employee') {
    if (task.createdBy.toString() === requester._id.toString()) return true
    if (task.assignees && task.assignees.some(a => a.toString() === requester._id.toString())) return true
    
    const subordinates = await User.find({ superior: requester._id }).lean()
    const subordinateIds = subordinates.map(sub => sub._id.toString())
    
    if (subordinateIds.includes(task.createdBy.toString())) return true
    if (task.assignees && task.assignees.some(a => subordinateIds.includes(a.toString()))) return true
    
    return false
  }
  return false
}

const getAllSubordinateIds = async (userId) => {
  const directSubs = await User.find({ superior: userId }).select('_id').lean()
  let allIds = directSubs.map(s => s._id)
  for (const sub of directSubs) {
    const childIds = await getAllSubordinateIds(sub._id)
    allIds = allIds.concat(childIds)
  }
  return allIds
}

router.get('/org', requireEmployee, async (req, res) => {
  try {
    const user = await User.findOne({ uid: req.user.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const filter = { isDeleted: false }

    if (req.query.status) filter.status = req.query.status
    if (req.query.priority) filter.priority = req.query.priority
    if (req.query.assignee) filter.assignees = req.query.assignee
    if (req.query.sprintId) filter.sprintId = req.query.sprintId

    if (req.query.supervisedOnly === 'true') {
      const subordinateIds = await getAllSubordinateIds(user._id)
      if (filter.assignees) {
        const singleAssignee = filter.assignees.toString()
        const matchesSub = subordinateIds.some(id => id.toString() === singleAssignee)
        filter.assignees = matchesSub ? singleAssignee : { $in: [] }
      } else {
        filter.assignees = { $in: subordinateIds }
      }
    }

    const tasks = await Task.find(filter)
      .populate('assignees', 'name email department role username')
      .populate('createdBy', 'name email uid username')
      .lean()

    res.json(tasks)
  } catch (error) {
    res.status(500).json({ error: 'Unable to get org tasks' })
  }
})

router.get('/personal', requireEmployee, async (req, res) => {
  const user = await User.findOne({ uid: req.user.uid })
  if (!user) return res.status(404).json({ error: 'User not found' })

  const tasks = await Task.find({ assignees: user._id, isDeleted: false })
    .populate('assignees', 'name email department role username')
    .populate('createdBy', 'name email uid username')
    .lean()
  res.json(tasks)
})

router.post('/', requireEmployee, async (req, res) => {
  try {
    const { title, description, priority, dueDate, assigneeIds, sprintId, tags, link } = req.body
    const user = await User.findOne({ uid: req.user.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })

    let assignees = [user._id]
    if (assigneeIds && Array.isArray(assigneeIds) && assigneeIds.length > 0) {
      const validUsers = await User.find({ _id: { $in: assigneeIds } })
      assignees = validUsers.map(u => u._id)
    }

    const task = await Task.create({
      title,
      description,
      priority,
      assignees,
      createdBy: user._id,
      sprintId: sprintId ? new mongoose.Types.ObjectId(sprintId) : undefined,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags,
      link: link || '',
    })

    // Notify assignees (excluding creator)
    const notifyAssignees = assignees.filter(id => id.toString() !== user._id.toString())
    if (notifyAssignees.length > 0) {
      sendNotificationToUsers(
        notifyAssignees,
        'New Task Assigned',
        `You have been assigned to: ${title}`,
        { taskId: task._id.toString() }
      )
    }

    res.status(201).json(task)
  } catch (error) {
    import('fs').then(fs => fs.appendFileSync('error.log', error.stack + '\n'));
    console.error('Task creation failed:', error)
    res.status(500).json({ error: error.message || 'Unable to create task' })
  }
})

router.patch('/:id', requireEmployee, async (req, res) => {
  const { id } = req.params
  const { title, description, priority, dueDate, assigneeIds, tags, updatedAt, link } = req.body
  if (!updatedAt) return res.status(400).json({ error: 'updatedAt is required' })

  const requester = await User.findOne({ uid: req.user.uid })
  if (!requester) return res.status(404).json({ error: 'Requesting user not found' })

  const task = await Task.findOne({ _id: id, isDeleted: false })
  if (!task) return res.status(404).json({ error: 'Task not found' })

  if (!(await canModifyTask(requester, task))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to edit this task.' })
  }

  let assignees = task.assignees
  if (assigneeIds && Array.isArray(assigneeIds)) {
    const validUsers = await User.find({ _id: { $in: assigneeIds } })
    assignees = validUsers.map(u => u._id)
  }

  const updated = await Task.findOneAndUpdate(
    { _id: id, updatedAt: new Date(updatedAt), isDeleted: false },
    {
      title,
      description,
      priority,
      assignees,
      dueDate: dueDate ? new Date(dueDate) : undefined,
      tags,
      link: link !== undefined ? link : undefined,
      updatedAt: new Date(),
    },
    { new: true },
  )

  if (!updated) {
    return res.status(409).json({ error: 'Conflict detected. Task was modified elsewhere.' })
  }

  res.json(updated)
})

router.patch('/:id/status', requireEmployee, async (req, res) => {
  const { id } = req.params
  const { status, updatedAt } = req.body
  if (!status || !updatedAt) return res.status(400).json({ error: 'status and updatedAt are required' })

  const task = await Task.findOne({ _id: id, isDeleted: false })
  if (!task) return res.status(404).json({ error: 'Task not found' })

  const requester = await User.findOne({ uid: req.user.uid })
  if (!requester) return res.status(404).json({ error: 'Requesting user not found' })

  const isOwner = task.createdBy.toString() === requester._id.toString() || (task.assignees && task.assignees.some(a => a.toString() === requester._id.toString()))
  if (!isOwner && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const oldStatus = task.status
  const updated = await Task.findOneAndUpdate(
    { _id: id, updatedAt: new Date(updatedAt), isDeleted: false },
    {
      status,
      updatedAt: new Date(),
      completedAt: status === 'completed' ? new Date() : undefined,
    },
    { new: true },
  )

  if (!updated) {
    return res.status(409).json({ error: 'Conflict detected. Task was modified elsewhere.' })
  }

  await ActivityLog.create({
    task: updated._id,
    author: requester._id,
    type: 'status_change',
    oldStatus,
    newStatus: status,
  })

  res.json(updated)
})

router.patch('/:id/reassign', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { assigneeId, updatedAt } = req.body
  if (!assigneeId || !updatedAt) return res.status(400).json({ error: 'assigneeId and updatedAt are required' })

  const task = await Task.findOne({ _id: id, isDeleted: false })
  if (!task) return res.status(404).json({ error: 'Task not found' })

  const assignee = await User.findById(assigneeId)
  if (!assignee) return res.status(404).json({ error: 'Assignee not found' })

  const requester = await User.findOne({ uid: req.user.uid })
  if (!requester) return res.status(404).json({ error: 'Requesting user not found' })

  const updated = await Task.findOneAndUpdate(
    { _id: id, updatedAt: new Date(updatedAt), isDeleted: false },
    {
      assignees: [assignee._id],
      updatedAt: new Date(),
    },
    { new: true },
  )

  if (!updated) {
    return res.status(409).json({ error: 'Conflict detected. Task was modified elsewhere.' })
  }

  await ActivityLog.create({
    task: updated._id,
    author: requester._id,
    type: 'reassignment',
    oldStatus: task.status,
    newStatus: task.status,
    content: `Reassigned to ${assignee.email}`,
  })

  if (assignee._id.toString() !== requester._id.toString()) {
    sendNotificationToUsers(
      [assignee._id],
      'Task Reassigned',
      `You have been reassigned to: ${task.title}`,
      { taskId: task._id.toString() }
    )
  }

  res.json(updated)
})

router.delete('/:id', requireEmployee, async (req, res) => {
  const { id } = req.params

  const requester = await User.findOne({ uid: req.user.uid })
  if (!requester) return res.status(404).json({ error: 'User not found' })

  const task = await Task.findOne({ _id: id, isDeleted: false })
  if (!task) return res.status(404).json({ error: 'Task not found' })

  if (!(await canModifyTask(requester, task))) {
    return res.status(403).json({ error: 'Forbidden: You do not have permission to delete this task.' })
  }

  const deletedTask = await Task.findOneAndUpdate(
    { _id: id, isDeleted: false },
    { isDeleted: true, updatedAt: new Date() },
    { new: true },
  )
  res.json(deletedTask)
})

router.get('/:id/comments', requireEmployee, async (req, res) => {
  try {
    const logs = await ActivityLog.find({ task: req.params.id })
      .populate('author', 'name email username')
      .sort({ timestamp: 1 })
      .lean()
    res.json(logs)
  } catch (error) {
    res.status(500).json({ error: 'Unable to get comments' })
  }
})

router.post('/:id/comments', requireEmployee, async (req, res) => {
  const { content } = req.body
  if (!content) return res.status(400).json({ error: 'content is required' })

  try {
    const user = await User.findOne({ uid: req.user.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const task = await Task.findOne({ _id: req.params.id, isDeleted: false })
    if (!task) return res.status(404).json({ error: 'Task not found' })

    const comment = await ActivityLog.create({
      task: task._id,
      author: user._id,
      type: 'comment',
      content,
    })

    const populated = await ActivityLog.findById(comment._id).populate('author', 'name email username').lean()
    res.status(201).json(populated)
  } catch (error) {
    res.status(500).json({ error: 'Unable to add comment' })
  }
})

export default router
