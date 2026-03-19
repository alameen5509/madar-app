"use client";

import { useState, useEffect } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";

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
  type: "salary" | "bill" | "installment" | "expected_income" | "expected_expense";
  frequency: "monthly" | "yearly" | "once";
  dueDay: number; // يوم الشهر
  dueMonth?: number; // للسنوي
  accountId?: string;
  pocketId?: string;
  category?: string;
  isActive: boolean;
  lastConfirmedDate?: string; // آخر مرة تأكد
}

interface FinSettings {
  debtPercent: number;
  savingsPercent: number;
  expenseCategories: string[];
  incomeCategories: string[];
}

/* ═══ Constants ═══════════════════════════════════════════════════════════ */

const TX_TYPES = [
  { key: "income",       label: "دخل",      icon: "📥", color: "#3D8C5A" },
  { key: "expense",      label: "مصروف",    icon: "📤", color: "#DC2626" },
  { key: "debt_payment", label: "سداد دين", icon: "💳", color: "#0F3460" },
  { key: "installment",  label: "قسط",      icon: "📋", color: "#8C4A3D" },
  { key: "gift",         label: "هدية",     icon: "🎁", color: "#D4AF37" },
  { key: "transfer",     label: "تحويل",    icon: "🔄", color: "#6B7280" },
] as const;

