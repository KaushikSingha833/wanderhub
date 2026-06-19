"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc, onSnapshot, query, where, orderBy, updateDoc, arrayRemove, deleteField, deleteDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { sendGroupNotification } from "../../lib/notifications";
import { ArrowLeft, Calendar, Plus, Plane, Hotel, Utensils, Map as MapIcon, Clock, Crown, UserMinus, LogOut, Users, CheckSquare, Square, Trash2, BaggageClaim, MapPin, FileText, Hash, X, Edit2, Heart, X as XIcon, Trophy, Flame, ExternalLink, ThumbsUp, Loader2, Star } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion"; 

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
  rating: number | string; 
  reviews: number;         
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

  // --- FEATURE: Voting Logic ---
  const handleVote = async (pollId: string, vote: "yes" | "no") => {
    if (!user) return;
    setSwipeDirection(vote === "yes" ? "right" : "left");
    
    setTimeout(async () => {
      try {
        await updateDoc(doc(db, "trips", tripId, "hotel_polls", pollId), {
          [`votes.${user.uid}`]: vote
        });
        
        // Trigger the Global Notification
        await sendGroupNotification(
          tripId, 
          user.uid, 
          user.displayName?.split(' ')[0] || "Someone", 
          vote === "yes" ? "Just upvoted a hotel!" : "Just vetoed a hotel.", 
          'vote'
        );
        
        setSwipeDirection(null);
      } catch (error) {
        console.error("Error casting vote:", error);
      }
    }, 200);
  };

  const getIcon = (type: string) => {
    switch(type) {
      case 'flight': return <Plane className="h-5 w-5 text-zinc-900 dark:text-white" />;
      case 'hotel': return <Hotel className="h-5 w-5 text-zinc-900 dark:text-white" />;
      case 'food': return <Utensils className="h-5 w-5 text-zinc-900 dark:text-white" />;
      default: return <MapIcon className="h-5 w-5 text-zinc-900 dark:text-white" />;
    }
  };

  if (isLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors"><div className="animate-spin h-10 w-10 border-4 border-emerald-500 border-t-transparent rounded-full"></div></div>;
  if (!trip) return <div className="min-h-screen flex items-center justify-center bg-zinc-50 dark:bg-zinc-950 transition-colors"><div className="text-center"><MapIcon className="h-16 w-16 mx-auto text-zinc-300 dark:text-zinc-700 mb-4"/><h2 className="text-2xl font-bold text-zinc-700 dark:text-zinc-300 tracking-tight">Trip not found</h2><button onClick={() => router.push('/')} className="mt-4 text-emerald-600 dark:text-emerald-400 font-bold hover:underline">Return Home</button></div></div>;

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
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 pb-24 selection:bg-emerald-500/30 transition-colors duration-300">
      
      {/* EDITORIAL HERO BANNER SECTION */}
      <div className="relative h-[40vh] md:h-[50vh] w-full bg-zinc-900 dark:bg-black overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tripImageUrl} alt={trip.title} className="absolute inset-0 w-full h-full object-cover opacity-70 dark:opacity-50 transition-opacity" />
        <div className="absolute inset-0 bg-gradient-to-t from-zinc-50 dark:from-zinc-950 via-zinc-950/40 to-zinc-950/20 transition-colors"></div>
        
        <div className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
          <button onClick={() => router.push('/')} className="flex items-center text-xs font-bold uppercase tracking-widest text-white bg-white/10 hover:bg-white/20 backdrop-blur-md px-5 py-2.5 rounded-full transition-all border border-white/20">
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </button>
        </div>

        <div className="absolute bottom-12 md:bottom-16 left-0 w-full px-6 md:px-12 z-20 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-[10px] font-bold uppercase tracking-widest mb-4 shadow-sm">
                <Calendar className="h-3 w-3" /> 
                {new Date(trip.startDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} — {new Date(trip.endDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
              </div>
              <h1 className="text-5xl md:text-7xl font-black text-white tracking-tighter drop-shadow-lg leading-tight">{trip.title}</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {trip.inviteCode && (
                <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-5 py-3 rounded-full flex items-center shadow-lg cursor-pointer hover:bg-white/20 transition-all" title="Share this code">
                  <span className="text-[10px] font-bold mr-3 uppercase tracking-widest opacity-80">Invite Code</span>
                  <span className="font-mono font-black tracking-widest text-lg">{trip.inviteCode}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT OVERLAP */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-6 md:-mt-8 relative z-30 grid grid-cols-1 xl:grid-cols-3 gap-8 md:gap-12">
        
        {/* LEFT COLUMN: MAIN CONTENT AREA */}
        <div className="xl:col-span-2">
          
          {/* ✨ EDITORIAL TAB NAVIGATION */}
          <div className="flex gap-8 mb-8 border-b border-zinc-200 dark:border-zinc-800 w-full overflow-x-auto custom-scrollbar pb-1">
            <button 
              onClick={() => setActiveTab("itinerary")} 
              className={`flex items-center pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === "itinerary" ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}
            >
              <Calendar className="h-4 w-4 mr-2" /> Itinerary
            </button>
            <button 
              onClick={() => setActiveTab("voting")} 
              className={`flex items-center pb-4 text-xs font-bold uppercase tracking-widest transition-all border-b-2 whitespace-nowrap ${activeTab === "voting" ? "border-zinc-900 dark:border-white text-zinc-900 dark:text-white" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}
            >
              <Flame className="h-4 w-4 mr-2" /> Voting Room
              {unvotedPolls.length > 0 && <span className="ml-2 bg-emerald-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full">{unvotedPolls.length}</span>}
            </button>
          </div>

          {/* ==================================================== */}
          {/* TAB 1: ITINERARY VIEW                                */}
          {/* ==================================================== */}
          {activeTab === "itinerary" && (
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="flex items-center justify-between mb-8 transition-colors">
                <div>
                  <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Timeline</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 text-sm font-medium mt-1">Your detailed day-by-day plan.</p>
                </div>
                <button onClick={openAddModal} className="flex items-center bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-6 py-3 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-all shadow-md active:scale-95">
                  <Plus className="h-4 w-4 mr-2" /> Add Event
                </button>
              </div>

              {activities.length === 0 ? (
                <div className="bg-white dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[300px] transition-colors">
                  <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mb-6">
                    <MapIcon className="h-8 w-8 text-zinc-400 dark:text-zinc-500" />
                  </div>
                  <h2 className="text-xl font-bold text-zinc-800 dark:text-white mb-2">Blank Canvas</h2>
                  <p className="text-zinc-500 dark:text-zinc-400 font-medium max-w-sm mx-auto text-sm">Your itinerary is currently empty. Start adding flights, hotels, or dinner reservations.</p>
                </div>
              ) : (
                <div className="relative transition-colors">
                  <div className="absolute left-6 md:left-8 top-8 bottom-8 w-[2px] bg-zinc-200 dark:bg-zinc-800"></div>
                  
                  <div className="space-y-8">
                    {activities.map((act) => (
                      <div key={act.id} className="relative flex items-start gap-6 group">
                        <div className="relative z-10 flex items-center justify-center w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-zinc-50 dark:border-zinc-950 bg-white dark:bg-zinc-900 shadow-sm group-hover:scale-110 transition-all duration-300 shrink-0">
                          {getIcon(act.type)}
                        </div>
                        <div className="flex-1 relative bg-white dark:bg-zinc-900/50 p-6 md:p-8 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm hover:border-zinc-300 dark:hover:border-zinc-700 transition-all duration-300 group-hover:-translate-y-1">
                          
                          <div className="absolute top-4 right-4 flex opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-zinc-900 backdrop-blur-sm rounded-full p-1 border border-zinc-200 dark:border-zinc-800">
                            <button onClick={() => openEditModal(act)} className="p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors" title="Edit Activity">
                              <Edit2 className="h-4 w-4" />
                            </button>
                            <button onClick={() => handleDeleteActivity(act.id)} className="p-2 text-zinc-400 hover:text-red-500 transition-colors" title="Delete Activity">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>

                          <div className="flex flex-wrap justify-between items-start gap-4 mb-4 pr-16">
                            <div className="flex items-center gap-3">
                              <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 border border-zinc-200 dark:border-zinc-700 px-3 py-1 rounded-full">{act.type}</span>
                              <span className="text-xs font-bold text-zinc-500 dark:text-zinc-400 flex items-center uppercase tracking-widest"><Calendar className="h-3.5 w-3.5 mr-1.5" /> {act.date}</span>
                            </div>
                            <div className="flex items-center text-zinc-900 dark:text-white font-black text-lg md:text-xl tracking-tight">
                              {act.time}
                            </div>
                          </div>
                          
                          <h3 className="font-black text-2xl text-zinc-900 dark:text-white mb-4 tracking-tight">{act.title}</h3>
                          
                          {(act.location || act.trackingNumber || act.notes) && (
                            <div className="bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl p-5 space-y-3 border border-zinc-100 dark:border-zinc-800/50">
                              {act.trackingNumber && (
                                <div className="flex items-center text-sm font-bold text-zinc-700 dark:text-zinc-300">
                                  <Hash className="h-4 w-4 mr-2 text-zinc-400 shrink-0" /> {act.trackingNumber}
                                </div>
                              )}
                              {act.location && (
                                <div className="flex items-start text-sm font-medium text-zinc-600 dark:text-zinc-400">
                                  <MapPin className="h-4 w-4 mr-2 text-zinc-400 shrink-0 mt-0.5" /> {act.location}
                                </div>
                              )}
                              {act.notes && (
                                <div className="flex items-start text-sm text-zinc-500 dark:text-zinc-400 italic">
                                  <FileText className="h-4 w-4 mr-2 text-zinc-400 shrink-0 mt-0.5" /> "{act.notes}"
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
                <div className="flex-1 flex flex-col items-center justify-center relative w-full pt-4 sm:pt-8">
                  <div className="absolute top-0 text-center w-full px-4">
                    <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight">Curate the Trip</h3>
                    <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-2 uppercase tracking-widest">Swipe Right to approve, Left to reject.</p>
                  </div>

                  <div className="relative w-[92%] sm:w-full max-w-sm h-[450px] sm:h-[480px] mx-auto mt-20 sm:mt-24 perspective-1000">
                    <AnimatePresence>
                      {unvotedPolls.map((poll, index) => {
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
                            className={`absolute inset-0 bg-white dark:bg-zinc-900 rounded-[2rem] sm:rounded-[2.5rem] shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden flex flex-col cursor-grab active:cursor-grabbing ${isFront ? 'z-50' : 'z-40 pointer-events-none'}`}
                            style={{ originY: 1 }}
                          >
                            <div className="relative h-1/2 sm:h-3/5 w-full bg-zinc-200 dark:bg-zinc-800 shrink-0">
                              {/* eslint-disable-next-line @next/next/no-img-element */}
                              <img src={poll.imageUrl} alt={poll.name} className="w-full h-full object-cover pointer-events-none" />
                              <div className="absolute inset-0 bg-gradient-to-t from-zinc-900/80 via-zinc-900/20 to-transparent"></div>
                              
                              <div className="absolute top-4 left-4 bg-white/90 dark:bg-black/60 backdrop-blur-md px-3 py-1.5 rounded-full text-xs font-bold text-zinc-900 dark:text-white flex items-center shadow-sm">
                                <Star className="h-3.5 w-3.5 mr-1 fill-zinc-900 dark:fill-white text-zinc-900 dark:text-white" /> {poll.rating}
                              </div>
                            </div>
                            
                            <div className="p-5 sm:p-8 flex flex-col flex-1 pointer-events-none select-none">
                              <h3 className="text-2xl font-black text-zinc-900 dark:text-white line-clamp-2 sm:line-clamp-1 mb-2 tracking-tight leading-tight">{poll.name}</h3>
                              <p className="text-xs sm:text-sm font-medium text-zinc-500 dark:text-zinc-400 flex items-center truncate mb-auto"><MapPin className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1.5 shrink-0" /> {poll.location}</p>
                              
                              <div className="flex items-end justify-between mt-4 border-t border-zinc-100 dark:border-zinc-800/50 pt-4">
                                <div>
                                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Price</p>
                                  <p className="text-xl sm:text-2xl font-black text-zinc-900 dark:text-white">₹{poll.pricePerNight}<span className="text-xs sm:text-sm font-medium text-zinc-500">/nt</span></p>
                                </div>
                                <div className="text-right">
                                  <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-0.5">Suggested by</p>
                                  <p className="text-xs sm:text-sm font-bold text-zinc-900 dark:text-white">{poll.suggestedByName.split(' ')[0]}</p>
                                </div>
                              </div>
                            </div>
                          </motion.div>
                        );
                      })}
                    </AnimatePresence>
                  </div>

                  <div className="flex items-center justify-center gap-6 mt-10 z-50">
                    <button 
                      onClick={() => handleVote(unvotedPolls[0].id, "no")}
                      className="h-16 w-16 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-rose-500 shadow-xl border border-zinc-200 dark:border-zinc-800 hover:scale-110 hover:bg-rose-50 dark:hover:bg-rose-500/10 transition-all active:scale-95"
                    >
                      <XIcon className="h-8 w-8" strokeWidth={2.5} />
                    </button>
                    <button 
                      onClick={() => handleVote(unvotedPolls[0].id, "yes")}
                      className="h-16 w-16 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-emerald-500 shadow-xl border border-zinc-200 dark:border-zinc-800 hover:scale-110 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 transition-all active:scale-95"
                    >
                      <Heart className="h-8 w-8 fill-emerald-500" strokeWidth={2.5} />
                    </button>
                  </div>
                </div>
              ) : (
                
              /* 2. CONSENSUS LEADERBOARD */
                <div className="flex-1 bg-white dark:bg-zinc-900/50 rounded-[2rem] sm:rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm p-6 sm:p-10 animate-in zoom-in-95 duration-500">
                  <div className="text-center mb-10">
                    <div className="h-16 w-16 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center text-zinc-900 dark:text-white mx-auto mb-6">
                      <Trophy className="h-8 w-8" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-black text-zinc-900 dark:text-white tracking-tight mb-2">Group Consensus</h3>
                    <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">You've voted on all suggestions. Here are the standings.</p>
                  </div>

                  {leaderboard.length === 0 ? (
                     <div className="text-center p-8 border border-dashed border-zinc-300 dark:border-zinc-700 rounded-[2rem] bg-zinc-50 dark:bg-zinc-900/30">
                       <p className="text-sm sm:text-base text-zinc-500 font-medium">No hotels have been suggested yet.</p>
                       <button onClick={() => router.push('/hotels')} className="mt-4 px-6 py-2 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-full text-xs font-bold uppercase tracking-widest hover:opacity-90 transition-opacity">Go to Hotel Search</button>
                     </div>
                  ) : (
                    <div className="space-y-4">
                      {leaderboard.map((hotel, index) => {
                        const yesVotes = Object.values(hotel.votes || {}).filter(v => v === 'yes').length;
                        const noVotes = Object.values(hotel.votes || {}).filter(v => v === 'no').length;
                        const isWinner = index === 0 && yesVotes > 0;

                        return (
                          <div key={hotel.id} className={`relative flex items-center gap-4 p-4 rounded-[1.5rem] border ${isWinner ? 'bg-emerald-50/50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30' : 'bg-zinc-50 dark:bg-zinc-950/50 border-zinc-200 dark:border-zinc-800'} transition-colors overflow-hidden`}>
                            
                            {isWinner && (
                              <div className="absolute -top-2 -left-2 bg-emerald-500 text-zinc-950 h-8 w-8 rounded-full flex items-center justify-center shadow-lg transform -rotate-12 border-2 border-white dark:border-zinc-900">
                                <Crown className="h-4 w-4" />
                              </div>
                            )}

                            <div className="font-black text-xl sm:text-2xl text-zinc-300 dark:text-zinc-700 w-6 text-center">#{index + 1}</div>
                            
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={hotel.imageUrl} alt="" className="h-14 w-14 sm:h-16 sm:w-16 rounded-xl object-cover shrink-0" />
                            
                            <div className="flex-1 min-w-0 pr-2">
                              <h4 className="font-bold text-zinc-900 dark:text-white text-base sm:text-lg truncate tracking-tight">{hotel.name}</h4>
                              <p className="text-[11px] sm:text-xs font-bold text-zinc-500 dark:text-zinc-400 mt-0.5">₹{hotel.pricePerNight} / night</p>
                            </div>

                            <div className="flex items-center gap-3 sm:gap-5 px-3 sm:px-5 border-x border-zinc-200 dark:border-zinc-800 shrink-0">
                              <div className="text-center">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">Yes</p>
                                <p className="text-base sm:text-lg font-black text-emerald-500">{yesVotes}</p>
                              </div>
                              <div className="text-center">
                                <p className="text-[9px] font-bold uppercase tracking-widest text-zinc-400">No</p>
                                <p className="text-base sm:text-lg font-black text-rose-500">{noVotes}</p>
                              </div>
                            </div>

                            <div className="pl-2 shrink-0">
                              {isWinner ? (
                                <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" className="bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-4 sm:px-6 py-2.5 sm:py-3 rounded-full font-bold text-xs uppercase tracking-widest transition-all hover:opacity-90 flex items-center whitespace-nowrap active:scale-95">
                                  Book <ExternalLink className="hidden sm:block h-3.5 w-3.5 ml-2" />
                                </a>
                              ) : (
                                <a href={hotel.bookingUrl} target="_blank" rel="noopener noreferrer" className="text-zinc-400 hover:text-zinc-900 dark:hover:text-white p-3 rounded-full hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors flex items-center justify-center">
                                  <ExternalLink className="h-4 w-4 sm:h-5 sm:w-5" />
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
          <div className="bg-white dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm p-8 transition-colors">
            <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-6 flex items-center uppercase tracking-widest"><Users className="h-5 w-5 mr-3 text-zinc-400"/> Travel Crew</h3>
            <div className="space-y-3 mb-8">
              {trip.members?.map((memberUid) => {
                const isThisMemberAdmin = memberUid === trip.adminId;
                const isMe = memberUid === user.uid;
                const memberName = trip.memberNames?.[memberUid] || "Unknown Traveler";

                return (
                  <div key={memberUid} className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950/50 rounded-2xl border border-zinc-200 dark:border-zinc-800 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-zinc-200 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold flex items-center justify-center text-sm shadow-inner">
                        {memberName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-zinc-900 dark:text-white flex items-center">
                          {memberName} {isMe && <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 ml-2 bg-white dark:bg-zinc-800 px-2 py-0.5 rounded-full border border-zinc-200 dark:border-zinc-700">You</span>}
                        </p>
                        {isThisMemberAdmin && <p className="text-[10px] font-bold tracking-widest text-emerald-500 uppercase flex items-center mt-1"><Crown className="h-3 w-3 mr-1"/> Admin</p>}
                      </div>
                    </div>
                    {isAdmin && !isMe && (
                      <button onClick={() => handleRemoveMember(memberUid, memberName)} className="text-zinc-400 hover:text-rose-500 transition-colors p-2 bg-white dark:bg-zinc-900 rounded-full opacity-0 group-hover:opacity-100 shadow-sm border border-zinc-200 dark:border-zinc-800 hover:border-rose-200 dark:hover:border-rose-900/50" title="Remove Member">
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!isAdmin && (
              <button onClick={() => handleRemoveMember(user.uid, "Yourself")} className="w-full flex items-center justify-center bg-transparent text-rose-500 hover:bg-rose-500 hover:text-white px-5 py-3 rounded-full font-bold text-sm uppercase tracking-widest transition-all border border-rose-500/30">
                <LogOut className="h-4 w-4 mr-2" /> Leave Adventure
              </button>
            )}
          </div>

          {/* PACKING LIST WIDGET */}
          <div className="bg-white dark:bg-zinc-900/50 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm p-8 sticky top-32 transition-colors">
            <h3 className="text-lg font-black text-zinc-900 dark:text-white mb-6 flex items-center uppercase tracking-widest"><BaggageClaim className="h-5 w-5 mr-3 text-zinc-400"/> Checklist</h3>
            
            <form onSubmit={handleAddPackingItem} className="flex gap-2 mb-6 relative">
              <input 
                type="text" 
                value={newItemName} 
                onChange={(e) => setNewItemName(e.target.value)} 
                placeholder="Add items..." 
                className="flex-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 rounded-full pl-5 pr-24 py-3 outline-none focus:ring-1 focus:ring-zinc-400 dark:focus:ring-zinc-600 transition-all text-sm font-medium text-zinc-900 dark:text-white placeholder-zinc-400" 
              />
              <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-5 rounded-full text-[10px] uppercase tracking-widest font-bold hover:opacity-90 transition-opacity">
                Add
              </button>
            </form>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {packingItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-10 w-10 bg-zinc-100 dark:bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-3"><CheckSquare className="h-4 w-4 text-zinc-300 dark:text-zinc-600"/></div>
                  <p className="text-sm font-medium text-zinc-400">Your bag is empty.</p>
                </div>
              ) : (
                packingItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between group p-3 bg-zinc-50 dark:bg-zinc-950/50 hover:bg-white dark:hover:bg-zinc-900 rounded-2xl transition-all border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 cursor-pointer" onClick={() => handleTogglePackingItem(item.id, item.isChecked)}>
                    <div className="flex items-center gap-4 flex-1">
                      {item.isChecked ? (
                        <div className="h-5 w-5 rounded border-2 border-emerald-500 bg-emerald-500 text-zinc-950 flex items-center justify-center shrink-0"><CheckSquare className="h-3 w-3" /></div>
                      ) : (
                        <div className="h-5 w-5 rounded border-2 border-zinc-300 dark:border-zinc-600 flex items-center justify-center shrink-0"></div>
                      )}
                      <span className={`text-sm font-bold transition-all ${item.isChecked ? 'line-through text-zinc-400 dark:text-zinc-600' : 'text-zinc-700 dark:text-zinc-200'}`}>{item.name}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePackingItem(item.id); }} className="text-zinc-300 dark:text-zinc-600 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-all p-2 bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full border border-zinc-100 dark:border-transparent" title="Delete item">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ACTIVITY MODAL (MINIMAL EDITORIAL) */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-zinc-950 rounded-[2rem] p-8 md:p-10 w-full max-w-lg shadow-2xl relative transform transition-all border border-zinc-200 dark:border-zinc-800">
            <button onClick={() => !isSubmitting && closeActivityModal()} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white bg-zinc-100 dark:bg-zinc-900 p-2.5 rounded-full transition-colors">
              <X className="h-4 w-4" />
            </button>
            
            <div className="mb-8">
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                {editingActivityId ? "Edit Activity" : "Add to Itinerary"}
              </h2>
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">
                {editingActivityId ? "Update your schedule details." : "Create a new schedule block."}
              </p>
            </div>

            <form onSubmit={handleSubmitActivity} className="flex flex-col gap-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Title / Event Name</label>
                  <input type="text" value={actTitle} onChange={(e) => setActTitle(e.target.value)} placeholder="Flight to Tokyo" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:ring-1 focus:ring-zinc-400 transition-all font-bold text-zinc-900 dark:text-white placeholder-zinc-400" required />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Category</label>
                  <select value={actType} onChange={(e) => setActType(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:ring-1 focus:ring-zinc-400 transition-all font-bold text-zinc-900 dark:text-white cursor-pointer appearance-none">
                    <option value="flight">✈️ Flight</option>
                    <option value="hotel">🏨 Hotel</option>
                    <option value="food">🍽️ Food</option>
                    <option value="activity">🎯 Activity</option>
                  </select>
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Reference / PNR</label>
                  <input type="text" value={actTrackingNum} onChange={(e) => setActTrackingNum(e.target.value.toUpperCase())} placeholder="6E 214" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:ring-1 focus:ring-zinc-400 transition-all font-bold text-zinc-900 dark:text-white tracking-wide uppercase placeholder-zinc-400" />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Date</label>
                  <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:ring-1 focus:ring-zinc-400 transition-all font-bold text-zinc-900 dark:text-white cursor-pointer dark:[color-scheme:dark]" required />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Time</label>
                  <input type="time" value={actTime} onChange={(e) => setActTime(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:ring-1 focus:ring-zinc-400 transition-all font-bold text-zinc-900 dark:text-white cursor-pointer dark:[color-scheme:dark]" required />
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 h-5 w-5 text-zinc-400" />
                    <input type="text" value={actLocation} onChange={(e) => setActLocation(e.target.value)} placeholder="Address or Maps link" className="w-full pl-12 pr-4 py-4 bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl outline-none focus:ring-1 focus:ring-zinc-400 transition-all font-medium text-zinc-900 dark:text-white placeholder-zinc-400" />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Notes</label>
                  <textarea value={actNotes} onChange={(e) => setActNotes(e.target.value)} placeholder="Booking instructions, dress code, etc." rows={2} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 rounded-xl outline-none focus:ring-1 focus:ring-zinc-400 transition-all font-medium text-zinc-900 dark:text-white resize-none placeholder-zinc-400" />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-zinc-200 dark:border-zinc-800">
                <button type="button" onClick={closeActivityModal} className="px-6 py-3 text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full text-sm font-bold uppercase tracking-widest transition-colors w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-3 text-white dark:text-zinc-950 bg-zinc-900 dark:bg-white hover:opacity-90 rounded-full text-sm font-bold uppercase tracking-widest transition-all w-full sm:w-auto disabled:opacity-50 flex justify-center items-center active:scale-95">
                  {isSubmitting ? <Loader2 className="h-5 w-5 animate-spin" /> : (editingActivityId ? "Save" : "Add Event")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}