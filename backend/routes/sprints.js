import express from 'express'
import Sprint from '../models/Sprint.js'
import Task from '../models/Task.js'
import { requireAdmin, requireEmployee } from '../middleware/rbac.js'

const router = express.Router()

// GET /api/sprints
router.get('/', requireEmployee, async (req, res) => {
  try {
    const sprints = await Sprint.find().sort({ sprintNumber: -1 }).lean()
    res.json(sprints)
  } catch (error) {
    res.status(500).json({ error: 'Unable to get sprints' })
  }
})

// POST /api/sprints
router.post('/', requireEmployee, async (req, res) => {
  const { sprintNumber, startDate, endDate } = req.body
  try {
    const sprint = await Sprint.create({ sprintNumber, startDate, endDate })
    res.status(201).json(sprint)
  } catch (error) {
    res.status(500).json({ error: 'Unable to create sprint' })
  }
})

// PATCH /api/sprints/:id
router.patch('/:id', requireAdmin, async (req, res) => {
  const { startDate, endDate, status } = req.body
  try {
    const sprint = await Sprint.findByIdAndUpdate(
      req.params.id,
      { startDate, endDate, status },
      { new: true }
    )
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' })
    res.json(sprint)
  } catch (error) {
    res.status(500).json({ error: 'Unable to update sprint' })
  }
})

// POST /api/sprints/:id/archive
router.post('/:id/archive', requireAdmin, async (req, res) => {
  try {
    const sprint = await Sprint.findById(req.params.id)
    if (!sprint) return res.status(404).json({ error: 'Sprint not found' })

    // 1. Gather all tasks for this sprint
    const tasks = await Task.find({ sprintId: sprint._id }).lean()
    
    // 2. Compute summary
    const completedTasks = tasks.filter(t => t.status === 'completed')
    const completedCount = completedTasks.length
    
    let totalCycleTimeMs = 0
    let validCycleCount = 0
    const byAssignee = new Map()

    completedTasks.forEach(task => {
      if (task.completedAt && task.createdAt) {
        const cycleMs = new Date(task.completedAt) - new Date(task.createdAt)
        totalCycleTimeMs += cycleMs
        validCycleCount++
      }
      const assigneeStr = task.assignee ? task.assignee.toString() : 'unassigned'
      byAssignee.set(assigneeStr, (byAssignee.get(assigneeStr) || 0) + 1)
    })

    const avgCycleTimeHours = validCycleCount > 0 
      ? (totalCycleTimeMs / validCycleCount) / (1000 * 60 * 60)
      : 0

    // 3. Save summary & set to archived
    sprint.status = 'archived'
    sprint.summary = {
      completedCount,
      avgCycleTimeHours,
      byAssignee
    }
    await sprint.save()

    // 4. (Mock) Export to Firebase Storage
    // In a real production scenario, we'd serialize `tasks` and upload to a bucket here.
    // e.g. await getStorage().bucket().file(`sprints/${sprint._id}.json`).save(JSON.stringify(tasks))
    
    // 5. We do NOT hard delete tasks immediately per the spec ("Export -> verify -> grace period -> delete")
    // A separate cron job would verify the export and prune old tasks.

    res.json({ message: 'Sprint archived and summary computed.', sprint })
  } catch (error) {
    console.error('Archive failed:', error)
    res.status(500).json({ error: 'Unable to archive sprint' })
  }
})

export default router