const DEF_EXP_CATS = ["طعام", "مواصلات", "سكن", "فواتير", "صحة", "تعليم", "ترفيه", "ملابس", "اشتراكات", "صيانة", "تبرعات", "أخرى"];
const DEF_INC_CATS = ["راتب", "عمل حر", "استثمار", "مكافأة", "إيجار", "أخرى"];
const DUE_TYPES = [
  { key: "salary",           label: "راتب",        icon: "💼", color: "#3D8C5A" },
  { key: "bill",             label: "فاتورة",      icon: "📄", color: "#DC2626" },
  { key: "installment",      label: "قسط",         icon: "📋", color: "#8C4A3D" },
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
  const [settings, setSettings] = useState<FinSettings>({ debtPercent: 10, savingsPercent: 10, expenseCategories: DEF_EXP_CATS, incomeCategories: DEF_INC_CATS });
  const [debts, setDebts]       = useState<Debt[]>([]);
  const [dues, setDues]         = useState<RecurringDue[]>([]);
  const [tab, setTab] = useState<"overview" | "transactions" | "accounts" | "pockets" | "debts" | "dues" | "settings">("overview");
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
  const [showTransfer, setShowTransfer]   = useState(false);
  const [trFrom, setTrFrom] = useState(""); const [trTo, setTrTo] = useState(""); const [trAmt, setTrAmt] = useState("");
  const [ncTitle, setNcTitle] = useState(""); const [ncAmount, setNcAmount] = useState(""); const [ncTotal, setNcTotal] = useState(""); const [ncDay, setNcDay] = useState("1");

  useEffect(() => {
    setTxs(load("mfin_tx", []));
    setAccounts(load("mfin_accts", DEF_ACCOUNTS));
    setPockets(load("mfin_pockets", DEF_POCKETS));
    const s = load("mfin_settings", { debtPercent: 10, savingsPercent: 10, expenseCategories: DEF_EXP_CATS, incomeCategories: DEF_INC_CATS });
    setSettings({ ...s, expenseCategories: s.expenseCategories ?? DEF_EXP_CATS, incomeCategories: s.incomeCategories ?? DEF_INC_CATS });
    setDebts(load("mfin_debts", []));
    setDues(load("mfin_dues", []));
  }, []);

  function sTxs(v: Transaction[]) { setTxs(v); save("mfin_tx", v); }
  function sAccts(v: Account[] | ((prev: Account[]) => Account[])) {
    setAccounts(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      save("mfin_accts", next);
      return next;
    });
  }
  function sPockets(v: Pocket[] | ((prev: Pocket[]) => Pocket[])) {
    setPockets(prev => {
      const next = typeof v === "function" ? v(prev) : v;
      save("mfin_pockets", next);
      return next;
    });
  }
  function sSettings(v: FinSettings) { setSettings(v); save("mfin_settings", v); }
  function sDebts(v: Debt[]) { setDebts(v); save("mfin_debts", v); }
  function sDues(v: RecurringDue[]) { setDues(v); save("mfin_dues", v); }

  /** تأكيد استلام/دفع مستحق وتحويله لمعاملة فعلية */
  function confirmDue(due: RecurringDue) {
    const isIncome = due.type === "salary" || due.type === "expected_income";
    const aid = due.accountId || accounts[0]?.id || "";
    const pid = due.pocketId || pockets[0]?.id || "";
    const t: Transaction = {
      id: Date.now().toString(), title: due.title, amount: due.amount,
      type: isIncome ? "income" : "expense",
      category: due.category ?? (isIncome ? "راتب" : "فواتير"),
      accountId: aid, pocketId: pid,
      date: new Date().toISOString().slice(0, 10),
    };
    sTxs([t, ...txs]);
    const mult = isIncome ? 1 : -1;
    sAccts(accounts.map((a) => a.id === aid ? { ...a, balance: a.balance + due.amount * mult } : a));
    if (isIncome) sPockets(pockets.map((p) => p.id === pid ? { ...p, balance: p.balance + due.amount } : p));
    else sPockets(pockets.map((p) => p.id === pid ? { ...p, balance: p.balance - due.amount } : p));
    sDues(dues.map((d) => d.id === due.id ? { ...d, lastConfirmedDate: new Date().toISOString().slice(0, 10) } : d));
  }

  /** تطبيق أثر معاملة على الأرصدة (إضافة أو عكس) */
  function applyTxEffect(t: Transaction, reverse = false) {
    const sign = reverse ? -1 : 1;
    const isIncome = t.type === "income";
    const mult = isIncome ? 1 : -1;

    // تحديث رصيد الحساب
    sAccts(prev => prev.map((a) => a.id === t.accountId ? { ...a, balance: a.balance + t.amount * mult * sign } : a));

    // تحديث رصيد المحفظة
    if (isIncome) {
      // الدخل: أضف للمحفظة + استقطاع تلقائي للديون والادخار
      const debtPkt = pockets.find(p => p.type === "debt");
      const savPkt = pockets.find(p => p.type === "savings");
      const deductDebt = Math.round(t.amount * settings.debtPercent / 100);
      const deductSav = Math.round(t.amount * settings.savingsPercent / 100);
      const netIncome = t.amount - deductDebt - deductSav;

      sPockets(prev => prev.map(p => {
        if (p.id === t.pocketId) return { ...p, balance: p.balance + netIncome * sign };
        if (debtPkt && p.id === debtPkt.id && deductDebt > 0) return { ...p, balance: p.balance + deductDebt * sign };
        if (savPkt && p.id === savPkt.id && deductSav > 0) return { ...p, balance: p.balance + deductSav * sign };
        return p;
      }));
    } else if (t.type === "debt_payment") {
      // سداد دين: ينزل من محفظة الديون
      const debtPkt = pockets.find(p => p.type === "debt");
      const targetId = debtPkt?.id ?? t.pocketId;
      sPockets(prev => prev.map(p => p.id === targetId ? { ...p, balance: p.balance - t.amount * sign } : p));
    } else {
      sPockets(prev => prev.map(p => p.id === t.pocketId ? { ...p, balance: p.balance - t.amount * sign } : p));
    }
  }

  function addTx() {
    if (!fTitle.trim() || !fAmount) return;
    let amt = 0;
    try { amt = Function('"use strict"; return (' + fAmount + ')')(); } catch { amt = Number(fAmount); }
    if (!amt || !isFinite(amt)) return;
    amt = Math.round(amt * 100) / 100;

    const aid = fAcct || accounts[0]?.id || "";
    const pid = fPocket || pockets[0]?.id || "";

    if (fType === "expense" && fExpCls === "improvement") {
      const week = new Date(); week.setDate(week.getDate() + 7);
      const t: Transaction = { id: Date.now().toString(), title: fTitle.trim(), amount: amt, type: fType, category: fCat, expenseClass: "improvement", accountId: aid, pocketId: pid, date: fDate, approvedAt: week.toISOString().slice(0,10) };
      sTxs([t, ...txs]); setFTitle(""); setFAmount(""); setShowAdd(false);
      alert(`مصروف تحسيني — متاح بعد ${week.toLocaleDateString("ar-SA")}`);
      return;
    }

    const t: Transaction = { id: Date.now().toString(), title: fTitle.trim(), amount: amt, type: fType, category: fCat, expenseClass: fType === "expense" ? fExpCls : undefined, accountId: aid, pocketId: pid, date: fDate };
    sTxs([t, ...txs]);
    applyTxEffect(t);

    setFTitle(""); setFAmount(""); setShowAdd(false);
  }

  /** حذف معاملة مع عكس أثرها من الأرصدة */
  function deleteTx(id: string) {
    const tx = txs.find(t => t.id === id);
    if (!tx) return;
    applyTxEffect(tx, true); // عكس الأثر
    sTxs(txs.filter(t => t.id !== id));
  }

  /** تعديل معاملة: عكس القديمة ثم تطبيق الجديدة */
  const [editTx, setEditTx] = useState<Transaction | null>(null);
  function saveEditTx() {
    if (!editTx) return;
    const old = txs.find(t => t.id === editTx.id);
    if (old) applyTxEffect(old, true);
    applyTxEffect(editTx);
    sTxs(txs.map(t => t.id === editTx.id ? editTx : t));
    setEditTx(null);
  }

  function addAccount() {
    if (!naName.trim()) return;
    sAccts([...accounts, { id: Date.now().toString(), name: naName.trim(), icon: naIcon, balance: Number(naBal) || 0 }]);
    setNaName(""); setNaBal(""); setShowNewAcct(false);
  }

  function addPocket() {
    if (!npName.trim()) return;
    sPockets([...pockets, { id: Date.now().toString(), name: npName.trim(), icon: npIcon, type: npType, balance: 0, commitments: [] }]);
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

  // Calculations
  const mTx = txs.filter((t) => t.date.startsWith(month));
  const income = mTx.filter((t) => t.type === "income").reduce((s, t) => s + t.amount, 0);
  const expense = mTx.filter((t) => t.type === "expense").reduce((s, t) => s + t.amount, 0);
  const debtPaid = mTx.filter((t) => t.type === "debt_payment" || t.type === "installment").reduce((s, t) => s + t.amount, 0);
  const gifts = mTx.filter((t) => t.type === "gift").reduce((s, t) => s + t.amount, 0);
  const net = income - expense - debtPaid - gifts;
  const totalAcctBal = accounts.reduce((s, a) => s + a.balance, 0);
  const debtPocket = pockets.find((p) => p.type === "debt");
  const savingsPocket = pockets.find((p) => p.type === "savings");
  const totalDebtRemaining = pockets.filter((p) => p.type === "debt" || p.type === "installment").flatMap((p) => p.commitments).reduce((s, c) => s + (c.totalAmount ?? 0) - c.paidSoFar, 0);
  const monthlyCommits = pockets.flatMap((p) => p.commitments).reduce((s, c) => s + c.monthlyAmount, 0);
  const essExp = mTx.filter((t) => t.expenseClass === "essential").reduce((s, t) => s + t.amount, 0);
  const luxExp = mTx.filter((t) => t.expenseClass === "luxury").reduce((s, t) => s + t.amount, 0);
  const impExp = mTx.filter((t) => t.expenseClass === "improvement").reduce((s, t) => s + t.amount, 0);
  const expByCat = new Map<string, number>();
  mTx.filter((t) => t.type === "expense").forEach((t) => expByCat.set(t.category, (expByCat.get(t.category) ?? 0) + t.amount));

  const TABS = [
    { key: "overview",     label: "ملخص" },
    { key: "transactions", label: "معاملات" },
    { key: "accounts",     label: "حسابات" },
    { key: "pockets",      label: "محافظ" },
    { key: "dues",         label: "مستحقات" },
    { key: "debts",        label: "ديون" },
    { key: "settings",     label: "إعدادات" },
  ] as const;

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
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4">
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
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} className="flex-1 py-1.5 rounded-lg text-[11px] font-semibold transition"
              style={{ background: tab === t.key ? "#2C2C54" : "transparent", color: tab === t.key ? "#fff" : "#6B7280" }}>{t.label}</button>
          ))}
        </div>
      </header>

      <div className="px-8 py-6 space-y-5">

        {/* ═══ Overview ═══ */}
        {tab === "overview" && (<>
          {/* الأرصدة الفعلية */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Stat label="إجمالي الحسابات" value={totalAcctBal} color="#2C2C54" />
            <Stat label="المحافظ" value={pockets.reduce((s, p) => s + p.balance, 0)} color="#5E5495" />
            <Stat label="محفظة الادخار" value={savingsPocket?.balance ?? 0} color="#D4AF37" />
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

        {/* ═══ Transactions ═══ */}
        {tab === "transactions" && (
          <div className="space-y-1.5">
            {mTx.length === 0 && <p className="text-[#6B7280] text-sm text-center py-8">لا توجد معاملات</p>}
            {mTx.map((t) => {
              const meta = TX_TYPES.find((x) => x.key === t.type) ?? TX_TYPES[0];
              return (
                <div key={t.id} className="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-gray-200">
                  <span className="text-lg">{meta.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-[#16213E] truncate">{t.title}</p>
                    <p className="text-[9px] text-[#9CA3AF]">{t.category} · {accounts.find((a) => a.id === t.accountId)?.name ?? ""} → {pockets.find((p) => p.id === t.pocketId)?.name ?? ""} · {t.date}</p>
                  </div>
                  {t.expenseClass && <span className="text-[9px]">{EXP_CLS[t.expenseClass].icon}</span>}
                  <span className="text-sm font-bold" style={{ color: meta.color }}>{t.type === "income" ? "+" : "-"}{t.amount.toLocaleString()}</span>
                  <button onClick={() => setEditTx({ ...t })} className="text-[#6B7280] hover:text-[#D4AF37] text-xs" title="تعديل">✎</button>
                  <button onClick={() => { if (confirm("حذف هذه المعاملة؟ سيتم عكس أثرها من الأرصدة.")) deleteTx(t.id); }} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
                </div>
              );
            })}
          </div>
        )}

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
                            onKeyDown={(e) => { if (e.key === "Enter") { sAccts(accounts.map(x => x.id === a.id ? { ...x, balance: Number(editAcctBal) || 0 } : x)); setEditAcctId(null); } }} />
                          <button onClick={() => { sAccts(accounts.map(x => x.id === a.id ? { ...x, balance: Number(editAcctBal) || 0 } : x)); setEditAcctId(null); }}
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
                    <button onClick={() => sAccts(accounts.filter((x) => x.id !== a.id))} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
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
                        <p className="text-lg font-black mt-1" style={{ color: p.balance >= 0 ? "#3D8C5A" : "#DC2626" }}>{p.balance.toLocaleString()} ريال</p>
                      </div>
                      <button onClick={() => sPockets(pockets.filter((x) => x.id !== p.id))} className="text-[#9CA3AF] hover:text-red-400 text-xs">✕</button>
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

        {/* ═══ Settings ═══ */}
        {tab === "settings" && (
          <FinSettingsSection settings={settings} onUpdate={sSettings} />
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
                    {pockets.map((p) => <option key={`p-${p.id}`} value={`p:${p.id}`}>{p.icon} {p.name} ({p.balance.toLocaleString()})</option>)}
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
              <div className="flex gap-1 flex-wrap">
                {TX_TYPES.map((t) => (
                  <button key={t.key} onClick={() => setFType(t.key as Transaction["type"])}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition min-w-[50px]"
                    style={{ background: fType === t.key ? t.color : "#F3F4F6", color: fType === t.key ? "#fff" : "#6B7280" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
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

              <div className="flex gap-1.5 flex-wrap">
                {(fType === "income" ? (settings.incomeCategories ?? DEF_INC_CATS) : (settings.expenseCategories ?? DEF_EXP_CATS)).map((c) => (
                  <button key={c} onClick={() => setFCat(c)} className="px-2 py-1 rounded-lg text-[10px] font-medium"
                    style={{ background: fCat === c ? "#2C2C54" : "#F3F4F6", color: fCat === c ? "#fff" : "#6B7280" }}>{c}</button>
                ))}
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
              <div className="flex gap-1 flex-wrap">
                {TX_TYPES.map((t) => (
                  <button key={t.key} onClick={() => setEditTx({ ...editTx, type: t.key as Transaction["type"] })}
                    className="flex-1 py-1.5 rounded-lg text-[10px] font-semibold transition min-w-[50px]"
                    style={{ background: editTx.type === t.key ? t.color : "#F3F4F6", color: editTx.type === t.key ? "#fff" : "#6B7280" }}>
                    {t.icon} {t.label}
                  </button>
                ))}
              </div>
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
