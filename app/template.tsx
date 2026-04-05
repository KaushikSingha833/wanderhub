"use client";
import { motion } from "framer-motion";

export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* The CSS for the exact loader you found, 
        updated with WanderHub's Indigo Theme colors 
      */}
      <style>{`
        .page-loader {
          --ballcolor: #818cf8; /* Tailwind indigo-400 */
          --shadow: 0px 0 rgba(255, 255, 255, 0);
          --shadowcolor: rgba(255, 255, 255, 0);
          width: 12px;
          height: 12px;
          left: -120px;
          border-radius: 50%;
          position: relative;
          color: var(--ballcolor);
          animation: shadowRolling 1.5s linear infinite;
        }

        @keyframes shadowRolling {
          0% {
            box-shadow: var(--shadow), var(--shadow), var(--shadow), var(--shadow);
          }
          12% {
            box-shadow: 100px 0 var(--ballcolor), var(--shadow), var(--shadow), var(--shadow);
          }
          25% {
            box-shadow: 110px 0 var(--ballcolor), 100px 0 var(--ballcolor), var(--shadow), var(--shadow);
          }
          36% {
            box-shadow: 120px 0 var(--ballcolor), 110px 0 var(--ballcolor), 100px 0 var(--ballcolor), var(--shadow);
          }
          50% {
            box-shadow: 130px 0 var(--ballcolor), 120px 0 var(--ballcolor), 110px 0 var(--ballcolor), 100px 0 var(--ballcolor);
          }
          62% {
            box-shadow: 200px 0 var(--shadowcolor), 130px 0 var(--ballcolor), 120px 0 var(--ballcolor), 110px 0 var(--ballcolor);
          }
          75% {
            box-shadow: 200px 0 var(--shadowcolor), 200px 0 var(--shadowcolor), 130px 0 var(--ballcolor), 120px 0 var(--ballcolor);
          }
          87% {
            box-shadow: 200px 0 var(--shadowcolor), 200px 0 var(--shadowcolor), 200px 0 var(--shadowcolor), 130px 0 var(--ballcolor);
          }
          100% {
            box-shadow: 200px 0 var(--shadowcolor), 200px 0 var(--shadowcolor), 200px 0 var(--shadowcolor), 200px 0 var(--shadowcolor);
          }
        }
      `}</style>

      {/* LAYER 1: The Indigo Accent Wipe */}
      <motion.div
        className="fixed inset-0 z-[100] bg-indigo-600 pointer-events-none"
        initial={{ y: "0%" }}
        animate={{ y: "-100%" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.15 }}
      />

      {/* LAYER 2: The Main Dark Curtain */}
      <motion.div
        className="fixed inset-0 z-[101] bg-slate-900 dark:bg-black flex flex-col items-center justify-center pointer-events-none overflow-hidden"
        initial={{ y: "0%" }}
        animate={{ y: "-100%" }}
        transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.2 }}
      >
        {/* The new trailing balls loader */}
        <div className="page-loader"></div>
        
        {/* Subtle typography to complement the loader */}
        <p className="text-indigo-400/70 font-black tracking-[0.4em] uppercase text-[10px] mt-10">
          Loading
        </p>
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