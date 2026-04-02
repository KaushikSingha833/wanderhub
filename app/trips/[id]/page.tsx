"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc, onSnapshot, query, where, orderBy, updateDoc, arrayRemove, deleteField, deleteDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { ArrowLeft, Calendar, Plus, Plane, Hotel, Utensils, Map as MapIcon, Clock, Crown, UserMinus, LogOut, Users, CheckSquare, Square, Trash2, BaggageClaim, MapPin, FileText, Hash, X } from "lucide-react";

interface Trip {
  id: string; title: string; startDate: string; endDate: string; inviteCode?: string;
  adminId?: string; members?: string[]; memberNames?: Record<string, string>;
}
interface Activity { 
  id: string; title: string; type: string; date: string; time: string; 
  location?: string; notes?: string; trackingNumber?: string; 
}
interface PackingItem { id: string; name: string; isChecked: boolean; }

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
  const [isLoading, setIsLoading] = useState(true);

  // Modal State
  const [isActivityModalOpen, setIsActivityModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
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

  // 2. Fetch Data
  useEffect(() => {
    if (!tripId) return;
    const fetchTrip = async () => {
      const docSnap = await getDoc(doc(db, "trips", tripId));
      if (docSnap.exists()) setTrip({ id: docSnap.id, ...(docSnap.data() as Omit<Trip, 'id'>) });
    };

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

    fetchTrip();
    return () => { unsubActivities(); unsubPacking(); };
  }, [tripId]);

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
      else setTrip(prev => prev ? { ...prev, members: prev.members?.filter(id => id !== memberUid) } : null);
    } catch (error) { console.error("Error removing member:", error); }
  };

  // --- ACTIVITY LOGIC ---
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle || !actDate || !actTime) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "activities"), { tripId, title: actTitle, type: actType, date: actDate, time: actTime, location: actLocation, notes: actNotes, trackingNumber: actTrackingNum, createdAt: new Date() });
      setActTitle(""); setActLocation(""); setActNotes(""); setActTrackingNum("");
      setIsActivityModalOpen(false);
    } catch (error) { console.error("Error adding activity:", error); } 
    finally { setIsSubmitting(false); }
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

  const getIcon = (type: string) => {
    switch(type) {
      case 'flight': return <Plane className="h-5 w-5 text-sky-500" />;
      case 'hotel': return <Hotel className="h-5 w-5 text-indigo-500" />;
      case 'food': return <Utensils className="h-5 w-5 text-orange-500" />;
      default: return <MapIcon className="h-5 w-5 text-emerald-500" />;
    }
  };

  if (isLoading || !user) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  if (!trip) return <div className="min-h-screen flex items-center justify-center bg-slate-50"><div className="text-center"><MapIcon className="h-16 w-16 mx-auto text-slate-300 mb-4"/><h2 className="text-2xl font-bold text-slate-700">Trip not found</h2><button onClick={() => router.push('/')} className="mt-4 text-indigo-600 font-bold">Return Home</button></div></div>;

  const isAdmin = user.uid === trip.adminId;
  const tripImageUrl = getTripImage(trip.id);

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-24 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* HERO BANNER SECTION */}
      <div className="relative h-[35vh] md:h-[45vh] w-full bg-slate-900 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tripImageUrl} alt={trip.title} className="absolute inset-0 w-full h-full object-cover opacity-60" />
        <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/40 to-transparent"></div>
        
        {/* Top Navigation inside Hero */}
        <div className="absolute top-0 w-full p-6 flex justify-between items-center z-20">
          <button onClick={() => router.push('/')} className="flex items-center text-sm font-bold text-white bg-black/20 hover:bg-black/40 backdrop-blur-md px-4 py-2 rounded-full transition-all border border-white/10">
            <ArrowLeft className="h-4 w-4 mr-2" /> Dashboard
          </button>
        </div>

        {/* Hero Content */}
        <div className="absolute bottom-12 md:bottom-16 left-0 w-full px-6 md:px-12 z-20 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/20 text-white text-xs font-bold mb-4 shadow-sm">
                <Calendar className="h-3.5 w-3.5" /> 
                {new Date(trip.startDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric'})} — {new Date(trip.endDate).toLocaleDateString('en-US', {month: 'short', day: 'numeric', year: 'numeric'})}
              </div>
              <h1 className="text-4xl md:text-6xl font-black text-white tracking-tight drop-shadow-lg">{trip.title}</h1>
            </div>
            
            <div className="flex items-center gap-4">
              {trip.inviteCode && (
                <div className="bg-white/10 backdrop-blur-md border border-white/20 text-white px-4 py-2.5 rounded-2xl flex items-center shadow-lg cursor-pointer hover:bg-white/20 transition-all" title="Share this code">
                  <span className="text-xs font-medium mr-2 text-white/70 uppercase tracking-wider">Invite Code:</span>
                  <span className="font-mono font-bold tracking-widest text-lg">{trip.inviteCode}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* MAIN CONTENT OVERLAP */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 -mt-8 md:-mt-10 relative z-30 grid grid-cols-1 xl:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: TIMELINE */}
        <div className="xl:col-span-2">
          
          <div className="flex items-center justify-between bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 mb-8">
            <div>
              <h2 className="text-2xl font-black text-slate-900">Itinerary</h2>
              <p className="text-slate-500 text-sm font-medium mt-1">Your detailed day-by-day plan.</p>
            </div>
            <button onClick={() => setIsActivityModalOpen(true)} className="flex items-center bg-indigo-600 text-white px-5 py-3 rounded-2xl font-bold hover:bg-indigo-700 hover:shadow-lg hover:-translate-y-0.5 transition-all shadow-indigo-600/20">
              <Plus className="h-5 w-5 mr-2" /> Add Event
            </button>
          </div>

          {activities.length === 0 ? (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-12 text-center flex flex-col items-center justify-center min-h-[300px]">
              <div className="h-20 w-20 bg-indigo-50 rounded-full flex items-center justify-center mb-6">
                <MapIcon className="h-10 w-10 text-indigo-300" />
              </div>
              <h2 className="text-2xl font-black text-slate-800 mb-2">Blank Canvas</h2>
              <p className="text-slate-500 font-medium max-w-sm mx-auto">Your itinerary is currently empty. Start adding flights, hotels, or dinner reservations!</p>
            </div>
          ) : (
            <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-6 md:p-10 relative">
              {/* Vertical connecting line */}
              <div className="absolute left-11 md:left-14 top-10 bottom-10 w-0.5 bg-gradient-to-b from-indigo-100 via-slate-200 to-transparent"></div>
              
              <div className="space-y-8">
                {activities.map((act) => (
                  <div key={act.id} className="relative flex items-start gap-6 group">
                    
                    {/* Icon Node */}
                    <div className="relative z-10 flex items-center justify-center w-12 h-12 rounded-2xl border-4 border-white bg-slate-50 shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300 shrink-0">
                      {getIcon(act.type)}
                    </div>
                    
                    {/* Activity Card */}
                    <div className="flex-1 bg-white p-6 rounded-3xl border border-slate-100 shadow-sm hover:shadow-xl hover:border-indigo-100 transition-all duration-300 group-hover:-translate-y-1">
                      <div className="flex flex-wrap justify-between items-start gap-4 mb-3">
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] font-black uppercase tracking-widest text-indigo-600 bg-indigo-50 px-3 py-1 rounded-full">{act.type}</span>
                          <span className="text-sm font-bold text-slate-400 flex items-center"><Calendar className="h-3.5 w-3.5 mr-1.5" /> {act.date}</span>
                        </div>
                        <div className="flex items-center text-slate-900 font-black bg-slate-50 px-3 py-1 rounded-lg border border-slate-100">
                          <Clock className="h-4 w-4 mr-2 text-indigo-500" /> {act.time}
                        </div>
                      </div>
                      
                      <h3 className="font-black text-xl text-slate-900 mb-4">{act.title}</h3>
                      
                      {/* Rich Details Area */}
                      {(act.location || act.trackingNumber || act.notes) && (
                        <div className="bg-slate-50 rounded-2xl p-4 space-y-3 border border-slate-100">
                          {act.trackingNumber && (
                            <div className="flex items-center text-sm font-semibold text-slate-700">
                              <Hash className="h-4 w-4 mr-2 text-slate-400" /> {act.trackingNumber}
                            </div>
                          )}
                          {act.location && (
                            <div className="flex items-start text-sm font-medium text-slate-600">
                              <MapPin className="h-4 w-4 mr-2 text-slate-400 shrink-0 mt-0.5" /> {act.location}
                            </div>
                          )}
                          {act.notes && (
                            <div className="flex items-start text-sm text-slate-500 italic">
                              <FileText className="h-4 w-4 mr-2 text-slate-400 shrink-0 mt-0.5" /> "{act.notes}"
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

        {/* RIGHT COLUMN: GROUPS & PACKING LIST */}
        <div className="xl:col-span-1 space-y-8">
          
          {/* GROUP MEMBERS WIDGET */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center"><Users className="h-6 w-6 mr-3 text-indigo-600"/> Travel Crew</h3>
            <div className="space-y-3 mb-8">
              {trip.members?.map((memberUid) => {
                const isThisMemberAdmin = memberUid === trip.adminId;
                const isMe = memberUid === user.uid;
                const memberName = trip.memberNames?.[memberUid] || "Unknown Traveler";

                return (
                  <div key={memberUid} className="flex items-center justify-between p-3.5 bg-slate-50 hover:bg-slate-100 rounded-2xl border border-transparent hover:border-slate-200 transition-colors group">
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 font-black flex items-center justify-center text-sm shadow-sm border border-indigo-200/50">
                        {memberName.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-bold text-sm text-slate-900 flex items-center">
                          {memberName} {isMe && <span className="text-xs font-semibold text-slate-400 ml-1.5 bg-white px-2 py-0.5 rounded-md shadow-sm border border-slate-200">You</span>}
                        </p>
                        {isThisMemberAdmin && <p className="text-[10px] font-black tracking-widest text-amber-500 uppercase flex items-center mt-1"><Crown className="h-3 w-3 mr-1"/> Admin</p>}
                      </div>
                    </div>
                    {isAdmin && !isMe && (
                      <button onClick={() => handleRemoveMember(memberUid, memberName)} className="text-slate-300 hover:text-red-500 transition-colors p-2 bg-white rounded-lg opacity-0 group-hover:opacity-100 shadow-sm border border-slate-200 hover:border-red-200" title="Remove Member">
                        <UserMinus className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {!isAdmin && (
              <button onClick={() => handleRemoveMember(user.uid, "Yourself")} className="w-full flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-500 hover:text-white px-5 py-3.5 rounded-2xl font-bold transition-all border border-red-100 shadow-sm">
                <LogOut className="h-4 w-4 mr-2" /> Leave Adventure
              </button>
            )}
          </div>

          {/* PACKING LIST WIDGET */}
          <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm p-8 sticky top-32">
            <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center"><BaggageClaim className="h-6 w-6 mr-3 text-emerald-500"/> Checklist</h3>
            
            <form onSubmit={handleAddPackingItem} className="flex gap-2 mb-6 relative">
              <input 
                type="text" 
                value={newItemName} 
                onChange={(e) => setNewItemName(e.target.value)} 
                placeholder="Add items..." 
                className="flex-1 bg-slate-50 border border-slate-200 rounded-2xl pl-4 pr-24 py-3.5 outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all text-sm font-medium" 
              />
              <button type="submit" className="absolute right-1.5 top-1.5 bottom-1.5 bg-slate-900 text-white px-4 rounded-xl text-xs font-bold hover:bg-indigo-600 transition-colors shadow-md">
                Add
              </button>
            </form>

            <div className="space-y-2 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
              {packingItems.length === 0 ? (
                <div className="text-center py-8">
                  <div className="h-12 w-12 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-3"><CheckSquare className="h-5 w-5 text-slate-300"/></div>
                  <p className="text-sm font-medium text-slate-400">Your bag is empty.</p>
                </div>
              ) : (
                packingItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between group p-3 bg-slate-50 hover:bg-white rounded-xl transition-all border border-transparent hover:border-slate-200 hover:shadow-sm cursor-pointer" onClick={() => handleTogglePackingItem(item.id, item.isChecked)}>
                    <div className="flex items-center gap-3 flex-1">
                      {item.isChecked ? (
                        <div className="h-6 w-6 rounded-md bg-emerald-500 text-white flex items-center justify-center shrink-0 shadow-inner"><CheckSquare className="h-4 w-4" /></div>
                      ) : (
                        <div className="h-6 w-6 rounded-md bg-white border-2 border-slate-300 flex items-center justify-center shrink-0"></div>
                      )}
                      <span className={`text-sm font-bold transition-all ${item.isChecked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.name}</span>
                    </div>
                    <button onClick={(e) => { e.stopPropagation(); handleDeletePackingItem(item.id); }} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-2 bg-white hover:bg-red-50 rounded-lg shadow-sm border border-slate-100" title="Delete item">
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
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-[2.5rem] p-8 md:p-10 w-full max-w-lg shadow-2xl relative transform transition-all">
            <button onClick={() => !isSubmitting && setIsActivityModalOpen(false)} className="absolute top-6 right-6 text-slate-400 hover:text-slate-900 bg-slate-50 hover:bg-slate-100 p-2.5 rounded-full transition-colors">
              <X className="h-5 w-5" />
            </button>
            
            <div className="flex items-center mb-8">
              <div className="h-12 w-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mr-4">
                <Plus className="h-6 w-6" />
              </div>
              <div>
                <h2 className="text-2xl font-black text-slate-900">Add to Itinerary</h2>
                <p className="text-sm font-medium text-slate-500">Create a new schedule block.</p>
              </div>
            </div>

            <form onSubmit={handleAddActivity} className="flex flex-col gap-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Title / Event Name</label>
                  <input type="text" value={actTitle} onChange={(e) => setActTitle(e.target.value)} placeholder="e.g. Flight to Tokyo" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold text-slate-900" required />
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                  <select value={actType} onChange={(e) => setActType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold text-slate-900 cursor-pointer appearance-none">
                    <option value="flight">✈️ Flight</option>
                    <option value="hotel">🏨 Hotel</option>
                    <option value="food">🍽️ Food</option>
                    <option value="activity">🎯 Activity</option>
                  </select>
                </div>
                
                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Reference / PNR</label>
                  <input type="text" value={actTrackingNum} onChange={(e) => setActTrackingNum(e.target.value.toUpperCase())} placeholder="e.g. 6E 214" className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold text-slate-900 tracking-wide uppercase placeholder-normal" />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Date</label>
                  <input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold text-slate-900 cursor-pointer" required />
                </div>

                <div className="col-span-2 sm:col-span-1">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Time</label>
                  <input type="time" value={actTime} onChange={(e) => setActTime(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-bold text-slate-900 cursor-pointer" required />
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-4 top-4 h-5 w-5 text-slate-400" />
                    <input type="text" value={actLocation} onChange={(e) => setActLocation(e.target.value)} placeholder="Address or Maps link" className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-900" />
                  </div>
                </div>

                <div className="col-span-2">
                  <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Notes</label>
                  <textarea value={actNotes} onChange={(e) => setActNotes(e.target.value)} placeholder="Booking instructions, dress code, etc." rows={2} className="w-full bg-slate-50 border border-slate-200 p-4 rounded-2xl outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all font-medium text-slate-900 resize-none" />
                </div>
              </div>

              <div className="flex justify-end gap-3 mt-4 pt-6 border-t border-slate-100">
                <button type="button" onClick={() => setIsActivityModalOpen(false)} className="px-6 py-3.5 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold transition-colors w-full sm:w-auto">Cancel</button>
                <button type="submit" disabled={isSubmitting} className="px-8 py-3.5 text-white bg-slate-900 hover:bg-indigo-600 rounded-2xl shadow-xl hover:shadow-indigo-500/30 font-black transition-all w-full sm:w-auto disabled:opacity-70 flex justify-center items-center">
                  {isSubmitting ? <div className="h-5 w-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : "Add Event"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}