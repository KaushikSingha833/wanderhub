"use client";

export default function LiquidBackground() {
  return (
    <div className="fixed inset-0 w-full h-full -z-50 overflow-hidden bg-slate-50 dark:bg-[#030712] transition-colors duration-500">
      
      {/* The "Blobs": We use absolute positioning, bright brand colors, 
        massive blurs, and our new custom animations to create fluid motion.
      */}
      
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-400/40 dark:bg-indigo-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 animate-blob"></div>
      
      <div className="absolute top-[20%] right-[-5%] w-96 h-96 bg-blue-400/40 dark:bg-blue-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[100px] opacity-70 animate-blob-slow"></div>
      
      <div className="absolute bottom-[-10%] left-[20%] w-[30rem] h-[30rem] bg-purple-400/30 dark:bg-purple-600/20 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-[120px] opacity-70 animate-blob-slower"></div>

      {/* A subtle noise overlay gives the liquid a premium, frosted texture */}
      <div className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] pointer-events-none"></div>
    </div>
  );
}