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
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { api } from "@/lib/api";

/* ─── Mind-map node palette ────────────────────────────────────────────── */

const LEVEL_COLORS = [
  "#2D6B9E", // root
  "#5E5495",
  "#D4AF37",
  "#3D8C5A",
  "#DC2626",
  "#0F3460",
];

/* ─── Mind-map branch node ─────────────────────────────────────────────── */

interface BranchData {
  label: string;
  level: number;
  onChange: (id: string, text: string) => void;
  onAddChild: (id: string) => void;
  onDelete: (id: string) => void;
  [key: string]: unknown;
}

function MindBranch({ id, data }: { id: string; data: BranchData }) {
  const color = LEVEL_COLORS[Math.min(data.level, LEVEL_COLORS.length - 1)];
  const isRoot = data.level === 0;

  return (
    <div className="relative group">
      <Handle type="target" position={Position.Left} style={{ opacity: 0 }} />
      <div
        className="flex items-center gap-2 rounded-full shadow-md transition"
        style={{
          background: isRoot ? color : "#fff",
          border: `2px solid ${color}`,
          padding: isRoot ? "10px 18px" : "8px 14px",
          minWidth: isRoot ? 140 : 110,
        }}
      >
        <input
          value={data.label}
          onChange={(e) => data.onChange(id, e.target.value)}
          placeholder="فكرة..."
          className="bg-transparent text-center font-bold focus:outline-none w-full"
          style={{
            color: isRoot ? "#fff" : color,
            fontSize: isRoot ? 14 : 12,
          }}
        />
      </div>

      {/* Floating buttons on hover */}
      <div className="absolute -top-2 left-1/2 -translate-x-1/2 flex gap-1 opacity-0 group-hover:opacity-100 transition">
        <button
          onClick={(e) => { e.stopPropagation(); data.onAddChild(id); }}
          className="w-5 h-5 rounded-full text-white text-[10px] font-bold shadow hover:scale-110 transition"
          style={{ background: color }}
          title="إضافة فرع"
        >
          +
        </button>
        {!isRoot && (
          <button
            onClick={(e) => { e.stopPropagation(); data.onDelete(id); }}
            className="w-5 h-5 rounded-full text-white text-[10px] font-bold shadow hover:scale-110 transition"
            style={{ background: "#DC2626" }}
            title="حذف"
          >
            ×
          </button>
        )}
      </div>

      <Handle type="source" position={Position.Right} style={{ opacity: 0 }} />
    </div>
  );
}

const nodeTypes: NodeTypes = { branch: MindBranch };

/* ─── MindMap component ────────────────────────────────────────────────── */

interface MindMapProps {
  entityType: "jobMindmap" | "roleMindmap" | "personalMindmap";
  entityId: string;
  entityName: string;
}

