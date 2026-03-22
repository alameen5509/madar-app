"use client";
import { use, useState } from "react";
import JobPageShell, { useJobMeta } from "@/components/JobPageShell";

interface Lesson { title: string; content?: string; date?: string; category?: string; }

function normalize(l: string | Lesson): Lesson {
  if (typeof l === "string") return { title: l, date: new Date().toISOString().slice(0, 10), category: "personal" };
  return l;
}

const CATS = [
  { key: "technical",  label: "تقني",      icon: "💻", color: "#2D6B9E" },
  { key: "management", label: "إداري",     icon: "📋", color: "#5E5495" },
  { key: "human",      label: "إنساني",    icon: "🤝", color: "#3D8C5A" },
  { key: "strategic",  label: "استراتيجي", icon: "🎯", color: "#D4AF37" },
  { key: "personal",   label: "شخصي",      icon: "💡", color: "#DC2626" },
];

export default function LessonsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { meta, setMeta } = useJobMeta(id);
  const [showAdd, setShowAdd] = useState(false);
  const [fTitle, setFTitle] = useState("");
  const [fContent, setFContent] = useState("");
  const [fCat, setFCat] = useState("personal");
  const [filterCat, setFilterCat] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const lessons: Lesson[] = meta.lessons.map(normalize);

  function save(updated: Lesson[]) {
    setMeta({ ...meta, lessons: updated });
  }

  function add() {
    if (!fTitle.trim()) return;
    save([{ title: fTitle.trim(), content: fContent.trim() || undefined, date: new Date().toISOString().slice(0, 10), category: fCat }, ...lessons]);
    setFTitle(""); setFContent(""); setFCat("personal"); setShowAdd(false);
  }

  function remove(i: number) {
    const arr = [...lessons]; arr.splice(i, 1); save(arr);
  }

  // Filter + search
  const filtered = lessons.filter(l => {
    if (filterCat && l.category !== filterCat) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!l.title.toLowerCase().includes(q) && !(l.content ?? "").toLowerCase().includes(q)) return false;
    }
    return true;
  });

  // Group by category
  const grouped = CATS.map(c => ({
    ...c,
    items: filtered.filter(l => l.category === c.key),
  })).filter(g => g.items.length > 0);

  // Counts per category
  const catCounts = CATS.map(c => ({ ...c, count: lessons.filter(l => l.category === c.key).length }));

  return (
    <JobPageShell jobId={id}>
      <div className="space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold" style={{ color: "var(--text)" }}>الدروس المستفادة</p>
            <p className="text-[10px]" style={{ color: "var(--muted)" }}>{lessons.length} درس مسجل</p>
          </div>
          <button onClick={() => setShowAdd(!showAdd)}
            className="px-4 py-2 rounded-xl text-xs font-bold text-white transition hover:opacity-90"
            style={{ background: "linear-gradient(135deg, #2D6B9E, #C9A84C)" }}>
            + درس جديد
          </button>
        </div>

        {/* Add form */}
        {showAdd && (
          <div className="rounded-2xl p-5 border-2 space-y-3 fade-up" style={{ borderColor: "#5E549540", background: "var(--card)" }}>
            <div className="flex items-center justify-between mb-1">
              <p className="text-xs font-bold" style={{ color: "#5E5495" }}>درس مستفاد جديد</p>
              <div className="flex gap-2">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1 rounded-lg text-[10px] text-[#6B7280] bg-gray-100">إلغاء</button>
                <button onClick={add} className="px-3 py-1 rounded-lg text-[10px] font-bold text-white" style={{ background: "#5E5495" }}>إضافة</button>
              </div>
            </div>
            <input value={fTitle} onChange={e => setFTitle(e.target.value)} placeholder="عنوان الدرس *"
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} autoFocus />
            <textarea value={fContent} onChange={e => setFContent(e.target.value)} placeholder="تفاصيل الدرس — ماذا تعلمت وكيف ستطبقه؟" rows={3}
              className="w-full px-4 py-2 rounded-xl border text-xs resize-none focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--bg)", color: "var(--text)" }} />
            <div className="flex gap-1.5 flex-wrap">
              {CATS.map(c => (
                <button key={c.key} onClick={() => setFCat(c.key)}
                  className="px-3 py-1.5 rounded-xl text-[10px] font-semibold transition"
                  style={{ background: fCat === c.key ? c.color : "#F3F4F6", color: fCat === c.key ? "#fff" : "#6B7280" }}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Search + filters */}
        {lessons.length > 0 && (
          <div className="space-y-2">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="🔍 بحث في الدروس…"
              className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none"
              style={{ borderColor: "var(--card-border)", background: "var(--card)", color: "var(--text)" }} />
            <div className="flex gap-1.5 flex-wrap">
              <button onClick={() => setFilterCat(null)}
                className="px-2.5 py-1 rounded-lg text-[9px] font-semibold transition"
                style={{ background: !filterCat ? "#2D6B9E" : "#F3F4F6", color: !filterCat ? "#fff" : "#6B7280" }}>
                الكل ({lessons.length})
              </button>
              {catCounts.filter(c => c.count > 0).map(c => (
                <button key={c.key} onClick={() => setFilterCat(filterCat === c.key ? null : c.key)}
                  className="px-2.5 py-1 rounded-lg text-[9px] font-semibold transition"
                  style={{ background: filterCat === c.key ? c.color : "#F3F4F6", color: filterCat === c.key ? "#fff" : "#6B7280" }}>
                  {c.icon} {c.label} ({c.count})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Grouped lessons */}
        {grouped.map(g => (
          <div key={g.key}>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm">{g.icon}</span>
              <p className="text-xs font-bold" style={{ color: g.color }}>{g.label} ({g.items.length})</p>
            </div>
            <div className="space-y-2">
              {g.items.map((l, li) => {
                const realIdx = lessons.indexOf(l);
                return (
                  <div key={li} className="rounded-2xl p-4 border transition-all hover:shadow-sm"
                    style={{ background: "var(--card)", borderColor: "var(--card-border)", borderRight: `3px solid ${g.color}` }}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[9px] px-2 py-0.5 rounded-full font-bold"
                            style={{ background: g.color + "15", color: g.color }}>{g.icon} {g.label}</span>
                          {l.date && <span className="text-[9px]" style={{ color: "var(--muted)" }}>{l.date}</span>}
                        </div>
                        <p className="text-sm font-bold mb-1" style={{ color: "var(--text)" }}>{l.title}</p>
                        {l.content && (
                          <p className="text-[11px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--muted)" }}>{l.content}</p>
                        )}
                      </div>
                      <button onClick={() => remove(realIdx)}
                        className="text-red-300 hover:text-red-500 text-xs transition flex-shrink-0">✕</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}

        {filtered.length === 0 && lessons.length > 0 && (
          <p className="text-center py-6 text-xs" style={{ color: "var(--muted)" }}>لا توجد دروس تطابق البحث</p>
        )}

        {lessons.length === 0 && !showAdd && (
          <div className="text-center py-12">
            <p className="text-3xl mb-3">📝</p>
            <p className="text-sm font-semibold mb-1" style={{ color: "var(--text)" }}>لا توجد دروس مستفادة</p>
            <p className="text-xs" style={{ color: "var(--muted)" }}>سجّل ما تتعلمه لتستفيد منه لاحقاً</p>
          </div>
        )}
      </div>
    </JobPageShell>
  );
}
