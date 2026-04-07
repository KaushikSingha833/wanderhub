"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, addDoc, query, where, onSnapshot, deleteDoc, updateDoc, orderBy, deleteField } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; 
import { useCurrency } from "../../lib/useCurrency"; 
import { Building2, Plus, BedDouble, Trash2, IndianRupee, Loader2, AlertTriangle, LogOut, Image as ImageIcon, CheckCircle2, TrendingUp, ShieldCheck, MapPin, AlignLeft, Tags, Inbox, Check, XCircle, Clock, Users, ArrowRightCircle, Settings, Wallet, Smartphone, Pencil } from "lucide-react";
import { signOut } from "firebase/auth";

interface Room {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl?: string;
  imageUrls?: string[];
  maxGuests?: number; // ✨ ADDED MAX GUESTS
}

interface Booking {
  id: string;
  hotelName: string;
  roomId: string;
  roomName: string;
  partnerId: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  checkIn: string;
  checkOut: string;
  guests: number;
  totalPriceBase: number;
  status: "Pending" | "Approved" | "Confirmed" | "Declined"; 
  createdAt: any;
  transactionId?: string;
  extensionRequest?: {
    requestedCheckOut: string;
    extraPriceBase: number;
    status: "Pending" | "Declined";
  };
}

export default function PartnerDashboard() {
  const router = useRouter();
  
  // Auth & Security State
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [activeTab, setActiveTab] = useState("inventory"); 

  // Room Inventory State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  
  // Booking Inbox State
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  // Form State
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPrice, setNewRoomPrice] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [newRoomImages, setNewRoomImages] = useState<string[]>([""]);
  const [newRoomMaxGuests, setNewRoomMaxGuests] = useState("2"); // ✨ NEW STATE FOR GUESTS

  // Payment Settings State
  const [upiId, setUpiId] = useState("");
  const [isSavingUpi, setIsSavingUpi] = useState(false);

  const { symbol, convert } = useCurrency();

  // 1. THE SECURITY BOUNCER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/");
        return;
      }

      try {
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const profile = docSnap.data();
          if (profile.role !== "hotel_partner") {
            router.push("/"); 
            return;
          }
          setUserProfile(profile);
          if (profile.upiId) {
            setUpiId(profile.upiId);
          }
        } else {
          router.push("/");
        }
      } catch (error) {
        console.error("Auth check error:", error);
      } finally {
        setIsCheckingAuth(false);
      }
    });

    return () => unsubscribe();
  }, [router]);

  // 2. FETCH HOTEL'S ROOMS & BOOKINGS
  useEffect(() => {
    if (!userProfile || userProfile.verificationStatus !== "approved") return;

    const qRooms = query(collection(db, "rooms"), where("hotelOwnerId", "==", userProfile.uid));
    const unsubscribeRooms = onSnapshot(qRooms, (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];
      setRooms(roomData);
    });

    const qBookings = query(
      collection(db, "bookings"), 
      where("partnerId", "==", userProfile.uid)
    );
    const unsubscribeBookings = onSnapshot(qBookings, (snapshot) => {
      const bookingData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      bookingData.sort((a, b) => b.createdAt?.toMillis() - a.createdAt?.toMillis());
      setBookings(bookingData);
    });

    return () => {
      unsubscribeRooms();
      unsubscribeBookings();
    };
  }, [userProfile]);

  // EDIT HELPERS
  const handleEditClick = (room: Room) => {
    setEditingRoomId(room.id);
    setNewRoomName(room.name);
    setNewRoomPrice(room.price.toString());
    setNewRoomDesc(room.description || "");
    setNewRoomImages(room.imageUrls && room.imageUrls.length > 0 ? room.imageUrls : (room.imageUrl ? [room.imageUrl] : [""]));
    setNewRoomMaxGuests(room.maxGuests?.toString() || "2"); // ✨ LOAD EXISTING GUESTS
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingRoomId(null);
    setNewRoomName("");
    setNewRoomPrice("");
    setNewRoomDesc("");
    setNewRoomImages([""]);
    setNewRoomMaxGuests("2"); // ✨ RESET GUESTS
  };

  // 3. SAVE A ROOM (Handles both Add and Update)
  const handleSaveRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName || !newRoomPrice || !userProfile) return;
    
    const validImages = newRoomImages.filter(url => url.trim() !== "");

    setIsAddingRoom(true);
    try {
      if (editingRoomId) {
        await updateDoc(doc(db, "rooms", editingRoomId), {
          name: newRoomName,
          price: Number(newRoomPrice),
          description: newRoomDesc,
          imageUrl: validImages[0] || "", 
          imageUrls: validImages, 
          maxGuests: Number(newRoomMaxGuests) // ✨ SAVE GUESTS
        });
      } else {
        await addDoc(collection(db, "rooms"), {
          hotelOwnerId: userProfile.uid,
          hotelName: userProfile.hotelName,
          name: newRoomName,
          price: Number(newRoomPrice), 
          description: newRoomDesc,
          city: userProfile.city, 
          imageUrl: validImages[0] || "", 
          imageUrls: validImages, 
          maxGuests: Number(newRoomMaxGuests), // ✨ SAVE GUESTS
          createdAt: new Date()
        });
      }
      handleCancelEdit();
    } catch (error) {
      console.error("Error saving room:", error);
      alert("Failed to save room");
    } finally {
      setIsAddingRoom(false);
    }
  };

  // 4. DELETE A ROOM
  const handleDeleteRoom = async (roomId: string) => {
    if (confirm("Remove this room from your inventory?")) {
      if (editingRoomId === roomId) {
        handleCancelEdit();
      }
      await deleteDoc(doc(db, "rooms", roomId));
    }
  };

  // UPDATE BOOKING STATUS
  const handleUpdateBooking = async (bookingId: string, newStatus: "Approved" | "Declined") => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: newStatus
      });
    } catch (error) {
      console.error(`Error updating booking to ${newStatus}:`, error);
      alert("Failed to update status. Please try again.");
    }
  };

  // EXTENSION HANDLERS
  const handleApproveExtension = async (booking: Booking) => {
    if (!booking.extensionRequest) return;
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        checkOut: booking.extensionRequest.requestedCheckOut,
        totalPriceBase: booking.totalPriceBase + booking.extensionRequest.extraPriceBase,
        extensionRequest: deleteField() 
      });
    } catch (error) {
      console.error("Error approving extension:", error);
      alert("Failed to approve extension.");
    }
  };

  const handleDeclineExtension = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        "extensionRequest.status": "Declined"
      });
    } catch (error) {
      console.error("Error declining extension:", error);
    }
  };

  // SAVE UPI ID
  const handleSaveUpi = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    setIsSavingUpi(true);
    try {
      await updateDoc(doc(db, "users", userProfile.uid), {
        upiId: upiId.trim()
      });
      setUserProfile({ ...userProfile, upiId: upiId.trim() });
      alert("Payment Settings updated successfully! You can now receive direct UPI payments.");
    } catch (error) {
      console.error("Error saving UPI:", error);
      alert("Failed to save UPI settings.");
    } finally {
      setIsSavingUpi(false);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    router.push("/");
  };


  // --- RENDER STATES ---

  if (isCheckingAuth) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-slate-50 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-indigo-500/10 rounded-full blur-[80px] animate-pulse"></div>
        <Loader2 className="h-10 w-10 animate-spin text-indigo-600 mb-4 relative z-10" />
        <p className="text-slate-500 font-bold uppercase tracking-widest text-xs relative z-10 animate-pulse">Authenticating Partner...</p>
      </div>
    );
  }

  if (userProfile?.verificationStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 relative overflow-hidden font-sans">
        <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="bg-white p-10 md:p-12 rounded-[2.5rem] shadow-2xl max-w-lg w-full text-center border border-amber-100 relative z-10 animate-in zoom-in-95 duration-500">
          <div className="h-24 w-24 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-200 shadow-sm">
            <AlertTriangle className="h-12 w-12 text-amber-500" />
          </div>
          <h2 className="text-3xl font-black text-slate-900 mb-3 tracking-tight">Account Pending</h2>
          <div className="bg-slate-50 rounded-2xl p-5 mb-8 border border-slate-100 text-left">
            <p className="text-slate-600 font-medium mb-3 leading-relaxed text-sm">
              Your application for <strong className="text-slate-900">{userProfile.hotelName}</strong> is currently being reviewed by the WanderHub verification team.
            </p>
            <p className="text-slate-500 text-sm leading-relaxed">
              We are cross-referencing your Trade License and GSTIN to ensure the safety of our travelers. You will be granted dashboard access once approved.
            </p>
          </div>
          <button onClick={handleLogout} className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 px-6 py-4 rounded-xl font-bold transition-colors flex items-center justify-center">
            <LogOut className="h-4 w-4 mr-2" /> Secure Log Out
          </button>
        </div>
      </div>
    );
  }

  const pendingBookingsCount = bookings.filter(b => b.status === "Pending" || (b.extensionRequest && b.extensionRequest.status === "Pending")).length;

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col md:flex-row font-sans selection:bg-indigo-100">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-72 bg-[#0f172a] text-white shrink-0 flex flex-col relative overflow-hidden transition-all print:hidden">
        <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/10 rounded-full blur-[60px] pointer-events-none"></div>
        
        <div className="p-8 border-b border-white/10 relative z-10">
          <div className="h-14 w-14 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-2xl flex items-center justify-center mb-5 shadow-lg shadow-indigo-500/20 border border-white/10">
            <Building2 className="h-7 w-7 text-white" />
          </div>
          <h2 className="text-xl font-black truncate tracking-tight mb-1" title={userProfile?.hotelName}>{userProfile?.hotelName || "WanderHub Partner"}</h2>
          
          <div className="flex items-center gap-2 mt-3">
            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-widest flex items-center">
              <ShieldCheck className="h-3 w-3 mr-1" /> Verified Partner
            </span>
          </div>
        </div>

        <div className="p-6 flex-1 relative z-10 space-y-2">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-4 pl-2">Menu</p>
          
          <button 
            onClick={() => setActiveTab("inventory")}
            className={`w-full ${activeTab === "inventory" ? "bg-white/10 text-white shadow-inner border border-white/5" : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"} px-4 py-3.5 rounded-2xl font-bold flex items-center cursor-pointer backdrop-blur-sm transition-all`}
          >
            <BedDouble className={`h-5 w-5 mr-3 ${activeTab === "inventory" ? "text-indigo-400" : ""}`} /> Property Inventory
          </button>

          <button 
            onClick={() => setActiveTab("inbox")}
            className={`w-full ${activeTab === "inbox" ? "bg-white/10 text-white shadow-inner border border-white/5" : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"} px-4 py-3.5 rounded-2xl font-bold flex items-center justify-between cursor-pointer backdrop-blur-sm transition-all`}
          >
            <div className="flex items-center">
              <Inbox className={`h-5 w-5 mr-3 ${activeTab === "inbox" ? "text-indigo-400" : ""}`} /> Booking Inbox
            </div>
            {pendingBookingsCount > 0 && (
              <span className="bg-indigo-500 text-white text-xs font-black px-2 py-0.5 rounded-full">{pendingBookingsCount}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab("settings")}
            className={`w-full ${activeTab === "settings" ? "bg-white/10 text-white shadow-inner border border-white/5" : "text-slate-400 hover:text-white hover:bg-white/5 border border-transparent"} px-4 py-3.5 rounded-2xl font-bold flex items-center cursor-pointer backdrop-blur-sm transition-all`}
          >
            <Settings className={`h-5 w-5 mr-3 ${activeTab === "settings" ? "text-indigo-400" : ""}`} /> Payment Settings
          </button>

        </div>

        <div className="p-6 border-t border-white/10 relative z-10">
          <button onClick={handleLogout} className="flex items-center justify-center text-slate-400 hover:text-white hover:bg-white/5 font-bold transition-all w-full px-4 py-3.5 rounded-xl border border-transparent hover:border-white/10 group">
            <LogOut className="h-5 w-5 mr-3 group-hover:-translate-x-1 transition-transform" /> Secure Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 overflow-y-auto relative">
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-indigo-500/5 rounded-full blur-[100px] pointer-events-none"></div>

        <div className="p-6 md:p-10 lg:p-12 max-w-7xl mx-auto relative z-10">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
                {activeTab === "inventory" && "Manage Inventory"}
                {activeTab === "inbox" && "Booking Requests"}
                {activeTab === "settings" && "Payment Configuration"}
              </h1>
              <p className="text-slate-500 font-medium mt-2 text-lg">
                {activeTab === "inventory" && "Add and update rooms to push live to WanderHub."}
                {activeTab === "inbox" && "Review and approve incoming reservations."}
                {activeTab === "settings" && "Set up direct payment methods for your hotel."}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-indigo-50 border border-indigo-100 px-4 py-2.5 rounded-xl">
              <MapPin className="h-5 w-5 text-indigo-500" />
              <span className="text-sm font-bold text-indigo-900 capitalize">{userProfile?.city || "Location set"}</span>
            </div>
          </div>

          {activeTab === "inventory" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 md:gap-6 mb-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-12 w-12 bg-sky-50 rounded-2xl flex items-center justify-center text-sky-600 border border-sky-100"><BedDouble className="h-6 w-6" /></div>
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Rooms Listed</p>
                  <h3 className="text-3xl font-black text-slate-900 tracking-tighter">{rooms.length}</h3>
                </div>
                
                <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm flex flex-col justify-center transition-all hover:shadow-md">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100"><CheckCircle2 className="h-6 w-6" /></div>
                  </div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Listing Status</p>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight text-emerald-600">Active & Live</h3>
                </div>

                <div className="bg-gradient-to-br from-indigo-900 to-slate-900 p-6 rounded-[2rem] shadow-lg flex flex-col justify-center text-white relative overflow-hidden group">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/30 rounded-full blur-[40px] group-hover:bg-indigo-400/40 transition-colors"></div>
                  <div className="absolute inset-0 opacity-10 mix-blend-soft-light bg-slate-500/10 pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">WanderHub Platform Fee</p>
                    <h3 className="text-4xl font-black tracking-tighter">0%</h3>
                    <p className="text-xs font-medium text-indigo-300 mt-2">You keep 100% of booking revenue.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                {/* LEFT: ADD / EDIT ROOM FORM (Sticky) */}
                <div className="xl:col-span-1">
                  <div className={`bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/50 border transition-all sticky top-10 ${editingRoomId ? 'border-indigo-400 shadow-indigo-100 ring-4 ring-indigo-50' : 'border-slate-100'}`}>
                    <div className="flex items-center mb-8">
                      <div className={`h-12 w-12 rounded-2xl flex items-center justify-center mr-4 transition-colors ${editingRoomId ? 'bg-indigo-600 text-white' : 'bg-indigo-100 text-indigo-600'}`}>
                        {editingRoomId ? <Pencil className="h-5 w-5" /> : <Plus className="h-6 w-6" />}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-slate-900 tracking-tight">
                          {editingRoomId ? "Edit Room" : "Add Room"}
                        </h3>
                        <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-0.5">
                          {editingRoomId ? "Update Listing" : "Publish Inventory"}
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveRoom} className="space-y-5">
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Room Type / Name</label>
                        <div className="relative">
                          <Tags className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                          <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="e.g. Deluxe King Suite" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder-slate-400" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Price (INR)</label>
                          <div className="relative">
                            <IndianRupee className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                            <input type="number" value={newRoomPrice} onChange={(e) => setNewRoomPrice(e.target.value)} placeholder="2500" required className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-black text-slate-900 transition-all placeholder-slate-400" />
                          </div>
                        </div>

                        {/* ✨ NEW GUEST CAPACITY DROPDOWN */}
                        <div>
                          <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Max Guests</label>
                          <div className="relative">
                            <Users className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                            <select 
                              value={newRoomMaxGuests} 
                              onChange={(e) => setNewRoomMaxGuests(e.target.value)}
                              className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all cursor-pointer appearance-none"
                            >
                              <option value="1">1 Person</option>
                              <option value="2">2 People</option>
                              <option value="3">3 People</option>
                              <option value="4">4 People</option>
                              <option value="5">5+ People</option>
                            </select>
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Description</label>
                        <div className="relative">
                          <AlignLeft className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                          <textarea value={newRoomDesc} onChange={(e) => setNewRoomDesc(e.target.value)} placeholder="Sea view, complimentary breakfast, ultra-fast WiFi..." rows={3} className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-medium text-slate-700 transition-all placeholder-slate-400 resize-none" />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2 ml-1">Room Images (URLs)</label>
                        <div className="space-y-3">
                          {newRoomImages.map((imgUrl, index) => (
                            <div key={index} className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <ImageIcon className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                                <input 
                                  type="url" 
                                  value={imgUrl} 
                                  onChange={(e) => {
                                    const updatedImages = [...newRoomImages];
                                    updatedImages[index] = e.target.value;
                                    setNewRoomImages(updatedImages);
                                  }} 
                                  placeholder={index === 0 ? "Main Photo URL (Required)" : "Additional Photo URL"} 
                                  required={index === 0}
                                  className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-medium text-slate-700 transition-all placeholder-slate-400" 
                                />
                              </div>
                              {index > 0 && (
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    const updatedImages = newRoomImages.filter((_, i) => i !== index);
                                    setNewRoomImages(updatedImages);
                                  }}
                                  className="p-4 bg-red-50 text-red-500 hover:bg-red-500 hover:text-white border border-red-100 rounded-2xl transition-colors"
                                >
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <button 
                          type="button" 
                          onClick={() => setNewRoomImages([...newRoomImages, ""])}
                          className="mt-3 text-xs font-bold text-indigo-600 hover:text-indigo-800 flex items-center ml-1 transition-colors"
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Another Photo
                        </button>
                      </div>
                      
                      <div className="flex gap-3 mt-4">
                        {editingRoomId && (
                          <button 
                            type="button" 
                            onClick={handleCancelEdit} 
                            className="w-1/3 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 font-black py-4 md:py-5 rounded-2xl transition-all flex items-center justify-center text-sm"
                          >
                            Cancel
                          </button>
                        )}
                        <button 
                          type="submit" 
                          disabled={isAddingRoom} 
                          className={`${editingRoomId ? 'w-2/3' : 'w-full'} bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-black py-4 md:py-5 rounded-2xl shadow-xl shadow-indigo-600/20 hover:shadow-indigo-600/40 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:hover:translate-y-0 flex items-center justify-center text-lg group`}
                        >
                          {isAddingRoom ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                            <>
                              {editingRoomId ? <Check className="h-5 w-5 mr-2" /> : <Plus className="h-5 w-5 mr-2" />}
                              {editingRoomId ? "Save Changes" : "Publish Live"}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                {/* RIGHT: LIVE INVENTORY LIST */}
                <div className="xl:col-span-2">
                  <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-200 min-h-[500px]">
                    <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
                      <h3 className="text-2xl font-black text-slate-900 tracking-tight">Active Rooms</h3>
                      <span className="text-xs font-black tracking-widest uppercase bg-slate-100 text-slate-500 px-4 py-2 rounded-xl">{rooms.length} Listed</span>
                    </div>
                    
                    {rooms.length === 0 ? (
                      <div className="text-center py-20 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                        <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm border border-slate-100">
                          <BedDouble className="h-10 w-10 text-slate-300" />
                        </div>
                        <h4 className="text-xl font-bold text-slate-900 tracking-tight mb-2">No inventory listed</h4>
                        <p className="text-slate-500 font-medium">Add your first room using the form to start receiving bookings.</p>
                      </div>
                    ) : (
                      <div className="space-y-5 animate-in fade-in duration-500">
                        {rooms.map(room => (
                          <div key={room.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 sm:p-5 bg-white rounded-3xl border shadow-sm transition-all group overflow-hidden relative ${editingRoomId === room.id ? 'border-indigo-400 ring-2 ring-indigo-50 shadow-indigo-100/50' : 'border-slate-200 hover:shadow-xl hover:border-indigo-300'}`}>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-5 mb-5 sm:mb-0">
                              <div className="h-32 sm:h-20 w-full sm:w-24 bg-slate-100 rounded-2xl shrink-0 overflow-hidden relative border border-slate-200">
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img 
                                  src={(room.imageUrls && room.imageUrls.length > 0) ? room.imageUrls[0] : (room.imageUrl || "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=800&q=80")} 
                                  alt={room.name} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                                />
                                {room.imageUrls && room.imageUrls.length > 1 && (
                                  <div className="absolute bottom-1 right-1 bg-black/70 backdrop-blur-md text-white text-[10px] font-black px-2 py-1 rounded-lg">
                                    +{room.imageUrls.length - 1}
                                  </div>
                                )}
                              </div>
                              
                              <div>
                                <h4 className="font-black text-slate-900 text-lg md:text-xl tracking-tight mb-1">{room.name}</h4>
                                <div className="flex items-center gap-2 mb-1 text-sm text-slate-500 font-bold">
                                  <Users className="h-4 w-4 text-indigo-500" /> {room.maxGuests || 2} Guests
                                </div>
                                <p className="text-sm font-medium text-slate-500 max-w-md line-clamp-2 leading-relaxed">{room.description || "No description provided."}</p>
                              </div>
                            </div>
                            
                            {/* Price & Actions */}
                            <div className="flex items-center justify-between sm:justify-end sm:gap-6 shrink-0 border-t border-slate-100 pt-4 sm:border-0 sm:pt-0 pl-0 sm:pl-4">
                              <div className="text-right">
                                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Price</p>
                                <div className="font-black text-slate-900 text-2xl flex items-center tracking-tighter">
                                  {symbol}{convert(room.price).toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-2">
                                <button onClick={() => handleEditClick(room)} className={`p-3.5 border rounded-xl transition-all shadow-sm ${editingRoomId === room.id ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-slate-50 text-slate-500 border-slate-100 hover:text-indigo-600 hover:bg-indigo-50 hover:border-indigo-200'}`} title="Edit Room">
                                  <Pencil className="h-5 w-5" />
                                </button>
                                <button onClick={() => handleDeleteRoom(room.id)} className="p-3.5 bg-slate-50 border border-slate-100 text-slate-400 hover:text-white hover:bg-red-500 hover:border-red-600 rounded-xl transition-all shadow-sm group-hover:shadow-md" title="Delete Room">
                                  <Trash2 className="h-5 w-5" />
                                </button>
                              </div>
                            </div>

                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === "inbox" ? (
            // --- INBOX TAB CONTENT ---
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-200 min-h-[500px]">
                <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-6">
                  <h3 className="text-2xl font-black text-slate-900 tracking-tight">Reservation Requests</h3>
                  <span className="text-xs font-black tracking-widest uppercase bg-indigo-50 text-indigo-600 px-4 py-2 rounded-xl">{pendingBookingsCount} Pending</span>
                </div>

                {bookings.length === 0 ? (
                  <div className="text-center py-20 bg-slate-50 rounded-[2rem] border border-dashed border-slate-200">
                    <div className="h-20 w-20 bg-white rounded-full flex items-center justify-center mx-auto mb-5 shadow-sm border border-slate-100">
                      <Inbox className="h-10 w-10 text-slate-300" />
                    </div>
                    <h4 className="text-xl font-bold text-slate-900 tracking-tight mb-2">Inbox Empty</h4>
                    <p className="text-slate-500 font-medium">No booking requests have been received yet.</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {bookings.map(booking => {
                      
                      const isPending = booking.status === "Pending";
                      const isApproved = booking.status === "Approved" || booking.status === "Confirmed"; 
                      const isDeclined = booking.status === "Declined";

                      const today = new Date(); today.setHours(0,0,0,0);
                      const checkInDate = new Date(booking.checkIn); checkInDate.setHours(0,0,0,0);
                      const checkOutDate = new Date(booking.checkOut); checkOutDate.setHours(0,0,0,0);
                      
                      let liveStatus = "";
                      let liveColor = "";
                      
                      if (isApproved) {
                        if (today < checkInDate) { liveStatus = "Upcoming Arrival"; liveColor = "text-sky-600 bg-sky-50 border-sky-200"; }
                        else if (today >= checkInDate && today < checkOutDate) { liveStatus = "Currently Occupied"; liveColor = "text-emerald-600 bg-emerald-50 border-emerald-200"; }
                        else if (today >= checkOutDate) { liveStatus = "Checked-Out"; liveColor = "text-slate-500 bg-slate-100 border-slate-200"; }
                      }

                      return (
                        <div key={booking.id} className={`bg-white rounded-3xl border ${isPending ? 'border-amber-200 shadow-amber-500/10 shadow-md' : 'border-slate-200 shadow-sm'} overflow-hidden flex flex-col transition-all group relative`}>
                          <div className={`px-6 py-4 flex justify-between items-center ${isPending ? 'bg-amber-50' : 'bg-slate-50'} border-b border-slate-100`}>
                            <div className="flex items-center gap-3">
                              <div className="h-10 w-10 bg-white rounded-xl flex items-center justify-center text-slate-400 font-black shadow-sm border border-slate-100">
                                {booking.customerName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className="font-black text-slate-900 tracking-tight">{booking.customerName}</h4>
                                <p className="text-xs font-bold text-slate-500">{booking.customerEmail}</p>
                              </div>
                            </div>
                            
                            <div className="text-right flex flex-col items-end gap-2">
                              {isPending && <span className="inline-flex items-center text-amber-600 bg-amber-100 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest"><Clock className="h-3 w-3 mr-1.5"/> Pending</span>}
                              
                              {isApproved && <span className="inline-flex items-center text-emerald-600 bg-emerald-100 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest"><CheckCircle2 className="h-3 w-3 mr-1.5"/> {booking.status === "Confirmed" ? "Confirmed" : "Approved"}</span>}
                              
                              {isDeclined && <span className="inline-flex items-center text-red-600 bg-red-100 px-3 py-1 rounded-lg text-xs font-black uppercase tracking-widest"><XCircle className="h-3 w-3 mr-1.5"/> Declined</span>}
                              
                              {isApproved && liveStatus && (
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-widest border ${liveColor}`}>
                                  {liveStatus}
                                </span>
                              )}
                            </div>
                          </div>

                          {booking.transactionId && booking.transactionId !== "Pending" && booking.transactionId !== "Pay at Hotel" && (
                            <div className="bg-slate-50 border-b border-slate-100 p-4 px-6 flex items-center gap-3">
                              <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${booking.transactionId.startsWith('pay_') ? 'bg-indigo-100 text-indigo-600' : 'bg-emerald-100 text-emerald-600'}`}>
                                {booking.transactionId.startsWith('pay_') ? <ShieldCheck className="h-4 w-4" /> : <Smartphone className="h-4 w-4" />}
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">
                                  {booking.transactionId.startsWith('pay_') ? 'Razorpay Secured' : 'UPI Payment Received'}
                                </p>
                                <p className="text-sm font-bold text-slate-900 flex items-center">
                                  Ref: <span className={`font-mono ml-1 px-1.5 py-0.5 rounded border tracking-wider ${booking.transactionId.startsWith('pay_') ? 'text-indigo-600 bg-indigo-50 border-indigo-100' : 'text-emerald-600 bg-emerald-50 border-emerald-100'}`}>
                                    {booking.transactionId}
                                  </span>
                                </p>
                              </div>
                            </div>
                          )}

                          {booking.transactionId === "Pay at Hotel" && (
                            <div className="bg-slate-50 border-b border-slate-100 p-4 px-6 flex items-center gap-3">
                              <div className="h-8 w-8 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center shrink-0"><Clock className="h-4 w-4" /></div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-0.5">Payment Method</p>
                                <p className="text-sm font-bold text-slate-900">Pay at Hotel</p>
                              </div>
                            </div>
                          )}

                          {booking.extensionRequest && booking.extensionRequest.status === "Pending" && (
                            <div className="bg-indigo-50 border-b border-indigo-100 p-4 px-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                              <div className="flex items-center gap-3">
                                <div className="h-8 w-8 bg-indigo-500/20 text-indigo-600 rounded-full flex items-center justify-center shrink-0"><ArrowRightCircle className="h-4 w-4" /></div>
                                <div>
                                  <p className="text-sm font-bold text-indigo-900">Extension Request: Stay until {new Date(booking.extensionRequest.requestedCheckOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</p>
                                  <p className="text-xs font-medium text-indigo-600">Additional Revenue: {symbol}{convert(booking.extensionRequest.extraPriceBase).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                                </div>
                              </div>
                              <div className="flex gap-2 w-full sm:w-auto">
                                <button onClick={() => handleDeclineExtension(booking.id)} className="flex-1 sm:flex-none px-4 py-2 bg-white text-red-600 border border-red-200 hover:bg-red-50 rounded-lg text-xs font-black transition-colors">Decline</button>
                                <button onClick={() => handleApproveExtension(booking)} className="flex-1 sm:flex-none px-4 py-2 bg-indigo-600 text-white hover:bg-indigo-500 rounded-lg text-xs font-black transition-colors shadow-sm">Approve Extension</button>
                              </div>
                            </div>
                          )}

                          <div className="p-6 flex flex-col md:flex-row justify-between gap-6 items-center">
                            <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-6">
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Room Type</p>
                                <p className="font-bold text-slate-900">{booking.roomName}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Dates</p>
                                <p className="font-bold text-slate-900">{new Date(booking.checkIn).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} - {new Date(booking.checkOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Guests</p>
                                <p className="font-bold text-slate-900 flex items-center"><Users className="h-4 w-4 mr-1.5 text-slate-400"/> {booking.guests}</p>
                              </div>
                              <div>
                                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-1">Est. Revenue</p>
                                <p className="font-black text-xl text-slate-900 tracking-tighter text-emerald-600">
                                  {symbol}{convert(booking.totalPriceBase).toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </p>
                              </div>
                            </div>
                            
                            {isPending && (
                              <div className="flex w-full md:w-auto gap-3 shrink-0">
                                <button onClick={() => handleUpdateBooking(booking.id, "Declined")} className="flex-1 md:flex-none px-6 py-3 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-black rounded-xl transition-colors border border-red-100 hover:border-red-500">Decline</button>
                                <button onClick={() => handleUpdateBooking(booking.id, "Approved")} className="flex-1 md:flex-none px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-black rounded-xl transition-all shadow-lg hover:shadow-emerald-500/30 hover:-translate-y-0.5 flex items-center justify-center">
                                  <Check className="h-5 w-5 mr-2"/> Approve
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : activeTab === "settings" ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-2xl mx-auto mt-4">
              <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-200">
                <div className="flex items-center mb-8">
                  <div className="h-14 w-14 bg-indigo-100 rounded-2xl flex items-center justify-center mr-5">
                    <Wallet className="h-7 w-7 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black text-slate-900 tracking-tight">Direct Payments</h3>
                    <p className="text-sm font-medium text-slate-500 mt-1">Configure your UPI ID to receive zero-fee transfers.</p>
                  </div>
                </div>

                <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5 mb-8">
                  <h4 className="text-sm font-bold text-emerald-900 mb-1 flex items-center">
                    <ShieldCheck className="h-4 w-4 mr-1.5 text-emerald-600" /> Zero Transaction Fees
                  </h4>
                  <p className="text-xs font-medium text-emerald-700 leading-relaxed">
                    By saving your Business UPI ID here, WanderHub will automatically generate deep-links for your customers. Payments will go directly to your bank account with 0% commission.
                  </p>
                </div>

                <form onSubmit={handleSaveUpi} className="space-y-6">
                  <div>
                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Your Business UPI ID</label>
                    <input 
                      type="text" 
                      value={upiId} 
                      onChange={(e) => setUpiId(e.target.value.toLowerCase())} 
                      placeholder="e.g., hotelname@okaxis" 
                      required 
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 outline-none font-bold text-slate-900 transition-all placeholder-slate-400 text-lg" 
                    />
                    <p className="text-[10px] font-medium text-slate-500 mt-2 ml-2">Make sure this is linked to your business account.</p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSavingUpi} 
                    className="w-full bg-slate-900 text-white font-black py-4 rounded-2xl shadow-xl hover:shadow-slate-900/30 hover:bg-slate-800 transition-all disabled:opacity-50 flex justify-center items-center"
                  >
                    {isSavingUpi ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Payment Settings"}
                  </button>
                </form>
              </div>
            </div>
          ) : null}

        </div>
      </main>
    </div>
  );
}