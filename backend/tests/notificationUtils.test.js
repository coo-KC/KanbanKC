import test from 'node:test'
import assert from 'node:assert/strict'

import {
  collectUserTokens,
  getChangedAssigneeIds,
  getDueSoonTaskIds,
} from '../utils/notificationUtils.js'

test('collectUserTokens filters blanks and deduplicates values', () => {
  const users = [
    { fcmTokens: ['token-1', '', 'token-2'] },
    { fcmTokens: ['token-2', 'token-3'] },
    { fcmTokens: [] },
    { fcmTokens: null },
  ]

  assert.deepEqual(collectUserTokens(users), ['token-1', 'token-2', 'token-3'])
})

test('getChangedAssigneeIds returns only newly assigned users', () => {
  const prev = ['u1', 'u2']
  const next = ['u2', 'u3', 'u4']

  assert.deepEqual(getChangedAssigneeIds(prev, next), ['u3', 'u4'])
})

test('getDueSoonTaskIds matches tasks due within the next 24 hours', () => {
  const now = new Date('2026-08-13T12:00:00Z')
  const tasks = [
    { _id: 'a', dueDate: new Date('2026-08-14T08:00:00Z') },
    { _id: 'b', dueDate: new Date('2026-08-15T10:00:00Z') },
    { _id: 'c', dueDate: new Date('2026-08-13T08:00:00Z') },
    { _id: 'd', dueDate: null },
  ]

  assert.deepEqual(getDueSoonTaskIds(tasks, now), ['a'])
})
