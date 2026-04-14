"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth } from "../lib/firebase";
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Menu, X, BedDouble, Plane, MessageSquare, Info, Heart, Sparkles, Globe, ShieldCheck, Zap, Target, Users, Compass, Briefcase, Building2, ArrowRight } from "lucide-react";

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
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#030712] font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300">
      
      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* Main Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/10 flex flex-col transform transition-all duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full"><X className="h-5 w-5" /></button>
        </div>
        
        <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="space-y-2">
            <Link href="/" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
            <Link href="/itineraries" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
            <Link href="/chat" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors"><MessageSquare className="h-5 w-5 mr-3" /> Group Chat</Link>
            <Link href="/expenses" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
            <Link href="/flights" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors"><Plane className="h-5 w-5 mr-3" /> Book Flights</Link>
            <Link href="/hotels" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
            <Link href="/settings" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
          </div>
          
          <div className="mt-auto pt-6">
            <Link href="/about" className="flex items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold shadow-sm transition-colors border border-transparent dark:border-indigo-500/20">
              <Info className="h-5 w-5 mr-3" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-500"></div>

        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 shrink-0 z-30 sticky top-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 rounded-full"><Menu className="h-6 w-6" /></button>
        </div>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
          
          {/* Hero Section */}
          <div className="relative py-24 px-6 md:px-12 flex flex-col items-center justify-center text-center overflow-hidden border-b border-slate-200 dark:border-white/10">
            <div className="absolute inset-0 bg-gradient-to-b from-indigo-50/50 dark:from-[#0f172a] to-transparent"></div>
            
            <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-700 max-w-4xl mx-auto">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/50 dark:bg-white/5 backdrop-blur-md border border-slate-200 dark:border-white/10 text-indigo-600 dark:text-indigo-400 text-xs font-black uppercase tracking-widest mb-8 shadow-sm">
                <Globe className="h-4 w-4" /> The Future of Travel Coordination
              </div>
              <h1 className="text-4xl md:text-6xl lg:text-7xl font-black text-slate-900 dark:text-white tracking-tight mb-6 leading-tight">
                Transforming how the world <span className="bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">travels together.</span>
              </h1>
              <p className="text-lg md:text-xl font-medium text-slate-500 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
                WanderHub is the definitive ecosystem for group travel. We eliminate the friction of planning, budgeting, and booking, empowering you to focus on the journey itself.
              </p>
            </div>
          </div>

          <div className="max-w-5xl mx-auto px-6 md:px-12 py-20 space-y-32">
            
            {/* The Vision & Problem/Solution */}
            <div className="grid lg:grid-cols-2 gap-16 items-center">
              <div>
                <div className="h-14 w-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center mb-6 border border-indigo-100 dark:border-indigo-500/20">
                  <Target className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
                </div>
                <h2 className="text-3xl md:text-4xl font-black text-slate-900 dark:text-white mb-6 tracking-tight">The group chat is not an itinerary.</h2>
                <div className="space-y-6 text-slate-600 dark:text-slate-400 font-medium leading-relaxed text-lg">
                  <p>
                    Historically, coordinating a trip with friends or colleagues meant juggling endless chaotic threads, fragmented spreadsheets, missing payment links, and scattered booking confirmations.
                  </p>
                  <p>
                    WanderHub was engineered to solve this exact bottleneck. We have consolidated the entire travel lifecycle into one unified, secure platform. From the moment someone says "We should go to..." to the final split of the restaurant bill, WanderHub handles the logistics.
                  </p>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-white dark:bg-[#1e293b] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 hover:shadow-xl hover:-translate-y-1 transition-all">
                  <Users className="h-8 w-8 text-sky-500 mb-4" />
                  <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">Democratic Planning</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">No more dictating. Our Tinder-style voting engine ensures the whole crew agrees on accommodations.</p>
                </div>
                <div className="bg-white dark:bg-[#1e293b] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 hover:shadow-xl hover:-translate-y-1 transition-all sm:translate-y-6">
                  <Zap className="h-8 w-8 text-amber-500 mb-4" />
                  <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">Real-Time Sync</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">Flight delays? Itinerary updates push instantly to all members' devices without refreshing.</p>
                </div>
                <div className="bg-white dark:bg-[#1e293b] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 hover:shadow-xl hover:-translate-y-1 transition-all">
                  <CreditCard className="h-8 w-8 text-emerald-500 mb-4" />
                  <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">Financial Harmony</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">Advanced algorithms track every expense and simplify debts into the fewest possible transactions.</p>
                </div>
                <div className="bg-white dark:bg-[#1e293b] p-8 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/5 hover:shadow-xl hover:-translate-y-1 transition-all sm:translate-y-6">
                  <ShieldCheck className="h-8 w-8 text-purple-500 mb-4" />
                  <h4 className="font-bold text-slate-900 dark:text-white text-lg mb-2">Verified Network</h4>
                  <p className="text-sm text-slate-500 leading-relaxed">We directly integrate with certified B2B hotel partners, ensuring trust, safety, and transparent pricing.</p>
                </div>
              </div>
            </div>

            {/* Leadership Section */}
            <div className="bg-slate-900 dark:bg-[#0f172a] rounded-[3rem] p-8 md:p-14 shadow-2xl relative overflow-hidden border border-slate-800 dark:border-white/10">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] pointer-events-none"></div>
              
              <div className="relative z-10 flex flex-col lg:flex-row items-center gap-12">
                <div className="h-48 w-48 shrink-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-sky-500 rounded-full flex items-center justify-center shadow-2xl border-4 border-slate-800 dark:border-[#0f172a]">
                  <Compass className="h-20 w-20 text-white" />
                </div>
                
                <div>
                  <h2 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tight">Kaushik Singha</h2>
                  <p className="text-indigo-400 font-bold mb-6 text-lg uppercase tracking-widest text-sm flex items-center">
                    <Briefcase className="h-4 w-4 mr-2" /> Founder & Lead Architect
                  </p>
                  
                  <div className="space-y-4 text-slate-300 font-medium leading-relaxed text-lg">
                    <p>
                      "WanderHub wasn't built just to be another travel booking site. It was engineered from the ground up to solve a deeply human problem: connection."
                    </p>
                    <p>
                      With a relentless focus on high-performance architecture and intuitive UI/UX design, our mission is to orchestrate complex data—from global geolocations to live peer-to-peer messaging—and present it in an interface that feels invisible to the user. We handle the heavy lifting, so you can focus on making memories.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* B2B Partner CTA */}
            <div className="bg-indigo-50 dark:bg-indigo-500/5 rounded-[2.5rem] p-8 md:p-12 border border-indigo-100 dark:border-indigo-500/10 text-center">
              <div className="h-16 w-16 bg-white dark:bg-indigo-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-sm border border-indigo-50 dark:border-indigo-500/20">
                <Building2 className="h-8 w-8 text-indigo-600 dark:text-indigo-400" />
              </div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white mb-4">Are you a property manager?</h2>
              <p className="text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto mb-8 text-lg">
                Join the WanderHub B2B Partner Network. List your rooms directly to thousands of verified travelers, bypass heavy aggregator commissions, and take control of your bookings.
              </p>
              <Link href="/partner/join" className="inline-flex items-center justify-center bg-slate-900 dark:bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-all shadow-xl hover:-translate-y-1 group">
                Access Partner Portal <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            {/* Footer */}
            <div className="text-center pb-12 pt-8 border-t border-slate-200 dark:border-white/10">
              <p className="text-slate-500 dark:text-slate-500 font-bold text-sm flex items-center justify-center">
                © {new Date().getFullYear()} WanderHub Technologies. Crafted for global explorers.
              </p>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
}