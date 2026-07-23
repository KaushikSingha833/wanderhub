"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { 
  onAuthStateChanged, 
  updateProfile, 
  signOut, 
  User as FirebaseUser, 
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, User, Globe, Bell, Shield, LogOut, Save, CheckCircle2, BedDouble, Menu, X, Smartphone, Moon, Languages, Clock, Lock, Loader2, Camera, Plane, AlertTriangle, Info, KeyRound, MessageSquare, History } from "lucide-react";

export default function SettingsPage() {
  const router = useRouter();
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  
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
  
  // PASSWORD CHANGE STATE
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // UI States
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // CUSTOM DIALOG STATE
  const [dialog, setDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    type: "info" | "warning" | "danger";
    confirmText?: string;
    cancelText?: string;
    onConfirm?: () => void;
  }>({
    isOpen: false,
    title: "",
    message: "",
    type: "info",
  });

  const showDialog = (title: string, message: string, type: "info" | "warning" | "danger" = "info", onConfirm?: () => void, confirmText = "OK", cancelText?: string) => {
    setDialog({ isOpen: true, title, message, type, confirmText, cancelText, onConfirm });
  };

  const closeDialog = () => setDialog(prev => ({ ...prev, isOpen: false }));

  const applyThemeToDocument = (selectedTheme: string) => {
    const root = document.documentElement;
    if (selectedTheme === 'Dark Mode') {
      root.classList.add('dark');
    } else if (selectedTheme === 'Light Mode') {
      root.classList.remove('dark');
    } else {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        root.classList.add('dark');
      } else {
        root.classList.remove('dark');
      }
    }
  };

  // 🛡️ 1. SECURITY GUARD: Check if logged in
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (!currentUser) {
        router.push("/"); // Kick to landing page if not logged in
      } else {
        setUser(currentUser);
        setIsAuthLoading(false); // Valid user, proceed to loading their data
      }
    });
    return () => unsubscribe();
  }, [router]);

  // 2. FETCH PREFERENCES (Only runs once user is verified)
  useEffect(() => {
    if (!user) return;

    setDisplayName(user.displayName || "");
    
    const fetchPreferences = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", user.uid));
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
          
          const dbTheme = data.theme;
          const resolvedTheme = localTheme || dbTheme || 'System Default';
          
          setTheme(resolvedTheme);
          applyThemeToDocument(resolvedTheme);

          if (localTheme && dbTheme !== localTheme) {
            setDoc(doc(db, "users", user.uid), { theme: localTheme }, { merge: true });
          }

        } else {
          const resolvedTheme = localTheme || 'System Default';
          setTheme(resolvedTheme);
          applyThemeToDocument(resolvedTheme);
        }
      } catch (error) {
        console.error("Error fetching preferences:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchPreferences();
  }, [user]);

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
      showDialog("Save Failed", "There was an error saving your preferences. Please try again.", "danger");
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !user.email) return;

    if (newPassword !== confirmPassword) {
      showDialog("Mismatch", "Your new passwords do not match. Please try again.", "warning");
      return;
    }
    if (newPassword.length < 6) {
      showDialog("Weak Password", "Your new password must be at least 6 characters long.", "warning");
      return;
    }

    setIsChangingPassword(true);
    try {
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      await updatePassword(user, newPassword);

      showDialog("Success", "Your password has been successfully updated.", "info");
      
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error: any) {
      console.error("Password change error:", error);
      if (error.code === 'auth/invalid-credential') {
         showDialog("Error", "The current password you entered is incorrect.", "danger");
      } else if (error.code === 'auth/requires-recent-login') {
         showDialog("Session Expired", "For security, please sign out and sign back in before changing your password.", "warning");
      } else {
         showDialog("Error", "Could not update password. If you originally signed up with Google, you cannot set an email password here.", "danger");
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handlePushToggle = async (checked: boolean) => {
    if (checked) {
      if (!("Notification" in window)) {
        showDialog("Not Supported", "Your browser does not support push notifications.", "warning");
        return;
      }
      
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setPushAlerts(true);
      } else {
        showDialog(
          "Permission Denied", 
          "We cannot send push notifications because permission was denied. Please enable them in your browser settings if you wish to use this feature.", 
          "warning"
        );
        setPushAlerts(false);
      }
    } else {
      setPushAlerts(false);
    }
  };

  const handleDeleteAccount = () => {
    if (!user) return;
    
    showDialog(
      "Delete Account?",
      "Are you absolutely sure you want to permanently delete your account? This action cannot be undone and you will lose all access to your trips and history.",
      "danger",
      async () => {
        closeDialog();
        try {
          await deleteUser(user);
          router.push("/");
        } catch (error: any) {
          console.error("Error deleting account:", error);
          if (error.code === 'auth/requires-recent-login') {
            showDialog("Re-authentication Required", "For security reasons, please sign out and sign back in before deleting your account.", "warning");
          } else {
            showDialog("Error", "Failed to delete account. Please try again later.", "danger");
          }
        }
      },
      "Delete Permanently",
      "Cancel"
    );
  };

  const handleLogout = () => {
    signOut(auth);
    router.push("/");
  };

  const handleGoogleAlert = (type: string) => {
    if (type === "photo") {
      window.open("https://myaccount.google.com/personal-info", "_blank");
    } else if (type === "security") {
      window.open("https://myaccount.google.com/security", "_blank");
    }
  };

  // 🛡️ LOADING SCREEN: Hide page until verified and preferences are loaded
  if (isAuthLoading || isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#FDFDFD] dark:bg-zinc-950">
        <Loader2 className="h-10 w-10 animate-spin text-emerald-500" />
      </div>
    );
  }
  
  if (!user) return null;

  // ✨ IDENTIFY USER TYPE
  const isEmailUser = user?.providerData.some(provider => provider.providerId === 'password');
  const isGoogleUser = user?.providerData.some(provider => provider.providerId === 'google.com');

  // ✨ DYNAMIC AVATAR GENERATION (Strictly 1st Alphabet of actual name or email)
  let rawName = displayName || user?.displayName || "";
  let avatarName = (rawName.trim() === "" || rawName.trim().toLowerCase() === "traveler") 
    ? (user?.email?.charAt(0).toUpperCase() || "U") 
    : rawName;
    
  const fallbackAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(avatarName)}&background=10b981&color=fff&length=1`;

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors duration-300 selection:bg-emerald-500/20">
      
      {/* MOBILE MENU BLUR */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-zinc-900/40 dark:bg-black/60 backdrop-blur-md z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* FLOATING SIDEBAR (EDITORIAL STYLE) */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-zinc-950 border-r border-zinc-200 dark:border-zinc-800 flex flex-col transform transition-all duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] print:hidden ${isMobileMenuOpen ? "translate-x-0 shadow-2xl" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-20 flex items-center px-8 border-b border-zinc-200 dark:border-zinc-800 shrink-0">
          <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-3 shadow-sm">
            <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
          </div>
          <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          <button onClick={() => setIsMobileMenuOpen(false)} className="ml-auto md:hidden p-2 text-zinc-400 hover:text-zinc-900 dark:hover:text-white rounded-full transition-colors"><X className="h-5 w-5" /></button>
        </div>
        
        <nav className="flex-1 px-4 py-8 overflow-y-auto custom-scrollbar flex flex-col gap-2">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Map className="h-5 w-5 mr-3 opacity-70" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Calendar className="h-5 w-5 mr-3 opacity-70" /> Itineraries</Link>
          <Link href="/chat" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><CreditCard className="h-5 w-5 mr-3 opacity-70" /> Expenses</Link>
          <Link href="/flights" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><BedDouble className="h-5 w-5 mr-3 opacity-70" /> Book Hotels</Link>
          <Link href="/history" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><History className="h-5 w-5 mr-3 opacity-70" /> Trip History</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><Settings className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Settings</Link>
          
          <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <Link href="/about" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
              <Info className="h-5 w-5 mr-3 opacity-70" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[10%] right-[10%] w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-[120px] pointer-events-none"></div>

        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-20 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-zinc-900 dark:bg-white rounded-full flex items-center justify-center mr-2 shadow-sm">
              <PlaneTakeoff className="h-4 w-4 text-white dark:text-zinc-900" />
            </div>
            <span className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-zinc-600 dark:text-zinc-400 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
        </div>

        {/* DESKTOP HEADER (MINIMALIST) */}
        <header className="hidden md:flex h-24 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 items-center justify-between px-12 z-20 shrink-0 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter">Account Settings</h2>
            <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500 dark:text-zinc-400 mt-1">Manage your preferences and profile.</p>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar">
          <div className="max-w-6xl mx-auto flex flex-col md:flex-row gap-10 lg:gap-14 pb-24 relative z-10">
            
            {/* SETTINGS NAVIGATION TABS */}
            <div className="w-full md:w-64 lg:w-72 shrink-0 space-y-2">
              <button onClick={() => setActiveTab("profile")} className={`w-full flex items-center px-6 py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === "profile" ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
                <User className="h-4 w-4 mr-3" /> Profile
              </button>
              <button onClick={() => setActiveTab("preferences")} className={`w-full flex items-center px-6 py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === "preferences" ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
                <Globe className="h-4 w-4 mr-3" /> Preferences
              </button>
              <button onClick={() => setActiveTab("notifications")} className={`w-full flex items-center px-6 py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === "notifications" ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
                <Bell className="h-4 w-4 mr-3" /> Notifications
              </button>
              <button onClick={() => setActiveTab("security")} className={`w-full flex items-center px-6 py-4 rounded-full text-xs font-bold uppercase tracking-widest transition-all ${activeTab === "security" ? "bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 shadow-sm" : "text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-900"}`}>
                <Shield className="h-4 w-4 mr-3" /> Security
              </button>
              <div className="pt-8 mt-8 border-t border-zinc-200 dark:border-zinc-800">
                <button onClick={handleLogout} className="w-full flex items-center px-6 py-4 text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-500/10 rounded-full text-xs font-bold uppercase tracking-widest transition-colors group">
                  <LogOut className="h-4 w-4 mr-3 group-hover:-translate-x-1 transition-transform" /> Sign Out
                </button>
              </div>
            </div>

            {/* SETTINGS CONTENT AREA */}
            <div className="flex-1">
              <div className="bg-white dark:bg-zinc-900/50 rounded-[2.5rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm p-8 md:p-14 transition-colors duration-300">
                
                {/* PROFILE TAB */}
                {activeTab === "profile" && (
                  <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6">
                      <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">Public Profile</h3>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">This is how other travelers will see you in group trips.</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-8 pb-10 border-b border-zinc-100 dark:border-zinc-800">
                      <div className="relative group">
                        {/* ✨ UPDATED AVATAR IMPLEMENTATION */}
                        <img 
                          src={user?.photoURL || fallbackAvatar} 
                          alt="Profile" 
                          referrerPolicy="no-referrer"
                          onError={(e) => {
                            e.currentTarget.onerror = null; 
                            e.currentTarget.src = fallbackAvatar;
                          }}
                          className="h-28 w-28 rounded-full border border-zinc-200 dark:border-zinc-800 shadow-md object-cover" 
                        />
                        {isGoogleUser && (
                          <div onClick={() => handleGoogleAlert("photo")} className="absolute inset-0 bg-black/60 rounded-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer">
                            <Camera className="h-6 w-6 text-white" />
                          </div>
                        )}
                      </div>
                      <div>
                        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 mb-2 uppercase tracking-widest">Profile Picture</p>
                        
                        {isGoogleUser ? (
                          <>
                            <p className="text-xs md:text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-5 max-w-sm leading-relaxed">Your photo is securely managed by your Google Account.</p>
                            <button onClick={() => handleGoogleAlert("photo")} className="bg-transparent text-zinc-900 dark:text-white px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors border border-zinc-300 dark:border-zinc-700 active:scale-95">Update on Google</button>
                          </>
                        ) : (
                          <>
                            <p className="text-xs md:text-sm font-medium text-zinc-900 dark:text-zinc-300 mb-5 max-w-sm leading-relaxed">Your avatar is automatically generated from your display name.</p>
                            <div className="bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-6 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest inline-block border border-transparent">Managed Locally</div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Display Name</label>
                        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-5 py-4 outline-none font-bold text-zinc-900 dark:text-white transition-all text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Email Address</label>
                        <input type="email" value={user.email || ""} disabled className="w-full bg-zinc-100 dark:bg-zinc-900/30 border border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-600 rounded-xl px-5 py-4 outline-none cursor-not-allowed font-medium text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Phone Number</label>
                        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91 98765 43210" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-5 py-4 outline-none font-bold text-zinc-900 dark:text-white transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm" />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Home City</label>
                        <input type="text" value={homeCity} onChange={(e) => setHomeCity(e.target.value)} placeholder="Mumbai, India" className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-5 py-4 outline-none font-bold text-zinc-900 dark:text-white transition-all placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Short Bio</label>
                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell your travel buddies a bit about yourself..." className="w-full bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-5 py-4 outline-none font-medium text-zinc-900 dark:text-white transition-all h-32 resize-none placeholder:text-zinc-400 dark:placeholder:text-zinc-600 text-sm"></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* PREFERENCES TAB */}
                {activeTab === "preferences" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6">
                      <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">App Preferences</h3>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">Customize your WanderHub experience.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="bg-zinc-50 dark:bg-zinc-950/50 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 transition-colors group">
                        <label className="flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-1"><Map className="h-4 w-4 mr-2 text-zinc-400 group-hover:text-emerald-500 transition-colors"/> Default Currency</label>
                        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-zinc-900 font-bold text-zinc-900 dark:text-white cursor-pointer text-sm">
                          <option value="INR">₹ Indian Rupee (INR)</option>
                          <option value="USD">$ US Dollar (USD)</option>
                          <option value="EUR">€ Euro (EUR)</option>
                          <option value="GBP">£ British Pound (GBP)</option>
                        </select>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-950/50 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 transition-colors group">
                        <label className="flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-1"><Languages className="h-4 w-4 mr-2 text-zinc-400 group-hover:text-emerald-500 transition-colors"/> Language</label>
                        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-zinc-900 font-bold text-zinc-900 dark:text-white cursor-pointer text-sm">
                          <option value="English (US)">English (US)</option>
                          <option value="English (UK)">English (UK)</option>
                          <option value="Hindi">Hindi</option>
                          <option value="Odia">Odia</option>
                        </select>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-950/50 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 transition-colors group">
                        <label className="flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-1"><Clock className="h-4 w-4 mr-2 text-zinc-400 group-hover:text-emerald-500 transition-colors"/> Time Zone</label>
                        <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="w-full border border-zinc-200 dark:border-zinc-800 rounded-xl px-4 py-3.5 outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-zinc-900 font-bold text-zinc-900 dark:text-white cursor-pointer text-sm">
                          <option value="UTC+05:30 Indian Standard Time">UTC+05:30 Indian Standard Time</option>
                          <option value="UTC+00:00 Greenwich Mean Time">UTC+00:00 Greenwich Mean Time</option>
                          <option value="UTC-05:00 Eastern Time">UTC-05:00 Eastern Time</option>
                        </select>
                      </div>
                      <div className="bg-zinc-50 dark:bg-zinc-950/50 p-6 rounded-[2rem] border border-zinc-200 dark:border-zinc-800 transition-colors relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-[30px] -translate-y-1/2 translate-x-1/2"></div>
                        <label className="flex items-center text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-4 ml-1 relative z-10"><Moon className="h-4 w-4 mr-2 text-zinc-400 group-hover:text-emerald-500 transition-colors"/> App Theme</label>
                        <select value={theme} onChange={handleThemeChange} className="w-full border border-emerald-500/30 rounded-xl px-4 py-3.5 outline-none focus:ring-1 focus:ring-emerald-500 bg-white dark:bg-zinc-900 font-bold text-zinc-900 dark:text-white cursor-pointer text-sm relative z-10 shadow-sm">
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
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6">
                      <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">Communication</h3>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">Choose how and when we should contact you.</p>
                    </div>
                    
                    <div className="space-y-5 pt-2">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 md:p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-zinc-50 dark:bg-zinc-950/50 transition-colors">
                        <div className="flex items-center gap-6 mb-4 sm:mb-0">
                          <div className="h-14 w-14 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-900 dark:text-white shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-sm"><Bell className="h-6 w-6"/></div>
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white text-lg tracking-tight mb-1">Push Notifications</p>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Real-time alerts on your device for trip invites.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 sm:ml-4">
                          <input type="checkbox" checked={pushAlerts} onChange={(e) => handlePushToggle(e.target.checked)} className="sr-only peer" />
                          <div className="w-14 h-8 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-zinc-950 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white dark:after:bg-zinc-300 after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-500 border border-transparent peer-checked:border-emerald-600"></div>
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 md:p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-zinc-50 dark:bg-zinc-950/50 transition-colors">
                        <div className="flex items-center gap-6 mb-4 sm:mb-0">
                          <div className="h-14 w-14 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-900 dark:text-white shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-sm"><CreditCard className="h-6 w-6"/></div>
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white text-lg tracking-tight mb-1">Email Summaries</p>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Get a weekly email recap of your group expenses.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 sm:ml-4">
                          <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="sr-only peer" />
                          <div className="w-14 h-8 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-zinc-950 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white dark:after:bg-zinc-300 after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-500 border border-transparent peer-checked:border-emerald-600"></div>
                        </label>
                      </div>

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 md:p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-zinc-50 dark:bg-zinc-950/50 transition-colors">
                        <div className="flex items-center gap-6 mb-4 sm:mb-0">
                          <div className="h-14 w-14 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-900 dark:text-white shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-sm"><Smartphone className="h-6 w-6"/></div>
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white text-lg tracking-tight mb-1">SMS Alerts</p>
                            <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Receive text messages for live flight status changes.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 sm:ml-4">
                          <input type="checkbox" checked={smsAlerts} onChange={(e) => setSmsAlerts(e.target.checked)} className="sr-only peer" />
                          <div className="w-14 h-8 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-zinc-950 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white dark:after:bg-zinc-300 after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-500 border border-transparent peer-checked:border-emerald-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECURITY TAB */}
                {activeTab === "security" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="border-b border-zinc-100 dark:border-zinc-800 pb-6">
                      <h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">Security & Access</h3>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">Keep your account and travel data safe.</p>
                    </div>

                    <div className="pt-2 space-y-6">
                      
                      {isGoogleUser && (
                        <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 transition-colors">
                          <div>
                            <p className="font-bold text-lg text-zinc-900 dark:text-white flex items-center tracking-tight mb-2"><Globe className="h-5 w-5 mr-3 text-zinc-400"/> Google Authentication</p>
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-md">Your primary account security is managed by Google. To change external settings, visit your Google Account.</p>
                          </div>
                          <button onClick={() => handleGoogleAlert("security")} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-zinc-900 dark:text-white px-6 py-4 rounded-full text-[10px] font-bold uppercase tracking-widest hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors shrink-0 shadow-sm active:scale-95">Manage on Google</button>
                        </div>
                      )}

                      {/* SECURE PASSWORD CHANGE FORM */}
                      {isEmailUser && (
                        <div className="bg-zinc-50 dark:bg-zinc-950/50 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] p-8 transition-colors">
                          <div className="flex items-center gap-5 mb-8 pb-8 border-b border-zinc-200 dark:border-zinc-800">
                            <div className="h-14 w-14 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-900 dark:text-white shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-sm">
                              <KeyRound className="h-6 w-6"/>
                            </div>
                            <div>
                              <p className="font-bold text-zinc-900 dark:text-white text-lg tracking-tight mb-1">Update Password</p>
                              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-md leading-relaxed">Securely change your WanderHub account password.</p>
                            </div>
                          </div>

                          <form onSubmit={handleChangePassword} className="space-y-6 max-w-xl">
                            <div>
                              <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Current Password</label>
                              <div className="relative">
                                <Lock className="absolute left-5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
                                <input 
                                  type="password" 
                                  value={currentPassword} 
                                  onChange={(e) => setCurrentPassword(e.target.value)} 
                                  required
                                  placeholder="••••••••" 
                                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl pl-12 pr-5 py-4 outline-none font-medium text-sm text-zinc-900 dark:text-white transition-all placeholder:text-zinc-400" 
                                />
                              </div>
                            </div>
                            
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">New Password</label>
                                <input 
                                  type="password" 
                                  value={newPassword} 
                                  onChange={(e) => setNewPassword(e.target.value)} 
                                  required
                                  minLength={6}
                                  placeholder="Min. 6 characters" 
                                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-5 py-4 outline-none font-medium text-sm text-zinc-900 dark:text-white transition-all placeholder:text-zinc-400" 
                                />
                              </div>
                              <div>
                                <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2 ml-1">Confirm New Password</label>
                                <input 
                                  type="password" 
                                  value={confirmPassword} 
                                  onChange={(e) => setConfirmPassword(e.target.value)} 
                                  required
                                  placeholder="Re-type new password" 
                                  className="w-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-5 py-4 outline-none font-medium text-sm text-zinc-900 dark:text-white transition-all placeholder:text-zinc-400" 
                                />
                              </div>
                            </div>

                            <div className="pt-4">
                              <button type="submit" disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword} className="bg-emerald-500 text-zinc-950 font-bold text-[10px] uppercase tracking-widest px-8 py-4 rounded-full hover:bg-emerald-400 transition-all disabled:opacity-50 flex items-center justify-center w-full sm:w-auto active:scale-95 shadow-[0_0_15px_rgba(16,185,129,0.2)] disabled:shadow-none">
                                {isChangingPassword ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
                                {isChangingPassword ? "Updating..." : "Update Password"}
                              </button>
                            </div>
                          </form>
                        </div>
                      )}

                      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-6 md:p-8 border border-zinc-200 dark:border-zinc-800 rounded-[2rem] bg-zinc-50 dark:bg-zinc-950/50 transition-colors">
                        <div className="flex items-center gap-6 mb-5 sm:mb-0">
                          <div className="h-14 w-14 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center text-zinc-900 dark:text-white shrink-0 border border-zinc-200 dark:border-zinc-700 shadow-sm"><Shield className="h-6 w-6"/></div>
                          <div>
                            <p className="font-bold text-zinc-900 dark:text-white text-lg tracking-tight mb-1">Two-Factor Authentication</p>
                            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 max-w-sm leading-relaxed">Require an extra 2FA code when joining new trips or modifying expenses.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 sm:ml-4">
                          <input type="checkbox" checked={twoFactorAuth} onChange={(e) => setTwoFactorAuth(e.target.checked)} className="sr-only peer" />
                          <div className="w-14 h-8 bg-zinc-300 dark:bg-zinc-700 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-zinc-950 after:content-[''] after:absolute after:top-[4px] after:left-[4px] after:bg-white dark:after:bg-zinc-300 after:border-zinc-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-emerald-500 dark:peer-checked:bg-emerald-500 border border-transparent peer-checked:border-emerald-600"></div>
                        </label>
                      </div>

                      <div className="pt-8 mt-4 border-t border-zinc-200 dark:border-zinc-800">
                        <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-4 ml-1">Danger Zone</p>
                        <button onClick={handleDeleteAccount} className="text-rose-500 font-bold text-[10px] uppercase tracking-widest bg-rose-50 dark:bg-rose-500/10 hover:bg-rose-100 dark:hover:bg-rose-500/20 px-8 py-4 rounded-full transition-colors border border-rose-100 dark:border-rose-500/20 w-full sm:w-auto text-center active:scale-95">
                          Delete Account Permanently
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* SAVE ACTION BAR */}
                <div className="mt-12 pt-8 border-t border-zinc-100 dark:border-zinc-800 flex flex-col-reverse sm:flex-row items-center justify-end gap-5">
                  {saveSuccess && (
                    <span className="flex items-center text-xs font-bold text-emerald-600 dark:text-emerald-400 animate-in fade-in slide-in-from-left-4 w-full sm:w-auto justify-center bg-emerald-50 dark:bg-emerald-500/10 px-5 py-3 rounded-full border border-emerald-100 dark:border-emerald-500/20 uppercase tracking-widest">
                      <CheckCircle2 className="h-4 w-4 mr-2" /> All saved
                    </span>
                  )}
                  <button 
                    onClick={handleSave} 
                    disabled={isSaving} 
                    className="w-full sm:w-auto flex items-center justify-center bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 px-10 py-4 rounded-full font-bold hover:opacity-90 transition-all disabled:opacity-50 text-[10px] uppercase tracking-widest active:scale-95 shadow-md group"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2 group-hover:scale-110 transition-transform" />}
                    {isSaving ? "Saving..." : "Save Changes"}
                  </button>
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>

      {/* CUSTOM ALERT DIALOG MODAL (EDITORIAL) */}
      {dialog.isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-zinc-900/60 dark:bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-950 rounded-[2.5rem] p-8 md:p-10 max-w-md w-full shadow-2xl border border-zinc-200 dark:border-zinc-800 animate-in zoom-in-95 duration-200 relative">
            <button onClick={closeDialog} className="absolute top-6 right-6 text-zinc-400 hover:text-zinc-900 dark:hover:text-white transition-colors active:scale-95">
              <X className="h-4 w-4" />
            </button>
            
            <div className="flex items-center gap-4 mb-6">
              <div className={`h-14 w-14 rounded-full flex items-center justify-center shrink-0 border shadow-sm ${
                dialog.type === 'danger' ? 'bg-rose-50 dark:bg-rose-500/10 text-rose-500 border-rose-200 dark:border-rose-500/20' :
                dialog.type === 'warning' ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-500 border-amber-200 dark:border-amber-500/20' :
                'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500 border-emerald-200 dark:border-emerald-500/20'
              }`}>
                {dialog.type === 'danger' ? <AlertTriangle className="h-6 w-6" /> : 
                 dialog.type === 'warning' ? <AlertTriangle className="h-6 w-6" /> : 
                 <Info className="h-6 w-6" />}
              </div>
              <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">{dialog.title}</h3>
            </div>
            
            <p className="text-zinc-600 dark:text-zinc-400 font-medium mb-10 leading-relaxed text-sm">
              {dialog.message}
            </p>
            
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              {dialog.cancelText && (
                <button onClick={closeDialog} className="px-8 py-4 rounded-full font-bold text-[10px] uppercase tracking-widest text-zinc-600 dark:text-zinc-300 bg-zinc-100 dark:bg-zinc-900 hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors w-full sm:w-auto text-center active:scale-95">
                  {dialog.cancelText}
                </button>
              )}
              <button 
                onClick={dialog.onConfirm || closeDialog} 
                className={`px-8 py-4 rounded-full font-bold text-[10px] uppercase tracking-widest transition-all w-full sm:w-auto text-center active:scale-95 ${
                  dialog.type === 'danger' ? 'bg-rose-500 hover:bg-rose-400 text-zinc-950 shadow-[0_0_15px_rgba(244,63,94,0.2)]' : 
                  'bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-[0_0_15px_rgba(16,185,129,0.2)]'
                }`}
              >
                {dialog.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}