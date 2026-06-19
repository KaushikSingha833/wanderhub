// lib/push.ts
import { getMessaging, getToken } from "firebase/messaging";
import { app } from "./firebase"; // Ensure this points to your firebase init file
import { doc, setDoc } from "firebase/firestore";
import { db } from "./firebase";

export const requestPushPermission = async (userId: string) => {
  try {
    // 1. Ask the browser for permission
    const permission = await Notification.requestPermission();
    
    if (permission === 'granted') {
      const messaging = getMessaging(app);
      
      // 2. Get the unique token using your specific VAPID key
      const token = await getToken(messaging, {
        vapidKey: "BGZ3JK3Ts_zGD_u70eljr_GeDC3Szxnj39BxJ77Z-cRvr-xSi6HIzTURV0zUgxTww8ru76fCY5Yq5MnOqe6SQes"
      });
      
      console.log("🔥 Push Token Generated:", token);

      // 3. Save this token to the user's Firestore profile so we know where to send alerts
      await setDoc(doc(db, "users", userId, "pushTokens"), {
        [token]: true 
      }, { merge: true });

      return token;
    } else {
      console.log("Push permission denied by user.");
      return null;
    }
  } catch (error) {
    console.error("Error getting push token:", error);
    return null;
  }
};