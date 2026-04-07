"use client";
import { useState, useEffect, Suspense, useMemo } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, where, getDocs, addDoc, doc, getDoc, orderBy, serverTimestamp, updateDoc, arrayUnion, arrayRemove, onSnapshot } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; 
import { useCurrency } from "../../lib/useCurrency"; 
import { MapPin, Star, Wifi, Coffee, BedDouble, Users, Calendar, ArrowLeft, CheckCircle2, Shield, Loader2, Sparkles, X, Tv, Wind, Smartphone, ChevronLeft, ChevronRight, Image as ImageIcon, MessageSquare, ThumbsUp, ThumbsDown, Map as MapIcon, ArrowDownUp } from "lucide-react";

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
  
  // ✨ NEW: SORTING STATE
  const [sortBy, setSortBy] = useState("recommended");

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
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

  const { symbol, convert } = useCurrency();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const qTrips = query(collection(db, "trips"), where("members", "array-contains", currentUser.uid));
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

  // ✨ NEW: FILTERING AND SORTING ENGINE
  const displayedRooms = useMemo(() => {
    // 1. Filter by Capacity
    let filtered = rooms.filter(room => {
      const roomCapacity = room.maxGuests || 2; // Default to 2 if not set in old DB entries
      return roomCapacity >= Number(guests);
    });

    // 2. Sort by Price
    if (sortBy === "price_asc") {
      filtered.sort((a, b) => a.price - b.price);
    } else if (sortBy === "price_desc") {
      filtered.sort((a, b) => b.price - a.price);
    }

    return filtered;
  }, [rooms, guests, sortBy]);

  const averageRating = reviews.length > 0 
    ? (reviews.reduce((acc, curr) => acc + curr.rating, 0) / reviews.length).toFixed(1) 
    : "New";

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
        theme: { color: "#4f46e5" },
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

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#030712]"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>;

  const hotelCity = rooms.length > 0 ? rooms[0].city : "Unknown Location";
  const heroImage = rooms.length > 0 ? (rooms[0].imageUrls?.[0] || rooms[0].imageUrl) : "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=1200&q=80";

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
          <div className="flex items-center gap-3 mb-4">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/20 text-white text-xs font-bold shadow-sm uppercase tracking-widest">
              <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Exclusive Partner
            </div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 text-slate-900 text-xs font-black shadow-lg">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" /> 
              {averageRating} <span className="font-medium text-slate-500 ml-1">({reviews.length} Reviews)</span>
            </div>
          </div>

          <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-lg mb-2">{decodedHotelName}</h1>
          <p className="text-white/80 font-bold flex items-center text-lg"><MapPin className="h-5 w-5 mr-2" /> {hotelCity}</p>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 md:px-8 -mt-8 relative z-30">
        
        {/* ROOMS GRID */}
        <div className="mb-16">
          <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
            <h2 className="text-2xl font-black text-slate-900 dark:text-white">Available Rooms</h2>
            
            {/* ✨ NEW: SORTING CONTROLS */}
            <div className="flex items-center gap-3">
              <div className="relative">
                <ArrowDownUp className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <select 
                  value={sortBy} 
                  onChange={(e) => setSortBy(e.target.value)}
                  className="pl-9 pr-8 py-2 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl text-sm font-bold text-slate-700 dark:text-slate-200 shadow-sm outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer appearance-none"
                >
                  <option value="recommended">Recommended</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>
          </div>

          {displayedRooms.length === 0 ? (
            <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] p-12 text-center border border-slate-200 dark:border-white/10">
              <BedDouble className="h-12 w-12 text-slate-300 mx-auto mb-4" />
              <p className="text-slate-900 dark:text-white font-black text-xl mb-2">No rooms available for {guests} guests.</p>
              <p className="text-slate-500 font-bold">Try adjusting your guest count or check back later.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displayedRooms.map(room => (
                <div key={room.id} className="bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm overflow-hidden flex flex-col hover:shadow-xl transition-all hover:-translate-y-1">
                  <div className="h-48 relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={room.imageUrls?.[0] || room.imageUrl || "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?w=800"} alt={room.name} className="w-full h-full object-cover" />
                    
                    <div className="absolute top-4 left-4 bg-white/90 dark:bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-lg text-xs font-black text-slate-800 dark:text-white flex items-center">
                      <Users className="h-3.5 w-3.5 mr-1.5 text-indigo-500" /> Up to {room.maxGuests || 2} Guests
                    </div>

                    {room.imageUrls && room.imageUrls.length > 1 && (
                      <div className="absolute bottom-4 right-4 bg-black/70 backdrop-blur-md text-white text-[10px] font-black px-2.5 py-1.5 rounded-lg flex items-center">
                        <ImageIcon className="h-3 w-3 mr-1" /> {room.imageUrls.length} Photos
                      </div>
                    )}
                  </div>
                  <div className="p-6 flex-1 flex flex-col">
                    <h3 className="font-black text-xl text-slate-900 dark:text-white mb-4">{room.name}</h3>
                    <div className="flex flex-wrap gap-2 mb-6">
                      <span className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center"><Wifi className="h-3 w-3 mr-1.5"/> Free WiFi</span>
                      <span className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center"><Tv className="h-3 w-3 mr-1.5"/> Smart TV</span>
                      <span className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2.5 py-1.5 rounded-md flex items-center"><Wind className="h-3 w-3 mr-1.5"/> AC</span>
                    </div>
                    
                    <div className="mt-auto pt-5 border-t border-slate-100 dark:border-white/5 flex flex-col gap-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Price</p>
                          <p className="text-2xl font-black text-slate-900 dark:text-white tracking-tighter truncate">
                            {symbol}{convert(room.price).toLocaleString(undefined, {maximumFractionDigits: 0})}
                            <span className="text-xs font-medium text-slate-500 tracking-normal ml-1">/night</span>
                          </p>
                        </div>
                        <button 
                          onClick={() => { 
                            if(!user) { alert("Please log in to book."); router.push('/'); return; }
                            setSelectedRoom(room); setPaymentStep("FORM"); 
                          }} 
                          className="bg-slate-900 dark:bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-black transition-all shadow-lg hover:scale-105 shrink-0"
                        >
                          Book Now
                        </button>
                      </div>

                      {room.imageUrls && room.imageUrls.length > 1 && (
                        <button 
                          onClick={() => { setViewingPhotosFor(room); setCurrentPhotoIndex(0); }}
                          className="w-full bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 py-3 rounded-xl text-sm font-bold transition-colors flex items-center justify-center border border-slate-200 dark:border-white/10"
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
        <div className="border-t border-slate-200 dark:border-white/10 pt-16">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
              Guest Reviews <span className="ml-3 bg-indigo-100 text-indigo-600 text-sm px-3 py-1 rounded-full">{reviews.length}</span>
            </h2>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
            {/* Left: Write a Review Form */}
            <div className="lg:col-span-1">
              <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] p-8 border border-slate-200 dark:border-white/10 shadow-sm sticky top-10">
                <div className="h-14 w-14 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mb-6">
                  <MessageSquare className="h-7 w-7" />
                </div>
                <h3 className="text-xl font-black text-slate-900 dark:text-white mb-2">Write a Review</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-6">Share your experience at {decodedHotelName} with other travelers.</p>

                {!user ? (
                  <div className="bg-slate-50 dark:bg-[#1e293b] p-6 rounded-2xl text-center border border-slate-100 dark:border-white/5">
                    <p className="text-sm font-bold text-slate-600 dark:text-slate-300 mb-4">You must be logged in to leave a review.</p>
                    <button onClick={() => router.push('/')} className="w-full bg-slate-900 dark:bg-white text-white dark:text-black font-black py-3 rounded-xl transition-all hover:scale-105">Sign In</button>
                  </div>
                ) : (
                  <form onSubmit={handleSubmitReview}>
                    <div className="mb-5">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Overall Rating</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewRating(star)}
                            className="focus:outline-none transition-transform hover:scale-110"
                          >
                            <Star className={`h-8 w-8 ${star <= newRating ? 'fill-amber-400 text-amber-400' : 'fill-slate-100 text-slate-200 dark:fill-slate-800 dark:text-slate-700'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="mb-6">
                      <label className="block text-xs font-black text-slate-400 uppercase tracking-widest mb-3">Your Comment</label>
                      <textarea 
                        value={newComment}
                        onChange={(e) => setNewComment(e.target.value)}
                        placeholder="How was the cleanliness, staff, and location?"
                        required
                        rows={4}
                        className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-2xl p-4 outline-none font-medium text-slate-700 dark:text-slate-200 resize-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 transition-all placeholder:text-slate-400"
                      />
                    </div>
                    
                    <button type="submit" disabled={isSubmittingReview || !newComment.trim()} className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-xl hover:bg-indigo-500 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 flex justify-center items-center">
                      {isSubmittingReview ? <Loader2 className="h-5 w-5 animate-spin" /> : "Post Public Review"}
                    </button>
                  </form>
                )}
              </div>
            </div>

            {/* Right: Public Review Feed */}
            <div className="lg:col-span-2">
              {reviews.length === 0 ? (
                <div className="text-center py-20 bg-slate-50 dark:bg-white/5 rounded-[2.5rem] border border-dashed border-slate-200 dark:border-white/10">
                  <Star className="h-12 w-12 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">No reviews yet</h4>
                  <p className="text-slate-500 dark:text-slate-400 font-medium">Be the first to share your thoughts about this hotel.</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {reviews.map((review) => {
                    const upvotes = review.upvotedBy?.length || 0;
                    const downvotes = review.downvotedBy?.length || 0;
                    const hasUpvoted = user && review.upvotedBy?.includes(user.uid);
                    const hasDownvoted = user && review.downvotedBy?.includes(user.uid);

                    return (
                      <div key={review.id} className="bg-white dark:bg-[#0f172a] p-6 md:p-8 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm flex flex-col">
                        <div className="flex justify-between items-start mb-4">
                          <div className="flex items-center gap-4">
                            <div className="h-12 w-12 bg-gradient-to-br from-indigo-500 to-purple-500 rounded-full flex items-center justify-center text-white font-black text-lg shadow-inner">
                              {review.userName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 dark:text-white">{review.userName}</p>
                              <p className="text-xs font-bold text-slate-400">
                                {review.createdAt?.toMillis ? new Date(review.createdAt.toMillis()).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : "Just now"}
                              </p>
                            </div>
                          </div>
                          <div className="flex gap-0.5 bg-amber-50 dark:bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-100 dark:border-amber-500/20">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`h-4 w-4 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'fill-transparent text-amber-200 dark:text-amber-900'}`} />
                            ))}
                          </div>
                        </div>
                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed font-medium pl-16 flex-1">{review.comment}</p>
                        
                        <div className="ml-16 mt-4 flex items-center gap-6 pt-4 border-t border-slate-100 dark:border-white/5">
                          <div className="flex items-center gap-4">
                            <button 
                              onClick={() => handleVote(review.id, 'upvote')}
                              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${hasUpvoted ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                              <ThumbsUp className={`h-4 w-4 ${hasUpvoted ? 'fill-current' : ''}`} />
                              {upvotes > 0 && upvotes}
                            </button>
                            <button 
                              onClick={() => handleVote(review.id, 'downvote')}
                              className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${hasDownvoted ? 'text-red-600 dark:text-red-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                            >
                              <ThumbsDown className={`h-4 w-4 ${hasDownvoted ? 'fill-current' : ''}`} />
                              {downvotes > 0 && downvotes}
                            </button>
                          </div>
                          
                          <button 
                            onClick={() => setReplyingTo(replyingTo === review.id ? null : review.id)}
                            className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${replyingTo === review.id ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}
                          >
                            <MessageSquare className="h-4 w-4" /> Reply
                          </button>
                        </div>

                        {replyingTo === review.id && (
                          <div className="ml-16 mt-4 animate-in fade-in slide-in-from-top-2 duration-200">
                            <form onSubmit={(e) => handleSubmitReply(e, review.id)} className="flex gap-3">
                              <input 
                                type="text" 
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="Write a reply..."
                                className="flex-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 transition-all dark:text-white font-medium"
                                required
                              />
                              <button type="submit" disabled={isSubmittingReply} className="bg-slate-900 dark:bg-indigo-600 text-white px-5 py-3 rounded-xl text-sm font-bold hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors disabled:opacity-50 flex items-center justify-center">
                                {isSubmittingReply ? <Loader2 className="h-4 w-4 animate-spin" /> : "Post"}
                              </button>
                            </form>
                          </div>
                        )}

                        {review.replies && review.replies.length > 0 && (
                          <div className="ml-16 mt-5 space-y-3">
                            {review.replies.map(reply => (
                              <div key={reply.id} className="bg-slate-50 dark:bg-white/5 p-4 rounded-2xl border border-slate-100 dark:border-white/5">
                                <div className="flex items-center justify-between mb-1.5">
                                  <div className="flex items-center gap-2.5">
                                    <div className="h-6 w-6 bg-gradient-to-br from-indigo-100 to-purple-100 dark:from-indigo-500/20 dark:to-purple-500/20 rounded-md flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-black text-[10px] border border-indigo-200/50 dark:border-indigo-500/30">
                                      {reply.userName.charAt(0).toUpperCase()}
                                    </div>
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">{reply.userName}</p>
                                  </div>
                                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                                    {new Date(reply.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                                  </span>
                                </div>
                                <p className="text-sm text-slate-600 dark:text-slate-300 font-medium pl-[34px] leading-relaxed">{reply.text}</p>
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

      {/* FULLSCREEN PHOTO SLIDER MODAL */}
      {viewingPhotosFor && viewingPhotosFor.imageUrls && (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-[100] animate-in fade-in duration-300">
          <div className="absolute top-0 w-full p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/80 to-transparent">
            <div className="text-white">
              <h3 className="font-black text-xl">{viewingPhotosFor.name}</h3>
              <p className="text-white/60 text-sm font-medium">{currentPhotoIndex + 1} / {viewingPhotosFor.imageUrls.length}</p>
            </div>
            <button onClick={() => setViewingPhotosFor(null)} className="text-white/70 hover:text-white bg-white/10 hover:bg-white/20 p-3 rounded-full transition-colors backdrop-blur-md">
              <X className="h-6 w-6" />
            </button>
          </div>

          <div className="relative w-full max-w-5xl px-4 md:px-12 flex items-center justify-center flex-1">
            <button onClick={handlePrevPhoto} className="absolute left-4 md:left-8 bg-white/10 hover:bg-white/20 text-white p-3 md:p-4 rounded-full backdrop-blur-md transition-transform hover:scale-110 z-10">
              <ChevronLeft className="h-8 w-8" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={viewingPhotosFor.imageUrls[currentPhotoIndex]} alt={`Photo ${currentPhotoIndex + 1}`} className="max-h-[75vh] w-auto object-contain rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200" />
            <button onClick={handleNextPhoto} className="absolute right-4 md:right-8 bg-white/10 hover:bg-white/20 text-white p-3 md:p-4 rounded-full backdrop-blur-md transition-transform hover:scale-110 z-10">
              <ChevronRight className="h-8 w-8" />
            </button>
          </div>

          <div className="h-24 w-full bg-black/50 p-4 flex justify-center gap-2 overflow-x-auto hide-scrollbar border-t border-white/10">
            {viewingPhotosFor.imageUrls.map((url, idx) => (
              <button key={idx} onClick={() => setCurrentPhotoIndex(idx)} className={`h-full w-20 shrink-0 rounded-lg overflow-hidden transition-all border-2 ${currentPhotoIndex === idx ? 'border-indigo-500 opacity-100 scale-105' : 'border-transparent opacity-40 hover:opacity-70'}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={url} alt="Thumbnail" className="h-full w-full object-cover" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* SECURE RAZORPAY BOOKING MODAL */}
      {selectedRoom && (
        <div className="fixed inset-0 bg-slate-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 md:p-10 w-full max-w-lg shadow-2xl relative border border-transparent dark:border-white/10 animate-in zoom-in-95 duration-300">
            
            {bookingSuccess ? (
              <div className="text-center py-10">
                <div className="h-20 w-20 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-6">
                  <CheckCircle2 className="h-10 w-10" />
                </div>
                <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-3">Booking Secured!</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Your payment is successful and your room is locked. Adding to itinerary...</p>
              </div>
            ) : paymentStep === "PROCESSING" ? (
              <div className="text-center py-10">
                <Loader2 className="h-12 w-12 text-indigo-600 animate-spin mx-auto mb-6" />
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Finalizing Details...</h2>
                <p className="text-slate-500 dark:text-slate-400 font-medium">Verifying payment with bank and confirming your room block.</p>
              </div>
            ) : (
              <>
                <button onClick={() => setSelectedRoom(null)} className="absolute top-6 right-6 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 p-2 rounded-full transition-colors"><X className="h-5 w-5" /></button>
                
                <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-2">Checkout</h2>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400 mb-6 flex items-center"><Shield className="h-4 w-4 mr-1.5"/> Secured by Razorpay</p>
                
                <div className="bg-slate-50 dark:bg-[#1e293b] p-5 rounded-2xl border border-slate-200 dark:border-white/10 mb-6 flex items-center gap-4">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={selectedRoom.imageUrls?.[0] || selectedRoom.imageUrl} alt="Room" className="h-16 w-16 rounded-xl object-cover" />
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

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-2">Guests</label>
                      <select value={guests} onChange={(e)=>setGuests(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-xl p-3 outline-none font-bold text-slate-900 dark:text-white cursor-pointer appearance-none">
                        <option value="1">1 Guest</option><option value="2">2 Guests</option><option value="3">3 Guests</option><option value="4">4 Guests</option>
                      </select>
                    </div>
                    {/* ✨ PHASE 4 ITINERARY DROPDOWN ✨ */}
                    <div>
                      <label className="block text-[10px] font-black text-indigo-500 dark:text-indigo-400 uppercase tracking-widest mb-2">Attach to Itinerary</label>
                      <div className="relative">
                        <MapIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                        <select 
                          value={selectedTripId} 
                          onChange={(e) => setSelectedTripId(e.target.value)}
                          className="w-full bg-indigo-50 dark:bg-[#1e293b] border border-indigo-100 dark:border-indigo-500/20 rounded-xl pl-9 pr-3 py-3 outline-none font-bold text-slate-900 dark:text-white cursor-pointer appearance-none"
                        >
                          {trips.length === 0 ? <option value="">No Trips Found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-100 dark:bg-white/5 rounded-xl p-5 mt-4 flex justify-between items-center border border-slate-200 dark:border-white/5 shadow-inner">
                    <div>
                      <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest">Total Price</p>
                      <p className="text-xs font-medium text-slate-400 mt-1">{nights} night{nights > 1 ? 's' : ''}</p>
                    </div>
                    <p className="text-3xl font-black text-slate-900 dark:text-white">
                      {symbol}{(convert(selectedRoom.price) * nights).toLocaleString(undefined, {maximumFractionDigits: 0})}
                    </p>
                  </div>

                  <button type="submit" disabled={isBookingLoading} className="w-full bg-slate-900 dark:bg-indigo-600 text-white py-4 rounded-xl font-black text-lg hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all shadow-xl disabled:opacity-70 flex justify-center items-center mt-4">
                    {isBookingLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Pay with Razorpay"}
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
    <Suspense fallback={<div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#030712]"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>}>
      <PartnerHotelContent />
    </Suspense>
  );
}