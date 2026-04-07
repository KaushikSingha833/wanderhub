"use client";
import { useState, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

interface TravelLoaderProps {
  messages: string[];
  isLanding?: boolean; // Used to optionally tilt the plane during payment success
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

      {/* This is the exact CSS keyframe logic you provided from Uiverse, 
        adapted for our Aeroplane lengths! 
      */}
      <style>{`
        .plane_part {
          stroke: currentColor;
          transition: stroke 0.3s ease;
        }
        
        .plane_body { animation: draw80 3s ease-in-out infinite; }
        .plane_wing { animation: draw40 3s ease-in-out infinite; }
        .plane_tail { animation: draw30 3s ease-in-out infinite; }
        .plane_window { animation: draw10 3s ease-in-out infinite; }
        /* Slight delay on the wind so it trails the plane */
        .plane_wind { animation: draw10 3s ease-in-out infinite; animation-delay: 0.15s; } 

        @keyframes draw80 { 
          from { stroke-dashoffset: 80; } 
          33%, 67% { stroke-dashoffset: 0; } 
          to { stroke-dashoffset: -80; } 
        }
        @keyframes draw40 { 
          from { stroke-dashoffset: 40; } 
          33%, 67% { stroke-dashoffset: 0; } 
          to { stroke-dashoffset: -40; } 
        }
        @keyframes draw30 { 
          from { stroke-dashoffset: 30; } 
          33%, 67% { stroke-dashoffset: 0; } 
          to { stroke-dashoffset: -30; } 
        }
        @keyframes draw10 { 
          from { stroke-dashoffset: 10; } 
          33%, 67% { stroke-dashoffset: 0; } 
          to { stroke-dashoffset: -10; } 
        }
      `}</style>

      {/* THE AEROPLANE SVG DRAWING */}
      <div className={`relative w-40 h-32 flex items-center justify-center mb-6 transition-transform duration-700 ${isLanding ? 'rotate-12 translate-y-2' : '-rotate-6'}`}>
        <svg
          className="w-full h-auto text-indigo-600 dark:text-indigo-400 drop-shadow-xl"
          viewBox="0 0 48 30"
          fill="none"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          {/* Wind / Speed Trails */}
          <line className="plane_part plane_wind" x1="8" y1="10" x2="2" y2="10" strokeDasharray="10 10" />
          <line className="plane_part plane_wind" x1="6" y1="20" x2="0" y2="20" strokeDasharray="10 10" />
          <line className="plane_part plane_wind" x1="12" y1="25" x2="6" y2="25" strokeDasharray="10 10" />

          {/* Aeroplane Body (Fuselage) */}
          <path className="plane_part plane_body" d="M 12,15 L 35,15 C 39,15 41,16 41,17 C 41,18 39,19 35,19 L 12,19 C 10,19 10,15 12,15 Z" strokeDasharray="80 80" />

          {/* Aeroplane Tail */}
          <path className="plane_part plane_tail" d="M 15,15 L 10,6 L 6,6 L 12,15 Z" strokeDasharray="30 30" />

          {/* Top Wing */}
          <path className="plane_part plane_wing" d="M 28,15 L 18,4 L 14,4 L 22,15" strokeDasharray="40 40" />

          {/* Bottom Wing */}
          <path className="plane_part plane_wing" d="M 26,19 L 16,29 L 12,29 L 20,19" strokeDasharray="40 40" />

          {/* Passenger Windows */}
          <line className="plane_part plane_window" x1="30" y1="17" x2="35" y2="17" strokeDasharray="10 10" />
        </svg>
      </div>

      {/* STAGGERED TEXT CROSS-FADE (Using Framer Motion) */}
      <div className="h-8 relative w-full flex justify-center">
        <AnimatePresence mode="wait">
          <motion.p
            key={messageIndex}
            initial={{ opacity: 0, y: 10, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -10, filter: "blur(4px)" }}
            transition={{ duration: 0.4 }}
            className="absolute text-sm font-black text-slate-600 dark:text-slate-300 uppercase tracking-widest text-center"
          >
            {messages[messageIndex]}
          </motion.p>
        </AnimatePresence>
      </div>

    </div>
  );
}