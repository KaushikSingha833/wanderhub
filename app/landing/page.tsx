"use client";
import React, { useRef, useState, useEffect } from "react";
import { motion, useScroll, useTransform, useSpring, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { PlaneTakeoff, Map as MapIcon, Receipt, BedDouble, ArrowRight, ShieldCheck, Zap, Users, Plus, Compass, Wallet, CreditCard, Loader2, Sparkles, Plane, MessageSquare, X } from "lucide-react";
import { useMotionValue } from "framer-motion";

const TRAVEL_DATA = [
  "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=1200&q=80",
  "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=1200&q=80",
  "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=1200&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=1200&q=80",
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=1200&q=80",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=1200&q=80",
];

const FAQS = [
  { q: "How does the AI Routing engine work?", a: "AERO utilizes a custom geospatial algorithm that ingests your desired landmarks and outputs a chronologically and geographically optimized sequence, minimizing transit times." },
  { q: "Is the Live Split feature truly real-time?", a: "Yes. Our architecture utilizes WebSockets to ensure that any expense logged by a group member is instantly reflected across all connected devices within 500 milliseconds." },
  { q: "How do you achieve 0% commission on hotels?", a: "We integrate directly with B2B hospitality providers, bypassing consumer-facing Online Travel Agencies (OTAs) to pass the wholesale rates directly to your workspace." },
  { q: "Can I export my itinerary?", a: "Absolutely. Workspaces can be exported to standard calendar formats, PDF dossiers, or shared via a live read-only web link." }
];

const CAROUSEL_FEATURES = [
  {
    id: "ai-routing",
    title: "AI Itinerary Routing",
    brief: "Algorithmic pathfinding for your daily travel plans.",
    detail: "Our proprietary AI processes millions of geospatial data points to sequence your daily landmarks. It minimizes transit time, accounts for local traffic patterns, and automatically reorganizes your day if delays occur.",
    icon: <Compass className="h-6 w-6 md:h-8 md:w-8 text-emerald-400" />,
    image: "https://images.unsplash.com/photo-1524661135-423995f22d0b?w=1200&q=80"
  },
  {
    id: "live-split",
    title: "Live Ledger Sync",
    brief: "Real-time expense splitting via WebSockets.",
    detail: "Eliminate the friction of group finances. Any expense logged by a member is instantly synced across all devices globally within 500ms. Complex debt matrices are mathematically simplified into single, easily settled balances.",
    icon: <Wallet className="h-6 w-6 md:h-8 md:w-8 text-emerald-400" />,
    image: "https://images.unsplash.com/photo-1554224155-6726b3ff858f?w=1200&q=80"
  },
  {
    id: "b2b-hotels",
    title: "Zero-Commission Hotels",
    brief: "Direct B2B integration bypassing OTA markups.",
    detail: "We connect directly to global hospitality aggregators. By eliminating consumer-facing Online Travel Agency (OTA) commissions, we pass wholesale rates directly to your workspace, saving you up to 30% per booking.",
    icon: <BedDouble className="h-6 w-6 md:h-8 md:w-8 text-emerald-400" />,
    image: "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=1200&q=80"
  },
  {
    id: "ndc-flights",
    title: "Global Flight Engine",
    brief: "Live NDC feeds for unmanipulated airline pricing.",
    detail: "Search and book flights using New Distribution Capability (NDC) feeds. This guarantees you are seeing real-time, unmanipulated airline inventory and pricing without artificial scarcity or tracking cookies.",
    icon: <Plane className="h-6 w-6 md:h-8 md:w-8 text-emerald-400" />,
    image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=1200&q=80"
  },
  {
    id: "group-chat",
    title: "Encrypted Comms",
    brief: "Dedicated workspace chat for trip coordination.",
    detail: "Keep your group aligned with integrated, end-to-end encrypted chat channels tied directly to your active expedition. Share polls, vote on hotels, and finalize decisions without leaving the environment.",
    icon: <MessageSquare className="h-6 w-6 md:h-8 md:w-8 text-emerald-400" />,
    image: "https://images.unsplash.com/photo-1511632765486-a01980e01a18?w=1200&q=80"
  },
  {
    id: "expense-analytics",
    title: "Expense Analytics",
    brief: "Visualize spending patterns with dynamic graphs.",
    detail: "Gain deep insights into your group's financial behavior. Our analytics engine categorizes expenses, tracks daily burn rates against budgets, and projects future costs based on historical data.",
    icon: <Receipt className="h-6 w-6 md:h-8 md:w-8 text-emerald-400" />,
    image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=1200&q=80"
  }
];

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
      animate={{ 
        scale: isHovering ? 2.5 : 1, 
        backgroundColor: isHovering ? "rgba(16, 185, 129, 0.2)" : "rgba(16, 185, 129, 0)", 
        borderWidth: isHovering ? "2px" : "1px" 
      }}
      transition={{ type: "spring", stiffness: 400, damping: 25 }}
    >
       <motion.div 
         className="h-1.5 w-1.5 bg-emerald-400 rounded-full"
         animate={{ opacity: isHovering ? 0 : 1 }}
       />
    </motion.div>
  );
};

