"use client";
import { motion } from "framer-motion";
import { PlaneTakeoff } from "lucide-react";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* LAYER 1: The Emerald Accent Wipe */}
      <motion.div
        className="fixed inset-0 z-[100] bg-emerald-500 pointer-events-none shadow-[0_0_50px_rgba(16,185,129,0.5)]"
        initial={{ y: "0%" }}
        animate={{ y: "-100%" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      />

      {/* LAYER 2: The Main Dark Curtain */}
      <motion.div
        className="fixed inset-0 z-[101] bg-zinc-950 flex flex-col items-center justify-center pointer-events-none overflow-hidden"
        initial={{ y: "0%" }}
        animate={{ y: "-100%" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      >
        {/* Ambient Glow & Texture */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay"></div>
        <div className="absolute w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px]"></div>

        {/* High-End Glassmorphic Loader */}
        <div className="relative flex items-center justify-center h-32 w-32 mb-10 z-10">
          
          {/* Outer Spin Ring */}
          <div className="absolute inset-0 border border-zinc-800 border-t-emerald-500 rounded-full animate-[spin_1.5s_linear_infinite] shadow-[0_0_30px_rgba(16,185,129,0.3)] opacity-90"></div>
          
          {/* Inner Spin Ring */}
          <div className="absolute inset-3 border border-zinc-800 border-b-teal-400 rounded-full animate-[spin_2.5s_linear_infinite_reverse] opacity-70"></div>
          
          {/* Frosted Glass Core */}
          <div className="absolute inset-6 bg-zinc-950/60 backdrop-blur-xl rounded-full flex items-center justify-center border border-white/10 shadow-inner">
            <PlaneTakeoff className="h-6 w-6 text-emerald-400 animate-pulse" />
          </div>

        </div>

        {/* Editorial Typography */}
        <div className="relative z-10 text-center">
          <h2 className="text-white font-black tracking-[0.2em] uppercase text-xl mb-3 drop-shadow-md">
            AERO
          </h2>
          <p className="text-emerald-500/80 font-bold tracking-[0.4em] uppercase text-[9px] animate-pulse">
            Initializing Workspace
          </p>
        </div>
      </motion.div>

      {/* THE ACTUAL PAGE CONTENT */}
      <motion.div
        initial={{ opacity: 0, scale: 0.98, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
        className="h-full w-full"
      >
        {children}
      </motion.div>
    </>
  );
}