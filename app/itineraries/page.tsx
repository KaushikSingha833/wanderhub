"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
// NEW: Added addDoc to the import list!
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc, addDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
// NEW: Added Menu and X to the icons list for the mobile drawer!
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Printer, Clock, MapPin, Plane, Hotel, Utensils, Trash2, Map as MapIcon, CalendarPlus, ChevronDown, ChevronUp, AlignLeft, Navigation, BedDouble, Sparkles, Loader2, Menu, X } from "lucide-react";

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

  // --- NEW: AI GENERATOR STATE ---
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiLoading, setIsAiLoading] = useState(false);

  // --- NEW: MOBILE MENU STATE ---
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- THE REAL API FETCH FUNCTION ---
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

  // --- NEW: THE AI GENERATE FUNCTION ---
  const handleGenerateItinerary = async () => {
    if (!aiPrompt.trim() || !selectedTripId) return;
    
    setIsAiLoading(true);
    try {
      // Calculate tomorrow's date dynamically to give the AI a realistic starting point
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const startDate = tomorrow.toISOString().split('T')[0];

      // Ping our secure Next.js backend!
      const response = await fetch('/api/generate-itinerary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: aiPrompt, startDate: startDate })
      });
      
      const data = await response.json();

      if (data.activities && data.activities.length > 0) {
        // Loop through the AI's response and save each item into Firebase!
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

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;

  return (
    // Added overflow-hidden here to lock the screen when mobile menu is open
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* --- NEW: MOBILE BLUR OVERLAY --- */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-40 md:hidden transition-opacity"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* --- UPDATED: RESPONSIVE SIDEBAR --- */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out print:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">
              WanderHub
            </span>
          </div>
          {/* NEW: Mobile Close X Button */}
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg bg-slate-50">
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          {/* Added onClick to all links so the menu closes when a user clicks a page */}
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors">
            <Map className="h-5 w-5 mr-3" /> Dashboard
          </Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium transition-colors">
            <Calendar className="h-5 w-5 mr-3" /> Itineraries
          </Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors">
            <CreditCard className="h-5 w-5 mr-3" /> Expenses
          </Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors">
            <BedDouble className="h-5 w-5 mr-3" /> Book Hotels
          </Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors">
            <Settings className="h-5 w-5 mr-3" /> Settings
          </Link>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      {/* Changed to flex-col h-screen to allow scrolling just this side */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* --- NEW: MOBILE TOP BAR --- */}
        <div className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10 print:hidden">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
            <Menu className="h-6 w-6" />
          </button>
        </div>

        {/* --- UPDATED: RESPONSIVE HEADER --- */}
        <header className="h-auto md:h-16 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 z-10 print:hidden shrink-0 gap-4">
          <h2 className="text-xl font-semibold text-slate-800 hidden md:block">Master Schedule</h2>
          
          <div className="flex flex-wrap items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
            <select 
              value={selectedTripId} 
              onChange={(e) => setSelectedTripId(e.target.value)}
              className="flex-1 md:flex-none border border-slate-300 rounded-lg p-2.5 md:p-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-medium max-w-[150px] md:max-w-xs truncate"
            >
              {trips.length === 0 ? <option>No trips found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>

            <div className="flex items-center gap-2">
              <button 
                onClick={() => setShowAiModal(true)} 
                disabled={trips.length === 0} 
                className="flex items-center bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-3 md:px-4 py-2.5 md:py-2 rounded-lg font-bold hover:opacity-90 transition-all shadow-sm disabled:opacity-50 text-sm md:text-base"
              >
                <Sparkles className="h-4 w-4 md:mr-2" /> <span className="hidden md:inline">Magic Plan</span>
              </button>

              <button onClick={handleExportCalendar} disabled={activities.length === 0} className="flex items-center bg-indigo-50 border border-indigo-200 text-indigo-700 px-3 md:px-4 py-2.5 md:py-2 rounded-lg font-medium hover:bg-indigo-100 transition-all disabled:opacity-50 text-sm md:text-base">
                <CalendarPlus className="h-4 w-4 md:mr-2" /> <span className="hidden lg:inline">Sync</span>
              </button>
              <button onClick={() => window.print()} disabled={activities.length === 0} className="flex items-center bg-white border border-slate-300 text-slate-700 px-3 md:px-4 py-2.5 md:py-2 rounded-lg font-medium hover:bg-slate-50 transition-all disabled:opacity-50 text-sm md:text-base">
                <Printer className="h-4 w-4 md:mr-2" /> <span className="hidden lg:inline">Print</span>
              </button>
            </div>
          </div>
        </header>

        {/* SCROLLABLE AGENDA */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:bg-white bg-slate-50">
          <div className="max-w-4xl mx-auto pb-20">
            
            {trips.length === 0 ? (
               <div className="text-center py-20">
                 <div className="h-16 w-16 bg-slate-100 rounded-full flex items-center justify-center text-slate-400 mx-auto mb-4"><Calendar className="h-8 w-8" /></div>
                 <h3 className="text-xl font-bold text-slate-900">No Trips Found</h3>
                 <p className="text-slate-500 mt-2">Create a trip on the Dashboard to start building an itinerary.</p>
               </div>
            ) : activities.length === 0 ? (
               <div className="text-center py-12 md:py-20 bg-white rounded-3xl border border-dashed border-slate-300 print:hidden px-4">
                 <Sparkles className="h-12 w-12 text-purple-400 mx-auto mb-4" />
                 <h3 className="text-xl font-bold text-slate-900">Your schedule is empty</h3>
                 <p className="text-slate-500 mt-2 mb-6">Let AI build a complete itinerary for you in seconds.</p>
                 <button onClick={() => setShowAiModal(true)} className="w-full md:w-auto bg-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-lg hover:bg-purple-700 transition-all">
                   Generate Magic Schedule
                 </button>
               </div>
            ) : (
              <div className="space-y-8 md:space-y-10">
                <div className="hidden print:block mb-8 pb-4 border-b-2 border-slate-800">
                  <h1 className="text-3xl font-bold text-slate-900">{trips.find(t => t.id === selectedTripId)?.title} - Master Itinerary</h1>
                  <p className="text-slate-500">Generated by WanderHub</p>
                </div>

                {sortedDates.map((date, index) => {
                  const dateObj = new Date(date);
                  const formattedDate = dateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });

                  return (
                    <div key={date} className="relative">
                      <div className="sticky top-0 bg-slate-50/95 backdrop-blur-sm print:bg-transparent z-10 py-2 mb-4 border-b border-slate-200 flex flex-col md:flex-row md:items-baseline gap-1 md:gap-3">
                        <h3 className="text-xl md:text-2xl font-bold text-slate-900">Day {index + 1}</h3>
                        <span className="text-sm md:text-base text-slate-500 font-medium">{formattedDate}</span>
                      </div>

                      <div className="space-y-3 pl-0 md:pl-4">
                        {groupedActivities[date].map((act) => {
                          const isExpanded = expandedIds.includes(act.id);
                          
                          return (
                            <div key={act.id} className="group flex flex-col bg-white border border-slate-200 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-200 transition-all print:border-slate-300 print:shadow-none overflow-hidden">
                              <div className="flex items-center p-3 md:p-4 cursor-pointer" onClick={() => toggleExpand(act.id)}>
                                <div className="w-16 md:w-24 shrink-0 flex flex-col items-center justify-center border-r border-slate-100 pr-3 md:pr-4 mr-3 md:mr-4">
                                  <span className="text-xs md:text-sm font-bold text-slate-900 text-center">{act.time}</span>
                                  <div className="mt-2 h-8 w-8 md:h-10 md:w-10 rounded-full bg-slate-50 flex items-center justify-center">
                                    {getIcon(act.type)}
                                  </div>
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-indigo-600 mb-0.5 md:mb-1 block">{act.type}</span>
                                  <h4 className="text-base md:text-lg font-bold text-slate-800 truncate">{act.title}</h4>
                                </div>
                                <div className="flex items-center gap-1 md:gap-2 ml-2">
                                  <button onClick={(e) => { e.stopPropagation(); handleDeleteActivity(act.id); }} className="p-2 text-slate-300 hover:text-red-600 rounded-lg transition-all print:hidden" title="Delete Activity">
                                    <Trash2 className="h-4 w-4 md:h-5 md:w-5" />
                                  </button>
                                  <div className="p-1 md:p-2 text-slate-400">
                                    {isExpanded ? <ChevronUp className="h-4 w-4 md:h-5 md:w-5" /> : <ChevronDown className="h-4 w-4 md:h-5 md:w-5" />}
                                  </div>
                                </div>
                              </div>
                              
                              {isExpanded && (
                                <div className="bg-slate-50 border-t border-slate-100 p-4 md:p-5 pl-4 md:pl-[8.5rem] animate-in slide-in-from-top-2 fade-in duration-200 print:pl-4 print:bg-white">
                                  <div className="space-y-4">
                                    <div className="flex items-start gap-2">
                                      <MapPin className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                      <div className="flex-1">
                                        <p className="text-sm text-slate-700 font-medium leading-relaxed">{act.location || "No address provided"}</p>
                                        <div className="flex flex-wrap gap-2 mt-2.5">
                                          <a href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(act.location || act.title)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center text-xs font-bold text-indigo-700 hover:text-indigo-800 bg-indigo-100/50 hover:bg-indigo-100 px-3 py-1.5 rounded-lg transition-colors print:hidden">
                                            <Navigation className="h-3 w-3 mr-1.5" /> Directions
                                          </a>
                                          {(act.type === 'flight' || act.type === 'train') && (
                                            <button onClick={(e) => { e.stopPropagation(); handleTrackStatus(act.title, act.type, act.trackingNumber); }} className="inline-flex items-center text-xs font-bold text-sky-700 hover:text-sky-800 bg-sky-100/50 hover:bg-sky-100 px-3 py-1.5 rounded-lg transition-colors print:hidden">
                                              <PlaneTakeoff className="h-3 w-3 mr-1.5" /> Tracker
                                            </button>
                                          )}
                                        </div>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-2">
                                      <AlignLeft className="h-4 w-4 text-slate-400 mt-0.5 shrink-0" />
                                      <p className="text-sm text-slate-600 leading-relaxed">{act.notes || "No additional notes."}</p>
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

      {/* --- AI GENERATOR MODAL (Changed z-index to 60) --- */}
      {showAiModal && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm z-[60]">
          <div className="bg-white rounded-3xl p-6 md:p-8 w-full max-w-lg shadow-2xl relative">
            <button onClick={() => !isAiLoading && setShowAiModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full">✕</button>
            
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 md:h-12 md:w-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600"><Sparkles className="h-5 w-5 md:h-6 md:w-6" /></div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-slate-900">AI Trip Planner</h2>
                <p className="text-slate-500 text-xs md:text-sm">Powered by Gemini 2.5</p>
              </div>
            </div>

            {isAiLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-center">
                <Loader2 className="h-12 w-12 text-purple-600 animate-spin mb-4" />
                <h3 className="text-lg font-bold text-slate-800">Designing your dream trip...</h3>
                <p className="text-slate-500 mt-2 text-sm">This usually takes about 5-10 seconds.</p>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-slate-700 mb-2">What kind of trip do you want?</label>
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="e.g. A 3-day romantic anniversary weekend in Paris, highly focused on French food and art museums..."
                    className="w-full h-32 border border-slate-300 rounded-xl p-4 text-slate-700 focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none resize-none text-sm md:text-base"
                  />
                </div>
                <button 
                  onClick={handleGenerateItinerary}
                  disabled={!aiPrompt.trim()}
                  className="w-full bg-gradient-to-r from-purple-600 to-indigo-600 text-white py-3.5 md:py-4 rounded-xl font-bold text-base md:text-lg hover:opacity-90 transition-opacity disabled:opacity-50 shadow-md"
                >
                  Generate Magic Schedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* --- LIVE TRACKER MODAL (Changed z-index to 60) --- */}
      {isTrackerOpen && (
        <div className="fixed inset-0 bg-slate-900/60 flex items-center justify-center p-4 backdrop-blur-sm z-[60]">
          <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
            <button onClick={() => setIsTrackerOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 bg-slate-50 p-2 rounded-full">✕</button>
            <h2 className="text-xl font-bold text-slate-900 mb-6 flex items-center">
              <span className="relative flex h-3 w-3 mr-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
              </span>
              Live Tracking
            </h2>

            {isTrackingLoading ? (
              <div className="py-12 flex flex-col items-center justify-center text-slate-500">
                <div className="animate-spin h-10 w-10 border-4 border-sky-600 border-t-transparent rounded-full mb-4"></div>
                <p className="font-medium animate-pulse">Connecting to Global Database...</p>
              </div>
            ) : trackingData ? (
              <div className="space-y-6 animate-in fade-in zoom-in-95 duration-300">
                <div className="text-center">
                  <span className="px-3 py-1 bg-sky-100 text-sky-700 font-bold text-xs rounded-full uppercase tracking-wider">{trackingData.type} {trackingData.number}</span>
                  <h3 className="text-2xl font-black text-slate-900 mt-3">{trackingData.status}</h3>
                </div>
                <div className="relative pt-4 pb-2">
                  <div className="overflow-hidden h-2 mb-4 text-xs flex rounded-full bg-slate-100">
                    <div style={{ width: `${trackingData.progress}%` }} className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-sky-500 transition-all duration-1000"></div>
                  </div>
                  <Plane className="absolute top-1.5 h-6 w-6 text-sky-600 transition-all duration-1000" style={{ left: `calc(${trackingData.progress}% - 12px)` }} />
                </div>
                <div className="flex justify-between items-center bg-slate-50 rounded-2xl p-4 border border-slate-100">
                  <div className="text-left">
                    <p className="text-xs font-bold text-slate-400 uppercase">Departure</p>
                    <p className="text-lg font-black text-slate-800">{trackingData.departure.time}</p>
                    <p className="text-sm font-medium text-slate-500">Gate {trackingData.departure.gate || trackingData.departure.platform}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-400 uppercase">Arrival</p>
                    <p className="text-lg font-black text-slate-800">{trackingData.arrival.time}</p>
                    <p className="text-sm font-medium text-slate-500">Gate {trackingData.arrival.gate || trackingData.arrival.platform}</p>
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