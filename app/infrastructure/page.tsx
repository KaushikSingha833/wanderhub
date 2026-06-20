"use client";
import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { PlaneTakeoff, Server, Cpu, Globe2, Activity, Zap, Database, Network, ArrowRight, HardDrive } from "lucide-react";
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
// 3. SCROLL REVEAL TYPOGRAPHY
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
        // eslint-disable-next-line react-hooks/rules-of-hooks
        const opacity = useTransform(scrollYProgress, [start, end], [0.1, 1]);
        return <motion.span key={i} style={{ opacity }} className="text-white">{word}</motion.span>;
      })}
    </p>
  );
};

// ==========================================
// 4. ANIMATED DATA NODE COMPONENT
// ==========================================
const DataNode = ({ cx, cy, delay }: { cx: number, cy: number, delay: number }) => (
  <g>
    <motion.circle cx={cx} cy={cy} r="4" fill="#10b981" initial={{ opacity: 0, scale: 0 }} whileInView={{ opacity: 1, scale: 1 }} transition={{ delay, duration: 0.5 }} viewport={{ once: true }} />
    <motion.circle cx={cx} cy={cy} r="12" fill="none" stroke="#10b981" strokeWidth="1"
      animate={{ scale: [1, 2.5, 1], opacity: [0.8, 0, 0] }}
      transition={{ duration: 2, repeat: Infinity, delay: delay, ease: "easeOut" }}
    />
  </g>
);

