"use client";
import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, updateDoc, deleteDoc, arrayUnion, arrayRemove, setDoc } from "firebase/firestore";
import { auth, db } from "../../lib/firebase";
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Menu, X, BedDouble, Plane, MessageSquare, Send, Loader2, ArrowLeft, Trash2, Smile, Check, CheckCheck, Clock, Eye, Info } from "lucide-react";
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

  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [tripName, setTripName] = useState("Loading Trip...");
  const [memberNames, setMemberNames] = useState<Record<string, string>>({});
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Feature States
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [infoMessageId, setInfoMessageId] = useState<string | null>(null); // NEW: Message Info Modal State
  const [typingUsers, setTypingUsers] = useState<string[]>([]);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const touchTimerRef = useRef<NodeJS.Timeout | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) router.push("/");
      setUser(currentUser);
    });
    return () => unsubscribeAuth();
  }, [router]);

  useEffect(() => {
    if (!tripId || !user) return;

    // 1. Fetch Trip Data & Member Names
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

    // 2. Listen to Messages
    const q = query(collection(db, "trips", tripId, "messages"), orderBy("createdAt", "asc"));
    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const msgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Message[];
      setMessages(msgs);
      setIsLoading(false);
      setTimeout(scrollToBottom, 100);

      // Read Receipts Update: Mark unseen messages as seen
      msgs.forEach(msg => {
        if (msg.senderId !== user.uid && (!msg.seenBy || !msg.seenBy.includes(user.uid))) {
          updateDoc(doc(db, "trips", tripId, "messages", msg.id), {
            seenBy: arrayUnion(user.uid)
          }).catch(err => console.error("Error updating read receipt:", err));
        }
      });
    });

    // 3. Listen to Typing Indicators
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

  // --- FEATURE: Typing Indicator Sync ---
  const handleInputText = (text: string) => {
    setNewMessage(text);
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

  // --- FEATURE: Send Message ---
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    const messageText = newMessage.trim();
    setNewMessage(""); 
    setShowEmojiPicker(false);
    
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    setDoc(doc(db, "trips", tripId, "typing", user.uid), { isTyping: false }, { merge: true });

    try {
      await addDoc(collection(db, "trips", tripId, "messages"), {
        text: messageText,
        senderId: user.uid,
        senderName: user.displayName || user.email?.split('@')[0] || "Traveler",
        createdAt: serverTimestamp(),
        seenBy: [],
        reactions: {}
      });
    } catch (error) {
      console.error("Error sending message:", error);
    }
  };

  // --- FEATURE: Delete Message ---
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

  // --- FEATURE: Smart Reactions (Toggle/Replace) ---
  const handleReact = async (msgId: string, emoji: string) => {
    if (!user) return;
    
    const msg = messages.find(m => m.id === msgId);
    if (!msg) return;

    const currentReactions = msg.reactions || {};
    const updates: Record<string, any> = {};

    // Check if the user is clicking the same emoji they already reacted with
    if (currentReactions[emoji]?.includes(user.uid)) {
      // Remove it (Toggle off)
      updates[`reactions.${emoji}`] = arrayRemove(user.uid);
    } else {
      // Remove the user from ALL other emojis first (so they only have 1 reaction per message)
      Object.keys(currentReactions).forEach(key => {
        if (currentReactions[key]?.includes(user.uid)) {
          updates[`reactions.${key}`] = arrayRemove(user.uid);
        }
      });
      // Add the new reaction
      updates[`reactions.${emoji}`] = arrayUnion(user.uid);
    }

    try {
      await updateDoc(doc(db, "trips", tripId, "messages", msgId), updates);
      setSelectedMessageId(null);
    } catch (err) {
      console.error("Error reacting:", err);
    }
  };

  // --- FEATURE: Long Press Logic (Mobile) ---
  const handleTouchStart = (msgId: string) => {
    touchTimerRef.current = setTimeout(() => {
      setSelectedMessageId(msgId);
    }, 500);
  };
  const handleTouchEnd = () => {
    if (touchTimerRef.current) clearTimeout(touchTimerRef.current);
  };

  // --- UTILS: Smart Formatting ---
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
            <a key={j} href={part} target="_blank" rel="noopener noreferrer" className="text-sky-300 hover:text-sky-100 underline decoration-sky-400/50 underline-offset-2">
              {part}
            </a>
          ) : part
        )}
      </span>
    ));
  };

  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#030712] font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300" onClick={() => setSelectedMessageId(null)}>
      
      {/* --- NEW: MESSAGE INFO MODAL (Seen By) --- */}
      {infoMessageId && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/40 dark:bg-black/60 backdrop-blur-sm" onClick={() => setInfoMessageId(null)}>
          <div className="bg-white dark:bg-[#1e293b] p-6 rounded-3xl w-80 shadow-2xl border border-slate-200 dark:border-white/10 animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-6">
              <h3 className="font-black text-lg flex items-center gap-2"><CheckCheck className="text-blue-500" /> Message Info</h3>
              <button onClick={() => setInfoMessageId(null)} className="p-1 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"><X className="h-5 w-5 text-slate-400" /></button>
            </div>
            
            <div className="space-y-4">
              <p className="text-xs font-black text-slate-400 uppercase tracking-widest border-b border-slate-100 dark:border-white/5 pb-2">Read by</p>
              
              {(() => {
                const msg = messages.find(m => m.id === infoMessageId);
                const viewers = msg?.seenBy?.filter(id => id !== user.uid).map(id => memberNames[id] || "Someone") || [];
                
                if (viewers.length === 0) {
                  return <p className="text-slate-500 font-medium text-sm">Delivered, but nobody has read it yet.</p>;
                }
                
                return viewers.map((v, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-gradient-to-br from-indigo-100 to-blue-100 dark:from-indigo-500/20 dark:to-blue-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-black text-xs border border-indigo-200/50 dark:border-indigo-500/30">
                      {v.charAt(0).toUpperCase()}
                    </div>
                    <span className="font-semibold text-slate-900 dark:text-white">{v}</span>
                  </div>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Mobile Sidebar Overlay */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden" onClick={(e) => { e.stopPropagation(); setIsMobileMenuOpen(false); }} />
      )}

      {/* Main Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/10 flex flex-col transform transition-all duration-300 md:relative md:translate-x-0 ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"}`} onClick={e => e.stopPropagation()}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full"><X className="h-5 w-5" /></button>
        </div>
        {/* ADD 'flex flex-col' TO THE NAV CLASS */}
        <nav className="flex-1 px-4 py-6 overflow-y-auto custom-scrollbar flex flex-col">
          <div className="space-y-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold shadow-sm transition-colors border border-transparent dark:border-indigo-500/20"><MessageSquare className="h-5 w-5 mr-3" /> Group Chat</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/flights" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold"><Plane className="h-5 w-5 mr-3" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
        </div>
        {/* Add the About Us link at the very end wrapped in this specific div */}
          <div className="mt-auto pt-6">
            <Link href="/about" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold transition-colors">
              <Info className="h-5 w-5 mr-3" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col h-screen relative bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] dark:bg-none">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none"></div>

        {/* Mobile Header */}
        <div className="md:hidden h-16 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 shrink-0 z-30 sticky top-0" onClick={e => e.stopPropagation()}>
          <button onClick={() => router.push(`/trips/${tripId}`)} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full"><ArrowLeft className="h-5 w-5" /></button>
          <div className="flex flex-col items-center flex-1 min-w-0 px-2">
            <span className="font-bold text-slate-900 dark:text-white truncate w-full text-center">{tripName}</span>
            {typingUsers.length > 0 && <span className="text-[10px] font-semibold text-indigo-500 truncate w-full text-center">{typingUsers.join(', ')} is typing...</span>}
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 rounded-full"><Menu className="h-6 w-6" /></button>
        </div>

        {/* Desktop Header */}
        <header className="hidden md:flex h-20 bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 items-center justify-between px-10 z-20 shrink-0 sticky top-0" onClick={e => e.stopPropagation()}>
          <div>
            <div className="flex items-center gap-3">
              <MessageSquare className="h-6 w-6 text-indigo-500" />
              <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">{tripName}</h2>
            </div>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5 h-5 transition-all">
              {typingUsers.length > 0 ? (
                <span className="text-indigo-500 animate-pulse">{typingUsers.join(', ')} is typing...</span>
              ) : "End-to-End Encrypted Group Chat"}
            </p>
          </div>
          <Link href={`/trips/${tripId}`} className="flex items-center text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 px-4 py-2 rounded-xl transition-colors border border-slate-200 dark:border-white/10 shadow-sm">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Itinerary
          </Link>
        </header>

        {/* Messages Feed */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 custom-scrollbar z-10 flex flex-col">
          {isLoading ? (
            <div className="flex-1 flex items-center justify-center"><Loader2 className="h-8 w-8 text-indigo-500 animate-spin" /></div>
          ) : messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 animate-in fade-in zoom-in-95 duration-500">
              <div className="h-20 w-20 bg-indigo-50 dark:bg-indigo-500/10 rounded-full flex items-center justify-center mb-4 border border-indigo-100 dark:border-indigo-500/20 shadow-inner">
                <MessageSquare className="h-10 w-10 text-indigo-400" />
              </div>
              <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-2">Start the conversation</h3>
              <p className="text-slate-500 dark:text-slate-400 font-medium max-w-sm">Say hello to your travel crew and start planning the details of your trip!</p>
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
                      <div className="flex justify-center my-6">
                        <span className="bg-slate-200/50 dark:bg-white/10 text-slate-600 dark:text-slate-300 text-[10px] font-black uppercase tracking-widest px-3 py-1 rounded-lg backdrop-blur-sm shadow-sm">
                          {currentDate}
                        </span>
                      </div>
                    )}

                    <div 
                      className={`flex flex-col relative group ${isMe ? "items-end" : "items-start"} mt-2 animate-in fade-in slide-in-from-bottom-2`}
                      onClick={(e) => e.stopPropagation()} 
                    >
                      {showName && (
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 ml-12">
                          {msg.senderName}
                        </span>
                      )}

                      <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[70%] relative ${isMe ? 'flex-row-reverse' : ''}`}>
                        
                        {!isMe && (
                          <div className={`h-8 w-8 rounded-full text-indigo-600 dark:text-indigo-400 font-black flex items-center justify-center text-xs shrink-0 shadow-sm mb-1 ${showName ? 'bg-gradient-to-br from-purple-100 to-indigo-100 dark:from-purple-500/20 dark:to-indigo-500/20 border border-indigo-200/50 dark:border-indigo-500/30' : 'opacity-0'}`}>
                            {msg.senderName.charAt(0).toUpperCase()}
                          </div>
                        )}

                        {/* Interactive Bubble */}
                        <div 
                          className={`px-5 py-3 rounded-[1.5rem] shadow-sm relative cursor-pointer ${
                            isMe ? "bg-indigo-600 text-white rounded-br-sm shadow-indigo-600/20" : "bg-white dark:bg-[#1e293b] text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/5 rounded-bl-sm"
                          }`}
                          onDoubleClick={() => setSelectedMessageId(msg.id)}
                          onTouchStart={() => handleTouchStart(msg.id)}
                          onTouchEnd={handleTouchEnd}
                          onTouchMove={handleTouchEnd}
                        >
                          <p className="text-[15px] font-medium leading-relaxed break-words whitespace-pre-wrap">{renderMessageText(msg.text)}</p>
                          
                          {/* Reactions Display - NOW CLICKABLE TO REMOVE */}
                          {msg.reactions && Object.keys(msg.reactions).length > 0 && (
                            <div className={`absolute -bottom-3 ${isMe ? 'right-2' : 'left-2'} flex gap-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-full px-2 py-0.5 shadow-md text-xs z-10`}>
                              {Object.entries(msg.reactions).map(([emoji, users]) => (
                                users.length > 0 && (
                                  <span 
                                    key={emoji} 
                                    onClick={(e) => { e.stopPropagation(); handleReact(msg.id, emoji); }}
                                    className="cursor-pointer hover:scale-125 transition-transform select-none"
                                    title={users.includes(user.uid) ? "Click to remove" : ""}
                                  >
                                    {emoji} {users.length > 1 && <span className="text-[10px] text-slate-500">{users.length}</span>}
                                  </span>
                                )
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Active Action Menu */}
                        {selectedMessageId === msg.id && (
                          <div className={`absolute top-full mt-2 flex flex-col gap-1 bg-white dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 shadow-xl rounded-2xl p-2 z-50 animate-in zoom-in-95 duration-100 ${isMe ? 'right-0' : 'left-10'}`}>
                            
                            {/* Quick Reactions */}
                            <div className="flex items-center gap-2 px-1 border-b border-slate-100 dark:border-white/5 pb-2 mb-1">
                              {REACTION_EMOJIS.map(emoji => (
                                <button key={emoji} onClick={() => handleReact(msg.id, emoji)} className="hover:scale-125 transition-transform p-1.5 text-xl bg-slate-50 dark:bg-slate-800 rounded-full">{emoji}</button>
                              ))}
                            </div>

                            {/* Info Option */}
                            {isMe && (
                              <button onClick={() => { setInfoMessageId(msg.id); setSelectedMessageId(null); }} className="flex items-center gap-2 w-full px-2 py-2 text-sm font-bold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-colors">
                                <Info className="h-4 w-4 text-blue-500" /> Message Info
                              </button>
                            )}

                            {/* Delete Option */}
                            {isMe && (
                              <button onClick={() => handleDeleteMessage(msg.id)} className="flex items-center gap-2 w-full px-2 py-2 text-sm font-bold text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-xl transition-colors">
                                <Trash2 className="h-4 w-4" /> Delete for everyone
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                      
                      {/* Meta Footer */}
                      <div className={`flex items-center gap-1 mt-1 ${isMe ? "mr-2" : "ml-12"}`}>
                        <span className="text-[10px] font-semibold text-slate-400">{formatTime(msg.createdAt)}</span>
                        {isMe && (
                          <span className="text-slate-400">
                            {!isSent ? <Clock className="h-3 w-3" /> : isSeen ? <CheckCheck className="h-3.5 w-3.5 text-blue-500" /> : <Check className="h-3.5 w-3.5" />}
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

        {/* Message Input Area */}
        <div className="bg-white/90 dark:bg-[#0f172a]/90 backdrop-blur-xl border-t border-slate-200 dark:border-white/10 p-4 shrink-0 z-20 sticky bottom-0" onClick={e => e.stopPropagation()}>
          <form onSubmit={handleSendMessage} className="max-w-4xl mx-auto relative flex items-end gap-2">
            
            <div className="relative flex-1">
              {/* Full Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-full mb-4 left-0 z-50 shadow-2xl animate-in slide-in-from-bottom-2">
                  <EmojiPicker 
                    onEmojiClick={(emojiData) => { setNewMessage(prev => prev + emojiData.emoji); setShowEmojiPicker(false); }}
                    theme="auto"
                  />
                </div>
              )}

              <button type="button" onClick={() => setShowEmojiPicker(!showEmojiPicker)} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-indigo-500 transition-colors p-2">
                <Smile className="h-6 w-6" />
              </button>

              <textarea
                value={newMessage}
                onChange={(e) => handleInputText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage(e);
                  }
                }}
                placeholder="Type your message... (Shift+Enter for new line)"
                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-200 dark:border-white/10 rounded-2xl pl-12 pr-4 py-4 outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 dark:focus:ring-indigo-500/20 transition-all font-medium text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-500 shadow-inner resize-none overflow-hidden h-[56px] leading-[24px]"
                rows={1}
              />
            </div>

            <button
              type="submit"
              disabled={!newMessage.trim()}
              className="h-[56px] w-[56px] shrink-0 bg-indigo-600 text-white rounded-2xl flex items-center justify-center hover:bg-indigo-500 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed group"
            >
              <Send className="h-6 w-6 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 transition-transform" />
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}