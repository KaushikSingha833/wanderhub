"use client";
import { useState, useEffect, Suspense, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy, serverTimestamp, updateDoc, arrayUnion, arrayRemove, onSnapshot} from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { useCurrency } from "../../lib/useCurrency";
import { MapPin, Star, Wifi, Coffee, BedDouble, Users, Calendar, ArrowLeft, CheckCircle2, Shield, Loader2, Sparkles, X, Tv, Wind, Smartphone, ChevronLeft, ChevronRight, Image as ImageIcon, MessageSquare, ThumbsUp, ThumbsDown, Map as MapIcon, ArrowDownUp, PlaneTakeoff, CreditCard, Settings, Plane, Info, Search, Menu, ChevronDown, AlertCircle} from "lucide-react";
import Link from "next/link";

// --- RAZORPAY SCRIPT LOADER ---
const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

interface Room {
  id: string;
  name: string;
  hotelName: string;
  city: string;
  price: number;
  imageUrl: string;
  imageUrls?: string[];
  hotelOwnerId: string;
  ownerId: string;
  maxGuests?: number;
  amenities?: string[];
  latitude?: number;
  longitude?: number;
}

interface ReviewReply {
  id: string;
  userId: string;
  userName: string;
  text: string;
  createdAt: number;
}

interface Review {
  id: string;
  hotelName: string;
  userId: string;
  userName: string;
  rating: number;
  comment: string;
  createdAt: any;
  upvotedBy?: string[];
  downvotedBy?: string[];
  replies?: ReviewReply[];
}

function PartnerHotelContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  
  const decodedHotelName = decodeURIComponent(params.hotelName as string);
  
  const [checkIn, setCheckIn] = useState(searchParams.get("checkIn") || "");
  const [checkOut, setCheckOut] = useState(searchParams.get("checkOut") || "");
  const [guests, setGuests] = useState(searchParams.get("guests") || "2");
  
  const [sortBy, setSortBy] = useState("recommended");

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [hotelCoords, setHotelCoords] = useState<{lat: number, lng: number} | null>(null);

  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");

  const [reviews, setReviews] = useState<Review[]>([]);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState("");
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [isBookingLoading, setIsBookingLoading] = useState(false);
  const [bookingSuccess, setBookingSuccess] = useState(false);

  const [paymentStep, setPaymentStep] = useState<"FORM" | "PROCESSING">("FORM");

  const [viewingPhotosFor, setViewingPhotosFor] = useState<Room | null>(null);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);

  // ✨ NEW: TRAIN BOOKING OVERLAP STATE
  const [occupiedRoomIds, setOccupiedRoomIds] = useState<Set<string>>(new Set());
  const [isCheckingAvailability, setIsCheckingAvailability] = useState(false);

  const { symbol, convert } = useCurrency();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        // ✨ Added the status filter right here!
        const qTrips = query(collection(db, "trips"), where("members", "array-contains", currentUser.uid), where("status", "==", "active"));
        onSnapshot(qTrips, (snapshot) => {
          const tripsData = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
          setTrips(tripsData);
          if (tripsData.length > 0) setSelectedTripId(tripsData[0].id);
        });
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const qRooms = query(collection(db, "rooms"), where("hotelName", "==", decodedHotelName));
        const snapshotRooms = await getDocs(qRooms);
        const fetchedRooms = snapshotRooms.docs.map(doc => ({
          id: doc.id, ...doc.data()
        })) as Room[];
        setRooms(fetchedRooms);

        const qHotel = query(collection(db, "users"), where("hotelName", "==", decodedHotelName), where("role", "==", "hotel_partner"));
        const snapshotHotel = await getDocs(qHotel);
        if (!snapshotHotel.empty) {
          const hotelData = snapshotHotel.docs[0].data();
          if (hotelData.latitude && hotelData.longitude) {
            setHotelCoords({ lat: hotelData.latitude, lng: hotelData.longitude });
          }
        }

        const qReviews = query(collection(db, "hotelReviews"), where("hotelName", "==", decodedHotelName));
        const snapshotReviews = await getDocs(qReviews);
        const fetchedReviews = snapshotReviews.docs.map(doc => ({
          id: doc.id, ...doc.data()
        })) as Review[];
        
        fetchedReviews.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
        setReviews(fetchedReviews);

      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (decodedHotelName) fetchData();
  }, [decodedHotelName]);

  // ✨ NEW: TRAIN BOOKING OVERLAP CHECKER
  useEffect(() => {
    const fetchOccupiedRooms = async () => {
      if (!checkIn || !checkOut) {
        setOccupiedRoomIds(new Set());
        return;
      }
      setIsCheckingAvailability(true);
      
      try {
        const reqStart = new Date(checkIn).getTime();
        const reqEnd = new Date(checkOut).getTime();
        
        // Prevent invalid date ranges
        if (reqStart >= reqEnd) {
          setOccupiedRoomIds(new Set());
          setIsCheckingAvailability(false);
          return;
        }

        const qBookings = query(
          collection(db, "bookings"),
          where("hotelName", "==", decodedHotelName),
          where("status", "in", ["Approved", "Confirmed"])
        );
        
        const snapshot = await getDocs(qBookings);
        const occupied = new Set<string>();

        snapshot.docs.forEach(doc => {
          const b = doc.data();
          const bStart = new Date(b.checkIn).getTime();
          const bEnd = new Date(b.checkOut).getTime();

          // ✨ OVERLAP FORMULA
          if (reqStart < bEnd && reqEnd > bStart) {
            occupied.add(b.roomId);
          }
        });

        setOccupiedRoomIds(occupied);
      } catch (err) {
        console.error("Error fetching occupied rooms:", err);
      } finally {
        setIsCheckingAvailability(false);
      }
    };

    fetchOccupiedRooms();
  }, [checkIn, checkOut, decodedHotelName]);

  // ✨ UPDATED: INTEGRATE OVERLAP INTO DISPLAY LOGIC
  const displayedRooms = useMemo(() => {
    let filtered = rooms.filter(room => {
      const roomCapacity = room.maxGuests || 2; 
      // 1. Capacity Check
      if (roomCapacity < Number(guests)) return false;
      // 2. Train Booking Overlap Check
      if (occupiedRoomIds.has(room.id)) return false; 
      return true;
    });

    if (sortBy === "price_asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_desc") {
      filtered.sort((a, b) => b.price - a.price);
    }

    return filtered;
  }, [rooms, guests, sortBy, occupiedRoomIds]);

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1) 
    : "New";

  const calculateNights = () => {
    if (!checkIn || !checkOut) return 1;
    const start = new Date(checkIn);
    const end = new Date(checkOut);
    const diffTime = end.getTime() - start.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
    return diffDays <= 0 ? 1 : diffDays;
  };

  const nights = calculateNights();
  const totalPriceInBase = selectedRoom ? selectedRoom.price * nights : 0;
  
  // Real-time check if selected room became occupied due to date tweaks in modal
  const isRoomCurrentlyOccupied = selectedRoom ? occupiedRoomIds.has(selectedRoom.id) : false;

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert("You must be logged in to leave a review."); return; }
    if (!newComment.trim()) return;

    setIsSubmittingReview(true);
    try {
      const reviewData = {
        hotelName: decodedHotelName, userId: user.uid, userName: user.displayName || "WanderHub Traveler",
        rating: newRating, comment: newComment.trim(), createdAt: serverTimestamp(),
        upvotedBy: [], downvotedBy: [], replies: []
      };
      const docRef = await addDoc(collection(db, "hotelReviews"), reviewData);
      setReviews([{ ...reviewData, id: docRef.id, createdAt: { toMillis: () => Date.now() } } as any, ...reviews]);
      setNewComment(""); setNewRating(5);
    } catch (error) {
      console.error("Error posting review:", error); alert("Failed to post review.");
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleSubmitReply = async (e: React.FormEvent, reviewId: string) => {
    e.preventDefault();
    if (!user) { alert("You must be logged in to reply."); return; }
    if (!replyText.trim()) return;

    setIsSubmittingReply(true);
    const newReply: ReviewReply = {
      id: Date.now().toString() + Math.random().toString(36).substring(2, 7),
      userId: user.uid, userName: user.displayName || "WanderHub Traveler",
      text: replyText.trim(), createdAt: Date.now()
    };

    try {
      const reviewRef = doc(db, "hotelReviews", reviewId);
      await updateDoc(reviewRef, { replies: arrayUnion(newReply) });
      setReviews(prev => prev.map(r => {
        if (r.id === reviewId) { return { ...r, replies: [...(r.replies || []), newReply] }; }
        return r;
      }));
      setReplyText(""); setReplyingTo(null);
    } catch (error) {
      console.error("Error posting reply:", error); alert("Failed to post reply.");
    } finally {
      setIsSubmittingReply(false);
    }
  };

  const handleVote = async (reviewId: string, type: 'upvote' | 'downvote') => {
    if (!user) { alert("You must be logged in to vote."); return; }
    const review = reviews.find(r => r.id === reviewId);
    if (!review) return;

    const hasUpvoted = review.upvotedBy?.includes(user.uid);
    const hasDownvoted = review.downvotedBy?.includes(user.uid);

    let newUpvotedBy = [...(review.upvotedBy || [])];
    let newDownvotedBy = [...(review.downvotedBy || [])];
    const reviewRef = doc(db, "hotelReviews", reviewId);

    try {
      if (type === 'upvote') {
        if (hasUpvoted) {
          newUpvotedBy = newUpvotedBy.filter(id => id !== user.uid);
          await updateDoc(reviewRef, { upvotedBy: arrayRemove(user.uid) });
        } else {
          newUpvotedBy.push(user.uid); newDownvotedBy = newDownvotedBy.filter(id => id !== user.uid);
          await updateDoc(reviewRef, { upvotedBy: arrayUnion(user.uid), downvotedBy: arrayRemove(user.uid) });
        }
      } else {
        if (hasDownvoted) {
          newDownvotedBy = newDownvotedBy.filter(id => id !== user.uid);
          await updateDoc(reviewRef, { downvotedBy: arrayRemove(user.uid) });
        } else {
          newDownvotedBy.push(user.uid); newUpvotedBy = newUpvotedBy.filter(id => id !== user.uid);
          await updateDoc(reviewRef, { downvotedBy: arrayUnion(user.uid), upvotedBy: arrayRemove(user.uid) });
        }
      }
      setReviews(prev => prev.map(r => r.id === reviewId ? { ...r, upvotedBy: newUpvotedBy, downvotedBy: newDownvotedBy } : r));
    } catch (error) { console.error("Error updating vote:", error); }
  };

  const handleInitiatePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) { alert("Please log in to book."); router.push('/'); return; }
    if (!selectedRoom || !checkIn || !checkOut) { alert("Please fill out all dates."); return; }
    
    // ✨ EXTRA SAFETY CHECK: Prevent double-booking race condition
    if (isRoomCurrentlyOccupied) {
       alert("Sorry! This room was just booked for these dates. Please select different dates.");
       return;
    }

    if (trips.length > 0 && !selectedTripId) { alert("Please select an itinerary to attach this booking to."); return; }

    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) return alert("Razorpay SDK failed to load. Check your internet connection.");

    setIsBookingLoading(true);

    const finalAmountINR = convert(selectedRoom.price) * nights;
    const amountInPaise = Math.round(finalAmountINR * 100);

    try {
      const orderRes = await fetch("/api/razorpay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountInPaise })
      });
      const orderData = await orderRes.json();

      if (orderData.error) throw new Error(orderData.error);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_SZpnRvlSEBfADP",
        amount: amountInPaise.toString(),
        currency: "INR",
        name: "WanderHub Hotels",
        description: `${selectedRoom.hotelName} - ${nights} Night(s)`,
        image: "https://cdn-icons-png.flaticon.com/512/3125/3125713.png", 
        order_id: orderData.id, 
        handler: async function (response: any) {
          console.log("Payment Success:", response.razorpay_payment_id);
          setPaymentStep("PROCESSING");
          await processFinalBooking(response.razorpay_payment_id);
        },
        prefill: {
          name: user.displayName || "Traveler",
          email: user.email || "",
          contact: "9999999999", 
        },
        theme: { color: "#10b981" }, // Emerald color
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();

    } catch (err) {
      console.error(err);
      alert("Payment initialization failed.");
    } finally {
      setIsBookingLoading(false);
    }
  };

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
        status: "Confirmed", 
        transactionId: transactionId, 
        createdAt: new Date()
      });

      if (selectedTripId) {
        await addDoc(collection(db, "activities"), {
          tripId: selectedTripId,
          title: `Check-in at ${selectedRoom.hotelName}`,
          type: "hotel",
          date: checkIn,
          time: "14:00", 
          location: hotelCity,
          notes: `Room: ${selectedRoom.name} | Guests: ${guests} | Checkout: ${checkOut}`,
          trackingNumber: transactionId.substring(4, 12).toUpperCase() 
        });
      }

      setBookingSuccess(true);
      setTimeout(() => {
        setSelectedRoom(null);
        setBookingSuccess(false);
        setPaymentStep("FORM");
        router.push('/itineraries'); 
      }, 3000);

    } catch (error) {
      console.error("Booking failed:", error);
      alert("Booking failed. Please try again.");
      setPaymentStep("FORM");
    } finally {
      setIsBookingLoading(false);
    }
  };

  const handleNextPhoto = () => {
    if (!viewingPhotosFor || !viewingPhotosFor.imageUrls) return;
    setCurrentPhotoIndex((prev) => prev === viewingPhotosFor.imageUrls!.length - 1 ? 0 : prev + 1);
  };
  const handlePrevPhoto = () => {
    if (!viewingPhotosFor || !viewingPhotosFor.imageUrls) return;
    setCurrentPhotoIndex((prev) => prev === 0 ? viewingPhotosFor.imageUrls!.length - 1 : prev - 1);
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-[#FDFDFD] dark:bg-zinc-950"><Loader2 className="h-10 w-10 animate-spin text-emerald-500" /></div>;

  const hotelCity = rooms.length > 0 ? rooms[0].city : "Unknown Location";
  const heroImage = rooms.length > 0 ? (rooms[0].imageUrls?.[0] || rooms[0].imageUrl) : "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=1200&q=80";

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
          <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto md:hidden p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>
        
        <nav className="flex-1 px-4 py-8 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><MapIcon className="h-5 w-5 mr-3 opacity-70" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Calendar className="h-5 w-5 mr-3 opacity-70" /> Itineraries</Link>
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><BedDouble className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Settings className="h-5 w-5 mr-3 opacity-70" /> Settings</Link>
          
          <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <Link href="/about" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
              <Info className="h-5 w-5 mr-3 opacity-70" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-2 shadow-sm">
              <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/hotels" className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"><Search className="h-5 w-5" /></Link>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-600 dark:text-zinc-400 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
          </div>
        </div>

        {/* DESKTOP HEADER (MINIMALIST) */}
        <header className="hidden md:flex h-24 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 items-center justify-between px-12 z-20 shrink-0 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter">Property Details</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-1">Review rooms and availability.</p>
          </div>
          <Link href="/hotels" className="flex items-center bg-transparent border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all px-6 py-3 rounded-full font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-widest active:scale-95">
            <ArrowLeft className="h-4 w-4 mr-2 text-zinc-500" /> Back to Search
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto custom-scrollbar relative z-10">
          
          {/* EDITORIAL HERO BANNER */}
          <div className="relative h-[40vh] md:h-[50vh] w-full bg-zinc-900 dark:bg-black overflow-hidden mb-8 md:mb-12 border-b border-zinc-800">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none"></div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroImage} alt={decodedHotelName} className="absolute inset-0 w-full h-full object-cover opacity-50 dark:opacity-40 filter grayscale-[0.2]" />
            <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>
            <div className="absolute top-[-50%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[100px] pointer-events-none"></div>

            <div className="absolute bottom-10 left-0 w-full px-6 md:px-12 z-20 max-w-7xl mx-auto">
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest shadow-sm">
                  <Sparkles className="h-3 w-3" /> Exclusive Partner
                </div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest shadow-sm">
                  <Star className="h-3.5 w-3.5 fill-white text-white" /> 
                  {averageRating} <span className="font-medium text-zinc-300 ml-1">({reviews.length} Reviews)</span>
                </div>
              </div>

              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter drop-shadow-md mb-3 leading-tight">{decodedHotelName}</h1>
              
              <div className="flex flex-col sm:flex-row sm:items-center gap-4 mt-2">
                <p className="text-zinc-300 font-bold flex items-center text-sm md:text-base"><MapPin className="h-4 w-4 mr-2 text-emerald-500" /> {hotelCity}</p>
                
                {hotelCoords && (
                  <a 
                    href={`https://www.google.com/maps/search/?api=1&query=${hotelCoords.lat},${hotelCoords.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center text-[10px] font-bold text-white uppercase tracking-widest bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full transition-all border border-white/20 shadow-sm w-max active:scale-95"
                  >
                    <MapIcon className="h-3.5 w-3.5 mr-2" /> Show on Map
                  </a>
                )}
              </div>
            </div>
          </div>

          <div className="max-w-7xl mx-auto px-4 md:px-12 pb-24 relative z-30">
            
            {/* ROOMS GRID */}
            <div className="mb-20">
              <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4 border-b border-zinc-200 dark:border-zinc-800 pb-4">
                <div>
                  <h2 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Available Rooms</h2>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-1.5">For {guests} guests from {checkIn || 'Dates TBD'}</p>
                </div>
                
                <div className="flex items-center gap-4">
                  {isCheckingAvailability && (
                    <div className="flex items-center text-[10px] font-bold text-emerald-500 uppercase tracking-widest">
                      <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> Live Syncing...
                    </div>
                  )}
                  <div className="relative group">
                    <ArrowDownUp className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-hover:text-emerald-500 transition-colors pointer-events-none" />
                    <select 
                      value={sortBy} 
                      onChange={(e) => setSortBy(e.target.value)}
                      className="pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white shadow-sm outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none transition-all"
                    >
                      <option value="recommended">Recommended</option>
                      <option value="price_asc">Price: Low to High</option>
                      <option value="price_desc">Price: High to Low</option>
                    </select>
                    <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                  </div>
                </div>
              </div>

              {displayedRooms.length === 0 ? (
                <div className="bg-transparent rounded-[2rem] p-16 text-center border border-dashed border-zinc-300 dark:border-zinc-800 animate-in zoom-in-95 duration-500">
                  <div className="h-16 w-16 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-200 dark:border-zinc-800 shadow-sm"><BedDouble className="h-8 w-8 text-zinc-400" /></div>
                  <p className="text-zinc-900 dark:text-white font-bold text-xl mb-2 tracking-tight">No rooms available for these dates.</p>
                  <p className="text-zinc-500 font-medium text-sm">All rooms are fully booked or cannot accommodate {guests} guests. Try adjusting your dates.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {displayedRooms.map(room => (
                    <div key={room.id} className="bg-white dark:bg-zinc-900/40 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm overflow-hidden flex flex-col hover:shadow-2xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-500 group relative hover:-translate-y-2">
                      <div className="h-56 relative overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={room.imageUrls?.[0] || room.imageUrl || "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?w=800"} alt={room.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
                        
                        <div className="absolute top-4 left-4 bg-white/90 dark:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-white flex items-center border border-white/20 shadow-sm">
                          <Users className="h-3 w-3 mr-1.5 text-emerald-500" /> Up to {room.maxGuests || 2} Guests
                        </div>

                        {room.imageUrls && room.imageUrls.length > 1 && (
                          <div className="absolute bottom-4 right-4 bg-black/60 backdrop-blur-md text-white text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center border border-white/20">
                            <ImageIcon className="h-3 w-3 mr-1.5" /> {room.imageUrls.length} Photos
                          </div>
                        )}
                      </div>
                      <div className="p-6 md:p-8 flex-1 flex flex-col">
                        <h3 className="font-black text-2xl text-zinc-900 dark:text-white mb-5 tracking-tight">{room.name}</h3>
                        <div className="flex flex-wrap gap-2 mb-6">
                          <span className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center"><Wifi className="h-3 w-3 mr-1.5 text-zinc-500"/> Free WiFi</span>
                          <span className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center"><Tv className="h-3 w-3 mr-1.5 text-zinc-500"/> Smart TV</span>
                          <span className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1.5 rounded-full flex items-center"><Wind className="h-3 w-3 mr-1.5 text-zinc-500"/> AC</span>
                        </div>
                        
                        <div className="mt-auto pt-6 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-4">
                          <div className="flex items-end justify-between">
                            <div>
                              <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Price</p>
                              <p className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter truncate">
                                {symbol}{convert(room.price).toLocaleString(undefined, {maximumFractionDigits: 0})}
                                <span className="text-xs font-medium text-zinc-500 tracking-normal ml-1">/night</span>
                              </p>
                            </div>
                            <button 
                              onClick={() => { 
                                if(!user) { alert("Please log in to book."); router.push('/'); return; }
                                setSelectedRoom(room); setPaymentStep("FORM"); 
                              }} 
                              className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all shadow-md hover:opacity-90 active:scale-95 shrink-0"
                            >
                              Book Now
                            </button>
                          </div>

                          {room.imageUrls && room.imageUrls.length > 1 && (
                            <button 
                              onClick={() => { setViewingPhotosFor(room); setCurrentPhotoIndex(0); }}
                              className="w-full bg-transparent text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 py-3.5 rounded-full text-[10px] uppercase tracking-widest font-bold transition-colors flex items-center justify-center border border-zinc-200 dark:border-zinc-700 active:scale-95 mt-2"
                            >
                              <ImageIcon className="h-4 w-4 mr-2" /> View Room Gallery
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* PUBLIC REVIEWS & RATINGS SECTION */}
            <div className="border-t border-zinc-200 dark:border-zinc-800 pt-16">
              <div className="flex items-center justify-between mb-10">
                <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center">
                  Guest Reviews <span className="ml-4 bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 text-sm font-bold px-4 py-1.5 rounded-full">{reviews.length}</span>
                </h2>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-10">
                {/* Left: Write a Review Form */}
                <div className="xl:col-span-1">
                  <div className="bg-white dark:bg-zinc-900/50 rounded-[2rem] p-8 md:p-10 border border-zinc-200 dark:border-zinc-800/50 shadow-sm sticky top-32">
                    <div className="h-12 w-12 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-full flex items-center justify-center mb-6 shadow-sm border border-zinc-200 dark:border-zinc-700">
                      <MessageSquare className="h-5 w-5" />
                    </div>
                    <h3 className="text-xl font-bold text-zinc-900 dark:text-white mb-2 tracking-tight">Write a Review</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mb-8">Share your experience at {decodedHotelName} with other travelers.</p>

                    {!user ? (
                      <div className="bg-zinc-50 dark:bg-zinc-950 p-6 rounded-2xl text-center border border-zinc-200 dark:border-zinc-800">
                        <p className="text-sm font-bold text-zinc-500 dark:text-zinc-400 mb-4">You must be logged in to leave a review.</p>
                        <button onClick={() => router.push('/')} className="w-full bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold py-3.5 rounded-full text-xs uppercase tracking-widest transition-all hover:opacity-90 active:scale-95 shadow-md">Sign In</button>
                      </div>
                    ) : (
                      <form onSubmit={handleSubmitReview}>
                        <div className="mb-6">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Overall Rating</label>
                          <div className="flex gap-2">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setNewRating(star)}
                                className="focus:outline-none transition-transform hover:scale-110 active:scale-95"
                              >
                                <Star className={`h-8 w-8 ${star <= newRating ? 'fill-amber-400 text-amber-400 drop-shadow-sm' : 'fill-zinc-100 text-zinc-200 dark:fill-zinc-800 dark:text-zinc-700'}`} />
                              </button>
                            ))}
                          </div>
                        </div>
                        
                        <div className="mb-8">
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Your Comment</label>
                          <textarea 
                            value={newComment}
                            onChange={(e) => setNewComment(e.target.value)}
                            placeholder="How was the cleanliness, staff, and location?"
                            required
                            rows={4}
                            className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 outline-none font-medium text-sm text-zinc-900 dark:text-white resize-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all placeholder:text-zinc-500"
                          />
                        </div>
                        
                        <button type="submit" disabled={isSubmittingReview || !newComment.trim()} className="w-full bg-emerald-500 text-zinc-950 font-bold text-xs uppercase tracking-widest py-4 rounded-full shadow-[0_0_15px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all disabled:opacity-50 disabled:shadow-none flex justify-center items-center active:scale-95">
                          {isSubmittingReview ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post Public Review"}
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Right: Public Review Feed */}
                <div className="xl:col-span-2">
                  {reviews.length === 0 ? (
                    <div className="text-center py-24 bg-transparent rounded-[2rem] border border-dashed border-zinc-300 dark:border-zinc-800">
                      <Star className="h-10 w-10 text-zinc-300 dark:text-zinc-600 mx-auto mb-4" />
                      <h4 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">No reviews yet</h4>
                      <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">Be the first to share your thoughts about this hotel.</p>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {reviews.map((review) => {
                        const upvotes = review.upvotedBy?.length || 0;
                        const downvotes = review.downvotedBy?.length || 0;
                        const hasUpvoted = user && review.upvotedBy?.includes(user.uid);
                        const hasDownvoted = user && review.downvotedBy?.includes(user.uid);

                        return (
                          <div key={review.id} className="bg-white dark:bg-zinc-900/40 p-6 md:p-8 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm flex flex-col transition-colors hover:border-zinc-300 dark:hover:border-zinc-700">
                            <div className="flex justify-between items-start mb-6">
                              <div className="flex items-center gap-4">
                                <div className="h-12 w-12 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-900 dark:text-white font-bold text-lg shadow-inner border border-zinc-200 dark:border-zinc-700">
                                  {review.userName.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-bold text-zinc-900 dark:text-white tracking-tight">{review.userName}</p>
                                  <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mt-0.5">
                                    {review.createdAt?.toMillis ? new Date(review.createdAt.toMillis()).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : "Just now"}
                                  </p>
                                </div>
                              </div>
                              <div className="flex gap-0.5 bg-zinc-50 dark:bg-zinc-950 px-3 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-800">
                                {[...Array(5)].map((_, i) => (
                                  <Star key={i} className={`h-3.5 w-3.5 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-zinc-300 dark:text-zinc-700'}`} />
                                ))}
                              </div>
                            </div>
                            <p className="text-zinc-600 dark:text-zinc-300 leading-relaxed font-medium md:pl-16 flex-1 text-sm md:text-base">{review.comment}</p>
                            
                            <div className="md:ml-16 mt-6 flex flex-wrap items-center gap-6 pt-5 border-t border-zinc-100 dark:border-zinc-800/50">
                              <div className="flex items-center gap-4">
                                <button 
                                  onClick={() => handleVote(review.id, 'upvote')}
                                  className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${hasUpvoted ? 'text-emerald-500' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                                >
                                  <ThumbsUp className={`h-4 w-4 ${hasUpvoted ? 'fill-current' : ''}`} />
                                  {upvotes > 0 && upvotes}
                                </button>
                                <button 
                                  onClick={() => handleVote(review.id, 'downvote')}
                                  className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${hasDownvoted ? 'text-rose-500' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                                >
                                  <ThumbsDown className={`h-4 w-4 ${hasDownvoted ? 'fill-current' : ''}`} />
                                  {downvotes > 0 && downvotes}
                                </button>
                              </div>
                              
                              <button 
                                onClick={() => setReplyingTo(replyingTo === review.id ? null : review.id)}
                                className={`flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest transition-colors ${replyingTo === review.id ? 'text-emerald-500' : 'text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-300'}`}
                              >
                                <MessageSquare className="h-4 w-4" /> Reply
                              </button>
                            </div>

                            {replyingTo === review.id && (
                              <div className="md:ml-16 mt-5 animate-in fade-in slide-in-from-top-2 duration-200">
                                <form onSubmit={(e) => handleSubmitReply(e, review.id)} className="flex gap-3">
                                  <input 
                                    type="text" 
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Write a reply..."
                                    className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-full px-5 py-3 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-zinc-900 dark:text-white font-medium placeholder-zinc-500"
                                    required
                                  />
                                  <button type="submit" disabled={isSubmittingReply} className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center shadow-md active:scale-95">
                                    {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                                  </button>
                                </form>
                              </div>
                            )}

                            {review.replies && review.replies.length > 0 && (
                              <div className="md:ml-16 mt-6 space-y-4">
                                {review.replies.map(reply => (
                                  <div key={reply.id} className="bg-zinc-50 dark:bg-zinc-950/50 p-5 rounded-2xl border border-zinc-100 dark:border-zinc-800/50">
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-3">
                                        <div className="h-8 w-8 bg-zinc-200 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-900 dark:text-white font-bold text-[10px] border border-zinc-300 dark:border-zinc-700 shadow-sm">
                                          {reply.userName.charAt(0).toUpperCase()}
                                        </div>
                                        <p className="font-bold text-xs text-zinc-900 dark:text-white">{reply.userName}</p>
                                      </div>
                                      <span className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest">
                                        {new Date(reply.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                      </span>
                                    </div>
                                    <p className="text-sm text-zinc-600 dark:text-zinc-300 font-medium pl-11 leading-relaxed">{reply.text}</p>
                                  </div>
                                ))}
                              </div>
                            )}

                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>
        </main>
      </div>

      {/* FULLSCREEN PHOTO SLIDER MODAL */}
      {viewingPhotosFor && viewingPhotosFor.imageUrls && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="absolute top-0 w-full p-6 md:p-8 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
            <div className="text-white">
              <h3 className="font-black text-xl md:text-2xl tracking-tight">{viewingPhotosFor.name}</h3>
              <p className="text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-1">{currentPhotoIndex + 1} / {viewingPhotosFor.imageUrls.length}</p>
            </div>
            <button onClick={() => setViewingPhotosFor(null)} className="text-zinc-400 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors backdrop-blur-md active:scale-95">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="relative w-full max-w-6xl px-4 md:px-16 flex items-center justify-center flex-1">
            <button onClick={handlePrevPhoto} className="absolute left-4 md:left-8 bg-white/10 hover:bg-white/20 text-white p-3 md:p-4 rounded-full backdrop-blur-md transition-all hover:scale-110 active:scale-95 z-10 border border-white/10">
              <ChevronLeft className="h-6 w-6 md:h-8 md:w-8" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewingPhotosFor.imageUrls[currentPhotoIndex]} alt={`Photo ${currentPhotoIndex + 1}`} className="max-h-[70vh] w-auto object-contain rounded-[2rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] animate-in zoom-in-95 duration-200 border border-white/10" />
            <button onClick={handleNextPhoto} className="absolute right-4 md:right-8 bg-white/10 hover:bg-white/20 text-white p-3 md:p-4 rounded-full backdrop-blur-md transition-all hover:scale-110 active:scale-95 z-10 border border-white/10">
              <ChevronRight className="h-6 w-6 md:h-8 md:w-8" />
            </button>
          </div>

          <div className="h-28 w-full bg-black/80 p-5 flex justify-center gap-3 overflow-x-auto custom-scrollbar border-t border-white/10 backdrop-blur-md">
            {viewingPhotosFor.imageUrls.map((url, idx) => (
              <button key={idx} onClick={() => setCurrentPhotoIndex(idx)} className={`h-full w-24 shrink-0 rounded-xl overflow-hidden transition-all border-2 ${currentPhotoIndex === idx ? 'border-emerald-500 opacity-100 scale-105 shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'border-transparent opacity-40 hover:opacity-70'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Thumbnail" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SECURE RAZORPAY BOOKING MODAL (FINTECH) */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] p-8 md:p-10 w-full max-w-md shadow-2xl relative border border-transparent dark:border-zinc-800 animate-in zoom-in-95 duration-300">
            
            {bookingSuccess ? (
              <div className="text-center py-10">
                <div className="h-20 w-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 border border-emerald-500/20">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Booking Secured!</h2>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">Payment successful. Room locked. Adding to itinerary...</p>
              </div>
            ) : paymentStep === "PROCESSING" ? (
              <div className="text-center py-10">
                <Loader2 className="h-12 w-12 text-emerald-500 animate-spin mx-auto mb-6" />
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Finalizing Details...</h2>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium text-sm">Verifying payment with bank and confirming your room block.</p>
              </div>
            ) : (
              <>
                <button onClick={() => setSelectedRoom(null)} className="absolute top-6 right-6 text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 p-2.5 rounded-full transition-colors active:scale-95"><X className="h-4 w-4" /></button>
                
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Checkout</h2>
                <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mb-6 flex items-center"><Shield className="h-3.5 w-3.5 mr-1.5"/> Secured by Razorpay</p>
                
                {isRoomCurrentlyOccupied && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-500 text-[10px] font-bold uppercase tracking-widest px-4 py-3 rounded-xl mb-6 flex items-center">
                    <AlertCircle className="h-4 w-4 mr-2" /> Room is unavailable for these dates.
                  </div>
                )}

                <div className="bg-zinc-50 dark:bg-zinc-900/50 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-8 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedRoom.imageUrls?.[0] || selectedRoom.imageUrl} alt="Room" className="h-16 w-16 rounded-xl object-cover shadow-sm" />
                  <div className="min-w-0">
                    <p className="font-bold text-zinc-900 dark:text-white truncate text-base">{selectedRoom.name}</p>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 mt-1">{symbol}{convert(selectedRoom.price).toLocaleString(undefined, {maximumFractionDigits: 0})} / night</p>
                  </div>
                </div>

                <form onSubmit={handleInitiatePayment} className="space-y-6">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Check-In</label>
                      <input type="date" value={checkIn} onChange={(e)=>setCheckIn(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none text-sm font-bold text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer dark:[color-scheme:dark] transition-all" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Check-Out</label>
                      <input type="date" value={checkOut} onChange={(e)=>setCheckOut(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3 outline-none text-sm font-bold text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer dark:[color-scheme:dark] transition-all" required />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="relative group">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Guests</label>
                      <select value={guests} onChange={(e)=>setGuests(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl pl-4 pr-8 py-3 outline-none text-sm font-bold text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none transition-all">
                        <option value="1">1 Guest</option><option value="2">2 Guests</option><option value="3">3 Guests</option><option value="4">4 Guests</option>
                      </select>
                      <ChevronDown className="absolute right-3 bottom-3 h-4 w-4 text-zinc-400 pointer-events-none group-hover:text-emerald-500 transition-colors" />
                    </div>
                    <div className="relative group">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Attach to Trip</label>
                      <select 
                        value={selectedTripId} 
                        onChange={(e) => setSelectedTripId(e.target.value)}
                        className="w-full bg-emerald-50/50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-xl pl-4 pr-8 py-3 outline-none text-sm font-bold text-zinc-900 dark:text-white focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none transition-all"
                      >
                        {trips.length === 0 ? <option value="">No Trips Found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 bottom-3 h-4 w-4 text-emerald-500/70 pointer-events-none group-hover:text-emerald-500 transition-colors" />
                    </div>
                  </div>

                  <div className="bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-5 mt-2 flex justify-between items-center border border-zinc-200 dark:border-zinc-800">
                    <div>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Total Price</p>
                      <p className="text-xs font-bold text-zinc-900 dark:text-zinc-300 mt-1">{nights} night{nights > 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">
                      {symbol}{(convert(selectedRoom.price) * nights).toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </p>
                  </div>

                  <button type="submit" disabled={isBookingLoading || isCheckingAvailability || isRoomCurrentlyOccupied} className={`w-full py-4 rounded-full font-bold text-xs uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)] flex justify-center items-center mt-2 active:scale-95 group ${isRoomCurrentlyOccupied ? 'bg-zinc-200 dark:bg-zinc-800 text-zinc-400 cursor-not-allowed shadow-none' : 'bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-50 disabled:shadow-none'}`}>
                    {isBookingLoading || isCheckingAvailability ? <Loader2 className="h-5 w-5 animate-spin" /> : <><CreditCard className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" /> Pay with Razorpay</>}
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function PartnerHotelPage() {
  return (
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-[#FDFDFD] dark:bg-zinc-950"><Loader2 className="h-10 w-10 animate-spin text-emerald-500" /></div>}>
      <PartnerHotelContent />
    </Suspense>
  );
}