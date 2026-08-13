/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode semantic colors (used directly)
        ivory: '#FAF7F2',
        espresso: '#2C2523',
        amber: '#D9A05B',
        charcoal: '#1C1917',
        taupe: '#78716C',
        'light-border': '#E7E5E4',
        // Dark mode semantic colors
        midnight: '#090D16',
        'slate-navy': '#121826',
        cyan: '#00D2FF',
        cobalt: '#3B82F6',
        ice: '#F8FAFC',
        'cool-slate': '#94A3B8',
        'dark-border': '#1E293B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
