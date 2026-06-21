"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc, addDoc, setDoc, serverTimestamp, getDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Printer, Clock, MapPin, Plane, Hotel, Utensils, Trash2, Map as MapIcon, CalendarPlus, ChevronDown, ChevronUp, AlignLeft, Navigation, BedDouble, Sparkles, Loader2, Menu, X, Sun, CloudRain, Hash, Info, ArrowRight, Radio, Users, MessageSquare, History } from "lucide-react";

// ✨ Dynamically load the map component (Bypasses the "window is not defined" SSR error)
const DynamicRadarMap = dynamic(() => import('../components/RadarMap'), { 
  ssr: false,
  loading: () => (
    <div className="h-full flex flex-col items-center justify-center text-zinc-500 bg-zinc-950">
      <Loader2 className="h-8 w-8 animate-spin mb-3" />
      <p className="text-[10px] font-bold uppercase tracking-widest">Loading Satellites...</p>
    </div>
  )
});

interface Trip { id: string; title: string; }
interface Activity {
  id: string;
  tripId: string;
  title: string;
  type: string;
  date: string;
  time: string;
  location?: string;
  notes?: string;
  trackingNumber?: string;
}

export default function ItinerariesPage() {
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  
  // LIVE TRACKER STATE (Air/Train Radar)
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);

  // AI GENERATOR STATE
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // MOBILE MENU STATE
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // WEATHER FORECAST STATE
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  // LIVE SAFE RADAR MAP STATE
  const [activeTab, setActiveTab] = useState<'itinerary' | 'live_map'>('itinerary');
  const [isBroadcasting, setIsBroadcasting] = useState(false);
  const [liveMembers, setLiveMembers] = useState<any[]>([]);
  const [myLatestCoords, setMyLatestCoords] = useState<[number, number] | null>(null);

  // 🛡️ SECURITY GUARD: Check if logged in
  // 🛡️ SECURITY GUARD: Travelers Only
