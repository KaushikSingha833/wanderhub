"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc, onSnapshot, query, where, orderBy, updateDoc, arrayRemove, deleteField, deleteDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { ArrowLeft, Calendar, Plus, Plane, Hotel, Utensils, Map as MapIcon, Clock, Crown, UserMinus, LogOut, Users, CheckSquare, Square, Trash2, BaggageClaim, MapPin, FileText, Hash, X, Edit2, Heart, X as XIcon, Trophy, Flame, ExternalLink, ThumbsUp } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; // ✨ NEW: Framer Motion

interface Trip {
  id: string; title: string; startDate: string; endDate: string; inviteCode?: string;
  adminId?: string; members?: string[]; memberNames?: Record<string, string>;
  imageUrl?: string; 
}
interface Activity { 
  id: string; title: string; type: string; date: string; time: string; 
  location?: string; notes?: string; trackingNumber?: string; 
}
interface PackingItem { id: string; name: string; isChecked: boolean; }

// ✨ NEW: HOTEL POLL INTERFACE
interface HotelPoll {
  id: string;
  name: string;
  location: string;
  rating: number | string; // ✨ Add this
  reviews: number;         // ✨ Add this
  pricePerNight: number;
  imageUrl: string;
  bookingUrl: string;
  suggestedByName: string;
  votes: Record<string, "yes" | "no" | "super">;
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

export default function TripDetails() {
  const params = useParams(); const router = useRouter(); const tripId = params.id as string;
  
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [trip, setTrip] = useState<Trip | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [packingItems, setPackingItems] = useState<PackingItem[]>([]);
  
  // ✨ NEW: VOTING ROOM STATE
  const [activeTab, setActiveTab] = useState<"itinerary" | "voting">("itinerary");
  const [polls, setPolls] = useState<HotelPoll[]>([]);
  const [swipeDirection, setSwipeDirection] = useState<"left" | "right" | null>(null);

  const [isLoading, setIsLoading] = useState(true);

  // Modal & Activity State
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingActivityId, setEditingActivityId] = useState<string | null>(null); 
  
  const [actTitle, setActTitle] = useState(""); const [actType, setActType] = useState("activity");
  const [actDate, setActDate] = useState(""); const [actTime, setActTime] = useState("");
  const [actLocation, setActLocation] = useState(""); 
  const [actNotes, setActNotes] = useState("");
  const [actTrackingNum, setActTrackingNum] = useState("");
  
  // Packing List State
  const [newItemName, setNewItemName] = useState("");

