"use client";
import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { PlaneTakeoff, Map, Receipt, BedDouble, ArrowRight, MessageSquare, MousePointer2, GitMerge, LayoutDashboard, Sparkles, Layers } from "lucide-react";
import { useMotionValue } from "framer-motion";

// ==========================================
// 1. DATA ASSETS
// ==========================================
const TRAVEL_DATA = [
  "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1200&q=80",
  "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=1200&q=80",
  "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=1200&q=80",
];

// ==========================================
// 2. FLAWLESS PHYSICS CURSOR
// ==========================================
const CustomCursor = () => {
  const mouseX = useMotionValue(-100);
  const mouseY = useMotionValue(-100);
  const springX = useSpring(mouseX, { stiffness: 500, damping: 28, mass: 0.1 });
  const springY = useSpring(mouseY, { stiffness: 500, damping: 28, mass: 0.1 });
  const [isHovering, setIsHovering] = useState(false);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX - 16);
      mouseY.set(e.clientY - 16);
      const target = e.target as HTMLElement;
      const isClickable = window.getComputedStyle(target).cursor === "pointer" || target.closest('a') || target.closest('button');
      setIsHovering(!!isClickable);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  return (
    <motion.div
      className="fixed left-0 top-0 z-[9999] h-8 w-8 rounded-full border border-emerald-500 bg-emerald-500/10 backdrop-blur-sm mix-blend-screen pointer-events-none hidden md:flex items-center justify-center"
      style={{ x: springX, y: springY }}
      animate={{ scale: isHovering ? 2.5 : 1, backgroundColor: isHovering ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0)", borderWidth: isHovering ? "2px" : "1px" }}
    >
       <motion.div className="h-1.5 w-1.5 bg-emerald-400 rounded-full" animate={{ opacity: isHovering ? 0 : 1 }} />
    </motion.div>
  );
};

// ==========================================
// 3. MAGNETIC COMPONENT
// ==========================================
const MagneticElement = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    setPosition({ x: (clientX - (left + width / 2)) * 0.3, y: (clientY - (top + height / 2)) * 0.3 });
  };

  return (
    <motion.div ref={ref} onMouseMove={handleMouse} onMouseLeave={() => setPosition({x:0, y:0})} animate={{ x: position.x, y: position.y }} transition={{ type: "spring", stiffness: 150, damping: 15 }} className={className}>
      {children}
    </motion.div>
  );
};

