"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { collection, addDoc, onSnapshot, query, orderBy, where, getDocs, getDoc, doc, updateDoc, arrayUnion, deleteDoc, setDoc } from "firebase/firestore";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  sendPasswordResetEmail
} from "firebase/auth";
import { auth, db } from "./lib/firebase";
import { Map, Calendar, CreditCard, Settings, Plus, PlaneTakeoff, Globe, Clock, User as UserIcon, Users, LogOut, BedDouble, Menu, X, ArrowRight, Archive, Mail, Lock, AlertCircle, Receipt, Sun, ShieldCheck, Sparkles, Globe2, Building2, Smartphone, Star, Zap, ChevronRight, BarChart, Loader2, Plane, CheckCircle2, MessageSquare, Info, History, AlertTriangle } from "lucide-react";

interface Trip {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  inviteCode: string;
  members: string[];
  adminId?: string;
  memberNames?: Record<string, string>;
  imageUrl?: string;
  status?: string; 
}

const TRAVEL_IMAGES = [
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?w=800&q=80",
  "https://images.unsplash.com/photo-1476514525535-07fb3b4ae5f1?w=800&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?w=800&q=80",
  "https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80",
  "https://images.unsplash.com/photo-1504150558240-0b4fd8946624?w=800&q=80",
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80",
  "https://images.unsplash.com/photo-1488085061387-422e29b40080?w=800&q=80",
  "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=800&q=80",
];

const getTripImage = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash += id.charCodeAt(i);
  return TRAVEL_IMAGES[hash % TRAVEL_IMAGES.length];
};

