import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft, Shield, Trash2 } from 'lucide-react'
import { auth } from '../firebase'
import { BACKEND_URL } from '../config'

function AdminSecurity() {
  const navigate = useNavigate()
  const [question, setQuestion] = useState('')
  const [answers, setAnswers] = useState('')
  const [reports, setReports] = useState<any[]>([])
  const [banList, setBanList] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [workingId, setWorkingId] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const fetchAdminSecurity = async () => {
    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${BACKEND_URL}/api/security-gate/admin`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (!res.ok) {
        throw new Error('Failed to load admin security settings')
      }

      const data = await res.json()
      setQuestion(data.question || '')
      setAnswers(data.rawAnswersStr || '')
      setReports(data.reports || [])
      setBanList(data.banList || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAdminSecurity()
  }, [])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setMessage('')
    setError('')

    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${BACKEND_URL}/api/security-gate/admin`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question, answers }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update security gate config')
      }

      setMessage('Bot Security Gate updated successfully! (Answers securely hashed)')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDecision = async (reportId: string, decision: 'red' | 'green') => {
    setWorkingId(reportId)
    setMessage('')
    setError('')

    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${BACKEND_URL}/api/security-gate/admin/reports/${reportId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ decision, note: decision === 'red' ? 'Confirmed abusive IP' : 'Mistaken report cleared' }),
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to update report')
      }

      const data = await res.json()
      setReports(data.reports || [])
      setBanList(data.banList || [])
      setMessage(decision === 'red' ? 'IP was permanently banned.' : 'IP ban was removed.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setWorkingId('')
    }
  }

  const handleClearLogHistory = async () => {
    setMessage('')
    setError('')

    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${BACKEND_URL}/api/security-gate/admin/reports`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to clear report history')
      }

      const data = await res.json()
      setReports(data.reports || [])
      setBanList(data.banList || [])
      setMessage('Security log history cleared successfully.')
    } catch (err: any) {
      setError(err.message)
    }
  }

  const handleDeleteBannedIp = async (ip: string) => {
    if (!window.confirm(`Permanently remove ${ip} from the IP ban list?`)) return

    setWorkingId(`ban:${ip}`)
    setMessage('')
    setError('')

    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${BACKEND_URL}/api/security-gate/admin/bans/${encodeURIComponent(ip)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to remove banned IP')
      }

      const data = await res.json()
      setBanList(data.banList || [])
      setMessage(`${ip} was permanently removed from the ban list.`)
    } catch (err: any) {
      setError(err.message)
    } finally {
      setWorkingId('')
    }
  }

  const handleDeleteAllBans = async () => {
    if (banList.length === 0 || !window.confirm('Permanently remove all IP addresses from the ban list?')) return

    setWorkingId('all-bans')
    setMessage('')
    setError('')

    try {
      const token = await auth.currentUser?.getIdToken()
      const res = await fetch(`${BACKEND_URL}/api/security-gate/admin/bans`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
        credentials: 'include',
      })

      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to remove banned IP addresses')
      }

      const data = await res.json()
      setBanList(data.banList || [])
      setMessage('All IP addresses were permanently removed from the ban list.')
    } catch (err: any) {
      setError(err.message)
    } finally {
      setWorkingId('')
    }
  }

  if (loading) {
    return <div className="p-8 text-[var(--text1)] font-medium">Loading security settings...</div>
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text1)] flex items-center gap-2">
            <Shield className="text-[var(--accent)]" size={26} /> Security Administration
          </h1>
          <p className="text-sm text-[var(--text2)] mt-1">
            Manage the bot challenge, review suspicious IP activity, and maintain the abuse log history.
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/admin')}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-[var(--border)] bg-[var(--bg)] text-[var(--text1)] font-semibold hover:bg-[var(--border)]/50 transition-all"
        >
          <ArrowLeft size={16} /> Back to Admin
        </button>
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[var(--text1)] mb-1">Bot Security Gate Settings</h2>
        <p className="text-sm text-[var(--text2)] mb-5">
          Customize the challenge question and acceptable answers. Answers are securely stored as salted PBKDF2 hashes.
        </p>

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            Security Question
            <input
              type="text"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3"
              placeholder="e.g. What software platform does KanbaKan belong to?"
              required
            />
          </label>

          <label className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            Acceptable Answers (Comma-separated aliases)
            <input
              type="text"
              value={answers}
              onChange={(e) => setAnswers(e.target.value)}
              className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3"
              placeholder="e.g. KanbaKan, kanbakan, Kanban"
              required
            />
          </label>

          <button
            type="submit"
            disabled={saving}
            className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
          >
            {saving ? 'Updating Gate Settings...' : 'Save Security Challenge Settings'}
          </button>
        </form>

        {message && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold text-sm">
            {message}
          </div>
        )}
        {error && (
          <div className="mt-4 p-3 rounded-xl bg-red-500/15 text-red-500 font-semibold text-sm">
            {error}
          </div>
        )}
      </div>

      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
          <div>
            <h2 className="text-lg font-bold text-[var(--text1)]">Security Gate Abuse Review</h2>
            <p className="text-sm text-[var(--text2)]">
              Reviews are created automatically after repeated wrong answers from the same IP. Mark a report as red to permanently ban the IP or green to clear a mistaken flag.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearLogHistory}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-500 font-semibold hover:bg-red-500/20 transition-all"
          >
            <Trash2 size={16} /> Clear Report History
          </button>
        </div>

        <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--bg)] p-3">
          <div className="flex items-center justify-between gap-3 mb-2">
            <div className="text-xs uppercase tracking-wider text-[var(--text2)] font-bold">Permanent bans</div>
            <button
              type="button"
              onClick={handleDeleteAllBans}
              disabled={banList.length === 0 || workingId !== ''}
              className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-500 hover:bg-red-500/20 disabled:opacity-50"
            >
              <Trash2 size={14} /> Delete All IP Bans
            </button>
          </div>
          {banList.length === 0 ? (
            <span className="text-sm text-[var(--text2)]">No banned IP addresses.</span>
          ) : (
            <div className="flex flex-wrap gap-2">
              {banList.map((ip) => (
                <span key={ip} className="inline-flex items-center gap-1 rounded-full border border-red-500/30 bg-red-500/10 pl-2 py-1 text-xs font-semibold text-red-500">
                  {ip}
                  <button
                    type="button"
                    onClick={() => handleDeleteBannedIp(ip)}
                    disabled={workingId !== ''}
                    aria-label={`Permanently remove ${ip} from the ban list`}
                    title={`Remove ${ip} from ban list`}
                    className="rounded-full p-1 hover:bg-red-500/20 disabled:opacity-50"
                  >
                    <Trash2 size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {reports.length === 0 ? (
          <div className="rounded-xl border border-dashed border-[var(--border)] p-6 text-center text-sm text-[var(--text2)]">
            No abuse reports yet.
          </div>
        ) : (
          <div className="space-y-3">
            {reports.map((report) => (
              <div key={report.id} className="rounded-xl border border-[var(--border)] bg-[var(--bg)] p-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-bold text-[var(--text1)]">IP: {report.ip}</div>
                    <div className="text-xs text-[var(--text2)]">
                      {new Date(report.createdAt).toLocaleString()} • {report.status}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={workingId === report.id}
                      onClick={() => handleDecision(report.id, 'green')}
                      className="px-3 py-2 rounded-xl border border-emerald-500/40 bg-emerald-500/10 text-emerald-600 font-semibold text-xs hover:opacity-90 disabled:opacity-50"
                    >
                      {workingId === report.id ? 'Updating...' : 'Green'}
                    </button>
                    <button
                      type="button"
                      disabled={workingId === report.id}
                      onClick={() => handleDecision(report.id, 'red')}
                      className="px-3 py-2 rounded-xl border border-red-500/40 bg-red-500/10 text-red-500 font-semibold text-xs hover:opacity-90 disabled:opacity-50"
                    >
                      {workingId === report.id ? 'Updating...' : 'Red'}
                    </button>
                  </div>
                </div>
                <p className="mt-3 text-sm text-[var(--text2)]">{report.reason}</p>
                {report.userAgent && <p className="mt-2 text-[11px] text-[var(--text2)]">User-Agent: {report.userAgent}</p>}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default AdminSecurity
