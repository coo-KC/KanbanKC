import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data: https:; connect-src 'self' http://localhost:* ws://localhost:* https://kanbankc-oday.onrender.com https://*.firebaseio.com https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://fcmregistrations.googleapis.com; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com; worker-src 'self' blob:;"
    }
  }
})
