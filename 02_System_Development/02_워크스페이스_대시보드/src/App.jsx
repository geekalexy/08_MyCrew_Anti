// src/App.jsx — Phase 10: 멀티뷰 라우팅 적용
import { useEffect, useState } from 'react';
import { useSocket } from './hooks/useSocket';
import { useUiStore } from './store/uiStore';
import { useSettingsStore } from './store/settingsStore';
import { useProjectStore } from './store/projectStore';
import { useAgentStore } from './store/agentStore';
import Sidebar from './components/Sidebar/Sidebar';
import KanbanBoard from './components/Board/KanbanBoard';
import LogDrawer from './components/Log/LogDrawer';
import TaskDetailModal from './components/Modal/TaskDetailModal';
import AgentDetailView from './components/Views/AgentDetailView';
import ArchiveView from './components/Views/ArchiveView';
import OrgView from './components/Views/OrgView';
import SettingsView from './components/Views/SettingsView';
import './styles/colors.css';
import './styles/animations.css';
import './styles/app.css';

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
  const { isLogPanelOpen, setLogPanelOpen, theme, toggleTheme, currentView, setCurrentView, hasCompletedOnboarding, setActiveLogTab, completeOnboarding } = useUiStore();
  const { fetchSettings } = useSettingsStore();
  const { projects, selectedProjectId, updateProject } = useProjectStore();
  const { selectedAgentId, addAgent } = useAgentStore();
  const [serverOnline, setServerOnline] = useState(null);
  
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
      completeOnboarding(); // 한 번 띄우고 플래그 끔 (원하면 끌 수 있도록)
    }
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  useEffect(() => {
    fetchSettings();
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
                  <h2 className="board-header__title" style={{ margin: 0 }}>
                    {selectedProject?.name || 'MyCrew Dashboard'}
                  </h2>
                  <button 
                    onClick={() => { setEditProjectNameInput(selectedProject?.name || ''); setIsEditingProjectName(true); }}
                    style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
                    title="프로젝트 이름 수정"
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', opacity: 0.6 }}>edit</span>
                  </button>
                </div>
              )}
              <p className="board-header__subtitle" style={{ marginTop: '0.3rem' }}>
                AI 에이전트가 실시간으로 작업을 처리하고 있습니다
              </p>
            </div>
            <KanbanBoard />
          </>
        );
    }
  };

  return (
    <div className="app">
      {/* ── 좌측 사이드바 ─────────────────────────────────────── */}
      <Sidebar />

      {/* ── 중앙 + 우측 래퍼 ────────────────────────────────────── */}
      <div className="app__content">
        {/* ── 헤더 ──────────────────────────────────────────────── */}
        <header className="app__header glass-panel">
          {currentView === 'organization' ? (
            <div className="recruit-section" style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
             {!isRecruiting && !recruitStatus && (
               <button
                 className="btn btn--primary recruit-section__btn"
                 onClick={() => setIsRecruiting(true)}
                 style={{ padding: '0.4rem 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.5rem', borderRadius: '8px' }}
               >
                 <IcoPersonAdd />
                 팀원 채용 (Recruit)
               </button>
             )}
             {isRecruiting && !recruitStatus && (
               <form className="recruit-form glass-panel" onSubmit={handleRecruit} style={{ padding: '0.4rem 0.8rem', display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: 0 }}>
                 <IcoPersonAdd />
                 <input
                   className="inline-task-form__textarea"
                   placeholder="어떤 역할이 필요한가요?"
                   value={recruitInput}
                   onChange={(e) => setRecruitInput(e.target.value)}
                   autoFocus
                   style={{ height: '32px', margin: 0, padding: '0.2rem 0.6rem', width: '220px', borderRadius: '4px' }}
                 />
                 <button type="submit" className="btn btn--primary btn--sm">지시</button>
                 <button type="button" className="btn btn--ghost btn--sm" onClick={() => setIsRecruiting(false)}>취소</button>
               </form>
             )}
             {recruitStatus === 'loading' && (
               <div className="recruit-loading" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--brand)' }}>
                 <div className="spinner" style={{ width: '16px', height: '16px', borderWidth: '2px' }} />
                 <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>수석 AI가 면접 중...</span>
               </div>
             )}
             {recruitStatus === 'done' && (
               <div className="recruit-done" style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--status-active)' }}>
                 <IcoCheckCircle />
                 <span style={{ fontSize: '0.85rem', fontWeight: 500 }}>팀원이 성공적으로 합류했습니다! 🎉</span>
               </div>
             )}
            </div>
          ) : (
            <div className="app__search">
              <span className="material-symbols-outlined app__search-icon" style={{ fontSize: '1rem' }}>search</span>
              <input className="app__search-input" placeholder="Global search commands..." />
            </div>
          )}

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

      {/* ── 우측 로그 드로어 ──────────────────────────────────── */}
      <LogDrawer />
      {/* ── Phase 11: 태스크 상세 모달 ────────────────────────── */}
      <TaskDetailModal />
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
