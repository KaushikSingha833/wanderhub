"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, deleteDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { useCurrency } from "../lib/useCurrency"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Plus, Receipt, Trash2, BedDouble, Menu, X, DollarSign, Users, PieChart as PieChartIcon, TrendingUp, Camera, Loader2, Plane, MessageSquare, Info, ChevronDown } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Trip { id: string; title: string; members?: string[]; }
interface Expense {
  id: string; tripId: string; title: string; amount: number; category: string; payerName: string; paidById: string; createdAt: any;
}

// Modern Editorial Chart Colors (Emeralds, Teals, Zincs)
const COLORS = ['#10b981', '#059669', '#34d399', '#0ea5e9', '#6366f1', '#8b5cf6'];

export default function ExpensesPage() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [trips, setTrips] = useState<Trip[]>([]);
  const [selectedTripId, setSelectedTripId] = useState<string>("");
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  
  // Form State
  const [isAdding, setIsAdding] = useState(false);
  const [expTitle, setExpTitle] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expCategory, setExpCategory] = useState("Food");
  const [expPayer, setExpPayer] = useState("");

  // OCR SCANNER STATE & REF
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // CURRENCY ENGINE
  const { symbol, convert } = useCurrency();

  // 1. Auth & Fetch Trips
  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        setExpPayer(currentUser.displayName?.split(" ")[0] || "Me");
        const q = query(collection(db, "trips"), where("members", "array-contains", currentUser.uid));
        onSnapshot(q, (snapshot) => {
          const tripsData = snapshot.docs.map(doc => ({ id: doc.id, title: doc.data().title, members: doc.data().members || [] }));
          setTrips(tripsData);
          if (tripsData.length > 0 && !selectedTripId) setSelectedTripId(tripsData[0].id);
        });
      }
    });
    return () => unsubscribeAuth();
  }, [selectedTripId]);

  // 2. Fetch Expenses for Selected Trip
  useEffect(() => {
    if (!selectedTripId) return;
    const q = query(collection(db, "expenses"), where("tripId", "==", selectedTripId), orderBy("createdAt", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setExpenses(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense)));
    });
    return () => unsubscribe();
  }, [selectedTripId]);

  // DELETE EXPENSE LOGIC
  const handleDeleteExpense = async (expenseId: string, paidById: string) => {
    if (user?.uid !== paidById) { alert("You can only delete expenses that you created!"); return; }
    if (!confirm("Delete this expense? This will update the group math.")) return;
    try { await deleteDoc(doc(db, "expenses", expenseId)); } catch (error) { console.error("Error deleting:", error); alert("Failed to delete."); }
  };

  // 3. Save New Expense
  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!expTitle || !expAmount || !expPayer || !selectedTripId || !user) return;
    setIsAdding(true);
    try {
      const currentRate = convert(1);
      const amountInBaseCurrency = parseFloat(expAmount) / currentRate;

      await addDoc(collection(db, "expenses"), {
        tripId: selectedTripId, 
        title: expTitle, 
        amount: amountInBaseCurrency, 
        category: expCategory,
        payerName: expPayer.trim(), 
        paidById: user.uid, 
        createdAt: new Date()
      });
      setExpTitle(""); setExpAmount(""); setIsAdding(false);
    } catch (error) { console.error("Error adding:", error); setIsAdding(false); }
  };

  // HANDLE RECEIPT UPLOAD (OCR)
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsScanning(true);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/scan-receipt", { method: "POST", body: formData });
      const data = await res.json();
      
      if (data.title) setExpTitle(data.title);
      if (data.amount) setExpAmount(data.amount.toString());
      
    } catch (err) {
      console.error(err);
      alert("Failed to scan receipt. The image might be blurry, or the AI is busy.");
    } finally {
      setIsScanning(false);
      if (fileInputRef.current) fileInputRef.current.value = ""; 
    }
  };

  // ENHANCED MATH & LOGIC
  const totalSpent = useMemo(() => expenses.reduce((sum, exp) => sum + exp.amount, 0), [expenses]);
  const currentTrip = useMemo(() => trips.find(t => t.id === selectedTripId), [trips, selectedTripId]);
  const totalMembers = currentTrip?.members?.length || 1; 
  const fairShare = totalMembers > 0 ? totalSpent / totalMembers : totalSpent;

  const chartData = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(exp => { totals[exp.category] = (totals[exp.category] || 0) + exp.amount; });
    return Object.keys(totals).map(key => ({ name: key, value: totals[key] })).sort((a,b) => b.value - a.value);
  }, [expenses]);

  const settlements = useMemo(() => {
    if (expenses.length === 0) return [];
    
    const paidByPerson: Record<string, number> = {};
    expenses.forEach(exp => { paidByPerson[exp.payerName] = (paidByPerson[exp.payerName] || 0) + exp.amount; });
    
    const uniquePeople = Object.keys(paidByPerson);
    const dynamicFairShare = totalSpent / Math.max(uniquePeople.length, 1);

    const balances = uniquePeople.map(person => ({ name: person, balance: paidByPerson[person] - dynamicFairShare }));
    const debtors = balances.filter(b => b.balance < -0.01).sort((a, b) => a.balance - b.balance);
    const creditors = balances.filter(b => b.balance > 0.01).sort((a, b) => b.balance - a.balance);

    const results: { debtor: string, creditor: string, amount: number }[] = [];
    let i = 0; let j = 0;

    while (i < debtors.length && j < creditors.length) {
      const debtor = debtors[i]; const creditor = creditors[j];
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);
      
      if (amount > 0.5) { 
        results.push({ debtor: debtor.name, creditor: creditor.name, amount });
      }
      
      debtor.balance += amount; creditor.balance -= amount;
      if (Math.abs(debtor.balance) < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }
    return results;
  }, [expenses, totalSpent]);

  return (
    <div className="flex h-screen bg-[#FDFDFD] dark:bg-zinc-950 font-sans text-zinc-900 dark:text-zinc-100 overflow-hidden transition-colors duration-300 selection:bg-emerald-500/20">
      
      {/* MOBILE BLUR OVERLAY */}
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
          <Link href="/chat" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
            <MessageSquare className="h-5 w-5 mr-3 opacity-70" /> Group Chat
          </Link>
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-zinc-100 dark:bg-zinc-900 text-zinc-900 dark:text-white rounded-2xl font-bold transition-all"><CreditCard className="h-5 w-5 mr-3 text-emerald-600 dark:text-emerald-400" /> Expenses</Link>
          <Link href="/flights" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Plane className="h-5 w-5 mr-3 opacity-70" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><BedDouble className="h-5 w-5 mr-3 opacity-70" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all"><Settings className="h-5 w-5 mr-3 opacity-70" /> Settings</Link>
          
          <div className="mt-auto pt-6 border-t border-zinc-200 dark:border-zinc-800">
            <Link href="/about" className="flex items-center px-4 py-3 text-zinc-500 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-900/50 hover:text-zinc-900 dark:hover:text-white rounded-2xl font-medium transition-all">
              <Info className="h-5 w-5 mr-3 opacity-70" /> About Us
            </Link>
          </div>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        
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
        <header className="h-auto md:h-24 py-4 md:py-0 bg-white/90 dark:bg-zinc-950/90 backdrop-blur-xl border-b border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row md:items-center justify-between px-6 md:px-12 z-20 shrink-0 gap-4 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tighter hidden md:block">Group Finances</h2>
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 hidden md:block mt-0.5">Track, split, and settle up easily.</p>
          </div>
          <div className="relative w-full md:w-auto group">
            <select value={selectedTripId} onChange={(e) => setSelectedTripId(e.target.value)} className="w-full md:w-64 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-full pl-5 pr-10 py-3 md:py-2.5 text-sm outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 bg-zinc-50 dark:bg-zinc-900 font-bold text-zinc-900 dark:text-white transition-all cursor-pointer appearance-none shadow-sm">
              {trips.length === 0 ? <option>No trips found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none">
              <ChevronDown className="h-4 w-4 text-zinc-400" />
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-12 custom-scrollbar relative z-10">
          <div className="max-w-[1200px] mx-auto space-y-8 md:space-y-12 pb-24">
            
            {/* --- FINTECH: AT A GLANCE ROW --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 shadow-sm flex items-center gap-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <div className="h-14 w-14 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white shrink-0 border border-zinc-100 dark:border-zinc-700/50"><DollarSign className="h-6 w-6"/></div>
                <div><p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Total Trip Spent</p><h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">{symbol}{convert(totalSpent).toLocaleString(undefined, {maximumFractionDigits: 0})}</h3></div>
              </div>
              
              <div className="bg-white dark:bg-zinc-900/50 p-6 rounded-3xl border border-zinc-200 dark:border-zinc-800/50 shadow-sm flex items-center gap-5 hover:border-zinc-300 dark:hover:border-zinc-700 transition-colors">
                <div className="h-14 w-14 rounded-full bg-zinc-50 dark:bg-zinc-800 flex items-center justify-center text-zinc-900 dark:text-white shrink-0 border border-zinc-100 dark:border-zinc-700/50"><Users className="h-6 w-6"/></div>
                <div><p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1">Group Size</p><h3 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tighter">{totalMembers} <span className="text-sm font-bold text-zinc-500 tracking-normal ml-1">travelers</span></h3></div>
              </div>
              
              <div className="bg-zinc-950 p-6 rounded-3xl shadow-xl flex items-center gap-5 text-white relative overflow-hidden border border-zinc-800">
                <div className="absolute top-[-50%] right-[-10%] w-40 h-40 bg-emerald-500/20 rounded-full blur-[60px]"></div>
                <div className="h-14 w-14 rounded-full bg-white/10 flex items-center justify-center shrink-0 border border-white/10 relative z-10"><TrendingUp className="h-6 w-6 text-emerald-400"/></div>
                <div className="relative z-10"><p className="text-[10px] font-bold text-emerald-500/80 uppercase tracking-widest mb-1">Fair Share</p><h3 className="text-3xl font-black tracking-tighter">{symbol}{convert(fairShare).toLocaleString(undefined, {maximumFractionDigits: 0})} <span className="text-sm font-bold text-zinc-500 tracking-normal ml-1">/each</span></h3></div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: Add Expense & List */}
              <div className="xl:col-span-7 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                
                {/* Add Expense Form */}
                <div className="bg-white dark:bg-zinc-900/50 p-8 md:p-10 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm relative transition-colors duration-300">
                  
                  {/* OCR SCANNER BUTTON */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center">
                        Log New Expense
                      </h3>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">Enter details manually or scan a receipt.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isScanning}
                      className="flex items-center justify-center bg-transparent text-zinc-900 dark:text-white hover:bg-zinc-100 dark:hover:bg-zinc-800 px-5 py-2.5 rounded-full text-xs font-bold uppercase tracking-widest transition-all disabled:opacity-50 border border-zinc-300 dark:border-zinc-700 w-full sm:w-auto shrink-0 group active:scale-95"
                    >
                      {isScanning ? <Loader2 className="h-4 w-4 mr-2 animate-spin text-emerald-500" /> : <Camera className="h-4 w-4 mr-2 group-hover:text-emerald-500 transition-colors" />}
                      <span>{isScanning ? "Scanning..." : "Scan Receipt"}</span>
                    </button>
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  </div>

                  <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Description</label>
                      <input type="text" value={expTitle} onChange={(e)=>setExpTitle(e.target.value)} placeholder="Dinner at Seaside Cafe" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-4 outline-none font-bold text-zinc-900 dark:text-white transition-all placeholder-zinc-400 text-sm" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Amount ({symbol})</label>
                      <input type="number" value={expAmount} onChange={(e)=>setExpAmount(e.target.value)} placeholder="0.00" min="1" step="any" className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-4 outline-none font-black text-zinc-900 dark:text-white transition-all placeholder-zinc-400 text-sm" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Who Paid?</label>
                      <input type="text" value={expPayer} onChange={(e)=>setExpPayer(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-4 outline-none font-bold text-zinc-900 dark:text-white transition-all text-sm" required />
                    </div>
                    <div className="md:col-span-2 flex flex-col md:flex-row gap-5 items-end mt-2">
                      <div className="w-full md:flex-1">
                        <label className="block text-[10px] font-bold text-zinc-500 uppercase tracking-widest mb-2">Category</label>
                        <select value={expCategory} onChange={(e)=>setExpCategory(e.target.value)} className="w-full bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl p-4 outline-none font-bold text-zinc-900 dark:text-white transition-all cursor-pointer appearance-none text-sm">
                          <option>Food</option><option>Transport</option><option>Lodging</option><option>Activities</option><option>Other</option>
                        </select>
                      </div>
                      <button type="submit" disabled={isAdding || !selectedTripId} className="w-full md:w-auto bg-zinc-900 dark:bg-white text-white dark:text-zinc-950 px-10 py-4 rounded-full font-bold text-xs uppercase tracking-widest hover:opacity-90 transition-all disabled:opacity-50 shrink-0 active:scale-95 shadow-md">
                        {isAdding ? "Saving..." : "Save Expense"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Expense Ledger */}
                <div className="bg-white dark:bg-zinc-900/50 p-8 md:p-10 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm transition-colors duration-300">
                  <div className="flex items-center justify-between mb-8 pb-6 border-b border-zinc-200 dark:border-zinc-800">
                    <div>
                      <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight flex items-center">Ledger</h3>
                      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mt-1">All recorded group expenses.</p>
                    </div>
                    <span className="text-[10px] font-bold tracking-widest uppercase bg-zinc-100 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400 px-4 py-1.5 rounded-full border border-zinc-200 dark:border-zinc-700">{expenses.length} entries</span>
                  </div>
                  
                  {expenses.length === 0 ? (
                    <div className="text-center py-16 bg-zinc-50 dark:bg-zinc-950/50 rounded-[1.5rem] border border-dashed border-zinc-200 dark:border-zinc-800">
                      <div className="h-14 w-14 bg-white dark:bg-zinc-900 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-100 dark:border-zinc-800">
                        <Receipt className="h-6 w-6 text-zinc-400" />
                      </div>
                      <p className="text-zinc-500 font-bold text-sm">No expenses logged yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {expenses.map(exp => {
                        const colorHash = exp.payerName.charCodeAt(0) % COLORS.length;
                        const avatarColor = COLORS[colorHash];

                        return (
                          <div key={exp.id} className="group flex items-center justify-between p-4 bg-zinc-50 dark:bg-zinc-950/50 hover:bg-zinc-100 dark:hover:bg-zinc-900 rounded-2xl border border-transparent hover:border-zinc-200 dark:hover:border-zinc-800 transition-all cursor-default">
                            <div className="flex items-center gap-4">
                              <div className="h-10 w-10 rounded-full flex items-center justify-center font-black text-white text-sm shrink-0 shadow-sm" style={{ backgroundColor: avatarColor }}>
                                {exp.payerName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-bold text-zinc-900 dark:text-white text-base tracking-tight mb-0.5 truncate max-w-[150px] md:max-w-[250px]">{exp.title}</p>
                                <p className="text-[10px] font-bold uppercase tracking-widest text-zinc-500">{exp.payerName} <span className="mx-1">•</span> {exp.category}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="font-black text-zinc-900 dark:text-white text-lg tracking-tighter">{symbol}{convert(exp.amount).toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                              {exp.paidById === user?.uid ? (
                                <button onClick={() => handleDeleteExpense(exp.id, exp.paidById)} className="p-2 text-zinc-400 hover:text-rose-500 bg-white dark:bg-zinc-800 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-full transition-all border border-zinc-200 dark:border-zinc-700 hover:border-rose-200 dark:hover:border-rose-900/50 opacity-100 md:opacity-0 group-hover:opacity-100 shadow-sm" title="Delete entry"><Trash2 className="h-4 w-4" /></button>
                              ) : (
                                <div className="w-8 hidden md:block"></div> 
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Charts & Settlement */}
              <div className="xl:col-span-5 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-200">
                
                {/* Fintech Settlement Algorithm Box */}
                <div className="bg-zinc-950 p-8 md:p-10 rounded-[2rem] shadow-2xl text-white relative overflow-hidden border border-zinc-800">
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.15] mix-blend-overlay"></div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/10 rounded-full blur-[80px] pointer-events-none"></div>
                  
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-1 flex items-center tracking-tight"><DollarSign className="h-6 w-6 mr-2 text-emerald-500"/> Settlement</h3>
                    <p className="text-sm font-medium text-zinc-500 mb-8">Who owes who.</p>
                    
                    {settlements.length === 0 ? (
                      <div className="bg-zinc-900/80 backdrop-blur-md p-8 rounded-[1.5rem] border border-zinc-800 text-center">
                        <div className="h-12 w-12 bg-zinc-800 rounded-full flex items-center justify-center mx-auto mb-4 border border-zinc-700"><DollarSign className="h-5 w-5 text-zinc-400" /></div>
                        <p className="text-white font-bold text-lg tracking-tight mb-1">All Settled Up</p>
                        <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">No debts detected.</p>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {settlements.map((settlement, idx) => (
                          <div key={idx} className="bg-zinc-900/80 hover:bg-zinc-800 border border-zinc-800 p-4 rounded-2xl flex items-center justify-between transition-colors backdrop-blur-md">
                            <div className="flex-1">
                              <p className="text-xs font-medium text-zinc-500 mb-0.5"><span className="font-bold text-white">{settlement.debtor}</span> owes</p>
                              <p className="text-sm font-bold text-white tracking-tight">{settlement.creditor}</p>
                            </div>
                            <div className="bg-emerald-500/10 text-emerald-400 px-4 py-2 rounded-xl font-black text-lg shrink-0 border border-emerald-500/20">
                              {symbol}{convert(settlement.amount).toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-8 pt-6 border-t border-zinc-800">
                      <p className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest leading-relaxed">
                        <span className="text-emerald-500">Smart Algorithm Active</span> <br/> Calculates absolute minimum transactions to make everyone even.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chart Box */}
                <div className="bg-white dark:bg-zinc-900/50 p-8 md:p-10 rounded-[2rem] border border-zinc-200 dark:border-zinc-800/50 shadow-sm transition-colors duration-300">
                  <h3 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight mb-1 flex items-center"><PieChartIcon className="h-6 w-6 mr-3 text-zinc-400"/> Spending Data</h3>
                  <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-8">Breakdown by category.</p>
                  
                  {chartData.length === 0 ? (
                    <div className="h-56 flex flex-col items-center justify-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-3xl text-zinc-400 bg-zinc-50 dark:bg-zinc-950/50">
                      <PieChartIcon className="h-8 w-8 mb-3 text-zinc-300 dark:text-zinc-700" />
                      <p className="font-bold text-xs uppercase tracking-widest">No data to graph</p>
                    </div>
                  ) : (
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={100} paddingAngle={5} dataKey="value" stroke="none">
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip 
                            formatter={(value: any) => `${symbol}${value ? convert(value).toLocaleString(undefined, {maximumFractionDigits: 0}) : 0}`}
                            contentStyle={{ 
                              borderRadius: '16px', 
                              border: '1px solid #27272a', 
                              backgroundColor: '#18181b', 
                              color: '#fff',
                              fontWeight: 'bold',
                              padding: '12px',
                              boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.5)'
                            }}
                            itemStyle={{ color: '#fff', fontWeight: '900' }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '11px', fontWeight: '800', color: '#71717a', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: '10px' }}/>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>

              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}