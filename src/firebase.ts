import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBDO3NOK6XS5vpMrBF0hFWSMY6qdW8Eqow",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0689323948.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0689323948",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0689323948.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "882023142919",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:882023142919:web:bf83c81f426abedd473ca2"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, import.meta.env.VITE_FIREBASE_DATABASE_ID || "ai-studio-6b2d9dd1-51a9-4e74-98f7-abded937af68");
export const googleProvider = new GoogleAuthProvider();
