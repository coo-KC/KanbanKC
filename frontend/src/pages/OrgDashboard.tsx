import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { auth } from '../firebase'
import { MessageSquare, Trash2, Edit, Send, Plus, Link2, LayoutDashboard } from 'lucide-react'
import { BACKEND_URL } from '../config'

const fetchOrgTasks = async (filters: Record<string, any>) => {
  const token = await auth.currentUser?.getIdToken()
  const cleanFilters: Record<string, string> = {}
  if (filters.status) cleanFilters.status = filters.status
  if (filters.priority) cleanFilters.priority = filters.priority
  if (filters.assignee) cleanFilters.assignee = filters.assignee
  if (filters.supervisedOnly) cleanFilters.supervisedOnly = 'true'

  const params = new URLSearchParams(cleanFilters)
  const res = await fetch(`${BACKEND_URL}/api/tasks/org?${params.toString()}`, {
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}` 
    },
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to fetch org tasks')
  return res.json()
}

const fetchUsers = async () => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { 
      Authorization: `Bearer ${token}` 
    },
    credentials: 'include'
  })
  if (!res.ok) {
    if (res.status === 403) return [] 
    throw new Error('Failed to fetch users')
  }
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

const updateTaskStatus = async ({ id, status, updatedAt }: { id: string, status: string, updatedAt: string }) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/tasks/${id}/status`, {
    method: 'PATCH',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ status, updatedAt }),
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to update status')
  return res.json()
}

