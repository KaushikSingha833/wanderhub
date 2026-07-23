"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { 
  Map, Calendar, CreditCard, Settings, PlaneTakeoff, Menu, X, 
  BedDouble, Plane, MessageSquare, Loader2, ArrowRight, Info, 
  Users, History, LogOut 
} from "lucide-react";

interface Trip {
  id: string;
  title: string;
  startDate: string;
  memberCount: number;
}

export default function ChatHubPage() {
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/");
      } else {
        setUser(currentUser);
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "trips"), 
      where("members", "array-contains", user.uid), 
      where("status", "==", "active")
    );
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({
        id: doc.id,
        title: doc.data().title,
        startDate: doc.data().startDate,
        memberCount: doc.data().members?.length || 1
      })) as Trip[];
      
      setTrips(tripsData);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error(error);
    }
  };

  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFDFD] dark:bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors duration-300 selection:bg-emerald-500/20">
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-20 flex items-center px-8 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-3 shadow-sm">
            <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
          </div>
          <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto md:hidden p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>
        
        <nav className="flex-1 px-4 py-8 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Map className="h-5 w-5 mr-3 opacity-70" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Calendar className="h-5 w-5 mr-3 opacity-70" /> Itineraries</Link>
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><MessageSquare className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Group Chat</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><BedDouble className="h-5 w-5 mr-3 opacity-70" /> Book Hotels</Link>
          <Link href="/history" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><History className="h-5 w-5 mr-3 opacity-70" /> Trip History</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Settings className="h-5 w-5 mr-3 opacity-70" /> Settings</Link>
          
          <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800 space-y-1">
            <Link href="/about" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
              <Info className="h-5 w-5 mr-3 opacity-70" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="md:hidden h-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-2 shadow-sm">
              <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          </div>
          
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold flex items-center justify-center text-xs shadow-inner border border-zinc-200 dark:border-zinc-700 overflow-hidden">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 -mr-2 text-zinc-600 dark:text-zinc-400 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
          </div>
        </div>

        <header className="hidden md:flex h-24 items-center justify-end px-12 z-20 shrink-0 sticky top-0 transition-all bg-white/80 dark:bg-zinc-950/80 backdrop-blur-md">
          <div className="flex items-center gap-6">
            
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800/80"></div>

            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold flex items-center justify-center text-sm shadow-inner border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"
                )}
              </div>

              <button 
                onClick={handleLogout} 
                title="Log Out"
                className="flex items-center justify-center h-10 w-10 rounded-full text-zinc-400 dark:text-zinc-500 hover:text-rose-500 dark:hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-all"
              >
                <LogOut className="h-[22px] w-[22px]" strokeWidth={2} />
              </button>
            </div>

          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar relative z-10">
          <div className="max-w-[1200px] mx-auto pb-24">
            
            <div className="mb-12 mt-4 md:mt-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <p className="text-zinc-500 dark:text-zinc-400 font-bold tracking-widest uppercase text-[11px] mb-3">Communications</p>
              <h1 className="text-4xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-tighter leading-tight mb-4">
                Active Conversations
              </h1>
              <p className="text-lg text-zinc-500 dark:text-zinc-400 font-medium">
                Select a trip to coordinate with your travel crew.
              </p>
            </div>

            {isLoading ? (
              <div className="py-24 flex flex-col items-center justify-center text-zinc-400">
                <Loader2 className="h-10 w-10 text-emerald-500 animate-spin mb-6" />
                <p className="font-bold text-[10px] uppercase tracking-widest text-zinc-500">Loading Connections...</p>
              </div>
            ) : trips.length === 0 ? (
              <div className="text-center py-32 bg-transparent rounded-[2rem] border border-dashed border-zinc-300 dark:border-zinc-800 animate-in zoom-in-95 duration-500">
                <div className="h-20 w-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <MessageSquare className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">No active chats</h3>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-2 mb-8 text-sm">Create or join a trip to start chatting.</p>
                <Link href="/" className="inline-flex bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-3 rounded-full font-bold shadow-md hover:opacity-90 transition-opacity active:scale-95 text-sm">Return to Dashboard</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                {trips.map(trip => (
                  <Link key={trip.id} href={`/chat/${trip.id}`} className="group relative bg-white dark:bg-zinc-900/40 p-6 md:p-8 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm hover:shadow-2xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-500 overflow-hidden flex flex-col h-56 cursor-pointer">
                    
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 group-hover:bg-emerald-500/15 rounded-full blur-3xl transition-all duration-700"></div>

                    <div className="relative z-10 flex items-start justify-between mb-auto">
                      <div className="h-14 w-14 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-110 group-hover:bg-emerald-500/10 group-hover:text-emerald-500 transition-all duration-300 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                        <MessageSquare className="h-6 w-6" />
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-950/50 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-800 flex items-center shadow-inner">
                        <Users className="h-3.5 w-3.5 mr-1.5 text-emerald-500" /> {trip.memberCount}
                      </div>
                    </div>

                    <div className="relative z-10 mt-auto pt-6 border-t border-zinc-100 dark:border-zinc-800/50">
                      <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mb-2 group-hover:text-emerald-500 transition-colors truncate">{trip.title}</h3>
                      <div className="flex items-center justify-between">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest flex items-center">
                          <Calendar className="h-3 w-3 mr-1.5" /> Starts {new Date(trip.startDate).toLocaleDateString()}
                        </p>
                        <div className="h-10 w-10 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full flex items-center justify-center shadow-lg group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors duration-300 transform group-hover:translate-x-1">
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}