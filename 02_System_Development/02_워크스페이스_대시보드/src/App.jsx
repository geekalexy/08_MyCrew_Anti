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

// ── [Phase 37] 파이프라인 시작 선택 프롬프트 ─────────────────────────
function PipelineStartPrompt({ projectId, onSelect }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1100,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      paddingBottom: '2.5rem',
      pointerEvents: 'none',
    }}>
      <div style={{
        background: 'var(--bg-surface-2)',
        border: '1px solid rgba(180,197,255,0.2)',
        borderRadius: '16px',
        padding: '1.5rem 2rem',
        boxShadow: '0 8px 40px rgba(0,0,0,0.4), 0 0 0 1px rgba(180,197,255,0.08)',
        backdropFilter: 'blur(20px)',
        display: 'flex', flexDirection: 'column', gap: '1rem',
        maxWidth: 440, width: '90vw',
        pointerEvents: 'auto',
        animation: 'modal-slide-up 0.25s cubic-bezier(0.34,1.2,0.64,1)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--brand)' }}>rocket_launch</span>
          <div>
            <p style={{ fontSize: '0.88rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              팀 준비 완료! 어떻게 시작하시겠어요?
            </p>
            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: '0.15rem 0 0' }}>
              AI 팀이 지금 바로 일을 시작할 수 있습니다.
            </p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '0.6rem' }}>
          <button
            id="pipeline-run-btn"
            onClick={() => onSelect('run')}
            style={{
              flex: 1, padding: '0.7rem 0.8rem',
              background: 'linear-gradient(135deg, rgba(100,135,242,0.2), rgba(124,110,248,0.15))',
              border: '1px solid rgba(100,135,242,0.4)',
              borderRadius: '10px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(100,135,242,0.28)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'linear-gradient(135deg, rgba(100,135,242,0.2), rgba(124,110,248,0.15))'; e.currentTarget.style.transform = ''; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.3rem', color: '#b4c5ff' }}>play_arrow</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b4c5ff', letterSpacing: '0.04em' }}>/run</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>자율 완주</span>
          </button>
          <button
            id="pipeline-runb-btn"
            onClick={() => onSelect('run-b')}
            style={{
              flex: 1, padding: '0.7rem 0.8rem',
              background: 'rgba(255,185,99,0.08)',
              border: '1px solid rgba(255,185,99,0.25)',
              borderRadius: '10px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,185,99,0.18)'; e.currentTarget.style.transform = 'translateY(-1px)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,185,99,0.08)'; e.currentTarget.style.transform = ''; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.3rem', color: '#ffb963' }}>step_into</span>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ffb963', letterSpacing: '0.04em' }}>/run-b</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>중간 확인 자율완주</span>
          </button>
          <button
            id="pipeline-later-btn"
            onClick={() => onSelect(null)}
            style={{
              padding: '0.7rem 0.8rem',
              background: 'transparent',
              border: '1px solid var(--border)',
              borderRadius: '10px', cursor: 'pointer',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.2rem',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.3rem', color: 'var(--text-muted)' }}>schedule</span>
            <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>나중에</span>
          </button>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const { isLogPanelOpen, setLogPanelOpen, theme, toggleTheme, currentView, setCurrentView, hasCompletedOnboarding, setActiveLogTab, completeOnboarding, activeArtifact } = useUiStore();
  const { fetchSettings } = useSettingsStore();
  const { projects, selectedProjectId, updateProject, fetchProjects, selectProject } = useProjectStore();
  const { selectedAgentId, addAgent, fetchProjectAgents, clearAgents } = useAgentStore();
  const [serverOnline, setServerOnline] = useState(null);
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [isSettingsModalOpen,   setIsSettingsModalOpen]   = useState(false);
  const [pipelinePrompt, setPipelinePrompt] = useState(null); // { projectId } | null
  
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
    // [Phase 37] 파이프라인 시작 선택 프롬프트
    const handlePipelinePrompt = (e) => setPipelinePrompt(e.detail);
    window.addEventListener('pipelineStartPrompt', handlePipelinePrompt);
    return () => {
      window.removeEventListener('openNewProjectModal', handleOpenNewProjectModal);
      window.removeEventListener('closeNewProjectModal', handleCloseNewProjectModal);
      window.removeEventListener('pipelineStartPrompt', handlePipelinePrompt);
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
    const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4010';
    fetch(`${SERVER_URL}/health`)
      .then((r) => setServerOnline(r.ok))
      .catch(() => setServerOnline(false));
  }, []);

  const selectedProject = projects && Array.isArray(projects) ? projects.find((p) => p.id === selectedProjectId) : null;

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
        // ── [Phase 36] 프로젝트 0개 → 빈 화면 CTA ─────────────────────────
        if (projects.length === 0) {
          return (
            <div style={{
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              height: '100%', gap: '2rem',
              userSelect: 'none',
            }}>
              {/* 아이콘 글로우 */}
              <div style={{
                width: 72, height: 72, borderRadius: '20px',
                background: 'linear-gradient(135deg, rgba(100,135,242,0.18), rgba(100,135,242,0.06))',
                border: '1px solid rgba(100,135,242,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 0 40px rgba(100,135,242,0.12)',
                animation: 'emptyStatePulse 3s ease-in-out infinite',
              }}>
                <span className="material-symbols-outlined" style={{
                  fontSize: '2.2rem', color: 'var(--brand)', opacity: 0.85,
                }}>groups</span>
              </div>

              {/* 카피 */}
              <div style={{ textAlign: 'center', maxWidth: 320 }}>
                <p style={{
                  fontSize: '1.05rem', fontWeight: 500,
                  color: 'var(--text-secondary)', lineHeight: 1.6,
                  margin: 0,
                  fontFamily: 'var(--font-sans, Inter, sans-serif)',
                }}>
                  프로젝트를 만들면<br />
                  <span style={{ color: 'var(--brand)', fontWeight: 600 }}>AI 멀티 에이전트</span>가 채용됩니다.
                </p>
              </div>

              {/* CTA 버튼 */}
              <button
                id="empty-state-create-project-btn"
                onClick={() => setIsNewProjectModalOpen(true)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.75rem 2rem',
                  background: 'linear-gradient(135deg, #5570d8, #6487f2)',
                  color: '#fff', fontWeight: 700,
                  fontSize: '0.95rem', letterSpacing: '0.02em',
                  border: 'none', borderRadius: '10px',
                  cursor: 'pointer',
                  boxShadow: '0 4px 20px rgba(100,135,242,0.35)',
                  transition: 'transform 0.15s, box-shadow 0.15s',
                  fontFamily: 'var(--font-sans, Inter, sans-serif)',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.transform = 'translateY(-2px)';
                  e.currentTarget.style.boxShadow = '0 8px 28px rgba(100,135,242,0.5)';
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.transform = '';
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(100,135,242,0.35)';
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>add</span>
                생성하기
              </button>

              <style>{`
                @keyframes emptyStatePulse {
                  0%, 100% { box-shadow: 0 0 30px rgba(100,135,242,0.10); }
                  50%       { box-shadow: 0 0 50px rgba(100,135,242,0.22); }
                }
              `}</style>
            </div>
          );
        }

        // ── 프로젝트 있음 → 기존 칸반 뷰 ─────────────────────────────────
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
                      appearance: 'none',
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

      {/* ── [Phase 37] 파이프라인 시작 선택 프롬프트 ─────────────── */}
      {pipelinePrompt && (
        <PipelineStartPrompt
          projectId={pipelinePrompt.projectId}
          onSelect={(mode) => {
            setPipelinePrompt(null);
            if (!mode) return; // '나중에' 선택
            const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4010';
            fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(pipelinePrompt.projectId)}/pipeline/${mode}`, { method: 'POST' })
              .then(r => r.json())
              .then(data => console.log('[Pipeline] 시작:', data))
              .catch(err => console.error('[Pipeline] 시작 실패:', err));
          }}
        />
      )}
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
