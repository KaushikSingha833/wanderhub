"use client";
import { useState, useEffect, useRef } from "react";
import { collection, query, orderBy, onSnapshot, updateDoc, doc, limit } from "firebase/firestore";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase";
import { Bell, CheckCircle2, MessageSquare, MapPin } from "lucide-react";
import toast from "react-hot-toast";
import { requestPushPermission } from "../lib/push";

interface AppNotification {
  id: string;
  title: string;
  message: string;
  type: 'chat' | 'vote' | 'system';
  isRead: boolean;
  createdAt: any;
}

export default function NotificationBell() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  const isInitialLoad = useRef(true);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, setUser);
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      unsubscribeAuth();
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "users", user.uid, "notifications"),
      orderBy("createdAt", "desc"),
      limit(20)
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetched = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as AppNotification[];
      setNotifications(fetched);
      snapshot.docChanges().forEach((change) => {
        if (change.type === "added" && !isInitialLoad.current) {
          const data = change.doc.data() as AppNotification;
          if (!data.isRead) {
            toast(data.message, { 
              icon: data.type === 'chat' ? '💬' : data.type === 'vote' ? '🔥' : '✈️',
            });
          }
        }
      });
      setTimeout(() => { isInitialLoad.current = false; }, 1000);
    });
    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (notifId: string) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, "users", user.uid, "notifications", notifId), { isRead: true });
    } catch (err) {
      console.error("Error marking read:", err);
    }
  };

  const markAllAsRead = () => {
    notifications.filter(n => !n.isRead).forEach(n => markAsRead(n.id));
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const timeAgo = (timestamp: any) => {
    if (!timestamp) return "Just now";
    const seconds = Math.floor((new Date().getTime() - timestamp.toDate().getTime()) / 1000);
    if (seconds < 60) return "Just now";
    if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
    if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
    return `${Math.floor(seconds / 86400)}d ago`;
  };

  if (!user) return null;

  return (
    <div className="relative" ref={dropdownRef}>
      {/* The Bell Button */}
      <button 
        onClick={() => setIsOpen(!isOpen)} 
        className="relative p-2 text-slate-600 dark:text-slate-300 hover:bg-white/20 dark:hover:bg-white/10 rounded-full transition-colors"
      >
        <Bell className="h-6 w-6" />
        {unreadCount > 0 && (
          <span className="absolute top-1.5 right-1.5 h-3 w-3 bg-red-500 border-2 border-white/50 dark:border-white/10 rounded-full animate-pulse"></span>
        )}
      </button>

      {/* The Dropdown Menu */}
      {isOpen && (
        /* 🚀 LIQUID GLASS CORE CLASSES APPLIED HERE 🚀 */
        <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white/40 dark:bg-[#0f172a]/50 backdrop-blur-3xl backdrop-saturate-[1.5] border border-white/50 dark:border-white/10 shadow-liquid dark:shadow-liquid-dark rounded-2xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-2">
          
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/30 dark:border-white/10 bg-white/20 dark:bg-black/20">
            <h3 className="font-black text-slate-900 dark:text-white">Notifications</h3>
            {unreadCount > 0 && (
              <button onClick={markAllAsRead} className="text-xs font-bold text-indigo-700 dark:text-indigo-400 hover:text-indigo-900 dark:hover:text-indigo-300 transition-colors">
                Mark all read
              </button>
            )}
          </div>

          <div className="bg-indigo-500/10 dark:bg-indigo-500/20 px-4 py-2 border-b border-white/20 dark:border-white/5 flex justify-between items-center backdrop-blur-md">
            <span className="text-[11px] font-semibold text-indigo-800 dark:text-indigo-300">Want alerts when the app is closed?</span>
            <button 
              onClick={async () => {
                const token = await requestPushPermission(user.uid);
                if (token) toast.success("Push notifications enabled!");
                else toast.error("Please allow notifications in your browser settings.");
              }}
              className="text-xs bg-indigo-600/90 hover:bg-indigo-500 text-white px-2 py-1 rounded shadow-sm font-bold transition-colors border border-white/20"
            >
              Enable Push
            </button>
          </div>

          <div className="max-h-[400px] overflow-y-auto custom-scrollbar p-2 space-y-1">
            {notifications.length === 0 ? (
              <div className="text-center py-8">
                <Bell className="h-8 w-8 text-slate-400 dark:text-slate-500 mx-auto mb-2 opacity-50" />
                <p className="text-sm font-medium text-slate-600 dark:text-slate-400">You're all caught up!</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div 
                  key={notif.id} 
                  onClick={() => !notif.isRead && markAsRead(notif.id)}
                  className={`flex items-start gap-3 p-3 rounded-xl cursor-pointer transition-colors ${notif.isRead ? 'hover:bg-white/30 dark:hover:bg-white/5' : 'bg-white/40 dark:bg-indigo-500/20 hover:bg-white/50 dark:hover:bg-indigo-500/30 shadow-sm border border-white/40 dark:border-white/5'}`}
                >
                  <div className={`mt-1 shrink-0 h-8 w-8 rounded-full flex items-center justify-center shadow-sm border ${notif.isRead ? 'bg-white/50 border-white/60 dark:bg-white/5 dark:border-white/10 text-slate-500' : 'bg-gradient-to-br from-indigo-400/30 to-blue-400/30 border-white/60 dark:border-white/20 text-indigo-700 dark:text-indigo-300 backdrop-blur-md'}`}>
                    {notif.type === 'chat' ? <MessageSquare className="h-4 w-4" /> : notif.type === 'vote' ? <MapPin className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm tracking-tight ${notif.isRead ? 'font-medium text-slate-700 dark:text-slate-300' : 'font-bold text-slate-900 dark:text-white'}`}>
                      {notif.message}
                    </p>
                    <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 uppercase tracking-widest">{timeAgo(notif.createdAt)}</p>
                  </div>
                  {!notif.isRead && <div className="h-2 w-2 rounded-full bg-indigo-500 mt-2 shrink-0 shadow-[0_0_8px_rgba(99,102,241,0.8)]"></div>}
                </div>
              ))
            )}
          </div>

        </div>
      )}
    </div>
  );
}