"use client";
import { useState, useEffect, useMemo, useRef } from "react";
import Link from "next/link";
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, deleteDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { useCurrency } from "../lib/useCurrency"; // <-- 1. IMPORTING THE CURRENCY ENGINE
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Plus, Receipt, Trash2, BedDouble, Menu, X, DollarSign, Users, PieChart as PieChartIcon, TrendingUp, Camera, Loader2, Plane } from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";

interface Trip { id: string; title: string; members?: string[]; }
interface Expense {
  id: string; tripId: string; title: string; amount: number; category: string; payerName: string; paidById: string; createdAt: any;
}

// Modern Chart Colors
const COLORS = ['#8b5cf6', '#3b82f6', '#10b981', '#f59e0b', '#f43f5e', '#6366f1'];

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

  // --- NEW: OCR SCANNER STATE & REF ---
  const [isScanning, setIsScanning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- 2. ACTIVATING THE CURRENCY ENGINE ---
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

  // --- DELETE EXPENSE LOGIC ---
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
      // Calculate what 1 unit of base currency is in the selected currency
      const currentRate = convert(1);
      // Convert the input amount back to the base currency (INR) before saving
      const amountInBaseCurrency = parseFloat(expAmount) / currentRate;

      await addDoc(collection(db, "expenses"), {
        tripId: selectedTripId, 
        title: expTitle, 
        amount: amountInBaseCurrency, // Saved in Base Currency!
        category: expCategory,
        payerName: expPayer.trim(), 
        paidById: user.uid, 
        createdAt: new Date()
      });
      setExpTitle(""); setExpAmount(""); setIsAdding(false);
    } catch (error) { console.error("Error adding:", error); setIsAdding(false); }
  };

  // --- NEW: HANDLE RECEIPT UPLOAD (OCR) ---
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
      // Reset input so you can scan the same file again if needed
      if (fileInputRef.current) fileInputRef.current.value = ""; 
    }
  };

  // --- ENHANCED MATH & LOGIC ---

  // A. Total Metrics
  const totalSpent = useMemo(() => expenses.reduce((sum, exp) => sum + exp.amount, 0), [expenses]);
  const currentTrip = useMemo(() => trips.find(t => t.id === selectedTripId), [trips, selectedTripId]);
  
  // FIXED BUG: Calculate fair share based on all trip members, not just people who paid for something
  const totalMembers = currentTrip?.members?.length || 1; 
  const fairShare = totalMembers > 0 ? totalSpent / totalMembers : totalSpent;

  // B. Data for Pie Chart
  const chartData = useMemo(() => {
    const totals: Record<string, number> = {};
    expenses.forEach(exp => { totals[exp.category] = (totals[exp.category] || 0) + exp.amount; });
    return Object.keys(totals).map(key => ({ name: key, value: totals[key] })).sort((a,b) => b.value - a.value);
  }, [expenses]);

  // C. The Settlement Algorithm
  const settlements = useMemo(() => {
    if (expenses.length === 0) return [];
    
    // Calculate how much each named person actually paid
    const paidByPerson: Record<string, number> = {};
    expenses.forEach(exp => { paidByPerson[exp.payerName] = (paidByPerson[exp.payerName] || 0) + exp.amount; });
    
    // We assume the "unique people" in the math are the people who have a name logged in the expenses
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
      
      if (amount > 0.5) { // Only log meaningful amounts
        results.push({ debtor: debtor.name, creditor: creditor.name, amount });
      }
      
      debtor.balance += amount; creditor.balance -= amount;
      if (Math.abs(debtor.balance) < 0.01) i++;
      if (creditor.balance < 0.01) j++;
    }
    return results;
  }, [expenses, totalSpent]);

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
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400 rounded-xl font-bold shadow-sm transition-colors border border-transparent dark:border-indigo-500/20"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/flights" className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl font-semibold"><Plane className="h-5 w-5 mr-3" /> Book Flights</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-white/5 hover:text-slate-900 dark:hover:text-white rounded-xl font-semibold transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
        </nav>
      </aside>

      {/* MAIN CONTENT */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden relative">
        <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] bg-indigo-500/5 dark:bg-indigo-500/10 rounded-full blur-[100px] pointer-events-none transition-colors duration-500"></div>

        {/* MOBILE TOP BAR */}
        <div className="md:hidden h-16 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-md border-b border-slate-200 dark:border-white/10 flex items-center justify-between px-4 shrink-0 z-30 sticky top-0 transition-colors">
          <div className="flex items-center">
            <PlaneTakeoff className="h-6 w-6 text-indigo-600 dark:text-indigo-400 mr-2" />
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-blue-500 dark:from-indigo-400 dark:to-blue-400">WanderHub</span>
          </div>
          <button onClick={() => setIsMobileMenuOpen(true)} className="p-2 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/10 rounded-full transition-colors"><Menu className="h-6 w-6" /></button>
        </div>

        {/* HEADER */}
        <header className="h-auto md:h-20 py-4 md:py-0 bg-white/80 dark:bg-[#0f172a]/80 backdrop-blur-xl border-b border-slate-200 dark:border-white/10 flex flex-col md:flex-row md:items-center justify-between px-6 md:px-10 z-20 shrink-0 gap-4 sticky top-0 transition-all">
          <div>
            <h2 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight hidden md:block">Group Finances</h2>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 hidden md:block mt-0.5">Track, split, and settle up easily.</p>
          </div>
          <div className="relative w-full md:w-auto">
            <select value={selectedTripId} onChange={(e) => setSelectedTripId(e.target.value)} className="w-full md:w-64 border border-slate-200 dark:border-white/10 hover:border-slate-300 dark:hover:border-white/20 rounded-xl p-3 md:p-2.5 text-sm outline-none focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 bg-white dark:bg-[#1e293b] font-bold text-slate-700 dark:text-slate-200 shadow-sm cursor-pointer transition-all appearance-none pr-10">
              {trips.length === 0 ? <option>No trips found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
            </select>
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none">
              <svg className="h-4 w-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-10 custom-scrollbar relative z-10">
          <div className="max-w-6xl mx-auto space-y-6 md:space-y-12 pb-24">
            
            {/* --- ENHANCED: AT A GLANCE ROW --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-indigo-50 dark:bg-indigo-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 group-hover:bg-indigo-100 dark:group-hover:bg-indigo-500/20 transition-colors"></div>
                <div className="h-14 w-14 rounded-2xl bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0 border border-indigo-100 dark:border-indigo-500/20 relative z-10"><DollarSign className="h-7 w-7"/></div>
                <div className="relative z-10"><p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Total Trip Spent</p><h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{symbol}{convert(totalSpent).toLocaleString(undefined, {maximumFractionDigits: 0})}</h3></div>
              </div>
              
              <div className="bg-white dark:bg-[#0f172a] p-6 rounded-[2rem] border border-slate-200 dark:border-white/10 shadow-sm flex items-center gap-5 hover:shadow-md transition-shadow group relative overflow-hidden">
                <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-50 dark:bg-emerald-500/10 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-500/20 transition-colors"></div>
                <div className="h-14 w-14 rounded-2xl bg-emerald-50 dark:bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0 border border-emerald-100 dark:border-emerald-500/20 relative z-10"><Users className="h-7 w-7"/></div>
                <div className="relative z-10"><p className="text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1">Group Size</p><h3 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">{totalMembers} <span className="text-sm font-bold text-slate-500 tracking-normal ml-1">travelers</span></h3></div>
              </div>
              
              <div className="bg-gradient-to-br from-indigo-900 via-slate-900 to-purple-900 dark:from-indigo-950 dark:via-[#0f172a] dark:to-purple-950 p-6 rounded-[2rem] shadow-xl flex items-center gap-5 text-white relative overflow-hidden group hover:shadow-indigo-500/20 transition-shadow">
                <div className="absolute top-[-50%] right-[-10%] w-48 h-48 bg-indigo-500/30 rounded-full blur-[60px] group-hover:bg-indigo-400/40 transition-colors"></div>
                <div className="h-14 w-14 rounded-2xl bg-white/10 flex items-center justify-center shrink-0 backdrop-blur-md border border-white/20 relative z-10"><TrendingUp className="h-7 w-7 text-white"/></div>
                <div className="relative z-10"><p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest mb-1">Fair Share</p><h3 className="text-3xl font-black tracking-tighter">{symbol}{convert(fairShare).toLocaleString(undefined, {maximumFractionDigits: 0})} <span className="text-sm font-bold text-indigo-300 tracking-normal ml-1">/each</span></h3></div>
              </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-12 gap-8">
              
              {/* LEFT COLUMN: Add Expense & List */}
              <div className="xl:col-span-7 space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-700 delay-100">
                
                {/* Add Expense Form */}
                <div className="bg-white dark:bg-[#0f172a] p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm relative overflow-hidden transition-colors duration-300">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 dark:bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                  
                  {/* --- NEW OCR SCANNER BUTTON --- */}
                  <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-8 relative z-10 gap-4">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">
                        Log New Expense
                      </h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">Manually enter details or scan a receipt.</p>
                    </div>
                    <button 
                      type="button"
                      onClick={() => fileInputRef.current?.click()} 
                      disabled={isScanning}
                      className="flex items-center justify-center bg-indigo-50 dark:bg-indigo-500/20 text-indigo-700 dark:text-indigo-400 hover:bg-indigo-600 hover:text-white dark:hover:bg-indigo-500 dark:hover:text-white px-5 py-3 rounded-2xl text-sm font-black transition-all disabled:opacity-50 border border-indigo-100 dark:border-indigo-500/30 hover:border-transparent shadow-sm hover:shadow-lg w-full sm:w-auto shrink-0 group"
                    >
                      {isScanning ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <Camera className="h-5 w-5 mr-2 group-hover:scale-110 transition-transform" />}
                      <span>{isScanning ? "Scanning..." : "Scan Receipt"}</span>
                    </button>
                    <input type="file" accept="image/*" className="hidden" ref={fileInputRef} onChange={handleFileUpload} />
                  </div>

                  <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                    <div className="md:col-span-2">
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Description</label>
                      <input type="text" value={expTitle} onChange={(e)=>setExpTitle(e.target.value)} placeholder="e.g. Dinner at Seaside Cafe" className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white transition-all placeholder-slate-300 dark:placeholder-slate-600" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Amount ({symbol})</label>
                      <input type="number" value={expAmount} onChange={(e)=>setExpAmount(e.target.value)} placeholder="0.00" min="1" step="any" className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-black text-slate-900 dark:text-white transition-all placeholder-slate-300 dark:placeholder-slate-600" required />
                    </div>
                    <div>
                      <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Who Paid?</label>
                      <input type="text" value={expPayer} onChange={(e)=>setExpPayer(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white transition-all" required />
                    </div>
                    <div className="md:col-span-2 flex flex-col md:flex-row gap-5 items-end mt-2">
                      <div className="w-full md:flex-1">
                        <label className="block text-[10px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-1.5">Category</label>
                        <select value={expCategory} onChange={(e)=>setExpCategory(e.target.value)} className="w-full bg-slate-50 dark:bg-[#1e293b] border border-slate-200 dark:border-white/10 focus:border-indigo-500 dark:focus:border-indigo-500 focus:ring-4 focus:ring-indigo-500/10 rounded-2xl p-4 outline-none font-bold text-slate-900 dark:text-white transition-all cursor-pointer appearance-none">
                          <option>Food</option><option>Transport</option><option>Lodging</option><option>Activities</option><option>Other</option>
                        </select>
                      </div>
                      <button type="submit" disabled={isAdding || !selectedTripId} className="w-full md:w-auto bg-slate-900 dark:bg-indigo-600 text-white px-10 py-4 rounded-2xl font-black text-sm hover:bg-indigo-600 dark:hover:bg-indigo-500 shadow-xl shadow-slate-900/20 dark:shadow-indigo-900/30 hover:shadow-indigo-500/30 transition-all disabled:opacity-50 shrink-0">
                        {isAdding ? "Saving..." : "Save Expense"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Expense Ledger */}
                <div className="bg-white dark:bg-[#0f172a] p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm transition-colors duration-300">
                  <div className="flex items-center justify-between mb-8 border-b border-slate-100 dark:border-white/10 pb-6">
                    <div>
                      <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight flex items-center">Ledger</h3>
                      <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-1">All recorded group expenses.</p>
                    </div>
                    <span className="text-xs font-black tracking-widest uppercase bg-indigo-50 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-xl">{expenses.length} entries</span>
                  </div>
                  
                  {expenses.length === 0 ? (
                    <div className="text-center py-16 bg-slate-50 dark:bg-[#1e293b]/50 rounded-[2rem] border border-dashed border-slate-200 dark:border-white/10">
                      <div className="h-16 w-16 bg-white dark:bg-[#0f172a] rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100 dark:border-white/5">
                        <Receipt className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      </div>
                      <p className="text-slate-500 dark:text-slate-400 font-bold">No expenses logged yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {expenses.map(exp => {
                        const colorHash = exp.payerName.charCodeAt(0) % COLORS.length;
                        const avatarColor = COLORS[colorHash];

                        return (
                          <div key={exp.id} className="group flex items-center justify-between p-4 md:p-5 bg-white dark:bg-white/5 hover:bg-slate-50 dark:hover:bg-white/10 rounded-2xl border border-slate-100 dark:border-white/5 hover:border-slate-200 dark:hover:border-white/10 transition-all cursor-default">
                            <div className="flex items-center gap-4 md:gap-5">
                              <div className="h-12 w-12 rounded-[1rem] flex items-center justify-center font-black text-white text-lg shrink-0 shadow-sm" style={{ backgroundColor: avatarColor }}>
                                {exp.payerName.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 dark:text-white text-base md:text-lg tracking-tight mb-0.5 truncate max-w-[150px] md:max-w-[250px]">{exp.title}</p>
                                <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">{exp.payerName} • <span className="bg-slate-100 dark:bg-black/30 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md ml-1">{exp.category}</span></p>
                              </div>
                            </div>
                            <div className="flex items-center gap-4">
                              <p className="font-black text-slate-900 dark:text-white text-lg md:text-xl tracking-tighter">{symbol}{convert(exp.amount).toLocaleString(undefined, {maximumFractionDigits: 2})}</p>
                              {exp.paidById === user?.uid ? (
                                <button onClick={() => handleDeleteExpense(exp.id, exp.paidById)} className="p-2.5 text-slate-300 dark:text-slate-600 hover:text-white hover:bg-red-500 dark:hover:bg-red-500/80 rounded-xl transition-all border border-transparent hover:border-red-600 dark:hover:border-red-500/50 opacity-100 md:opacity-0 group-hover:opacity-100 shadow-sm" title="Delete entry"><Trash2 className="h-4 w-4 md:h-5 md:w-5" /></button>
                              ) : (
                                <div className="w-10 md:w-[46px] hidden md:block"></div> 
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
                
                {/* Settlement Algorithm Box */}
                <div className="bg-slate-900 dark:bg-black p-8 md:p-10 rounded-[2.5rem] shadow-2xl text-white relative overflow-hidden border border-transparent dark:border-white/10">
                  <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 mix-blend-overlay"></div>
                  <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/20 rounded-full blur-[60px] -translate-y-1/2 translate-x-1/2"></div>
                  <div className="absolute bottom-0 left-0 w-48 h-48 bg-sky-500/20 rounded-full blur-[60px] translate-y-1/2 -translate-x-1/2"></div>
                  
                  <div className="relative z-10">
                    <h3 className="text-2xl font-black mb-1 flex items-center tracking-tight"><DollarSign className="h-7 w-7 mr-2 text-emerald-400"/> Settlement</h3>
                    <p className="text-sm font-medium text-slate-400 mb-8">Who owes who.</p>
                    
                    {settlements.length === 0 ? (
                      <div className="bg-white/5 backdrop-blur-md p-8 rounded-3xl border border-white/10 text-center shadow-inner">
                        <div className="h-14 w-14 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/30"><DollarSign className="h-7 w-7 text-emerald-400" /></div>
                        <p className="text-emerald-400 font-black text-xl tracking-tight mb-1">All Settled Up!</p>
                        <p className="text-slate-400 text-sm font-medium">No debts currently detected.</p>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {settlements.map((settlement, idx) => (
                          <div key={idx} className="bg-white/5 hover:bg-white/10 border border-white/10 p-5 rounded-2xl flex items-center justify-between transition-colors backdrop-blur-md shadow-sm">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-slate-400 mb-0.5"><span className="font-black text-white text-base">{settlement.debtor}</span> owes</p>
                              <p className="text-sm font-black text-white">{settlement.creditor}</p>
                            </div>
                            <div className="bg-emerald-500/20 text-emerald-400 px-4 py-2.5 rounded-xl font-black text-lg shrink-0 border border-emerald-500/30 shadow-inner">
                              {symbol}{convert(settlement.amount).toLocaleString(undefined, {maximumFractionDigits: 0})}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="mt-8 pt-6 border-t border-white/10">
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                        <span className="text-emerald-500">Smart Algorithm Active</span> <br/> Calculates the absolute minimum number of transactions to make everyone even.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Chart Box */}
                <div className="bg-white dark:bg-[#0f172a] p-8 md:p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/10 shadow-sm transition-colors duration-300">
                  <h3 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight mb-1 flex items-center"><PieChartIcon className="h-6 w-6 mr-3 text-indigo-600 dark:text-indigo-400"/> Spending Data</h3>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-8">Breakdown by category.</p>
                  
                  {chartData.length === 0 ? (
                    <div className="h-56 flex flex-col items-center justify-center border-2 border-dashed border-slate-100 dark:border-white/10 rounded-3xl text-slate-400 dark:text-slate-600 bg-slate-50 dark:bg-black/20">
                      <PieChartIcon className="h-8 w-8 mb-3 text-slate-300 dark:text-slate-600" />
                      <p className="font-bold text-sm">Not enough data to graph</p>
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
                              border: '1px solid #e2e8f0', 
                              boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', 
                              backgroundColor: '#ffffff', 
                              color: '#0f172a',
                              fontWeight: 'bold',
                              padding: '12px'
                            }}
                            itemStyle={{ color: '#0f172a', fontWeight: '900' }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '800', color: '#64748b', marginTop: '10px' }}/>
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