export default function MindMap({ entityType, entityId, entityName }: MindMapProps) {
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [boardId, setBoardId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const autoSaveTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const dirty = useRef(false);

  /* ─── Handlers ────────────────────────────────────────────────────── */

  const onNodeLabelChange = useCallback((nodeId: string, text: string) => {
    setNodes((nds) => nds.map((n) => n.id === nodeId ? { ...n, data: { ...n.data, label: text } } : n));
    dirty.current = true;
  }, []);

  // Add a child node + edge atomically in a single render cycle.
  const addChildAtomic = useCallback((parentId: string) => {
    let newNodeId = "";
    setNodes((nds) => {
      const parent = nds.find(n => n.id === parentId);
      if (!parent) return nds;
      const parentLevel = (parent.data as unknown as BranchData).level ?? 0;
      const siblingCount = nds.filter(n => (n.data as { parentId?: string }).parentId === parentId).length;
      newNodeId = `n_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const newNode: Node = {
        id: newNodeId,
        type: "branch",
        position: {
          x: parent.position.x + 240,
          y: parent.position.y + (siblingCount - 0.5) * 80,
        },
        data: {
          label: "",
          level: parentLevel + 1,
          parentId: parentId,
        },
      };
      return [...nds, newNode];
    });
    setEdges((eds) => {
      if (!newNodeId) return eds;
      const color = LEVEL_COLORS[Math.min(1, LEVEL_COLORS.length - 1)];
      return [...eds, {
        id: `e_${parentId}_${newNodeId}`,
        source: parentId,
        target: newNodeId,
        type: "smoothstep",
        animated: false,
        style: { stroke: color, strokeWidth: 2 },
      }];
    });
    dirty.current = true;
  }, []);

  const onDeleteNode = useCallback((nodeId: string) => {
    // Collect descendants
    setNodes((nds) => {
      const toDelete = new Set<string>([nodeId]);
      let added = true;
      while (added) {
        added = false;
        for (const n of nds) {
          const pid = (n.data as { parentId?: string }).parentId;
          if (pid && toDelete.has(pid) && !toDelete.has(n.id)) {
            toDelete.add(n.id);
            added = true;
          }
        }
      }
      setEdges((eds) => eds.filter(e => !toDelete.has(e.source) && !toDelete.has(e.target)));
      return nds.filter(n => !toDelete.has(n.id));
    });
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
    setEdges((eds) => addEdge({ ...connection, type: "smoothstep", style: { stroke: "#5E5495", strokeWidth: 2 } }, eds));
    dirty.current = true;
  }, []);

  /* ─── Load / save board ──────────────────────────────────────────── */

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
            } catch { /* invalid json */ }
          }
        } else {
          const { data: created } = await api.post("/api/boards", {
            name: entityName,
            entityType,
            entityId,
          });
          setBoardId(created.id);
          // Seed a root node
          const rootId = `root_${Date.now()}`;
          setNodes([{
            id: rootId,
            type: "branch",
            position: { x: 300, y: 200 },
            data: { label: entityName, level: 0 },
          }]);
          dirty.current = true;
        }
      } catch { /* offline */ }
      setLoading(false);
    })();
  }, [entityType, entityId, entityName]);

  const saveBoard = useCallback(async () => {
    if (!boardId) return;
    setSaving(true);
    dirty.current = false;
    try {
      // Strip callbacks before saving
      const cleanNodes = nodes.map(n => ({
        ...n,
        data: {
          label: (n.data as { label?: string }).label ?? "",
          level: (n.data as { level?: number }).level ?? 0,
          parentId: (n.data as { parentId?: string }).parentId,
        },
      }));
      await api.put(`/api/boards/${boardId}`, {
        data: JSON.stringify({ nodes: cleanNodes, edges }),
      });
    } catch { dirty.current = true; }
    setSaving(false);
  }, [boardId, nodes, edges]);

  useEffect(() => {
    autoSaveTimer.current = setInterval(() => {
      if (dirty.current && boardId) saveBoard();
    }, 15_000);
    return () => { if (autoSaveTimer.current) clearInterval(autoSaveTimer.current); };
  }, [boardId, saveBoard]);

  useEffect(() => {
    return () => { if (dirty.current && boardId) saveBoard(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [boardId]);

  /* ─── Inject callbacks into nodes ────────────────────────────────── */

  const nodesWithCallbacks = nodes.map((n) => ({
    ...n,
    data: {
      ...n.data,
      onChange: onNodeLabelChange,
      onAddChild: addChildAtomic,
      onDelete: onDeleteNode,
    },
  }));

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="w-8 h-8 border-3 border-[#2D6B9E] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  return (
    <div className="rounded-2xl border overflow-hidden" style={{ background: "var(--card)", borderColor: "var(--card-border)", height: "calc(100vh - 220px)" }}>
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b" style={{ borderColor: "var(--card-border)", background: "var(--bg)" }}>
        <span className="text-xs font-bold" style={{ color: "var(--text)" }}>🧠 الخريطة الذهنية</span>
        <span className="text-[10px]" style={{ color: "var(--muted)" }}>حرّك العقد بالسحب — اضغط + لإضافة فرع</span>
        <div className="flex-1" />
        <button
          onClick={saveBoard}
          disabled={saving}
          className="px-3 py-1.5 rounded-lg text-[10px] font-bold text-white transition disabled:opacity-50"
          style={{ background: "#2D6B9E" }}
        >
          {saving ? "جارٍ الحفظ..." : "💾 حفظ"}
        </button>
      </div>

      {/* Canvas */}
      <div style={{ width: "100%", height: "calc(100% - 40px)" }}>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          nodeTypes={nodeTypes}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          proOptions={{ hideAttribution: true }}
        >
          <Background color="#C9A84C20" gap={20} />
          <Controls />
          <MiniMap nodeColor={(n) => LEVEL_COLORS[Math.min((n.data as { level?: number }).level ?? 0, LEVEL_COLORS.length - 1)]} />
        </ReactFlow>
      </div>
    </div>
  );
}
