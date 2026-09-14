import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auth } from '../firebase'
import { BACKEND_URL } from '../config'
import { AlertTriangle, Trash2, Shield, UserCheck, Search, CheckCircle } from 'lucide-react'

type UserItem = {
  _id: string
  uid: string
  email: string
  name?: string
  username?: string
  role: string
  department?: string
  isWarned?: boolean
  superior?: {
    _id: string
    name?: string
    email?: string
    username?: string
  } | string | null
}

const fetchUsers = async (): Promise<UserItem[]> => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  })
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

const warnUser = async ({ id, isWarned }: { id: string; isWarned: boolean }) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/users/${id}/warn`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ isWarned }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update warning status')
  }
  return res.json()
}

const updateSuperior = async ({ id, superiorId }: { id: string; superiorId: string }) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/users/${id}/superior`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ superiorId }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update superior')
  }
  return res.json()
}

const updateRole = async ({ id, role }: { id: string; role: string }) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/users/${id}/role`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to update role')
  }
  return res.json()
}

const deleteUser = async (id: string) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/users/${id}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || 'Failed to delete user')
  }
  return res.json()
}

export default function AdminDashboard() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [deletingUser, setDeletingUser] = useState<UserItem | null>(null)
  const [successMsg, setSuccessMsg] = useState('')

  const { data: users = [], isLoading, error } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: fetchUsers,
  })

  const warnMutation = useMutation({
    mutationFn: warnUser,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      setSuccessMsg(data.isWarned ? `Warning issued to ${data.name || data.email}` : `Warning lifted for ${data.name || data.email}`)
      setTimeout(() => setSuccessMsg(''), 4000)
    },
    onError: (err: Error) => alert(err.message),
  })

  const superiorMutation = useMutation({
    mutationFn: updateSuperior,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      setSuccessMsg('Superior updated successfully')
      setTimeout(() => setSuccessMsg(''), 4000)
    },
    onError: (err: Error) => alert(err.message),
  })

  const roleMutation = useMutation({
    mutationFn: updateRole,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      setSuccessMsg('User role updated successfully')
      setTimeout(() => setSuccessMsg(''), 4000)
    },
    onError: (err: Error) => alert(err.message),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteUser,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['adminUsers'] })
      setDeletingUser(null)
      setSuccessMsg('User account permanently deleted')
      setTimeout(() => setSuccessMsg(''), 4000)
    },
    onError: (err: Error) => alert(err.message),
  })

  const filteredUsers = users.filter((u) => {
    const term = searchTerm.toLowerCase()
    return (
      (u.name && u.name.toLowerCase().includes(term)) ||
      u.email.toLowerCase().includes(term) ||
      (u.username && u.username.toLowerCase().includes(term)) ||
      (u.role && u.role.toLowerCase().includes(term)) ||
      (u.department && u.department.toLowerCase().includes(term))
    )
  })

  if (isLoading) {
    return <div className="p-8 text-[var(--text1)] font-medium">Loading Admin Dashboard...</div>
  }

  if (error) {
    return <div className="p-8 text-red-500 font-medium">Error loading user list: {(error as Error).message}</div>
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-sm">
        <div>
          <h1 className="text-2xl font-bold text-[var(--text1)] flex items-center gap-2">
            <Shield className="text-[var(--accent)]" size={26} /> Admin User Management
          </h1>
          <p className="text-sm text-[var(--text2)] mt-1">
            Manage user roles, assign immediate superiors, warn users under watch, or remove user accounts.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="bg-[var(--bg)] border border-[var(--border)] px-4 py-2 rounded-xl text-xs font-semibold text-[var(--text1)]">
            Total Users: {users.length}
          </span>
        </div>
      </div>

      {successMsg && (
        <div className="p-4 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold border border-emerald-500/30 flex items-center gap-2">
          <CheckCircle size={18} /> {successMsg}
        </div>
      )}

      {/* Search Bar */}
      <div className="relative">
        <Search className="absolute left-4 top-3.5 text-[var(--text2)]" size={18} />
        <input
          type="text"
          placeholder="Search users by name, email, username, role, or department..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-[var(--surface)] border border-[var(--border)] rounded-xl pl-11 pr-4 py-3 text-[var(--text1)] outline-none focus:ring-2 focus:ring-[var(--accent)] transition-all duration-200"
        />
      </div>

      {/* Users Table */}
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg)] border-b border-[var(--border)] text-xs font-bold uppercase tracking-wider text-[var(--text2)]">
                <th className="p-4">User</th>
                <th className="p-4">Username</th>
                <th className="p-4">Role</th>
                <th className="p-4">Immediate Superior</th>
                <th className="p-4">Status / Warning</th>
                <th className="p-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border)] text-sm text-[var(--text1)]">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--text2)] italic">
                    No users match your search criteria.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((u) => {
                  const currentSuperiorId =
                    typeof u.superior === 'object' && u.superior ? u.superior._id : typeof u.superior === 'string' ? u.superior : ''

                  return (
                    <tr key={u._id} className="hover:bg-[var(--bg)]/50 transition-colors">
                      {/* Name & Email */}
                      <td className="p-4">
                        <div className="font-semibold text-[var(--text1)]">{u.name || 'Unnamed User'}</div>
                        <div className="text-xs text-[var(--text2)]">{u.email}</div>
                        {u.department && (
                          <span className="inline-block mt-1 text-[10px] px-2 py-0.5 rounded bg-[var(--bg)] border border-[var(--border)] text-[var(--text2)] uppercase font-semibold">
                            {u.department}
                          </span>
                        )}
                      </td>

                      {/* Username */}
                      <td className="p-4 font-mono text-xs text-[var(--text1)]">
                        {u.username ? `@${u.username}` : <em className="text-[var(--text2)]">Not set</em>}
                      </td>

                      {/* Role Selector */}
                      <td className="p-4">
                        <select
                          value={u.role || 'employee'}
                          onChange={(e) => roleMutation.mutate({ id: u._id, role: e.target.value })}
                          disabled={roleMutation.isPending}
                          className="bg-[var(--bg)] border border-[var(--border)] text-[var(--text1)] rounded-lg px-3 py-1.5 text-xs font-semibold outline-none focus:border-[var(--accent)]"
                        >
                          <option value="employee">Employee</option>
                          <option value="cgrade">C-Grade Leader</option>
                          <option value="admin">Admin</option>
                        </select>
                      </td>

                      {/* Immediate Superior Selector */}
                      <td className="p-4">
                        <select
                          value={currentSuperiorId}
                          onChange={(e) => superiorMutation.mutate({ id: u._id, superiorId: e.target.value })}
                          disabled={superiorMutation.isPending}
                          className="bg-[var(--bg)] border border-[var(--border)] text-[var(--text1)] rounded-lg px-3 py-1.5 text-xs outline-none focus:border-[var(--accent)] max-w-[200px]"
                        >
                          <option value="">No Superior</option>
                          {users
                            .filter((supCandidate) => supCandidate._id !== u._id)
                            .map((supCandidate) => (
                              <option key={supCandidate._id} value={supCandidate._id}>
                                {supCandidate.name || supCandidate.email} ({supCandidate.role})
                              </option>
                            ))}
                        </select>
                      </td>

                      {/* Warning Status */}
                      <td className="p-4">
                        {u.isWarned ? (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/15 text-red-500 font-bold text-xs border border-red-500/30">
                            <AlertTriangle size={14} /> Under Watch
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold text-xs border border-emerald-500/30">
                            <UserCheck size={14} /> Clear
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="p-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => warnMutation.mutate({ id: u._id, isWarned: !u.isWarned })}
                            disabled={warnMutation.isPending}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl font-semibold text-xs transition-all duration-200 cursor-pointer ${
                              u.isWarned
                                ? 'bg-amber-500/15 text-amber-600 dark:text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                                : 'bg-red-500/10 text-red-500 border border-red-500/20 hover:bg-red-500/20'
                            }`}
                            title={u.isWarned ? 'Lift warning' : 'Warn user'}
                          >
                            <AlertTriangle size={14} />
                            {u.isWarned ? 'Unwarn' : 'Warn User'}
                          </button>

                          <button
                            type="button"
                            onClick={() => setDeletingUser(u)}
                            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-500/15 text-red-500 border border-red-500/30 hover:bg-red-500/25 text-xs font-semibold transition-all duration-200 cursor-pointer"
                            title="Delete User Account"
                          >
                            <Trash2 size={14} /> Remove
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete User Confirmation Modal */}
      {deletingUser && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-6 shadow-2xl w-full max-w-md space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <div className="p-3 rounded-full bg-red-500/15">
                <Trash2 size={24} />
              </div>
              <h3 className="text-xl font-bold">Delete User Account</h3>
            </div>
            <p className="text-sm text-[var(--text2)] leading-relaxed">
              Are you sure you want to permanently delete the account for{' '}
              <strong className="text-[var(--text1)]">{deletingUser.name || deletingUser.email}</strong> (
              <span className="font-mono">{deletingUser.email}</span>)?
            </p>
            <p className="text-xs text-red-500 font-semibold bg-red-500/10 p-3 rounded-xl border border-red-500/20">
              ⚠️ This will remove the user from Firebase Auth and delete their database profile immediately.
            </p>
            <div className="flex justify-end gap-3 pt-4 border-t border-[var(--border)]">
              <button
                type="button"
                onClick={() => setDeletingUser(null)}
                className="px-4 py-2 text-[var(--text1)] hover:bg-[var(--bg)] rounded-xl border border-[var(--border)] text-sm font-semibold transition-all"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => deleteMutation.mutate(deletingUser._id)}
                disabled={deleteMutation.isPending}
                className="px-5 py-2 bg-red-500 text-white rounded-xl text-sm font-semibold hover:opacity-90 transition-all disabled:opacity-50"
              >
                {deleteMutation.isPending ? 'Deleting...' : 'Delete Account'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
