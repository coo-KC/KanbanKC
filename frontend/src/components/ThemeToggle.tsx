import { Sun, Moon } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'

export default function ThemeToggle() {
  const { theme, toggle } = useTheme()

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-50 w-12 h-12 rounded-full flex items-center justify-center
        bg-[var(--surface)] border border-[var(--border)] shadow-lg
        hover:scale-110 active:scale-95 transition-all duration-200 cursor-pointer"
      title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {theme === 'light' ? (
        <Moon size={20} className="text-[var(--text2)]" />
      ) : (
        <Sun size={20} className="text-amber" />
      )}
    </button>
  )
}
