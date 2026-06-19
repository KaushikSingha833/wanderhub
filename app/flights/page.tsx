"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { collection, onSnapshot, query, where, addDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, MapPin, Plane, BedDouble, Loader2, Menu, X, ArrowRightLeft, Search, CheckCircle2, AlertCircle, User as UserIcon, Ticket, Briefcase, Users, Tag, Download, Map as MapIcon, Clock, Hash, MessageSquare, Info, ChevronDown, History } from "lucide-react";
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

  // PAGE TABS STATE
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
        
        const q = query(collection(db, "trips"), where("members", "array-contains", currentUser.uid), where("status", "==", "active"));
        onSnapshot(q, (snapshot) => {
          const tripsData = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title }));
          setTrips(tripsData);
          if (tripsData.length > 0 && !selectedTripId) setSelectedTripId(tripsData[0].id);
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // FETCH USER'S PAST BOOKINGS
  useEffect(() => {
    if (trips.length === 0) return;
    const tripIds = trips.map(t => t.id);
    
    const q = query(collection(db, "activities"), where("type", "==", "flight"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const flights = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((act: any) => tripIds.includes(act.tripId))
        .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime()); 
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
        theme: { color: "#10b981" }, // Emerald color
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
    if (!ticketElement) {
      setIsEmailSending(false);
      return;
    }

    try {
      // 1. COMPRESS THE IMAGE: Lowered pixelRatio and quality to prevent 413 Payload Too Large
      const dataUrl = await toPng(ticketElement, { quality: 0.8, pixelRatio: 1 });
      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (ticketElement.offsetHeight * pdfWidth) / ticketElement.offsetWidth;
      pdf.addImage(dataUrl, "PNG", 0, 15, pdfWidth, pdfHeight);

      const pdfBase64 = pdf.output('datauristring');

      // 2. Send to backend
      const res = await fetch("/api/flights/send-ticket", {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: passengerDetails.email, 
          pnr: generatedPnr, 
          pdfBase64: pdfBase64,
          passengerName: passengerDetails.firstName, 
          flightNo: selectedOffer.slices[0].segments[0].marketing_carrier_flight_number
        }),
      });

      const data = await res.json();
      
      if (!res.ok || data.error) {
        throw new Error(data.error || `Server Error: ${res.status}`);
      }
      
      alert(`Success! E-Ticket emailed to ${passengerDetails.email}`);
    } catch (error: any) {
      console.error("Email Failed:", error);
      alert(`Failed to send email: ${error.message}. Please check your server terminal for details.`);
    } finally {
      setIsEmailSending(false);
    }
  };

  const formatFlightTime = (isoString: string) => {
    return new Date(isoString).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden selection:bg-emerald-500/20 transition-colors duration-300">
      
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
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Map className="h-5 w-5 mr-3 opacity-70" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Calendar className="h-5 w-5 mr-3 opacity-70" /> Itineraries</Link>
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
            <MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat
          </Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><Plane className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Book Flights</Link>
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

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

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

        {/* DESKTOP HEADER (MINIMALIST) */}
        <header className="hidden md:flex h-24 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 items-center justify-between px-12 z-20 shrink-0 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter">Flight Hub</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-1">Search flights and manage boarding passes.</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar relative z-10">
          <div className="max-w-[1000px] mx-auto pb-24">

            {/* --- TABS NAVIGATION --- */}
            {bookingStep === "SEARCH" && (
              <div className="flex items-center gap-8 mb-10 border-b border-zinc-200 dark:border-zinc-800 w-full overflow-x-auto custom-scrollbar pb-1">
                <button 
                  onClick={() => setActiveTab("book")} 
                  className={`flex items-center pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === 'book' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                >
                  <Search className="h-4 w-4 mr-2" /> Search Flights
                </button>
                <button 
                  onClick={() => setActiveTab("my_bookings")} 
                  className={`flex items-center pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === 'my_bookings' ? 'border-zinc-900 dark:border-white text-zinc-900 dark:text-white' : 'border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300'}`}
                >
                  <Ticket className="h-4 w-4 mr-2" /> My Bookings 
                  {myFlights.length > 0 && <span className="ml-2 bg-emerald-500 text-zinc-950 px-2 py-0.5 rounded-full">{myFlights.length}</span>}
                </button>
              </div>
            )}

            {/* ========================================================= */}
            {/* VIEW: MY BOOKINGS LIST */}
            {/* ========================================================= */}
            {activeTab === "my_bookings" && bookingStep === "SEARCH" && (
              <div className="animate-in fade-in duration-500">
                {myFlights.length === 0 ? (
                  <div className="text-center py-32 bg-transparent rounded-[2rem] border border-dashed border-zinc-300 dark:border-zinc-800 shadow-sm">
                    <Plane className="h-16 w-16 text-zinc-300 dark:text-zinc-700 mx-auto mb-6" />
                    <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">No Flights Booked</h3>
                    <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-2 text-sm">You have not booked any flights through WanderHub yet.</p>
                    <button onClick={() => setActiveTab("book")} className="mt-8 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-3.5 rounded-full font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-opacity active:scale-95 shadow-md">Book a Flight Now</button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {myFlights.map((flight) => {
                      const details = flight.notes || "";
                      const pnrMatch = details.match(/PNR:\s*([A-Z0-9]+)/);
                      const airlineMatch = details.match(/Airline:\s*([^,]+)/);
                      const pnr = pnrMatch ? pnrMatch[1] : "N/A";
                      const airline = airlineMatch ? airlineMatch[1] : "WanderHub Partner";

                      return (
                        <div key={flight.id} className="bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 rounded-[2rem] shadow-sm hover:shadow-2xl transition-all duration-300 overflow-hidden group hover:border-zinc-300 dark:hover:border-zinc-700">
                          <div className="bg-zinc-900 dark:bg-black px-8 py-6 flex justify-between items-center text-white relative overflow-hidden border-b border-zinc-800">
                            <div className="absolute right-0 top-0 w-32 h-32 bg-emerald-500/20 rounded-full blur-[40px]"></div>
                            <div className="relative z-10">
                              <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400 mb-1">Booking PNR</p>
                              <p className="text-2xl font-black tracking-widest">{pnr}</p>
                            </div>
                            <div className="h-12 w-12 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-md border border-white/10 relative z-10 group-hover:scale-110 transition-transform">
                              <Plane className="h-5 w-5 text-white" />
                            </div>
                          </div>
                          
                          <div className="p-8">
                            <div className="flex justify-between items-center mb-8">
                              <div className="flex-1">
                                <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">{flight.location.split('➔')[0].trim()}</p>
                                <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">{new Date(flight.date).toLocaleDateString()}</p>
                              </div>
                              <div className="flex-1 flex justify-center">
                                <PlaneTakeoff className="h-6 w-6 text-zinc-300 dark:text-zinc-700 group-hover:text-emerald-500 group-hover:translate-x-2 transition-all duration-300" />
                              </div>
                              <div className="flex-1 text-right">
                                <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">{flight.location.split('➔')[1]?.trim()}</p>
                                <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">{flight.time}</p>
                              </div>
                            </div>

                            <div className="bg-zinc-50 dark:bg-zinc-950 p-5 rounded-2xl border border-zinc-200 dark:border-zinc-800 flex flex-col gap-4">
                              <div className="flex justify-between items-center text-sm">
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest flex items-center"><Hash className="h-3 w-3 mr-1.5"/> Flight</span>
                                <span className="font-black text-zinc-900 dark:text-white tracking-widest">{flight.trackingNumber}</span>
                              </div>
                              <div className="flex justify-between items-center text-sm border-t border-zinc-200 dark:border-zinc-800 pt-4">
                                <span className="text-[10px] text-zinc-500 dark:text-zinc-400 font-bold uppercase tracking-widest flex items-center"><Plane className="h-3 w-3 mr-1.5"/> Airline</span>
                                <span className="font-black text-zinc-900 dark:text-white">{airline}</span>
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
              <div className="relative z-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[3rem] transform -rotate-1 opacity-5 dark:opacity-10 blur-xl"></div>
                
                <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative overflow-hidden">
                  
                  <div className="relative z-10">
                    <div className="flex items-center gap-5 mb-10 border-b border-zinc-100 dark:border-zinc-800 pb-8">
                      <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-full flex items-center justify-center shadow-inner border border-zinc-200 dark:border-zinc-700">
                        <PlaneTakeoff className="h-6 w-6" />
                      </div>
                      <div>
                        <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">Global Flight Engine</h3>
                        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 flex items-center gap-2 mt-1.5 uppercase tracking-widest">
                          <span className="relative flex h-2 w-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>
                          Live NDC Feed via Duffel
                        </p>
                      </div>
                    </div>
                    
                    <form onSubmit={handleFlightSearch} className="space-y-6">
                      {/* ADVANCED FILTERS ROW */}
                      <div className="flex flex-wrap gap-4 mb-2">
                        <div className="flex bg-zinc-50 dark:bg-zinc-950 p-1.5 rounded-full border border-zinc-200 dark:border-zinc-800">
                          <button type="button" onClick={() => setTripType("oneway")} className={`px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${tripType === "oneway" ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}>One Way</button>
                          <button type="button" onClick={() => setTripType("roundtrip")} className={`px-5 py-2.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all ${tripType === "roundtrip" ? "bg-white dark:bg-zinc-800 shadow-sm text-zinc-900 dark:text-white" : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"}`}>Round Trip</button>
                        </div>

                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 rounded-full border border-zinc-200 dark:border-zinc-800 px-5 group">
                          <Users className="h-4 w-4 text-zinc-400 mr-2 group-hover:text-emerald-500 transition-colors" />
                          <select value={passengers} onChange={(e) => setPassengers(Number(e.target.value))} className="bg-transparent text-xs font-bold text-zinc-700 dark:text-zinc-200 outline-none cursor-pointer py-3 appearance-none">
                            {[1, 2, 3, 4, 5, 6].map(num => <option key={num} value={num}>{num} Traveler{num > 1 ? 's' : ''}</option>)}
                          </select>
                        </div>

                        <div className="flex items-center bg-zinc-50 dark:bg-zinc-950 rounded-full border border-zinc-200 dark:border-zinc-800 px-5 group">
                          <select value={cabinClass} onChange={(e) => setCabinClass(e.target.value)} className="bg-transparent text-xs font-bold text-zinc-700 dark:text-zinc-200 outline-none cursor-pointer py-3 uppercase tracking-widest appearance-none">
                            <option value="economy">Economy</option>
                            <option value="premium_economy">Premium Econ</option>
                            <option value="business">Business</option>
                            <option value="first">First Class</option>
                          </select>
                        </div>
                      </div>

                      <div className="bg-zinc-50 dark:bg-zinc-950 p-3 md:p-4 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row gap-3 items-center shadow-inner">
                        <div className="relative flex-1 w-full group bg-white dark:bg-zinc-900 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none"><MapPin className="h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" /></div>
                          <input type="text" value={flightOrigin} onChange={(e)=>setFlightOrigin(e.target.value.toUpperCase())} className="w-full bg-transparent border-none py-4 pl-12 pr-4 text-base font-black uppercase tracking-widest outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" placeholder="ORIGIN (LHR)" maxLength={3} />
                        </div>
                        
                        <div className="h-10 w-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center z-10 shrink-0 md:-mx-6 shadow-sm text-zinc-500">
                          <ArrowRightLeft className="h-4 w-4 md:rotate-0 rotate-90" />
                        </div>

                        <div className="relative flex-1 w-full group bg-white dark:bg-zinc-900 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none"><MapPin className="h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" /></div>
                          <input type="text" value={flightDest} onChange={(e)=>setFlightDest(e.target.value.toUpperCase())} className="w-full bg-transparent border-none py-4 pl-12 pr-4 text-base font-black uppercase tracking-widest outline-none text-zinc-900 dark:text-white placeholder:text-zinc-400" placeholder="DEST (JFK)" maxLength={3} />
                        </div>

                        <div className="relative flex-1 w-full group bg-white dark:bg-zinc-900 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none"><Calendar className="h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" /></div>
                          <input type="date" value={flightDate} onChange={(e)=>setFlightDate(e.target.value)} className="w-full bg-transparent border-none py-4 pl-12 pr-4 text-sm font-bold outline-none text-zinc-900 dark:text-white dark:[color-scheme:dark]" />
                        </div>

                        {tripType === "roundtrip" && (
                          <div className="relative flex-1 w-full group bg-white dark:bg-zinc-900 rounded-[1.5rem] border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors animate-in slide-in-from-right-4 duration-300">
                            <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none"><Calendar className="h-4 w-4 text-zinc-400 group-focus-within:text-emerald-500 transition-colors" /></div>
                            <input type="date" value={returnDate} onChange={(e)=>setReturnDate(e.target.value)} className="w-full bg-transparent border-none py-4 pl-12 pr-4 text-sm font-bold outline-none text-zinc-900 dark:text-white dark:[color-scheme:dark]" required />
                          </div>
                        )}

                        <button type="submit" disabled={isFlightLoading} className="w-full md:w-auto h-full bg-emerald-500 text-zinc-950 px-10 py-4 md:py-0 rounded-[1.5rem] font-bold text-xs uppercase tracking-widest hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] flex items-center justify-center shrink-0 active:scale-95 disabled:opacity-50">
                          {isFlightLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Search"}
                        </button>
                      </div>
                    </form>

                    {/* LOADING STATE: FLIGHT SEARCH */}
                    {isFlightLoading && (
                      <div className="mt-12 py-16 animate-in fade-in duration-500 bg-white/40 dark:bg-zinc-950/40 backdrop-blur-2xl rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-xl">
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
                      <div className="mt-10 py-12 text-center bg-rose-50 dark:bg-rose-500/10 rounded-3xl border border-rose-100 dark:border-rose-500/20">
                        <p className="text-rose-600 dark:text-rose-400 font-bold text-sm">No flights found. Try different dates or check your IATA codes.</p>
                      </div>
                    )}

                    {/* INTERACTIVE RESULTS LIST */}
                    {!isFlightLoading && flightResults.length > 0 && (
                      <div className="mt-12 space-y-6 animate-in fade-in slide-in-from-bottom-8 duration-700">
                        <div className="flex items-center justify-between px-2 mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-2">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Live Inventory</p>
                          <p className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-100 dark:border-emerald-500/20">{flightResults.length} Offers Available</p>
                        </div>
                        
                        {flightResults.map((offer: any) => {
                          const slice = offer.slices[0];
                          const segment = slice.segments[0];
                          const capacity = segment.available_capacity || 9;
                          
                          const originalPrice = tripType === "roundtrip" ? (Number(offer.total_amount) * 1.15).toFixed(2) : null;
                          
                          return (
                            <div key={offer.id} className="group bg-white dark:bg-zinc-900/50 border border-zinc-200 dark:border-zinc-800/50 rounded-[2rem] p-6 md:p-8 flex flex-col lg:flex-row lg:items-center justify-between hover:border-zinc-400 dark:hover:border-zinc-600 hover:shadow-2xl transition-all duration-300 relative overflow-hidden">
                              
                              {tripType === "roundtrip" && (
                                <div className="absolute top-0 right-0 bg-emerald-500 text-zinc-950 text-[8px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-bl-2xl flex items-center shadow-sm">
                                  <Tag className="h-3 w-3 mr-1.5" /> 15% Round-Trip Saver
                                </div>
                              )}

                              <div className="flex items-center gap-5 lg:w-1/4 mb-8 lg:mb-0">
                                <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-2xl flex items-center justify-center border border-zinc-200 dark:border-zinc-700 shadow-inner">
                                  {offer.owner.logo_symbol_url ? (
                                    /* eslint-disable-next-line @next/next/no-img-element */
                                    <img src={offer.owner.logo_symbol_url} alt={offer.owner.name} className="h-10 w-10 object-contain filter drop-shadow-sm" />
                                  ) : (
                                    <Plane className="h-8 w-8 text-zinc-400" />
                                  )}
                                </div>
                                <div>
                                  <p className="text-xl font-black text-zinc-900 dark:text-white leading-tight tracking-tight mb-2">{offer.owner.name}</p>
                                  <div className="flex flex-col gap-2">
                                    <div className="flex items-center gap-2">
                                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border border-zinc-200 dark:border-zinc-700 px-2 py-0.5 rounded-md bg-zinc-50 dark:bg-zinc-950">
                                        {segment.marketing_carrier_flight_number}
                                      </p>
                                      {capacity < 5 && (
                                         <span className="text-[10px] font-bold text-rose-500 bg-rose-50 dark:bg-rose-500/10 px-2 py-0.5 rounded-md flex items-center border border-rose-100 dark:border-rose-500/20"><AlertCircle className="h-3 w-3 mr-1"/> {capacity} Left</span>
                                      )}
                                    </div>
                                    <div className="flex items-center text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
                                      <Briefcase className="h-3 w-3 mr-1.5" /> 7kg Cabin • 23kg Checked
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center justify-between flex-1 px-0 lg:px-12 mb-8 lg:mb-0 relative">
                                 <div className="text-center">
                                   <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">{formatFlightTime(segment.departing_at)}</p>
                                   <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">{slice.origin.iata_code}</p>
                                 </div>
                                 
                                 <div className="flex-1 px-6 flex flex-col items-center relative">
                                   <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 bg-zinc-100 dark:bg-zinc-800 px-3 py-1 rounded-full z-10 border border-zinc-200 dark:border-zinc-700">
                                     {slice.duration.replace('PT','').replace('H','h ').replace('M','m')}
                                   </p>
                                   <div className="w-full border-t border-dashed border-zinc-300 dark:border-zinc-700 relative flex items-center justify-center">
                                      <div className="absolute h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600 left-0 -translate-x-1/2"></div>
                                      <Plane className="h-5 w-5 text-zinc-300 dark:text-zinc-600 absolute bg-white dark:bg-zinc-900 px-1" />
                                      <div className="absolute h-2 w-2 rounded-full bg-zinc-300 dark:bg-zinc-600 right-0 translate-x-1/2"></div>
                                   </div>
                                   <p className="text-[9px] font-bold text-zinc-400 mt-2 uppercase tracking-widest">{cabinClass}</p>
                                 </div>

                                 <div className="text-center">
                                   <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">{formatFlightTime(segment.arriving_at)}</p>
                                   <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">{slice.destination.iata_code}</p>
                                 </div>
                              </div>

                              <div className="lg:w-1/4 flex flex-row lg:flex-col items-center lg:items-end justify-between lg:justify-center border-t lg:border-t-0 lg:border-l border-zinc-100 dark:border-zinc-800 pt-5 lg:pt-0 lg:pl-8">
                                <div className="text-left lg:text-right">
                                  <p className="text-[9px] font-bold text-zinc-400 uppercase tracking-widest mb-1 flex items-center justify-end">
                                    <Users className="h-3 w-3 mr-1"/> For {passengers} Traveler{passengers > 1 ? 's' : ''}
                                  </p>
                                  {originalPrice && (
                                    <p className="text-xs font-black text-zinc-400 line-through decoration-rose-500/50">{offer.total_currency} {originalPrice}</p>
                                  )}
                                  <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">
                                    {offer.total_currency} {Number(offer.total_amount).toLocaleString()}
                                  </p>
                                </div>
                                <button 
                                   onClick={() => handleBookClick(offer)} 
                                   className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-3.5 rounded-full text-[10px] font-bold uppercase tracking-widest hover:opacity-90 transition-opacity shadow-md mt-0 lg:mt-4 active:scale-95"
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
                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-500 rounded-[3rem] transform -rotate-1 opacity-5 dark:opacity-10 blur-xl"></div>
                
                <div className="bg-white dark:bg-zinc-900/80 backdrop-blur-xl rounded-[2.5rem] p-8 md:p-12 border border-zinc-200 dark:border-zinc-800 shadow-2xl relative overflow-hidden">
                  <button onClick={() => setBookingStep("SEARCH")} className="text-xs font-bold uppercase tracking-widest text-zinc-400 hover:text-zinc-900 dark:hover:text-white mb-10 flex items-center transition-colors active:scale-95">&larr; Back to Flights</button>
                  
                  <div className="flex flex-col lg:flex-row lg:items-center justify-between mb-10 pb-8 border-b border-zinc-200 dark:border-zinc-800 gap-8">
                    <div className="flex items-center gap-5">
                      <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white rounded-full flex items-center justify-center shadow-inner border border-zinc-200 dark:border-zinc-700"><UserIcon className="h-7 w-7" /></div>
                      <div>
                        <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter mb-1">Passenger Details</h3>
                        <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">Booking for {passengers} passenger{passengers > 1 ? 's' : ''} in {cabinClass}.</p>
                      </div>
                    </div>

                    <div className="bg-zinc-50 dark:bg-zinc-950 p-4 md:p-5 rounded-3xl border border-zinc-200 dark:border-zinc-800 shrink-0">
                      <label className="text-[9px] font-bold uppercase text-zinc-500 tracking-widest block mb-2 pl-1">Attach to Itinerary</label>
                      <div className="relative flex items-center group">
                        <MapIcon className="absolute left-4 h-4 w-4 text-zinc-400 pointer-events-none group-focus-within:text-emerald-500 transition-colors" />
                        <select 
                          value={selectedTripId} 
                          onChange={(e) => setSelectedTripId(e.target.value)}
                          className="appearance-none bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full pl-11 pr-10 py-3 text-xs font-bold uppercase tracking-widest text-zinc-900 dark:text-white outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer w-full min-w-[250px] shadow-sm transition-all"
                        >
                          {trips.length === 0 ? <option value="">No Trips Found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
                        </select>
                        <ChevronDown className="absolute right-4 h-4 w-4 text-zinc-400 pointer-events-none" />
                      </div>
                    </div>
                  </div>

                  <form onSubmit={handlePaymentAndBooking} className="space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest ml-1">First Name</label><input type="text" value={passengerDetails.firstName} onChange={(e) => setPassengerDetails({...passengerDetails, firstName: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-zinc-900 dark:text-white placeholder-zinc-400" required /></div>
                      <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest ml-1">Last Name</label><input type="text" value={passengerDetails.lastName} onChange={(e) => setPassengerDetails({...passengerDetails, lastName: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-zinc-900 dark:text-white placeholder-zinc-400" required /></div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest ml-1">Date of Birth</label><input type="date" value={passengerDetails.dob} onChange={(e) => setPassengerDetails({...passengerDetails, dob: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-zinc-900 dark:text-white dark:[color-scheme:dark]" required /></div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest ml-1">Gender</label>
                        <select value={passengerDetails.gender} onChange={(e) => setPassengerDetails({...passengerDetails, gender: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-zinc-900 dark:text-white appearance-none cursor-pointer">
                          <option value="m">Male</option><option value="f">Female</option>
                        </select>
                      </div>
                    </div>
                    <div className="space-y-2"><label className="text-[10px] font-bold uppercase text-zinc-500 tracking-widest ml-1">Email for E-Tickets</label><input type="email" value={passengerDetails.email} onChange={(e) => setPassengerDetails({...passengerDetails, email: e.target.value})} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 text-sm font-bold outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-colors text-zinc-900 dark:text-white placeholder-zinc-400" required /></div>

                    <div className="bg-zinc-50 dark:bg-zinc-950 rounded-[2rem] p-8 md:p-10 mt-12 flex flex-col md:flex-row justify-between items-center border border-zinc-200 dark:border-zinc-800 shadow-inner">
                      <div className="mb-8 md:mb-0 text-center md:text-left">
                        <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 flex items-center justify-center md:justify-start">
                           <Users className="h-3.5 w-3.5 mr-1.5"/> Total Amount ({passengers} {passengers > 1 ? 'Travelers' : 'Traveler'})
                        </p>
                        <p className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white tracking-tighter">{selectedOffer.total_currency} {selectedOffer.total_amount}</p>
                      </div>
                      <button type="submit" className="w-full md:w-auto bg-emerald-500 text-zinc-950 px-10 py-5 rounded-full font-bold text-xs uppercase tracking-widest shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:bg-emerald-400 transition-all active:scale-95 flex items-center justify-center">
                        Secure Checkout &rarr;
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* STEP 3: PROCESSING OVERLAY */}
            {/* ========================================================= */}
            {bookingStep === "PROCESSING" && (
              <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#FDFDFD]/90 dark:bg-zinc-950/90 backdrop-blur-xl animate-in fade-in duration-300 rounded-[3rem]">
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
                 <div className="text-center mb-12">
                   <div className="h-24 w-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-inner"><CheckCircle2 className="h-10 w-10 text-emerald-500" /></div>
                   <h2 className="text-4xl md:text-5xl font-black text-zinc-900 dark:text-white mb-3 tracking-tighter">Booking Confirmed</h2>
                   <p className="text-zinc-500 font-medium text-sm">Your flight has been securely added to your WanderHub Itinerary.</p>
                 </div>

                 {/* BOARDING PASS UI */}
                 <div id="e-ticket-board" className="bg-white dark:bg-zinc-900 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800 shadow-2xl overflow-hidden max-w-3xl mx-auto relative mb-10">
                   <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-500 to-teal-500"></div>
                   
                   <div className="p-8 md:p-12 pb-0 flex justify-between items-start">
                     <div>
                       <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-400 mb-1.5">Airline Locator (PNR)</p>
                       <p className="text-5xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-widest">{generatedPnr}</p>
                     </div>
                     <Ticket className="h-12 w-12 text-zinc-200 dark:text-zinc-800" />
                   </div>

                   <div className="p-8 md:p-12">
                     <div className="flex justify-between items-end mb-10 border-b border-dashed border-zinc-200 dark:border-zinc-800 pb-10">
                       <div><p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Lead Passenger</p><p className="font-black text-xl text-zinc-900 dark:text-white uppercase tracking-tight">{passengerDetails.firstName} {passengerDetails.lastName}</p></div>
                       <div className="text-right">
                          <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1.5">Flight No.</p>
                          <p className="font-black text-xl text-zinc-900 dark:text-white tracking-tight">{selectedOffer.owner.name} {selectedOffer.slices[0].segments[0].marketing_carrier_flight_number}</p>
                       </div>
                     </div>

                     <div className="flex justify-between items-center bg-zinc-50 dark:bg-zinc-950 p-6 md:p-8 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 shadow-inner">
                       <div><p className="text-5xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-tighter">{selectedOffer.slices[0].origin.iata_code}</p><p className="text-sm font-bold text-zinc-500 mt-3 uppercase tracking-widest">{formatFlightTime(selectedOffer.slices[0].segments[0].departing_at)}</p></div>
                       <div className="flex flex-col items-center">
                          <Plane className="h-8 w-8 text-zinc-300 dark:text-zinc-700 rotate-45 mb-3" />
                          <span className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 border border-zinc-200 dark:border-zinc-800 px-3 py-1 rounded-full">{cabinClass}</span>
                       </div>
                       <div className="text-right"><p className="text-5xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-tighter">{selectedOffer.slices[0].destination.iata_code}</p><p className="text-sm font-bold text-zinc-500 mt-3 uppercase tracking-widest">{formatFlightTime(selectedOffer.slices[0].segments[0].arriving_at)}</p></div>
                     </div>
                   </div>

                   <div className="bg-zinc-950 p-8 md:p-10 flex flex-col md:flex-row justify-between items-center border-t border-zinc-800">
                     <div className="text-center md:text-left mb-6 md:mb-0">
                       <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-2 flex items-center justify-center md:justify-start"><Briefcase className="h-3 w-3 mr-2"/> Baggage: 23kg Checked</p>
                       <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest flex items-center justify-center md:justify-start"><Users className="h-3 w-3 mr-2"/> Total Passengers: {passengers}</p>
                     </div>
                     <div className="text-center md:text-right">
                       <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Issue Date</p>
                       <p className="text-sm font-bold text-white uppercase tracking-widest">{new Date().toLocaleDateString()}</p>
                     </div>
                   </div>
                 </div>

                 {/* ACTION BUTTONS */}
                 <div className="max-w-2xl mx-auto flex flex-col sm:flex-row gap-4">
                   <button 
                     onClick={handleEmailTicket} 
                     disabled={isEmailSending}
                     className="flex-1 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 px-6 py-4 rounded-full font-bold text-xs uppercase tracking-widest transition-colors shadow-lg flex items-center justify-center disabled:opacity-70 active:scale-95"
                   >
                     {isEmailSending ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <CheckCircle2 className="h-4 w-4 mr-2"/>}
                     {isEmailSending ? "Sending Email..." : "Email E-Ticket"}
                   </button>
                   
                   <button 
                     onClick={handleDownloadPDF} 
                     disabled={isPdfGenerating}
                     className="flex-1 bg-zinc-900 dark:bg-white hover:bg-zinc-800 dark:hover:bg-zinc-200 text-white dark:text-zinc-900 px-6 py-4 rounded-full font-bold text-xs uppercase tracking-widest transition-colors shadow-lg flex items-center justify-center disabled:opacity-70 active:scale-95"
                   >
                     {isPdfGenerating ? <Loader2 className="h-4 w-4 animate-spin mr-2"/> : <Download className="h-4 w-4 mr-2"/>}
                     {isPdfGenerating ? "Generating..." : "Download PDF"}
                   </button>

                   <button 
                     onClick={() => {
                        setBookingStep("SEARCH");
                        setActiveTab("my_bookings"); 
                     }} 
                     className="flex-1 bg-transparent hover:bg-zinc-100 dark:hover:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-white px-6 py-4 rounded-full font-bold text-xs uppercase tracking-widest transition-colors shadow-sm active:scale-95"
                   >
                     View Bookings
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