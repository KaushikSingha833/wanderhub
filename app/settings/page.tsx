"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, updateProfile, signOut, User as FirebaseUser, deleteUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, User, Globe, Bell, Shield, LogOut, Save, CheckCircle2, BedDouble, Menu, X, Smartphone, Moon, Languages, Clock, Lock, Loader2, Camera } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [activeTab, setActiveTab] = useState("profile");
  
  // Mobile Menu State
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Form States (Profile)
  const [displayName, setDisplayName] = useState("");
  const [bio, setBio] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [homeCity, setHomeCity] = useState("");

  // Form States (Preferences)
  const [currency, setCurrency] = useState("INR");
  const [language, setLanguage] = useState("English (US)");
  const [timeZone, setTimeZone] = useState("UTC+05:30 Indian Standard Time");
  const [theme, setTheme] = useState("System Default");

  // Form States (Notifications & Security)
  const [emailAlerts, setEmailAlerts] = useState(true);
  const [pushAlerts, setPushAlerts] = useState(true);
  const [smsAlerts, setSmsAlerts] = useState(false);
  const [twoFactorAuth, setTwoFactorAuth] = useState(false);
  
  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // 1. Load User & Preferences
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
        setDisplayName(currentUser.displayName || "");
        
        // Fetch custom preferences from Firestore
        const userDoc = await getDoc(doc(db, "users", currentUser.uid));
        const localTheme = localStorage.getItem('theme');

        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.currency) setCurrency(data.currency);
          if (data.language) setLanguage(data.language);
          if (data.timeZone) setTimeZone(data.timeZone);
          if (data.bio) setBio(data.bio);
          if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
          if (data.homeCity) setHomeCity(data.homeCity);
          if (data.emailAlerts !== undefined) setEmailAlerts(data.emailAlerts);
          if (data.pushAlerts !== undefined) setPushAlerts(data.pushAlerts);
          if (data.smsAlerts !== undefined) setSmsAlerts(data.smsAlerts);
          if (data.twoFactorAuth !== undefined) setTwoFactorAuth(data.twoFactorAuth);
          
          // --- BULLETPROOF THEME LOGIC ---
          const dbTheme = data.theme;
          const resolvedTheme = localTheme || dbTheme || 'System Default';
          
          setTheme(resolvedTheme);
          applyThemeToDocument(resolvedTheme);

          if (localTheme && dbTheme !== localTheme) {
            setDoc(doc(db, "users", currentUser.uid), { theme: localTheme }, { merge: true });
          }

        } else {
          // New User Setup
          const resolvedTheme = localTheme || 'System Default';
          setTheme(resolvedTheme);
          applyThemeToDocument(resolvedTheme);
        }
      } else {
        router.push("/"); 
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // --- THEME APPLICATION FUNCTION ---
  const applyThemeToDocument = (selectedTheme: string) => {
    const root = document.documentElement;
    if (selectedTheme === 'Dark Mode') {
      root.classList.add('dark');
    } else if (selectedTheme === 'Light Mode') {
      root.classList.remove('dark');
    } else {
      // System Default Logic
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  // --- HANDLE THEME CHANGE WITH AUTO-SAVE ---
  const handleThemeChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newTheme = e.target.value;
    setTheme(newTheme);
    applyThemeToDocument(newTheme);
    localStorage.setItem('theme', newTheme);

    if (user) {
      try {
        await setDoc(doc(db, "users", user.uid), { theme: newTheme }, { merge: true });
      } catch (error) {
        console.error("Error auto-saving theme:", error);
      }
    }
  };

  // 2. Save Other Preferences
  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
      }

      await setDoc(doc(db, "users", user.uid), {
        currency, language, timeZone, bio, phoneNumber, homeCity,
        emailAlerts, pushAlerts, smsAlerts, twoFactorAuth,
        updatedAt: new Date()
      }, { merge: true });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (error) {
      console.error("Error saving settings:", error);
      alert("Failed to save settings.");
    } finally {
      setIsSaving(false);
    }
  };

  // --- NEW: HANDLE ACCOUNT DELETION ---
  const handleDeleteAccount = async () => {
    if (!user) return;
    
    const isConfirmed = window.confirm(
      "Are you absolutely sure you want to permanently delete your account? This action cannot be undone and you will lose all access to your trips."
    );

    if (isConfirmed) {
      try {
        await deleteUser(user);
        router.push("/");
      } catch (error: any) {
        console.error("Error deleting account:", error);
        // Firebase requires users to have recently signed in to delete their account
        if (error.code === 'auth/requires-recent-login') {
          alert("For security reasons, please sign out and sign back in before deleting your account.");
        } else {
          alert("Failed to delete account. Please try again.");
        }
      }
    }
  };

  const handleLogout = () => {
    signOut(auth);
    router.push("/");
  };

  // Google managed alerts
  const handleGoogleAlert = (type: string) => {
    if (type === "photo") {
      alert("Your profile picture is securely synced with your Google Account. Please update it directly in your Google settings.");
    } else if (type === "security") {
      alert("Your password and primary authentication methods are securely managed by your Google Account.");
    }
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  if (!user) return null;

  return (
    <div className="flex h-screen bg-[#f8fafc] dark:bg-[#030712] font-sans text-slate-900 dark:text-slate-100 overflow-hidden transition-colors duration-300 selection:bg-indigo-100 selection:text-indigo-900">
      
      {/* MOBILE BLUR OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* RESPONSIVE SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-[#0f172a] border-r border-slate-200 dark:border-white/10 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 dark:border-white/10 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white bg-slate-50 dark:bg-white/5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold shadow-sm transition-colors border border-transparent dark:border-indigo-500/20"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        {/* Decorative Background Blur */}
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-500"></div>

        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-16 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
        </div>

        {/* DESKTOP HEADER */}
        <header className="hidden md:flex h-20 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 items-center justify-between px-10 z-20 shrink-0 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Account Settings</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Manage your preferences and profile.</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-8 lg:gap-12 pb-24 relative z-10">
            
            {/* SETTINGS NAVIGATION TABS */}
            <div className="w-full md:w-64 lg:w-72 shrink-0 space-y-2">
              <button onClick={() => setActiveTab("profile")} className={`w-full flex items-center px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === "profile" ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200 dark:border-white/10" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 border border-transparent"}`}>
                <User className="h-5 w-5 mr-3" /> Profile
              </button>
              <button onClick={() => setActiveTab("preferences")} className={`w-full flex items-center px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === "preferences" ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200 dark:border-white/10" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 border border-transparent"}`}>
                <Globe className="h-5 w-5 mr-3" /> Preferences
              </button>
              <button onClick={() => setActiveTab("notifications")} className={`w-full flex items-center px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === "notifications" ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200 dark:border-white/10" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 border border-transparent"}`}>
                <Bell className="h-5 w-5 mr-3" /> Notifications
              </button>
              <button onClick={() => setActiveTab("security")} className={`w-full flex items-center px-5 py-4 rounded-2xl font-bold transition-all ${activeTab === "security" ? "bg-white dark:bg-white/10 text-indigo-600 dark:text-indigo-400 shadow-md border border-slate-200 dark:border-white/10" : "text-slate-600 dark:text-slate-400 hover:bg-slate-200/50 dark:hover:bg-white/5 border border-transparent"}`}>
                <Shield className="h-5 w-5 mr-3" /> Security
              </button>
              <div className="pt-6 mt-6 border-t border-slate-200 dark:border-white/10">
                <button onClick={handleLogout} className="w-full flex items-center px-5 py-4 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 rounded-2xl font-bold transition-colors border border-transparent hover:border-red-100 dark:hover:border-red-500/20 group">
                  <LogOut className="h-5 w-5 mr-3 group-hover:-translate-x-1 transition-transform" /> Sign Out
                </button>
              </div>
            </div>

            {/* SETTINGS CONTENT AREA */}
            <div className="flex-1">
              <div className="bg-white dark:bg-[#0f172a] rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm dark:shadow-2xl p-8 md:p-12 transition-colors duration-300">
                
                {/* PROFILE TAB */}
                {activeTab === "profile" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="border-b border-slate-100 dark:border-white/10 pb-6">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Public Profile</h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">This is how other travelers will see you in group trips.</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-8 border-b border-slate-100 dark:border-white/10">
                      <div className="relative group">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={user?.photoURL || "https://ui-avatars.com/api/?name=Traveler&background=e0e7ff&color=4f46e5"} alt="Profile" className="h-24 w-24 md:h-28 md:w-28 rounded-full border-4 border-white dark:border-[#0f172a] shadow-xl object-cover" />
                        <div onClick={() => handleGoogleAlert("photo")} className="absolute inset-0 bg-black/50 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                          <Camera className="h-6 w-6 text-white" />
                        </div>
                      </div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white mb-1.5 uppercase tracking-widest">Profile Picture</p>
                        <p className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400 mb-4 max-w-sm leading-relaxed">Your photo is currently synced with your Google Account.</p>
                        <button onClick={() => handleGoogleAlert("photo")} className="bg-slate-100 dark:bg-white/5 text-slate-700 dark:text-slate-300 px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-slate-200 dark:hover:bg-white/10 transition-colors shadow-sm border border-slate-200 dark:border-white/10">Update on Google</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Display Name</label>
                        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white transition-all" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                        <input type="email" value={user.email || ""} disabled className="w-full bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-transparent text-slate-400 dark:text-slate-600 rounded-2xl p-4 outline-none cursor-not-allowed font-medium" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91 98765 43210" className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white transition-all placeholder-slate-400 dark:placeholder-slate-600" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Home City</label>
                        <input type="text" value={homeCity} onChange={(e) => setHomeCity(e.target.value)} placeholder="e.g. Mumbai, India" className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white transition-all placeholder-slate-400 dark:placeholder-slate-600" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-2 ml-1">Short Bio</label>
                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell your travel buddies a bit about yourself..." className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-medium text-slate-900 dark:text-white transition-all h-28 resize-none placeholder-slate-400 dark:placeholder-slate-600"></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* PREFERENCES TAB */}
                {activeTab === "preferences" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="border-b border-slate-100 dark:border-white/10 pb-6">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">App Preferences</h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Customize your WanderHub experience.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="bg-slate-50 dark:bg-[#1e293b]/50 p-5 rounded-[1.5rem] border border-slate-200 dark:border-white/5 transition-colors">
                        <label className="flex items-center text-sm font-black text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider"><Map className="h-4 w-4 mr-2 text-indigo-500 dark:text-indigo-400"/> Default Currency</label>
                        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[#0f172a] shadow-sm cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                          <option value="INR">₹ Indian Rupee (INR)</option>
                          <option value="USD">$ US Dollar (USD)</option>
                          <option value="EUR">€ Euro (EUR)</option>
                          <option value="GBP">£ British Pound (GBP)</option>
                        </select>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#1e293b]/50 p-5 rounded-[1.5rem] border border-slate-200 dark:border-white/5 transition-colors">
                        <label className="flex items-center text-sm font-black text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider"><Languages className="h-4 w-4 mr-2 text-indigo-500 dark:text-indigo-400"/> Language</label>
                        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[#0f172a] shadow-sm cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                          <option value="English (US)">English (US)</option>
                          <option value="English (UK)">English (UK)</option>
                          <option value="Hindi">Hindi</option>
                          <option value="Odia">Odia</option>
                        </select>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#1e293b]/50 p-5 rounded-[1.5rem] border border-slate-200 dark:border-white/5 transition-colors">
                        <label className="flex items-center text-sm font-black text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider"><Clock className="h-4 w-4 mr-2 text-indigo-500 dark:text-indigo-400"/> Time Zone</label>
                        <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="w-full border border-slate-200 dark:border-white/10 rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[#0f172a] shadow-sm cursor-pointer font-bold text-slate-700 dark:text-slate-300">
                          <option value="UTC+05:30 Indian Standard Time">UTC+05:30 Indian Standard Time</option>
                          <option value="UTC+00:00 Greenwich Mean Time">UTC+00:00 Greenwich Mean Time</option>
                          <option value="UTC-05:00 Eastern Time">UTC-05:00 Eastern Time</option>
                        </select>
                      </div>
                      <div className="bg-slate-50 dark:bg-[#1e293b]/50 p-5 rounded-[1.5rem] border border-slate-200 dark:border-white/5 transition-colors relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-500/10 rounded-full blur-[30px] -translate-y-1/2 translate-x-1/2"></div>
                        <label className="flex items-center text-sm font-black text-slate-800 dark:text-slate-200 mb-4 uppercase tracking-wider relative z-10"><Moon className="h-4 w-4 mr-2 text-indigo-500 dark:text-indigo-400"/> App Theme</label>
                        <select value={theme} onChange={handleThemeChange} className="w-full border border-indigo-200 dark:border-indigo-500/30 rounded-xl p-4 outline-none focus:ring-2 focus:ring-indigo-500 bg-white dark:bg-[#0f172a] shadow-md cursor-pointer font-bold text-slate-700 dark:text-indigo-300 relative z-10">
                          <option value="System Default">System Default</option>
                          <option value="Light Mode">Light Mode</option>
                          <option value="Dark Mode">Dark Mode</option>
                        </select>
                      </div>
                    </div>
                  </div>
                )}

                {/* NOTIFICATIONS TAB */}
                {activeTab === "notifications" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="border-b border-slate-100 dark:border-white/10 pb-6">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Communication</h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Choose how and when we should contact you.</p>
                    </div>
                    
                    <div className="space-y-4 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border border-slate-200 dark:border-white/10 rounded-[1.5rem] bg-slate-50 dark:bg-[#1e293b]/30 shadow-sm transition-colors">
                        <div className="flex items-center gap-5 mb-4 sm:mb-0">
                          <div className="h-12 w-12 bg-indigo-100 dark:bg-indigo-500/20 rounded-xl flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-200 dark:border-indigo-500/30"><Bell className="h-6 w-6"/></div>
                          <div>
                            <p className="font-black text-slate-800 dark:text-slate-200 text-lg tracking-tight">Push Notifications</p>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Real-time alerts on your device for trip invites.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 sm:ml-4">
                          <input type="checkbox" checked={pushAlerts} onChange={(e) => setPushAlerts(e.target.checked)} className="sr-only peer" />
                          <div className="w-14 h-8 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-500 dark:peer-checked:bg-indigo-600 shadow-inner"></div>
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border border-slate-200 dark:border-white/10 rounded-[1.5rem] bg-slate-50 dark:bg-[#1e293b]/30 shadow-sm transition-colors">
                        <div className="flex items-center gap-5 mb-4 sm:mb-0">
                          <div className="h-12 w-12 bg-sky-100 dark:bg-sky-500/20 rounded-xl flex items-center justify-center text-sky-600 dark:text-sky-400 shrink-0 border border-sky-200 dark:border-sky-500/30"><CreditCard className="h-6 w-6"/></div>
                          <div>
                            <p className="font-black text-slate-800 dark:text-slate-200 text-lg tracking-tight">Email Summaries</p>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Get a weekly email recap of your group expenses.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 sm:ml-4">
                          <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="sr-only peer" />
                          <div className="w-14 h-8 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-500 dark:peer-checked:bg-indigo-600 shadow-inner"></div>
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 border border-slate-200 dark:border-white/10 rounded-[1.5rem] bg-slate-50 dark:bg-[#1e293b]/30 shadow-sm transition-colors">
                        <div className="flex items-center gap-5 mb-4 sm:mb-0">
                          <div className="h-12 w-12 bg-emerald-100 dark:bg-emerald-500/20 rounded-xl flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-200 dark:border-emerald-500/30"><Smartphone className="h-6 w-6"/></div>
                          <div>
                            <p className="font-black text-slate-800 dark:text-slate-200 text-lg tracking-tight">SMS Alerts</p>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Receive text messages for live flight status changes.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 sm:ml-4">
                          <input type="checkbox" checked={smsAlerts} onChange={(e) => setSmsAlerts(e.target.checked)} className="sr-only peer" />
                          <div className="w-14 h-8 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-indigo-500 dark:peer-checked:bg-indigo-600 shadow-inner"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECURITY TAB */}
                {activeTab === "security" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="border-b border-slate-100 dark:border-white/10 pb-6">
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Security & Access</h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Keep your account and travel data safe.</p>
                    </div>

                    <div className="pt-2 space-y-6">
                      <div className="bg-slate-50 dark:bg-[#1e293b]/30 border border-slate-200 dark:border-white/10 rounded-[1.5rem] p-6 md:p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-colors">
                        <div>
                          <p className="font-black text-lg text-slate-900 dark:text-white flex items-center tracking-tight mb-2"><Lock className="h-5 w-5 mr-3 text-slate-400"/> Google Authentication</p>
                          <p className="text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed max-w-md">Your password is securely managed by Google. To change it, visit your external Google Account settings.</p>
                        </div>
                        <button onClick={() => handleGoogleAlert("security")} className="bg-white dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-700 dark:text-white px-6 py-3.5 rounded-xl text-sm font-bold hover:bg-slate-100 dark:hover:bg-white/10 transition-colors shrink-0 shadow-sm">Manage on Google</button>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 md:p-8 border border-slate-200 dark:border-white/10 rounded-[1.5rem] bg-slate-50 dark:bg-[#1e293b]/30 shadow-sm transition-colors">
                        <div className="flex items-center gap-5 mb-5 sm:mb-0">
                          <div className="h-12 w-12 bg-purple-100 dark:bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0 border border-purple-200 dark:border-purple-500/30"><Shield className="h-6 w-6"/></div>
                          <div>
                            <p className="font-black text-slate-800 dark:text-white text-lg tracking-tight">Two-Factor Authentication</p>
                            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1 max-w-sm leading-relaxed">Require an extra 2FA code when joining new trips or modifying expenses.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 sm:ml-4">
                          <input type="checkbox" checked={twoFactorAuth} onChange={(e) => setTwoFactorAuth(e.target.checked)} className="sr-only peer" />
                          <div className="w-14 h-8 bg-slate-300 dark:bg-slate-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-purple-500 dark:peer-checked:bg-purple-600 shadow-inner"></div>
                        </label>
                      </div>

                      <div className="pt-6 mt-2">
                        <p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-4 ml-1">Danger Zone</p>
                        <button onClick={handleDeleteAccount} className="text-red-600 dark:text-red-400 font-bold text-sm bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 px-6 py-3.5 rounded-xl transition-colors border border-red-100 dark:border-red-500/20 w-full sm:w-auto text-center">
                          Delete My Account Permanently
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SAVE ACTION BAR */}
                <div className="mt-10 pt-8 border-t border-slate-100 dark:border-white/10 flex flex-col-reverse sm:flex-row items-center justify-end gap-5">
                  {saveSuccess && (
                    <span className="flex items-center text-sm font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-left-4 w-full sm:w-auto justify-center bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 rounded-lg border border-emerald-100 dark:border-emerald-500/20">
                      <CheckCircle2 className="h-5 w-5 mr-2" /> All preferences saved!
                    </span>
                  )}
                  <button 
                    onClick={handleSave} 
                    disabled={isSaving} 
                    className="w-full sm:w-auto flex items-center justify-center bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black hover:bg-indigo-700 dark:hover:bg-indigo-500 shadow-xl shadow-indigo-600/20 dark:shadow-indigo-900/30 transition-all disabled:opacity-70 text-lg sm:text-base group"
                  >
                    {isSaving ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Save className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />}
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}