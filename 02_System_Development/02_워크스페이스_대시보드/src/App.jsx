// src/App.jsx — Phase 10: 멀티뷰 라우팅 적용
import { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';
import { useUiStore } from './store/uiStore';
import { useSettingsStore } from './store/settingsStore';
import { useProjectStore } from './store/projectStore';
import { useAgentStore } from './store/agentStore';
import { useAuthStore } from './store/authStore';
import Sidebar from './components/Sidebar/Sidebar';
import KanbanBoard from './components/Board/KanbanBoard';
import LogDrawer from './components/Log/LogDrawer';
import TaskDetailModal from './components/Modal/TaskDetailModal';
import NewProjectModal from './components/Modal/NewProjectModal';
import ProjectSettingsModal from './components/Modal/ProjectSettingsModal';
import AgentDetailView from './components/Views/AgentDetailView';
import ArchiveView from './components/Views/ArchiveView';
import OrgView from './components/Views/OrgView';
import SettingsView from './components/Views/SettingsView';
import OnboardingWizard from './components/Views/OnboardingWizard';
import ArtifactViewer from './components/Views/ArtifactViewer';
import ImageLabView from './components/Views/ImageLabView';
import VideoLabView from './components/Views/VideoLabView';
import './styles/colors.css';

import './styles/animations.css';
import './styles/app.css';
import './styles/markdown.css';

/* ── SVG 아이콘 ─────────────────────────────────────────── */
const IcoPersonAdd = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/>
    <line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);

const IcoCheckCircle = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--status-active)' }}>
    <circle cx="12" cy="12" r="10"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

