"use client";
import { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { collection, addDoc, onSnapshot, query, where, orderBy, doc, deleteDoc } from "firebase/firestore"; 
import { onAuthStateChanged, User as FirebaseUser } from "firebase/auth";
import { auth, db } from "../lib/firebase"; 
import { Map, Calendar, CreditCard, Settings, PlaneTakeoff, Plus, Receipt, Trash2, BedDouble, Menu, X, DollarSign, Users, PieChart as PieChartIcon, TrendingUp } from "lucide-react";
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
      await addDoc(collection(db, "expenses"), {
        tripId: selectedTripId, title: expTitle, amount: parseFloat(expAmount), category: expCategory,
        payerName: expPayer.trim(), paidById: user.uid, createdAt: new Date()
      });
      setExpTitle(""); setExpAmount(""); setIsAdding(false);
    } catch (error) { console.error("Error adding:", error); setIsAdding(false); }
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
    <div className="flex h-screen bg-slate-50 font-sans text-slate-900 overflow-hidden">
      
      {/* MOBILE BLUR OVERLAY */}
      {isMobileMenuOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-40 md:hidden transition-opacity" onClick={() => setIsMobileMenuOpen(false)} />
      )}

      {/* RESPONSIVE SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 flex flex-col transform transition-transform duration-300 ease-in-out print:hidden ${isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"} md:relative md:translate-x-0`}>
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
          <Link href="/expenses" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 bg-indigo-50 text-indigo-700 rounded-xl font-medium shadow-sm transition-colors"><CreditCard className="h-5 w-5 mr-3" /> Expenses</Link>
          <Link href="/hotels" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><BedDouble className="h-5 w-5 mr-3" /> Book Hotels</Link>
          <Link href="/settings" onClick={() => setIsMobileMenuOpen(false)} className="flex items-center px-4 py-3 text-slate-600 hover:bg-slate-50 hover:text-slate-900 rounded-xl font-medium transition-colors"><Settings className="h-5 w-5 mr-3" /> Settings</Link>
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

        {/* HEADER */}
        <header className="h-auto md:h-16 py-4 md:py-0 bg-white border-b border-slate-200 flex flex-col md:flex-row md:items-center justify-between px-4 md:px-8 z-10 shrink-0 gap-4">
          <h2 className="text-xl font-semibold text-slate-800 hidden md:block">Group Finances</h2>
          <select value={selectedTripId} onChange={(e) => setSelectedTripId(e.target.value)} className="w-full md:w-64 border border-slate-300 rounded-xl p-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 font-bold text-slate-700 shadow-sm cursor-pointer">
            {trips.length === 0 ? <option>No trips found</option> : trips.map(t => <option key={t.id} value={t.id}>{t.title}</option>)}
          </select>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-50/50">
          <div className="max-w-6xl mx-auto space-y-6 md:space-y-8 pb-20">
            
            {/* --- ENHANCED: AT A GLANCE ROW --- */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-indigo-100 flex items-center justify-center text-indigo-600 shrink-0"><DollarSign className="h-6 w-6"/></div>
                <div><p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Total Trip Spent</p><h3 className="text-2xl md:text-3xl font-black text-slate-900">₹{totalSpent.toLocaleString(undefined, {maximumFractionDigits: 0})}</h3></div>
              </div>
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center gap-4">
                <div className="h-12 w-12 rounded-2xl bg-emerald-100 flex items-center justify-center text-emerald-600 shrink-0"><Users className="h-6 w-6"/></div>
                <div><p className="text-sm font-bold text-slate-400 uppercase tracking-wider">Group Size</p><h3 className="text-2xl md:text-3xl font-black text-slate-900">{totalMembers} <span className="text-lg font-medium text-slate-400">people</span></h3></div>
              </div>
              <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-6 rounded-3xl shadow-md flex items-center gap-4 text-white">
                <div className="h-12 w-12 rounded-2xl bg-white/20 flex items-center justify-center shrink-0 backdrop-blur-sm"><TrendingUp className="h-6 w-6 text-white"/></div>
                <div><p className="text-sm font-bold text-indigo-200 uppercase tracking-wider">Fair Share</p><h3 className="text-2xl md:text-3xl font-black">₹{fairShare.toLocaleString(undefined, {maximumFractionDigits: 0})} <span className="text-lg font-medium text-indigo-300">/each</span></h3></div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">
              
              {/* LEFT COLUMN: Add Expense & List */}
              <div className="lg:col-span-7 space-y-6 md:space-y-8">
                
                {/* Add Expense Form */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-50 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                  <h3 className="text-xl font-black text-slate-900 mb-6 flex items-center relative z-10"><Plus className="h-6 w-6 mr-2 text-indigo-600"/> Log New Expense</h3>
                  <form onSubmit={handleAddExpense} className="grid grid-cols-1 md:grid-cols-2 gap-5 relative z-10">
                    <div className="md:col-span-2">
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Description</label>
                      <input type="text" value={expTitle} onChange={(e)=>setExpTitle(e.target.value)} placeholder="e.g. Dinner at Seaside Cafe" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-3.5 outline-none font-medium text-slate-900 transition-colors" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Amount (₹)</label>
                      <input type="number" value={expAmount} onChange={(e)=>setExpAmount(e.target.value)} placeholder="0.00" min="1" step="any" className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-3.5 outline-none font-black text-slate-900 transition-colors" required />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Who Paid?</label>
                      <input type="text" value={expPayer} onChange={(e)=>setExpPayer(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-3.5 outline-none font-medium text-slate-900 transition-colors" required />
                    </div>
                    <div className="md:col-span-2 flex flex-col md:flex-row gap-4 items-end">
                      <div className="w-full md:flex-1">
                        <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Category</label>
                        <select value={expCategory} onChange={(e)=>setExpCategory(e.target.value)} className="w-full bg-slate-50 border border-slate-200 focus:border-indigo-500 rounded-xl p-3.5 outline-none font-medium text-slate-900 transition-colors cursor-pointer">
                          <option>Food</option><option>Transport</option><option>Lodging</option><option>Activities</option><option>Other</option>
                        </select>
                      </div>
                      <button type="submit" disabled={isAdding || !selectedTripId} className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3.5 rounded-xl font-bold hover:bg-indigo-700 shadow-md hover:shadow-lg transition-all disabled:opacity-50 shrink-0">
                        {isAdding ? "Saving..." : "Save Expense"}
                      </button>
                    </div>
                  </form>
                </div>

                {/* Expense Ledger */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-black text-slate-900 flex items-center"><Receipt className="h-6 w-6 mr-2 text-indigo-600"/> Ledger</h3>
                    <span className="text-xs font-bold bg-slate-100 text-slate-500 px-3 py-1 rounded-full">{expenses.length} entries</span>
                  </div>
                  
                  {expenses.length === 0 ? (
                    <div className="text-center py-12 border-2 border-dashed border-slate-100 rounded-2xl">
                      <Receipt className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                      <p className="text-slate-500 font-medium">No expenses logged yet.</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {expenses.map(exp => (
                        <div key={exp.id} className="group flex items-center justify-between p-4 bg-white hover:bg-slate-50 rounded-2xl border border-slate-100 transition-all">
                          <div className="flex items-center gap-4">
                            <div className="h-10 w-10 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm shrink-0 uppercase">
                              {exp.payerName.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 text-sm md:text-base">{exp.title}</p>
                              <p className="text-xs text-slate-500 mt-0.5">{exp.payerName} • <span className="bg-slate-100 px-2 py-0.5 rounded-md">{exp.category}</span></p>
                            </div>
                          </div>
                          <div className="flex items-center">
                            <p className="font-black text-slate-900 mr-2 md:mr-4">₹{exp.amount.toLocaleString()}</p>
                            {exp.paidById === user?.uid ? (
                              <button onClick={() => handleDeleteExpense(exp.id, exp.paidById)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all" title="Delete entry"><Trash2 className="h-4 w-4 md:h-5 md:w-5" /></button>
                            ) : (
                              <div className="w-8 md:w-9"></div> // Spacer to keep alignment clean
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Charts & Settlement */}
              <div className="lg:col-span-5 space-y-6 md:space-y-8">
                
                {/* Settlement Algorithm Box */}
                <div className="bg-slate-900 p-6 md:p-8 rounded-3xl shadow-xl text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-emerald-500 opacity-10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                  <h3 className="text-xl font-black mb-6 flex items-center relative z-10"><DollarSign className="h-6 w-6 mr-2 text-emerald-400"/> How to Settle Up</h3>
                  
                  {settlements.length === 0 ? (
                    <div className="bg-white/10 p-6 rounded-2xl border border-white/10 text-center relative z-10 backdrop-blur-sm">
                      <p className="text-emerald-300 font-bold mb-1">All Settled!</p>
                      <p className="text-slate-400 text-sm">No debts currently detected.</p>
                    </div>
                  ) : (
                    <div className="space-y-3 relative z-10">
                      {settlements.map((settlement, idx) => (
                        <div key={idx} className="bg-white/10 hover:bg-white/15 border border-white/5 p-4 rounded-2xl flex items-center justify-between transition-colors backdrop-blur-sm">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-slate-300"><span className="font-bold text-white">{settlement.debtor}</span> owes</p>
                            <p className="text-sm font-medium text-slate-300"><span className="font-bold text-white">{settlement.creditor}</span></p>
                          </div>
                          <div className="bg-emerald-500/20 text-emerald-300 px-4 py-2 rounded-xl font-black shrink-0 border border-emerald-500/30">
                            ₹{settlement.amount.toLocaleString(undefined, {maximumFractionDigits: 0})}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <p className="text-[10px] text-slate-500 mt-6 leading-relaxed relative z-10">
                    *This smart algorithm calculates the absolute minimum number of transactions required to make everyone even.
                  </p>
                </div>

                {/* Chart Box */}
                <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200 shadow-sm">
                  <h3 className="text-lg font-black text-slate-900 mb-6 flex items-center"><PieChartIcon className="h-5 w-5 mr-2 text-indigo-600"/> Spending by Category</h3>
                  {chartData.length === 0 ? (
                    <div className="h-48 flex items-center justify-center border-2 border-dashed border-slate-100 rounded-2xl text-slate-400 font-medium">Not enough data</div>
                  ) : (
                    <div className="h-64 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={chartData} cx="50%" cy="50%" innerRadius={70} outerRadius={90} paddingAngle={3} dataKey="value" stroke="none">
                            {chartData.map((entry, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                          </Pie>
                          <Tooltip 
                            formatter={(value: any) => `₹${value ? value.toLocaleString() : 0}`}
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', fontWeight: '600', color: '#64748b' }}/>
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