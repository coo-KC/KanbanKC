import express from 'express'
import User from '../models/User.js'
import { findOrCreateOrBindUser } from '../utils/userUtils.js'

const router = express.Router()

router.post('/session', async (req, res) => {
  if (req.body?.company_website_url && req.body.company_website_url.trim() !== '') {
    return res.status(400).json({ error: 'Invalid submission' })
  }

  const firebaseUser = req.user
  if (!firebaseUser) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const user = await findOrCreateOrBindUser(firebaseUser)

    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department || '',
      isWarned: !!user.isWarned,
    })
  } catch (error) {
    console.error('Session creation failed:', error?.stack || error)
    res.status(500).json({ error: error?.message || 'Unable to create or retrieve session' })
  }
})

router.get('/me', async (req, res) => {
  const firebaseUser = req.user
  if (!firebaseUser) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const user = await findOrCreateOrBindUser(firebaseUser)

    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department || '',
      isWarned: !!user.isWarned,
    })
  } catch (error) {
    console.error('Failed to fetch /auth/me:', error)
    res.status(500).json({ error: 'Unable to fetch user profile' })
  }
})

export default router
