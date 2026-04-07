"use client";

import React, { useRef, useEffect } from 'react';
import { Globe, ArrowRight, ArrowUpRight, PlaneTakeoff, Map, Receipt, Sun, BedDouble, Star } from 'lucide-react';
import { motion, useInView } from "framer-motion";
import Link from 'next/link';

function HeroSection({ onLogin }: { onLogin: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    let playing = false;

    const fadeVideo = (from: number, to: number, duration: number, callback?: () => void) => {
      const start = performance.now();
      const animate = (time: number) => {
        const elapsed = time - start;
        const progress = Math.min(elapsed / duration, 1);
        if (video) {
          video.style.opacity = (from + (to - from) * progress).toString();
        }
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else if (callback) {
          callback();
        }
      };
      requestAnimationFrame(animate);
    };

    const handleCanPlay = () => {
      if (!playing) {
        playing = true;
        video.play();
        fadeVideo(0, 1, 500);
      }
    };

    const handleTimeUpdate = () => {
      if (video.duration - video.currentTime <= 0.55 && video.style.opacity === "1") {
        fadeVideo(1, 0, 500);
      }
    };

    const handleEnded = () => {
      video.style.opacity = "0";
      setTimeout(() => {
        video.currentTime = 0;
        video.play();
        fadeVideo(0, 1, 500);
      }, 100);
    };

    video.addEventListener("canplay", handleCanPlay);
    video.addEventListener("timeupdate", handleTimeUpdate);
    video.addEventListener("ended", handleEnded);

    return () => {
      video.removeEventListener("canplay", handleCanPlay);
      video.removeEventListener("timeupdate", handleTimeUpdate);
      video.removeEventListener("ended", handleEnded);
    };
  }, []);

  return (
    <div className="min-h-screen relative overflow-hidden flex flex-col bg-black">
      <video
        ref={videoRef}
        className="absolute inset-0 w-full h-full object-cover object-bottom"
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260405_074625_a81f018a-956b-43fb-9aee-4d1508e30e6a.mp4"
        muted
        playsInline
        preload="auto"
        style={{ opacity: 0 }}
      />
      
      <nav className="relative z-20 px-6 py-6 w-full max-w-5xl mx-auto flex justify-between items-center liquid-glass rounded-full mt-6">
        <div className="flex items-center gap-2">
          <PlaneTakeoff className="w-6 h-6 text-indigo-400" />
          <span className="text-white font-semibold text-lg">WanderHub</span>
          <div className="hidden md:flex gap-8 ml-8">
            <Link href="#" className="text-white/80 hover:text-white text-sm font-medium">Features</Link>
            <Link href="/partner/join" className="text-white/80 hover:text-white text-sm font-medium">Partners</Link>
            <Link href="#" className="text-white/80 hover:text-white text-sm font-medium">About</Link>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <button onClick={onLogin} className="text-white text-sm font-medium hover:text-indigo-300 transition-colors">Sign Up</button>
          <button onClick={onLogin} className="liquid-glass rounded-full px-6 py-2 text-white text-sm font-medium hover:bg-white/10 transition-colors">Login</button>
        </div>
      </nav>

      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 py-12 text-center -translate-y-[15%]">
        <h1 className="text-7xl md:text-8xl lg:text-9xl text-white tracking-tight whitespace-nowrap mb-8" style={{ fontFamily: "'Instrument Serif', serif" }}>
          Travel planning, <em className="italic text-indigo-200">evolved</em>.
        </h1>
        
        <p className="text-white/80 text-sm md:text-base leading-relaxed px-4 max-w-lg mx-auto mb-10">
          The ultimate platform for modern travelers. Build AI itineraries, book partner hotels, split live expenses, and sync it all with your group instantly.
        </p>

        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-16 w-full px-4">
          <button onClick={onLogin} className="bg-white text-black rounded-full px-8 py-3.5 text-sm font-bold shadow-lg hover:scale-105 transition-all flex items-center gap-2 group w-full sm:w-auto justify-center">
            Start Planning 
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </button>
          <Link href="/partner/join" className="liquid-glass rounded-full px-8 py-3.5 text-white text-sm font-medium hover:bg-white/10 transition-colors flex items-center gap-2 w-full sm:w-auto justify-center">
            <BedDouble className="w-4 h-4 text-indigo-300" /> List Property
          </Link>
        </div>
        
        <div className="flex items-center gap-4 text-xs font-semibold text-white/50">
           <div className="flex -space-x-2">
             {[1,2,3,4].map(i => <div key={i} className="w-8 h-8 rounded-full border border-black bg-gradient-to-br from-indigo-400 to-purple-500 shadow-sm opacity-80 block"></div>)}
           </div>
           <div className="text-left flex flex-col gap-0.5">
             <div className="flex items-center text-amber-400">
               <Star className="w-3 h-3 fill-amber-400 mr-0.5"/>
               <Star className="w-3 h-3 fill-amber-400 mr-0.5"/>
               <Star className="w-3 h-3 fill-amber-400 mr-0.5"/>
               <Star className="w-3 h-3 fill-amber-400 mr-0.5"/>
               <Star className="w-3 h-3 fill-amber-400"/>
             </div>
             Loved by 10,000+ travelers
           </div>
        </div>

      </div>

      <div className="relative z-10 flex justify-center gap-4 pb-12 w-full mt-auto">
        <button className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all outline-none">
          <Globe className="w-5 h-5" />
        </button>
        <button className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
          <Map className="w-5 h-5" />
        </button>
         <button className="liquid-glass rounded-full p-4 text-white/80 hover:text-white hover:bg-white/5 transition-all">
          <PlaneTakeoff className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
}

function AboutSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="bg-black pt-32 md:pt-44 pb-10 md:pb-14 px-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,255,255,0.03)_0%,_transparent_70%)] pointer-events-none"></div>
      
      <div className="max-w-5xl mx-auto relative z-10">
        <motion.p 
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 20 }}
          transition={{ duration: 0.6 }}
          className="text-white/40 text-sm tracking-widest uppercase mb-6"
        >
          About WanderHub
        </motion.p>

        <motion.h2
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8, delay: 0.1 }}
          className="text-4xl md:text-6xl lg:text-7xl text-white leading-[1.1] tracking-tight"
        >
          Seamless <span style={{ fontFamily: "'Instrument Serif', serif" }} className="italic text-white/60">journeys</span> for
          <br className="hidden md:block" />
          travelers that <span style={{ fontFamily: "'Instrument Serif', serif" }} className="italic text-white/60">explore, discover, and unite.</span>
        </motion.h2>
      </div>
    </section>
  );
}

function FeaturedVideoSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="bg-black pt-6 md:pt-10 pb-20 md:pb-32 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div 
          initial={{ opacity: 0, y: 60 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 60 }}
          transition={{ duration: 0.9 }}
          className="relative rounded-3xl overflow-hidden aspect-video block"
        >
          <video
            className="w-full h-full object-cover"
            src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260402_054547_9875cfc5-155a-4229-8ec8-b7ba7125cbf8.mp4"
            muted
            autoPlay
            loop
            playsInline
            preload="auto"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>

          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-10 flex flex-col md:flex-row justify-between items-end md:items-center gap-6">
            <div className="liquid-glass rounded-2xl p-6 md:p-8 max-w-md w-full md:w-auto text-left">
              <p className="text-white/50 text-xs tracking-widest uppercase mb-3">The Operating System</p>
              <p className="text-white/90 text-sm md:text-base leading-relaxed">
                Stop managing 15 open tabs. We unite maps, bookings, weather, and finances into one unified platform. Every adventure starts with a single tap.
              </p>
            </div>

            <motion.button 
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="liquid-glass rounded-full px-8 py-3 text-white text-sm font-medium whitespace-nowrap self-start md:self-end hover:bg-white/10 transition-colors"
            >
              Explore features
            </motion.button>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

