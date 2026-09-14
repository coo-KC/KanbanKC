import express from 'express'
import { getAuth } from 'firebase-admin/auth'
import User from '../models/User.js'
import { roles, requireAdmin } from '../middleware/rbac.js'
import { clearUserCache } from '../middleware/auth.js'
import { sendNotificationToUsers } from '../utils/messaging.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const users = await User.find()
      .select('email name role department username superior isWarned uid')
      .populate('superior', 'name email username')
      .lean()
    res.json(users)
  } catch (error) {
    console.error('List users failed:', error)
    res.status(500).json({ error: 'Unable to list users' })
  }
})

router.post('/', requireAdmin, async (req, res) => {
  const { email, password, name, role = roles.EMPLOYEE, department = '' } = req.body
  if (!email || !password || !name) {
    return res.status(400).json({ error: 'email, password, and name are required' })
  }

  try {
    const firebaseUser = await getAuth().createUser({
      email,
      password,
      displayName: name,
    })

    await getAuth().setCustomUserClaims(firebaseUser.uid, { role })

    const userRecord = await User.create({
      uid: firebaseUser.uid,
      email,
      name,
      role,
      department,
    })

    res.status(201).json({
      uid: userRecord.uid,
      email: userRecord.email,
      name: userRecord.name,
      role: userRecord.role,
      department: userRecord.department,
    })
  } catch (error) {
    console.error('Provision user failed:', error)
    res.status(500).json({ error: 'Unable to provision user' })
  }
})

router.patch('/:id/role', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { role } = req.body
  if (!Object.values(roles).includes(role)) {
    return res.status(400).json({ error: 'Invalid role' })
  }

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    await getAuth().setCustomUserClaims(user.uid, { role })
    user.role = role
    await user.save()
    clearUserCache(user.uid)

    res.json({
      uid: user.uid,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    })
  } catch (error) {
    console.error('Change role failed:', error)
    res.status(500).json({ error: 'Unable to change role' })
  }
})

router.patch('/:id/warn', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { isWarned } = req.body

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    user.isWarned = typeof isWarned === 'boolean' ? isWarned : !user.isWarned
    await user.save()
    clearUserCache(user.uid)

    if (user.isWarned) {
      sendNotificationToUsers(
        [user._id],
        'Warning Issued',
        "Warning: You're Under Watch",
        { type: 'warning' }
      )
    }

    res.json({
      _id: user._id,
      email: user.email,
      name: user.name,
      isWarned: user.isWarned,
    })
  } catch (error) {
    console.error('Warn user failed:', error)
    res.status(500).json({ error: 'Unable to update warning status' })
  }
})

router.patch('/:id/superior', requireAdmin, async (req, res) => {
  const { id } = req.params
  const { superiorId } = req.body

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    if (superiorId) {
      if (superiorId === id) {
        return res.status(400).json({ error: 'User cannot be their own superior' })
      }
      const superior = await User.findById(superiorId)
      if (!superior) {
        return res.status(404).json({ error: 'Superior user not found' })
      }
      user.superior = superior._id
    } else {
      user.superior = null
    }

    await user.save()
    clearUserCache(user.uid)

    const updatedUser = await User.findById(id).populate('superior', 'name email username').lean()
    res.json(updatedUser)
  } catch (error) {
    console.error('Update superior failed:', error)
    res.status(500).json({ error: 'Unable to update superior' })
  }
})

router.delete('/:id', requireAdmin, async (req, res) => {
  const { id } = req.params

  try {
    const user = await User.findById(id)
    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    // Delete user from Firebase Auth
    try {
      await getAuth().deleteUser(user.uid)
    } catch (fbErr) {
      console.warn('Firebase admin deletion warning:', fbErr.message)
    }

    await User.deleteOne({ _id: user._id })
    clearUserCache(user.uid)

    res.json({ message: 'User deleted successfully' })
  } catch (error) {
    console.error('Delete user failed:', error)
    res.status(500).json({ error: 'Unable to delete user' })
  }
})

export default router
