import express from 'express'
import { Transform } from 'stream'
import { AsyncParser } from 'json2csv'
import Task from '../models/Task.js'
import User from '../models/User.js'
import { requireCgrade, requireEmployee } from '../middleware/rbac.js'

const router = express.Router()

const formatTaskForReport = (task) => {
  const createdAtMs = new Date(task.createdAt).getTime()
  const completedAtMs = task.completedAt ? new Date(task.completedAt).getTime() : null
  const timeToCompleteHrs = completedAtMs ? ((completedAtMs - createdAtMs) / (1000 * 60 * 60)).toFixed(2) : ''

  // Build assignee string from the assignees array
  const assigneeStr = task.assignees && task.assignees.length > 0
    ? task.assignees.map(a => a.username ? `@${a.username}` : (a.name || a.email || 'Unknown')).join(', ')
    : 'Unassigned'

  return {
    'Task ID': task._id.toString(),
    'Title': task.title,
    'Assignee': assigneeStr,
    'Priority': task.priority,
    'Status': task.status,
    'Created Date': task.createdAt.toISOString(),
    'Due Date': task.dueDate ? task.dueDate.toISOString() : '',
    'Completion Date': task.completedAt ? task.completedAt.toISOString() : '',
    'Time-to-Complete (Hours)': timeToCompleteHrs,
  }
}

// Helper to stream tasks directly from MongoDB cursor to CSV
const streamTasksToCSV = (cursor, res) => {
  res.setHeader('Content-Type', 'text/csv')
  res.setHeader('Content-Disposition', 'attachment; filename="report.csv"')

  const transformStream = new Transform({
    objectMode: true,
    transform(chunk, encoding, callback) {
      callback(null, formatTaskForReport(chunk))
    }
  })

  const parser = new AsyncParser({}, { objectMode: true })
  
  cursor
    .pipe(transformStream)
    .pipe(parser.processor)
    .pipe(res)
    .on('error', err => {
      console.error('CSV stream error:', err)
      res.status(500).end()
    })
}

// GET /api/reports/org
router.get('/org', requireEmployee, async (req, res) => {
  const { format } = req.query
  const filter = { isDeleted: false }
  
  const user = await User.findOne({ uid: req.user.uid })
  if (!user) return res.status(404).json({ error: 'User not found' })

  if (user.role === 'employee') {
    const subordinates = await User.find({ superior: user._id }).lean()
    const subordinateIds = subordinates.map(sub => sub._id)
    filter.assignees = { $in: [user._id, ...subordinateIds] }
  }

  const cursor = Task.find(filter).populate('assignees', 'name email username').cursor()
  
  if (format === 'csv') {
    streamTasksToCSV(cursor, res)
  } else {
    // Return JSON data for PDF or preview
    const tasks = []
    for await (const doc of cursor) {
      tasks.push(formatTaskForReport(doc))
    }
    res.json(tasks)
  }
})

// GET /api/reports/self
router.get('/self', requireEmployee, async (req, res) => {
  const { format } = req.query
  const user = await User.findOne({ uid: req.user.uid })
  if (!user) return res.status(404).json({ error: 'User not found' })

  const filter = { assignees: user._id, isDeleted: false }
  const cursor = Task.find(filter).populate('assignees', 'name email username').cursor()

  if (format === 'csv') {
    streamTasksToCSV(cursor, res)
  } else {
    const tasks = []
    for await (const doc of cursor) {
      tasks.push(formatTaskForReport(doc))
    }
    res.json(tasks)
  }
})

export default router