function PhilosophySection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="bg-black py-28 md:py-40 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.h2 
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 40 }}
          transition={{ duration: 0.8 }}
          className="text-5xl md:text-7xl lg:text-8xl text-white tracking-tight mb-16 md:mb-24"
        >
          Exploration <span style={{ fontFamily: "'Instrument Serif', serif" }} className="italic text-white/40">x</span> Simplicity
        </motion.h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-12">
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
            transition={{ duration: 0.8 }}
            className="rounded-3xl overflow-hidden aspect-[4/3] block relative"
          >
            <video
              className="absolute inset-0 w-full h-full object-cover"
              src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260307_083826_e938b29f-a43a-41ec-a153-3d4730578ab8.mp4"
              muted
              autoPlay
              loop
              playsInline
              preload="auto"
            />
          </motion.div>

          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
            transition={{ duration: 0.8 }}
            className="flex flex-col justify-center gap-10"
          >
            <div>
              <p className="text-white/40 text-xs tracking-widest uppercase mb-4 flex items-center gap-2"><Map className="w-4 h-4"/> AI-Powered Itineraries</p>
              <p className="text-white/70 text-base md:text-lg leading-relaxed">
                Input your destination and dates. Our AI generates a perfectly optimized, day-by-day travel map instantly. Let us handle the logistics so you can focus on the experience.
              </p>
            </div>

            <div className="w-full h-px bg-white/10"></div>

            <div>
               <p className="text-white/40 text-xs tracking-widest uppercase mb-4 flex items-center gap-2"><BedDouble className="w-4 h-4"/> Hybrid Aggregator</p>
              <p className="text-white/70 text-base md:text-lg leading-relaxed">
                Compare millions of standard listings directly alongside verified, exclusive WanderHub Hotel Partners. We ensure you get the absolute best value on stays worldwide.
              </p>
            </div>
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function ServicesSection() {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  const cards = [
    {
      video: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260314_131748_f2ca2a28-fed7-44c8-b9a9-bd9acdd5ec31.mp4",
      tag: "Finance",
      title: "Live Split & Expenses",
      description: "Log expenses on the go. We calculate exactly who owes who, down to the last cent. Never argue over dinner bills again.",
      icon: <Receipt className="text-white w-4 h-4" />
    },
    {
       video: "https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260324_151826_c7218672-6e92-402c-9e45-f1e0f454bdc4.mp4",
      tag: "Planning",
      title: "Smart Weather & Maps",
      description: "Integrated API forecasting ensures you never pack a swimsuit for a thunderstorm, with unified maps connecting your entire group.",
      icon: <Sun className="text-white w-4 h-4" />
    }
  ];

  return (
    <section ref={ref} className="bg-black py-28 md:py-40 px-6 overflow-hidden relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(255,255,255,0.02)_0%,_transparent_60%)] pointer-events-none"></div>

      <div className="max-w-6xl mx-auto relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 30 }}
          transition={{ duration: 0.7 }}
          className="flex justify-between items-center mb-16"
        >
          <h2 className="text-3xl md:text-5xl text-white tracking-tight">Our features</h2>
          <span className="text-white/40 text-sm hidden md:block uppercase tracking-widest">Everything you need</span>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          {cards.map((card, idx) => (
            <motion.div
              key={idx}
              initial={{ opacity: 0, y: 50 }}
              animate={isInView ? { opacity: 1, y: 0 } : { opacity: 0, y: 50 }}
              transition={{ duration: 0.8, delay: idx * 0.15 }}
              className="liquid-glass rounded-3xl overflow-hidden group flex flex-col block border border-white/5"
            >
              <div className="aspect-video relative overflow-hidden block">
                <video
                  className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105 absolute inset-0"
                  src={card.video}
                  muted
                  autoPlay
                  loop
                  playsInline
                  preload="auto"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none"></div>
              </div>
              
              <div className="p-6 md:p-8 flex-1 flex flex-col justify-start relative z-10 bg-black/40 backdrop-blur-md">
                <div className="flex justify-between items-start mb-6 w-full">
                   <span className="uppercase tracking-widest text-white/40 text-xs">{card.tag}</span>
                   <div className="liquid-glass rounded-full p-2 block relative z-10 bg-white/5 border border-white/10">
                     {card.icon}
                   </div>
                </div>
                <h3 className="text-white text-xl md:text-2xl mb-3 tracking-tight">{card.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{card.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function LandingPage({ onLogin }: { onLogin: () => void }) {
  return (
    <div className="bg-black min-h-screen text-white font-sans selection:bg-white/20">
      <HeroSection onLogin={onLogin} />
      <AboutSection />
      <FeaturedVideoSection />
      <PhilosophySection />
      <ServicesSection />
    </div>
  );
}
