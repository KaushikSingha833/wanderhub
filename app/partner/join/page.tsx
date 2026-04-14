"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; // Make sure this path is correct
import { Building2, Mail, Lock, AlertCircle, CheckCircle2, User as UserIcon, FileText, Hash, MapPin, PlaneTakeoff, ShieldCheck, ArrowRight, Loader2, LocateFixed } from "lucide-react";

import dynamic from 'next/dynamic'; // ✨ NEW

// ✨ Dynamically import the map component with SSR disabled
const PartnerMap = dynamic(() => import('../../components/PartnerMap'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full bg-slate-100 animate-pulse flex items-center justify-center text-slate-400 font-bold uppercase tracking-widest text-xs">Loading Map...</div> 
});

export default function PartnerJoinPage() {
  const router = useRouter();

  // Toggle State
  const [isLoginMode, setIsLoginMode] = useState(false);

  // Form States
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // Verification Fields
  const [licenseNumber, setLicenseNumber] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  
  // ✨ NEW: GEOLOCATION STATES
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [isMounted, setIsMounted] = useState(false);

  // UI States
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  // Fix hydration issues
  useEffect(() => {
    setIsMounted(true);
  }, []);

  const handleDetectLocation = () => {
    if (!navigator.geolocation) {
      setError("Geolocation is not supported by your browser.");
      return;
    }
    setIsDetectingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLatitude(position.coords.latitude.toFixed(6));
        setLongitude(position.coords.longitude.toFixed(6));
        setIsDetectingLocation(false);
      },
      (error) => {
        console.error(error);
        setError("Could not auto-detect location. Please drop the pin on the map manually.");
        setIsDetectingLocation(false);
      }
    );
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (isLoginMode) {
        // --- LOGIN FLOW ---
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Security Check: Ensure they are a Hotel Partner
        const userDoc = await getDoc(doc(db, "users", user.uid));
        if (userDoc.exists() && userDoc.data().role === "hotel_partner") {
          router.push("/partner/dashboard"); // Make sure this matches your route
        } else {
          await auth.signOut();
          throw new Error("Access Denied: This email is not registered as a Hotel Partner.");
        }
      } else {
        // --- REGISTRATION FLOW ---
        if (!licenseNumber.trim() || !gstNumber.trim()) {
          throw new Error("Please provide your business verification numbers.");
        }
        
        // ✨ Check for coordinates before proceeding
        if (!latitude || !longitude) {
          throw new Error("Please pin your exact property location on the map.");
        }

        // 1. Create the Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Save the Business Profile to Firestore with Coordinates locked in!
        await setDoc(doc(db, "users", user.uid), {
          uid: user.uid,
          email: user.email,
          hotelName,
          city: city.toLowerCase().trim(),
          ownerName,
          role: "hotel_partner",
          verificationStatus: "pending", 
          licenseNumber: licenseNumber.trim(),
          gstNumber: gstNumber.trim().toUpperCase(), 
          latitude: Number(latitude), // ✨ SAVED
          longitude: Number(longitude), // ✨ SAVED
          createdAt: new Date(),
        });

        setSuccess(true);
      }
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential') setError("Incorrect email or password.");
      else if (err.code === 'auth/email-already-in-use') setError("This hotel email is already registered.");
      else setError(err.message || "Failed to authenticate. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // --- SUCCESS SCREEN ---
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f172a] p-4 font-sans relative overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-emerald-600/20 rounded-full blur-[120px] animate-pulse delay-1000"></div>
        
        <div className="bg-white/10 backdrop-blur-2xl p-10 md:p-12 rounded-[2.5rem] shadow-2xl max-w-lg w-full text-center border border-white/10 relative z-10 animate-in zoom-in-95 duration-500">
          <div className="h-24 w-24 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            <CheckCircle2 className="h-12 w-12 text-emerald-400" />
          </div>
          <h2 className="text-3xl font-black text-white mb-4 tracking-tight">Application Received!</h2>
          <div className="bg-white/5 border border-white/10 rounded-2xl p-6 mb-8 text-left">
            <p className="text-slate-300 font-medium mb-3 leading-relaxed text-sm">
              Thank you for registering <strong className="text-white">{hotelName}</strong>.
            </p>
            <p className="text-slate-400 text-sm leading-relaxed mb-4">
              Our trust & safety team is currently verifying your coordinates, GSTIN (<span className="text-white font-mono">{gstNumber.toUpperCase()}</span>) and Business License.
            </p>
            <div className="flex items-center text-xs font-bold text-amber-400 uppercase tracking-widest bg-amber-400/10 px-3 py-2 rounded-lg w-max">
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Verification Pending
            </div>
          </div>
          <Link href="/" className="inline-flex w-full justify-center bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-500 transition-all shadow-lg hover:shadow-indigo-500/25">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // --- REGISTRATION / LOGIN SCREEN ---
  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans selection:bg-indigo-100">
      
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 px-6 md:px-10 py-5 flex justify-between items-center shrink-0 sticky top-0 z-50">
        <Link href="/" className="flex items-center text-slate-900 hover:text-indigo-600 transition-colors group">
          <PlaneTakeoff className="h-7 w-7 mr-2.5 text-indigo-600 group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" />
          <span className="text-2xl font-black tracking-tight">WanderHub</span>
        </Link>
        <span className="bg-slate-900 text-white px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest shadow-md">Partner Portal</span>
      </header>

      <div className="flex-1 flex items-center justify-center p-4 md:p-8 relative">
        {/* Subtle background glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="max-w-5xl w-full bg-white rounded-[2.5rem] shadow-2xl shadow-slate-200/50 border border-slate-100 overflow-hidden flex flex-col lg:flex-row relative z-10">
          
          {/* Left Side: Marketing/Branding (Hidden on mobile) */}
          <div className="hidden lg:flex lg:w-5/12 bg-[#0f172a] text-white p-12 flex-col justify-between relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/20 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/2"></div>
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/20 rounded-full blur-[80px] translate-y-1/2 -translate-x-1/2"></div>
            
            <div className="relative z-10">
              <div className="h-16 w-16 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/10 mb-8 shadow-xl">
                <Building2 className="h-8 w-8 text-indigo-400" />
              </div>
              <h2 className="text-4xl font-black tracking-tight mb-6 leading-[1.1]">Elevate your property's reach.</h2>
              <p className="text-slate-400 font-medium leading-relaxed text-lg mb-8">
                List your rooms directly to thousands of verified WanderHub travelers. Bypass heavy aggregator commissions and control your bookings.
              </p>
            </div>

            <div className="relative z-10 bg-white/5 backdrop-blur-xl p-6 rounded-[1.5rem] border border-white/10 shadow-inner">
              <div className="flex items-center mb-3">
                <ShieldCheck className="h-6 w-6 text-emerald-400 mr-3" />
                <h4 className="font-bold text-white text-lg tracking-tight">Verified B2B Network</h4>
              </div>
              <p className="text-sm text-slate-400 font-medium leading-relaxed">
                Strict GSTIN and trade license checks ensure our travelers only book with premium, legitimate partners.
              </p>
            </div>
          </div>

          {/* Right Side: The Form */}
          <div className="w-full lg:w-7/12 p-8 md:p-12 lg:p-14 bg-white">
            <h3 className="text-3xl md:text-4xl font-black text-slate-900 mb-3 tracking-tight">
              {isLoginMode ? "Welcome Back" : "Partner Registration"}
            </h3>
            <p className="text-slate-500 font-medium mb-10 text-lg">
              {isLoginMode ? "Log in to manage your bookings and inventory." : "Create your business profile to get started."}
            </p>

            {error && (
              <div className="mb-8 p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-2xl flex items-start animate-in fade-in slide-in-from-top-2">
                <AlertCircle className="h-5 w-5 mr-3 shrink-0 mt-0.5" /> 
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleAuth} className="space-y-5">
              
              {/* --- REGISTRATION ONLY FIELDS --- */}
              {!isLoginMode && (
                <div className="space-y-5 animate-in fade-in duration-500">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Hotel Name</label>
                      <div className="relative">
                        <Building2 className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                        <input type="text" value={hotelName} onChange={(e) => setHotelName(e.target.value)} required placeholder="The Grand Taj" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder-slate-400" />
                      </div>
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">City / Location</label>
                      <div className="relative">
                        <MapPin className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                        <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="e.g. Mumbai" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder-slate-400" />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Manager / Owner Name</label>
                    <div className="relative">
                      <UserIcon className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                      <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required placeholder="Rahul Sharma" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder-slate-400" />
                    </div>
                  </div>
                </div>
              )}

              {/* --- ALWAYS VISIBLE FIELDS (Email/Password) --- */}
              <div className="space-y-5">
                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Business Email</label>
                  <div className="relative">
                    <Mail className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                    <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="manager@hotel.com" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Password</label>
                  <div className="relative">
                    <Lock className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                    <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 focus:bg-white outline-none font-bold text-slate-900 transition-all placeholder-slate-400" />
                  </div>
                </div>
              </div>

              {/* --- REGISTRATION MAP AND VERIFICATION FIELDS --- */}
              {!isLoginMode && (
                <>
                  {/* ✨ NEW: GEOGRAPHIC LOCATION MAP ✨ */}
                  <div className="mt-8 bg-slate-50 rounded-3xl p-6 md:p-8 border border-slate-200 animate-in fade-in duration-500">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center">
                        <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mr-3 shrink-0">
                          <MapPin className="h-4 w-4" />
                        </div>
                        <div>
                          <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Property Location</h3>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">Pin your exact location for travelers.</p>
                        </div>
                      </div>
                      <button 
                        type="button" 
                        onClick={handleDetectLocation}
                        className="text-[10px] font-black uppercase tracking-widest bg-indigo-100 text-indigo-600 hover:bg-indigo-200 px-3 py-2 rounded-lg transition-colors flex items-center"
                      >
                        {isDetectingLocation ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <LocateFixed className="h-3 w-3 mr-1" />} Auto-Detect
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Latitude</label>
                        <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="e.g. 19.0760" required className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder-slate-400" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Longitude</label>
                        <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="e.g. 72.8777" required className="w-full px-4 py-3.5 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder-slate-400" />
                      </div>
                    </div>

                    {isMounted && (
                    <div className="rounded-2xl overflow-hidden border border-slate-200 shadow-inner h-64 relative z-0">
                      <PartnerMap 
                        latitude={latitude} 
                        longitude={longitude} 
                        setLatitude={setLatitude} 
                        setLongitude={setLongitude} 
                      />

                      {!latitude && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-white/90 backdrop-blur-md px-4 py-2 rounded-full shadow-lg border border-indigo-100 z-[1000] text-[10px] font-black uppercase tracking-widest text-indigo-600 pointer-events-none whitespace-nowrap">
                          Click map to drop pin 📍
                        </div>
                      )}
                    </div>
                  )}
                  </div>

                  <div className="mt-8 bg-slate-50 rounded-3xl p-6 md:p-8 border border-slate-200 animate-in fade-in duration-500">
                    <div className="flex items-center mb-6">
                      <div className="h-8 w-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mr-3 shrink-0">
                        <ShieldCheck className="h-4 w-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 uppercase tracking-widest">Business Verification</h3>
                        <p className="text-xs font-medium text-slate-500 mt-0.5">Required for trust & safety compliance.</p>
                      </div>
                    </div>
                    
                    <div className="space-y-5">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Trade License Number</label>
                        <div className="relative">
                          <FileText className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                          <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required placeholder="e.g. TL-2026-8921" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder-slate-400" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">GSTIN Number</label>
                        <div className="relative">
                          <Hash className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                          <input type="text" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} required placeholder="22AAAAA0000A1Z5" className="w-full pl-12 pr-4 py-4 bg-white border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder-slate-400 uppercase" />
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              )}

              <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white font-black py-4 md:py-5 rounded-2xl shadow-xl shadow-slate-900/20 hover:bg-indigo-600 hover:shadow-indigo-600/30 transition-all disabled:opacity-50 mt-8 flex justify-center items-center text-lg group">
                {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : (isLoginMode ? "Access Dashboard" : "Submit Application")}
                {!isLoading && <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />}
              </button>
            </form>

            <div className="mt-8 md:mt-10 text-center">
              <p className="text-sm font-medium text-slate-500 bg-slate-50 inline-block px-6 py-3 rounded-full border border-slate-200">
                {isLoginMode ? "Don't have a partner account?" : "Already registered your property?"}{" "}
                <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setError(""); }} className="text-indigo-600 font-black hover:text-indigo-700 transition-colors ml-1">
                  {isLoginMode ? "Register here" : "Log in here"}
                </button>
              </p>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}