// ==========================================
// 5. MAIN INFRASTRUCTURE PAGE
// ==========================================
export default function InfrastructurePage() {
  const mainRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: mainRef });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 50, damping: 20 });
  const heroY = useTransform(smoothProgress, [0, 0.2], [0, 200]);
  const heroOpacity = useTransform(smoothProgress, [0, 0.2], [1, 0]);

  // Network SVG Draw Math
  const svgRef = useRef(null);
  const { scrollYProgress: svgProgress } = useScroll({ target: svgRef, offset: ["start 70%", "end 30%"] });
  const pathLength = useSpring(useTransform(svgProgress, [0, 1], [0, 1]), { stiffness: 40, damping: 20 });

  return (
    <div ref={mainRef} className="bg-[#050505] text-white min-h-screen font-sans selection:bg-emerald-500/30 overflow-x-hidden relative">
      <CustomCursor />
      
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] mix-blend-screen bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      <nav className="fixed top-0 w-full z-50 px-6 md:px-12 py-8 flex justify-between items-center mix-blend-difference pointer-events-none">
        <Link href="/landing" className="flex items-center gap-3 pointer-events-auto">
          <PlaneTakeoff className="h-8 w-8 text-emerald-400" />
          <span className="text-2xl font-black tracking-tighter text-white">WanderHub</span>
        </Link>
        <MagneticElement className="pointer-events-auto">
          <Link href="/" className="px-8 py-4 bg-white text-black font-black text-xs uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-colors shadow-2xl">
            Access Portal
          </Link>
        </MagneticElement>
      </nav>

      {/* ==========================================
          HERO SECTION
      ========================================== */}
      <section className="h-screen w-full relative flex flex-col items-center justify-center overflow-hidden bg-[#050505]">
        
        {/* Animated Grid / Mesh Background */}
        <motion.div style={{ opacity: heroOpacity, y: heroY }} className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(16,185,129,0.15)_0%,transparent_70%)]"></div>
          
          <div className="absolute inset-0" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '4vw 4vw', perspective: '1000px' }}>
             <motion.div animate={{ rotateX: 60, y: [0, 50] }} transition={{ duration: 5, repeat: Infinity, repeatType: "reverse", ease: "linear" }} className="w-full h-full transform origin-top opacity-30"></motion.div>
          </div>
        </motion.div>

        <div className="relative z-10 w-full px-6 flex flex-col items-center text-center mt-20">
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.2 }} className="mb-8">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl">
              <Server className="h-4 w-4 text-emerald-400" />
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">Global Infrastructure</span>
            </div>
          </motion.div>

          <motion.h1 initial={{ opacity: 0, scale: 0.9, filter: "blur(20px)" }} animate={{ opacity: 1, scale: 1, filter: "blur(0px)" }} transition={{ duration: 1.5, delay: 0.4, ease: [0.16, 1, 0.3, 1] }} className="text-[14vw] md:text-[9vw] font-black tracking-tighter leading-[0.85] text-white uppercase mix-blend-screen">
            PLANETARY<br/>
            <span className="text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 via-emerald-600 to-emerald-900 drop-shadow-[0_0_40px_rgba(16,185,129,0.4)]">
              SCALE.
            </span>
          </motion.h1>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1, duration: 1.5 }} className="mt-12 text-lg md:text-2xl font-medium text-zinc-400 max-w-2xl tracking-tight">
            WanderHub operates on a distributed edge network, ensuring sub-500ms latency for real-time synchronization, anywhere on Earth.
          </motion.p>
        </div>
      </section>

      {/* ==========================================
          SCROLL REVEAL TEXT
      ========================================== */}
      <section className="py-40 px-6 max-w-7xl mx-auto min-h-screen flex items-center">
        <TextReveal text="Legacy systems rely on centralized monolithic servers. We shattered that architecture. WanderHub deploys code and data to the absolute edge, running compute cycles physically closer to your devices." />
      </section>

      {/* ==========================================
          GLOBAL NODE NETWORK (SVG DRAW ANIMATION)
      ========================================== */}
      <section ref={svgRef} className="py-32 relative z-10 border-y border-white/5 bg-black overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-emerald-900/10 blur-[150px] pointer-events-none"></div>
        
        <div className="max-w-7xl mx-auto px-6 relative z-10 flex flex-col items-center">
           <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-4 text-center">The Edge Mesh.</h2>
           <p className="text-zinc-400 text-xl font-medium text-center max-w-2xl mb-20">Routing, WebSockets, and AI computations are executed across 200+ globally distributed points of presence.</p>
           
           <div className="w-full h-[400px] md:h-[600px] relative border border-white/10 rounded-[3rem] bg-[#050505] shadow-2xl overflow-hidden flex items-center justify-center">
              
              {/* World Map Backdrop (Abstract) */}
              <div className="absolute inset-0 opacity-[0.15] bg-[url('https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80')] bg-cover bg-center filter grayscale mix-blend-luminosity"></div>

              {/* SVG Network Draw */}
              <svg viewBox="0 0 1000 600" className="w-full h-full relative z-10 drop-shadow-[0_0_15px_rgba(16,185,129,0.6)]">
                 {/* Main Trunks */}
                 <motion.path d="M 200 200 C 400 100, 600 300, 800 200" fill="none" stroke="#34d399" strokeWidth="3" strokeDasharray="5 5" style={{ pathLength }} />
                 <motion.path d="M 200 200 C 300 400, 500 500, 700 400" fill="none" stroke="#10b981" strokeWidth="2" style={{ pathLength }} />
                 <motion.path d="M 800 200 C 900 300, 800 500, 700 400" fill="none" stroke="#059669" strokeWidth="2" strokeDasharray="10 5" style={{ pathLength }} />
                 <motion.path d="M 400 100 C 450 250, 550 250, 700 400" fill="none" stroke="#34d399" strokeWidth="1.5" style={{ pathLength }} />

                 {/* Nodes */}
                 <DataNode cx={200} cy={200} delay={0.2} />
                 <DataNode cx={400} cy={100} delay={0.4} />
                 <DataNode cx={600} cy={300} delay={0.6} />
                 <DataNode cx={800} cy={200} delay={0.8} />
                 <DataNode cx={300} cy={400} delay={0.5} />
                 <DataNode cx={500} cy={500} delay={0.7} />
                 <DataNode cx={700} cy={400} delay={0.9} />
              </svg>
           </div>
        </div>
      </section>

      {/* ==========================================
          BENTO GRID (THE STACK)
      ========================================== */}
      <section className="py-40 px-6 relative z-10">
        <div className="max-w-7xl mx-auto">
          <h2 className="text-4xl md:text-6xl font-black tracking-tighter mb-16">The Engine Room.</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            
            {/* Feature 1 (Large) */}
            <div className="md:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden group">
               {/* Animated Data Line Border */}
               <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-emerald-500 to-transparent -translate-x-full group-hover:animate-[slideRight_2s_ease-in-out_infinite]"></div>
               <div className="relative z-10">
                 <Cpu className="h-12 w-12 text-emerald-400 mb-8" />
                 <h3 className="text-3xl font-black tracking-tighter mb-4">Vercel Edge Compute</h3>
                 <p className="text-zinc-400 text-lg leading-relaxed max-w-lg">Our Next.js Turbopack architecture pre-renders static assets while delegating heavy dynamic operations (like AI routing) directly to Edge Functions deployed globally.</p>
               </div>
            </div>

            {/* Feature 2 (Small) */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden group">
               <Database className="h-10 w-10 text-zinc-300 mb-6" />
               <h3 className="text-2xl font-black tracking-tighter mb-3">NoSQL Ledger</h3>
               <p className="text-zinc-400 text-sm leading-relaxed">Firestore's document model allows us to perform real-time fan-out updates for split expenses.</p>
            </div>

            {/* Feature 3 (Small) */}
            <div className="bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 relative overflow-hidden group">
               <Network className="h-10 w-10 text-zinc-300 mb-6" />
               <h3 className="text-2xl font-black tracking-tighter mb-3">WebSocket Sockets</h3>
               <p className="text-zinc-400 text-sm leading-relaxed">Persistent TCP connections keep your group chats and live map trackers perfectly in sync.</p>
            </div>

            {/* Feature 4 (Large) */}
            <div className="md:col-span-2 bg-[#0a0a0a] border border-white/5 rounded-[2.5rem] p-10 md:p-14 relative overflow-hidden flex flex-col md:flex-row items-center gap-12 group">
               <div className="flex-1 z-10">
                 <HardDrive className="h-12 w-12 text-emerald-400 mb-8" />
                 <h3 className="text-3xl font-black tracking-tighter mb-4">Hybrid Aggregation API</h3>
                 <p className="text-zinc-400 text-lg leading-relaxed">We don't just rely on our own B2B inventory. Our gateway nodes dynamically fetch and compare standard OTA rates in the background to ensure price parity.</p>
               </div>
            </div>

          </div>
        </div>
      </section>

      {/* ==========================================
          PERFORMANCE STATS
      ========================================== */}
      <section className="py-32 relative z-10 border-t border-white/5 bg-[#020202]">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-px bg-white/5 rounded-[3rem] overflow-hidden border border-white/10">
            
            {[
              { label: "Latency", value: "<50ms", desc: "Edge Cold Start" },
              { label: "Uptime", value: "99.99%", desc: "SLA Guarantee" },
              { label: "Nodes", value: "200+", desc: "Global PoPs" },
              { label: "Queries", value: "10M+", desc: "Processed Daily" },
            ].map((stat, i) => (
              <div key={i} className="bg-[#050505] p-12 text-center flex flex-col justify-center group hover:bg-[#0a0a0a] transition-colors">
                <h4 className="text-5xl md:text-6xl font-black tracking-tighter text-white mb-2 group-hover:text-emerald-400 transition-colors">
                  {stat.value}
                </h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
                  {stat.desc}
                </p>
              </div>
            ))}
            
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
               SPIN UP A<br/>CLUSTER.
            </h2>
            <MagneticElement className="mx-auto block w-fit">
               <Link href="/" className="relative group inline-flex items-center justify-center">
                  <div className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl opacity-40 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative flex items-center gap-4 md:gap-6 bg-white text-black px-12 md:px-16 py-6 md:py-8 rounded-full text-xl md:text-2xl font-black uppercase tracking-widest overflow-hidden shadow-2xl">
                     <span className="relative z-10">Initialize App</span>
                     <ArrowRight className="h-6 w-6 md:h-8 md:w-8 relative z-10 group-hover:translate-x-2 transition-transform duration-500" />
                  </div>
               </Link>
            </MagneticElement>
         </div>
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
                   <Link href="/infrastructure" className="text-white hover:text-emerald-400 transition-colors">Infrastructure</Link>
                </div>
                <div className="flex flex-col gap-4">
                   <Link href="/security" className="hover:text-emerald-400 transition-colors">Security</Link>
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
        <div className="absolute bottom-[-5vw] md:bottom-[-10vw] left-0 right-0 text-[20vw] font-black text-white/[0.02] text-center pointer-events-none select-none tracking-tighter leading-none">
           WANDERHUB
        </div>
      </footer>

      {/* Global CSS for Data Line Animation */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slideRight {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
      `}} />
    </div>
  );
}