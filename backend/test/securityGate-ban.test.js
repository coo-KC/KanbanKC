import test from 'node:test'
import assert from 'node:assert/strict'

import {
  recordFailedAttempt,
  applyReportDecision,
  isIpBanned,
} from '../utils/securityGateBan.js'

test('records a pending admin report after 5 failed attempts from the same IP', () => {
  const state = { banList: [], reports: [], failedAttempts: [] }

  for (let i = 0; i < 5; i += 1) {
    const now = Date.parse('2026-01-01T00:00:00Z') + i * 60_000
    const result = recordFailedAttempt({
      state,
      ip: '203.0.113.10',
      userAgent: 'test-agent',
      now,
    })

    if (i === 4) {
      assert.equal(result.triggeredReport, true)
    }
  }

  assert.equal(state.reports.length, 1)
  assert.equal(state.reports[0].status, 'pending')
  assert.equal(isIpBanned(state.banList, '203.0.113.10'), false)
})

test('red decision bans the IP permanently and green clears it', () => {
  const state = {
    banList: [],
    reports: [
      {
        id: 'report-1',
        ip: '198.51.100.7',
        status: 'pending',
        decision: 'pending',
        createdAt: new Date().toISOString(),
      },
    ],
    failedAttempts: [],
  }

  applyReportDecision({ state, reportId: 'report-1', decision: 'red', note: 'Confirmed abuse' })
  assert.equal(isIpBanned(state.banList, '198.51.100.7'), true)
  assert.equal(state.reports[0].status, 'banned')

  applyReportDecision({ state, reportId: 'report-1', decision: 'green', note: 'Mistaken report' })
  assert.equal(isIpBanned(state.banList, '198.51.100.7'), false)
  assert.equal(state.reports[0].status, 'cleared')
})
