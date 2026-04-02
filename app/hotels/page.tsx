"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Search, MapPin, Star, Wifi, Coffee, ExternalLink, BedDouble, Menu, X, Sparkles, Users, Loader2 } from "lucide-react";

interface HotelResult {
  id: string;
  name: string;
  location: string;
  rating: number;
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

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => setUser(currentUser));
    return () => unsubscribe();
  }, []);

  // --- THE HYBRID AGGREGATOR FETCH FUNCTION ---
  const handleSearchHotels = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!destination || !checkIn || !checkOut) {
      alert("Missing info: Please fill in destination, check-in, and check-out.");
      return;
    }
    
    setIsSearching(true);
    setHasSearched(true);
    setHotels([]);

    // 1. FETCH INTERNAL WANDERHUB PARTNER ROOMS FIRST
    let internalRooms: HotelResult[] = [];
    try {
      console.log("🔍 Fetching internal WanderHub partner rooms...");
      const roomsSnapshot = await getDocs(collection(db, "rooms"));
      
      const searchDestinationLower = destination.toLowerCase();

      internalRooms = roomsSnapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as any))
        .filter(room => {
           if (!room.city) return false; 
           return searchDestinationLower.includes(room.city);
        })
        .map(roomData => {
          return {
            id: roomData.id,
            name: `${roomData.hotelName} - ${roomData.name}`,
            location: roomData.city ? roomData.city.charAt(0).toUpperCase() + roomData.city.slice(1) : destination, 
            rating: 5.0, 
            reviews: Math.floor(Math.random() * 40) + 10, 
            pricePerNight: roomData.price || 5000,
            imageUrl: roomData.imageUrl || "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=800&q=80",
            provider: "WanderHub Direct",
            bookingUrl: `/book/${roomData.id}`,
            isExclusive: true
          };
        });
      console.log(`✅ Found ${internalRooms.length} WanderHub Exclusive rooms in this city!`);
    } catch (err) {
      console.error("Internal fetch error:", err);
    }

    // 2. FETCH EXTERNAL BOOKING.COM API
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

      console.log(`🔍 Looking up ID for: ${destination}`);
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
      
      console.log("🔍 Fetching Booking.com hotels with valid ID...");
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
      
      // MERGE DATA: Put our exclusive partners at the very top!
      setHotels([...internalRooms, ...mappedHotels]);
      console.log("🎉 Success! Hybrid data rendered.");

    } catch (error: any) {
      console.error("🔴 EXTERNAL API ERROR CAUGHT:", error.message);
      
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      // Even if RapidAPI fails, we STILL show our internal partners alongside the mock data!
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
      console.log("🟢 Fallback mock data rendered alongside internal partners.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] font-sans text-slate-900 overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* MOBILE MENU BLUR */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">
              WanderHub
            </span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <Map className="h-5 w-5 mr-3" /> Dashboard
          </Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <Calendar className="h-5 w-5 mr-3" /> Itineraries
          </Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <CreditCard className="h-5 w-5 mr-3" /> Expenses
          </Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold shadow-sm transition-colors">
            <BedDouble className="h-5 w-5 mr-3" /> Book Hotels
          </Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <Settings className="h-5 w-5 mr-3" /> Settings
          </Link>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-30 sticky top-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* DESKTOP HEADER */}
        <header className="hidden md:flex h-20 bg-white/80 backdrop-blur-xl border-b border-slate-200 items-center px-10 z-20 shrink-0 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight">Hotel Search</h2>
            <p className="text-sm font-medium text-slate-500 mt-0.5">Find the perfect stay for your trip.</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto pb-24">
            
            {/* --- PRO HERO SEARCH WIDGET --- */}
            <div className="relative rounded-[2rem] p-8 md:p-12 mb-12 overflow-hidden shadow-xl border border-indigo-500/10">
              {/* Dynamic Backgrounds */}
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-900 via-blue-900 to-slate-900"></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=1200&q=80" alt="Luxury Hotel" className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay" />
              <div className="absolute top-[-50%] right-[-10%] w-[500px] h-[500px] bg-indigo-500/30 rounded-full blur-[80px]"></div>
              
              <div className="relative z-10">
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
                      <select value={guests} onChange={(e)=>setGuests(e.target.value)} className="w-full bg-transparent border-none outline-none text-white font-bold cursor-pointer text-base">
                        <option value="1" className="text-slate-900">1 Guest</option>
                        <option value="2" className="text-slate-900">2 Guests</option>
                        <option value="3" className="text-slate-900">3 Guests</option>
                        <option value="4" className="text-slate-900">4+ Guests</option>
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
               <div className="text-center py-16 md:py-24">
                 <div className="h-24 w-24 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-6 rotate-3">
                   <BedDouble className="h-10 w-10 text-indigo-300" />
                 </div>
                 <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Ready to book?</h3>
                 <p className="text-slate-500 font-medium mt-3 text-lg">Enter your destination to compare prices across the web.</p>
               </div>
            ) : isSearching ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                 {/* Pro Skeleton Loader */}
                 {[1,2,3,4,5,6,7,8].map(i => (
                   <div key={i} className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden flex flex-col animate-pulse">
                     <div className="h-56 bg-slate-200"></div>
                     <div className="p-5 flex-1 flex flex-col">
                       <div className="h-6 w-3/4 bg-slate-200 rounded-lg mb-3"></div>
                       <div className="h-4 w-1/2 bg-slate-200 rounded-lg mb-6"></div>
                       <div className="flex gap-2 mb-auto">
                         <div className="h-6 w-16 bg-slate-100 rounded-md"></div>
                         <div className="h-6 w-16 bg-slate-100 rounded-md"></div>
                       </div>
                       <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-end">
                         <div className="h-8 w-20 bg-slate-200 rounded-lg"></div>
                         <div className="h-10 w-24 bg-slate-200 rounded-xl"></div>
                       </div>
                     </div>
                   </div>
                 ))}
               </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end px-2 md:px-0 border-b border-slate-200 pb-4">
                  <div>
                    <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">Top deals for {destination}</h3>
                    <p className="text-sm font-medium text-slate-500 mt-1">Showing the best available rates for your dates.</p>
                  </div>
                  <span className="text-sm font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-xl mt-4 md:mt-0 inline-block w-max">
                    {hotels.length} properties found
                  </span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                  {hotels.map(hotel => (
                    <div key={hotel.id} className={`bg-white rounded-[2rem] border ${hotel.isExclusive ? 'border-purple-300 shadow-purple-100/50' : 'border-slate-200'} shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden flex flex-col group relative hover:-translate-y-2`}>
                      
                      {/* PREMIUM EXCLUSIVE BADGE */}
                      {hotel.isExclusive && (
                        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-md text-purple-700 px-3.5 py-1.5 rounded-xl text-[10px] font-black flex items-center shadow-lg z-10 uppercase tracking-widest border border-purple-200">
                          <Sparkles className="h-3 w-3 mr-1.5 text-purple-500" /> WanderHub Partner
                        </div>
                      )}

                      {/* Image Container with Zoom */}
                      <div className="h-56 bg-slate-200 relative overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-in-out" />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                        
                        <div className="absolute bottom-4 left-4 bg-white/90 backdrop-blur-md px-2.5 py-1.5 rounded-lg text-xs font-black text-slate-800 flex items-center shadow-sm border border-white/50">
                          <Star className="h-3.5 w-3.5 mr-1 text-amber-500 fill-amber-500" /> {hotel.rating} <span className="text-slate-400 font-medium ml-1">({hotel.reviews})</span>
                        </div>
                      </div>

                      {/* Content Container */}
                      <div className="p-5 md:p-6 flex-1 flex flex-col">
                        <h4 className="font-black text-xl text-slate-900 line-clamp-1 mb-1 tracking-tight" title={hotel.name}>{hotel.name}</h4>
                        <p className="text-sm font-medium text-slate-500 mb-4 flex items-center truncate"><MapPin className="h-3.5 w-3.5 mr-1.5 shrink-0 text-slate-400"/> {hotel.location}</p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="bg-slate-50 border border-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-md flex items-center"><Wifi className="h-3 w-3 mr-1.5 text-slate-400"/> WiFi</span>
                          <span className="bg-slate-50 border border-slate-100 text-slate-600 text-xs font-semibold px-2.5 py-1 rounded-md flex items-center"><Coffee className="h-3 w-3 mr-1.5 text-slate-400"/> Breakfast</span>
                        </div>

                        <div className="mt-auto pt-5 border-t border-slate-100 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-0.5">Price</p>
                            {/* FIX: Formatted price to strip decimals and added truncate to prevent pushing button */}
                            <p className="text-xl md:text-2xl font-black text-slate-900 tracking-tighter truncate" title={`₹${Math.round(hotel.pricePerNight).toLocaleString()}`}>
                              ₹{Math.round(hotel.pricePerNight).toLocaleString()}
                              <span className="text-xs md:text-sm font-medium text-slate-500 tracking-normal ml-1">/night</span>
                            </p>
                          </div>
                          
                          <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" className={`${hotel.isExclusive ? 'bg-gradient-to-br from-purple-600 to-indigo-600 text-white shadow-purple-500/30' : 'bg-slate-900 text-white shadow-slate-900/20'} px-4 py-2.5 rounded-xl text-xs md:text-sm font-black transition-all flex items-center justify-center shadow-lg hover:scale-105 shrink-0 whitespace-nowrap`}>
                            {hotel.isExclusive ? 'Book' : 'View'} <ExternalLink className="h-3 w-3 ml-1.5" />
                          </a>
                        </div>
                        <p className="text-[10px] font-semibold text-slate-400 text-right mt-3 flex items-center justify-end">
                          Provided by <span className="font-bold text-slate-600 ml-1">{hotel.provider}</span>
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