import { getAuth } from 'firebase-admin/auth'
import User from '../models/User.js'
import Task from '../models/Task.js'
import { clearUserCache } from '../middleware/auth.js'

/**
 * Robustly find, bind, or create a MongoDB user record from a Firebase auth token payload.
 * Handles cases where a user re-registers in Firebase Auth with the same email (new UID).
 */
export const findOrCreateOrBindUser = async (firebaseUser) => {
  if (!firebaseUser || !firebaseUser.uid) {
    throw new Error('Firebase user payload with UID is required')
  }

  const rawEmail = firebaseUser.email || ''
  const cleanEmail = rawEmail.trim().toLowerCase()

  // 1. Try finding by exact Firebase UID
  let user = await User.findOne({ uid: firebaseUser.uid })

  // 2. If not found by UID, try finding by email
  if (!user && cleanEmail) {
    user = await User.findOne({ email: cleanEmail })
    if (user) {
      // Re-bind the new Firebase UID to this user record
      user.uid = firebaseUser.uid
      if (firebaseUser.name && !user.name) {
        user.name = firebaseUser.name
      }
      await user.save()
    }
  }

  // 3. If still not found, create a fresh User record
  if (!user) {
    user = await User.create({
      uid: firebaseUser.uid,
      email: cleanEmail,
      name: firebaseUser.name || '',
      role: firebaseUser.role || 'employee',
    })
  } else if (firebaseUser.role && user.role !== firebaseUser.role) {
    user.role = firebaseUser.role
    await user.save()
  }

  clearUserCache(user.uid)
  return user
}

/**
 * Permanently and smoothly purge a user from Firebase Auth, MongoDB User collection,
 * Task assignments, Superior hierarchies, and in-memory caches.
 */
export const purgeUserCompletely = async (user) => {
  if (!user) return

  // 1. Delete from Firebase Auth
  if (user.uid) {
    try {
      await getAuth().deleteUser(user.uid)
    } catch (fbErr) {
      console.warn('Firebase user deletion warning (may already be deleted):', fbErr.message)
    }
  }

  // 2. Remove user from task assignees
  if (user._id) {
    try {
      await Task.updateMany({}, { $pull: { assignees: user._id } })
    } catch (tErr) {
      console.warn('Task cleanup warning on user deletion:', tErr.message)
    }

    // 3. Clear superior references for any subordinates
    try {
      await User.updateMany({ superior: user._id }, { superior: null })
    } catch (uErr) {
      console.warn('Subordinate cleanup warning on user deletion:', uErr.message)
    }
  }

  // 4. Delete user document(s) matching _id, uid, or email
  const cleanEmail = (user.email || '').trim().toLowerCase()
  const deleteConditions = []
  if (user._id) deleteConditions.push({ _id: user._id })
  if (user.uid) deleteConditions.push({ uid: user.uid })
  if (cleanEmail) deleteConditions.push({ email: cleanEmail })

  if (deleteConditions.length > 0) {
    await User.deleteMany({ $or: deleteConditions })
  }

  // 5. Clear user cache
  if (user.uid) {
    clearUserCache(user.uid)
  }
}
