"use client";
import { useState, useEffect } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "./firebase"; 

// Static conversion rates (Base: INR)
const EXCHANGE_RATES: Record<string, number> = {
  INR: 1,
  USD: 0.012,   // Approx 83 INR to 1 USD
  EUR: 0.011,   // Approx 90 INR to 1 EUR
  GBP: 0.0095   // Approx 105 INR to 1 GBP
};

const SYMBOLS: Record<string, string> = {
  INR: "₹",
  USD: "$",
  EUR: "€",
  GBP: "£"
};

export function useCurrency() {
  const [currency, setCurrency] = useState("INR");
  const [symbol, setSymbol] = useState("₹");
  const [rate, setRate] = useState(1);
  const [isCurrencyLoading, setIsCurrencyLoading] = useState(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (user) => {
      if (user) {
        // Listen to the user's settings document in real-time
        const unsubscribeDoc = onSnapshot(doc(db, "users", user.uid), (docSnap) => {
          if (docSnap.exists()) {
            const data = docSnap.data();
            const userCurrency = data.currency || "INR";
            
            setCurrency(userCurrency);
            setSymbol(SYMBOLS[userCurrency] || "₹");
            setRate(EXCHANGE_RATES[userCurrency] || 1);
          }
          setIsCurrencyLoading(false);
        });
        
        // Cleanup the document listener when component unmounts
        return () => unsubscribeDoc();
      } else {
        setIsCurrencyLoading(false);
      }
    });

    // Cleanup the auth listener
    return () => unsubscribeAuth();
  }, []);

  // The magic math function
  const convert = (amountInRupees: number) => {
    return amountInRupees * rate;
  };

  return { currency, symbol, convert, isCurrencyLoading };
}