  // 1. Listen to Auth State
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => { setUser(currentUser); });
    return () => unsubscribe();
  }, []);

  // 2. Fetch Data (UPGRADED: Trip is now real-time!)
  useEffect(() => {
    if (!tripId) return;

    // Real-time trip listener
    const unsubTrip = onSnapshot(doc(db, "trips", tripId), (docSnap) => {
      if (docSnap.exists()) {
        setTrip({ id: docSnap.id, ...(docSnap.data() as Omit<Trip, 'id'>) });
      }
    });

    // Fetch Activities
    const qActivities = query(collection(db, "activities"), where("tripId", "==", tripId), orderBy("date", "asc"), orderBy("time", "asc"));
    const unsubActivities = onSnapshot(qActivities, (snapshot) => {
      setActivities(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as Activity));
      setIsLoading(false);
    });

    // Fetch Packing List
    const qPacking = query(collection(db, "packingList"), where("tripId", "==", tripId), orderBy("createdAt", "asc"));
    const unsubPacking = onSnapshot(qPacking, (snapshot) => {
      setPackingItems(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as PackingItem));
    });

    // ✨ NEW: Fetch Hotel Polls
    const qPolls = query(collection(db, "trips", tripId, "hotel_polls"));
    const unsubPolls = onSnapshot(qPolls, (snapshot) => {
      setPolls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }) as HotelPoll));
    });

    return () => { unsubTrip(); unsubActivities(); unsubPacking(); unsubPolls(); };
  }, [tripId]);

  // The Self-Healing Name Sync
  useEffect(() => {
    if (!trip || !user || !trip.members?.includes(user.uid)) return;

    const savedName = trip.memberNames?.[user.uid];
    const realAuthName = user.displayName || user.email?.split('@')[0] || "Traveler";

    if (!savedName || savedName !== realAuthName) {
      updateDoc(doc(db, "trips", tripId), {
        [`memberNames.${user.uid}`]: realAuthName
      }).catch(err => console.error("Error auto-syncing name:", err));
    }
  }, [trip, user, tripId]);

  // --- MEMBER LOGIC ---
  const handleRemoveMember = async (memberUid: string, memberName: string) => {
    const isSelf = memberUid === user?.uid;
    const confirmMessage = isSelf ? "Are you sure you want to leave this trip?" : `Are you sure you want to kick ${memberName} out?`;
    if (!confirm(confirmMessage)) return;

    try {
      await updateDoc(doc(db, "trips", tripId), {
        members: arrayRemove(memberUid),
        [`memberNames.${memberUid}`]: deleteField()
      });
      if (isSelf) router.push("/");
    } catch (error) { console.error("Error removing member:", error); }
  };

  // --- ACTIVITY LOGIC ---
  const openAddModal = () => {
    setEditingActivityId(null);
    setActTitle(""); setActType("activity"); setActDate(""); setActTime("");
    setActLocation(""); setActNotes(""); setActTrackingNum("");
    setIsActivityModalOpen(true);
  };

  const openEditModal = (act: Activity) => {
    setEditingActivityId(act.id);
    setActTitle(act.title); setActType(act.type); setActDate(act.date); setActTime(act.time);
    setActLocation(act.location || ""); setActNotes(act.notes || ""); setActTrackingNum(act.trackingNumber || "");
    setIsActivityModalOpen(true);
  };

  const handleSubmitActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle || !actDate || !actTime) return;
    setIsSubmitting(true);
    try {
      if (editingActivityId) {
        await updateDoc(doc(db, "activities", editingActivityId), { 
          title: actTitle, type: actType, date: actDate, time: actTime, 
          location: actLocation, notes: actNotes, trackingNumber: actTrackingNum 
        });
      } else {
        await addDoc(collection(db, "activities"), { 
          tripId, title: actTitle, type: actType, date: actDate, time: actTime, 
          location: actLocation, notes: actNotes, trackingNumber: actTrackingNum, createdAt: new Date() 
        });
      }
      setActTitle(""); setActLocation(""); setActNotes(""); setActTrackingNum("");
      setIsActivityModalOpen(false);
      setEditingActivityId(null); 
    } catch (error) { console.error("Error saving activity:", error); } 
    finally { setIsSubmitting(false); }
  };

  const handleDeleteActivity = async (id: string) => {
    if (confirm("Are you sure you want to delete this activity?")) {
      try { await deleteDoc(doc(db, "activities", id)); }
      catch (error) { console.error("Error deleting activity:", error); }
    }
  };

  const closeActivityModal = () => {
    setIsActivityModalOpen(false);
    setEditingActivityId(null);
  };

  // --- PACKING LIST LOGIC ---
  const handleAddPackingItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemName.trim()) return;
    try {
      await addDoc(collection(db, "packingList"), { tripId, name: newItemName, isChecked: false, createdAt: new Date() });
      setNewItemName("");
    } catch (error) { console.error("Error adding item:", error); }
  };

  const handleTogglePackingItem = async (itemId: string, currentStatus: boolean) => {
    try { await updateDoc(doc(db, "packingList", itemId), { isChecked: !currentStatus }); }
    catch (error) { console.error("Error toggling item:", error); }
  };

  const handleDeletePackingItem = async (itemId: string) => {
    try { await deleteDoc(doc(db, "packingList", itemId)); }
    catch (error) { console.error("Error deleting item:", error); }
  };

  // ✨ NEW: VOTING LOGIC
  const handleVote = async (pollId: string, vote: "yes" | "no") => {
    if (!user) return;
    setSwipeDirection(vote === "yes" ? "right" : "left");
    
    // Short timeout to let the swipe out animation finish before hiding the card
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, "trips", tripId, "hotel_polls", pollId), {
          [`votes.${user.uid}`]: vote
        });
        setSwipeDirection(null);
      } catch (error) {
        console.error("Error casting vote:", error);
      }
    }, 200);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'flight': return <Plane className="h-5 w-5 text-sky-500 dark:text-sky-400" />;
      case 'hotel': return <Hotel className="h-5 w-5 text-indigo-500 dark:text-indigo-400" />;
      case 'food': return <Utensils className="h-5 w-5 text-orange-500 dark:text-orange-400" />;
      default: return <MapIcon className="h-5 w-5 text-emerald-500 dark:text-emerald-400" />;
    }
  };

  if (isLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#030712] transition-colors"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  if (!trip) return <div className="min-h-screen flex items-center justify-center bg-slate-50 dark:bg-[#030712] transition-colors"><div className="text-center"><MapIcon className="h-16 w-16 mx-auto text-slate-300 dark:text-slate-600 mb-4"/><h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300">Trip not found</h2><button onClick={() => router.push('/')} className="mt-4 text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Return Home</button></div></div>;

  const isAdmin = user.uid === trip.adminId;
  const tripImageUrl = trip.imageUrl || getTripImage(trip.id);

  // ✨ COMPUTE VOTING DATA
  const unvotedPolls = polls.filter(p => !p.votes || !p.votes[user.uid]);
  
  // Calculate Leaderboard
  const leaderboard = [...polls].sort((a, b) => {
    const scoreA = Object.values(a.votes || {}).reduce((acc, v) => acc + (v === 'yes' ? 1 : 0), 0);
    const scoreB = Object.values(b.votes || {}).reduce((acc, v) => acc + (v === 'yes' ? 1 : 0), 0);
    return scoreB - scoreA;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#030712] font-sans text-slate-900 dark:text-slate-100 pb-24 selection:bg-indigo-100 selection:text-indigo-900 transition-colors duration-300">
      
      {/* HERO BANNER SECTION */}
      <div className="relative h-[35vh] md:h-[45vh] w-full bg-slate-900 dark:bg-black overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tripImageUrl} alt={trip.title} className="absolute inset-0 w-full h-full object-cover opacity-60 dark:opacity-40 transition-opacity" />
        <div className="absolute inset-0 bg-gradient-to-t from-[#f8fafc] dark:from-[#030712] via-slate-900/40 dark:via-black/60 to-transparent transition-colors"></div>
        
        <div className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
          <button onClick={() => router.push('/')} className="flex items-center text-sm font-bold text-white bg-black/20 hover:bg-black/40 backdrop-blur-md px-4 py-2 rounded-full transition-all border border-white/10">
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </button>
        </div>

        <div className="absolute bottom-12 md:bottom-16 left-0 w-full px-6 md:px-12 z-20 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 dark:bg-black/30 backdrop-blur-md border border-white/20 dark:border-white/10 text-white text-xs font-bold mb-4 shadow-sm">
                <Calendar className="h-3.5 w-3.5" /> 
                {new Date(trip.startDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} — {new Date(trip.endDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-lg">{trip.title}</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {trip.inviteCode && (
                <div className="bg-white/90 dark:bg-black/50 backdrop-blur-md border border-slate-200/50 dark:border-white/10 text-slate-900 dark:text-white px-4 py-2.5 rounded-2xl flex items-center shadow-lg cursor-pointer hover:bg-white dark:hover:bg-white/10 transition-all" title="Share this code">
                  <span className="text-xs font-medium mr-2 text-slate-500 dark:text-slate-400 uppercase tracking-wider">Invite Code:</span>
                  <span className="font-mono font-bold tracking-widest text-lg text-indigo-600 dark:text-indigo-400">{trip.inviteCode}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT OVERLAP */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-8 md:-mt-10 relative z-30 grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: MAIN CONTENT AREA */}
        <div className="xl:col-span-2">
          
          {/* ✨ NEW: TAB NAVIGATION */}
          <div className="flex items-center gap-3 mb-6 p-1.5 bg-white dark:bg-[#0f172a] rounded-[1.5rem] shadow-sm border border-slate-100 dark:border-white/10 w-max transition-colors">
            <button onClick={() => setActiveTab("itinerary")} className={`flex items-center px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === "itinerary" ? "bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              <Calendar className="h-4 w-4 mr-2" /> Itinerary
            </button>
            <button onClick={() => setActiveTab("voting")} className={`flex items-center px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${activeTab === "voting" ? "bg-purple-50 dark:bg-purple-500/20 text-purple-600 dark:text-purple-400 shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              <Flame className="h-4 w-4 mr-2" /> Voting Room
              {unvotedPolls.length > 0 && <span className="ml-2 bg-purple-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{unvotedPolls.length}</span>}
            </button>
          </div>

          {/* ==================================================== */}
          {/* TAB 1: ITINERARY VIEW (Untouched Original Code)        */}
          {/* ==================================================== */}
          {activeTab === "itinerary" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] shadow-sm border border-slate-100 dark:border-white/10 mb-8 transition-colors">
                <div>
                  <h2 className="text-2xl font-black text-slate-900 dark:text-white">Itinerary</h2>
                  <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mt-1">Your detailed day-by-day plan.</p>
                </div>
                <button onClick={openAddModal} className="flex items-center bg-indigo-600 dark:bg-indigo-500 text-white px-5 py-3 rounded-2xl font-bold hover:bg-indigo-700 dark:hover:bg-indigo-600 hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-indigo-600/20 dark:shadow-none">
                  <Plus className="h-5 w-5 mr-2" /> Add Event
                </button>
              </div>

              {activities.length === 0 ? (
                <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[300px] transition-colors">
                  <div className="h-20 w-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-6">
                    <MapIcon className="h-10 w-10 text-indigo-300 dark:text-indigo-500/50" />
                  </div>
                  <h2 className="text-2xl font-black text-slate-800 dark:text-white mb-2">Blank Canvas</h2>
                  <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm mx-auto">Your itinerary is currently empty. Start adding flights, hotels, or dinner reservations!</p>
                </div>
              ) : (
                <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm p-6 md:p-10 relative transition-colors">
                  <div className="absolute left-11 md:left-14 top-10 bottom-10 w-0.5 bg-gradient-to-b from-indigo-100 dark:from-indigo-500/20 via-slate-200 dark:via-slate-800 to-transparent"></div>
                  
                  <div className="space-y-8">
                    {activities.map((act) => (
                      <div key={act.id} className="relative flex items-start gap-6 group">
                        <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-2xl border-4 border-white dark:border-[#0f172a] bg-slate-50 dark:bg-[#1e293b] shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300 shrink-0">
                          {getIcon(act.type)}
                        </div>
                        <div className="flex-1 relative bg-white dark:bg-[#1e293b]/50 p-6 rounded-3xl border border-slate-100 dark:border-white/5 shadow-sm hover:shadow-xl hover:border-indigo-100 dark:hover:border-indigo-500/30 transition-all duration-300 group-hover:-translate-y-1">
                          
                          <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity bg-white/80 dark:bg-[#1e293b]/80 backdrop-blur-sm rounded-lg p-1 shadow-sm border border-slate-100 dark:border-white/10">
                            <button onClick={() => openEditModal(act)} className="p-1.5 text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors" title="Edit Activity">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteActivity(act.id)} className="p-1.5 text-slate-400 hover:text-red-600 dark:hover:text-red-400 transition-colors" title="Delete Activity">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex flex-wrap justify-between items-start gap-4 mb-3 pr-16">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 px-3 py-1 rounded-full">{act.type}</span>
                              <span className="text-sm font-bold text-slate-400 dark:text-slate-500 flex items-center"><Calendar className="h-3.5 w-3.5 mr-1.5" /> {act.date}</span>
                            </div>
                            <div className="flex items-center text-slate-900 dark:text-white font-black bg-slate-50 dark:bg-white/5 px-3 py-1 rounded-lg border border-slate-100 dark:border-white/5">
                              <Clock className="h-4 w-4 mr-2 text-indigo-500 dark:text-indigo-400" /> {act.time}
                            </div>
                          </div>
                          
                          <h3 className="font-black text-xl text-slate-900 dark:text-white mb-4">{act.title}</h3>
                          
                          {(act.location || act.trackingNumber || act.notes) && (
                            <div className="bg-slate-50 dark:bg-black/20 rounded-2xl p-4 space-y-3 border border-slate-100 dark:border-white/5">
                              {act.trackingNumber && (
                                <div className="flex items-center text-sm font-semibold text-slate-700 dark:text-slate-300">
                                  <Hash className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500" /> {act.trackingNumber}
                                </div>
                              )}
                              {act.location && (
                                <div className="flex items-start text-sm font-medium text-slate-600 dark:text-slate-400">
                                  <MapPin className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" /> {act.location}
                                </div>
                              )}
                              {act.notes && (
                                <div className="flex items-start text-sm text-slate-500 dark:text-slate-400 italic">
                                  <FileText className="h-4 w-4 mr-2 text-slate-400 dark:text-slate-500 shrink-0 mt-0.5" /> "{act.notes}"
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ==================================================== */}
          {/* TAB 2: VOTING ROOM (Tinder Swiper & Consensus)         */}
          {/* ==================================================== */}
          {activeTab === "voting" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 min-h-[600px] flex flex-col">
              
              {/* 1. TINDER SWIPE STACK */}
              {unvotedPolls.length > 0 ? (
                <div className="flex-1 flex flex-col items-center justify-center relative w-full pt-8">
                  <div className="absolute top-0 text-center w-full">
                    <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Vote on Hotels</h3>
                    <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Swipe Right to approve, Left to reject.</p>
                  </div>

                  <div className="relative w-full max-w-sm h-[450px] mx-auto mt-16 perspective-1000">
                    <AnimatePresence>
                      {unvotedPolls.map((poll, index) => {
                        // Only render the top 3 cards for performance
                        if (index > 2) return null;
                        
                        const isFront = index === 0;
                        const cardScale = isFront ? 1 : 1 - (index * 0.05);
                        const cardY = isFront ? 0 : index * 15;
                        const cardOpacity = isFront ? 1 : 1 - (index * 0.2);

                        return (
                          <motion.div
                            key={poll.id}
                            initial={{ scale: 0.9, opacity: 0, y: 50 }}
                            animate={{ scale: cardScale, opacity: cardOpacity, y: cardY }}
                            exit={{ 
                              x: swipeDirection === "right" ? 300 : -300, 
                              opacity: 0, 
                              rotate: swipeDirection === "right" ? 15 : -15,
                              transition: { duration: 0.3 } 
                            }}
                            drag={isFront ? "x" : false}
                            dragConstraints={{ left: 0, right: 0 }}
                            onDragEnd={(e, info) => {
                              if (info.offset.x > 100) handleVote(poll.id, "yes");
                              else if (info.offset.x < -100) handleVote(poll.id, "no");
                            }}
                            className={`absolute inset-0 bg-white dark:bg-[#0f172a] rounded-[2.5rem] shadow-2xl border border-slate-200 dark:border-white/10 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing ${isFront ? 'z-50' : 'z-40 pointer-events-none'}`}
                            style={{ originY: 1 }}
                          >
                            <div className="relative h-3/5 w-full bg-slate-200 dark:bg-slate-800 shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={poll.imageUrl} alt={poll.name} className="w-full h-full object-cover pointer-events-none" />
                              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
                              
                              <div className="absolute top-4 left-4 bg-white/90 dark:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-black text-slate-800 dark:text-white flex items-center shadow-sm">
                                ⭐ {poll.rating}
                              </div>
                            </div>
                            
                            <div className="p-6 flex flex-col flex-1 pointer-events-none select-none">
                              <h3 className="text-2xl font-black text-slate-900 dark:text-white line-clamp-1 mb-1 tracking-tight">{poll.name}</h3>
                              <p className="text-sm font-medium text-slate-500 dark:text-slate-400 flex items-center truncate mb-auto"><MapPin className="h-4 w-4 mr-1 shrink-0" /> {poll.location}</p>
                              
                              <div className="flex items-end justify-between mt-4">
                                <div>
                                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">Price</p>
                                  <p className="text-2xl font-black text-slate-900 dark:text-white">₹{poll.pricePerNight}<span className="text-sm font-medium text-slate-500">/nt</span></p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold text-slate-400">Suggested by</p>
                                  <p className="text-sm font-bold text-indigo-500 dark:text-indigo-400">{poll.suggestedByName.split(' ')[0]}</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  {/* Manual Swipe Buttons */}
                  <div className="flex items-center justify-center gap-6 mt-12 z-50">
                    <button 
                      onClick={() => handleVote(unvotedPolls[0].id, "no")}
                      className="h-16 w-16 bg-white dark:bg-[#0f172a] rounded-full flex items-center justify-center text-red-500 shadow-xl border border-slate-100 dark:border-white/10 hover:scale-110 hover:bg-red-50 dark:hover:bg-red-500/10 transition-all active:scale-95"
                    >
                      <XIcon className="h-8 w-8" strokeWidth={3} />
                    </button>
                    <button 
                      onClick={() => handleVote(unvotedPolls[0].id, "yes")}
                      className="h-16 w-16 bg-white dark:bg-[#0f172a] rounded-full flex items-center justify-center text-emerald-500 shadow-xl border border-slate-100 dark:border-white/10 hover:scale-110 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
                    >
                      <Heart className="h-8 w-8 fill-emerald-500" strokeWidth={3} />
                    </button>
                  </div>
                </div>
              ) : (
                
              /* 2. CONSENSUS LEADERBOARD */
                <div className="flex-1 bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-100 dark:border-white/10 shadow-sm p-8 md:p-12 animate-in zoom-in-95 duration-500">
                  <div className="text-center mb-10">
                    <div className="h-20 w-20 bg-amber-50 dark:bg-amber-500/10 rounded-full flex items-center justify-center text-amber-500 dark:text-amber-400 mx-auto mb-6 shadow-inner border border-amber-100 dark:border-amber-500/20">
                      <Trophy className="h-10 w-10" />
                    </div>
                    <h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Group Consensus</h3>
                    <p className="text-slate-500 dark:text-slate-400 font-medium">You've voted on all suggestions! Here are the current standings.</p>
                  </div>

                  {leaderboard.length === 0 ? (
                     <div className="text-center p-8 border border-dashed border-slate-200 dark:border-white/10 rounded-2xl bg-slate-50 dark:bg-[#1e293b]/30">
                       <p className="text-slate-500 font-bold">No hotels have been suggested yet.</p>
                       <button onClick={() => router.push('/hotels')} className="mt-4 text-indigo-600 dark:text-indigo-400 font-bold hover:underline">Go to Hotel Search to suggest one</button>
                     </div>
                  ) : (
                    <div className="space-y-4">
                      {leaderboard.map((hotel, index) => {
                        const yesVotes = Object.values(hotel.votes || {}).filter(v => v === 'yes').length;
                        const noVotes = Object.values(hotel.votes || {}).filter(v => v === 'no').length;
                        const isWinner = index === 0 && yesVotes > 0;

                        return (
                          <div key={hotel.id} className={`relative flex items-center gap-4 p-4 rounded-2xl border ${isWinner ? 'bg-amber-50/50 dark:bg-amber-500/10 border-amber-200 dark:border-amber-500/30 shadow-md' : 'bg-slate-50 dark:bg-[#1e293b]/50 border-slate-100 dark:border-white/5'} transition-colors`}>
                            
                            {isWinner && (
                              <div className="absolute -top-3 -left-3 bg-gradient-to-br from-amber-400 to-orange-500 text-white h-8 w-8 rounded-full flex items-center justify-center shadow-lg transform -rotate-12 border-2 border-white dark:border-[#0f172a]">
                                <Crown className="h-4 w-4" />
                              </div>
                            )}

                            <div className="font-black text-2xl text-slate-300 dark:text-slate-600 w-6 text-center">#{index + 1}</div>
                            
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={hotel.imageUrl} alt="" className="h-16 w-16 rounded-xl object-cover shadow-sm" />
                            
                            <div className="flex-1 min-w-0">
                              <h4 className="font-black text-slate-900 dark:text-white text-lg truncate tracking-tight">{hotel.name}</h4>
                              <p className="text-xs font-bold text-slate-500 dark:text-slate-400">₹{hotel.pricePerNight} / night</p>
                            </div>

                            <div className="flex items-center gap-4 px-4 border-r border-slate-200 dark:border-white/10">
                              <div className="text-center">
                                <p className="text-[10px] font-black uppercase text-slate-400">Yes</p>
                                <p className="text-lg font-black text-emerald-500">{yesVotes}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[10px] font-black uppercase text-slate-400">No</p>
                                <p className="text-lg font-black text-red-400">{noVotes}</p>
                              </div>
                            </div>

                            <div className="pl-2">
                              {isWinner ? (
                                <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" className="bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-xl font-black text-sm transition-all shadow-md flex items-center whitespace-nowrap">
                                  Book <ExternalLink className="h-4 w-4 ml-2" />
                                </a>
                              ) : (
                                <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" className="text-slate-500 hover:text-indigo-600 dark:hover:text-indigo-400 p-3 bg-white dark:bg-white/5 rounded-xl border border-slate-200 dark:border-white/10 transition-colors flex items-center justify-center">
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

        </div>

        {/* RIGHT COLUMN: GROUPS & PACKING LIST */}
        <div className="xl:col-span-1 space-y-8">
          
          {/* GROUP MEMBERS WIDGET */}
          <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm p-8 transition-colors">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center"><Users className="h-6 w-6 mr-3 text-indigo-600 dark:text-indigo-400"/> Travel Crew</h3>
            <div className="space-y-3 mb-8">
              {trip.members?.map((memberUid) => {
                const isThisMemberAdmin = memberUid === trip.adminId;
                const isMe = memberUid === user.uid;
                const memberName = trip.memberNames?.[memberUid] || "Unknown Traveler";

                return (
                  <div key={memberUid} className="flex items-center justify-between p-3.5 bg-slate-50 dark:bg-[#1e293b]/50 hover:bg-slate-100 dark:hover:bg-[#1e293b] rounded-2xl border border-transparent hover:border-slate-200 dark:hover:border-white/10 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-100 dark:from-indigo-500/20 to-purple-100 dark:to-purple-500/20 text-indigo-700 dark:text-indigo-300 font-black flex items-center justify-center text-sm shadow-sm border border-indigo-200/50 dark:border-indigo-500/30">
                        {memberName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 dark:text-white flex items-center">
                          {memberName} {isMe && <span className="text-xs font-semibold text-slate-400 dark:text-slate-500 ml-1.5 bg-white dark:bg-white/10 px-2 py-0.5 rounded-md shadow-sm border border-slate-200 dark:border-transparent">You</span>}
                        </p>
                        {isThisMemberAdmin && <p className="text-[10px] font-black tracking-widest text-amber-500 uppercase flex items-center mt-1"><Crown className="h-3 w-3 mr-1"/> Admin</p>}
                      </div>
                    </div>
                    {isAdmin && !isMe && (
                      <button onClick={() => handleRemoveMember(memberUid, memberName)} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 transition-colors p-2 bg-white dark:bg-black/20 rounded-lg opacity-0 group-hover:opacity-100 shadow-sm border border-slate-200 dark:border-white/5 hover:border-red-200 dark:hover:border-red-500/30" title="Remove Member">
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!isAdmin && (
              <button onClick={() => handleRemoveMember(user.uid, "Yourself")} className="w-full flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500 dark:hover:bg-red-600 hover:text-white px-5 py-3.5 rounded-2xl font-bold transition-all border border-red-100 dark:border-red-500/20 shadow-sm">
                <LogOut className="h-4 w-4 mr-2" /> Leave Adventure
              </button>
            )}
          </div>

          {/* PACKING LIST WIDGET */}
          <div className="bg-white dark:bg-[#0f172a] rounded-[2rem] border border-slate-100 dark:border-white/10 shadow-sm p-8 sticky top-32 transition-colors">
            <h3 className="text-xl font-black text-slate-900 dark:text-white mb-6 flex items-center"><BaggageClaim className="h-6 w-6 mr-3 text-emerald-500 dark:text-emerald-400"/> Checklist</h3>
            
            <form onSubmit={handleAddPackingItem} className="flex gap-2 mb-6 relative">
              <input 
                type="text" 
                value={newItemName} 
                onChange={(e) => setNewItemName(e.target.value)} 
                placeholder="Add items..." 
                className="flex-1 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-2xl pl-4 pr-24 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all text-sm font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500" 
              />
              <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 bg-slate-900 dark:bg-indigo-600 text-white px-4 rounded-xl text-xs font-bold hover:bg-indigo-600 dark:hover:bg-indigo-500 transition-colors shadow-md">
                Add
              </button>
            </form>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {packingItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-12 w-12 bg-slate-50 dark:bg-white/5 rounded-full flex items-center justify-center mx-auto mb-3"><CheckSquare className="h-5 w-5 text-slate-300 dark:text-slate-600"/></div>
                  <p className="text-sm font-medium text-slate-400 dark:text-slate-500">Your bag is empty.</p>
                </div>
              ) : (
                packingItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between group p-3 bg-slate-50 dark:bg-white/5 hover:bg-white dark:hover:bg-white/10 rounded-xl transition-all border border-transparent hover:border-slate-200 dark:hover:border-white/10 hover:shadow-sm cursor-pointer" onClick={() => handleTogglePackingItem(item.id, item.isChecked)}>
                    <div className="flex items-center gap-3 flex-1">
                      {item.isChecked ? (
                        <div className="h-6 w-6 rounded-md bg-emerald-500 dark:bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-inner"><CheckSquare className="h-4 w-4" /></div>
                      ) : (
                        <div className="h-6 w-6 rounded-md bg-white dark:bg-transparent border-2 border-slate-300 dark:border-slate-600 flex items-center justify-center shrink-0"></div>
                      )}
                      <span className={`text-sm font-bold transition-all ${item.isChecked ? 'line-through text-slate-400 dark:text-slate-600' : 'text-slate-700 dark:text-slate-200'}`}>{item.name}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePackingItem(item.id); }} className="text-slate-300 dark:text-slate-600 hover:text-red-500 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all p-2 bg-white dark:bg-white/5 hover:bg-red-50 dark:hover:bg-red-500/20 rounded-lg shadow-sm border border-slate-100 dark:border-transparent" title="Delete item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ACTIVITY MODAL */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] p-8 md:p-10 w-full max-w-lg shadow-2xl relative transform transition-all border border-transparent dark:border-white/10">
            <button onClick={() => !isSubmitting && closeActivityModal()} className="absolute top-6 right-6 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 p-2.5 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center mb-8">
              <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-2xl flex items-center justify-center mr-4 border border-transparent dark:border-indigo-500/30">
                {editingActivityId ? <Edit2 className="h-6 w-6" /> : <Plus className="h-6 w-6" />}
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900 dark:text-white">
                  {editingActivityId ? "Edit Activity" : "Add to Itinerary"}
                </h2>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">
                  {editingActivityId ? "Update your schedule details." : "Create a new schedule block."}
                </p>
              </div>
            </div>

            <form onSubmit={handleSubmitActivity} className="flex flex-col gap-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Title / Event Name</label>
                  <input type="text" value={actTitle} onChange={(e) => setActTitle(e.target.value)} placeholder="e.g. Flight to Tokyo" className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all font-bold text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600" required />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Category</label>
                  <select value={actType} onChange={(e) => setActType(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all font-bold text-slate-900 dark:text-white cursor-pointer appearance-none">
                    <option value="flight">✈️ Flight</option>
                    <option value="hotel">🏨 Hotel</option>
                    <option value="food">🍽️ Food</option>
                    <option value="activity">🎯 Activity</option>
                  </select>
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Reference / PNR</label>
                  <input type="text" value={actTrackingNum} onChange={(e) => setActTrackingNum(e.target.value.toUpperCase())} placeholder="e.g. 6E 214" className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all font-bold text-slate-900 dark:text-white tracking-wide uppercase placeholder-slate-400 dark:placeholder-slate-600" />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Date</label>
                  <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all font-bold text-slate-900 dark:text-white cursor-pointer dark:[color-scheme:dark]" required />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Time</label>
                  <input type="time" value={actTime} onChange={(e) => setActTime(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all font-bold text-slate-900 dark:text-white cursor-pointer dark:[color-scheme:dark]" required />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 h-5 w-5 text-slate-400 dark:text-slate-500" />
                    <input type="text" value={actLocation} onChange={(e) => setActLocation(e.target.value)} placeholder="Address or Maps link" className="w-full pl-12 pr-4 py-4 bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600" />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mb-2">Notes</label>
                  <textarea value={actNotes} onChange={(e) => setActNotes(e.target.value)} placeholder="Booking instructions, dress code, etc." rows={2} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-500 focus:bg-white dark:focus:bg-[#1e293b] transition-all font-medium text-slate-900 dark:text-white resize-none placeholder-slate-400 dark:placeholder-slate-600" />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-slate-100 dark:border-white/10">
                <button type="button" onClick={closeActivityModal} className="px-6 py-3.5 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-2xl font-bold transition-colors w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 text-white bg-slate-900 dark:bg-indigo-600 hover:bg-indigo-600 dark:hover:bg-indigo-500 rounded-2xl shadow-xl hover:shadow-indigo-500/30 dark:shadow-indigo-900/30 font-black transition-all w-full sm:w-auto disabled:opacity-70 flex justify-center items-center">
                  {isSubmitting ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : (editingActivityId ? "Save Changes" : "Add Event")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}