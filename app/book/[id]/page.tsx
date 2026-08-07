"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; 
import { Loader2, ShieldCheck, MapPin, IndianRupee, CreditCard, Building2, CheckCircle2, Smartphone, X, Calendar, Users, Sparkles } from "lucide-react";
import Link from "next/link";

export default function BookingCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [room, setRoom] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [success, setSuccess] = useState(false);

  // BOOKING & PAYMENT STATES
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"SELECT" | "VERIFY">("SELECT");
  const [ownerUpiId, setOwnerUpiId] = useState("");
  const [utrNumber, setUtrNumber] = useState("");

  useEffect(() => {
    const fetchRoomDetails = async () => {
      try {
        const docRef = doc(db, "rooms", roomId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setRoom({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert("Room not found!");
          router.push("/hotels");
        }
      } catch (error) {
        console.error("Error fetching room:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId) fetchRoomDetails();
  }, [roomId, router]);

  // DYNAMIC PRICE CALCULATION
  const calculateNights = () => {
    if (!checkIn || !checkOut) return 1;
    const d1 = new Date(checkIn);
    const d2 = new Date(checkOut);
    const diff = Math.ceil((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
    return diff > 0 ? diff : 1;
  };

  const nights = calculateNights();
  const baseTotal = room ? room.price * nights : 0;
  const taxes = baseTotal * 0.12;
  const finalTotal = baseTotal + taxes;

  // INITIATE CHECKOUT (Checks for UPI)
  const handleInitiateCheckout = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to book this room!");
      return;
    }
    if (!checkIn || !checkOut) {
      alert("Please select check-in and check-out dates.");
      return;
    }

    setIsBooking(true);
    try {
      const ownerRef = doc(db, "users", room.hotelOwnerId);
      const ownerSnap = await getDoc(ownerRef);
      
      if (ownerSnap.exists() && ownerSnap.data().upiId) {
        setOwnerUpiId(ownerSnap.data().upiId);
        setShowPaymentModal(true); 
        setPaymentStep("SELECT");
      } else {
        await processBooking("Pay at Hotel");
      }
    } catch (error) {
      console.error("Error initiating checkout:", error);
      alert("Failed to process checkout.");
    } finally {
      setIsBooking(false);
    }
  };

  // DEEP LINK GENERATOR
  const getUpiLink = () => {
    if (!room || !ownerUpiId) return "";
    const hotelNameEncoded = encodeURIComponent(room.hotelName);
    return `upi://pay?pa=${ownerUpiId}&pn=${hotelNameEncoded}&am=${finalTotal.toFixed(0)}&cu=INR`;
  };

  // CONFIRM UTR PAYMENT
  const handleConfirmUpiPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (utrNumber.length < 12) {
      alert("Please enter a valid 12-digit UTR.");
      return;
    }
    await processBooking(utrNumber);
  };

  const processBooking = async (transactionId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    setIsBooking(true);
    try {
      await addDoc(collection(db, "bookings"), {
        travelerId: user.uid,
        travelerEmail: user.email,
        hotelOwnerId: room.hotelOwnerId,
        roomId: room.id,
        hotelName: room.hotelName,
        roomName: room.name,
        pricePaid: room.price,
        bookingDate: new Date(),
        partnerId: room.hotelOwnerId,
        customerId: user.uid,
        customerName: user.displayName || "Traveler",
        customerEmail: user.email,
        checkIn: checkIn,
        checkOut: checkOut,
        guests: guests,
        totalPriceBase: baseTotal,
        transactionId: transactionId, 
        status: "Pending", 
        createdAt: new Date()
      });

      setShowPaymentModal(false);
      setSuccess(true);
    } catch (error) {
      console.error("Error confirming booking:", error);
      alert("Failed to process booking.");
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#FDFDFD] dark:bg-zinc-950"><Loader2 className="h-10 w-10 animate-spin text-emerald-500" /></div>;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 font-sans selection:bg-emerald-500/30">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none"></div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="bg-white/10 backdrop-blur-xl p-10 md:p-14 rounded-[2.5rem] shadow-2xl max-w-md w-full text-center border border-white/10 relative z-10 animate-in zoom-in-95 duration-500">
          <div className="h-24 w-24 bg-emerald-500 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_30px_rgba(16,185,129,0.4)]">
            <CheckCircle2 className="h-12 w-12 text-zinc-950" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Request Sent!</h2>
          <p className="text-zinc-400 font-medium mb-10 text-sm leading-relaxed">
            Your booking request for <strong className="text-white">{room.hotelName}</strong> has been forwarded to management. They will verify your payment and approve your stay shortly.
          </p>
          <Link href="/my-bookings" className="inline-block w-full bg-white text-zinc-950 px-6 py-4 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-xl active:scale-95">
            View My Bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 relative selection:bg-emerald-500/30 transition-colors duration-300">
      
      {/* EDITORIAL HERO BANNER */}
      <div className="relative h-[30vh] w-full bg-zinc-900 dark:bg-black overflow-hidden mb-8 md:mb-12">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.1] mix-blend-overlay pointer-events-none"></div>
        <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/40 via-zinc-900 to-zinc-950"></div>
        <div className="absolute top-[-50%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>
        
        <div className="absolute top-0 w-full p-6 md:p-10 flex justify-between items-center z-20">
          <button onClick={() => router.back()} className="flex items-center text-xs font-bold uppercase tracking-widest text-white bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full transition-all border border-white/20 active:scale-95">
            &larr; Back
          </button>
        </div>

        <div className="absolute bottom-8 left-0 w-full px-6 md:px-10 z-20 max-w-5xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-4 shadow-sm">
            <ShieldCheck className="h-3 w-3" /> Verified Partner Secure Checkout
          </div>
          <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter drop-shadow-md">Confirm Your Stay</h1>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-4 md:px-10 pb-24 relative z-30 -mt-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          
          {/* Room Summary Card (Bento Box) */}
          <div className="lg:col-span-2 space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="bg-white dark:bg-zinc-900/50 rounded-[2rem] p-8 md:p-10 shadow-sm border border-zinc-200 dark:border-zinc-800/50">
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-10 pb-8 border-b border-zinc-100 dark:border-zinc-800">
                <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-inner">
                  <Building2 className="h-10 w-10 text-zinc-900 dark:text-white" />
                </div>
                <div>
                  <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">{room.hotelName}</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 font-bold text-xs uppercase tracking-widest flex items-center">
                    <MapPin className="h-3.5 w-3.5 mr-1" /> {room.city ? room.city : "Destination"}
                  </p>
                </div>
              </div>

              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-2xl p-6 border border-zinc-200 dark:border-zinc-800 mb-8">
                <h3 className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-3">Room Selected</h3>
                <p className="text-xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">{room.name}</p>
                <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed italic">"{room.description || "A beautiful room reserved exclusively for AERO travelers."}"</p>
              </div>

              <div className="bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 p-5 rounded-2xl border border-emerald-200 dark:border-emerald-500/20 flex items-start text-sm font-bold">
                <Sparkles className="h-5 w-5 mr-3 shrink-0" />
                <p className="leading-relaxed">This is an exclusive AERO Partner property. Your booking request will be routed directly to the hotel management, bypassing third-party fees.</p>
              </div>
            </div>
          </div>

          {/* Fintech Payment Summary Widget */}
          <div className="lg:col-span-1 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
            <div className="bg-zinc-950 text-white rounded-[2.5rem] p-8 shadow-2xl sticky top-8 border border-zinc-800 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px]"></div>
              
              {/* DATE & GUEST INPUTS */}
              <div className="mb-8 space-y-4 border-b border-zinc-800 pb-8 relative z-10">
                <div className="relative">
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Check-in Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all [color-scheme:dark]" />
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Check-out Date</label>
                  <div className="relative">
                    <Calendar className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} min={checkIn || new Date().toISOString().split('T')[0]} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all [color-scheme:dark]" />
                  </div>
                </div>
                <div className="relative">
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-1">Travelers</label>
                  <div className="relative">
                    <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full bg-zinc-900 border border-zinc-800 rounded-xl pl-11 pr-4 py-3.5 text-sm font-bold text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all appearance-none cursor-pointer">
                      {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} Guest{n>1?'s':''}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-5 ml-1 relative z-10">Price Summary</h3>
              
              <div className="space-y-3 mb-8 relative z-10 text-sm font-bold">
                <div className="flex justify-between items-center text-zinc-300">
                  <span>{nights} Night{nights > 1 ? 's' : ''} × Base</span>
                  <span className="flex items-center"><IndianRupee className="h-3.5 w-3.5" />{baseTotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center text-zinc-400">
                  <span>Taxes & Partner Fees</span>
                  <span className="flex items-center"><IndianRupee className="h-3.5 w-3.5" />{taxes.toFixed(0)}</span>
                </div>
              </div>

              <div className="border-t border-zinc-800 pt-6 mb-8 relative z-10">
                <div className="flex justify-between items-end">
                  <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Due (INR)</span>
                  <span className="text-3xl font-black text-white tracking-tighter flex items-center">
                    <IndianRupee className="h-6 w-6 text-emerald-500 mr-1" />
                    {finalTotal.toFixed(0)}
                  </span>
                </div>
              </div>

              <button 
                onClick={handleInitiateCheckout}
                disabled={isBooking || !checkIn || !checkOut}
                className="w-full bg-emerald-500 text-zinc-950 font-bold py-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:shadow-none flex items-center justify-center text-xs uppercase tracking-widest active:scale-95 relative z-10"
              >
                {isBooking ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-2" /> Book Now</>}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* UPI PAYMENT MODAL (FINTECH BENTO BOX) */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] p-8 md:p-10 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-300 border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => !isBooking && setShowPaymentModal(false)} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-full transition-colors"><X className="h-4 w-4" /></button>
            
            {paymentStep === "SELECT" ? (
              <>
                <div className="flex justify-center mb-6">
                  <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-full flex items-center justify-center shadow-inner border border-zinc-200 dark:border-zinc-800">
                    <Smartphone className="h-8 w-8" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-center text-zinc-900 dark:text-white tracking-tight mb-1">Direct UPI Transfer</h2>
                <p className="text-sm font-medium text-center text-zinc-500 dark:text-zinc-400 mb-8">Pay directly to {room.hotelName} with zero fees.</p>

                <div className="bg-zinc-50 dark:bg-zinc-900/50 rounded-[1.5rem] p-6 text-center mb-8 border border-zinc-200 dark:border-zinc-800">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-2">Total Due</p>
                  <p className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter flex items-center justify-center">
                    <IndianRupee className="h-7 w-7 mr-1 text-emerald-500" /> {finalTotal.toFixed(0)}
                  </p>
                </div>

                <a 
                  href={getUpiLink()} 
                  onClick={() => setTimeout(() => setPaymentStep("VERIFY"), 2500)}
                  className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 font-bold text-xs uppercase tracking-widest py-4 rounded-full shadow-lg hover:opacity-90 transition-all flex justify-center items-center mb-4 active:scale-95"
                >
                  Pay via Any UPI App
                </a>
                
                <p className="text-[10px] text-center text-zinc-400 font-bold uppercase tracking-widest">
                  Opens GPay, PhonePe, or Paytm automatically.
                </p>
              </>
            ) : (
              // VERIFICATION STEP
              <form onSubmit={handleConfirmUpiPayment}>
                <div className="flex justify-center mb-6">
                  <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center shadow-inner border border-emerald-500/20">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-center text-zinc-900 dark:text-white tracking-tight mb-2">Verify Payment</h2>
                <p className="text-sm font-medium text-center text-zinc-500 dark:text-zinc-400 mb-8">Enter the 12-digit UTR (Reference Number) from your UPI app receipt.</p>

                <div className="mb-8">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Transaction ID (UTR)</label>
                  <input 
                    type="text" 
                    value={utrNumber} 
                    onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                    placeholder="123456789012" 
                    required 
                    minLength={12}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 text-center font-black tracking-[0.3em] text-xl outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-zinc-900 dark:text-white placeholder-zinc-300 dark:placeholder-zinc-700"
                  />
                </div>

                <button type="submit" disabled={isBooking || utrNumber.length < 12} className="w-full bg-emerald-500 text-zinc-950 font-bold text-xs uppercase tracking-widest py-4 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:shadow-none flex justify-center items-center mb-3 active:scale-95">
                  {isBooking ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Booking"}
                </button>
                
                <button type="button" onClick={() => setPaymentStep("SELECT")} className="w-full text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300 text-[10px] font-bold uppercase tracking-widest py-3 transition-colors text-center">
                  &larr; Go Back
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}