const updateTask = async ({ id, taskData }: { id: string, taskData: any }) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/tasks/${id}`, {
    method: 'PATCH',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskData),
    credentials: 'include'
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || 'Failed to update task')
  }
  return res.json()
}

const deleteTask = async (id: string) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/tasks/${id}`, {
    method: 'DELETE',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}` 
    },
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to delete task')
  return res.json()
}

const STATUSES = ['todo', 'in_progress', 'halted', 'completed', 'cancelled']

export default function OrgDashboard() {
  const queryClient = useQueryClient()
  const [filters, setFilters] = useState<{ status: string; priority: string; assignee: string; supervisedOnly: boolean }>({
    status: '',
    priority: '',
    assignee: '',
    supervisedOnly: false,
  })
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [commentText, setCommentText] = useState('')
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null)
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null)

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUserUid(user?.uid || null)
    })
    return () => unsubscribe()
  }, [])
  
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['orgTasks', filters],
    queryFn: () => fetchOrgTasks(filters),
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  // Deduce role from users list if possible, or we just trust the backend rules
  useEffect(() => {
    if (users.length > 0 && currentUserUid) {
      const me = users.find((u: any) => u.uid === currentUserUid)
      if (me) setCurrentUserRole(me.role)
    }
  }, [users, currentUserUid])

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', selectedTask?._id],
    queryFn: () => fetchComments(selectedTask._id),
    enabled: !!selectedTask,
  })

  const statusMutation = useMutation({
    mutationFn: updateTaskStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orgTasks'] }),
    onError: (err: any) => alert(err.message)
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['orgTasks'] }),
    onError: (err: any) => alert(err.message)
  })

  const editMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orgTasks'] })
      setEditingTask(null)
    },
    onError: (err: any) => alert(err.message)
  })

  const commentMutation = useMutation({
    mutationFn: postComment,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comments', selectedTask?._id] })
      setCommentText('')
    }
  })

  const [editAssigneeSelects, setEditAssigneeSelects] = useState<{id: number, value: string}[]>([])

  const handleEditTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const assigneeIds = fd.getAll('assigneeIds').filter(id => id.toString().trim() !== '')
    editMutation.mutate({
      id: editingTask._id,
      taskData: {
        title: fd.get('title'),
        description: fd.get('description') || '',
        priority: fd.get('priority'),
        assigneeIds,
        dueDate: fd.get('dueDate') || undefined,
        link: fd.get('link') || '',
        updatedAt: editingTask.updatedAt
      }
    })
  }

  const handleDeleteTask = (task: any) => {
    if (confirm('Are you sure you want to soft delete this task?')) {
      deleteMutation.mutate(task._id)
    }
  }

  const isStale = (task: any) => {
    if (task.status !== 'halted') return false
    const fortyEightHoursAgo = Date.now() - 48 * 60 * 60 * 1000
    return new Date(task.updatedAt).getTime() < fortyEightHoursAgo
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
      case 'high': return 'bg-orange-100 text-orange-600 dark:bg-orange-900/30 dark:text-orange-400'
      case 'medium': return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400'
      case 'low': return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
      default: return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400'
    }
  }

  if (isLoading) return <div className="p-6 text-[var(--text1)]">Loading Organization Board...</div>
  if (error) return <div className="p-6 text-red-500">Error loading org tasks: {error.message}</div>

  return (
    <div className="h-full flex flex-col bg-[var(--bg)] text-[var(--text1)] overflow-hidden">
      <div className="flex-none p-6 border-b border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h2 className="text-2xl font-bold">Organization Board</h2>
        <div className="flex flex-wrap gap-3">
          <Link
            to="/boards"
            className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
          >
            <LayoutDashboard size={16} /> My Board
          </Link>

          <select
            value={filters.supervisedOnly ? 'supervised' : 'all'}
            onChange={e => setFilters({...filters, supervisedOnly: e.target.value === 'supervised'})}
            className="border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] font-semibold cursor-pointer"
          >
            <option value="all">Whole Organization</option>
            <option value="supervised">Under My Supervision Only</option>
          </select>

          <select 
            value={filters.status} 
            onChange={e => setFilters({...filters, status: e.target.value})}
            className="border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">All Statuses</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
          <select 
            value={filters.priority} 
            onChange={e => setFilters({...filters, priority: e.target.value})}
            className="border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">All Priorities</option>
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
          <select 
            value={filters.assignee} 
            onChange={e => setFilters({...filters, assignee: e.target.value})}
            className="border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-2 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          >
            <option value="">All Assignees</option>
            {users.map((u: any) => (
              <option key={u._id} value={u._id}>
                {u.name || u.email} [{u.role}]
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden p-6">
        <div className="flex gap-6 h-full items-start">
          {STATUSES.map(status => {
            const columnTasks = tasks.filter((t: any) => t.status === status)
            return (
              <div key={status} className="w-80 flex-shrink-0 flex flex-col h-full bg-[var(--surface)] border border-[var(--border)] rounded-2xl overflow-hidden">
                <div className="p-4 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg)]">
                  <h3 className="font-semibold capitalize text-[var(--text1)]">{status.replace('_', ' ')}</h3>
                  <span className="bg-[var(--border)] text-[var(--text2)] text-xs font-bold px-2 py-1 rounded-full">{columnTasks.length}</span>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {columnTasks.map((task: any) => {
                    const isCreator = task.createdBy?.uid === currentUserUid
                    const isAdminOrCgrade = currentUserRole === 'admin' || currentUserRole === 'cgrade'
                    const canModify = isCreator || isAdminOrCgrade
                    const stale = isStale(task)

                    return (
                      <div 
                        key={task._id} 
                        className={`bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 shadow-sm hover:shadow-md transition-all duration-200 cursor-pointer flex flex-col gap-3 ${stale ? 'border-red-500/50 bg-red-50/50 dark:bg-red-900/10' : ''}`}
                        onClick={() => setSelectedTask(task)}
                      >
                        <h4 className="font-medium text-[var(--text1)]">{task.title}</h4>
                        <div className="flex items-center justify-between gap-2">
                          <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(task.priority)}`}>
                            {task.priority}
                          </span>
                          <span className="text-sm text-[var(--text2)] truncate max-w-[120px]" title={task.assignees?.map((a: any) => a.username ? `@${a.username}` : (a.name || a.email)).join(', ')}>
                            {task.assignees && task.assignees.length > 0
                              ? task.assignees.map((a: any) => a.username ? `@${a.username}` : (a.name || a.email)).join(', ') 
                              : 'Unassigned'}
                          </span>
                          {task.link && <span title={task.link}><Link2 size={13} className="text-[var(--accent)] flex-shrink-0" /></span>}
                        </div>
                        <div className="flex items-center justify-between mt-2 pt-3 border-t border-[var(--border)]" onClick={e => e.stopPropagation()}>
                          <select 
                            value={task.status} 
                            onChange={(e) => statusMutation.mutate({ id: task._id, status: e.target.value, updatedAt: task.updatedAt })}
                            className="text-xs border border-[var(--border)] rounded-lg bg-[var(--bg)] text-[var(--text1)] px-2 py-1 focus:outline-none"
                          >
                            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                          </select>
                          <div className="flex items-center gap-1">
                            <button className="p-1.5 text-[var(--text2)] hover:text-[var(--text1)] hover:bg-[var(--bg)] rounded-lg transition-all duration-200" title="View details/comments" onClick={() => setSelectedTask(task)}>
                              <MessageSquare size={14}/>
                            </button>
                            {canModify && (
                              <>
                                <button className="p-1.5 text-[var(--text2)] hover:text-[var(--text1)] hover:bg-[var(--bg)] rounded-lg transition-all duration-200" title="Edit task" onClick={() => {
                                  setEditAssigneeSelects(task.assignees && task.assignees.length > 0 
                                    ? task.assignees.map((a: any) => ({ id: Math.random(), value: a._id }))
                                    : [{ id: Math.random(), value: '' }])
                                  setEditingTask(task)
                                }}>
                                  <Edit size={14}/>
                                </button>
                                <button className="p-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-all duration-200" title="Delete task" onClick={() => handleDeleteTask(task)}>
                                  <Trash2 size={14}/>
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Editing Task Modal */}
      {editingTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-lg shadow-xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-[var(--border)]">
              <h3 className="text-xl font-bold text-[var(--text1)]">Edit Task</h3>
            </div>
            <form onSubmit={handleEditTask} className="p-6 flex flex-col gap-4 overflow-y-auto">
              <div>
                <label className="block text-sm font-medium text-[var(--text2)] mb-1">Title</label>
                <input name="title" defaultValue={editingTask.title} required className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text2)] mb-1">Details (Description)</label>
                <textarea name="description" defaultValue={editingTask.description} rows={3} placeholder="Write task details here..." className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)] resize-none" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text2)] mb-1">Assignees</label>
                <div className="flex flex-col gap-2">
                  {editAssigneeSelects.map((item, index) => (
                    <div key={item.id} className="flex gap-2 items-center">
                      <select name="assigneeIds" defaultValue={item.value} className="flex-1 border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                        <option value="">Select Assignee...</option>
                        {users.map((u: any) => (
                          <option key={u._id} value={u._id}>
                            {u.name || u.email} {u.username ? `(@${u.username})` : `[${u.role}]`}
                          </option>
                        ))}
                      </select>
                      {index === editAssigneeSelects.length - 1 && (
                        <button type="button" onClick={() => setEditAssigneeSelects([...editAssigneeSelects, { id: Date.now(), value: '' }])} className="p-3 bg-[var(--bg)] border border-[var(--border)] rounded-xl text-[var(--text1)] hover:bg-[var(--border)] transition-all duration-200">
                          <Plus size={16} />
                        </button>
                      )}
                      {editAssigneeSelects.length > 1 && (
                        <button type="button" onClick={() => setEditAssigneeSelects(editAssigneeSelects.filter(i => i.id !== item.id))} className="p-3 bg-[var(--bg)] border border-red-200 text-red-500 hover:bg-red-50 dark:border-red-900/30 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text2)] mb-1">Priority</label>
                <select name="priority" defaultValue={editingTask.priority} className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text2)] mb-1">Deadline</label>
                <input type="date" name="dueDate" defaultValue={editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : ''} className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div>
                <label className="block text-sm font-medium text-[var(--text2)] mb-1">Link (URL)</label>
                <input name="link" type="url" defaultValue={editingTask.link || ''} placeholder="https://..." className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]" />
              </div>
              <div className="flex gap-3 pt-4 border-t border-[var(--border)] mt-2">
                <button type="button" onClick={() => setEditingTask(null)} className="flex-1 py-3 px-4 rounded-xl border border-[var(--border)] bg-[var(--surface)] text-[var(--text1)] hover:bg-[var(--bg)] transition-all duration-200 font-medium">Cancel</button>
                <button type="submit" disabled={editMutation.isPending} className="flex-1 py-3 px-4 rounded-xl bg-[var(--accent)] text-white hover:opacity-90 transition-all duration-200 font-medium disabled:opacity-50">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Selected Task Details Modal */}
      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-[var(--surface)] rounded-2xl w-full max-w-2xl shadow-xl overflow-hidden flex flex-col h-[80vh]" onClick={e => e.stopPropagation()}>
            <div className="p-6 border-b border-[var(--border)] flex justify-between items-center bg-[var(--bg)]">
              <h3 className="text-xl font-bold text-[var(--text1)]">Task Details</h3>
              <button className="text-[var(--text2)] hover:text-[var(--text1)] transition-all duration-200" onClick={() => setSelectedTask(null)}>
                <span className="text-2xl leading-none">&times;</span>
              </button>
            </div>
            
            <div className="flex-1 overflow-y-auto">
              <div className="p-6 space-y-4 border-b border-[var(--border)]">
                <p className="text-[var(--text1)]"><strong className="text-[var(--text2)]">Title:</strong> {selectedTask.title}</p>
                <p className="text-[var(--text1)]">
                  <strong className="text-[var(--text2)]">Assignees:</strong>{' '}
                  {selectedTask.assignees && selectedTask.assignees.length > 0 
                    ? selectedTask.assignees.map((a: any) => a.username ? `@${a.username}` : (a.name || a.email)).join(', ') 
                    : 'Unassigned'}
                </p>
                <p className="text-[var(--text1)] flex items-center gap-2">
                  <strong className="text-[var(--text2)]">Priority:</strong> 
                  <span className={`text-xs px-2 py-1 rounded-full font-medium ${getPriorityColor(selectedTask.priority)}`}>
                    {selectedTask.priority}
                  </span>
                </p>
                <div>
                  <strong className="text-[var(--text2)] block mb-2">Details:</strong>
                  <div className="bg-[var(--bg)] p-4 rounded-xl text-[var(--text1)] whitespace-pre-wrap border border-[var(--border)] min-h-[80px]">
                    {selectedTask.description || <em className="text-[var(--text2)]">No details provided.</em>}
                  </div>
                </div>
                {selectedTask.link && (
                  <div className="text-sm mt-1">
                    <strong className="text-[var(--text2)]">Link:</strong>{' '}
                    <a href={selectedTask.link} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline break-all print-link">{selectedTask.link}</a>
                  </div>
                )}
                <div className="flex gap-6 text-sm">
                  <p className="text-[var(--text1)]"><strong className="text-[var(--text2)]">Deadline:</strong> {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : 'None'}</p>
                  <p className="text-[var(--text1)]"><strong className="text-[var(--text2)]">Date Assigned:</strong> {selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleDateString() : 'Unknown'}</p>
                </div>
              </div>

              <div className="p-6 flex flex-col h-full max-h-[400px]">
                <h4 className="font-bold text-[var(--text1)] mb-4">Comments</h4>
                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2">
                  {comments.length === 0 ? <p className="text-[var(--text2)] italic text-sm">No comments yet.</p> : (
                    comments.map((comment: any) => (
                      <div key={comment._id} className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)]">
                        <div className="flex justify-between items-center mb-2">
                          <strong className="text-[var(--text1)] text-sm">{comment.author?.username ? `@${comment.author.username}` : (comment.author?.name || comment.author?.email)}</strong>
                          <span className="text-xs text-[var(--text2)]">{new Date(comment.timestamp).toLocaleString()}</span>
                        </div>
                        <p className="text-[var(--text1)] text-sm">{comment.content}</p>
                      </div>
                    ))
                  )}
                </div>
                <form 
                  className="flex gap-2 mt-auto pt-2"
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
                    className="flex-1 border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
                  />
                  <button type="submit" disabled={commentMutation.isPending || !commentText.trim()} className="bg-[var(--accent)] text-white p-3 rounded-xl hover:opacity-90 transition-all duration-200 disabled:opacity-50">
                    <Send size={20} />
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
