"use client";
import { useState } from "react";
import { createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; // Make sure this path is correct
import { Building2, Mail, Lock, AlertCircle, CheckCircle2, User as UserIcon, FileText, Hash, MapPin } from "lucide-react";
import Link from "next/link";

export default function PartnerJoinPage() {
  const [hotelName, setHotelName] = useState("");
  const [city, setCity] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  // NEW: Text fields instead of files!
  const [licenseNumber, setLicenseNumber] = useState("");
  const [gstNumber, setGstNumber] = useState("");
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      if (!licenseNumber.trim() || !gstNumber.trim()) {
        throw new Error("Please provide your business verification numbers.");
      }

      // 1. Create the Auth User
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 2. Save the Business Profile to Firestore with the text IDs
      await setDoc(doc(db, "users", user.uid), {
        uid: user.uid,
        email: user.email,
        hotelName,
        city: city.toLowerCase().trim(),
        ownerName,
        role: "hotel_partner",
        verificationStatus: "pending", 
        // Save the text numbers directly to the database
        licenseNumber: licenseNumber.trim(),
        gstNumber: gstNumber.trim().toUpperCase(), 
        createdAt: new Date(),
      });

      setSuccess(true);
      
    } catch (err: any) {
      setError(err.message || "Failed to register. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-slate-100">
          <CheckCircle2 className="h-16 w-16 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Application Received!</h2>
          <p className="text-slate-500 font-medium mb-6">
            Thank you for registering <strong>{hotelName}</strong>. Our team is verifying your GSTIN and Business License. You will receive an email once your hotel dashboard is unlocked.
          </p>
          <Link href="/" className="inline-block bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all">
            Return to Home
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4 font-sans text-slate-900">
      <div className="w-full max-w-lg bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-slate-100 my-8">
        
        <div className="flex justify-center mb-6">
          <div className="h-16 w-16 bg-slate-900 rounded-2xl flex items-center justify-center shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
        </div>
        
        <h2 className="text-3xl font-black text-center mb-2 tracking-tight">WanderHub Partners</h2>
        <p className="text-slate-500 font-medium text-center mb-8">Register your hotel and reach thousands of travelers.</p>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-100 text-red-600 text-sm font-bold rounded-xl flex items-center">
            <AlertCircle className="h-5 w-5 mr-2 shrink-0" /> {error}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Hotel Name</label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <input type="text" value={hotelName} onChange={(e) => setHotelName(e.target.value)} required placeholder="The Grand Taj" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-all text-slate-900" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">City / Location</label>
              <div className="relative">
                <MapPin className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <input type="text" value={city} onChange={(e) => setCity(e.target.value)} required placeholder="e.g. Pune, Mumbai" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-all text-slate-900" />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Manager Name</label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                <input type="text" value={ownerName} onChange={(e) => setOwnerName(e.target.value)} required placeholder="Rahul Sharma" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-all text-slate-900" />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Business Email</label>
            <div className="relative">
              <Mail className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="contact@hotel.com" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-all text-slate-900" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Password</label>
            <div className="relative">
              <Lock className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-all text-slate-900" />
            </div>
          </div>

          <div className="my-6 border-t border-slate-100 pt-4">
            <h3 className="text-sm font-bold text-slate-900 mb-4">Business Verification</h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Trade License Number</label>
                <div className="relative">
                  <FileText className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                  <input type="text" value={licenseNumber} onChange={(e) => setLicenseNumber(e.target.value)} required placeholder="e.g. TL-2026-8921" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-all text-slate-900" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">GSTIN Number</label>
                <div className="relative">
                  <Hash className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                  <input type="text" value={gstNumber} onChange={(e) => setGstNumber(e.target.value)} required placeholder="22AAAAA0000A1Z5" className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-slate-900 outline-none font-medium transition-all text-slate-900 uppercase" />
                </div>
              </div>
            </div>
          </div>

          <button type="submit" disabled={isLoading} className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl hover:bg-slate-800 shadow-xl transition-all disabled:opacity-50 mt-2 text-lg">
            {isLoading ? "Submitting Application..." : "Submit for Verification"}
          </button>
        </form>
      </div>
    </div>
  );
}