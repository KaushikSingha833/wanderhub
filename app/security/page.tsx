"use client";
import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import Link from "next/link";
import { PlaneTakeoff, ShieldCheck, Lock, Fingerprint, Network, Server, Key, Terminal, ArrowRight } from "lucide-react";
import { useMotionValue } from "framer-motion";

// ==========================================
// 1. FLAWLESS PHYSICS CURSOR
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
// 2. MAGNETIC COMPONENT
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
// 3. MAIN SECURITY PAGE
// ==========================================
export default function SecurityPage() {
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
          <span className="text-2xl font-black tracking-tighter text-white">WanderHub</span>
        </Link>
        <MagneticElement className="pointer-events-auto">
          <Link href="/" className="whitespace-nowrap px-5 py-3 md:px-8 md:py-4 bg-white text-black font-black text-[10px] md:text-xs uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-colors shadow-2xl">
                Access Portal
            </Link>
        </MagneticElement>
      </nav>

      {/* HERO SECTION */}
      <section className="h-screen w-full relative flex flex-col items-center justify-center overflow-hidden">
        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.08)_0%,transparent_50%)]"></div>
          
          {/* Abstract Cryptography Visual */}
          <div className="relative w-[80vw] h-[80vw] md:w-[40vw] md:h-[40vw] flex items-center justify-center">
             <motion.div animate={{ rotate: 360 }} transition={{ duration: 50, repeat: Infinity, ease: "linear" }} className="absolute inset-0 border border-emerald-500/20 rounded-full border-dashed"></motion.div>
             <motion.div animate={{ rotate: -360 }} transition={{ duration: 40, repeat: Infinity, ease: "linear" }} className="absolute inset-10 border border-white/5 rounded-full"></motion.div>
             <ShieldCheck className="h-32 w-32 text-emerald-500/20 absolute" />
          </div>
        </motion.div>

        <div className="relative z-10 w-full px-6 flex flex-col items-center text-center">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2 }} className="mb-8">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-emerald-500/20 bg-emerald-500/5 backdrop-blur-md shadow-2xl text-emerald-400">
              <Lock className="h-4 w-4" />
              <span className="text-xs font-bold uppercase tracking-widest">Enterprise-Grade Security</span>
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1.2, delay: 0.4 }} className="text-[12vw] md:text-[8vw] font-black tracking-tighter leading-[0.85] text-white uppercase mix-blend-screen">
            ZERO<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-zinc-100 via-zinc-400 to-zinc-700 drop-shadow-2xl">
              COMPROMISE.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 1.5 }} className="mt-10 text-lg md:text-2xl font-medium text-zinc-400 max-w-2xl tracking-tight">
            Hermetically sealed environments. Cryptographic ledger synchronization. Granular document-level isolation.
          </motion.p>
        </div>
      </section>

      {/* BENTO GRID SECURITY ARCHITECTURE */}
      <section className="py-32 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-16 text-center">Defense in Depth.</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            <div className="md:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden group hover:border-white/10 transition-colors">
               <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
               <Network className="h-12 w-12 text-emerald-400 mb-8" />
               <h3 className="text-3xl font-black tracking-tighter mb-4">WSS:// Encrypted WebSockets</h3>
               <p className="text-zinc-400 text-lg leading-relaxed max-w-lg">All live collaborative sessions, expenses, and geographical routing calculations are transmitted over mathematically encrypted WebSocket channels, preventing man-in-the-middle (MITM) interceptions.</p>
            </div>

            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden group hover:border-white/10 transition-colors">
               <Fingerprint className="h-12 w-12 text-zinc-300 mb-8" />
               <h3 className="text-3xl font-black tracking-tighter mb-4">Auth Tokens</h3>
               <p className="text-zinc-400 leading-relaxed">Stateless JWT authentication ensures session integrity across edge nodes without exposing credentials.</p>
            </div>

            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden group hover:border-white/10 transition-colors">
               <Server className="h-12 w-12 text-zinc-300 mb-8" />
               <h3 className="text-3xl font-black tracking-tighter mb-4">Data at Rest</h3>
               <p className="text-zinc-400 leading-relaxed">All physical database partitions are encrypted at the storage level using AES-256 standard.</p>
            </div>

            <div className="md:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden flex flex-col md:flex-row items-center gap-12 group hover:border-white/10 transition-colors">
               <div className="flex-1">
                 <Key className="h-12 w-12 text-emerald-400 mb-8" />
                 <h3 className="text-3xl font-black tracking-tighter mb-4">PCI-DSS Payments</h3>
                 <p className="text-zinc-400 text-lg leading-relaxed">Direct integration with Razorpay ensures WanderHub never touches raw credit card data. All ledger settlements and B2B bookings are fully tokenized.</p>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* CODE TERMINAL SECTION */}
      <section className="py-32 relative z-10 bg-[#020202] border-y border-white/5 overflow-hidden">
         <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/10 blur-[150px] pointer-events-none"></div>
         <div className="max-w-7xl mx-auto px-6 grid md:grid-cols-2 gap-20 items-center relative z-10">
            
            <div>
               <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 mb-6">
                 <Terminal className="h-4 w-4 text-emerald-400" />
                 <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-300">Rules Engine</span>
               </div>
               <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 leading-none">Granular<br/>Isolation.</h2>
               <p className="text-xl text-zinc-400 font-medium leading-relaxed">
                 WanderHub's database utilizes a Zero-Trust architecture. Even if an actor is authenticated, strict algorithmic rules verify their membership in a workspace before a single byte of data is returned.
               </p>
            </div>

            {/* Fake Code Terminal */}
            <div className="rounded-2xl border border-white/10 bg-[#0a0a0a] shadow-2xl overflow-hidden text-sm md:text-base">
               <div className="bg-[#111] px-4 py-3 border-b border-white/5 flex gap-2">
                 <div className="h-3 w-3 rounded-full bg-rose-500"></div>
                 <div className="h-3 w-3 rounded-full bg-amber-500"></div>
                 <div className="h-3 w-3 rounded-full bg-emerald-500"></div>
               </div>
               <div className="p-6 md:p-8 font-mono text-zinc-400 overflow-x-auto leading-loose">
                  <span className="text-rose-400">match</span> /trips/&#123;tripId&#125; &#123;<br/>
                  &nbsp;&nbsp;<span className="text-emerald-400">// Strict Membership Verification</span><br/>
                  &nbsp;&nbsp;<span className="text-sky-400">allow</span> read, write: <span className="text-amber-400">if</span> isAuthenticated() && <br/>
                  &nbsp;&nbsp;(request.auth.uid <span className="text-rose-400">in</span> resource.data.members);<br/>
                  &#125;
               </div>
            </div>

         </div>
      </section>

      {/* FINAL CTA */}
      <section className="py-40 text-center px-6 relative z-10">
         <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-10">Secure Your Journey.</h2>
         <MagneticElement className="mx-auto block w-fit">
            <Link href="/" className="inline-flex items-center gap-4 bg-white text-black px-10 py-5 rounded-full text-lg font-black uppercase tracking-widest hover:scale-105 transition-transform">
               Deploy Workspace <ArrowRight className="h-6 w-6" />
            </Link>
         </MagneticElement>
      </section>

      {/* ==========================================
          FOOTER (SHARED)
      ========================================== */}
      <footer className="bg-[#020202] py-20 border-t border-white/5 relative z-20 overflow-hidden">
        <div className="max-w-7xl mx-auto px-6 relative z-10">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-12 mb-32">
             <div>
                <div className="flex items-center gap-4 mb-8">
                   <PlaneTakeoff className="h-10 w-10 text-white" />
                   <span className="text-4xl font-black tracking-tighter">WanderHub</span>
                </div>
                <p className="text-xl text-zinc-500 font-medium max-w-sm">The unified standard for geospatial planning and asynchronous ledger synchronization.</p>
             </div>
             <div className="flex flex-col sm:flex-row gap-12 text-sm font-bold uppercase tracking-widest text-zinc-500">
                <div className="flex flex-col gap-4">
                   <Link href="/landing" className="hover:text-emerald-400 transition-colors">Platform</Link>
                   <Link href="/infrastructure" className="hover:text-emerald-400 transition-colors">Infrastructure</Link>
                </div>
                <div className="flex flex-col gap-4">
                   <Link href="/security" className="text-white hover:text-emerald-400 transition-colors">Security</Link>
                   <Link href="/partner/join" className="hover:text-emerald-400 transition-colors">B2B Portal</Link>
                </div>
             </div>
          </div>
          
          <div className="flex flex-col md:flex-row justify-between items-center pt-8 border-t border-white/10 text-xs font-bold uppercase tracking-widest text-zinc-600">
             <p>© {new Date().getFullYear()} WANDERHUB TECHNOLOGIES.</p>
             <div className="flex items-center gap-4 mt-4 md:mt-0">
                <span>All Systems Nominal</span>
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
             </div>
          </div>
        </div>
        
        {/* Massive Background Text */}
        <div className="absolute bottom-[-5vw] md:bottom-[-10vw] left-0 right-0 text-[20vw] font-black text-white/[0.02] text-center pointer-events-none select-none tracking-tighter leading-none">
           WANDERHUB
        </div>
      </footer>

    </div>
  );
}