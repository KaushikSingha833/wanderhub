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

// ✨ INTERACTIVE HOVER SPOTLIGHT CARD (UPGRADED TO FINTECH GLASS)
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
      className={`relative overflow-hidden rounded-[2.5rem] bg-zinc-900/40 backdrop-blur-2xl border border-zinc-800/50 shadow-2xl transition-all duration-500 hover:border-zinc-700/50 hover:shadow-indigo-500/10 ${className}`}
    >
      <div
        className="pointer-events-none absolute -inset-px opacity-0 transition-opacity duration-500 z-0"
        style={{
          opacity,
          background: `radial-gradient(800px circle at ${position.x}px ${position.y}px, rgba(99, 102, 241, 0.12), transparent 40%)`,
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

  // STRICT ROLE-BASED ACCESS CONTROL (RBAC)
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
          fetchPendingHotels();
        } else {
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

  // APPROVE LOGIC USING CUSTOM UI DIALOG
  const handleApprove = (uid: string, hotelName: string) => {
    showDialog(
      "Approve Partner?",
      `Are you sure you want to officially verify and approve ${hotelName}? They will instantly gain access to the WanderHub partner ecosystem.`,
      "warning",
      async () => {
        closeDialog();
        setProcessingId(uid);
        try {
          await updateDoc(doc(db, "users", uid), {
            verificationStatus: "approved"
          });
          setPendingHotels(prev => prev.filter(hotel => hotel.uid !== uid));
          showDialog("Success", `${hotelName} has been verified and integrated into the network.`, "info");
        } catch (error) {
          console.error("Error approving hotel:", error);
          showDialog("Error", "Failed to approve hotel due to a secure database error.", "danger");
        } finally {
          setProcessingId(null);
        }
      },
      "Authorize & Approve",
      "Cancel"
    );
  };

  if (isCheckingAuth) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] animate-pulse"></div>
        <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-4 relative z-10" />
        <p className="text-[10px] font-bold uppercase tracking-widest text-indigo-500/80 relative z-10 animate-pulse">Verifying Credentials...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-950 font-sans text-white relative overflow-hidden selection:bg-indigo-500/30">
      
      {/* --- PRO BACKGROUND EFFECTS --- */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[600px] h-[600px] bg-indigo-600/10 rounded-full blur-[120px] animate-pulse"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[600px] h-[600px] bg-emerald-600/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s'}}></div>
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.08] mix-blend-overlay"></div>
      </div>

      <div className="max-w-7xl mx-auto px-6 md:px-12 py-16 relative z-10">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6 pb-8 border-b border-zinc-800">
          <div>
            <Link href="/" className="inline-flex items-center text-zinc-500 hover:text-white text-[10px] uppercase tracking-widest font-bold mb-8 transition-colors bg-zinc-900/50 px-5 py-2.5 rounded-full border border-zinc-800 backdrop-blur-md w-max active:scale-95">
              <ArrowLeft className="h-3.5 w-3.5 mr-2" /> Back to Dashboard
            </Link>
            <h1 className="text-4xl md:text-6xl font-black text-white flex items-center tracking-tighter drop-shadow-md">
              <ShieldCheck className="h-10 w-10 md:h-14 md:w-14 mr-4 text-indigo-500" /> 
              Command Center
            </h1>
            <p className="text-zinc-400 mt-3 font-medium text-sm md:text-base">Review and cryptographically verify incoming hotel partnerships.</p>
          </div>
          <div className="bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 px-6 py-3.5 rounded-full text-[10px] uppercase tracking-widest font-bold flex items-center shadow-[0_0_30px_rgba(99,102,241,0.15)]">
            <span className="relative flex h-2.5 w-2.5 mr-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-indigo-500"></span>
            </span>
            {pendingHotels.length} Awaiting Verification
          </div>
        </div>

        {/* LOADING STATE */}
        {isLoading ? (
          <div className="flex flex-col justify-center items-center py-32 bg-zinc-900/30 backdrop-blur-xl rounded-[3rem] border border-zinc-800 shadow-2xl">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-500 mb-6" />
            <p className="text-zinc-500 font-bold uppercase tracking-widest text-[10px]">Scanning Database...</p>
          </div>
        ) : pendingHotels.length === 0 ? (
          
          /* EMPTY STATE */
          <div className="bg-zinc-900/30 backdrop-blur-xl rounded-[3rem] p-16 md:p-24 text-center border border-dashed border-zinc-800 shadow-2xl animate-in zoom-in-95 duration-500 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-emerald-500"></div>
            <div className="h-24 w-24 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-8 shadow-[0_0_40px_rgba(16,185,129,0.15)]">
              <CheckCircle2 className="h-10 w-10 text-emerald-500" />
            </div>
            <h3 className="text-3xl md:text-4xl font-black text-white mb-3 tracking-tighter">Queue is Clear</h3>
            <p className="text-zinc-400 font-medium text-sm">All partner applications have been successfully processed and verified.</p>
          </div>

        ) : (
          
          /* PENDING HOTELS GRID */
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700">
            {pendingHotels.map((hotel) => (
              <SpotlightCard key={hotel.uid} className="p-8 md:p-10 group">
                
                <div className="absolute top-8 right-8 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-[9px] font-bold px-3.5 py-1.5 rounded-full uppercase tracking-widest flex items-center shadow-lg">
                  <div className="h-1.5 w-1.5 bg-amber-400 rounded-full mr-2 animate-pulse"></div> Action Required
                </div>
                
                <div className="flex flex-col sm:flex-row sm:items-start gap-6 mb-10">
                  <div className="h-20 w-20 bg-zinc-950 border border-zinc-800 rounded-2xl flex items-center justify-center shrink-0 shadow-inner">
                    <Building2 className="h-10 w-10 text-indigo-500" />
                  </div>
                  <div className="pr-0 sm:pr-20">
                    <h3 className="text-3xl font-black text-white mb-2 tracking-tighter">{hotel.hotelName}</h3>
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5">Managed by <span className="text-zinc-300">{hotel.ownerName}</span></p>
                    <a href={`mailto:${hotel.email}`} className="text-sm font-bold text-indigo-400 hover:text-indigo-300 transition-colors inline-block">{hotel.email}</a>
                  </div>
                </div>

                <div className="bg-zinc-950 rounded-3xl p-6 mb-8 border border-zinc-800/80 shadow-inner space-y-5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      <FileText className="h-4 w-4 mr-2" /> Trade License
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">{hotel.licenseNumber}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-zinc-800/80 pt-5">
                    <div className="flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest">
                      <Hash className="h-4 w-4 mr-2" /> GSTIN
                    </div>
                    <span className="font-mono text-sm font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">{hotel.gstNumber}</span>
                  </div>
                </div>

                <button 
                  onClick={() => handleApprove(hotel.uid, hotel.hotelName)}
                  disabled={processingId === hotel.uid}
                  className={`w-full py-5 rounded-full font-bold text-xs uppercase tracking-widest flex items-center justify-center transition-all disabled:opacity-50 active:scale-95 ${
                    processingId === hotel.uid 
                      ? 'bg-emerald-500 text-zinc-950 shadow-[0_0_30px_rgba(16,185,129,0.3)]' 
                      : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.2)] hover:shadow-[0_0_30px_rgba(79,70,229,0.4)]'
                  }`}
                >
                  {processingId === hotel.uid ? <Loader2 className="h-5 w-5 animate-spin" /> : "Authorize & Approve"}
                </button>

              </SpotlightCard>
            ))}
          </div>
        )}
      </div>

      {/* --- ✨ CUSTOM ALERT DIALOG MODAL (EDITORIAL LUXURY) --- */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/80 backdrop-blur-xl animate-in fade-in duration-200">
          <div className="bg-zinc-950 rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl border border-zinc-800 animate-in zoom-in-95 duration-300 relative">
            <button onClick={closeDialog} className="absolute top-6 right-6 text-zinc-500 hover:text-white transition-colors active:scale-95">
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-5 mb-6">
              <div className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 border shadow-inner ${
                dialog.type === 'danger' ? 'bg-rose-500/10 text-rose-500 border-rose-500/20' :
                dialog.type === 'warning' ? 'bg-amber-500/10 text-amber-500 border-amber-500/20' :
                'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
              }`}>
                {dialog.type === 'danger' ? <AlertTriangle className="h-6 w-6" /> : 
                 dialog.type === 'warning' ? <AlertTriangle className="h-6 w-6" /> : 
                 <Info className="h-6 w-6" />}
              </div>
              <h3 className="text-2xl font-black text-white tracking-tight">{dialog.title}</h3>
            </div>
            
            <p className="text-zinc-400 font-medium mb-10 leading-relaxed text-sm">
              {dialog.message}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {dialog.cancelText && (
                <button onClick={closeDialog} className="px-8 py-4 rounded-full font-bold text-[10px] uppercase tracking-widest text-zinc-400 bg-zinc-900 hover:text-white hover:bg-zinc-800 transition-colors w-full sm:w-auto border border-zinc-800 active:scale-95">
                  {dialog.cancelText}
                </button>
              )}
              <button 
                onClick={dialog.onConfirm || closeDialog} 
                className={`px-8 py-4 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all w-full sm:w-auto active:scale-95 ${
                  dialog.type === 'danger' ? 'bg-rose-500 hover:bg-rose-400 text-zinc-950 shadow-[0_0_20px_rgba(244,63,94,0.3)]' : 
                  dialog.type === 'warning' ? 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-[0_0_20px_rgba(79,70,229,0.3)]' :
                  'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_20px_rgba(16,185,129,0.3)]'
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