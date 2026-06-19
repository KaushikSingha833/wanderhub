import { collection, query, where, getDocs } from "firebase/firestore";
import { db } from "./firebase";

export async function getOccupiedRoomIds(hotelId: string, requestedCheckIn: string, requestedCheckOut: string): Promise<string[]> {
  const reqStart = new Date(requestedCheckIn).getTime();
  const reqEnd = new Date(requestedCheckOut).getTime();

  const q = query(
    collection(db, "bookings"),
    where("partnerId", "==", hotelId),
    where("status", "in", ["Approved", "Confirmed"])
  );

  const snapshot = await getDocs(q);
  const occupiedRoomIds = new Set<string>();

  snapshot.forEach((doc) => {
    const booking = doc.data();
    const bookStart = new Date(booking.checkIn).getTime();
    const bookEnd = new Date(booking.checkOut).getTime();

    if (reqStart < bookEnd && reqEnd > bookStart) {
      occupiedRoomIds.add(booking.roomId);
    }
  });

  return Array.from(occupiedRoomIds);
}