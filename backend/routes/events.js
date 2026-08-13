import express from 'express'
import Event from '../models/Event.js'
import User from '../models/User.js'
import { requireAdmin, requireCgrade, requireEmployee } from '../middleware/rbac.js'

const router = express.Router()

// GET /api/events -> any authenticated (requireEmployee covers all roles)
router.get('/', requireEmployee, async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 }).populate('createdBy', 'name email').lean()
    res.json(events)
  } catch (error) {
    console.error('Failed to get events:', error)
    res.status(500).json({ error: 'Unable to get events' })
  }
})

// POST /api/events -> any authenticated
router.post('/', requireEmployee, async (req, res) => {
  const { title, description, eventType, date, deadline } = req.body
  const role = req.user.role
  const user = await User.findOne({ uid: req.user.uid })
  
  if (!user) {
    return res.status(404).json({ error: 'User not found' })
  }

  const status = role === 'admin' ? 'published' : 'pending_approval'

  try {
    const event = await Event.create({
      title,
      description,
      eventType,
      date: new Date(date),
      deadline: deadline ? new Date(deadline) : undefined,
      status,
      createdBy: user._id,
    })
    res.status(201).json(event)
  } catch (error) {
    console.error('Failed to create event:', error)
    res.status(500).json({ error: 'Unable to create event' })
  }
})

// PATCH /api/events/:id/approve -> admin only
router.patch('/:id/approve', requireAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndUpdate(
      req.params.id,
      { status: 'published' },
      { new: true }
    )
    if (!event) return res.status(404).json({ error: 'Event not found' })
    res.json(event)
  } catch (error) {
    console.error('Failed to approve event:', error)
    res.status(500).json({ error: 'Unable to approve event' })
  }
})

// DELETE /api/events/:id -> admin only
router.delete('/:id', requireAdmin, async (req, res) => {
  try {
    const event = await Event.findByIdAndDelete(req.params.id)
    if (!event) return res.status(404).json({ error: 'Event not found' })
    res.json({ message: 'Event deleted' })
  } catch (error) {
    console.error('Failed to delete event:', error)
    res.status(500).json({ error: 'Unable to delete event' })
  }
})

export default router
