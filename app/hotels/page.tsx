"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, getDocs } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Search, MapPin, Star, Wifi, Coffee, ExternalLink, BedDouble, Menu, X, Sparkles } from "lucide-react";

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
  isExclusive?: boolean; // NEW: Flag to identify our internal partner hotels!
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
        // THE MAGIC FILTER: Only keep rooms if the user's search string includes the room's city!
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
            imageUrl: "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=800&q=80",
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
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
              WanderHub
            </span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg bg-slate-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium shadow-sm transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        <div className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <Menu className="h-6 w-6" />
          </button>
        </div>

        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center px-8 z-10 shrink-0">
          <h2 className="text-xl font-semibold text-slate-800">Hotel Search</h2>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <div className="max-w-6xl mx-auto space-y-8">
            
            <div className="bg-indigo-600 rounded-3xl p-6 md:p-8 shadow-lg text-white relative overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-white opacity-5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
              
              <h1 className="text-2xl md:text-3xl font-bold mb-2 relative z-10">Find your perfect stay.</h1>
              <p className="text-indigo-200 mb-6 md:mb-8 text-sm md:text-base relative z-10">Compare prices from 100+ sites instantly.</p>

              <form onSubmit={handleSearchHotels} className="bg-white p-2 rounded-2xl shadow-xl flex flex-col md:flex-row gap-2 relative z-10">
                
                <div className="flex-1 flex items-center px-4 py-2 border-b md:border-b-0 md:border-r border-slate-200">
                  <MapPin className="h-5 w-5 text-slate-400 mr-3 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Where to?</label>
                    <input type="text" value={destination} onChange={(e)=>setDestination(e.target.value)} className="w-full bg-transparent border-none outline-none text-slate-900 font-semibold placeholder-slate-300 truncate" placeholder="e.g. Paris, Goa..." required />
                  </div>
                </div>

                <div className="flex-1 flex items-center px-4 py-2 border-b md:border-b-0 md:border-r border-slate-200 gap-4">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Check-In</label>
                    <input type="date" value={checkIn} onChange={(e)=>setCheckIn(e.target.value)} className="w-full bg-transparent border-none outline-none text-slate-900 font-semibold cursor-pointer" required />
                  </div>
                  <div className="w-px h-8 bg-slate-200"></div>
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Check-Out</label>
                    <input type="date" value={checkOut} onChange={(e)=>setCheckOut(e.target.value)} className="w-full bg-transparent border-none outline-none text-slate-900 font-semibold cursor-pointer" required />
                  </div>
                </div>

                <div className="flex-1 flex items-center px-4 py-2">
                  <div className="flex-1">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">Guests</label>
                    <select value={guests} onChange={(e)=>setGuests(e.target.value)} className="w-full bg-transparent border-none outline-none text-slate-900 font-semibold cursor-pointer">
                      <option value="1">1 Guest</option>
                      <option value="2">2 Guests</option>
                      <option value="3">3 Guests</option>
                      <option value="4">4+ Guests</option>
                    </select>
                  </div>
                  <button type="submit" disabled={isSearching} className="ml-4 bg-indigo-600 hover:bg-indigo-700 text-white p-3 md:p-4 rounded-xl shadow-md transition-all disabled:opacity-70 shrink-0">
                    <Search className={`h-5 w-5 ${isSearching ? 'animate-ping' : ''}`} />
                  </button>
                </div>
              </form>
            </div>

            {!hasSearched ? (
               <div className="text-center py-20 opacity-50">
                 <BedDouble className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                 <h3 className="text-xl font-bold text-slate-400">Search to see deals</h3>
               </div>
            ) : isSearching ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                 {[1,2,3,4].map(i => (
                   <div key={i} className="bg-white h-72 rounded-2xl animate-pulse border border-slate-100 shadow-sm p-4 flex flex-col justify-end">
                     <div className="w-2/3 h-4 bg-slate-200 rounded mb-2"></div>
                     <div className="w-1/3 h-4 bg-slate-200 rounded"></div>
                   </div>
                 ))}
               </div>
            ) : (
              <div className="space-y-6">
                <div className="flex justify-between items-end px-2 md:px-0">
                  <h3 className="text-lg md:text-xl font-bold text-slate-900">Top deals for {destination}</h3>
                  <span className="text-xs md:text-sm font-medium text-slate-500">{hotels.length} properties found</span>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  {hotels.map(hotel => (
                    <div key={hotel.id} className={`bg-white rounded-2xl border ${hotel.isExclusive ? 'border-purple-300 shadow-purple-100' : 'border-slate-200'} shadow-sm hover:shadow-xl transition-all overflow-hidden flex flex-col group relative`}>
                      
                      {/* EXCLUSIVE BADGE */}
                      {hotel.isExclusive && (
                        <div className="absolute top-3 right-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 py-1.5 rounded-full text-[10px] font-black flex items-center shadow-lg z-10 uppercase tracking-wider border border-purple-400/50 backdrop-blur-md">
                          <Sparkles className="h-3 w-3 mr-1.5" /> Partner
                        </div>
                      )}

                      <div className="h-48 bg-slate-200 relative overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                        <div className="absolute top-3 left-3 bg-white/90 backdrop-blur-sm px-2 py-1 rounded-md text-xs font-bold text-slate-800 flex items-center shadow-sm">
                          <Star className="h-3 w-3 mr-1 text-amber-500 fill-amber-500" /> {hotel.rating}
                        </div>
                      </div>

                      <div className="p-4 md:p-5 flex-1 flex flex-col">
                        <h4 className="font-bold text-lg text-slate-900 line-clamp-1">{hotel.name}</h4>
                        <p className="text-xs text-slate-500 mb-3 flex items-center"><MapPin className="h-3 w-3 mr-1 shrink-0"/> <span className="truncate">{hotel.location}</span></p>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md flex items-center"><Wifi className="h-3 w-3 mr-1"/> Free WiFi</span>
                          <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-md flex items-center"><Coffee className="h-3 w-3 mr-1"/> Breakfast</span>
                        </div>

                        <div className="mt-auto pt-4 border-t border-slate-100 flex items-end justify-between">
                          <div>
                            <p className="text-[10px] md:text-xs text-slate-400 font-medium mb-0.5">Price per night</p>
                            <p className="text-lg md:text-xl font-black text-slate-900">₹{hotel.pricePerNight.toLocaleString()}</p>
                          </div>
                          <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" className={`${hotel.isExclusive ? 'bg-purple-50 text-purple-700 hover:bg-purple-600 border-purple-200 hover:border-purple-600' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-600 border-emerald-200 hover:border-emerald-600'} hover:text-white px-3 md:px-4 py-2 rounded-xl text-xs md:text-sm font-bold transition-colors flex items-center border shrink-0`}>
                            {hotel.isExclusive ? 'Book Direct' : 'View Deal'} <ExternalLink className="h-3 w-3 ml-1.5" />
                          </a>
                        </div>
                        <p className="text-[10px] text-slate-400 text-right mt-2">Lowest price on {hotel.provider}</p>
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