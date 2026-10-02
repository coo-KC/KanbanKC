import test from 'node:test'
import assert from 'node:assert/strict'

test('findOrCreateOrBindUser module loads cleanly', async () => {
  const { findOrCreateOrBindUser, purgeUserCompletely } = await import('../utils/userUtils.js')
  assert.equal(typeof findOrCreateOrBindUser, 'function')
  assert.equal(typeof purgeUserCompletely, 'function')
})
