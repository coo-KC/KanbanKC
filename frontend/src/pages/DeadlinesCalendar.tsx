import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auth } from '../firebase'
import { Send, ChevronLeft, ChevronRight, CheckCircle2, Circle } from 'lucide-react'

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const MAX_CHIPS_PER_DAY = 3

const fetchOrgTasks = async () => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/tasks/org`, {
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}` 
    },
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to fetch org tasks')
  return res.json()
}

const fetchComments = async (taskId: string) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}/comments`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to fetch comments')
  return res.json()
}

const postComment = async ({ taskId, content }: { taskId: string, content: string }) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/tasks/${taskId}/comments`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ content }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to post comment')
  return res.json()
}

export default function DeadlinesCalendar() {
  const queryClient = useQueryClient()
  const today = new Date()
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [commentText, setCommentText] = useState('')

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ['orgTasksCalendar'],
    queryFn: fetchOrgTasks
  })

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', selectedTask?._id],
    queryFn: () => fetchComments(selectedTask._id),
    enabled: !!selectedTask,
    refetchInterval: 5000
  })

  const commentMutation = useMutation({
    mutationFn: postComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', selectedTask?._id] })
      setCommentText('')
    }
  })

  // ── Build a lookup: dateString → tasks[] ──
  const tasksByDate = useMemo(() => {
    const map = new Map<string, any[]>()
    tasks.forEach((t: any) => {
      if (!t.dueDate) return
      const key = t.dueDate.split('T')[0] // "YYYY-MM-DD"
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(t)
    })
    return map
  }, [tasks])

  // ── Build the calendar grid cells ──
  const calendarCells = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1)
    const startDayOfWeek = firstDay.getDay() // 0=Sun … 6=Sat
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate()

    // Previous month padding
    const prevMonthDays = new Date(viewYear, viewMonth, 0).getDate()
    const cells: { day: number; month: number; year: number; outside: boolean }[] = []

    for (let i = startDayOfWeek - 1; i >= 0; i--) {
      const d = prevMonthDays - i
      const m = viewMonth === 0 ? 11 : viewMonth - 1
      const y = viewMonth === 0 ? viewYear - 1 : viewYear
      cells.push({ day: d, month: m, year: y, outside: true })
    }

    // Current month
    for (let d = 1; d <= daysInMonth; d++) {
      cells.push({ day: d, month: viewMonth, year: viewYear, outside: false })
    }

    // Next month padding (fill to 42 cells = 6 rows)
    const remaining = 42 - cells.length
    for (let d = 1; d <= remaining; d++) {
      const m = viewMonth === 11 ? 0 : viewMonth + 1
      const y = viewMonth === 11 ? viewYear + 1 : viewYear
      cells.push({ day: d, month: m, year: y, outside: true })
    }

    return cells
  }, [viewYear, viewMonth])

  // ── Upcoming deadlines (next 14 days) ──
  const upcomingTasks = useMemo(() => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const cutoff = new Date(now)
    cutoff.setDate(cutoff.getDate() + 14)

    return tasks
      .filter((t: any) => {
        if (!t.dueDate || t.status === 'completed' || t.status === 'cancelled') return false
        const d = new Date(t.dueDate)
        return d >= now && d <= cutoff
      })
      .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      .slice(0, 10)
  }, [tasks])

  // ── Navigation helpers ──
  const goToPrev = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1) }
    else setViewMonth(viewMonth - 1)
  }
  const goToNext = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1) }
    else setViewMonth(viewMonth + 1)
  }
  const goToToday = () => {
    setViewMonth(today.getMonth())
    setViewYear(today.getFullYear())
  }

  const isToday = (cell: typeof calendarCells[0]) => 
    cell.day === today.getDate() && cell.month === today.getMonth() && cell.year === today.getFullYear()

  const getDateKey = (cell: typeof calendarCells[0]) => {
    const mm = String(cell.month + 1).padStart(2, '0')
    const dd = String(cell.day).padStart(2, '0')
    return `${cell.year}-${mm}-${dd}`
  }

  const getChipClass = (task: any) => {
    if (task.status === 'completed') {
      return 'bg-[var(--text2)]/10 text-[var(--text2)] border-l-[var(--border)] opacity-60'
    }
    switch (task.priority) {
      case 'urgent': return 'bg-red-500/15 text-red-600 dark:text-red-300 border-l-red-500'
      case 'high': return 'bg-orange-500/15 text-orange-600 dark:text-orange-300 border-l-orange-500'
      case 'low': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 border-l-emerald-500'
      case 'medium': 
      default:
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-300 border-l-blue-500'
    }
  }

  const getPriorityBadgeClass = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20'
      case 'high': return 'bg-orange-500/15 text-orange-600 dark:text-orange-400 border border-orange-500/20'
      case 'medium': return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20'
      case 'low': return 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
      default: return 'bg-[var(--text2)]/10 text-[var(--text2)] border border-[var(--border)]'
    }
  }

  const getDaysLeftInfo = (dueDate: string) => {
    const now = new Date()
    now.setHours(0, 0, 0, 0)
    const due = new Date(dueDate)
    due.setHours(0, 0, 0, 0)
    const diff = Math.ceil((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'text-red-500 font-bold' }
    if (diff === 0) return { text: 'Today', cls: 'text-orange-500 font-bold' }
    if (diff === 1) return { text: 'Tomorrow', cls: 'text-orange-500 font-bold' }
    if (diff <= 3) return { text: `${diff} days left`, cls: 'text-orange-500 font-medium' }
    return { text: `${diff} days left`, cls: 'text-[var(--text2)]' }
  }

  if (isLoading) return <div className="p-8 text-[var(--text2)]">Loading Calendar...</div>

  return (
    <div className="flex flex-col h-full min-h-0 gap-6 p-6">
      {/* ── Toolbar ── */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-2xl font-bold text-[var(--text1)]">Deadlines Calendar</h2>
        <div className="flex items-center gap-4">
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
            onClick={goToPrev} 
            title="Previous month"
          >
            <ChevronLeft size={18} />
          </button>
          <span className="text-xl font-bold text-[var(--text1)] min-w-[220px] text-center">
            {MONTH_NAMES[viewMonth]} {viewYear}
          </span>
          <button 
            className="w-10 h-10 flex items-center justify-center rounded-xl bg-[var(--surface)] border border-[var(--border)] text-[var(--text2)] hover:text-[var(--accent)] hover:border-[var(--accent)] transition-all"
            onClick={goToNext} 
            title="Next month"
          >
            <ChevronRight size={18} />
          </button>
          <button 
            className="px-4 py-2 rounded-lg bg-[var(--accent)]/10 text-[var(--accent)] border border-[var(--accent)]/30 font-semibold hover:bg-[var(--accent)]/20 transition-all"
            onClick={goToToday}
          >
            Today
          </button>
        </div>
      </div>

      {/* ── Calendar Grid ── */}
      <div className="flex-1 flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden min-h-[400px]">
        <div className="grid grid-cols-7 border-b border-[var(--border)] bg-[var(--surface)]">
          {DAYS_OF_WEEK.map(d => (
            <div key={d} className="py-3 px-2 text-center text-xs font-bold uppercase tracking-wider text-[var(--text2)]">
              {d}
            </div>
          ))}
        </div>
        <div className="flex-1 grid grid-cols-7 auto-rows-[minmax(100px,1fr)] bg-[var(--surface)]">
          {calendarCells.map((cell, idx) => {
            const key = getDateKey(cell)
            const dayTasks = tasksByDate.get(key) || []
            const visible = dayTasks.slice(0, MAX_CHIPS_PER_DAY)
            const overflow = dayTasks.length - MAX_CHIPS_PER_DAY
            
            const isOutside = cell.outside
            const isCurrentToday = isToday(cell)

            return (
              <div
                key={idx}
                className={`
                  relative border-r border-b border-[var(--border)]/30 p-2 flex flex-col transition-colors hover:bg-[var(--text2)]/5
                  ${isOutside ? 'opacity-30 pointer-events-none' : ''}
                  ${isCurrentToday ? 'bg-[var(--accent)]/5 ring-1 ring-inset ring-[var(--accent)]/20' : ''}
                `}
              >
                <span className={`text-sm font-semibold mb-2 ${isCurrentToday ? 'text-[var(--accent)]' : 'text-[var(--text1)]'}`}>
                  {cell.day}
                </span>
                
                <div className="flex flex-col gap-1 overflow-y-auto pr-1">
                  {visible.map((task: any) => (
                    <div
                      key={task._id}
                      className={`
                        flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium cursor-pointer border-l-2 transition-all hover:translate-x-0.5 truncate
                        ${getChipClass(task)}
                      `}
                      onClick={() => { setSelectedTask(task); setCommentText('') }}
                      title={`${task.title} — ${task.priority}`}
                    >
                      {task.status === 'completed' ? (
                        <CheckCircle2 size={12} className="flex-shrink-0" />
                      ) : (
                        <Circle size={12} className="flex-shrink-0" />
                      )}
                      <span className="truncate">{task.title}</span>
                    </div>
                  ))}
                  {overflow > 0 && (
                    <div className="text-[10px] font-semibold text-[var(--text2)] mt-1 px-1 bg-[var(--text2)]/10 rounded w-fit">
                      +{overflow} more
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Upcoming Deadlines Strip ── */}
      {upcomingTasks.length > 0 && (
        <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-thin">
          {upcomingTasks.map((task: any) => {
            const dl = getDaysLeftInfo(task.dueDate)
            return (
              <div
                key={task._id}
                className="flex-none w-[220px] p-4 bg-[var(--surface)] border border-[var(--border)] rounded-xl cursor-pointer hover:-translate-y-0.5 hover:border-[var(--accent)] transition-all flex flex-col gap-2"
                onClick={() => { setSelectedTask(task); setCommentText('') }}
              >
                <h4 className="text-[var(--text1)] font-semibold truncate" title={task.title}>{task.title}</h4>
                <div className="flex items-center justify-between text-xs mt-auto">
                  <span className={`px-2 py-0.5 rounded-md font-medium uppercase tracking-wider text-[10px] ${getPriorityBadgeClass(task.priority)}`}>
                    {task.priority || 'Medium'}
                  </span>
                  <span className={dl.cls}>{dl.text}</span>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── Task Details + Comments Modal ── */}
      {selectedTask && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4" 
          onClick={() => setSelectedTask(null)}
        >
          <div 
            className="bg-[var(--surface)] rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl border border-[var(--border)]" 
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-[var(--border)]">
              <h3 className="text-xl font-bold text-[var(--text1)]">Task Details</h3>
              <button 
                className="w-8 h-8 flex items-center justify-center rounded-lg text-[var(--text2)] hover:bg-[var(--text2)]/10 hover:text-[var(--text1)] transition-colors"
                onClick={() => setSelectedTask(null)}
              >
                &times;
              </button>
            </div>
            
            {/* Content Body */}
            <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
              
              {/* Task Details Info */}
              <div className="flex-1 overflow-y-auto p-6 border-b md:border-b-0 md:border-r border-[var(--border)] space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Title</label>
                  <p className="text-[var(--text1)] font-medium text-lg mt-1">{selectedTask.title}</p>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Priority</label>
                    <div className="mt-1">
                      <span className={`inline-block px-2 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${getPriorityBadgeClass(selectedTask.priority)}`}>
                        {selectedTask.priority || 'Medium'}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Status</label>
                    <p className="mt-1 text-[var(--text1)] capitalize font-medium">{selectedTask.status?.replace('_', ' ')}</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Assignees</label>
                  <p className="mt-1 text-[var(--text1)]">
                    {selectedTask.assignees && selectedTask.assignees.length > 0 
                      ? selectedTask.assignees.map((a: any) => a.username ? `@${a.username}` : (a.name || a.email)).join(', ') 
                      : 'Unassigned'}
                  </p>
                </div>
                
                <div>
                  <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Deadline</label>
                  <p className="mt-1 text-[var(--text1)]">
                    {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : 'None'}
                  </p>
                </div>

                <div>
                  <label className="text-xs font-semibold text-[var(--text2)] uppercase tracking-wider">Description</label>
                  <div className="mt-1 p-3 bg-[var(--bg)] rounded-lg text-sm text-[var(--text1)] whitespace-pre-wrap border border-[var(--border)]">
                    {selectedTask.description || <em className="text-[var(--text2)]">No details provided.</em>}
                  </div>
                </div>
              </div>

              {/* Comments Section */}
              <div className="flex-1 flex flex-col w-full md:w-80 lg:w-96 bg-[var(--surface)]">
                <div className="p-4 border-b border-[var(--border)] bg-[var(--bg)]/50">
                  <h4 className="font-semibold text-[var(--text1)]">Comments</h4>
                </div>
                
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {comments.length === 0 ? (
                    <p className="text-sm text-[var(--text2)] italic text-center mt-4">No comments yet.</p>
                  ) : (
                    comments.map((comment: any) => (
                      <div key={comment._id} className="bg-[var(--bg)] p-3 rounded-xl border border-[var(--border)]">
                        <div className="flex justify-between items-center mb-1">
                          <strong className="text-sm font-semibold text-[var(--text1)]">
                            {comment.author?.username ? `@${comment.author.username}` : (comment.author?.name || comment.author?.email)}
                          </strong>
                          <span className="text-xs text-[var(--text2)]">
                            {new Date(comment.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-sm text-[var(--text1)] whitespace-pre-wrap">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>

                <form 
                  className="p-4 border-t border-[var(--border)] flex gap-2 bg-[var(--surface)]"
                  onSubmit={(e) => {
                    e.preventDefault()
                    if (!commentText.trim()) return
                    commentMutation.mutate({ taskId: selectedTask._id, content: commentText })
                  }}
                >
                  <input 
                    type="text" 
                    value={commentText} 
                    onChange={e => setCommentText(e.target.value)} 
                    placeholder="Type a comment..." 
                    disabled={commentMutation.isPending}
                    className="flex-1 bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-sm text-[var(--text1)] focus:outline-none focus:border-[var(--accent)] transition-colors placeholder:text-[var(--text2)] disabled:opacity-50"
                  />
                  <button 
                    type="submit" 
                    disabled={commentMutation.isPending || !commentText.trim()} 
                    className="w-10 h-10 flex items-center justify-center bg-[var(--accent)] text-white rounded-xl hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    <Send size={16} />
                  </button>
                </form>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
