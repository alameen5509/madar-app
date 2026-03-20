"use client";

import { useState, useEffect, useCallback } from "react";
import { GeometricDivider } from "@/components/IslamicPattern";
import { getTasks, getGoals, getCircles, type SmartTask, type Goal, type LifeCircle } from "@/lib/api";

interface Insight {
  icon: string;
  title: string;
  body: string;
  type: "success" | "warning" | "info" | "idea";
}

function analyze(tasks: SmartTask[], goals: Goal[], circles: LifeCircle[]): Insight[] {
  const insights: Insight[] = [];
  const completed = tasks.filter((t) => t.status === "Completed").length;
  const total = tasks.length;
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  const overdue = tasks.filter((t) => {
    if (t.status === "Completed") return false;
    if (t.dueDate && new Date(t.dueDate) < new Date()) return true;
    if (t.createdAt && Date.now() - new Date(t.createdAt).getTime() > 24 * 60 * 60 * 1000) return true;
    return false;
  });
  const highP = tasks.filter((t) => t.userPriority >= 4 && t.status !== "Completed");
  const urgent = tasks.filter((t) => (t.contextNote ?? "").includes("urgent") && t.status !== "Completed");
  const activeGoals = goals.filter((g) => g.status === "Active");
  const avgCircle = circles.length === 0 ? 0 : Math.round(circles.reduce((s, c) => s + c.progressPercent, 0) / circles.length);
  const weakCircles = circles.filter((c) => c.progressPercent < 25).sort((a, b) => a.progressPercent - b.progressPercent);

  // Completion rate
  if (pct >= 80) insights.push({ icon: "🏆", title: "إنجاز ممتاز!", body: `نسبة إنجازك ${pct}%. ما شاء الله، استمر على هذا المستوى.`, type: "success" });
  else if (pct >= 50) insights.push({ icon: "📊", title: "أداء جيد", body: `نسبة إنجازك ${pct}%. يمكنك الوصول لأكثر بتقليل المشتتات.`, type: "info" });
  else if (total > 0) insights.push({ icon: "⚠️", title: "تحتاج تركيز", body: `نسبة إنجازك ${pct}% فقط. ابدأ بأسهل مهمة لبناء الزخم.`, type: "warning" });

  // Overdue
  if (overdue.length > 0) insights.push({ icon: "⏰", title: `${overdue.length} مهمة متأخرة`, body: `المتأخرة: ${overdue.slice(0, 3).map((t) => t.title).join("، ")}${overdue.length > 3 ? "..." : ""}. أعد جدولتها أو ألغِ ما لا تحتاجه.`, type: "warning" });

  // Urgent
  if (urgent.length > 0) insights.push({ icon: "🔴", title: `${urgent.length} مهمة ملحة`, body: `أشخاص ينتظرون منك. ابدأ بها أولاً.`, type: "warning" });

  // High priority
  if (highP.length > 3) insights.push({ icon: "🎯", title: "أولويات كثيرة", body: `لديك ${highP.length} مهمة عالية الأولوية. ركّز على أهم 3 فقط اليوم.`, type: "idea" });

  // Goals
  if (activeGoals.length > 5) insights.push({ icon: "📋", title: "مشاريع كثيرة", body: `${activeGoals.length} مشروع نشط. فكّر في إيقاف بعضها مؤقتاً.`, type: "idea" });
  else if (activeGoals.length === 0 && total > 0) insights.push({ icon: "💡", title: "بدون مشاريع", body: "كل مهامك مستقلة. اربطها بمشاريع لتتبع التقدم.", type: "idea" });

  // Circle balance
  if (weakCircles.length > 0) {
    insights.push({ icon: "⚖️", title: "خلل في التوازن", body: `الأدوار الضعيفة: ${weakCircles.slice(0, 3).map((c) => `${c.name} (${c.progressPercent}%)`).join("، ")}. خصص لها وقتاً.`, type: "warning" });
  }
  if (avgCircle >= 60) insights.push({ icon: "🌟", title: "توازن جيد", body: `متوسط التوازن ${avgCircle}% عبر ${circles.length} دائرة. أحسنت.`, type: "success" });

  // Work-life balance
  const workTasks = tasks.filter((t) => (t.contextNote ?? "").includes("work")).length;
  const personalTasks = total - workTasks;
  if (workTasks > 0 && personalTasks === 0) insights.push({ icon: "🏠", title: "كل مهامك عمل", body: "لا توجد مهام شخصية. لا تنسَ نفسك وأسرتك.", type: "idea" });

  // Deep work
  const deepTasks = tasks.filter((t) => t.cognitiveLoad === "Deep" && t.status !== "Completed").length;
  if (deepTasks > 2) insights.push({ icon: "🧠", title: "مهام عميقة", body: `${deepTasks} مهام تحتاج تركيز عميق. خصص لها أول جلسة صباحية.`, type: "info" });

  // General tips
  insights.push({ icon: "🕌", title: "نصيحة", body: "البركة في البكور. ابدأ يومك بعد صلاة الفجر.", type: "info" });
  insights.push({ icon: "📝", title: "فرصة تطوير", body: "راجع مهامك المكتملة أسبوعياً لتعرف أنماط إنتاجيتك.", type: "idea" });

  return insights;
}

