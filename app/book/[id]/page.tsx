"use client";
import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { doc, getDoc, addDoc, collection } from "firebase/firestore";
import { auth, db } from "../../lib/firebase"; // Check your firebase import path!
import { Loader2, ShieldCheck, MapPin, IndianRupee, CreditCard, Building2, CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function BookingCheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const [room, setRoom] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isBooking, setIsBooking] = useState(false);
  const [success, setSuccess] = useState(false);

  // Fetch the specific room from Firestore based on the URL ID
  useEffect(() => {
    const fetchRoomDetails = async () => {
      try {
        const docRef = doc(db, "rooms", roomId);
        const docSnap = await getDoc(docRef);
        
        if (docSnap.exists()) {
          setRoom({ id: docSnap.id, ...docSnap.data() });
        } else {
          alert("Room not found!");
          router.push("/hotels");
        }
      } catch (error) {
        console.error("Error fetching room:", error);
      } finally {
        setIsLoading(false);
      }
    };

    if (roomId) fetchRoomDetails();
  }, [roomId, router]);

  const handleConfirmBooking = async () => {
    const user = auth.currentUser;
    if (!user) {
      alert("Please log in to book this room!");
      return;
    }

    setIsBooking(true);
    try {
      // Create a "bookings" collection to save the reservation
      await addDoc(collection(db, "bookings"), {
        travelerId: user.uid,
        travelerEmail: user.email,
        hotelOwnerId: room.hotelOwnerId,
        roomId: room.id,
        hotelName: room.hotelName,
        roomName: room.name,
        pricePaid: room.price,
        bookingDate: new Date(),
        status: "confirmed"
      });

      setSuccess(true);
    } catch (error) {
      console.error("Error confirming booking:", error);
      alert("Failed to process booking.");
    } finally {
      setIsBooking(false);
    }
  };

  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50"><Loader2 className="h-10 w-10 animate-spin text-indigo-600" /></div>;
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4 font-sans">
        <div className="bg-white p-10 rounded-3xl shadow-xl max-w-md w-full text-center border border-emerald-100">
          <CheckCircle2 className="h-20 w-20 text-emerald-500 mx-auto mb-6" />
          <h2 className="text-3xl font-black text-slate-900 mb-2">Booking Confirmed!</h2>
          <p className="text-slate-500 font-medium mb-6">
            You are officially booked at <strong>{room.hotelName}</strong>. The hotel has been notified of your reservation.
          </p>
          <Link href="/itineraries" className="inline-block w-full bg-slate-900 text-white px-6 py-4 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg">
            View My Itinerary
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900 p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-8">
          <button onClick={() => router.back()} className="text-sm font-bold text-indigo-600 hover:text-indigo-800 mb-4 inline-block">&larr; Back to Search</button>
          <h1 className="text-3xl font-black text-slate-900 flex items-center">
            <ShieldCheck className="h-8 w-8 mr-3 text-emerald-500" /> Secure Checkout
          </h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Room Summary Card */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-3xl p-6 md:p-8 shadow-sm border border-slate-200">
              <div className="flex items-center mb-6">
                <div className="h-16 w-16 bg-indigo-50 rounded-2xl flex items-center justify-center mr-4">
                  <Building2 className="h-8 w-8 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-2xl font-black text-slate-900">{room.hotelName}</h2>
                  <p className="text-slate-500 font-medium flex items-center mt-1">
                    <MapPin className="h-4 w-4 mr-1" /> {room.city ? room.city.toUpperCase() : "Destination"}
                  </p>
                </div>
              </div>

              <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100 mb-6">
                <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Room Details</h3>
                <p className="text-xl font-bold text-slate-900 mb-2">{room.name}</p>
                <p className="text-slate-600">{room.description || "A beautiful room reserved exclusively for WanderHub travelers."}</p>
              </div>

              <div className="bg-emerald-50 text-emerald-700 p-4 rounded-2xl border border-emerald-100 flex items-start text-sm font-medium">
                <ShieldCheck className="h-5 w-5 mr-3 shrink-0" />
                <p>This is a WanderHub Partner property. Your booking is instantly confirmed directly with the hotel management.</p>
              </div>
            </div>
          </div>

          {/* Payment Summary */}
          <div className="md:col-span-1">
            <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 shadow-xl sticky top-8">
              <h3 className="text-lg font-bold mb-6 border-b border-slate-700 pb-4">Price Summary</h3>
              
              <div className="space-y-4 mb-6">
                <div className="flex justify-between items-center text-slate-300">
                  <span>1 Night</span>
                  <span className="flex items-center"><IndianRupee className="h-4 w-4" />{room.price}</span>
                </div>
                <div className="flex justify-between items-center text-slate-300">
                  <span>Taxes & Fees</span>
                  <span className="flex items-center"><IndianRupee className="h-4 w-4" />{(room.price * 0.12).toFixed(0)}</span>
                </div>
              </div>

              <div className="border-t border-slate-700 pt-4 mb-8">
                <div className="flex justify-between items-center">
                  <span className="font-bold">Total (INR)</span>
                  <span className="text-2xl font-black text-emerald-400 flex items-center">
                    <IndianRupee className="h-6 w-6" />
                    {(room.price + (room.price * 0.12)).toFixed(0)}
                  </span>
                </div>
              </div>

              <button 
                onClick={handleConfirmBooking}
                disabled={isBooking}
                className="w-full bg-indigo-500 hover:bg-indigo-600 text-white font-bold py-4 rounded-xl shadow-lg transition-all disabled:opacity-50 flex items-center justify-center text-lg"
              >
                {isBooking ? <Loader2 className="h-6 w-6 animate-spin" /> : <><CreditCard className="h-5 w-5 mr-2" /> Confirm Booking</>}
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}