useEffect(() => {
  const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
    if (!currentUser) {
      router.push("/"); // Kick to landing page if not logged in
    } else {
      try {
        // Fetch user profile to check their role
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        
        if (userDoc.exists() && userDoc.data().role === "hotel_partner") {
          // Bouncer: Kick Hotel Partners OUT of the customer site!
          router.push("/partner/dashboard");
          return;
        }

        // If they pass, let them in
        setUser(currentUser);
        setIsAuthLoading(false);
        
      } catch (error) {
        console.error("Auth check error:", error);
      }
    }
  });
  return () => unsubscribe();
  }, [router]);

  // FETCH TRIPS (Only runs once user is verified)
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "trips"), 
      where("members", "array-contains", user.uid), 
      where("status", "==", "active")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripsData = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
      setTrips(tripsData);
      if (tripsData.length > 0 && !selectedTripId) {
        setSelectedTripId(tripsData[0].id);
      }
    });
    return () => unsubscribe();
  }, [user, selectedTripId]);

  // BROADCAST ENGINE (Watch Position)
  useEffect(() => {
    let watchId: number;

    if (isBroadcasting && selectedTripId && user) {
      if (!navigator.geolocation) {
        alert("Geolocation is not supported by your browser.");
        setIsBroadcasting(false);
        return;
      }

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          setMyLatestCoords([latitude, longitude]);
          
          // Push to Firebase instantly
          const trackRef = doc(db, "liveTracking", `${selectedTripId}_${user.uid}`);
          setDoc(trackRef, {
            tripId: selectedTripId,
            userId: user.uid,
            userName: user.displayName || "Traveler",
            lat: latitude,
            lng: longitude,
            lastUpdated: serverTimestamp()
          }, { merge: true });
        },
        (error) => {
          console.error("GPS Error:", error);
          alert("Make sure location permissions are allowed.");
          setIsBroadcasting(false);
        },
        { enableHighAccuracy: true, maximumAge: 5000, timeout: 5000 }
      );
    } else if (!isBroadcasting && user && selectedTripId) {
      // Remove ping from map when turned off
      const trackRef = doc(db, "liveTracking", `${selectedTripId}_${user.uid}`);
      deleteDoc(trackRef).catch(console.error);
      setMyLatestCoords(null);
    }

    return () => {
      if (watchId) navigator.geolocation.clearWatch(watchId);
    };
  }, [isBroadcasting, selectedTripId, user]);

  // MULTI-PLAYER RADAR LISTENER
  useEffect(() => {
    if (!selectedTripId || activeTab !== 'live_map') return;
    
    const q = query(collection(db, "liveTracking"), where("tripId", "==", selectedTripId));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const activeMembers = snapshot.docs.map(doc => doc.data());
      // Filter out people who haven't updated in the last 30 minutes (fallback safety)
      const recentMembers = activeMembers.filter(m => {
        if (!m.lastUpdated) return true; 
        const diffMs = Date.now() - m.lastUpdated.toMillis();
        return diffMs < 30 * 60 * 1000; 
      });
      setLiveMembers(recentMembers);
    });

    return () => unsubscribe();
  }, [selectedTripId, activeTab]);

  const handleTrackStatus = async (activityTitle: string, type: string, trackingNum?: string) => {
    setIsTrackerOpen(true);
    setIsTrackingLoading(true);
    setTrackingData(null);

    const finalTrackingNumber = trackingNum || "UNKNOWN";

    if (type === 'flight') {
      try {
        const cleanFlightNum = finalTrackingNumber.replace(/\s/g, '');
        const response = await fetch(`http://api.aviationstack.com/v1/flights?access_key=${process.env.NEXT_PUBLIC_FLIGHT_API_KEY}&flight_iata=${cleanFlightNum}`);
        const json = await response.json();

        if (json.data && json.data.length > 0) {
          const liveFlight = json.data[0]; 
          
          setTrackingData({
            type: 'Flight',
            number: liveFlight.flight.iata || finalTrackingNumber,
            status: liveFlight.flight_status === "active" ? "In Air" : liveFlight.flight_status || "Scheduled",
            departure: { 
              city: liveFlight.departure.airport || "Origin", 
              time: new Date(liveFlight.departure.estimated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || "TBD", 
              gate: liveFlight.departure.gate || "TBD" 
            },
            arrival: { 
              city: liveFlight.arrival.airport || "Destination", 
              time: new Date(liveFlight.arrival.estimated).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) || "TBD", 
              gate: liveFlight.arrival.gate || "TBD" 
            },
            progress: liveFlight.flight_status === "active" ? 50 : (liveFlight.flight_status === "landed" ? 100 : 0)
          });
        } else {
          console.warn(`Flight ${cleanFlightNum} not currently active in AviationStack free tier.`);
          setTrackingData({
            type: 'Flight', number: finalTrackingNumber, status: "Status Unavailable",
            departure: { city: "N/A", time: "--", gate: "--" },
            arrival: { city: "N/A", time: "--", gate: "--" },
            progress: 0
          });
        }
      } catch (error) {
        console.warn("Network Error:", error);
        setTrackingData({
          type: 'Flight', number: finalTrackingNumber, status: "Network Error",
          departure: { city: "N/A", time: "--", gate: "--" },
          arrival: { city: "N/A", time: "--", gate: "--" },
          progress: 0
        });
      }
    } else {
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      setTrackingData({
        type: 'Train', number: finalTrackingNumber, status: "Check Local Station",
        departure: { city: "Origin", time: "TBD", platform: "TBD" },
        arrival: { city: "Destination", time: "TBD", platform: "TBD" }, progress: 0
      });
    }
    
    setIsTrackingLoading(false);
  };

  const handleGenerateItinerary = async () => {
    if (!aiPrompt.trim() || !selectedTripId) return;
    
    setIsAiLoading(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().split('T')[0];

      const currentTrip = trips.find(t => t.id === selectedTripId);
      const destination = currentTrip ? currentTrip.title : "";
      
      const contextualPrompt = `Destination: ${destination}. Request: ${aiPrompt}`;

      const response = await fetch('/api/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: contextualPrompt, startDate: startDate })
      });
      
      const data = await response.json();

      if (data.activities && data.activities.length > 0) {
        for (const act of data.activities) {
          await addDoc(collection(db, "activities"), {
            tripId: selectedTripId,
            title: act.title,
            type: act.type.toLowerCase(),
            date: act.date,
            time: act.time,
            location: act.location || "",
            notes: act.notes || ""
          });
        }
        setAiPrompt("");
        setShowAiModal(false);
      } else {
        alert("The AI couldn't generate a trip for that prompt. Try being more specific!");
      }
    } catch (error) {
      console.error("AI Error:", error);
      alert("Failed to connect to the AI engine.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  useEffect(() => {
    if (!selectedTripId) {
      setIsLoading(false);
      return;
    }
    const q = query(collection(db, "activities"), where("tripId", "==", selectedTripId), orderBy("date", "asc"), orderBy("time", "asc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const actData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Activity));
      setActivities(actData);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [selectedTripId]);

  useEffect(() => {
    if (!selectedTripId || trips.length === 0) return;
    
    const fetchWeather = async () => {
      setIsWeatherLoading(true);
      setWeatherError("");
      setWeatherData([]);
      
      try {
        const currentTrip = trips.find(t => t.id === selectedTripId);
        if (!currentTrip || !currentTrip.title) return;

        const words = currentTrip.title.trim().split(" ");
        const presumedCity = words[words.length - 1];

        const res = await fetch(`/api/weather?city=${presumedCity}`);
        const data = await res.json();
        
        if (res.ok) {
          setWeatherData(data);
        } else {
          setWeatherError(`Weather unavailable for "${presumedCity}"`);
        }
      } catch (err) {
        console.error(err);
        setWeatherError("Weather service disconnected.");
      } finally {
        setIsWeatherLoading(false);
      }
    };

    fetchWeather();
  }, [selectedTripId, trips]);

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Are you sure you want to remove this from the itinerary?")) return;
    try {
      await deleteDoc(doc(db, "activities", activityId));
    } catch (error) {
      console.error("Error deleting activity:", error);
      alert("Failed to delete. Please try again.");
    }
  };

  const handleExportCalendar = () => {
    if (activities.length === 0 || !selectedTripId) return;
    const currentTrip = trips.find(t => t.id === selectedTripId);
    if (!currentTrip) return;

    let icsContent = "BEGIN:VCALENDAR\nVERSION:2.0\nPRODID:-//WanderHub//EN\n";

    activities.forEach(act => {
      const startDateTime = new Date(`${act.date}T${act.time}`);
      const endDateTime = new Date(startDateTime.getTime() + 60 * 60 * 1000); 
      const formatIcalDate = (date: Date) => date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';

      icsContent += "BEGIN:VEVENT\n";
      icsContent += `UID:${act.id}@wanderhub.com\n`;
      icsContent += `DTSTAMP:${formatIcalDate(new Date())}\n`;
      icsContent += `DTSTART:${formatIcalDate(startDateTime)}\n`;
      icsContent += `DTEND:${formatIcalDate(endDateTime)}\n`;
      icsContent += `SUMMARY:${act.title}\n`;
      icsContent += `DESCRIPTION:WanderHub Activity Type: ${act.type}\n`;
      icsContent += "END:VEVENT\n";
    });

    icsContent += "END:VCALENDAR";

    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = window.URL.createObjectURL(blob);
    link.setAttribute('download', `${currentTrip.title.replace(/\s+/g, '_')}_Itinerary.ics`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const groupedActivities = activities.reduce((groups, activity) => {
    const date = activity.date;
    if (!groups[date]) groups[date] = [];
    groups[date].push(activity);
    return groups;
  }, {} as Record<string, Activity[]>);

  const sortedDates = Object.keys(groupedActivities).sort();

  const getIcon = (type: string) => {
    switch(type) {
      case 'flight': return <Plane className="h-4 w-4 md:h-5 md:w-5 text-zinc-900 dark:text-white" />;
      case 'hotel': return <Hotel className="h-4 w-4 md:h-5 md:w-5 text-zinc-900 dark:text-white" />;
      case 'food': return <Utensils className="h-4 w-4 md:h-5 md:w-5 text-zinc-900 dark:text-white" />;
      default: return <MapPin className="h-4 w-4 md:h-5 md:w-5 text-zinc-900 dark:text-white" />;
    }
  };

  // 🛡️ LOADING SCREEN: Hide page until verified
  if (isAuthLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  // Fallback state if user somehow bypasses but is still not loaded (technically caught by isAuthLoading)
  if (isLoading && trips.length === 0 && !selectedTripId) {
      return <div className="h-screen flex items-center justify-center bg-[#FDFDFD] dark:bg-zinc-950 transition-colors"><div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors duration-300 selection:bg-emerald-500/20">
      
      {/* MOBILE MENU BLUR */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity duration-300"
          onClick={() => setIsMobileMenuOpen(false)}
        />
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
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><Calendar className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Itineraries</Link>
          <Link href="/chat" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
            <MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat
          </Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><BedDouble className="h-5 w-5 mr-3 opacity-70" /> Book Hotels</Link>
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
        
        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-2 shadow-sm">
              <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-600 dark:text-zinc-400 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
        </div>

        {/* DESKTOP/TABLET HEADER */}
        <header className="h-auto md:h-24 py-4 md:py-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between px-6 md:px-12 z-20 print:hidden shrink-0 gap-4 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white hidden md:block tracking-tighter">Master Schedule</h2>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hidden md:block mt-0.5">Plan and track your group journey.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 md:gap-5 w-full md:w-auto justify-between md:justify-end">
            <div className="relative flex-1 md:flex-none group">
              <MapIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-zinc-500 group-hover:text-emerald-500 transition-colors pointer-events-none" />
              <select 
                value={selectedTripId} 
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full appearance-none border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-full pl-10 pr-10 py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-zinc-50 dark:bg-zinc-900 font-bold text-zinc-900 dark:text-white transition-all cursor-pointer max-w-[200px] md:max-w-[240px] truncate"
              >
                {trips.length === 0 ? <option>No trips found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <button 
                onClick={() => setShowAiModal(true)} 
                disabled={trips.length === 0} 
                className="flex items-center bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 py-2.5 rounded-full font-bold hover:opacity-90 transition-all disabled:opacity-50 shadow-sm text-sm active:scale-95 group"
              >
                <Sparkles className="h-4 w-4 md:mr-2 text-emerald-400 dark:text-emerald-600 transition-colors" /> <span className="hidden md:inline">Magic Plan</span>
              </button>

              <button onClick={handleExportCalendar} disabled={activities.length === 0} className="flex items-center bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2.5 rounded-full font-bold hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all disabled:opacity-50 text-sm active:scale-95 group" title="Sync to Calendar">
                <CalendarPlus className="h-4 w-4 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors md:mr-2" /> <span className="hidden lg:inline">Sync</span>
              </button>
              <button onClick={() => window.print()} disabled={activities.length === 0} className="flex items-center bg-transparent border border-zinc-200 dark:border-zinc-800 text-zinc-700 dark:text-zinc-300 px-4 py-2.5 rounded-full font-bold hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all disabled:opacity-50 text-sm active:scale-95 group" title="Print Itinerary">
                <Printer className="h-4 w-4 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors md:mr-2" /> <span className="hidden lg:inline">Print</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-12 print:p-0 print:bg-white bg-[#FDFDFD] dark:bg-transparent custom-scrollbar relative z-10">
          <div className="max-w-[1000px] mx-auto pb-24">
            
            {/* ✨ TAB TOGGLE (ITINERARY vs LIVE MAP) */}
            {selectedTripId && (
              <div className="flex justify-start mb-10 print:hidden animate-in fade-in slide-in-from-bottom-4 duration-500 border-b border-zinc-200 dark:border-zinc-800 w-full overflow-x-auto custom-scrollbar pb-1">
                <div className="flex gap-8">
                  <button 
                    onClick={() => setActiveTab('itinerary')} 
                    className={`flex items-center pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === 'itinerary' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                  >
                    <AlignLeft className="h-4 w-4 mr-2" /> Itinerary
                  </button>
                  <button 
                    onClick={() => setActiveTab('live_map')} 
                    className={`flex items-center pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === 'live_map' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                  >
                    <Radio className="h-4 w-4 mr-2" /> Live Map
                  </button>
                </div>
              </div>
            )}

            {/* ======================================================= */}
            {/* TAB 1: MASTER ITINERARY VIEW                            */}
            {/* ======================================================= */}
            {activeTab === 'itinerary' && (
              <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
                {/* --- PRO WEATHER WIDGET --- */}
                {selectedTripId && !isWeatherLoading && weatherData.length > 0 && (
                  <div className="mb-14 relative overflow-hidden rounded-[2rem] p-8 md:p-10 print:hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-950 shadow-2xl">
                    <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
                    <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                    
                    {/* Content */}
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-800">
                        <h3 className="text-xl font-bold text-white flex items-center tracking-tight">
                          <Sun className="h-5 w-5 mr-3 text-emerald-400"/> Destination Forecast
                        </h3>
                        <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest border border-zinc-800 px-3 py-1 rounded-full">Live API</span>
                      </div>
                      
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                        {weatherData.slice(0, 5).map((day: any, idx: number) => {
                          const dateObj = new Date(day.dt * 1000);
                          const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'short' });
                          const dateNum = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                          const temp = Math.round(day.main.temp);
                          const iconUrl = `https://openweathermap.org/img/wn/${day.weather[0].icon}@4x.png`;
                          
                          return (
                            <div key={idx} className="bg-zinc-900 rounded-2xl p-5 flex flex-col items-center text-center border border-zinc-800 hover:border-zinc-700 hover:-translate-y-1 transition-all duration-300 group">
                              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 mb-1">{weekday}</p>
                              <p className="text-xs font-medium text-zinc-400 mb-3">{dateNum}</p>
                              
                              <div className="relative h-14 w-14 mb-2 group-hover:scale-110 transition-transform duration-500">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={iconUrl} alt="weather icon" className="absolute inset-0 w-full h-full object-contain filter brightness-110 grayscale-[0.2]" />
                              </div>
                              
                              <p className="text-3xl font-black text-white tracking-tighter">{temp}°</p>
                              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-3 w-full truncate">{day.weather[0].description}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}
                
                {/* Loading/Error States for Weather */}
                {selectedTripId && isWeatherLoading && (
                  <div className="mb-14 bg-zinc-50 dark:bg-zinc-950 rounded-[2rem] p-8 border border-zinc-200 dark:border-zinc-800 shadow-sm flex flex-col items-center justify-center h-48 animate-pulse print:hidden">
                    <Loader2 className="h-8 w-8 mb-4 animate-spin text-emerald-500" /> 
                    <p className="text-zinc-500 dark:text-zinc-400 font-bold text-[10px] uppercase tracking-widest">Connecting to Weather Satellites...</p>
                  </div>
                )}
                {selectedTripId && weatherError && !isWeatherLoading && (
                  <div className="mb-14 bg-zinc-50 dark:bg-zinc-900 rounded-[2rem] p-6 border border-zinc-200 dark:border-zinc-800 text-zinc-500 dark:text-zinc-400 font-medium flex items-center justify-center print:hidden shadow-inner">
                    <CloudRain className="h-5 w-5 mr-3 text-zinc-400 dark:text-zinc-500" /> {weatherError}
                  </div>
                )}

                {/* Content States */}
                {trips.length === 0 ? (
                  <div className="text-center py-24 md:py-32">
                    <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6">
                      <Calendar className="h-8 w-8 text-zinc-400" />
                    </div>
                    <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">No Trips Found</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-2 mb-8 text-sm">Head back to the dashboard to start planning.</p>
                    <Link href="/" className="inline-flex bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-3 rounded-full font-bold hover:opacity-90 transition-opacity text-sm">Go to Dashboard</Link>
                  </div>
                ) : activities.length === 0 ? (
                  <div className="text-center py-24 md:py-32 bg-transparent rounded-[2rem] border border-dashed border-zinc-300 dark:border-zinc-800 print:hidden px-6 relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 border border-zinc-200 dark:border-zinc-800">
                        <Sparkles className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                      </div>
                      <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight">Your canvas is blank.</h3>
                      <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-3 mb-8 max-w-md mx-auto text-sm leading-relaxed">Let our AI engine build a complete, optimized itinerary for you in seconds.</p>
                      <button onClick={() => setShowAiModal(true)} className="w-full md:w-auto bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-3.5 rounded-full font-bold text-sm hover:opacity-90 transition-all flex items-center justify-center mx-auto active:scale-95 group">
                        Generate Magic Schedule <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-12 md:space-y-16 relative">
                    <div className="absolute left-[1.35rem] md:left-[2.75rem] top-24 bottom-10 w-[2px] bg-zinc-200 dark:bg-zinc-800 print:hidden"></div>

                    <div className="hidden print:block mb-10 pb-6 border-b border-zinc-900 dark:border-white/20">
                      <h1 className="text-4xl font-black text-zinc-900 dark:text-white tracking-tighter">{trips.find(t => t.id === selectedTripId)?.title} - Master Itinerary</h1>
                      <p className="text-zinc-500 dark:text-zinc-400 font-bold mt-2 text-xs uppercase tracking-widest">Generated securely by WanderHub</p>
                    </div>

                    {sortedDates.map((date, index) => {
                      const dateObj = new Date(date);
                      const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                      const dateNum = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

                      return (
                        <div key={date} className="relative z-10">
                          <div className="sticky top-0 bg-[#FDFDFD]/95 dark:bg-zinc-950/95 backdrop-blur-xl print:bg-transparent z-30 pt-6 pb-4 mb-8 flex flex-col md:flex-row md:items-center gap-2 md:gap-4 md:ml-1 border-b border-zinc-200 dark:border-zinc-800 -mt-6">
                            <div className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 py-1.5 rounded-full text-[10px] font-bold tracking-widest uppercase inline-block w-max">Day {index + 1}</div>
                            <h3 className="text-2xl md:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">{weekday}, <span className="text-zinc-500 dark:text-zinc-400">{dateNum}</span></h3>
                          </div>

                          <div className="space-y-6 md:pl-[5.5rem]">
                            {groupedActivities[date].map((act) => {
                              const isExpanded = expandedIds.includes(act.id);
                              
                              return (
                                <div key={act.id} className="group relative bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 rounded-[1.5rem] md:rounded-[2rem] shadow-sm hover:border-zinc-400 dark:hover:border-zinc-600 transition-all duration-300 print:border-zinc-300 print:shadow-none">
                                  
                                  {/* Timeline Node */}
                                  <div className="absolute top-1/2 -translate-y-1/2 -left-[4.3rem] w-4 h-4 rounded-full bg-white dark:bg-zinc-950 border-4 border-zinc-300 dark:border-zinc-700 hidden md:block group-hover:border-emerald-500 group-hover:scale-125 transition-all z-10"></div>

                                  <div className="p-5 md:p-8 cursor-pointer" onClick={() => toggleExpand(act.id)}>
                                    <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-8">
                                      <div className="flex items-center md:flex-col md:justify-center md:w-24 shrink-0 bg-transparent p-0 rounded-none border-none md:border-r md:border-zinc-200 dark:md:border-zinc-800 md:pr-6">
                                        <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-zinc-100 dark:bg-zinc-800 flex items-center justify-center mr-3 md:mr-0 md:mb-3 group-hover:scale-110 transition-transform">
                                          {getIcon(act.type)}
                                        </div>
                                        <span className="text-lg md:text-sm font-bold text-zinc-900 dark:text-white tracking-tight">{act.time}</span>
                                      </div>

                                      <div className="flex-1 min-w-0">
                                        <div className="flex items-center gap-2 mb-2">
                                          <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-3 py-0.5 rounded-full">{act.type}</span>
                                          {act.trackingNumber && <span className="text-[10px] font-bold uppercase tracking-wider text-zinc-400 dark:text-zinc-500 flex items-center ml-2"><Hash className="h-3 w-3 mr-0.5"/> {act.trackingNumber}</span>}
                                        </div>
                                        <h4 className="text-xl md:text-3xl font-bold text-zinc-900 dark:text-white truncate tracking-tight">{act.title}</h4>
                                        {act.location && !isExpanded && (
                                          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2 flex items-center truncate"><MapPin className="h-3.5 w-3.5 mr-1.5 shrink-0"/> {act.location}</p>
                                        )}
                                      </div>

                                      <div className="flex items-center justify-end gap-2 md:ml-4 border-t border-zinc-100 dark:border-zinc-800/50 md:border-none pt-3 md:pt-0 mt-2 md:mt-0">
                                        <button onClick={(e) => { e.stopPropagation(); handleDeleteActivity(act.id); }} className="p-3 text-zinc-400 hover:text-white hover:bg-rose-500 rounded-full transition-all print:hidden opacity-100 md:opacity-0 group-hover:opacity-100" title="Delete Activity">
                                          <Trash2 className="h-4 w-4" />
                                        </button>
                                        <div className={`p-2.5 rounded-full transition-colors border border-transparent ${isExpanded ? 'bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white' : 'bg-transparent text-zinc-400 group-hover:border-zinc-200 dark:group-hover:border-zinc-700'}`}>
                                          {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                  
                                  {isExpanded && (
                                    <div className="bg-zinc-50 dark:bg-zinc-900/30 border-t border-zinc-200 dark:border-zinc-800/50 p-6 md:p-8 md:pl-[8.5rem] animate-in slide-in-from-top-2 fade-in duration-300 print:pl-4 print:bg-white rounded-b-[1.5rem] md:rounded-b-[2rem]">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-4">
                                          <div className="flex items-start gap-4">
                                            <div className="h-8 w-8 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-sm"><MapPin className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" /></div>
                                            <div className="flex-1 pt-1">
                                              <p className="text-sm font-bold text-zinc-900 dark:text-zinc-200 mb-3 leading-relaxed">{act.location || "No address provided"}</p>
                                              <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.location || act.title)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-zinc-900 dark:text-white bg-white dark:bg-zinc-800 hover:bg-zinc-100 dark:hover:bg-zinc-700 px-5 py-2.5 rounded-full transition-colors print:hidden shadow-sm border border-zinc-200 dark:border-zinc-700">
                                                <Navigation className="h-3 w-3 mr-2" /> Get Directions
                                              </a>
                                            </div>
                                          </div>
                                        </div>

                                        <div className="space-y-4">
                                          <div className="flex items-start gap-4">
                                            <div className="h-8 w-8 rounded-full bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 flex items-center justify-center shrink-0 shadow-sm"><Info className="h-3.5 w-3.5 text-zinc-500 dark:text-zinc-400" /></div>
                                            <div className="flex-1 pt-1">
                                              <p className="text-sm font-medium text-zinc-600 dark:text-zinc-400 leading-relaxed italic">"{act.notes || "No additional notes for this event."}"</p>
                                            </div>
                                          </div>

                                          {(act.type === 'flight' || act.type === 'train') && (
                                            <div className="flex justify-end pt-4">
                                              <button onClick={(e) => { e.stopPropagation(); handleTrackStatus(act.title, act.type, act.trackingNumber); }} className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest text-zinc-950 bg-emerald-500 hover:bg-emerald-400 px-6 py-3 rounded-full transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] print:hidden w-full md:w-auto justify-center">
                                                <PlaneTakeoff className="h-4 w-4 mr-2" /> Live Status Tracker
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ======================================================= */}
            {/* TAB 2: LIVE MAP (New Broadcast Feature)                   */}
            {/* ======================================================= */}
            {activeTab === 'live_map' && (
              <div className="h-[70vh] rounded-[2rem] overflow-hidden relative shadow-lg border border-zinc-200 dark:border-zinc-800 animate-in fade-in slide-in-from-bottom-4 duration-500 bg-zinc-950">
                
                {/* Live Controls Overlay */}
                <div className="absolute top-6 left-6 z-[1000] bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl p-6 rounded-3xl shadow-2xl border border-zinc-200 dark:border-zinc-800 w-64">
                   <h3 className="font-bold text-zinc-900 dark:text-white flex items-center mb-2 tracking-tight">
                     <span className="relative flex h-3 w-3 mr-3">
                       {isBroadcasting && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                       <span className={`relative inline-flex rounded-full h-3 w-3 ${isBroadcasting ? 'bg-emerald-500' : 'bg-zinc-300 dark:bg-zinc-700'}`}></span>
                     </span>
                     Group Radar
                   </h3>
                   <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-6 leading-relaxed">Share your live location with members of this trip.</p>
                   
                   <button 
                     onClick={() => setIsBroadcasting(!isBroadcasting)} 
                     className={`w-full py-3.5 px-4 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center active:scale-95 ${isBroadcasting ? 'bg-rose-500/10 text-rose-500 border border-rose-500/20 hover:bg-rose-500/20' : 'bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 hover:opacity-90 shadow-lg'}`}
                   >
                     {isBroadcasting ? 'Stop Broadcast' : 'Go Live Now'}
                   </button>
                </div>

                {/* Info Overlay */}
                <div className="absolute bottom-6 right-6 z-[1000] bg-zinc-900/80 backdrop-blur-md px-5 py-2.5 rounded-full border border-zinc-800 text-white text-[10px] font-bold uppercase tracking-widest flex items-center shadow-lg">
                   <Users className="h-4 w-4 mr-2 text-emerald-500" />
                   {liveMembers.length} {liveMembers.length === 1 ? 'member' : 'members'} live
                </div>

                {/* ✨ DYNAMICALLY LOADED RADAR MAP */}
                <DynamicRadarMap myLatestCoords={myLatestCoords} liveMembers={liveMembers} />

              </div>
            )}
          </div>
        </main>
      </div>

      {/* --- AI GENERATOR MODAL (EDITORIAL) --- */}
      {showAiModal && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-zinc-950 rounded-[2rem] p-8 md:p-12 w-full max-w-xl shadow-2xl relative animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
            
            <button onClick={() => !isAiLoading && setShowAiModal(false)} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-full transition-colors">
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="h-12 w-12 rounded-full bg-zinc-900 dark:bg-white flex items-center justify-center shadow-sm">
                <Sparkles className="h-5 w-5 text-white dark:text-zinc-900" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">AI Trip Architect</h2>
                <p className="text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest mt-1">Powered by Gemini</p>
              </div>
            </div>

            {isAiLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-zinc-50 dark:bg-zinc-900/30 rounded-3xl border border-zinc-200 dark:border-zinc-800">
                <div className="relative">
                  <div className="absolute inset-0 bg-emerald-500 blur-xl opacity-20 rounded-full animate-pulse"></div>
                  <Loader2 className="relative h-10 w-10 text-emerald-500 animate-spin mb-6" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Designing your dream trip...</h3>
                <p className="text-zinc-500 dark:text-zinc-400 mt-2 font-medium text-sm">Cross-referencing locations, opening hours, and travel times.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest mb-3">Describe your ideal journey</label>
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Build a 3-day romantic anniversary weekend in Paris. Include a visit to the Louvre, dinner at a Michelin star restaurant, and a sunset boat cruise..."
                    className="w-full h-40 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 text-zinc-900 dark:text-white focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none font-medium text-sm transition-all leading-relaxed placeholder-zinc-400"
                  />
                </div>
                <button 
                  onClick={handleGenerateItinerary}
                  disabled={!aiPrompt.trim()}
                  className="w-full bg-emerald-500 text-zinc-950 py-4 rounded-full font-bold text-sm uppercase tracking-widest hover:bg-emerald-400 transition-all disabled:opacity-50 active:scale-95 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.2)] group"
                >
                  <Sparkles className="h-4 w-4 mr-2 group-hover:animate-pulse" /> Generate Magic Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- LIVE TRACKER MODAL (Aviation/Train API) --- */}
      {isTrackerOpen && (
        <div className="fixed inset-0 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[60]">
          <div className="bg-zinc-950 rounded-[2.5rem] p-8 md:p-10 w-full max-w-md shadow-2xl relative overflow-hidden border border-zinc-800 animate-in zoom-in-95 duration-200">
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay pointer-events-none"></div>
            
            {/* Minimalist Radar Rings */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] border border-emerald-500/10 rounded-full animate-[ping_3s_linear_infinite]"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] border border-emerald-500/5 rounded-full animate-[ping_3s_linear_infinite_1s]"></div>

            <button onClick={() => setIsTrackerOpen(false)} className="absolute top-6 right-6 text-zinc-500 hover:text-white bg-zinc-900 hover:bg-zinc-800 p-2.5 rounded-full transition-colors z-20">
              <X className="h-4 w-4" />
            </button>
            
            <h2 className="text-xl font-bold text-white mb-10 flex items-center relative z-10 tracking-tight">
              <span className="relative flex h-3 w-3 mr-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
              </span>
              Global Radar Sync
            </h2>

            {isTrackingLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-zinc-400 relative z-10">
                <div className="relative">
                  <Loader2 className="relative h-10 w-10 text-emerald-500 animate-spin mb-6" />
                </div>
                <p className="font-bold text-[10px] uppercase tracking-widest text-emerald-400/80 animate-pulse">Locating signal...</p>
              </div>
            ) : trackingData ? (
              <div className="relative z-10 animate-in fade-in duration-500">
                <div className="text-center mb-10">
                  <span className="inline-block px-4 py-1.5 bg-zinc-900 border border-zinc-800 text-zinc-300 font-bold text-[10px] rounded-full uppercase tracking-widest mb-4">{trackingData.type} {trackingData.number}</span>
                  <h3 className="text-3xl font-black text-white tracking-tighter">{trackingData.status}</h3>
                </div>
                
                <div className="relative pt-6 pb-8 px-2">
                  <div className="overflow-hidden h-1 mb-4 flex rounded-full bg-zinc-800">
                    <div style={{ width: `${trackingData.progress}%` }} className="shadow-[0_0_15px_rgba(16,185,129,0.5)] flex flex-col text-center whitespace-nowrap text-white justify-center bg-emerald-500 transition-all duration-1000 ease-out"></div>
                  </div>
                  <div className="absolute top-2.5 transition-all duration-1000 ease-out" style={{ left: `calc(${trackingData.progress}% - 14px)` }}>
                    <Plane className="h-6 w-6 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]" />
                  </div>
                  <div className="flex justify-between text-[9px] font-bold text-zinc-500 uppercase tracking-widest mt-2">
                    <span>Origin</span>
                    <span>Dest</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-zinc-900/80 backdrop-blur-md rounded-3xl p-5 border border-zinc-800 hover:border-zinc-700 transition-colors text-center">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Departure</p>
                    <p className="text-2xl font-black text-white tracking-tighter mb-2">{trackingData.departure.time}</p>
                    <div className="flex items-center justify-center text-xs font-bold text-zinc-300"><MapPin className="h-3 w-3 mr-1 text-emerald-500"/> {trackingData.departure.city}</div>
                    <div className="mt-4 pt-3 border-t border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Gate <span className="text-white">{trackingData.departure.gate || trackingData.departure.platform}</span></div>
                  </div>
                  <div className="bg-zinc-900/80 backdrop-blur-md rounded-3xl p-5 border border-zinc-800 hover:border-zinc-700 transition-colors text-center">
                    <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Arrival</p>
                    <p className="text-2xl font-black text-white tracking-tighter mb-2">{trackingData.arrival.time}</p>
                    <div className="flex items-center justify-center text-xs font-bold text-zinc-300"><MapPin className="h-3 w-3 mr-1 text-emerald-500"/> {trackingData.arrival.city}</div>
                    <div className="mt-4 pt-3 border-t border-zinc-800 text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Gate <span className="text-white">{trackingData.arrival.gate || trackingData.arrival.platform}</span></div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}