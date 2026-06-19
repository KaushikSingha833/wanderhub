"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, onSnapshot, query, orderBy, where, deleteDoc, doc, updateDoc } from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser, signOut } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Users, LogOut, BedDouble, Menu, X, ArrowRight, Trash2, Archive, Plane, MessageSquare, Info, History, Check, RefreshCcw } from "lucide-react";

interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  inviteCode: string;
  members: string[];
  adminId?: string;
  imageUrl?: string;
  status?: string;
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

export default function HistoryPage() {
  const router = useRouter();

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Bulk Selection State
  const [selectedTrips, setSelectedTrips] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/");
      } else {
        setUser(currentUser);
      }
      setIsAuthLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    // Fetches ONLY Archived Trips
    const q = query(
      collection(db, "trips"),
      where("members", "array-contains", user.uid),
      where("status", "==", "archived"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Trip, 'id'>),
      }));
      setTrips(tripsData);
      setIsLoading(false);
      
      // Clean up selected trips if they get deleted/restored externally
      setSelectedTrips(prev => {
        const newSet = new Set(prev);
        const currentIds = new Set(tripsData.map(t => t.id));
        for (const id of newSet) {
          if (!currentIds.has(id)) newSet.delete(id);
        }
        return newSet;
      });
    });
    return () => unsubscribe();
  }, [user]);

  // Derived state to know which trips the user has permission to delete/restore
  const adminTrips = trips.filter(t => t.adminId === user?.uid);

  // Toggle Individual Selection
  const handleToggleSelect = (e: React.MouseEvent, tripId: string) => {
    e.stopPropagation();
    const newSet = new Set(selectedTrips);
    if (newSet.has(tripId)) newSet.delete(tripId);
    else newSet.add(tripId);
    setSelectedTrips(newSet);
  };

  // Toggle Select All
  const handleSelectAll = () => {
    if (selectedTrips.size === adminTrips.length && adminTrips.length > 0) {
      setSelectedTrips(new Set()); // Deselect all
    } else {
      setSelectedTrips(new Set(adminTrips.map(t => t.id))); // Select all
    }
  };

  // Bulk Delete Engine
  const handleBulkDelete = async () => {
    if (selectedTrips.size === 0) return;
    if (confirm(`Are you sure you want to permanently delete ${selectedTrips.size} trips from your history? This cannot be undone.`)) {
      try {
        await Promise.all(Array.from(selectedTrips).map(id => deleteDoc(doc(db, "trips", id))));
        setSelectedTrips(new Set());
      } catch (error) {
        console.error("Error during bulk delete:", error);
        alert("Failed to delete some trips.");
      }
    }
  };

  // Single Delete Engine
  const handleDeleteTrip = async (e: React.MouseEvent, tripId: string, tripTitle: string) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to permanently delete the history of "${tripTitle}"? This cannot be undone.`)) {
      try {
        await deleteDoc(doc(db, "trips", tripId));
        // Remove from selection if it was selected
        if (selectedTrips.has(tripId)) {
          const newSet = new Set(selectedTrips);
          newSet.delete(tripId);
          setSelectedTrips(newSet);
        }
      } catch (error) {
        console.error("Error deleting trip:", error);
        alert("Failed to delete trip.");
      }
    }
  };

  // ✨ NEW: Single Restore Engine
  const handleRestoreTrip = async (e: React.MouseEvent, tripId: string, tripTitle: string) => {
    e.stopPropagation();
    if (confirm(`Do you want to restore "${tripTitle}" back to your active dashboard?`)) {
      try {
        await updateDoc(doc(db, "trips", tripId), {
          status: "active"
        });
        // Remove from selection if it was selected
        if (selectedTrips.has(tripId)) {
          const newSet = new Set(selectedTrips);
          newSet.delete(tripId);
          setSelectedTrips(newSet);
        }
      } catch (error) {
        console.error("Error restoring trip:", error);
        alert("Failed to restore trip.");
      }
    }
  };

  if (isAuthLoading) return <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950"><div className="animate-spin h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full"></div></div>;
  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors duration-300 selection:bg-emerald-500/20">

      {/* MOBILE MENU BLUR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* FLOATING SIDEBAR */}
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
          <Link href="/chat" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
            <MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat
          </Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><BedDouble className="h-5 w-5 mr-3 opacity-70" /> Book Hotels</Link>
          
          {/* Highlighted History Tab */}
          <Link href="/history" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><History className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Trip History</Link>
          
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Settings className="h-5 w-5 mr-3 opacity-70" /> Settings</Link>
          
          <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <Link href="/about" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
              <Info className="h-5 w-5 mr-3 opacity-70" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-2 shadow-sm">
              <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white font-bold text-sm">
              {user.displayName?.charAt(0) || "U"}
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-600 dark:text-zinc-400 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
          </div>
        </div>

        {/* DESKTOP HEADER (MINIMALIST) */}
        <header className="hidden md:flex h-24 items-center justify-end px-12 z-20 shrink-0 sticky top-0 transition-all">
          <div className="flex items-center gap-5">
            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold flex items-center justify-center text-sm shadow-inner">
                {user.displayName?.charAt(0) || "U"}
              </div>
              <button onClick={() => signOut(auth)} className="text-zinc-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10" title="Log Out">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar relative z-10">
          <div className="max-w-[1200px] mx-auto pb-24">

            {/* EDITORIAL WELCOME AREA */}
            <div className="mb-12 mt-4 md:mt-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <p className="text-zinc-500 dark:text-zinc-400 font-bold tracking-widest uppercase text-[11px] mb-3">Memory Lane</p>
              <h1 className="text-4xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-tighter leading-tight flex items-center gap-4">
                Past Adventures <Archive className="h-10 w-10 text-zinc-300 dark:text-zinc-700" />
              </h1>
              <p className="text-zinc-500 mt-4 font-medium max-w-xl">
                Your archived trips are preserved here. You can still view your past itineraries, group chats, and settled expenses.
              </p>
            </div>

            {/* SELECTION TOOLBAR */}
            {!isLoading && adminTrips.length > 0 && (
              <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-zinc-100 dark:bg-zinc-900/40 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 p-4 rounded-[1.5rem] mb-8 animate-in fade-in duration-500 gap-4">
                <div className="flex items-center gap-4">
                  <button onClick={handleSelectAll} className="flex items-center gap-3 text-sm font-bold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition-colors group">
                    <div className={`h-6 w-6 rounded-md border flex items-center justify-center transition-all ${selectedTrips.size === adminTrips.length && adminTrips.length > 0 ? 'bg-emerald-500 border-emerald-500 text-zinc-950 shadow-sm' : 'bg-white dark:bg-black/50 border-zinc-300 dark:border-zinc-600 group-hover:border-zinc-400 dark:group-hover:border-zinc-400 text-transparent'}`}>
                      <Check className="h-4 w-4" />
                    </div>
                    {selectedTrips.size === adminTrips.length && adminTrips.length > 0 ? 'Deselect All' : 'Select All'}
                  </button>
                  <span className="text-xs font-bold uppercase tracking-widest text-zinc-400">
                    ({selectedTrips.size} Selected)
                  </span>
                </div>
                
                <button 
                  onClick={handleBulkDelete}
                  disabled={selectedTrips.size === 0}
                  className={`flex items-center justify-center px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${selectedTrips.size > 0 ? 'bg-rose-500/10 text-rose-600 dark:text-rose-500 border border-rose-500/20 hover:bg-rose-500 hover:text-zinc-50 shadow-sm active:scale-95' : 'bg-zinc-100 dark:bg-zinc-900 text-zinc-400 border border-transparent cursor-not-allowed opacity-50'}`}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Delete Selected
                </button>
              </div>
            )}

            {/* TRIPS GRID (DESATURATED ARCHIVE DESIGN) */}
            {isLoading ? (
              <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-zinc-900 dark:border-white border-t-transparent rounded-full"></div></div>
            ) : trips.length === 0 ? (
              <div className="text-center py-32 bg-transparent rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 animate-in zoom-in-95 duration-500">
                <div className="h-16 w-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Archive className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">No archived trips yet</h3>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-2 mb-8 text-sm">When your active trips expire, they will be automatically moved here.</p>
                <Link href="/" className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-3 rounded-full font-bold shadow-md hover:opacity-90 transition-opacity active:scale-95 text-sm">Return to Dashboard</Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                {trips.map((trip) => (
                  <div key={trip.id} onClick={() => router.push(`/trips/${trip.id}`)} className={`group relative h-80 rounded-[2rem] overflow-hidden hover:-translate-y-2 transition-all duration-500 cursor-pointer bg-zinc-200 dark:bg-zinc-800 border-2 ${selectedTrips.has(trip.id) ? 'border-emerald-500 shadow-[0_0_20px_rgba(16,185,129,0.2)]' : 'border-transparent shadow-sm hover:shadow-2xl hover:shadow-zinc-500/20 dark:hover:shadow-black/50'}`}>
                    
                    {/* Full Cover Image - Filtered to look "Past" */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={trip.imageUrl || getTripImage(trip.id)} alt={trip.title} className={`absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out filter ${selectedTrips.has(trip.id) ? 'grayscale-0 opacity-100 scale-105' : 'grayscale-[0.6] opacity-70 group-hover:grayscale-0 group-hover:opacity-100 group-hover:scale-105'}`} />
                    
                    {/* Dark Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10 opacity-90 transition-opacity duration-500"></div>

                    {/* Checkbox & Archived Badge Container */}
                    <div className="absolute top-5 left-5 z-20 flex items-center gap-3">
                      {trip.adminId === user.uid && (
                        <div 
                          onClick={(e) => handleToggleSelect(e, trip.id)}
                          className={`h-7 w-7 rounded-md backdrop-blur-md border flex items-center justify-center transition-all shadow-lg cursor-pointer ${selectedTrips.has(trip.id) ? 'bg-emerald-500 border-emerald-500 text-zinc-950 scale-110' : 'bg-black/50 border-white/30 text-transparent hover:border-white/60 hover:bg-black/70'}`}
                        >
                          <Check className="h-4 w-4" />
                        </div>
                      )}
                      
                      <div className="bg-zinc-950/80 backdrop-blur-md border border-zinc-700/50 text-zinc-300 px-3 py-1.5 rounded-full flex items-center text-[10px] font-bold uppercase tracking-widest shadow-lg pointer-events-none">
                        <Archive className="h-3 w-3 mr-1.5" /> Archived
                      </div>
                    </div>

                    {/* ✨ NEW: Top Right Admin Actions (Restore & Delete) */}
                    {trip.adminId === user.uid && (
                      <div className="absolute top-5 right-5 z-20 flex flex-col gap-2">
                        <button
                          onClick={(e) => handleRestoreTrip(e, trip.id, trip.title)}
                          className="h-10 w-10 bg-emerald-500 text-zinc-950 hover:bg-emerald-400 backdrop-blur-md border border-emerald-400/50 rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-[0_0_15px_rgba(16,185,129,0.3)] scale-90 group-hover:scale-100"
                          title="Restore to Dashboard"
                        >
                          <RefreshCcw className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleDeleteTrip(e, trip.id, trip.title)}
                          className="h-10 w-10 bg-white/10 hover:bg-rose-500/90 backdrop-blur-md border border-white/20 text-white rounded-full flex items-center justify-center transition-all opacity-0 group-hover:opacity-100 shadow-lg scale-90 group-hover:scale-100"
                          title="Permanently Delete History"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Floating Pill Info Box */}
                    <div className="absolute bottom-5 left-5 right-5 bg-zinc-950/60 backdrop-blur-xl border border-white/10 p-5 rounded-3xl flex justify-between items-center shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                      <div className="min-w-0 pr-4">
                        <h3 className="text-xl font-bold text-white truncate drop-shadow-md mb-1.5">{trip.title}</h3>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center text-zinc-400 text-xs font-bold">
                            <Calendar className="h-3.5 w-3.5 mr-1 opacity-80" /> {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="h-1 w-1 bg-zinc-600 rounded-full"></span>
                          <span className="flex items-center text-zinc-400 text-xs font-bold">
                            <Users className="h-3.5 w-3.5 mr-1 opacity-80" /> {trip.members?.length || 1}
                          </span>
                        </div>
                      </div>
                      
                      {/* Enter Button */}
                      <div className="h-10 w-10 shrink-0 bg-white/10 border border-white/20 text-white rounded-full flex items-center justify-center shadow-lg group-hover:bg-white group-hover:text-zinc-950 transition-colors duration-300">
                        <ArrowRight className="h-4 w-4" />
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}