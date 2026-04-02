"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { onAuthStateChanged, updateProfile, signOut, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, User, Globe, Bell, Shield, LogOut, Save, CheckCircle2, BedDouble, Menu, X, Smartphone, Moon, Languages, Clock, Lock } from "lucide-react";

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
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.currency) setCurrency(data.currency);
          if (data.language) setLanguage(data.language);
          if (data.timeZone) setTimeZone(data.timeZone);
          if (data.theme) setTheme(data.theme);
          if (data.bio) setBio(data.bio);
          if (data.phoneNumber) setPhoneNumber(data.phoneNumber);
          if (data.homeCity) setHomeCity(data.homeCity);
          if (data.emailAlerts !== undefined) setEmailAlerts(data.emailAlerts);
          if (data.pushAlerts !== undefined) setPushAlerts(data.pushAlerts);
          if (data.smsAlerts !== undefined) setSmsAlerts(data.smsAlerts);
          if (data.twoFactorAuth !== undefined) setTwoFactorAuth(data.twoFactorAuth);
        }
      } else {
        router.push("/"); 
      }
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [router]);

  // 2. Save Preferences
  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    setSaveSuccess(false);

    try {
      if (displayName !== user.displayName) {
        await updateProfile(user, { displayName });
      }

      await setDoc(doc(db, "users", user.uid), {
        currency, language, timeZone, theme, bio, phoneNumber, homeCity,
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

  const handleLogout = () => {
    signOut(auth);
    router.push("/");
  };

  if (isLoading) return <div className="h-screen flex items-center justify-center bg-slate-50"><div className="animate-spin h-8 w-8 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>;
  if (!user) return null;

  return (
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* MOBILE BLUR OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* RESPONSIVE SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
        <div className="h-16 flex items-center justify-between px-6 border-b border-slate-200 shrink-0">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(false)} className="md:hidden p-2 text-slate-400 hover:text-slate-600 rounded-lg bg-slate-50"><X className="h-5 w-5" /></button>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto">
          <Link href="/" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><Map className="h-5 w-5 mr-3" /> Dashboard</Link>
          <Link href="/itineraries" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><Calendar className="h-5 w-5 mr-3" /> Itineraries</Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium shadow-sm transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-16 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 z-10">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"><Menu className="h-6 w-6" /></button>
        </div>

        {/* DESKTOP HEADER */}
        <header className="hidden md:flex h-16 bg-white border-b border-slate-200 items-center px-8 z-10 shrink-0">
          <h2 className="text-xl font-semibold text-slate-800">Account Settings</h2>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-5xl mx-auto flex flex-col md:flex-row gap-6 md:gap-8 pb-20">
            
            {/* SETTINGS NAVIGATION TABS */}
            <div className="w-full md:w-64 shrink-0 space-y-1">
              <button onClick={() => setActiveTab("profile")} className={`w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all ${activeTab === "profile" ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}>
                <User className="h-5 w-5 mr-3" /> Profile
              </button>
              <button onClick={() => setActiveTab("preferences")} className={`w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all ${activeTab === "preferences" ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}>
                <Globe className="h-5 w-5 mr-3" /> Preferences
              </button>
              <button onClick={() => setActiveTab("notifications")} className={`w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all ${activeTab === "notifications" ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}>
                <Bell className="h-5 w-5 mr-3" /> Notifications
              </button>
              <button onClick={() => setActiveTab("security")} className={`w-full flex items-center px-4 py-3 rounded-xl font-medium transition-all ${activeTab === "security" ? "bg-white text-indigo-600 shadow-sm border border-slate-200" : "text-slate-600 hover:bg-slate-200/50"}`}>
                <Shield className="h-5 w-5 mr-3" /> Security
              </button>
              <div className="pt-4 mt-4 border-t border-slate-200">
                <button onClick={handleLogout} className="w-full flex items-center px-4 py-3 text-red-600 hover:bg-red-50 rounded-xl font-medium transition-colors">
                  <LogOut className="h-5 w-5 mr-3" /> Sign Out
                </button>
              </div>
            </div>

            {/* SETTINGS CONTENT AREA */}
            <div className="flex-1">
              <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8">
                
                {/* PROFILE TAB */}
                {activeTab === "profile" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Public Profile</h3>
                      <p className="text-sm text-slate-500 mt-1">This is how other travelers will see you in group trips.</p>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-6 pb-6 border-b border-slate-100">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={user.photoURL || "https://ui-avatars.com/api/?name=Traveler&background=e0e7ff&color=4f46e5"} alt="Profile" className="h-20 w-20 md:h-24 md:w-24 rounded-full border-4 border-slate-50 shadow-md" />
                      <div>
                        <p className="text-sm font-bold text-slate-700 mb-1">Profile Picture</p>
                        <p className="text-xs md:text-sm text-slate-500 mb-3">Your photo is automatically synced with your Google account.</p>
                        <button className="bg-slate-100 text-slate-600 px-4 py-2 rounded-lg text-xs font-bold hover:bg-slate-200 transition-colors">Update on Google</button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Display Name</label>
                        <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-3.5 outline-none font-medium text-slate-900 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Email Address</label>
                        <input type="email" value={user.email || ""} disabled className="w-full bg-slate-100 border border-slate-200 text-slate-500 rounded-xl p-3.5 outline-none cursor-not-allowed" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Phone Number</label>
                        <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+91 98765 43210" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-3.5 outline-none font-medium text-slate-900 transition-colors" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Home City</label>
                        <input type="text" value={homeCity} onChange={(e) => setHomeCity(e.target.value)} placeholder="e.g. Mumbai, India" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-3.5 outline-none font-medium text-slate-900 transition-colors" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Short Bio</label>
                        <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Tell your travel buddies a bit about yourself..." className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-3.5 outline-none font-medium text-slate-900 transition-colors h-24 resize-none"></textarea>
                      </div>
                    </div>
                  </div>
                )}

                {/* PREFERENCES TAB */}
                {activeTab === "preferences" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">App Preferences</h3>
                      <p className="text-sm text-slate-500 mt-1">Customize your WanderHub experience.</p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label className="flex items-center text-sm font-bold text-slate-700 mb-3"><Map className="h-4 w-4 mr-2 text-indigo-500"/> Default Currency</label>
                        <select value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm cursor-pointer">
                          <option value="INR">₹ Indian Rupee (INR)</option>
                          <option value="USD">$ US Dollar (USD)</option>
                          <option value="EUR">€ Euro (EUR)</option>
                          <option value="GBP">£ British Pound (GBP)</option>
                        </select>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label className="flex items-center text-sm font-bold text-slate-700 mb-3"><Languages className="h-4 w-4 mr-2 text-indigo-500"/> Language</label>
                        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm cursor-pointer">
                          <option value="English (US)">English (US)</option>
                          <option value="English (UK)">English (UK)</option>
                          <option value="Hindi">Hindi</option>
                          <option value="Odia">Odia</option>
                        </select>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label className="flex items-center text-sm font-bold text-slate-700 mb-3"><Clock className="h-4 w-4 mr-2 text-indigo-500"/> Time Zone</label>
                        <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm cursor-pointer">
                          <option value="UTC+05:30 Indian Standard Time">UTC+05:30 Indian Standard Time</option>
                          <option value="UTC+00:00 Greenwich Mean Time">UTC+00:00 Greenwich Mean Time</option>
                          <option value="UTC-05:00 Eastern Time">UTC-05:00 Eastern Time</option>
                        </select>
                      </div>
                      <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                        <label className="flex items-center text-sm font-bold text-slate-700 mb-3"><Moon className="h-4 w-4 mr-2 text-indigo-500"/> App Theme</label>
                        <select value={theme} onChange={(e) => setTheme(e.target.value)} className="w-full border border-slate-300 rounded-xl p-3 outline-none focus:ring-2 focus:ring-indigo-500 bg-white shadow-sm cursor-pointer">
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
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Communication</h3>
                      <p className="text-sm text-slate-500 mt-1">Choose how and when we should contact you.</p>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Toggle Item */}
                      <div className="flex items-center justify-between p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-indigo-50 rounded-full flex items-center justify-center text-indigo-600 shrink-0"><Bell className="h-5 w-5"/></div>
                          <div>
                            <p className="font-bold text-slate-800">Push Notifications</p>
                            <p className="text-xs text-slate-500 mt-0.5">Real-time alerts on your device for trip invites.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input type="checkbox" checked={pushAlerts} onChange={(e) => setPushAlerts(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-sky-50 rounded-full flex items-center justify-center text-sky-600 shrink-0"><CreditCard className="h-5 w-5"/></div>
                          <div>
                            <p className="font-bold text-slate-800">Email Summaries</p>
                            <p className="text-xs text-slate-500 mt-0.5">Get a weekly email recap of your group expenses.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input type="checkbox" checked={emailAlerts} onChange={(e) => setEmailAlerts(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>

                      <div className="flex items-center justify-between p-5 border border-slate-200 rounded-2xl bg-white shadow-sm hover:border-indigo-200 transition-colors">
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-600 shrink-0"><Smartphone className="h-5 w-5"/></div>
                          <div>
                            <p className="font-bold text-slate-800">SMS Alerts</p>
                            <p className="text-xs text-slate-500 mt-0.5">Receive text messages for live flight status changes.</p>
                          </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0">
                          <input type="checkbox" checked={smsAlerts} onChange={(e) => setSmsAlerts(e.target.checked)} className="sr-only peer" />
                          <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* SECURITY TAB */}
                {activeTab === "security" && (
                  <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
                    <div>
                      <h3 className="text-xl font-black text-slate-900">Security & Access</h3>
                      <p className="text-sm text-slate-500 mt-1">Keep your account and travel data safe.</p>
                    </div>

                    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <p className="font-bold text-slate-900 flex items-center"><Lock className="h-4 w-4 mr-2 text-slate-500"/> Google Authentication</p>
                        <p className="text-sm text-slate-500 mt-1">Your password is securely managed by Google. To change it, visit your Google Account settings.</p>
                      </div>
                      <button className="bg-white border border-slate-300 text-slate-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-slate-50 transition-colors shrink-0 shadow-sm">Manage on Google</button>
                    </div>

                    <div className="flex items-center justify-between p-5 border border-slate-200 rounded-2xl bg-white shadow-sm">
                      <div className="flex items-center gap-4">
                        <div className="h-10 w-10 bg-purple-50 rounded-full flex items-center justify-center text-purple-600 shrink-0"><Shield className="h-5 w-5"/></div>
                        <div>
                          <p className="font-bold text-slate-800">Two-Factor Authentication (2FA)</p>
                          <p className="text-xs text-slate-500 mt-0.5">Require an extra code when joining new trips.</p>
                        </div>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer shrink-0">
                        <input type="checkbox" checked={twoFactorAuth} onChange={(e) => setTwoFactorAuth(e.target.checked)} className="sr-only peer" />
                        <div className="w-11 h-6 bg-slate-200 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>

                    <div className="pt-4 border-t border-slate-200">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">Danger Zone</p>
                      <button className="text-red-600 font-bold text-sm bg-red-50 hover:bg-red-100 px-4 py-2.5 rounded-xl transition-colors border border-red-100 w-full sm:w-auto text-center">
                        Delete My Account
                      </button>
                    </div>
                  </div>
                )}

                {/* SAVE ACTION BAR */}
                <div className="mt-8 pt-6 border-t border-slate-200 flex flex-col-reverse sm:flex-row items-center justify-end gap-4">
                  {saveSuccess && (
                    <span className="flex items-center text-sm font-bold text-emerald-600 animate-in fade-in slide-in-from-left-2 w-full sm:w-auto justify-center">
                      <CheckCircle2 className="h-5 w-5 mr-1.5" /> All preferences saved!
                    </span>
                  )}
                  <button 
                    onClick={handleSave} 
                    disabled={isSaving} 
                    className="w-full sm:w-auto flex items-center justify-center bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-70 text-lg sm:text-base"
                  >
                    {isSaving ? "Saving..." : <><Save className="h-5 w-5 mr-2" /> Save Changes</>}
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