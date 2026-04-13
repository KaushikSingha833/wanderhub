"use client";
import React, { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { collection, query, where, getDocs, doc, updateDoc, getDoc } from "firebase/firestore";
import { onAuthStateChanged } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { Building2, CheckCircle2, ShieldCheck, Loader2, FileText, Hash, AlertTriangle, Info, X, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface PendingHotel {
  uid: string;
  hotelName: string;
  ownerName: string;
  email: string;
  licenseNumber: string;
  gstNumber: string;
}

// ✨ NEW: INTERACTIVE HOVER SPOTLIGHT CARD COMPONENT
const SpotlightCard = ({ children, className = "" }: { children: React.ReactNode, className?: string }) => {
  const divRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [opacity, setOpacity] = useState(0);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!divRef.current) return;
    const rect = divRef.current.getBoundingClientRect();
    setPosition({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  };

  return (
    <div
      ref={divRef}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setOpacity(1)}
      onMouseLeave={() => setOpacity(0)}
      className={`relative overflow-hidden rounded-[2rem] bg-white/5 backdrop-blur-xl border border-white/10 shadow-2xl transition-all duration-300 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 z-0"
        style={{
          opacity,
          background: `radial-gradient(600px circle at ${position.x}px ${position.y}px, rgba(99, 102, 241, 0.15), transparent 40%)`,
        }}
      />
      <div className="relative z-10">
        {children}
      </div>
    </div>
  );
};

export default function AdminDashboard() {
  const router = useRouter();
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [pendingHotels, setPendingHotels] = useState<PendingHotel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // CUSTOM DIALOG STATE
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "warning" | "danger";
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    isOpen: false, title: "", message: "", type: "info",
  });

  const showDialog = (title: string, message: string, type: "info" | "warning" | "danger" = "info", onConfirm?: () => void, confirmText = "OK", cancelText?: string) => {
    setDialog({ isOpen: true, title, message, type, confirmText, cancelText, onConfirm });
  };
  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  // ✨ NEW: STRICT ROLE-BASED ACCESS CONTROL (RBAC)
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push('/');
        return;
      }
      try {
        const userDocRef = doc(db, "users", user.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists() && userDocSnap.data().role === "admin") {
          // User is verified as an Admin! Let them in.
          fetchPendingHotels();
        } else {
          // Security Triggered: User is not an admin. Kick them out.
          router.push('/');
        }
      } catch (error) {
        console.error("Auth check failed:", error);
        router.push('/');
      } finally {
        setIsCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  const fetchPendingHotels = async () => {
    setIsLoading(true);
    try {
      const q = query(
        collection(db, "users"), 
        where("role", "==", "hotel_partner"),
        where("verificationStatus", "==", "pending")
      );
      
      const querySnapshot = await getDocs(q);
      const hotels: PendingHotel[] = [];
      querySnapshot.forEach((doc) => {
        hotels.push(doc.data() as PendingHotel);
      });
      
      setPendingHotels(hotels);
    } catch (error) {
      console.error("Error fetching hotels:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // ✨ UPGRADED: APPROVE LOGIC USING CUSTOM UI DIALOG
  const handleApprove = (uid: string, hotelName: string) => {
    showDialog(
      "Approve Partner?",
      `Are you sure you want to approve ${hotelName}? They will immediately be granted access to the WanderHub partner dashboard.`,
      "warning",
      async () => {
        closeDialog();
        setProcessingId(uid);
        try {
          await updateDoc(doc(db, "users", uid), {
            verificationStatus: "approved"
          });
          setPendingHotels(prev => prev.filter(hotel => hotel.uid !== uid));
          showDialog("Success", `${hotelName} has been successfully verified and approved!`, "info");
        } catch (error) {
          console.error("Error approving hotel:", error);
          showDialog("Error", "Failed to approve hotel due to a database error.", "danger");
        } finally {
          setProcessingId(null);
        }
      },
      "Approve Hotel",
      "Cancel"
    );
  };

  if (isCheckingAuth) {
    return <div className="h-screen flex items-center justify-center bg-[#030712]"><div className="animate-spin h-10 w-10 border-4 border-indigo-500 border-t-transparent rounded-full"></div></div>;
  }

  return (
    <div className="min-h-screen bg-[#030712] font-sans text-white relative overflow-hidden selection:bg-indigo-500/30">
      
      {/* --- PRO BACKGROUND EFFECTS --- */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[500px] h-[500px] bg-indigo-600/20 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-purple-600/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s'}}></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-10 mix-blend-overlay"></div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-12 relative z-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-12 gap-6 pb-8 border-b border-white/10">
          <div>
            <Link href="/" className="inline-flex items-center text-slate-400 hover:text-white text-sm font-bold mb-6 transition-colors bg-white/5 px-4 py-2 rounded-full border border-white/10 backdrop-blur-md w-max">
              <ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard
            </Link>
            <h1 className="text-4xl md:text-5xl font-black text-white flex items-center tracking-tight">
              <ShieldCheck className="h-10 w-10 mr-4 text-indigo-500" /> 
              Command Center
            </h1>
            <p className="text-slate-400 mt-3 font-medium text-lg">Review and cryptographically verify incoming hotel partnerships.</p>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 px-6 py-3 rounded-2xl font-black flex items-center shadow-[0_0_20px_rgba(99,102,241,0.2)]">
            <span className="relative flex h-3 w-3 mr-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
            </span>
            {pendingHotels.length} Awaiting Verification
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-32 bg-white/5 backdrop-blur-xl rounded-[2.5rem] border border-white/10 shadow-2xl">
            <Loader2 className="h-12 w-12 animate-spin text-indigo-500 mb-4" />
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">Scanning Database...</p>
          </div>
        ) : pendingHotels.length === 0 ? (
          
          /* EMPTY STATE */
          <div className="bg-white/5 backdrop-blur-xl rounded-[3rem] p-16 text-center border border-dashed border-white/20 shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-emerald-400 to-teal-500"></div>
            <div className="h-24 w-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-6 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
              <CheckCircle2 className="h-12 w-12 text-emerald-400" />
            </div>
            <h3 className="text-3xl font-black text-white mb-3 tracking-tight">Queue is Clear!</h3>
            <p className="text-slate-400 font-medium text-lg">All partner applications have been processed and verified.</p>
          </div>

        ) : (
          
          /* PENDING HOTELS GRID */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {pendingHotels.map((hotel) => (
              <SpotlightCard key={hotel.uid} className="p-8">
                
                <div className="absolute top-6 right-6 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest flex items-center shadow-lg">
                  <div className="h-1.5 w-1.5 bg-amber-400 rounded-full mr-2 animate-pulse"></div> Action Required
                </div>
                
                <div className="flex items-start gap-5 mb-8">
                  <div className="h-16 w-16 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                    <Building2 className="h-8 w-8 text-indigo-400" />
                  </div>
                  <div className="pr-20">
                    <h3 className="text-2xl font-black text-white mb-1 tracking-tight">{hotel.hotelName}</h3>
                    <p className="text-sm font-medium text-slate-400 mb-1">Managed by <span className="text-slate-200 font-bold">{hotel.ownerName}</span></p>
                    <a href={`mailto:${hotel.email}`} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors inline-block">{hotel.email}</a>
                  </div>
                </div>

                <div className="bg-black/20 rounded-2xl p-5 mb-8 border border-white/5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-xs font-black text-slate-500 uppercase tracking-widest">
                      <FileText className="h-4 w-4 mr-2" /> Trade License
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">{hotel.licenseNumber}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-white/5 pt-4">
                    <div className="flex items-center text-xs font-black text-slate-500 uppercase tracking-widest">
                      <Hash className="h-4 w-4 mr-2" /> GSTIN
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1 rounded-lg border border-emerald-500/20">{hotel.gstNumber}</span>
                  </div>
                </div>

                <button 
                  onClick={() => handleApprove(hotel.uid, hotel.hotelName)}
                  disabled={processingId === hotel.uid}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white py-4 rounded-xl font-black text-lg flex items-center justify-center transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(79,70,229,0.3)] hover:shadow-[0_0_30px_rgba(79,70,229,0.5)]"
                >
                  {processingId === hotel.uid ? <Loader2 className="h-6 w-6 animate-spin" /> : "Verify & Approve Partner"}
                </button>

              </SpotlightCard>
            ))}
          </div>
        )}
      </div>

      {/* --- ✨ CUSTOM ALERT DIALOG MODAL --- */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-[#0f172a] rounded-[2rem] p-8 max-w-md w-full shadow-2xl border border-white/10 animate-in zoom-in-95 duration-300 relative">
            <button onClick={closeDialog} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center gap-4 mb-5">
              <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 border ${
                dialog.type === 'danger' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                dialog.type === 'warning' ? 'bg-amber-500/20 text-amber-400 border-amber-500/30' :
                'bg-indigo-500/20 text-indigo-400 border-indigo-500/30'
              }`}>
                {dialog.type === 'danger' ? <AlertTriangle className="h-6 w-6" /> : 
                 dialog.type === 'warning' ? <AlertTriangle className="h-6 w-6" /> : 
                 <Info className="h-6 w-6" />}
              </div>
              <h3 className="text-xl font-black text-white tracking-tight">{dialog.title}</h3>
            </div>
            
            <p className="text-slate-300 font-medium mb-8 leading-relaxed">
              {dialog.message}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {dialog.cancelText && (
                <button onClick={closeDialog} className="px-6 py-3 rounded-xl font-bold text-slate-300 bg-white/5 hover:bg-white/10 transition-colors w-full sm:w-auto border border-white/10">
                  {dialog.cancelText}
                </button>
              )}
              <button 
                onClick={dialog.onConfirm || closeDialog} 
                className={`px-6 py-3 rounded-xl font-black text-white transition-all shadow-lg w-full sm:w-auto ${
                  dialog.type === 'danger' ? 'bg-red-600 hover:bg-red-500 shadow-red-600/20' : 
                  'bg-indigo-600 hover:bg-indigo-500 shadow-indigo-600/20'
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