const MagneticElement = ({ children, className }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const handleMouse = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current) return;
    const { clientX, clientY } = e;
    const { height, width, left, top } = ref.current.getBoundingClientRect();
    const middleX = clientX - (left + width / 2);
    const middleY = clientY - (top + height / 2);
    setPosition({ x: middleX * 0.3, y: middleY * 0.3 });
  };

  const reset = () => setPosition({ x: 0, y: 0 });

  return (
    <motion.div 
      ref={ref} 
      onMouseMove={handleMouse} 
      onMouseLeave={reset} 
      animate={{ x: position.x, y: position.y }} 
      transition={{ type: "spring", stiffness: 150, damping: 15, mass: 0.1 }} 
      className={className}
    >
      {children}
    </motion.div>
  );
};

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

const TypewriterText = ({ text, className = "" }: { text: string; className?: string }) => {
  return (
    <motion.p 
      className={className} 
      initial="hidden" 
      animate="visible" 
      variants={{
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { staggerChildren: 0.015 } }
      }}
    >
      {text.split("").map((char, index) => (
        <motion.span 
          key={index} 
          variants={{ hidden: { opacity: 0 }, visible: { opacity: 1 } }}
        >
          {char}
        </motion.span>
      ))}
    </motion.p>
  );
};

const FeatureCarousel = () => {
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedFeature, setSelectedFeature] = useState<any>(null);
  const total = CAROUSEL_FEATURES.length;

  useEffect(() => {
    if (selectedFeature) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [selectedFeature]);

  useEffect(() => {
    if (isPaused || selectedFeature) return;
    const timer = setTimeout(() => {
      setCurrent((prev) => (prev + 1) % total);
    }, 5000);
    return () => clearTimeout(timer);
  }, [current, isPaused, selectedFeature, total]);

  const getCardState = (idx: number) => {
    const diff = (idx - current + total) % total;
    if (diff === 0) return "center";
    if (diff === 1) return "right";
    if (diff === total - 1) return "left";
    return "hidden";
  };

  const cardVariants = {
    center: { x: "0%", scale: 1, opacity: 1, zIndex: 30, filter: "brightness(1) blur(0px)" },
    left: { x: "-55%", scale: 0.8, opacity: 0.5, zIndex: 20, filter: "brightness(0.4) blur(3px)" },
    right: { x: "55%", scale: 0.8, opacity: 0.5, zIndex: 20, filter: "brightness(0.4) blur(3px)" },
    hidden: { x: "0%", scale: 0.5, opacity: 0, zIndex: 10, filter: "brightness(0) blur(10px)" }
  };

  return (
    <>
      <section className="w-full bg-[#050505] relative z-20 border-y border-white/5">
        <div className="relative w-full max-w-7xl mx-auto px-6 py-20 md:py-32 overflow-hidden">
          <div className="mb-16 text-center">
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter text-white">Core Modules.</h2>
            <p className="text-zinc-400 font-medium mt-3 text-lg md:text-xl">The structural pillars of the AERO ecosystem.</p>
          </div>
          
          <div 
            className="relative h-[450px] md:h-[550px] w-full flex items-center justify-center perspective-[1000px]"
            onMouseEnter={() => setIsPaused(true)}
            onMouseLeave={() => setIsPaused(false)}
          >
            {CAROUSEL_FEATURES.map((feature, idx) => {
              const state = getCardState(idx);
              const isCenter = state === "center";

              return (
                <motion.div
                  key={feature.id}
                  initial={false}
                  animate={state}
                  variants={cardVariants}
                  transition={{ type: "spring", stiffness: 200, damping: 25 }}
                  className="absolute w-[80%] md:w-[60%] h-full rounded-[2.5rem] md:rounded-[3rem] overflow-hidden border border-white/10 bg-zinc-950 shadow-2xl flex flex-col cursor-pointer"
                  onClick={() => {
                    if (!isCenter) setCurrent(idx);
                  }}
                >
                  <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/60 to-transparent z-10"></div>
                    <img src={feature.image} alt={feature.title} className="w-full h-full object-cover filter grayscale opacity-60" />
                  </div>

                  {isCenter && (
                    <div className="relative z-20 flex flex-col h-full justify-end p-8 md:p-12">
                      <div className="flex items-center gap-4 mb-6">
                         <div className="h-12 w-12 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20">
                           {feature.icon}
                         </div>
                         <span className="text-5xl font-black text-white/10 tracking-tighter">0{idx + 1}</span>
                      </div>
                      <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-4">
                        {feature.title}
                      </h3>
                      
                      <div className="h-16 md:h-12">
                        <TypewriterText key={`brief-${current}`} text={feature.brief} className="font-mono text-emerald-400 text-sm md:text-base tracking-tight" />
                      </div>

                      <div className="mt-8">
                        <button 
                          onClick={(e) => { e.stopPropagation(); setSelectedFeature(feature); }}
                          className="bg-white text-black px-8 py-3.5 rounded-full font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.15)] flex items-center group/btn active:scale-95 border border-white/10"
                        >
                          Learn More <ArrowRight className="ml-2 h-4 w-4 group-hover/btn:translate-x-1 transition-transform" />
                        </button>
                      </div>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          <div className="flex gap-3 justify-center mt-12">
            {CAROUSEL_FEATURES.map((_, i) => (
              <div key={i} onClick={() => setCurrent(i)} className="h-1.5 md:h-2 w-12 md:w-16 bg-white/10 rounded-full overflow-hidden cursor-pointer">
                 <motion.div
                   className="h-full bg-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.8)]"
                   initial={{ width: "0%" }}
                   animate={{ width: i === current && !isPaused && !selectedFeature ? "100%" : i < current ? "100%" : "0%" }}
                   transition={{ duration: i === current && !isPaused && !selectedFeature ? 5 : 0.3, ease: "linear" }}
                 />
              </div>
            ))}
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedFeature && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center px-4">
            <motion.div 
              initial={{ opacity: 0 }} 
              animate={{ opacity: 1 }} 
              exit={{ opacity: 0 }}
              onClick={() => setSelectedFeature(null)}
              className="absolute inset-0 bg-black/80 backdrop-blur-xl"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-3xl bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] md:rounded-[3rem] overflow-hidden shadow-2xl z-10"
            >
              <div className="h-48 md:h-64 relative w-full overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] to-transparent z-10"></div>
                <img src={selectedFeature.image} alt={selectedFeature.title} className="w-full h-full object-cover opacity-50" />
                <button 
                  onClick={() => setSelectedFeature(null)}
                  className="absolute top-6 right-6 z-20 h-10 w-10 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full flex items-center justify-center text-white transition-colors border border-white/10 active:scale-95"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              
              <div className="p-8 md:p-12 -mt-16 md:-mt-20 relative z-20">
                <div className="h-16 w-16 md:h-20 md:w-20 bg-[#0a0a0a] border border-emerald-500/30 rounded-2xl flex items-center justify-center mb-6 shadow-2xl">
                  {selectedFeature.icon}
                </div>
                <h3 className="text-3xl md:text-5xl font-black text-white tracking-tighter mb-6">{selectedFeature.title}</h3>
                
                <div className="bg-emerald-950/20 border border-emerald-500/10 p-6 md:p-8 rounded-2xl min-h-[150px]">
                  <TypewriterText key={`detail-${selectedFeature.id}`} text={selectedFeature.detail} className="font-mono text-emerald-400 text-sm md:text-base leading-relaxed tracking-tight" />
                </div>
                
                <div className="mt-8 pt-8 border-t border-white/10">
                  <button onClick={() => setSelectedFeature(null)} className="w-full md:w-auto bg-white text-black px-10 py-4 rounded-full font-black text-xs uppercase tracking-widest hover:bg-emerald-400 transition-colors active:scale-95">
                    Close Briefing
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

const Accordion = ({ q, a }: { q: string, a: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/10 py-8 cursor-pointer group" onClick={() => setIsOpen(!isOpen)}>
      <div className="flex justify-between items-center">
        <h4 className="text-2xl md:text-3xl font-bold tracking-tight text-white group-hover:text-emerald-400 transition-colors pr-8">{q}</h4>
        <motion.div animate={{ rotate: isOpen ? 45 : 0 }} transition={{ type: "spring", stiffness: 200, damping: 20 }} className="shrink-0">
          <Plus className="h-8 w-8 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
        </motion.div>
      </div>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", stiffness: 100, damping: 20 }} className="overflow-hidden">
            <p className="pt-6 text-xl text-zinc-400 font-medium leading-relaxed max-w-4xl">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

const ParallaxColumn = ({ images, yTransform }: { images: string[], yTransform: any }) => (
  <motion.div style={{ y: yTransform }} className="flex flex-col gap-6 w-full md:w-1/3 min-w-[300px]">
    {images.map((src, i) => (
      <div key={i} className="w-full h-[350px] md:h-[500px] rounded-[2rem] overflow-hidden relative group shrink-0">
        <div className="absolute inset-0 bg-emerald-500/20 mix-blend-overlay z-10 opacity-0 group-hover:opacity-100 transition-opacity duration-700"></div>
        <img src={src} alt="Travel Architecture" className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 group-hover:scale-110 transition-all duration-1000 ease-out" />
      </div>
    ))}
  </motion.div>
);

const WalletGroup = () => (
  <div className="flex flex-col gap-4 w-full p-6">
    <div className="bg-[#050505] p-5 rounded-2xl border border-white/5 shadow-2xl flex items-center gap-4">
      <Wallet className="h-8 w-8 text-rose-400"/>
      <div className="flex-1"><div className="h-2 w-1/2 bg-white/20 rounded-full mb-2"></div><div className="h-2 w-3/4 bg-white/10 rounded-full"></div></div>
    </div>
    <div className="bg-[#050505] p-5 rounded-2xl border border-white/5 shadow-2xl flex items-center gap-4">
      <CreditCard className="h-8 w-8 text-emerald-400"/>
      <div className="flex-1"><div className="h-2 w-2/3 bg-white/20 rounded-full mb-2"></div><div className="h-2 w-1/2 bg-white/10 rounded-full"></div></div>
    </div>
  </div>
);

const DualCard = ({ num, title, desc, img, component }: any) => (
  <div className="w-full md:w-[45vw] min-h-[40vh] md:min-h-0 md:h-[40vh] shrink-0 bg-[#0a0a0a] border border-white/10 rounded-[2.5rem] md:rounded-[3rem] overflow-hidden relative flex flex-col md:flex-row shadow-2xl group hover:border-emerald-500/30 transition-colors duration-700">
    <div className="w-full md:w-[50%] p-8 md:p-12 flex flex-col justify-center relative z-20">
      <h2 className="text-4xl md:text-6xl font-black text-white/10 mb-2 md:mb-4 tracking-tighter">{num}</h2>
      <h3 className="text-3xl md:text-5xl font-black mb-3 tracking-tighter">{title}</h3>
      <p className="text-sm md:text-base text-zinc-400 font-medium leading-relaxed">{desc}</p>
    </div>
    <div className="w-full md:w-[50%] h-full absolute md:relative inset-0 md:inset-auto z-0 md:z-10">
      <div className="absolute inset-0 bg-gradient-to-t md:bg-gradient-to-r from-[#0a0a0a] via-[#0a0a0a]/90 md:via-transparent to-transparent z-10 pointer-events-none"></div>
      {img ? (
        <img src={img} className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-700 opacity-30 md:opacity-100 scale-105 group-hover:scale-100" alt={title} />
      ) : (
        <div className="w-full h-full flex items-center justify-center bg-[#050505] relative z-0 opacity-40 md:opacity-100">
          {component}
        </div>
      )}
    </div>
  </div>
);

export default function ProLanding() {
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 1500);
    return () => clearTimeout(timer);
  }, []);

  const mainRef = useRef(null);
  const { scrollYProgress } = useScroll({ target: mainRef });
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 50, damping: 20, restDelta: 0.001 });

  const dualRef = useRef(null);
  const { scrollYProgress: dualProgress } = useScroll({ 
    target: dualRef, 
    offset: ["start start", "end end"] 
  });
  
  const xTop = useTransform(dualProgress, [0, 1], ["5vw", "-60vw"]);
  const xBottom = useTransform(dualProgress, [0, 1], ["-60vw", "5vw"]);

  const svgRef = useRef(null);
  const { scrollYProgress: svgProgress } = useScroll({ target: svgRef, offset: ["start 80%", "end 20%"] });
  const pathLength = useSpring(useTransform(svgProgress, [0, 1], [0, 1]), { stiffness: 50, damping: 20 });

  const galleryRef = useRef(null);
  const { scrollYProgress: galleryProgress } = useScroll({ target: galleryRef, offset: ["start end", "end start"] });
  const y1 = useTransform(galleryProgress, [0, 1], ["0px", "-150px"]);
  const y2 = useTransform(galleryProgress, [0, 1], ["0px", "150px"]);
  const y3 = useTransform(galleryProgress, [0, 1], ["-100px", "-250px"]);

  return (
    <div ref={mainRef} className="text-white min-h-screen font-sans selection:bg-emerald-500/30 overflow-x-hidden relative">
      <CustomCursor />
      
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03] mix-blend-screen bg-[url('https://grainy-gradients.vercel.app/noise.svg')]"></div>

      <div className="fixed inset-0 z-[-1] pointer-events-none overflow-hidden bg-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 240, repeat: Infinity, ease: "linear" }}
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200vmax] h-[200vmax]"
        >
          <img src="https://images.unsplash.com/photo-1451187580459-43490279c0fa?q=80&w=2072" alt="Earth" className="w-full h-full object-cover opacity-80" />
        </motion.div>
        <div className="absolute inset-0 bg-[#050505]/80 z-10 pointer-events-none"></div>
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.15)_0%,transparent_60%)] z-10 pointer-events-none"></div>
      </div>

      <AnimatePresence>
        {!isLoaded && (
          <motion.div 
            initial={{ opacity: 1 }} 
            exit={{ opacity: 0, y: -50 }} 
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-0 z-[99999] bg-black flex flex-col items-center justify-center"
          >
            <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mb-6" />
            <div className="text-sm font-bold uppercase tracking-widest text-zinc-500 animate-pulse">Initializing OS</div>
          </motion.div>
        )}
      </AnimatePresence>

      <nav className="fixed top-0 w-full z-50 px-6 md:px-12 py-8 flex justify-between items-center mix-blend-difference pointer-events-none">
        <div className="flex items-center gap-3">
          <PlaneTakeoff className="h-8 w-8 text-emerald-400" />
          <span className="text-2xl font-black tracking-tighter text-white">AERO</span>
        </div>
        <MagneticElement className="pointer-events-auto">
          <Link href="/" className="whitespace-nowrap px-5 py-3 md:px-8 md:py-4 bg-white text-black font-black text-[10px] md:text-xs uppercase tracking-widest rounded-full hover:bg-emerald-400 transition-colors shadow-2xl">
                Access Portal
            </Link>
        </MagneticElement>
      </nav>

      <section className="h-screen w-full relative flex flex-col items-center justify-center overflow-hidden bg-transparent pt-10">
        <div className="relative z-10 w-full px-6 flex flex-col items-center text-center">
          
          <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 1.2, ease: "easeOut" }} className="mb-8">
            <div className="inline-flex items-center gap-3 px-5 py-2.5 rounded-full border border-white/10 bg-white/5 backdrop-blur-md shadow-2xl">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-xs font-bold uppercase tracking-widest text-zinc-300">AERO OS v2.0</span>
            </div>
          </motion.div>

          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1, delay: 1.4 }} className="flex flex-col items-center">
            <h1 className="text-[14vw] md:text-[9vw] font-black tracking-tighter leading-[0.85] text-white flex flex-col items-center uppercase">
              <span className="flex items-center gap-3 md:gap-6">
                UNIFY
                <motion.div
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: "18vw", opacity: 1 }}
                  transition={{ duration: 1.5, delay: 1.8, ease: [0.16, 1, 0.3, 1] }}
                  className="h-[10vw] md:h-[6.5vw] rounded-full overflow-hidden border border-white/20 shadow-2xl shrink-0 relative"
                >
                  <div className="absolute inset-0 bg-emerald-500/20 mix-blend-overlay z-10"></div>
                  <img src="https://images.unsplash.com/photo-1519501025264-65ba15a82390?w=1200&q=80" className="w-full h-full object-cover filter grayscale hover:grayscale-0 transition-all duration-700" alt="Travel Element" />
                </motion.div>
                YOUR
              </span>
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-teal-500 to-emerald-800 pb-2">EXPEDITIONS.</span>
            </h1>
          </motion.div>

          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 2.2, duration: 1 }} className="mt-10 text-lg md:text-2xl font-medium text-zinc-400 max-w-2xl tracking-tight">
            A hyper-optimized engine for modern travel. Sync itineraries, automate ledgers, and bypass OTA commissions in one frictionless workspace.
          </motion.p>
        </div>
      </section>

      <section className="w-full relative z-20 bg-[#050505]">
        <div className="py-40 px-6 max-w-7xl mx-auto min-h-screen flex items-center">
          <TextReveal text="We engineered AERO to replace the fractured ecosystem of legacy travel tools. A singular, hyper-optimized environment where itineraries, finances, and bookings converge seamlessly." />
        </div>
      </section>

      <FeatureCarousel />

      <section ref={svgRef} className="py-32 w-full relative overflow-hidden bg-black border-y border-white/5 z-20">
         <div className="max-w-7xl mx-auto px-6 relative z-10 grid grid-cols-1 md:grid-cols-2 gap-12 md:gap-20 items-center">
            <div>
               <div className="h-20 w-20 bg-zinc-900 border border-white/10 rounded-3xl flex items-center justify-center text-emerald-400 mb-10 shadow-inner">
                 <Compass className="h-10 w-10" />
               </div>
               <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-8 text-white">Spatial Logic.</h2>
               <p className="text-xl md:text-2xl text-zinc-400 font-medium leading-relaxed">Our AI node processes raw locational data, structuring it into an immutable, chronologically sequenced map. Transit friction is mathematically minimized.</p>
            </div>
            
            <div className="relative h-[400px] md:h-[600px] w-full bg-zinc-950 border border-white/10 rounded-[3rem] p-10 flex items-center justify-center overflow-hidden shadow-2xl">
               <svg viewBox="0 0 400 400" className="w-full h-full opacity-80 drop-shadow-[0_0_20px_rgba(16,185,129,0.4)]">
                  <motion.path d="M 50 350 C 100 300, 50 150, 150 150 C 250 150, 200 50, 350 50" fill="none" stroke="#34d399" strokeWidth="4" strokeLinecap="round" style={{ pathLength }} />
                  <motion.circle cx="50" cy="350" r="8" fill="#10b981" initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: 0.2 }} />
                  <motion.circle cx="150" cy="150" r="8" fill="#10b981" initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: 0.4 }} />
                  <motion.circle cx="350" cy="50" r="8" fill="#10b981" initial={{ scale: 0 }} whileInView={{ scale: 1 }} transition={{ delay: 0.6 }} />
               </svg>
            </div>
         </div>
      </section>

      <section ref={dualRef} className="h-auto md:h-[300vh] w-full relative z-20 py-20 md:py-0">
        
        <div className="hidden md:flex sticky top-0 h-screen w-full flex-col justify-center overflow-hidden bg-[#020202] gap-8 md:gap-12">
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[80%] h-[80%] bg-emerald-900/10 blur-[150px] pointer-events-none z-0"></div>

          <motion.div style={{ x: xTop }} className="flex gap-6 md:gap-10 w-max relative z-10 px-[5vw]">
             <DualCard 
               num="01." 
               title="Initiate." 
               desc="Define parameters. Establish temporal boundaries and invite actors via secure cryptographic links." 
               img={TRAVEL_DATA[0]} 
             />
             <DualCard 
               num="02." 
               title="Synthesize." 
               desc="Aggregated data converges. WebSockets reflect structural changes globally across all viewports instantly." 
               img={TRAVEL_DATA[1]} 
             />
             <div className="w-[85vw] md:w-[45vw] h-[35vh] md:h-[40vh] rounded-[2.5rem] md:rounded-[3rem] overflow-hidden border border-white/10 shrink-0 shadow-2xl group">
               <img src={TRAVEL_DATA[3]} className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-700 opacity-40 group-hover:opacity-100" alt="Padding" />
             </div>
          </motion.div>

          <motion.div style={{ x: xBottom }} className="flex gap-6 md:gap-10 w-max relative z-10 px-[5vw]">
             <div className="w-[85vw] md:w-[45vw] h-[35vh] md:h-[40vh] rounded-[2.5rem] md:rounded-[3rem] overflow-hidden border border-white/10 shrink-0 shadow-2xl group">
               <img src={TRAVEL_DATA[4]} className="w-full h-full object-cover filter grayscale group-hover:grayscale-0 transition-all duration-700 opacity-40 group-hover:opacity-100" alt="Padding" />
             </div>
             <DualCard 
               num="03." 
               title="Calculate." 
               desc="Distributed ledger algorithms process micro-expenses, rendering live debt matrices automatically." 
               component={<WalletGroup />} 
             />
             <DualCard 
               num="04." 
               title="Execute." 
               desc="Secure B2B infrastructure bridges digital planning with physical reality. Seamless transaction architecture." 
               img="https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80" 
             />
          </motion.div>
        </div>

        <div className="flex md:hidden flex-col gap-6 px-6 relative z-10 w-full max-w-md mx-auto">
           <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-emerald-900/10 blur-[100px] pointer-events-none z-0"></div>
           
           {[
             { num: "01.", title: "Initiate.", desc: "Define parameters. Establish temporal boundaries and invite actors via secure cryptographic links.", img: TRAVEL_DATA[0] },
             { num: "02.", title: "Synthesize.", desc: "Aggregated data converges. WebSockets reflect structural changes globally across all viewports instantly.", img: TRAVEL_DATA[1] },
             { num: "03.", title: "Calculate.", desc: "Distributed ledger algorithms process micro-expenses, rendering live debt matrices automatically.", component: <WalletGroup /> },
             { num: "04.", title: "Execute.", desc: "Secure B2B infrastructure bridges digital planning with physical reality. Seamless transaction architecture.", img: "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=1200&q=80" },
           ].map((card, idx) => (
             <motion.div
               key={idx}
               initial={{ opacity: 0, y: 80, scale: 0.9 }}
               whileInView={{ opacity: 1, y: 0, scale: 1 }}
               viewport={{ once: true, margin: "-100px" }}
               transition={{ duration: 0.6, delay: 0.1, ease: "easeOut" }}
             >
               <DualCard {...card} />
             </motion.div>
           ))}
        </div>
      </section>

      <section ref={galleryRef} className="py-40 w-full relative z-20 bg-[#050505] border-y border-white/5">
        <div className="max-w-7xl mx-auto px-6 mb-20 text-center relative z-20">
           <h2 className="text-5xl md:text-7xl font-black tracking-tighter text-white">Global Render.</h2>
           <p className="text-zinc-500 font-medium mt-4 text-xl">The world's destinations, integrated directly into your workspace.</p>
        </div>
        
        <div className="h-[700px] w-full max-w-[1400px] mx-auto px-6 overflow-hidden relative">
           <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#050505] to-transparent z-20 pointer-events-none"></div>
           <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-[#050505] to-transparent z-20 pointer-events-none"></div>
           
           <div className="flex flex-col md:flex-row gap-6">
             <ParallaxColumn images={[TRAVEL_DATA[0], TRAVEL_DATA[3], TRAVEL_DATA[1]]} yTransform={y1} />
             <ParallaxColumn images={[TRAVEL_DATA[4],"https://images.unsplash.com/photo-1467269204594-9661b134dd2b?w=1200&q=80", TRAVEL_DATA[5]]} yTransform={y2} />
             <ParallaxColumn images={[TRAVEL_DATA[1], TRAVEL_DATA[5], TRAVEL_DATA[0]]} yTransform={y3} />
           </div>
        </div>
      </section>

      <section className="w-full relative z-20 bg-[#050505]">
        <div className="py-40 px-6 max-w-4xl mx-auto">
           <h2 className="text-5xl md:text-7xl font-black tracking-tighter mb-20 text-center">Architecture FAQs.</h2>
           <div className="border-t border-white/10">
              {FAQS.map((faq, i) => <Accordion key={i} q={faq.q} a={faq.a} />)}
           </div>
        </div>
      </section>

      <section className="relative w-full h-screen flex flex-col items-center justify-center overflow-hidden bg-black border-t border-white/5 z-20">
         
         <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.1, 0.2, 0.1] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
            <div className="w-[120vw] h-[120vw] md:w-[80vw] md:h-[80vw] bg-emerald-500/30 rounded-full blur-[150px]"></div>
         </motion.div>

         <div className="relative z-10 text-center px-6 w-full max-w-5xl">
            <h2 className="text-[14vw] md:text-[8vw] font-black tracking-tighter leading-[0.9] mb-12 text-white drop-shadow-2xl">
               DEPLOY<br/>WORKSPACE.
            </h2>
            <MagneticElement className="mx-auto block w-fit">
               <Link href="/" className="relative group inline-flex items-center justify-center">
                  <div className="absolute inset-0 bg-emerald-500 rounded-full blur-2xl opacity-40 group-hover:opacity-100 transition-opacity duration-500"></div>
                  <div className="relative flex items-center gap-4 md:gap-6 bg-white text-black px-12 md:px-16 py-6 md:py-8 rounded-full text-xl md:text-2xl font-black uppercase tracking-widest overflow-hidden shadow-2xl">
                     <span className="relative z-10">Initialize</span>
                     <ArrowRight className="h-6 w-6 md:h-8 md:w-8 relative z-10 group-hover:rotate-[-45deg] transition-transform duration-500" />
                     <div className="absolute inset-0 bg-emerald-400 translate-y-full group-hover:translate-y-0 transition-transform duration-500 ease-out z-0"></div>
                  </div>
               </Link>
            </MagneticElement>
         </div>
      </section>

      <footer className="bg-[#020202] w-full py-20 border-t border-white/5 relative z-20 overflow-hidden">
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
                   <Link href="/landing" className="hover:text-emerald-400 transition-colors">Platform</Link>
                   <Link href="/infrastructure" className="hover:text-emerald-400 transition-colors">Infrastructure</Link>
                </div>
                <div className="flex flex-col gap-4">
                   <Link href="/security" className="hover:text-emerald-400 transition-colors">Security</Link>
                   <Link href="/partner/join" className="hover:text-emerald-400 transition-colors text-white">B2B Portal</Link>
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
        
        <motion.div 
           whileHover={{ 
             y: -20,
             color: "rgba(16, 185, 129, 0.15)",
             textShadow: "0px -20px 100px rgba(16, 185, 129, 0.5)",
             scale: 1.02
           }}
           transition={{ type: "spring", stiffness: 100, damping: 10 }}
           className="absolute bottom-[-5vw] md:bottom-[-10vw] left-0 right-0 text-[20vw] font-black text-white/[0.02] text-center select-none tracking-tighter leading-none cursor-pointer"
        >
           AERO
        </motion.div>
      </footer>
    </div>
  );
}