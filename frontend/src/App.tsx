import { useEffect, useMemo, useState } from 'react'
import { Routes, Route, Link, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { LayoutDashboard, Users, PieChart, Calendar, CalendarClock, LogOut, Settings as SettingsIcon, Network, Menu, X } from 'lucide-react'
import { auth, googleProvider } from './firebase'
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithPopup,
} from 'firebase/auth'
import type { User } from 'firebase/auth'
import { useFCM } from './hooks/useFCM'

import ThemeToggle from './components/ThemeToggle'
import UserDashboard from './pages/UserDashboard'
import OrgDashboard from './pages/OrgDashboard'
import ReportingHub from './pages/ReportingHub'
import PlanningHub from './pages/PlanningHub'
import DeadlinesCalendar from './pages/DeadlinesCalendar'
import Settings from './pages/Settings'
import KCTree from './pages/KCTree'
import InstallPWA from './components/InstallPWA'
import { BACKEND_URL } from './config'

function BoardsHub() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <UserDashboard />
      <div className="flex justify-end border-t border-[var(--border)] pt-6">
        <button
          type="button"
          onClick={() => navigate('/org')}
          className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90"
        >
          <Users size={18} /> Organization Board
        </button>
      </div>
    </div>
  )
}

function CalendarHub() {
  const navigate = useNavigate()

  return (
    <div className="space-y-6">
      <DeadlinesCalendar />
      <div className="flex justify-end border-t border-[var(--border)] pt-6">
        <button
          type="button"
          onClick={() => navigate('/planning')}
          className="flex items-center gap-2 rounded-xl bg-[var(--accent)] px-5 py-3 font-semibold text-white transition-opacity hover:opacity-90"
        >
          <CalendarClock size={18} /> Events Calendar
        </button>
      </div>
    </div>
  )
}

type UserProfile = {
  uid: string
  email: string | null
  name?: string | null
  role?: string
  department?: string
}

