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
import { Map, Calendar, CreditCard, Settings, Plus, PlaneTakeoff, Globe, Clock, User as UserIcon, Users, LogOut, BedDouble, Menu, X, ArrowRight, Trash2, Mail, Lock, AlertCircle } from "lucide-react";

interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  inviteCode: string;
  members: string[]; 
  adminId?: string; 
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

    try {
      await addDoc(collection(db, "trips"), {
        title, 
        startDate, 
        endDate, 
        inviteCode: generateInviteCode(),
        members: [user.uid], 
        adminId: user.uid,            
        memberNames: { [user.uid]: userName },                              
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

  if (isAuthLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  // --- ENHANCED LOGIN SCREEN ---
  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-50 via-white to-blue-50 p-4 font-sans">
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden z-0 pointer-events-none">
          <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-indigo-200/40 rounded-full blur-3xl"></div>
          <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-blue-200/40 rounded-full blur-3xl"></div>
        </div>
        
        <div className="bg-white/80 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl max-w-md w-full border border-white/50 relative z-10 my-8">
          
          <div className="h-20 w-20 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-3xl flex items-center justify-center text-white mx-auto mb-6 shadow-lg shadow-indigo-200 rotate-3 hover:rotate-6 transition-transform">
            <PlaneTakeoff className="h-10 w-10 -rotate-3" />
          </div>
          
          <h2 className="text-3xl font-black text-slate-900 mb-2 text-center tracking-tight">
            {isLoginMode ? "WanderHub" : "Create Account"}
          </h2>
          <p className="text-slate-500 font-medium mb-8 text-center">
            {isLoginMode ? "Sign in to access your trips." : "Start planning your next adventure."}
          </p>

          {authError && (
            <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl flex items-center text-left">
              <AlertCircle className="h-5 w-5 mr-2 shrink-0" /> {authError}
            </div>
          )}

          <form onSubmit={handleEmailAuth} className="space-y-4 text-left">
            {!isLoginMode && (
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Full Name</label>
                <div className="relative">
                  <UserIcon className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                  <input 
                    type="text" 
                    value={authName} 
                    onChange={(e) => setAuthName(e.target.value)} 
                    required={!isLoginMode} 
                    placeholder="e.g., Kaushik Singha" 
                    className="w-full pl-11 pr-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium transition-all" 
                  />
                </div>
              </div>
            )}

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <input 
                  type="email" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  required 
                  placeholder="you@example.com" 
                  className="w-full pl-11 pr-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium transition-all" 
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <input 
                  type="password" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  required 
                  placeholder="••••••••" 
                  className="w-full pl-11 pr-4 py-3 bg-white text-slate-900 border border-slate-200 rounded-xl focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none font-medium transition-all" 
                />
              </div>
            </div>

            <button type="submit" disabled={authLoading} className="w-full bg-slate-900 text-white font-bold py-3.5 rounded-xl hover:bg-slate-800 shadow-xl hover:shadow-2xl transition-all disabled:opacity-50 mt-2">
              {authLoading ? "Please wait..." : (isLoginMode ? "Sign In" : "Sign Up")}
            </button>
          </form>

          <div className="flex items-center my-6">
            <hr className="flex-1 border-slate-200" />
            <span className="px-4 text-xs font-bold text-slate-400 uppercase">Or continue with</span>
            <hr className="flex-1 border-slate-200" />
          </div>

          <button onClick={handleGoogleSignIn} type="button" className="w-full flex items-center justify-center bg-white border-2 border-slate-200 text-slate-700 font-bold py-3.5 rounded-xl hover:bg-slate-50 transition-all shadow-sm">
            <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google
          </button>

          <p className="mt-8 text-sm font-medium text-slate-500 text-center">
            {isLoginMode ? "Don't have an account? " : "Already have an account? "}
            <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(""); }} className="text-indigo-600 font-bold hover:underline">
              {isLoginMode ? "Sign up here" : "Log in here"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  // --- DASHBOARD RENDER ---
  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out print:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg bg-slate-50"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium shadow-sm transition-colors"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        <div className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">WanderHub</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-full border border-slate-200 bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold uppercase text-sm">
              {user.displayName?.charAt(0) || "U"}
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"><Menu className="h-6 w-6" /></button>
          </div>
        </div>

        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center justify-between px-8 z-10 shrink-0">
          <h2 className="text-xl font-semibold text-slate-800">Overview</h2>
          <div className="flex items-center gap-3">
            <button onClick={() => setIsJoinModalOpen(true)} className="flex items-center bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl font-medium hover:bg-slate-50 transition-all shadow-sm">
              <Users className="h-4 w-4 mr-2" /> Join Trip
            </button>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-indigo-600 text-white px-4 py-2 rounded-xl font-medium hover:bg-indigo-700 transition-all shadow-sm">
              <Plus className="h-4 w-4 mr-2" /> New Trip
            </button>
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-slate-200">
              <div className="h-9 w-9 rounded-full border border-slate-200 bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold uppercase text-sm">
                {user.displayName?.charAt(0) || "U"}
              </div>
              <button onClick={() => signOut(auth)} className="text-slate-400 hover:text-red-500 transition-colors bg-slate-50 hover:bg-red-50 p-2 rounded-full" title="Log Out">
                <LogOut className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-6xl mx-auto pb-20">
            
            <div className="mb-8 md:mb-10 mt-4 md:mt-0">
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">Welcome back, {user.displayName?.split(" ")[0] || "Traveler"}! 👋</h1>
              <p className="text-slate-500 mt-2 text-sm md:text-base">Here is what is happening with your upcoming adventures.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 md:gap-6 mb-10 md:mb-12">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5">
                <div className="h-14 w-14 bg-sky-100 rounded-2xl flex items-center justify-center text-sky-600 shrink-0"><Globe className="h-7 w-7" /></div>
                <div><p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Your Trips</p><p className="text-3xl font-black text-slate-900">{trips.length}</p></div>
              </div>
              
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 cursor-pointer hover:border-emerald-300 hover:shadow-md transition-all group" onClick={() => setIsJoinModalOpen(true)}>
                <div className="h-14 w-14 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600 shrink-0 group-hover:scale-105 transition-transform"><Users className="h-7 w-7" /></div>
                <div><p className="text-lg font-bold text-slate-900">Join a trip</p><p className="text-sm font-medium text-slate-500">Have an invite code?</p></div>
              </div>

              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-5 cursor-pointer hover:border-indigo-300 hover:shadow-md transition-all group sm:col-span-2 md:col-span-1" onClick={() => setIsModalOpen(true)}>
                <div className="h-14 w-14 bg-indigo-50 border border-indigo-100 border-dashed rounded-2xl flex items-center justify-center text-indigo-600 shrink-0 group-hover:scale-105 transition-transform"><Plus className="h-7 w-7" /></div>
                <div><p className="text-lg font-bold text-slate-900">Plan new trip</p><p className="text-sm font-medium text-slate-500">Draft an itinerary</p></div>
              </div>
            </div>

            <div className="flex justify-between items-end mb-6 px-2 md:px-0">
              <h2 className="text-xl md:text-2xl font-black text-slate-800">Your Destinations</h2>
            </div>
            
            {isLoading ? (
              <div className="flex justify-center py-12"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>
            ) : trips.length === 0 ? (
              <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-slate-300">
                <Map className="h-16 w-16 text-slate-300 mx-auto mb-4" />
                <h3 className="text-xl font-bold text-slate-900">No trips found</h3>
                <p className="text-slate-500 mt-2">Create or join a trip to get started.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
                {trips.map((trip) => (
                  <div key={trip.id} onClick={() => router.push(`/trips/${trip.id}`)} className="group bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1.5 transition-all cursor-pointer flex flex-col">
                    
                    <div className="h-40 md:h-48 bg-slate-200 relative overflow-hidden shrink-0">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={getTripImage(trip.id)} alt={trip.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-transparent to-transparent opacity-80"></div>
                      <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1.5 rounded-full text-[10px] font-black text-slate-800 uppercase tracking-widest shadow-sm">Upcoming</div>
                      <h3 className="absolute bottom-4 left-5 right-5 text-2xl font-black text-white line-clamp-1 truncate drop-shadow-md">{trip.title}</h3>
                    </div>
                    
                    <div className="p-5 flex-1 flex flex-col justify-between">
                      <div className="flex items-center text-sm font-bold text-slate-500 bg-slate-50 px-3 py-2 rounded-xl mb-4 w-fit border border-slate-100">
                        <Calendar className="h-4 w-4 mr-2 text-indigo-500" />
                        <span>{new Date(trip.startDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} — {new Date(trip.endDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</span>
                      </div>
                      
                      <div className="flex items-center justify-between border-t border-slate-100 pt-4 mt-auto">
                        <div className="flex items-center text-slate-400 font-medium text-xs">
                           <Users className="h-4 w-4 mr-1.5" /> {trip.members?.length || 1} {trip.members?.length === 1 ? 'Traveler' : 'Travelers'}
                        </div>
                        
                        <div className="flex items-center gap-2">
                          {trip.adminId === user.uid && (
                            <button 
                              onClick={(e) => handleDeleteTrip(e, trip.id, trip.title)}
                              className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete Trip"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          )}
                          
                          <div className="text-indigo-600 font-bold text-sm flex items-center group-hover:text-indigo-700 ml-1">
                            View Trip <ArrowRight className="h-4 w-4 ml-1 group-hover:translate-x-1 transition-transform" />
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
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm z-[60]">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-md shadow-2xl relative">
            <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full">✕</button>
            <h2 className="text-2xl font-black text-slate-900 mb-6 flex items-center"><PlaneTakeoff className="h-6 w-6 mr-3 text-indigo-600"/> Plan New Trip</h2>
            <form onSubmit={handleCreateTrip} className="flex flex-col gap-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Destination / Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Summer in Tokyo" className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-900" required />
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Start Date</label><input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-900" required /></div>
                <div className="flex-1"><label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">End Date</label><input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-900" required /></div>
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-3 text-slate-600 hover:bg-slate-100 rounded-xl font-bold transition-colors w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-6 py-3 text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-md font-bold transition-all w-full sm:w-auto disabled:opacity-70">{isSubmitting ? "Saving..." : "Create Trip"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* JOIN TRIP MODAL */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm z-[60]">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-sm shadow-2xl relative text-center">
            <button onClick={() => !isSubmitting && setIsJoinModalOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full">✕</button>
            <div className="h-16 w-16 bg-emerald-100 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4"><Users className="h-8 w-8" /></div>
            <h2 className="text-2xl font-black text-slate-900 mb-2">Join a Trip</h2>
            <p className="text-slate-500 text-sm mb-6">Enter the 6-character code shared by your friend.</p>
            <form onSubmit={handleJoinTrip} className="flex flex-col gap-5">
              <div>
                <input 
                  type="text" 
                  value={joinCode} 
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())} 
                  placeholder="e.g., X7B9K2" 
                  maxLength={6}
                  className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-center text-3xl font-black tracking-[0.2em] uppercase outline-none focus:border-emerald-500 focus:ring-4 focus:ring-emerald-100 focus:bg-white transition-all placeholder-slate-300" 
                  required 
                />
              </div>
              <div className="mt-2">
                <button type="submit" disabled={isSubmitting} className="px-5 py-4 text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl shadow-md w-full font-bold transition-all text-lg disabled:opacity-70">{isSubmitting ? "Searching..." : "Join Adventure"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}