// src/lib/firebase.ts
import { initializeApp, getApps, getApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Replace this with your actual config object from the Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyBPV7e0nW_Zz-a6wtjDEdr-1tWpyhZs2Rw",
  authDomain: "travel-hub-60f61.firebaseapp.com",
  projectId: "travel-hub-60f61",
  storageBucket: "travel-hub-60f61.firebasestorage.app",
  messagingSenderId: "409998249088",
  appId: "1:409998249088:web:9dd2632d63cc586f246a65"
};

// Initialize Firebase (this check ensures we don't initialize it multiple times in Next.js)
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Firestore (Database) and Authentication
const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };