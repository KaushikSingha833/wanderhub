"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, addDoc, onSnapshot, query, orderBy, where, getDocs, doc, updateDoc, arrayUnion, deleteDoc } from "firebase/firestore"; 
import { 
  GoogleAuthProvider, 
  signInWithPopup, 
  signOut, 
  onAuthStateChanged, 
  User as FirebaseUser,
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  updateProfile 
} from "firebase/auth";
import { auth, db } from "./lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, Plus, PlaneTakeoff, Globe, Clock, User as UserIcon, Users, LogOut, BedDouble, Menu, X, ArrowRight, Trash2, Mail, Lock, AlertCircle, Receipt, Sun, ShieldCheck, Sparkles, Globe2, Building2, Smartphone, Star, Zap, ChevronRight, BarChart, Loader2 } from "lucide-react";

interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  inviteCode: string;
  members: string[]; 
  adminId?: string; 
  memberNames?: Record<string, string>;
  // --- NEW: Added imageUrl to the interface ---
  imageUrl?: string;
}

const TRAVEL_IMAGES = [
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80", 
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80", 
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80", 
  "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80", 
  "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?w=800&q=80", 
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80", 
  "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=800&q=80", 
  "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=800&q=80", 
];

const getTripImage = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return TRAVEL_IMAGES[hash % TRAVEL_IMAGES.length];
};

export default function Home() {
  const router = useRouter();
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  // --- NEW: Landing Page Toggle ---
  const [showLanding, setShowLanding] = useState(true);

  // --- NEW AUTH STATE ---
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [joinCode, setJoinCode] = useState("");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return; 

    const q = query(
      collection(db, "trips"), 
      where("members", "array-contains", user.uid),
      orderBy("createdAt", "desc")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Trip, 'id'>),
      }));
      setTrips(tripsData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [user]);

  // --- GOOGLE SIGN IN ---
  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  // --- EMAIL/PASSWORD AUTH ---
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, authEmail, authPassword);
      } else {
        if (!authName.trim()) throw new Error("Please enter your full name.");
        
        const userCredential = await createUserWithEmailAndPassword(auth, authEmail, authPassword);
        
        // Attach the name to their Firebase profile
        await updateProfile(userCredential.user, {
          displayName: authName.trim()
        });
        
        // Force a UI update to show the new name
        setUser({ ...userCredential.user, displayName: authName.trim() } as FirebaseUser);
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') setAuthError("Incorrect email or password.");
      else if (err.code === 'auth/email-already-in-use') setAuthError("An account with this email already exists.");
      else if (err.code === 'auth/weak-password') setAuthError("Password should be at least 6 characters.");
      else setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  const generateInviteCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate || !user) return;
    setIsSubmitting(true);
    
    const userName = user.displayName?.split(" ")[0] || "Traveler";

    // --- NEW: FETCH IMAGE FROM UNSPLASH ---
    let fetchedImageUrl = "";
    try {
      // We search unsplash with the title and specify landscape orientation
      const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(title)}&orientation=landscape&client_id=S3o5ZZwBMWNSOTH5s-hc8BiYzYmitblOVgZvYJ28Syc&per_page=1`);
      const unsplashData = await unsplashRes.json();
      
      // If we find results, grab the regular sized image URL
      if (unsplashData.results && unsplashData.results.length > 0) {
        fetchedImageUrl = unsplashData.results[0].urls.regular;
      }
    } catch (err) {
      console.error("Failed to fetch image from Unsplash", err);
      // If it fails, fetchedImageUrl stays empty and we fall back to the old method automatically!
    }

    try {
      await addDoc(collection(db, "trips"), {
        title, 
        startDate, 
        endDate, 
        inviteCode: generateInviteCode(),
        members: [user.uid], 
        adminId: user.uid,            
        memberNames: { [user.uid]: userName },                              
        imageUrl: fetchedImageUrl, // --- NEW: SAVE TO FIREBASE ---
        createdAt: new Date(), 
      });
      setTitle(""); setStartDate(""); setEndDate(""); setIsModalOpen(false);
    } catch (error) { console.error("Error adding trip: ", error); } 
    finally { setIsSubmitting(false); }
  };

  const handleJoinTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode || !user) return;
    setIsSubmitting(true);
    
    try {
      const q = query(collection(db, "trips"), where("inviteCode", "==", joinCode.toUpperCase()));
      const querySnapshot = await getDocs(q);
      
      if (querySnapshot.empty) {
        alert("Invalid invite code! Please check and try again.");
      } else {
        const tripDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "trips", tripDoc.id), {
          members: arrayUnion(user.uid)
        });
        setIsJoinModalOpen(false);
        setJoinCode("");
        alert("Successfully joined the trip!");
      }
    } catch (error) {
      console.error("Error joining trip:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteTrip = async (e: React.MouseEvent, tripId: string, tripTitle: string) => {
    e.stopPropagation(); 
    
    if (confirm(`Are you sure you want to permanently delete "${tripTitle}"? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, "trips", tripId));
      } catch (error) {
        console.error("Error deleting trip:", error);
        alert("Failed to delete trip.");
      }
    }
  };

  if (isAuthLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#030712]"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  // ==========================================
  // UN-AUTHENTICATED FLOW (LANDING PAGE OR LOGIN)
  // ==========================================
  if (!user) {
    
    // 1. SHOW PRO-LEVEL LANDING PAGE
    if (showLanding) {
      return (
        <div className="min-h-screen bg-[#030712] font-sans text-white overflow-x-hidden selection:bg-indigo-500/30">
          
          {/* --- CUSTOM CSS ANIMATIONS --- */}
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes fadeInUp {
              0% { opacity: 0; transform: translateY(30px); }
              100% { opacity: 1; transform: translateY(0); }
            }
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-20px); }
            }
            @keyframes floatReverse {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(20px); }
            }
            @keyframes blob {
              0% { transform: translate(0px, 0px) scale(1); }
              33% { transform: translate(30px, -50px) scale(1.1); }
              66% { transform: translate(-20px, 20px) scale(0.9); }
              100% { transform: translate(0px, 0px) scale(1); }
            }
            .animate-fade-in-up { animation: fadeInUp 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
            .animate-float { animation: float 6s ease-in-out infinite; }
            .animate-float-reverse { animation: floatReverse 7s ease-in-out infinite; }
            .animate-blob { animation: blob 10s infinite; }
            .delay-100 { animation-delay: 100ms; }
            .delay-200 { animation-delay: 200ms; }
            .delay-300 { animation-delay: 300ms; }
            .glass-panel { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(16px); border: 1px solid rgba(255, 255, 255, 0.05); }
          `}} />

          {/* BACKGROUND EFFECTS */}
          <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
            <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-blob"></div>
            <div className="absolute top-[20%] right-[-10%] w-[600px] h-[600px] bg-purple-600/20 rounded-full blur-[120px] animate-blob delay-200"></div>
            <div className="absolute bottom-[-20%] left-[20%] w-[700px] h-[700px] bg-blue-600/10 rounded-full blur-[150px] animate-blob delay-300"></div>
            {/* Grid Pattern */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
            <div className="absolute inset-0" style={{ backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.05) 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
          </div>

          {/* GLASS NAV */}
          <nav className="fixed top-0 w-full z-50 transition-all duration-300 glass-panel border-b-0 border-white/10">
            <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
              <div className="flex items-center gap-3">
                <div className="bg-gradient-to-br from-indigo-500 to-purple-600 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
                  <PlaneTakeoff className="h-6 w-6 text-white" />
                </div>
                <span className="text-2xl font-black tracking-tight text-white">WanderHub</span>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/partner/join" className="hidden md:flex text-sm font-bold text-slate-300 hover:text-white transition-colors">
                  Business Portal
                </Link>
                <button onClick={() => setShowLanding(false)} className="bg-white text-slate-900 px-6 py-2.5 rounded-full text-sm font-bold hover:bg-indigo-50 hover:scale-105 transition-all shadow-[0_0_20px_rgba(255,255,255,0.3)]">
                  Log In
                </button>
              </div>
            </div>
          </nav>

          {/* HERO SECTION */}
          <header className="relative pt-40 pb-20 md:pt-52 md:pb-32 px-6 z-10">
            <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
              
              {/* Left Text */}
              <div className="text-left">
                <div className="animate-fade-in-up inline-flex items-center gap-2 px-4 py-2 rounded-full glass-panel text-indigo-300 text-xs font-bold mb-8 shadow-sm border border-indigo-500/30 uppercase tracking-widest">
                  <Sparkles className="h-4 w-4 text-indigo-400" /> Version 2.0 is Live
                </div>
                
                <h1 className="animate-fade-in-up delay-100 text-5xl md:text-7xl lg:text-[5.5rem] font-black tracking-tighter text-white mb-8 leading-[1.1]">
                  Travel planning, <br/>
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-pink-400">
                    fully evolved.
                  </span>
                </h1>
                
                <p className="animate-fade-in-up delay-200 text-lg md:text-xl text-slate-400 font-medium max-w-xl mb-10 leading-relaxed">
                  The ultimate SaaS platform for modern travelers. Build AI itineraries, book partner hotels, split live expenses, and sync it all with your group instantly.
                </p>
                
                <div className="animate-fade-in-up delay-300 flex flex-col sm:flex-row items-center gap-5">
                  <button onClick={() => setShowLanding(false)} className="w-full sm:w-auto bg-white text-slate-900 px-8 py-4 rounded-2xl text-lg font-black hover:scale-105 hover:shadow-[0_0_30px_rgba(255,255,255,0.3)] transition-all flex items-center justify-center group">
                    Start Planning 
                    <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <Link href="/partner/join" className="w-full sm:w-auto glass-panel text-white px-8 py-4 rounded-2xl text-lg font-bold hover:bg-white/10 transition-all flex items-center justify-center">
                    <Building2 className="mr-2 h-5 w-5 text-indigo-400" /> List Property
                  </Link>
                </div>

                <div className="animate-fade-in-up delay-300 mt-12 flex items-center gap-4 text-sm font-bold text-slate-500">
                  <div className="flex -space-x-3">
                    {[1,2,3,4].map(i => <div key={i} className="w-10 h-10 rounded-full border-2 border-[#030712] bg-gradient-to-br from-indigo-400 to-purple-500"></div>)}
                  </div>
                  <div>
                    <div className="flex items-center text-amber-400 mb-1">
                      <Star className="w-4 h-4 fill-amber-400"/>
                      <Star className="w-4 h-4 fill-amber-400"/>
                      <Star className="w-4 h-4 fill-amber-400"/>
                      <Star className="w-4 h-4 fill-amber-400"/>
                      <Star className="w-4 h-4 fill-amber-400"/>
                    </div>
                    Loved by 10,000+ travelers
                  </div>
                </div>
              </div>

              {/* Right Floating Elements (Pro Visuals) */}
              <div className="hidden lg:block relative h-[600px] w-full">
                
                {/* Main Dashboard Card */}
                <div className="absolute right-0 top-10 w-[450px] glass-panel p-6 rounded-3xl shadow-2xl animate-float border-white/10 bg-[#0f172a]/80 backdrop-blur-2xl">
                  <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-400"><Map className="h-5 w-5"/></div>
                      <div>
                        <div className="text-sm font-bold text-white">Bali Adventure</div>
                        <div className="text-xs text-slate-400">7 Days • 4 Members</div>
                      </div>
                    </div>
                    <div className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">Syncing</div>
                  </div>
                  <div className="space-y-3">
                    <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden"><div className="h-full w-[70%] bg-indigo-500 rounded-full"></div></div>
                    <div className="flex justify-between text-xs font-bold text-slate-500"><span>Progress</span><span>70%</span></div>
                  </div>
                </div>

                {/* Secondary Floating Card - Expense */}
                <div className="absolute left-0 top-[250px] w-[280px] glass-panel p-5 rounded-3xl shadow-2xl animate-float-reverse border-white/10 bg-[#0f172a]/80 backdrop-blur-2xl z-20">
                  <div className="flex items-center gap-4 mb-4">
                    <div className="h-12 w-12 bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-400"><Receipt className="h-6 w-6"/></div>
                    <div>
                      <div className="text-sm font-bold text-white">Dinner Split</div>
                      <div className="text-xs text-rose-400 font-bold">You owe ₹2,400</div>
                    </div>
                  </div>
                  <button className="w-full bg-white/5 hover:bg-white/10 text-white text-xs font-bold py-2 rounded-lg transition-colors border border-white/10">Settle Up Now</button>
                </div>

                {/* Third Floating Card - Weather */}
                <div className="absolute right-10 bottom-10 w-[240px] glass-panel p-5 rounded-3xl shadow-2xl animate-float border-white/10 bg-[#0f172a]/80 backdrop-blur-2xl">
                  <div className="flex justify-between items-start">
                    <div>
                      <div className="text-3xl font-black text-white mb-1">28°</div>
                      <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">Ubud, Bali</div>
                    </div>
                    <Sun className="h-8 w-8 text-amber-400" />
                  </div>
                </div>

              </div>
            </div>
          </header>

          {/* BENTO BOX FEATURES GRID */}
          <section className="py-24 relative z-10 bg-[#030712]">
            <div className="max-w-7xl mx-auto px-6">
              
              <div className="text-center mb-20">
                <h2 className="text-4xl md:text-5xl font-black text-white mb-6 tracking-tight">The ultimate <span className="text-indigo-400">travel operating system.</span></h2>
                <p className="text-slate-400 text-lg font-medium max-w-2xl mx-auto">Stop managing 15 open tabs. WanderHub unites bookings, mapping, weather, and finances into one stunning dashboard.</p>
              </div>

              {/* Grid Layout */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Bento Card 1 - Large (Spans 2 columns on desktop) */}
                <div className="md:col-span-2 glass-panel p-8 md:p-12 rounded-[2rem] hover:bg-white/[0.04] transition-colors group relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
                  <div className="h-14 w-14 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-8 border border-indigo-500/30">
                    <Map className="h-7 w-7 text-indigo-400" />
                  </div>
                  <h3 className="text-3xl font-black text-white mb-4">AI-Powered Itineraries</h3>
                  <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-md">Input your destination and dates. Our AI generates a perfectly optimized, day-by-day travel map instantly.</p>
                </div>

                {/* Bento Card 2 - Small */}
                <div className="glass-panel p-8 md:p-10 rounded-[2rem] hover:bg-white/[0.04] transition-colors group relative overflow-hidden">
                  <div className="h-14 w-14 bg-rose-500/20 rounded-2xl flex items-center justify-center mb-8 border border-rose-500/30">
                    <Receipt className="h-7 w-7 text-rose-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-4">Live Split</h3>
                  <p className="text-slate-400 font-medium leading-relaxed">Log expenses on the go. We calculate exactly who owes who, down to the last cent.</p>
                </div>

                {/* Bento Card 3 - Small */}
                <div className="glass-panel p-8 md:p-10 rounded-[2rem] hover:bg-white/[0.04] transition-colors group relative overflow-hidden">
                  <div className="h-14 w-14 bg-amber-500/20 rounded-2xl flex items-center justify-center mb-8 border border-amber-500/30">
                    <Sun className="h-7 w-7 text-amber-400" />
                  </div>
                  <h3 className="text-2xl font-black text-white mb-4">Smart Weather</h3>
                  <p className="text-slate-400 font-medium leading-relaxed">Integrated API forecasting ensures you never pack a swimsuit for a thunderstorm.</p>
                </div>

                {/* Bento Card 4 - Large */}
                <div className="md:col-span-2 glass-panel p-8 md:p-12 rounded-[2rem] hover:bg-white/[0.04] transition-colors group relative overflow-hidden">
                  <div className="absolute bottom-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all"></div>
                  <div className="h-14 w-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center mb-8 border border-emerald-500/30">
                    <BedDouble className="h-7 w-7 text-emerald-400" />
                  </div>
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-3xl font-black text-white">Hybrid Aggregator</h3>
                    <span className="bg-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-xs font-bold border border-emerald-500/30">B2B</span>
                  </div>
                  <p className="text-slate-400 text-lg font-medium leading-relaxed max-w-md">Compare millions of standard Booking.com listings directly alongside verified, exclusive WanderHub Hotel Partners.</p>
                </div>

              </div>
            </div>
          </section>

          {/* BOTTOM CTA */}
          <section className="py-32 relative z-10 border-t border-white/5">
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-indigo-950/50 pointer-events-none"></div>
            <div className="max-w-4xl mx-auto px-6 text-center relative z-20">
              <Globe2 className="h-20 w-20 mx-auto mb-8 text-indigo-500 animate-float" />
              <h2 className="text-5xl md:text-7xl font-black mb-8 tracking-tight">Your next adventure <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">starts right here.</span></h2>
              <button onClick={() => setShowLanding(false)} className="inline-flex bg-white text-slate-900 px-10 py-5 rounded-full text-xl font-black hover:scale-105 transition-all shadow-[0_0_40px_rgba(255,255,255,0.2)]">
                Create Free Account
              </button>
            </div>
          </section>
        </div>
      );
    }

    // 2. SHOW EXISTING LOGIN FORM
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#030712] p-4 font-sans relative overflow-hidden">
        
        {/* Background Effects matching landing page */}
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[500px] h-[500px] bg-purple-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>

        <button onClick={() => setShowLanding(true)} className="absolute top-6 left-6 text-slate-400 hover:text-white font-bold flex items-center bg-white/5 backdrop-blur-md px-4 py-2 rounded-xl border border-white/10 transition-all z-20">
          ← Back to Home
        </button>
        
        <div className="bg-[#0f172a]/80 backdrop-blur-2xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-white/10 relative z-10 my-8">
          
          <div className="h-20 w-20 bg-gradient-to-tr from-indigo-500 to-purple-600 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-indigo-500/20 rotate-3 hover:rotate-6 transition-transform">
            <PlaneTakeoff className="h-10 w-10 -rotate-3" />
          </div>
          
          <h2 className="text-3xl font-black text-white mb-2 text-center tracking-tight">
            {isLoginMode ? "Welcome Back" : "Create Account"}
          </h2>
          <p className="text-slate-400 font-medium mb-8 text-center">
            {isLoginMode ? "Sign in to access your itinerary." : "Start planning your next adventure."}
          </p>

          {authError && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-bold rounded-xl flex items-center text-left">
              <AlertCircle className="h-5 w-5 mr-2 shrink-0" /> {authError}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
            {!isLoginMode && (
              <div>
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
                  <input 
                    type="text" 
                    value={authName} 
                    onChange={(e) => setAuthName(e.target.value)} 
                    required={!isLoginMode} 
                    placeholder="e.g., Kaushik Singha" 
                    className="w-full pl-11 pr-4 py-3 bg-[#1e293b] text-white border border-white/10 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium transition-all placeholder-slate-500" 
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
                <input 
                  type="email" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  required 
                  placeholder="you@example.com" 
                  className="w-full pl-11 pr-4 py-3 bg-[#1e293b] text-white border border-white/10 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium transition-all placeholder-slate-500" 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-500" />
                <input 
                  type="password" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  required 
                  placeholder="••••••••" 
                  className="w-full pl-11 pr-4 py-3 bg-[#1e293b] text-white border border-white/10 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium transition-all placeholder-slate-500" 
                />
              </div>
            </div>

            <button type="submit" disabled={authLoading} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-500 shadow-xl transition-all disabled:opacity-50 mt-2">
              {authLoading ? "Please wait..." : (isLoginMode ? "Sign In" : "Sign Up")}
            </button>
          </form>

          <div className="flex items-center my-6">
            <hr className="flex-1 border-white/10" />
            <span className="px-4 text-xs font-bold text-slate-500 uppercase">Or continue with</span>
            <hr className="flex-1 border-white/10" />
          </div>

          <button onClick={handleGoogleSignIn} type="button" className="w-full flex items-center justify-center bg-[#1e293b] border border-white/10 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 transition-all shadow-sm">
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </button>

          <p className="mt-8 text-sm font-medium text-slate-400 text-center">
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(""); }} className="text-indigo-400 font-bold hover:text-indigo-300">
              {isLoginMode ? "Sign up here" : "Log in here"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // ==========================================
  // AUTHENTICATED FLOW (DASHBOARD WITH DARK MODE CLASSES)
  // ==========================================
  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#030712] font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* MOBILE MENU BLUR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/10 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600 dark:from-indigo-400 dark:to-blue-400">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold shadow-sm transition-colors border border-transparent dark:border-indigo-500/20"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-16 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">WanderHub</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border border-slate-200 dark:border-white/10 bg-indigo-50 dark:bg-indigo-500/20 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold uppercase text-sm shadow-sm">
              {user.displayName?.charAt(0) || "U"}
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
          </div>
        </div>

        {/* DESKTOP HEADER */}
        <header className="hidden md:flex h-20 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 items-center justify-between px-10 z-20 shrink-0 sticky top-0 transition-all">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Mission Control</h2>
          
          <div className="flex items-center gap-3">
            <button onClick={() => setIsJoinModalOpen(true)} className="flex items-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-700 dark:text-slate-300 px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 dark:hover:bg-white/10 transition-all shadow-sm text-sm group">
              <Users className="h-4 w-4 mr-2 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors" /> Join Trip
            </button>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-slate-900 dark:bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-all shadow-md hover:shadow-indigo-500/20 text-sm group">
              <Plus className="h-4 w-4 mr-2" /> New Trip
            </button>
            
            <div className="flex items-center gap-3 ml-5 pl-5 border-l border-slate-200 dark:border-white/10">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-500/20 dark:to-purple-500/20 text-indigo-700 dark:text-indigo-300 font-black flex items-center justify-center text-sm shadow-sm border border-indigo-200/50 dark:border-indigo-500/30">
                {user.displayName?.charAt(0) || "U"}
              </div>
              <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-500 dark:hover:text-red-400 transition-colors bg-white dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/10 border border-slate-200 dark:border-white/10 p-2.5 rounded-xl shadow-sm" title="Log Out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar relative z-10">
          <div className="max-w-6xl mx-auto pb-24">
            
            {/* WELCOME BANNER */}
            <div className="mb-10 mt-2 md:mt-0 bg-gradient-to-r from-indigo-900 via-slate-900 to-purple-900 dark:from-indigo-950 dark:via-[#0f172a] dark:to-purple-950 rounded-[2rem] p-8 md:p-12 text-white shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-top-4 duration-700">
              <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-purple-500/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
              
              <div className="relative z-10">
                <h1 className="text-3xl md:text-5xl font-black tracking-tight mb-3">Welcome back, {user.displayName?.split(" ")[0] || "Traveler"}! 👋</h1>
                <p className="text-indigo-100/80 text-base md:text-lg font-medium max-w-2xl">Here is what is happening with your upcoming adventures.</p>
              </div>
            </div>

            {/* QUICK STATS ROW */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-5 md:gap-6 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-5 hover:shadow-md transition-all hover:-translate-y-1">
                <div className="h-14 w-14 bg-sky-50 dark:bg-sky-500/10 rounded-2xl flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 border border-sky-100 dark:border-sky-500/20"><Globe className="h-7 w-7" /></div>
                <div><p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Your Trips</p><p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{trips.length}</p></div>
              </div>
              
              <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-5 cursor-pointer hover:border-emerald-300 dark:hover:border-emerald-500/50 hover:shadow-emerald-500/10 transition-all hover:-translate-y-1 group" onClick={() => setIsJoinModalOpen(true)}>
                <div className="h-14 w-14 bg-emerald-50 dark:bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100 dark:border-emerald-500/20 group-hover:scale-110 transition-transform"><Users className="h-7 w-7" /></div>
                <div><p className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Join a trip</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Have an invite code?</p></div>
              </div>

              <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[1.5rem] border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-5 cursor-pointer hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-indigo-500/10 transition-all hover:-translate-y-1 group sm:col-span-2 md:col-span-1" onClick={() => setIsModalOpen(true)}>
                <div className="h-14 w-14 bg-indigo-50 dark:bg-indigo-500/10 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-100 dark:border-indigo-500/20 border-dashed group-hover:scale-110 transition-transform"><Plus className="h-7 w-7" /></div>
                <div><p className="text-lg font-black text-slate-900 dark:text-white tracking-tight">Plan new trip</p><p className="text-xs font-semibold text-slate-500 dark:text-slate-400 mt-0.5">Draft an itinerary</p></div>
              </div>
            </div>

            <div className="flex justify-between items-end mb-8 px-2 md:px-0">
              <h2 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Your Destinations</h2>
            </div>
            
            {/* TRIPS GRID */}
            {isLoading ? (
              <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 dark:border-indigo-400 border-t-transparent rounded-full"></div></div>
            ) : trips.length === 0 ? (
              <div className="text-center py-24 bg-white dark:bg-[#0f172a] rounded-[2rem] border border-dashed border-slate-300 dark:border-slate-700 shadow-sm animate-in zoom-in-95 duration-500">
                <div className="h-20 w-20 bg-slate-50 dark:bg-[#1e293b] rounded-full flex items-center justify-center mx-auto mb-6">
                  <Map className="h-10 w-10 text-slate-300 dark:text-slate-500" />
                </div>
                <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">No trips found</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mt-2 mb-8">Create or join a trip to get started.</p>
                <button onClick={() => setIsModalOpen(true)} className="bg-slate-900 dark:bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold shadow-lg hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors">Start Planning</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                {trips.map((trip) => (
                  <div key={trip.id} onClick={() => router.push(`/trips/${trip.id}`)} className="group bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-200 dark:border-white/10 overflow-hidden shadow-sm hover:shadow-xl hover:shadow-indigo-500/10 hover:-translate-y-2 transition-all cursor-pointer flex flex-col relative">
                    
                    {/* Floating Date Badge */}
                    <div className="absolute top-4 left-4 z-20 bg-white/95 dark:bg-black/80 backdrop-blur-sm px-3 py-1.5 rounded-lg text-xs font-black text-slate-900 dark:text-white flex items-center shadow-md border border-slate-200/50 dark:border-white/10">
                      <Calendar className="h-3.5 w-3.5 mr-1.5 text-indigo-600 dark:text-indigo-400" />
                      {new Date(trip.startDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}
                    </div>

                    <div className="absolute top-4 right-4 z-20 bg-slate-900/90 dark:bg-indigo-600/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-black text-white uppercase tracking-widest shadow-md">
                      Upcoming
                    </div>

                    <div className="h-48 md:h-56 bg-slate-200 dark:bg-slate-800 relative overflow-hidden shrink-0">
                      {/* --- NEW: Display the Unsplash image, or fallback automatically --- */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={trip.imageUrl || getTripImage(trip.id)} alt={trip.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent opacity-80 group-hover:opacity-90 transition-opacity"></div>
                      <h3 className="absolute bottom-5 left-6 right-6 text-2xl font-black text-white line-clamp-1 truncate drop-shadow-lg tracking-tight">{trip.title}</h3>
                    </div>
                    
                    <div className="p-6 flex-1 flex flex-col justify-between bg-white dark:bg-[#0f172a] relative z-10">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center text-slate-500 dark:text-slate-400 font-semibold text-sm bg-slate-50 dark:bg-white/5 px-3 py-1.5 rounded-lg border border-slate-100 dark:border-white/5">
                           <Users className="h-4 w-4 mr-2 text-indigo-400 dark:text-indigo-500" /> {trip.members?.length || 1} {trip.members?.length === 1 ? 'Traveler' : 'Travelers'}
                        </div>
                        
                        <div className="flex items-center gap-3">
                          {trip.adminId === user.uid && (
                            <button 
                              onClick={(e) => handleDeleteTrip(e, trip.id, trip.title)}
                              className="p-2 text-slate-300 dark:text-slate-500 hover:text-white hover:bg-red-500 dark:hover:bg-red-500/80 rounded-xl transition-all border border-transparent hover:border-red-600 dark:hover:border-red-500/50 shadow-sm opacity-0 group-hover:opacity-100"
                              title="Delete Trip"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          
                          <div className="h-10 w-10 bg-indigo-50 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center group-hover:bg-indigo-600 dark:group-hover:bg-indigo-500 group-hover:text-white text-indigo-600 dark:text-indigo-400 transition-colors shadow-sm">
                            <ArrowRight className="h-5 w-5" />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CREATE TRIP MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 md:p-10 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-white/10">
            <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="absolute top-6 right-6 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 p-2.5 rounded-full transition-colors">✕</button>
            
            <div className="flex items-center mb-8">
              <div className="h-14 w-14 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mr-4 border border-indigo-200 dark:border-indigo-500/30">
                <PlaneTakeoff className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Plan New Trip</h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Where are we going?</p>
              </div>
            </div>

            <form onSubmit={handleCreateTrip} className="flex flex-col gap-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Destination / Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer in Tokyo" className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white transition-all placeholder-slate-300 dark:placeholder-slate-600 text-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white transition-all cursor-pointer dark:[color-scheme:dark]" required />
                </div>
                <div>
                  <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2">End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white transition-all cursor-pointer dark:[color-scheme:dark]" required />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-slate-100 dark:border-white/10">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-4 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl font-bold transition-colors w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-4 text-white bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 rounded-2xl shadow-xl hover:shadow-indigo-500/30 dark:shadow-indigo-900/30 font-black transition-all w-full sm:w-auto disabled:opacity-70 flex justify-center items-center">
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Trip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN TRIP MODAL */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 md:p-12 w-full max-w-sm shadow-2xl relative text-center animate-in zoom-in-95 duration-300 border border-slate-200 dark:border-white/10">
            <button onClick={() => !isSubmitting && setIsJoinModalOpen(false)} className="absolute top-6 right-6 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 p-2.5 rounded-full transition-colors">✕</button>
            <div className="h-20 w-20 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 rounded-[2rem] flex items-center justify-center text-emerald-500 dark:text-emerald-400 mx-auto mb-6 shadow-sm rotate-3"><Users className="h-10 w-10" /></div>
            <h2 className="text-3xl font-black text-slate-900 dark:text-white mb-3 tracking-tight">Join a Trip</h2>
            <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">Enter the 6-character code shared by your friend to sync up.</p>
            <form onSubmit={handleJoinTrip} className="flex flex-col gap-6">
              <div>
                <input 
                  type="text" 
                  value={joinCode} 
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())} 
                  placeholder="e.g., X7B9K2" 
                  maxLength={6}
                  className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-emerald-500 dark:focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/20 dark:focus:ring-emerald-500/20 rounded-2xl p-5 text-center text-4xl font-black tracking-[0.3em] uppercase outline-none transition-all placeholder-slate-300 dark:placeholder-slate-600 text-slate-900 dark:text-white" 
                  required 
                />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-slate-900 dark:bg-emerald-600 hover:bg-emerald-500 dark:hover:bg-emerald-500 text-white py-5 rounded-2xl shadow-xl hover:shadow-emerald-500/30 dark:shadow-emerald-900/30 font-black transition-all text-lg disabled:opacity-70 flex justify-center items-center">
                {isSubmitting ? <Loader2 className="h-6 w-6 animate-spin" /> : "Join Adventure"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}