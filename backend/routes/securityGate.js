import express from 'express'
import SystemConfig from '../models/SystemConfig.js'
import { requireAdmin } from '../middleware/rbac.js'
import { verifyFirebaseToken } from '../middleware/auth.js'
import {
  hashAnswersList,
  verifyProvidedAnswer,
  createGateToken,
  normalizeInput,
} from '../utils/security.js'
import {
  applyReportDecision,
  isIpBanned,
  normalizeIp,
  recordFailedAttempt,
} from '../utils/securityGateBan.js'

const router = express.Router()

const DEFAULT_QUESTION = 'What software platform does KanbanKC belong to?'
const DEFAULT_ANSWERS_STR = 'KanbaKan, kanbakan, Kanban'

const getRequestIp = (req) => {
  const forwardedFor = req.headers['x-forwarded-for']
  if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
    return normalizeIp(forwardedFor)
  }
  if (Array.isArray(forwardedFor) && forwardedFor.length > 0) {
    return normalizeIp(forwardedFor[0])
  }
  return normalizeIp(req.ip || req.socket?.remoteAddress || 'unknown')
}

const buildSecurityGateState = (value = {}) => {
  const rawAnswersStr = value.rawAnswersStr || DEFAULT_ANSWERS_STR
  const hashedAnswers = value.hashedAnswers || hashAnswersList(rawAnswersStr)

  return {
    question: value.question || DEFAULT_QUESTION,
    rawAnswersStr,
    hashedAnswers,
    banList: Array.isArray(value.banList) ? value.banList : [],
    reports: Array.isArray(value.reports) ? value.reports : [],
    failedAttempts: Array.isArray(value.failedAttempts) ? value.failedAttempts : [],
  }
}

const getSecurityGateConfig = async () => {
  let config = await SystemConfig.findOne({ key: 'securityGate' })
  if (!config) {
    const defaultHashedAnswers = hashAnswersList(DEFAULT_ANSWERS_STR)
    config = await SystemConfig.create({
      key: 'securityGate',
      value: {
        question: DEFAULT_QUESTION,
        rawAnswersStr: DEFAULT_ANSWERS_STR,
        hashedAnswers: defaultHashedAnswers,
        banList: [],
        reports: [],
        failedAttempts: [],
      },
    })
  }

  return buildSecurityGateState(config.value)
}

const persistSecurityGateState = async (state) => {
  await SystemConfig.findOneAndUpdate(
    { key: 'securityGate' },
    {
      key: 'securityGate',
      value: {
        ...state,
      },
    },
    { new: true, upsert: true }
  )
}

// PUBLIC: GET /api/security-gate/question
router.get('/question', async (req, res) => {
  try {
    const config = await getSecurityGateConfig()
    const clientIp = getRequestIp(req)

    if (isIpBanned(config.banList, clientIp)) {
      return res.status(403).json({
        error: 'This IP address has been banned from the security gate.',
        banned: true,
      })
    }

    res.json({ question: config.question || DEFAULT_QUESTION })
  } catch (error) {
    console.error('Failed to get security question:', error)
    res.status(500).json({ error: 'Unable to fetch security question' })
  }
})

