"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc, addDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Printer, Clock, MapPin, Plane, Hotel, Utensils, Trash2, Map as MapIcon, CalendarPlus, ChevronDown, ChevronUp, AlignLeft, Navigation, BedDouble, Sparkles, Loader2, Menu, X, Sun, CloudRain, Hash, Info, ArrowRight } from "lucide-react";

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
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [activities, setActivities] = useState<Activity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  
  // LIVE TRACKER STATE
  const [isTrackerOpen, setIsTrackerOpen] = useState(false);
  const [isTrackingLoading, setIsTrackingLoading] = useState(false);
  const [trackingData, setTrackingData] = useState<any>(null);

  // AI GENERATOR STATE
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // MOBILE MENU STATE
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- NEW: WEATHER FORECAST STATE ---
  const [weatherData, setWeatherData] = useState<any[]>([]);
  const [isWeatherLoading, setIsWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState("");

  // THE REAL API FETCH FUNCTION
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

  // THE AI GENERATE FUNCTION
  const handleGenerateItinerary = async () => {
    if (!aiPrompt.trim() || !selectedTripId) return;
    
    setIsAiLoading(true);
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().split('T')[0];

      const response = await fetch('/api/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, startDate: startDate })
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

  // 1. Auth & Fetch Trips
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const q = query(collection(db, "trips"), where("members", "array-contains", currentUser.uid));
        onSnapshot(q, (snapshot) => {
          const tripsData = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
          setTrips(tripsData);
          if (tripsData.length > 0 && !selectedTripId) setSelectedTripId(tripsData[0].id);
        });
      } else {
        setIsLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [selectedTripId]);

  // 2. Fetch Activities for Selected Trip
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

  // --- NEW: FETCH LIVE WEATHER ---
  useEffect(() => {
    if (!selectedTripId || trips.length === 0) return;
    
    const fetchWeather = async () => {
      setIsWeatherLoading(true);
      setWeatherError("");
      setWeatherData([]);
      
      try {
        const currentTrip = trips.find(t => t.id === selectedTripId);
        if (!currentTrip || !currentTrip.title) return;

        // Extract the last word of the title as the city (e.g., "Trip to Paris" -> "Paris")
        // This helps the weather API find the correct location!
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

  // 3. Delete Activity Logic
  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Are you sure you want to remove this from the itinerary?")) return;
    try {
      await deleteDoc(doc(db, "activities", activityId));
    } catch (error) {
      console.error("Error deleting activity:", error);
      alert("Failed to delete. Please try again.");
    }
  };

  // 4. Export to Calendar (.ics) Logic
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
      case 'flight': return <Plane className="h-5 w-5 text-sky-500" />;
      case 'hotel': return <Hotel className="h-5 w-5 text-indigo-500" />;
      case 'food': return <Utensils className="h-5 w-5 text-orange-500" />;
      default: return <MapPin className="h-5 w-5 text-emerald-500" />;
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
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
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-bold shadow-sm transition-colors">
            <Calendar className="h-5 w-5 mr-3" /> Itineraries
          </Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <CreditCard className="h-5 w-5 mr-3" /> Expenses
          </Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <BedDouble className="h-5 w-5 mr-3" /> Book Hotels
          </Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-semibold transition-colors">
            <Settings className="h-5 w-5 mr-3" /> Settings
          </Link>
        </nav>
      </aside>

      {/* MAIN CONTENT AREA */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-16 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-30 print:hidden sticky top-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-purple-600">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* DESKTOP/TABLET HEADER */}
        <header className="h-auto md:h-20 py-4 md:py-0 bg-white/80 backdrop-blur-xl border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between px-6 md:px-10 z-20 print:hidden shrink-0 gap-4 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-slate-900 hidden md:block tracking-tight">Master Schedule</h2>
            <p className="text-sm font-medium text-slate-500 hidden md:block mt-0.5">Plan and track your group journey.</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 md:gap-5 w-full md:w-auto justify-between md:justify-end">
            <div className="relative flex-1 md:flex-none group">
              <MapIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 group-hover:text-indigo-500 transition-colors pointer-events-none" />
              <select 
                value={selectedTripId} 
                onChange={(e) => setSelectedTripId(e.target.value)}
                className="w-full appearance-none border border-slate-200 hover:border-slate-300 rounded-xl pl-10 pr-10 py-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 bg-white font-bold text-slate-700 shadow-sm transition-all cursor-pointer max-w-[200px] md:max-w-[240px] truncate"
              >
                {trips.length === 0 ? <option>No trips found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
              </select>
              <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            </div>

            <div className="flex items-center gap-2 md:gap-3">
              <button 
                onClick={() => setShowAiModal(true)} 
                disabled={trips.length === 0} 
                className="flex items-center bg-slate-900 text-white px-4 md:px-5 py-2.5 md:py-2.5 rounded-xl font-bold hover:bg-indigo-600 hover:shadow-lg hover:shadow-indigo-500/20 transition-all disabled:opacity-50 disabled:hover:bg-slate-900 shadow-md text-sm group"
              >
                <Sparkles className="h-4 w-4 md:mr-2 text-indigo-400 group-hover:text-white transition-colors" /> <span className="hidden md:inline">Magic Plan</span>
              </button>

              <button onClick={handleExportCalendar} disabled={activities.length === 0} className="flex items-center bg-white border border-slate-200 text-slate-700 px-3.5 md:px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 text-sm shadow-sm group" title="Sync to Calendar">
                <CalendarPlus className="h-4 w-4 group-hover:text-indigo-600 transition-colors md:mr-2" /> <span className="hidden lg:inline">Sync</span>
              </button>
              <button onClick={() => window.print()} disabled={activities.length === 0} className="flex items-center bg-white border border-slate-200 text-slate-700 px-3.5 md:px-4 py-2.5 rounded-xl font-bold hover:bg-slate-50 hover:border-slate-300 transition-all disabled:opacity-50 text-sm shadow-sm group" title="Print Itinerary">
                <Printer className="h-4 w-4 group-hover:text-indigo-600 transition-colors md:mr-2" /> <span className="hidden lg:inline">Print</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 print:p-0 print:bg-white bg-[#f8fafc] custom-scrollbar">
          <div className="max-w-4xl mx-auto pb-24">
            
            {/* --- PRO WEATHER WIDGET --- */}
            {selectedTripId && !isWeatherLoading && weatherData.length > 0 && (
              <div className="mb-10 relative overflow-hidden rounded-[2rem] p-8 print:hidden animate-in fade-in slide-in-from-top-8 duration-700 shadow-xl border border-indigo-500/10">
                {/* Dynamic Backgrounds */}
                <div className="absolute inset-0 bg-gradient-to-br from-indigo-600 via-blue-600 to-sky-400"></div>
                <div className="absolute top-[-50%] right-[-10%] w-[500px] h-[500px] bg-white/20 rounded-full blur-[80px]"></div>
                <div className="absolute bottom-[-30%] left-[-10%] w-[300px] h-[300px] bg-indigo-900/30 rounded-full blur-[60px]"></div>
                
                {/* Content */}
                <div className="relative z-10">
                  <div className="flex items-center justify-between mb-8 border-b border-white/20 pb-4">
                    <h3 className="text-xl font-black text-white flex items-center tracking-tight">
                      <Sun className="h-6 w-6 mr-3 text-amber-300"/> Destination Forecast
                    </h3>
                    <span className="text-xs font-bold text-sky-100 uppercase tracking-widest bg-black/20 px-3 py-1 rounded-full backdrop-blur-sm">Live API</span>
                  </div>
                  
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                    {weatherData.slice(0, 5).map((day: any, idx: number) => {
                      const dateObj = new Date(day.dt * 1000);
                      const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                      const dateNum = dateObj.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                      const temp = Math.round(day.main.temp);
                      const iconUrl = `https://openweathermap.org/img/wn/${day.weather[0].icon}@4x.png`;
                      
                      return (
                        <div key={idx} className="bg-black/10 backdrop-blur-xl rounded-2xl p-5 flex flex-col items-center text-center border border-white/10 hover:bg-black/20 hover:-translate-y-1 transition-all duration-300 shadow-inner group">
                          <p className="text-[10px] font-black uppercase tracking-widest text-sky-200 mb-0.5">{weekday}</p>
                          <p className="text-xs font-bold text-white/80 mb-2">{dateNum}</p>
                          
                          <div className="relative h-16 w-16 mb-2 group-hover:scale-110 transition-transform duration-500">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={iconUrl} alt="weather icon" className="absolute inset-0 w-full h-full object-contain drop-shadow-2xl filter brightness-110" />
                          </div>
                          
                          <p className="text-3xl font-black text-white tracking-tighter drop-shadow-md">{temp}°</p>
                          <p className="text-[11px] font-semibold text-sky-100 capitalize mt-2 bg-white/10 px-2.5 py-1 rounded-lg w-full truncate">{day.weather[0].description}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
            
            {/* Loading/Error States for Weather */}
            {selectedTripId && isWeatherLoading && (
              <div className="mb-10 bg-white rounded-[2rem] p-8 border border-slate-200 shadow-sm flex flex-col items-center justify-center h-48 animate-pulse print:hidden">
                <Loader2 className="h-8 w-8 mb-4 animate-spin text-indigo-400" /> 
                <p className="text-slate-500 font-bold text-sm uppercase tracking-widest">Connecting to Weather Satellites...</p>
              </div>
            )}
            {selectedTripId && weatherError && !isWeatherLoading && (
              <div className="mb-10 bg-slate-100 rounded-[2rem] p-6 border border-slate-200 text-slate-500 font-medium flex items-center justify-center print:hidden shadow-inner">
                <CloudRain className="h-5 w-5 mr-3 text-slate-400" /> {weatherError}
              </div>
            )}
            {/* --- END WEATHER WIDGET --- */}

            {trips.length === 0 ? (
               <div className="text-center py-24 md:py-32">
                 <div className="h-24 w-24 bg-white rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-center mx-auto mb-6 rotate-3">
                   <Calendar className="h-10 w-10 text-indigo-400" />
                 </div>
                 <h3 className="text-3xl font-black text-slate-900 tracking-tight">No Trips Found</h3>
                 <p className="text-slate-500 font-medium mt-3 text-lg">Head back to the dashboard to start planning.</p>
                 <Link href="/" className="inline-flex mt-8 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-600 transition-colors shadow-lg shadow-slate-900/20">Go to Dashboard</Link>
               </div>
            ) : activities.length === 0 ? (
               <div className="text-center py-20 md:py-28 bg-white rounded-[2.5rem] border border-slate-200 shadow-xl shadow-slate-200/50 print:hidden px-6 relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-purple-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4"></div>
                 <div className="absolute bottom-0 left-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4"></div>
                 
                 <div className="relative z-10">
                   <div className="h-20 w-20 bg-gradient-to-br from-purple-100 to-indigo-100 rounded-[2rem] flex items-center justify-center mx-auto mb-6 shadow-inner border border-white">
                     <Sparkles className="h-10 w-10 text-purple-600" />
                   </div>
                   <h3 className="text-3xl font-black text-slate-900 tracking-tight">Your canvas is blank.</h3>
                   <p className="text-slate-500 font-medium mt-3 mb-10 max-w-md mx-auto text-lg leading-relaxed">Let our AI engine build a complete, optimized itinerary for you in seconds.</p>
                   <button onClick={() => setShowAiModal(true)} className="w-full md:w-auto bg-slate-900 text-white px-8 py-4 rounded-2xl font-black text-lg hover:bg-purple-600 hover:scale-105 transition-all shadow-xl shadow-slate-900/20 flex items-center justify-center mx-auto group">
                     Generate Magic Schedule <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                   </button>
                 </div>
               </div>
            ) : (
              <div className="space-y-12 md:space-y-16 relative">
                
                {/* Global timeline connecting line */}
                <div className="absolute left-6 md:left-[3.25rem] top-24 bottom-10 w-0.5 bg-slate-200 print:hidden hidden md:block"></div>

                <div className="hidden print:block mb-10 pb-6 border-b-2 border-slate-900">
                  <h1 className="text-4xl font-black text-slate-900">{trips.find(t => t.id === selectedTripId)?.title} - Master Itinerary</h1>
                  <p className="text-slate-500 font-bold mt-2">Generated securely by WanderHub</p>
                </div>

                {sortedDates.map((date, index) => {
                  const dateObj = new Date(date);
                  const weekday = dateObj.toLocaleDateString('en-US', { weekday: 'long' });
                  const dateNum = dateObj.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });

                  return (
                    <div key={date} className="relative z-10">
                      
                      {/* Date Header */}
                      <div className="sticky top-16 md:top-20 bg-[#f8fafc]/90 backdrop-blur-xl print:bg-transparent z-20 py-4 mb-6 flex flex-col md:flex-row md:items-center gap-1 md:gap-4 md:ml-2">
                        <div className="bg-indigo-600 text-white px-4 py-1.5 rounded-full text-sm font-black tracking-widest uppercase shadow-md inline-block w-max">Day {index + 1}</div>
                        <h3 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">{weekday}, <span className="text-slate-500">{dateNum}</span></h3>
                      </div>

                      {/* Day's Activities */}
                      <div className="space-y-4 md:pl-[6.5rem]">
                        {groupedActivities[date].map((act) => {
                          const isExpanded = expandedIds.includes(act.id);
                          
                          return (
                            <div key={act.id} className="group relative bg-white border border-slate-200 rounded-[1.5rem] shadow-sm hover:shadow-xl hover:border-indigo-300 transition-all duration-300 print:border-slate-300 print:shadow-none">
                              
                              {/* Horizontal connector line (desktop) */}
                              <div className="absolute top-1/2 -translate-y-1/2 -left-12 w-12 h-0.5 bg-slate-200 hidden md:block group-hover:bg-indigo-200 transition-colors"></div>
                              
                              {/* Icon Node (desktop) */}
                              <div className="absolute top-1/2 -translate-y-1/2 -left-[3.75rem] w-4 h-4 rounded-full bg-white border-4 border-slate-300 hidden md:block group-hover:border-indigo-500 group-hover:scale-125 transition-all shadow-sm"></div>

                              <div className="p-4 md:p-6 cursor-pointer" onClick={() => toggleExpand(act.id)}>
                                <div className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6">
                                  
                                  {/* Time & Icon Block */}
                                  <div className="flex items-center md:flex-col md:justify-center md:w-28 shrink-0 bg-slate-50 md:bg-transparent p-3 md:p-0 rounded-xl md:rounded-none border border-slate-100 md:border-none md:border-r md:border-slate-100 md:pr-6">
                                    <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-white md:bg-slate-50 border border-slate-200 md:border-none flex items-center justify-center shadow-sm md:shadow-none mr-3 md:mr-0 md:mb-2 group-hover:scale-110 transition-transform">
                                      {getIcon(act.type)}
                                    </div>
                                    <span className="text-lg md:text-base font-black text-slate-900 tracking-tight">{act.time}</span>
                                  </div>

                                  {/* Content Block */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5">
                                      <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-md">{act.type}</span>
                                      {act.trackingNumber && <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 border border-slate-200 px-2 py-0.5 rounded-md flex items-center"><Hash className="h-3 w-3 mr-0.5"/> {act.trackingNumber}</span>}
                                    </div>
                                    <h4 className="text-xl md:text-2xl font-black text-slate-800 truncate tracking-tight">{act.title}</h4>
                                    {act.location && !isExpanded && (
                                      <p className="text-sm font-medium text-slate-500 mt-1 flex items-center truncate"><MapPin className="h-3.5 w-3.5 mr-1.5 shrink-0"/> {act.location}</p>
                                    )}
                                  </div>

                                  {/* Actions Block */}
                                  <div className="flex items-center justify-end gap-2 md:ml-4 border-t border-slate-100 md:border-none pt-3 md:pt-0 mt-2 md:mt-0">
                                    <button onClick={(e) => { e.stopPropagation(); handleDeleteActivity(act.id); }} className="p-2.5 text-slate-300 hover:text-white hover:bg-red-500 rounded-xl transition-all print:hidden opacity-100 md:opacity-0 group-hover:opacity-100" title="Delete Activity">
                                      <Trash2 className="h-5 w-5" />
                                    </button>
                                    <div className={`p-2 rounded-xl transition-colors ${isExpanded ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-50 text-slate-400 group-hover:bg-slate-100'}`}>
                                      {isExpanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              
                              {/* EXPANDED DETAILS AREA */}
                              {isExpanded && (
                                <div className="bg-slate-50/50 border-t border-slate-100 p-5 md:p-6 md:pl-[9.5rem] animate-in slide-in-from-top-4 fade-in duration-300 print:pl-4 print:bg-white rounded-b-[1.5rem]">
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    
                                    {/* Info Left */}
                                    <div className="space-y-4">
                                      <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm"><MapPin className="h-4 w-4 text-slate-500" /></div>
                                        <div className="flex-1 pt-1">
                                          <p className="text-sm font-bold text-slate-900 mb-2">{act.location || "No address provided"}</p>
                                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.location || act.title)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs font-black uppercase tracking-wider text-indigo-600 hover:text-white bg-indigo-50 hover:bg-indigo-600 px-4 py-2 rounded-lg transition-colors print:hidden shadow-sm border border-indigo-100 hover:border-transparent">
                                            <Navigation className="h-3 w-3 mr-2" /> Get Directions
                                          </a>
                                        </div>
                                      </div>
                                    </div>

                                    {/* Info Right */}
                                    <div className="space-y-4">
                                      <div className="flex items-start gap-3">
                                        <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0 shadow-sm"><Info className="h-4 w-4 text-slate-500" /></div>
                                        <div className="flex-1 pt-1">
                                          <p className="text-sm font-medium text-slate-600 leading-relaxed italic border-l-2 border-indigo-200 pl-3 py-1 bg-white rounded-r-lg shadow-sm">"{act.notes || "No additional notes for this event."}"</p>
                                        </div>
                                      </div>

                                      {/* Tracking Button */}
                                      {(act.type === 'flight' || act.type === 'train') && (
                                        <div className="flex justify-end pt-2">
                                          <button onClick={(e) => { e.stopPropagation(); handleTrackStatus(act.title, act.type, act.trackingNumber); }} className="inline-flex items-center text-sm font-black text-white bg-slate-900 hover:bg-sky-600 px-5 py-2.5 rounded-xl transition-all shadow-lg hover:shadow-sky-500/30 print:hidden w-full md:w-auto justify-center">
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
        </main>
      </div>

      {/* --- AI GENERATOR MODAL --- */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-md z-[60]">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 w-full max-w-xl shadow-2xl relative animate-in zoom-in-95 duration-300 overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-purple-500 to-indigo-500"></div>
            
            <button onClick={() => !isAiLoading && setShowAiModal(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-full transition-colors">✕</button>
            
            <div className="flex items-center gap-4 mb-8">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-purple-100 to-indigo-100 flex items-center justify-center shadow-inner border border-white">
                <Sparkles className="h-7 w-7 text-purple-600" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 tracking-tight">AI Trip Architect</h2>
                <p className="text-slate-500 text-sm font-bold mt-1">Powered by Gemini Engine</p>
              </div>
            </div>

            {isAiLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-center bg-slate-50 rounded-[2rem] border border-slate-100">
                <div className="relative">
                  <div className="absolute inset-0 bg-purple-400 blur-xl opacity-50 rounded-full animate-pulse"></div>
                  <Loader2 className="relative h-14 w-14 text-purple-600 animate-spin mb-6" />
                </div>
                <h3 className="text-xl font-black text-slate-800 tracking-tight">Designing your dream trip...</h3>
                <p className="text-slate-500 mt-2 font-medium">Cross-referencing locations, opening hours, and travel times. This takes about 5-10 seconds.</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div>
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Describe your ideal journey</label>
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. Build a 3-day romantic anniversary weekend in Paris. Include a visit to the Louvre, dinner at a Michelin star restaurant, and a sunset boat cruise..."
                    className="w-full h-40 bg-slate-50 border border-slate-200 rounded-[1.5rem] p-5 text-slate-800 focus:ring-4 focus:ring-purple-500/10 focus:border-purple-500 outline-none resize-none font-medium text-base shadow-inner transition-all leading-relaxed"
                  />
                </div>
                <button 
                  onClick={handleGenerateItinerary}
                  disabled={!aiPrompt.trim()}
                  className="w-full bg-slate-900 text-white py-4 md:py-5 rounded-2xl font-black text-lg hover:bg-purple-600 hover:-translate-y-1 transition-all disabled:opacity-50 disabled:hover:translate-y-0 disabled:hover:bg-slate-900 shadow-xl shadow-slate-900/20 flex items-center justify-center group"
                >
                  <Sparkles className="h-5 w-5 mr-2 group-hover:animate-pulse" /> Generate Magic Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- LIVE TRACKER MODAL --- */}
      {isTrackerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-md z-[60]">
          <div className="bg-slate-900 rounded-[2.5rem] p-8 w-full max-w-md shadow-2xl relative overflow-hidden border border-slate-700 animate-in zoom-in-95 duration-300">
            {/* Radar Background */}
            <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay pointer-events-none"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 border border-sky-500/20 rounded-full animate-ping"></div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 border border-sky-500/10 rounded-full animate-ping delay-300"></div>

            <button onClick={() => setIsTrackerOpen(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white bg-white/5 hover:bg-white/10 p-2.5 rounded-full transition-colors z-20">✕</button>
            
            <h2 className="text-xl font-black text-white mb-8 flex items-center relative z-10 tracking-tight">
              <span className="relative flex h-3 w-3 mr-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.8)]"></span>
              </span>
              Global Radar Sync
            </h2>

            {isTrackingLoading ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-400 relative z-10">
                <div className="relative">
                  <div className="absolute inset-0 bg-sky-500 blur-xl opacity-30 rounded-full animate-pulse"></div>
                  <Loader2 className="relative h-12 w-12 text-sky-400 animate-spin mb-6" />
                </div>
                <p className="font-bold text-sm uppercase tracking-widest text-sky-300 animate-pulse">Locating signal...</p>
              </div>
            ) : trackingData ? (
              <div className="relative z-10 animate-in fade-in duration-500">
                <div className="text-center mb-8">
                  <span className="inline-block px-4 py-1.5 bg-sky-500/20 border border-sky-500/30 text-sky-300 font-black text-[10px] rounded-full uppercase tracking-widest mb-3 backdrop-blur-md shadow-[0_0_15px_rgba(14,165,233,0.3)]">{trackingData.type} {trackingData.number}</span>
                  <h3 className="text-3xl font-black text-white tracking-tight drop-shadow-md">{trackingData.status}</h3>
                </div>
                
                {/* Flight Path Visualization */}
                <div className="relative pt-6 pb-8 px-4">
                  <div className="overflow-hidden h-1.5 mb-4 flex rounded-full bg-slate-800">
                    <div style={{ width: `${trackingData.progress}%` }} className="shadow-[0_0_15px_rgba(14,165,233,0.8)] flex flex-col text-center whitespace-nowrap text-white justify-center bg-sky-400 transition-all duration-1000 ease-out"></div>
                  </div>
                  <div className="absolute top-2.5 transition-all duration-1000 ease-out" style={{ left: `calc(${trackingData.progress}% - 14px)` }}>
                    <Plane className="h-7 w-7 text-white drop-shadow-[0_0_10px_rgba(255,255,255,0.8)]" />
                  </div>
                  <div className="flex justify-between text-[10px] font-black text-slate-500 uppercase tracking-widest mt-2">
                    <span>Origin</span>
                    <span>Dest</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-colors">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Departure</p>
                    <p className="text-2xl font-black text-white tracking-tight mb-1">{trackingData.departure.time}</p>
                    <div className="flex items-center text-xs font-bold text-sky-400"><MapPin className="h-3 w-3 mr-1"/> {trackingData.departure.city}</div>
                    <div className="mt-3 pt-3 border-t border-white/10 text-xs font-medium text-slate-300">Gate <span className="font-bold text-white">{trackingData.departure.gate || trackingData.departure.platform}</span></div>
                  </div>
                  <div className="bg-white/5 backdrop-blur-md rounded-2xl p-5 border border-white/10 hover:bg-white/10 transition-colors">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Arrival</p>
                    <p className="text-2xl font-black text-white tracking-tight mb-1">{trackingData.arrival.time}</p>
                    <div className="flex items-center text-xs font-bold text-emerald-400"><MapPin className="h-3 w-3 mr-1"/> {trackingData.arrival.city}</div>
                    <div className="mt-3 pt-3 border-t border-white/10 text-xs font-medium text-slate-300">Gate <span className="font-bold text-white">{trackingData.arrival.gate || trackingData.arrival.platform}</span></div>
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