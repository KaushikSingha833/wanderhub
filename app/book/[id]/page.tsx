"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; // Check your firebase import path!
import { Loader2, ShieldCheck, MapPin, IndianRupee, CreditCard, Building2, CheckCircle2, Smartphone, X } from "lucide-react";
import Link from "next/link";

export default function BookingCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [room, setRoom] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [success, setSuccess] = useState(false);

  // --- NEW: BOOKING & PAYMENT STATES ---
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState(1);
  
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentStep, setPaymentStep] = useState<"SELECT" | "VERIFY">("SELECT");
  const [ownerUpiId, setOwnerUpiId] = useState("");
  const [utrNumber, setUtrNumber] = useState("");

  // Fetch the specific room from Firestore based on the URL ID
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

  // --- NEW: DYNAMIC PRICE CALCULATION ---
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

  // --- NEW: INITIATE CHECKOUT (Checks for UPI) ---
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
      // Fetch owner profile to see if they have a UPI ID saved
      const ownerRef = doc(db, "users", room.hotelOwnerId);
      const ownerSnap = await getDoc(ownerRef);
      
      if (ownerSnap.exists() && ownerSnap.data().upiId) {
        setOwnerUpiId(ownerSnap.data().upiId);
        setShowPaymentModal(true); // Show UPI flow
        setPaymentStep("SELECT");
      } else {
        // Fallback: Owner has no UPI, book normally as "Pay at Hotel"
        await processBooking("Pay at Hotel");
      }
    } catch (error) {
      console.error("Error initiating checkout:", error);
      alert("Failed to process checkout.");
    } finally {
      setIsBooking(false);
    }
  };

  // --- NEW: DEEP LINK GENERATOR ---
  const getUpiLink = () => {
    if (!room || !ownerUpiId) return "";
    const hotelNameEncoded = encodeURIComponent(room.hotelName);
    return `upi://pay?pa=${ownerUpiId}&pn=${hotelNameEncoded}&am=${finalTotal.toFixed(0)}&cu=INR`;
  };

  // --- NEW: CONFIRM UTR PAYMENT ---
  const handleConfirmUpiPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (utrNumber.length < 12) {
      alert("Please enter a valid 12-digit UTR.");
      return;
    }
    await processBooking(utrNumber);
  };

  // Original booking logic, now safely handles the new fields for Partner Dashboard
  const processBooking = async (transactionId: string) => {
    const user = auth.currentUser;
    if (!user) return;

    setIsBooking(true);
    try {
      await addDoc(collection(db, "bookings"), {
        // Preserved your old fields so nothing breaks
        travelerId: user.uid,
        travelerEmail: user.email,
        hotelOwnerId: room.hotelOwnerId,
        roomId: room.id,
        hotelName: room.hotelName,
        roomName: room.name,
        pricePaid: room.price,
        bookingDate: new Date(),
        
        // Added new fields required by the Partner Dashboard
        partnerId: room.hotelOwnerId,
        customerId: user.uid,
        customerName: user.displayName || "Traveler",
        customerEmail: user.email,
        checkIn: checkIn,
        checkOut: checkOut,
        guests: guests,
        totalPriceBase: baseTotal,
        transactionId: transactionId, // The UPI UTR
        status: "Pending", // Must be pending for owner to approve
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
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-emerald-100">
          <CheckCircle2 className="h-20 w-20 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-slate-900 mb-2">Booking Requested!</h2>
          <p className="text-slate-500 font-medium mb-6">
            You have successfully requested a booking at <strong>{room.hotelName}</strong>. The hotel has been notified to verify your payment and approve your stay.
          </p>
          <Link href="/my-bookings" className="inline-block w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
            View My Bookings
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-4 md:p-8 relative">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-8">
          <button onClick={() => router.back()} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 mb-4 inline-block">&larr; Back to Search</button>
          <h1 className="text-3xl font-black text-slate-900 flex items-center">
            <ShieldCheck className="h-8 w-8 mr-3 text-emerald-500" /> Secure Checkout
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Room Summary Card */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <div className="flex items-center mb-6">
                <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mr-4">
                  <Building2 className="h-8 w-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{room.hotelName}</h2>
                  <p className="text-slate-500 font-medium flex items-center mt-1">
                    <MapPin className="h-4 w-4 mr-1" /> {room.city ? room.city.toUpperCase() : "Destination"}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Room Details</h3>
                <p className="text-xl font-bold text-slate-900 mb-2">{room.name}</p>
                <p className="text-slate-600">{room.description || "A beautiful room reserved exclusively for WanderHub travelers."}</p>
              </div>

              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100 flex items-start text-sm font-medium">
                <ShieldCheck className="h-5 w-5 mr-3 shrink-0" />
                <p>This is a WanderHub Partner property. Your booking request is sent directly to the hotel management.</p>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="md:col-span-1">
            <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl sticky top-8">
              
              {/* --- NEW: DATE & GUEST INPUTS (Seamlessly injected to maintain layout) --- */}
              <div className="mb-6 space-y-3 border-b border-slate-700 pb-6">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Check-in</label>
                  <input type="date" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} min={new Date().toISOString().split('T')[0]} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Check-out</label>
                  <input type="date" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} min={checkIn || new Date().toISOString().split('T')[0]} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-indigo-500 [color-scheme:dark]" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1">Guests</label>
                  <select value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-sm text-white outline-none focus:border-indigo-500">
                    {[1,2,3,4].map(n => <option key={n} value={n}>{n} Guest{n>1?'s':''}</option>)}
                  </select>
                </div>
              </div>

              <h3 className="text-lg font-bold mb-6 border-b border-slate-700 pb-4">Price Summary</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-slate-300">
                  <span>{nights} Night{nights > 1 ? 's' : ''}</span>
                  <span className="flex items-center"><IndianRupee className="h-4 w-4" />{baseTotal.toFixed(0)}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Taxes & Fees</span>
                  <span className="flex items-center"><IndianRupee className="h-4 w-4" />{taxes.toFixed(0)}</span>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="font-bold">Total (INR)</span>
                  <span className="text-2xl font-black text-emerald-400 flex items-center">
                    <IndianRupee className="h-6 w-6" />
                    {finalTotal.toFixed(0)}
                  </span>
                </div>
              </div>

              <button 
                onClick={handleInitiateCheckout}
                disabled={isBooking || !checkIn || !checkOut}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center text-lg"
              >
                {isBooking ? <Loader2 className="h-6 w-6 animate-spin" /> : <><CreditCard className="h-5 w-5 mr-2" /> Book Now</>}
              </button>
            </div>
          </div>

        </div>
      </div>

      {/* --- NEW: PAYMENT MODAL --- */}
      {showPaymentModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2rem] p-8 md:p-10 w-full max-w-md shadow-2xl relative animate-in zoom-in-95 duration-300">
            <button onClick={() => !isBooking && setShowPaymentModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 p-2 rounded-full transition-colors"><X className="h-5 w-5" /></button>
            
            {paymentStep === "SELECT" ? (
              <>
                <div className="flex justify-center mb-6">
                  <div className="h-16 w-16 bg-indigo-100 text-indigo-600 rounded-full flex items-center justify-center shadow-inner">
                    <Smartphone className="h-8 w-8" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-center text-slate-900 mb-2">Direct UPI Payment</h2>
                <p className="text-sm font-medium text-center text-slate-500 mb-8">Pay directly to {room.hotelName} with zero fees.</p>

                <div className="bg-slate-50 rounded-2xl p-6 text-center mb-8 border border-slate-200">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Due</p>
                  <p className="text-4xl font-black text-slate-900 tracking-tighter flex items-center justify-center">
                    <IndianRupee className="h-6 w-6 mr-1 text-slate-400" /> {finalTotal.toFixed(0)}
                  </p>
                </div>

                <a 
                  href={getUpiLink()} 
                  onClick={() => setTimeout(() => setPaymentStep("VERIFY"), 2500)} // Switch to verification step after clicking the link
                  className="w-full bg-slate-900 text-white font-black py-4 rounded-xl shadow-xl hover:scale-105 transition-transform flex justify-center items-center gap-3 mb-4"
                >
                  Pay via Any UPI App
                </a>
                
                <p className="text-xs text-center text-slate-400 font-medium px-4">
                  Clicking will open GPay, PhonePe, or Paytm on your mobile device.
                </p>
              </>
            ) : (
              // VERIFICATION STEP
              <form onSubmit={handleConfirmUpiPayment}>
                <div className="flex justify-center mb-6">
                  <div className="h-16 w-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center shadow-inner">
                    <CheckCircle2 className="h-8 w-8" />
                  </div>
                </div>
                <h2 className="text-2xl font-black text-center text-slate-900 mb-2">Verify Payment</h2>
                <p className="text-sm font-medium text-center text-slate-500 mb-8">Please enter the 12-digit UTR (Reference Number) from your UPI app.</p>

                <div className="mb-6">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Transaction ID (UTR)</label>
                  <input 
                    type="text" 
                    value={utrNumber} 
                    onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))} // Only allow 12 digits
                    placeholder="e.g. 123456789012" 
                    required 
                    minLength={12}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl p-4 text-center font-black tracking-[0.2em] text-xl outline-none focus:border-indigo-500 transition-colors"
                  />
                </div>

                <button type="submit" disabled={isBooking || utrNumber.length < 12} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-xl hover:bg-indigo-500 transition-all disabled:opacity-50 flex justify-center items-center">
                  {isBooking ? <Loader2 className="h-6 w-6 animate-spin" /> : "Confirm Booking"}
                </button>
                
                <button type="button" onClick={() => setPaymentStep("SELECT")} className="w-full text-slate-500 text-xs font-bold py-4 mt-2 hover:text-slate-700 transition-colors">
                  Go Back
                </button>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}