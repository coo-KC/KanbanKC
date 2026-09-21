import crypto from 'crypto'

const JWT_SECRET = process.env.GATE_JWT_SECRET || 'kanbakan_security_gate_jwt_secret_key_2026'

// Normalize input string: trim, lowercase, collapse multiple spaces
export const normalizeInput = (str) => {
  if (!str || typeof str !== 'string') return ''
  return str.trim().toLowerCase().replace(/\s+/g, ' ')
}

// Hash a normalized answer with PBKDF2
export const hashSingleAnswer = (plainText) => {
  const normalized = normalizeInput(plainText)
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.pbkdf2Sync(normalized, salt, 10000, 64, 'sha512').toString('hex')
  return { salt, hash }
}

// Hash list of comma-separated or array answers
export const hashAnswersList = (answersInput) => {
  let list = []
  if (Array.isArray(answersInput)) {
    list = answersInput
  } else if (typeof answersInput === 'string') {
    list = answersInput.split(',')
  }
  return list
    .map(a => a.trim())
    .filter(Boolean)
    .map(hashSingleAnswer)
}

// Verify a provided answer against stored hashed answers array
export const verifyProvidedAnswer = (providedText, storedAnswers) => {
  const normalizedProvided = normalizeInput(providedText)
  if (!normalizedProvided || !Array.isArray(storedAnswers) || storedAnswers.length === 0) {
    return false
  }

  for (const item of storedAnswers) {
    if (!item.salt || !item.hash) continue
    const computedHash = crypto.pbkdf2Sync(normalizedProvided, item.salt, 10000, 64, 'sha512').toString('hex')
    const bufA = Buffer.from(computedHash, 'hex')
    const bufB = Buffer.from(item.hash, 'hex')
    if (bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB)) {
      return true
    }
  }

  return false
}

// Base64Url helpers for dependency-free JWT
const base64UrlEncode = (str) => {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

const base64UrlDecode = (str) => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/')
  while (base64.length % 4) {
    base64 += '='
  }
  return Buffer.from(base64, 'base64').toString('utf8')
}

// Issue 10-minute gate token JWT
export const createGateToken = (expiresInSeconds = 600) => {
  const header = JSON.stringify({ alg: 'HS256', typ: 'JWT' })
  const now = Math.floor(Date.now() / 1000)
  const payload = JSON.stringify({
    gateCleared: true,
    iat: now,
    exp: now + expiresInSeconds,
  })

  const encodedHeader = base64UrlEncode(header)
  const encodedPayload = base64UrlEncode(payload)
  const signatureInput = `${encodedHeader}.${encodedPayload}`

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  return `${signatureInput}.${signature}`
}

// Verify 10-minute gate token JWT
export const verifyGateToken = (token) => {
  if (!token || typeof token !== 'string') return false
  const parts = token.split('.')
  if (parts.length !== 3) return false

  const [encodedHeader, encodedPayload, signature] = parts
  const signatureInput = `${encodedHeader}.${encodedPayload}`

  const expectedSignature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(signatureInput)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')

  const bufSig = Buffer.from(signature)
  const bufExp = Buffer.from(expectedSignature)

  if (bufSig.length !== bufExp.length || !crypto.timingSafeEqual(bufSig, bufExp)) {
    return false
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload))
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp && payload.exp < now) {
      return false
    }
    return payload.gateCleared === true
  } catch (e) {
    return false
  }
}
