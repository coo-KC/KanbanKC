import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getMessaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'AIzaSyCO7z2cE8eomj6JVCFCflOeWcLLKBeaMHw',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'kanbankc.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'kanbankc',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'kanbankc.firebasestorage.app',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '1027071921414',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:1027071921414:web:98749e1ba209db917ae287',
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()
const messaging = getMessaging(app)

export { app, auth, googleProvider, messaging }
