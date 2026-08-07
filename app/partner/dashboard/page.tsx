"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, addDoc, query, where, onSnapshot, deleteDoc, updateDoc, deleteField, serverTimestamp, orderBy } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; 
import { useCurrency } from "../../lib/useCurrency"; 
import { Building2, Plus, BedDouble, Trash2, IndianRupee, Loader2, AlertTriangle, LogOut, Image as ImageIcon, CheckCircle2, TrendingUp, ShieldCheck, MapPin, AlignLeft, Tags, Inbox, Check, XCircle, Clock, Users, ArrowRightCircle, Settings, Wallet, Smartphone, Pencil, ChevronDown, CalendarDays, History, BellRing, UserCheck, ClipboardList, MessageSquare, Send } from "lucide-react";
import { signOut } from "firebase/auth";

interface Room {
  id: string;
  name: string;
  price: number;
  description: string;
  imageUrl?: string;
  imageUrls?: string[];
  maxGuests?: number;
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
  arrivalTime?: string;   
  departureTime?: string; 
  guests: number;
  totalPriceBase: number;
  status: "Pending" | "Approved" | "Confirmed" | "Declined" | "Cancelled"; 
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
  
  // 🛡️ SECURITY GUARD STATE
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  
  const [activeTab, setActiveTab] = useState("inventory"); 

  const [rooms, setRooms] = useState<Room[]>([]);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  const [editingRoomId, setEditingRoomId] = useState<string | null>(null);
  
  const [bookings, setBookings] = useState<Booking[]>([]);
  
  const [roomSubTabs, setRoomSubTabs] = useState<Record<string, "upcoming" | "history">>({});
  const [roomRequestSubTabs, setRoomRequestSubTabs] = useState<Record<string, "current-details" | "extend-current" | "extend-upcoming">>({});

  const [selectedChatBooking, setSelectedChatBooking] = useState<Booking | null>(null);
  const [chatMessages, setChatMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState("");

  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPrice, setNewRoomPrice] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");
  const [newRoomImages, setNewRoomImages] = useState<string[]>([""]);
  const [newRoomMaxGuests, setNewRoomMaxGuests] = useState("2"); 

  const [hotelPhone, setHotelPhone] = useState("");
  const [hotelEmail, setHotelEmail] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // ✨ UPI VERIFICATION ENGINE STATES
  const [upiId, setUpiId] = useState(""); 
  const [upiInput, setUpiInput] = useState("");
  const [isVerifyingUpi, setIsVerifyingUpi] = useState(false);
  const [verifiedUpiName, setVerifiedUpiName] = useState<string | null>(null);
  const [upiError, setUpiError] = useState("");

  const { symbol, convert } = useCurrency();

