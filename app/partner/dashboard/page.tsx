"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { onAuthStateChanged } from "firebase/auth";
import { doc, getDoc, collection, addDoc, query, where, onSnapshot, deleteDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; // Make sure path is correct!
import { Building2, Plus, BedDouble, Trash2, IndianRupee, Loader2, AlertTriangle, LogOut } from "lucide-react";
import { signOut } from "firebase/auth";

interface Room {
  id: string;
  name: string;
  price: number;
  description: string;
}

export default function PartnerDashboard() {
  const router = useRouter();
  
  // Auth & Security State
  const [userProfile, setUserProfile] = useState<any>(null);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);

  // Room Inventory State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isAddingRoom, setIsAddingRoom] = useState(false);
  
  // Form State
  const [newRoomName, setNewRoomName] = useState("");
  const [newRoomPrice, setNewRoomPrice] = useState("");
  const [newRoomDesc, setNewRoomDesc] = useState("");

  // 1. THE SECURITY BOUNCER
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        router.push("/"); // Not logged in? Kick them out.
        return;
      }

      try {
        // Fetch their profile from Firestore to check their role and status
        const docRef = doc(db, "users", user.uid);
        const docSnap = await getDoc(docRef);

        if (docSnap.exists()) {
          const profile = docSnap.data();
          
          if (profile.role !== "hotel_partner") {
            router.push("/"); // Just a traveler? Kick them out.
            return;
          }

          setUserProfile(profile);
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

  // 2. FETCH HOTEL'S ROOMS
  useEffect(() => {
    if (!userProfile || userProfile.verificationStatus !== "approved") return;

    // Listen to the 'rooms' collection, but ONLY grab rooms belonging to THIS hotel owner
    const q = query(collection(db, "rooms"), where("hotelOwnerId", "==", userProfile.uid));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const roomData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Room[];
      
      setRooms(roomData);
    });

    return () => unsubscribe();
  }, [userProfile]);

  // 3. ADD A NEW ROOM
  const handleAddRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName || !newRoomPrice || !userProfile) return;
    
    setIsAddingRoom(true);
    try {
      await addDoc(collection(db, "rooms"), {
        hotelOwnerId: userProfile.uid,
        hotelName: userProfile.hotelName,
        name: newRoomName,
        price: Number(newRoomPrice),
        description: newRoomDesc,
        city: userProfile.city, // <-- AUTOMATICALLY PULLS THE CITY FROM THEIR PROFILE!
        createdAt: new Date()
      });

      // Clear the form
      setNewRoomName("");
      setNewRoomPrice("");
      setNewRoomDesc("");
    } catch (error) {
      console.error("Error adding room:", error);
      alert("Failed to add room");
    } finally {
      setIsAddingRoom(false);
    }
  };

  // 4. DELETE A ROOM
  const handleDeleteRoom = async (roomId: string) => {
    if (confirm("Remove this room from your inventory?")) {
      await deleteDoc(doc(db, "rooms", roomId));
    }
  };

  const handleLogout = () => {
    signOut(auth);
    router.push("/");
  };


  // --- RENDER STATES ---

  if (isCheckingAuth) {
    return <div className="h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-8 w-8 animate-spin text-indigo-600" /></div>;
  }

  // PENDING STATE (They signed up, but you haven't approved them in /admin yet)
  if (userProfile?.verificationStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-amber-100">
          <AlertTriangle className="h-16 w-16 text-amber-500 mx-auto mb-6" />
          <h2 className="text-2xl font-black text-slate-900 mb-2">Account Pending</h2>
          <p className="text-slate-500 font-medium mb-6">
            Your application for <strong>{userProfile.hotelName}</strong> is currently being reviewed by our team. Please check back later.
          </p>
          <button onClick={handleLogout} className="text-slate-500 hover:text-slate-900 font-bold transition-colors">Log Out</button>
        </div>
      </div>
    );
  }

  // APPROVED DASHBOARD STATE
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      
      {/* SIDEBAR */}
      <aside className="w-full md:w-64 bg-slate-900 text-white shrink-0 flex flex-col">
        <div className="p-6 border-b border-slate-800">
          <div className="h-12 w-12 bg-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <Building2 className="h-6 w-6 text-white" />
          </div>
          <h2 className="text-lg font-black truncate">{userProfile.hotelName}</h2>
          <p className="text-slate-400 text-sm font-medium">Partner Dashboard</p>
        </div>
        <div className="p-4 flex-1">
          <div className="bg-slate-800 text-white px-4 py-3 rounded-xl font-medium flex items-center">
            <BedDouble className="h-5 w-5 mr-3 text-indigo-400" /> Inventory
          </div>
        </div>
        <div className="p-4 border-t border-slate-800">
          <button onClick={handleLogout} className="flex items-center text-slate-400 hover:text-white font-medium transition-colors w-full px-4 py-2">
            <LogOut className="h-5 w-5 mr-3" /> Sign Out
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 p-4 md:p-8 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          
          <div className="mb-8">
            <h1 className="text-3xl font-black text-slate-900">Manage Rooms</h1>
            <p className="text-slate-500 font-medium mt-1">Add inventory so travelers can book your hotel.</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            
            {/* ADD ROOM FORM */}
            <div className="lg:col-span-1">
              <div className="bg-white p-6 rounded-3xl shadow-sm border border-slate-200">
                <h3 className="text-lg font-bold text-slate-900 mb-6 flex items-center">
                  <Plus className="h-5 w-5 mr-2 text-indigo-600" /> Add New Room
                </h3>
                <form onSubmit={handleAddRoom} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Room Type / Name</label>
                    <input type="text" value={newRoomName} onChange={(e) => setNewRoomName(e.target.value)} placeholder="e.g. Deluxe King Suite" required className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Price per Night</label>
                    <div className="relative">
                      <IndianRupee className="absolute left-3.5 top-3.5 h-5 w-5 text-slate-400" />
                      <input type="number" value={newRoomPrice} onChange={(e) => setNewRoomPrice(e.target.value)} placeholder="2500" required className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium" />
                    </div>
                  </div>
                  {/* ADD THIS NEW DIV BLOCK FOR CITY */}
                  
                  <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                    <textarea value={newRoomDesc} onChange={(e) => setNewRoomDesc(e.target.value)} placeholder="Sea view, complimentary breakfast..." rows={3} className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none font-medium resize-none" />
                  </div>
                  <button type="submit" disabled={isAddingRoom} className="w-full bg-indigo-600 text-white font-bold py-3.5 rounded-xl hover:bg-indigo-700 shadow-md transition-all disabled:opacity-50">
                    {isAddingRoom ? "Adding..." : "Publish Room"}
                  </button>
                </form>
              </div>
            </div>

            {/* LIVE INVENTORY LIST */}
            <div className="lg:col-span-2">
              <div className="bg-white p-6 md:p-8 rounded-3xl shadow-sm border border-slate-200 min-h-[400px]">
                <h3 className="text-lg font-bold text-slate-900 mb-6">Current Inventory ({rooms.length})</h3>
                
                {rooms.length === 0 ? (
                  <div className="text-center py-16 border-2 border-dashed border-slate-200 rounded-2xl">
                    <BedDouble className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                    <h4 className="text-slate-500 font-medium">No rooms added yet.</h4>
                    <p className="text-slate-400 text-sm mt-1">Use the form to list your first room.</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {rooms.map(room => (
                      <div key={room.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 hover:border-indigo-200 transition-colors group">
                        <div className="mb-4 sm:mb-0">
                          <h4 className="font-bold text-slate-900 text-lg">{room.name}</h4>
                          <p className="text-sm text-slate-500 mt-1 max-w-md truncate">{room.description || "No description provided."}</p>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end sm:gap-6 shrink-0 border-t border-slate-200 pt-4 sm:border-0 sm:pt-0">
                          <div className="font-black text-indigo-600 text-xl flex items-center">
                            <IndianRupee className="h-5 w-5 mr-0.5" />{room.price}
                            <span className="text-xs text-slate-400 font-bold ml-1 uppercase">/ night</span>
                          </div>
                          <button onClick={() => handleDeleteRoom(room.id)} className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-colors" title="Delete Room">
                            <Trash2 className="h-5 w-5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </main>
    </div>
  );
}