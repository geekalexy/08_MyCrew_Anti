// src/components/Sidebar/Sidebar.jsx — v8 (프로젝트별 팀 나열)
import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useAgentStore } from '../../store/agentStore';
import { useKanbanStore } from '../../store/kanbanStore';
import { useUiStore } from '../../store/uiStore';
import { getRoleData, inferProjectType } from '../../data/roleRegistry';

export default function Sidebar() {
  const { projects, selectedProjectId, selectProject, deleteProject, allCrews } = useProjectStore();
  const { agents, selectedAgentId, selectAgent, clearAgentSelection } = useAgentStore();
  const { currentView, setCurrentView, workspaceName, workspaceLogo } = useUiStore();

  // Projects 섹션 접기
  const [isProjectsCollapsed, setIsProjectsCollapsed] = useState(false);
  // 팀별 독립 collapse: { [projectId]: boolean }
  const [collapsedTeams, setCollapsedTeams] = useState({});

  const toggleTeam = (projectId) => {
    setCollapsedTeams(prev => ({ ...prev, [projectId]: !prev[projectId] }));
  };

  const handleAddProject = () => {
    window.dispatchEvent(new CustomEvent('openNewProjectModal'));
  };

  const handleAgentClick = (agentId) => {
    selectAgent(agentId);
    setCurrentView('agent-detail');
  };

  const handleNavClick = (view) => {
    clearAgentSelection();
    setCurrentView(view);
  };

  return (
    <aside className="sidebar">

      {/* ── 워크스페이스 헤더 ───────────────────────────── */}
      <div className="sidebar__workspace">
        <div className="sidebar__workspace-logo" style={workspaceLogo ? { background: 'transparent' } : {}}>
          {workspaceLogo ? (
            <img src={workspaceLogo} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
          ) : (
            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>terminal</span>
          )}
        </div>
        <span className="sidebar__workspace-name">{workspaceName || 'Socian'}</span>
      </div>

      <nav className="sidebar__nav">

        {/* ── NAVIGATION 섹션 헤더 */}
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
            <button className="sidebar__icon-btn" title="새 프로젝트 생성" onClick={handleAddProject} aria-label="프로젝트 추가">
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add</span>
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
              </div>
            ))}
          </div>
        )}

        {/* Image Lab */}
        <button
          id="sidebar-image-lab"
          className={`sidebar__nav-item ${currentView === 'image-lab' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => handleNavClick('image-lab')}
        >
          <span className="material-symbols-outlined sidebar__nav-icon" style={{ fontVariationSettings: currentView === 'image-lab' ? "'FILL' 1" : "'FILL' 0" }}>experiment</span>
          Image Lab
          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(180,197,255,0.15)', color: 'var(--brand)', fontFamily: 'Space Grotesk', letterSpacing: '0.04em', marginLeft: '2px' }}>BETA</span>
        </button>

        {/* Video Lab */}
        <button
          id="sidebar-video-lab"
          className={`sidebar__nav-item ${currentView === 'video-lab' ? 'sidebar__nav-item--active' : ''}`}
          onClick={() => handleNavClick('video-lab')}
        >
          <span className="material-symbols-outlined sidebar__nav-icon" style={{ fontVariationSettings: currentView === 'video-lab' ? "'FILL' 1" : "'FILL' 0" }}>movie_filter</span>
          Video Lab
          <span style={{ fontSize: '0.6rem', fontWeight: 700, padding: '1px 5px', borderRadius: '3px', background: 'rgba(238,42,123,0.15)', color: '#f472b6', fontFamily: 'Space Grotesk', letterSpacing: '0.04em', marginLeft: '2px' }}>P1</span>
        </button>


        {/* ── AI CREW 섹션 ──────────────────────────────── */}
        <div className="sidebar__section-header sidebar__section-header--mt">
          <span className="sidebar__section-label">AI Crew</span>
        </div>

        {/* 프로젝트별 팀 나열 — 각 팀 독립 접기/펼치기 */}
        {projects.map((project) => {
          const teamName = `${project.name}팀`;
          const crew = allCrews[project.id] || [];
          const isCollapsed = collapsedTeams[project.id] ?? false; // 기본 펼침

          return (
            <div key={project.id} style={{ marginBottom: '0.2rem' }}>

              {/* 팀 헤더 — + 버튼 없음 (프로젝트 생성 시 자동 생성) */}
              <div className="sidebar__projects-row">
                <button
                  className={`sidebar__nav-item sidebar__nav-item--group ${currentView === 'organization' && selectedProjectId === project.id ? 'sidebar__nav-item--active' : ''}`}
                  onClick={() => { selectProject(project.id); handleNavClick('organization'); }}
                  style={{ flex: 1 }}
                >
                  <span className="material-symbols-outlined sidebar__nav-icon" style={{ fontVariationSettings: "'FILL' 0", fontSize: '1rem' }}>
                    group
                  </span>
                  {teamName}
                </button>
                {/* 접기/펼치기 버튼만 */}
                <button
                  className="sidebar__icon-btn"
                  title={isCollapsed ? '팀 펼치기' : '팀 접기'}
                  onClick={() => toggleTeam(project.id)}
                  aria-label="팀 접기/펼치기"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                    {isCollapsed ? 'expand_more' : 'expand_less'}
                  </span>
                </button>
              </div>

              {/* 팀원 목록 */}
              {!isCollapsed && (
                <div className="sidebar__project-list" style={{ marginBottom: 0 }}>
                  {crew.length === 0 ? (
                    <div style={{ padding: '0.3rem 1.2rem', fontSize: '0.7rem', color: 'var(--text-muted)', opacity: 0.5 }}>
                      팀원 없음
                    </div>
                  ) : (
                    crew.map((member) => {
                      // 1. team_agents.nickname (사용자 지정)
                      // 2. roleRegistry 사전 (role_id + projectType 매칭)
                      // 3. extractShortRole fallback (LLM 문장 단축)
                      const instanceId = (member.id || member.agent_id)?.toLowerCase();
                      const baseRoleId = (member.role_id || member.agent_id || instanceId)?.toLowerCase().replace(/^proj-\d+-/, '');
                      const agentState = agents[baseRoleId];
                      const isActive = agentState?.status === 'active';

                      const projectType = inferProjectType(project.name, project.isolation_scope || '');
                      const roleData = getRoleData(baseRoleId, projectType);

                      const rawRole = (member.role_description || member.experiment_role || '').trim();
                      const firstClause = rawRole.split(/[,\.\n\r\-\u2013\u2014(]/)[0].trim();
                      const words = firstClause.split(/\s+/);
                      const fallbackRole = words.length > 3 ? words.slice(0, 2).join(' ') : firstClause;

                      const displayName = member.nickname || roleData?.mainRole || fallbackRole || baseRoleId?.toUpperCase();
                      // [UI-FIX] 역할명 2중 노출 방지 — 서브텍스트 제거 (1줄 단독 표시)
                      const roleSub = null;

                      return (
                        <button
                          key={`${project.id}-${baseRoleId}`}
                          className={`sidebar__project-item ${
                            selectedAgentId === baseRoleId &&
                            selectedProjectId === project.id &&
                            currentView === 'agent-detail'
                              ? 'sidebar__project-item--active'
                              : ''
                          }`}
                          onClick={() => { selectProject(project.id); handleAgentClick(baseRoleId); }}
                          style={{ width: '100%', flexDirection: 'column', alignItems: 'flex-start', gap: '0.1rem', padding: '0.35rem 0.8rem' }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', width: '100%' }}>
                            <span
                              className={`sidebar__agent-dot sidebar__agent-dot--${isActive ? 'active' : 'idle'}`}
                              style={{ flexShrink: 0 }}
                            />
                            {/* 표시명: 닉네임 > 역할명 — agentId 노출 없음 */}
                            <span
                              className="sidebar__project-name"
                              style={{ flex: 1, fontWeight: selectedAgentId === baseRoleId ? 600 : 500, fontSize: '0.82rem' }}
                            >
                              {displayName}
                            </span>
                          </div>
                          {roleSub && (
                            <div title={roleSub} style={{ paddingLeft: '1.2rem', fontSize: '0.68rem', color: 'var(--text-muted)', textAlign: 'left', width: '100%', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {roleSub}
                            </div>
                          )}
                        </button>
                      );
                    })
                  )}
                </div>
              )}

            </div>
          );
        })}

      </nav>

      {/* ── 하단 (Settings + 유저) ────────────────────── */}
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