  // 🛡️ SECURITY GUARD: Check if logged in & verify partner role
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (!currentUser) {
        router.push("/"); // Kick to landing page if not logged in
      } else {
        try {
          const docRef = doc(db, "users", currentUser.uid);
          const docSnap = await getDoc(docRef);

          if (docSnap.exists()) {
            const profile = docSnap.data();
            
            // Strictly block non-partners
            if (profile.role !== "hotel_partner") {
              router.push("/"); 
              return;
            }
            
            setUserProfile(profile);
            if (profile.hotelPhone) setHotelPhone(profile.hotelPhone);
            if (profile.hotelEmail) setHotelEmail(profile.hotelEmail);
            
            // Auto-verify if they already have a saved UPI ID in the DB
            if (profile.upiId) {
              setUpiId(profile.upiId);
              setUpiInput(profile.upiId);
              setVerifiedUpiName(profile.hotelName || "Verified Partner Account");
            }
            
            setIsAuthLoading(false); // Show the page
          } else {
            router.push("/");
          }
        } catch (error) {
          console.error("Auth check error:", error);
          router.push("/");
        }
      }
    });

    return () => unsubscribe();
  }, [router]);

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

  useEffect(() => {
    if (!selectedChatBooking || !userProfile) return;
    
    const combinedChatId = `${selectedChatBooking.customerId}_${userProfile.uid}`;
    
    const qMessages = query(
      collection(db, "hotelChats"),
      where("chatId", "==", combinedChatId),
      orderBy("timestamp", "asc")
    );
    
    const unsubscribeMessages = onSnapshot(qMessages, (snapshot) => {
      setChatMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    
    return () => unsubscribeMessages();
  }, [selectedChatBooking, userProfile]);

  // ✨ VPA NETWORK VERIFICATION CALL
  const verifyUpiId = async () => {
    setUpiError("");
    setVerifiedUpiName(null);

    if (!upiInput.includes("@")) {
      setUpiError("Please enter a valid UPI ID format (e.g., hotel@okaxis)");
      return;
    }

    setIsVerifyingUpi(true);

    try {
      const res = await fetch("/api/verify-upi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ upiId: upiInput }),
      });

      const data = await res.json();

      if (!res.ok || !data.isValid) {
        throw new Error(data.message || "Failed to verify UPI ID");
      }

      // Success! Lock the VPA and show the bank account name
      setVerifiedUpiName(data.registeredName);
      setUpiId(upiInput); 
    } catch (err: any) {
      setUpiError(err.message);
    } finally {
      setIsVerifyingUpi(false);
    }
  };

  const handleEditClick = (room: Room) => {
    setEditingRoomId(room.id);
    setNewRoomName(room.name);
    setNewRoomPrice(room.price.toString());
    setNewRoomDesc(room.description || "");
    setNewRoomImages(room.imageUrls && room.imageUrls.length > 0 ? room.imageUrls : (room.imageUrl ? [room.imageUrl] : [""]));
    setNewRoomMaxGuests(room.maxGuests?.toString() || "2"); 
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCancelEdit = () => {
    setEditingRoomId(null);
    setNewRoomName("");
    setNewRoomPrice("");
    setNewRoomDesc("");
    setNewRoomImages([""]);
    setNewRoomMaxGuests("2"); 
  };

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
          maxGuests: Number(newRoomMaxGuests) 
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
          maxGuests: Number(newRoomMaxGuests), 
          createdAt: new Date()
        });
      }
      handleCancelEdit();
    } catch (error) {
      console.error(error);
      alert("Failed to save room");
    } finally {
      setIsAddingRoom(false);
    }
  };

  const handleDeleteRoom = async (roomId: string) => {
    if (confirm("Remove this room from your inventory?")) {
      if (editingRoomId === roomId) {
        handleCancelEdit();
      }
      await deleteDoc(doc(db, "rooms", roomId));
    }
  };

  const handleUpdateBooking = async (bookingId: string, newStatus: "Approved" | "Declined") => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        status: newStatus
      });
    } catch (error) {
      console.error(error);
      alert("Failed to update status. Please try again.");
    }
  };

  const handleCancelConfirmedBooking = async (bookingId: string) => {
    if (confirm("WARNING: Are you sure you want to cancel this confirmed reservation? \n\nNote: If this is done unfairly or without valid reason, the customer can report your property to AERO Trust & Safety.")) {
      try {
        await updateDoc(doc(db, "bookings", bookingId), {
          status: "Cancelled",
          cancelledAt: serverTimestamp(),
          cancelledBy: "Partner_Admin"
        });
      } catch (error) {
        console.error(error);
        alert("Failed to cancel booking. Please try again.");
      }
    }
  };

  const handleApproveExtension = async (booking: Booking) => {
    if (!booking.extensionRequest) return;
    try {
      await updateDoc(doc(db, "bookings", booking.id), {
        checkOut: booking.extensionRequest.requestedCheckOut,
        totalPriceBase: booking.totalPriceBase + booking.extensionRequest.extraPriceBase,
        extensionRequest: deleteField() 
      });
    } catch (error) {
      console.error(error);
      alert("Failed to approve extension.");
    }
  };

  const handleDeclineExtension = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, "bookings", bookingId), {
        "extensionRequest.status": "Declined"
      });
    } catch (error) {
      console.error(error);
    }
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userProfile) return;
    
    // Final check before sending to DB
    if (!verifiedUpiName) {
      setUpiError("You must verify the UPI ID before saving settings.");
      return;
    }

    setIsSavingSettings(true);
    try {
      await updateDoc(doc(db, "users", userProfile.uid), {
        upiId: upiId.trim(),
        hotelPhone: hotelPhone.trim(),
        hotelEmail: hotelEmail.trim()
      });
      setUserProfile({ 
        ...userProfile, 
        upiId: upiId.trim(), 
        hotelPhone: hotelPhone.trim(), 
        hotelEmail: hotelEmail.trim() 
      });
      alert("Hotel Contact and Payment Settings updated successfully!");
    } catch (error) {
      console.error(error);
      alert("Failed to save settings.");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !selectedChatBooking || !userProfile) return;
    
    const combinedChatId = `${selectedChatBooking.customerId}_${userProfile.uid}`;
    
    try {
      await addDoc(collection(db, "hotelChats"), {
        chatId: combinedChatId,
        hotelId: userProfile.uid,
        hotelName: userProfile.hotelName || "Hotel Support",
        customerId: selectedChatBooking.customerId,
        customerName: selectedChatBooking.customerName,
        senderId: userProfile.uid,
        text: newMessage.trim(),
        timestamp: serverTimestamp()
      });
      setNewMessage("");
    } catch (error) {
      console.error(error);
    }
  };

  const handleLogout = () => {
    signOut(auth);
    router.push("/");
  };

  const formatTime = (timeString?: string) => {
    if (!timeString) return "14:00 (EST)";
    const [hour, minute] = timeString.split(":");
    const h = parseInt(hour, 10);
    const ampm = h >= 12 ? 'PM' : 'AM';
    const formattedHour = h % 12 || 12;
    return `${formattedHour}:${minute} ${ampm}`;
  };

  const toggleRoomSubTab = (roomId: string, tab: "upcoming" | "history") => {
    setRoomSubTabs(prev => ({ ...prev, [roomId]: tab }));
  };

  const toggleRoomRequestSubTab = (roomId: string, tab: "current-details" | "extend-current" | "extend-upcoming") => {
    setRoomRequestSubTabs(prev => ({ ...prev, [roomId]: tab }));
  };

  // 🛡️ LOADING SCREEN: Hide page until verified
  if (isAuthLoading) {
    return (
      <div className="h-screen flex flex-col items-center justify-center bg-zinc-950 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] animate-pulse"></div>
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500 mb-4 relative z-10" />
        <p className="text-emerald-500/80 font-bold uppercase tracking-widest text-[10px] relative z-10 animate-pulse">Authenticating Partner...</p>
      </div>
    );
  }

  if (userProfile?.verificationStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4 relative overflow-hidden font-sans selection:bg-amber-500/30">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay pointer-events-none"></div>
        <div className="absolute top-[20%] left-[-10%] w-[500px] h-[500px] bg-amber-500/10 rounded-full blur-[120px] pointer-events-none"></div>
        
        <div className="bg-white/5 backdrop-blur-xl p-10 md:p-12 rounded-[2.5rem] shadow-2xl max-w-lg w-full text-center border border-white/10 relative z-10 animate-in zoom-in-95 duration-500">
          <div className="h-24 w-24 bg-amber-500/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-amber-500/20 shadow-sm">
            <AlertTriangle className="h-10 w-10 text-amber-500" />
          </div>
          <h2 className="text-3xl font-black text-white mb-3 tracking-tighter">Account Pending</h2>
          <div className="bg-zinc-900/50 rounded-2xl p-6 mb-8 border border-zinc-800 text-left">
            <p className="text-zinc-300 font-medium mb-4 leading-relaxed text-sm">
              Your application for <strong className="text-white">{userProfile.hotelName}</strong> is currently being reviewed by the AERO verification team.
            </p>
            <p className="text-zinc-500 text-xs font-medium leading-relaxed">
              We are cross-referencing your Trade License and GSTIN to ensure the safety of our travelers. You will be granted dashboard access once approved.
            </p>
          </div>
          <button onClick={handleLogout} className="w-full bg-zinc-900 text-white hover:bg-zinc-800 px-6 py-4 rounded-full font-bold text-xs uppercase tracking-widest transition-colors flex items-center justify-center border border-zinc-800 shadow-sm active:scale-95">
            <LogOut className="h-4 w-4 mr-2" /> Secure Log Out
          </button>
        </div>
      </div>
    );
  }

  const pendingBookingsCount = bookings.filter(b => b.status === "Pending" || (b.extensionRequest && b.extensionRequest.status === "Pending")).length;
  const extendRequestsCount = bookings.filter(b => b.extensionRequest && b.extensionRequest.status === "Pending").length;

  return (
    <div className="min-h-screen bg-zinc-950 flex flex-col md:flex-row font-sans selection:bg-emerald-500/30 text-white">
      
      <aside className="w-full md:w-72 bg-zinc-950/80 backdrop-blur-xl text-white shrink-0 flex flex-col relative overflow-hidden transition-all border-r border-zinc-800 print:hidden z-20">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.1] mix-blend-overlay pointer-events-none"></div>
        <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none"></div>
        
        <div className="p-8 border-b border-zinc-800 relative z-10">
          <div className="h-14 w-14 bg-zinc-900 rounded-[1.25rem] flex items-center justify-center mb-5 shadow-inner border border-zinc-800">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-xl font-black truncate tracking-tighter mb-1" title={userProfile?.hotelName}>{userProfile?.hotelName || "AERO Partner"}</h2>
          
          <div className="flex items-center gap-2 mt-3">
            <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center">
              <ShieldCheck className="h-3 w-3 mr-1.5" /> Verified B2B Partner
            </span>
          </div>
        </div>

        <div className="p-6 flex-1 relative z-10 space-y-2">
          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 pl-3">Workspace</p>
          
          <button 
            onClick={() => setActiveTab("inventory")}
            className={`w-full ${activeTab === "inventory" ? "bg-white text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"} px-5 py-4 rounded-2xl font-bold flex items-center cursor-pointer transition-all text-sm`}
          >
            <BedDouble className={`h-4 w-4 mr-3 ${activeTab === "inventory" ? "text-emerald-600" : ""}`} /> Property Inventory
          </button>

          <button 
            onClick={() => setActiveTab("inbox")}
            className={`w-full ${activeTab === "inbox" ? "bg-white text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"} px-5 py-4 rounded-2xl font-bold flex items-center justify-between cursor-pointer transition-all text-sm`}
          >
            <div className="flex items-center">
              <Inbox className={`h-4 w-4 mr-3 ${activeTab === "inbox" ? "text-emerald-600" : ""}`} /> Global Inbox
            </div>
            {pendingBookingsCount > 0 && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${activeTab === "inbox" ? "bg-emerald-100 text-emerald-700" : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"}`}>{pendingBookingsCount}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab("requests")}
            className={`w-full ${activeTab === "requests" ? "bg-white text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"} px-5 py-4 rounded-2xl font-bold flex items-center justify-between cursor-pointer transition-all text-sm`}
          >
            <div className="flex items-center">
              <BellRing className={`h-4 w-4 mr-3 ${activeTab === "requests" ? "text-emerald-600" : ""}`} /> Live Ops & Requests
            </div>
            {extendRequestsCount > 0 && (
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-full ${activeTab === "requests" ? "bg-emerald-100 text-emerald-700" : "bg-amber-500/20 text-amber-500 border border-amber-500/30"}`}>{extendRequestsCount}</span>
            )}
          </button>

          <button 
            onClick={() => setActiveTab("status")}
            className={`w-full ${activeTab === "status" ? "bg-white text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"} px-5 py-4 rounded-2xl font-bold flex items-center cursor-pointer transition-all text-sm`}
          >
            <CalendarDays className={`h-4 w-4 mr-3 ${activeTab === "status" ? "text-emerald-600" : ""}`} /> Room Status
          </button>

          <button 
            onClick={() => { setActiveTab("messages"); setSelectedChatBooking(null); }}
            className={`w-full ${activeTab === "messages" ? "bg-white text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"} px-5 py-4 rounded-2xl font-bold flex items-center cursor-pointer transition-all text-sm`}
          >
            <MessageSquare className={`h-4 w-4 mr-3 ${activeTab === "messages" ? "text-emerald-600" : ""}`} /> Guest Messages
          </button>

          <button 
            onClick={() => setActiveTab("settings")}
            className={`w-full ${activeTab === "settings" ? "bg-white text-zinc-950 shadow-md" : "text-zinc-400 hover:text-white hover:bg-zinc-900 border border-transparent"} px-5 py-4 rounded-2xl font-bold flex items-center cursor-pointer transition-all text-sm`}
          >
            <Settings className={`h-4 w-4 mr-3 ${activeTab === "settings" ? "text-emerald-600" : ""}`} /> Config & Settings
          </button>

        </div>

        <div className="p-6 border-t border-zinc-800 relative z-10">
          <button onClick={handleLogout} className="flex items-center justify-center text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold text-xs uppercase tracking-widest transition-all w-full px-4 py-4 rounded-2xl border border-transparent hover:border-zinc-700 group active:scale-95">
            <LogOut className="h-4 w-4 mr-3 group-hover:-translate-x-1 transition-transform" /> Secure Sign Out
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-y-auto relative custom-scrollbar">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] mix-blend-overlay pointer-events-none z-0"></div>
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none z-0"></div>

        <div className="p-6 md:p-10 lg:p-14 max-w-7xl mx-auto relative z-10">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12 border-b border-zinc-800 pb-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-black text-white tracking-tighter">
                {activeTab === "inventory" && "Manage Inventory"}
                {activeTab === "inbox" && "Global Inbox"}
                {activeTab === "requests" && "Live Ops & Requests"}
                {activeTab === "status" && "Room Status"}
                {activeTab === "messages" && "Guest Messages"}
                {activeTab === "settings" && "Config & Settings"}
              </h1>
              <p className="text-zinc-400 font-medium mt-2 text-base md:text-lg">
                {activeTab === "inventory" && "Add and update rooms to push live to AERO."}
                {activeTab === "inbox" && "Review all incoming reservations and requests globally."}
                {activeTab === "requests" && "Manage active stays and handle extension requests by room."}
                {activeTab === "status" && "Monitor live room availability, upcoming stays, and past records."}
                {activeTab === "messages" && "Communicate directly with any guest regarding their booking."}
                {activeTab === "settings" && "Set up direct payment methods and support contact details."}
              </p>
            </div>
            <div className="flex items-center gap-2 bg-zinc-900 border border-zinc-800 px-5 py-3 rounded-full shadow-inner">
              <MapPin className="h-4 w-4 text-zinc-500" />
              <span className="text-xs font-bold text-white uppercase tracking-widest">{userProfile?.city || "Location set"}</span>
            </div>
          </div>

          {activeTab === "inventory" ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
                <div className="bg-zinc-900/50 backdrop-blur-xl p-8 rounded-[2rem] border border-zinc-800 shadow-sm flex flex-col justify-center transition-all hover:border-zinc-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-12 w-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 border border-zinc-700"><BedDouble className="h-5 w-5" /></div>
                    <TrendingUp className="h-5 w-5 text-emerald-500" />
                  </div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Total Rooms Listed</p>
                  <h3 className="text-4xl font-black text-white tracking-tighter">{rooms.length}</h3>
                </div>
                
                <div className="bg-zinc-900/50 backdrop-blur-xl p-8 rounded-[2rem] border border-zinc-800 shadow-sm flex flex-col justify-center transition-all hover:border-zinc-700">
                  <div className="flex items-center justify-between mb-4">
                    <div className="h-12 w-12 bg-emerald-500/10 rounded-full flex items-center justify-center text-emerald-500 border border-emerald-500/20"><CheckCircle2 className="h-5 w-5" /></div>
                  </div>
                  <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Listing Status</p>
                  <h3 className="text-3xl font-black tracking-tight text-emerald-400">Active & Live</h3>
                </div>

                <div className="bg-zinc-950 p-8 rounded-[2rem] shadow-2xl flex flex-col justify-center relative overflow-hidden group border border-zinc-800">
                  <div className="absolute top-0 right-0 w-40 h-40 bg-emerald-500/10 rounded-full blur-[40px] pointer-events-none"></div>
                  <div className="relative z-10">
                    <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1">AERO Platform Fee</p>
                    <h3 className="text-5xl font-black tracking-tighter text-white">0%</h3>
                    <p className="text-xs font-bold text-emerald-500 mt-2 uppercase tracking-widest">You keep 100% of revenue.</p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 xl:grid-cols-12 gap-10 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                
                <div className="xl:col-span-4">
                  <div className={`bg-zinc-900/40 backdrop-blur-xl p-8 md:p-10 rounded-[2.5rem] shadow-2xl border transition-all sticky top-10 ${editingRoomId ? 'border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.15)]' : 'border-zinc-800'}`}>
                    <div className="flex items-center mb-8 pb-6 border-b border-zinc-800">
                      <div className={`h-12 w-12 rounded-full flex items-center justify-center mr-4 shadow-sm border ${editingRoomId ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' : 'bg-zinc-800 text-white border-zinc-700'}`}>
                        {editingRoomId ? <Pencil className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                      </div>
                      <div>
                        <h3 className="text-xl font-black text-white tracking-tight">
                          {editingRoomId ? "Edit Room" : "Add Room"}
                        </h3>
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mt-1">
                          {editingRoomId ? "Update Listing" : "Publish Inventory"}
                        </p>
                      </div>
                    </div>

                    <form onSubmit={handleSaveRoom} className="space-y-6">
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Room Type / Name</label>
                        <div className="relative">
                          <Tags className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                          <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="Deluxe King Suite" required className="w-full pl-12 pr-5 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-bold text-white transition-all placeholder-zinc-600 shadow-inner" />
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Price (INR)</label>
                          <div className="relative">
                            <IndianRupee className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <input type="number" value={newRoomPrice} onChange={(e) => setNewRoomPrice(e.target.value)} placeholder="2500" required className="w-full pl-10 pr-4 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-black text-white transition-all placeholder-zinc-600 shadow-inner" />
                          </div>
                        </div>

                        <div>
                          <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Max Guests</label>
                          <div className="relative group">
                            <Users className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                            <select 
                              value={newRoomMaxGuests} 
                              onChange={(e) => setNewRoomMaxGuests(e.target.value)}
                              className="w-full pl-11 pr-8 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-bold text-white transition-all cursor-pointer appearance-none shadow-inner"
                            >
                              <option value="1">1 Person</option><option value="2">2 People</option><option value="3">3 People</option><option value="4">4 People</option><option value="5">5+ People</option>
                            </select>
                            <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500 pointer-events-none group-focus-within:text-emerald-500" />
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Description</label>
                        <div className="relative">
                          <AlignLeft className="absolute left-4 top-4 h-4 w-4 text-zinc-500" />
                          <textarea value={newRoomDesc} onChange={(e) => setNewRoomDesc(e.target.value)} placeholder="Sea view, complimentary breakfast, ultra-fast WiFi..." rows={3} className="w-full pl-12 pr-5 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-medium text-white transition-all placeholder-zinc-600 resize-none shadow-inner" />
                        </div>
                      </div>
                      
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Room Images (URLs)</label>
                        <div className="space-y-3">
                          {newRoomImages.map((imgUrl, index) => (
                            <div key={index} className="flex items-center gap-3">
                              <div className="relative flex-1">
                                <ImageIcon className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
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
                                  className="w-full pl-11 pr-4 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none text-sm font-medium text-white transition-all placeholder-zinc-600 shadow-inner" 
                                />
                              </div>
                              {index > 0 && (
                                <button 
                                  type="button" 
                                  onClick={() => {
                                    const updatedImages = newRoomImages.filter((_, i) => i !== index);
                                    setNewRoomImages(updatedImages);
                                  }}
                                  className="h-12 w-12 flex items-center justify-center bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-zinc-950 border border-rose-500/20 rounded-2xl transition-colors shrink-0 active:scale-95"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                        
                        <button 
                          type="button" 
                          onClick={() => setNewRoomImages([...newRoomImages, ""])}
                          className="mt-4 text-[10px] font-bold uppercase tracking-widest text-emerald-500 hover:text-emerald-400 flex items-center ml-1 transition-colors"
                        >
                          <Plus className="h-3 w-3 mr-1" /> Add Another Photo
                        </button>
                      </div>
                      
                      <div className="flex gap-3 pt-4 border-t border-zinc-800">
                        {editingRoomId && (
                          <button 
                            type="button" 
                            onClick={handleCancelEdit} 
                            className="w-1/3 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white font-bold text-[10px] uppercase tracking-widest py-4 rounded-full transition-all flex items-center justify-center border border-zinc-700 active:scale-95"
                          >
                            Cancel
                          </button>
                        )}
                        <button 
                          type="submit" 
                          disabled={isAddingRoom} 
                          className={`${editingRoomId ? 'w-2/3' : 'w-full'} bg-emerald-500 text-zinc-950 font-bold text-[10px] uppercase tracking-widest py-4 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center active:scale-95 group`}
                        >
                          {isAddingRoom ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                            <>
                              {editingRoomId ? <Check className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
                              {editingRoomId ? "Save Changes" : "Publish Live"}
                            </>
                          )}
                        </button>
                      </div>
                    </form>
                  </div>
                </div>

                <div className="xl:col-span-8">
                  <div className="bg-zinc-900/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-zinc-800 min-h-[600px]">
                    <div className="flex items-center justify-between mb-10 border-b border-zinc-800 pb-6">
                      <h3 className="text-3xl font-black text-white tracking-tighter">Active Rooms</h3>
                      <span className="text-[10px] font-bold tracking-widest uppercase bg-zinc-800 text-zinc-400 px-4 py-2 rounded-full border border-zinc-700">{rooms.length} Listed</span>
                    </div>
                    
                    {rooms.length === 0 ? (
                      <div className="text-center py-24 bg-zinc-950/50 rounded-[2rem] border border-dashed border-zinc-800">
                        <div className="h-20 w-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-zinc-800">
                          <BedDouble className="h-8 w-8 text-zinc-500" />
                        </div>
                        <h4 className="text-2xl font-bold text-white tracking-tight mb-2">No inventory listed</h4>
                        <p className="text-zinc-500 font-medium text-sm">Add your first room using the form to start receiving bookings.</p>
                      </div>
                    ) : (
                      <div className="space-y-6 animate-in fade-in duration-500">
                        {rooms.map(room => (
                          <div key={room.id} className={`flex flex-col sm:flex-row sm:items-center justify-between p-5 md:p-6 bg-zinc-950/80 rounded-[2rem] border shadow-sm transition-all group overflow-hidden relative ${editingRoomId === room.id ? 'border-emerald-500/50 shadow-[0_0_20px_rgba(16,185,129,0.1)]' : 'border-zinc-800 hover:border-zinc-600 hover:shadow-2xl'}`}>
                            
                            <div className="flex flex-col sm:flex-row sm:items-center gap-6 mb-6 sm:mb-0">
                              <div className="h-40 sm:h-24 w-full sm:w-32 bg-zinc-900 rounded-[1.5rem] shrink-0 overflow-hidden relative border border-zinc-800">
                                <img 
                                  src={(room.imageUrls && room.imageUrls.length > 0) ? room.imageUrls[0] : (room.imageUrl || "https://images.unsplash.com/photo-1542314831-c6a4d1409a54?w=800&q=80")} 
                                  alt={room.name} 
                                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 ease-out" 
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                                {room.imageUrls && room.imageUrls.length > 1 && (
                                  <div className="absolute bottom-2 right-2 bg-black/80 backdrop-blur-md text-white text-[9px] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full border border-white/10">
                                    +{room.imageUrls.length - 1} Photos
                                  </div>
                                )}
                              </div>
                              
                              <div>
                                <h4 className="font-black text-white text-xl md:text-2xl tracking-tight mb-2">{room.name}</h4>
                                <div className="flex items-center gap-2 mb-2 text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                                  <Users className="h-3.5 w-3.5 text-emerald-500" /> {room.maxGuests || 2} Guests
                                </div>
                                <p className="text-sm font-medium text-zinc-500 max-w-md line-clamp-2 leading-relaxed">{room.description || "No description provided."}</p>
                              </div>
                            </div>
                            
                            <div className="flex items-center justify-between sm:justify-end sm:gap-8 shrink-0 border-t border-zinc-800 pt-5 sm:border-0 sm:pt-0 pl-0 sm:pl-6">
                              <div className="text-left sm:text-right">
                                <p className="text-[9px] font-bold text-zinc-500 uppercase tracking-widest mb-1">Nightly Rate</p>
                                <div className="font-black text-white text-3xl flex items-center tracking-tighter">
                                  {symbol}{convert(room.price).toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </div>
                              </div>
                              
                              <div className="flex items-center gap-3">
                                <button onClick={() => handleEditClick(room)} className={`h-12 w-12 rounded-full flex items-center justify-center transition-all shadow-sm active:scale-95 border ${editingRoomId === room.id ? 'bg-emerald-500 text-zinc-950 border-emerald-400' : 'bg-zinc-900 text-zinc-400 border-zinc-800 hover:text-white hover:bg-zinc-800 hover:border-zinc-600'}`} title="Edit Room">
                                  <Pencil className="h-4 w-4" />
                                </button>
                                <button onClick={() => handleDeleteRoom(room.id)} className="h-12 w-12 rounded-full flex items-center justify-center bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-zinc-950 hover:bg-rose-500 hover:border-rose-400 transition-all shadow-sm active:scale-95" title="Delete Room">
                                  <Trash2 className="h-4 w-4" />
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
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-5xl mx-auto">
              <div className="bg-zinc-900/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-zinc-800 min-h-[600px]">
                <div className="flex items-center justify-between mb-10 border-b border-zinc-800 pb-8">
                  <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter">Reservation Inbox</h3>
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-full border border-emerald-500/20">{pendingBookingsCount} Action Required</span>
                </div>

                {bookings.length === 0 ? (
                  <div className="text-center py-24 bg-zinc-950/50 rounded-[2rem] border border-dashed border-zinc-800">
                    <div className="h-20 w-20 bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-zinc-800">
                      <Inbox className="h-8 w-8 text-zinc-500" />
                    </div>
                    <h4 className="text-2xl font-bold text-white tracking-tight mb-2">Inbox Empty</h4>
                    <p className="text-zinc-500 font-medium text-sm">No booking requests have been received yet.</p>
                  </div>
                ) : (
                  <div className="space-y-8">
                    {bookings.map(booking => {
                      
                      const isPending = booking.status === "Pending";
                      const isApproved = booking.status === "Approved" || booking.status === "Confirmed"; 
                      const isDeclined = booking.status === "Declined";
                      const isCancelled = booking.status === "Cancelled";

                      const today = new Date(); 
                      const checkInMs = new Date(`${booking.checkIn}T${booking.arrivalTime || "14:00"}`).getTime();
                      const checkOutMs = new Date(`${booking.checkOut}T${booking.departureTime || "11:00"}`).getTime();
                      
                      let liveStatus = "";
                      let liveColor = "";
                      
                      if (isApproved) {
                        if (today.getTime() < checkInMs) { 
                          liveStatus = "Upcoming Arrival"; 
                          liveColor = "text-sky-400 border-sky-500/30 bg-sky-500/10"; 
                        }
                        else if (today.getTime() >= checkInMs && today.getTime() <= checkOutMs) { 
                          liveStatus = "Currently Occupied"; 
                          liveColor = "text-emerald-400 border-emerald-500/50 bg-emerald-500/20 shadow-[0_0_15px_rgba(16,185,129,0.2)]"; 
                        }
                        else if (today.getTime() > checkOutMs) { 
                          liveStatus = "Checked-Out"; 
                          liveColor = "text-zinc-400 border-zinc-700 bg-zinc-800"; 
                        }
                      }

                      return (
                        <div key={booking.id} className={`bg-zinc-950 rounded-[2rem] border ${isPending ? 'border-amber-500/30 shadow-[0_0_20px_rgba(245,158,11,0.1)]' : isCancelled ? 'border-rose-500/20' : 'border-zinc-800 shadow-sm'} overflow-hidden flex flex-col transition-all group relative`}>
                          
                          <div className={`px-6 md:px-8 py-5 flex justify-between items-center ${isPending ? 'bg-amber-500/5' : isCancelled ? 'bg-rose-500/5' : 'bg-zinc-900/50'} border-b border-zinc-800`}>
                            <div className="flex items-center gap-4">
                              <div className="h-12 w-12 bg-zinc-800 rounded-full flex items-center justify-center text-zinc-300 font-bold shadow-inner border border-zinc-700">
                                {booking.customerName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <h4 className={`font-black text-lg tracking-tight ${isCancelled ? 'text-zinc-500 line-through' : 'text-white'}`}>{booking.customerName}</h4>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{booking.customerEmail}</p>
                              </div>
                            </div>
                            
                            <div className="text-right flex flex-col items-end gap-2">
                              {isPending && <span className="inline-flex items-center text-amber-500 bg-amber-500/10 border border-amber-500/20 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest"><Clock className="h-3 w-3 mr-1.5"/> Pending</span>}
                              
                              {isApproved && <span className="inline-flex items-center text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest"><CheckCircle2 className="h-3 w-3 mr-1.5"/> {booking.status === "Confirmed" ? "Confirmed" : "Approved"}</span>}
                              
                              {isDeclined && <span className="inline-flex items-center text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest"><XCircle className="h-3 w-3 mr-1.5"/> Declined</span>}
                              
                              {isCancelled && <span className="inline-flex items-center text-rose-500 bg-rose-500/10 border border-rose-500/30 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest"><AlertTriangle className="h-3 w-3 mr-1.5"/> Cancelled</span>}

                              {isApproved && liveStatus && (
                                <span className={`inline-flex items-center px-3 py-1 rounded-full text-[9px] font-bold uppercase tracking-widest border ${liveColor}`}>
                                  {liveStatus === "Currently Occupied" && <span className="relative flex h-2 w-2 mr-2"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span><span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span></span>}
                                  {liveStatus}
                                </span>
                              )}
                            </div>
                          </div>

                          {booking.transactionId && booking.transactionId !== "Pending" && booking.transactionId !== "Pay at Hotel" && (
                            <div className={`bg-zinc-900/30 border-b border-zinc-800 p-5 px-6 md:px-8 flex items-center gap-4 ${isCancelled ? 'opacity-50' : ''}`}>
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center shrink-0 border ${booking.transactionId.startsWith('pay_') ? 'bg-sky-500/10 text-sky-400 border-sky-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'}`}>
                                {booking.transactionId.startsWith('pay_') ? <ShieldCheck className="h-5 w-5" /> : <Smartphone className="h-5 w-5" />}
                              </div>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">
                                  {booking.transactionId.startsWith('pay_') ? 'Razorpay Secured' : 'UPI Payment Received'}
                                </p>
                                <p className="text-sm font-bold text-white flex items-center">
                                  Ref: <span className={`font-mono ml-2 px-2 py-0.5 rounded border tracking-wider text-xs ${booking.transactionId.startsWith('pay_') ? 'text-sky-400 bg-sky-500/10 border-sky-500/30' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30'}`}>
                                    {booking.transactionId}
                                  </span>
                                </p>
                              </div>
                            </div>
                          )}

                          {booking.transactionId === "Pay at Hotel" && (
                            <div className={`bg-zinc-900/30 border-b border-zinc-800 p-5 px-6 md:px-8 flex items-center gap-4 ${isCancelled ? 'opacity-50' : ''}`}>
                              <div className="h-10 w-10 bg-amber-500/10 text-amber-500 border border-amber-500/20 rounded-full flex items-center justify-center shrink-0"><Clock className="h-5 w-5" /></div>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1">Payment Method</p>
                                <p className="text-sm font-bold text-white">Pay at Hotel</p>
                              </div>
                            </div>
                          )}

                          <div className={`p-6 md:p-8 flex flex-col md:flex-row justify-between gap-8 items-center ${isCancelled ? 'opacity-50' : ''}`}>
                            <div className="flex-1 w-full grid grid-cols-2 md:grid-cols-4 gap-6 bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800">
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Room Type</p>
                                <p className="font-bold text-sm text-white truncate">{booking.roomName}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Check-In</p>
                                <p className="font-bold text-sm text-white">{new Date(booking.checkIn).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</p>
                                <p className="text-xs font-mono text-zinc-400 mt-0.5">{formatTime(booking.arrivalTime)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Check-Out</p>
                                <p className="font-bold text-sm text-white">{new Date(booking.checkOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})}</p>
                                <p className="text-xs font-mono text-zinc-400 mt-0.5">{formatTime(booking.departureTime)}</p>
                              </div>
                              <div>
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-1.5">Est. Revenue</p>
                                <p className={`font-black text-xl tracking-tighter ${isCancelled ? 'text-zinc-500 line-through' : 'text-emerald-400'}`}>
                                  {symbol}{convert(booking.totalPriceBase).toLocaleString(undefined, {maximumFractionDigits: 0})}
                                </p>
                              </div>
                            </div>
                            
                            {isPending && (
                              <div className="flex w-full md:w-auto gap-3 shrink-0">
                                <button onClick={() => handleUpdateBooking(booking.id, "Declined")} className="flex-1 md:flex-none px-6 py-4 bg-transparent text-rose-500 hover:bg-rose-500 hover:text-zinc-950 font-bold text-[10px] uppercase tracking-widest rounded-full transition-all border border-rose-500/30 active:scale-95">Decline</button>
                                <button onClick={() => handleUpdateBooking(booking.id, "Approved")} className="flex-1 md:flex-none px-8 py-4 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-[10px] uppercase tracking-widest rounded-full transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)] flex items-center justify-center active:scale-95">
                                  <Check className="h-4 w-4 mr-2"/> Approve
                                </button>
                              </div>
                            )}

                            {isApproved && liveStatus !== "Checked-Out" && (
                              <div className="flex w-full md:w-auto gap-3 shrink-0">
                                <button 
                                  onClick={() => handleCancelConfirmedBooking(booking.id)} 
                                  className="flex-1 md:flex-none px-6 py-4 bg-transparent text-rose-500 hover:bg-rose-500 hover:text-zinc-950 font-bold text-[10px] uppercase tracking-widest rounded-full transition-all border border-rose-500/30 active:scale-95 flex items-center justify-center"
                                  title="Revoke access or cancel due to policy violation"
                                >
                                  <AlertTriangle className="h-3 w-3 mr-2" /> Cancel Stay
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
          ) : activeTab === "requests" ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
              <div className="bg-zinc-900/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-zinc-800 min-h-[600px]">
                <div className="flex items-center justify-between mb-10 border-b border-zinc-800 pb-8">
                  <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter">Live Ops & Requests</h3>
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-zinc-800 text-zinc-400 px-4 py-2 rounded-full border border-zinc-700">{rooms.length} Rooms</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {rooms.map(room => {
                    const today = new Date();
                    
                    const roomBookings = bookings.filter(b => b.roomId === room.id && (b.status === "Approved" || b.status === "Confirmed"));
                    
                    const currentBookings = roomBookings.filter(b => {
                      const checkInMs = new Date(`${b.checkIn}T${b.arrivalTime || "14:00"}`).getTime();
                      const checkOutMs = new Date(`${b.checkOut}T${b.departureTime || "11:00"}`).getTime();
                      return today.getTime() >= checkInMs && today.getTime() <= checkOutMs;
                    });

                    const upcomingBookingsList = roomBookings.filter(b => {
                      const checkInMs = new Date(`${b.checkIn}T${b.arrivalTime || "14:00"}`).getTime();
                      return checkInMs > today.getTime();
                    });

                    const extendCurrent = currentBookings.filter(b => b.extensionRequest && b.extensionRequest.status === "Pending");
                    const extendUpcoming = upcomingBookingsList.filter(b => b.extensionRequest && b.extensionRequest.status === "Pending");

                    const activeSubTab = roomRequestSubTabs[room.id] || "current-details";
                    
                    let displayBookings: Booking[] = [];
                    if (activeSubTab === "current-details") displayBookings = currentBookings;
                    if (activeSubTab === "extend-current") displayBookings = extendCurrent;
                    if (activeSubTab === "extend-upcoming") displayBookings = extendUpcoming;

                    return (
                        <div key={room.id} className="bg-zinc-950 rounded-[2rem] border border-zinc-800 overflow-hidden flex flex-col shadow-sm hover:border-zinc-700 transition-colors">
                            
                            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-[1rem] overflow-hidden shrink-0 border border-zinc-800 shadow-sm">
                                        <img src={room.imageUrls?.[0] || room.imageUrl || "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?w=800"} alt={room.name} className="h-full w-full object-cover" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-xl text-white tracking-tight">{room.name}</h4>
                                        <span className={`inline-flex items-center px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest mt-1.5 border shadow-sm ${currentBookings.length > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-zinc-800 text-zinc-400 border-zinc-700'}`}>
                                            {currentBookings.length > 0 ? 'Currently Occupied' : 'Currently Empty'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="flex flex-col sm:flex-row bg-zinc-900/50 border-b border-zinc-800 p-2 gap-2">
                                <button 
                                  onClick={() => toggleRoomRequestSubTab(room.id, "current-details")}
                                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeSubTab === "current-details" ? 'bg-zinc-800 text-white shadow-inner border border-zinc-700' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                                >
                                  <UserCheck className="h-3 w-3" /> Current ({currentBookings.length})
                                </button>
                                <button 
                                  onClick={() => toggleRoomRequestSubTab(room.id, "extend-current")}
                                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeSubTab === "extend-current" ? 'bg-amber-500/10 text-amber-500 shadow-inner border border-amber-500/20' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                                >
                                  <Clock className="h-3 w-3" /> Ext Active ({extendCurrent.length})
                                </button>
                                <button 
                                  onClick={() => toggleRoomRequestSubTab(room.id, "extend-upcoming")}
                                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeSubTab === "extend-upcoming" ? 'bg-amber-500/10 text-amber-500 shadow-inner border border-amber-500/20' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                                >
                                  <ClipboardList className="h-3 w-3" /> Ext Upcm ({extendUpcoming.length})
                                </button>
                            </div>
                            
                            <div className="p-6 flex-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {displayBookings.length === 0 ? (
                                    <div className="text-center py-10 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
                                      {activeSubTab === "current-details" ? <UserCheck className="h-8 w-8 text-zinc-600 mx-auto mb-3" /> : <BellRing className="h-8 w-8 text-zinc-600 mx-auto mb-3" />}
                                      <p className="text-sm font-bold text-white mb-1">Nothing to show</p>
                                      <p className="text-xs font-medium text-zinc-500">
                                        {activeSubTab === "current-details" ? "No guests are currently in this room." : "No pending extension requests here."}
                                      </p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {displayBookings.map(b => (
                                            <div key={b.id} className="bg-zinc-900/50 p-5 rounded-2xl border border-zinc-800/50 flex flex-col hover:bg-zinc-900 transition-colors gap-4">
                                                
                                                <div className="flex justify-between items-start">
                                                  <div>
                                                      <p className="font-bold text-base text-white tracking-tight">{b.customerName}</p>
                                                      <p className="text-[10px] font-bold text-zinc-500 tracking-wider mt-0.5">{b.customerEmail}</p>
                                                  </div>
                                                  <div className="text-right shrink-0">
                                                      <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Est. Payout</p>
                                                      <p className="text-base font-black text-emerald-400">{symbol}{convert(b.totalPriceBase).toLocaleString()}</p>
                                                  </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 bg-black/40 p-4 rounded-xl border border-white/5">
                                                  <div>
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 mb-1 flex items-center"><Clock className="h-3 w-3 mr-1"/> Check-In</p>
                                                    <p className="text-sm font-bold text-white">{new Date(b.checkIn).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                                                    <p className="text-xs text-zinc-400 font-mono mt-1">{formatTime(b.arrivalTime)}</p>
                                                  </div>
                                                  <div>
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500 mb-1 flex items-center"><Clock className="h-3 w-3 mr-1"/> Check-Out</p>
                                                    <p className="text-sm font-bold text-white">{new Date(b.checkOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                                                    <p className="text-xs text-zinc-400 font-mono mt-1">{formatTime(b.departureTime)}</p>
                                                  </div>
                                                </div>

                                                {(activeSubTab === "extend-current" || activeSubTab === "extend-upcoming") && b.extensionRequest && (
                                                  <div className="bg-sky-950 border border-sky-900 p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mt-2">
                                                    <div>
                                                      <p className="text-sm font-bold text-white">Requested Checkout: {new Date(b.extensionRequest.requestedCheckOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                                                      <p className="text-[10px] font-bold uppercase tracking-widest text-sky-400 mt-1">Extra: {symbol}{convert(b.extensionRequest.extraPriceBase).toLocaleString(undefined, {maximumFractionDigits: 0})}</p>
                                                    </div>
                                                    <div className="flex gap-2 w-full sm:w-auto shrink-0">
                                                      <button onClick={() => handleDeclineExtension(b.id)} className="flex-1 sm:flex-none px-4 py-2 bg-transparent text-rose-500 border border-rose-500/30 hover:bg-rose-500/10 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors active:scale-95">Decline</button>
                                                      <button onClick={() => handleApproveExtension(b)} className="flex-1 sm:flex-none px-4 py-2 bg-sky-500 text-zinc-950 hover:bg-sky-400 rounded-full text-[10px] font-bold uppercase tracking-widest transition-colors shadow-sm active:scale-95">Approve</button>
                                                    </div>
                                                  </div>
                                                )}

                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : activeTab === "status" ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
              <div className="bg-zinc-900/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-zinc-800 min-h-[600px]">
                <div className="flex items-center justify-between mb-10 border-b border-zinc-800 pb-8">
                  <h3 className="text-3xl md:text-4xl font-black text-white tracking-tighter">Room Status</h3>
                  <span className="text-[10px] font-bold tracking-widest uppercase bg-zinc-800 text-zinc-400 px-4 py-2 rounded-full border border-zinc-700">{rooms.length} Rooms</span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {rooms.map(room => {
                    const today = new Date();
                    
                    const roomBookings = bookings.filter(b => b.roomId === room.id);
                    
                    const isOccupied = roomBookings.some(b => {
                      if (b.status !== "Approved" && b.status !== "Confirmed") return false;
                      const checkInMs = new Date(`${b.checkIn}T${b.arrivalTime || "14:00"}`).getTime();
                      const checkOutMs = new Date(`${b.checkOut}T${b.departureTime || "11:00"}`).getTime();
                      return today.getTime() >= checkInMs && today.getTime() <= checkOutMs;
                    });

                    const upcomingBookings = roomBookings.filter(b => {
                      if (b.status !== "Approved" && b.status !== "Confirmed") return false;
                      const checkoutDateTime = new Date(`${b.checkOut}T${b.departureTime || "11:00"}`).getTime();
                      return checkoutDateTime >= today.getTime();
                    }).sort((a, b) => {
                      const dateA = new Date(`${a.checkIn}T${a.arrivalTime || "14:00"}`).getTime();
                      const dateB = new Date(`${b.checkIn}T${b.arrivalTime || "14:00"}`).getTime();
                      return dateA - dateB;
                    });

                    const historyBookings = roomBookings.filter(b => {
                      if (b.status === "Cancelled" || b.status === "Declined" || b.status === "Pending") return true;
                      const checkoutDateTime = new Date(`${b.checkOut}T${b.departureTime || "11:00"}`).getTime();
                      return checkoutDateTime < today.getTime();
                    }).sort((a, b) => {
                      const dateA = new Date(`${a.checkIn}T${a.arrivalTime || "14:00"}`).getTime();
                      const dateB = new Date(`${b.checkIn}T${b.arrivalTime || "14:00"}`).getTime();
                      return dateB - dateA; 
                    });

                    const activeSubTab = roomSubTabs[room.id] || "upcoming";
                    const displayBookings = activeSubTab === "upcoming" ? upcomingBookings : historyBookings;

                    return (
                        <div key={room.id} className="bg-zinc-950 rounded-[2rem] border border-zinc-800 overflow-hidden flex flex-col shadow-sm hover:border-zinc-700 transition-colors">
                            
                            <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-900/30">
                                <div className="flex items-center gap-4">
                                    <div className="h-16 w-16 rounded-[1rem] overflow-hidden shrink-0 border border-zinc-800 shadow-sm">
                                        <img src={room.imageUrls?.[0] || room.imageUrl || "https://images.unsplash.com/photo-1518733057094-95b53143d2a7?w=800"} alt={room.name} className="h-full w-full object-cover" />
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-xl text-white tracking-tight">{room.name}</h4>
                                        {isOccupied ? (
                                            <span className="inline-flex items-center text-rose-400 bg-rose-500/10 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest mt-1.5 border border-rose-500/20 shadow-sm">
                                                <span className="h-1.5 w-1.5 rounded-full bg-rose-500 mr-1.5 animate-pulse shadow-[0_0_10px_rgba(244,63,94,0.8)]"></span> Occupied
                                            </span>
                                        ) : (
                                            <span className="inline-flex items-center text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-full text-[9px] font-bold uppercase tracking-widest mt-1.5 border border-emerald-500/20 shadow-sm">
                                                <CheckCircle2 className="h-3 w-3 mr-1" /> Available
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="flex bg-zinc-900/50 border-b border-zinc-800 p-2 gap-2">
                                <button 
                                  onClick={() => toggleRoomSubTab(room.id, "upcoming")}
                                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeSubTab === "upcoming" ? 'bg-zinc-800 text-white shadow-inner border border-zinc-700' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                                >
                                  <CalendarDays className="h-3 w-3" /> Upcoming ({upcomingBookings.length})
                                </button>
                                <button 
                                  onClick={() => toggleRoomSubTab(room.id, "history")}
                                  className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${activeSubTab === "history" ? 'bg-zinc-800 text-white shadow-inner border border-zinc-700' : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'}`}
                                >
                                  <History className="h-3 w-3" /> History ({historyBookings.length})
                                </button>
                            </div>
                            
                            <div className="p-6 flex-1 max-h-[400px] overflow-y-auto custom-scrollbar">
                                {displayBookings.length === 0 ? (
                                    <div className="text-center py-10 bg-zinc-900/30 rounded-2xl border border-dashed border-zinc-800">
                                      {activeSubTab === "upcoming" ? <CalendarDays className="h-8 w-8 text-zinc-600 mx-auto mb-3" /> : <History className="h-8 w-8 text-zinc-600 mx-auto mb-3" />}
                                      <p className="text-sm font-bold text-white mb-1">{activeSubTab === "upcoming" ? "Clear Schedule" : "No History"}</p>
                                      <p className="text-xs font-medium text-zinc-500">{activeSubTab === "upcoming" ? "No upcoming arrivals for this room." : "No past or cancelled records."}</p>
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {displayBookings.map(b => (
                                            <div key={b.id} className={`bg-zinc-900/50 p-5 rounded-2xl border flex flex-col hover:bg-zinc-900 transition-colors gap-4 ${b.status === "Cancelled" || b.status === "Declined" ? 'border-rose-500/10' : 'border-zinc-800/50'}`}>
                                                
                                                <div className="flex justify-between items-start">
                                                  <div>
                                                      <p className={`font-bold text-base tracking-tight ${b.status === "Cancelled" || b.status === "Declined" ? 'text-zinc-400 line-through' : 'text-white'}`}>{b.customerName}</p>
                                                      <p className="text-[10px] font-bold text-zinc-500 tracking-wider mt-0.5">{b.customerEmail}</p>
                                                  </div>
                                                  <div className="text-right shrink-0">
                                                      {activeSubTab === "history" && (
                                                        <span className={`inline-block mb-1.5 px-2 py-0.5 rounded border text-[8px] font-bold uppercase tracking-widest ${
                                                          b.status === "Cancelled" ? "bg-rose-500/10 text-rose-500 border-rose-500/20" :
                                                          b.status === "Declined" ? "bg-zinc-800 text-zinc-400 border-zinc-700" :
                                                          "bg-zinc-800 text-zinc-300 border-zinc-600" 
                                                        }`}>
                                                          {b.status === "Approved" || b.status === "Confirmed" ? "Completed" : b.status}
                                                        </span>
                                                      )}
                                                      {activeSubTab === "upcoming" && (
                                                        <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-500 mb-0.5">Est. Payout</p>
                                                      )}
                                                      <p className={`text-base font-black ${b.status === "Cancelled" || b.status === "Declined" ? 'text-zinc-600' : 'text-emerald-400'}`}>
                                                        {symbol}{convert(b.totalPriceBase).toLocaleString()}
                                                      </p>
                                                  </div>
                                                </div>

                                                <div className="grid grid-cols-2 gap-3 bg-black/40 p-4 rounded-xl border border-white/5">
                                                  <div>
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-emerald-500 mb-1 flex items-center"><Clock className="h-3 w-3 mr-1"/> Check-In</p>
                                                    <p className="text-sm font-bold text-white">{new Date(b.checkIn).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                                                    <p className="text-xs text-zinc-400 font-mono mt-1">{formatTime(b.arrivalTime)}</p>
                                                  </div>
                                                  <div>
                                                    <p className="text-[9px] font-bold uppercase tracking-widest text-rose-500 mb-1 flex items-center"><Clock className="h-3 w-3 mr-1"/> Check-Out</p>
                                                    <p className="text-sm font-bold text-white">{new Date(b.checkOut).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}</p>
                                                    <p className="text-xs text-zinc-400 font-mono mt-1">{formatTime(b.departureTime)}</p>
                                                  </div>
                                                </div>

                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                  })}
                </div>
              </div>
            </div>
          ) : activeTab === "messages" ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-7xl mx-auto">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                
                <div className="lg:col-span-4 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-[2rem] p-6 h-[600px] flex flex-col">
                  <h3 className="text-2xl font-black text-white mb-6">Conversations</h3>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3">
                    {bookings.length === 0 ? (
                      <p className="text-sm text-zinc-500 text-center mt-10">No guests to message.</p>
                    ) : (
                      bookings.map(b => (
                          <div 
                            key={b.id} 
                            onClick={() => setSelectedChatBooking(b)} 
                            className={`p-4 rounded-2xl cursor-pointer transition-all ${selectedChatBooking?.id === b.id ? 'bg-emerald-500/10 border border-emerald-500/20 shadow-inner' : 'bg-zinc-900/50 border border-zinc-800 hover:bg-zinc-800'}`}
                          >
                            <p className="font-bold text-white truncate text-sm">{b.customerName}</p>
                            <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1 truncate">{b.roomName} <span className="lowercase text-zinc-600">({b.status})</span></p>
                            <p className="text-[10px] text-zinc-400 mt-1">Arrival: {new Date(b.checkIn).toLocaleDateString()}</p>
                          </div>
                      ))
                    )}
                  </div>
                </div>

                <div className="lg:col-span-8 bg-zinc-900/40 backdrop-blur-xl border border-zinc-800 rounded-[2rem] h-[600px] flex flex-col overflow-hidden shadow-2xl">
                  {selectedChatBooking ? (
                    <>
                      <div className="p-6 border-b border-zinc-800 bg-zinc-900/50 flex justify-between items-center">
                        <div>
                          <h3 className="font-black text-white text-lg tracking-tight">Chat with {selectedChatBooking.customerName}</h3>
                          <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-1">Ref: {selectedChatBooking.id}</p>
                        </div>
                        <div className="bg-zinc-800 text-zinc-300 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest border border-zinc-700">
                          {selectedChatBooking.roomName}
                        </div>
                      </div>
                      
                      <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar bg-black/20">
                        {chatMessages.length === 0 ? (
                          <div className="h-full flex flex-col items-center justify-center text-zinc-500 opacity-50">
                            <MessageSquare className="h-10 w-10 mb-3" />
                            <p className="text-sm font-medium">No messages yet. Send a welcome message!</p>
                          </div>
                        ) : (
                          chatMessages.map(msg => {
                            const isOwner = msg.senderId === userProfile.uid;
                            return (
                              <div key={msg.id} className={`flex ${isOwner ? 'justify-end' : 'justify-start'}`}>
                                <div className={`px-5 py-3.5 rounded-2xl max-w-[75%] shadow-md ${isOwner ? 'bg-emerald-500 text-zinc-950 rounded-br-sm' : 'bg-zinc-800 text-white rounded-bl-sm border border-zinc-700'}`}>
                                  <p className="text-sm font-medium leading-relaxed">{msg.text}</p>
                                  {msg.timestamp && (
                                    <p className={`text-[8px] font-bold uppercase tracking-widest mt-2 text-right ${isOwner ? 'text-emerald-900/60' : 'text-zinc-500'}`}>
                                      {new Date(msg.timestamp.toDate()).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </p>
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                      
                      <form onSubmit={handleSendMessage} className="p-5 border-t border-zinc-800 bg-zinc-900/50 flex gap-3">
                        <input 
                          value={newMessage} 
                          onChange={e => setNewMessage(e.target.value)} 
                          placeholder="Type your message here..." 
                          className="flex-1 bg-zinc-950 border border-zinc-800 rounded-full px-6 py-4 text-sm font-medium text-white outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all placeholder-zinc-600 shadow-inner" 
                        />
                        <button 
                          type="submit" 
                          disabled={!newMessage.trim()}
                          className="h-14 w-14 bg-emerald-500 text-zinc-950 rounded-full flex items-center justify-center hover:bg-emerald-400 transition-all shrink-0 active:scale-95 disabled:opacity-50 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                        >
                          <Send className="h-5 w-5 ml-1" />
                        </button>
                      </form>
                    </>
                  ) : (
                    <div className="flex-1 flex flex-col items-center justify-center text-zinc-500">
                      <div className="h-20 w-20 bg-zinc-900 rounded-full flex items-center justify-center mb-4 shadow-inner border border-zinc-800">
                        <MessageSquare className="h-8 w-8 opacity-50" />
                      </div>
                      <p className="text-lg font-bold text-white tracking-tight mb-1">Your Messages</p>
                      <p className="text-sm font-medium">Select a guest from the list to start chatting.</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : activeTab === "settings" ? (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-3xl mx-auto mt-4">
              <div className="bg-zinc-900/40 backdrop-blur-xl p-8 md:p-12 rounded-[2.5rem] shadow-2xl border border-zinc-800">
                <div className="flex items-center mb-10 border-b border-zinc-800 pb-8">
                  <div className="h-16 w-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mr-6">
                    <Wallet className="h-8 w-8 text-emerald-500" />
                  </div>
                  <div>
                    <h3 className="text-3xl font-black text-white tracking-tighter">Config & Settings</h3>
                    <p className="text-xs font-bold uppercase tracking-widest text-zinc-500 mt-1">Configure your contact details and payments.</p>
                  </div>
                </div>

                <div className="bg-zinc-950 border border-zinc-800 rounded-2xl p-6 mb-10 relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-[40px]"></div>
                  <h4 className="text-sm font-black text-white mb-2 flex items-center relative z-10">
                    <ShieldCheck className="h-4 w-4 mr-2 text-emerald-500" /> Zero Transaction Fees
                  </h4>
                  <p className="text-xs font-medium text-zinc-400 leading-relaxed relative z-10 max-w-xl">
                    By saving your Business UPI ID here, AERO will automatically generate deep-links for your customers during checkout. Payments will route directly to your bank account with 0% commission.
                  </p>
                </div>

                <form onSubmit={handleSaveSettings} className="space-y-8">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Support Phone Number</label>
                      <input 
                        type="tel" 
                        value={hotelPhone} 
                        onChange={(e) => setHotelPhone(e.target.value)} 
                        placeholder="+91 9876543210" 
                        required 
                        className="w-full px-6 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-white transition-all placeholder-zinc-600 text-base shadow-inner" 
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Support Email ID</label>
                      <input 
                        type="email" 
                        value={hotelEmail} 
                        onChange={(e) => setHotelEmail(e.target.value)} 
                        placeholder="contact@hotel.com" 
                        required 
                        className="w-full px-6 py-4 bg-zinc-950 border border-zinc-800 rounded-2xl focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none font-bold text-white transition-all placeholder-zinc-600 text-base shadow-inner" 
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-3 ml-1">Your Business UPI ID</label>
                    <div className="relative group flex flex-col sm:flex-row items-start sm:items-center gap-3">
                      <div className="relative w-full sm:flex-1">
                        <input 
                          type="text" 
                          value={upiInput} 
                          onChange={(e) => {
                            setUpiInput(e.target.value.toLowerCase());
                            setVerifiedUpiName(null); // Reset verification if they change the text
                            setUpiError("");
                          }} 
                          placeholder="hotelname@okaxis" 
                          required 
                          className={`w-full px-6 py-4 bg-zinc-950 border ${verifiedUpiName ? 'border-emerald-500/50 focus:border-emerald-500' : upiError ? 'border-rose-500/50 focus:border-rose-500' : 'border-zinc-800 focus:border-zinc-500'} rounded-2xl outline-none font-bold text-white transition-all placeholder-zinc-600 text-base shadow-inner`} 
                        />
                      </div>
                      
                      <button 
                        type="button"
                        onClick={verifyUpiId}
                        disabled={isVerifyingUpi || !upiInput || verifiedUpiName !== null}
                        className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-bold text-[10px] uppercase tracking-widest transition-all flex items-center justify-center shrink-0 shadow-sm ${verifiedUpiName ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' : 'bg-zinc-800 text-white hover:bg-zinc-700 active:scale-95 disabled:opacity-50'}`}
                      >
                        {isVerifyingUpi ? <Loader2 className="h-4 w-4 animate-spin" /> : verifiedUpiName ? "Verified" : "Verify Network"}
                      </button>
                    </div>

                    {upiError && (
                      <p className="text-[10px] font-bold uppercase tracking-widest text-rose-400 mt-3 flex items-center ml-1 animate-in fade-in">
                        <AlertTriangle className="h-3 w-3 mr-1.5" /> {upiError}
                      </p>
                    )}

                    {verifiedUpiName && (
                      <div className="mt-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center animate-in fade-in slide-in-from-top-2">
                        <CheckCircle2 className="h-5 w-5 text-emerald-500 mr-3 shrink-0" />
                        <div>
                          <p className="text-[9px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest mb-0.5">Bank Account Found</p>
                          <p className="text-sm font-bold text-white tracking-tight">{verifiedUpiName}</p>
                        </div>
                      </div>
                    )}

                    {!verifiedUpiName && !upiError && (
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mt-3 ml-2 flex items-center">
                        <AlertTriangle className="h-3 w-3 mr-1 text-amber-500"/> Make sure this is linked to your business account.
                      </p>
                    )}
                  </div>

                  <button 
                    type="submit" 
                    disabled={isSavingSettings || !verifiedUpiName} 
                    className="w-full bg-emerald-500 text-zinc-950 font-bold text-xs uppercase tracking-widest py-5 rounded-full shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:bg-emerald-400 transition-all disabled:opacity-50 flex justify-center items-center active:scale-95"
                  >
                    {isSavingSettings ? <Loader2 className="h-5 w-5 animate-spin" /> : "Save Settings"}
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