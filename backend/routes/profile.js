import express from 'express'
import User from '../models/User.js'

const router = express.Router()

router.get('/', async (req, res) => {
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
    } else if (firebaseUser.role && user.role !== firebaseUser.role) {
      user.role = firebaseUser.role
      await user.save()
    }

    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department || '',
      username: user.username || '',
      superior: user.superior || null,
    })
  } catch (error) {
    console.error('Profile route error:', error)
    res.status(500).json({ error: 'Unable to load profile' })
  }
})

router.post('/device-token', async (req, res) => {
  const firebaseUser = req.user
  if (!firebaseUser) return res.status(401).json({ error: 'Unauthorized' })

  const { token } = req.body || {}
  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'A valid device token is required' })
  }

  try {
    const user = await User.findOne({ uid: firebaseUser.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })

    const cleanedToken = token.trim()
    const existingTokens = Array.isArray(user.fcmTokens) ? user.fcmTokens : []
    if (!existingTokens.includes(cleanedToken)) {
      user.fcmTokens = [...existingTokens, cleanedToken]
      await user.save()
    }

    res.json({ ok: true, token: cleanedToken })
  } catch (error) {
    console.error('Device token registration failed:', error)
    res.status(500).json({ error: 'Unable to register device token' })
  }
})

router.patch('/', async (req, res) => {
  const firebaseUser = req.user
  if (!firebaseUser) return res.status(401).json({ error: 'Unauthorized' })

  const { name, username, superior } = req.body

  try {
    const user = await User.findOne({ uid: firebaseUser.uid })
    if (!user) return res.status(404).json({ error: 'User not found' })

    if (name !== undefined) user.name = name
    
    if (username !== undefined) {
      if (username.trim() === '') {
        user.username = undefined // clear username
      } else {
        // check uniqueness
        const existing = await User.findOne({ username, _id: { $ne: user._id } })
        if (existing) {
          return res.status(400).json({ error: 'Username already taken' })
        }
        user.username = username
      }
    }

    if (superior !== undefined) {
      if (superior === '') {
        user.superior = null
      } else {
        if (superior === user._id.toString()) {
          return res.status(400).json({ error: 'Cannot be your own superior' })
        }
        user.superior = superior
      }
    }

    await user.save()

    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department || '',
      username: user.username || '',
      superior: user.superior || null,
    })
  } catch (error) {
    console.error('Profile update error:', error)
    res.status(500).json({ error: 'Unable to update profile' })
  }
})

export default router;
