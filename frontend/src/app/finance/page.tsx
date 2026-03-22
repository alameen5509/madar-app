"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { api } from "@/lib/api";

/* ═══ Types ═══════════════════════════════════════════════════════════════ */

type ExpenseClass = "essential" | "luxury" | "improvement";

/** الحساب = أين يقع المال (بنك، نقد، محفظة إلكترونية) */
interface Account {
  id: string;
  name: string;
  icon: string;
  balance: number;
}

/** المحفظة = لمن هذا المال / الغرض (شخصي، ديون، ادخار، أقساط) */
interface Pocket {
  id: string;
  name: string;
  icon: string;
  type: "personal" | "debt" | "savings" | "installment" | "emergency";
  balance: number;
  commitments: PocketCommitment[];
}

interface PocketCommitment {
  id: string;
  title: string;
  monthlyAmount: number;
  totalAmount?: number;
  paidSoFar: number;
  dueDay: number;
}

interface Transaction {
  id: string;
  title: string;
  amount: number;
  type: "income" | "expense" | "transfer" | "debt_payment" | "installment" | "gift";
  category: string;
  expenseClass?: ExpenseClass;
  accountId: string;
  pocketId: string;
  date: string;
  approvedAt?: string;
}

/** الديون مع بيانات الدائن */
interface Debt {
  id: string;
  creditorName: string;
  creditorPhone: string;
  originalAmount: number;
  paidSoFar: number;
  monthlyPayment: number;
  notes?: string;
  createdAt: string;
}

/** مستحقات مستقبلية (رواتب، فواتير، أقساط) */
interface RecurringDue {
  id: string;
  title: string;
  amount: number;
  type: "salary" | "bill" | "installment" | "expected_income" | "expected_expense" | "nafaqa" | "rent" | "subscription" | "insurance";
  frequency: "monthly" | "yearly" | "once";
  dueDay: number; // يوم الشهر
  dueMonth?: number; // للسنوي
  accountId?: string;
  pocketId?: string;
  category?: string;
  isActive: boolean;
  lastConfirmedDate?: string; // آخر مرة تأكد
}

interface GoldPurchase {
  id: string;
  grams: number;
  pricePerGram: number;
  totalCost: number;
  date: string;
  notes?: string;
}

interface ZakatData {
  hawalDate: string; // تاريخ بداية الحول (هجري ISO)
  goldGrams: number; // إجمالي الذهب (جرام)
  goldPurchases: GoldPurchase[];
}

interface FinGoal {
  id: string;
  title: string;
  description: string;
  targetAmount: number;
  savedSoFar: number;
  deadline: string;
  items: { name: string; cost: number }[];
}

interface Deduction {
  id: string;
  title: string;
  type: "percent" | "fixed";
  value: number;
  source: "all" | string;
  targetPocketId?: string;
  paidSoFar: number; // المبلغ المسدد حتى الآن
}

interface Receivable {
  id: string;
  title: string;
  amount: number;
  fromWhom: string;
  dueDate?: string;
  isPaid: boolean;
}

interface FinSettings {
  debtPercent: number;
  savingsPercent: number;
  expenseCategories: string[];
  incomeCategories: string[];
  deductions: Deduction[];
  receivables: Receivable[];
}

/* ═══ Constants ═══════════════════════════════════════════════════════════ */

// الأنواع الأساسية: دخل | مصروف | تحويل
const TX_TYPES = [
  { key: "income",   label: "دخل",    icon: "📥", color: "#3D8C5A" },
  { key: "expense",  label: "مصروف",  icon: "📤", color: "#DC2626" },
  { key: "transfer", label: "تحويل",  icon: "🔄", color: "#6B7280" },
] as const;

// أقسام المصروف الفرعية
const EXPENSE_SUBS = [
  { key: "expense",      label: "مصروف عام", icon: "📤" },
  { key: "debt_payment", label: "سداد دين",  icon: "💳" },
  { key: "installment",  label: "قسط",       icon: "📋" },
  { key: "gift",         label: "هدية",      icon: "🎁" },
] as const;

const DEF_EXP_CATS = ["طعام", "مواصلات", "سكن", "فواتير", "صحة", "تعليم", "ترفيه", "ملابس", "اشتراكات", "صيانة", "تبرعات", "أخرى"];
const DEF_INC_CATS = ["راتب", "عمل حر", "استثمار", "مكافأة", "إيجار", "أخرى"];
const DUE_TYPES = [
  { key: "salary",           label: "راتب",        icon: "💼", color: "#3D8C5A" },
  { key: "bill",             label: "فاتورة",      icon: "📄", color: "#DC2626" },
  { key: "installment",      label: "قسط",         icon: "📋", color: "#8C4A3D" },
  { key: "nafaqa",           label: "نفقة",        icon: "👨‍👩‍👧", color: "#5E5495" },
  { key: "rent",             label: "إيجار",       icon: "🏠", color: "#0F3460" },
  { key: "subscription",     label: "اشتراك",      icon: "📱", color: "#2D6B9E" },
  { key: "insurance",        label: "تأمين",       icon: "🛡️", color: "#6B7280" },
  { key: "expected_income",  label: "دخل متوقع",   icon: "📥", color: "#0F3460" },
  { key: "expected_expense", label: "مصروف متوقع", icon: "📤", color: "#D4AF37" },
] as const;
const EXP_CLS: Record<ExpenseClass, { label: string; color: string; icon: string }> = {
  essential:   { label: "ضروري",  color: "#3D8C5A", icon: "🟢" },
  luxury:      { label: "كمالي",  color: "#D4AF37", icon: "🟡" },
  improvement: { label: "تحسيني", color: "#0F3460", icon: "🔵" },
};
const POCKET_TYPES = [
  { key: "personal",    label: "شخصي",   icon: "👤" },
  { key: "debt",        label: "ديون",   icon: "💳" },
  { key: "savings",     label: "ادخار",  icon: "💎" },
  { key: "installment", label: "أقساط",  icon: "📋" },
  { key: "emergency",   label: "طوارئ",  icon: "🆘" },
] as const;
const ACCT_ICONS = ["🏦", "💰", "📱", "💳", "🏠"];

/* ═══ Helpers ═════════════════════════════════════════════════════════════ */

function load<T>(k: string, d: T): T { if (typeof window === "undefined") return d; try { return JSON.parse(localStorage.getItem(k)!) ?? d; } catch { return d; } }
function save<T>(k: string, v: T) { localStorage.setItem(k, JSON.stringify(v)); }

const DEF_ACCOUNTS: Account[] = [
  { id: "a1", name: "البنك الرئيسي", icon: "🏦", balance: 0 },
  { id: "a2", name: "نقد", icon: "💰", balance: 0 },
];
const DEF_POCKETS: Pocket[] = [
  { id: "p1", name: "المصاريف الشخصية", icon: "👤", type: "personal", balance: 0, commitments: [] },
  { id: "p2", name: "محفظة الديون", icon: "💳", type: "debt", balance: 0, commitments: [] },
  { id: "p3", name: "محفظة الادخار", icon: "💎", type: "savings", balance: 0, commitments: [] },
];

/* ═══ Debt Section ════════════════════════════════════════════════════════ */

