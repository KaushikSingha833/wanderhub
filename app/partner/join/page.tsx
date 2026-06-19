"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc, getDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; 
import { Building2, Mail, Lock, AlertCircle, CheckCircle2, User as UserIcon, FileText, Hash, MapPin, PlaneTakeoff, ShieldCheck, ArrowRight, Loader2, LocateFixed, Sparkles, TrendingUp, CreditCard } from "lucide-react";

import dynamic from 'next/dynamic'; 

// Dynamically import the map component with SSR disabled
const PartnerMap = dynamic(() => import('../../components/PartnerMap'), { 
  ssr: false, 
  loading: () => <div className="h-full w-full bg-zinc-900/50 animate-pulse flex items-center justify-center text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Loading Satellite Map...</div> 
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
  
  // GEOLOCATION STATES
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
          router.push("/partner/dashboard"); 
        } else {
          await auth.signOut();
          throw new Error("Access Denied: This email is not registered as a Hotel Partner.");
        }
      } else {
        // --- REGISTRATION FLOW ---
        if (!licenseNumber.trim() || !gstNumber.trim()) {
          throw new Error("Please provide your business verification numbers.");
        }
        
        if (!latitude || !longitude) {
          throw new Error("Please pin your exact property location on the map.");
        }

        // 1. Create the Auth User
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // 2. Save the Business Profile to Firestore with Coordinates
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
          latitude: Number(latitude), 
          longitude: Number(longitude), 
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

  // --- SUCCESS SCREEN (CINEMATIC) ---
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 font-sans relative overflow-hidden">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none"></div>
        <div className="absolute top-[-20%] left-[-10%] w-[600px] h-[600px] bg-emerald-500/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[600px] h-[600px] bg-teal-500/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }}></div>
        
        <div className="bg-zinc-900/40 backdrop-blur-2xl p-10 md:p-16 rounded-[3rem] shadow-[0_0_50px_rgba(0,0,0,0.5)] max-w-xl w-full text-center border border-zinc-800/50 relative z-10 animate-in zoom-in-95 duration-700">
          <div className="h-28 w-28 bg-emerald-500/10 rounded-full flex items-center justify-center mx-auto mb-8 border border-emerald-500/30 shadow-[0_0_40px_rgba(16,185,129,0.3)]">
            <CheckCircle2 className="h-14 w-14 text-emerald-400" />
          </div>
          <h2 className="text-4xl font-black text-white mb-4 tracking-tighter">Application Received</h2>
          <div className="bg-zinc-950/50 border border-zinc-800/50 rounded-3xl p-8 mb-10 text-left shadow-inner">
            <p className="text-zinc-300 font-medium mb-5 leading-relaxed text-sm">
              Thank you for registering <strong className="text-white text-base">{hotelName}</strong>.
            </p>
            <p className="text-zinc-500 text-sm leading-relaxed mb-8">
              Our trust & safety team is currently verifying your coordinates, GSTIN (<span className="text-white font-mono tracking-widest">{gstNumber.toUpperCase()}</span>) and Business License. This process typically takes 1-2 business days.
            </p>
            <div className="flex items-center text-[10px] font-bold text-amber-400 uppercase tracking-widest bg-amber-500/10 border border-amber-500/20 px-4 py-2.5 rounded-full w-max">
              <Loader2 className="h-3.5 w-3.5 mr-2 animate-spin" /> Verification Pending
            </div>
          </div>
          <Link href="/" className="inline-flex w-full justify-center bg-white text-zinc-950 px-8 py-5 rounded-full font-black text-xs uppercase tracking-widest hover:bg-zinc-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.15)] active:scale-95">
            Return to Homepage
          </Link>
        </div>
      </div>
    );
  }

  // --- FULL-SCREEN SPLIT LAYOUT ---
  return (
    <div className="h-screen w-full flex bg-zinc-950 font-sans selection:bg-emerald-500/30 overflow-hidden">
      
      {/* LEFT SIDE: IMMERSIVE BRANDING (Hidden on Mobile) */}
      <div className="hidden lg:flex lg:w-5/12 relative flex-col justify-between p-12 overflow-hidden border-r border-zinc-800 z-10">
        
        {/* Background Image & Gradients */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img 
          src="https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200" 
          alt="Luxury Resort" 
          className="absolute inset-0 w-full h-full object-cover filter grayscale-[0.2]" 
        />
        <div className="absolute inset-0 bg-gradient-to-br from-zinc-950/95 via-zinc-950/80 to-emerald-900/40 mix-blend-multiply"></div>
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-950 via-transparent to-transparent"></div>
        <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/20 rounded-full blur-[120px] pointer-events-none"></div>

        {/* Top Branding */}
        <div className="relative z-20">
          <Link href="/" className="inline-flex items-center text-white hover:text-emerald-400 transition-colors group">
            <div className="h-10 w-10 bg-white rounded-full flex items-center justify-center mr-3 shadow-lg">
              <PlaneTakeoff className="h-5 w-5 text-zinc-950 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </div>
            <span className="text-2xl font-black tracking-tighter">WanderHub</span>
          </Link>
        </div>

        {/* Floating Glassmorphic Value Props */}
        <div className="relative z-20 mt-auto">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/20 backdrop-blur-md border border-emerald-500/30 text-emerald-400 text-[10px] font-bold uppercase tracking-widest mb-6 shadow-sm">
            <Sparkles className="h-3 w-3" /> Exclusive Partner Network
          </div>
          <h1 className="text-5xl xl:text-6xl font-black text-white tracking-tighter leading-[1.05] mb-6 drop-shadow-xl">
            Elevate your <br/><span className="text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500">property's reach.</span>
          </h1>
          <p className="text-zinc-300 font-medium text-lg max-w-md leading-relaxed mb-10 drop-shadow-md">
            List your rooms directly to thousands of verified travelers. Bypass aggregator commissions and take absolute control.
          </p>

          {/* Glass Bento Cards */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
            <div className="bg-white/10 backdrop-blur-xl p-5 rounded-3xl border border-white/20 shadow-xl flex items-start gap-4">
              <div className="h-10 w-10 bg-emerald-500/20 rounded-full flex items-center justify-center shrink-0 border border-emerald-500/30"><TrendingUp className="h-4 w-4 text-emerald-400"/></div>
              <div>
                <p className="font-bold text-white text-sm mb-1 tracking-tight">0% Commissions</p>
                <p className="text-[10px] font-medium text-zinc-400 leading-relaxed">Keep 100% of your booking revenue.</p>
              </div>
            </div>
            <div className="bg-white/10 backdrop-blur-xl p-5 rounded-3xl border border-white/20 shadow-xl flex items-start gap-4">
              <div className="h-10 w-10 bg-sky-500/20 rounded-full flex items-center justify-center shrink-0 border border-sky-500/30"><CreditCard className="h-4 w-4 text-sky-400"/></div>
              <div>
                <p className="font-bold text-white text-sm mb-1 tracking-tight">Direct Payments</p>
                <p className="text-[10px] font-medium text-zinc-400 leading-relaxed">Travelers pay straight to your UPI.</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT SIDE: THE FORM */}
      <div className="w-full lg:w-7/12 h-full overflow-y-auto custom-scrollbar relative bg-zinc-950/95 backdrop-blur-3xl z-20">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.05] mix-blend-overlay pointer-events-none z-0"></div>
        
        {/* Mobile Header (Only visible on small screens) */}
        <header className="lg:hidden w-full px-6 py-5 flex justify-between items-center border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50">
          <Link href="/" className="flex items-center text-white">
            <PlaneTakeoff className="h-6 w-6 mr-2 text-emerald-500" />
            <span className="text-xl font-black tracking-tighter">WanderHub</span>
          </Link>
          <span className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest">Partner</span>
        </header>

        <div className="max-w-2xl mx-auto p-6 md:p-12 lg:p-20 relative z-10">
          
          <div className="mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <h3 className="text-3xl md:text-4xl font-black text-white mb-2 tracking-tighter">
              {isLoginMode ? "Welcome Back" : "Partner Registration"}
            </h3>
            <p className="text-zinc-500 font-bold text-[10px] uppercase tracking-widest">
              {isLoginMode ? "Access your unified dashboard." : "Create your business profile to start listing."}
            </p>
          </div>

          {error && (
            <div className="mb-8 p-4 bg-rose-500/10 border border-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-widest rounded-2xl flex items-center animate-in fade-in slide-in-from-top-2 shadow-sm">
              <AlertCircle className="h-4 w-4 mr-3 shrink-0" /> 
              <span className="leading-relaxed">{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-6">
            
            {/* --- REGISTRATION ONLY FIELDS --- */}
            {!isLoginMode && (
              <div className="space-y-6 animate-in fade-in duration-500">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Hotel Name</label>
                    <div className="relative group">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                      <input type="text" value={hotelName} onChange={(e) => setHotelName(e.target.value)} required placeholder="The Grand Taj" className="w-full pl-11 pr-4 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-white transition-all placeholder-zinc-600 text-sm shadow-inner" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">City / Location</label>
                    <div className="relative group">
                      <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                      <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="Mumbai" className="w-full pl-11 pr-4 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-white transition-all placeholder-zinc-600 text-sm shadow-inner" />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Manager / Owner Name</label>
                  <div className="relative group">
                    <UserIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                    <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required placeholder="Rahul Sharma" className="w-full pl-11 pr-4 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-white transition-all placeholder-zinc-600 text-sm shadow-inner" />
                  </div>
                </div>
              </div>
            )}

            {/* --- ALWAYS VISIBLE FIELDS (Email/Password) --- */}
            <div className="space-y-6">
              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Business Email</label>
                <div className="relative group">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="manager@hotel.com" className="w-full pl-11 pr-4 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-white transition-all placeholder-zinc-600 text-sm shadow-inner" />
                </div>
              </div>

              <div>
                <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Password</label>
                <div className="relative group">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                  <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full pl-11 pr-4 py-4 bg-zinc-900 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-white transition-all placeholder-zinc-600 text-sm shadow-inner" />
                </div>
              </div>
            </div>

            {/* --- REGISTRATION MAP AND VERIFICATION FIELDS --- */}
            {!isLoginMode && (
              <>
                {/* GEOGRAPHIC LOCATION MAP (Bento Box) */}
                <div className="mt-10 bg-zinc-900/40 rounded-[2.5rem] p-6 md:p-8 border border-zinc-800/50 animate-in fade-in duration-500">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-8 gap-4 border-b border-zinc-800 pb-6">
                    <div className="flex items-center">
                      <div className="h-12 w-12 bg-zinc-950 border border-zinc-800 text-emerald-500 rounded-2xl flex items-center justify-center mr-4 shrink-0 shadow-inner">
                        <MapPin className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-widest">Property Location</h3>
                        <p className="text-[10px] font-bold text-zinc-500 mt-1 uppercase tracking-widest">Pin your exact location for travelers.</p>
                      </div>
                    </div>
                    <button 
                      type="button" 
                      onClick={handleDetectLocation}
                      className="text-[9px] font-bold uppercase tracking-widest bg-zinc-800 text-white hover:bg-zinc-700 px-5 py-3 rounded-full transition-colors flex items-center active:scale-95 w-max shadow-sm"
                    >
                      {isDetectingLocation ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <LocateFixed className="h-3 w-3 mr-2" />} Auto-Detect
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-5 mb-6">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Latitude</label>
                      <input type="number" step="any" value={latitude} onChange={(e) => setLatitude(e.target.value)} placeholder="19.0760" required className="w-full px-5 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-bold text-white transition-all placeholder-zinc-700 shadow-inner" />
                    </div>
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Longitude</label>
                      <input type="number" step="any" value={longitude} onChange={(e) => setLongitude(e.target.value)} placeholder="72.8777" required className="w-full px-5 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-bold text-white transition-all placeholder-zinc-700 shadow-inner" />
                    </div>
                  </div>

                  {isMounted && (
                  <div className="rounded-[2rem] overflow-hidden border border-zinc-800 shadow-inner h-64 relative z-0">
                    <PartnerMap 
                      latitude={latitude} 
                      longitude={longitude} 
                      setLatitude={setLatitude} 
                      setLongitude={setLongitude} 
                    />

                    {!latitude && (
                      <div className="absolute top-4 left-1/2 -translate-x-1/2 bg-zinc-900/90 backdrop-blur-md px-5 py-2.5 rounded-full shadow-xl border border-zinc-700 z-[1000] text-[9px] font-bold uppercase tracking-widest text-emerald-400 pointer-events-none whitespace-nowrap">
                        Click map to drop pin 📍
                      </div>
                    )}
                  </div>
                )}
                </div>

                {/* BUSINESS VERIFICATION (Bento Box) */}
                <div className="mt-8 bg-zinc-900/40 rounded-[2.5rem] p-6 md:p-8 border border-zinc-800/50 animate-in fade-in duration-500">
                  <div className="flex items-center mb-8 border-b border-zinc-800 pb-6">
                    <div className="h-12 w-12 bg-zinc-950 border border-zinc-800 text-emerald-500 rounded-2xl flex items-center justify-center mr-4 shrink-0 shadow-inner">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-sm font-black text-white uppercase tracking-widest">Business Verification</h3>
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Required for trust & safety compliance.</p>
                    </div>
                  </div>
                  
                  <div className="space-y-6">
                    <div>
                      <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Trade License Number</label>
                      <div className="relative group">
                        <FileText className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required placeholder="TL-2026-8921" className="w-full pl-11 pr-4 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-white transition-all placeholder-zinc-700 text-sm shadow-inner" />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">GSTIN Number</label>
                      <div className="relative group">
                        <Hash className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 group-focus-within:text-emerald-500 transition-colors" />
                        <input type="text" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} required placeholder="22AAAAA0000A1Z5" className="w-full pl-11 pr-4 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-white transition-all placeholder-zinc-700 uppercase text-sm shadow-inner" />
                      </div>
                    </div>
                  </div>
                </div>
              </>
            )}

            <div className="pt-6">
              <button type="submit" disabled={isLoading} className="w-full bg-emerald-500 text-zinc-950 font-black py-5 rounded-full shadow-[0_0_30px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all disabled:opacity-50 flex justify-center items-center text-xs uppercase tracking-widest active:scale-95 group">
                {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (isLoginMode ? "Access Dashboard" : "Submit Application")}
                {!isLoading && <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />}
              </button>
            </div>
          </form>

          <div className="mt-10 text-center pt-8 border-t border-zinc-800">
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">
              {isLoginMode ? "Don't have a partner account?" : "Already registered your property?"}{" "}
              <button type="button" onClick={() => { setIsLoginMode(!isLoginMode); setError(""); }} className="text-emerald-500 font-black hover:text-emerald-400 transition-colors ml-1">
                {isLoginMode ? "Register here" : "Log in here"}
              </button>
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}