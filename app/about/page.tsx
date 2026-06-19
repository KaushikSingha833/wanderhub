"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Menu, X, BedDouble, Plane, MessageSquare, Info, Sparkles, Globe, ShieldCheck, Zap, Target, Users, Compass, Briefcase, Building2, ArrowRight, Code, Cpu, LineChart } from "lucide-react";

export default function AboutPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, []);

  return (
    <div className="flex h-screen bg-[#030712] font-sans text-white overflow-hidden transition-colors duration-300 selection:bg-emerald-500/30">
      
      {/* --- CUSTOM CSS ANIMATIONS --- */}
      <style dangerouslySetInnerHTML={{
        __html: `
        @keyframes float1 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(2deg); }
        }
        @keyframes float2 {
          0%, 100% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(20px) rotate(-2deg); }
        }
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 15s infinite; }
        .animate-float-1 { animation: float1 8s ease-in-out infinite; }
        .animate-float-2 { animation: float2 10s ease-in-out infinite; }
        .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(24px); -webkit-backdrop-filter: blur(24px); border: 1px solid rgba(255, 255, 255, 0.05); }
        .glass-panel-hover:hover { background: rgba(255, 255, 255, 0.06); border: 1px solid rgba(255, 255, 255, 0.1); box-shadow: 0 20px 40px -10px rgba(16, 185, 129, 0.1); }
      `}} />

      {/* MOBILE MENU BLUR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-40 md:hidden transition-opacity duration-300" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* FLOATING SIDEBAR (EDITORIAL STYLE) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 glass-panel border-r border-white/10 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isMobileMenuOpen ? "translate-x-0 shadow-[0_0_50px_rgba(0,0,0,0.5)]" : "-translate-x-full"} md:relative md:translate-x-0 bg-[#030712]/50`}>
        <div className="h-20 flex items-center px-8 border-b border-white/5 shrink-0">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-white rounded-full flex items-center justify-center mr-3 shadow-[0_0_15px_rgba(255,255,255,0.2)]">
              <PlaneTakeoff className="h-4 w-4 text-black" />
            </div>
            <span className="text-xl font-black tracking-tighter text-white">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto md:hidden p-2 text-zinc-400 hover:text-white rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>
        
        <nav className="flex-1 px-4 py-8 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white rounded-2xl font-medium transition-all"><Map className="h-5 w-5 mr-3 opacity-70" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white rounded-2xl font-medium transition-all"><Calendar className="h-5 w-5 mr-3 opacity-70" /> Itineraries</Link>
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white rounded-2xl font-medium transition-all"><MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white rounded-2xl font-medium transition-all"><BedDouble className="h-5 w-5 mr-3 opacity-70" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-400 hover:bg-white/5 hover:text-white rounded-2xl font-medium transition-all"><Settings className="h-5 w-5 mr-3 opacity-70" /> Settings</Link>
          
          <div className="mt-auto pt-6 border-t border-white/5">
            <Link href="/about" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-white/10 text-white rounded-2xl font-bold transition-all shadow-[0_0_15px_rgba(255,255,255,0.05)] border border-white/10"><Info className="h-5 w-5 mr-3 text-emerald-400" /> About Us</Link>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* DYNAMIC BACKGROUND BLOBS */}
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none z-0"></div>
        <div className="absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none animate-blob z-0"></div>
        <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] bg-sky-500/20 rounded-full blur-[120px] pointer-events-none animate-blob z-0" style={{ animationDelay: "2s" }}></div>
        <div className="absolute top-[40%] left-[20%] w-[400px] h-[400px] bg-indigo-500/20 rounded-full blur-[120px] pointer-events-none animate-blob z-0" style={{ animationDelay: "4s" }}></div>

        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-20 glass-panel border-b border-white/5 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0 bg-[#030712]/50">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-white rounded-full flex items-center justify-center mr-2 shadow-[0_0_10px_rgba(255,255,255,0.2)]">
              <PlaneTakeoff className="h-4 w-4 text-black" />
            </div>
            <span className="text-xl font-black tracking-tighter text-white">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-400 hover:text-white rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
        </div>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
          
          {/* EDITORIAL HERO SECTION */}
          <div className="relative py-24 md:py-32 px-6 md:px-12 flex flex-col items-center justify-center text-center overflow-hidden">
            <div className="relative z-10 animate-in fade-in slide-in-from-bottom-8 duration-1000 max-w-5xl mx-auto flex flex-col items-center">
              
              <div className="inline-flex items-center gap-2 px-5 py-2 rounded-full glass-panel border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-10 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <Globe className="h-3.5 w-3.5" /> The Future of Travel Coordination
              </div>
              
              <h1 className="text-5xl md:text-7xl lg:text-[6rem] font-black text-white tracking-tighter mb-8 leading-[1.05] drop-shadow-2xl">
                We don't just plan trips. <br />
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-sky-400 to-indigo-400">We engineer experiences.</span>
              </h1>
              
              <p className="text-lg md:text-xl font-medium text-zinc-300 max-w-3xl mx-auto leading-relaxed drop-shadow-md">
                WanderHub is the definitive ecosystem for group travel. We eliminate the friction of planning, budgeting, and booking, empowering you to focus entirely on the journey itself.
              </p>

            </div>
          </div>

          {/* FLOATING STATS STRIP */}
          <div className="max-w-6xl mx-auto px-6 md:px-12 mb-24 relative z-20 animate-in fade-in duration-1000 delay-300">
            <div className="glass-panel rounded-[2rem] p-8 grid grid-cols-1 md:grid-cols-3 gap-8 divide-y md:divide-y-0 md:divide-x divide-white/10">
              <div className="flex flex-col items-center justify-center text-center pt-4 md:pt-0">
                <p className="text-5xl font-black text-white tracking-tighter mb-2">10k+</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Active Explorers</p>
              </div>
              <div className="flex flex-col items-center justify-center text-center pt-8 md:pt-0">
                <p className="text-5xl font-black text-white tracking-tighter mb-2">150+</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400">Countries Mapped</p>
              </div>
              <div className="flex flex-col items-center justify-center text-center pt-8 md:pt-0">
                <p className="text-5xl font-black text-white tracking-tighter mb-2">$0</p>
                <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-400">Hidden Fees</p>
              </div>
            </div>
          </div>

          <div className="max-w-6xl mx-auto px-6 md:px-12 pb-24 space-y-32">
            
            {/* FINTECH BENTO GRID: The Problem/Solution */}
            <div className="grid lg:grid-cols-12 gap-12 lg:gap-16 items-center relative z-20">
              
              {/* Sticky Text Side */}
              <div className="lg:col-span-5 lg:sticky lg:top-32">
                <div className="h-16 w-16 glass-panel rounded-full flex items-center justify-center mb-8 shadow-[0_0_30px_rgba(255,255,255,0.1)]">
                  <Target className="h-7 w-7 text-emerald-400" />
                </div>
                <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tighter leading-tight drop-shadow-lg">The group chat is not an itinerary.</h2>
                <div className="space-y-6 text-zinc-300 font-medium leading-relaxed text-lg">
                  <p>
                    Historically, coordinating a trip with friends or colleagues meant juggling endless chaotic threads, fragmented spreadsheets, missing payment links, and scattered booking confirmations.
                  </p>
                  <p>
                    WanderHub was engineered to solve this exact bottleneck. We have consolidated the entire travel lifecycle into one unified, secure platform. From the moment someone says "We should go to..." to the final split of the restaurant bill.
                  </p>
                </div>
              </div>
              
              {/* Glass Bento Grid Side */}
              <div className="lg:col-span-7 grid grid-cols-1 sm:grid-cols-2 gap-6 relative">
                
                <div className="glass-panel glass-panel-hover p-8 md:p-10 rounded-[2.5rem] transition-all duration-500 animate-float-1 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-sky-500/20 rounded-full blur-[40px] group-hover:bg-sky-400/30 transition-colors duration-500"></div>
                  <div className="h-14 w-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform duration-500">
                    <Users className="h-6 w-6 text-sky-400" />
                  </div>
                  <h4 className="font-black text-white text-xl mb-3 tracking-tight relative z-10">Democratic Planning</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed relative z-10">No more dictating. Our Tinder-style voting engine ensures the whole crew agrees on accommodations.</p>
                </div>

                <div className="glass-panel glass-panel-hover p-8 md:p-10 rounded-[2.5rem] transition-all duration-500 animate-float-2 sm:translate-y-12 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/20 rounded-full blur-[40px] group-hover:bg-amber-400/30 transition-colors duration-500"></div>
                  <div className="h-14 w-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform duration-500">
                    <Zap className="h-6 w-6 text-amber-400" />
                  </div>
                  <h4 className="font-black text-white text-xl mb-3 tracking-tight relative z-10">Real-Time Sync</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed relative z-10">Flight delays? Itinerary updates push instantly to all members' devices without refreshing.</p>
                </div>

                <div className="glass-panel glass-panel-hover p-8 md:p-10 rounded-[2.5rem] transition-all duration-500 animate-float-2 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-[40px] group-hover:bg-emerald-400/30 transition-colors duration-500"></div>
                  <div className="h-14 w-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform duration-500">
                    <CreditCard className="h-6 w-6 text-emerald-400" />
                  </div>
                  <h4 className="font-black text-white text-xl mb-3 tracking-tight relative z-10">Financial Harmony</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed relative z-10">Advanced algorithms track every expense and simplify debts into the fewest possible transactions.</p>
                </div>

                <div className="glass-panel glass-panel-hover p-8 md:p-10 rounded-[2.5rem] transition-all duration-500 animate-float-1 sm:translate-y-12 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-[40px] group-hover:bg-purple-400/30 transition-colors duration-500"></div>
                  <div className="h-14 w-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center mb-6 relative z-10 group-hover:scale-110 transition-transform duration-500">
                    <ShieldCheck className="h-6 w-6 text-purple-400" />
                  </div>
                  <h4 className="font-black text-white text-xl mb-3 tracking-tight relative z-10">Verified Network</h4>
                  <p className="text-sm text-zinc-400 leading-relaxed relative z-10">We directly integrate with certified B2B hotel partners, ensuring trust, safety, and transparent pricing.</p>
                </div>
              </div>
            </div>

            {/* EDITORIAL LEADERSHIP PROFILE */}
            <div className="glass-panel rounded-[3rem] p-10 md:p-16 shadow-2xl relative overflow-hidden border border-white/10 z-20">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12 lg:gap-20">
                <div className="relative shrink-0 group">
                  <div className="absolute inset-0 bg-gradient-to-br from-emerald-400 to-teal-600 rounded-full blur-2xl opacity-40 group-hover:opacity-70 transition-opacity duration-700"></div>
                  <div className="h-56 w-56 bg-black/50 backdrop-blur-2xl rounded-full flex items-center justify-center shadow-2xl border border-white/10 relative z-10">
                    <Code className="h-20 w-20 text-emerald-400" />
                  </div>
                </div>
                
                <div className="text-center lg:text-left">
                  <h2 className="text-4xl md:text-5xl font-black text-white mb-2 tracking-tighter drop-shadow-md">Kaushik Singha</h2>
                  <p className="text-emerald-400 font-bold mb-8 text-[10px] uppercase tracking-widest flex items-center justify-center lg:justify-start">
                    <Cpu className="h-3.5 w-3.5 mr-2" /> Founder & Lead Architect
                  </p>
                  
                  <div className="space-y-6 text-zinc-300 font-medium leading-relaxed text-lg max-w-3xl">
                    <p className="text-white text-xl md:text-2xl font-bold tracking-tight italic drop-shadow-sm">
                      "WanderHub wasn't built just to be another travel booking site. It was engineered from the ground up to solve a deeply human problem: connection."
                    </p>
                    <p>
                      With a relentless focus on high-performance architecture and intuitive UI/UX design, our mission is to orchestrate complex data—from global geolocations to live peer-to-peer messaging—and present it in an interface that feels invisible to the user. We handle the heavy lifting, so you can focus on making memories.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* B2B PARTNER CTA */}
            <div className="relative rounded-[3rem] p-10 md:p-16 border border-emerald-500/20 text-center overflow-hidden z-20 bg-emerald-950/30 backdrop-blur-xl shadow-[0_0_50px_rgba(16,185,129,0.1)]">
              <div className="absolute top-[-50%] right-[-10%] w-[400px] h-[400px] bg-emerald-500/20 rounded-full blur-[80px] pointer-events-none"></div>
              <div className="absolute bottom-[-50%] left-[-10%] w-[400px] h-[400px] bg-teal-500/20 rounded-full blur-[80px] pointer-events-none"></div>
              
              <div className="relative z-10">
                <div className="h-24 w-24 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center mx-auto mb-8 shadow-xl border border-white/10">
                  <Building2 className="h-10 w-10 text-emerald-400" />
                </div>
                <h2 className="text-3xl md:text-5xl font-black text-white mb-6 tracking-tighter drop-shadow-md">Are you a property manager?</h2>
                <p className="text-zinc-300 font-medium max-w-2xl mx-auto mb-12 text-lg leading-relaxed">
                  Join the WanderHub B2B Partner Network. List your rooms directly to thousands of verified travelers, bypass heavy aggregator commissions, and take control of your bookings.
                </p>
                <Link href="/partner/join" className="inline-flex items-center justify-center bg-white text-black px-10 py-5 rounded-full font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.2)] active:scale-95 group">
                  Access Partner Portal <ArrowRight className="h-4 w-4 ml-3 group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>

            {/* Footer */}
            <div className="text-center pb-8 pt-12 border-t border-white/10 relative z-20">
              <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest flex items-center justify-center">
                © {new Date().getFullYear()} WanderHub Technologies. Crafted for global explorers.
              </p>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}