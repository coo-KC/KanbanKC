import express from 'express'
import { getAuth } from 'firebase-admin/auth'
import User from '../models/User.js'
import { roles, requireAdmin } from '../middleware/rbac.js'

const router = express.Router()

router.get('/', async (req, res) => {
  try {
    const users = await User.find().select('email name role department username superior').lean()
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

export default router
