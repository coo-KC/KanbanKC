import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auth } from '../firebase'
import { Plus, MessageSquare, Trash2, Edit, Send, Link2 } from 'lucide-react'
import { BACKEND_URL } from '../config'

const fetchPersonalTasks = async () => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/tasks/personal`, {
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}` 
    },
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to fetch tasks')
  return res.json()
}

const fetchUsers = async () => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
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
  if (!res.ok) {
    if (res.status === 409) throw new Error('Conflict: Task was modified elsewhere.')
    throw new Error('Failed to update status')
  }
  return res.json()
}

const createTask = async (taskData: any) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/tasks`, {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(taskData),
    credentials: 'include'
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || 'Failed to create task')
  }
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
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  })
  if (!res.ok) {
    const errData = await res.json().catch(() => ({}))
    throw new Error(errData.error || 'Failed to delete task')
  }
  return res.json()
}

const STATUSES = ['todo', 'in_progress', 'halted', 'completed', 'cancelled']

const getPriorityColor = (priority: string) => {
  switch (priority.toLowerCase()) {
    case 'urgent': return 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300'
    case 'high': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300'
    case 'medium': return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300'
    case 'low': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300'
    default: return 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300'
  }
}

export default function UserDashboard() {
  const queryClient = useQueryClient()
  const [isCreateModalOpen, setCreateModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<any>(null)
  const [selectedTask, setSelectedTask] = useState<any>(null)
  const [commentText, setCommentText] = useState('')
  const [currentUserUid, setCurrentUserUid] = useState<string | null>(null)
  const [createAssigneeSelects, setCreateAssigneeSelects] = useState<number[]>([Date.now()])
  const [editAssigneeSelects, setEditAssigneeSelects] = useState<{id: number, value: string}[]>([])

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(user => {
      setCurrentUserUid(user?.uid || null)
    })
    return () => unsubscribe()
  }, [])
  
  const { data: tasks = [], isLoading, error } = useQuery({
    queryKey: ['personalTasks'],
    queryFn: fetchPersonalTasks
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers,
  })

  const { data: comments = [] } = useQuery({
    queryKey: ['comments', selectedTask?._id],
    queryFn: () => fetchComments(selectedTask._id),
    enabled: !!selectedTask,
    refetchInterval: 5000
  })

  const statusMutation = useMutation({
    mutationFn: updateTaskStatus,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['personalTasks'] }),
    onError: (err) => alert(err.message)
  })

  const createMutation = useMutation({
    mutationFn: createTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalTasks'] })
      setCreateModalOpen(false)
    },
    onError: (err: any) => alert(err.message)
  })

  const editMutation = useMutation({
    mutationFn: updateTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalTasks'] })
      setEditingTask(null)
    },
    onError: (err: any) => alert(err.message)
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTask,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['personalTasks'] })
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

  if (isLoading) return <div className="p-8 text-[var(--text1)]">Loading board...</div>
  if (error) return <div className="p-8 text-red-500">Error loading tasks: {error.message}</div>

  const handleCreateTask = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const assigneeIds = fd.getAll('assigneeIds').filter(id => id.toString().trim() !== '')
    createMutation.mutate({
      title: fd.get('title'),
      description: fd.get('description') || '',
      priority: fd.get('priority'),
      assigneeIds,
      dueDate: fd.get('dueDate') || undefined,
      link: fd.get('link') || ''
    })
  }

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
    if (confirm('Are you sure you want to delete this task?')) {
      deleteMutation.mutate(task._id)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-[var(--text1)]">My Board</h2>
        <button 
          onClick={() => { setCreateAssigneeSelects([Date.now()]); setCreateModalOpen(true); }} 
          className="flex items-center gap-2 px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-all duration-200 shadow-sm"
        >
          <Plus size={16} /> New Task
        </button>
      </div>

      <div className="flex flex-row gap-6 overflow-x-auto pb-4 h-full items-start">
        {STATUSES.map(status => {
          const columnTasks = tasks.filter((t: any) => t.status === status)
          return (
            <div key={status} className="flex-none w-[300px] flex flex-col bg-[var(--surface)] border border-[var(--border)] rounded-xl max-h-full">
              <h3 className="p-4 font-semibold uppercase text-sm text-[var(--text2)] border-b border-[var(--border)] flex justify-between items-center">
                {status.replace('_', ' ')} 
                <span className="bg-[var(--bg)] px-2 py-0.5 rounded-full text-xs">{columnTasks.length}</span>
              </h3>
              <div className="p-4 flex flex-col gap-4 overflow-y-auto">
                {columnTasks.map((task: any) => {
                  const isCreator = task.createdBy?.uid === currentUserUid
                  const canModify = true // Users can modify tasks on their personal board
                  if (isCreator) { /* used for creator check */ }
                  return (
                    <div 
                      key={task._id} 
                      className="bg-[var(--surface)] border border-[var(--border)] rounded-xl p-4 cursor-pointer hover:-translate-y-1 hover:shadow-md transition-all duration-200" 
                      onClick={() => setSelectedTask(task)}
                    >
                      <h4 className="font-semibold text-[var(--text1)] text-base">{task.title}</h4>
                      <div className="flex flex-wrap justify-between items-center gap-2 text-xs mt-3 text-[var(--text2)]">
                        <span className={`px-2 py-1 rounded font-medium capitalize ${getPriorityColor(task.priority)}`}>
                          {task.priority}
                        </span>
                        <span className="truncate max-w-[120px]">
                          {task.assignees && task.assignees.length > 0
                            ? task.assignees.map((a: any) => a.username ? `@${a.username}` : (a.name || a.email)).join(', ') 
                            : 'Unassigned'}
                        </span>
                        {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString()}</span>}
                        {task.link && <span title={task.link}><Link2 size={13} className="text-[var(--accent)] flex-shrink-0" /></span>}
                      </div>
                      <div className="flex justify-between items-center mt-4 pt-3 border-t border-[var(--border)]" onClick={e => e.stopPropagation()}>
                        <select 
                          className="bg-[var(--bg)] border border-[var(--border)] text-[var(--text1)] rounded-lg px-2 py-1 text-sm outline-none focus:border-[var(--accent)] transition-all duration-200"
                          value={task.status} 
                          onChange={(e) => statusMutation.mutate({ id: task._id, status: e.target.value, updatedAt: task.updatedAt })}
                        >
                          {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
                        </select>
                        <div className="flex gap-1">
                          <button className="p-1.5 text-[var(--text2)] hover:text-[var(--accent)] hover:bg-[var(--bg)] rounded transition-all duration-200" title="View details/comments" onClick={() => setSelectedTask(task)}>
                            <MessageSquare size={14}/>
                          </button>
                          {canModify && (
                            <>
                              <button className="p-1.5 text-[var(--text2)] hover:text-[var(--accent)] hover:bg-[var(--bg)] rounded transition-all duration-200" title="Edit task" onClick={() => {
                                setEditAssigneeSelects(task.assignees && task.assignees.length > 0 
                                  ? task.assignees.map((a: any) => ({ id: Math.random(), value: a._id }))
                                  : [{ id: Math.random(), value: '' }])
                                setEditingTask(task)
                              }}>
                                <Edit size={14}/>
                              </button>
                              <button className="p-1.5 text-[var(--text2)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-all duration-200" title="Delete task" onClick={() => handleDeleteTask(task)}>
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

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-[var(--text1)] mb-4">Create Task</h3>
            <form onSubmit={handleCreateTask} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Title 
                <input name="title" required className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Details (Description) 
                <textarea name="description" rows={3} placeholder="Write task details here..." className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200 resize-y" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Assignees
                <div className="flex flex-col gap-2">
                  {createAssigneeSelects.map((selectId, index) => (
                    <div key={selectId} className="flex gap-2">
                      <select name="assigneeIds" className="flex-grow bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200">
                        <option value="">Select Assignee...</option>
                        {users.map((u: any) => (
                          <option key={u._id} value={u._id}>
                            {u.name || u.email} {u.username ? `(@${u.username})` : `[${u.role}]`}
                          </option>
                        ))}
                      </select>
                      {index === createAssigneeSelects.length - 1 && (
                        <button type="button" onClick={() => setCreateAssigneeSelects([...createAssigneeSelects, Date.now()])} className="p-2 text-[var(--text2)] hover:text-[var(--accent)] hover:bg-[var(--bg)] rounded-xl transition-all duration-200 border border-[var(--border)]">
                          <Plus size={16} />
                        </button>
                      )}
                      {createAssigneeSelects.length > 1 && (
                        <button type="button" onClick={() => setCreateAssigneeSelects(createAssigneeSelects.filter(id => id !== selectId))} className="p-2 text-[var(--text2)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 border border-[var(--border)]">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Priority
                <select name="priority" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <div className="flex gap-4">
                <label className="flex-1 flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                  Deadline 
                  <input type="date" name="dueDate" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200" />
                </label>
                <label className="flex-1 flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                  Date Assigned 
                  <input type="date" name="dateAssigned" defaultValue={new Date().toISOString().split('T')[0]} readOnly title="Automatically recorded by the database" className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text2)] opacity-70 outline-none" />
                </label>
              </div>
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Link (URL)
                <input name="link" type="url" placeholder="https://..." className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200" />
              </label>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[var(--border)]">
                <button type="button" onClick={() => setCreateModalOpen(false)} className="px-4 py-2 text-[var(--text1)] hover:bg-[var(--bg)] rounded-lg transition-all duration-200 border border-[var(--border)] font-medium">Cancel</button>
                <button type="submit" disabled={createMutation.isPending} className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-all duration-200 font-medium disabled:opacity-50">Create</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {editingTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <h3 className="text-xl font-bold text-[var(--text1)] mb-4">Edit Task</h3>
            <form onSubmit={handleEditTask} className="flex flex-col gap-4">
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Title 
                <input name="title" defaultValue={editingTask.title} required className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Details (Description) 
                <textarea name="description" defaultValue={editingTask.description} rows={3} placeholder="Write task details here..." className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200 resize-y" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Assignees
                <div className="flex flex-col gap-2">
                  {editAssigneeSelects.map((item, index) => (
                    <div key={item.id} className="flex gap-2">
                      <select name="assigneeIds" defaultValue={item.value} className="flex-grow bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200">
                        <option value="">Select Assignee...</option>
                        {users.map((u: any) => (
                          <option key={u._id} value={u._id}>
                            {u.name || u.email} {u.username ? `(@${u.username})` : `[${u.role}]`}
                          </option>
                        ))}
                      </select>
                      {index === editAssigneeSelects.length - 1 && (
                        <button type="button" onClick={() => setEditAssigneeSelects([...editAssigneeSelects, { id: Date.now(), value: '' }])} className="p-2 text-[var(--text2)] hover:text-[var(--accent)] hover:bg-[var(--bg)] rounded-xl transition-all duration-200 border border-[var(--border)]">
                          <Plus size={16} />
                        </button>
                      )}
                      {editAssigneeSelects.length > 1 && (
                        <button type="button" onClick={() => setEditAssigneeSelects(editAssigneeSelects.filter(i => i.id !== item.id))} className="p-2 text-[var(--text2)] hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-xl transition-all duration-200 border border-[var(--border)]">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Priority
                <select name="priority" defaultValue={editingTask.priority} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200">
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="urgent">Urgent</option>
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Deadline 
                <input type="date" name="dueDate" defaultValue={editingTask.dueDate ? new Date(editingTask.dueDate).toISOString().split('T')[0] : ''} className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200" />
              </label>
              <label className="flex flex-col gap-1 text-sm font-medium text-[var(--text1)]">
                Link (URL)
                <input name="link" type="url" defaultValue={editingTask.link || ''} placeholder="https://..." className="w-full bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] outline-none focus:border-[var(--accent)] transition-all duration-200" />
              </label>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-[var(--border)]">
                <button type="button" onClick={() => setEditingTask(null)} className="px-4 py-2 text-[var(--text1)] hover:bg-[var(--bg)] rounded-lg transition-all duration-200 border border-[var(--border)] font-medium">Cancel</button>
                <button type="submit" disabled={editMutation.isPending} className="px-4 py-2 bg-[var(--accent)] text-white rounded-lg hover:opacity-90 transition-all duration-200 font-medium disabled:opacity-50">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {selectedTask && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setSelectedTask(null)}>
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto flex flex-col gap-4" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-xl font-bold text-[var(--text1)]">Task Details</h3>
              <button className="text-2xl leading-none text-[var(--text2)] hover:text-[var(--text1)] transition-colors" onClick={() => setSelectedTask(null)}>&times;</button>
            </div>
            
            <div className="flex flex-col gap-3 text-sm text-[var(--text1)]">
              <p><strong className="text-[var(--text2)] mr-2">Title:</strong> {selectedTask.title}</p>
              <p>
                <strong className="text-[var(--text2)] mr-2">Assignees:</strong>
                {selectedTask.assignees && selectedTask.assignees.length > 0 
                  ? selectedTask.assignees.map((a: any) => a.username ? `@${a.username}` : (a.name || a.email)).join(', ') 
                  : 'Unassigned'}
              </p>
              <p>
                <strong className="text-[var(--text2)] mr-2">Priority:</strong> 
                <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${getPriorityColor(selectedTask.priority)}`}>{selectedTask.priority}</span>
              </p>
              <p><strong className="text-[var(--text2)]">Details:</strong></p>
              <div className="bg-[var(--bg)] p-4 rounded-xl border border-[var(--border)] whitespace-pre-wrap mt-1">
                {selectedTask.description || <em className="text-[var(--text2)]">No details provided.</em>}
              </div>
              {selectedTask.link && (
                <div className="mt-2">
                  <strong className="text-[var(--text2)] mr-2">Link:</strong>
                  <a href={selectedTask.link} target="_blank" rel="noopener noreferrer" className="text-[var(--accent)] hover:underline break-all print-link">{selectedTask.link}</a>
                </div>
              )}
              <div className="flex gap-6 mt-2">
                <p><strong className="text-[var(--text2)] mr-2">Deadline:</strong> {selectedTask.dueDate ? new Date(selectedTask.dueDate).toLocaleDateString() : 'None'}</p>
                <p><strong className="text-[var(--text2)] mr-2">Date Assigned:</strong> {selectedTask.createdAt ? new Date(selectedTask.createdAt).toLocaleDateString() : 'Unknown'}</p>
              </div>
            </div>

            <div className="mt-6 pt-6 border-t border-[var(--border)] flex flex-col gap-4">
              <h4 className="font-bold text-[var(--text1)]">Comments</h4>
              <div className="flex flex-col gap-3 max-h-60 overflow-y-auto pr-2">
                {comments.length === 0 ? <p className="text-[var(--text2)] text-sm italic">No comments yet.</p> : (
                  comments.map((comment: any) => (
                    <div key={comment._id} className="bg-[var(--bg)] rounded-xl p-3 text-sm text-[var(--text1)] border border-[var(--border)]">
                      <div className="flex justify-between items-center mb-1">
                        <strong className="text-[var(--accent)] font-semibold">{comment.author?.username ? `@${comment.author.username}` : (comment.author?.name || comment.author?.email)}</strong>
                        <span className="text-xs text-[var(--text2)]">{new Date(comment.timestamp).toLocaleString()}</span>
                      </div>
                      <p className="whitespace-pre-wrap">{comment.content}</p>
                    </div>
                  ))
                )}
              </div>
              <form 
                className="flex gap-2 mt-2"
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
                  className="flex-grow bg-[var(--bg)] border border-[var(--border)] rounded-xl px-4 py-2 text-[var(--text1)] text-sm outline-none focus:border-[var(--accent)] transition-all duration-200"
                />
                <button type="submit" disabled={commentMutation.isPending || !commentText.trim()} className="px-3 py-2 bg-[var(--accent)] text-white rounded-xl hover:opacity-90 transition-all duration-200 disabled:opacity-50 flex items-center justify-center">
                  <Send size={16} />
                </button>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