// PUBLIC: POST /api/security-gate/verify
router.post('/verify', async (req, res) => {
  try {
    const { answer, company_website_url } = req.body
    const clientIp = getRequestIp(req)

    // Phase 1: Invisible Honeypot check - silently reject scrapers/autofill bots
    if (company_website_url && company_website_url.trim() !== '') {
      return res.status(400).json({ error: 'Invalid submission' })
    }

    if (!answer || typeof answer !== 'string') {
      return res.status(400).json({ error: 'Answer is required' })
    }

    const config = await getSecurityGateConfig()
    if (isIpBanned(config.banList, clientIp)) {
      return res.status(403).json({
        success: false,
        error: 'This IP address has been blocked by an administrator.',
        banned: true,
      })
    }

    const isValid = verifyProvidedAnswer(answer, config.hashedAnswers)

    if (isValid) {
      const clearedAttempts = (config.failedAttempts || []).filter(
        (entry) => normalizeIp(entry.ip) !== clientIp
      )

      await persistSecurityGateState({
        ...config,
        failedAttempts: clearedAttempts,
      })

      const gateToken = createGateToken(600)
      return res.json({
        success: true,
        gateToken,
        message: 'Verification successful',
      })
    }

    const nextState = {
      ...config,
      reports: [...(config.reports || [])],
      failedAttempts: [...(config.failedAttempts || [])],
      banList: [...(config.banList || [])],
    }

    const result = recordFailedAttempt({
      state: nextState,
      ip: clientIp,
      userAgent: req.headers['user-agent'] || '',
      now: Date.now(),
      windowMs: 15 * 60 * 1000,
      triggerCount: 5,
    })

    await persistSecurityGateState(nextState)

    if (result.triggeredReport) {
      return res.status(429).json({
        success: false,
        error: 'Five incorrect answers have been reported to the admin for review. An administrator can approve or clear the IP ban.',
        pendingReview: true,
        reportId: result.report?.id,
      })
    }

    return res.status(401).json({
      success: false,
      error: 'Incorrect answer. Please try again.',
    })
  } catch (error) {
    console.error('Security gate verification error:', error)
    res.status(500).json({ error: 'Verification error' })
  }
})

// ADMIN ONLY: GET /api/security-gate/admin
router.get('/admin', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const config = await getSecurityGateConfig()
    res.json({
      question: config.question,
      rawAnswersStr: config.rawAnswersStr || DEFAULT_ANSWERS_STR,
      banList: config.banList || [],
      reports: [...(config.reports || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    })
  } catch (error) {
    res.status(500).json({ error: 'Unable to fetch admin security config' })
  }
})

// ADMIN ONLY: PATCH /api/security-gate/admin
router.patch('/admin', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { question, answers } = req.body
    if (!question || !answers) {
      return res.status(400).json({ error: 'Question and acceptable answers are required' })
    }

    const config = await getSecurityGateConfig()
    const hashedAnswers = hashAnswersList(answers)

    const updated = await SystemConfig.findOneAndUpdate(
      { key: 'securityGate' },
      {
        key: 'securityGate',
        value: {
          ...config,
          question: question.trim(),
          rawAnswersStr: answers.trim(),
          hashedAnswers,
        },
      },
      { new: true, upsert: true }
    )

    res.json({
      question: updated.value.question,
      rawAnswersStr: updated.value.rawAnswersStr,
      banList: updated.value.banList || [],
      reports: updated.value.reports || [],
    })
  } catch (error) {
    console.error('Failed to update security gate config:', error)
    res.status(500).json({ error: 'Unable to update security gate settings' })
  }
})

router.get('/admin/reports', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const config = await getSecurityGateConfig()
    res.json({
      reports: [...(config.reports || [])].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
      banList: config.banList || [],
    })
  } catch (error) {
    console.error('Failed to fetch security gate reports:', error)
    res.status(500).json({ error: 'Unable to fetch security gate reports' })
  }
})

router.patch('/admin/reports/:reportId', verifyFirebaseToken, requireAdmin, async (req, res) => {
  try {
    const { reportId } = req.params
    const { decision, note } = req.body

    if (!['red', 'green'].includes(String(decision || '').trim().toLowerCase())) {
      return res.status(400).json({ error: 'Decision must be either red or green.' })
    }

    const config = await getSecurityGateConfig()
    const state = {
      ...config,
      banList: [...(config.banList || [])],
      reports: [...(config.reports || [])],
      failedAttempts: [...(config.failedAttempts || [])],
    }

    const result = applyReportDecision({
      state,
      reportId,
      decision,
      note: note || '',
    })

    if (!result.updated) {
      return res.status(404).json({ error: result.reason })
    }

    await persistSecurityGateState(state)

    res.json({
      report: result.report,
      banList: state.banList,
      reports: state.reports,
    })
  } catch (error) {
    console.error('Failed to update security gate report:', error)
    res.status(500).json({ error: 'Unable to update security gate report' })
  }
})

export default router
