{/*"use client";
import { useEffect } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
import { auth, db } from "./lib/firebase";

export default function ThemeListener() {
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().theme) {
          const theme = userDoc.data().theme;
          const root = window.document.documentElement;
          if (theme === 'Dark Mode') {
            root.classList.add('dark');
          } else if (theme === 'Light Mode') {
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
}*/}