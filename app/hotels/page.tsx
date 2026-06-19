"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, getDocs, query, where, onSnapshot, addDoc, serverTimestamp } from "firebase/firestore";
import { auth, db } from "../lib/firebase"; 
import { useCurrency } from "../lib/useCurrency"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Search, MapPin, Star, Wifi, Coffee, ExternalLink, BedDouble, Menu, X, Sparkles, Users, Loader2, Plane, ArrowDownUp, LocateFixed, CheckCircle2, MessageSquare, Info, ChevronDown, History } from "lucide-react";

// --- HAVERSINE DISTANCE FORMULA ---
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; 
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2); 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); 
  return R * c; 
}

interface HotelResult {
  id: string;
  name: string;
  location: string;
  rating: number | string; 
  reviews: number;
  pricePerNight: number;
  imageUrl: string;
  provider: string;
  bookingUrl: string;
  isExclusive?: boolean; 
  distance?: number; 
}

export default function HotelsPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  
  const [destination, setDestination] = useState("Mumbai, India");
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [guests, setGuests] = useState("2");

  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFetchingSuggestions, setIsFetchingSuggestions] = useState(false);

  const [userLocation, setUserLocation] = useState<{lat: number, lng: number} | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const [isSearching, setIsSearching] = useState(false);
  const [hotels, setHotels] = useState<HotelResult[]>([]);
  const [hasSearched, setHasSearched] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  const [sortBy, setSortBy] = useState("recommended");

  const { symbol, convert } = useCurrency();

  const [userTrips, setUserTrips] = useState<{id: string, title: string}[]>([]);
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [hotelToSuggest, setHotelToSuggest] = useState<HotelResult | null>(null);
  const [selectedTripId, setSelectedTripId] = useState("");
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [suggestSuccess, setSuggestSuccess] = useState(false);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(collection(db, "trips"), where("members", "array-contains", currentUser.uid),where("status", "==", "active"));
        onSnapshot(q, (snapshot) => {
          const tripsData = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
          setUserTrips(tripsData);
          if (tripsData.length > 0 && !selectedTripId) setSelectedTripId(tripsData[0].id);
        });
      }
    });
    return () => unsubscribeAuth();
  }, [selectedTripId]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (destination.trim().length < 3) {
        setSuggestions([]);
        return;
      }
      setIsFetchingSuggestions(true);
      try {
        const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(destination)}&limit=5&featuretype=settlement`);
        const data = await res.json();
        setSuggestions(data);
      } catch (error) {
        console.error("Error fetching suggestions:", error);
      } finally {
        setIsFetchingSuggestions(false);
      }
    };

    const timeoutId = setTimeout(() => {
      if (showSuggestions) fetchSuggestions();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [destination, showSuggestions]);

  const handleSuggestionClick = (suggestion: any) => {
    const parts = suggestion.display_name.split(", ");
    const cleanName = parts.length >= 3 ? `${parts[0]}, ${parts[parts.length - 1]}` : suggestion.display_name;
    setDestination(cleanName);
    setShowSuggestions(false);
  };

  const handleNearMeClick = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        setUserLocation({ lat, lng });

        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
          const data = await res.json();
          const city = data.address?.city || data.address?.town || data.address?.state || "Current Location";
          setDestination(city);
        } catch (error) {
          console.error("Geocoding failed", error);
          setDestination("Current Location");
        } finally {
          setIsLocating(false);
        }
      },
      (error) => {
        console.error(error);
        alert("Could not get your location. Please check your browser permissions.");
        setIsLocating(false);
      }
    );
  };

  const handleSearchHotels = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false); 
    
    if (!destination || !checkIn || !checkOut) {
      alert("Missing info: Please fill in destination, check-in, and check-out.");
      return;
    }
    
    setIsSearching(true);
    setHasSearched(true);
    setHotels([]);

    let internalRooms: HotelResult[] = [];
    try {
      // 1. ✨ "TRAIN BOOKING" LOGIC: Find Occupied Rooms
      const reqStart = new Date(checkIn).getTime();
      const reqEnd = new Date(checkOut).getTime();
      const requiredGuests = parseInt(guests.replace(/\D/g, '')) || 2;

      // Query all Approved/Confirmed bookings
      const qBookings = query(
        collection(db, "bookings"),
        where("status", "in", ["Approved", "Confirmed"])
      );
      const bookingsSnapshot = await getDocs(qBookings);
      
      const occupiedRoomIds = new Set<string>();
      
      bookingsSnapshot.docs.forEach(doc => {
        const b = doc.data();
        const bStart = new Date(b.checkIn).getTime();
        const bEnd = new Date(b.checkOut).getTime();
        
        // OVERLAP FORMULA: If (UserStart < BookingEnd) AND (UserEnd > BookingStart)
        if (reqStart < bEnd && reqEnd > bStart) {
          occupiedRoomIds.add(b.roomId); // This room is blocked for these dates
        }
      });

      // 2. Fetch Ratings & Locations
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

      const usersSnapshot = await getDocs(collection(db, "users"));
      const partnerLocations: Record<string, {lat: number, lng: number}> = {};
      usersSnapshot.docs.forEach(doc => {
        const uData = doc.data();
        if (uData.role === "hotel_partner" && uData.hotelName && uData.latitude && uData.longitude) {
          partnerLocations[uData.hotelName] = { lat: uData.latitude, lng: uData.longitude };
        }
      });

      // 3. Process Rooms through the Availability Filter
      const roomsSnapshot = await getDocs(collection(db, "rooms"));
      const searchDestinationLower = destination.toLowerCase();
      const hotelGroups: Record<string, HotelResult> = {};

      roomsSnapshot.docs.forEach(doc => {
        const roomData = doc.data() as any;
        const roomId = doc.id;

        // ✨ FILTER 1: Skip if room is already occupied (Overlapping Dates)
        if (occupiedRoomIds.has(roomId)) return;

        // ✨ FILTER 2: Skip if room cannot fit the requested number of guests
        if (roomData.maxGuests && roomData.maxGuests < requiredGuests) return;

        // Filter 3: City Match
        if (destination !== "Current Location" && (!roomData.city || !searchDestinationLower.includes(roomData.city.toLowerCase()))) return;

        const hotelName = roomData.hotelName || "WanderHub Partner Hotel";

        const stats = hotelRatings[hotelName];
        const realRating = stats ? Number((stats.total / stats.count).toFixed(1)) : 5.0; 
        const realReviewsCount = stats ? stats.count : 0;

        const lat = roomData.latitude || partnerLocations[hotelName]?.lat;
        const lng = roomData.longitude || partnerLocations[hotelName]?.lng;

        let calculatedDistance = undefined;
        if (userLocation && lat && lng) {
          calculatedDistance = getDistanceFromLatLonInKm(
            userLocation.lat, 
            userLocation.lng, 
            Number(lat), 
            Number(lng)
          );
        }

        if (!hotelGroups[hotelName]) {
          hotelGroups[hotelName] = {
            id: roomData.ownerId || doc.id, 
            name: hotelName,
            location: roomData.city ? roomData.city.charAt(0).toUpperCase() + roomData.city.slice(1) : destination, 
            rating: realRating, 
            reviews: realReviewsCount, 
            pricePerNight: roomData.price || 5000,
            imageUrl: roomData.imageUrl || "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=800&q=80",
            provider: "WanderHub Direct",
            bookingUrl: `/partner-hotel/${encodeURIComponent(hotelName)}?checkIn=${checkIn}&checkOut=${checkOut}&guests=${guests}`,
            isExclusive: true,
            distance: calculatedDistance 
          };
        } else {
          if (roomData.price && roomData.price < hotelGroups[hotelName].pricePerNight) {
            hotelGroups[hotelName].pricePerNight = roomData.price;
          }
          if (hotelGroups[hotelName].distance === undefined && calculatedDistance !== undefined) {
            hotelGroups[hotelName].distance = calculatedDistance;
          }
        }
      });

      internalRooms = Object.values(hotelGroups);
    } catch (err) {
      console.error("Internal fetch error:", err);
    }

    try {
      const apiKey = process.env.NEXT_PUBLIC_HOTEL_API_KEY;
      if (!apiKey || apiKey === "mock") throw new Error("No valid API Key found in .env");

      const headers = { 'X-RapidAPI-Key': apiKey, 'X-RapidAPI-Host': 'booking-com.p.rapidapi.com' };
      const cleanGuestCount = guests.replace(/\D/g, '') || "2";

      const locationRes = await fetch(`https://booking-com.p.rapidapi.com/v1/hotels/locations?name=${encodeURIComponent(destination)}&locale=en-gb`, { method: 'GET', headers });
      if (!locationRes.ok) throw new Error(`Location API Error: ${locationRes.status}`);
      const locationData = await locationRes.json();
      if (!locationData || locationData.length === 0) throw new Error("Could not find that destination on Booking.com");

      const destId = locationData[0].dest_id;
      const destType = locationData[0].dest_type;
      
      const searchUrl = `https://booking-com.p.rapidapi.com/v1/hotels/search?dest_id=${destId}&dest_type=${destType}&checkin_date=${checkIn}&checkout_date=${checkOut}&adults_number=${cleanGuestCount}&room_number=1&order_by=popularity&units=metric&locale=en-gb&filter_by_currency=INR`;
      const searchRes = await fetch(searchUrl, { method: 'GET', headers });
      if (!searchRes.ok) throw new Error(`Search API Error: ${searchRes.status}`);
      const searchData = await searchRes.json();
      if (!searchData || !searchData.result || searchData.result.length === 0) throw new Error("Search succeeded, but 0 hotels were available for these dates."); 
      
      const mappedHotels = searchData.result.map((h: any) => ({
        id: h.hotel_id?.toString() || Math.random().toString(),
        name: h.hotel_name || "Unknown Hotel",
        location: h.city_trans || destination,
        rating: h.review_score || 4.0,
        reviews: h.review_nr || 0,
        pricePerNight: h.min_total_price || 5000,
        imageUrl: h.max_photo_url || "https://images.unsplash.com/photo-1566073771259-6a8506099945?w=800&q=80",
        provider: "Booking.com",
        bookingUrl: h.url || "#",
        distance: (userLocation && h.latitude && h.longitude) 
          ? getDistanceFromLatLonInKm(userLocation.lat, userLocation.lng, Number(h.latitude), Number(h.longitude))
          : undefined
      }));
      
      setHotels([...internalRooms, ...mappedHotels]);

    } catch (error: any) {
      console.error("🔴 EXTERNAL API ERROR CAUGHT:", error.message);
      await new Promise(resolve => setTimeout(resolve, 1500)); 

      setHotels([
        ...internalRooms,
        { id: "1", name: "Taj Mahal Palace", location: "Colaba, Mumbai", rating: 4.9, reviews: 12450, pricePerNight: 18500, imageUrl: "https://images.unsplash.com/photo-1582719508461-905c673771fd?w=800&q=80", provider: "Agoda", bookingUrl: "https://agoda.com" },
        { id: "2", name: "The Oberoi", location: "Nariman Point, Mumbai", rating: 4.8, reviews: 8920, pricePerNight: 15200, imageUrl: "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=800&q=80", provider: "MakeMyTrip", bookingUrl: "https://makemytrip.com" }
      ]);
    } finally {
      setIsSearching(false);
    }
  };

  const handleSuggestToGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!hotelToSuggest || !selectedTripId || !user) return;
    setIsSuggesting(true);

    try {
      const pollRef = collection(db, "trips", selectedTripId, "hotel_polls");
      await addDoc(pollRef, {
        hotelId: hotelToSuggest.id,
        name: hotelToSuggest.name,
        location: hotelToSuggest.location,
        rating: hotelToSuggest.rating,
        reviews: hotelToSuggest.reviews,
        pricePerNight: hotelToSuggest.pricePerNight,
        imageUrl: hotelToSuggest.imageUrl,
        provider: hotelToSuggest.provider,
        bookingUrl: hotelToSuggest.bookingUrl,
        suggestedBy: user.uid,
        suggestedByName: user.displayName || "A member",
        votes: {}, 
        createdAt: serverTimestamp()
      });

      setSuggestSuccess(true);
      setTimeout(() => {
        setSuggestSuccess(false);
        setSuggestModalOpen(false);
        setHotelToSuggest(null);
      }, 2000);
    } catch (error) {
      console.error("Error suggesting hotel:", error);
      alert("Failed to suggest hotel to the group.");
    } finally {
      setIsSuggesting(false);
    }
  };

  const displayedHotels = [...hotels].sort((a, b) => {
    if (sortBy === "price_asc") return a.pricePerNight - b.pricePerNight;
    if (sortBy === "price_desc") return b.pricePerNight - a.pricePerNight;
    if (sortBy === "distance") return (a.distance ?? 9999) - (b.distance ?? 9999);
    return 0; 
  });

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors duration-300 selection:bg-emerald-500/20">
      
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
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Map className="h-5 w-5 mr-3 opacity-70" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Calendar className="h-5 w-5 mr-3 opacity-70" /> Itineraries</Link>
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><BedDouble className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Book Hotels</Link>
          <Link href="/history" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><History className="h-5 w-5 mr-3 opacity-70" /> Trip History</Link>
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
            <Link href="/my-bookings" className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"><Calendar className="h-5 w-5 text-emerald-500" /></Link>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-600 dark:text-zinc-400 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
          </div>
        </div>

        {/* DESKTOP HEADER (MINIMALIST) */}
        <header className="hidden md:flex h-24 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 items-center justify-between px-12 z-20 shrink-0 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter">Hotel Search</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-1">Find the perfect stay for your trip.</p>
          </div>
          <Link href="/my-bookings" className="flex items-center bg-transparent border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 hover:bg-zinc-50 dark:hover:bg-zinc-900 transition-all px-6 py-3 rounded-full font-bold text-zinc-900 dark:text-white text-xs uppercase tracking-widest active:scale-95">
            <Calendar className="h-4 w-4 mr-2 text-emerald-500" /> My Bookings
          </Link>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-12 custom-scrollbar relative z-10">
          <div className="max-w-6xl mx-auto pb-24">
            
            {/* EDITORIAL HERO SEARCH SECTION */}
            <div className="relative rounded-[2.5rem] p-8 md:p-14 mb-14 shadow-2xl border border-zinc-200 dark:border-zinc-800 bg-zinc-950 overflow-hidden">
              <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none"></div>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=1200&q=80" alt="Luxury Hotel" className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-luminosity filter grayscale-[0.5]" />
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-zinc-950/40 to-transparent"></div>
              
              <div className="relative z-10 animate-in fade-in slide-in-from-top-4 duration-700">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/10 backdrop-blur-md border border-emerald-500/20 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-6 shadow-sm">
                  <Sparkles className="h-3 w-3" /> Best Price Guarantee
                </div>
                <h1 className="text-4xl md:text-6xl font-black text-white mb-4 tracking-tighter drop-shadow-md leading-tight">Where are you heading?</h1>
                <p className="text-zinc-400 mb-12 text-sm md:text-base font-medium max-w-2xl">Compare millions of properties globally, including verified exclusive WanderHub Partners.</p>

                <form onSubmit={handleSearchHotels} className="bg-white/10 backdrop-blur-xl p-3 rounded-[2rem] shadow-2xl flex flex-col lg:flex-row gap-3 border border-white/10">
                  <div className="flex-1 flex items-center px-5 py-4 border-b lg:border-b-0 lg:border-r border-white/10 bg-black/20 rounded-2xl lg:rounded-none lg:rounded-l-2xl hover:bg-black/30 transition-colors group relative z-50">
                    <MapPin className="h-5 w-5 text-zinc-400 mr-3 shrink-0 group-hover:text-white transition-colors" />
                    <div className="flex-1 min-w-0 pr-10">
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Destination</label>
                      <input 
                        type="text" 
                        value={destination} 
                        onChange={(e) => { setDestination(e.target.value); setShowSuggestions(true); }} 
                        onFocus={() => { if (destination.trim().length >= 3) setShowSuggestions(true); }}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
                        className="w-full bg-transparent border-none outline-none text-white font-bold placeholder-zinc-500 truncate text-base" 
                        placeholder="City or Hotel Name" required autoComplete="off"
                      />
                    </div>
                    <button type="button" onClick={handleNearMeClick} className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-white rounded-full transition-all shadow-sm flex items-center" title="Find Hotels Near Me">
                      {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                    </button>
                    {showSuggestions && (suggestions.length > 0 || isFetchingSuggestions) && (
                      <div className="absolute top-[calc(100%+8px)] left-0 w-full bg-zinc-900/95 backdrop-blur-2xl border border-zinc-700 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200 z-[100]">
                        {isFetchingSuggestions ? (
                          <div className="px-5 py-5 text-zinc-400 text-xs font-bold uppercase tracking-widest flex items-center justify-center"><Loader2 className="h-4 w-4 animate-spin mr-2" /> Searching...</div>
                        ) : (
                          suggestions.map((s, i) => (
                            <div key={i} onClick={() => handleSuggestionClick(s)} className="px-5 py-4 hover:bg-white/5 cursor-pointer text-sm font-bold text-white border-b border-zinc-800 last:border-0 truncate flex items-center transition-colors">
                              <MapPin className="h-4 w-4 mr-3 text-zinc-500 shrink-0" /><span className="truncate">{s.display_name}</span>
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex-1 flex items-center px-5 py-4 border-b lg:border-b-0 lg:border-r border-white/10 bg-black/20 rounded-2xl lg:rounded-none hover:bg-black/30 transition-colors gap-4 group">
                    <div className="flex-1"><label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Check-In</label><input type="date" value={checkIn} onChange={(e)=>setCheckIn(e.target.value)} className="w-full bg-transparent border-none outline-none text-white font-bold cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert text-sm" required /></div>
                    <div className="w-px h-10 bg-white/10"></div>
                    <div className="flex-1"><label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Check-Out</label><input type="date" value={checkOut} onChange={(e)=>setCheckOut(e.target.value)} className="w-full bg-transparent border-none outline-none text-white font-bold cursor-pointer [&::-webkit-calendar-picker-indicator]:filter [&::-webkit-calendar-picker-indicator]:invert text-sm" required /></div>
                  </div>

                  <div className="flex-[0.8] flex items-center px-3 py-3 lg:py-2 bg-black/20 rounded-2xl lg:rounded-none lg:rounded-r-2xl hover:bg-black/30 transition-colors group">
                    <div className="flex-1 px-3 relative">
                      <label className="block text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 flex items-center"><Users className="h-3 w-3 mr-1"/> Guests</label>
                      <div className="relative">
                        <select value={guests} onChange={(e)=>setGuests(e.target.value)} className="w-full bg-transparent border-none outline-none text-white font-bold cursor-pointer text-sm appearance-none pr-6">
                          <option value="1" className="text-zinc-900 dark:text-white dark:bg-zinc-900">1 Guest</option>
                          <option value="2" className="text-zinc-900 dark:text-white dark:bg-zinc-900">2 Guests</option>
                          <option value="3" className="text-zinc-900 dark:text-white dark:bg-zinc-900">3 Guests</option>
                          <option value="4" className="text-zinc-900 dark:text-white dark:bg-zinc-900">4+ Guests</option>
                        </select>
                        <ChevronDown className="absolute right-0 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none" />
                      </div>
                    </div>
                    <button type="submit" disabled={isSearching} className="ml-2 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-6 lg:px-8 py-3.5 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.3)] transition-all disabled:opacity-50 shrink-0 font-bold text-xs uppercase tracking-widest flex items-center justify-center group-hover:scale-[1.02] active:scale-95">
                      {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Search className="h-4 w-4 mr-2" /> Search</>}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {!hasSearched ? (
               <div className="text-center py-16 md:py-24 animate-in zoom-in-95 duration-500">
                 <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-900 rounded-full border border-zinc-200 dark:border-zinc-800 flex items-center justify-center mx-auto mb-6 shadow-sm"><BedDouble className="h-8 w-8 text-zinc-400" /></div>
                 <h3 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Ready to book?</h3>
                 <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-2 text-sm">Enter your destination to compare prices across the web.</p>
               </div>
            ) : isSearching ? (
               <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                 {[1,2,3,4,5,6,7,8].map(i => (
                   <div key={i} className="bg-white dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm overflow-hidden flex flex-col animate-pulse">
                     <div className="h-64 bg-zinc-200 dark:bg-zinc-800"></div>
                     <div className="p-6 flex-1 flex flex-col"><div className="h-6 w-3/4 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-3"></div><div className="h-4 w-1/2 bg-zinc-200 dark:bg-zinc-800 rounded-full mb-6"></div><div className="flex gap-2 mb-auto"><div className="h-6 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-md"></div><div className="h-6 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-md"></div></div><div className="mt-6 pt-4 border-t border-zinc-100 dark:border-zinc-800/50 flex justify-between items-end"><div className="h-8 w-20 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div><div className="h-10 w-24 bg-zinc-200 dark:bg-zinc-800 rounded-full"></div></div></div>
                   </div>
                 ))}
               </div>
            ) : (
              <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
                <div className="flex flex-col md:flex-row md:justify-between md:items-end px-2 md:px-0 border-b border-zinc-200 dark:border-zinc-800 pb-4 gap-4">
                  <div>
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Top deals for {destination}</h3>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-1.5">Showing the best available rates.</p>
                  </div>
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
                    <div className="relative group">
                      <ArrowDownUp className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 group-hover:text-emerald-500 transition-colors pointer-events-none" />
                      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)} className="pl-10 pr-8 py-2.5 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-full text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white shadow-sm outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer appearance-none transition-all">
                        <option value="recommended">Recommended</option>
                        <option value="price_asc">Price: Low to High</option>
                        <option value="price_desc">Price: High to Low</option>
                        {userLocation && <option value="distance">Distance: Nearest First</option>}
                      </select>
                      <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
                    </div>
                    <span className="text-[10px] font-bold text-zinc-900 dark:text-white bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 px-4 py-2.5 rounded-full uppercase tracking-widest w-max shadow-sm">{displayedHotels.length} properties</span>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                  {displayedHotels.map(hotel => (
                    <div key={hotel.id} className={`bg-white dark:bg-zinc-900/40 rounded-[2rem] border ${hotel.isExclusive ? 'border-emerald-500/50 shadow-emerald-500/10' : 'border-zinc-200 dark:border-zinc-800/50'} shadow-sm hover:shadow-2xl hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 overflow-hidden flex flex-col group relative hover:-translate-y-2`}>
                      
                      {hotel.isExclusive && (
                        <div className="absolute top-4 right-4 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-md text-emerald-600 dark:text-emerald-400 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest flex items-center shadow-lg z-10 border border-emerald-500/30">
                          <Sparkles className="h-3 w-3 mr-1.5 text-emerald-500" /> WanderHub Partner
                        </div>
                      )}

                      <div className="h-64 bg-zinc-200 dark:bg-zinc-800 relative overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={hotel.imageUrl} alt={hotel.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent opacity-60 group-hover:opacity-80 transition-opacity duration-300"></div>
                        <div className="absolute bottom-5 left-5 bg-white/20 dark:bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-white flex items-center shadow-md border border-white/20">
                          <Star className="h-3 w-3 mr-1 text-white fill-white" /> {hotel.rating} <span className="text-zinc-300 font-medium ml-1">({hotel.reviews})</span>
                        </div>
                      </div>

                      <div className="p-6 flex-1 flex flex-col">
                        <h4 className="font-bold text-xl text-zinc-900 dark:text-white line-clamp-1 mb-2 tracking-tight" title={hotel.name}>{hotel.name}</h4>
                        
                        <div className="flex items-center gap-2 mb-4">
                          <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 flex items-center truncate max-w-[50%]"><MapPin className="h-3.5 w-3.5 mr-1.5 shrink-0 text-zinc-400"/> {hotel.location}</p>
                          {hotel.distance !== undefined && (
                            <span className="bg-zinc-100 dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full flex items-center shrink-0">
                              <LocateFixed className="h-3 w-3 mr-1" /> {hotel.distance.toFixed(1)} km
                            </span>
                          )}
                        </div>
                        
                        <div className="flex flex-wrap gap-2 mb-4">
                          <span className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center"><Wifi className="h-3 w-3 mr-1.5 text-zinc-500"/> WiFi</span>
                          <span className="bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full flex items-center"><Coffee className="h-3 w-3 mr-1.5 text-zinc-500"/> Breakfast</span>
                        </div>

                        <div className="mt-auto pt-5 border-t border-zinc-100 dark:border-zinc-800 flex flex-col gap-4">
                          
                          <div className="flex items-end justify-between min-w-0 gap-4">
                            <div className="min-w-0">
                              <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Starting from</p>
                              <p className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter truncate" title={`${symbol}${convert(hotel.pricePerNight).toLocaleString()}`}>
                                {symbol}{convert(hotel.pricePerNight).toLocaleString(undefined, {maximumFractionDigits: 0})}
                                <span className="text-xs font-medium text-zinc-500 tracking-normal ml-1">/night</span>
                              </p>
                            </div>
                            <p className="text-[9px] font-bold text-zinc-400 text-right shrink-0 uppercase tracking-widest">
                              Provided by<br/><span className="font-black text-zinc-600 dark:text-zinc-300">{hotel.provider}</span>
                            </p>
                          </div>
                          
                          <div className="flex items-center gap-3 w-full mt-2">
                            {userTrips.length > 0 && (
                              <button 
                                onClick={() => { setHotelToSuggest(hotel); setSuggestModalOpen(true); }}
                                className="bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 text-zinc-900 dark:text-white border border-zinc-200 dark:border-zinc-700 h-12 w-12 rounded-full transition-all flex items-center justify-center shadow-sm hover:scale-105 shrink-0 active:scale-95"
                                title="Suggest to Group"
                              >
                                <Sparkles className="h-5 w-5" />
                              </button>
                            )}
                            <Link href={hotel.bookingUrl} target={hotel.isExclusive ? "_self" : "_blank"} rel="noopener noreferrer" className={`${hotel.isExclusive ? 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.2)]' : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-md'} h-12 rounded-full text-xs font-bold uppercase tracking-widest transition-all flex-1 flex items-center justify-center hover:opacity-90 active:scale-95 whitespace-nowrap`}>
                              {hotel.isExclusive ? 'View Rooms' : 'Availability'} <ExternalLink className="h-3.5 w-3.5 ml-2" />
                            </Link>
                          </div>

                        </div>
                      </div>

                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </main>
      </div>

      {suggestModalOpen && hotelToSuggest && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200 relative">
            <button onClick={() => setSuggestModalOpen(false)} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-full transition-colors"><X className="h-4 w-4" /></button>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center shrink-0 shadow-sm border border-zinc-800 dark:border-zinc-200">
                <Sparkles className="h-5 w-5 text-white dark:text-zinc-900" />
              </div>
              <div>
                <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Suggest Hotel</h3>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-0.5">Push to Voting Room</p>
              </div>
            </div>

            <div className="flex items-center gap-4 p-4 bg-zinc-50 dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-800 mb-8">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={hotelToSuggest.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover shadow-sm" />
              <div className="min-w-0">
                <h4 className="font-bold text-zinc-900 dark:text-white truncate text-base">{hotelToSuggest.name}</h4>
                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 truncate mt-1">{hotelToSuggest.location}</p>
              </div>
            </div>

            {suggestSuccess ? (
              <div className="py-8 flex flex-col items-center justify-center text-center animate-in zoom-in duration-300">
                <div className="h-16 w-16 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mb-4 border border-emerald-500/20">
                  <CheckCircle2 className="h-8 w-8" />
                </div>
                <h3 className="text-xl font-black text-zinc-900 dark:text-white">Sent to Group!</h3>
                <p className="text-sm font-medium text-zinc-500 mt-1">Open the Trip Dashboard to start swiping.</p>
              </div>
            ) : (
              <form onSubmit={handleSuggestToGroup} className="space-y-6">
                <div className="relative group">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Select Target Trip</label>
                  <select 
                    value={selectedTripId} 
                    onChange={(e) => setSelectedTripId(e.target.value)}
                    className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-5 py-4 outline-none font-bold text-zinc-900 dark:text-white transition-all cursor-pointer appearance-none shadow-sm text-sm"
                    required
                  >
                    {userTrips.map(trip => (
                      <option key={trip.id} value={trip.id}>{trip.title}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-4 bottom-4 h-5 w-5 text-zinc-400 pointer-events-none group-hover:text-emerald-500 transition-colors" />
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  <button type="button" onClick={() => setSuggestModalOpen(false)} className="px-6 py-4 rounded-full font-bold text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors w-full sm:w-auto text-center active:scale-95">Cancel</button>
                  <button type="submit" disabled={isSuggesting || !selectedTripId} className="px-6 py-4 rounded-full font-bold text-xs uppercase tracking-widest text-zinc-950 bg-emerald-500 hover:bg-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)] transition-all flex-1 flex items-center justify-center disabled:opacity-50 active:scale-95 group">
                    {isSuggesting ? <Loader2 className="h-4 w-4 animate-spin" /> : <><MessageSquare className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" /> Push to Group</>}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

    </div>
  );
}