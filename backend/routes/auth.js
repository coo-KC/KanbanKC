import express from 'express'
import User from '../models/User.js'

const router = express.Router()

router.post('/session', async (req, res) => {
  const firebaseUser = req.user
  if (!firebaseUser) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    let user = await User.findOne({ uid: firebaseUser.uid })
    if (!user) {
      user = await User.create({
        uid: firebaseUser.uid,
        email: firebaseUser.email || '',
        name: firebaseUser.name || '',
        role: firebaseUser.role || 'employee',
      })
    }

    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department || '',
    })
  } catch (error) {
    console.error('Session creation failed:', error)
    res.status(500).json({ error: 'Unable to create or retrieve session' })
  }
})

router.get('/me', async (req, res) => {
  const firebaseUser = req.user
  if (!firebaseUser) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const user = await User.findOne({ uid: firebaseUser.uid })
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department || '',
    })
  } catch (error) {
    console.error('Failed to fetch /auth/me:', error)
    res.status(500).json({ error: 'Unable to fetch user profile' })
  }
})

export default router
