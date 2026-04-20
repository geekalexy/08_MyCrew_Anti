// src/components/Sidebar/Sidebar.jsx — v7 (에이전트명 편집 → 에이전트 상세 페이지로 이전)
import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useAgentStore } from '../../store/agentStore';
import { useKanbanStore } from '../../store/kanbanStore';
import { useUiStore } from '../../store/uiStore';

export default function Sidebar() {
  const { projects, selectedProjectId, selectProject, addProject, deleteProject } = useProjectStore();
  const { agents, selectedAgentId, selectAgent, clearAgentSelection, agentMeta } = useAgentStore();
  const tasks = useKanbanStore((s) => s.tasks);
  const { currentView, setCurrentView, workspaceName, workspaceLogo, teamPageTitle } = useUiStore();

  // Projects 상태
  const [newProjectName, setNewProjectName] = useState('');
  const [isAddingProject, setIsAddingProject] = useState(false);
  const [isProjectsCollapsed, setIsProjectsCollapsed] = useState(false);
  // Team 상태
  const [isTeamCollapsed, setIsTeamCollapsed] = useState(false);

  const doneTasks = Object.values(tasks).filter((t) => t.column === 'done');

  const handleAddProject = (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    const id = addProject(newProjectName.trim());
    selectProject(id);
    setNewProjectName('');
    setIsAddingProject(false);
  };

  const handleAgentClick = (agentId) => {
    selectAgent(agentId);
    setCurrentView('agent-detail');
  };

  const handleNavClick = (view) => {
    clearAgentSelection();
    setCurrentView(view);
  };

  const handleAddTeam = () => {
    handleNavClick('organization');
  };


  return (
    <aside className="sidebar">
      {/* ── 워크스페이스 헤더 ──────────────────────────── */}
      <div className="sidebar__workspace">
        <div className="sidebar__workspace-logo" style={workspaceLogo ? { background: 'transparent' } : {}}>
          {workspaceLogo ? (
            <img src={workspaceLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>terminal</span>
          )}
        </div>
        <span className="sidebar__workspace-name" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
          {workspaceName || 'Socian'}
        </span>
      </div>

      {/* ── 내비게이션 ──────────────────────────────────── */}
      <nav className="sidebar__nav">

        <div className="sidebar__section-header">
          <span className="sidebar__section-label">Navigation</span>
        </div>

        {/* Projects 행 */}
        <div className="sidebar__projects-row">
          <button
            className={`sidebar__nav-item sidebar__nav-item--group ${currentView === 'projects' ? 'sidebar__nav-item--active' : ''}`}
            onClick={() => handleNavClick('projects')}
            style={{ flex: 1 }}
          >
            <span
              className="material-symbols-outlined sidebar__nav-icon"
              style={{ fontVariationSettings: currentView === 'projects' ? "'FILL' 1" : "'FILL' 0" }}
            >
              folder_open
            </span>
            Projects
          </button>
          <div className="sidebar__projects-actions">
            <button
              className="sidebar__icon-btn"
              title={isAddingProject ? '취소' : '새 프로젝트 추가'}
              onClick={() => {
                if (isAddingProject) { setIsAddingProject(false); setNewProjectName(''); }
                else { setIsAddingProject(true); }
              }}
              aria-label={isAddingProject ? '취소' : '프로젝트 추가'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                {isAddingProject ? 'close' : 'add'}
              </span>
            </button>
            <button
              className="sidebar__icon-btn"
              title={isProjectsCollapsed ? '펼치기' : '접기'}
              onClick={() => setIsProjectsCollapsed(!isProjectsCollapsed)}
              aria-label="프로젝트 목록 접기/펼치기"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                {isProjectsCollapsed ? 'expand_more' : 'expand_less'}
              </span>
            </button>
          </div>
        </div>

        {!isProjectsCollapsed && (
          <div className="sidebar__project-list">
            {isAddingProject && (
              <form onSubmit={handleAddProject} className="sidebar__add-form">
                <input
                  className="sidebar__add-input"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  placeholder="프로젝트 이름..."
                  autoFocus
                  onKeyDown={(e) => e.key === 'Escape' && setIsAddingProject(false)}
                />
              </form>
            )}
            {projects.map((p) => (
              <div key={p.id} className="sidebar__project-row">
                <button
                  className={`sidebar__project-item ${selectedProjectId === p.id && currentView === 'projects' ? 'sidebar__project-item--active' : ''}`}
                  onClick={() => { selectProject(p.id); handleNavClick('projects'); }}
                  style={{ flex: 1 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.75rem', opacity: 0.5 }}>fiber_manual_record</span>
                  <span className="sidebar__project-name">{p.name}</span>
                </button>
                <button
                  className="sidebar__project-delete"
                  title="프로젝트 삭제"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (window.confirm(`'${p.name}' 프로젝트를 삭제할까요?`)) deleteProject(p.id);
                  }}
                  aria-label="삭제"
                >
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Archive */}
        <button
          className={`sidebar__nav-item ${currentView === 'archive' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => handleNavClick('archive')}
        >
          <span className="material-symbols-outlined sidebar__nav-icon" style={{ fontVariationSettings: currentView === 'archive' ? "'FILL' 1" : "'FILL' 0" }}>archive</span>
          Archive
          {doneTasks.length > 0 && (
            <span className="sidebar__badge">{doneTasks.length}</span>
          )}
        </button>

        {/* Image Lab */}
        <button
          id="sidebar-image-lab"
          className={`sidebar__nav-item ${currentView === 'image-lab' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => handleNavClick('image-lab')}
        >
          <span
            className="material-symbols-outlined sidebar__nav-icon"
            style={{ fontVariationSettings: currentView === 'image-lab' ? "'FILL' 1" : "'FILL' 0" }}
          >
            experiment
          </span>
          Image Lab
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
            background: 'rgba(180,197,255,0.15)', color: 'var(--brand)',
            fontFamily: 'Space Grotesk', letterSpacing: '0.04em', marginLeft: '2px',
          }}>BETA</span>
        </button>

        {/* Video Lab */}
        <button
          id="sidebar-video-lab"
          className={`sidebar__nav-item ${currentView === 'video-lab' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => handleNavClick('video-lab')}
        >
          <span
            className="material-symbols-outlined sidebar__nav-icon"
            style={{ fontVariationSettings: currentView === 'video-lab' ? "'FILL' 1" : "'FILL' 0" }}
          >
            movie_filter
          </span>
          Video Lab
          <span style={{
            fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px',
            background: 'rgba(238,42,123,0.15)', color: '#f472b6',
            fontFamily: 'Space Grotesk', letterSpacing: '0.04em', marginLeft: '2px',
          }}>P1</span>
        </button>


        {/* AI Crew 섹션 */}
        <div className="sidebar__section-header sidebar__section-header--mt">
          <span className="sidebar__section-label">AI Crew</span>
        </div>

        {/* ── Team 행: Projects와 동일한 +/접기 패턴 ─────── */}
        <div className="sidebar__projects-row">
          <button
            className={`sidebar__nav-item sidebar__nav-item--group ${currentView === 'organization' ? 'sidebar__nav-item--active' : ''}`}
            onClick={() => handleNavClick('organization')}
            style={{ flex: 1 }}
          >
            <span
              className="material-symbols-outlined sidebar__nav-icon"
              style={{ fontVariationSettings: currentView === 'organization' ? "'FILL' 1" : "'FILL' 0" }}
            >
              group
            </span>
            {teamPageTitle || 'Team'}
          </button>
          <div className="sidebar__projects-actions">
            <button
              className="sidebar__icon-btn"
              title="새 팀 만들기"
              onClick={handleAddTeam}
              aria-label="새 팀 만들기"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add</span>
            </button>
            <button
              className="sidebar__icon-btn"
              title={isTeamCollapsed ? '팀 목록 펼치기' : '팀 목록 접기'}
              onClick={() => setIsTeamCollapsed(!isTeamCollapsed)}
              aria-label="팀 목록 접기/펼치기"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                {isTeamCollapsed ? 'expand_more' : 'expand_less'}
              </span>
            </button>
          </div>
        </div>

        {/* 에이전트 목록 (접기 적용) */}
        {!isTeamCollapsed && (
          <div className="sidebar__project-list" style={{ marginBottom: 0 }}>
            {Object.keys(agentMeta).map((agentId) => {
              const meta = agentMeta[agentId];
              const agentState = agents[agentId];
              const isActive = agentState?.status === 'active';

              return (
                <button
                  key={agentId}
                  className={`sidebar__project-item ${selectedAgentId === agentId && currentView === 'agent-detail' ? 'sidebar__project-item--active' : ''}`}
                  onClick={() => handleAgentClick(agentId)}
                  style={{ width: '100%' }}
                >
                  <span
                    className={`sidebar__agent-dot sidebar__agent-dot--${isActive ? 'active' : 'idle'}`}
                    style={{ flexShrink: 0 }}
                  />
                  <span
                    className="sidebar__project-name"
                    style={{ flex: 1, fontWeight: selectedAgentId === agentId ? 600 : 500 }}
                  >
                    {meta.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </nav>

      {/* ── 하단 (Settings + 유저 + Powered by) ────────── */}
      <div className="sidebar__footer">
        <button
          className={`sidebar__footer-settings ${currentView === 'settings' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => handleNavClick('settings')}
        >
          <span className="material-symbols-outlined sidebar__nav-icon" style={{ fontVariationSettings: currentView === 'settings' ? "'FILL' 1" : "'FILL' 0" }}>settings</span>
          <span>Settings</span>
        </button>

        <div className="sidebar__user" style={{ paddingRight: '0.9rem', justifyContent: 'flex-start' }}>
          <span className="sidebar__user-email">admin@mycrew.run</span>
        </div>

        <div className="sidebar__powered">
          Powered by <strong>MyCrew</strong>
        </div>
      </div>
    </aside>
  );
}
