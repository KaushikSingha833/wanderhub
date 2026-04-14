"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, onSnapshot } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Menu, X, BedDouble, Plane, MessageSquare, Loader2, ArrowRight, Info } from "lucide-react";

interface Trip {
  id: string;
  title: string;
  startDate: string;
  memberCount: number;
}

export default function ChatHubPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/");
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "trips"), where("members", "array-contains", user.uid));
    
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

  if (!user) return null;

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
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="space-y-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
          
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
          
          {/* Active styling moved to Group Chat */}
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold shadow-sm transition-colors border border-transparent dark:border-indigo-500/20">
            <MessageSquare className="h-5 w-5 mr-3" /> Group Chat
          </Link>
          
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          
          <Link href="/flights" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold"><Plane className="h-5 w-5 mr-3" /> Book Flights</Link>
          
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          
          {/* Inactive styling moved to Settings */}
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors">
            <Settings className="h-5 w-5 mr-3" /> Settings
          </Link>
          </div>
          {/* Add the About Us link at the very end wrapped in this specific div */}
          <div className="mt-auto pt-6">
            <Link href="/about" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors">
              <Info className="h-5 w-5 mr-3" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col h-screen overflow-y-auto p-4 md:p-10 relative">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="md:hidden flex justify-between items-center mb-6">
          <h2 className="text-2xl font-black">Group Chats</h2>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2"><Menu className="h-6 w-6" /></button>
        </div>

        <header className="hidden md:block mb-10">
          <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">Active Conversations</h2>
          <p className="text-slate-500 font-medium mt-1">Select a trip to coordinate with your travel crew.</p>
        </header>

        {isLoading ? (
          <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 text-indigo-500 animate-spin" /></div>
        ) : trips.length === 0 ? (
          <div className="text-center py-20">
            <MessageSquare className="h-12 w-12 text-slate-300 mx-auto mb-4" />
            <h3 className="text-xl font-bold text-slate-700 dark:text-slate-300">No active chats</h3>
            <p className="text-slate-500">Create or join a trip to start chatting.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {trips.map(trip => (
              <Link key={trip.id} href={`/chat/${trip.id}`} className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all group">
                <div className="flex items-center justify-between mb-4">
                  <div className="h-12 w-12 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center">
                    <MessageSquare className="h-6 w-6" />
                  </div>
                  <div className="bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-lg text-xs font-bold text-slate-500 flex items-center">
                    {trip.memberCount} Members
                  </div>
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-1 group-hover:text-indigo-600 transition-colors">{trip.title}</h3>
                <p className="text-sm text-slate-500 font-medium flex justify-between items-center">
                  Starts {new Date(trip.startDate).toLocaleDateString()}
                  <ArrowRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity text-indigo-500" />
                </p>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}