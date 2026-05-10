import { useMemo, useState, useEffect } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useUiStore } from "../../store/uiStore";
const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:4000";
const IcoArchive = () => /* @__PURE__ */ React.createElement("svg", { width: "48", height: "48", viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: "1.2", strokeLinecap: "round", strokeLinejoin: "round" }, /* @__PURE__ */ React.createElement("rect", { x: "2", y: "3", width: "20", height: "4", rx: "1" }), /* @__PURE__ */ React.createElement("path", { d: "M4 7v12a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V7" }), /* @__PURE__ */ React.createElement("path", { d: "M10 12h4" }));
function ArchiveView() {
  const projects = useProjectStore((s) => s.projects);
  const selectedProjectId = useProjectStore((s) => s.selectedProjectId);
  const { setActiveDetailTaskId } = useUiStore();
  const [archivedTasks, setArchivedTasks] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("graph");
  const projectMap = useMemo(() => {
    const map = {};
    projects.forEach((p) => {
      map[p.id] = p.name;
    });
    return map;
  }, [projects]);
  useEffect(() => {
    const fetchArchivedTasks = async () => {
      if (!selectedProjectId) return;
      try {
        setIsLoading(true);
        const res = await fetch(`${SERVER_URL}/api/tasks/archived?project_id=${selectedProjectId}`);
        if (!res.ok) throw new Error("Network response was not ok");
        const data = await res.json();
        if (data.status === "ok") {
          setArchivedTasks(data.tasks || []);
        }
      } catch (err) {
        console.error("Failed to fetch archived tasks:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchArchivedTasks();
  }, [selectedProjectId]);
  const selectedProject = projects.find((p) => p.id === selectedProjectId);
  const graphUrl = selectedProject ? `/preview/${selectedProject.id}/OUTPUT/graph.html` : "";
  return /* @__PURE__ */ React.createElement("div", { className: "archive-view", style: { display: "flex", flexDirection: "column", height: "100%" } }, /* @__PURE__ */ React.createElement("div", { className: "board-header" }, /* @__PURE__ */ React.createElement("h2", { className: "board-header__title" }, "Knowledge Hub"), /* @__PURE__ */ React.createElement("p", { className: "board-header__subtitle" }, "\uD504\uB85C\uC81D\uD2B8 \uC9C0\uC2DD \uADF8\uB798\uD504 \uBC0F \uC544\uCE74\uC774\uBE0C\uB41C \uC5C5\uBB34 \uBCF4\uAD00\uC18C")), /* @__PURE__ */ React.createElement("div", { style: { display: "flex", gap: "1rem", marginTop: "1rem", borderBottom: "1px solid var(--border)", paddingBottom: "0.5rem" } }, /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setActiveTab("graph"),
      style: {
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: "1rem",
        fontWeight: activeTab === "graph" ? 700 : 500,
        color: activeTab === "graph" ? "var(--brand)" : "var(--text-muted)",
        padding: "0.5rem 1rem",
        position: "relative"
      }
    },
    "Knowledge Graph (AST)",
    activeTab === "graph" && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", bottom: "-0.5rem", left: 0, right: 0, height: "2px", background: "var(--brand)" } })
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      onClick: () => setActiveTab("tasks"),
      style: {
        background: "transparent",
        border: "none",
        cursor: "pointer",
        fontSize: "1rem",
        fontWeight: activeTab === "tasks" ? 700 : 500,
        color: activeTab === "tasks" ? "var(--brand)" : "var(--text-muted)",
        padding: "0.5rem 1rem",
        position: "relative"
      }
    },
    "Archived Tasks (",
    archivedTasks.length,
    ")",
    activeTab === "tasks" && /* @__PURE__ */ React.createElement("div", { style: { position: "absolute", bottom: "-0.5rem", left: 0, right: 0, height: "2px", background: "var(--brand)" } })
  )), /* @__PURE__ */ React.createElement("div", { className: "archive-content", style: { flex: 1, overflow: "hidden", marginTop: "1rem" } }, activeTab === "graph" ? /* @__PURE__ */ React.createElement("div", { className: "glass-panel", style: { width: "100%", height: "100%", overflow: "hidden", padding: 0 } }, selectedProjectId ? /* @__PURE__ */ React.createElement(
    "iframe",
    {
      src: graphUrl,
      title: "Knowledge Graph",
      style: { width: "100%", height: "100%", border: "none" },
      sandbox: "allow-scripts allow-same-origin",
      onError: (e) => console.warn("\uADF8\uB798\uD504 \uB80C\uB354\uB9C1 \uC2E4\uD328 (\uC544\uC9C1 \uD30C\uC77C\uC774 \uC5C6\uAC70\uB098 \uC6CC\uCE58\uB3C5 \uC2E4\uD589 \uC804\uC785\uB2C8\uB2E4)", e)
    }
  ) : /* @__PURE__ */ React.createElement("div", { className: "view-empty" }, /* @__PURE__ */ React.createElement("p", null, "\uD504\uB85C\uC81D\uD2B8\uB97C \uC120\uD0DD\uD574\uC8FC\uC138\uC694."))) : /* @__PURE__ */ React.createElement("div", { className: "archive-table glass-panel", style: { height: "100%", overflow: "auto" } }, isLoading ? /* @__PURE__ */ React.createElement("div", { className: "view-empty" }, /* @__PURE__ */ React.createElement("p", null, "\uB370\uC774\uD130\uB97C \uBD88\uB7EC\uC624\uB294 \uC911\uC785\uB2C8\uB2E4...")) : archivedTasks.length === 0 ? /* @__PURE__ */ React.createElement("div", { className: "view-empty" }, /* @__PURE__ */ React.createElement(IcoArchive, null), /* @__PURE__ */ React.createElement("p", null, "\uC544\uC9C1 \uC544\uCE74\uC774\uBE0C\uB41C Task\uAC00 \uC5C6\uC2B5\uB2C8\uB2E4.")) : /* @__PURE__ */ React.createElement("table", { className: "data-table" }, /* @__PURE__ */ React.createElement("thead", null, /* @__PURE__ */ React.createElement("tr", null, /* @__PURE__ */ React.createElement("th", null, "#ID"), /* @__PURE__ */ React.createElement("th", null, "\uD0C0\uC774\uD2C0"), /* @__PURE__ */ React.createElement("th", null, "\uD504\uB85C\uC81D\uD2B8"), /* @__PURE__ */ React.createElement("th", null, "\uB2F4\uB2F9"), /* @__PURE__ */ React.createElement("th", null, "\uACB0\uACFC"))), /* @__PURE__ */ React.createElement("tbody", null, archivedTasks.map((task) => {
    const projectName = task.projectId ? projectMap[task.projectId] || "\u2014" : "\u2014";
    return /* @__PURE__ */ React.createElement(
      "tr",
      {
        key: task.id,
        onClick: () => setActiveDetailTaskId(task.id),
        style: { cursor: "pointer" },
        className: "archive-table-row"
      },
      /* @__PURE__ */ React.createElement("td", { className: "data-table__id" }, "#", task.id),
      /* @__PURE__ */ React.createElement("td", { className: "data-table__content" }, task.title || task.content),
      /* @__PURE__ */ React.createElement("td", { className: "data-table__project" }, projectName),
      /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: `exec-badge exec-badge--${task.executionMode || "ari"}` }, task.executionMode === "omo" ? "Dev Team" : "Ari")),
      /* @__PURE__ */ React.createElement("td", null, /* @__PURE__ */ React.createElement("span", { className: "status-badge", style: { backgroundColor: "#F59E0B", color: "#fff", border: "none" } }, "\u{1F4E6} ARCHIVED"))
    );
  }))))));
}
export {
  ArchiveView as default
};