// ==========================================
// 4. SCROLL REVEAL TYPOGRAPHY
// ==========================================
const TextReveal = ({ text }: { text: string }) => {
  const ref = useRef(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 80%", "end 40%"] });
  const words = text.split(" ");

  return (
    <p ref={ref} className="text-4xl md:text-7xl font-black tracking-tighter leading-[1.1] text-white/20 flex flex-wrap gap-x-3 md:gap-x-5 gap-y-2">
      {words.map((word, i) => {
        const start = i / words.length;
        const end = start + 1 / words.length;
        const opacity = useTransform(scrollYProgress, [start, end], [0.1, 1]);
        return <motion.span key={i} style={{ opacity }} className="text-white">{word}</motion.span>;
      })}
    </p>
  );
};

// ==========================================
// 5. MAIN PLATFORM PAGE
// ==========================================
export default function PlatformPage() {
  const mainRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: mainRef });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 50, damping: 20 });
  
  const heroY = useTransform(smoothProgress, [0, 0.2], [0, 200]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.2], [1, 0]);

  return (
    <div ref={mainRef} className="bg-[#050505] text-white min-h-screen font-sans selection:bg-emerald-500/30 overflow-x-hidden relative">
      <CustomCursor />
      
      {/* GLOBAL NOISE */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] mix-blend-screen bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      {/* NAVBAR */}
      <nav className="fixed top-0 w-full z-50 px-6 md:px-12 py-8 flex justify-between items-center mix-blend-difference pointer-events-none">
        <Link href="/landing" className="flex items-center gap-3 pointer-events-auto">
          <PlaneTakeoff className="h-8 w-8 text-emerald-400" />
          <span className="text-2xl font-black tracking-tighter text-white">AERO</span>
        </Link>
        <MagneticElement className="pointer-events-auto">
          <Link href="/" className="px-8 py-4 bg-white text-black font-black text-xs uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-colors shadow-2xl">
            Access Portal
          </Link>
        </MagneticElement>
      </nav>

      {/* ==========================================
          HERO SECTION (THE OS CONCEPT)
      ========================================== */}
      <section className="h-screen w-full relative flex flex-col items-center justify-center overflow-hidden bg-[#050505]">
        
        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.15)_0%,transparent_60%)]"></div>
          
          {/* Abstract Layered UI Visual */}
          <div className="relative w-[100vw] h-[100vw] md:w-[60vw] md:h-[60vw] perspective-[1200px] flex items-center justify-center">
             <motion.div animate={{ rotateX: [60, 50, 60], rotateZ: [0, 5, 0], y: [0, -20, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute w-[60%] h-[60%] border border-white/10 bg-white/[0.02] backdrop-blur-sm rounded-3xl shadow-2xl"></motion.div>
             <motion.div animate={{ rotateX: [60, 65, 60], rotateZ: [0, -5, 0], y: [40, 20, 40] }} transition={{ duration: 9, repeat: Infinity, ease: "easeInOut" }} className="absolute w-[50%] h-[50%] border border-emerald-500/20 bg-emerald-500/[0.02] backdrop-blur-md rounded-3xl shadow-2xl"></motion.div>
             <motion.div animate={{ rotateX: [60, 55, 60], rotateZ: [0, 3, 0], y: [80, 60, 80] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute w-[40%] h-[40%] border border-white/5 bg-black/50 backdrop-blur-xl rounded-3xl shadow-2xl flex items-center justify-center">
                <Layers className="h-16 w-16 text-emerald-500/30" />
             </motion.div>
          </div>
        </motion.div>

        <div className="relative z-10 w-full px-6 flex flex-col items-center text-center mt-10">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2 }} className="mb-8">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl text-emerald-400">
              <LayoutDashboard className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">The Workspace</span>
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, scale: 0.95, filter: "blur(10px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 1.2, delay: 0.4 }} className="text-[12vw] md:text-[8vw] font-black tracking-tighter leading-[0.85] text-white uppercase mix-blend-screen">
            A UNIFIED<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-300 via-teal-400 to-emerald-700 drop-shadow-[0_0_30px_rgba(16,185,129,0.3)]">
              ECOSYSTEM.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 1.5 }} className="mt-10 text-lg md:text-2xl font-medium text-zinc-400 max-w-2xl tracking-tight">
            Four hyper-optimized modules running in perfect synchrony. Leave the chaotic group chats and fragmented spreadsheets behind.
          </motion.p>
        </div>
      </section>

      {/* ==========================================
          SCROLL REVEAL TEXT
      ========================================== */}
      <section className="py-40 px-6 max-w-7xl mx-auto min-h-screen flex items-center">
        <TextReveal text="A journey is a complex, dynamic system with multiple moving parts. AERO orchestrates the logistics, finances, and communications into a single, beautiful interface." />
      </section>

      {/* ==========================================
          THE 4 MODULES (BENTO GRID)
      ========================================== */}
      <section className="py-32 px-6 relative z-10 bg-black border-y border-white/5 overflow-hidden">
        <div className="absolute top-0 right-0 w-[600px] h-[600px] bg-emerald-900/10 blur-[150px] pointer-events-none"></div>
        <div className="max-w-7xl mx-auto relative z-10">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-16 text-center">The Application Suite.</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* ITINERARY (Large) */}
            <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden group hover:border-white/10 transition-colors">
               <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
               <div className="relative z-10 flex flex-col md:flex-row gap-10 items-center">
                 <div className="flex-1">
                   <div className="h-16 w-16 bg-black border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner text-emerald-400"><Map className="h-8 w-8" /></div>
                   <h3 className="text-3xl font-black tracking-tighter mb-4">Geospatial Routing</h3>
                   <p className="text-zinc-400 leading-relaxed">Drag-and-drop locations. Our AI calculates optimal transit times and sequences your days automatically.</p>
                 </div>
                 <div className="w-full md:w-64 h-48 bg-black rounded-2xl border border-white/5 p-4 flex flex-col gap-3 shadow-2xl relative overflow-hidden">
                    <div className="w-full h-8 bg-zinc-900 rounded-md border border-white/5"></div>
                    <div className="w-3/4 h-8 bg-zinc-900 rounded-md border border-white/5"></div>
                    <div className="w-full h-8 bg-emerald-900/40 rounded-md border border-emerald-500/20"></div>
                    {/* Simulated Path Line */}
                    <div className="absolute left-6 top-8 bottom-8 w-[2px] bg-emerald-500/30"></div>
                 </div>
               </div>
            </div>

            {/* EXPENSES (Small) */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden group hover:border-white/10 transition-colors">
               <div className="h-14 w-14 bg-black border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner text-rose-400"><Receipt className="h-6 w-6" /></div>
               <h3 className="text-2xl font-black tracking-tighter mb-4">Ledger Sync</h3>
               <p className="text-zinc-400 leading-relaxed text-sm">Log an expense and immediately see exactly who owes whom. Fully tokenized and mathematically sound.</p>
            </div>

            {/* CHAT (Small) */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden group hover:border-white/10 transition-colors">
               <div className="h-14 w-14 bg-black border border-white/10 rounded-2xl flex items-center justify-center mb-6 shadow-inner text-sky-400"><MessageSquare className="h-6 w-6" /></div>
               <h3 className="text-2xl font-black tracking-tighter mb-4">Comms Link</h3>
               <p className="text-zinc-400 leading-relaxed text-sm">Threaded discussions tied directly to specific itinerary items. Stop losing context in external apps.</p>
            </div>

            {/* HOTELS (Large) */}
            <div className="lg:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden flex flex-col md:flex-row items-center gap-12 group hover:border-white/10 transition-colors">
               <div className="flex-1 z-10">
                 <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-teal-500/20 bg-teal-500/10 mb-6">
                   <span className="text-[10px] font-bold uppercase tracking-widest text-teal-400">Exclusive Network</span>
                 </div>
                 <h3 className="text-3xl font-black tracking-tighter mb-4">B2B Hospitality</h3>
                 <p className="text-zinc-400 text-lg leading-relaxed">Browse millions of global listings alongside our verified partner network. Book directly with 0% commission fees injected into your ledger automatically.</p>
               </div>
               <div className="w-full md:w-64 h-48 bg-black rounded-2xl border border-white/5 overflow-hidden relative shadow-2xl shrink-0">
                  <img src={TRAVEL_DATA[2]} className="w-full h-full object-cover opacity-50 grayscale group-hover:grayscale-0 transition-all duration-700" alt="Hotel" />
                  <div className="absolute bottom-4 left-4 right-4 bg-black/60 backdrop-blur-md rounded-xl p-3 border border-white/10 flex items-center justify-between">
                     <span className="text-xs font-bold text-white">Grand Resort</span>
                     <span className="text-[10px] text-teal-400 font-bold uppercase">Verified</span>
                  </div>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* ==========================================
          MULTIPLAYER / LIVE CURSOR ANIMATION
      ========================================== */}
      <section className="py-40 relative z-10 overflow-hidden bg-[#020202]">
         <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center">
            
            <div>
               <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-6">
                 <GitMerge className="h-4 w-4 text-emerald-400" />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Multiplayer Native</span>
               </div>
               <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 leading-none">Total<br/>Synchrony.</h2>
               <p className="text-xl text-zinc-400 font-medium leading-relaxed mb-8">
                 When one person updates the itinerary or logs an expense, every connected device on the network updates instantly via WebSocket connections. You will never look at outdated information again.
               </p>
            </div>

            {/* Simulated Live Environment */}
            <div className="w-full h-[400px] bg-[#0a0a0a] rounded-[3rem] border border-white/5 shadow-2xl relative overflow-hidden">
               {/* Abstract Grid */}
               <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-screen"></div>
               <div className="absolute inset-0 border-[0.5px] border-white/[0.02] grid grid-cols-6 grid-rows-4">
                  {[...Array(24)].map((_, i) => <div key={i} className="border-[0.5px] border-white/[0.02]"></div>)}
               </div>

               {/* Central UI Element */}
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-32 bg-black border border-white/10 rounded-2xl shadow-xl flex items-center justify-center flex-col">
                  <div className="h-2 w-32 bg-zinc-800 rounded-full mb-4"></div>
                  <div className="h-2 w-24 bg-emerald-900/50 rounded-full"></div>
               </div>

               {/* Simulated Cursors */}
               <motion.div animate={{ x: [50, 250, 150, 50], y: [50, 100, 250, 50] }} transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }} className="absolute z-20 flex flex-col items-center drop-shadow-xl">
                  <MousePointer2 className="h-6 w-6 text-rose-500 fill-rose-500 -rotate-12" />
                  <span className="bg-rose-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">Alex</span>
               </motion.div>

               <motion.div animate={{ x: [300, 100, 250, 300], y: [250, 200, 80, 250] }} transition={{ duration: 7, repeat: Infinity, ease: "easeInOut" }} className="absolute z-20 flex flex-col items-center drop-shadow-xl">
                  <MousePointer2 className="h-6 w-6 text-sky-500 fill-sky-500 -rotate-12" />
                  <span className="bg-sky-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">Sarah</span>
               </motion.div>

               <motion.div animate={{ x: [150, 280, 80, 150], y: [300, 50, 150, 300] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }} className="absolute z-20 flex flex-col items-center drop-shadow-xl">
                  <MousePointer2 className="h-6 w-6 text-emerald-500 fill-emerald-500 -rotate-12" />
                  <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full mt-1">You</span>
               </motion.div>
            </div>

         </div>
      </section>

      {/* ==========================================
          FINAL CTA
      ========================================== */}
      <section className="relative h-[80vh] flex flex-col items-center justify-center overflow-hidden bg-black border-t border-white/5">
         <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
            <div className="w-[120vw] h-[120vw] md:w-[80vw] md:h-[80vw] bg-emerald-500/30 rounded-full blur-[150px]"></div>
         </motion.div>

         <div className="relative z-10 text-center px-6 w-full max-w-5xl">
            <h2 className="text-[10vw] md:text-[6vw] font-black tracking-tighter leading-[0.9] mb-12 text-white drop-shadow-2xl">
               ENTER THE<br/>ECOSYSTEM.
            </h2>
            <MagneticElement className="mx-auto block w-fit">
               <Link href="/" className="relative group inline-flex items-center justify-center">
                  <div className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl opacity-40 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative flex items-center gap-4 md:gap-6 bg-white text-black px-12 md:px-16 py-6 md:py-8 rounded-full text-xl md:text-2xl font-black uppercase tracking-widest overflow-hidden shadow-2xl">
                     <span className="relative z-10">Start Planning</span>
                     <ArrowRight className="h-6 w-6 md:h-8 md:w-8 relative z-10 group-hover:translate-x-2 transition-transform duration-500" />
                  </div>
               </Link>
            </MagneticElement>
         </div>
      </section>

      {/* ==========================================
          FOOTER
      ========================================== */}
      <footer className="bg-[#020202] py-20 border-t border-white/5 relative z-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 mb-32">
             <div>
                <div className="flex items-center gap-4 mb-8">
                   <PlaneTakeoff className="h-10 w-10 text-white" />
                   <span className="text-4xl font-black tracking-tighter">AERO</span>
                </div>
                <p className="text-xl text-zinc-500 font-medium max-w-sm">The unified standard for geospatial planning and asynchronous ledger synchronization.</p>
             </div>
             <div className="flex flex-col sm:flex-row gap-12 text-sm font-bold uppercase tracking-widest text-zinc-500">
                <div className="flex flex-col gap-4">
                   <Link href="/platform" className="text-white hover:text-emerald-400 transition-colors">Platform</Link>
                   <Link href="/infrastructure" className="hover:text-emerald-400 transition-colors">Infrastructure</Link>
                </div>
                <div className="flex flex-col gap-4">
                   <Link href="/security" className="hover:text-emerald-400 transition-colors">Security</Link>
                   <Link href="/partner/join" className="hover:text-emerald-400 transition-colors">B2B Portal</Link>
                </div>
             </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 text-xs font-bold uppercase tracking-widest text-zinc-600">
             <p>© {new Date().getFullYear()} AERO TECHNOLOGIES.</p>
             <div className="flex items-center gap-4 mt-4 md:mt-0">
                <span>All Systems Nominal</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
             </div>
          </div>
        </div>
        
        <div className="absolute bottom-[-5vw] md:bottom-[-10vw] left-0 right-0 text-[20vw] font-black text-white/[0.02] text-center pointer-events-none select-none tracking-tighter leading-none">
           AERO
        </div>
      </footer>

    </div>
  );
}