"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, onSnapshot, doc, updateDoc, deleteDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { useCurrency } from "../lib/useCurrency"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, BedDouble, Menu, X, Clock, CheckCircle2, XCircle, Trash2, MapPin, Users, Shield, Loader2, ArrowLeft, History, Search, PlusSquare, Info, MessageSquare, Plane } from "lucide-react";

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
  // --- NEW: EXTENSION ENGINE ---
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

  // --- NEW: EXTENSION MODAL STATE ---
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

  // --- NEW: SMART EXTENSION LOGIC ---
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

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#030712]"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>;

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#030712] font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300 selection:bg-indigo-100 selection:text-indigo-900">
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/10 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">
              WanderHub
            </span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        {/* ADD 'flex flex-col' TO THE NAV CLASS */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="space-y-2">
          <Link href="/" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
          <Link href="/itineraries" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
          <Link href="/chat" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors">
            <MessageSquare className="h-5 w-5 mr-3" /> Group Chat
          </Link>
          <Link href="/expenses" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/flights" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold"><Plane className="h-5 w-5 mr-3" /> Book Flights</Link>
          <Link href="/hotels" className="flex items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold shadow-sm transition-colors border border-transparent dark:border-indigo-500/20"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
        </div>
        {/* Add the About Us link at the very end wrapped in this specific div */}
          <div className="mt-auto pt-6">
            <Link href="/about" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors">
              <Info className="h-5 w-5 mr-3" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-500"></div>

        <div className="md:hidden h-16 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <header className="hidden md:flex h-20 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 items-center justify-between px-10 z-20 shrink-0 sticky top-0 transition-all">
          <div className="flex items-center gap-4">
            <Link href="/hotels" className="p-2 text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">My Bookings</h2>
              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Manage your WanderHub Partner reservations.</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar relative z-10">
          <div className="max-w-4xl mx-auto pb-24">
            
            {bookings.length === 0 ? (
              <div className="text-center py-24 bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/10 shadow-sm animate-in zoom-in-95 duration-500">
                <div className="h-20 w-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-indigo-100 dark:border-indigo-500/20">
                  <Calendar className="h-10 w-10 text-indigo-500 dark:text-indigo-400" />
                </div>
                <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">No bookings yet</h3>
                <p className="text-slate-500 dark:text-slate-400 font-medium mb-8">You haven't made any reservations with WanderHub Partners.</p>
                <Link href="/hotels" className="inline-flex items-center bg-indigo-600 hover:bg-indigo-500 text-white px-8 py-4 rounded-xl font-black transition-all shadow-xl shadow-indigo-600/20">
                  <Search className="h-5 w-5 mr-2" /> Find a Hotel
                </Link>
              </div>
            ) : (
              <div className="space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
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
                    <div key={booking.id} className={`bg-white dark:bg-[#0f172a] rounded-[2rem] border ${isApproved ? 'border-emerald-200 dark:border-emerald-500/30 shadow-emerald-500/10' : 'border-slate-200 dark:border-white/10'} shadow-sm overflow-hidden flex flex-col group transition-all duration-300 hover:shadow-xl ${isInactive ? 'opacity-80 grayscale-[20%]' : ''}`}>
                      
                      {/* Header Area */}
                      <div className={`px-6 md:px-8 py-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 dark:border-white/5 ${isApproved ? 'bg-emerald-50/50 dark:bg-emerald-500/5' : 'bg-slate-50 dark:bg-white/5'}`}>
                        <div className="flex items-center gap-4">
                          <div className="h-12 w-12 bg-white dark:bg-[#1e293b] rounded-xl flex items-center justify-center text-slate-400 font-black shadow-sm border border-slate-100 dark:border-white/10 shrink-0">
                            <Shield className="h-6 w-6 text-indigo-500" />
                          </div>
                          <div>
                            {/* ✨ NEW: Clickable Hotel Name Link */}
                            <Link href={`/partner-hotel/${encodeURIComponent(booking.hotelName)}`} className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                              <h4 className="font-black text-lg md:text-xl text-slate-900 dark:text-white tracking-tight leading-tight">{booking.hotelName}</h4>
                            </Link>
                            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-0.5">{booking.roomName}</p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2 shrink-0">
                          <div>
                            {isPending && <span className="inline-flex items-center text-amber-600 bg-amber-100 dark:bg-amber-500/20 dark:text-amber-400 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest"><Clock className="h-3.5 w-3.5 mr-1.5"/> Pending Approval</span>}
                            {isApproved && <span className="inline-flex items-center text-emerald-600 bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-400 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest"><CheckCircle2 className="h-3.5 w-3.5 mr-1.5"/> Confirmed</span>}
                            
                            {isCompleted && <span className="inline-flex items-center text-slate-600 bg-slate-200 dark:bg-white/10 dark:text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest"><History className="h-3.5 w-3.5 mr-1.5"/> Completed Trip</span>}
                            {isExpired && <span className="inline-flex items-center text-slate-500 bg-slate-100 dark:bg-black/40 dark:text-slate-400 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest"><Clock className="h-3.5 w-3.5 mr-1.5"/> Request Expired</span>}
                            
                            {isDeclined && <span className="inline-flex items-center text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest"><XCircle className="h-3.5 w-3.5 mr-1.5"/> Declined by Hotel</span>}
                            {isCancelled && <span className="inline-flex items-center text-slate-600 bg-slate-200 dark:bg-white/10 dark:text-slate-300 px-3.5 py-1.5 rounded-lg text-xs font-black uppercase tracking-widest"><XCircle className="h-3.5 w-3.5 mr-1.5"/> Cancelled by You</span>}
                          </div>
                          
                          {booking.extensionRequest && booking.extensionRequest.status === "Pending" && (
                            <span className="inline-flex items-center text-indigo-600 bg-indigo-100 dark:bg-indigo-500/20 dark:text-indigo-400 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">
                              <PlusSquare className="h-3 w-3 mr-1" /> Extension Pending
                            </span>
                          )}
                          {booking.extensionRequest && booking.extensionRequest.status === "Declined" && (
                            <span className="inline-flex items-center text-red-600 bg-red-100 dark:bg-red-500/20 dark:text-red-400 px-2 py-1 rounded-md text-[10px] font-black uppercase tracking-widest shadow-sm">
                              <XCircle className="h-3 w-3 mr-1" /> Extension Declined
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Details Area */}
                      <div className="p-6 md:p-8 grid grid-cols-2 md:grid-cols-4 gap-6 items-center">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Check-In</p>
                          <p className="font-bold text-slate-900 dark:text-white flex items-center"><Calendar className="h-4 w-4 mr-2 text-slate-400"/> {new Date(booking.checkIn).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Check-Out</p>
                          <p className="font-bold text-slate-900 dark:text-white flex items-center"><Calendar className="h-4 w-4 mr-2 text-slate-400"/> {new Date(booking.checkOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Guests</p>
                          <p className="font-bold text-slate-900 dark:text-white flex items-center"><Users className="h-4 w-4 mr-2 text-slate-400"/> {booking.guests}</p>
                        </div>
                        <div className="text-right md:text-left">
                          <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500 mb-1.5">Total Amount</p>
                          <p className="font-black text-xl text-slate-900 dark:text-white tracking-tighter">
                            {symbol}{convert(booking.totalPriceBase).toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </p>
                        </div>
                      </div>

                      {/* Action Bar */}
                      <div className="px-6 md:px-8 py-4 bg-slate-50/50 dark:bg-[#1e293b]/30 border-t border-slate-100 dark:border-white/5 flex justify-end gap-3">
                        {isPending && (
                          <button onClick={() => handleCancelBooking(booking.id)} className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-2 rounded-lg text-xs font-black transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-500/20">
                            Cancel Request
                          </button>
                        )}
                        
                        {isApproved && (
                          <>
                            {!booking.extensionRequest || booking.extensionRequest.status === "Declined" ? (
                              <button onClick={() => setExtendBooking(booking)} className="text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 px-4 py-2 rounded-lg text-xs font-black transition-colors shadow-sm flex items-center border border-transparent hover:border-indigo-200 dark:hover:border-indigo-500/30">
                                <PlusSquare className="h-3.5 w-3.5 mr-1.5" /> Extend Stay
                              </button>
                            ) : null}
                            <button onClick={() => handleCancelBooking(booking.id)} className="text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 px-4 py-2 rounded-lg text-xs font-black transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-500/20">
                              Cancel Booking
                            </button>
                          </>
                        )}
                        
                        {(isInactive) && (
                          <button onClick={() => handleDeleteHistory(booking.id)} className="text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white px-4 py-2 rounded-lg text-xs font-black transition-colors flex items-center">
                            <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Remove from History
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

      {/* EXTEND STAY MODAL */}
      {extendBooking && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 md:p-10 w-full max-w-lg shadow-2xl relative border border-transparent dark:border-white/10 animate-in zoom-in-95 duration-300">
            <button onClick={() => !isExtending && setExtendBooking(null)} className="absolute top-6 right-6 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 p-2 rounded-full transition-colors"><X className="h-5 w-5" /></button>
            
            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Extend Your Stay</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-6">Request more days at {extendBooking.hotelName}.</p>

            <div className="bg-indigo-50 dark:bg-indigo-500/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 mb-6 flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-1">Current Check-Out</p>
                <p className="font-black text-slate-900 dark:text-white">{new Date(extendBooking.checkOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
              </div>
              <ArrowLeft className="h-5 w-5 text-indigo-300 rotate-180" />
            </div>

            <form onSubmit={handleRequestExtension} className="space-y-5">
              <div>
                <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">New Check-Out Date</label>
                <input 
                  type="date" 
                  value={newCheckOut} 
                  min={extendBooking.checkOut} 
                  onChange={(e)=>setNewCheckOut(e.target.value)} 
                  className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl p-4 outline-none font-bold text-slate-900 dark:text-white cursor-pointer dark:[color-scheme:dark]" 
                  required 
                />
              </div>

              {/* LIVE PRICING PREVIEW */}
              {newCheckOut && new Date(newCheckOut) > new Date(extendBooking.checkOut) && (
                <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-5 mt-4 flex justify-between items-center border border-slate-200 dark:border-white/5">
                  <div>
                    <p className="text-[10px] font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest">Extra Cost</p>
                    <p className="text-xs font-bold text-emerald-500 mt-1">
                      +{calculateNights(extendBooking.checkOut, newCheckOut)} night(s)
                    </p>
                  </div>
                  <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                    {symbol}{(convert(extendBooking.totalPriceBase / calculateNights(extendBooking.checkIn, extendBooking.checkOut)) * calculateNights(extendBooking.checkOut, newCheckOut)).toLocaleString(undefined, {maximumFractionDigits: 0})}
                  </p>
                </div>
              )}

              <button type="submit" disabled={isExtending} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-lg hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-70 flex justify-center items-center mt-4">
                {isExtending ? <Loader2 className="h-6 w-6 animate-spin" /> : "Send Request to Hotel"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}