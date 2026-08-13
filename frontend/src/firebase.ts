import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider } from 'firebase/auth'
import { getMessaging } from 'firebase/messaging'

const firebaseConfig = {
  apiKey: 'AIzaSyCO7z2cE8eomj6JVCFCflOeWcLLKBeaMHw',
  authDomain: 'kanbankc.firebaseapp.com',
  projectId: 'kanbankc',
  storageBucket: 'kanbankc.firebasestorage.app',
  messagingSenderId: '1027071921414',
  appId: '1:1027071921414:web:98749e1ba209db917ae287',
}

const app = initializeApp(firebaseConfig)
const auth = getAuth(app)
const googleProvider = new GoogleAuthProvider()
const messaging = getMessaging(app)

export { app, auth, googleProvider, messaging }
