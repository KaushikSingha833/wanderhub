// lib/notifications.ts
import { collection, addDoc, getDoc, doc, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

export async function sendGroupNotification(
  tripId: string,
  senderId: string,
  senderName: string,
  message: string,
  type: 'chat' | 'vote' | 'system'
) {
  try {
    // 1. Fetch the trip to get the member list
    const tripDoc = await getDoc(doc(db, "trips", tripId));
    if (!tripDoc.exists()) return;

    const tripData = tripDoc.data();
    const members = tripData.members || [];

    // 2. Remove the sender (you don't want a notification for your own message)
    const recipients = members.filter((uid: string) => uid !== senderId);

    // 3. Fire notifications to everyone else simultaneously
    await Promise.all(recipients.map((uid: string) =>
      addDoc(collection(db, "users", uid, "notifications"), {
        title: tripData.title || "WanderHub Trip",
        message: `${senderName}: ${message}`,
        type: type,
        isRead: false,
        createdAt: serverTimestamp(),
        tripId: tripId
      })
    ));
    
  } catch (error) {
    console.error("Fan-out notification failed:", error);
  }
}