import { useState, useEffect, useCallback, useRef } from "react";
import { useUiStore } from "../../store/uiStore";
import { useKanbanStore } from "../../store/kanbanStore";
import { useAgentStore } from "../../store/agentStore";
import { useTimelineStore } from "../../store/timelineStore";
import { useSocket } from "../../hooks/useSocket";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { renderTaggedText, renderChainRefText } from "../../utils/TagRenderer";
import { useContextChain, extractChainRefs } from "../../hooks/useContextChain";
import ContextChainPanel from "./ContextChainPanel";
const WORKFLOW_STEPS = [
  { step: 0, label: "\uC5D4\uC9C4 \uAC00\uB3D9", icon: "rocket_launch", color: "#b4c5ff" },
  { step: 1, label: "Phase 1 \uBCD1\uB82C \uC0DD\uC131", icon: "fork_right", color: "#4ade80" },
  { step: 2, label: "Phase 2 \uD569\uC131/\uAC80\uD1A0", icon: "merge", color: "#fbbf24" },
  { step: 3, label: "\uC644\uB8CC", icon: "check_circle", color: "#4ade80" }
];
const TEAM_AGENTS = {
  team_A: { img: "NOVA", vid: "LILY", brain: "OLLIE", protocol: "\uC801\uB300\uC801 \uAC80\uD1A0" },
  team_B: { img: "LUMI", vid: "PICO", brain: "LUNA", protocol: "CKS \uD611\uB825" }
};
const SERVER_URL_TL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
function WorkflowTimeline({ taskId }) {
  const logs = useTimelineStore((s) => s.timelines);
  const [bridgeWaiting, setBridgeWaiting] = useState([]);
  const wfLogs = logs.filter(
    (l) => String(l.taskId) === String(taskId) && l.step !== void 0
  );
  const currentStep = wfLogs.length > 0 ? Math.max(...wfLogs.map((l) => l.step ?? 0)) : -1;
  const teamLog = wfLogs.find((l) => l.message?.includes("team_"));
  const teamId = teamLog?.message?.includes("team_A") ? "team_A" : "team_B";
  const agents = TEAM_AGENTS[teamId] || TEAM_AGENTS["team_B"];
  const phase1Logs = wfLogs.filter((l) => l.step === 1);
  const imgDone = phase1Logs.some((l) => l.agentId === agents.img.toLowerCase() && l.message?.includes("\uC644\uB8CC"));
  const vidDone = phase1Logs.some((l) => l.agentId === agents.vid.toLowerCase() && l.message?.includes("\uC644\uB8CC"));
  const imgActive = phase1Logs.some((l) => l.agentId === agents.img.toLowerCase());
  const vidActive = phase1Logs.some((l) => l.agentId === agents.vid.toLowerCase());
  const phase2Logs = wfLogs.filter((l) => l.step === 2);
  const brainDone = phase2Logs.some((l) => l.message?.includes("\uC644\uB8CC"));
  const brainActive = phase2Logs.length > 0;
  useEffect(() => {
    if (currentStep !== 2 || brainDone) {
      setBridgeWaiting([]);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`${SERVER_URL_TL}/api/bridge/status`);
        const data = await res.json();
        if (!cancelled) setBridgeWaiting(data.waiting || []);
      } catch {
      }
    };
    poll();
    const id = setInterval(poll, 3e3);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [currentStep, brainDone]);
  if (currentStep < 0) return null;
  const AGENT_LABEL = { prime: "PRIME (Opus)", nexus: "NEXUS (GPT)" };
  return /* @__PURE__ */ React.createElement("div", { style: {
    background: "linear-gradient(135deg, rgba(100,135,242,0.06), rgba(74,222,128,0.04))",
    border: "1px solid rgba(180,197,255,0.15)",
    borderRadius: "14px",
    padding: "1rem 1.1rem",
    marginBottom: "1.25rem"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem", color: "#b4c5ff" } }, "account_tree"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.78rem", fontWeight: 700, color: "#b4c5ff", letterSpacing: "0.08em", fontFamily: "Space Grotesk, sans-serif", textTransform: "uppercase" } }, "3\uC778 \uD611\uC5C5 \uC6CC\uD06C\uD50C\uB85C\uC6B0 \xB7 ", agents.protocol), /* @__PURE__ */ React.createElement("span", { style: { marginLeft: "auto", fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "Space Grotesk, sans-serif" } }, teamId === "team_A" ? "\u26D4 Team A" : "\u{1F319} Team B")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0", marginBottom: "1rem" } }, WORKFLOW_STEPS.map((s, i) => {
    const isDone = currentStep > s.step;
    const isActive = currentStep === s.step;
    return /* @__PURE__ */ React.createElement("div", { key: s.step, style: { display: "flex", alignItems: "center", flex: i < 3 ? 1 : "none" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", alignItems: "center", gap: "0.3rem" } }, /* @__PURE__ */ React.createElement("div", { style: {
      width: "30px",
      height: "30px",
      borderRadius: "50%",
      background: isDone ? s.color : isActive ? "rgba(180,197,255,0.2)" : "rgba(255,255,255,0.05)",
      border: `2px solid ${isDone || isActive ? s.color : "rgba(255,255,255,0.1)"}`,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      boxShadow: isActive ? `0 0 12px ${s.color}55` : "none",
      transition: "all 0.3s ease",
      animation: isActive ? "thinking-glow-pulse 2s ease-in-out infinite" : "none"
    } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: {
      fontSize: "0.9rem",
      color: isDone || isActive ? isDone ? "var(--bg-base)" : s.color : "var(--text-muted)"
    } }, isDone ? "check" : s.icon)), /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: "0.6rem",
      fontWeight: 600,
      color: isDone || isActive ? s.color : "var(--text-muted)",
      fontFamily: "Space Grotesk, sans-serif",
      whiteSpace: "nowrap",
      textAlign: "center",
      letterSpacing: "0.04em"
    } }, s.label)), i < 3 && /* @__PURE__ */ React.createElement("div", { style: {
      flex: 1,
      height: "2px",
      margin: "0 4px",
      marginBottom: "18px",
      background: isDone ? `linear-gradient(to right, ${s.color}, ${WORKFLOW_STEPS[i + 1].color})` : "rgba(255,255,255,0.08)",
      transition: "background 0.4s ease"
    } }));
  })), currentStep >= 1 && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "0.6rem", marginBottom: currentStep >= 2 ? "0.6rem" : 0 } }, [
    { id: agents.img, role: "\u{1F5BC} \uC774\uBBF8\uC9C0", done: imgDone, active: imgActive && !imgDone },
    { id: agents.vid, role: "\u{1F3AC} \uC601\uC0C1", done: vidDone, active: vidActive && !vidDone }
  ].map((ag) => /* @__PURE__ */ React.createElement("div", { key: ag.id, style: {
    flex: 1,
    background: "rgba(0,0,0,0.2)",
    borderRadius: "8px",
    padding: "0.45rem 0.65rem",
    border: `1px solid ${ag.done ? "rgba(74,222,128,0.3)" : ag.active ? "rgba(180,197,255,0.25)" : "rgba(255,255,255,0.07)"}`,
    transition: "border-color 0.3s"
  } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem", marginBottom: "0.3rem" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.72rem", color: "var(--text-secondary)", fontWeight: 600 } }, ag.role), /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: "0.65rem",
    fontWeight: 700,
    fontFamily: "Space Grotesk, sans-serif",
    color: ag.done ? "#4ade80" : ag.active ? "#b4c5ff" : "var(--text-muted)",
    marginLeft: "auto"
  } }, ag.done ? "\u2713 \uC644\uB8CC" : ag.active ? "\u25CF \uC791\uC5C5\uC911" : "\uB300\uAE30")), /* @__PURE__ */ React.createElement("div", { style: { height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: "100%",
    borderRadius: "2px",
    width: ag.done ? "100%" : ag.active ? "60%" : "0%",
    background: ag.done ? "#4ade80" : "var(--brand)",
    transition: "width 0.5s ease"
  } })), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.65rem", color: "var(--text-muted)", marginTop: "0.2rem", fontFamily: "SF Mono, monospace" } }, ag.id)))), currentStep >= 2 && /* @__PURE__ */ React.createElement("div", { style: {
    background: "rgba(0,0,0,0.2)",
    borderRadius: "8px",
    padding: "0.45rem 0.65rem",
    border: `1px solid ${brainDone ? "rgba(74,222,128,0.3)" : brainActive ? "rgba(251,191,36,0.3)" : "rgba(255,255,255,0.07)"}`,
    display: "flex",
    alignItems: "center",
    gap: "0.5rem"
  } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem", color: brainDone ? "#4ade80" : "#fbbf24" } }, brainDone ? "check_circle" : "psychology"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.35rem" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.72rem", fontWeight: 600, color: "var(--text-secondary)" } }, teamId === "team_B" ? "\u{1F319} LUNA" : "\u26D4 OLLIE", " \xB7 ", agents.protocol), /* @__PURE__ */ React.createElement("span", { style: {
    fontSize: "0.65rem",
    fontWeight: 700,
    fontFamily: "Space Grotesk, sans-serif",
    color: brainDone ? "#4ade80" : brainActive ? "#fbbf24" : "var(--text-muted)",
    marginLeft: "auto"
  } }, brainDone ? "\u2713 \uD1B5\uD569 \uC644\uB8CC" : brainActive ? "\u25CF \uBD84\uC11D \uC911" : "\uB300\uAE30")), /* @__PURE__ */ React.createElement("div", { style: { height: "3px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden", marginTop: "0.3rem" } }, /* @__PURE__ */ React.createElement("div", { style: {
    height: "100%",
    borderRadius: "2px",
    width: brainDone ? "100%" : brainActive ? "45%" : "0%",
    background: "#fbbf24",
    transition: "width 0.5s ease"
  } })))), bridgeWaiting.length > 0 && /* @__PURE__ */ React.createElement("div", { style: { marginTop: "0.65rem", display: "flex", flexDirection: "column", gap: "0.4rem" } }, bridgeWaiting.map((b) => {
    const mins = Math.floor(b.elapsedSec / 60);
    const secs = b.elapsedSec % 60;
    const elapsed = mins > 0 ? `${mins}\uBD84 ${secs}\uCD08` : `${secs}\uCD08`;
    return /* @__PURE__ */ React.createElement("div", { key: b.agentKey, style: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      background: b.timedOut ? "rgba(255,82,82,0.07)" : "rgba(251,191,36,0.07)",
      border: `1px solid ${b.timedOut ? "rgba(255,82,82,0.25)" : "rgba(251,191,36,0.25)"}`,
      borderRadius: "8px",
      padding: "0.5rem 0.75rem"
    } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem", color: b.timedOut ? "#ff5449" : "#fbbf24", flexShrink: 0 } }, b.timedOut ? "warning" : "hourglass_top"), /* @__PURE__ */ React.createElement("div", { style: { flex: 1 } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.75rem", fontWeight: 700, color: b.timedOut ? "#ff5449" : "#fbbf24", fontFamily: "Space Grotesk, sans-serif" } }, b.timedOut ? `\u23F0 \uB300\uAE30 \uC2DC\uAC04 \uCD08\uACFC \u2192 Flash Fallback \uC804\uD658 \uC911` : `\u23F3 ${AGENT_LABEL[b.agentKey] || b.agentKey} \u2014 \uB300\uD45C\uB2D8\uC758 \uD2B8\uB9AC\uAC70 \uB300\uAE30 \uC911`), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "1px" } }, b.timedOut ? "5\uBD84 \uCD08\uACFC \u2014 \uC790\uB3D9\uC73C\uB85C Gemini Flash\uAC00 \uB300\uC5ED \uC2E4\uD589\uD569\uB2C8\uB2E4" : `\uACBD\uACFC: ${elapsed} / \uCD5C\uB300 5\uBD84`)), !b.timedOut && /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.68rem", color: "#fbbf24", fontFamily: "SF Mono, monospace", flexShrink: 0 } }, elapsed));
  })));
}
const STATUS_LABEL = {
  PENDING: { text: "\uB300\uAE30 \uC911", color: "var(--text-muted)" },
  in_progress: { text: "\uC9C4\uD589 \uC911", color: "var(--status-active)" },
  REVIEW: { text: "\uC2B9\uC778 \uB300\uAE30", color: "var(--brand)" },
  COMPLETED: { text: "\uC644\uB8CC", color: "var(--brand)" },
  done: { text: "\uC644\uB8CC", color: "var(--brand)" },
  ARCHIVED: { text: "\uC544\uCE74\uC774\uBE0C", color: "#F59E0B" },
  // 주황색
  FAILED: { text: "\uC2E4\uD328", color: "var(--text-muted)" },
  PAUSED: { text: "\uC911\uB2E8\uB428", color: "var(--status-active)" }
};
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const formatModelName = (modelStr, agentMeta = {}) => {
  if (!modelStr) return "";
  const lowerStr = modelStr.toLowerCase();
  let resolvedModel = lowerStr;
  if (lowerStr.startsWith("anti-bridge-")) {
    const agentId = lowerStr.replace("anti-bridge-", "");
    const profileModel = agentMeta[agentId]?.model;
    if (profileModel) {
      resolvedModel = profileModel.toLowerCase();
    }
  }
  const map = {
    "anti-gemini-3.1-pro-high": "Gemini 3.1 Pro",
    "anti-gemini-3.1-pro-low": "Gemini 3.1 Pro",
    "anti-gemini-3-flash": "Gemini 3 Flash",
    "anti-claude-sonnet-4.6-thinking": "Claude Sonnet 4.6",
    "anti-claude-opus-4.6-thinking": "Claude Opus 4.6",
    "anti-gpt-oss-120b": "GPT-OSS 120B",
    "gemini-2.5-flash": "Gemini 2.5 Flash",
    "gemini-2.5-pro": "Gemini 2.5 Pro",
    "gemini-exp-1206": "Gemini Exp 1206",
    // [Bridge 에이전트 매핑] (프로필 모델이 없을 경우 대비 기본 폴백)
    "anti-bridge-nova": "Gemini 3.1 Pro",
    "anti-bridge-lumi": "Gemini 3.1 Pro",
    "anti-bridge-lily": "Claude Sonnet 4.6",
    "anti-bridge-pico": "Claude Sonnet 4.6",
    "anti-bridge-ollie": "Claude Opus 4.6",
    "anti-bridge-luna": "Claude Opus 4.6"
  };
  return map[resolvedModel] || resolvedModel.replace(/-preview|-latest/g, "").replace("anti-bridge-", "");
};
function TaskDetailModal() {
  const { activeDetailTaskId, setActiveDetailTaskId, setFocusedTaskId, focusedTaskId, openArtifact } = useUiStore();
  const tasks = useKanbanStore((s) => s.tasks);
  const removeTask = useKanbanStore((s) => s.removeTask);
  const updateTaskStatus = useKanbanStore((s) => s.updateTaskStatus);
  const patchTask = useKanbanStore((s) => s.patchTask);
  const agentMeta = useAgentStore((s) => s.agentMeta);
  const { socket } = useSocket();
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState("");
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState("discussion");
  const [graphReport, setGraphReport] = useState(null);
  useEffect(() => {
    if (activeCommentTab === "graph" && !graphReport) {
      const projectId2 = task?.projectId || task?.project_id;
      if (projectId2) {
        fetch(`${SERVER_URL}/preview/${projectId2}/OUTPUT/GRAPH_REPORT.md`).then((r) => r.ok ? r.text() : "\uC9C0\uC2DD\uB9DD \uB9AC\uD3EC\uD2B8\uAC00 \uC544\uC9C1 \uC0DD\uC131\uB418\uC9C0 \uC54A\uC558\uAC70\uB098 \uC6CC\uCE58\uB3C5 \uC2A4\uCE94 \uC804\uC785\uB2C8\uB2E4.").then((text) => setGraphReport(text)).catch(() => setGraphReport("\uB9AC\uD3EC\uD2B8\uB97C \uBD88\uB7EC\uC624\uC9C0 \uBABB\uD588\uC2B5\uB2C8\uB2E4."));
      }
    }
  }, [activeCommentTab, task, SERVER_URL, graphReport]);
  const [isStarting, setIsStarting] = useState(false);
  const [commentColumn, setCommentColumn] = useState("");
  const [commentAssignee, setCommentAssignee] = useState("");
  const [commentPriority, setCommentPriority] = useState("medium");
  const [isEditing, setIsEditing] = useState(false);
  const [selectedMode, setSelectedMode] = useState("DEV");
  const [selectedModel, setSelectedModel] = useState("Claude Sonnet 4.6 (Thinking)");
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editAssignee, setEditAssignee] = useState("");
  const [editModel, setEditModel] = useState("");
  const [editColumn, setEditColumn] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [reworkReason, setReworkReason] = useState("");
  const [showReworkInput, setShowReworkInput] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isArchived, setIsArchived] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [copiedCommentIdx, setCopiedCommentIdx] = useState(null);
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);
  const [previewError, setPreviewError] = useState(false);
  const [hasPreviewData, setHasPreviewData] = useState(false);
  const iframeRef = useRef(null);
  const resizerRef = useRef(null);
  const isDragging = useRef(false);
  const textareaRef = useRef(null);
  const editAreaRef = useRef(null);
  const moreMenuRef = useRef(null);
  const [slashQuery, setSlashQuery] = useState("");
  const [showSlash, setShowSlash] = useState(false);
  const [slashTarget, setSlashTarget] = useState(null);
  const slashRef = useRef(null);
  const SLASH_COMMANDS = [
    { id: "/\uCF54\uB4DC", label: "\uCF54\uB4DC \uBE14\uB85D \uC0BD\uC785", icon: "data_object" },
    { id: "/bugdog\uAE30\uB85D", label: "\uBC84\uADF8\uB3C5 \uC790\uB3D9\uD654 \uAE30\uB85D", icon: "bug_report" },
    { id: "/run", label: "\uC790\uC728 \uB9B4\uB808\uC774 \u2014 PRD\u2192Advisor \uC790\uB3D9 \uC644\uC8FC", icon: "play_arrow" },
    { id: "/run-b", label: "\uBC18\uC790\uB3D9 \uB9B4\uB808\uC774 \u2014 PRD\u2192\uC2B9\uC778\u2192Advisor", icon: "step_into" },
    { id: "/stop", label: "\uD30C\uC774\uD504\uB77C\uC778 \uAC15\uC81C \uC885\uB8CC (Stuck \uD574\uC81C)", icon: "stop" }
  ];
  const filteredSlash = SLASH_COMMANDS.filter((c) => c.id.includes(slashQuery));
  const task = activeDetailTaskId ? tasks[String(activeDetailTaskId)] || null : null;
  const isFocused = String(focusedTaskId) === String(activeDetailTaskId);
  const projectId = task?.projectId || task?.project_id || null;
  const contextChain = useContextChain(projectId);
  const isChainMode = !!contextChain.activeRef;
  useEffect(() => {
    if (!activeDetailTaskId) return;
    setComments([]);
    setActiveCommentTab("discussion");
    setIsLoadingComments(true);
    fetch(`${SERVER_URL}/api/tasks/${activeDetailTaskId}/comments`).then((r) => r.json()).then((data) => setComments(Array.isArray(data.comments) ? data.comments : [])).catch(() => setComments([])).finally(() => setIsLoadingComments(false));
    setCommentColumn("NO_CHANGE");
    setCommentAssignee("NO_CHANGE");
    setCommentPriority("NO_CHANGE");
    setHasPreviewData(false);
    setIsPreviewMode(false);
    const projectId2 = tasks[String(activeDetailTaskId)]?.projectId || tasks[String(activeDetailTaskId)]?.project_id;
    if (projectId2) {
      fetch(`${SERVER_URL}/preview/${projectId2}/OUTPUT/index.html`, { method: "HEAD" }).then((r) => setHasPreviewData(r.ok)).catch(() => setHasPreviewData(false));
    }
  }, [activeDetailTaskId]);
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [commentText]);
  useEffect(() => {
    if (!socket || !activeDetailTaskId) return;
    const KNOWN_AGENTS = ["ari", "nova", "lumi", "pico", "ollie", "lily", "luna", "devteam", "system"];
    const handler = ({ taskId, author, text, createdAt }) => {
      if (String(taskId) !== String(activeDetailTaskId)) return;
      if (author === "CEO") return;
      const isAgent = KNOWN_AGENTS.includes(author?.toLowerCase());
      setComments((prev) => {
        const targetName = prev.length > 0 ? prev[prev.length - 1].source?.name || prev[prev.length - 1].author : "CEO";
        const newC = {
          author,
          source: isAgent ? { id: `agent-${author.toLowerCase()}`, name: author } : { id: "user-1", name: author || "CEO" },
          target: { id: "user-1", name: targetName },
          content: text,
          created_at: createdAt || (/* @__PURE__ */ new Date()).toISOString()
        };
        return [...prev, newC];
      });
    };
    socket.on("task:comment_added", handler);
    return () => socket.off("task:comment_added", handler);
  }, [socket, activeDetailTaskId]);
  useEffect(() => {
    if (!socket || !activeDetailTaskId) return;
    const onTaskUpdated = ({ taskId, status, column }) => {
      if (String(taskId) !== String(activeDetailTaskId)) return;
      if (status !== "IN_PROGRESS" && column !== "in_progress") return;
      const currentTask = useKanbanStore.getState().tasks[String(activeDetailTaskId)];
      const assignee = currentTask?.assignee || "\uB2F4\uB2F9\uC790";
      setComments((prev) => {
        const last = prev[prev.length - 1];
        if (last?.author === "system" && last?.content?.includes("\uC2DC\uC791")) return prev;
        return [...prev, {
          author: "system",
          source: { id: "system", name: "system" },
          target: { id: "user-1", name: "CEO" },
          content: `\u25B6\uFE0F ${assignee}\uC774(\uAC00) \uC791\uC5C5\uC744 \uC2DC\uC791\uD588\uC2B5\uB2C8\uB2E4.`,
          created_at: (/* @__PURE__ */ new Date()).toISOString()
        }];
      });
    };
    socket.on("task:updated", onTaskUpdated);
    return () => socket.off("task:updated", onTaskUpdated);
  }, [socket, activeDetailTaskId]);
  const handleClose = useCallback(() => {
    if (isArchived && activeDetailTaskId) {
      removeTask(String(activeDetailTaskId));
    }
    setActiveDetailTaskId(null);
    setIsConfirmingDelete(false);
    setIsEditing(false);
    setShowReworkInput(false);
    setReworkReason("");
    setIsArchived(false);
    setIsPreviewMode(false);
    setIsExpanded(false);
    contextChain.closePanel();
    setSplitRatio(50);
  }, [setActiveDetailTaskId, isArchived, activeDetailTaskId, removeTask, contextChain]);
  const handleResizerMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    if (iframeRef.current) iframeRef.current.style.pointerEvents = "none";
    const onMouseMove = (ev) => {
      if (!isDragging.current) return;
      const container = resizerRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newRatio = (ev.clientX - rect.left) / rect.width * 100;
      setSplitRatio(Math.min(Math.max(newRatio, 20), 80));
    };
    const onMouseUp = () => {
      isDragging.current = false;
      if (iframeRef.current) iframeRef.current.style.pointerEvents = "auto";
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("mouseup", onMouseUp);
    };
    window.addEventListener("mousemove", onMouseMove);
    window.addEventListener("mouseup", onMouseUp);
  }, []);
  const previewUrl = (() => {
    const projectId2 = task?.projectId || task?.project_id;
    if (!projectId2) return null;
    return `${SERVER_URL}/preview/${projectId2}/OUTPUT/index.html`;
  })();
  const handlePreviewRefresh = () => {
    setPreviewError(false);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };
  const handleEditTask = () => {
    setEditTitle(task.title);
    setEditContent(task.content || "");
    setEditAssignee(task.assignee || "");
    setEditModel(task.model || "");
    setEditColumn(task.column || "todo");
    setEditPriority(task.priority || "");
    setIsEditing(true);
    setShowMoreMenu(false);
  };
  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    const trimmedContent = editContent.trim();
    if (trimmedContent.startsWith("/run") || trimmedContent.startsWith("/run-b")) {
      const pipelineMode = trimmedContent.startsWith("/run-b") ? "run-b" : "run";
      const projectId2 = task.projectId || task.project_id;
      if (projectId2) {
        fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(projectId2)}/pipeline/${pipelineMode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: String(task.id) })
        }).then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "\uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 \uC2E4\uD328");
          const msg = pipelineMode === "run" ? `\u{1F680} /run \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 \u2014 ${data.title || "PRD"}\uBD80\uD130 Advisor \uB9AC\uBDF0\uAE4C\uC9C0 \uC790\uC728 \uC644\uC8FC` : `\u23F8 /run-b \uB2E8\uACC4\uBCC4 \uD655\uC778 \uBAA8\uB4DC \uC2DC\uC791`;
          useTimelineStore.getState().appendTimeline({
            level: "info",
            message: msg,
            agentId: "system",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            projectId: projectId2,
            taskId: String(task.id)
          });
          fetch(`${SERVER_URL}/api/tasks/${task.id}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author: "system", content: msg })
          }).catch(console.error);
        }).catch((err) => alert(err.message));
      }
      setIsEditing(false);
      return;
    }
    if (trimmedContent.startsWith("/bugdog\uAE30\uB85D")) {
      socket.emit("task:message", { taskId: task.id, text: trimmedContent, author: "CEO" });
      setIsEditing(false);
      return;
    }
    const payload = {
      title: editTitle.trim(),
      content: trimmedContent
    };
    patchTask(task.id, payload);
    fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    }).catch(console.error);
    setIsEditing(false);
  };
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") handleClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleClose]);
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
        setIsConfirmingDelete(false);
      }
    };
    if (showMoreMenu) window.addEventListener("mousedown", handleClickOutside);
    return () => window.removeEventListener("mousedown", handleClickOutside);
  }, [showMoreMenu]);
  const handleSubmitComment = () => {
    if (!commentText.trim() || !task) return;
    const trimmedText = commentText.trim();
    if (trimmedText.startsWith("/run") || trimmedText.startsWith("/run-b") || trimmedText.startsWith("/stop")) {
      const isStop = trimmedText.startsWith("/stop");
      const pipelineMode = isStop ? "stop" : trimmedText.startsWith("/run-b") ? "run-b" : "run";
      const projectId2 = task.projectId || task.project_id;
      const pendingMsg = isStop ? `\u{1F6D1} /stop \uD30C\uC774\uD504\uB77C\uC778 \uAC15\uC81C \uC885\uB8CC \uC694\uCCAD` : pipelineMode === "run" ? `\u{1F680} /run \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 \uC694\uCCAD \u2014 PRD\u2192Advisor \uC790\uC728 \uC644\uC8FC \uBAA8\uB4DC` : `\u23F8 /run-b \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 \uC694\uCCAD \u2014 \uB2E8\uACC4\uBCC4 CEO \uD655\uC778 \uBAA8\uB4DC`;
      const newComment2 = {
        author: "system",
        source: { id: "system", name: "system" },
        target: { id: "user-1", name: "CEO" },
        content: pendingMsg,
        created_at: (/* @__PURE__ */ new Date()).toISOString()
      };
      setComments((prev) => [...prev, newComment2]);
      setActiveCommentTab("activity");
      if (projectId2) {
        fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(projectId2)}/pipeline/${pipelineMode}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ taskId: String(task.id) })
        }).then(async (res) => {
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "\uD30C\uC774\uD504\uB77C\uC778 \uBA85\uB839 \uC2E4\uD328");
          const msg = isStop ? `\u{1F6D1} /stop \uD30C\uC774\uD504\uB77C\uC778\uC774 \uC815\uC0C1\uC801\uC73C\uB85C \uC885\uB8CC(\uCD08\uAE30\uD654)\uB418\uC5C8\uC2B5\uB2C8\uB2E4.` : pipelineMode === "run" ? `\u{1F680} /run \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791\uB428 \u2014 ${data.title || "PRD"}\uBD80\uD130 Advisor \uB9AC\uBDF0\uAE4C\uC9C0 \uC790\uC728 \uC644\uC8FC` : `\u23F8 /run-b \uB2E8\uACC4\uBCC4 \uD655\uC778 \uBAA8\uB4DC \uC2DC\uC791\uB428`;
          useTimelineStore.getState().appendTimeline({
            level: "info",
            message: msg,
            agentId: "system",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            projectId: projectId2,
            taskId: String(task.id)
            // 타임라인에서도 해당 태스크 필터에 걸리도록 taskId 부여
          });
          setComments((prev) => [...prev, {
            ...newComment2,
            content: `\u2705 ${msg}`,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          }]);
        }).catch((err) => {
          useTimelineStore.getState().appendTimeline({
            level: "error",
            message: `\u274C ${isStop ? "\uD30C\uC774\uD504\uB77C\uC778 \uC885\uB8CC \uC2E4\uD328" : "\uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 \uC2E4\uD328"}: ${err.message}`,
            agentId: "system",
            timestamp: (/* @__PURE__ */ new Date()).toISOString(),
            projectId: projectId2,
            taskId: String(task.id)
          });
          fetch(`${SERVER_URL}/api/tasks/${task.id}/comments`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ author: "system", content: `\u274C \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 \uC2E4\uD328: ${err.message}` })
          }).catch(console.error);
          setComments((prev) => [...prev, {
            ...newComment2,
            content: `\u274C \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 \uC2E4\uD328: ${err.message}`,
            created_at: (/* @__PURE__ */ new Date()).toISOString()
          }]);
        });
      }
      setCommentText("");
      setCommentColumn("NO_CHANGE");
      setCommentAssignee("NO_CHANGE");
      setCommentPriority("NO_CHANGE");
      return;
    }
    let finalColumn = commentColumn === "NO_CHANGE" ? task.column : commentColumn;
    const finalPriority = commentPriority === "NO_CHANGE" ? task.priority : commentPriority;
    if (finalPriority === "high" && finalColumn === "todo") {
      finalColumn = "in_progress";
    }
    const finalAssignee = commentAssignee === "NO_CHANGE" ? task.assignee : commentAssignee;
    const isHandoff = finalAssignee && finalAssignee !== task.assignee && finalAssignee !== "\uBBF8\uD560\uB2F9";
    if (isHandoff && commentColumn === "NO_CHANGE" && ["in_progress", "review"].includes(task.column)) {
      finalColumn = "todo";
    }
    const hasUpdates = finalPriority !== task.priority || finalAssignee !== task.assignee || finalColumn !== task.column;
    if (hasUpdates) {
      patchTask(task.id, {
        priority: finalPriority,
        assignee: finalAssignee,
        column: finalColumn
      });
      if (finalColumn && finalColumn !== task.column) {
        useKanbanStore.getState().moveTask(task.id, finalColumn);
      }
      fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priority: finalPriority,
          assignee: finalAssignee,
          column: finalColumn
        })
      }).catch(console.error);
    }
    const assigneeChanged = finalAssignee && finalAssignee !== task.assignee && finalAssignee !== "\uBBF8\uD560\uB2F9";
    const targetName = assigneeChanged ? finalAssignee : commentAssignee || task.assignee || "ARI";
    const newComment = {
      author: "CEO",
      source: { id: "user-1", name: "CEO" },
      target: { id: "agent", name: targetName },
      content: commentText.trim(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    };
    setComments((prev) => [...prev, newComment]);
    setCommentText("");
    setCommentColumn("NO_CHANGE");
    setCommentAssignee("NO_CHANGE");
    setCommentPriority("NO_CHANGE");
    fetch(`${SERVER_URL}/api/tasks/${task.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ author: "CEO", content: newComment.content, assignedAgent: finalAssignee })
    }).catch(console.error);
  };
  const handleKill = () => {
    fetch(`${SERVER_URL}/api/tasks/${task.id}/kill`, { method: "POST" }).then((r) => r.json()).then(() => updateTaskStatus(task.id, "PAUSED")).catch(console.error);
  };
  const handleStartTask = () => {
    if (!task.assignee || task.assignee === "\uBBF8\uD560\uB2F9") {
      alert("\uB2F4\uB2F9\uC790\uB97C \uBA3C\uC800 \uC9C0\uC815\uD574\uC8FC\uC138\uC694.");
      return;
    }
    setIsStarting(true);
    fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ column: "in_progress" })
    }).then((r) => r.json()).then(() => patchTask(task.id, { column: "in_progress", status: "IN_PROGRESS" })).catch(console.error).finally(() => setIsStarting(false));
  };
  const handleApprove = () => {
    fetch(`${SERVER_URL}/api/tasks/${task.id}/approve`, { method: "PATCH" }).catch(console.error);
    handleClose();
  };
  const handleRework = () => {
    fetch(`${SERVER_URL}/api/tasks/${task.id}/rework`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: reworkReason.trim() || "\uCD94\uAC00 \uAC80\uD1A0 \uD6C4 \uC7AC\uC791\uC5C5\uC774 \uD544\uC694\uD569\uB2C8\uB2E4." })
    }).catch(console.error);
    handleClose();
  };
  const handleDelete = () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    fetch(`${SERVER_URL}/api/tasks/${task.id}`, { method: "DELETE" }).then((r) => r.json()).then(() => {
      removeTask(task.id);
      if (String(focusedTaskId) === String(task.id)) setFocusedTaskId(null);
      handleClose();
    }).catch(console.error);
  };
  if (!task) return null;
  const statusInfo = STATUS_LABEL[task.status] || STATUS_LABEL["PENDING"];
  const isReview = task.column === "review";
  const uiCodeRegex = /```(html|css|js|jsx|ts|tsx|javascript|typescript)(?:\s|$)/i;
  const hasCodeBlock = typeof task.content === "string" && uiCodeRegex.test(task.content) || Array.isArray(comments) && comments.some((c) => typeof c.content === "string" && uiCodeRegex.test(c.content));
  return /* @__PURE__ */ React.createElement(
    "div",
    {
      className: `modal-overlay ${isExpanded ? "modal-overlay--expanded" : ""}`,
      role: "dialog",
      "aria-modal": "true",
      "aria-label": `Task #${task.project_task_num != null ? task.project_task_num : String(task.id).slice(-6)} \uC0C1\uC138`,
      onClick: (e) => {
        if (e.target === e.currentTarget) handleClose();
      }
    },
    /* @__PURE__ */ React.createElement("div", { className: `modal modal--detail ${isExpanded ? "modal--expanded" : ""}` }, /* @__PURE__ */ React.createElement("div", { className: "modal__header", style: { alignItems: "flex-start", gap: "0.75rem" } }, /* @__PURE__ */ React.createElement("div", { style: { flex: 1, minWidth: 0 } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.3rem" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setIsExpanded(!isExpanded),
        title: isExpanded ? "\uCD95\uC18C" : "\uC804\uCCB4 \uD654\uBA74\uC73C\uB85C \uD655\uC7A5",
        style: {
          background: "transparent",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          padding: "2px",
          borderRadius: "4px"
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.1rem" } }, isExpanded ? "close_fullscreen" : "open_in_full")
    ), /* @__PURE__ */ React.createElement("span", { style: {
      fontSize: "0.76rem",
      fontFamily: "Space Grotesk, sans-serif",
      fontWeight: 700,
      letterSpacing: "0.08em",
      color: "var(--text-muted)"
    } }, "Task #", task.project_task_num != null ? task.project_task_num : String(task.id).slice(-6))), isEditing ? /* @__PURE__ */ React.createElement(
      "input",
      {
        value: editTitle,
        onChange: (e) => setEditTitle(e.target.value),
        style: { fontSize: "1.5rem", margin: "0.5rem 0", width: "100%", background: "var(--bg-surface-3)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.4rem 0.6rem", outline: "none" }
      }
    ) : /* @__PURE__ */ React.createElement("h2", { className: "modal__title", style: { fontSize: "1.5rem", margin: 0 } }, task.title)), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "0.4rem", alignItems: "center", flexShrink: 0 } }, previewUrl && hasPreviewData && hasCodeBlock && /* @__PURE__ */ React.createElement(
      "button",
      {
        id: "btn-live-preview",
        onClick: () => {
          setIsPreviewMode((v) => {
            const nextV = !v;
            if (nextV) setIsExpanded(true);
            return nextV;
          });
          setPreviewError(false);
          if (isChainMode) contextChain.closePanel();
        },
        title: isPreviewMode ? "\uD504\uB9AC\uBDF0 \uB2EB\uAE30" : "\uACB0\uACFC\uBB3C \uBBF8\uB9AC\uBCF4\uAE30",
        style: {
          background: isPreviewMode ? "linear-gradient(135deg, rgba(100,135,242,0.3), rgba(74,222,128,0.15))" : "rgba(180,197,255,0.07)",
          border: `1px solid ${isPreviewMode ? "rgba(100,135,242,0.55)" : "rgba(180,197,255,0.18)"}`,
          color: isPreviewMode ? "#b4c5ff" : "var(--text-secondary)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.35rem 0.75rem",
          borderRadius: "8px",
          fontSize: "0.78rem",
          fontWeight: 700,
          fontFamily: "Space Grotesk, sans-serif",
          letterSpacing: "0.03em",
          boxShadow: isPreviewMode ? "0 0 10px rgba(100,135,242,0.25)" : "none",
          transition: "all 0.2s"
        },
        onMouseEnter: (e) => {
          if (!isPreviewMode) {
            e.currentTarget.style.background = "rgba(180,197,255,0.13)";
            e.currentTarget.style.borderColor = "rgba(180,197,255,0.35)";
            e.currentTarget.style.color = "var(--text-primary)";
          }
        },
        onMouseLeave: (e) => {
          if (!isPreviewMode) {
            e.currentTarget.style.background = "rgba(180,197,255,0.07)";
            e.currentTarget.style.borderColor = "rgba(180,197,255,0.18)";
            e.currentTarget.style.color = "var(--text-secondary)";
          }
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, isPreviewMode ? "close" : "preview"),
      isPreviewMode ? "\uB2EB\uAE30" : "\uBBF8\uB9AC\uBCF4\uAE30"
    ), /* @__PURE__ */ React.createElement("div", { style: { position: "relative" }, ref: moreMenuRef }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: () => setShowMoreMenu(!showMoreMenu),
        style: {
          background: "none",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "32px",
          height: "32px",
          borderRadius: "50%",
          transition: "background 0.2s"
        },
        className: showMoreMenu ? "more-active" : ""
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.4rem" } }, "more_vert")
    ), showMoreMenu && /* @__PURE__ */ React.createElement("div", { style: {
      position: "absolute",
      top: "100%",
      right: 0,
      marginTop: "0.5rem",
      background: "var(--bg-surface-3)",
      backdropFilter: "blur(10px)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      boxShadow: "none",
      minWidth: "160px",
      zIndex: 200,
      padding: "0.4rem",
      overflow: "hidden"
    } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleEditTask,
        style: {
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "0.7rem 1rem",
          background: "none",
          border: "none",
          color: "var(--text-primary)",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "0.9rem",
          fontWeight: 600,
          transition: "all 0.2s",
          textAlign: "left",
          marginBottom: "0.2rem"
        },
        onMouseOver: (e) => e.currentTarget.style.background = "var(--bg-surface-highest)",
        onMouseOut: (e) => e.currentTarget.style.background = "none"
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.2rem" } }, "edit"),
      "\uD3B8\uC9D1\uD558\uAE30"
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleDelete,
        style: {
          width: "100%",
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          padding: "0.7rem 1rem",
          background: isConfirmingDelete ? "rgba(255,82,82,0.1)" : "none",
          border: "none",
          color: isConfirmingDelete ? "#ff5449" : "var(--text-secondary)",
          borderRadius: "8px",
          cursor: "pointer",
          fontSize: "0.9rem",
          fontWeight: 600,
          transition: "all 0.2s",
          textAlign: "left"
        },
        onMouseOver: (e) => {
          if (!isConfirmingDelete) e.currentTarget.style.background = "var(--bg-surface-highest)";
        },
        onMouseOut: (e) => {
          if (!isConfirmingDelete) e.currentTarget.style.background = "none";
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.1rem" } }, isConfirmingDelete ? "priority_high" : "delete"),
      isConfirmingDelete ? "\uC815\uB9D0 \uC0AD\uC81C\uD560\uAE4C\uC694?" : "\uC0AD\uC81C\uD558\uAE30"
    ))), /* @__PURE__ */ React.createElement("button", { className: "modal__close", onClick: handleClose, "aria-label": "\uB2EB\uAE30" }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.3rem" } }, "close")))), /* @__PURE__ */ React.createElement("div", { style: {
      flex: 1,
      display: "flex",
      overflow: "hidden",
      // 프리뷰 또는 체인 패널 모드에선 row, 일반 모드에선 column
      flexDirection: isPreviewMode || isChainMode ? "row" : "column"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      flex: isPreviewMode ? `0 0 ${splitRatio}%` : "1 1 auto",
      overflowY: "auto",
      padding: "1rem 1.5rem",
      minWidth: 0,
      transition: isDragging.current ? "none" : "flex-basis 0.05s"
    } }, isEditing ? /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "1.25rem" } }, /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement(
      "textarea",
      {
        ref: editAreaRef,
        value: editContent,
        onChange: (e) => {
          const val = e.target.value;
          setEditContent(val);
          const slashIdx = val.lastIndexOf("/");
          if (slashIdx !== -1) {
            const afterSlash = val.slice(slashIdx + 1);
            if (!afterSlash.includes(" ") && !afterSlash.includes("\n")) {
              setSlashQuery(afterSlash);
              setSlashTarget("edit");
              setShowSlash(true);
            } else {
              setShowSlash(false);
            }
          } else {
            setShowSlash(false);
          }
        },
        onKeyDown: (e) => {
          if (showSlash && slashTarget === "edit" && e.key === "Escape") {
            e.preventDefault();
            setShowSlash(false);
            return;
          }
          if (showSlash && slashTarget === "edit" && e.key === "Enter" && filteredSlash.length > 0) {
            e.preventDefault();
            const cmd = filteredSlash[0];
            if (cmd.id === "/\uCF54\uB4DC") {
              const sIdx = editContent.lastIndexOf("/");
              const newText = editContent.slice(0, sIdx) + "\n```typescript\n// \uC5EC\uAE30\uC5D0 \uCF54\uB4DC\uB97C \uC791\uC131\uD558\uC138\uC694\n\n```\n";
              setEditContent(newText);
            } else {
              const sIdx = editContent.lastIndexOf("/");
              const newText = editContent.slice(0, sIdx) + `${cmd.id} `;
              setEditContent(newText);
            }
            setShowSlash(false);
            return;
          }
        },
        onBlur: () => setTimeout(() => setShowSlash(false), 150),
        rows: 5,
        style: { width: "100%", background: "var(--bg-surface-3)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.8rem", outline: "none", resize: "vertical", fontSize: "1.05rem", lineHeight: 1.6 },
        placeholder: "\uD0DC\uC2A4\uD06C \uC0C1\uC138 \uB0B4\uC6A9... (/\uCEE4\uB9E8\uB4DC \uD638\uCD9C \uAC00\uB2A5)"
      }
    ), showSlash && slashTarget === "edit" && filteredSlash.length > 0 && /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: slashRef,
        style: {
          position: "absolute",
          bottom: "100%",
          left: 0,
          right: 0,
          marginBottom: 6,
          background: "var(--bg-surface-2)",
          border: "1px solid rgba(124,110,248,0.4)",
          borderRadius: 10,
          overflow: "hidden",
          zIndex: 200,
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)"
        }
      },
      filteredSlash.map((cmd) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: cmd.id,
          onMouseDown: (e) => {
            e.preventDefault();
            if (cmd.id === "/\uCF54\uB4DC") {
              const sIdx = editContent.lastIndexOf("/");
              const newText = editContent.slice(0, sIdx) + "\n```typescript\n// \uC5EC\uAE30\uC5D0 \uCF54\uB4DC\uB97C \uC791\uC131\uD558\uC138\uC694\n\n```\n";
              setEditContent(newText);
            } else {
              const sIdx = editContent.lastIndexOf("/");
              const newText = editContent.slice(0, sIdx) + `${cmd.id} `;
              setEditContent(newText);
            }
            setShowSlash(false);
            setTimeout(() => editAreaRef.current?.focus(), 0);
          },
          style: {
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            width: "100%",
            padding: "0.6rem 0.8rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: "0.88rem",
            textAlign: "left",
            transition: "background 0.12s",
            borderBottom: "1px solid var(--border)"
          },
          onMouseEnter: (e) => e.currentTarget.style.background = "rgba(124,110,248,0.15)",
          onMouseLeave: (e) => e.currentTarget.style.background = "transparent"
        },
        /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.2rem", color: "var(--brand)" } }, cmd.icon),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.1rem" } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, color: "var(--text-primary)" } }, cmd.id), /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.6, fontSize: "0.75rem" } }, cmd.label))
      ))
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "0.5rem", marginTop: "1rem", justifyContent: "flex-end" } }, /* @__PURE__ */ React.createElement("button", { className: "btn btn--ghost btn--sm", onClick: () => setIsEditing(false) }, "\uCDE8\uC18C"), /* @__PURE__ */ React.createElement("button", { className: "btn btn--primary btn--sm", onClick: handleSaveEdit }, "\uC800\uC7A5"))) : /* @__PURE__ */ React.createElement("div", { className: "task-content-area", style: { position: "relative", minHeight: "60px" } }, /* @__PURE__ */ React.createElement("div", { style: {
      fontSize: "1.05rem",
      color: "var(--text-secondary)",
      lineHeight: 1.75,
      marginBottom: "20px",
      wordBreak: "break-word"
    } }, /* @__PURE__ */ React.createElement(
      ReactMarkdown,
      {
        className: "notion-md",
        remarkPlugins: [remarkGfm],
        rehypePlugins: [rehypeRaw]
      },
      task.content || ""
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.25rem" } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem", background: "rgba(255,255,255,0.05)", padding: "2px 8px", borderRadius: "4px" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "edit_square"), "\uC791\uC131: ", task.author || "\uC2DC\uC2A4\uD15C"), task.createdAt && /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "calendar_today"), new Date(task.createdAt).toLocaleDateString("ko-KR")), task.executionMode && task.executionMode !== "ari" && /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.82rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.3rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "smart_toy"), task.executionMode.toUpperCase())), task.category === "WORKFLOW" && /* @__PURE__ */ React.createElement(WorkflowTimeline, { taskId: task.id }), task.column === "todo" && task.status !== "IN_PROGRESS" && task.status !== "REVIEW" && task.status !== "COMPLETED" && /* @__PURE__ */ React.createElement("div", { style: {
      background: isStarting ? "rgba(180,197,255,0.1)" : "rgba(180,197,255,0.06)",
      border: `1px solid ${isStarting ? "rgba(180,197,255,0.4)" : "rgba(180,197,255,0.18)"}`,
      borderRadius: "12px",
      padding: "0.8rem 1rem",
      marginBottom: "1.25rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between",
      gap: "1rem",
      transition: "all 0.3s"
    } }, (() => {
      const assigneeKey = task.assignee?.toLowerCase().replace(/^proj-\d+-/, "");
      const displayAssignee = (agentMeta[assigneeKey]?.role || task.assignee || "").toUpperCase();
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.88rem", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: {
        fontSize: "1.1rem",
        color: "var(--brand)",
        opacity: 0.85,
        animation: isStarting ? "spin 1s linear infinite" : "none"
      } }, isStarting ? "sync" : "pending_actions"), isStarting ? /* @__PURE__ */ React.createElement("span", { style: { color: "var(--brand)" } }, /* @__PURE__ */ React.createElement("strong", null, displayAssignee), "\uC5D0\uAC8C \uD0DC\uC2A4\uD06C\uB97C \uC804\uB2EC\uD558\uB294 \uC911...") : task.assignee && task.assignee !== "\uBBF8\uD560\uB2F9" ? task.assignee.toLowerCase() === "ceo" ? /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--text-primary)" } }, "CEO"), "\uB2D8\uC740 \uC9C1\uC811 \uC791\uC5C5\uC744 \uC218\uD589\uD569\uB2C8\uB2E4. (AI \uC5D0\uC774\uC804\uD2B8\uC5D0\uAC8C \uD560\uB2F9\uD558\uC138\uC694)") : /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--text-primary)" } }, displayAssignee), "\uC5D0\uAC8C \uC989\uC2DC \uC2E4\uD589\uC744 \uC2DC\uC791\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4.") : /* @__PURE__ */ React.createElement("span", { style: { color: "var(--text-muted)" } }, "\uB2F4\uB2F9\uC790\uB97C \uC9C0\uC815\uD558\uBA74 \uC2E4\uD589\uC2DC\uD0AC \uC218 \uC788\uC2B5\uB2C8\uB2E4.")), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: handleStartTask,
          disabled: !task.assignee || task.assignee === "\uBBF8\uD560\uB2F9" || task.assignee.toLowerCase() === "ceo" || isStarting,
          style: {
            background: isStarting ? "rgba(180,197,255,0.15)" : !task.assignee || task.assignee === "\uBBF8\uD560\uB2F9" || task.assignee.toLowerCase() === "ceo" ? "var(--bg-surface-3)" : "linear-gradient(135deg, rgba(180,197,255,0.25), rgba(120,140,255,0.35))",
            color: !task.assignee || task.assignee === "\uBBF8\uD560\uB2F9" || task.assignee.toLowerCase() === "ceo" ? "var(--text-muted)" : "var(--brand)",
            border: "1px solid rgba(180,197,255,0.3)",
            borderRadius: "8px",
            padding: "0.45rem 1rem",
            cursor: !task.assignee || task.assignee === "\uBBF8\uD560\uB2F9" || task.assignee.toLowerCase() === "ceo" || isStarting ? "not-allowed" : "pointer",
            fontWeight: 700,
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            fontFamily: "Space Grotesk, sans-serif",
            letterSpacing: "0.04em",
            whiteSpace: "nowrap",
            transition: "all 0.2s",
            flexShrink: 0,
            opacity: isStarting ? 0.7 : 1
          }
        },
        /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, isStarting ? "hourglass_empty" : "play_arrow"),
        isStarting ? "\uC804\uB2EC \uC911..." : "\uC2E4\uD589 \uC2DC\uC791"
      ));
    })()), task.status === "in_progress" && /* @__PURE__ */ React.createElement("div", { style: {
      background: "var(--bg-surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      padding: "0.8rem 1rem",
      marginBottom: "1.25rem",
      display: "flex",
      alignItems: "center",
      justifyContent: "space-between"
    } }, /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.88rem", color: "var(--text-secondary)" } }, /* @__PURE__ */ React.createElement("strong", { style: { color: "var(--status-active)", display: "flex", alignItems: "center", gap: "0.3rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "bolt"), "\uC2E4\uD589 \uC911"), " \u2014 \uC774 \uD0DC\uC2A4\uD06C\uC758 AI \uD504\uB85C\uC138\uC2A4\uB97C \uC911\uB2E8\uD560 \uC218 \uC788\uC2B5\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleKill,
        style: {
          background: "var(--bg-surface-3)",
          color: "var(--text-secondary)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          padding: "0.4rem 0.9rem",
          cursor: "pointer",
          fontWeight: 700,
          fontSize: "0.85rem",
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          fontFamily: "Space Grotesk, sans-serif",
          letterSpacing: "0.04em"
        }
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "stop_circle"),
      "KILL"
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "1rem", marginBottom: "1.25rem", flexWrap: "wrap", padding: "0.6rem 0.8rem", background: "var(--bg-surface-2)", borderRadius: "8px", border: "1px solid var(--border)" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1, minWidth: "130px" } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 } }, "\uB2F4\uB2F9\uC790 (Assignee)"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: task.assignee || "",
        onChange: (e) => {
          const newAssignee = e.target.value;
          patchTask(task.id, { assignee: newAssignee || "\uBBF8\uD560\uB2F9" });
          fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ assignee: newAssignee || "\uBBF8\uD560\uB2F9" })
          }).catch(console.error);
        },
        style: {
          background: "var(--bg-surface-3)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "0.4rem 0.5rem",
          outline: "none",
          fontSize: "0.8rem",
          cursor: "pointer",
          fontFamily: "Space Grotesk, sans-serif"
        }
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "\uBBF8\uD560\uB2F9"),
      /* @__PURE__ */ React.createElement("option", { value: "CEO" }, "CEO"),
      Object.entries(useAgentStore.getState().agentMeta || {}).map(([id, m]) => /* @__PURE__ */ React.createElement("option", { key: id, value: id }, m.name || m.role || id))
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1, minWidth: "130px" } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 } }, "\uBAA8\uB378 (Model)"), /* @__PURE__ */ React.createElement("div", { style: { height: "32px", display: "flex", alignItems: "center" } }, (() => {
      const assigneeKey = task.assignee?.toLowerCase();
      const profileModel = assigneeKey ? Object.values(agentMeta).find(
        (m) => m.id?.toLowerCase() === assigneeKey || m.name?.toLowerCase() === assigneeKey
      )?.model : null;
      const displayModel = profileModel || task.model;
      if (!displayModel || ["ari", "luca", "sonnet", "opus"].includes(displayModel.toLowerCase())) {
        return /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.8rem", color: "var(--text-muted)" } }, "\uC790\uB3D9 \uD560\uB2F9");
      }
      return /* @__PURE__ */ React.createElement("div", { style: {
        fontSize: "0.72rem",
        fontWeight: 700,
        padding: "4px 8px",
        borderRadius: "4px",
        background: "rgba(180,197,255,0.1)",
        color: "var(--brand)",
        border: "1px solid rgba(180,197,255,0.2)",
        fontFamily: "Space Grotesk, sans-serif",
        letterSpacing: "0.04em",
        display: "flex",
        alignItems: "center",
        gap: "0.3rem",
        width: "fit-content"
      } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.9rem" } }, "memory"), formatModelName(displayModel, agentMeta));
    })())), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1, minWidth: "130px" } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 } }, "\uC0C1\uD0DC (Status)"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: task.status === "ARCHIVED" ? "archived" : task.column || "todo",
        onChange: (e) => {
          const newColumn = e.target.value;
          if (newColumn === "archived") {
            if (!window.confirm("\uC774 \uD0DC\uC2A4\uD06C\uB97C \uC544\uCE74\uC774\uBE0C(\uBCF4\uAD00)\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?")) return;
            patchTask(task.id, { status: "ARCHIVED" });
            fetch(`${SERVER_URL}/api/tasks/${task.id}/archive`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ archivedBy: "CEO (Manual)" })
            }).then(() => handleClose()).catch(console.error);
          } else {
            patchTask(task.id, { column: newColumn });
            fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ column: newColumn })
            }).catch(console.error);
          }
        },
        style: {
          background: "var(--bg-surface-3)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "0.4rem 0.5rem",
          outline: "none",
          fontSize: "0.8rem",
          cursor: "pointer",
          fontFamily: "Space Grotesk, sans-serif"
        }
      },
      /* @__PURE__ */ React.createElement("option", { value: "todo" }, "To Do"),
      /* @__PURE__ */ React.createElement("option", { value: "in_progress" }, "In Progress"),
      /* @__PURE__ */ React.createElement("option", { value: "review" }, "Review"),
      /* @__PURE__ */ React.createElement("option", { value: "done" }, "Done"),
      /* @__PURE__ */ React.createElement("option", { value: "archived" }, "Archive")
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.4rem", flex: 1, minWidth: "130px" } }, /* @__PURE__ */ React.createElement("label", { style: { fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 600 } }, "\uC6B0\uC120\uC21C\uC704 (Priority)"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: task.priority || "",
        onChange: (e) => {
          const newPriority = e.target.value;
          patchTask(task.id, { priority: newPriority });
          fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ priority: newPriority })
          }).catch(console.error);
        },
        style: {
          background: "var(--bg-surface-3)",
          color: "var(--text-primary)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          padding: "0.4rem 0.5rem",
          outline: "none",
          fontSize: "0.8rem",
          cursor: "pointer",
          fontFamily: "Space Grotesk, sans-serif"
        }
      },
      /* @__PURE__ */ React.createElement("option", { value: "" }, "\uC120\uD0DD \uC548\uD568"),
      /* @__PURE__ */ React.createElement("option", { value: "urgent" }, "Urgent"),
      /* @__PURE__ */ React.createElement("option", { value: "high" }, "High"),
      /* @__PURE__ */ React.createElement("option", { value: "medium" }, "Medium"),
      /* @__PURE__ */ React.createElement("option", { value: "low" }, "Low")
    ))), /* @__PURE__ */ React.createElement("div", { style: { marginBottom: "1rem" } }, (() => {
      const isSystemComment = (c) => {
        const a = (c.author || "").toLowerCase();
        const s = (c.source?.name || "").toLowerCase();
        return a === "system" || s === "system";
      };
      const activityComments = comments.filter((c) => isSystemComment(c));
      const discussionComments = comments.filter((c) => !isSystemComment(c));
      const visibleComments = activeCommentTab === "discussion" ? discussionComments : activityComments;
      return /* @__PURE__ */ React.createElement(React.Fragment, null, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", borderBottom: "1px solid var(--border)", marginBottom: "0.75rem" } }, [
        { key: "discussion", icon: "forum", label: "Discussion", count: discussionComments.length },
        { key: "activity", icon: "history", label: "Activity", count: activityComments.length },
        { key: "graph", icon: "account_tree", label: "Graphify Report", count: 0 }
      ].map((tab) => /* @__PURE__ */ React.createElement("button", { key: tab.key, onClick: () => setActiveCommentTab(tab.key), style: {
        display: "flex",
        alignItems: "center",
        gap: "0.3rem",
        padding: "0.35rem 0.8rem",
        fontSize: "0.74rem",
        fontWeight: 600,
        fontFamily: "Space Grotesk, sans-serif",
        letterSpacing: "0.04em",
        border: "none",
        borderBottom: activeCommentTab === tab.key ? "2px solid var(--brand)" : "2px solid transparent",
        borderRadius: 0,
        background: "none",
        color: activeCommentTab === tab.key ? "var(--brand)" : "var(--text-muted)",
        cursor: "pointer",
        transition: "color 0.15s"
      } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.85rem" } }, tab.icon), tab.label, tab.count > 0 && /* @__PURE__ */ React.createElement("span", { style: {
        marginLeft: "0.2rem",
        fontSize: "0.62rem",
        fontWeight: 700,
        background: activeCommentTab === tab.key ? "rgba(180,197,255,0.15)" : "rgba(255,255,255,0.07)",
        borderRadius: "10px",
        padding: "1px 5px"
      } }, tab.count)))), activeCommentTab === "graph" ? /* @__PURE__ */ React.createElement("div", { style: { padding: "0.5rem", fontSize: "0.82rem", color: "var(--text-secondary)", lineHeight: 1.6 } }, graphReport ? /* @__PURE__ */ React.createElement("div", { className: "markdown-body", style: { background: "transparent" } }, /* @__PURE__ */ React.createElement(ReactMarkdown, { remarkPlugins: [remarkGfm], rehypePlugins: [rehypeRaw] }, graphReport)) : /* @__PURE__ */ React.createElement("p", { style: { fontStyle: "italic", color: "var(--text-muted)" } }, "\uB9AC\uD3EC\uD2B8 \uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911...")) : isLoadingComments ? /* @__PURE__ */ React.createElement("p", { style: { fontSize: "0.78rem", color: "var(--text-muted)" } }, "\uB313\uAE00 \uBD88\uB7EC\uC624\uB294 \uC911...") : visibleComments.length === 0 ? /* @__PURE__ */ React.createElement("p", { style: { fontSize: "0.9rem", color: "var(--text-muted)", fontStyle: "italic" } }, activeCommentTab === "discussion" ? "\uC544\uC9C1 \uB313\uAE00\uC774 \uC5C6\uC2B5\uB2C8\uB2E4. \uC9C0\uC2DC\uC0AC\uD56D\uC774\uB098 \uD53C\uB4DC\uBC31\uC744 \uB0A8\uACA8\uBCF4\uC138\uC694." : "\uC2DC\uC2A4\uD15C \uD65C\uB3D9 \uAE30\uB85D\uC774 \uC5C6\uC2B5\uB2C8\uB2E4.") : /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.65rem" } }, visibleComments.map((c, i) => {
        const srcName = c.source?.name || c.author || "\uC54C \uC218 \uC5C6\uC74C";
        const tgtName = c.target?.name || (i === 0 ? task.assignee || "ARI" : comments[i - 1]?.source?.name || comments[i - 1]?.author || "\uB300\uD45C\uB2D8");
        const isCeo = srcName === "CEO";
        const isAriDelegate = srcName === "ARI(\uC704\uC784)";
        const isAgentComment = !isCeo && !isAriDelegate && c.author !== "CEO" && c.author !== "\uB300\uD45C\uB2D8";
        const srcColor = isCeo ? "#4ade80" : isAriDelegate ? "#fb923c" : "var(--brand)";
        const tgtColor = isAgentComment ? "var(--status-active)" : isCeo || isAriDelegate ? "var(--brand)" : "var(--text-muted)";
        const isChainComment = isAgentComment && /^\[.+\]\n/.test(c.content || "");
        const prevC = visibleComments[i - 1];
        const prevIsChain = prevC && !["CEO", "\uB300\uD45C\uB2D8", "system"].includes(prevC.author) && /^\[.+\]\n/.test(prevC.content || "");
        const showPipe = isChainComment && prevIsChain && i > 0;
        return /* @__PURE__ */ React.createElement("div", { key: i, style: { display: "contents" } }, showPipe && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", padding: "0 0.5rem" } }, /* @__PURE__ */ React.createElement("div", { style: { width: "2px", height: "18px", background: "linear-gradient(to bottom, rgba(180,197,255,0.3), rgba(180,197,255,0.1))", marginLeft: "0.9rem", flexShrink: 0 } }), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.65rem", color: "rgba(180,197,255,0.4)", fontFamily: "Space Grotesk, sans-serif", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase" } }, prevC.author?.toUpperCase(), " \u2192 ", c.author?.toUpperCase())), /* @__PURE__ */ React.createElement("div", { style: {
          background: isChainComment ? "rgba(180,197,255,0.04)" : "var(--bg-surface-2)",
          borderRadius: "10px",
          padding: "0.7rem 0.9rem",
          border: isChainComment ? "1px solid rgba(180,197,255,0.15)" : "1px solid var(--border)"
        } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", marginBottom: "0.35rem", alignItems: "center" } }, /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "0.3rem" } }, c.author === "system" ? /* @__PURE__ */ React.createElement("span", { style: {
          fontSize: "0.68rem",
          fontWeight: 700,
          color: "var(--text-muted)",
          fontFamily: "Space Grotesk, sans-serif",
          textTransform: "uppercase",
          letterSpacing: "0.07em",
          background: "rgba(255,255,255,0.06)",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: "4px",
          padding: "1px 6px"
        } }, "System Log") : /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.82rem", fontWeight: 700, color: srcColor } }, srcName)), /* @__PURE__ */ React.createElement("span", { style: { display: "inline-flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.75rem", color: "var(--text-muted)" } }, (() => {
          const d = new Date(c.created_at);
          const yy = String(d.getFullYear()).slice(2);
          const mm = String(d.getMonth() + 1).padStart(2, "0");
          const dd = String(d.getDate()).padStart(2, "0");
          const hh = String(d.getHours()).padStart(2, "0");
          const min = String(d.getMinutes()).padStart(2, "0");
          return `${yy}.${mm}.${dd} ${hh}:${min}`;
        })()), c.author !== "system" && task?.project_task_num != null && (() => {
          const commentIdx = c.comment_idx ?? i + 1;
          const tag = `#${task.project_task_num}C${commentIdx}`;
          const isCopied = copiedCommentIdx === tag;
          return /* @__PURE__ */ React.createElement(
            "button",
            {
              title: `\uD0DC\uADF8 \uBCF5\uC0AC: ${tag}`,
              onClick: () => {
                navigator.clipboard.writeText(tag).then(() => {
                  setCopiedCommentIdx(tag);
                  setTimeout(() => setCopiedCommentIdx(null), 800);
                });
              },
              style: {
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.25rem",
                padding: "2px 6px",
                borderRadius: "4px",
                color: isCopied ? "#4ade80" : "var(--text-muted)",
                fontSize: "0.8rem",
                fontFamily: "Space Grotesk, sans-serif",
                fontWeight: 600,
                letterSpacing: "0.03em",
                transition: "color 0.2s",
                opacity: 0.8
              },
              onMouseEnter: (e) => e.currentTarget.style.opacity = 1,
              onMouseLeave: (e) => e.currentTarget.style.opacity = 0.8
            },
            /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.9rem" } }, isCopied ? "check" : "content_copy"),
            isCopied ? "\uBCF5\uC0AC\uB428" : tag
          );
        })())), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "1.05rem", color: "var(--text-secondary)", lineHeight: 1.5, margin: 0, wordBreak: "break-word" } }, /* @__PURE__ */ React.createElement(
          ReactMarkdown,
          {
            className: "notion-md",
            remarkPlugins: [remarkGfm],
            rehypePlugins: [rehypeRaw],
            components: {
              // [Phase 36b/37] 카드링크 + 컨텍스트 체인 [#ID] 인라인 렌더링
              p: ({ children }) => {
                const processChild = (child) => {
                  if (typeof child !== "string") return child;
                  const chainParts = renderChainRefText(
                    child,
                    contextChain.chainCache,
                    (refId) => {
                      contextChain.openPanel(refId);
                      setIsPreviewMode(false);
                      if (!isExpanded) setIsExpanded(true);
                    }
                  );
                  return chainParts.flatMap(
                    (part) => typeof part === "string" ? renderTaggedText(part, null) : [part]
                  );
                };
                const processed = Array.isArray(children) ? children.flatMap(processChild) : processChild(children);
                return /* @__PURE__ */ React.createElement("p", null, processed);
              }
            }
          },
          c.content || ""
        )), isAgentComment && c.thought_process && /* @__PURE__ */ React.createElement("div", { style: {
          marginTop: "0.75rem",
          borderTop: "1px solid rgba(180,197,255,0.12)",
          paddingTop: "0.6rem"
        } }, c.thought_process.thinking && /* @__PURE__ */ React.createElement("details", { open: true, style: { marginBottom: "0.4rem" } }, /* @__PURE__ */ React.createElement("summary", { style: {
          cursor: "pointer",
          fontSize: "0.72rem",
          color: "rgba(180,197,255,0.6)",
          userSelect: "none",
          fontFamily: "Space Grotesk, sans-serif",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          listStyle: "none"
        } }, /* @__PURE__ */ React.createElement("span", { style: {
          display: "inline-block",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "rgba(180,197,255,0.5)",
          flexShrink: 0
        } }), "\uC0AC\uACE0\uACFC\uC815 (Thinking)"), /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"JetBrains Mono", "SF Mono", monospace',
          fontSize: "0.78rem",
          color: "rgba(200,210,255,0.7)",
          marginTop: "0.45rem",
          whiteSpace: "pre-wrap",
          lineHeight: 1.65,
          background: "rgba(180,197,255,0.04)",
          border: "1px solid rgba(180,197,255,0.1)",
          borderRadius: "8px",
          padding: "0.6rem 0.8rem"
        } }, c.thought_process.thinking)), c.thought_process.working && /* @__PURE__ */ React.createElement("details", { open: true }, /* @__PURE__ */ React.createElement("summary", { style: {
          cursor: "pointer",
          fontSize: "0.72rem",
          color: "rgba(251,191,36,0.6)",
          userSelect: "none",
          fontFamily: "Space Grotesk, sans-serif",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          listStyle: "none"
        } }, /* @__PURE__ */ React.createElement("span", { style: {
          display: "inline-block",
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "rgba(251,191,36,0.5)",
          flexShrink: 0
        } }), "\uC2E4\uD589 \uACFC\uC815 (Working)"), /* @__PURE__ */ React.createElement("div", { style: {
          fontFamily: '"JetBrains Mono", "SF Mono", monospace',
          fontSize: "0.78rem",
          color: "rgba(251,191,36,0.7)",
          marginTop: "0.45rem",
          whiteSpace: "pre-wrap",
          lineHeight: 1.65,
          background: "rgba(251,191,36,0.04)",
          border: "1px solid rgba(251,191,36,0.12)",
          borderRadius: "8px",
          padding: "0.6rem 0.8rem"
        } }, c.thought_process.working)))));
      })));
    })()), /* @__PURE__ */ React.createElement("div", { style: {
      background: "var(--bg-surface-2)",
      border: "1px solid var(--border)",
      borderRadius: "12px",
      padding: "0.8rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.6rem"
    } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "0.8rem", flexWrap: "wrap", marginBottom: "0.4rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem", color: "var(--text-muted)" } }, "view_column"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: commentColumn,
        onChange: (e) => {
          const val = e.target.value;
          if (val === "archive") {
            fetch(`${SERVER_URL}/api/tasks/${task.id}/archive`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ archivedBy: "CEO" })
            }).catch(console.error);
            patchTask(task.id, { status: "ARCHIVED" });
            setIsArchived(true);
            return;
          }
          setCommentColumn(val);
        },
        disabled: isArchived,
        style: { background: "var(--bg-surface-1)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.3rem 0.5rem", outline: "none", fontSize: "0.82rem", opacity: isArchived ? 0.5 : 1 }
      },
      /* @__PURE__ */ React.createElement("option", { value: "NO_CHANGE", style: { color: "var(--text-muted)" } }, "\uC0C1\uD0DC"),
      /* @__PURE__ */ React.createElement("option", { value: "todo" }, "\uC9C4\uD589 \uC804 (To Do)"),
      /* @__PURE__ */ React.createElement("option", { value: "in_progress" }, "\uC9C4\uD589 \uC911 (In Progress)"),
      /* @__PURE__ */ React.createElement("option", { value: "review" }, "\uC2B9\uC778 \uB300\uAE30 (Review)"),
      /* @__PURE__ */ React.createElement("option", { value: "done" }, "\uC644\uB8CC (Done)"),
      /* @__PURE__ */ React.createElement("option", { value: "archive", style: { color: "#F59E0B", fontWeight: 600 } }, "\u{1F4E6} \uC544\uCE74\uC774\uBE59")
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem", color: "var(--text-muted)" } }, "person"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: commentAssignee,
        onChange: (e) => setCommentAssignee(e.target.value),
        disabled: isArchived,
        style: { background: "var(--bg-surface-1)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.3rem 0.5rem", outline: "none", fontSize: "0.82rem" }
      },
      /* @__PURE__ */ React.createElement("option", { value: "NO_CHANGE", style: { color: "var(--text-muted)" } }, "\uB2F4\uB2F9"),
      /* @__PURE__ */ React.createElement("option", { value: "" }, "\uBBF8\uD560\uB2F9"),
      /* @__PURE__ */ React.createElement("option", { value: "CEO" }, "CEO"),
      Object.entries(useAgentStore.getState().agentMeta || {}).map(([id, m]) => /* @__PURE__ */ React.createElement("option", { key: id, value: id }, m.name || m.role || id))
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.4rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem", color: "var(--text-muted)" } }, "flag"), /* @__PURE__ */ React.createElement(
      "select",
      {
        value: commentPriority,
        onChange: (e) => setCommentPriority(e.target.value),
        style: { background: "var(--bg-surface-1)", color: "var(--text-primary)", border: "1px solid var(--border)", borderRadius: "6px", padding: "0.3rem 0.5rem", outline: "none", fontSize: "0.82rem" }
      },
      /* @__PURE__ */ React.createElement("option", { value: "NO_CHANGE", style: { color: "var(--text-muted)" } }, "\uC6B0\uC120\uC21C\uC704"),
      /* @__PURE__ */ React.createElement("option", { value: "low" }, "\uB0AE\uC74C"),
      /* @__PURE__ */ React.createElement("option", { value: "medium" }, "\uBCF4\uD1B5"),
      /* @__PURE__ */ React.createElement("option", { value: "high" }, "\uB192\uC74C")
    ))), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.6rem", padding: "0 0.2rem", marginBottom: "-0.3rem" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.75rem", fontWeight: 600, color: "var(--brand)", textTransform: "uppercase", letterSpacing: "0.04em" } }, selectedMode === "ARCHITECT" && "\u{1F4D0} \uAE30\uD68D \uBAA8\uB4DC", selectedMode === "DEV" && "\u{1F4BB} \uAC1C\uBC1C \uBAA8\uB4DC", selectedMode === "QA" && "\u{1F575}\uFE0F\u200D\u2642\uFE0F \uB9AC\uBDF0 \uBAA8\uB4DC", selectedMode === "DEBUG" && "\u{1F9F0} \uB514\uBC84\uAE45 \uBAA8\uB4DC"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.7rem", color: "var(--text-muted)" } }, "|"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.75rem", color: "var(--text-muted)" } }, selectedModel)), /* @__PURE__ */ React.createElement("div", { style: { position: "relative" } }, /* @__PURE__ */ React.createElement(
      "textarea",
      {
        ref: textareaRef,
        value: commentText,
        onChange: (e) => {
          const val = e.target.value;
          setCommentText(val);
          const refs = extractChainRefs(val);
          refs.forEach((refId) => contextChain.debouncedValidate(refId));
          const slashIdx = val.lastIndexOf("/");
          if (slashIdx !== -1) {
            const afterSlash = val.slice(slashIdx + 1);
            if (!afterSlash.includes(" ") && !afterSlash.includes("\n")) {
              setSlashQuery(afterSlash);
              setSlashTarget("comment");
              setShowSlash(true);
            } else {
              setShowSlash(false);
            }
          } else {
            setShowSlash(false);
          }
        },
        placeholder: "\uC5C5\uBB34 \uC9C0\uC2DC\uB098 \uD53C\uB4DC\uBC31\uC744 \uC804\uB2EC\uD558\uC138\uC694... (/\uCEE4\uB9E8\uB4DC \uD638\uCD9C \uAC00\uB2A5)",
        onKeyDown: (e) => {
          if (showSlash && slashTarget === "comment" && e.key === "Escape") {
            e.preventDefault();
            setShowSlash(false);
            return;
          }
          if (showSlash && slashTarget === "comment" && e.key === "Enter" && filteredSlash.length > 0) {
            e.preventDefault();
            const cmd = filteredSlash[0];
            setShowSlash(false);
            if (cmd.id === "/run" || cmd.id === "/run-b") {
              const pipelineMode = cmd.id === "/run-b" ? "run-b" : "run";
              const projectId2 = task?.project_id;
              const pendingMsg = pipelineMode === "run" ? `\u{1F680} /run \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 \uC694\uCCAD \u2014 PRD\u2192Advisor \uC790\uC728 \uC644\uC8FC \uBAA8\uB4DC` : `\u23F8 /run-b \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791 \uC694\uCCAD \u2014 \uB2E8\uACC4\uBCC4 CEO \uD655\uC778 \uBAA8\uB4DC`;
              setComments((prev) => [...prev, {
                author: "system",
                source: { id: "system", name: "system" },
                target: { id: "user-1", name: "CEO" },
                content: pendingMsg,
                created_at: (/* @__PURE__ */ new Date()).toISOString()
              }]);
              setActiveCommentTab("activity");
              setCommentText("");
              if (projectId2) {
                fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(projectId2)}/pipeline/${pipelineMode}`, {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ taskId: String(task.id) })
                }).then(async (res) => {
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || "\uC2E4\uD328");
                  const msg = pipelineMode === "run" ? `\u{1F680} /run \uD30C\uC774\uD504\uB77C\uC778 \uC2DC\uC791\uB428 \u2014 ${data.title || "PRD"}\uBD80\uD130 \uC790\uC728 \uC644\uC8FC` : `\u23F8 /run-b \uB2E8\uACC4\uBCC4 \uD655\uC778 \uBAA8\uB4DC \uC2DC\uC791\uB428`;
                  useTimelineStore.getState().appendTimeline({
                    level: "info",
                    message: msg,
                    agentId: "system",
                    timestamp: (/* @__PURE__ */ new Date()).toISOString(),
                    projectId: projectId2
                  });
                  setComments((prev) => [...prev, {
                    author: "system",
                    source: { id: "system", name: "system" },
                    target: { id: "user-1", name: "CEO" },
                    content: `\u2705 ${msg}`,
                    created_at: (/* @__PURE__ */ new Date()).toISOString()
                  }]);
                }).catch((err) => {
                  setComments((prev) => [...prev, {
                    author: "system",
                    source: { id: "system", name: "system" },
                    target: { id: "user-1", name: "CEO" },
                    content: `\u274C \uD30C\uC774\uD504\uB77C\uC778 \uC2E4\uD328: ${err.message}`,
                    created_at: (/* @__PURE__ */ new Date()).toISOString()
                  }]);
                });
              }
              return;
            }
            if (cmd.id === "/\uCF54\uB4DC") {
              const sIdx2 = commentText.lastIndexOf("/");
              const newText2 = commentText.slice(0, sIdx2) + "\n```typescript\n// \uC5EC\uAE30\uC5D0 \uCF54\uB4DC\uB97C \uC791\uC131\uD558\uC138\uC694\n\n```\n";
              setCommentText(newText2);
              return;
            }
            const sIdx = commentText.lastIndexOf("/");
            const newText = commentText.slice(0, sIdx) + `${cmd.id} `;
            setCommentText(newText);
            return;
          }
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleSubmitComment();
        },
        onBlur: () => setTimeout(() => setShowSlash(false), 150),
        disabled: isArchived,
        style: {
          width: "100%",
          background: "var(--bg-surface-1)",
          border: "1px solid var(--border)",
          borderRadius: "8px",
          resize: "none",
          outline: "none",
          color: "var(--text-primary)",
          fontSize: "1.05rem",
          fontFamily: "inherit",
          lineHeight: 1.5,
          minHeight: "80px",
          maxHeight: "200px",
          padding: "0.8rem",
          opacity: isArchived ? 0.45 : 1
        }
      }
    ), showSlash && slashTarget === "comment" && filteredSlash.length > 0 && /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: slashRef,
        style: {
          position: "absolute",
          bottom: "100%",
          left: 0,
          right: 0,
          marginBottom: 6,
          background: "var(--bg-surface-2)",
          border: "1px solid rgba(124,110,248,0.4)",
          borderRadius: 10,
          overflow: "hidden",
          zIndex: 200,
          boxShadow: "0 4px 20px rgba(0,0,0,0.35)"
        }
      },
      filteredSlash.map((cmd) => /* @__PURE__ */ React.createElement(
        "button",
        {
          key: cmd.id,
          onMouseDown: (e) => {
            e.preventDefault();
            if (cmd.id === "/\uCF54\uB4DC") {
              const sIdx = commentText.lastIndexOf("/");
              const newText = commentText.slice(0, sIdx) + "\n```typescript\n// \uC5EC\uAE30\uC5D0 \uCF54\uB4DC\uB97C \uC791\uC131\uD558\uC138\uC694\n\n```\n";
              setCommentText(newText);
            } else {
              const sIdx = commentText.lastIndexOf("/");
              const newText = commentText.slice(0, sIdx) + `${cmd.id} `;
              setCommentText(newText);
            }
            setShowSlash(false);
            setTimeout(() => textareaRef.current?.focus(), 0);
          },
          style: {
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            width: "100%",
            padding: "0.6rem 0.8rem",
            background: "transparent",
            border: "none",
            cursor: "pointer",
            color: "var(--text-primary)",
            fontSize: "0.88rem",
            textAlign: "left",
            transition: "background 0.12s",
            borderBottom: "1px solid var(--border)"
          },
          onMouseEnter: (e) => e.currentTarget.style.background = "rgba(124,110,248,0.15)",
          onMouseLeave: (e) => e.currentTarget.style.background = "transparent"
        },
        /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.2rem", color: "var(--brand)" } }, cmd.icon),
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", flexDirection: "column", gap: "0.1rem" } }, /* @__PURE__ */ React.createElement("span", { style: { fontWeight: 600, color: "var(--text-primary)" } }, cmd.id), /* @__PURE__ */ React.createElement("span", { style: { opacity: 0.6, fontSize: "0.75rem" } }, cmd.label))
      ))
    )), isArchived && /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      background: "rgba(245,158,11,0.12)",
      border: "1px solid rgba(245,158,11,0.35)",
      borderRadius: "8px",
      padding: "0.55rem 0.9rem",
      color: "#F59E0B",
      fontSize: "0.85rem",
      fontWeight: 600
    } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "inventory_2"), "\u{1F4E6} \uC544\uCE74\uC774\uBE59 \uC644\uB8CC \u2014 Obsidian\uC5D0 \uC800\uC7A5\uB429\uB2C8\uB2E4. X \uBC84\uD2BC\uC73C\uB85C \uB2EB\uC73C\uBA74 \uCE78\uBC18\uC5D0\uC11C \uC81C\uAC70\uB429\uB2C8\uB2E4."), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.2rem" } }, /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } }, /* @__PURE__ */ React.createElement(
      "button",
      {
        title: "\uC6CC\uD06C\uD50C\uB85C\uC6B0 \uBAA8\uB4DC \uC804\uD658",
        onClick: () => setShowModeSelector(!showModeSelector),
        style: { background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.3rem", borderRadius: "4px", transition: "background 0.2s" },
        onMouseEnter: (e) => e.currentTarget.style.background = "var(--bg-surface-1)",
        onMouseLeave: (e) => e.currentTarget.style.background = "transparent"
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.2rem" } }, "add_circle")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        title: "LLM \uBAA8\uB378 \uAD50\uCCB4",
        onClick: () => setShowModelSelector(!showModelSelector),
        style: { background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer", display: "flex", alignItems: "center", padding: "0.3rem", borderRadius: "4px", transition: "background 0.2s" },
        onMouseEnter: (e) => e.currentTarget.style.background = "var(--bg-surface-1)",
        onMouseLeave: (e) => e.currentTarget.style.background = "transparent"
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.2rem" } }, "keyboard_double_arrow_up")
    )), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem" } }, /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.74rem", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "0.2rem" } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.85rem" } }, "keyboard_command_key"), "+Enter \uC5C5\uB370\uC774\uD2B8 \uC804\uC1A1"), /* @__PURE__ */ React.createElement(
      "button",
      {
        onClick: handleSubmitComment,
        disabled: isArchived || commentColumn === "archive" || !commentText.trim() && Object.keys(task).length > 0 && commentColumn === task.column && commentAssignee === task.assignee && commentPriority === task.priority,
        style: {
          background: "var(--brand-dim, #2668ff)",
          color: "#ffffff",
          border: "none",
          borderRadius: "8px",
          padding: "0.4rem 1rem",
          cursor: "pointer",
          fontSize: "0.9rem",
          fontWeight: 700,
          fontFamily: "Space Grotesk, sans-serif",
          transition: "all 0.18s ease",
          letterSpacing: "0.02em",
          boxShadow: "0 2px 8px rgba(38,104,255,0.35)"
        },
        onMouseEnter: (e) => {
          e.currentTarget.style.background = "#1a52e8";
        },
        onMouseLeave: (e) => {
          e.currentTarget.style.background = "var(--brand-dim, #2668ff)";
        }
      },
      "\uC804\uC1A1"
    ))), showModeSelector && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.2rem" } }, ["ARCHITECT", "DEV", "QA", "DEBUG"].map((mode) => /* @__PURE__ */ React.createElement("button", { key: mode, onClick: () => {
      setSelectedMode(mode);
      setShowModeSelector(false);
    }, style: { fontSize: "0.75rem", padding: "0.3rem 0.6rem", borderRadius: "4px", background: selectedMode === mode ? "var(--brand)" : "var(--bg-surface-1)", color: selectedMode === mode ? "#fff" : "var(--text-primary)", border: "1px solid var(--border)", cursor: "pointer" } }, mode))), showModelSelector && /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "0.2rem" } }, ["Claude Opus 4.6 (Thinking)", "Claude Sonnet 4.6 (Thinking)", "Gemini 3.1 Pro"].map((model) => /* @__PURE__ */ React.createElement("button", { key: model, onClick: () => {
      setSelectedModel(model);
      setShowModelSelector(false);
    }, style: { fontSize: "0.75rem", padding: "0.3rem 0.6rem", borderRadius: "4px", background: selectedModel === model ? "var(--brand)" : "var(--bg-surface-1)", color: selectedModel === model ? "#fff" : "var(--text-primary)", border: "1px solid var(--border)", cursor: "pointer" } }, model))))), (isPreviewMode || isChainMode) && /* @__PURE__ */ React.createElement(
      "div",
      {
        ref: resizerRef,
        onMouseDown: handleResizerMouseDown,
        title: "\uB4DC\uB798\uADF8\uD574\uC11C \uD06C\uAE30 \uC870\uC808",
        style: {
          width: "5px",
          flexShrink: 0,
          background: "rgba(180,197,255,0.12)",
          cursor: "col-resize",
          transition: "background 0.15s",
          position: "relative",
          zIndex: 10
        },
        onMouseEnter: (e) => e.currentTarget.style.background = "rgba(100,135,242,0.35)",
        onMouseLeave: (e) => {
          if (!isDragging.current) e.currentTarget.style.background = "rgba(180,197,255,0.12)";
        }
      },
      /* @__PURE__ */ React.createElement("div", { style: {
        position: "absolute",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        display: "flex",
        flexDirection: "column",
        gap: "4px"
      } }, [0, 1, 2].map((i) => /* @__PURE__ */ React.createElement("div", { key: i, style: { width: "3px", height: "3px", borderRadius: "50%", background: "rgba(180,197,255,0.5)" } })))
    ), isChainMode && !isPreviewMode && /* @__PURE__ */ React.createElement("div", { style: {
      flex: `0 0 ${100 - splitRatio}%`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minWidth: 0,
      background: "var(--bg-base)",
      borderLeft: "1px solid var(--border)"
    } }, /* @__PURE__ */ React.createElement(
      ContextChainPanel,
      {
        activeRef: contextChain.activeRef,
        chainData: contextChain.chainData,
        isLoading: contextChain.isLoading,
        canGoBack: contextChain.canGoBack,
        onNavigate: (refId) => contextChain.navigateTo(refId),
        onBack: contextChain.navigateBack,
        onClose: contextChain.closePanel
      }
    )), isPreviewMode && /* @__PURE__ */ React.createElement("div", { style: {
      flex: `0 0 ${100 - splitRatio}%`,
      display: "flex",
      flexDirection: "column",
      overflow: "hidden",
      minWidth: 0,
      background: "var(--bg-base)",
      borderLeft: "1px solid var(--border)"
    } }, /* @__PURE__ */ React.createElement("div", { style: {
      display: "flex",
      alignItems: "center",
      gap: "0.5rem",
      padding: "0.45rem 0.8rem",
      background: "var(--bg-surface-2)",
      borderBottom: "1px solid var(--border)",
      flexShrink: 0
    } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.9rem", color: "var(--brand)", opacity: 0.8 } }, "preview"), /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.72rem", color: "var(--text-muted)", fontFamily: "SF Mono, monospace", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" } }, previewUrl), /* @__PURE__ */ React.createElement(
      "button",
      {
        id: "btn-preview-refresh",
        onClick: handlePreviewRefresh,
        title: "\uC0C8\uB85C\uACE0\uCE68 (\uC5D0\uC774\uC804\uD2B8\uAC00 \uD30C\uC77C\uC744 \uC5C5\uB370\uC774\uD2B8\uD55C \uACBD\uC6B0)",
        style: {
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          padding: "4px",
          borderRadius: "6px",
          transition: "all 0.15s"
        },
        onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.07)",
        onMouseLeave: (e) => e.currentTarget.style.background = "none"
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.05rem" } }, "refresh")
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        id: "btn-preview-new-tab",
        onClick: () => window.open(previewUrl, "_blank"),
        title: "\uC0C8 \uD0ED\uC5D0\uC11C \uC5F4\uAE30",
        style: {
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--text-muted)",
          display: "flex",
          alignItems: "center",
          padding: "4px",
          borderRadius: "6px",
          transition: "all 0.15s"
        },
        onMouseEnter: (e) => e.currentTarget.style.background = "rgba(255,255,255,0.07)",
        onMouseLeave: (e) => e.currentTarget.style.background = "none"
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1.05rem" } }, "open_in_new")
    )), previewError ? (
      /* Empty State: OUTPUT/index.html 없을 때 */
      /* @__PURE__ */ React.createElement("div", { style: {
        flex: 1,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.75rem",
        padding: "2rem",
        color: "var(--text-muted)"
      } }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "2.5rem", opacity: 0.4 } }, "web_asset_off"), /* @__PURE__ */ React.createElement("div", { style: { textAlign: "center" } }, /* @__PURE__ */ React.createElement("div", { style: { fontWeight: 700, fontSize: "0.9rem", marginBottom: "0.35rem", color: "var(--text-secondary)" } }, "\uC544\uC9C1 OUTPUT/index.html\uC774 \uC5C6\uC5B4\uC694"), /* @__PURE__ */ React.createElement("div", { style: { fontSize: "0.78rem", lineHeight: 1.6 } }, "\uC5D0\uC774\uC804\uD2B8\uAC00 \uCF54\uB4DC\uB97C \uC0DD\uC131\uD558\uBA74 \uC790\uB3D9\uC73C\uB85C \uD45C\uC2DC\uB429\uB2C8\uB2E4.", /* @__PURE__ */ React.createElement("br", null), "\uC0DD\uC131 \uD6C4 ", /* @__PURE__ */ React.createElement("strong", null, "\uC0C8\uB85C\uACE0\uCE68"), " \uBC84\uD2BC\uC744 \uB20C\uB7EC\uC8FC\uC138\uC694.")), /* @__PURE__ */ React.createElement(
        "button",
        {
          onClick: handlePreviewRefresh,
          style: {
            marginTop: "0.5rem",
            padding: "0.5rem 1.2rem",
            background: "rgba(100,135,242,0.12)",
            border: "1px solid rgba(100,135,242,0.3)",
            borderRadius: "8px",
            color: "var(--brand)",
            cursor: "pointer",
            fontSize: "0.82rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            transition: "all 0.15s"
          }
        },
        /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "refresh"),
        "\uB2E4\uC2DC \uC2DC\uB3C4"
      ))
    ) : /* @__PURE__ */ React.createElement(
      "iframe",
      {
        ref: iframeRef,
        src: previewUrl,
        title: `\uD504\uB9AC\uBDF0 \u2014 ${task?.title || "Task"}`,
        style: { flex: 1, width: "100%", border: "none", background: "#fff" },
        sandbox: "allow-scripts allow-same-origin allow-forms allow-popups",
        onError: () => setPreviewError(true)
      }
    ))), isReview && /* @__PURE__ */ React.createElement("div", { className: "modal__footer" }, /* @__PURE__ */ React.createElement("div", { className: "modal__review-zone" }, showReworkInput ? /* @__PURE__ */ React.createElement("div", { className: "modal__rework-input-row" }, /* @__PURE__ */ React.createElement(
      "input",
      {
        className: "modal__rework-input",
        placeholder: "\uC7AC\uC791\uC5C5 \uC0AC\uC720 (\uC120\uD0DD)",
        value: reworkReason,
        onChange: (e) => setReworkReason(e.target.value),
        onKeyDown: (e) => {
          if (e.key === "Enter") handleRework();
          if (e.key === "Escape") setShowReworkInput(false);
        },
        autoFocus: true
      }
    ), /* @__PURE__ */ React.createElement("button", { className: "modal-btn modal-btn--rework", onClick: handleRework }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "refresh"), "\uC804\uC1A1"), /* @__PURE__ */ React.createElement("button", { className: "modal-btn modal-btn--ghost", onClick: () => setShowReworkInput(false) }, "\uCDE8\uC18C")) : /* @__PURE__ */ React.createElement("div", { className: "modal__review-btns" }, /* @__PURE__ */ React.createElement("button", { className: "modal-btn modal-btn--approve", onClick: handleApprove }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "check_circle"), "\uC2B9\uC778"), /* @__PURE__ */ React.createElement("button", { className: "modal-btn modal-btn--rework", onClick: () => setShowReworkInput(true) }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "1rem" } }, "refresh"), "\uC7AC\uC791\uC5C5")))))
  );
}
export {
  TaskDetailModal as default
};