export default function App() {
  const { isLogPanelOpen, setLogPanelOpen, theme, toggleTheme, currentView, setCurrentView, hasCompletedOnboarding, setActiveLogTab, completeOnboarding, activeArtifact } = useUiStore();
  const { fetchSettings } = useSettingsStore();
  const { projects, selectedProjectId, updateProject, fetchProjects, selectProject } = useProjectStore();
  const { selectedAgentId, addAgent, fetchProjectAgents, clearAgents } = useAgentStore();
  const [serverOnline, setServerOnline] = useState(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isSettingsModalOpen,   setIsSettingsModalOpen]   = useState(false);
  
  // 헤더 채용(Recruit) 상태 변수들
  const [isRecruiting, setIsRecruiting] = useState(false);
  const [recruitInput, setRecruitInput] = useState('');
  const [recruitStatus, setRecruitStatus] = useState(null); // null | 'loading' | 'done'
  useSocket();

  useEffect(() => {
    // [Phase 17-3] 미온보딩 유저 최초 진입 시 Chatting 탭 강제 오픈
    if (!hasCompletedOnboarding) {
      setLogPanelOpen(true);
      setActiveLogTab('interaction');
      // completeOnboarding(); // Phase 20: 위저드에서 직접 완료 처리하므로 주석 처리/삭제
    }
  }, []);

  useEffect(() => {
    const handleOpenNewProjectModal = () => setIsNewProjectModalOpen(true);
    const handleCloseNewProjectModal = () => {
      setIsNewProjectModalOpen(false);
      setCurrentView('projects');
    };
    window.addEventListener('openNewProjectModal', handleOpenNewProjectModal);
    window.addEventListener('closeNewProjectModal', handleCloseNewProjectModal);
    return () => {
      window.removeEventListener('openNewProjectModal', handleOpenNewProjectModal);
      window.removeEventListener('closeNewProjectModal', handleCloseNewProjectModal);
    };
  }, []);

  // [Phase 35] 선택된 프로젝트 변경 시 해당 프로젝트의 에이전트 목록 동적으로 불러오기
  useEffect(() => {
    if (selectedProjectId) {
      fetchProjectAgents(selectedProjectId);
    } else {
      clearAgents();
    }
  }, [selectedProjectId]);


  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchSettings();
    fetchProjects(); // [Phase 28a] 프로젝트 목록 및 초기 선택 동기화
    useAuthStore.getState().syncWithBackend();
    const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';
    fetch(`${SERVER_URL}/health`)
      .then((r) => setServerOnline(r.ok))
      .catch(() => setServerOnline(false));
  }, []);

  const selectedProject = projects.find((p) => p.id === selectedProjectId);

  const [isEditingProjectName, setIsEditingProjectName] = useState(false);
  const [editProjectNameInput, setEditProjectNameInput] = useState('');
  
  const handleEditProjectNameSubmit = (e) => {
    if (e) e.preventDefault();
    if (editProjectNameInput.trim() && selectedProject) {
      updateProject(selectedProject.id, editProjectNameInput.trim());
    }
    setIsEditingProjectName(false);
  };

  const handleRecruit = async (e) => {
    e.preventDefault();
    if (!recruitInput.trim()) return;
    setRecruitStatus('loading');
    // 채용 로직 시뮬레이션
    await new Promise((res) => setTimeout(res, 1500));
    addAgent(recruitInput.trim()); // 입력된 역할 기반으로 새 에이전트 생성
    setRecruitStatus('done');
    setRecruitInput('');
    setTimeout(() => { setRecruitStatus(null); setIsRecruiting(false); }, 2500);
  };

  // ── 뷰 라우터: currentView에 따라 중앙 메인 컴포넌트 결정 ──────────────
  const renderMainView = () => {
    switch (currentView) {
      case 'agent-detail': return <AgentDetailView />;
      case 'archive':      return <ArchiveView />;
      case 'organization': return <OrgView />;
      case 'settings':     return <SettingsView />;
      case 'image-lab':    return <ImageLabView />;
      case 'video-lab':    return <VideoLabView />;
      case 'projects':
      default:
        return (
          <>
            <div className="board-header">
              {isEditingProjectName ? (
                <form onSubmit={handleEditProjectNameSubmit} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  <input
                    value={editProjectNameInput}
                    onChange={(e) => setEditProjectNameInput(e.target.value)}
                    autoFocus
                    onBlur={handleEditProjectNameSubmit}
                    style={{ fontSize: '1.4rem', fontWeight: 700, padding: '0.2rem 0.5rem', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--brand)', borderRadius: '4px', outline: 'none' }}
                  />
                </form>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <select 
                    value={selectedProjectId || ''} 
                    onChange={(e) => selectProject(e.target.value)}
                    style={{
                      fontSize: '1.4rem', 
                      fontWeight: 700, 
                      background: 'transparent', 
                      color: 'var(--text-primary)', 
                      border: 'none', 
                      outline: 'none',
                      cursor: 'pointer',
                      appearance: 'none', // 기본 화살표 숨김
                    }}
                  >
                    {projects.map(p => (
                      <option key={p.id} value={p.id} style={{ color: '#000' }}>
                        {p.name}
                      </option>
                    ))}
                  </select>
              {/* #31: 연필 → 설정 아이콘 교체 + ProjectSettingsModal 오픈 */}
                  <button 
                    onClick={() => setIsSettingsModalOpen(true)}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                    title="프로젝트 설정"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', opacity: 0.6 }}>settings</span>
                  </button>
                </div>
              )}
              {/* #30: 설명글 → selectedProject.objective_raw 또는 objective 파싱값으로 동적 표시 */}
              <p className="board-header__subtitle" style={{ marginTop: '0.3rem' }}>
                {(() => {
                  if (!selectedProject) return 'AI 에이전트가 실시간으로 작업을 처리하고 있습니다';
                  const flow = selectedProject.workflow_raw
                    || (selectedProject.objective || '').split('[업무 흐름]')[1]?.trim()
                    || (selectedProject.objective || '').split('[업무 흐름]')[0].replace('[목적]', '').trim();
                  return flow || '업무 흐름을 설정해 주세요';
                })()} 
              </p>
            </div>
            <KanbanBoard />
          </>
        );
    }
  };

  if (!hasCompletedOnboarding) {
    return <OnboardingWizard />;
  }

  // Phase 21: ArtifactViewer — 사이드바/헤더 위를 완전히 덮는 풀스크린
  if (activeArtifact) {
    return <ArtifactViewer />;
  }

  return (
    <div className="app">
      {/* ── 좌측 사이드바 ─────────────────────────────────────── */}
      <Sidebar />


      {/* ── 중앙 + 우측 래퍼 ────────────────────────────────────── */}
      <div className="app__content">
        {/* ── 헤더 ──────────────────────────────────────────────── */}
        <header className="app__header glass-panel">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
            {selectedProject && currentView !== 'projects' && (
              <div className="header-project-badge" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'var(--brand-glow)', padding: '0.25rem 0.6rem', borderRadius: '6px', border: '1px solid var(--brand)', opacity: 0.9 }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.8rem', color: 'var(--brand)' }}>grid_view</span>
                <span style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--brand)' }}>{selectedProject.name}</span>
              </div>
            )}
            {currentView !== 'organization' && currentView !== 'agent-detail' && (
              <div className="app__search">
                <span className="material-symbols-outlined app__search-icon" style={{ fontSize: '1rem' }}>search</span>
                <input className="app__search-input" placeholder="Global search commands..." />
              </div>
            )}
          </div>


          <div className="app__header-actions">
            <span
              title={serverOnline === null ? '확인 중...' : serverOnline ? '서버 연결됨' : '서버 오프라인'}
              style={{
                width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                background: serverOnline === null ? 'var(--text-muted)'
                  : serverOnline ? 'var(--status-active)'
                  : '#ff5449',
                boxShadow: serverOnline ? '0 0 6px var(--status-active-glow)' : 'none',
                display: 'inline-block',
              }}
            />
            <button className="btn btn--ghost btn--icon" title="알림">
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>notifications</span>
            </button>
            <button
              className="btn btn--ghost btn--icon"
              onClick={toggleTheme}
              title={theme === 'dark' ? '라이트 모드' : '다크 모드'}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
                {theme === 'dark' ? 'light_mode' : 'dark_mode'}
              </span>
            </button>
            <button
              className={`btn btn--icon ${isLogPanelOpen ? 'btn--active' : 'btn--ghost'}`}
              onClick={() => setLogPanelOpen(!isLogPanelOpen)}
              title="Activity Log"
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>history</span>
            </button>
          </div>
        </header>

        {/* ── 메인 뷰 (라우터 분기) ────────────────────────────── */}
        <main className={`app__main${currentView === 'projects' ? ' app__main--kanban' : ''}`}>
          {renderMainView()}
        </main>
      </div>

      {/* ── 우측 로그 드로어 — Image Lab에서는 숨김 (3-Panel 레이아웃 보호) ── */}
      {currentView !== 'image-lab' && currentView !== 'video-lab' && <LogDrawer />}
      {/* ── Phase 11: 태스크 상세 모달 ────────────────────────── */}
      <TaskDetailModal />
      <NewProjectModal isOpen={isNewProjectModalOpen} onClose={() => setIsNewProjectModalOpen(false)} />
      <ProjectSettingsModal
        isOpen={isSettingsModalOpen}
        onClose={() => setIsSettingsModalOpen(false)}
        project={selectedProject}
      />
      {/* ── 모바일 하단 네비게이션 ────────────────────────────── */}
      <nav className="mobile-nav" aria-label="모바일 네비게이션">
        <button
          className={`mobile-nav__item ${currentView === 'projects' ? 'mobile-nav__item--active' : ''}`}
          onClick={() => setCurrentView('projects')}
        >
          <svg className="mobile-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/></svg>
          <span>Projects</span>
        </button>
        <button
          className={`mobile-nav__item ${currentView === 'organization' || currentView === 'agent-detail' ? 'mobile-nav__item--active' : ''}`}
          onClick={() => setCurrentView('organization')}
        >
          <svg className="mobile-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          <span>AI Crew</span>
        </button>
        <button
          className={`mobile-nav__item ${currentView === 'archive' ? 'mobile-nav__item--active' : ''}`}
          onClick={() => setCurrentView('archive')}
        >
          <svg className="mobile-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="5" x="2" y="3" rx="1"/><path d="M4 8v11a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8"/><path d="M10 12h4"/></svg>
          <span>Archive</span>
        </button>
        <button
          className={`mobile-nav__item ${currentView === 'settings' ? 'mobile-nav__item--active' : ''}`}
          onClick={() => setCurrentView('settings')}
        >
          <svg className="mobile-nav__icon" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}