function DebtSection({ debts, onUpdate }: { debts: Debt[]; onUpdate: (d: Debt[]) => void }) {
  const [showAdd, setShowAdd] = useState(false);
  const [name, setName]       = useState("");
  const [phone, setPhone]     = useState("");
  const [amount, setAmount]   = useState("");
  const [monthly, setMonthly] = useState("");
  const [notes, setNotes]     = useState("");
  const [payId, setPayId]     = useState<string | null>(null);
  const [payAmt, setPayAmt]   = useState("");

  // Sort: smallest remaining first (snowball method)
  const sorted = [...debts].sort((a, b) => (a.originalAmount - a.paidSoFar) - (b.originalAmount - b.paidSoFar));
  const totalDebt = debts.reduce((s, d) => s + d.originalAmount, 0);
  const totalPaid = debts.reduce((s, d) => s + d.paidSoFar, 0);
  const totalRemaining = totalDebt - totalPaid;
  const totalMonthly = debts.reduce((s, d) => s + d.monthlyPayment, 0);

  function addDebt() {
    if (!name.trim() || !amount) return;
    const d: Debt = {
      id: Date.now().toString(), creditorName: name.trim(), creditorPhone: phone.trim(),
      originalAmount: Number(amount), paidSoFar: 0, monthlyPayment: Number(monthly) || 0,
      notes: notes.trim() || undefined, createdAt: new Date().toISOString().slice(0, 10),
    };
    onUpdate([...debts, d]);
    setName(""); setPhone(""); setAmount(""); setMonthly(""); setNotes(""); setShowAdd(false);
  }

  function payDebt() {
    if (!payId || !payAmt) return;
    onUpdate(debts.map((d) => d.id === payId ? { ...d, paidSoFar: d.paidSoFar + Number(payAmt) } : d));
    setPayId(null); setPayAmt("");
  }

  return (
    <section className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">إجمالي الديون</p>
          <p className="text-lg font-black text-[#DC2626]">{totalDebt.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">المسدد</p>
          <p className="text-lg font-black text-[#3D8C5A]">{totalPaid.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-xl p-4 border border-gray-200 text-center">
          <p className="text-[10px] text-[#6B7280]">المتبقي</p>
          <p className="text-lg font-black text-[#0F3460]">{totalRemaining.toLocaleString()}</p>
        </div>
      </div>

      {totalDebt > 0 && (
        <div className="bg-white rounded-xl p-4 border border-gray-200">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-[#6B7280]">تقدم السداد الكلي</span>
            <span className="font-bold text-[#3D8C5A]">{totalDebt > 0 ? Math.round(totalPaid / totalDebt * 100) : 0}%</span>
          </div>
          <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden">
            <div className="h-full rounded-full bg-[#3D8C5A]" style={{ width: `${totalDebt > 0 ? Math.round(totalPaid / totalDebt * 100) : 0}%` }} />
          </div>
          <p className="text-[10px] text-[#9CA3AF] mt-1">إجمالي الأقساط الشهرية: {totalMonthly.toLocaleString()} ريال</p>
        </div>
      )}

      {/* Debt list - sorted smallest first */}
      <GeometricDivider label="الديون — من الأقل إلى الأكثر" />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#6B7280]">طريقة كرة الثلج: سدد الأصغر أولاً</p>
        <button onClick={() => setShowAdd(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#2C2C54" }}>+ دين جديد</button>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12 bg-green-50 rounded-xl border border-green-200">
          <p className="text-2xl mb-2">🎉</p>
          <p className="text-green-700 font-semibold">لا توجد ديون — الحمد لله</p>
        </div>
      )}

      {sorted.map((d, i) => {
        const remaining = d.originalAmount - d.paidSoFar;
        const pct = d.originalAmount > 0 ? Math.round(d.paidSoFar / d.originalAmount * 100) : 0;
        const isFirst = i === 0 && remaining > 0;

        return (
          <div key={d.id} className={`bg-white rounded-xl border shadow-sm overflow-hidden ${isFirst ? "border-[#D4AF37] ring-2 ring-[#D4AF37]/20" : "border-gray-200"}`}>
            {isFirst && <div className="bg-[#D4AF37] text-white text-[10px] font-bold text-center py-1">⚡ أولوية السداد</div>}
            <div className="p-5">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <p className="font-bold text-[#16213E]">{d.creditorName}</p>
                  {d.creditorPhone && (
                    <a href={`tel:${d.creditorPhone}`} className="text-xs text-[#2C2C54] hover:underline flex items-center gap-1 mt-0.5">
                      📞 {d.creditorPhone}
                    </a>
                  )}
                  {d.notes && <p className="text-[10px] text-[#9CA3AF] mt-1">{d.notes}</p>}
                </div>
                <div className="flex items-center gap-2">
                  {d.creditorPhone && (
                    <a href={`https://wa.me/${d.creditorPhone.replace(/\D/g, "")}`} target="_blank"
                      className="text-xs px-2 py-1 rounded-lg bg-green-50 text-green-600 border border-green-200 hover:bg-green-100">
                      واتساب
                    </a>
                  )}
                  <button onClick={() => onUpdate(debts.filter((x) => x.id !== d.id))}
                    className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 mb-3">
                <div>
                  <p className="text-[9px] text-[#9CA3AF]">المبلغ الأصلي</p>
                  <p className="text-sm font-black text-[#16213E]">{d.originalAmount.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#9CA3AF]">المسدد</p>
                  <p className="text-sm font-black text-[#3D8C5A]">{d.paidSoFar.toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-[9px] text-[#9CA3AF]">المتبقي</p>
                  <p className="text-sm font-black text-[#DC2626]">{remaining.toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-3">
                <div className="flex justify-between text-[9px] text-[#6B7280] mb-1">
                  <span>السداد</span><span>{pct}%</span>
                </div>
                <div className="bg-gray-100 rounded-full h-2 overflow-hidden">
                  <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: pct >= 100 ? "#3D8C5A" : "#D4AF37" }} />
                </div>
              </div>

              {remaining > 0 && (
                <>
                  {d.monthlyPayment > 0 && (
                    <p className="text-[10px] text-[#6B7280] mb-2">القسط الشهري: {d.monthlyPayment.toLocaleString()} ريال · متبقي ~{Math.ceil(remaining / d.monthlyPayment)} شهر</p>
                  )}

                  {payId === d.id ? (
                    <div className="flex gap-2 mt-2">
                      <input type="number" value={payAmt} onChange={(e) => setPayAmt(e.target.value)} placeholder="مبلغ السداد"
                        className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                      <button onClick={payDebt} className="px-4 py-2 rounded-lg text-xs font-bold text-white bg-[#3D8C5A]">سدد</button>
                      <button onClick={() => setPayId(null)} className="px-3 py-2 rounded-lg text-xs text-[#6B7280] bg-gray-100">✕</button>
                    </div>
                  ) : (
                    <button onClick={() => { setPayId(d.id); setPayAmt(String(d.monthlyPayment || "")); }}
                      className="w-full py-2 rounded-lg text-xs font-bold text-white mt-1" style={{ background: "#2C2C54" }}>
                      💳 تسجيل سداد
                    </button>
                  )}
                </>
              )}

              {remaining <= 0 && (
                <div className="text-center py-2 bg-green-50 rounded-lg">
                  <p className="text-green-700 text-xs font-bold">✅ تم السداد بالكامل — الحمد لله</p>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {/* Add debt form */}
      {showAdd && (
        <div className="bg-white rounded-xl p-5 border border-gray-200 fade-up space-y-3">
          <p className="font-bold text-sm text-[#16213E]">إضافة دين جديد</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم الدائن *"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="رقم الجوال (اختياري)" type="tel"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
          <input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="مبلغ الدين *"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
          <input type="number" value={monthly} onChange={(e) => setMonthly(e.target.value)} placeholder="القسط الشهري (اختياري)"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
          <input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
            <button onClick={addDebt} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#2C2C54" }}>إضافة الدين</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ═══ Stat Card ════════════════════════════════════════════════════════════ */

function Stat({ label, value, color, sub }: { label: string; value: number; color: string; sub?: string }) {
  return (
    <div className="bg-white rounded-xl p-4 border border-gray-200 shadow-sm text-center">
      <p className="text-[#6B7280] text-[10px] mb-0.5">{label}</p>
      <p className="text-lg font-black" style={{ color }}>{value.toLocaleString()}</p>
      <p className="text-[8px] text-[#9CA3AF]">{sub ?? "ريال"}</p>
    </div>
  );
}

/* ═══ Dues Section (مستحقات مالية) ════════════════════════════════════════ */

function DuesSection({ dues, accounts, pockets, expCats, incCats, onUpdate, onConfirm }: {
  dues: RecurringDue[]; accounts: Account[]; pockets: Pocket[];
  expCats: string[]; incCats: string[];
  onUpdate: (d: RecurringDue[]) => void; onConfirm: (d: RecurringDue) => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [dTitle, setDTitle]   = useState("");
  const [dAmount, setDAmount] = useState("");
  const [dType, setDType]     = useState<RecurringDue["type"]>("salary");
  const [dFreq, setDFreq]     = useState<RecurringDue["frequency"]>("monthly");
  const [dDay, setDDay]       = useState("27");
  const [dAcct, setDAcct]     = useState("");
  const [dPocket, setDPocket] = useState("");
  const [dCat, setDCat]       = useState("");

  function addDue() {
    if (!dTitle.trim() || !dAmount) return;
    const d: RecurringDue = {
      id: Date.now().toString(), title: dTitle.trim(), amount: Number(dAmount),
      type: dType, frequency: dFreq, dueDay: Number(dDay) || 1,
      accountId: dAcct || undefined, pocketId: dPocket || undefined,
      category: dCat || undefined, isActive: true,
    };
    onUpdate([...dues, d]);
    setDTitle(""); setDAmount(""); setShowAdd(false);
  }

  const today = new Date();
  const todayDay = today.getDate();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;

  const activeDues = dues.filter((d) => d.isActive);
  const incomeDues = activeDues.filter((d) => d.type === "salary" || d.type === "expected_income");
  const expenseDues = activeDues.filter((d) => d.type !== "salary" && d.type !== "expected_income");

  function isDueNow(d: RecurringDue): boolean {
    if (d.frequency === "yearly" && d.dueMonth !== today.getMonth() + 1) return false;
    const confirmed = d.lastConfirmedDate?.startsWith(currentMonthStr);
    return !confirmed && todayDay >= d.dueDay;
  }

  const totalMonthlyIncome = incomeDues.filter(d => d.frequency === "monthly").reduce((s, d) => s + d.amount, 0);
  const totalMonthlyExpense = expenseDues.filter(d => d.frequency === "monthly").reduce((s, d) => s + d.amount, 0);

  return (
    <section className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-2 gap-3">
        <Stat label="دخل شهري متوقع" value={totalMonthlyIncome} color="#3D8C5A" />
        <Stat label="مصاريف شهرية ثابتة" value={totalMonthlyExpense} color="#DC2626" />
      </div>

      {/* Due Now - needs action */}
      {activeDues.filter(isDueNow).length > 0 && (
        <>
          <GeometricDivider label="مستحقات الآن — تحتاج تأكيد" />
          <div className="space-y-2">
            {activeDues.filter(isDueNow).map((d) => {
              const meta = DUE_TYPES.find((t) => t.key === d.type);
              const isIncome = d.type === "salary" || d.type === "expected_income";
              return (
                <div key={d.id} className="bg-white rounded-xl px-5 py-4 border-2 shadow-sm"
                  style={{ borderColor: isIncome ? "#3D8C5A" : "#DC2626" }}>
                  <div className="flex items-center gap-3">
                    <span className="text-xl">{meta?.icon}</span>
                    <div className="flex-1">
                      <p className="text-sm font-bold text-[#16213E]">{d.title}</p>
                      <p className="text-[10px] text-[#6B7280]">يوم {d.dueDay} · {meta?.label} · {d.amount.toLocaleString()} ريال</p>
                    </div>
                    <button onClick={() => onConfirm(d)}
                      className="px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
                      style={{ background: isIncome ? "#3D8C5A" : "#DC2626" }}>
                      {isIncome ? "تم الاستلام" : "تم الدفع"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Income dues */}
      <GeometricDivider label="الدخل المتوقع" />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#6B7280]">رواتب ودخل متكرر</p>
        <button onClick={() => { setDType("salary"); setShowAdd(true); }} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#3D8C5A" }}>+ راتب / دخل</button>
      </div>
      {incomeDues.length === 0 && <p className="text-center text-[#9CA3AF] text-xs py-4">لا توجد مصادر دخل مجدولة</p>}
      {incomeDues.map((d) => {
        const confirmed = d.lastConfirmedDate?.startsWith(currentMonthStr);
        return (
          <div key={d.id} className={`bg-white rounded-xl px-5 py-4 border border-gray-200 flex items-center gap-3 ${confirmed ? "opacity-50" : ""}`}>
            <span className="text-lg">{DUE_TYPES.find((t) => t.key === d.type)?.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#16213E]">{d.title}</p>
              <p className="text-[10px] text-[#6B7280]">يوم {d.dueDay} · {d.frequency === "monthly" ? "شهري" : d.frequency === "yearly" ? "سنوي" : "مرة واحدة"}</p>
            </div>
            <p className="text-sm font-black text-[#3D8C5A]">{d.amount.toLocaleString()}</p>
            {confirmed && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">تم</span>}
            <button onClick={() => onUpdate(dues.filter((x) => x.id !== d.id))} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
          </div>
        );
      })}

      {/* Expense dues */}
      <GeometricDivider label="المصاريف الثابتة" />
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-[#6B7280]">فواتير وأقساط ومستحقات</p>
        <button onClick={() => { setDType("bill"); setShowAdd(true); }} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#DC2626" }}>+ فاتورة / قسط</button>
      </div>
      {expenseDues.length === 0 && <p className="text-center text-[#9CA3AF] text-xs py-4">لا توجد مصاريف ثابتة</p>}
      {expenseDues.map((d) => {
        const confirmed = d.lastConfirmedDate?.startsWith(currentMonthStr);
        return (
          <div key={d.id} className={`bg-white rounded-xl px-5 py-4 border border-gray-200 flex items-center gap-3 ${confirmed ? "opacity-50" : ""}`}>
            <span className="text-lg">{DUE_TYPES.find((t) => t.key === d.type)?.icon}</span>
            <div className="flex-1">
              <p className="text-sm font-medium text-[#16213E]">{d.title}</p>
              <p className="text-[10px] text-[#6B7280]">يوم {d.dueDay} · {d.frequency === "monthly" ? "شهري" : d.frequency === "yearly" ? "سنوي" : "مرة واحدة"}</p>
            </div>
            <p className="text-sm font-black text-[#DC2626]">{d.amount.toLocaleString()}</p>
            {confirmed && <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">تم</span>}
            <button onClick={() => onUpdate(dues.filter((x) => x.id !== d.id))} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
          </div>
        );
      })}

      {/* Add due form */}
      {showAdd && (
        <div className="bg-white rounded-xl p-5 border border-gray-200 fade-up space-y-3">
          <p className="font-bold text-sm text-[#16213E]">إضافة مستحق جديد</p>
          <div className="flex gap-1 flex-wrap">
            {DUE_TYPES.map((t) => (
              <button key={t.key} onClick={() => setDType(t.key as RecurringDue["type"])}
                className="px-2.5 py-1.5 rounded-lg text-[10px] font-semibold transition"
                style={{ background: dType === t.key ? t.color : "#F3F4F6", color: dType === t.key ? "#fff" : "#6B7280" }}>
                {t.icon} {t.label}
              </button>
            ))}
          </div>
          <input value={dTitle} onChange={(e) => setDTitle(e.target.value)} placeholder="مثال: راتب الشركة، فاتورة الكهرباء…"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
          <input type="number" value={dAmount} onChange={(e) => setDAmount(e.target.value)} placeholder="المبلغ"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
          <div className="flex gap-2">
            {([["monthly","شهري"],["yearly","سنوي"],["once","مرة واحدة"]] as const).map(([k, l]) => (
              <button key={k} onClick={() => setDFreq(k)} className="flex-1 py-1.5 rounded-lg text-xs font-medium"
                style={{ background: dFreq === k ? "#2C2C54" : "#F3F4F6", color: dFreq === k ? "#fff" : "#6B7280" }}>{l}</button>
            ))}
          </div>
          <input type="number" min={1} max={31} value={dDay} onChange={(e) => setDDay(e.target.value)} placeholder="يوم الاستحقاق في الشهر"
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
          <select value={dAcct} onChange={(e) => setDAcct(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]">
            <option value="">الحساب (اختياري)</option>
            {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
          </select>
          <div className="flex gap-1.5 flex-wrap">
            {(dType === "salary" || dType === "expected_income" ? incCats : expCats).map((c) => (
              <button key={c} onClick={() => setDCat(c)} className="px-2 py-1 rounded-lg text-[10px] font-medium"
                style={{ background: dCat === c ? "#2C2C54" : "#F3F4F6", color: dCat === c ? "#fff" : "#6B7280" }}>{c}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => setShowAdd(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
            <button onClick={addDue} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#2C2C54" }}>إضافة</button>
          </div>
        </div>
      )}
    </section>
  );
}

/* ═══ Finance Settings Section ═══════════════════════════════════════════ */

function FinSettingsSection({ settings, onUpdate }: { settings: FinSettings; onUpdate: (s: FinSettings) => void }) {
  const [newExpCat, setNewExpCat] = useState("");
  const [newIncCat, setNewIncCat] = useState("");

  return (
    <section className="space-y-5">
      <GeometricDivider label="استقطاعات ثابتة من الدخل" />
      <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-5">
        {([["debtPercent","💳 سداد ديون"] as const, ["savingsPercent","💎 ادخار"] as const]).map(([key, label]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-sm text-[#16213E]">{label}</span>
            <div className="flex items-center gap-2">
              <button onClick={() => onUpdate({ ...settings, [key]: Math.max(0, settings[key] - 5) })} className="w-8 h-8 rounded-lg bg-gray-100 font-bold">-</button>
              <span className="text-lg font-black text-[#2C2C54] w-12 text-center">{settings[key]}%</span>
              <button onClick={() => onUpdate({ ...settings, [key]: Math.min(50, settings[key] + 5) })} className="w-8 h-8 rounded-lg bg-gray-100 font-bold">+</button>
            </div>
          </div>
        ))}
      </div>

      <GeometricDivider label="بنود الصرف" />
      <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {(settings.expenseCategories ?? DEF_EXP_CATS).map((c) => (
            <span key={c} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-700 border border-red-200">
              {c}
              <button onClick={() => onUpdate({ ...settings, expenseCategories: settings.expenseCategories.filter((x) => x !== c) })}
                className="text-red-400 hover:text-red-600 text-[10px]">✕</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newExpCat} onChange={(e) => setNewExpCat(e.target.value)} placeholder="بند صرف جديد…"
            onKeyDown={(e) => { if (e.key === "Enter" && newExpCat.trim()) { onUpdate({ ...settings, expenseCategories: [...settings.expenseCategories, newExpCat.trim()] }); setNewExpCat(""); } }}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#D4AF37]" />
          <button onClick={() => { if (newExpCat.trim()) { onUpdate({ ...settings, expenseCategories: [...settings.expenseCategories, newExpCat.trim()] }); setNewExpCat(""); } }}
            className="px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#DC2626" }}>+</button>
        </div>
      </div>

      <GeometricDivider label="أنواع الدخل" />
      <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-3">
        <div className="flex gap-1.5 flex-wrap">
          {(settings.incomeCategories ?? DEF_INC_CATS).map((c) => (
            <span key={c} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-green-50 text-green-700 border border-green-200">
              {c}
              <button onClick={() => onUpdate({ ...settings, incomeCategories: settings.incomeCategories.filter((x) => x !== c) })}
                className="text-green-400 hover:text-green-600 text-[10px]">✕</button>
            </span>
          ))}
        </div>
        <div className="flex gap-2">
          <input value={newIncCat} onChange={(e) => setNewIncCat(e.target.value)} placeholder="نوع دخل جديد…"
            onKeyDown={(e) => { if (e.key === "Enter" && newIncCat.trim()) { onUpdate({ ...settings, incomeCategories: [...settings.incomeCategories, newIncCat.trim()] }); setNewIncCat(""); } }}
            className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#D4AF37]" />
          <button onClick={() => { if (newIncCat.trim()) { onUpdate({ ...settings, incomeCategories: [...settings.incomeCategories, newIncCat.trim()] }); setNewIncCat(""); } }}
            className="px-3 py-2 rounded-lg text-xs font-bold text-white" style={{ background: "#3D8C5A" }}>+</button>
        </div>
      </div>
    </section>
  );
}

/* ═══ Page ════════════════════════════════════════════════════════════════ */

export default function FinancePage() {
  const [txs, setTxs]           = useState<Transaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>(DEF_ACCOUNTS);
  const [pockets, setPockets]   = useState<Pocket[]>(DEF_POCKETS);
  const [settings, setSettings] = useState<FinSettings>({ debtPercent: 10, savingsPercent: 10, expenseCategories: DEF_EXP_CATS, incomeCategories: DEF_INC_CATS, deductions: [], receivables: [] });
  const [debts, setDebts]       = useState<Debt[]>([]);
  const [dues, setDues]         = useState<RecurringDue[]>([]);
  const [zakatData, setZakatData] = useState<ZakatData>({ hawalDate: "", goldGrams: 0, goldPurchases: [] });
  const [finGoals, setFinGoals] = useState<FinGoal[]>([]);
  const [goldPrice, setGoldPriceRaw] = useState<number>(0);
  function setGoldPrice(v: number) { setGoldPriceRaw(v); if (v > 0) save("mfin_gold_price", v); }
  const [tab, setTab] = useState<"overview" | "transactions" | "accounts" | "pockets" | "debts" | "dues" | "goals" | "deductions" | "receivables" | "gold" | "zakat" | "settings">("overview");
  const [showAdd, setShowAdd] = useState(false);
  const [month, setMonth]     = useState(() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; });

  // Add form
  const [fType, setFType]     = useState<Transaction["type"]>("expense");
  const [fTitle, setFTitle]   = useState("");
  const [fAmount, setFAmount] = useState("");
  const [fCat, setFCat]       = useState("أخرى");
  const [fExpCls, setFExpCls] = useState<ExpenseClass>("essential");
  const [fAcct, setFAcct]     = useState("");
  const [fPocket, setFPocket] = useState("");
  const [fDate, setFDate]     = useState(() => new Date().toISOString().slice(0,10));

  // Add account/pocket
  const [showNewAcct, setShowNewAcct]     = useState(false);
  const [naName, setNaName] = useState(""); const [naIcon, setNaIcon] = useState("🏦"); const [naBal, setNaBal] = useState("");
  const [showNewPocket, setShowNewPocket] = useState(false);
  const [npName, setNpName] = useState(""); const [npIcon, setNpIcon] = useState("👤"); const [npType, setNpType] = useState<Pocket["type"]>("personal");
  const [showAddCommit, setShowAddCommit] = useState<string | null>(null);
  const [editAcctId, setEditAcctId] = useState<string | null>(null);
  const [editAcctBal, setEditAcctBal] = useState("");
  // Goal modals
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [gfTitle, setGfTitle] = useState(""); const [gfDeadline, setGfDeadline] = useState(""); const [gfAmount, setGfAmount] = useState("");
  const [showSaveForm, setShowSaveForm] = useState<string | null>(null);
  const [sfAmount, setSfAmount] = useState("");
  const [showItemForm, setShowItemForm] = useState<string | null>(null);
  const [ifName, setIfName] = useState(""); const [ifCost, setIfCost] = useState("");
  const [showMoreTabs, setShowMoreTabs] = useState(false);
  // Gold alert
  const [goldAdvice, setGoldAdvice] = useState<string | null>(null);
  const [showTransfer, setShowTransfer]   = useState(false);
  // Deductions form
  const [showAddDed, setShowAddDed] = useState(false);
  const [ddTitle, setDdTitle] = useState(""); const [ddType, setDdType] = useState<"percent"|"fixed">("percent");
  const [ddValue, setDdValue] = useState(""); const [ddSource, setDdSource] = useState("all");
  // Receivables form
  const [showAddRec, setShowAddRec] = useState(false);
  const [rrTitle, setRrTitle] = useState(""); const [rrAmount, setRrAmount] = useState("");
  const [rrFrom, setRrFrom] = useState(""); const [rrDate, setRrDate] = useState("");
  // Gold form
  const [goldForm, setGoldForm] = useState<"buy"|"sell"|null>(null);
  const [gfGrams, setGfGrams] = useState(""); const [gfPrice, setGfPrice] = useState(""); const [gfNotes, setGfNotes] = useState("");
  const [trFrom, setTrFrom] = useState(""); const [trTo, setTrTo] = useState(""); const [trAmt, setTrAmt] = useState("");
  const [ncTitle, setNcTitle] = useState(""); const [ncAmount, setNcAmount] = useState(""); const [ncTotal, setNcTotal] = useState(""); const [ncDay, setNcDay] = useState("1");

  const [dataLoading, setDataLoading] = useState(true);

  // ═══ تحميل البيانات من API (مع fallback لـ localStorage) ═══
  const loadFinanceData = useCallback(async () => {
    setDataLoading(true);
    try {
      const { data } = await api.get("/api/finance/snapshot");
      const hasApiData = data && (
        (data.transactions && data.transactions.length > 0) ||
        (data.accounts && data.accounts.length > 0) ||
        (data.debts && data.debts.length > 0) ||
        (data.goals && data.goals.length > 0) ||
        (data.pockets && data.pockets.length > 0)
      );

      if (hasApiData) {
        // الـ API فيه بيانات — استخدمها
        console.log("[Finance] Loading from API:", data.transactions?.length ?? 0, "transactions");
        applySnapshot(data);
      } else {
        // الـ API فارغ — جرب ترحيل localStorage
        const localTxs = load<Transaction[]>("mfin_tx", []);
        const localAccts = load<Account[]>("mfin_accts", []);
        const hasLocal = localTxs.length > 0 || localAccts.length > 0;

        if (hasLocal) {
          console.log("[Finance] Migrating localStorage to API...");
          try {
            await api.post("/api/finance/sync", {
              accounts: load("mfin_accts", DEF_ACCOUNTS).map((a: Account) => ({ id: a.id, name: a.name, icon: a.icon, balance: a.balance })),
              pockets: load("mfin_pockets", DEF_POCKETS).map((p: Pocket) => ({ id: p.id, name: p.name, icon: p.icon, type: p.type, commitments: p.commitments })),
              transactions: localTxs.map((t: Transaction) => ({ title: t.title, amount: t.amount, type: t.type, category: t.category, expenseClass: t.expenseClass, accountId: t.accountId, pocketId: t.pocketId, date: t.date })),
              debts: load("mfin_debts", []),
              dues: load<RecurringDue[]>("mfin_dues", []).map((d) => ({ title: d.title, amount: d.amount, type: d.type, frequency: d.frequency, dueDay: d.dueDay, dueMonth: d.dueMonth, accountId: d.accountId, pocketId: d.pocketId, category: d.category, isActive: d.isActive })),
              goals: load<FinGoal[]>("mfin_goals", []).map((g) => ({ title: g.title, description: g.description, targetAmount: g.targetAmount, savedSoFar: g.savedSoFar, deadline: g.deadline, items: g.items })),
              zakat: load("mfin_zakat", null),
              settings: load("mfin_settings", null),
            });
            ["mfin_tx", "mfin_accts", "mfin_pockets", "mfin_settings", "mfin_debts", "mfin_dues", "mfin_goals", "mfin_zakat"].forEach(k => localStorage.removeItem(k));
            const { data: fresh } = await api.get("/api/finance/snapshot");
            applySnapshot(fresh);
            console.log("[Finance] Migration complete!");
          } catch (e) { console.error("[Finance] Migration failed:", e); applyLocalStorage(); }
        } else {
          // لا بيانات في أي مكان — صفحة فارغة
          console.log("[Finance] No data found (API empty, localStorage empty)");
          applySnapshot(data ?? {});
        }
      }
    } catch (e) {
      console.error("[Finance] API failed, using localStorage:", e);
      applyLocalStorage();
    }
    setDataLoading(false);
  }, []);

  function applySnapshot(data: Record<string, unknown>) {
    const d = data as { accounts?: Account[]; pockets?: Pocket[]; transactions?: Transaction[]; debts?: Debt[]; dues?: RecurringDue[]; goals?: FinGoal[]; zakat?: ZakatData; settings?: FinSettings };

    // تحويل أسماء الأنواع من PascalCase (API) إلى camelCase (frontend)
    const typeMap: Record<string, string> = { Income: "income", Expense: "expense", Transfer: "transfer", DebtPayment: "debt_payment", Installment: "installment", Gift: "gift" };
    const expClsMap: Record<string, string> = { Essential: "essential", Luxury: "luxury", Improvement: "improvement" };
    const pocketTypeMap: Record<string, string> = { Personal: "personal", Debt: "debt", Savings: "savings", Installment: "installment", Emergency: "emergency" };
    const dueTypeMap: Record<string, string> = { Salary: "salary", Bill: "bill", Installment: "installment", ExpectedIncome: "expected_income", ExpectedExpense: "expected_expense", Nafaqa: "nafaqa", Rent: "rent", Subscription: "subscription", Insurance: "insurance" };
    const dueFreqMap: Record<string, string> = { Monthly: "monthly", Yearly: "yearly", Once: "once" };

    setAccounts((d.accounts ?? []).length > 0 ? d.accounts! : DEF_ACCOUNTS);
    setPockets(((d.pockets ?? []).length > 0 ? d.pockets! : DEF_POCKETS).map(p => ({
      ...p, type: (pocketTypeMap[p.type] ?? p.type) as Pocket["type"], commitments: p.commitments ?? [],
    })));
    setTxs((d.transactions ?? []).map(t => ({
      ...t, type: (typeMap[t.type] ?? t.type) as Transaction["type"],
      expenseClass: t.expenseClass ? (expClsMap[t.expenseClass] ?? t.expenseClass) as ExpenseClass : undefined,
    })));
    setDebts(d.debts ?? []);
    setDues((d.dues ?? []).map(du => ({
      ...du, type: (dueTypeMap[du.type] ?? du.type) as RecurringDue["type"],
      frequency: (dueFreqMap[du.frequency] ?? du.frequency) as RecurringDue["frequency"],
    })));
    setFinGoals((d.goals ?? []).map(g => ({ ...g, items: g.items ?? [] })));
    setZakatData(d.zakat ?? { hawalDate: "", goldGrams: 0, goldPurchases: [] });
    const cats = (d.settings ?? {}) as Partial<FinSettings>;
    // جلب الاستقطاعات والمستحقات من preferences
    api.get("/api/users/me/preferences").then(({ data: prefs }) => {
      setSettings({
        debtPercent: cats.debtPercent ?? 10,
        savingsPercent: cats.savingsPercent ?? 10,
        expenseCategories: (cats.expenseCategories && cats.expenseCategories.length > 0) ? cats.expenseCategories : DEF_EXP_CATS,
        incomeCategories: (cats.incomeCategories && cats.incomeCategories.length > 0) ? cats.incomeCategories : DEF_INC_CATS,
        deductions: prefs?.deductions ?? [],
        receivables: prefs?.receivables ?? [],
      });
    }).catch(() => {
      setSettings({
        debtPercent: cats.debtPercent ?? 10, savingsPercent: cats.savingsPercent ?? 10,
        expenseCategories: (cats.expenseCategories && cats.expenseCategories.length > 0) ? cats.expenseCategories : DEF_EXP_CATS,
        incomeCategories: (cats.incomeCategories && cats.incomeCategories.length > 0) ? cats.incomeCategories : DEF_INC_CATS,
        deductions: [], receivables: [],
      });
    });
  }

  function applyLocalStorage() {
    setTxs(load("mfin_tx", []));
    setAccounts(load("mfin_accts", DEF_ACCOUNTS));
    setPockets(load("mfin_pockets", DEF_POCKETS));
    const s = load("mfin_settings", { debtPercent: 10, savingsPercent: 10, expenseCategories: DEF_EXP_CATS, incomeCategories: DEF_INC_CATS, deductions: [], receivables: [] });
    setSettings({ ...s, expenseCategories: s.expenseCategories ?? DEF_EXP_CATS, incomeCategories: s.incomeCategories ?? DEF_INC_CATS });
    setDebts(load("mfin_debts", []));
    setDues(load("mfin_dues", []));
    setZakatData(load("mfin_zakat", { hawalDate: "", goldGrams: 0, goldPurchases: [] }));
    setFinGoals(load("mfin_goals", []));
  }

  useEffect(() => { loadFinanceData(); }, [loadFinanceData]);

  // جلب سعر الذهب يومياً
  useEffect(() => {
    (async () => {
      const lastFetch = load<string>("mfin_gold_date", "");
      const today = new Date().toISOString().slice(0, 10);
      const cached = load<number>("mfin_gold_price", 0);
      if (lastFetch === today && cached > 0) { setGoldPrice(cached); return; }
      let price = 0;
      try { const r = await fetch("https://data-asg.goldprice.org/dbXRates/SAR"); if (r?.ok) { const d = await r.json(); if (d.items?.[0]?.xauPrice) price = Math.round(d.items[0].xauPrice / 31.1035); } } catch {}
      if (!price) { try { const r = await fetch("https://api.coindesk.com/v1/bpi/currentprice/XAU.json"); if (r?.ok) { const d = await r.json(); if (d.bpi?.XAU?.rate_float) price = Math.round((1 / d.bpi.XAU.rate_float) * 3.75 * 31.1035); } } catch {} }
      if (price > 0) { setGoldPrice(price); save("mfin_gold_date", today); } else { setGoldPrice(cached || 552); }
    })();
  }, []);

  // ═══ Setters — تحديث State + API (fire-and-forget) ═══
  function sTxs(v: Transaction[]) { setTxs(v); }
  function sAccts(v: Account[] | ((prev: Account[]) => Account[])) {
    setAccounts(prev => typeof v === "function" ? v(prev) : v);
  }
  function sPockets(v: Pocket[] | ((prev: Pocket[]) => Pocket[])) {
    setPockets(prev => typeof v === "function" ? v(prev) : v);
  }
  function sSettings(v: FinSettings) {
    setSettings(v);
    // حفظ البنود والنسب في finance/settings
    api.put("/api/finance/settings", { debtPercent: v.debtPercent, savingsPercent: v.savingsPercent, expenseCategories: v.expenseCategories, incomeCategories: v.incomeCategories }).catch(() => {});
    // حفظ الاستقطاعات والمستحقات في preferences
    api.put("/api/users/me/preferences", {
      ...JSON.parse(localStorage.getItem("madar_settings") ?? "{}"),
      deductions: v.deductions, receivables: v.receivables,
    }).catch(() => {});
  }
  function sDebts(v: Debt[]) {
    // اكتشف الفرق وأرسل للـ API
    const added = v.filter(d => !debts.some(x => x.id === d.id));
    const removed = debts.filter(d => !v.some(x => x.id === d.id));
    const updated = v.filter(d => { const old = debts.find(x => x.id === d.id); return old && JSON.stringify(old) !== JSON.stringify(d); });
    added.forEach(d => api.post("/api/finance/debts", d).then(({ data }) => { /* update id */ }).catch(() => {}));
    removed.forEach(d => api.delete(`/api/finance/debts/${d.id}`).catch(() => {}));
    updated.forEach(d => api.put(`/api/finance/debts/${d.id}`, d).catch(() => {}));
    setDebts(v);
  }
  function sDues(v: RecurringDue[]) {
    const added = v.filter(d => !dues.some(x => x.id === d.id));
    const removed = dues.filter(d => !v.some(x => x.id === d.id));
    added.forEach(d => api.post("/api/finance/dues", d).catch(() => {}));
    removed.forEach(d => api.delete(`/api/finance/dues/${d.id}`).catch(() => {}));
    setDues(v);
  }
  function sZakat(v: ZakatData) {
    setZakatData(v);
    api.put("/api/finance/zakat", { hawalDate: v.hawalDate, goldGrams: v.goldGrams }).catch(() => {});
  }
  function sFinGoals(v: FinGoal[]) { setFinGoals(v); }

  /** تأكيد استلام/دفع مستحق */
  async function confirmDue(due: RecurringDue) {
    const isIncome = due.type === "salary" || due.type === "expected_income";
    const aid = due.accountId || accounts[0]?.id || null;
    const pid = due.pocketId || pockets[0]?.id || null;
    const safeAid = aid && String(aid).length > 10 ? aid : null;
    const safePid = pid && String(pid).length > 10 ? pid : null;
    try {
      const { data: newTx } = await api.post("/api/finance/transactions", {
        title: due.title, amount: due.amount, type: isIncome ? "Income" : "Expense",
        category: due.category ?? (isIncome ? "راتب" : "فواتير"), accountId: safeAid, pocketId: safePid,
        date: new Date().toISOString().slice(0, 10),
      });
      setTxs(prev => [newTx, ...prev]);
      // حدّث تاريخ التأكيد
      await api.put(`/api/finance/dues/${due.id}`, { title: due.title, amount: due.amount, type: due.type, frequency: due.frequency, dueDay: due.dueDay, lastConfirmedDate: new Date().toISOString().slice(0, 10) }).catch(() => {});
      setDues(prev => prev.map(d => d.id === due.id ? { ...d, lastConfirmedDate: new Date().toISOString().slice(0, 10) } : d));
    } catch { /* fallback — just update locally */ }
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  function applyTxEffect(_t: Transaction, _reverse = false) { }

  async function addTx() {
    if (!fTitle.trim() || !fAmount) return;
    let amt = 0;
    try { amt = Function('"use strict"; return (' + fAmount + ')')(); } catch { amt = Number(fAmount); }
    if (!amt || !isFinite(amt)) return;
    amt = Math.round(amt * 100) / 100;

    const aid = fAcct || accounts[0]?.id || null;
    const pid = fPocket || pockets[0]?.id || null;

    // تحويل IDs الفارغة لـ null (الباكند يتوقع GUID أو null)
    const safeAid = aid && aid.length > 10 ? aid : null;
    const safePid = pid && pid.length > 10 ? pid : null;
    try {
      const { data: newTx } = await api.post("/api/finance/transactions", {
        title: fTitle.trim(), amount: amt, type: fType, category: fCat,
        expenseClass: fType === "expense" ? fExpCls : null,
        accountId: safeAid, pocketId: safePid, date: fDate,
      });
      const mapped = { ...newTx, type: fType, expenseClass: fType === "expense" ? fExpCls : undefined };
      setTxs(prev => [mapped, ...prev]);
    } catch {
      setTxs(prev => [{ id: Date.now().toString(), title: fTitle.trim(), amount: amt, type: fType, category: fCat, expenseClass: fType === "expense" ? fExpCls : undefined, accountId: safeAid ?? "", pocketId: safePid ?? "", date: fDate }, ...prev]);
    }
    setFTitle(""); setFAmount(""); setShowAdd(false);
  }

  /** حذف معاملة */
  async function deleteTx(id: string) {
    const tx = txs.find(t => t.id === id);
    if (!tx) return;
    api.delete(`/api/finance/transactions/${id}`).catch(() => {});
    sTxs(txs.filter(t => t.id !== id));
  }

  /** تعديل معاملة: عكس القديمة ثم تطبيق الجديدة */
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  async function saveEditTx() {
    if (!editTx) return;
    try {
      await api.put(`/api/finance/transactions/${editTx.id}`, {
        title: editTx.title, amount: editTx.amount, type: editTx.type, category: editTx.category,
        expenseClass: editTx.expenseClass, accountId: editTx.accountId || null, pocketId: editTx.pocketId || null, date: editTx.date,
      });
    } catch {}
    setTxs(prev => prev.map(t => t.id === editTx.id ? editTx : t));
    setEditTx(null);
  }

  async function addAccount() {
    if (!naName.trim()) return;
    try {
      const { data } = await api.post("/api/finance/accounts", { name: naName.trim(), icon: naIcon, balance: Number(naBal) || 0 });
      setAccounts(prev => [...prev, { ...data, balance: data.balance ?? 0 }]);
    } catch {
      setAccounts(prev => [...prev, { id: Date.now().toString(), name: naName.trim(), icon: naIcon, balance: Number(naBal) || 0 }]);
    }
    setNaName(""); setNaBal(""); setShowNewAcct(false);
  }

  async function addPocket() {
    if (!npName.trim()) return;
    try {
      const { data } = await api.post("/api/finance/pockets", { name: npName.trim(), icon: npIcon, type: npType });
      setPockets(prev => [...prev, { ...data, commitments: [] }]);
    } catch {
      setPockets(prev => [...prev, { id: Date.now().toString(), name: npName.trim(), icon: npIcon, type: npType, balance: 0, commitments: [] }]);
    }
    setNpName(""); setShowNewPocket(false);
  }

  function addCommitment(pocketId: string) {
    if (!ncTitle.trim() || !ncAmount) return;
    sPockets(pockets.map((p) => {
      if (p.id !== pocketId) return p;
      return { ...p, commitments: [...p.commitments, { id: Date.now().toString(), title: ncTitle.trim(), monthlyAmount: Number(ncAmount), totalAmount: ncTotal ? Number(ncTotal) : undefined, paidSoFar: 0, dueDay: Number(ncDay) || 1 }] };
    }));
    setNcTitle(""); setNcAmount(""); setNcTotal(""); setShowAddCommit(null);
  }

  // ═══ الحسابات مبنية بالكامل على المعاملات ═══
  // أرصدة الحسابات = مجموع المعاملات (الواردة - الصادرة)
  const calcAcctBal = (acctId: string) => {
    return txs.reduce((s, t) => {
      if (t.accountId !== acctId) return s;
      return s + (t.type === "income" ? t.amount : -t.amount);
    }, 0);
  };
  // أرصدة المحافظ = مجموع المعاملات المرتبطة
  const calcPocketBal = (pocketId: string) => {
    return txs.reduce((s, t) => {
      if (t.pocketId !== pocketId) return s;
      return s + (t.type === "income" ? t.amount : -t.amount);
    }, 0);
  };

  // معاملات الشهر المختار
  const mTx = txs.filter((t) => t.date.startsWith(month));
  const income = mTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = mTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const debtPaid = mTx.filter((t) => t.type === "debt_payment" || t.type === "installment").reduce((s, t) => s + t.amount, 0);
  const gifts = mTx.filter((t) => t.type === "gift").reduce((s, t) => s + t.amount, 0);
  const net = income - expense - debtPaid - gifts;

  // الرصيد الكلي = مجموع الوارد - مجموع الصادر (من المعاملات فقط)
  const allIncome = txs.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const allExpense = txs.filter(t => t.type !== "income").reduce((s, t) => s + t.amount, 0);
  const totalAcctBal = allIncome - allExpense;

  const savingsPocket = pockets.find((p) => p.type === "savings");
  const savingsBalance = savingsPocket ? calcPocketBal(savingsPocket.id) : 0;
  const totalDebtRemaining = debts.reduce((s, d) => s + d.originalAmount - d.paidSoFar, 0);
  const monthlyCommits = pockets.flatMap((p) => p.commitments).reduce((s, c) => s + c.monthlyAmount, 0);

  // تصنيف المصروفات
  const essExp = mTx.filter((t) => t.expenseClass === "essential").reduce((s, t) => s + t.amount, 0);
  const luxExp = mTx.filter((t) => t.expenseClass === "luxury").reduce((s, t) => s + t.amount, 0);
  const impExp = mTx.filter((t) => t.expenseClass === "improvement").reduce((s, t) => s + t.amount, 0);
  const expByCat = new Map<string, number>();
  mTx.filter((t) => t.type === "expense").forEach((t) => expByCat.set(t.category, (expByCat.get(t.category) ?? 0) + t.amount));

  const MAIN_TABS = [
    { key: "overview",     label: "ملخص" },
    { key: "transactions", label: "معاملات" },
    { key: "pockets",      label: "محافظ" },
  ] as const;
  const MORE_TABS = [
    { key: "accounts",     label: "حسابات" },
    { key: "dues",         label: "مستحقات" },
    { key: "debts",        label: "ديون" },
    { key: "goals",        label: "أهداف" },
    { key: "deductions",   label: "استقطاعات" },
    { key: "receivables",  label: "مستحقات لي" },
    { key: "gold",         label: "ذهب" },
    { key: "zakat",        label: "زكاة" },
    { key: "settings",     label: "إعدادات" },
  ] as const;
  const ALL_TABS = [...MAIN_TABS, ...MORE_TABS];
  const currentTabLabel = ALL_TABS.find(t => t.key === tab)?.label ?? "ملخص";

  // المستحقات المقبلة (خلال 7 أيام)
  const today = new Date();
  const todayDay = today.getDate();
  const currentMonth = today.getMonth() + 1;
  const upcomingDues = dues.filter((d) => {
    if (!d.isActive) return false;
    const confirmedThisMonth = d.lastConfirmedDate?.startsWith(`${today.getFullYear()}-${String(currentMonth).padStart(2, "0")}`);
    if (confirmedThisMonth && d.frequency === "monthly") return false;
    if (d.frequency === "yearly" && d.dueMonth !== currentMonth) return false;
    return true;
  });

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4 pr-16 md:pr-8">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-[#16213E] font-bold text-lg">الإدارة المالية</h2>
            <p className="text-[#6B7280] text-[10px]">حسابات (أين المال) · محافظ (لمن المال) · التزامات</p>
          </div>
          <div className="flex gap-2">
            <input type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="px-2 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#D4AF37]" />
            <button onClick={() => setShowAdd(true)} className="px-4 py-2 rounded-lg text-sm font-semibold text-white" style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>+ معاملة</button>
          </div>
        </div>
        <div className="flex gap-1 items-center">
          {MAIN_TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition"
              style={{ background: tab === t.key ? "#2C2C54" : "transparent", color: tab === t.key ? "#fff" : "#6B7280" }}>{t.label}</button>
          ))}
          {/* أيقونة التبويب النشط من المزيد */}
          {MORE_TABS.some(t => t.key === tab) && (
            <button className="py-1.5 px-3 rounded-lg text-[11px] font-semibold" style={{ background: "#2C2C54", color: "#fff" }}>{currentTabLabel}</button>
          )}
          <button onClick={() => setShowMoreTabs(!showMoreTabs)}
            className="py-1.5 px-3 rounded-lg text-[11px] font-semibold transition"
            style={{ background: showMoreTabs ? "#D4AF37" : "transparent", color: showMoreTabs ? "#fff" : "#6B7280" }}>
            المزيد ▾
          </button>
        </div>
      </header>

      {/* More tabs dropdown — fixed overlay for mobile */}
      {showMoreTabs && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowMoreTabs(false)} />
          <div className="fixed top-24 left-4 right-4 z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 p-2 fade-up" style={{ maxWidth: 300, marginInline: "auto" }}>
            <div className="grid grid-cols-2 gap-1">
              {MORE_TABS.map(t => (
                <button key={t.key} onClick={() => { setTab(t.key); setShowMoreTabs(false); }}
                  className="py-3 px-3 rounded-xl text-sm font-semibold text-right transition"
                  style={{ background: tab === t.key ? "#2C2C54" : "#F9FAFB", color: tab === t.key ? "#fff" : "#374151" }}>
                  {t.label}
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Gold advice banner */}
      {goldAdvice && (
        <div className="mx-8 mt-3 p-3 rounded-xl flex items-center gap-3" style={{ background: "#D4AF3715", border: "1px solid #D4AF3730" }}>
          <p className="text-xs font-semibold flex-1" style={{ color: "#92400E" }}>{goldAdvice}</p>
          <button onClick={() => setGoldAdvice(null)} className="text-[#9CA3AF] text-xs">✕</button>
        </div>
      )}

      <div className="px-8 py-6 space-y-5">

        {/* ═══ Overview ═══ */}
        {tab === "overview" && (<>
          {/* الأرصدة — محسوبة من المعاملات */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="الرصيد الكلي" value={totalAcctBal} color="#2C2C54" sub="واردة - صادرة" />
            <Stat label="إجمالي الوارد" value={allIncome} color="#3D8C5A" sub={`${txs.filter(t=>t.type==="income").length} معاملة`} />
            <Stat label="محفظة الادخار" value={savingsBalance} color="#D4AF37" />
            <Stat label="ديون متبقية" value={totalDebtRemaining} color="#DC2626" />
          </div>
          {/* معاملات الشهر المختار */}
          <GeometricDivider label={`معاملات ${month}`} />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="الدخل" value={income} color="#3D8C5A" sub={`${mTx.filter(t=>t.type==="income").length} معاملة`} />
            <Stat label="المصروفات" value={expense} color="#DC2626" sub={`${mTx.filter(t=>t.type==="expense").length} معاملة`} />
            <Stat label="سداد ديون" value={debtPaid} color="#0F3460" />
            <Stat label="الصافي" value={net} color={net >= 0 ? "#3D8C5A" : "#DC2626"} />
          </div>
          {mTx.length === 0 && (
            <p className="text-center text-[10px] text-[#9CA3AF] py-2">لا توجد معاملات في هذا الشهر — الأرقام أعلاه تعكس الأرصدة الفعلية</p>
          )}

          {/* Upcoming dues */}
          {upcomingDues.length > 0 && (
            <div className="bg-amber-50 rounded-xl p-4 border border-amber-200 space-y-2">
              <p className="text-amber-800 text-sm font-semibold">مستحقات تنتظر التأكيد ({upcomingDues.length})</p>
              {upcomingDues.slice(0, 3).map((d) => {
                const isIncome = d.type === "salary" || d.type === "expected_income";
                return (
                  <div key={d.id} className="flex items-center gap-2">
                    <span className="text-xs">{DUE_TYPES.find((t) => t.key === d.type)?.icon}</span>
                    <span className="text-xs text-[#16213E] flex-1">{d.title} — يوم {d.dueDay}</span>
                    <span className="text-xs font-bold" style={{ color: isIncome ? "#3D8C5A" : "#DC2626" }}>{d.amount.toLocaleString()}</span>
                    <button onClick={() => confirmDue(d)} className="text-[10px] px-2 py-1 rounded-lg font-bold text-white"
                      style={{ background: isIncome ? "#3D8C5A" : "#DC2626" }}>
                      {isIncome ? "استلمت" : "دفعت"}
                    </button>
                  </div>
                );
              })}
              {upcomingDues.length > 3 && <button onClick={() => setTab("dues")} className="text-[10px] text-amber-700 hover:underline">عرض الكل →</button>}
            </div>
          )}

          {/* Deductions */}
          {(settings.debtPercent > 0 || settings.savingsPercent > 0) && (
            <div className="bg-blue-50 rounded-xl p-4 border border-blue-200 space-y-1">
              <p className="text-blue-800 text-sm font-semibold">الاستقطاعات من الدخل</p>
              {settings.debtPercent > 0 && <p className="text-blue-600 text-xs">💳 ديون: {settings.debtPercent}% = <b>{Math.round(income * settings.debtPercent / 100).toLocaleString()}</b></p>}
              {settings.savingsPercent > 0 && <p className="text-blue-600 text-xs">💎 ادخار: {settings.savingsPercent}% = <b>{Math.round(income * settings.savingsPercent / 100).toLocaleString()}</b></p>}
            </div>
          )}

          {/* Expense classification */}
          {expense > 0 && (
            <div className="grid grid-cols-3 gap-3">
              {(["essential","luxury","improvement"] as ExpenseClass[]).map((c) => {
                const val = c === "essential" ? essExp : c === "luxury" ? luxExp : impExp;
                return <Stat key={c} label={`${EXP_CLS[c].icon} ${EXP_CLS[c].label}`} value={val} color={EXP_CLS[c].color} sub={`${expense > 0 ? Math.round(val/expense*100) : 0}%`} />;
              })}
            </div>
          )}

          {/* Category breakdown */}
          {expByCat.size > 0 && (
            <section>
              <GeometricDivider label="توزيع المصروفات" />
              <div className="mt-3 bg-white rounded-xl p-4 border border-gray-200 space-y-2">
                {Array.from(expByCat.entries()).sort((a,b) => b[1]-a[1]).map(([cat, val]) => (
                  <div key={cat} className="flex items-center gap-3">
                    <span className="text-xs text-[#16213E] w-16">{cat}</span>
                    <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden"><div className="h-full rounded-full bg-[#DC2626]" style={{ width: `${Math.round(val/expense*100)}%` }} /></div>
                    <span className="text-[10px] font-bold text-[#DC2626] w-14 text-left">{val.toLocaleString()}</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>)}

        {/* ═══ Transactions — grouped by day ═══ */}
        {tab === "transactions" && (() => {
          const grouped = new Map<string, Transaction[]>();
          mTx.forEach(t => { const k = t.date; grouped.set(k, [...(grouped.get(k) ?? []), t]); });
          const days = Array.from(grouped.entries()).sort((a, b) => b[0].localeCompare(a[0]));
          return (
            <div className="space-y-3">
              {days.length === 0 && <p className="text-[#6B7280] text-sm text-center py-8">لا توجد معاملات</p>}
              {days.map(([date, dayTxs]) => {
                const dayTotal = dayTxs.reduce((s, t) => s + (t.type === "income" ? t.amount : -t.amount), 0);
                const label = date === new Date().toISOString().slice(0, 10) ? "اليوم" : date === new Date(Date.now() - 86400000).toISOString().slice(0, 10) ? "أمس" : new Date(date).toLocaleDateString("ar-SA", { weekday: "long", day: "numeric", month: "short" });
                return (
                  <details key={date} open={date === new Date().toISOString().slice(0, 10) || days.length <= 3}>
                    <summary className="flex items-center justify-between px-4 py-2.5 rounded-xl cursor-pointer hover:bg-gray-50 transition" style={{ background: "var(--bg)", border: "1px solid var(--card-border)" }}>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold" style={{ color: "var(--text)" }}>{label}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-[#6B7280]">{dayTxs.length} معاملة</span>
                      </div>
                      <span className="text-sm font-bold" style={{ color: dayTotal >= 0 ? "#3D8C5A" : "#DC2626" }}>{dayTotal >= 0 ? "+" : ""}{dayTotal.toLocaleString()}</span>
                    </summary>
                    <div className="mt-1 space-y-1">
                      {dayTxs.map(t => {
                        const meta = TX_TYPES.find(x => x.key === t.type) ?? TX_TYPES[0];
                        return (
                          <div key={t.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200">
                            <span className="text-lg">{meta.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#16213E] truncate">{t.title}</p>
                              <p className="text-[9px] text-[#9CA3AF]">{t.category} · {accounts.find(a => a.id === t.accountId)?.name ?? ""} → {pockets.find(p => p.id === t.pocketId)?.name ?? ""}</p>
                            </div>
                            {t.expenseClass && <span className="text-[9px]">{EXP_CLS[t.expenseClass].icon}</span>}
                            <span className="text-sm font-bold" style={{ color: meta.color }}>{t.type === "income" ? "+" : "-"}{t.amount.toLocaleString()}</span>
                            <button onClick={() => setEditTx({ ...t })} className="text-[#6B7280] hover:text-[#D4AF37] text-xs">✎</button>
                            <button onClick={() => { if (confirm("حذف؟")) deleteTx(t.id); }} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
                          </div>
                        );
                      })}
                    </div>
                  </details>
                );
              })}
            </div>
          );
        })()}

        {/* ═══ Accounts (أين المال) ═══ */}
        {tab === "accounts" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div><p className="text-sm font-bold text-[#16213E]">الحسابات</p><p className="text-[10px] text-[#6B7280]">أين يقع المال فعلياً</p></div>
              <div className="flex gap-2">
                <button onClick={() => setShowTransfer(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-gray-200 text-[#6B7280] hover:bg-gray-50">🔄 تحويل</button>
                <button onClick={() => setShowNewAcct(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#2C2C54" }}>+ حساب</button>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {accounts.map((a) => (
                <div key={a.id} className="bg-white rounded-xl p-5 border border-gray-200 shadow-sm">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{a.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm text-[#16213E]">{a.name}</p>
                      {editAcctId === a.id ? (
                        <div className="flex items-center gap-2 mt-1">
                          <input type="number" value={editAcctBal} onChange={(e) => setEditAcctBal(e.target.value)}
                            className="w-28 px-2 py-1 rounded-lg border border-[#D4AF37] text-sm font-bold focus:outline-none" autoFocus
                            onKeyDown={(e) => { if (e.key === "Enter") { const bal = Number(editAcctBal) || 0; api.put(`/api/finance/accounts/${a.id}`, { name: a.name, icon: a.icon, balance: bal }).catch(() => {}); sAccts(accounts.map(x => x.id === a.id ? { ...x, balance: bal } : x)); setEditAcctId(null); } }} />
                          <button onClick={() => { const bal = Number(editAcctBal) || 0; api.put(`/api/finance/accounts/${a.id}`, { name: a.name, icon: a.icon, balance: bal }).catch(() => {}); sAccts(accounts.map(x => x.id === a.id ? { ...x, balance: bal } : x)); setEditAcctId(null); }}
                            className="text-[10px] px-2 py-1 rounded-lg bg-[#3D8C5A] text-white font-bold">حفظ</button>
                          <button onClick={() => setEditAcctId(null)} className="text-[10px] px-2 py-1 rounded-lg bg-gray-100 text-[#6B7280]">✕</button>
                        </div>
                      ) : (
                        <p className="text-xl font-black mt-1 cursor-pointer hover:opacity-70 transition"
                          onClick={() => { setEditAcctId(a.id); setEditAcctBal(String(a.balance)); }}
                          title="انقر لتعديل الرصيد"
                          style={{ color: a.balance >= 0 ? "#3D8C5A" : "#DC2626" }}>
                          {a.balance.toLocaleString()} <span className="text-[10px] text-[#9CA3AF]">ريال ✎</span>
                        </p>
                      )}
                    </div>
                    <button onClick={() => { api.delete(`/api/finance/accounts/${a.id}`).catch(() => {}); sAccts(accounts.filter((x) => x.id !== a.id)); }} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
                  </div>
                </div>
              ))}
            </div>
            {showNewAcct && (
              <div className="mt-4 bg-white rounded-xl p-5 border border-gray-200 fade-up space-y-3">
                <input value={naName} onChange={(e) => setNaName(e.target.value)} placeholder="اسم الحساب (البنك الأهلي، محفظة STC…)"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                <div className="flex gap-1.5">{ACCT_ICONS.map((i) => <button key={i} onClick={() => setNaIcon(i)} className="w-9 h-9 rounded-lg text-lg" style={{ background: naIcon === i ? "#D4AF3720" : "#F3F4F6", border: naIcon === i ? "2px solid #D4AF37" : "none" }}>{i}</button>)}</div>
                <input type="number" value={naBal} onChange={(e) => setNaBal(e.target.value)} placeholder="الرصيد الحالي"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                <div className="flex gap-2">
                  <button onClick={() => setShowNewAcct(false)} className="flex-1 py-2 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
                  <button onClick={addAccount} className="flex-1 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#2C2C54" }}>إضافة</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ Pockets (لمن المال) ═══ */}
        {tab === "pockets" && (
          <section>
            <div className="flex items-center justify-between mb-3">
              <div><p className="text-sm font-bold text-[#16213E]">المحافظ</p><p className="text-[10px] text-[#6B7280]">لمن هذا المال / الغرض منه</p></div>
              <div className="flex gap-2">
                <button onClick={() => setShowTransfer(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold border border-gray-200 text-[#6B7280] hover:bg-gray-50">🔄 تحويل</button>
                <button onClick={() => setShowNewPocket(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#2C2C54" }}>+ محفظة</button>
              </div>
            </div>
            <div className="space-y-4">
              {pockets.map((p) => {
                const typeLabel = POCKET_TYPES.find((t) => t.key === p.type)?.label ?? p.type;
                return (
                  <div key={p.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                    <div className="flex items-center gap-4 px-5 py-4">
                      <span className="text-2xl">{p.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-sm text-[#16213E]">{p.name}</p>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-gray-100 text-[#6B7280]">{typeLabel}</span>
                        </div>
                        <p className="text-lg font-black mt-1" style={{ color: calcPocketBal(p.id) >= 0 ? "#3D8C5A" : "#DC2626" }}>{calcPocketBal(p.id).toLocaleString()} ريال</p>
                      </div>
                      <button onClick={() => { api.delete(`/api/finance/pockets/${p.id}`).catch(() => {}); sPockets(pockets.filter((x) => x.id !== p.id)); }} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
                    </div>

                    {/* Commitments inside pocket */}
                    {(p.type === "debt" || p.type === "installment" || p.type === "savings") && (
                      <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/50">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-[11px] font-semibold text-[#16213E]">المستحقات</p>
                          <button onClick={() => setShowAddCommit(p.id)} className="text-[10px] text-[#2C2C54] hover:underline">+ إضافة</button>
                        </div>
                        {p.commitments.length === 0 && <p className="text-[10px] text-[#9CA3AF]">لا توجد مستحقات</p>}
                        {p.commitments.map((c) => {
                          const rem = (c.totalAmount ?? 0) - c.paidSoFar;
                          const pct = c.totalAmount ? Math.round(c.paidSoFar / c.totalAmount * 100) : 0;
                          return (
                            <div key={c.id} className="py-2 border-b border-gray-100 last:border-0">
                              <div className="flex items-center justify-between">
                                <p className="text-xs font-medium text-[#16213E]">{c.title}</p>
                                <p className="text-xs font-bold text-[#DC2626]">{c.monthlyAmount.toLocaleString()} / شهر</p>
                              </div>
                              {c.totalAmount && (
                                <div className="mt-1">
                                  <div className="flex justify-between text-[9px] text-[#6B7280]">
                                    <span>مسدد: {c.paidSoFar.toLocaleString()}</span>
                                    <span>متبقي: {rem.toLocaleString()}</span>
                                    <span>{pct}%</span>
                                  </div>
                                  <div className="bg-gray-200 rounded-full h-1.5 mt-1 overflow-hidden">
                                    <div className="h-full rounded-full bg-[#3D8C5A]" style={{ width: `${pct}%` }} />
                                  </div>
                                </div>
                              )}
                              <p className="text-[9px] text-[#9CA3AF] mt-0.5">يوم الاستحقاق: {c.dueDay}</p>
                            </div>
                          );
                        })}

                        {showAddCommit === p.id && (
                          <div className="mt-2 space-y-2 p-3 bg-white rounded-lg border border-gray-200">
                            <input value={ncTitle} onChange={(e) => setNcTitle(e.target.value)} placeholder="مثال: قسط السيارة"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#D4AF37]" />
                            <input type="number" value={ncAmount} onChange={(e) => setNcAmount(e.target.value)} placeholder="المبلغ الشهري"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#D4AF37]" />
                            <input type="number" value={ncTotal} onChange={(e) => setNcTotal(e.target.value)} placeholder="إجمالي المبلغ (اختياري)"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#D4AF37]" />
                            <input type="number" min={1} max={30} value={ncDay} onChange={(e) => setNcDay(e.target.value)} placeholder="يوم الاستحقاق"
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs focus:outline-none focus:border-[#D4AF37]" />
                            <div className="flex gap-2">
                              <button onClick={() => setShowAddCommit(null)} className="flex-1 py-1.5 rounded-lg text-xs text-[#6B7280] bg-gray-100">إلغاء</button>
                              <button onClick={() => addCommitment(p.id)} className="flex-1 py-1.5 rounded-lg text-xs font-bold text-white" style={{ background: "#2C2C54" }}>إضافة</button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {showNewPocket && (
              <div className="mt-4 bg-white rounded-xl p-5 border border-gray-200 fade-up space-y-3">
                <input value={npName} onChange={(e) => setNpName(e.target.value)} placeholder="اسم المحفظة"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                <div className="flex gap-2 flex-wrap">
                  {POCKET_TYPES.map((t) => (
                    <button key={t.key} onClick={() => { setNpType(t.key); setNpIcon(t.icon); }}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium"
                      style={{ background: npType === t.key ? "#2C2C54" : "#F3F4F6", color: npType === t.key ? "#fff" : "#6B7280" }}>
                      {t.icon} {t.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setShowNewPocket(false)} className="flex-1 py-2 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
                  <button onClick={addPocket} className="flex-1 py-2 rounded-xl text-sm font-bold text-white" style={{ background: "#2C2C54" }}>إضافة</button>
                </div>
              </div>
            )}
          </section>
        )}

        {/* ═══ Dues (مستحقات) ═══ */}
        {tab === "dues" && (
          <DuesSection dues={dues} accounts={accounts} pockets={pockets}
            expCats={settings.expenseCategories ?? DEF_EXP_CATS}
            incCats={settings.incomeCategories ?? DEF_INC_CATS}
            onUpdate={sDues} onConfirm={confirmDue} />
        )}

        {/* ═══ Debts ═══ */}
        {tab === "debts" && (<DebtSection debts={debts} onUpdate={sDebts} />)}

        {/* ═══ Goals (أهداف مالية) ═══ */}
        {tab === "goals" && (
          <section className="space-y-5">
            <div className="flex items-center justify-between">
              <div><p className="text-sm font-bold text-[#16213E]">الأهداف المالية</p><p className="text-[10px] text-[#6B7280]">حدد هدفك وتفاصيل تكلفته</p></div>
              <button onClick={() => setShowGoalForm(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#2C2C54" }}>+ هدف جديد</button>
            </div>

            {/* نموذج إضافة هدف */}
            {showGoalForm && (
              <div className="bg-white rounded-xl p-5 border border-[#D4AF37] shadow-sm fade-up space-y-3">
                <p className="font-bold text-sm text-[#16213E]">هدف مالي جديد</p>
                <input value={gfTitle} onChange={e => setGfTitle(e.target.value)} placeholder="اسم الهدف (سيارة، زواج، سفر…)"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                <input type="number" value={gfAmount} onChange={e => setGfAmount(e.target.value)} placeholder="المبلغ المستهدف (اختياري إذا فيه بنود)"
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                <input type="date" value={gfDeadline} onChange={e => setGfDeadline(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                <div className="flex gap-2">
                  <button onClick={() => setShowGoalForm(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
                  <button onClick={() => {
                    if (!gfTitle.trim()) return;
                    api.post("/api/finance/goals", { title: gfTitle.trim(), description: "", targetAmount: Number(gfAmount) || 0, savedSoFar: 0, deadline: gfDeadline || null, items: [] }).then(({ data }) => { sFinGoals([{ id: data.id, title: gfTitle.trim(), description: "", targetAmount: Number(gfAmount) || 0, savedSoFar: 0, deadline: gfDeadline, items: [] }, ...finGoals]); }).catch(() => { sFinGoals([{ id: Date.now().toString(), title: gfTitle.trim(), description: "", targetAmount: Number(gfAmount) || 0, savedSoFar: 0, deadline: gfDeadline, items: [] }, ...finGoals]); });
                    setGfTitle(""); setGfAmount(""); setGfDeadline(""); setShowGoalForm(false);
                  }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #5E5495, #D4AF37)" }}>إضافة</button>
                </div>
              </div>
            )}
            {finGoals.length === 0 && <p className="text-center text-[#9CA3AF] text-xs py-8">لا توجد أهداف مالية — أضف هدفك الأول</p>}
            {finGoals.map(g => {
              const totalItems = g.items.reduce((s, i) => s + i.cost, 0);
              const target = totalItems > 0 ? totalItems : g.targetAmount;
              const pct = target > 0 ? Math.min(100, Math.round((g.savedSoFar / target) * 100)) : 0;
              const daysLeft = g.deadline ? Math.max(0, Math.ceil((new Date(g.deadline).getTime() - Date.now()) / 86400000)) : null;
              const monthlyNeeded = daysLeft && daysLeft > 0 ? Math.round((target - g.savedSoFar) / Math.max(1, Math.ceil(daysLeft / 30))) : 0;
              return (
                <div key={g.id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                  <div className="px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <p className="font-bold text-sm text-[#16213E]">{g.title}</p>
                      <div className="flex gap-1">
                        <button onClick={() => { setShowSaveForm(g.id); setSfAmount(""); }} className="text-[10px] px-2 py-1 rounded-lg bg-[#3D8C5A] text-white font-bold">+ ادخار</button>
                        <button onClick={() => { api.delete(`/api/finance/goals/${g.id}`).catch(() => {}); sFinGoals(finGoals.filter(x => x.id !== g.id)); }} className="text-[#9CA3AF] hover:text-red-400 text-xs px-1">✕</button>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center mb-3">
                      <div><p className="text-[9px] text-[#9CA3AF]">الهدف</p><p className="text-sm font-black text-[#2C2C54]">{target.toLocaleString()}</p></div>
                      <div><p className="text-[9px] text-[#9CA3AF]">المدّخر</p><p className="text-sm font-black text-[#3D8C5A]">{g.savedSoFar.toLocaleString()}</p></div>
                      <div><p className="text-[9px] text-[#9CA3AF]">المتبقي</p><p className="text-sm font-black text-[#DC2626]">{(target - g.savedSoFar).toLocaleString()}</p></div>
                    </div>
                    <div className="bg-gray-100 rounded-full h-2.5 overflow-hidden mb-2">
                      <div className="h-full rounded-full bg-[#D4AF37] transition-all" style={{ width: `${pct}%` }} />
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-[#6B7280]">
                      <span>{pct}%</span>
                      {daysLeft !== null && <span>{daysLeft === 0 ? "حان الموعد!" : `${daysLeft} يوم متبقي`}{monthlyNeeded > 0 ? ` · ${monthlyNeeded.toLocaleString()} ريال/شهر` : ""}</span>}
                    </div>
                  </div>
                  {/* نموذج ادخار */}
                  {showSaveForm === g.id && (
                    <div className="px-5 pb-3 flex gap-2 items-center fade-up">
                      <input type="number" value={sfAmount} onChange={e => setSfAmount(e.target.value)} placeholder="المبلغ"
                        className="flex-1 px-3 py-2 rounded-lg border border-[#3D8C5A] text-sm focus:outline-none" autoFocus />
                      <button onClick={() => {
                        const a = Number(sfAmount); if (!a) return;
                        sFinGoals(finGoals.map(x => x.id === g.id ? { ...x, savedSoFar: x.savedSoFar + a } : x));
                        const aid = accounts[0]?.id || "";
                        const savPkt = pockets.find(p => p.type === "savings");
                        if (savPkt) { sTxs([{ id: Date.now().toString(), title: `ادخار: ${g.title}`, amount: a, type: "expense", category: "ادخار", accountId: aid, pocketId: savPkt.id, date: new Date().toISOString().slice(0, 10) } as Transaction, ...txs]); }
                        setShowSaveForm(null); setSfAmount("");
                      }} className="px-3 py-2 rounded-lg text-xs font-bold text-white bg-[#3D8C5A]">حفظ</button>
                      <button onClick={() => setShowSaveForm(null)} className="px-2 py-2 rounded-lg text-xs text-[#6B7280] bg-gray-100">✕</button>
                    </div>
                  )}

                  {/* تفاصيل البنود */}
                  <div className="border-t border-gray-100 px-5 py-3 bg-gray-50/50">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[11px] font-semibold text-[#16213E]">تفاصيل التكلفة</p>
                      <button onClick={() => { setShowItemForm(g.id); setIfName(""); setIfCost(""); }} className="text-[10px] text-[#D4AF37] hover:underline">+ بند</button>
                    </div>
                    {showItemForm === g.id && (
                      <div className="flex gap-2 items-center mb-2 fade-up">
                        <input value={ifName} onChange={e => setIfName(e.target.value)} placeholder="اسم البند"
                          className="flex-1 px-2 py-1.5 rounded-lg border border-[#D4AF37] text-xs focus:outline-none" autoFocus />
                        <input type="number" value={ifCost} onChange={e => setIfCost(e.target.value)} placeholder="التكلفة"
                          className="w-24 px-2 py-1.5 rounded-lg border border-[#D4AF37] text-xs focus:outline-none" />
                        <button onClick={() => {
                          if (!ifName.trim() || !ifCost) return;
                          sFinGoals(finGoals.map(x => x.id === g.id ? { ...x, items: [...x.items, { name: ifName.trim(), cost: Number(ifCost) || 0 }] } : x));
                          setShowItemForm(null); setIfName(""); setIfCost("");
                        }} className="px-2 py-1.5 rounded-lg text-[10px] font-bold text-white" style={{ background: "#D4AF37" }}>+</button>
                        <button onClick={() => setShowItemForm(null)} className="text-[10px] text-[#6B7280]">✕</button>
                      </div>
                    )}
                    {g.items.length === 0 && !showItemForm && <p className="text-[10px] text-[#9CA3AF]">أضف بنود التكلفة لحساب المبلغ تلقائياً</p>}
                    {g.items.map((item, i) => (
                      <div key={i} className="flex items-center justify-between py-1 border-b border-gray-100 last:border-0">
                        <span className="text-xs text-[#16213E]">{item.name}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-[#2C2C54]">{item.cost.toLocaleString()}</span>
                          <button onClick={() => sFinGoals(finGoals.map(x => x.id === g.id ? { ...x, items: x.items.filter((_, j) => j !== i) } : x))}
                            className="text-[#9CA3AF] hover:text-red-400 text-[10px]">✕</button>
                        </div>
                      </div>
                    ))}
                    {g.items.length > 0 && (
                      <div className="flex items-center justify-between pt-2 mt-1 border-t border-gray-200">
                        <span className="text-xs font-bold text-[#16213E]">الإجمالي</span>
                        <span className="text-xs font-black text-[#D4AF37]">{totalItems.toLocaleString()} ريال</span>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ═══ Gold (ذهب) ═══ */}
        {tab === "gold" && (() => {
          const goldValue = zakatData.goldGrams * (goldPrice || 310);
          const buyPurchases = zakatData.goldPurchases.filter(p => p.grams > 0);
          const sellPurchases = zakatData.goldPurchases.filter(p => p.grams < 0);
          const avgBuyPrice = buyPurchases.length > 0
            ? Math.round(buyPurchases.reduce((s, p) => s + p.pricePerGram * p.grams, 0) / buyPurchases.reduce((s, p) => s + p.grams, 0))
            : 0;
          const goldProfit = avgBuyPrice > 0 ? Math.round(((goldPrice || 310) - avgBuyPrice) * zakatData.goldGrams) : 0;


          async function submitGoldTx() {
            const g = Number(gfGrams); const p = Number(gfPrice);
            if (!g || !p) return;
            const isSell = goldForm === "sell";
            const grams = isSell ? -g : g;
            const notes = (isSell ? "بيع" : "شراء") + (gfNotes ? ` · ${gfNotes}` : "");
            try {
              const { data } = await api.post("/api/finance/zakat/purchases", { grams, pricePerGram: p, date: new Date().toISOString().slice(0, 10), notes });
              const purchase: GoldPurchase = { id: data.id, grams, pricePerGram: p, totalCost: Math.round(Math.abs(g) * p), date: new Date().toISOString().slice(0, 10), notes };
              setZakatData(prev => ({ ...prev, goldGrams: data.goldGrams ?? prev.goldGrams + grams, goldPurchases: [purchase, ...prev.goldPurchases] }));
            } catch {
              const purchase: GoldPurchase = { id: Date.now().toString(), grams, pricePerGram: p, totalCost: Math.round(Math.abs(g) * p), date: new Date().toISOString().slice(0, 10), notes };
              setZakatData(prev => ({ ...prev, goldGrams: prev.goldGrams + grams, goldPurchases: [purchase, ...prev.goldPurchases] }));
            }
            setGoldForm(null); setGfGrams(""); setGfPrice(""); setGfNotes("");
          }

          return (
            <section className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="سعر الجرام الآن" value={goldPrice || 552} color="#D4AF37" sub="ريال / 24 قيراط" />
                <Stat label="إجمالي الذهب" value={zakatData.goldGrams} color="#D4AF37" sub="جرام" />
                <Stat label="القيمة الحالية" value={goldValue} color="#D4AF37" sub="ريال" />
                <Stat label={goldProfit >= 0 ? "الربح" : "الخسارة"} value={Math.abs(goldProfit)} color={goldProfit >= 0 ? "#3D8C5A" : "#DC2626"} sub="ريال" />
              </div>

              {goldPrice > 0 && avgBuyPrice > 0 && goldPrice < avgBuyPrice && (
                <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                  <p className="text-green-800 text-sm font-bold">💡 فرصة شراء! السعر ({goldPrice}) أقل من متوسطك ({avgBuyPrice})</p>
                </div>
              )}

              <div className="bg-white rounded-xl p-4 border border-gray-200 flex items-center gap-3">
                <p className="text-xs text-[#6B7280]">تعديل السعر يدوياً:</p>
                <input type="number" value={goldPrice || ""} onChange={(e) => setGoldPrice(Number(e.target.value) || 0)}
                  className="w-24 px-2 py-1 rounded-lg border border-[#D4AF37] text-sm font-bold text-center focus:outline-none" />
                <p className="text-[10px] text-[#9CA3AF]">ريال/جرام</p>
              </div>

              <div className="flex gap-2">
                <button onClick={() => { setGoldForm("buy"); setGfPrice(String(goldPrice || "")); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#3D8C5A" }}>🪙 شراء ذهب</button>
                <button onClick={() => { setGoldForm("sell"); setGfPrice(String(goldPrice || "")); }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#DC2626" }}>💰 بيع ذهب</button>
              </div>

              {goldForm && (
                <div className="bg-white rounded-xl p-5 border shadow-sm fade-up space-y-3" style={{ borderColor: goldForm === "buy" ? "#3D8C5A" : "#DC2626" }}>
                  <p className="font-bold text-sm" style={{ color: goldForm === "buy" ? "#3D8C5A" : "#DC2626" }}>{goldForm === "buy" ? "🪙 شراء ذهب" : "💰 بيع ذهب"}</p>
                  <input type="number" value={gfGrams} onChange={e => setGfGrams(e.target.value)} placeholder="عدد الجرامات"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" autoFocus />
                  <input type="number" value={gfPrice} onChange={e => setGfPrice(e.target.value)} placeholder="سعر الجرام (ريال)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                  {gfGrams && gfPrice && <p className="text-xs text-[#6B7280]">الإجمالي: <b className="text-[#D4AF37]">{(Number(gfGrams) * Number(gfPrice)).toLocaleString()} ريال</b></p>}
                  <input value={gfNotes} onChange={e => setGfNotes(e.target.value)} placeholder="ملاحظات (اختياري)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                  <div className="flex gap-2">
                    <button onClick={() => setGoldForm(null)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
                    <button onClick={submitGoldTx} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white"
                      style={{ background: goldForm === "buy" ? "#3D8C5A" : "#DC2626" }}>تأكيد</button>
                  </div>
                </div>
              )}

              <GeometricDivider label="سجل العمليات" />
              {zakatData.goldPurchases.length === 0 && <p className="text-center text-[#9CA3AF] text-xs py-4">لا توجد عمليات</p>}
              {zakatData.goldPurchases.map(p => (
                <div key={p.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200">
                  <span className="text-lg">{p.grams > 0 ? "🪙" : "💰"}</span>
                  <div className="flex-1">
                    <p className="text-sm font-medium text-[#16213E]">{Math.abs(p.grams)} جرام × {p.pricePerGram} ريال</p>
                    <p className="text-[9px] text-[#9CA3AF]">{p.date}{p.notes ? ` · ${p.notes}` : ""}</p>
                  </div>
                  <p className="text-sm font-bold" style={{ color: p.grams > 0 ? "#3D8C5A" : "#DC2626" }}>{p.grams > 0 ? "+" : "-"}{p.totalCost.toLocaleString()}</p>
                  <button onClick={() => { api.delete(`/api/finance/zakat/purchases/${p.id}`).catch(() => {}); setZakatData(prev => ({ ...prev, goldGrams: prev.goldGrams - p.grams, goldPurchases: prev.goldPurchases.filter(x => x.id !== p.id) })); }}
                    className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
                </div>
              ))}
            </section>
          );
        })()}

        {/* ═══ Zakat (زكاة) ═══ */}
        {tab === "zakat" && (() => {
          const nisab = goldPrice > 0 ? goldPrice * 85 : 310 * 85;
          const goldValue = zakatData.goldGrams * (goldPrice || 310);
          const totalWealth = totalAcctBal + goldValue;
          const zakatDue = totalWealth >= nisab ? Math.round(totalWealth * 0.025) : 0;

          return (
            <section className="space-y-5">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Stat label="النصاب (85 جرام)" value={nisab} color="#2C2C54" sub="ريال" />
                <Stat label="إجمالي أموالك" value={totalWealth} color={totalWealth >= nisab ? "#3D8C5A" : "#6B7280"} sub={`نقد ${totalAcctBal.toLocaleString()} + ذهب ${goldValue.toLocaleString()}`} />
                <Stat label="الزكاة المستحقة" value={zakatDue} color={zakatDue > 0 ? "#DC2626" : "#3D8C5A"} sub={zakatDue > 0 ? "2.5%" : "لم تبلغ النصاب"} />
                <Stat label="سعر الذهب" value={goldPrice || 310} color="#D4AF37" sub="ريال / جرام" />
              </div>
              {zakatDue > 0 && (
                <div className="bg-green-50 rounded-xl p-5 border border-green-200 space-y-3">
                  <p className="text-green-800 text-sm font-bold">💰 زكاتك: {zakatDue.toLocaleString()} ريال</p>
                  <p className="text-green-600 text-xs">({totalWealth.toLocaleString()} ريال) × 2.5%</p>
                  <button onClick={async () => {
                    if (!confirm(`هل أخرجت الزكاة (${zakatDue.toLocaleString()} ريال)؟`)) return;
                    try {
                      await api.post("/api/finance/transactions", {
                        title: "إخراج زكاة المال", amount: zakatDue, type: "Expense",
                        category: "تبرعات", date: new Date().toISOString().slice(0, 10),
                      });
                      setTxs(prev => [{ id: Date.now().toString(), title: "إخراج زكاة المال", amount: zakatDue, type: "expense", category: "تبرعات", accountId: "", pocketId: "", date: new Date().toISOString().slice(0, 10) }, ...prev]);
                    } catch {}
                  }}
                    className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#3D8C5A" }}>
                    ✅ نعم، أخرجت الزكاة — خصم {zakatDue.toLocaleString()} ريال
                  </button>
                </div>
              )}
              <GeometricDivider label="تاريخ الحول (هجري)" />
              <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-3">
                <p className="text-[10px] text-[#6B7280]">تستحق الزكاة بعد مرور سنة هجرية كاملة على بلوغ النصاب</p>
                <input type="date" value={zakatData.hawalDate} onChange={(e) => sZakat({ ...zakatData, hawalDate: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                {zakatData.hawalDate && (() => {
                  const start = new Date(zakatData.hawalDate);
                  // سنة هجرية ≈ 354 يوم
                  const hawlEnd = new Date(start.getTime() + 354 * 86400000);
                  const daysLeft = Math.max(0, Math.ceil((hawlEnd.getTime() - Date.now()) / 86400000));
                  const hijriEnd = hawlEnd.toLocaleDateString("ar-SA-u-ca-islamic", { year: "numeric", month: "long", day: "numeric" });
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <p className="text-xs text-[#16213E]">استحقاق الزكاة: <b>{hijriEnd}</b></p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full font-bold"
                          style={{ background: daysLeft === 0 ? "#DC262620" : "#D4AF3720", color: daysLeft === 0 ? "#DC2626" : "#D4AF37" }}>
                          {daysLeft === 0 ? "مستحقة الآن!" : `${daysLeft} يوم متبقي`}
                        </span>
                      </div>
                      <p className="text-[9px] text-[#9CA3AF]">({hawlEnd.toLocaleDateString("ar-SA")} ميلادي)</p>
                    </div>
                  );
                })()}
              </div>
            </section>
          );
        })()}

        {/* ═══ Settings ═══ */}
        {/* ═══ Deductions (استقطاعات) ═══ */}
        {tab === "deductions" && (() => {
          const deds = settings.deductions ?? [];

          // حساب إجمالي الاستقطاعات من الدخل الشهري
          const monthlyIncome = mTx.filter(t => t.type === "income").reduce((s, t) => s + t.amount, 0);
          const totalDeducted = deds.reduce((s, d) => s + (d.type === "percent" ? Math.round(monthlyIncome * d.value / 100) : d.value), 0);
          // خصم ما سُدد من الديون هذا الشهر
          const debtPaidThisMonth = mTx.filter(t => t.type === "debt_payment").reduce((s, t) => s + t.amount, 0);
          const debtDeductionTotal = deds.filter(d => d.title.includes("دين") || d.title.includes("سداد")).reduce((s, d) => s + (d.type === "percent" ? Math.round(monthlyIncome * d.value / 100) : d.value), 0);
          const debtRemaining = Math.max(0, debtDeductionTotal - debtPaidThisMonth);

          return (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-bold text-[#16213E]">الاستقطاعات الدورية</p><p className="text-[10px] text-[#6B7280]">نسبة أو مبلغ يُستقطع من الدخل تلقائياً</p></div>
                <button onClick={() => setShowAddDed(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#2C2C54" }}>+ استقطاع</button>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <Stat label="الدخل الشهري" value={monthlyIncome} color="#3D8C5A" />
                <Stat label="إجمالي الاستقطاعات" value={totalDeducted} color="#5E5495" />
                <Stat label="المتبقي بعد الاستقطاع" value={monthlyIncome - totalDeducted} color={monthlyIncome - totalDeducted >= 0 ? "#2C2C54" : "#DC2626"} />
              </div>

              {debtPaidThisMonth > 0 && debtDeductionTotal > 0 && (
                <div className="bg-green-50 rounded-xl p-3 border border-green-200">
                  <p className="text-green-800 text-xs font-semibold">سددت {debtPaidThisMonth.toLocaleString()} من أصل {debtDeductionTotal.toLocaleString()} مخصص للديون{debtRemaining > 0 ? ` — متبقي ${debtRemaining.toLocaleString()}` : " ✅ تم السداد"}</p>
                </div>
              )}

              {showAddDed && (
                <div className="bg-white rounded-xl p-5 border border-[#5E5495] shadow-sm fade-up space-y-3">
                  <input value={ddTitle} onChange={e => setDdTitle(e.target.value)} placeholder="اسم الاستقطاع (مثال: ادخار، نفقة، سداد ديون)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                  <div className="flex gap-2">
                    <button onClick={() => setDdType("percent")} className="flex-1 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: ddType === "percent" ? "#5E5495" : "#F3F4F6", color: ddType === "percent" ? "#fff" : "#6B7280" }}>نسبة %</button>
                    <button onClick={() => setDdType("fixed")} className="flex-1 py-2 rounded-lg text-xs font-semibold"
                      style={{ background: ddType === "fixed" ? "#5E5495" : "#F3F4F6", color: ddType === "fixed" ? "#fff" : "#6B7280" }}>مبلغ ثابت</button>
                  </div>
                  <input type="number" value={ddValue} onChange={e => setDdValue(e.target.value)} placeholder={ddType === "percent" ? "النسبة (مثال: 10)" : "المبلغ"}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddDed(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
                    <button onClick={() => {
                      if (!ddTitle.trim() || !ddValue) return;
                      const newDed: Deduction = { id: Date.now().toString(), title: ddTitle.trim(), type: ddType, value: Number(ddValue), source: ddSource, paidSoFar: 0 };
                      sSettings({ ...settings, deductions: [...deds, newDed] });
                      setDdTitle(""); setDdValue(""); setShowAddDed(false);
                    }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#5E5495" }}>إضافة</button>
                  </div>
                </div>
              )}

              {deds.length === 0 && !showAddDed && <p className="text-center text-[#9CA3AF] text-xs py-6">لا توجد استقطاعات — أضف لتنظيم دخلك</p>}
              {deds.map(d => {
                const amount = d.type === "percent" ? Math.round(monthlyIncome * d.value / 100) : d.value;
                const paid = d.paidSoFar ?? 0;
                const remaining = Math.max(0, amount - paid);
                const pct = amount > 0 ? Math.min(100, Math.round((paid / amount) * 100)) : 0;
                const isDone = remaining <= 0;
                return (
                  <div key={d.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                    <div className="px-5 py-3 flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-lg" style={{ background: isDone ? "#3D8C5A15" : "#5E549515" }}>
                        {isDone ? "✅" : "💰"}
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-[#16213E]">{d.title}</p>
                        <p className="text-[10px] text-[#6B7280]">{d.type === "percent" ? `${d.value}%` : `${d.value.toLocaleString()}`} · مسدد {paid.toLocaleString()} · متبقي {remaining.toLocaleString()}</p>
                        <div className="mt-1 bg-gray-100 rounded-full h-1.5 overflow-hidden">
                          <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: isDone ? "#3D8C5A" : "#5E5495" }} />
                        </div>
                      </div>
                      <p className="text-sm font-black" style={{ color: isDone ? "#3D8C5A" : "#5E5495" }}>{amount.toLocaleString()}</p>
                      <button onClick={() => sSettings({ ...settings, deductions: deds.filter(x => x.id !== d.id) })} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
                    </div>
                    {!isDone && (
                      <div className="px-5 py-2 border-t border-gray-100 space-y-2">
                        <div className="flex gap-1 flex-wrap">
                          {TX_TYPES.filter(t => t.key !== "income" && t.key !== "transfer").map(t => (
                            <button key={t.key} id={`ded-type-${d.id}-${t.key}`}
                              onClick={(e) => {
                                document.querySelectorAll(`[id^="ded-type-${d.id}-"]`).forEach(el => (el as HTMLElement).style.background = "#F3F4F6");
                                (e.currentTarget as HTMLElement).style.background = t.color; (e.currentTarget as HTMLElement).style.color = "#fff";
                                (e.currentTarget as HTMLElement).dataset.selected = "true";
                              }}
                              className="px-2 py-1 rounded-lg text-[9px] font-semibold"
                              style={{ background: t.key === "expense" ? t.color : "#F3F4F6", color: t.key === "expense" ? "#fff" : "#6B7280" }}>
                              {t.icon} {t.label}
                            </button>
                          ))}
                        </div>
                        <div className="flex gap-2 items-center">
                          <input type="number" defaultValue={remaining} min={1} max={remaining}
                            id={`ded-pay-${d.id}`}
                            className="flex-1 px-3 py-1.5 rounded-lg border border-gray-200 text-xs text-center focus:outline-none focus:border-[#D4AF37]"
                            placeholder="المبلغ" />
                          <button onClick={async () => {
                            const input = document.getElementById(`ded-pay-${d.id}`) as HTMLInputElement;
                            const payAmount = Math.min(Number(input?.value) || remaining, remaining);
                            if (payAmount <= 0) return;
                            // اكتشف النوع المختار
                            const selectedBtn = document.querySelector(`[id^="ded-type-${d.id}-"][data-selected="true"]`);
                            const txType = selectedBtn?.id?.split("-").pop() ?? "expense";
                            const typeMap: Record<string, string> = { expense: "Expense", debt_payment: "DebtPayment", installment: "Installment", gift: "Gift" };
                            try { await api.post("/api/finance/transactions", { title: `سداد: ${d.title}`, amount: payAmount, type: typeMap[txType] ?? "Expense", category: d.title, date: new Date().toISOString().slice(0, 10) }); } catch {}
                            setTxs(prev => [{ id: Date.now().toString(), title: `سداد: ${d.title}`, amount: payAmount, type: txType as Transaction["type"], category: d.title, accountId: "", pocketId: "", date: new Date().toISOString().slice(0, 10) }, ...prev]);
                            sSettings({ ...settings, deductions: deds.map(x => x.id === d.id ? { ...x, paidSoFar: (x.paidSoFar ?? 0) + payAmount } : x) });
                          }} className="px-4 py-1.5 rounded-lg text-[10px] font-bold text-white bg-[#3D8C5A]">
                            سداد
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </section>
          );
        })()}

        {/* ═══ Receivables (مستحقات لي — غير مستلمة) ═══ */}
        {tab === "receivables" && (() => {
          const recs = settings.receivables ?? [];
          const unpaid = recs.filter(r => !r.isPaid);
          const paid = recs.filter(r => r.isPaid);
          const totalUnpaid = unpaid.reduce((s, r) => s + r.amount, 0);

          return (
            <section className="space-y-5">
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-bold text-[#16213E]">مبالغ مستحقة لي</p><p className="text-[10px] text-[#6B7280]">أموال عند أشخاص لم تُسلّم بعد</p></div>
                <button onClick={() => setShowAddRec(true)} className="text-xs px-3 py-1.5 rounded-lg font-semibold text-white" style={{ background: "#D4AF37" }}>+ مستحق</button>
              </div>

              <Stat label="إجمالي المستحق لك" value={totalUnpaid} color="#D4AF37" sub={`${unpaid.length} مستحق`} />

              {showAddRec && (
                <div className="bg-white rounded-xl p-5 border border-[#D4AF37] shadow-sm fade-up space-y-3">
                  <input value={rrTitle} onChange={e => setRrTitle(e.target.value)} placeholder="وصف المستحق (مثال: سلفة لأحمد)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                  <input type="number" value={rrAmount} onChange={e => setRrAmount(e.target.value)} placeholder="المبلغ"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                  <input value={rrFrom} onChange={e => setRrFrom(e.target.value)} placeholder="من عند (الشخص/الجهة)"
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                  <input type="date" value={rrDate} onChange={e => setRrDate(e.target.value)}
                    className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddRec(false)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
                    <button onClick={() => {
                      if (!rrTitle.trim() || !rrAmount) return;
                      const r: Receivable = { id: Date.now().toString(), title: rrTitle.trim(), amount: Number(rrAmount), fromWhom: rrFrom.trim(), dueDate: rrDate || undefined, isPaid: false };
                      sSettings({ ...settings, receivables: [r, ...recs] });
                      setRrTitle(""); setRrAmount(""); setRrFrom(""); setRrDate(""); setShowAddRec(false);
                    }} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#D4AF37" }}>إضافة</button>
                  </div>
                </div>
              )}

              {unpaid.length === 0 && !showAddRec && <p className="text-center text-[#9CA3AF] text-xs py-6">لا توجد مبالغ مستحقة — الحمد لله</p>}

              {unpaid.map(r => (
                <div key={r.id} className="bg-white rounded-xl px-5 py-4 border border-gray-200 flex items-center gap-3">
                  <div className="flex-1">
                    <p className="text-sm font-bold text-[#16213E]">{r.title}</p>
                    <p className="text-[10px] text-[#6B7280]">من: {r.fromWhom}{r.dueDate ? ` · ${new Date(r.dueDate).toLocaleDateString("ar-SA")}` : ""}</p>
                  </div>
                  <p className="text-sm font-black text-[#D4AF37]">{r.amount.toLocaleString()}</p>
                  <button onClick={async () => {
                    // تم الاستلام — أضف كدخل وحوّل لمستلم
                    try { await api.post("/api/finance/transactions", { title: `استلام: ${r.title}`, amount: r.amount, type: "Income", category: "أخرى", date: new Date().toISOString().slice(0, 10) }); } catch {}
                    setTxs(prev => [{ id: Date.now().toString(), title: `استلام: ${r.title}`, amount: r.amount, type: "income", category: "أخرى", accountId: "", pocketId: "", date: new Date().toISOString().slice(0, 10) }, ...prev]);
                    sSettings({ ...settings, receivables: recs.map(x => x.id === r.id ? { ...x, isPaid: true } : x) });
                  }} className="text-[10px] px-3 py-1.5 rounded-lg font-bold text-white bg-[#3D8C5A]">تم الاستلام</button>
                  <button onClick={() => sSettings({ ...settings, receivables: recs.filter(x => x.id !== r.id) })} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
                </div>
              ))}

              {paid.length > 0 && (
                <>
                  <GeometricDivider label="مستلمة" />
                  {paid.map(r => (
                    <div key={r.id} className="bg-white rounded-xl px-5 py-3 border border-gray-200 flex items-center gap-3 opacity-50">
                      <p className="text-sm text-[#16213E] flex-1 line-through">{r.title} — {r.fromWhom}</p>
                      <p className="text-sm text-[#3D8C5A]">{r.amount.toLocaleString()} ✓</p>
                      <button onClick={() => sSettings({ ...settings, receivables: recs.filter(x => x.id !== r.id) })} className="text-[#9CA3AF] text-xs">✕</button>
                    </div>
                  ))}
                </>
              )}
            </section>
          );
        })()}

        {tab === "settings" && (
          <>
            <FinSettingsSection settings={settings} onUpdate={sSettings} />
            {/* أدوات الترحيل */}
            <GeometricDivider label="مزامنة البيانات" />
            <div className="bg-white rounded-xl p-5 border border-gray-200 space-y-3">
              <p className="text-sm font-bold text-[#16213E]">ترحيل البيانات المحلية للسيرفر</p>
              <p className="text-[10px] text-[#6B7280]">إذا عندك بيانات مالية على هذا الجهاز لم تُرحّل</p>
              <button onClick={async () => {
                const localTxs = load<Transaction[]>("mfin_tx", []);
                const localAccts = load<Account[]>("mfin_accts", []);
                if (localTxs.length === 0 && localAccts.length === 0) { alert("لا توجد بيانات محلية للترحيل"); return; }
                try {
                  await api.post("/api/finance/sync", {
                    accounts: load("mfin_accts", []).map((a: Account) => ({ id: a.id, name: a.name, icon: a.icon, balance: a.balance })),
                    pockets: load("mfin_pockets", []).map((p: Pocket) => ({ id: p.id, name: p.name, icon: p.icon, type: p.type, commitments: p.commitments })),
                    transactions: localTxs.map((t: Transaction) => ({ title: t.title, amount: t.amount, type: t.type, category: t.category, expenseClass: t.expenseClass, accountId: t.accountId, pocketId: t.pocketId, date: t.date })),
                    debts: load("mfin_debts", []),
                    dues: load<RecurringDue[]>("mfin_dues", []).map((d) => ({ title: d.title, amount: d.amount, type: d.type, frequency: d.frequency, dueDay: d.dueDay, dueMonth: d.dueMonth, accountId: d.accountId, pocketId: d.pocketId, category: d.category, isActive: d.isActive })),
                    goals: load<FinGoal[]>("mfin_goals", []).map((g) => ({ title: g.title, description: g.description, targetAmount: g.targetAmount, savedSoFar: g.savedSoFar, deadline: g.deadline, items: g.items })),
                    zakat: load("mfin_zakat", null),
                    settings: load("mfin_settings", null),
                  });
                  ["mfin_tx", "mfin_accts", "mfin_pockets", "mfin_settings", "mfin_debts", "mfin_dues", "mfin_goals", "mfin_zakat"].forEach(k => localStorage.removeItem(k));
                  alert("تم الترحيل بنجاح! أعد تحميل الصفحة.");
                  loadFinanceData();
                } catch (e) { alert("فشل الترحيل: " + String(e)); }
              }} className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#2C2C54" }}>
                ترحيل البيانات المحلية
              </button>
              <button onClick={() => loadFinanceData()} className="w-full py-2 rounded-xl text-sm font-semibold text-[#6B7280] bg-gray-100">
                إعادة تحميل من السيرفر
              </button>
            </div>
          </>
        )}

        <div className="pb-4"><GeometricDivider /></div>
      </div>

      {/* ═══ Transfer Dialog (محافظ + حسابات) ═══ */}
      {showTransfer && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowTransfer(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-sm fade-up">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-200">
              <h3 className="font-bold text-[#16213E]">🔄 تحويل</h3>
              <button onClick={() => setShowTransfer(false)} className="text-[#6B7280] text-sm">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div>
                <p className="text-xs text-[#6B7280] mb-1">من:</p>
                <select value={trFrom} onChange={(e) => setTrFrom(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]">
                  <option value="">اختر</option>
                  <optgroup label="المحافظ">
                    {pockets.map((p) => <option key={`p-${p.id}`} value={`p:${p.id}`}>{p.icon} {p.name} ({calcPocketBal(p.id).toLocaleString()})</option>)}
                  </optgroup>
                  <optgroup label="الحسابات">
                    {accounts.map((a) => <option key={`a-${a.id}`} value={`a:${a.id}`}>{a.icon} {a.name} ({a.balance.toLocaleString()})</option>)}
                  </optgroup>
                </select>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">إلى:</p>
                <select value={trTo} onChange={(e) => setTrTo(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]">
                  <option value="">اختر</option>
                  <optgroup label="المحافظ">
                    {pockets.map((p) => <option key={`p-${p.id}`} value={`p:${p.id}`}>{p.icon} {p.name}</option>)}
                  </optgroup>
                  <optgroup label="الحسابات">
                    {accounts.map((a) => <option key={`a-${a.id}`} value={`a:${a.id}`}>{a.icon} {a.name}</option>)}
                  </optgroup>
                </select>
              </div>
              <input type="number" value={trAmt} onChange={(e) => setTrAmt(e.target.value)} placeholder="المبلغ"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
              <button onClick={() => {
                if (!trFrom || !trTo || !trAmt || trFrom === trTo) return;
                const amt = Number(trAmt);
                const [fType, fId] = trFrom.split(":"); const [tType, tId] = trTo.split(":");
                if (fType === "p") sPockets(pockets.map((p) => p.id === fId ? { ...p, balance: p.balance - amt } : p));
                else sAccts(accounts.map((a) => a.id === fId ? { ...a, balance: a.balance - amt } : a));
                if (tType === "p") sPockets(pockets.map((p) => p.id === tId ? { ...p, balance: p.balance + amt } : p));
                else sAccts(accounts.map((a) => a.id === tId ? { ...a, balance: a.balance + amt } : a));
                setShowTransfer(false); setTrFrom(""); setTrTo(""); setTrAmt("");
              }}
                className="w-full py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#2C2C54" }}>تحويل</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Add Transaction Dialog ═══ */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowAdd(false)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-up">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-200">
              <h3 className="font-bold text-[#16213E]">معاملة جديدة</h3>
              <button onClick={() => setShowAdd(false)} className="text-[#6B7280] text-sm">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              {/* النوع الأساسي */}
              <div className="flex gap-1">
                {TX_TYPES.map((t) => (
                  <button key={t.key} onClick={() => setFType(t.key as Transaction["type"])}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
                    style={{ background: fType === t.key || (fType !== "income" && fType !== "transfer" && t.key === "expense") ? t.color : "#F3F4F6", color: fType === t.key || (fType !== "income" && fType !== "transfer" && t.key === "expense") ? "#fff" : "#6B7280" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              {/* قسم المصروف الفرعي */}
              {fType !== "income" && fType !== "transfer" && (
                <div className="flex gap-1 flex-wrap">
                  {EXPENSE_SUBS.map((s) => (
                    <button key={s.key} onClick={() => setFType(s.key as Transaction["type"])}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition"
                      style={{ background: fType === s.key ? "#DC2626" : "#FEF2F2", color: fType === s.key ? "#fff" : "#DC2626" }}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              )}
              <input value={fTitle} onChange={(e) => setFTitle(e.target.value)} placeholder="الوصف"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
              <input type="text" value={fAmount} onChange={(e) => { if (/^[\d+\-*/. ]*$/.test(e.target.value)) setFAmount(e.target.value); }}
                onBlur={() => { try { const r = Function('"use strict"; return (' + fAmount + ')')(); if (typeof r === "number" && isFinite(r)) setFAmount(String(Math.round(r*100)/100)); } catch {} }}
                placeholder="المبلغ (يدعم حسابات: 500+300)"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />

              {/* Account selection */}
              <div>
                <p className="text-xs text-[#6B7280] mb-1">الحساب (أين المال):</p>
                <select value={fAcct} onChange={(e) => setFAcct(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]">
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </select>
              </div>

              {/* Pocket selection */}
              <div>
                <p className="text-xs text-[#6B7280] mb-1">المحفظة (لمن المال):</p>
                <select value={fPocket} onChange={(e) => setFPocket(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]">
                  {pockets.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                </select>
              </div>

              <div className="flex gap-1.5 flex-wrap items-center">
                {(fType === "income" ? (settings.incomeCategories ?? DEF_INC_CATS) : (settings.expenseCategories ?? DEF_EXP_CATS)).map((c) => (
                  <button key={c} onClick={() => setFCat(c)} className="px-2 py-1 rounded-lg text-[10px] font-medium"
                    style={{ background: fCat === c ? "#2C2C54" : "#F3F4F6", color: fCat === c ? "#fff" : "#6B7280" }}>{c}</button>
                ))}
                <input type="text" placeholder="+ بند جديد" className="px-2 py-1 rounded-lg text-[10px] border border-dashed border-gray-300 w-20 focus:outline-none focus:border-[#D4AF37]"
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (!val) return;
                    const key = fType === "income" ? "incomeCategories" : "expenseCategories";
                    const current = settings[key] ?? (fType === "income" ? DEF_INC_CATS : DEF_EXP_CATS);
                    if (!current.includes(val)) sSettings({ ...settings, [key]: [...current, val] });
                    setFCat(val);
                    (e.target as HTMLInputElement).value = "";
                  }} />
              </div>

              {fType === "expense" && (
                <div className="flex gap-2">
                  {(Object.entries(EXP_CLS) as [ExpenseClass, { label: string; color: string; icon: string }][]).map(([k, v]) => (
                    <button key={k} onClick={() => setFExpCls(k)} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold"
                      style={{ background: fExpCls === k ? v.color : "#F3F4F6", color: fExpCls === k ? "#fff" : "#6B7280" }}>{v.icon} {v.label}</button>
                  ))}
                </div>
              )}

              <input type="date" value={fDate} onChange={(e) => setFDate(e.target.value)}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />

              <button onClick={addTx} className="w-full py-2.5 rounded-xl text-sm font-bold text-white"
                style={{ background: TX_TYPES.find((t) => t.key === fType)?.color ?? "#2C2C54" }}>إضافة</button>
            </div>
          </div>
        </div>
      )}

      {/* ═══ Edit Transaction Dialog ═══ */}
      {editTx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={() => setEditTx(null)} />
          <div className="relative z-10 bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto fade-up">
            <div className="flex items-center justify-between px-6 pt-6 pb-3 border-b border-gray-200">
              <h3 className="font-bold text-[#16213E]">تعديل المعاملة</h3>
              <button onClick={() => setEditTx(null)} className="text-[#6B7280] text-sm">✕</button>
            </div>
            <div className="px-6 py-5 space-y-3">
              <div className="flex gap-1">
                {TX_TYPES.map((t) => (
                  <button key={t.key} onClick={() => setEditTx({ ...editTx, type: t.key as Transaction["type"] })}
                    className="flex-1 py-2 rounded-lg text-xs font-semibold transition"
                    style={{ background: editTx.type === t.key || (editTx.type !== "income" && editTx.type !== "transfer" && t.key === "expense") ? t.color : "#F3F4F6", color: editTx.type === t.key || (editTx.type !== "income" && editTx.type !== "transfer" && t.key === "expense") ? "#fff" : "#6B7280" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
              {editTx.type !== "income" && editTx.type !== "transfer" && (
                <div className="flex gap-1 flex-wrap">
                  {EXPENSE_SUBS.map((s) => (
                    <button key={s.key} onClick={() => setEditTx({ ...editTx, type: s.key as Transaction["type"] })}
                      className="px-2.5 py-1 rounded-lg text-[10px] font-medium transition"
                      style={{ background: editTx.type === s.key ? "#DC2626" : "#FEF2F2", color: editTx.type === s.key ? "#fff" : "#DC2626" }}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              )}
              <input value={editTx.title} onChange={(e) => setEditTx({ ...editTx, title: e.target.value })} placeholder="الوصف"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
              <input type="number" value={editTx.amount} onChange={(e) => setEditTx({ ...editTx, amount: Number(e.target.value) })} placeholder="المبلغ"
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
              <div>
                <p className="text-xs text-[#6B7280] mb-1">الحساب:</p>
                <select value={editTx.accountId} onChange={(e) => setEditTx({ ...editTx, accountId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]">
                  {accounts.map((a) => <option key={a.id} value={a.id}>{a.icon} {a.name}</option>)}
                </select>
              </div>
              <div>
                <p className="text-xs text-[#6B7280] mb-1">المحفظة:</p>
                <select value={editTx.pocketId} onChange={(e) => setEditTx({ ...editTx, pocketId: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]">
                  {pockets.map((p) => <option key={p.id} value={p.id}>{p.icon} {p.name}</option>)}
                </select>
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {(editTx.type === "income" ? (settings.incomeCategories ?? DEF_INC_CATS) : (settings.expenseCategories ?? DEF_EXP_CATS)).map((c) => (
                  <button key={c} onClick={() => setEditTx({ ...editTx, category: c })} className="px-2 py-1 rounded-lg text-[10px] font-medium"
                    style={{ background: editTx.category === c ? "#2C2C54" : "#F3F4F6", color: editTx.category === c ? "#fff" : "#6B7280" }}>{c}</button>
                ))}
              </div>
              {editTx.type === "expense" && (
                <div className="flex gap-2">
                  {(Object.entries(EXP_CLS) as [ExpenseClass, { label: string; color: string; icon: string }][]).map(([k, v]) => (
                    <button key={k} onClick={() => setEditTx({ ...editTx, expenseClass: k })} className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold"
                      style={{ background: editTx.expenseClass === k ? v.color : "#F3F4F6", color: editTx.expenseClass === k ? "#fff" : "#6B7280" }}>{v.icon} {v.label}</button>
                  ))}
                </div>
              )}
              <input type="date" value={editTx.date} onChange={(e) => setEditTx({ ...editTx, date: e.target.value })}
                className="w-full px-4 py-2.5 rounded-xl border border-gray-200 text-sm focus:outline-none focus:border-[#D4AF37]" />
              <div className="flex gap-2">
                <button onClick={() => setEditTx(null)} className="flex-1 py-2.5 rounded-xl text-sm text-[#6B7280] bg-gray-100">إلغاء</button>
                <button onClick={saveEditTx} className="flex-1 py-2.5 rounded-xl text-sm font-bold text-white" style={{ background: "#D4AF37" }}>حفظ التعديل</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
