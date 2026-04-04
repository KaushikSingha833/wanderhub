"use client";
import { useState, useEffect, Suspense } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, doc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; 
import { useCurrency } from "../../lib/useCurrency"; 
import { MapPin, Star, Wifi, Coffee, BedDouble, Users, Calendar, ArrowLeft, CheckCircle2, Shield, Loader2, Sparkles, X, Tv, Wind, Smartphone } from "lucide-react";

interface Room {
  id: string;
  name: string;
  hotelName: string;
  city: string;
  price: number;
  imageUrl: string;
  hotelOwnerId: string;
  ownerId: string;
  maxGuests?: number;
  amenities?: string[];
}

// --- WE WRAP THE MAIN LOGIC IN A SEPARATE COMPONENT TO SATISFY NEXT.JS SUSPENSE ---
function PartnerHotelContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  // URL Parameters
  const decodedHotelName = decodeURIComponent(params.hotelName as string);
  
  // Booking Form State (Pre-filled from URL)
  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") || "");
  const [guests, setGuests] = useState(searchParams.get("guests") || "2");
  
  // App State
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Booking Modal State
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  // --- NEW: PAYMENT MODAL STATES ---
  const [paymentStep, setPaymentStep] = useState<"FORM" | "UPI" | "VERIFY">("FORM");
  const [ownerUpiId, setOwnerUpiId] = useState("");
  const [utrNumber, setUtrNumber] = useState("");

  const { symbol, convert } = useCurrency();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (!currentUser) router.push('/'); // Force login to book
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchRooms = async () => {
      try {
        const q = query(collection(db, "rooms"), where("hotelName", "==", decodedHotelName));
        const snapshot = await getDocs(q);
        
        const fetchedRooms = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Room[];

        setRooms(fetchedRooms);
      } catch (error) {
        console.error("Error fetching rooms:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (decodedHotelName) fetchRooms();
  }, [decodedHotelName]);

  // Calculate Total Days for pricing
  const calculateNights = () => {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays === 0 ? 1 : diffDays;
  };

  const nights = calculateNights();
  const totalPriceInBase = selectedRoom ? selectedRoom.price * nights : 0;

  // --- NEW: INITIATE UPI CHECKOUT ---
  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedRoom || !checkIn || !checkOut) {
      alert("Please fill out all dates.");
      return;
    }

    setIsBookingLoading(true);
    try {
      // Check if this specific hotel owner has a UPI ID
      const ownerRef = doc(db, "users", selectedRoom.hotelOwnerId);
      const ownerSnap = await getDoc(ownerRef);

      if (ownerSnap.exists() && ownerSnap.data().upiId) {
        setOwnerUpiId(ownerSnap.data().upiId);
        setPaymentStep("UPI"); // Switch modal to UPI view
      } else {
        // Fallback: No UPI setup, proceed as "Pay at Hotel"
        await processFinalBooking("Pay at Hotel");
      }
    } catch (error) {
      console.error("Payment init failed:", error);
      alert("Failed to check payment status.");
    } finally {
      setIsBookingLoading(false);
    }
  };

  const getUpiLink = () => {
    if (!selectedRoom || !ownerUpiId) return "";
    const name = encodeURIComponent(selectedRoom.hotelName);
    return `upi://pay?pa=${ownerUpiId}&pn=${name}&am=${totalPriceInBase}&cu=INR`;
  };

  const handleVerifyUTR = async (e: React.FormEvent) => {
    e.preventDefault();
    if (utrNumber.length < 12) {
      alert("Please enter a valid 12-digit UTR.");
      return;
    }
    await processFinalBooking(utrNumber);
  };

  // The actual database saving function
  const processFinalBooking = async (transactionId: string) => {
    if (!user || !selectedRoom) return;
    setIsBookingLoading(true);

    try {
      await addDoc(collection(db, "bookings"), {
        hotelName: selectedRoom.hotelName || decodedHotelName || "Unknown Hotel",
        roomId: selectedRoom.id || "Unknown Room ID",
        roomName: selectedRoom.name || "Standard Room",
        partnerId: selectedRoom.hotelOwnerId || "UNKNOWN_PARTNER",
        customerId: user.uid,
        customerName: user.displayName || "Traveler",
        customerEmail: user.email || "", 
        checkIn: checkIn || "",
        checkOut: checkOut || "",
        guests: Number(guests) || 2,
        totalPriceBase: totalPriceInBase || 0, 
        status: "Pending", 
        transactionId: transactionId, // Stores the UTR for the owner to see
        createdAt: new Date()
      });

      setBookingSuccess(true);
      setTimeout(() => {
        setSelectedRoom(null);
        setBookingSuccess(false);
        setPaymentStep("FORM");
        router.push('/'); 
      }, 3000);

    } catch (error) {
      console.error("Booking failed:", error);
      alert("Booking failed. Please try again.");
    } finally {
      setIsBookingLoading(false);
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#030712]"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>;

  const hotelCity = rooms.length > 0 ? rooms[0].city : "Unknown Location";
  const heroImage = rooms.length > 0 ? rooms[0].imageUrl : "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=1200&q=80";

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#030712] font-sans text-slate-900 dark:text-slate-100 pb-24 selection:bg-indigo-100 selection:text-indigo-900 transition-colors duration-300">
      
      {/* HERO BANNER SECTION */}
      <div className="relative h-[40vh] md:h-[50vh] w-full bg-slate-900 dark:bg-black overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={heroImage} alt={decodedHotelName} className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-40" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] dark:from-[#030712] via-slate-900/40 dark:via-black/60 to-transparent"></div>
        
        <div className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
          <button onClick={() => router.back()} className="flex items-center text-sm font-bold text-white bg-black/20 hover:bg-black/40 backdrop-blur-md px-4 py-2 rounded-full transition-all border border-white/10">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Search
          </button>
        </div>

        <div className="absolute bottom-12 md:bottom-16 left-0 w-full px-6 md:px-12 z-20 max-w-6xl mx-auto">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/20 text-white text-xs font-bold mb-4 shadow-sm uppercase tracking-widest">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Exclusive Partner
          </div>
          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-lg mb-2">{decodedHotelName}</h1>
          <p className="text-white/80 font-bold flex items-center text-lg"><MapPin className="h-5 w-5 mr-2" /> {hotelCity}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-8 relative z-30">
        <div className="mb-8">
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">Available Rooms</h2>
          {rooms.length === 0 ? (
            <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] p-12 text-center border border-slate-200 dark:border-white/10">
              <BedDouble className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-500 font-bold">No rooms currently available for this property.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {rooms.map(room => (
                <div key={room.id} className="bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all hover:-translate-y-1">
                  <div className="h-48 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={room.imageUrl || "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?w=800"} alt={room.name} className="w-full h-full object-cover" />
                    <div className="absolute top-4 left-4 bg-white/90 dark:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-black text-slate-800 dark:text-white flex items-center">
                      <Users className="h-3.5 w-3.5 mr-1.5 text-indigo-500" /> Up to {room.maxGuests || 2} Guests
                    </div>
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="font-black text-xl text-slate-900 dark:text-white mb-4">{room.name}</h3>
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center"><Wifi className="h-3 w-3 mr-1.5"/> Free WiFi</span>
                      <span className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center"><Tv className="h-3 w-3 mr-1.5"/> Smart TV</span>
                      <span className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center"><Wind className="h-3 w-3 mr-1.5"/> AC</span>
                    </div>
                    <div className="mt-auto pt-5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Price</p>
                        <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter truncate">
                          {symbol}{convert(room.price).toLocaleString(undefined, {maximumFractionDigits: 0})}
                          <span className="text-xs font-medium text-slate-500 tracking-normal ml-1">/night</span>
                        </p>
                      </div>
                      <button 
                        onClick={() => { setSelectedRoom(room); setPaymentStep("FORM"); }} 
                        className="bg-slate-900 dark:bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-black transition-all shadow-lg hover:scale-105 shrink-0"
                      >
                        Select Room
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* BOOKING MODAL */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 md:p-10 w-full max-w-lg shadow-2xl relative border border-transparent dark:border-white/10 animate-in zoom-in-95 duration-300">
            
            {bookingSuccess ? (
              <div className="text-center py-10">
                <div className="h-20 w-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">Request Sent!</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">The hotel partner has received your booking request. You will be redirected shortly.</p>
              </div>
            ) : paymentStep === "FORM" ? (
              <>
                <button onClick={() => setSelectedRoom(null)} className="absolute top-6 right-6 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 p-2 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Request to Book</h2>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-6 flex items-center"><Shield className="h-4 w-4 mr-1.5"/> Secure WanderHub Partner</p>
                <div className="bg-slate-50 dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-white/10 mb-6 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedRoom.imageUrl} alt="Room" className="h-16 w-16 rounded-xl object-cover" />
                  <div>
                    <p className="font-black text-slate-900 dark:text-white">{selectedRoom.name}</p>
                    <p className="text-xs font-bold text-slate-500 dark:text-slate-400 mt-1">{symbol}{convert(selectedRoom.price).toLocaleString(undefined, {maximumFractionDigits: 0})} / night</p>
                  </div>
                </div>
                <form onSubmit={handleInitiatePayment} className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Check-In</label>
                      <input type="date" value={checkIn} onChange={(e)=>setCheckIn(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl p-3 outline-none font-bold text-slate-900 dark:text-white cursor-pointer dark:[color-scheme:dark]" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Check-Out</label>
                      <input type="date" value={checkOut} onChange={(e)=>setCheckOut(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl p-3 outline-none font-bold text-slate-900 dark:text-white cursor-pointer dark:[color-scheme:dark]" required />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Guests</label>
                    <select value={guests} onChange={(e)=>setGuests(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl p-3 outline-none font-bold text-slate-900 dark:text-white cursor-pointer appearance-none">
                      <option value="1">1 Guest</option><option value="2">2 Guests</option><option value="3">3 Guests</option><option value="4">4 Guests</option>
                    </select>
                  </div>
                  <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-5 mt-4 flex justify-between items-center border border-slate-200 dark:border-white/5">
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Price</p>
                      <p className="text-xs font-medium text-slate-400 mt-1">{nights} night{nights > 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                      {symbol}{(convert(selectedRoom.price) * nights).toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </p>
                  </div>
                  <button type="submit" disabled={isBookingLoading} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-black text-lg hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-600/20 disabled:opacity-70 flex justify-center items-center mt-4">
                    {isBookingLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Send Request to Partner"}
                  </button>
                </form>
              </>
            ) : paymentStep === "UPI" ? (
              // --- UPI DEEP LINK STEP ---
              <>
                <button onClick={() => setPaymentStep("FORM")} className="absolute top-6 left-6 text-slate-400 hover:text-slate-600 font-bold text-xs uppercase tracking-widest">&larr; Back</button>
                <div className="text-center">
                   <div className="h-16 w-16 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-full flex items-center justify-center mx-auto mb-6"><Smartphone className="h-8 w-8" /></div>
                   <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Direct UPI Payment</h2>
                   <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8">Pay directly to {selectedRoom.hotelName} for instant confirmation.</p>
                   <div className="bg-slate-50 dark:bg-white/5 rounded-2xl p-6 mb-8 border border-slate-200 dark:border-white/5">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Total Due</p>
                      <p className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">
                        {symbol}{(convert(selectedRoom.price) * nights).toLocaleString(undefined, {maximumFractionDigits: 0})}
                      </p>
                   </div>
                   <a 
                    href={getUpiLink()} 
                    onClick={() => setTimeout(() => setPaymentStep("VERIFY"), 2500)}
                    className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black py-4 rounded-xl shadow-xl flex justify-center items-center gap-3 mb-4 transition-transform hover:scale-105"
                   >
                     Open UPI App to Pay
                   </a>
                   <p className="text-xs text-slate-400 font-medium">Safe & Secure via Standard UPI Protocol</p>
                </div>
              </>
            ) : (
              // --- UTR VERIFICATION STEP ---
              <form onSubmit={handleVerifyUTR}>
                <div className="text-center">
                  <div className="h-16 w-16 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6"><CheckCircle2 className="h-8 w-8" /></div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Confirm Payment</h2>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8">Enter the 12-digit UTR from your bank transaction.</p>
                  <div className="mb-6">
                    <input 
                      type="text" 
                      value={utrNumber} 
                      onChange={(e) => setUtrNumber(e.target.value.replace(/\D/g, '').slice(0, 12))}
                      placeholder="e.g. 123456789012" 
                      required 
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl p-4 text-center font-black tracking-[0.2em] text-xl outline-none focus:border-indigo-500 dark:text-white"
                    />
                  </div>
                  <button type="submit" disabled={isBookingLoading || utrNumber.length < 12} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-xl hover:bg-indigo-500 flex justify-center items-center">
                    {isBookingLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Verify & Complete"}
                  </button>
                  <button type="button" onClick={() => setPaymentStep("UPI")} className="mt-4 text-xs font-bold text-slate-400 uppercase tracking-widest hover:text-slate-600 transition-colors">Go Back</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// --- NEXT.JS REQUIREMENT: WRAP IN SUSPENSE TO AVOID ROUTER ERRORS ---
export default function PartnerHotelPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#030712]"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>}>
      <PartnerHotelContent />
    </Suspense>
  );
}