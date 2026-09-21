import express from 'express'
import rateLimit from 'express-rate-limit'
import SystemConfig from '../models/SystemConfig.js'
import { requireAdmin } from '../middleware/rbac.js'
import { verifyFirebaseToken } from '../middleware/auth.js'
import {
  hashAnswersList,
  verifyProvidedAnswer,
  createGateToken,
  normalizeInput,
} from '../utils/security.js'

const router = express.Router()

const DEFAULT_QUESTION = 'What software platform does KanbanKC belong to?'
const DEFAULT_ANSWERS_STR = 'KanbaKan, kanbakan, Kanban'

// Rate limiting: 5 failed verification attempts per 15 minutes per IP
const securityGateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    const retryAfterSeconds = Math.ceil(15 * 60)
    res.setHeader('Retry-After', retryAfterSeconds)
    res.status(429).json({
      error: 'Too many failed verification attempts. Rate limit exceeded.',
      retryAfter: retryAfterSeconds,
    })
  },
})

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
      },
    })
  }
  return config.value
}

// PUBLIC: GET /api/security-gate/question
router.get('/question', async (req, res) => {
  try {
    const config = await getSecurityGateConfig()
    res.json({ question: config.question || DEFAULT_QUESTION })
  } catch (error) {
    console.error('Failed to get security question:', error)
    res.status(500).json({ error: 'Unable to fetch security question' })
  }
})

// PUBLIC: POST /api/security-gate/verify
router.post('/verify', securityGateLimiter, async (req, res) => {
  try {
    const { answer, company_website_url } = req.body

    // Phase 1: Invisible Honeypot check - silently reject scrapers/autofill bots
    if (company_website_url && company_website_url.trim() !== '') {
      return res.status(400).json({ error: 'Invalid submission' })
    }

    if (!answer || typeof answer !== 'string') {
      return res.status(400).json({ error: 'Answer is required' })
    }

    const config = await getSecurityGateConfig()
    const isValid = verifyProvidedAnswer(answer, config.hashedAnswers)

    if (isValid) {
      // Phase 4: Issue signed 10-minute temporary gate passage token
      const gateToken = createGateToken(600)
      return res.json({
        success: true,
        gateToken,
        message: 'Verification successful',
      })
    } else {
      return res.status(401).json({
        success: false,
        error: 'Incorrect answer. Please try again.',
      })
    }
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

    const hashedAnswers = hashAnswersList(answers)

    const updated = await SystemConfig.findOneAndUpdate(
      { key: 'securityGate' },
      {
        value: {
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
    })
  } catch (error) {
    console.error('Failed to update security gate config:', error)
    res.status(500).json({ error: 'Unable to update security gate settings' })
  }
})

export default router
