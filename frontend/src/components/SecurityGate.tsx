import { useState, useEffect, useRef } from 'react'
import { ShieldCheck, AlertTriangle, Clock } from 'lucide-react'
import { BACKEND_URL } from '../config'
import ThemeToggle from './ThemeToggle'

interface SecurityGateProps {
  onPassed: (gateToken: string) => void
}

export default function SecurityGate({ onPassed }: SecurityGateProps) {
  const [question, setQuestion] = useState<string>('')
  const [answer, setAnswer] = useState<string>('')
  const [honeypot, setHoneypot] = useState<string>('') // Phase 1: Invisible Honeypot
  const [loading, setLoading] = useState<boolean>(true)
  const [verifying, setVerifying] = useState<boolean>(false)
  const [error, setError] = useState<string>('')

  // Phase 2: Dynamic server-side rate limit countdown
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number>(0)
  const [attemptsUsed, setAttemptsUsed] = useState<number>(0)
  const timerRef = useRef<any>(null)

  const maxAttempts = 5

  useEffect(() => {
    const fetchQuestion = async () => {
      setLoading(true)
      try {
        const res = await fetch(`${BACKEND_URL}/api/security-gate/question`)
        if (res.ok) {
          const data = await res.json()
          setQuestion(data.question)
        } else {
          setQuestion('What software platform does KanbanKC belong to?')
        }
      } catch (err) {
        setQuestion('What software platform does KanbanKC belong to?')
      } finally {
        setLoading(false)
      }
    }
    fetchQuestion()
  }, [])

  // Countdown timer for 429 rate limit
  useEffect(() => {
    if (rateLimitSeconds > 0) {
      timerRef.current = setInterval(() => {
        setRateLimitSeconds((prev) => {
          if (prev <= 1) {
            clearInterval(timerRef.current)
            setAttemptsUsed(0)
            setError('')
            return 0
          }
          return prev - 1
        })
      }, 1000)
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [rateLimitSeconds])

  const formatCountdown = (seconds: number) => {
    const mins = Math.floor(seconds / 60)
    const secs = seconds % 60
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`
  }

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (rateLimitSeconds > 0 || verifying || !answer.trim()) return

    setVerifying(true)
    setError('')

    try {
      const res = await fetch(`${BACKEND_URL}/api/security-gate/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          answer: answer.trim(),
          company_website_url: honeypot, // Honeypot payload
        }),
      })

      if (res.status === 429) {
        const data = await res.json().catch(() => ({}))
        const retryAfter = data.retryAfter || 900
        setRateLimitSeconds(retryAfter)
        setAttemptsUsed(maxAttempts)
        setError(`Rate limit reached: Too many failed attempts. Please wait ${formatCountdown(retryAfter)} before trying again.`)
        return
      }

      const data = await res.json()
      if (data.success && data.gateToken) {
        sessionStorage.setItem('securityGatePassed', 'true')
        sessionStorage.setItem('gateToken', data.gateToken)
        onPassed(data.gateToken)
      } else {
        const nextUsed = attemptsUsed + 1
        setAttemptsUsed(nextUsed)
        if (nextUsed >= maxAttempts) {
          setRateLimitSeconds(900) // 15-minute cooldown
          setError(`Rate limit reached. Please wait ${formatCountdown(900)} before trying again.`)
        } else {
          setError(data.error || `Incorrect answer. ${maxAttempts - nextUsed} attempt(s) remaining.`)
        }
      }
    } catch (err) {
      setError('Verification network error. Please try again.')
    } finally {
      setVerifying(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4 relative">
      <div className="w-full max-w-md">
        <header className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[var(--accent)]/15 text-[var(--accent)] mb-4">
            {rateLimitSeconds > 0 ? <Clock size={32} /> : <ShieldCheck size={32} />}
          </div>
          <h1 className="text-3xl font-bold text-[var(--text1)]">Security Verification</h1>
          <p className="mt-2 text-[var(--text2)] text-sm">
            Anti-bot protection gate. Please answer the security question to access login or registration.
          </p>
        </header>

        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 shadow-xl">
          {loading ? (
            <div className="py-8 text-center text-[var(--text2)] font-medium">Loading security challenge...</div>
          ) : rateLimitSeconds > 0 ? (
            <div className="space-y-4 text-center py-4">
              <div className="p-4 rounded-xl bg-red-500/15 text-red-500 font-bold flex flex-col items-center gap-2">
                <AlertTriangle size={28} />
                <span>Rate Limit Exceeded</span>
                <p className="text-xl font-mono mt-1 font-extrabold text-red-500">
                  {formatCountdown(rateLimitSeconds)}
                </p>
                <p className="text-xs font-normal opacity-90">
                  Maximum 5 failed attempts reached. Inputs will automatically re-enable when the timer expires.
                </p>
              </div>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="flex flex-col gap-5">
              {/* Phase 1: Invisible Honeypot Input */}
              <input
                type="text"
                name="company_website_url"
                tabIndex={-1}
                autoComplete="off"
                style={{ display: 'none' }}
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
              />

              <div className="bg-[var(--bg)] border border-[var(--border)] p-4 rounded-xl">
                <span className="text-xs font-bold text-[var(--accent)] uppercase tracking-wider block mb-1">
                  Security Challenge
                </span>
                <p className="text-sm font-semibold text-[var(--text1)]">{question}</p>
              </div>

              <label className="flex flex-col gap-2 font-semibold text-sm text-[var(--text1)]">
                Your Answer
                <input
                  type="text"
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  placeholder="Type your answer here..."
                  required
                  disabled={verifying}
                  className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                />
              </label>

              <button
                type="submit"
                disabled={verifying || !answer.trim()}
                className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-all duration-200 cursor-pointer disabled:opacity-50"
              >
                {verifying ? 'Verifying...' : 'Verify & Continue'}
              </button>

              <div className="flex justify-between items-center text-xs text-[var(--text2)] pt-2 border-t border-[var(--border)]">
                <span>
                  Attempts remaining:{' '}
                  <strong className="text-[var(--text1)]">
                    {Math.max(0, maxAttempts - attemptsUsed)} / {maxAttempts}
                  </strong>
                </span>
                <span className="text-emerald-500 font-medium">Protected by KanbaKan</span>
              </div>
            </form>
          )}

          {error && rateLimitSeconds === 0 && (
            <div className="mt-4 p-3 rounded-xl bg-red-500/15 text-red-500 font-semibold text-xs text-center">
              {error}
            </div>
          )}
        </div>
      </div>
      <ThemeToggle />
    </div>
  )
}
