"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where, addDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, MapPin, Plane, BedDouble, Loader2, Menu, X, ArrowRightLeft, Search, CheckCircle2, AlertCircle, User as UserIcon, Ticket, Briefcase, Users, Tag, Download, Map as MapIcon, Clock, Hash, MessageSquare, Info } from "lucide-react";
import { toPng } from "html-to-image";
import jsPDF from "jspdf";
import TravelLoader from "../components/TravelLoader";

const loadRazorpayScript = () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
};

export default function FlightsPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // --- NEW: PAGE TABS STATE ---
  const [activeTab, setActiveTab] = useState<"book" | "my_bookings">("book");
  const [myFlights, setMyFlights] = useState<any[]>([]);

  // FIREBASE TRIPS STATE
  const [trips, setTrips] = useState<any[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");

  const [tripType, setTripType] = useState<"oneway" | "roundtrip">("oneway");
  const [flightOrigin, setFlightOrigin] = useState("LHR"); 
  const [flightDest, setFlightDest] = useState("JFK");    
  const [flightDate, setFlightDate] = useState("");
  const [returnDate, setReturnDate] = useState("");
  const [passengers, setPassengers] = useState(1);
  const [cabinClass, setCabinClass] = useState("economy");
  
  const [flightResults, setFlightResults] = useState<any[]>([]);
  const [isFlightLoading, setIsFlightLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);

  const [bookingStep, setBookingStep] = useState<"SEARCH" | "PASSENGER" | "PROCESSING" | "TICKET">("SEARCH");
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [passengerDetails, setPassengerDetails] = useState({ firstName: "", lastName: "", dob: "", gender: "m", email: "" });
  const [generatedPnr, setGeneratedPnr] = useState("");
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);
  const [isEmailSending, setIsEmailSending] = useState(false);

  // FETCH USER TRIPS
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setPassengerDetails(prev => ({ ...prev, email: currentUser.email || "" }));
        
        const q = query(collection(db, "trips"), where("members", "array-contains", currentUser.uid));
        onSnapshot(q, (snapshot) => {
          const tripsData = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
          setTrips(tripsData);
          if (tripsData.length > 0) setSelectedTripId(tripsData[0].id);
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // --- NEW: FETCH USER'S PAST BOOKINGS ---
  useEffect(() => {
    if (trips.length === 0) return;
    const tripIds = trips.map(t => t.id);
    
    // Fetch all flight activities and filter them for the user's trips
    const q = query(collection(db, "activities"), where("type", "==", "flight"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flights = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((act: any) => tripIds.includes(act.tripId))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()); // Sort newest first
      setMyFlights(flights);
    });

    return () => unsubscribe();
  }, [trips]);

  const handleFlightSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flightOrigin || !flightDest || !flightDate) return alert("Please fill all required flight details.");
    if (tripType === "roundtrip" && !returnDate) return alert("Please select a return date.");
    
    setIsFlightLoading(true); setHasSearched(true); setFlightResults([]); setBookingStep("SEARCH");
    
    try {
      const res = await fetch("/api/flights/search", {
        method: "POST",
        body: JSON.stringify({ 
          origin: flightOrigin.toUpperCase(), destination: flightDest.toUpperCase(), departureDate: flightDate,
          returnDate: tripType === "roundtrip" ? returnDate : undefined, passengers: passengers, cabinClass: cabinClass
        })
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setFlightResults(data);
    } catch (err) {
      console.error(err);
      alert("Flight search failed. Ensure you use valid 3-letter IATA codes.");
    } finally {
      setIsFlightLoading(false);
    }
  };

  const handleBookClick = (offer: any) => {
    setSelectedOffer(offer);
    setBookingStep("PASSENGER");
  };

  const handlePaymentAndBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripId) return alert("Please select an itinerary to attach this flight to.");

    const isScriptLoaded = await loadRazorpayScript();
    if (!isScriptLoaded) return alert("Razorpay SDK failed to load. Check your internet connection.");

    const mockConversionRate = 90; 
    const amountInINR = Math.round(Number(selectedOffer.total_amount) * mockConversionRate);
    const amountInPaise = amountInINR * 100;

    try {
      const orderRes = await fetch("/api/razorpay", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amountInPaise })
      });
      const orderData = await orderRes.json();
      if (orderData.error) return alert("Error creating Razorpay Order: " + orderData.error);

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID || "rzp_test_SZpnRvlSEBfADP",
        amount: amountInPaise.toString(), currency: "INR",
        name: "WanderHub Flights", description: `${selectedOffer.owner.name} Flight Reservation`,
        image: "https://cdn-icons-png.flaticon.com/512/3125/3125713.png", 
        order_id: orderData.id, 
        handler: async function (response: any) {
          console.log("Payment Success:", response.razorpay_payment_id);
          setBookingStep("PROCESSING");
          
          const newPnr = Math.random().toString(36).substring(2, 8).toUpperCase();
          setGeneratedPnr(newPnr);

          // FIREBASE SYNC
          try {
            await addDoc(collection(db, "activities"), {
              tripId: selectedTripId,
              title: `Flight to ${selectedOffer.slices[0].destination.iata_code}`,
              type: "flight",
              date: flightDate,
              time: formatFlightTime(selectedOffer.slices[0].segments[0].departing_at),
              location: `${selectedOffer.slices[0].origin.iata_code} ➔ ${selectedOffer.slices[0].destination.iata_code}`,
              notes: `Passenger: ${passengerDetails.firstName} ${passengerDetails.lastName}. Airline: ${selectedOffer.owner.name}, PNR: ${newPnr}`,
              trackingNumber: selectedOffer.slices[0].segments[0].marketing_carrier_flight_number
            });
          } catch (firebaseErr) {
            console.error("Failed to sync flight to Itinerary:", firebaseErr);
          }

          setTimeout(() => { setBookingStep("TICKET"); }, 2000);
        },
        prefill: { name: `${passengerDetails.firstName} ${passengerDetails.lastName}`, email: passengerDetails.email, contact: "9999999999" },
        theme: { color: "#4f46e5" },
      };

      const paymentObject = new (window as any).Razorpay(options);
      paymentObject.open();

    } catch (err) {
      console.error(err);
      alert("Payment initialization failed.");
    }
  };

  const handleDownloadPDF = async () => {
    setIsPdfGenerating(true);
    const ticketElement = document.getElementById("e-ticket-board");
    if (!ticketElement) { setIsPdfGenerating(false); return; }

    try {
      const dataUrl = await toPng(ticketElement, { quality: 1, pixelRatio: 2 });
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (ticketElement.offsetHeight * pdfWidth) / ticketElement.offsetWidth;
      pdf.addImage(dataUrl, "PNG", 0, 15, pdfWidth, pdfHeight);
      pdf.save(`WanderHub_Ticket_${generatedPnr}.pdf`);
    } catch (error) {
      console.error("PDF Generation Failed:", error);
      alert("Failed to generate PDF.");
    } finally {
      setIsPdfGenerating(false);
    }
  };

  const handleEmailTicket = async () => {
    setIsEmailSending(true);
    const ticketElement = document.getElementById("e-ticket-board");
    if (!ticketElement) return;

    try {
      const dataUrl = await toPng(ticketElement, { quality: 1, pixelRatio: 2 });
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (ticketElement.offsetHeight * pdfWidth) / ticketElement.offsetWidth;
      pdf.addImage(dataUrl, "PNG", 0, 15, pdfWidth, pdfHeight);

      const pdfBase64 = pdf.output('datauristring');

      const res = await fetch("/api/flights/send-ticket", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: passengerDetails.email, pnr: generatedPnr, pdfBase64: pdfBase64,
          passengerName: passengerDetails.firstName, flightNo: selectedOffer.slices[0].segments[0].marketing_carrier_flight_number
        }),
      });

      const data = await res.json();
      if (data.error) throw new Error(data.error);
      alert(`Success! E-Ticket emailed to ${passengerDetails.email}`);
    } catch (error) {
      console.error("Email Failed:", error);
      alert("Failed to send email. Check your server console.");
    } finally {
      setIsEmailSending(false);
    }
  };

  const formatFlightTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#030712] font-sans text-slate-900 dark:text-slate-100 overflow-hidden selection:bg-indigo-100">
      
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity duration-300" onClick={() => setIsMobileMenuOpen(false)}/>
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/10 flex flex-col transform transition-all duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-50 dark:bg-white/5 rounded-full"><X className="h-5 w-5" /></button>
        </div>
        {/* ADD 'flex flex-col' TO THE NAV CLASS */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="space-y-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
          <Link href="/chat" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors">
            <MessageSquare className="h-5 w-5 mr-3" /> Group Chat
          </Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/flights" className="flex items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold shadow-sm transition-colors border border-transparent dark:border-indigo-500/20"><Plane className="h-5 w-5 mr-3" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
        </div>
        {/* Add the About Us link at the very end wrapped in this specific div */}
          <div className="mt-auto pt-6">
            <Link href="/about" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors">
              <Info className="h-5 w-5 mr-3" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="md:hidden h-16 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 z-30 sticky top-0">
          <div className="flex items-center"><PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" /><span className="text-xl font-bold">WanderHub</span></div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 rounded-full"><Menu className="h-6 w-6" /></button>
        </div>

        <header className="h-auto md:h-20 py-4 md:py-0 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between px-6 md:px-10 shrink-0 z-20 sticky top-0">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Flight Hub</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Search flights or manage your bookings.</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-10 bg-[#f8fafc] dark:bg-transparent custom-scrollbar">
          <div className="max-w-5xl mx-auto pb-24">

            {/* --- NEW: TABS NAVIGATION --- */}
            {bookingStep === "SEARCH" && (
              <div className="flex items-center gap-8 mb-8 border-b border-slate-200 dark:border-white/10">
                <button 
                  onClick={() => setActiveTab("book")} 
                  className={`pb-4 text-sm md:text-base font-black uppercase tracking-widest transition-all relative ${activeTab === 'book' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                  <span className="flex items-center"><Search className="h-4 w-4 mr-2" /> Search Flights</span>
                  {activeTab === 'book' && <span className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></span>}
                </button>
                <button 
                  onClick={() => setActiveTab("my_bookings")} 
                  className={`pb-4 text-sm md:text-base font-black uppercase tracking-widest transition-all relative ${activeTab === 'my_bookings' ? 'text-indigo-600 dark:text-indigo-400' : 'text-slate-400 hover:text-slate-600 dark:hover:text-slate-200'}`}
                >
                  <span className="flex items-center"><Ticket className="h-4 w-4 mr-2" /> My Bookings <span className="ml-2 bg-slate-100 dark:bg-white/10 px-2 py-0.5 rounded-md text-xs">{myFlights.length}</span></span>
                  {activeTab === 'my_bookings' && <span className="absolute bottom-0 left-0 w-full h-1 bg-indigo-600 dark:bg-indigo-400 rounded-t-full"></span>}
                </button>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW: MY BOOKINGS LIST */}
            {/* ========================================================= */}
            {activeTab === "my_bookings" && bookingStep === "SEARCH" && (
              <div className="animate-in fade-in duration-500">
                {myFlights.length === 0 ? (
                  <div className="text-center py-20 bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm">
                    <Plane className="h-16 w-16 text-slate-300 dark:text-slate-600 mx-auto mb-4" />
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white">No Flights Booked</h3>
                    <p className="text-slate-500 font-medium mt-2">You have not booked any flights through WanderHub yet.</p>
                    <button onClick={() => setActiveTab("book")} className="mt-6 bg-indigo-600 text-white px-6 py-3 rounded-xl font-bold hover:bg-indigo-500 transition-colors">Book a Flight Now</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {myFlights.map((flight) => {
                      // We smartly parse the details we saved in Firebase earlier!
                      const details = flight.notes || "";
                      const pnrMatch = details.match(/PNR:\s*([A-Z0-9]+)/);
                      const airlineMatch = details.match(/Airline:\s*([^,]+)/);
                      const pnr = pnrMatch ? pnrMatch[1] : "N/A";
                      const airline = airlineMatch ? airlineMatch[1] : "WanderHub Partner";

                      return (
                        <div key={flight.id} className="bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-[2rem] shadow-sm hover:shadow-xl transition-all overflow-hidden group">
                          <div className="bg-indigo-600 px-6 py-4 flex justify-between items-center text-white relative overflow-hidden">
                            <div className="absolute right-[-10%] top-[-50%] w-32 h-32 bg-white/10 rounded-full blur-xl"></div>
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-widest opacity-80 mb-0.5">Booking PNR</p>
                              <p className="text-2xl font-black tracking-widest">{pnr}</p>
                            </div>
                            <div className="h-10 w-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-md">
                              <Plane className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          
                          <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                              <div className="flex-1">
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{flight.location.split('➔')[0].trim()}</p>
                                <p className="text-xs font-bold text-slate-500 mt-1 uppercase">{new Date(flight.date).toLocaleDateString()}</p>
                              </div>
                              <div className="flex-1 flex justify-center">
                                <PlaneTakeoff className="h-5 w-5 text-indigo-400 group-hover:translate-x-2 transition-transform" />
                              </div>
                              <div className="flex-1 text-right">
                                <p className="text-2xl font-black text-slate-900 dark:text-white">{flight.location.split('➔')[1]?.trim()}</p>
                                <p className="text-xs font-bold text-slate-500 mt-1 uppercase">{flight.time}</p>
                              </div>
                            </div>

                            <div className="bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border border-slate-100 dark:border-white/5 flex flex-col gap-3">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center"><Hash className="h-4 w-4 mr-1"/> Flight</span>
                                <span className="font-black text-slate-900 dark:text-white uppercase">{flight.trackingNumber}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm border-t border-slate-200 dark:border-white/10 pt-3">
                                <span className="text-slate-500 dark:text-slate-400 font-bold flex items-center"><Plane className="h-4 w-4 mr-1"/> Airline</span>
                                <span className="font-black text-slate-900 dark:text-white">{airline}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW: FLIGHT SEARCH ENGINE WIDGET */}
            {/* ========================================================= */}
            {activeTab === "book" && bookingStep === "SEARCH" && (
              <div className="relative z-10 animate-in fade-in duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-blue-600 to-indigo-600 rounded-[3rem] transform rotate-1 opacity-10 dark:opacity-20 blur-xl"></div>
                
                <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 md:p-10 border border-slate-200 dark:border-white/10 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] dark:opacity-[0.05] pointer-events-none">
                    <Plane className="h-64 w-64 text-indigo-900 transform translate-x-16 -translate-y-16 rotate-12" />
                  </div>

                  <div className="relative z-10">
                    <div className="flex items-center gap-4 mb-8 border-b border-slate-100 dark:border-white/10 pb-6">
                      <div className="h-14 w-14 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center shadow-inner border border-indigo-100 dark:border-indigo-500/20">
                        <PlaneTakeoff className="h-7 w-7" />
                      </div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Global Flight Engine</h3>
                        <p className="text-sm font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-0.5">
                          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                          Live NDC Feed via Duffel
                        </p>
                      </div>
                    </div>
                    
                    <form onSubmit={handleFlightSearch} className="space-y-4">
                      {/* ADVANCED FILTERS ROW */}
                      <div className="flex flex-wrap gap-4 mb-2">
                        <div className="flex bg-slate-50 dark:bg-[#1e293b] p-1 rounded-xl border border-slate-200 dark:border-white/5">
                          <button type="button" onClick={() => setTripType("oneway")} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${tripType === "oneway" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}>One Way</button>
                          <button type="button" onClick={() => setTripType("roundtrip")} className={`px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${tripType === "roundtrip" ? "bg-white dark:bg-slate-700 shadow-sm text-indigo-600 dark:text-indigo-400" : "text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"}`}>Round Trip</button>
                        </div>

                        <div className="flex items-center bg-slate-50 dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-white/5 px-4">
                          <Users className="h-4 w-4 text-slate-400 mr-2" />
                          <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer py-2">
                            {[1, 2, 3, 4, 5, 6].map(num => <option key={num} value={num}>{num} Traveler{num > 1 ? 's' : ''}</option>)}
                          </select>
                        </div>

                        <div className="flex items-center bg-slate-50 dark:bg-[#1e293b] rounded-xl border border-slate-200 dark:border-white/5 px-4">
                          <select value={cabinClass} onChange={(e) => setCabinClass(e.target.value)} className="bg-transparent text-sm font-bold text-slate-700 dark:text-slate-200 outline-none cursor-pointer py-2">
                            <option value="economy">Economy</option>
                            <option value="premium_economy">Premium Economy</option>
                            <option value="business">Business</option>
                            <option value="first">First Class</option>
                          </select>
                        </div>
                      </div>

                      <div className="bg-slate-50 dark:bg-[#1e293b] p-3 rounded-[2rem] border border-slate-200 dark:border-white/5 flex flex-col md:flex-row gap-2 items-center shadow-inner">
                        <div className="relative flex-1 w-full group">
                          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none"><MapPin className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /></div>
                          <input type="text" value={flightOrigin} onChange={(e)=>setFlightOrigin(e.target.value.toUpperCase())} className="w-full bg-white dark:bg-[#0f172a] border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-indigo-500 rounded-3xl py-4 pl-14 pr-4 text-sm font-black uppercase tracking-widest outline-none transition-all placeholder:text-slate-400 shadow-sm" placeholder="ORIGIN (e.g. LHR)" maxLength={3} />
                        </div>
                        
                        <div className="h-10 w-10 bg-white dark:bg-[#0f172a] rounded-full flex items-center justify-center border border-slate-200 dark:border-white/10 z-10 shrink-0 md:-mx-4 shadow-sm text-slate-400">
                          <ArrowRightLeft className="h-4 w-4 md:rotate-0 rotate-90" />
                        </div>

                        <div className="relative flex-1 w-full group">
                          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none"><MapPin className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /></div>
                          <input type="text" value={flightDest} onChange={(e)=>setFlightDest(e.target.value.toUpperCase())} className="w-full bg-white dark:bg-[#0f172a] border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-indigo-500 rounded-3xl py-4 pl-14 pr-4 text-sm font-black uppercase tracking-widest outline-none transition-all placeholder:text-slate-400 shadow-sm" placeholder="DEST (e.g. JFK)" maxLength={3} />
                        </div>

                        <div className="relative flex-1 w-full group">
                          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none"><Calendar className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /></div>
                          <input type="date" value={flightDate} onChange={(e)=>setFlightDate(e.target.value)} className="w-full bg-white dark:bg-[#0f172a] border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-indigo-500 rounded-3xl py-4 pl-14 pr-4 text-sm font-bold outline-none transition-all shadow-sm dark:[color-scheme:dark]" />
                        </div>

                        {tripType === "roundtrip" && (
                          <div className="relative flex-1 w-full group animate-in slide-in-from-right-4 duration-300">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none"><Calendar className="h-5 w-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" /></div>
                            <input type="date" value={returnDate} onChange={(e)=>setReturnDate(e.target.value)} className="w-full bg-white dark:bg-[#0f172a] border border-transparent hover:border-slate-200 dark:hover:border-white/10 focus:border-indigo-500 rounded-3xl py-4 pl-14 pr-4 text-sm font-bold outline-none transition-all shadow-sm dark:[color-scheme:dark]" required />
                          </div>
                        )}

                        <button type="submit" disabled={isFlightLoading} className="w-full md:w-auto h-full bg-indigo-600 text-white px-10 py-4 rounded-3xl font-black hover:bg-indigo-500 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center shrink-0">
                          {isFlightLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : "Search"}
                        </button>
                      </div>
                    </form>

                    {/* LOADING STATE: FLIGHT SEARCH */}
                    {isFlightLoading && (
                      <div className="mt-10 py-12 animate-in fade-in duration-500 bg-white/40 dark:bg-[#1e293b]/40 backdrop-blur-2xl rounded-3xl border border-slate-200 dark:border-white/10 shadow-2xl">
                        <TravelLoader 
                          messages={[
                            "Scanning Global Airlines...", 
                            "Connecting to Duffel Sandbox...", 
                            "Checking real-time seat capacity...", 
                            "Finding the best routes..."
                          ]} 
                        />
                      </div>
                    )}

                    {/* NO RESULTS */}
                    {!isFlightLoading && hasSearched && flightResults.length === 0 && (
                      <div className="mt-10 py-10 text-center bg-red-50 dark:bg-red-500/10 rounded-3xl border border-red-100 dark:border-red-500/20">
                        <p className="text-red-600 dark:text-red-400 font-bold">No flights found. Try different dates or check your IATA codes.</p>
                      </div>
                    )}

                    {/* INTERACTIVE RESULTS LIST */}
                    {!isFlightLoading && flightResults.length > 0 && (
                      <div className="mt-10 space-y-5 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center justify-between px-2 mb-2">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Live Inventory</p>
                          <p className="text-xs font-black text-indigo-500 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">{flightResults.length} Offers Available</p>
                        </div>
                        
                        {flightResults.map((offer: any) => {
                          const slice = offer.slices[0];
                          const segment = slice.segments[0];
                          const capacity = segment.available_capacity || 9;
                          
                          const originalPrice = tripType === "roundtrip" ? (Number(offer.total_amount) * 1.15).toFixed(2) : null;
                          
                          return (
                            <div key={offer.id} className="group bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/10 rounded-3xl p-6 flex flex-col md:flex-row md:items-center justify-between hover:border-indigo-400 hover:shadow-2xl hover:shadow-indigo-500/10 transition-all duration-300 relative overflow-hidden">
                              
                              {tripType === "roundtrip" && (
                                <div className="absolute top-0 right-0 bg-emerald-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl flex items-center shadow-sm">
                                  <Tag className="h-3 w-3 mr-1" /> 15% Round-Trip Saver
                                </div>
                              )}

                              <div className="flex items-center gap-5 md:w-1/4 mb-6 md:mb-0 pt-2">
                                <div className="h-14 w-14 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-sm">
                                  {offer.owner.logo_symbol_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={offer.owner.logo_symbol_url} alt={offer.owner.name} className="h-8 w-8 object-contain" />
                                  ) : (
                                    <Plane className="h-6 w-6 text-indigo-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-lg font-black text-slate-900 dark:text-white leading-tight">{offer.owner.name}</p>
                                  <div className="flex flex-col gap-1 mt-1">
                                    <div className="flex items-center gap-2">
                                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest border border-slate-200 dark:border-white/10 px-2 py-0.5 rounded bg-slate-50 dark:bg-white/5">
                                        {segment.marketing_carrier_flight_number}
                                      </p>
                                      {capacity < 5 && (
                                         <span className="text-[10px] font-black text-red-500 bg-red-50 dark:bg-red-500/10 px-2 py-0.5 rounded flex items-center"><AlertCircle className="h-3 w-3 mr-1"/> {capacity} Left</span>
                                      )}
                                    </div>
                                    <div className="flex items-center text-[10px] font-bold text-slate-500 uppercase mt-1">
                                      <Briefcase className="h-3 w-3 mr-1" /> 7kg Cabin • 23kg Checked
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between flex-1 px-0 md:px-10 mb-6 md:mb-0 relative">
                                 <div className="text-center">
                                   <p className="text-2xl font-black text-slate-900 dark:text-white">{formatFlightTime(segment.departing_at)}</p>
                                   <p className="text-xs font-bold text-slate-500 mt-1">{slice.origin.iata_code}</p>
                                 </div>
                                 
                                 <div className="flex-1 px-4 flex flex-col items-center relative">
                                   <p className="text-[10px] font-black text-indigo-500 uppercase tracking-widest mb-2 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full z-10">
                                     {slice.duration.replace('PT','').replace('H','h ').replace('M','m')}
                                   </p>
                                   <div className="w-full border-t-2 border-dashed border-slate-200 dark:border-slate-700 relative flex items-center justify-center">
                                      <div className="absolute h-3 w-3 rounded-full bg-slate-200 dark:bg-slate-700 left-0 -translate-x-1/2"></div>
                                      <Plane className="h-5 w-5 text-slate-300 dark:text-slate-600 absolute" />
                                      <div className="absolute h-3 w-3 rounded-full bg-slate-200 dark:bg-slate-700 right-0 translate-x-1/2"></div>
                                   </div>
                                   <p className="text-[10px] font-bold text-slate-400 mt-2 uppercase tracking-widest bg-slate-50 dark:bg-white/5 px-2 py-0.5 rounded">{cabinClass}</p>
                                 </div>

                                 <div className="text-center">
                                   <p className="text-2xl font-black text-slate-900 dark:text-white">{formatFlightTime(segment.arriving_at)}</p>
                                   <p className="text-xs font-bold text-slate-500 mt-1">{slice.destination.iata_code}</p>
                                 </div>
                              </div>

                              <div className="md:w-1/4 flex flex-row md:flex-col items-center md:items-end justify-between md:justify-center border-t md:border-t-0 md:border-l border-slate-100 dark:border-white/10 pt-4 md:pt-0 md:pl-6">
                                <div className="text-left md:text-right">
                                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-end">
                                    <Users className="h-3 w-3 mr-1"/> For {passengers} Traveler{passengers > 1 ? 's' : ''}
                                  </p>
                                  {originalPrice && (
                                    <p className="text-xs font-black text-slate-400 line-through decoration-red-500/50">{offer.total_currency} {originalPrice}</p>
                                  )}
                                  <p className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">
                                    {offer.total_currency} {Number(offer.total_amount).toLocaleString()}
                                  </p>
                                </div>
                                <button 
                                   onClick={() => handleBookClick(offer)} 
                                   className="bg-slate-900 dark:bg-indigo-600 text-white px-6 py-3 rounded-xl text-sm font-black hover:bg-slate-800 dark:hover:bg-indigo-500 transition-colors shadow-lg hover:-translate-y-0.5 mt-0 md:mt-3"
                                >
                                  Book Seat
                                </button>
                              </div>

                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 2: INTERACTIVE PASSENGER FORM WITH ITINERARY SELECTOR */}
            {/* ========================================================= */}
            {bookingStep === "PASSENGER" && selectedOffer && (
              <div className="relative z-10 animate-in slide-in-from-right-10 duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 rounded-[3rem] transform -rotate-1 opacity-10 dark:opacity-20 blur-xl"></div>
                
                <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 md:p-10 border border-slate-200 dark:border-white/10 shadow-2xl relative overflow-hidden">
                  <button onClick={() => setBookingStep("SEARCH")} className="text-sm font-black text-slate-500 hover:text-indigo-600 mb-8 flex items-center transition-colors">&larr; Back to Flights</button>
                  
                  <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 pb-6 border-b border-slate-100 dark:border-white/10 gap-6">
                    <div className="flex items-center gap-4">
                      <div className="h-14 w-14 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-2xl flex items-center justify-center border border-emerald-100 dark:border-emerald-500/20"><UserIcon className="h-7 w-7" /></div>
                      <div>
                        <h3 className="text-2xl font-black text-slate-900 dark:text-white">Lead Passenger Details</h3>
                        <p className="text-sm font-bold text-slate-500">Booking for {passengers} passenger{passengers > 1 ? 's' : ''} in {cabinClass}.</p>
                      </div>
                    </div>

                    <div className="bg-slate-50 dark:bg-[#1e293b] p-4 rounded-xl border border-slate-200 dark:border-white/10 shrink-0">
                      <label className="text-[10px] font-black uppercase text-indigo-500 tracking-widest block mb-1">Attach to Itinerary</label>
                      <div className="relative flex items-center">
                        <MapIcon className="absolute left-3 h-4 w-4 text-slate-400 pointer-events-none" />
                        <select 
                          value={selectedTripId} 
                          onChange={(e) => setSelectedTripId(e.target.value)}
                          className="appearance-none bg-transparent pl-9 pr-8 py-1 font-bold text-slate-900 dark:text-white outline-none cursor-pointer w-full min-w-[200px]"
                        >
                          {trips.length === 0 ? <option value="">No Trips Found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handlePaymentAndBooking} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-2">First Name</label><input type="text" value={passengerDetails.firstName} onChange={(e) => setPassengerDetails({...passengerDetails, firstName: e.target.value})} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 transition-colors" required /></div>
                      <div className="space-y-2"><label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-2">Last Name</label><input type="text" value={passengerDetails.lastName} onChange={(e) => setPassengerDetails({...passengerDetails, lastName: e.target.value})} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 transition-colors" required /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-2">Date of Birth</label><input type="date" value={passengerDetails.dob} onChange={(e) => setPassengerDetails({...passengerDetails, dob: e.target.value})} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 transition-colors dark:[color-scheme:dark]" required /></div>
                      <div className="space-y-2">
                        <label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-2">Gender</label>
                        <select value={passengerDetails.gender} onChange={(e) => setPassengerDetails({...passengerDetails, gender: e.target.value})} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 transition-colors">
                          <option value="m">Male</option><option value="f">Female</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2"><label className="text-xs font-black uppercase text-slate-400 tracking-widest ml-2">Email for E-Tickets</label><input type="email" value={passengerDetails.email} onChange={(e) => setPassengerDetails({...passengerDetails, email: e.target.value})} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-2xl p-4 font-bold outline-none focus:border-indigo-500 transition-colors" required /></div>

                    <div className="bg-slate-50 dark:bg-[#1e293b] rounded-[2rem] p-8 mt-10 flex flex-col md:flex-row justify-between items-center border border-slate-200 dark:border-white/5 shadow-inner">
                      <div className="mb-6 md:mb-0 text-center md:text-left">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1 flex items-center justify-center md:justify-start">
                           <Users className="h-3 w-3 mr-1"/> Total Amount ({passengers} {passengers > 1 ? 'Travelers' : 'Traveler'})
                        </p>
                        <p className="text-4xl font-black text-indigo-600 dark:text-indigo-400">{selectedOffer.total_currency} {selectedOffer.total_amount}</p>
                      </div>
                      <button type="submit" className="w-full md:w-auto bg-slate-900 dark:bg-indigo-600 text-white px-10 py-5 rounded-2xl font-black shadow-2xl hover:bg-slate-800 dark:hover:bg-indigo-500 transition-all hover:-translate-y-1">Pay with Razorpay</button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 3: PROCESSING OVERLAY */}
            {/* ========================================================= */}
            {bookingStep === "PROCESSING" && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#f8fafc]/90 dark:bg-[#030712]/90 backdrop-blur-md animate-in fade-in duration-300 rounded-[3rem]">
                <TravelLoader 
                  isLanding={true}
                  messages={[
                    "Clearing departure with ATC...", 
                    "Securing your preferred cabin class...", 
                    "Generating Airline PNR...", 
                    `Reserving baggage for ${passengers} traveler${passengers > 1 ? 's' : ''}...`,
                    "Syncing to Master Itinerary..."
                  ]} 
                />
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 4: BEAUTIFUL E-TICKET WITH PDF & EMAIL */}
            {/* ========================================================= */}
            {bookingStep === "TICKET" && selectedOffer && (
               <div className="relative z-10 animate-in zoom-in-95 duration-700">
                 <div className="text-center mb-10">
                   <div className="h-24 w-24 bg-gradient-to-br from-emerald-400 to-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/30"><CheckCircle2 className="h-12 w-12 text-white" /></div>
                   <h2 className="text-4xl font-black text-slate-900 dark:text-white mb-2">Booking Confirmed</h2>
                   <p className="text-slate-500 font-bold">Your flight has been securely added to your WanderHub Itinerary.</p>
                 </div>

                 {/* BOARDING PASS UI */}
                 <div id="e-ticket-board" className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-2xl overflow-hidden max-w-2xl mx-auto relative mb-8">
                   <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-indigo-500 to-purple-500"></div>
                   
                   <div className="p-8 md:p-10 pb-0 flex justify-between items-start">
                     <div>
                       <p className="text-xs font-black uppercase tracking-widest text-slate-400 mb-1">Airline Locator (PNR)</p>
                       <p className="text-5xl font-black text-indigo-600 dark:text-indigo-400 tracking-wider">{generatedPnr}</p>
                     </div>
                     <Ticket className="h-12 w-12 text-slate-200 dark:text-slate-800" />
                   </div>

                   <div className="p-8 md:p-10">
                     <div className="flex justify-between items-center mb-10 border-b border-dashed border-slate-200 dark:border-white/10 pb-8">
                       <div><p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Lead Passenger</p><p className="font-black text-xl text-slate-900 dark:text-white uppercase">{passengerDetails.firstName} {passengerDetails.lastName}</p></div>
                       <div className="text-right">
                          <p className="text-xs font-black text-slate-400 uppercase tracking-widest mb-1">Flight No.</p>
                          <p className="font-black text-xl text-slate-900 dark:text-white">{selectedOffer.owner.name} {selectedOffer.slices[0].segments[0].marketing_carrier_flight_number}</p>
                       </div>
                     </div>

                     <div className="flex justify-between items-center bg-slate-50 dark:bg-[#1e293b] p-6 rounded-3xl border border-slate-100 dark:border-white/5">
                       <div><p className="text-5xl font-black text-slate-900 dark:text-white">{selectedOffer.slices[0].origin.iata_code}</p><p className="text-sm font-black text-slate-500 mt-2 uppercase">{formatFlightTime(selectedOffer.slices[0].segments[0].departing_at)}</p></div>
                       <div className="flex flex-col items-center">
                          <Plane className="h-8 w-8 text-indigo-400 rotate-45 mb-2" />
                          <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{cabinClass}</span>
                       </div>
                       <div className="text-right"><p className="text-5xl font-black text-slate-900 dark:text-white">{selectedOffer.slices[0].destination.iata_code}</p><p className="text-sm font-black text-slate-500 mt-2 uppercase">{formatFlightTime(selectedOffer.slices[0].segments[0].arriving_at)}</p></div>
                     </div>
                   </div>

                   <div className="bg-slate-900 dark:bg-black p-8 flex flex-col md:flex-row justify-between items-center">
                     <div className="text-center md:text-left">
                       <p className="text-xs font-bold text-slate-400 mb-1 flex items-center justify-center md:justify-start"><Briefcase className="h-3 w-3 mr-2"/> Baggage Confirmed: 23kg Checked</p>
                       <p className="text-xs font-bold text-slate-400 flex items-center justify-center md:justify-start"><Users className="h-3 w-3 mr-2"/> Total Passengers: {passengers}</p>
                     </div>
                     <div className="hidden md:block text-right">
                       <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1">Issue Date</p>
                       <p className="text-sm font-bold text-white">{new Date().toLocaleDateString()}</p>
                     </div>
                   </div>
                 </div>

                 {/* ACTION BUTTONS */}
                 <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-4">
                   <button 
                     onClick={handleEmailTicket} 
                     disabled={isEmailSending}
                     className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white px-6 py-4 rounded-2xl font-black transition-colors shadow-lg flex items-center justify-center disabled:opacity-70"
                   >
                     {isEmailSending ? <Loader2 className="h-5 w-5 animate-spin mr-2"/> : <CheckCircle2 className="h-5 w-5 mr-2"/>}
                     {isEmailSending ? "Sending Email..." : "Email E-Ticket"}
                   </button>
                   
                   <button 
                     onClick={handleDownloadPDF} 
                     disabled={isPdfGenerating}
                     className="flex-1 bg-indigo-600 hover:bg-indigo-500 text-white px-6 py-4 rounded-2xl font-black transition-colors shadow-lg flex items-center justify-center disabled:opacity-70"
                   >
                     {isPdfGenerating ? <Loader2 className="h-5 w-5 animate-spin mr-2"/> : <Download className="h-5 w-5 mr-2"/>}
                     {isPdfGenerating ? "Generating..." : "Download PDF"}
                   </button>

                   <button 
                     onClick={() => {
                        setBookingStep("SEARCH");
                        setActiveTab("my_bookings"); // Send them to their new booking tab!
                     }} 
                     className="flex-1 bg-white dark:bg-[#1e293b] hover:bg-slate-50 dark:hover:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-900 dark:text-white px-6 py-4 rounded-2xl font-black transition-colors shadow-sm"
                   >
                     View My Bookings
                   </button>
                 </div>
                 
               </div>
            )}

          </div>
        </main>
      </div>
    </div>
  );
}