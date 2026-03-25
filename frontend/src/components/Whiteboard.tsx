"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  addEdge,
  applyNodeChanges,
  applyEdgeChanges,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type NodeTypes,
  Handle,
  Position,
  NodeResizer,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";

/* ─── Custom Nodes ───────────────────────────────────────────────────────── */

function StickyNote({ id, data }: { id: string; data: { label: string; color: string; onChange: (id: string, text: string) => void } }) {
  return (
    <div className="relative" style={{ minWidth: 140, minHeight: 100 }}>
      <NodeResizer color={data.color} minWidth={120} minHeight={80} />
      <Handle type="target" position={Position.Top} />
      <div className="rounded-xl p-3 shadow-md w-full h-full" style={{ background: data.color, border: `2px solid ${data.color}dd` }}>
        <textarea
          value={data.label}
          onChange={(e) => data.onChange(id, e.target.value)}
          className="w-full h-full bg-transparent text-xs resize-none focus:outline-none"
          style={{ color: "#1A1830", minHeight: 60 }}
          placeholder="اكتب ملاحظة..."
        />
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function ShapeRect({ id, data }: { id: string; data: { label: string; color: string; onChange: (id: string, text: string) => void } }) {
  return (
    <div className="relative" style={{ minWidth: 120, minHeight: 60 }}>
      <NodeResizer color={data.color} minWidth={100} minHeight={50} />
      <Handle type="target" position={Position.Top} />
      <div className="rounded-lg border-2 p-3 flex items-center justify-center w-full h-full"
        style={{ borderColor: data.color, background: `${data.color}10` }}>
        <input value={data.label} onChange={(e) => data.onChange(id, e.target.value)}
          className="bg-transparent text-xs text-center w-full focus:outline-none font-medium"
          style={{ color: "var(--text, #1A1830)" }}
          placeholder="نص..." />
      </div>
      <Handle type="source" position={Position.Bottom} />
      <Handle type="source" position={Position.Right} id="right" />
      <Handle type="target" position={Position.Left} id="left" />
    </div>
  );
}

function ShapeCircle({ id, data }: { id: string; data: { label: string; color: string; onChange: (id: string, text: string) => void } }) {
  return (
    <div className="relative" style={{ minWidth: 100, minHeight: 100 }}>
      <Handle type="target" position={Position.Top} />
      <div className="rounded-full border-2 flex items-center justify-center"
        style={{ width: 100, height: 100, borderColor: data.color, background: `${data.color}10` }}>
        <input value={data.label} onChange={(e) => data.onChange(id, e.target.value)}
          className="bg-transparent text-[10px] text-center w-16 focus:outline-none font-medium"
          style={{ color: "var(--text, #1A1830)" }}
          placeholder="نص..." />
      </div>
      <Handle type="source" position={Position.Bottom} />
    </div>
  );
}

function TextNode({ id, data }: { id: string; data: { label: string; onChange: (id: string, text: string) => void } }) {
  return (
    <div style={{ minWidth: 80 }}>
      <Handle type="target" position={Position.Top} style={{ opacity: 0 }} />
      <input value={data.label} onChange={(e) => data.onChange(id, e.target.value)}
        className="bg-transparent text-sm focus:outline-none font-medium"
        style={{ color: "var(--text, #1A1830)" }}
        placeholder="نص..." />
      <Handle type="source" position={Position.Bottom} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = {
  sticky: StickyNote,
  shapeRect: ShapeRect,
  shapeCircle: ShapeCircle,
  textNode: TextNode,
};

/* ─── Colors (Madar palette) ─────────────────────────────────────────────── */

const STICKY_COLORS = ["#FEF3C7", "#DBEAFE", "#FCE7F3", "#D1FAE5", "#EDE9FE", "#FEE2E2"];
const SHAPE_COLOR = "#5E5495";

/* ─── Whiteboard Component ───────────────────────────────────────────────── */

interface WhiteboardProps {
  entityType: "job" | "project" | "personal";
  entityId: string;
  entityName: string;
}

export default function Whiteboard({ entityType, entityId, entityName }: WhiteboardProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const undoStack = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const redoStack = useRef<{ nodes: Node[]; edges: Edge[] }[]>([]);
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const dirty = useRef(false);
  const colorIdx = useRef(0);

  // Load or auto-create board
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const { data: boards } = await api.get(`/api/boards?entityType=${entityType}&entityId=${entityId}`);
        if (boards.length > 0) {
          const b = boards[0];
          setBoardId(b.id);
          if (b.data) {
            try {
              const parsed = JSON.parse(b.data);
              setNodes(parsed.nodes ?? []);
              setEdges(parsed.edges ?? []);
            } catch { /* invalid json, start fresh */ }
          }
        } else {
          // Auto-create
          const { data: created } = await api.post("/api/boards", {
            name: entityName,
            entityType,
            entityId,
          });
          setBoardId(created.id);
        }
      } catch { /* offline or error */ }
      setLoading(false);
    })();
  }, [entityType, entityId, entityName]);

  // Auto-save every 30s
  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (dirty.current && boardId) {
        saveBoard();
      }
    }, 30_000);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  // Save on unmount
  useEffect(() => {
    return () => { if (dirty.current && boardId) saveBoard(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  async function saveBoard() {
    if (!boardId) return;
    setSaving(true);
    dirty.current = false;
    try {
      await api.put(`/api/boards/${boardId}`, {
        data: JSON.stringify({ nodes, edges }),
      });
    } catch { dirty.current = true; }
    setSaving(false);
  }

  function pushUndo() {
    undoStack.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    if (undoStack.current.length > 50) undoStack.current.shift();
    redoStack.current = [];
  }

  function undo() {
    const prev = undoStack.current.pop();
    if (!prev) return;
    redoStack.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    setNodes(prev.nodes);
    setEdges(prev.edges);
    dirty.current = true;
  }

  function redo() {
    const next = redoStack.current.pop();
    if (!next) return;
    undoStack.current.push({ nodes: structuredClone(nodes), edges: structuredClone(edges) });
    setNodes(next.nodes);
    setEdges(next.edges);
    dirty.current = true;
  }

  const onNodeLabelChange = useCallback((nodeId: string, text: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label: text } } : n));
    dirty.current = true;
  }, []);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    setNodes((nds) => applyNodeChanges(changes, nds));
    dirty.current = true;
  }, []);

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    setEdges((eds) => applyEdgeChanges(changes, eds));
    dirty.current = true;
  }, []);

  const onConnect: OnConnect = useCallback((connection) => {
    pushUndo();
    setEdges((eds) => addEdge({ ...connection, type: "smoothstep", animated: true, style: { stroke: "#C9A84C" } }, eds));
    dirty.current = true;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges]);

  // Inject onChange callback into all node data
  const nodesWithCallbacks = nodes.map((n) => ({
    ...n,
    data: { ...n.data, onChange: onNodeLabelChange },
  }));

  /* ─── Add tools ─── */

  function getCenter(): { x: number; y: number } {
    return { x: 200 + Math.random() * 200, y: 150 + Math.random() * 200 };
  }

  function addSticky() {
    pushUndo();
    const color = STICKY_COLORS[colorIdx.current % STICKY_COLORS.length];
    colorIdx.current++;
    const pos = getCenter();
    setNodes((nds) => [...nds, {
      id: `sticky_${Date.now()}`,
      type: "sticky",
      position: pos,
      data: { label: "", color },
      style: { width: 180, height: 120 },
    }]);
    dirty.current = true;
  }

  function addRect() {
    pushUndo();
    const pos = getCenter();
    setNodes((nds) => [...nds, {
      id: `rect_${Date.now()}`,
      type: "shapeRect",
      position: pos,
      data: { label: "", color: SHAPE_COLOR },
      style: { width: 160, height: 70 },
    }]);
    dirty.current = true;
  }

  function addCircle() {
    pushUndo();
    const pos = getCenter();
    setNodes((nds) => [...nds, {
      id: `circle_${Date.now()}`,
      type: "shapeCircle",
      position: pos,
      data: { label: "", color: "#C9A84C" },
    }]);
    dirty.current = true;
  }

  function addText() {
    pushUndo();
    const pos = getCenter();
    setNodes((nds) => [...nds, {
      id: `text_${Date.now()}`,
      type: "textNode",
      position: pos,
      data: { label: "نص جديد" },
    }]);
    dirty.current = true;
  }

  // Keyboard shortcuts
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || (e.key === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
      if ((e.ctrlKey || e.metaKey) && e.key === "s") { e.preventDefault(); saveBoard(); }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, edges, boardId]);

  if (loading) return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "var(--bg)" }}>
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-3 border-[#5E5495] border-t-transparent rounded-full animate-spin" />
        <p className="text-sm" style={{ color: "var(--muted)" }}>جارٍ تحميل السبورة...</p>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col h-[calc(100vh-140px)]" style={{ direction: "ltr" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b flex-wrap"
        style={{ background: "var(--card, #fff)", borderColor: "var(--card-border, #E2D5B0)" }}>
        <button onClick={addSticky} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition hover:opacity-80"
          style={{ background: "#FEF3C7", color: "#92400E", border: "1px solid #FDE68A" }}>
          📌 ملاحظة
        </button>
        <button onClick={addRect} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition hover:opacity-80"
          style={{ background: "#5E549515", color: "#5E5495", border: "1px solid #5E549530" }}>
          ▭ مستطيل
        </button>
        <button onClick={addCircle} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition hover:opacity-80"
          style={{ background: "#C9A84C15", color: "#C9A84C", border: "1px solid #C9A84C30" }}>
          ○ دائرة
        </button>
        <button onClick={addText} className="px-3 py-1.5 rounded-lg text-[11px] font-medium transition hover:opacity-80"
          style={{ background: "var(--bg, #F8F6F0)", color: "var(--text)", border: "1px solid var(--card-border)" }}>
          T نص
        </button>

        <div className="h-5 w-px mx-1" style={{ background: "var(--card-border)" }} />

        <button onClick={undo} title="Ctrl+Z" className="px-2 py-1.5 rounded-lg text-[11px] transition hover:bg-gray-100"
          style={{ color: undoStack.current.length ? "var(--text)" : "var(--muted)" }}>
          ↩️
        </button>
        <button onClick={redo} title="Ctrl+Y" className="px-2 py-1.5 rounded-lg text-[11px] transition hover:bg-gray-100"
          style={{ color: redoStack.current.length ? "var(--text)" : "var(--muted)" }}>
          ↪️
        </button>

        <div className="flex-1" />

        <span className="text-[10px]" style={{ color: "var(--muted)" }}>
          {saving ? "جارٍ الحفظ..." : dirty.current ? "غير محفوظ" : "✓ محفوظ"}
        </span>
        <button onClick={saveBoard}
          className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-white transition hover:opacity-90"
          style={{ background: "linear-gradient(135deg, #5E5495, #C9A84C)" }}>
          💾 حفظ
        </button>
      </div>

      {/* Canvas */}
      <div className="flex-1">
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          snapToGrid
          snapGrid={[15, 15]}
          defaultEdgeOptions={{ type: "smoothstep", animated: true, style: { stroke: "#C9A84C", strokeWidth: 2 } }}
          deleteKeyCode="Delete"
          onNodeDragStart={pushUndo}
          proOptions={{ hideAttribution: true }}
        >
          <Background gap={20} size={1.5} color="#d0ccc4" />
          <Controls position="bottom-left" />
          <MiniMap
            nodeStrokeColor="#5E5495"
            nodeColor={(n) => n.type === "sticky" ? (n.data?.color as string ?? "#FEF3C7") : "#5E549530"}
            style={{ background: "#F8F6F0", borderRadius: 12, border: "1px solid #E2D5B0" }}
          />
        </ReactFlow>
      </div>
    </div>
  );
}
