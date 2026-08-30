import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auth } from '../firebase'
import { ChevronLeft, ChevronRight, Plus, Clock, MapPin, X, Trash2 } from 'lucide-react'
import { BACKEND_URL } from '../config'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MAX_CHIPS = 3

const fetchEvents = async () => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/events`, {
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to fetch events')
  return res.json()
}

const createEvent = async (data: { title: string; description: string; eventType: string; date: string; deadline?: string }) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/events`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to create event')
  }
  return res.json()
}

export default function PlanningHub() {
  const queryClient = useQueryClient()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedEvent, setSelectedEvent] = useState<any>(null)
  const [showCreateModal, setShowCreateModal] = useState(false)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['events'],
    queryFn: fetchEvents
  })

  const createMutation = useMutation({
    mutationFn: createEvent,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] })
      setShowCreateModal(false)
    },
    onError: (err: any) => alert(err.message)
  })

  // ── Build date → events lookup ──
  const eventsByDate = useMemo(() => {
    const map = new Map<string, any[]>()
    events.forEach((ev: any) => {
      if (!ev.date) return
      const key = ev.date.split('T')[0]
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(ev)
    })
    return map
  }, [events])

  // ── Calendar grid ──
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startDow = firstDay.getDay()
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()
    const prevDays = new Date(viewYear, viewMonth, 0).getDate()

    const cells: { day: number; month: number; year: number; outside: boolean }[] = []

    for (let i = startDow - 1; i >= 0; i--) {
      const d = prevDays - i
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ day: d, month: m, year: y, outside: true })
    }
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, outside: false })
    }
    const rem = 42 - cells.length
    for (let d = 1; d <= rem; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, month: m, year: y, outside: true })
    }
    return cells
  }, [viewYear, viewMonth])

  // ── Upcoming events (next 30 days) ──
  const upcomingEvents = useMemo(() => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const cutoff = new Date(now); cutoff.setDate(cutoff.getDate() + 30)
    return events
      .filter((ev: any) => {
        if (!ev.date) return false
        const d = new Date(ev.date)
        return d >= now && d <= cutoff
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 10)
  }, [events])

  // ── Navigation ──
  const goToPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  const goToNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }
  const goToToday = () => { setViewMonth(today.getMonth()); setViewYear(today.getFullYear()) }

  const isToday = (cell: typeof calendarCells[0]) =>
    cell.day === today.getDate() && cell.month === today.getMonth() && cell.year === today.getFullYear()

  const getDateKey = (cell: typeof calendarCells[0]) => {
    const mm = String(cell.month + 1).padStart(2, '0')
    const dd = String(cell.day).padStart(2, '0')
    return `${cell.year}-${mm}-${dd}`
  }

  const getDaysUntil = (dateStr: string) => {
    const now = new Date(); now.setHours(0, 0, 0, 0)
    const d = new Date(dateStr); d.setHours(0, 0, 0, 0)
    const diff = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { text: `${Math.abs(diff)}d ago`, cls: 'text-red-400' }
    if (diff === 0) return { text: 'Today', cls: 'text-amber' }
    if (diff === 1) return { text: 'Tomorrow', cls: 'text-amber' }
    if (diff <= 7) return { text: `${diff} days`, cls: 'text-[var(--accent)]' }
    return { text: `${diff} days`, cls: 'text-[var(--text2)]' }
  }

  const handleCreateSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    createMutation.mutate({
      title: fd.get('title') as string,
      description: fd.get('description') as string,
      eventType: fd.get('eventType') as string,
      date: fd.get('date') as string,
      deadline: (fd.get('deadline') as string) || undefined
    })
  }

  if (isLoading) return <div className="p-8 text-[var(--text2)]">Loading Events...</div>

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ── */}
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[var(--text1)]">Events Hub</h2>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-3">
            <button className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] flex items-center justify-center hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all duration-200 cursor-pointer" onClick={goToPrev}>
              <ChevronLeft size={18} />
            </button>
            <span className="text-xl font-bold text-[var(--text1)] min-w-[220px] text-center">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] flex items-center justify-center hover:text-[var(--accent)] hover:border-[var(--accent)]/40 transition-all duration-200 cursor-pointer" onClick={goToNext}>
              <ChevronRight size={18} />
            </button>
            <button className="px-4 py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 text-sm font-semibold hover:bg-[var(--accent)]/20 transition-all duration-200 cursor-pointer" onClick={goToToday}>Today</button>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-all duration-200 cursor-pointer"
            onClick={() => setShowCreateModal(true)}
          >
            <Plus size={16} /> New Event
          </button>
        </div>
      </div>

      {/* ── Calendar Grid ── */}
      <div className="flex-1 bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden flex flex-col">
        <div className="grid grid-cols-7 border-b border-[var(--border)]">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="py-3 px-2 text-center text-xs font-bold uppercase tracking-wider text-[var(--text2)]">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 flex-1" style={{ gridAutoRows: '1fr' }}>
          {calendarCells.map((cell, idx) => {
            const key = getDateKey(cell)
            const dayEvents = eventsByDate.get(key) || []
            const visible = dayEvents.slice(0, MAX_CHIPS)
            const overflow = dayEvents.length - MAX_CHIPS

            return (
              <div
                key={idx}
                className={`relative border-r border-b border-[var(--border)]/30 p-2 min-h-[100px] flex flex-col transition-colors duration-150
                  ${cell.outside ? 'opacity-30 pointer-events-none' : ''}
                  ${isToday(cell) ? 'bg-[var(--accent)]/5 ring-1 ring-inset ring-[var(--accent)]/20' : 'hover:bg-[var(--border)]/20'}`}
              >
                <span className={`text-sm font-semibold mb-1.5 select-none ${isToday(cell) ? 'text-[var(--accent)] font-bold' : 'text-[var(--text2)]'}`}>
                  {cell.day}
                </span>
                <div className="flex flex-col gap-1 overflow-y-auto flex-1">
                  {visible.map((ev: any) => (
                    <div
                      key={ev._id}
                      className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-medium cursor-pointer transition-all duration-150 hover:translate-x-0.5
                        bg-[var(--accent2)]/15 text-[var(--accent2)] border-l-2 border-l-[var(--accent2)]"
                      onClick={() => setSelectedEvent(ev)}
                      title={ev.title}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent2)] flex-shrink-0" />
                      <span className="truncate">{ev.title}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[10px] text-[var(--text2)] text-center">+{overflow} more</div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Upcoming Events Strip ── */}
      {upcomingEvents.length > 0 && (
        <div className="flex gap-3 overflow-x-auto mt-5 pb-2">
          {upcomingEvents.map((ev: any) => {
            const dl = getDaysUntil(ev.date)
            return (
              <div
                key={ev._id}
                className="flex-none w-[220px] p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl cursor-pointer hover:-translate-y-0.5 hover:border-[var(--accent)] transition-all duration-200"
                onClick={() => setSelectedEvent(ev)}
              >
                <h4 className="font-semibold text-sm text-[var(--text1)] truncate mb-1.5">{ev.title}</h4>
                <div className="flex justify-between text-[11px]">
                  <span className="text-[var(--text2)] capitalize">{ev.eventType || 'Event'}</span>
                  <span className={`font-semibold ${dl.cls}`}>{dl.text}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Create Event Modal ── */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowCreateModal(false)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[var(--text1)]">Create New Event</h3>
              <button className="text-[var(--text2)] hover:text-[var(--text1)] transition-colors cursor-pointer" onClick={() => setShowCreateModal(false)}>
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                Event Title
                <input name="title" required className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                Description
                <textarea name="description" rows={3} placeholder="Event details..." className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 resize-none focus:outline-none focus:border-[var(--accent)] transition-colors" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                Event Type
                <select name="eventType" className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer">
                  <option value="meeting">Meeting</option>
                  <option value="workshop">Workshop</option>
                  <option value="celebration">Celebration</option>
                  <option value="deadline">Deadline</option>
                  <option value="sprint_review">Sprint Review</option>
                  <option value="webinar">Webinar</option>
                  <option value="all_hands">All Hands</option>
                  <option value="roadmap">Roadmap</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                Date
                <input type="date" name="date" required className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer" />
              </label>
              <label className="flex flex-col gap-2 text-sm font-semibold text-[var(--text1)]">
                Deadline (Optional)
                <input type="date" name="deadline" className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:border-[var(--accent)] transition-colors cursor-pointer" />
              </label>
              <div className="flex justify-end gap-3 mt-2">
                <button type="button" onClick={() => setShowCreateModal(false)} className="px-4 py-2.5 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text2)] font-medium hover:text-[var(--text1)] transition-all cursor-pointer">
                  Cancel
                </button>
                <button type="submit" disabled={createMutation.isPending} className="px-6 py-2.5 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-all disabled:opacity-50 cursor-pointer">
                  {createMutation.isPending ? 'Creating...' : 'Create Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Event Details Modal ── */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setSelectedEvent(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-lg font-bold text-[var(--text1)]">Event Details</h3>
              <div className="flex items-center gap-2">
                <button
                  className="p-2 text-[var(--text2)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all cursor-pointer"
                  title="Delete event"
                  onClick={async (e) => {
                    e.stopPropagation()
                    if (!confirm('Are you sure you want to delete this event?')) return
                    try {
                      const token = await auth.currentUser?.getIdToken()
                      const res = await fetch(`${BACKEND_URL}/api/events/${selectedEvent._id}`, {
                        method: 'DELETE',
                        headers: { Authorization: `Bearer ${token}` },
                        credentials: 'include'
                      })
                      if (res.ok) {
                        queryClient.invalidateQueries({ queryKey: ['events'] })
                        setSelectedEvent(null)
                      } else {
                        alert('Failed to delete event')
                      }
                    } catch { alert('Failed to delete event') }
                  }}
                >
                  <Trash2 size={16} />
                </button>
                <button className="text-[var(--text2)] hover:text-[var(--text1)] transition-colors cursor-pointer" onClick={() => setSelectedEvent(null)}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div className="flex flex-col gap-4 text-[var(--text1)]">
              <div>
                <p className="text-xs text-[var(--text2)] uppercase tracking-wider font-semibold mb-1">Title</p>
                <p className="text-lg font-semibold">{selectedEvent.title}</p>
              </div>

              {selectedEvent.description && (
                <div>
                  <p className="text-xs text-[var(--text2)] uppercase tracking-wider font-semibold mb-1">Description</p>
                  <div className="bg-[var(--bg)] border border-[var(--border)] rounded-xl p-4 text-sm whitespace-pre-wrap">
                    {selectedEvent.description}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--text2)] uppercase tracking-wider font-semibold mb-1">Date</p>
                  <p className="flex items-center gap-2 text-sm">
                    <Clock size={14} className="text-[var(--accent)]" />
                    {new Date(selectedEvent.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-[var(--text2)] uppercase tracking-wider font-semibold mb-1">Type</p>
                  <p className="flex items-center gap-2 text-sm capitalize">
                    <MapPin size={14} className="text-[var(--accent2)]" />
                    {selectedEvent.eventType || 'Event'}
                  </p>
                </div>
              </div>

              {selectedEvent.deadline && (
                <div>
                  <p className="text-xs text-[var(--text2)] uppercase tracking-wider font-semibold mb-1">Deadline</p>
                  <p className="flex items-center gap-2 text-sm">
                    <Clock size={14} className="text-red-400" />
                    {new Date(selectedEvent.deadline).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-xs text-[var(--text2)] uppercase tracking-wider font-semibold mb-1">Status</p>
                  <span className={`text-xs px-3 py-1 rounded-full font-semibold inline-block
                    ${selectedEvent.status === 'published' ? 'bg-emerald-500/15 text-emerald-500' : 'bg-amber/20 text-amber'}`}>
                    {selectedEvent.status}
                  </span>
                </div>
                {selectedEvent.createdBy && (
                  <div>
                    <p className="text-xs text-[var(--text2)] uppercase tracking-wider font-semibold mb-1">Created By</p>
                    <p className="text-sm">{selectedEvent.createdBy.name || selectedEvent.createdBy.email}</p>
                  </div>
                )}
              </div>

              {(() => {
                const dl = getDaysUntil(selectedEvent.date)
                return (
                  <div className={`text-center py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] font-semibold text-sm ${dl.cls}`}>
                    {dl.text === 'Today' ? '🎉 This event is today!' :
                     dl.text === 'Tomorrow' ? '📅 This event is tomorrow!' :
                     dl.text.includes('ago') ? `⏰ This event was ${dl.text}` :
                     `📅 ${dl.text} until this event`}
                  </div>
                )
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
