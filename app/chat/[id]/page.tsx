"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, signOut, User as FirebaseUser } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import NotificationBell from "../../components/NotificationBell";
import { sendGroupNotification } from "../../lib/notifications";
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Menu, X, BedDouble, Plane, MessageSquare, Send, Loader2, ArrowLeft, Trash2, Smile, Check, CheckCheck, Clock, Eye, Info, History, LogOut } from "lucide-react";
import EmojiPicker from 'emoji-picker-react';

interface Message {
  id: string;
  text: string;
  senderId: string;
  senderName: string;
  createdAt: any;
  seenBy?: string[];
  reactions?: Record<string, string[]>;
}

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '🙏'];

export default function TripChatPage() {
  const params = useParams();
  const router = useRouter();
  const tripId = params.id as string;

  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [user, setUser] = useState<FirebaseUser | null>(null);
  
  const [tripName, setTripName] = useState("Loading Trip...");
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [infoMessageId, setInfoMessageId] = useState<string | null>(null);
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/"); 
      } else {
        setUser(currentUser);
        setIsAuthLoading(false);
      }
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!tripId || !user) return;

    const fetchTrip = async () => {
      const tripDoc = await getDoc(doc(db, "trips", tripId));
      if (tripDoc.exists()) {
        const data = tripDoc.data();
        if (!data.members?.includes(user.uid)) {
          alert("You are not a member of this trip.");
          router.push("/");
          return;
        }
        setTripName(data.title);
        setMemberNames(data.memberNames || {});
      }
    };
    fetchTrip();

    const q = query(collection(db, "trips", tripId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
      setMessages(msgs);
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);

      msgs.forEach(msg => {
        if (msg.senderId !== user.uid && (!msg.seenBy || !msg.seenBy.includes(user.uid))) {
          updateDoc(doc(db, "trips", tripId, "messages", msg.id), {
            seenBy: arrayUnion(user.uid)
          }).catch(err => console.error("Error updating read receipt:", err));
        }
      });
    });

    const tq = query(collection(db, "trips", tripId, "typing"));
    const unsubscribeTyping = onSnapshot(tq, (snapshot) => {
      const typing = snapshot.docs
        .map(doc => doc.data())
        .filter(d => d.isTyping && d.uid !== user.uid)
        .map(d => d.name);
      setTypingUsers(typing);
    });

    return () => { unsubscribeMessages(); unsubscribeTyping(); };
  }, [tripId, user, router]);

  const handleInputText = (text: string) => {
    setNewMessage(text);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      const scrollH = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = Math.min(scrollH, 120) + 'px';
      setIsScrolled(scrollH > 120);
    }

    if (!user) return;

    setDoc(doc(db, "trips", tripId, "typing", user.uid), { 
      uid: user.uid, 
      name: user.displayName?.split(' ')[0] || "Someone", 
      isTyping: true 
    }, { merge: true });

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      setDoc(doc(db, "trips", tripId, "typing", user.uid), { isTyping: false }, { merge: true });
    }, 2000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setNewMessage(""); 
    setShowEmojiPicker(false);
    setIsScrolled(false);
    
    if (textareaRef.current) {
      textareaRef.current.style.height = isMobile ? '44px' : '56px';
    }
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setDoc(doc(db, "trips", tripId, "typing", user.uid), { isTyping: false }, { merge: true });

    try {
      const shortName = user.displayName?.split(' ')[0] || "Someone";
      
      await addDoc(collection(db, "trips", tripId, "messages"), {
        text: messageText,
        senderId: user.uid,
        senderName: shortName,
        createdAt: serverTimestamp(),
        seenBy: [],
        reactions: {}
      });

      await sendGroupNotification(
        tripId, 
        user.uid, 
        shortName,
        messageText.length > 30 ? messageText.substring(0, 30) + '...' : messageText, 
        'chat'
      );

    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  const handleDeleteMessage = async (msgId: string) => {
    if (confirm("Delete this message for everyone?")) {
      try {
        await deleteDoc(doc(db, "trips", tripId, "messages", msgId));
        setSelectedMessageId(null);
      } catch (err) {
        console.error("Error deleting message:", err);
      }
    }
  };

  const handleReact = async (msgId: string, emoji: string) => {
    if (!user) return;
    
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const currentReactions = msg.reactions || {};
    const updates: Record<string, any> = {};

    if (currentReactions[emoji]?.includes(user.uid)) {
      updates[`reactions.${emoji}`] = arrayRemove(user.uid);
    } else {
      Object.keys(currentReactions).forEach(key => {
        if (currentReactions[key]?.includes(user.uid)) {
          updates[`reactions.${key}`] = arrayRemove(user.uid);
        }
      });
      updates[`reactions.${emoji}`] = arrayUnion(user.uid);
    }

    try {
      await updateDoc(doc(db, "trips", tripId, "messages", msgId), updates);
      setSelectedMessageId(null);
    } catch (err) {
      console.error("Error reacting:", err);
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      router.push("/");
    } catch (error) {
      console.error(error);
    }
  };

  const handleTouchStart = (msgId: string) => {
    touchTimerRef.current = setTimeout(() => {
      setSelectedMessageId(msgId);
    }, 500);
  };
  
  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp) return "";
    return timestamp.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const getDateLabel = (timestamp: any) => {
    if (!timestamp) return "Today";
    const date = timestamp.toDate();
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) return "Today";
    if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
    return date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const renderMessageText = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split('\n').map((line, i) => (
      <span key={i} className="block min-h-[1.5rem]">
        {line.split(urlRegex).map((part, j) => 
          urlRegex.test(part) ? (
            <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-emerald-300 hover:text-emerald-100 underline decoration-emerald-400/50 underline-offset-2">
              {part}
            </a>
          ) : part
        )}
      </span>
    ));
  };

  if (isAuthLoading || !user) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFDFD] dark:bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors duration-300 selection:bg-emerald-500/20" onClick={() => setSelectedMessageId(null)}>
      
      {infoMessageId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-zinc-900/40 dark:bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setInfoMessageId(null)}>
          <div className="bg-white dark:bg-zinc-900 p-8 rounded-3xl w-[320px] shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-bold text-lg flex items-center gap-2 tracking-tight"><CheckCheck className="text-emerald-500" /> Message Info</h3>
              <button onClick={() => setInfoMessageId(null)} className="p-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-800 rounded-full transition-colors"><X className="h-4 w-4 text-zinc-400" /></button>
            </div>
            
            <div className="space-y-4">
              <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-zinc-200 dark:border-zinc-800 pb-2">Read by</p>
              
              {(() => {
                const msg = messages.find(m => m.id === infoMessageId);
                const viewers = msg?.seenBy?.filter(id => id !== user.uid).map(id => memberNames[id] || "Someone") || [];
                
                if (viewers.length === 0) {
                  return <p className="text-zinc-500 font-medium text-sm">Delivered, but nobody has read it yet.</p>;
                }
                
                return viewers.map((v, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white flex items-center justify-center font-bold text-xs shadow-inner">
                      {v.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-bold text-zinc-900 dark:text-white tracking-tight">{v}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden" onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); }} />
      )}

      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transform transition-all duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`} onClick={e => e.stopPropagation()}>
        <div className="h-20 flex items-center justify-between px-8 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-3 shadow-sm">
              <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>
        
        <nav className="flex-1 px-4 py-8 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Map className="h-5 w-5 mr-3 opacity-70" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Calendar className="h-5 w-5 mr-3 opacity-70" /> Itineraries</Link>
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><MessageSquare className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Group Chat</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><BedDouble className="h-5 w-5 mr-3 opacity-70" /> Book Hotels</Link>
          <Link href="/history" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><History className="h-5 w-5 mr-3 opacity-70" /> Trip History</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Settings className="h-5 w-5 mr-3 opacity-70" /> Settings</Link>
          
          <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <Link href="/about" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
              <Info className="h-5 w-5 mr-3 opacity-70" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen relative bg-zinc-50 dark:bg-zinc-950">
        <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] dark:opacity-[0.1] mix-blend-overlay pointer-events-none"></div>
        <div className="absolute top-[10%] right-[-10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

        <div className="md:hidden h-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-4 shrink-0 z-30 sticky top-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => router.push(`/trips/${tripId}`)} className="p-2 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-full transition-colors"><ArrowLeft className="h-5 w-5" /></button>
          
          <div className="flex flex-col items-center flex-1 min-w-0 px-2">
            <span className="font-bold text-zinc-900 dark:text-white truncate w-full text-center tracking-tight">{tripName}</span>
            {typingUsers.length > 0 && <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-500 truncate w-full text-center">{typingUsers.join(', ')} is typing</span>}
          </div>
          
          <div className="flex items-center gap-2">
            <NotificationBell />
            <div className="h-8 w-8 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold flex items-center justify-center text-xs shadow-inner border border-zinc-200 dark:border-zinc-700 overflow-hidden shrink-0">
              {user?.photoURL ? (
                <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
              ) : (
                user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"
              )}
            </div>
            <button onClick={() => setIsMobileMenuOpen(true)} className="p-1.5 -mr-1.5 text-zinc-600 dark:text-zinc-400 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
          </div>
        </div>

        <header className="hidden md:flex h-24 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 items-center justify-between px-10 z-20 shrink-0 sticky top-0" onClick={e => e.stopPropagation()}>
          <div>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-zinc-400" />
              <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter">{tripName}</h2>
            </div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-1 h-4 transition-all">
              {typingUsers.length > 0 ? (
                <span className="text-emerald-500 animate-pulse">{typingUsers.join(', ')} is typing...</span>
              ) : "End-to-End Encrypted Group Chat"}
            </p>
          </div>
          
          <div className="flex items-center gap-6">
            <NotificationBell />
            <Link href={`/trips/${tripId}`} className="flex items-center text-xs font-bold uppercase tracking-widest text-zinc-600 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900 px-5 py-3 rounded-full transition-colors border border-zinc-200 dark:border-zinc-800 shadow-sm active:scale-95">
              <ArrowLeft className="h-4 w-4 mr-2" /> Itinerary
            </Link>
            
            <div className="h-8 w-px bg-zinc-200 dark:bg-zinc-800/80"></div>

            <div className="flex items-center gap-4">
              <div className="h-10 w-10 rounded-full bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-white font-bold flex items-center justify-center text-sm shadow-inner border border-zinc-200 dark:border-zinc-700 overflow-hidden">
                {user?.photoURL ? (
                  <img src={user.photoURL} alt="Profile" className="h-full w-full object-cover" />
                ) : (
                  user?.displayName?.charAt(0).toUpperCase() || user?.email?.charAt(0).toUpperCase() || "U"
                )}
              </div>

              <button 
                onClick={handleLogout} 
                title="Log Out"
                className="flex items-center justify-center h-10 w-10 rounded-full text-zinc-400 dark:text-zinc-500 hover:text-rose-500 dark:hover:text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-950/50 transition-all"
              >
                <LogOut className="h-[22px] w-[22px]" strokeWidth={2} />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar z-10 flex flex-col relative">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 text-emerald-500 animate-spin" /></div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="h-20 w-20 bg-zinc-100 dark:bg-zinc-900 rounded-full flex items-center justify-center mb-6 shadow-sm border border-zinc-200 dark:border-zinc-800">
                <MessageSquare className="h-8 w-8 text-zinc-400" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-900 dark:text-white tracking-tight mb-2">Start the conversation</h3>
              <p className="text-zinc-500 dark:text-zinc-400 font-medium max-w-sm text-sm">Say hello to your travel crew and start planning the details of your trip.</p>
            </div>
          ) : (
            <div className="space-y-4 max-w-4xl mx-auto w-full pb-4">
              {messages.map((msg, index) => {
                const isMe = msg.senderId === user.uid;
                const showName = !isMe && (index === 0 || messages[index - 1].senderId !== msg.senderId);
                
                const currentDate = getDateLabel(msg.createdAt);
                const previousDate = index > 0 ? getDateLabel(messages[index - 1].createdAt) : null;
                const showDateDivider = currentDate !== previousDate;

                const isSent = !!msg.createdAt;
                const isSeen = msg.seenBy && msg.seenBy.length > 0;

                return (
                  <div key={msg.id} className="flex flex-col">
                    {showDateDivider && (
                      <div className="flex justify-center my-8">
                        <span className="bg-zinc-200/50 dark:bg-zinc-800/50 text-zinc-500 dark:text-zinc-400 text-[10px] font-bold uppercase tracking-widest px-4 py-1.5 rounded-full border border-zinc-300/50 dark:border-zinc-700/50 backdrop-blur-sm">
                          {currentDate}
                        </span>
                      </div>
                    )}

                    <div 
                      className={`flex flex-col relative group ${isMe ? "items-end" : "items-start"} mt-2 animate-in fade-in slide-in-from-bottom-2`}
                      onClick={(e) => e.stopPropagation()} 
                    >
                      {showName && (
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-1.5 ml-14">
                          {msg.senderName}
                        </span>
                      )}

                      <div className={`flex items-end gap-3 max-w-[85%] md:max-w-[70%] relative ${isMe ? 'flex-row-reverse' : ''}`}>
                        
                        {!isMe && (
                          <div className={`h-8 w-8 rounded-full text-zinc-900 dark:text-white font-bold flex items-center justify-center text-xs shrink-0 shadow-sm mb-1 ${showName ? 'bg-zinc-200 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700' : 'opacity-0'}`}>
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        <div 
                          className={`px-5 py-3.5 rounded-3xl shadow-sm relative cursor-pointer ${
                            isMe ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 rounded-br-sm" : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 border border-zinc-200 dark:border-zinc-800 rounded-bl-sm"
                          }`}
                          onDoubleClick={() => setSelectedMessageId(msg.id)}
                          onTouchStart={() => handleTouchStart(msg.id)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchEnd}
                        >
                          <p className="text-[15px] font-medium leading-relaxed break-words whitespace-pre-wrap">{renderMessageText(msg.text)}</p>
                          
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} flex gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-full px-2 py-0.5 shadow-md text-xs z-10`}>
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                users.length > 0 && (
                                  <span 
                                    key={emoji} 
                                    onClick={(e) => { e.stopPropagation(); handleReact(msg.id, emoji); }}
                                    className="cursor-pointer hover:scale-125 transition-transform select-none"
                                    title={users.includes(user.uid) ? "Click to remove" : ""}
                                  >
                                    {emoji} {users.length > 1 && <span className="text-[10px] text-zinc-500 font-bold">{users.length}</span>}
                                  </span>
                                )
                              ))}
                            </div>
                          )}
                        </div>

                        {selectedMessageId === msg.id && (
                          <div className={`absolute top-full mt-3 flex flex-col gap-1 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-2xl rounded-2xl p-2 z-50 animate-in zoom-in-95 duration-100 ${isMe ? 'right-0' : 'left-12'}`}>
                            
                            <div className="flex items-center gap-2 px-2 border-b border-zinc-100 dark:border-zinc-800 pb-2 mb-1">
                              {REACTION_EMOJIS.map(emoji => (
                                <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className="hover:scale-125 transition-transform p-1.5 text-xl bg-zinc-50 dark:bg-zinc-800 rounded-full">{emoji}</button>
                              ))}
                            </div>

                            {isMe && (
                              <button onClick={() => { setInfoMessageId(msg.id); setSelectedMessageId(null); }} className="flex items-center gap-3 w-full px-3 py-2 text-sm font-bold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 rounded-xl transition-colors">
                                <Info className="h-4 w-4 text-zinc-400" /> Message Info
                              </button>
                            )}

                            {isMe && (
                              <button onClick={() => handleDeleteMessage(msg.id)} className="flex items-center gap-3 w-full px-3 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-xl transition-colors">
                                <Trash2 className="h-4 w-4" /> Delete for everyone
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      <div className={`flex items-center gap-1.5 mt-1.5 ${isMe ? "mr-2" : "ml-12"}`}>
                        <span className="text-[10px] font-bold text-zinc-400">{formatTime(msg.createdAt)}</span>
                        {isMe && (
                          <span className="text-zinc-400">
                            {!isSent ? <Clock className="h-3 w-3" /> : isSeen ? <CheckCheck className="h-3.5 w-3.5 text-emerald-500" /> : <Check className="h-3.5 w-3.5" />}
                          </span>
                        )}
                      </div>

                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>
          )}
        </main>

        <div className="bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-t border-zinc-200 dark:border-zinc-800 p-2 md:p-6 shrink-0 z-20 sticky bottom-0" onClick={e => e.stopPropagation()}>
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-end gap-2 md:gap-3">
            
            <div className="relative flex-1 flex items-center">
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-2 md:mb-4 left-0 z-50 shadow-2xl animate-in slide-in-from-bottom-2">
                  <EmojiPicker 
                    onEmojiClick={(emojiData) => { 
                      handleInputText(newMessage + emojiData.emoji); 
                      setShowEmojiPicker(false); 
                    }}
                    theme={"auto" as any}
                    width={isMobile ? window.innerWidth - 16 : 350}
                    height={400}
                  />
                </div>
              )}

              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="absolute left-2 md:left-4 bottom-[8px] md:bottom-3 text-zinc-400 hover:text-emerald-500 transition-colors p-2">
                <Smile className="h-5 w-5 md:h-6 md:w-6" />
              </button>

              <textarea
                ref={textareaRef}
                value={newMessage}
                onChange={(e) => handleInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && !isMobile) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder={isMobile ? "Message..." : "Type your message... (Shift+Enter for new line)"}
                className={`w-full bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl md:rounded-[28px] pl-12 pr-4 md:pl-14 md:pr-6 py-3 md:py-4 outline-none focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 transition-all font-medium text-sm md:text-base text-zinc-900 dark:text-white placeholder-zinc-500 resize-none ${isScrolled ? 'overflow-y-auto' : 'overflow-hidden'} min-h-[44px] md:min-h-[56px] max-h-[120px] leading-tight md:leading-[24px] custom-scrollbar`}
                rows={1}
                style={{ height: newMessage ? undefined : (isMobile ? '44px' : '56px') }}
              />
            </div>

            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="h-[44px] w-[44px] md:h-[56px] md:w-[56px] shrink-0 bg-emerald-500 text-zinc-950 rounded-full flex items-center justify-center hover:bg-emerald-400 transition-all shadow-[0_0_15px_rgba(16,185,129,0.3)] disabled:opacity-50 disabled:shadow-none disabled:bg-zinc-200 dark:disabled:bg-zinc-800 active:scale-95 group mb-[0px]"
            >
              <Send className="h-5 w-5 md:h-6 w-6 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}