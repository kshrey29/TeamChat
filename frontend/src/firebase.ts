import { initializeApp } from "firebase/app";
import {
  getAuth,
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  getFirestore,
  serverTimestamp,
  type Firestore,
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db: Firestore = getFirestore(app);
export const now = serverTimestamp;

export {
  type User,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
};

