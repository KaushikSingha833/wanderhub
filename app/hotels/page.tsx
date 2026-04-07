"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { useCurrency } from "../lib/useCurrency"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Search, MapPin, Star, Wifi, Coffee, ExternalLink, BedDouble, Menu, X, Sparkles, Users, Loader2, Plane, ArrowDownUp } from "lucide-react";

interface HotelResult {
  id: string;
  name: string;
  location: string;
  rating: number | string; // Changed to allow "New"
  reviews: number;
  pricePerNight: number;
  imageUrl: string;
  provider: string;
  bookingUrl: string;
  isExclusive?: boolean; 
}

export default function HotelsPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  
  // Search Form State
  const [destination, setDestination] = useState("Mumbai, India");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");

  // Results State
  const [isSearching, setIsSearching] = useState(false);
  const [hotels, setHotels] = useState<HotelResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // ✨ NEW: SORTING STATE
  const [sortBy, setSortBy] = useState("recommended");

  const { symbol, convert } = useCurrency();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  const handleSearchHotels = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!destination || !checkIn || !checkOut) {
      alert("Missing info: Please fill in destination, check-in, and check-out.");
      return;
    }
    
    setIsSearching(true);
    setHasSearched(true);
    setHotels([]);

    let internalRooms: HotelResult[] = [];
    try {
      console.log("🔍 Fetching internal WanderHub partner rooms...");
      
      // ✨ NEW: FETCH REAL RATINGS FIRST
      const reviewsSnapshot = await getDocs(collection(db, "hotelReviews"));
      const hotelRatings: Record<string, { total: number; count: number }> = {};
      
      reviewsSnapshot.docs.forEach(doc => {
        const rev = doc.data() as any;
        if (rev.hotelName && rev.rating) {
          if (!hotelRatings[rev.hotelName]) hotelRatings[rev.hotelName] = { total: 0, count: 0 };
          hotelRatings[rev.hotelName].total += rev.rating;
          hotelRatings[rev.hotelName].count += 1;
        }
      });

      const roomsSnapshot = await getDocs(collection(db, "rooms"));
      const searchDestinationLower = destination.toLowerCase();

      const hotelGroups: Record<string, HotelResult> = {};

      roomsSnapshot.docs.forEach(doc => {
        const roomData = doc.data() as any;
        if (!roomData.city || !searchDestinationLower.includes(roomData.city.toLowerCase())) return;

        const hotelName = roomData.hotelName || "WanderHub Partner Hotel";

        // ✨ NEW: CALCULATE REAL RATING FOR THIS SPECIFIC HOTEL
        const stats = hotelRatings[hotelName];
        const realRating = stats ? Number((stats.total / stats.count).toFixed(1)) : 5.0; // Default to 5.0 if no reviews yet
        const realReviewsCount = stats ? stats.count : 0;

        if (!hotelGroups[hotelName]) {
          hotelGroups[hotelName] = {
            id: roomData.ownerId || doc.id, 
            name: hotelName,
            location: roomData.city ? roomData.city.charAt(0).toUpperCase() + roomData.city.slice(1) : destination, 
            rating: realRating, // <-- Real Rating injected
            reviews: realReviewsCount, // <-- Real Review count injected
            pricePerNight: roomData.price || 5000,
            imageUrl: roomData.imageUrl || "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=800&q=80",
            provider: "WanderHub Direct",
            bookingUrl: `/partner-hotel/${encodeURIComponent(hotelName)}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`,
            isExclusive: true
          };
        } else {
          if (roomData.price && roomData.price < hotelGroups[hotelName].pricePerNight) {
            hotelGroups[hotelName].pricePerNight = roomData.price;
          }
        }
      });

      internalRooms = Object.values(hotelGroups);
      console.log(`✅ Found ${internalRooms.length} WanderHub Exclusive Hotels!`);
    } catch (err) {
      console.error("Internal fetch error:", err);
    }

    try {
      const apiKey = process.env.NEXT_PUBLIC_HOTEL_API_KEY;
      
      if (!apiKey || apiKey === "mock") {
        throw new Error("No valid API Key found in .env");
      }

      const headers = {
        'X-RapidAPI-Key': apiKey,
        'X-RapidAPI-Host': 'booking-com.p.rapidapi.com'
      };

      const cleanGuestCount = guests.replace(/\D/g, '') || "2";

      const locationRes = await fetch(`https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(destination)}&locale=en-gb`, { 
        method: 'GET', 
        headers 
      });

      if (!locationRes.ok) throw new Error(`Location API Error: ${locationRes.status}`);
      const locationData = await locationRes.json();
      
      if (!locationData || locationData.length === 0) {
        throw new Error("Could not find that destination on Booking.com");
      }

      const destId = locationData[0].dest_id;
      const destType = locationData[0].dest_type;
      
      const searchUrl = `https://booking-com.p.rapidapi.com/v1/hotels/search?dest_id=${destId}&dest_type=${destType}&checkin_date=${checkIn}&checkout_date=${checkOut}&adults_number=${cleanGuestCount}&room_number=1&order_by=popularity&units=metric&locale=en-gb&filter_by_currency=INR`;

      const searchRes = await fetch(searchUrl, { method: 'GET', headers });

      if (!searchRes.ok) throw new Error(`Search API Error: ${searchRes.status}`);
      const searchData = await searchRes.json();
      
      if (!searchData || !searchData.result || searchData.result.length === 0) {
        throw new Error("Search succeeded, but 0 hotels were available for these dates."); 
      }
      
      const mappedHotels = searchData.result.map((h: any) => ({
        id: h.hotel_id?.toString() || Math.random().toString(),
        name: h.hotel_name || "Unknown Hotel",
        location: h.city_trans || destination,
        rating: h.review_score || 4.0,
        reviews: h.review_nr || 0,
        pricePerNight: h.min_total_price || 5000,
        imageUrl: h.max_photo_url || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
        provider: "Booking.com",
        bookingUrl: h.url || "#"
      }));
      
      setHotels([...internalRooms, ...mappedHotels]);

    } catch (error: any) {
      console.error("🔴 EXTERNAL API ERROR CAUGHT:", error.message);
      
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      setHotels([
        ...internalRooms,
        {
          id: "1", name: "Taj Mahal Palace", location: "Colaba, Mumbai", rating: 4.9, reviews: 12450, pricePerNight: 18500,
          imageUrl: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80", provider: "Agoda", bookingUrl: "https://agoda.com"
        },
        {
          id: "2", name: "The Oberoi", location: "Nariman Point, Mumbai", rating: 4.8, reviews: 8920, pricePerNight: 15200,
          imageUrl: "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=800&q=80", provider: "MakeMyTrip", bookingUrl: "https://makemytrip.com"
        },
        {
          id: "3", name: "Trident Bandra Kurla", location: "BKC, Mumbai", rating: 4.6, reviews: 5430, pricePerNight: 9800,
          imageUrl: "https://images.unsplash.com/photo-1551882547-ff40c0d1398c?w=800&q=80", provider: "Booking.com", bookingUrl: "https://booking.com"
        },
        {
          id: "4", name: "Novotel Mumbai Juhu Beach", location: "Juhu, Mumbai", rating: 4.4, reviews: 6100, pricePerNight: 8500,
          imageUrl: "https://images.unsplash.com/photo-1520250497591-112f2f40a3f4?w=800&q=80", provider: "Expedia", bookingUrl: "https://expedia.com"
        }
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  // ✨ NEW: SORTING ENGINE
  // This smoothly sorts the results right before they are drawn on the screen!
  const displayedHotels = [...hotels].sort((a, b) => {
    if (sortBy === "price_asc") return a.pricePerNight - b.pricePerNight;
    if (sortBy === "price_desc") return b.pricePerNight - a.pricePerNight;
    return 0; // "recommended" keeps the original order (Exclusive Partners first!)
  });

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#030712] font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* MOBILE MENU BLUR */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
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
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors">
            <Map className="h-5 w-5 mr-3" /> Dashboard
          </Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors">
            <Calendar className="h-5 w-5 mr-3" /> Itineraries
          </Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors">
            <CreditCard className="h-5 w-5 mr-3" /> Expenses
          </Link>
          <Link href="/flights" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold"><Plane className="h-5 w-5 mr-3" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold shadow-sm transition-colors border border-transparent dark:border-indigo-500/20">
            <BedDouble className="h-5 w-5 mr-3" /> Book Hotels
          </Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors">
            <Settings className="h-5 w-5 mr-3" /> Settings
          </Link>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-500"></div>

        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-16 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">WanderHub</span>
          </div>
          
          <div className="flex items-center gap-2">
            <Link href="/my-bookings" className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
              <Calendar className="h-6 w-6 text-indigo-500" />
            </Link>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors">
              <Menu className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* DESKTOP HEADER */}
        <header className="hidden md:flex h-20 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 items-center justify-between px-10 z-20 shrink-0 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Hotel Search</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Find the perfect stay for your trip.</p>
          </div>
          
          <Link href="/my-bookings" className="flex items-center bg-white dark:bg-white/5 border border-slate-200 dark:border-white/10 hover:border-indigo-300 dark:hover:border-indigo-500/50 hover:shadow-md transition-all px-5 py-2.5 rounded-xl font-bold text-slate-700 dark:text-slate-200 text-sm group">
            <Calendar className="h-4 w-4 mr-2 text-indigo-500 group-hover:scale-110 transition-transform" />
            My Bookings
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar relative z-10">
          <div className="max-w-6xl mx-auto pb-24">
            
            {/* --- PRO HERO SEARCH WIDGET --- */}
            <div className="relative rounded-[2rem] p-8 md:p-12 mb-12 overflow-hidden shadow-xl border border-indigo-500/10 dark:border-white/5">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900 dark:from-indigo-950 dark:via-[#0f172a] dark:to-purple-950"></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=1200&q=80" alt="Luxury Hotel" className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay" />
              <div className="absolute top-[-50%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/30 rounded-full blur-[80px]"></div>
              
              <div className="relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold mb-6 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" /> Best Price Guarantee
                </div>
                
                <h1 className="text-3xl md:text-5xl font-black text-white mb-3 tracking-tight drop-shadow-md">Where are you heading?</h1>
                <p className="text-sky-100 mb-10 text-base md:text-lg font-medium max-w-2xl">Compare millions of properties globally, including exclusive WanderHub Partners.</p>

                <form onSubmit={handleSearchHotels} className="bg-white/10 backdrop-blur-xl p-2 rounded-[1.5rem] shadow-2xl flex flex-col md:flex-row gap-2 border border-white/20">
                  
                  {/* Destination */}
                  <div className="flex-1 flex items-center px-5 py-3 md:py-4 border-b md:border-b-0 md:border-r border-white/20 bg-white/5 rounded-xl md:rounded-none md:rounded-l-xl hover:bg-white/10 transition-colors group">
                    <MapPin className="h-5 w-5 text-indigo-300 mr-3 shrink-0 group-hover:scale-110 transition-transform" />
                    <div className="flex-1 min-w-0">
                      <label className="block text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-0.5">Destination</label>
                      <input type="text" value={destination} onChange={(e)=>setDestination(e.target.value)} className="w-full bg-transparent border-none outline-none text-white font-bold placeholder-white/40 truncate text-lg" placeholder="City or Hotel Name" required />
                    </div>
                  </div>

                  {/* Dates */}
                  <div className="flex-1 flex items-center px-5 py-3 md:py-4 border-b md:border-b-0 md:border-r border-white/20 bg-white/5 rounded-xl md:rounded-none hover:bg-white/10 transition-colors gap-4 group">
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-0.5">Check-In</label>
                      <input type="date" value={checkIn} onChange={(e)=>setCheckIn(e.target.value)} className="w-full bg-transparent border-none outline-none text-white font-bold cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert text-sm" required />
                    </div>
                    <div className="w-px h-8 bg-white/20"></div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-0.5">Check-Out</label>
                      <input type="date" value={checkOut} onChange={(e)=>setCheckOut(e.target.value)} className="w-full bg-transparent border-none outline-none text-white font-bold cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert text-sm" required />
                    </div>
                  </div>

                  {/* Guests & Button */}
                  <div className="flex-1 flex items-center px-3 py-3 md:py-2 bg-white/5 rounded-xl md:rounded-none md:rounded-r-xl hover:bg-white/10 transition-colors group">
                    <div className="flex-1 px-2">
                      <label className="block text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-0.5 flex items-center"><Users className="h-3 w-3 mr-1"/> Guests</label>
                      <select value={guests} onChange={(e)=>setGuests(e.target.value)} className="w-full bg-transparent border-none outline-none text-white font-bold cursor-pointer text-base appearance-none">
                        <option value="1" className="text-slate-900 dark:text-white dark:bg-[#0f172a]">1 Guest</option>
                        <option value="2" className="text-slate-900 dark:text-white dark:bg-[#0f172a]">2 Guests</option>
                        <option value="3" className="text-slate-900 dark:text-white dark:bg-[#0f172a]">3 Guests</option>
                        <option value="4" className="text-slate-900 dark:text-white dark:bg-[#0f172a]">4+ Guests</option>
                      </select>
                    </div>
                    <button type="submit" disabled={isSearching} className="ml-2 bg-indigo-500 hover:bg-indigo-400 text-white px-6 md:px-8 py-3.5 md:py-4 rounded-xl shadow-lg shadow-indigo-500/30 transition-all disabled:opacity-70 shrink-0 font-black flex items-center justify-center group-hover:scale-[1.02]">
                      {isSearching ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Search className="h-5 w-5 mr-2" /> Search</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* RESULTS AREA */}
            {!hasSearched ? (
               <div className="text-center py-16 md:py-24 animate-in zoom-in-95 duration-500">
                 <div className="h-24 w-24 bg-white dark:bg-[#0f172a] rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/10 flex items-center justify-center mx-auto mb-6 rotate-3">
                   <BedDouble className="h-10 w-10 text-indigo-400" />
                 </div>
                 <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Ready to book?</h3>
                 <p className="text-slate-500 dark:text-slate-400 font-medium mt-3 text-lg">Enter your destination to compare prices across the web.</p>
               </div>
            ) : isSearching ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                 {[1,2,3,4,5,6,7,8].map(i => (
                   <div key={i} className="bg-white dark:bg-[#0f172a] rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden flex flex-col animate-pulse">
                     <div className="h-56 bg-slate-200 dark:bg-slate-800"></div>
                     <div className="p-5 flex-1 flex flex-col">
                       <div className="h-6 w-3/4 bg-slate-200 dark:bg-slate-800 rounded-lg mb-3"></div>
                       <div className="h-4 w-1/2 bg-slate-200 dark:bg-slate-800 rounded-lg mb-6"></div>
                       <div className="flex gap-2 mb-auto">
                         <div className="h-6 w-16 bg-slate-100 dark:bg-slate-800 rounded-md"></div>
                         <div className="h-6 w-16 bg-slate-100 dark:bg-slate-800 rounded-md"></div>
                       </div>
                       <div className="mt-6 pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-end">
                         <div className="h-8 w-20 bg-slate-200 dark:bg-slate-800 rounded-lg"></div>
                         <div className="h-10 w-24 bg-slate-200 dark:bg-slate-800 rounded-xl"></div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                {/* ✨ UPDATED HEADER WITH SORT DROPDOWN ✨ */}
                <div className="flex flex-col md:flex-row md:justify-between md:items-end px-2 md:px-0 border-b border-slate-200 dark:border-white/10 pb-4 gap-4">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Top deals for {destination}</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Showing the best available rates for your dates.</p>
                  </div>
                  
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
                    <span className="text-sm font-bold text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border border-transparent dark:border-indigo-500/20 px-4 py-2 rounded-xl w-max">
                      {displayedHotels.length} properties found
                    </span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                  {/* ✨ WE NOW MAP OVER THE SORTED displayedHotels INSTEAD OF hotels ✨ */}
                  {displayedHotels.map(hotel => (
                    <div key={hotel.id} className={`bg-white dark:bg-[#0f172a] rounded-[2rem] border ${hotel.isExclusive ? 'border-purple-300 shadow-purple-100/50 dark:border-purple-500/30 dark:shadow-purple-900/30' : 'border-slate-200 dark:border-white/10'} shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col group relative hover:-translate-y-2`}>
                      
                      {hotel.isExclusive && (
                        <div className="absolute top-4 right-4 bg-white/90 dark:bg-black/80 backdrop-blur-md text-purple-700 dark:text-purple-400 px-3.5 py-1.5 rounded-xl text-[10px] font-black flex items-center shadow-lg z-10 uppercase tracking-widest border border-purple-200 dark:border-purple-500/30">
                          <Sparkles className="h-3 w-3 mr-1.5 text-purple-500 dark:text-purple-400" /> WanderHub Partner
                        </div>
                      )}

                      <div className="h-56 bg-slate-200 dark:bg-slate-800 relative overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        <div className="absolute bottom-4 left-4 bg-white/90 dark:bg-black/80 backdrop-blur-md px-2.5 py-1.5 rounded-lg text-xs font-black text-slate-800 dark:text-white flex items-center shadow-sm border border-white/50 dark:border-white/10">
                          <Star className="h-3.5 w-3.5 mr-1 text-amber-500 fill-amber-500" /> {hotel.rating} <span className="text-slate-400 font-medium ml-1">({hotel.reviews})</span>
                        </div>
                      </div>

                      <div className="p-5 md:p-6 flex-1 flex flex-col">
                        <h4 className="font-black text-xl text-slate-900 dark:text-white line-clamp-1 mb-1 tracking-tight" title={hotel.name}>{hotel.name}</h4>
                        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 flex items-center truncate"><MapPin className="h-3.5 w-3.5 mr-1.5 shrink-0 text-slate-400"/> {hotel.location}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-md flex items-center"><Wifi className="h-3 w-3 mr-1.5 text-slate-400"/> WiFi</span>
                          <span className="bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 text-slate-600 dark:text-slate-300 text-xs font-semibold px-2.5 py-1 rounded-md flex items-center"><Coffee className="h-3 w-3 mr-1.5 text-slate-400"/> Breakfast</span>
                        </div>

                        <div className="mt-auto pt-5 border-t border-slate-100 dark:border-white/5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Starting from</p>
                            
                            <p className="text-xl md:text-2xl font-black text-slate-900 dark:text-white tracking-tighter truncate" title={`${symbol}${convert(hotel.pricePerNight).toLocaleString()}`}>
                              {symbol}{convert(hotel.pricePerNight).toLocaleString(undefined, {maximumFractionDigits: 0})}
                              <span className="text-xs md:text-sm font-medium text-slate-500 tracking-normal ml-1">/night</span>
                            </p>

                          </div>
                          
                          <Link href={hotel.bookingUrl} target={hotel.isExclusive ? "_self" : "_blank"} rel="noopener noreferrer" className={`${hotel.isExclusive ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-purple-500/30' : 'bg-slate-900 dark:bg-indigo-600 text-white shadow-slate-900/20 dark:shadow-indigo-900/30'} px-4 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center shadow-lg hover:scale-105 shrink-0 whitespace-nowrap`}>
                            {hotel.isExclusive ? 'View Rooms' : 'View'} <ExternalLink className="h-3 w-3 ml-1.5" />
                          </Link>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400 text-right mt-3 flex items-center justify-end">
                          Provided by <span className="font-bold text-slate-600 dark:text-slate-300 ml-1">{hotel.provider}</span>
                        </p>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}