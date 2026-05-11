import { useState } from "react";
import { useProjectStore } from "../../store/projectStore";
import { useAgentStore } from "../../store/agentStore";
import { useKanbanStore } from "../../store/kanbanStore";
import { useUiStore } from "../../store/uiStore";
import { getRoleData, inferProjectType } from "../../data/roleRegistry";
function Sidebar() {
  const { projects, selectedProjectId, selectProject, deleteProject, allCrews } = useProjectStore();
  const { agents, selectedAgentId, selectAgent, clearAgentSelection } = useAgentStore();
  const { currentView, setCurrentView, workspaceName, workspaceLogo } = useUiStore();
  const [isProjectsCollapsed, setIsProjectsCollapsed] = useState(false);
  const [collapsedTeams, setCollapsedTeams] = useState({});
  const toggleTeam = (projectId) => {
    setCollapsedTeams((prev) => ({ ...prev, [projectId]: !prev[projectId] }));
  };
  const handleAddProject = () => {
    window.dispatchEvent(new CustomEvent("openNewProjectModal"));
  };
  const handleAgentClick = (agentId) => {
    selectAgent(agentId);
    setCurrentView("agent-detail");
  };
  const handleNavClick = (view) => {
    clearAgentSelection();
    setCurrentView(view);
  };
  return /* @__PURE__ */ React.createElement("aside", { className: "sidebar" }, /* @__PURE__ */ React.createElement("div", { className: "sidebar__workspace" }, /* @__PURE__ */ React.createElement("div", { className: "sidebar__workspace-logo", style: workspaceLogo ? { background: "transparent" } : {} }, workspaceLogo ? /* @__PURE__ */ React.createElement("img", { src: workspaceLogo, alt: "Logo", style: { width: "100%", height: "100%", objectFit: "contain" } }) : /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.9rem" } }, "terminal")), /* @__PURE__ */ React.createElement("span", { className: "sidebar__workspace-name" }, workspaceName || "Socian")), /* @__PURE__ */ React.createElement("nav", { className: "sidebar__nav" }, /* @__PURE__ */ React.createElement("div", { className: "sidebar__section-header" }, /* @__PURE__ */ React.createElement("span", { className: "sidebar__section-label" }, "Navigation")), /* @__PURE__ */ React.createElement("div", { className: "sidebar__projects-row" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `sidebar__nav-item sidebar__nav-item--group ${currentView === "projects" ? "sidebar__nav-item--active" : ""}`,
      onClick: () => handleNavClick("projects"),
      style: { flex: 1 }
    },
    /* @__PURE__ */ React.createElement(
      "span",
      {
        className: "material-symbols-outlined sidebar__nav-icon",
        style: { fontVariationSettings: currentView === "projects" ? "'FILL' 1" : "'FILL' 0" }
      },
      "folder_open"
    ),
    "Projects"
  ), /* @__PURE__ */ React.createElement("div", { className: "sidebar__projects-actions" }, /* @__PURE__ */ React.createElement("button", { className: "sidebar__icon-btn", title: "\uC0C8 \uD504\uB85C\uC81D\uD2B8 \uC0DD\uC131", onClick: handleAddProject, "aria-label": "\uD504\uB85C\uC81D\uD2B8 \uCD94\uAC00" }, /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.9rem" } }, "add")), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: "sidebar__icon-btn",
      title: isProjectsCollapsed ? "\uD3BC\uCE58\uAE30" : "\uC811\uAE30",
      onClick: () => setIsProjectsCollapsed(!isProjectsCollapsed),
      "aria-label": "\uD504\uB85C\uC81D\uD2B8 \uBAA9\uB85D \uC811\uAE30/\uD3BC\uCE58\uAE30"
    },
    /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.9rem" } }, isProjectsCollapsed ? "expand_more" : "expand_less")
  ))), !isProjectsCollapsed && /* @__PURE__ */ React.createElement("div", { className: "sidebar__project-list" }, projects.map((p) => /* @__PURE__ */ React.createElement("div", { key: p.id, className: "sidebar__project-row" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `sidebar__project-item ${selectedProjectId === p.id && currentView === "projects" ? "sidebar__project-item--active" : ""}`,
      onClick: () => {
        selectProject(p.id);
        handleNavClick("projects");
      },
      style: { flex: 1 }
    },
    /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.75rem", opacity: 0.5 } }, "fiber_manual_record"),
    /* @__PURE__ */ React.createElement("span", { className: "sidebar__project-name" }, p.name)
  )))), /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `sidebar__nav-item ${currentView === "archive" ? "sidebar__nav-item--active" : ""}`,
      onClick: () => handleNavClick("archive")
    },
    /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined sidebar__nav-icon", style: { fontVariationSettings: currentView === "archive" ? "'FILL' 1" : "'FILL' 0" } }, "inventory_2"),
    "Knowledge Hub",
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.6rem", fontWeight: 700, padding: "1px 5px", borderRadius: "3px", background: "rgba(180,197,255,0.15)", color: "var(--brand)", fontFamily: "Space Grotesk", letterSpacing: "0.04em", marginLeft: "2px" } }, "NEW")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      id: "sidebar-image-lab",
      className: `sidebar__nav-item ${currentView === "image-lab" ? "sidebar__nav-item--active" : ""}`,
      onClick: () => handleNavClick("image-lab")
    },
    /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined sidebar__nav-icon", style: { fontVariationSettings: currentView === "image-lab" ? "'FILL' 1" : "'FILL' 0" } }, "experiment"),
    "Image Lab",
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.6rem", fontWeight: 700, padding: "1px 5px", borderRadius: "3px", background: "rgba(180,197,255,0.15)", color: "var(--brand)", fontFamily: "Space Grotesk", letterSpacing: "0.04em", marginLeft: "2px" } }, "BETA")
  ), /* @__PURE__ */ React.createElement(
    "button",
    {
      id: "sidebar-video-lab",
      className: `sidebar__nav-item ${currentView === "video-lab" ? "sidebar__nav-item--active" : ""}`,
      onClick: () => handleNavClick("video-lab")
    },
    /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined sidebar__nav-icon", style: { fontVariationSettings: currentView === "video-lab" ? "'FILL' 1" : "'FILL' 0" } }, "movie_filter"),
    "Video Lab",
    /* @__PURE__ */ React.createElement("span", { style: { fontSize: "0.6rem", fontWeight: 700, padding: "1px 5px", borderRadius: "3px", background: "rgba(238,42,123,0.15)", color: "#f472b6", fontFamily: "Space Grotesk", letterSpacing: "0.04em", marginLeft: "2px" } }, "P1")
  ), /* @__PURE__ */ React.createElement("div", { className: "sidebar__section-header sidebar__section-header--mt" }, /* @__PURE__ */ React.createElement("span", { className: "sidebar__section-label" }, "AI Crew")), projects.map((project) => {
    const teamName = `${project.name}\uD300`;
    const crew = allCrews[project.id] || [];
    const isCollapsed = collapsedTeams[project.id] ?? false;
    return /* @__PURE__ */ React.createElement("div", { key: project.id, style: { marginBottom: "0.2rem" } }, /* @__PURE__ */ React.createElement("div", { className: "sidebar__projects-row" }, /* @__PURE__ */ React.createElement(
      "button",
      {
        className: `sidebar__nav-item sidebar__nav-item--group ${currentView === "organization" && selectedProjectId === project.id ? "sidebar__nav-item--active" : ""}`,
        onClick: () => {
          selectProject(project.id);
          handleNavClick("organization");
        },
        style: { flex: 1 }
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined sidebar__nav-icon", style: { fontVariationSettings: "'FILL' 0", fontSize: "1rem" } }, "group"),
      teamName
    ), /* @__PURE__ */ React.createElement(
      "button",
      {
        className: "sidebar__icon-btn",
        title: isCollapsed ? "\uD300 \uD3BC\uCE58\uAE30" : "\uD300 \uC811\uAE30",
        onClick: () => toggleTeam(project.id),
        "aria-label": "\uD300 \uC811\uAE30/\uD3BC\uCE58\uAE30"
      },
      /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined", style: { fontSize: "0.9rem" } }, isCollapsed ? "expand_more" : "expand_less")
    )), !isCollapsed && /* @__PURE__ */ React.createElement("div", { className: "sidebar__project-list", style: { marginBottom: 0 } }, crew.length === 0 ? /* @__PURE__ */ React.createElement("div", { style: { padding: "0.3rem 1.2rem", fontSize: "0.7rem", color: "var(--text-muted)", opacity: 0.5 } }, "\uD300\uC6D0 \uC5C6\uC74C") : crew.map((member) => {
      const instanceId = (member.id || member.agent_id)?.toLowerCase();
      const baseRoleId = (member.role_id || member.agent_id || instanceId)?.toLowerCase().replace(/^proj-\d+-/, "");
      const agentState = agents[baseRoleId];
      const isActive = agentState?.status === "active";
      const projectType = inferProjectType(project.name, project.isolation_scope || "");
      const roleData = getRoleData(baseRoleId, projectType);
      const rawRole = (member.role_description || member.experiment_role || "").trim();
      const firstClause = rawRole.split(/[,\.\n\r\-\u2013\u2014(]/)[0].trim();
      const words = firstClause.split(/\s+/);
      const fallbackRole = words.length > 3 ? words.slice(0, 2).join(" ") : firstClause;
      const displayName = member.nickname || roleData?.mainRole || fallbackRole || baseRoleId?.toUpperCase();
      const roleSub = null;
      return /* @__PURE__ */ React.createElement(
        "button",
        {
          key: `${project.id}-${baseRoleId}`,
          className: `sidebar__project-item ${selectedAgentId === baseRoleId && selectedProjectId === project.id && currentView === "agent-detail" ? "sidebar__project-item--active" : ""}`,
          onClick: () => {
            selectProject(project.id);
            handleAgentClick(baseRoleId);
          },
          style: { width: "100%", flexDirection: "column", alignItems: "flex-start", gap: "0.1rem", padding: "0.35rem 0.8rem" }
        },
        /* @__PURE__ */ React.createElement("div", { style: { display: "flex", alignItems: "center", gap: "0.5rem", width: "100%" } }, /* @__PURE__ */ React.createElement(
          "span",
          {
            className: `sidebar__agent-dot sidebar__agent-dot--${isActive ? "active" : "idle"}`,
            style: { flexShrink: 0 }
          }
        ), /* @__PURE__ */ React.createElement(
          "span",
          {
            className: "sidebar__project-name",
            style: { flex: 1, fontWeight: selectedAgentId === baseRoleId ? 600 : 500, fontSize: "0.82rem" }
          },
          displayName
        )),
        roleSub && /* @__PURE__ */ React.createElement("div", { title: roleSub, style: { paddingLeft: "1.2rem", fontSize: "0.68rem", color: "var(--text-muted)", textAlign: "left", width: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } }, roleSub)
      );
    })));
  })), /* @__PURE__ */ React.createElement("div", { className: "sidebar__footer" }, /* @__PURE__ */ React.createElement(
    "button",
    {
      className: `sidebar__footer-settings ${currentView === "settings" ? "sidebar__nav-item--active" : ""}`,
      onClick: () => handleNavClick("settings")
    },
    /* @__PURE__ */ React.createElement("span", { className: "material-symbols-outlined sidebar__nav-icon", style: { fontVariationSettings: currentView === "settings" ? "'FILL' 1" : "'FILL' 0" } }, "settings"),
    /* @__PURE__ */ React.createElement("span", null, "Settings")
  ), /* @__PURE__ */ React.createElement("div", { className: "sidebar__user", style: { paddingRight: "0.9rem", justifyContent: "flex-start" } }, /* @__PURE__ */ React.createElement("span", { className: "sidebar__user-email" }, "admin@mycrew.run")), /* @__PURE__ */ React.createElement("div", { className: "sidebar__powered" }, "Powered by ", /* @__PURE__ */ React.createElement("strong", null, "MyCrew"))));
}
export {
  Sidebar as default
};
