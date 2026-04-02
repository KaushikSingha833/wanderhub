"use client";
import { useState, useEffect } from "react";
import { collection, query, where, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from "../lib/firebase"; // Make sure this path points to your firebase.ts!
import { Building2, CheckCircle, ShieldCheck, Loader2, FileText, Hash } from "lucide-react";

// Define what a pending hotel looks like based on our registration form
interface PendingHotel {
  uid: string;
  hotelName: string;
  ownerName: string;
  email: string;
  licenseNumber: string;
  gstNumber: string;
}

export default function AdminDashboard() {
  const [pendingHotels, setPendingHotels] = useState<PendingHotel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  // Fetch all hotels that have a 'pending' status
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

  useEffect(() => {
    fetchPendingHotels();
  }, []);

  // The Magic Approve Function
  const handleApprove = async (uid: string) => {
    if (!confirm("Are you sure you want to approve this hotel? They will be granted access to the partner dashboard.")) return;
    
    setProcessingId(uid);
    try {
      // Find their profile in Firestore and flip their status to approved!
      await updateDoc(doc(db, "users", uid), {
        verificationStatus: "approved"
      });

      // Remove them from the local list so they disappear from the screen
      setPendingHotels(prev => prev.filter(hotel => hotel.uid !== uid));
      alert("Hotel successfully approved!");
    } catch (error) {
      console.error("Error approving hotel:", error);
      alert("Failed to approve hotel.");
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-8">
      <div className="max-w-5xl mx-auto">
        
        {/* Header */}
        <div className="flex items-center justify-between mb-8 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-black text-slate-900 flex items-center">
              <ShieldCheck className="h-8 w-8 mr-3 text-indigo-600" /> 
              Admin Portal
            </h1>
            <p className="text-slate-500 mt-2 font-medium">Review and verify new Hotel Partner applications.</p>
          </div>
          <div className="bg-indigo-100 text-indigo-800 px-4 py-2 rounded-xl font-bold">
            {pendingHotels.length} Pending
          </div>
        </div>

        {/* Loading State */}
        {isLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
          </div>
        ) : pendingHotels.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-12 text-center border border-dashed border-slate-300">
            <CheckCircle className="h-16 w-16 text-emerald-500 mx-auto mb-4" />
            <h3 className="text-2xl font-bold text-slate-900 mb-2">You are all caught up!</h3>
            <p className="text-slate-500">There are no pending hotel applications to review at this time.</p>
          </div>
        ) : (
          /* The Pending Hotels Grid */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingHotels.map((hotel) => (
              <div key={hotel.uid} className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-bl-xl uppercase tracking-wider">
                  Needs Review
                </div>
                
                <div className="flex items-start gap-4 mb-6">
                  <div className="h-14 w-14 bg-slate-100 rounded-2xl flex items-center justify-center shrink-0">
                    <Building2 className="h-7 w-7 text-slate-600" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-slate-900">{hotel.hotelName}</h3>
                    <p className="text-sm font-medium text-slate-500">Manager: {hotel.ownerName}</p>
                    <a href={`mailto:${hotel.email}`} className="text-sm font-bold text-indigo-600 hover:underline">{hotel.email}</a>
                  </div>
                </div>

                <div className="bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm font-bold text-slate-500">
                      <FileText className="h-4 w-4 mr-2" /> Trade License
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-900">{hotel.licenseNumber}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center text-sm font-bold text-slate-500">
                      <Hash className="h-4 w-4 mr-2" /> GSTIN
                    </div>
                    <span className="font-mono text-sm font-bold text-slate-900">{hotel.gstNumber}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button 
                    onClick={() => handleApprove(hotel.uid)}
                    disabled={processingId === hotel.uid}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-xl font-bold flex items-center justify-center transition-all disabled:opacity-50"
                  >
                    {processingId === hotel.uid ? <Loader2 className="h-5 w-5 animate-spin" /> : "Approve Hotel"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}