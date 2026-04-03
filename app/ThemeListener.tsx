"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";

export default function ThemeListener() {
  useEffect(() => {
    const root = window.document.documentElement;

    // 1. INSTANT LOAD: Check localStorage first to prevent the "white flash"
    const localTheme = localStorage.getItem('theme');
    if (localTheme === 'Dark Mode') {
      root.classList.add('dark');
    } else if (localTheme === 'Light Mode') {
      root.classList.remove('dark');
    } else if (localTheme === 'System Default' || !localTheme) {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }

    // 2. BACKGROUND SYNC: Check Firebase to ensure it matches their account settings
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().theme) {
          const dbTheme = userDoc.data().theme;
          
          // Keep local storage in sync with database
          localStorage.setItem('theme', dbTheme); 

          if (dbTheme === 'Dark Mode') {
            root.classList.add('dark');
          } else if (dbTheme === 'Light Mode') {
            root.classList.remove('dark');
          } else {
            if (window.matchMedia('(prefers-color-scheme: dark)').matches) root.classList.add('dark');
            else root.classList.remove('dark');
          }
        }
      }
    });

    return () => unsubscribe();
  }, []);
  
  return null; // This is invisible! It just runs the logic in the background.
}