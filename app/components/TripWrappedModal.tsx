"use client";
import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, animate } from "framer-motion";
import { X, Map, CreditCard, Hotel, Trophy, ArrowRight, Download, Zap } from "lucide-react";

interface TripWrappedProps {
  isOpen: boolean;
  onClose: () => void;
  tripData: {
    title: string;
    memberCount: number;
    distanceKm: number;
    totalSpend: number;
    topHotelName: string;
    topHotelVotes: number;
    activitiesCount: number;
  };
}

const AnimatedNumber = ({ value, prefix = "", suffix = "" }: { value: number, prefix?: string, suffix?: string }) => {
  const nodeRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const node = nodeRef.current;
    if (node) {
      const controls = animate(0, value, {
        duration: 2.5,
        ease: "easeOut",
        onUpdate(val) {
          node.textContent = `${prefix}${Math.floor(val).toLocaleString()}${suffix}`;
        }
      });
      return () => controls.stop();
    }
  }, [value, prefix, suffix]);

  return <span ref={nodeRef} />;
};

export default function TripWrappedModal({ isOpen, onClose, tripData }: TripWrappedProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const totalSlides = 5;
  const slideDuration = 5000;

  useEffect(() => {
    if (!isOpen) {
      setCurrentSlide(0);
      return;
    }

    const timer = setInterval(() => {
      setCurrentSlide((prev) => {
        if (prev === totalSlides - 1) {
          clearInterval(timer);
          return prev;
        }
        return prev + 1;
      });
    }, slideDuration);

    return () => clearInterval(timer);
  }, [isOpen, currentSlide]);

  const handleNext = () => {
    if (currentSlide < totalSlides - 1) setCurrentSlide((prev) => prev + 1);
  };

  const handlePrev = () => {
    if (currentSlide > 0) setCurrentSlide((prev) => prev - 1);
  };

  if (!isOpen) return null;

  const slideVariants = {
    initial: { opacity: 0, scale: 1.1, filter: "blur(10px)" },
    animate: { opacity: 1, scale: 1, filter: "blur(0px)", transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] } },
    exit: { opacity: 0, scale: 0.9, filter: "blur(10px)", transition: { duration: 0.5, ease: [0.7, 0, 0.84, 0] } }
  };

  const textVariants = {
    initial: { opacity: 0, y: 40 },
    animate: { opacity: 1, y: 0, transition: { duration: 0.8, delay: 0.3, ease: "easeOut" } }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-zinc-950 text-white overflow-hidden flex flex-col selection:bg-emerald-500/30">
      
      <div className="absolute inset-0 pointer-events-none opacity-[0.05] bg-[url('https://grainy-gradients.vercel.app/noise.svg')] mix-blend-overlay z-0"></div>
      
      <motion.div 
        animate={{ 
          background: [
            "radial-gradient(circle at 0% 0%, rgba(16,185,129,0.15) 0%, transparent 50%)",
            "radial-gradient(circle at 100% 100%, rgba(16,185,129,0.15) 0%, transparent 50%)",
            "radial-gradient(circle at 0% 100%, rgba(16,185,129,0.15) 0%, transparent 50%)",
            "radial-gradient(circle at 100% 0%, rgba(16,185,129,0.15) 0%, transparent 50%)"
          ]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
        className="absolute inset-0 z-0"
      />

      <div className="absolute top-0 left-0 right-0 z-50 p-4 flex gap-2">
        {Array.from({ length: totalSlides }).map((_, i) => (
          <div key={i} className="h-1.5 flex-1 bg-white/20 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: i < currentSlide ? "100%" : "0%" }}
              animate={{ width: i === currentSlide ? "100%" : i < currentSlide ? "100%" : "0%" }}
              transition={{ duration: i === currentSlide ? slideDuration / 1000 : 0, ease: "linear" }}
              className="h-full bg-emerald-500"
            />
          </div>
        ))}
      </div>

      <button onClick={onClose} className="absolute top-10 right-6 z-50 p-3 bg-white/10 hover:bg-white/20 backdrop-blur-md rounded-full transition-colors">
        <X className="h-5 w-5" />
      </button>

      <div className="absolute inset-y-0 left-0 w-1/3 z-40" onClick={handlePrev} />
      <div className="absolute inset-y-0 right-0 w-1/3 z-40" onClick={handleNext} />

      <div className="relative z-10 flex-1 flex items-center justify-center p-6 h-full w-full max-w-2xl mx-auto pointer-events-none">
        <AnimatePresence mode="wait">
          
          {currentSlide === 0 && (
            <motion.div key="slide0" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="text-center w-full">
              <motion.div variants={textVariants} className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-8">
                <Zap className="h-3.5 w-3.5" /> Mission Accomplished
              </motion.div>
              <motion.h1 variants={textVariants} className="text-6xl md:text-8xl font-black tracking-tighter uppercase leading-[0.85] mb-6">
                THE<br />
                <span className="text-transparent bg-clip-text bg-gradient-to-b from-white to-zinc-500">{tripData.title}</span><br />
                FILES.
              </motion.h1>
              <motion.p variants={textVariants} className="text-zinc-400 font-medium uppercase tracking-widest text-sm">
                Executed by {tripData.memberCount} Travelers
              </motion.p>
            </motion.div>
          )}

          {currentSlide === 1 && (
            <motion.div key="slide1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="text-center w-full">
              <motion.div variants={textVariants} className="h-20 w-20 bg-zinc-900 border border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-8 shadow-2xl">
                <Map className="h-10 w-10 text-emerald-500" />
              </motion.div>
              <motion.h2 variants={textVariants} className="text-3xl font-bold text-zinc-300 mb-2">You covered</motion.h2>
              <motion.div variants={textVariants} className="text-7xl md:text-9xl font-black text-white tracking-tighter drop-shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <AnimatedNumber value={tripData.distanceKm} />
              </motion.div>
              <motion.h3 variants={textVariants} className="text-2xl font-bold text-emerald-500 mt-2 uppercase tracking-widest">Kilometers</motion.h3>
              <motion.p variants={textVariants} className="text-zinc-500 font-medium mt-8 text-sm uppercase tracking-widest border border-zinc-800 rounded-full px-6 py-3 inline-block">
                Across {tripData.activitiesCount} recorded waypoints.
              </motion.p>
            </motion.div>
          )}

          {currentSlide === 2 && (
            <motion.div key="slide2" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="w-full flex flex-col items-center">
              <motion.h2 variants={textVariants} className="text-3xl font-bold text-zinc-300 mb-12 text-center">The Financial Ledger</motion.h2>
              
              <motion.div variants={textVariants} className="w-full bg-zinc-900 border border-zinc-800 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-transparent"></div>
                <div className="flex items-center gap-4 mb-8 text-zinc-400">
                  <CreditCard className="h-6 w-6" />
                  <span className="uppercase tracking-widest text-xs font-bold">Total Network Spend</span>
                </div>
                <div className="text-6xl md:text-7xl font-black tracking-tighter text-white mb-8">
                  <AnimatedNumber value={tripData.totalSpend} prefix="₹" />
                </div>
                
                <div className="border-t border-zinc-800 pt-8 flex justify-between items-end">
                  <div>
                    <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Per Operator Average</p>
                    <p className="text-3xl font-black text-emerald-400">
                      <AnimatedNumber value={tripData.totalSpend / tripData.memberCount} prefix="₹" />
                    </p>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}

          {currentSlide === 3 && (
            <motion.div key="slide3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="text-center w-full">
              <motion.h2 variants={textVariants} className="text-2xl font-bold text-zinc-400 uppercase tracking-widest mb-12">The Basecamp</motion.h2>
              <motion.div variants={textVariants} className="relative inline-block mb-8">
                <div className="absolute inset-0 bg-emerald-500 blur-3xl opacity-20 rounded-full"></div>
                <div className="h-32 w-32 bg-zinc-900 border-2 border-emerald-500 rounded-[2rem] flex items-center justify-center relative z-10 rotate-12">
                  <Hotel className="h-14 w-14 text-white" />
                </div>
                <div className="absolute -top-4 -right-4 h-12 w-12 bg-emerald-500 rounded-full flex items-center justify-center z-20 border-4 border-zinc-950">
                  <Trophy className="h-5 w-5 text-zinc-950" />
                </div>
              </motion.div>
              <motion.h3 variants={textVariants} className="text-5xl md:text-6xl font-black text-white tracking-tighter leading-tight mb-4">
                {tripData.topHotelName}
              </motion.h3>
              <motion.div variants={textVariants} className="inline-flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-6 py-3 rounded-full mt-4">
                <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
                <span className="text-sm font-bold uppercase tracking-widest text-zinc-300">
                  {tripData.topHotelVotes} Unanimous Votes
                </span>
              </motion.div>
            </motion.div>
          )}

          {currentSlide === 4 && (
            <motion.div id="final-summary-card" key="slide4" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="w-full flex flex-col items-center pointer-events-auto">
              
              <div className="w-full bg-zinc-900 border border-zinc-800 rounded-[2rem] p-8 md:p-10 shadow-2xl relative overflow-hidden mb-8">
                <div className="absolute top-0 right-0 p-8 opacity-10">
                  <Zap className="h-32 w-32" />
                </div>
                
                <div className="relative z-10">
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-zinc-950 border border-zinc-800 rounded-full text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-6">
                    WanderHub Verified
                  </div>
                  
                  <h2 className="text-4xl md:text-5xl font-black text-white uppercase tracking-tighter mb-10 leading-none">
                    {tripData.title}
                  </h2>

                  <div className="grid grid-cols-2 gap-y-8 gap-x-4 border-l-2 border-emerald-500 pl-6">
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Distance</p>
                      <p className="text-xl font-black text-white">{tripData.distanceKm.toLocaleString()} KM</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Squad</p>
                      <p className="text-xl font-black text-white">{tripData.memberCount} Members</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Total Spend</p>
                      <p className="text-xl font-black text-emerald-400">₹{tripData.totalSpend.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 mb-1">Top Stay</p>
                      <p className="text-base font-bold text-white truncate pr-4">{tripData.topHotelName}</p>
                    </div>
                  </div>
                </div>
                
                <div className="mt-10 pt-6 border-t border-zinc-800 flex justify-between items-center relative z-10">
                  <div className="flex gap-1">
                    {[1,2,3,4,5,6,7,8].map(i => (
                      <div key={i} className={`w-1 h-8 ${i%2===0 ? 'bg-zinc-700' : 'bg-zinc-500'}`}></div>
                    ))}
                  </div>
                  <span className="text-[9px] font-mono text-zinc-500 tracking-widest">WNDR-HUB-2026</span>
                </div>
              </div>

              <button className="flex items-center justify-center gap-3 w-full max-w-sm bg-emerald-500 hover:bg-emerald-400 text-zinc-950 py-4 rounded-full font-black uppercase tracking-widest transition-all active:scale-95 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <Download className="h-5 w-5" /> Save Digital Manifest
              </button>

            </motion.div>
          )}

        </AnimatePresence>
      </div>

    </div>
  );
}