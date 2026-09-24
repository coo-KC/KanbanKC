export const normalizeIp = (value = '') => {
  const rawIp = String(value ?? '').trim()
  if (!rawIp) return ''

  const normalized = rawIp
    .split(',')[0]
    .trim()
    .replace(/^::ffff:/i, '')
    .toLowerCase()

  return normalized || ''
}

export const isIpBanned = (banList = [], ip = '') => {
  const normalizedIp = normalizeIp(ip)
  if (!normalizedIp) return false

  return (banList || []).some((entry) => normalizeIp(entry) === normalizedIp)
}

export const createSecurityReport = ({ ip, userAgent, reason }) => ({
  id: `security-report-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
  ip: normalizeIp(ip),
  userAgent: userAgent || '',
  reason: reason || 'Repeated incorrect security answers',
  status: 'pending',
  decision: 'pending',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

export const recordFailedAttempt = ({
  state,
  ip,
  userAgent = '',
  now = Date.now(),
  windowMs = 15 * 60 * 1000,
  triggerCount = 5,
}) => {
  const normalizedIp = normalizeIp(ip)
  if (!normalizedIp) {
    return { triggeredReport: false, report: null }
  }

  const existingAttempts = Array.isArray(state.failedAttempts) ? state.failedAttempts : []
  const recentAttempts = existingAttempts.filter((entry) => {
    const entryIp = normalizeIp(entry.ip)
    const attemptTime = new Date(entry.at).getTime()
    return entryIp === normalizedIp && now - attemptTime < windowMs
  })

  const nextAttempt = {
    ip: normalizedIp,
    at: new Date(now).toISOString(),
    userAgent,
  }

  const updatedAttempts = [...recentAttempts, nextAttempt].slice(-50)
  state.failedAttempts = updatedAttempts

  const triggeredReport = updatedAttempts.length >= triggerCount
  if (!triggeredReport) {
    return { triggeredReport: false, report: null }
  }

  const reportList = Array.isArray(state.reports) ? state.reports : []
  const existingReport = reportList.find(
    (report) => normalizeIp(report.ip) === normalizedIp && report.status === 'pending'
  )

  if (existingReport) {
    return { triggeredReport: true, report: existingReport }
  }

  const report = createSecurityReport({
    ip: normalizedIp,
    userAgent,
    reason: 'Five incorrect security answers were submitted within 15 minutes.',
  })

  state.reports = [...reportList, report]
  return { triggeredReport: true, report }
}

export const applyReportDecision = ({ state, reportId, decision, note = '' }) => {
  const normalizedDecision = String(decision || '').trim().toLowerCase()
  if (!['red', 'green'].includes(normalizedDecision)) {
    return { updated: false, reason: 'Decision must be either red or green.' }
  }

  const reports = Array.isArray(state.reports) ? state.reports : []
  const report = reports.find((entry) => entry.id === reportId)
  if (!report) {
    return { updated: false, reason: 'Report not found.' }
  }

  report.decision = normalizedDecision
  report.status = normalizedDecision === 'red' ? 'banned' : 'cleared'
  report.note = note
  report.updatedAt = new Date().toISOString()

  const banList = Array.isArray(state.banList) ? state.banList : []
  const normalizedIp = normalizeIp(report.ip)

  if (normalizedDecision === 'red') {
    state.banList = Array.from(
      new Set([...banList.map((entry) => normalizeIp(entry)).filter(Boolean), normalizedIp])
    )
  } else {
    state.banList = banList
      .map((entry) => normalizeIp(entry))
      .filter((entry) => entry && entry !== normalizedIp)
  }

  return { updated: true, report }
}