export default function Home() {
  const router = useRouter();

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);

  const [showLanding, setShowLanding] = useState(true);

  // AUTH STATE
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authName, setAuthName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");

  // ✨ PHASE 1: OTP STATE
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpInput, setOtpInput] = useState("");
  const [otpLoading, setOtpLoading] = useState(false);
  const [otpError, setOtpError] = useState("");

  // FORGOT PASSWORD STATE
  const [isForgotModalOpen, setIsForgotModalOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState("");

  const [trips, setTrips] = useState<Trip[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isJoinModalOpen, setIsJoinModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // ✨ EXTEND TRIP STATE
  const [isExtendModalOpen, setIsExtendModalOpen] = useState(false);
  const [selectedTripToExtend, setSelectedTripToExtend] = useState<Trip | null>(null);
  const [newEndDate, setNewEndDate] = useState("");
  const [isExtending, setIsExtending] = useState(false);

  const [title, setTitle] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [joinCode, setJoinCode] = useState("");

  // ✨ CUSTOM DIALOG STATE
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "warning" | "danger";
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showDialog = (title: string, message: string, type: "info" | "warning" | "danger" = "info", onConfirm?: () => void, confirmText = "OK", cancelText?: string) => {
    setDialog({ isOpen: true, title, message, type, confirmText, cancelText, onConfirm });
  };

  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  // 🛡️ SECURITY GUARD: Travelers Only
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        // Allow unauthenticated users to see the landing page
        setUser(null);
        setIsAuthLoading(false);
      } else {
        try {
          // Fetch user profile to check their role
          const userDoc = await getDoc(doc(db, "users", currentUser.uid));
          
          if (userDoc.exists() && userDoc.data().role === "hotel_partner") {
            // Bouncer: Kick Hotel Partners OUT of the customer site!
            router.push("/partner/dashboard");
            return;
          }

          // If they pass the check, let them into the traveler dashboard
          setUser(currentUser);
          setIsAuthLoading(false);
          
        } catch (error) {
          console.error("Auth check error:", error);
          setIsAuthLoading(false);
        }
      }
    });
    return () => unsubscribe();
  }, [router]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "trips"),
      where("members", "array-contains", user.uid),
      where("status", "==", "active"),
      orderBy("createdAt", "desc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const tripsData = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...(doc.data() as Omit<Trip, 'id'>),
      }));

      // ✨ AUTO-ARCHIVE LOGIC: Clean up trips that have ended
      const today = new Date();
      const localMonth = String(today.getMonth() + 1).padStart(2, '0');
      const localDay = String(today.getDate()).padStart(2, '0');
      const todayStr = `${today.getFullYear()}-${localMonth}-${localDay}`; // Safely gets local YYYY-MM-DD
      
      const activeTrips: Trip[] = [];

      tripsData.forEach((trip) => {
        // If the trip's end date is strictly before today, it's over.
        if (trip.endDate && trip.endDate < todayStr) {
          // Auto-archive it in Firebase so it moves to the History page permanently
          updateDoc(doc(db, "trips", trip.id), { status: "archived" }).catch(console.error);
        } else {
          activeTrips.push(trip);
        }
      });

      setTrips(activeTrips);
      setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [user]);

  const handleGoogleSignIn = async () => {
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  // ✨ PHASE 1 & 2: SECURE OTP EMAIL SENDING WITH RATE LIMITING
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError("");
    setAuthLoading(true);

    try {
      if (!isLoginMode && !authName.trim()) throw new Error("Please enter your full name.");
      if (authPassword.length < 6) throw new Error("Password must be at least 6 characters.");

      const cleanEmail = authEmail.toLowerCase().trim();

      // 🛡️ PHASE 2: RATE LIMIT CHECK
      const attemptRef = doc(db, "login_attempts", cleanEmail);
      const attemptSnap = await getDoc(attemptRef);
      if (attemptSnap.exists()) {
        const attemptData = attemptSnap.data();
        if (attemptData.lockedUntil && attemptData.lockedUntil.toDate() > new Date()) {
          const minutesLeft = Math.ceil((attemptData.lockedUntil.toDate().getTime() - Date.now()) / 60000);
          throw new Error(`Too many failed attempts. Try again in ${minutesLeft} minutes.`);
        }
      }

      // 1. Generate a 6-digit secure code
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString();
      
      // 2. Save it to Firestore temporarily (Expires in 10 minutes)
      await setDoc(doc(db, "temp_otps", cleanEmail), {
        code: generatedOtp,
        expiresAt: new Date(Date.now() + 10 * 60000), 
        type: isLoginMode ? "login" : "register"
      });

      // 3. Trigger the Email API
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanEmail, otp: generatedOtp })
      });

      // 4. Strict check: If email fails to send, throw error and stop process
      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to send verification email. Please check your configuration.");
      }

      // If email sent successfully, show modal
      setShowOtpModal(true);

    } catch (err: any) {
      setAuthError(err.message);
    } finally {
      setAuthLoading(false);
    }
  };

  // ✨ VERIFY OTP & FINALIZE LOGIN WITH BRUTE-FORCE PROTECTION
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setOtpError("");
    setOtpLoading(true);
    const cleanEmail = authEmail.toLowerCase().trim();

    try {
      const otpDocRef = doc(db, "temp_otps", cleanEmail);
      const otpDoc = await getDoc(otpDocRef);

      if (!otpDoc.exists()) throw new Error("Verification code expired or invalid.");
      
      const data = otpDoc.data();
      
      // Validation Checks
      if (data.code !== otpInput) throw new Error("Incorrect verification code.");
      if (data.expiresAt.toDate() < new Date()) throw new Error("Code has expired. Please request a new one.");

      // Success! Delete the OTP document so it can't be reused
      await deleteDoc(otpDocRef);

      // Finalize Firebase Auth
      if (isLoginMode) {
        await signInWithEmailAndPassword(auth, cleanEmail, authPassword);
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, authPassword);
        await setDoc(doc(db, "users", userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          role: "traveler",
          createdAt: new Date(),
        });
        await updateProfile(userCredential.user, { displayName: authName.trim() });
        setUser({ ...userCredential.user, displayName: authName.trim() } as FirebaseUser);
      }
      
      // 🛡️ RESET RATE LIMIT COUNTER ON SUCCESS
      await deleteDoc(doc(db, "login_attempts", cleanEmail)).catch(() => {});

      setShowOtpModal(false);
      setOtpInput("");
    } catch (err: any) {
      // 🛡️ RECORD FAILED ATTEMPT
      const attemptRef = doc(db, "login_attempts", cleanEmail);
      const attemptSnap = await getDoc(attemptRef);
      let currentAttempts = 1;

      if (attemptSnap.exists()) {
        currentAttempts = (attemptSnap.data().failedAttempts || 0) + 1;
      }

      if (currentAttempts >= 5) {
        await setDoc(attemptRef, {
          failedAttempts: currentAttempts,
          lockedUntil: new Date(Date.now() + 15 * 60000) // Lock for 15 mins
        }, { merge: true });
        setOtpError("Too many failed attempts. Account locked for 15 minutes.");
        setTimeout(() => setShowOtpModal(false), 2000);
      } else {
        await setDoc(attemptRef, { failedAttempts: currentAttempts }, { merge: true });
        if (err.code === 'auth/invalid-credential') setOtpError("Firebase Error: Incorrect email or password.");
        else if (err.code === 'auth/email-already-in-use') setOtpError("Firebase Error: Account already exists.");
        else setOtpError(err.message);
      }
    } finally {
      setOtpLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return;
    setIsResetting(true);
    setResetMessage("");
    setAuthError(""); 

    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetMessage("A secure reset link has been sent to your email. Check your inbox.");
      setTimeout(() => {
        setIsForgotModalOpen(false);
        setResetMessage("");
        setResetEmail("");
      }, 6000);
    } catch (error: any) {
      console.error("Password reset error:", error);
      if (error.code === 'auth/user-not-found') {
          setResetMessage("Error: No account found with this email.");
      } else if (error.code === 'auth/invalid-email') {
          setResetMessage("Error: Please enter a valid email address.");
      } else {
          setResetMessage("Error: Could not send reset email. Try again later.");
      }
    } finally {
      setIsResetting(false);
    }
  };

  const generateInviteCode = () => Math.random().toString(36).substring(2, 8).toUpperCase();

  const handleCreateTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !startDate || !endDate || !user) return;
    setIsSubmitting(true);

    const userName = user.displayName?.split(" ")[0] || "Traveler";

    let fetchedImageUrl = "";
    try {
      const unsplashRes = await fetch(`https://api.unsplash.com/search/photos?query=${encodeURIComponent(title)}&orientation=landscape&client_id=S3o5ZZwBMWNSOTH5s-hc8BiYzYmitblOVgZvYJ28Syc&per_page=1`);
      const unsplashData = await unsplashRes.json();

      if (unsplashData.results && unsplashData.results.length > 0) {
        fetchedImageUrl = unsplashData.results[0].urls.regular;
      }
    } catch (err) {
      console.error("Failed to fetch image from Unsplash", err);
    }

    try {
      await addDoc(collection(db, "trips"), {
        title,
        startDate,
        endDate,
        inviteCode: generateInviteCode(),
        members: [user.uid],
        adminId: user.uid,
        memberNames: { [user.uid]: userName },
        imageUrl: fetchedImageUrl, 
        status: "active",
        createdAt: new Date(),
      });
      setTitle(""); setStartDate(""); setEndDate(""); setIsModalOpen(false);
    } catch (error) { console.error("Error adding trip: ", error); }
    finally { setIsSubmitting(false); }
  };

  const handleJoinTrip = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!joinCode || !user) return;
    setIsSubmitting(true);

    try {
      const q = query(collection(db, "trips"), where("inviteCode", "==", joinCode.toUpperCase()));
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        showDialog("Invalid Code", "Invalid invite code! Please check and try again.", "warning");
      } else {
        const tripDoc = querySnapshot.docs[0];
        await updateDoc(doc(db, "trips", tripDoc.id), {
          members: arrayUnion(user.uid)
        });
        setIsJoinModalOpen(false);
        setJoinCode("");
        showDialog("Success", "Successfully joined the trip!", "info");
      }
    } catch (error) {
      console.error("Error joining trip:", error);
      showDialog("Error", "Failed to join trip.", "danger");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchiveTrip = async (e: React.MouseEvent, tripId: string, tripTitle: string) => {
    e.stopPropagation();

    showDialog(
      "Archive Trip?",
      `Are you sure you want to archive "${tripTitle}"? It will be moved to your History.`,
      "warning",
      async () => {
        closeDialog();
        try {
          await updateDoc(doc(db, "trips", tripId), {
            status: "archived"
          });
        } catch (error) {
          console.error("Error archiving trip:", error);
          showDialog("Error", "Failed to archive trip.", "danger");
        }
      },
      "Archive",
      "Cancel"
    );
  };

  const handleExtendTripSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTripToExtend || !newEndDate) return;
    setIsExtending(true);
    try {
      await updateDoc(doc(db, "trips", selectedTripToExtend.id), {
        endDate: newEndDate
      });
      setIsExtendModalOpen(false);
      setSelectedTripToExtend(null);
      setNewEndDate("");
      showDialog("Success", "Trip extended successfully!", "info");
    } catch (error) {
      console.error("Error extending trip:", error);
      showDialog("Error", "Failed to extend trip.", "danger");
    } finally {
      setIsExtending(false);
    }
  };

  if (isAuthLoading) return <div className="h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950"><div className="animate-spin h-10 w-10 border-4 border-emerald-600 border-t-transparent rounded-full"></div></div>;

  // ==========================================
  // UN-AUTHENTICATED FLOW (LANDING PAGE OR LOGIN)
  // ==========================================
  if (!user) {

    // 1. SHOW PREMIUM ANIMATED LANDING PAGE
    if (showLanding) {
      return (
        <div className="min-h-screen bg-zinc-950 font-sans text-white selection:bg-emerald-500/30 overflow-x-hidden">
          
          <style dangerouslySetInnerHTML={{
            __html: `
            @keyframes fadeUp {
              from { opacity: 0; transform: translateY(30px); }
              to { opacity: 1; transform: translateY(0); }
            }
            @keyframes float1 {
              0%, 100% { transform: translateY(0px) rotate(-2deg); }
              50% { transform: translateY(-20px) rotate(1deg); }
            }
            @keyframes float2 {
              0%, 100% { transform: translateY(0px) rotate(3deg); }
              50% { transform: translateY(15px) rotate(-1deg); }
            }
            @keyframes float3 {
              0%, 100% { transform: translateY(0px) rotate(-1deg); }
              50% { transform: translateY(-10px) rotate(2deg); }
            }
            @keyframes panGrid {
              0% { background-position: 0px 0px; }
              100% { background-position: 64px 64px; }
            }
            @keyframes marquee {
              0% { transform: translateX(0%); }
              100% { transform: translateX(-50%); }
            }
            .animate-fade-up { animation: fadeUp 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
            .animate-grid { animation: panGrid 4s linear infinite; }
            .delay-100 { animation-delay: 100ms; }
            .delay-200 { animation-delay: 200ms; }
            .delay-300 { animation-delay: 300ms; }
          `}} />

          {/* Animated Minimalist Grid Background */}
          <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-emerald-900/15 rounded-full blur-[150px]"></div>
            <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] bg-teal-900/10 rounded-full blur-[120px]"></div>
            <div className="absolute inset-0 animate-grid" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '64px 64px' }}></div>
          </div>

          {/* Floating Pill Nav */}
          <nav className="fixed top-6 left-0 right-0 z-50 flex justify-center px-4">
            <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-full px-6 py-3 flex items-center justify-between w-full max-w-5xl shadow-2xl">
              <div className="flex items-center gap-3">
                <div className="bg-white p-1.5 rounded-full"><PlaneTakeoff className="h-5 w-5 text-zinc-900" /></div>
                <span className="text-xl font-bold tracking-tight text-white">WanderHub</span>
              </div>
              <div className="flex items-center gap-6">
                <Link href="/partner/join" className="hidden md:block text-sm font-medium text-zinc-400 hover:text-white transition-colors">
                  Business Portal
                </Link>
                <button onClick={() => setShowLanding(false)} className="bg-emerald-500 text-zinc-950 px-6 py-2 rounded-full text-sm font-bold hover:bg-emerald-400 hover:scale-105 transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                  Log In
                </button>
              </div>
            </div>
          </nav>

          {/* ANIMATED EDITORIAL HERO */}
          <header className="relative pt-40 pb-16 md:pt-52 md:pb-24 px-6 z-10 overflow-hidden">
            <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-12 items-center">
              
              {/* Left Text */}
              <div className="text-left z-20">
                <div className="animate-fade-up inline-flex items-center gap-2 px-4 py-2 rounded-full bg-zinc-900/50 border border-zinc-800 text-zinc-300 text-xs font-bold mb-8 uppercase tracking-widest backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-400" /> Discover the new standard
                </div>

                <h1 className="animate-fade-up delay-100 text-5xl md:text-7xl lg:text-[6.5rem] font-black tracking-tighter text-white mb-8 leading-[1.05]">
                  Plan deeply. <br />
                  <span className="text-zinc-500">Travel lightly.</span>
                </h1>

                <p className="animate-fade-up delay-200 text-lg md:text-xl text-zinc-400 font-medium max-w-lg mb-12 leading-relaxed">
                  A unified workspace for the modern traveler. Build dynamic itineraries, settle live expenses, and sync instantly with your entire group.
                </p>

                <div className="animate-fade-up delay-300 flex flex-col sm:flex-row items-center gap-4 w-full sm:w-auto">
                  <button onClick={() => setShowLanding(false)} className="w-full sm:w-auto bg-white text-zinc-950 px-10 py-4 rounded-full text-lg font-bold hover:scale-105 shadow-[0_0_30px_rgba(255,255,255,0.2)] transition-all flex items-center justify-center group">
                    Start Planning <ArrowRight className="h-5 w-5 ml-2 group-hover:translate-x-1 transition-transform" />
                  </button>
                  <Link href="/partner/join" className="w-full sm:w-auto bg-transparent border border-zinc-700 text-white px-10 py-4 rounded-full text-lg font-medium hover:bg-zinc-900 transition-all flex items-center justify-center">
                    <Building2 className="mr-2 h-5 w-5 text-zinc-400" /> List Property
                  </Link>
                </div>
              </div>

              {/* Right Side: Animated Floating Gallery */}
              <div className="hidden lg:block relative h-[600px] w-full z-10 perspective-[1200px]">
                {/* Glowing Orb Behind Cards */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/30 rounded-full blur-[80px]"></div>
                
                {/* Card 1: Main Destination */}
                <div className="absolute top-[10%] right-[10%] w-[280px] h-[360px] rounded-3xl overflow-hidden border border-zinc-700/50 shadow-2xl animate-[float1_6s_ease-in-out_infinite] z-30 group">
                  <img src="https://images.unsplash.com/photo-1499856871958-5b9627545d1a?w=800&q=80" alt="Paris" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/90 via-transparent to-transparent"></div>
                  <div className="absolute bottom-5 left-5 right-5 flex justify-between items-end">
                    <div>
                      <p className="text-white font-bold text-lg leading-tight">Paris, France</p>
                      <p className="text-emerald-400 text-xs font-bold uppercase tracking-wider">Group Trip</p>
                    </div>
                    <div className="h-8 w-8 bg-white/20 backdrop-blur-md rounded-full border border-white/30 flex items-center justify-center text-white"><ArrowRight className="h-4 w-4 -rotate-45" /></div>
                  </div>
                </div>

                {/* Card 2: Nature/Secondary */}
                <div className="absolute top-[35%] left-[5%] w-[240px] h-[300px] rounded-3xl overflow-hidden border border-zinc-700/50 shadow-2xl animate-[float2_8s_ease-in-out_infinite_reverse] z-20 group">
                  <img src="https://images.unsplash.com/photo-1533929736458-ca588d08c8be?w=800&q=80" alt="Nature" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 filter saturate-50 group-hover:saturate-100" />
                </div>

                {/* Card 3: Small Element */}
                <div className="absolute bottom-[5%] right-[25%] w-[200px] h-[200px] rounded-3xl overflow-hidden border border-zinc-700/50 shadow-2xl animate-[float3_7s_ease-in-out_infinite_1s] z-40 group">
                  <img src="https://images.unsplash.com/photo-1512453979798-5ea266f8880c?w=800&q=80" alt="Desert" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                  <div className="absolute top-4 left-4 bg-zinc-950/80 backdrop-blur-md px-3 py-1 rounded-full border border-zinc-700 flex items-center text-xs font-bold text-white shadow-lg"><Clock className="h-3 w-3 mr-1.5 text-zinc-400"/> Syncing</div>
                </div>
              </div>
            </div>
          </header>

          {/* INFINITE MARQUEE STRIP */}
          <div className="w-full overflow-hidden border-y border-zinc-800/50 bg-zinc-900/20 py-4 mb-24 relative z-20">
            <div className="flex w-[200%] animate-[marquee_20s_linear_infinite]">
              <div className="flex w-1/2 justify-around items-center text-zinc-500 font-bold tracking-[0.2em] uppercase text-xs">
                <span>✦ AI-Engineered Routing</span>
                <span>✦ Live Expense Splitting</span>
                <span>✦ Hybrid Aggregator</span>
                <span>✦ Smart Climate Intel</span>
                <span>✦ Real-time Group Sync</span>
              </div>
              <div className="flex w-1/2 justify-around items-center text-zinc-500 font-bold tracking-[0.2em] uppercase text-xs">
                <span>✦ AI-Engineered Routing</span>
                <span>✦ Live Expense Splitting</span>
                <span>✦ Hybrid Aggregator</span>
                <span>✦ Smart Climate Intel</span>
                <span>✦ Real-time Group Sync</span>
              </div>
            </div>
          </div>

          {/* EDITORIAL BENTO GRID */}
          <section className="py-12 relative z-10">
            <div className="max-w-6xl mx-auto px-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Large Map Card */}
                <div className="md:col-span-2 bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 p-10 md:p-14 rounded-[2rem] flex flex-col justify-between overflow-hidden relative group hover:border-zinc-700 transition-colors duration-500">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 group-hover:bg-emerald-500/15 rounded-full blur-3xl transition-all duration-700"></div>
                  <div className="relative z-10">
                    <div className="h-14 w-14 bg-zinc-800 rounded-full flex items-center justify-center mb-8 border border-zinc-700 text-emerald-400 group-hover:scale-110 group-hover:bg-emerald-500/10 transition-all duration-300">
                      <Map className="h-6 w-6" />
                    </div>
                    <h3 className="text-3xl font-bold text-white mb-4 tracking-tight">AI-Engineered Routing</h3>
                    <p className="text-zinc-400 text-lg font-medium leading-relaxed max-w-md">Input your destinations. Our system generates a geographically optimized, day-by-day travel map instantly.</p>
                  </div>
                </div>

                {/* Small Expense Card */}
                <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 p-10 rounded-[2rem] flex flex-col justify-between relative overflow-hidden group hover:border-zinc-700 transition-colors duration-500">
                  <div className="absolute bottom-0 right-0 w-40 h-40 bg-rose-500/5 group-hover:bg-rose-500/15 rounded-full blur-3xl transition-all duration-700"></div>
                  <div className="relative z-10">
                    <div className="h-14 w-14 bg-zinc-800 rounded-full flex items-center justify-center mb-8 border border-zinc-700 text-rose-400 group-hover:scale-110 group-hover:bg-rose-500/10 transition-all duration-300">
                      <Receipt className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Live Split</h3>
                    <p className="text-zinc-400 font-medium leading-relaxed">Log expenses on the go. We track who owes who, down to the last cent.</p>
                  </div>
                </div>

                {/* Small Weather Card */}
                <div className="bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 p-10 rounded-[2rem] flex flex-col justify-between relative overflow-hidden group hover:border-zinc-700 transition-colors duration-500">
                  <div className="absolute top-0 left-0 w-40 h-40 bg-amber-500/5 group-hover:bg-amber-500/15 rounded-full blur-3xl transition-all duration-700"></div>
                  <div className="relative z-10">
                    <div className="h-14 w-14 bg-zinc-800 rounded-full flex items-center justify-center mb-8 border border-zinc-700 text-amber-400 group-hover:scale-110 group-hover:bg-amber-500/10 transition-all duration-300">
                      <Sun className="h-6 w-6" />
                    </div>
                    <h3 className="text-2xl font-bold text-white mb-4 tracking-tight">Smart Climate</h3>
                    <p className="text-zinc-400 font-medium leading-relaxed">Integrated API forecasting ensures you never pack a swimsuit for a storm.</p>
                  </div>
                </div>

                {/* Large Hotel Card */}
                <div className="md:col-span-2 bg-zinc-900/40 backdrop-blur-sm border border-zinc-800/50 p-10 md:p-14 rounded-[2rem] flex flex-col justify-between relative overflow-hidden group hover:border-zinc-700 transition-colors duration-500">
                  <div className="absolute bottom-0 right-0 w-64 h-64 bg-teal-500/5 group-hover:bg-teal-500/15 rounded-full blur-3xl transition-all duration-700"></div>
                  <div className="relative z-10">
                    <div className="h-14 w-14 bg-zinc-800 rounded-full flex items-center justify-center mb-8 border border-zinc-700 text-teal-400 group-hover:scale-110 group-hover:bg-teal-500/10 transition-all duration-300">
                      <BedDouble className="h-6 w-6" />
                    </div>
                    <div className="flex items-center gap-3 mb-4">
                      <h3 className="text-3xl font-bold text-white tracking-tight">Hybrid Aggregator</h3>
                      <span className="bg-teal-500/10 text-teal-400 px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase border border-teal-500/20">Exclusive</span>
                    </div>
                    <p className="text-zinc-400 text-lg font-medium leading-relaxed max-w-md">Compare standard Booking.com listings directly alongside verified, exclusive WanderHub Hotel Partners.</p>
                  </div>
                </div>

              </div>
            </div>
          </section>

          {/* BOTTOM CTA */}
          <section className="py-32 relative z-10 border-t border-zinc-800/50 mt-12">
            <div className="max-w-4xl mx-auto px-6 text-center">
              <Globe2 className="h-16 w-16 mx-auto mb-8 text-zinc-600" />
              <h2 className="text-5xl md:text-6xl font-black mb-10 tracking-tighter text-white">Your adventure begins.</h2>
              <button onClick={() => setShowLanding(false)} className="inline-flex bg-emerald-500 text-zinc-950 px-10 py-5 rounded-full text-lg font-bold hover:bg-emerald-400 hover:scale-105 transition-all shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                Create Free Account
              </button>
            </div>
          </section>
        </div>
      );
    }

    // 2. SPLIT-SCREEN EDITORIAL LOGIN FORM
    return (
      <div className="flex min-h-screen bg-zinc-950 font-sans selection:bg-emerald-500/30">
        
        {/* Left Side: Cinematic Image (Hidden on mobile) */}
        <div className="hidden lg:flex lg:w-1/2 relative bg-zinc-900 items-center justify-center overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img 
            src="https://images.unsplash.com/photo-1506012787146-f92b2d7d6d96?w=1200&q=80" 
            alt="Travel Landscape" 
            className="absolute inset-0 w-full h-full object-cover opacity-60"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-zinc-950/20 to-zinc-950"></div>
          
          <div className="relative z-10 p-16 max-w-xl text-left mr-auto">
            <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl inline-block mb-8 border border-white/10">
              <PlaneTakeoff className="h-8 w-8 text-white" />
            </div>
            <h2 className="text-5xl font-black text-white tracking-tighter leading-tight mb-6">
              The world is waiting. <br/><span className="text-emerald-400">Plan it right.</span>
            </h2>
            <p className="text-zinc-300 text-lg font-medium leading-relaxed">
              Join thousands of modern explorers who have upgraded their travel workflow with WanderHub.
            </p>
          </div>
        </div>

        {/* Right Side: Clean Form */}
        <div className="w-full lg:w-1/2 flex items-center justify-center p-6 md:p-12 relative bg-zinc-950">
          
          <button onClick={() => setShowLanding(true)} className="absolute top-8 right-8 text-zinc-500 hover:text-white font-medium flex items-center px-4 py-2 rounded-full hover:bg-zinc-900 transition-all text-sm border border-transparent hover:border-zinc-800">
            <X className="h-4 w-4 mr-2" /> Cancel
          </button>

          <div className="w-full max-w-md">
            <h2 className="text-3xl font-black text-white mb-2 tracking-tight">
              {isLoginMode ? "Welcome back." : "Create account."}
            </h2>
            <p className="text-zinc-400 font-medium mb-10 text-sm">
              {isLoginMode ? "Enter your details to sign in to your workspace." : "Start organizing your next adventure today."}
            </p>

            {authError && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-sm font-medium rounded-xl flex items-center">
                <AlertCircle className="h-5 w-5 mr-3 shrink-0" /> {authError}
              </div>
            )}

            <form onSubmit={handleEmailAuth} className="space-y-5">
              {!isLoginMode && (
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Full Name</label>
                  <input
                    type="text"
                    value={authName}
                    onChange={(e) => setAuthName(e.target.value)}
                    required={!isLoginMode}
                    placeholder="Jane Doe"
                    className="w-full px-4 py-3.5 bg-zinc-900 text-white border border-zinc-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium transition-all placeholder-zinc-600"
                  />
                </div>
              )}

              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Email Address</label>
                <input
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  placeholder="name@example.com"
                  className="w-full px-4 py-3.5 bg-zinc-900 text-white border border-zinc-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium transition-all placeholder-zinc-600"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Password</label>
                  {isLoginMode && (
                    <button type="button" onClick={() => setIsForgotModalOpen(true)} className="text-xs font-medium text-emerald-400 hover:text-emerald-300 transition-colors">Forgot password?</button>
                  )}
                </div>
                <input
                  type="password"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  className="w-full px-4 py-3.5 bg-zinc-900 text-white border border-zinc-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium transition-all placeholder-zinc-600"
                />
              </div>

              <button type="submit" disabled={authLoading} className="w-full bg-emerald-500 text-zinc-950 font-bold py-4 rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 mt-6 active:scale-[0.98]">
                {authLoading ? <Loader2 className="h-5 w-5 animate-spin mx-auto" /> : (isLoginMode ? "Sign In Securely" : "Create Secure Account")}
              </button>
            </form>

            <div className="flex items-center my-8">
              <hr className="flex-1 border-zinc-800" />
              <span className="px-4 text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Or</span>
              <hr className="flex-1 border-zinc-800" />
            </div>

            <button onClick={handleGoogleSignIn} type="button" className="w-full flex items-center justify-center bg-transparent border border-zinc-800 text-white font-medium py-4 rounded-xl hover:bg-zinc-900 transition-all active:scale-[0.98]">
              <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" /><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" /><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" /><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" /></svg>
              Continue with Google
            </button>

            <p className="mt-8 text-sm font-medium text-zinc-500 text-center">
              {isLoginMode ? "Don't have an account? " : "Already have an account? "}
              <button onClick={() => { setIsLoginMode(!isLoginMode); setAuthError(""); }} className="text-white font-bold hover:underline">
                {isLoginMode ? "Sign up" : "Log in"}
              </button>
            </p>
          </div>
        </div>

        {/* FORGOT PASSWORD MODAL */}
        {isForgotModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
            <div className="bg-zinc-950 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-zinc-800 relative animate-in zoom-in-95 duration-200">
              <button onClick={() => { setIsForgotModalOpen(false); setResetMessage(""); }} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
              
              <div className="h-14 w-14 bg-zinc-900 rounded-full flex items-center justify-center text-zinc-300 mb-6 border border-zinc-800 mx-auto">
                <Lock className="h-6 w-6" />
              </div>
              
              <h3 className="text-xl font-bold text-white text-center tracking-tight mb-2">Reset Password</h3>
              <p className="text-sm font-medium text-zinc-400 text-center mb-8">
                Enter your email address and we'll send you a link to reset your password.
              </p>

              {resetMessage && (
                <div className={`mb-6 p-4 text-sm font-medium rounded-xl flex items-start text-left border ${resetMessage.startsWith("Error:") ? "bg-red-500/10 text-red-400 border-red-500/30" : "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"}`}>
                  {resetMessage.startsWith("Error:") ? <AlertCircle className="h-5 w-5 mr-2 shrink-0 mt-0.5" /> : <CheckCircle2 className="h-5 w-5 mr-2 shrink-0 mt-0.5" />}
                  {resetMessage.replace("Error: ", "")}
                </div>
              )}

              <form onSubmit={handlePasswordReset}>
                <div className="relative mb-6">
                  <input 
                    type="email" 
                    value={resetEmail} 
                    onChange={(e) => setResetEmail(e.target.value)} 
                    placeholder="name@example.com" 
                    required
                    className="w-full px-4 py-3.5 bg-zinc-900 text-white border border-zinc-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-medium transition-all placeholder-zinc-600"
                  />
                </div>
                <button type="submit" disabled={isResetting || !resetEmail} className="w-full bg-white text-zinc-950 font-bold py-3.5 rounded-xl hover:bg-zinc-200 transition-all disabled:opacity-50 flex justify-center items-center active:scale-[0.98]">
                  {isResetting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Send Reset Link"}
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ✨ THE NEW OTP VERIFICATION MODAL */}
        {showOtpModal && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-[100] animate-in fade-in duration-200">
            <div className="bg-zinc-950 rounded-[2rem] p-8 max-w-sm w-full shadow-2xl border border-zinc-800 relative animate-in zoom-in-95 duration-200">
              <button onClick={() => { setShowOtpModal(false); setOtpInput(""); }} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors">
                <X className="h-5 w-5" />
              </button>
              
              <div className="h-14 w-14 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 mb-6 border border-emerald-500/20 mx-auto shadow-[0_0_15px_rgba(16,185,129,0.2)]">
                <ShieldCheck className="h-6 w-6" />
              </div>
              
              <h3 className="text-xl font-bold text-white text-center tracking-tight mb-2">Verify Identity</h3>
              <p className="text-sm font-medium text-zinc-400 text-center mb-6">
                We sent a 6-digit code to <br/><span className="text-white font-bold">{authEmail}</span>.
              </p>

              {otpError && (
                <div className="mb-6 p-4 text-xs font-bold uppercase tracking-widest text-red-400 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start text-left">
                  <AlertCircle className="h-4 w-4 mr-2 shrink-0" /> {otpError}
                </div>
              )}

              <form onSubmit={handleVerifyOtp}>
                <div className="relative mb-6">
                  <input 
                    type="text" 
                    maxLength={6}
                    value={otpInput} 
                    onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))} 
                    placeholder="Enter 6-digit code" 
                    required
                    className="w-full px-4 py-4 bg-zinc-900 text-white border border-zinc-800 rounded-xl focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 outline-none font-black tracking-[0.3em] text-center text-xl transition-all placeholder-zinc-700"
                  />
                </div>
                <button type="submit" disabled={otpLoading || otpInput.length !== 6} className="w-full bg-emerald-500 text-zinc-950 font-bold py-4 rounded-xl hover:bg-emerald-400 transition-all disabled:opacity-50 flex justify-center items-center active:scale-[0.98] uppercase tracking-widest text-[10px]">
                  {otpLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify & Continue"}
                </button>
              </form>
            </div>
          </div>
        )}

      </div>
    );
  }

  // ✨ DYNAMIC AVATAR GENERATION
  let rawName = user.displayName || "";
  let avatarName = (rawName.trim() === "" || rawName.trim().toLowerCase() === "traveler") 
    ? (user.email?.charAt(0).toUpperCase() || "U") 
    : rawName;
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=10b981&color=fff&length=1`;

  // ==========================================
  // AUTHENTICATED FLOW (DASHBOARD)
  // ==========================================
  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors duration-300 selection:bg-emerald-500/20">

      {/* MOBILE MENU BLUR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* FLOATING SIDEBAR (EDITORIAL STYLE) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-20 flex items-center px-8 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-3 shadow-sm">
            <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
          </div>
          <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto md:hidden p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>
        
        <nav className="flex-1 px-4 py-8 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><Map className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Calendar className="h-5 w-5 mr-3 opacity-70" /> Itineraries</Link>
          <Link href="/chat" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
            <MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat</Link>
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

      <div className="flex-1 flex flex-col h-screen overflow-hidden">

        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-2 shadow-sm">
              <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          </div>
          <div className="flex items-center gap-2">
            {/* ✨ UPDATED MOBILE DP */}
            <img 
              src={user.photoURL || fallbackAvatar} 
              alt="Profile" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                e.currentTarget.onerror = null; 
                e.currentTarget.src = fallbackAvatar;
              }}
              className="h-8 w-8 rounded-full border border-zinc-200 dark:border-zinc-800 object-cover shadow-sm" 
            />
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-600 dark:text-zinc-400 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
          </div>
        </div>

        {/* DESKTOP HEADER (MINIMALIST) */}
        <header className="hidden md:flex h-24 items-center justify-end px-12 z-20 shrink-0 sticky top-0 transition-all">
          <div className="flex items-center gap-5">
            <button onClick={() => setIsJoinModalOpen(true)} className="flex items-center text-zinc-500 dark:text-zinc-400 px-4 py-2 rounded-full font-bold hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-all text-sm active:scale-95">
              <Users className="h-4 w-4 mr-2" /> Join Trip
            </button>
            <button onClick={() => setIsModalOpen(true)} className="flex items-center bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-2.5 rounded-full font-bold hover:opacity-90 transition-all shadow-sm text-sm active:scale-95">
              <Plus className="h-4 w-4 mr-2" /> New Trip
            </button>

            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800 mx-2"></div>

            <div className="flex items-center gap-4">
              {/* ✨ UPDATED DESKTOP DP */}
              <img 
                src={user.photoURL || fallbackAvatar} 
                alt="Profile" 
                referrerPolicy="no-referrer"
                onError={(e) => {
                  e.currentTarget.onerror = null; 
                  e.currentTarget.src = fallbackAvatar;
                }}
                className="h-10 w-10 rounded-full border border-zinc-200 dark:border-zinc-800 object-cover shadow-inner" 
              />
              <button onClick={() => signOut(auth)} className="text-zinc-400 hover:text-red-500 transition-colors p-2 rounded-full hover:bg-red-50 dark:hover:bg-red-500/10" title="Log Out">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar relative z-10">
          <div className="max-w-[1200px] mx-auto pb-24">

            {/* EDITORIAL WELCOME AREA */}
            <div className="mb-16 mt-4 md:mt-0 animate-in fade-in slide-in-from-bottom-4 duration-700">
              <p className="text-zinc-500 dark:text-zinc-400 font-bold tracking-widest uppercase text-[11px] mb-3">Overview</p>
              <h1 className="text-4xl md:text-6xl font-black text-zinc-900 dark:text-white tracking-tighter leading-tight">
                Welcome back,<br/>{user.displayName?.split(" ")[0] || "Traveler"}.
              </h1>
            </div>

            {/* QUICK STATS (CLEAN BOXES) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6 mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700 delay-100">
              <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 shadow-sm flex flex-col justify-between h-36">
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-900 dark:text-white"><Globe className="h-5 w-5" /></div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Your Trips</p>
                  <p className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">{trips.length}</p>
                </div>
              </div>

              <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 shadow-sm flex flex-col justify-between h-36 cursor-pointer hover:border-zinc-300 dark:hover:border-zinc-700 transition-all group" onClick={() => setIsJoinModalOpen(true)}>
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 bg-zinc-50 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-900 dark:text-white group-hover:scale-110 transition-transform"><Users className="h-5 w-5" /></div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Invite Code</p>
                  <p className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">Join a trip</p>
                </div>
              </div>

              <div className="bg-zinc-900 dark:bg-white p-6 rounded-3xl shadow-lg flex flex-col justify-between h-36 cursor-pointer hover:opacity-90 transition-all group" onClick={() => setIsModalOpen(true)}>
                <div className="flex justify-between items-start">
                  <div className="h-10 w-10 bg-white/10 dark:bg-zinc-900/10 rounded-full flex items-center justify-center text-white dark:text-zinc-900 group-hover:scale-110 transition-transform"><Plus className="h-5 w-5" /></div>
                </div>
                <div>
                  <p className="text-[10px] font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest mb-1">Draft Itinerary</p>
                  <p className="text-xl font-bold text-white dark:text-zinc-900 tracking-tight">Plan new trip</p>
                </div>
              </div>
            </div>

            {/* TRIPS SECTION HEADER */}
            <div className="flex justify-between items-end mb-8">
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Your Destinations</h2>
            </div>

            {/* TRIPS GRID (FLOATING PILL DESIGN) */}
            {isLoading ? (
              <div className="flex justify-center py-20"><div className="animate-spin h-8 w-8 border-4 border-zinc-900 dark:border-white border-t-transparent rounded-full"></div></div>
            ) : trips.length === 0 ? (
              <div className="text-center py-32 bg-transparent rounded-3xl border border-dashed border-zinc-300 dark:border-zinc-800 animate-in zoom-in-95 duration-500">
                <div className="h-16 w-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                  <Map className="h-6 w-6 text-zinc-400 dark:text-zinc-500" />
                </div>
                <h3 className="text-xl font-bold text-zinc-900 dark:text-white tracking-tight">No trips found</h3>
                <p className="text-zinc-500 dark:text-zinc-400 font-medium mt-2 mb-8 text-sm">Create or join a trip to get started.</p>
                <button onClick={() => setIsModalOpen(true)} className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-8 py-3 rounded-full font-bold shadow-md hover:opacity-90 transition-opacity active:scale-95 text-sm">Start Planning</button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                {trips.map((trip) => (
                  <div key={trip.id} onClick={() => router.push(`/trips/${trip.id}`)} className="group relative h-96 rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl hover:shadow-zinc-500/20 dark:hover:shadow-black/50 hover:-translate-y-2 transition-all duration-500 cursor-pointer bg-zinc-200 dark:bg-zinc-800">
                    
                    {/* Full Cover Image */}
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={trip.imageUrl || getTripImage(trip.id)} alt={trip.title} className="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out" />
                    
                    {/* Dark Gradient Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent opacity-80 group-hover:opacity-90 transition-opacity duration-500"></div>

                    {/* ✨ UPDATED: Top Right Admin Actions */}
                    {trip.adminId === user.uid && (
                      <div className="absolute top-5 right-5 z-20 flex flex-col gap-2">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedTripToExtend(trip);
                            setNewEndDate(trip.endDate);
                            setIsExtendModalOpen(true);
                          }}
                          className="h-10 w-10 bg-sky-500 text-zinc-950 hover:bg-sky-400 backdrop-blur-md border border-sky-400/50 rounded-full flex items-center justify-center transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-[0_0_15px_rgba(14,165,233,0.3)] scale-100 md:scale-90 md:group-hover:scale-100"
                          title="Extend Trip Duration"
                        >
                          <Calendar className="h-4 w-4" />
                        </button>
                        <button
                          onClick={(e) => handleArchiveTrip(e, trip.id, trip.title)}
                          className="h-10 w-10 bg-white/10 hover:bg-white backdrop-blur-md border border-white/20 text-white hover:text-zinc-900 rounded-full flex items-center justify-center transition-all opacity-100 md:opacity-0 md:group-hover:opacity-100 shadow-lg scale-100 md:scale-90 md:group-hover:scale-100"
                          title="Archive Trip"
                        >
                          <Archive className="h-4 w-4" />
                        </button>
                      </div>
                    )}

                    {/* Floating Pill Info Box */}
                    <div className="absolute bottom-5 left-5 right-5 bg-white/10 dark:bg-black/20 backdrop-blur-xl border border-white/20 p-5 rounded-3xl flex justify-between items-center shadow-2xl transform translate-y-2 group-hover:translate-y-0 transition-transform duration-500">
                      <div className="min-w-0 pr-4">
                        <h3 className="text-xl font-bold text-white truncate drop-shadow-md mb-1.5">{trip.title}</h3>
                        <div className="flex items-center gap-3">
                          <span className="flex items-center text-white/90 text-xs font-bold">
                            <Calendar className="h-3.5 w-3.5 mr-1 opacity-80" /> {new Date(trip.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                          </span>
                          <span className="h-1 w-1 bg-white/50 rounded-full"></span>
                          <span className="flex items-center text-white/90 text-xs font-bold">
                            <Users className="h-3.5 w-3.5 mr-1 opacity-80" /> {trip.members?.length || 1}
                          </span>
                        </div>
                      </div>
                      
                      {/* Enter Button */}
                      <div className="h-12 w-12 shrink-0 bg-white text-zinc-900 rounded-full flex items-center justify-center shadow-lg group-hover:bg-emerald-500 group-hover:text-zinc-950 transition-colors duration-300">
                        <ArrowRight className="h-5 w-5" />
                      </div>
                    </div>

                  </div>
                ))}
              </div>
            )}
          </div>
        </main>
      </div>

      {/* CREATE TRIP MODAL (MINIMAL) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-zinc-950 rounded-[2rem] p-8 md:p-10 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => !isSubmitting && setIsModalOpen(false)} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 p-2 rounded-full transition-colors"><X className="h-5 w-5" /></button>

            <div className="mb-8">
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Plan New Trip</h2>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">Set the dates. We'll handle the rest.</p>
            </div>

            <form onSubmit={handleCreateTrip} className="flex flex-col gap-6">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Destination / Title</label>
                <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Summer in Tokyo" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 dark:focus:border-zinc-600 focus:ring-1 focus:ring-zinc-400 rounded-xl p-4 outline-none font-bold text-zinc-900 dark:text-white transition-all placeholder-zinc-400 text-lg" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Start Date</label>
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 rounded-xl p-4 outline-none font-bold text-zinc-900 dark:text-white transition-all cursor-pointer dark:[color-scheme:dark]" required />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">End Date</label>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 rounded-xl p-4 outline-none font-bold text-zinc-900 dark:text-white transition-all cursor-pointer dark:[color-scheme:dark]" required />
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-4 pt-6">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3.5 text-zinc-500 hover:bg-zinc-100 dark:bg-zinc-900 rounded-xl font-bold transition-colors w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 text-white dark:text-zinc-950 bg-zinc-900 dark:bg-white hover:opacity-90 rounded-xl font-bold transition-all w-full sm:w-auto disabled:opacity-50 flex justify-center items-center active:scale-95">
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Create Trip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXTEND TRIP MODAL */}
      {isExtendModalOpen && selectedTripToExtend && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-zinc-950 rounded-[2rem] p-8 md:p-10 w-full max-w-sm shadow-2xl relative animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => !isExtending && setIsExtendModalOpen(false)} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 p-2 rounded-full transition-colors"><X className="h-5 w-5" /></button>

            <div className="mb-6">
              <div className="h-12 w-12 bg-sky-500/10 text-sky-500 rounded-full flex items-center justify-center mb-4 border border-sky-500/20">
                <Calendar className="h-6 w-6" />
              </div>
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">Extend Trip</h2>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">Select a new end date for <span className="font-bold text-zinc-900 dark:text-white">{selectedTripToExtend.title}</span>.</p>
            </div>

            <form onSubmit={handleExtendTripSubmit} className="flex flex-col gap-6">
              <div>
                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">New End Date</label>
                <input 
                  type="date" 
                  value={newEndDate} 
                  min={selectedTripToExtend.endDate} 
                  onChange={(e) => setNewEndDate(e.target.value)} 
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-xl p-4 outline-none font-bold text-zinc-900 dark:text-white transition-all cursor-pointer dark:[color-scheme:dark]" 
                  required 
                />
              </div>
              <button type="submit" disabled={isExtending} className="w-full bg-sky-500 text-zinc-950 py-4 rounded-xl font-bold transition-all text-base disabled:opacity-50 flex justify-center items-center active:scale-95 hover:bg-sky-400 shadow-[0_0_15px_rgba(14,165,233,0.3)]">
                {isExtending ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Extension"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* JOIN TRIP MODAL (MINIMAL) */}
      {isJoinModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-white dark:bg-zinc-950 rounded-[2rem] p-8 md:p-12 w-full max-w-sm shadow-2xl relative text-center animate-in zoom-in-95 duration-200 border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => !isSubmitting && setIsJoinModalOpen(false)} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 p-2 rounded-full transition-colors"><X className="h-5 w-5" /></button>
            
            <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-900 dark:text-white mx-auto mb-6 shadow-sm"><Users className="h-6 w-6" /></div>
            
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white mb-2 tracking-tight">Join a Trip</h2>
            <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-8 text-sm">Enter the 6-character code shared by your friend.</p>
            
            <form onSubmit={handleJoinTrip} className="flex flex-col gap-6">
              <div>
                <input
                  type="text"
                  value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                  placeholder="X7B9K2"
                  maxLength={6}
                  className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-zinc-400 focus:ring-1 focus:ring-zinc-400 rounded-xl p-5 text-center text-3xl font-black tracking-[0.4em] uppercase outline-none transition-all placeholder-zinc-300 dark:placeholder-zinc-700 text-zinc-900 dark:text-white"
                  required
                />
              </div>
              <button type="submit" disabled={isSubmitting} className="w-full bg-emerald-500 text-zinc-950 py-4 rounded-xl font-bold transition-all text-base disabled:opacity-50 flex justify-center items-center active:scale-95 hover:bg-emerald-400">
                {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Join Adventure"}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ✨ CUSTOM ALERT DIALOG MODAL */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200 relative">
            <button onClick={closeDialog} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors active:scale-95">
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${
                dialog.type === 'danger' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 border-rose-200 dark:border-rose-500/20' :
                dialog.type === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500 border-amber-200 dark:border-amber-500/20' :
                'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 border-emerald-200 dark:border-emerald-500/20'
              }`}>
                {dialog.type === 'danger' ? <AlertTriangle className="h-6 w-6" /> : 
                 dialog.type === 'warning' ? <AlertTriangle className="h-6 w-6" /> : 
                 <Info className="h-6 w-6" />}
              </div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">{dialog.title}</h3>
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-400 font-medium mb-10 leading-relaxed text-sm">
              {dialog.message}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {dialog.cancelText && (
                <button onClick={closeDialog} className="px-8 py-4 rounded-full font-bold text-[10px] uppercase tracking-widest text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors w-full sm:w-auto text-center active:scale-95">
                  {dialog.cancelText}
                </button>
              )}
              <button 
                onClick={dialog.onConfirm || closeDialog} 
                className={`px-8 py-4 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all w-full sm:w-auto text-center active:scale-95 ${
                  dialog.type === 'danger' ? 'bg-rose-500 hover:bg-rose-400 text-zinc-950 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 
                  'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                }`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}