function App() {
  useFCM()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isSignup, setIsSignup] = useState(false)
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navigate = useNavigate()
  const location = useLocation()

  const fetchSession = async (token: string) => {
    const response = await fetch(`${BACKEND_URL}/api/auth/session`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      credentials: 'include',
    })
    if (!response.ok) {
      throw new Error('Failed to establish backend session')
    }
    return response.json() as Promise<UserProfile>
  }

  const handleGoogleSignIn = async () => {
    setError(null)
    setMessage('')
    try {
      await signInWithPopup(auth, googleProvider)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Google sign-in failed')
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setLoading(true)
      setError(null)
      setUser(currentUser)
      if (currentUser) {
        try {
          const token = await currentUser.getIdToken(true)
          const data = await fetchSession(token)
          setProfile(data)
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Unable to fetch profile')
          setProfile(null)
        }
      } else {
        setProfile(null)
      }
      setLoading(false)
    })
    return () => unsubscribe()
  }, [])

  const authForm = useMemo(() => {
    const action = isSignup ? 'Create account' : 'Sign in'
    return (
      <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] px-4">
        <div className="w-full max-w-md">
          <header className="text-center mb-8">
            <h1 className="text-4xl font-bold text-[var(--text1)]">KanbanKC</h1>
            <p className="mt-2 text-[var(--text2)]">Login to continue</p>
          </header>
          <form
            className="bg-[var(--surface)] border border-[var(--border)] rounded-2xl p-7 shadow-xl flex flex-col gap-4"
            onSubmit={async (event) => {
              event.preventDefault()
              setError(null)
              setMessage('')
              try {
                if (isSignup) {
                  await createUserWithEmailAndPassword(auth, email, password)
                } else {
                  await signInWithEmailAndPassword(auth, email, password)
                }
                setEmail('')
                setPassword('')
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Authentication failed')
              }
            }}
          >
            <h2 className="text-xl font-bold text-[var(--text1)]">{action}</h2>
            <label className="flex flex-col gap-2 font-semibold text-sm text-[var(--text1)]">
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3"
              />
            </label>
            <label className="flex flex-col gap-2 font-semibold text-sm text-[var(--text1)]">
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                required
                minLength={6}
                className="w-full border border-[var(--border)] rounded-xl bg-[var(--bg)] text-[var(--text1)] px-4 py-3"
              />
            </label>
            <button type="submit" className="w-full py-3 rounded-xl bg-[var(--accent)] text-white font-semibold hover:opacity-90 transition-all duration-200 cursor-pointer">
              {action}
            </button>
            <button
              type="button"
              onClick={() => {
                setIsSignup(!isSignup)
                setError(null)
                setMessage('')
              }}
              className="w-full py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text2)] font-medium hover:text-[var(--text1)] transition-all duration-200 cursor-pointer"
            >
              {isSignup ? 'Already have an account? Sign in' : 'Create a new account'}
            </button>
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="w-full py-3 rounded-xl bg-[var(--bg)] border border-[var(--border)] text-[var(--text1)] font-medium hover:border-[var(--accent)] transition-all duration-200 cursor-pointer"
            >
              Continue with Google
            </button>
          </form>
          {message && <p className="mt-4 p-4 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-300 font-semibold text-center">{message}</p>}
          {error && <p className="mt-4 p-4 rounded-xl bg-red-500/15 text-red-500 font-semibold text-center">{error}</p>}
        </div>
        <ThemeToggle />
      </div>
    )
  }, [email, password, isSignup, message, error])

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--bg)] text-[var(--text2)]">Loading...</div>
  }

  if (!user || !profile) {
    return authForm
  }

  const navItems = [
    { path: '/boards', label: 'Boards', icon: <LayoutDashboard size={18} /> },
    { path: '/tree', label: 'KC Tree', icon: <Network size={18} /> },
    { path: '/reports', label: 'Reporting & Analytics', icon: <PieChart size={18} /> },
    { path: '/calendar', label: 'Calendar', icon: <Calendar size={18} /> },
    { path: '/settings', label: 'Settings', icon: <SettingsIcon size={18} /> },
  ]

  return (
    <div className="flex flex-col min-h-screen w-full bg-[var(--bg)]">
      <InstallPWA />
      {/* ── Top Header ── */}
      <header className="flex items-center justify-between px-4 sm:px-8 h-[72px] bg-[var(--surface)] border-b border-[var(--border)] sticky top-0 z-40 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            aria-label="Open navigation"
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen(true)}
            className="rounded-lg p-2 text-[var(--text1)] hover:bg-[var(--border)]/50 md:hidden"
          >
            <Menu size={22} />
          </button>
          <div className="text-2xl font-bold tracking-tight text-[var(--text1)]">KanbanKC</div>
        </div>
        <nav className="hidden gap-1 items-center md:flex">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-200
                ${location.pathname === item.path || (item.path === '/boards' && ['/org', '/'].includes(location.pathname)) || (item.path === '/calendar' && location.pathname === '/planning')
                  ? 'bg-[var(--accent)]/15 text-[var(--accent)]'
                  : 'text-[var(--text2)] hover:bg-[var(--border)]/50 hover:text-[var(--text1)]'
                }`}
            >
              {item.icon}
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-2 sm:gap-6">
          <div className="hidden flex-col items-end sm:flex">
            <span className="font-semibold text-[var(--text1)]">{profile.name || profile.email}</span>
            <span className="text-xs text-[var(--text2)] capitalize">{profile.role}</span>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-transparent border border-[var(--border)] text-[var(--text2)] hover:bg-red-500/10 hover:text-red-400 hover:border-red-400/30 transition-all duration-200 cursor-pointer"
            onClick={async () => {
              await signOut(auth)
              navigate('/')
            }}
          >
            <LogOut size={16} /> Sign out
          </button>
        </div>
      </header>

      {mobileNavOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
        />
      )}
      <aside className={`fixed inset-y-0 left-0 z-50 w-72 bg-[var(--surface)] p-5 shadow-2xl transition-transform duration-200 md:hidden ${mobileNavOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="mb-8 flex items-center justify-between">
          <span className="text-xl font-bold text-[var(--text1)]">Navigation</span>
          <button type="button" aria-label="Close navigation" onClick={() => setMobileNavOpen(false)} className="rounded-lg p-2 text-[var(--text2)] hover:bg-[var(--border)]/50">
            <X size={22} />
          </button>
        </div>
        <nav className="flex flex-col gap-2">
          {navItems.map((item) => (
            <Link
              key={item.path}
              to={item.path}
              onClick={() => setMobileNavOpen(false)}
              className={`flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium ${location.pathname === item.path || (item.path === '/boards' && ['/org', '/'].includes(location.pathname)) || (item.path === '/calendar' && location.pathname === '/planning') ? 'bg-[var(--accent)]/15 text-[var(--accent)]' : 'text-[var(--text2)] hover:bg-[var(--border)]/50'}`}
            >
              {item.icon}<span>{item.label}</span>
            </Link>
          ))}
        </nav>
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 min-w-0 p-4 sm:p-6 lg:p-8">
        <Routes>
          <Route path="/" element={<Navigate to="/boards" replace />} />
          <Route path="/boards" element={<BoardsHub />} />
          <Route path="/org" element={<OrgDashboard />} />
          <Route path="/tree" element={<KCTree />} />
          <Route path="/reports" element={<ReportingHub />} />
          <Route path="/planning" element={<PlanningHub />} />
          <Route path="/calendar" element={<CalendarHub />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
      </main>

      {/* ── Footer ── */}
      <footer className="flex flex-col items-center justify-center py-10 px-8 bg-[var(--surface)] border-t border-[var(--border)] gap-5">
        <div className="flex gap-8">
          <a href="#" className="text-[var(--text2)] font-medium text-sm hover:text-[var(--accent)] transition-colors duration-200">WhatsApp Group</a>
          <a href="#" className="text-[var(--text2)] font-medium text-sm hover:text-[var(--accent)] transition-colors duration-200">Twitter / X</a>
          <a href="#" className="text-[var(--text2)] font-medium text-sm hover:text-[var(--accent)] transition-colors duration-200">LinkedIn</a>
        </div>
        <p className="text-[var(--text2)] text-sm">&copy; {new Date().getFullYear()} KanbanKC. All rights reserved.</p>
      </footer>

      {/* ── Theme Toggle ── */}
      <ThemeToggle />
    </div>
  )
}

export default App
