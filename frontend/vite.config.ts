import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
const firebaseAuthCsp = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://apis.google.com https://www.googleapis.com https://www.gstatic.com https://accounts.google.com https://*.firebaseapp.com https://www.google.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; img-src 'self' data: https: blob:; font-src 'self' data: https:; connect-src 'self' http://localhost:* ws://localhost:* https://kanbankc-oday.onrender.com https://*.firebaseio.com https://*.googleapis.com https://securetoken.googleapis.com https://identitytoolkit.googleapis.com https://fcmregistrations.googleapis.com https://firebaseinstallations.googleapis.com https://firebaseremoteconfig.googleapis.com https://*.firebaseapp.com; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://*.google.com; worker-src 'self' blob: https://www.gstatic.com;"

export default defineConfig({
  plugins: [react()],
  server: {
    headers: {
      'X-Frame-Options': 'DENY',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Content-Security-Policy': firebaseAuthCsp
    }
  }
})
