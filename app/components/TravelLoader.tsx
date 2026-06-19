"use client";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plane } from "lucide-react";

interface TravelLoaderProps {
  messages: string[];
  isLanding?: boolean; // Used to tilt the plane during payment success/arrival
}

export default function TravelLoader({ messages, isLanding = false }: TravelLoaderProps) {
  const [messageIndex, setMessageIndex] = useState(0);

  // Rotates the text messages every 2.5 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2500);
    return () => clearInterval(interval);
  }, [messages.length]);

  return (
    <div className="flex flex-col items-center justify-center p-8 w-full max-w-md mx-auto">
      
      {/* PREMIUM ORBITAL RADAR LOADER */}
      <div className="relative w-32 h-32 flex items-center justify-center mb-10">
        
        {/* Ambient Glowing Aura */}
        <div className="absolute inset-0 bg-emerald-500/20 rounded-full blur-[30px] animate-pulse"></div>
        
        {/* Outer Spinning Orbit */}
        <div className="absolute inset-0 rounded-full border border-zinc-200/50 dark:border-zinc-800 border-t-emerald-500 dark:border-t-emerald-500 animate-[spin_2s_linear_infinite] opacity-80"></div>
        
        {/* Inner Counter-Spinning Orbit */}
        <div className="absolute inset-3 rounded-full border border-zinc-200/50 dark:border-zinc-800 border-b-teal-400 dark:border-b-teal-400 animate-[spin_3s_linear_infinite_reverse] opacity-60"></div>
        
        {/* Frosted Glass Core */}
        <div className="absolute inset-6 rounded-full bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 flex items-center justify-center shadow-[0_0_30px_rgba(16,185,129,0.15)] z-10 overflow-hidden">
          
          {/* Radar Sweep Effect inside the glass */}
          <div className="absolute inset-0 w-[200%] h-[200%] -top-[50%] -left-[50%] bg-[conic-gradient(from_0deg,transparent_70%,rgba(16,185,129,0.1)_100%)] animate-[spin_2s_linear_infinite]"></div>
          
          {/* Central Plane Icon */}
          <Plane 
            className={`h-6 w-6 text-emerald-500 dark:text-emerald-400 transition-all duration-1000 relative z-20 ${
              isLanding ? 'rotate-[45deg] translate-y-1' : '-rotate-45 hover:scale-110'
            }`} 
            strokeWidth={2.5}
          />
        </div>
        
      </div>

      {/* STAGGERED TEXT CROSS-FADE (Premium Typography) */}
      <div className="h-10 relative w-full flex justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.4 }}
            className="absolute text-[10px] sm:text-[11px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-[0.25em] text-center w-full"
          >
            {messages[messageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

    </div>
  );
}