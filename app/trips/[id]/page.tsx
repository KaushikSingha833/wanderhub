"use client";
import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, collection, addDoc, onSnapshot, query, where, orderBy, updateDoc, arrayRemove, deleteField, deleteDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../../lib/firebase"; 
import { ArrowLeft, Calendar, Plus, Plane, Hotel, Utensils, Map as MapIcon, Clock, Crown, UserMinus, LogOut, Users, CheckSquare, Square, Trash2, BaggageClaim } from "lucide-react";

interface Trip {
  id: string; title: string; startDate: string; endDate: string; inviteCode?: string;
  adminId?: string; members?: string[]; memberNames?: Record<string, string>;
}
interface Activity { id: string; title: string; type: string; date: string; time: string; }
interface PackingItem { id: string; name: string; isChecked: boolean; }

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

  // --- MEMBER LOGIC (Still here!) ---
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

  // --- ACTIVITY LOGIC (Still here!) ---
  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle || !actDate || !actTime) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, "activities"), { tripId, title: actTitle, type: actType, date: actDate, time: actTime, location: actLocation, notes: actNotes, trackingNumber: actTrackingNum, createdAt: new Date() });
      setActTitle(""); setIsActivityModalOpen(false);
    } catch (error) { console.error("Error adding activity:", error); } 
    finally { setIsSubmitting(false); }
  };

  // --- NEW PACKING LIST LOGIC ---
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

  if (isLoading || !user) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  if (!trip) return <div className="min-h-screen flex items-center justify-center">Trip not found!</div>;

  const isAdmin = user.uid === trip.adminId;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 pb-20">
      
      {/* HEADER (Still here!) */}
      <div className="bg-white border-b border-slate-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <button onClick={() => router.push('/')} className="flex items-center text-sm font-medium text-slate-500 hover:text-indigo-600 transition-colors mb-4"><ArrowLeft className="h-4 w-4 mr-2" /> Back to Dashboard</button>
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-bold text-slate-900">{trip.title}</h1>
                {trip.inviteCode && (
                  <div className="bg-emerald-100 border border-emerald-200 text-emerald-800 px-3 py-1 rounded-lg flex items-center shadow-sm">
                    <span className="text-xs font-semibold mr-2 uppercase">Invite Code:</span><span className="font-mono font-bold tracking-wider">{trip.inviteCode}</span>
                  </div>
                )}
              </div>
              <div className="flex items-center text-slate-500 mt-2 font-medium text-sm"><Calendar className="h-4 w-4 mr-2 text-slate-400" />{trip.startDate} to {trip.endDate}</div>
            </div>
            <button onClick={() => setIsActivityModalOpen(true)} className="flex items-center bg-indigo-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-indigo-700 shadow-sm"><Plus className="h-4 w-4 mr-2" /> Add Activity</button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 mt-8 grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* LEFT COLUMN: TIMELINE (Still here!) */}
        <div className="lg:col-span-2">
          {activities.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center border-dashed"><MapIcon className="h-8 w-8 mx-auto mb-4 text-indigo-300" /><h2 className="text-xl font-bold text-slate-800 mb-2">Itinerary is empty</h2><p className="text-slate-500">Add flights and hotels to build your schedule!</p></div>
          ) : (
            <div className="space-y-6 relative before:absolute before:inset-0 before:ml-5 before:-translate-x-px md:before:mx-auto md:before:translate-x-0 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
              {activities.map((act) => (
                <div key={act.id} className="relative flex items-center justify-between md:justify-normal md:odd:flex-row-reverse group">
                  <div className="flex items-center justify-center w-10 h-10 rounded-full border-4 border-slate-50 bg-white shadow shrink-0 md:order-1 md:group-odd:-translate-x-1/2 md:group-even:translate-x-1/2 z-10">{getIcon(act.type)}</div>
                  <div className="w-[calc(100%-4rem)] md:w-[calc(50%-2.5rem)] bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                    <div className="flex justify-between mb-1"><span className="text-xs font-bold uppercase text-indigo-600">{act.type}</span><div className="flex items-center text-slate-400 text-sm"><Clock className="h-3 w-3 mr-1" /> {act.time}</div></div>
                    <h3 className="font-bold text-lg">{act.title}</h3><p className="text-sm text-slate-500 mt-1">{act.date}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: GROUPS & PACKING LIST */}
        <div className="lg:col-span-1 space-y-6">
          
          {/* GROUP MEMBERS (Still here!) */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center"><Users className="h-5 w-5 mr-2 text-indigo-600"/> Group Members</h3>
            <div className="space-y-3 mb-6">
              {trip.members?.map((memberUid) => {
                const isThisMemberAdmin = memberUid === trip.adminId;
                const isMe = memberUid === user.uid;
                const memberName = trip.memberNames?.[memberUid] || "Unknown Traveler";

                return (
                  <div key={memberUid} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-600 font-bold flex items-center justify-center text-sm">{memberName.charAt(0).toUpperCase()}</div>
                      <div>
                        <p className="font-semibold text-sm text-slate-900 flex items-center">{memberName} {isMe && <span className="text-xs font-normal text-slate-400 ml-1">(You)</span>}</p>
                        {isThisMemberAdmin && <p className="text-xs font-bold text-amber-500 flex items-center mt-0.5"><Crown className="h-3 w-3 mr-1"/> Admin</p>}
                      </div>
                    </div>
                    {isAdmin && !isMe && (
                      <button onClick={() => handleRemoveMember(memberUid, memberName)} className="text-slate-400 hover:text-red-500 transition-colors p-1" title="Kick out"><UserMinus className="h-4 w-4" /></button>
                    )}
                  </div>
                );
              })}
            </div>
            {!isAdmin && (
              <button onClick={() => handleRemoveMember(user.uid, "Yourself")} className="w-full flex items-center justify-center bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2.5 rounded-xl font-medium transition-colors border border-red-100"><LogOut className="h-4 w-4 mr-2" /> Leave Trip</button>
            )}
          </div>

          {/* NEW PACKING LIST UI */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 sticky top-32">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center"><BaggageClaim className="h-5 w-5 mr-2 text-indigo-600"/> Packing List</h3>
            <form onSubmit={handleAddPackingItem} className="flex gap-2 mb-4">
              <input type="text" value={newItemName} onChange={(e) => setNewItemName(e.target.value)} placeholder="e.g., Passports..." className="flex-1 border border-slate-300 rounded-xl p-2.5 outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              <button type="submit" className="bg-indigo-600 text-white px-4 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-colors">Add</button>
            </form>
            <div className="space-y-1 max-h-60 overflow-y-auto pr-1">
              {packingItems.length === 0 ? (
                <p className="text-sm text-slate-500 text-center py-4">Nothing added yet.</p>
              ) : (
                packingItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between group p-2 hover:bg-slate-50 rounded-lg transition-colors border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-3 cursor-pointer flex-1" onClick={() => handleTogglePackingItem(item.id, item.isChecked)}>
                      {item.isChecked ? <CheckSquare className="h-5 w-5 text-emerald-500" /> : <Square className="h-5 w-5 text-slate-300" />}
                      <span className={`text-sm font-medium transition-all ${item.isChecked ? 'line-through text-slate-400' : 'text-slate-700'}`}>{item.name}</span>
                    </div>
                    <button onClick={() => handleDeletePackingItem(item.id)} className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all p-1.5" title="Delete item"><Trash2 className="h-4 w-4" /></button>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>
      </div>

      {/* MODAL CODE (Still here!) */}
      {isActivityModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md">
            <h2 className="text-2xl font-bold mb-6">Add to Itinerary</h2>
            <form onSubmit={handleAddActivity} className="flex flex-col gap-4">
              <input type="text" value={actTitle} onChange={(e) => setActTitle(e.target.value)} placeholder="Title" className="w-full border p-3 rounded-xl outline-none" required />
              <select value={actType} onChange={(e) => setActType(e.target.value)} className="w-full border p-3 rounded-xl outline-none"><option value="flight">Flight</option><option value="hotel">Hotel</option><option value="food">Food</option><option value="activity">Activity</option></select>
              <div className="flex gap-4"><input type="date" value={actDate} onChange={(e) => setActDate(e.target.value)} className="w-full border p-3 rounded-xl outline-none" required /><input type="time" value={actTime} onChange={(e) => setActTime(e.target.value)} className="w-full border p-3 rounded-xl outline-none" required /></div>
              <input type="text" value={actLocation} onChange={(e) => setActLocation(e.target.value)} placeholder="Address or Location (Optional)" className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm" />
              <textarea value={actNotes} onChange={(e) => setActNotes(e.target.value)} placeholder="Booking notes, PNR, instructions (Optional)" rows={3} className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm resize-none" />
                <input 
                type="text" 
                value={actTrackingNum} 
                onChange={(e) => setActTrackingNum(e.target.value.toUpperCase())} 
                placeholder="Flight/Train No. (e.g., 6E 214 or 12004) - Optional" 
                className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-sm font-medium tracking-wide" 
              />
              <div className="flex justify-end gap-3 mt-4"><button type="button" onClick={() => setIsActivityModalOpen(false)} className="px-5 py-2.5 bg-slate-100 rounded-xl">Cancel</button><button type="submit" className="px-5 py-2.5 text-white bg-indigo-600 rounded-xl">{isSubmitting ? "Saving..." : "Add"}</button></div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}