const TYPE_STYLES: Record<string, { bg: string; border: string; text: string }> = {
  success: { bg: "bg-green-50", border: "border-green-200", text: "text-green-800" },
  warning: { bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-800" },
  info:    { bg: "bg-blue-50",  border: "border-blue-200",  text: "text-blue-800"  },
  idea:    { bg: "bg-purple-50", border: "border-purple-200", text: "text-purple-800" },
};

export default function AIPage() {
  const [insights, setInsights] = useState<Insight[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState("");

  const generateReport = useCallback(async () => {
    setLoading(true);
    try {
      const [tasks, goals, circles] = await Promise.all([getTasks(), getGoals(), getCircles()]);
      setInsights(analyze(tasks, goals, circles));
      setLastUpdate(new Date().toLocaleTimeString("ar-SA", { hour: "2-digit", minute: "2-digit" }));
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { generateReport(); }, [generateReport]);

  return (
    <main className="flex-1 overflow-y-auto" style={{ background: "var(--bg)" }}>
      <header className="sticky top-0 z-20 bg-white/80 backdrop-blur border-b border-gray-200 px-8 py-4 pr-16 md:pr-8">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-[#16213E] font-bold text-lg">التقرير الذكي</h2>
            <p className="text-[#6B7280] text-xs">تحليل شامل وتوصيات بناءً على بياناتك {lastUpdate && `· آخر تحديث ${lastUpdate}`}</p>
          </div>
          <button onClick={generateReport} disabled={loading}
            className="px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: "linear-gradient(135deg, #2C2C54, #D4AF37)" }}>
            {loading ? "جارٍ التحليل..." : "🔄 تحديث"}
          </button>
        </div>
      </header>

      <div className="px-8 py-6 space-y-4">
        {loading && (
          <div className="text-center py-16">
            <div className="w-16 h-16 rounded-full bg-[#D4AF37]/10 flex items-center justify-center mx-auto mb-4 text-2xl animate-pulse">🤖</div>
            <p className="text-[#6B7280] text-sm animate-pulse">يحلل بياناتك...</p>
          </div>
        )}

        {!loading && insights.map((insight, i) => {
          const style = TYPE_STYLES[insight.type];
          return (
            <div key={i} className={`rounded-xl p-5 border ${style.bg} ${style.border} fade-up`} style={{ animationDelay: `${i * 80}ms` }}>
              <div className="flex items-start gap-3">
                <span className="text-2xl flex-shrink-0">{insight.icon}</span>
                <div>
                  <p className={`font-bold text-sm ${style.text}`}>{insight.title}</p>
                  <p className={`text-xs mt-1 leading-relaxed ${style.text} opacity-80`}>{insight.body}</p>
                </div>
              </div>
            </div>
          );
        })}

        <div className="pb-4"><GeometricDivider /></div>
      </div>
    </main>
  );
}
