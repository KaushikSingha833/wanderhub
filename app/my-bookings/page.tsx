"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { useCurrency } from "../lib/useCurrency"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, BedDouble, Menu, X, Clock, CheckCircle2, XCircle, Trash2, MapPin, Users, Shield, Loader2, ArrowLeft, History, Search, PlusSquare, Info, MessageSquare, Plane, Building2, ArrowRight, LogOut } from "lucide-react";

interface Booking {
  id: string;
  hotelName: string;
  roomId: string;
  roomName: string;
  partnerId: string;
  customerId: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPriceBase: number;
  status: "Pending" | "Approved" | "Confirmed" | "Declined" | "Cancelled";
  createdAt: any;
  // --- EXTENSION ENGINE ---
  extensionRequest?: {
    requestedCheckOut: string;
    extraPriceBase: number;
    status: "Pending" | "Declined";
  };
}

export default function MyBookingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- EXTENSION MODAL STATE ---
  const [extendBooking, setExtendBooking] = useState<Booking | null>(null);
  const [newCheckOut, setNewCheckOut] = useState("");
  const [isExtending, setIsExtending] = useState(false);

  const { symbol, convert } = useCurrency();

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push('/');
        return;
      }
      setUser(currentUser);

      const q = query(collection(db, "bookings"), where("customerId", "==", currentUser.uid));
      
      const unsubscribeBookings = onSnapshot(q, (snapshot) => {
        const fetchedBookings = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Booking[];
        
        fetchedBookings.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setBookings(fetchedBookings);
        setIsLoading(false);
      });

      return () => unsubscribeBookings();
    });

    return () => unsubscribeAuth();
  }, [router]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error(error);
    }
  };

  const handleCancelBooking = async (bookingId: string) => {
    if (!confirm("Are you sure you want to cancel this booking request?")) return;
    try {
      await updateDoc(doc(db, "bookings", bookingId), { status: "Cancelled" });
    } catch (error) {
      console.error("Error cancelling booking:", error);
      alert("Failed to cancel booking.");
    }
  };

  const handleDeleteHistory = async (bookingId: string) => {
    if (!confirm("Remove this permanently from your history?")) return;
    try {
      await deleteDoc(doc(db, "bookings", bookingId));
    } catch (error) {
      console.error("Error deleting booking:", error);
      alert("Failed to delete booking history.");
    }
  };

  // --- SMART EXTENSION LOGIC ---
  const calculateNights = (start: string, end: string) => {
    if (!start || !end) return 1;
    const d1 = new Date(start); d1.setHours(0,0,0,0);
    const d2 = new Date(end); d2.setHours(0,0,0,0);
    const diffDays = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays > 0 ? diffDays : 1;
  };

  const handleRequestExtension = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendBooking || !newCheckOut) return;

    const dCurrent = new Date(extendBooking.checkOut); dCurrent.setHours(0,0,0,0);
    const dNew = new Date(newCheckOut); dNew.setHours(0,0,0,0);
    
    if (dNew <= dCurrent) {
      alert("New check-out date must be after your current check-out date.");
      return;
    }

    setIsExtending(true);
    
    // Calculate how much they owe for the extra days based on their original booking rate
    const currentNights = calculateNights(extendBooking.checkIn, extendBooking.checkOut);
    const pricePerNightBase = extendBooking.totalPriceBase / currentNights;
    const extraNights = calculateNights(extendBooking.checkOut, newCheckOut);
    const extraPriceBase = pricePerNightBase * extraNights;

    try {
      await updateDoc(doc(db, "bookings", extendBooking.id), {
        extensionRequest: {
          requestedCheckOut: newCheckOut,
          extraPriceBase: extraPriceBase,
          status: "Pending"
        }
      });
      setExtendBooking(null);
      setNewCheckOut("");
    } catch (error) {
      console.error("Error requesting extension:", error);
      alert("Failed to request extension.");
    } finally {
      setIsExtending(false);
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-[#FDFDFD] dark:bg-zinc-950 transition-colors"><div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors duration-300 selection:bg-emerald-500/20">
      
      {/* MOBILE MENU BLUR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* FLOATING SIDEBAR (EDITORIAL STYLE) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-20 flex items-center px-8 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-3 shadow-sm">
            <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
          </div>
          <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">AERO</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto md:hidden p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>
        
        <nav className="flex-1 px-4 py-8 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Map className="h-5 w-5 mr-3 opacity-70" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Calendar className="h-5 w-5 mr-3 opacity-70" /> Itineraries</Link>
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><BedDouble className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Settings className="h-5 w-5 mr-3 opacity-70" /> Settings</Link>
          
          <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <Link href="/about" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Info className="h-5 w-5 mr-3 opacity-70" /> About Us</Link>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] dark:opacity-[0.1] mix-blend-overlay pointer-events-none"></div>
        <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none transition-colors duration-500"></div>

        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-2 shadow-sm">
              <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">AERO</span>
          </div>
          
          <div className="flex items-center gap-3">
            <Link href="/hotels" className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"><Search className="h-5 w-5 text-emerald-500" /></Link>
            
            <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold flex items-center justify-center text-xs shadow-inner border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"
              )}
            </div>

            <button onClick={() => setIsMobileMenuOpen(true)} className="p-1 text-zinc-600 dark:text-zinc-400 rounded-full transition-colors -mr-1"><Menu className="h-6 w-6" /></button>
          </div>
        </div>

        {/* DESKTOP HEADER (MINIMALIST) */}
        <header className="hidden md:flex h-24 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 items-center justify-between px-12 z-20 shrink-0 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter">My Bookings</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-1">Manage your AERO Partner reservations.</p>
          </div>
          
          <div className="flex items-center gap-6">
            <Link href="/hotels" className="flex items-center bg-transparent border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all px-6 py-3 rounded-full font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-widest active:scale-95">
              <Search className="h-4 w-4 mr-2 text-emerald-500" /> Find a Hotel
            </Link>

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

        <main className="flex-1 overflow-y-auto p-4 md:p-12 custom-scrollbar relative z-10">
          <div className="max-w-5xl mx-auto pb-24">
            
            {bookings.length === 0 ? (
              <div className="text-center py-32 bg-transparent rounded-[2rem] border border-dashed border-zinc-300 dark:border-zinc-800 animate-in zoom-in-95 duration-500">
                <div className="h-20 w-20 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Calendar className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                </div>
                <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">No bookings yet</h3>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8 text-sm">You haven't made any reservations with AERO Partners.</p>
                <Link href="/hotels" className="inline-flex items-center bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-3.5 rounded-full font-bold shadow-md hover:opacity-90 transition-opacity active:scale-95 text-xs uppercase tracking-widest">
                  <Search className="h-4 w-4 mr-2" /> Find a Hotel
                </Link>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {bookings.map(booking => {
                  
                  // --- DYNAMIC TIME LOGIC ---
                  const today = new Date();
                  today.setHours(0, 0, 0, 0);
                  const checkoutDate = new Date(booking.checkOut);
                  checkoutDate.setHours(0, 0, 0, 0);
                  const isPastCheckout = checkoutDate < today;

                  const isDeclined = booking.status === "Declined";
                  const isCancelled = booking.status === "Cancelled";
                  
                  const isPending = booking.status === "Pending" && !isPastCheckout;
                  const isApproved = (booking.status === "Approved" || booking.status === "Confirmed") && !isPastCheckout;

                  const isCompleted = (booking.status === "Approved" || booking.status === "Confirmed") && isPastCheckout;
                  const isExpired = booking.status === "Pending" && isPastCheckout;

                  const isInactive = isCompleted || isExpired || isDeclined || isCancelled;

                  return (
                    <div key={booking.id} className={`bg-white dark:bg-zinc-900/60 rounded-[2rem] border ${isApproved ? 'border-emerald-500/30 shadow-emerald-500/10' : 'border-zinc-200 dark:border-zinc-800/50'} shadow-sm overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-2xl hover:border-zinc-300 dark:hover:border-zinc-700 ${isInactive ? 'opacity-70 grayscale-[30%]' : ''}`}>
                      
                      {/* Header Area */}
                      <div className={`px-6 md:px-8 py-6 flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/50 ${isApproved ? 'bg-emerald-500/5' : 'bg-transparent'}`}>
                        <div className="flex items-start gap-4">
                          <div className="h-12 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-400 shadow-inner border border-zinc-200 dark:border-zinc-700 shrink-0">
                            <Building2 className="h-5 w-5 text-zinc-900 dark:text-white" />
                          </div>
                          <div>
                            <Link href={`/partner-hotel/${encodeURIComponent(booking.hotelName)}`} className="hover:text-emerald-500 transition-colors">
                              <h4 className="font-black text-xl text-zinc-900 dark:text-white tracking-tight leading-tight mb-1 line-clamp-1">{booking.hotelName}</h4>
                            </Link>
                            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400">{booking.roomName}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-start sm:items-end gap-2 shrink-0">
                          <div>
                            {isPending && <span className="inline-flex items-center text-amber-500 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm"><Clock className="h-3 w-3 mr-1.5"/> Pending</span>}
                            {isApproved && <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm"><CheckCircle2 className="h-3 w-3 mr-1.5"/> Confirmed</span>}
                            
                            {isCompleted && <span className="inline-flex items-center text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm"><History className="h-3 w-3 mr-1.5"/> Completed</span>}
                            {isExpired && <span className="inline-flex items-center text-zinc-500 dark:text-zinc-400 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm"><Clock className="h-3 w-3 mr-1.5"/> Expired</span>}
                            
                            {isDeclined && <span className="inline-flex items-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm"><XCircle className="h-3 w-3 mr-1.5"/> Declined</span>}
                            {isCancelled && <span className="inline-flex items-center text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm"><XCircle className="h-3 w-3 mr-1.5"/> Cancelled</span>}
                          </div>
                          
                          {booking.extensionRequest && booking.extensionRequest.status === "Pending" && (
                            <span className="inline-flex items-center text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/10 border border-sky-200 dark:border-sky-500/20 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm mt-1">
                              <PlusSquare className="h-3 w-3 mr-1" /> Ext. Pending
                            </span>
                          )}
                          {booking.extensionRequest && booking.extensionRequest.status === "Declined" && (
                            <span className="inline-flex items-center text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 px-2.5 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest shadow-sm mt-1">
                              <XCircle className="h-3 w-3 mr-1" /> Ext. Declined
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details Area (Fintech Style) */}
                      <div className="p-6 md:p-8 grid grid-cols-2 gap-6 items-center">
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1.5">Check-In</p>
                          <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{new Date(booking.checkIn).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1.5">Check-Out</p>
                          <p className="font-bold text-sm text-zinc-900 dark:text-white truncate">{new Date(booking.checkOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1.5">Travelers</p>
                          <p className="font-bold text-sm text-zinc-900 dark:text-white flex items-center"><Users className="h-3.5 w-3.5 mr-1.5 text-zinc-400"/> {booking.guests}</p>
                        </div>
                        <div className="bg-zinc-50 dark:bg-zinc-950 p-4 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                          <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-1.5">Total Paid</p>
                          <p className="font-black text-lg text-zinc-900 dark:text-white tracking-tighter truncate">
                            {symbol}{convert(booking.totalPriceBase).toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </p>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="px-6 md:px-8 py-5 border-t border-zinc-100 dark:border-zinc-800/50 flex flex-wrap justify-end gap-3 mt-auto">
                        {isPending && (
                          <button onClick={() => handleCancelBooking(booking.id)} className="text-rose-500 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-5 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 active:scale-95">
                            Cancel Request
                          </button>
                        )}
                        
                        {isApproved && (
                          <>
                            {!booking.extensionRequest || booking.extensionRequest.status === "Declined" ? (
                              <button onClick={() => setExtendBooking(booking)} className="text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 px-5 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-colors shadow-sm flex items-center border border-emerald-200 dark:border-emerald-500/30 active:scale-95">
                                <PlusSquare className="h-3 w-3 mr-1.5" /> Extend Stay
                              </button>
                            ) : null}
                            <button onClick={() => handleCancelBooking(booking.id)} className="text-zinc-500 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 px-5 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-colors border border-transparent hover:border-rose-200 dark:hover:border-rose-500/20 active:scale-95">
                              Cancel Booking
                            </button>
                          </>
                        )}
                        
                        {(isInactive) && (
                          <button onClick={() => handleDeleteHistory(booking.id)} className="text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 hover:text-zinc-900 dark:hover:text-white px-5 py-2.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-colors flex items-center active:scale-95 border border-transparent hover:border-zinc-200 dark:hover:border-zinc-700">
                            <Trash2 className="h-3 w-3 mr-1.5" /> Remove
                          </button>
                        )}
                      </div>

                    </div>
                  );
                })}
              </div>
            )}

          </div>
        </main>
      </div>

      {/* EXTEND STAY MODAL (FINTECH GLASS) */}
      {extendBooking && (
        <div className="fixed inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] p-8 md:p-10 w-full max-w-lg shadow-2xl relative border border-transparent dark:border-zinc-800 animate-in zoom-in-95 duration-300">
            <button onClick={() => !isExtending && setExtendBooking(null)} className="absolute top-6 right-6 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 p-2.5 rounded-full transition-colors active:scale-95"><X className="h-4 w-4" /></button>
            
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Extend Your Stay</h2>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-8">Request additional days at {extendBooking.hotelName}.</p>

            <div className="bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-8 flex items-center justify-between shadow-inner">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Current Check-Out</p>
                <p className="font-bold text-sm text-zinc-900 dark:text-white">{new Date(extendBooking.checkOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
              </div>
              <div className="h-10 w-10 bg-white dark:bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-sm">
                <ArrowLeft className="h-4 w-4 text-zinc-400 rotate-180" />
              </div>
            </div>

            <form onSubmit={handleRequestExtension} className="space-y-6">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">New Check-Out Date</label>
                <input 
                  type="date" 
                  value={newCheckOut} 
                  min={extendBooking.checkOut} 
                  onChange={(e)=>setNewCheckOut(e.target.value)} 
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-5 py-4 outline-none text-sm font-bold text-zinc-900 dark:text-white cursor-pointer dark:[color-scheme:dark] focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all shadow-sm" 
                  required 
                />
              </div>

              {/* LIVE PRICING PREVIEW */}
              {newCheckOut && new Date(newCheckOut) > new Date(extendBooking.checkOut) && (
                <div className="bg-zinc-950 rounded-2xl p-6 flex justify-between items-center border border-zinc-800 shadow-xl relative overflow-hidden animate-in fade-in slide-in-from-bottom-2">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Extra Cost</p>
                    <p className="text-xs font-bold text-emerald-400 flex items-center">
                      <PlusSquare className="h-3 w-3 mr-1" /> {calculateNights(extendBooking.checkOut, newCheckOut)} night(s)
                    </p>
                  </div>
                  <p className="text-3xl font-black text-white tracking-tighter relative z-10">
                    {symbol}{(convert(extendBooking.totalPriceBase / calculateNights(extendBooking.checkIn, extendBooking.checkOut)) * calculateNights(extendBooking.checkOut, newCheckOut)).toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </p>
                </div>
              )}

              <button type="submit" disabled={isExtending || !newCheckOut} className="w-full bg-emerald-500 text-zinc-950 py-4 rounded-full font-bold text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] disabled:opacity-50 disabled:shadow-none flex justify-center items-center mt-4 active:scale-95 group">
                {isExtending ? <Loader2 className="h-5 w-5 animate-spin" /> : <><PlaneTakeoff className="h-4 w-4 mr-2 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" /> Send Request</>}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}