import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { auth } from '../firebase'
import { BACKEND_URL } from '../config'

const fetchProfile = async () => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/profile`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to fetch profile')
  return res.json()
}

const fetchUsers = async () => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/users`, {
    headers: { Authorization: `Bearer ${token}` },
    credentials: 'include'
  })
  if (!res.ok) throw new Error('Failed to fetch users')
  return res.json()
}

const updateProfile = async (data: { name: string, username: string, superior: string }) => {
  const token = await auth.currentUser?.getIdToken()
  const res = await fetch(`${BACKEND_URL}/api/profile`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}` 
    },
    body: JSON.stringify(data),
    credentials: 'include'
  })
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}))
    throw new Error(errorData.error || 'Failed to update profile')
  }
  return res.json()
}

export default function Settings() {
  const queryClient = useQueryClient()
  const [successMsg, setSuccessMsg] = useState('')
  const [errorMsg, setErrorMsg] = useState('')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['profile'],
    queryFn: fetchProfile
  })

  const { data: users = [] } = useQuery({
    queryKey: ['users'],
    queryFn: fetchUsers
  })

  const mutation = useMutation({
    mutationFn: updateProfile,
    onSuccess: (data) => {
      setSuccessMsg('Profile updated successfully!')
      setErrorMsg('')
      queryClient.setQueryData(['profile'], data)
      setTimeout(() => setSuccessMsg(''), 3000)
    },
    onError: (err: any) => {
      setErrorMsg(err.message)
      setSuccessMsg('')
    }
  })

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    mutation.mutate({
      name: fd.get('name') as string,
      username: fd.get('username') as string,
      superior: fd.get('superior') as string,
    })
  }

  if (isLoading) return <div className="p-8 text-[var(--text1)]">Loading settings...</div>

  // Filter out the current user from the superior options to prevent selecting oneself
  // In a real app we'd also prevent selecting someone who reports to this user (circular dependencies).
  const availableSuperiors = users.filter((u: any) => u.uid !== profile?.uid)

  return (
    <div className="max-w-xl mx-auto">
      <h2 className="text-2xl font-bold text-[var(--text1)] mb-6">Account Settings</h2>
      
      <div className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 shadow-lg">
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            Full Name
            <input className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3" name="name" defaultValue={profile?.name || ''} required />
          </label>
          
          <label className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            Username
            <input 
              className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3"
              name="username" 
              defaultValue={profile?.username || ''} 
              placeholder="e.g. johndoe" 
            />
          </label>
          
          <label className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            Immediate Superior
            <select name="superior" defaultValue={profile?.superior || ''} className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3">
              <option value="">None (Top Level)</option>
              {availableSuperiors.map((u: any) => (
                <option key={u._id} value={u._id}>
                  {u.name || u.email} [{u.role}] {u.username ? `(@${u.username})` : ''}
                </option>
              ))}
            </select>
          </label>

          <button className="w-full py-3 rounded-xl bg-[var(--accent)] text-white dark:text-midnight font-semibold hover:opacity-90 transition-all" type="submit" disabled={mutation.isPending}>
            {mutation.isPending ? 'Saving...' : 'Save Settings'}
          </button>

          {successMsg && <div className="mt-4 p-3 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold">{successMsg}</div>}
          {errorMsg && <div className="mt-4 p-3 rounded-xl bg-red-500/15 text-red-500 font-semibold">{errorMsg}</div>}
        </form>

        <div className="mt-10 border-t border-[var(--border)] pt-6">
          <h3 className="text-[var(--text1)] font-bold mb-1">Security & Identity</h3>
          <p className="text-[var(--text2)] text-sm mb-4">
            This information is private and is used internally by the system.
          </p>
          <div className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm mb-4">
            <label>Secret UID</label>
            <input type="text" readOnly value={profile?.uid || ''} className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 opacity-60 cursor-not-allowed" />
          </div>
          <div className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm mb-4">
            <label>Email Address</label>
            <input type="text" readOnly value={profile?.email || ''} className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 opacity-60 cursor-not-allowed" />
          </div>
          <div className="flex flex-col gap-2 font-semibold text-[var(--text1)] text-sm">
            <label>System Role</label>
            <input type="text" readOnly value={profile?.role || 'employee'} className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3 opacity-60 cursor-not-allowed capitalize" />
          </div>
        </div>
      </div>
    </div>
  )
}
