// src/components/Views/AgentDetailView.jsx — 에이전트 상세 뷰 (프로필 수정 + 탭 기반 칸반/통계)
import { useMemo, useEffect, useState, useRef } from 'react';
import { useAgentStore } from '../../store/agentStore';
import { useKanbanStore } from '../../store/kanbanStore';
import { useUiStore } from '../../store/uiStore';
import SkillSection from '../Skills/SkillSection';
import SkillAddDrawer from '../Skills/SkillAddDrawer';

const COLUMNS = ['todo', 'in_progress', 'review', 'done'];
const COLUMN_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };

const IcoPersonSearch = () => (
  <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="10" cy="8" r="4"/>
    <path d="M10.5 16H6a4 4 0 0 0-4 4"/>
    <circle cx="17.5" cy="17.5" r="3.5"/>
    <path d="m21 21-1.9-1.9"/>
  </svg>
);

const IcoInbox = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="7" width="20" height="14" rx="2"/>
    <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2"/>
    <line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/>
  </svg>
);

const IcoEdit = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/>
    <path d="m15 5 4 4"/>
  </svg>
);

const IcoPlay = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const IcoPause = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);
const IcoStop = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12"/>
  </svg>
);

export default function AgentDetailView() {
  const { selectedAgentId, agents, agentMeta, updateAgentMeta, fetchAgentSkills } = useAgentStore();
  const tasks = useKanbanStore((s) => s.tasks);
  const { setLogPanelOpen } = useUiStore();

  const [activeTab, setActiveTab] = useState('PERFORMANCE');
  const [showSkillDrawer, setShowSkillDrawer] = useState(false);
  // 이름 편집 상태
  const [isEditingName, setIsEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState('');
  const nameInputRef = useRef(null);

  useEffect(() => {
    // [Phase 17-4] 프로필 뷰 진입 시 로그 패널 닫기
    setLogPanelOpen(false);
  }, []);

  const agentId = selectedAgentId;

  useEffect(() => {
    // [Phase 17-4] 에이전트 선택 시 DB에서 스킬 설정 로드
    if (agentId) fetchAgentSkills(agentId);
  }, [agentId]);

  const meta = agentId ? agentMeta[agentId] : null;
  const agentState = agentId ? agents[agentId] : null;
  const isActive = agentState?.status === 'active';

  // 아바타 클릭 시 URL 변경 프롬프트
  const handleAvatarClick = () => {
    if (!meta) return;
    const newAvatar = window.prompt(
      "새로운 프로필 이미지 URL을 입력하세요.\n제공되는 아바타: ari, nova, lumi, pico, ollie (.svg)", 
      meta.avatar
    );
    if (newAvatar && newAvatar.trim() !== '') {
      updateAgentMeta(agentId, { avatar: newAvatar.trim() });
    }
  };

  // 이름 수정 시작
  const startEditingName = () => {
    setEditNameValue(meta.name);
    setIsEditingName(true);
    setTimeout(() => nameInputRef.current?.focus(), 50);
  };

  // 이름 저장
  const saveName = () => {
    if (editNameValue.trim() && editNameValue.trim() !== meta.name) {
      updateAgentMeta(agentId, { name: editNameValue.trim() });
    }
    setIsEditingName(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') saveName();
    if (e.key === 'Escape') setIsEditingName(false);
  };

  const myTasks = useMemo(() =>
    Object.values(tasks).filter((t) => t.agentId === agentId),
    [tasks, agentId]
  );

  const tasksByColumn = useMemo(() => {
    const grouped = {};
    COLUMNS.forEach((col) => { grouped[col] = []; });
    myTasks.forEach((t) => { if (grouped[t.column]) grouped[t.column].push(t); });
    return grouped;
  }, [myTasks]);
  
  // 더미(Mock) 퍼포먼스 데이터
  const performanceMock = useMemo(() => {
    if (!agentId) return null;
    const seed = agentId.charCodeAt(0) + (agentId.charCodeAt(1) || 0);
    return {
      tasksResolved: 12 + (seed % 20),
      avgSpeed: 2.1 + (seed % 3),
      tokensUsed: 12400 + (seed * 105),
      tokenLimit: 50000,
    };
  }, [agentId]);

  if (!meta) {
    return (
      <div className="view-empty">
        <IcoPersonSearch />
        <p>좌측 AI Crew 메뉴에서 팀원을 선택하세요.</p>
      </div>
    );
  }

  return (
    <div className="agent-detail-view" style={{ position: 'relative', overflow: 'hidden' }}>
      {/* ── 1. 프로필 헤더 ─────────────────────────────────── */}
      <div className="agent-profile glass-panel">
        <div 
          className="agent-profile__avatar" 
          onClick={handleAvatarClick}
          style={{ cursor: 'pointer', position: 'relative' }}
          title="클릭하여 프로필 이미지 변경"
        >
          <img src={meta.avatar} alt={meta.name} />
          <div className="agent-profile__avatar-overlay" style={{
            position: 'absolute', bottom: 0, right: 0, background: 'var(--brand)', 
            borderRadius: '50%', padding: '4px', display: 'flex', color: '#fff'
          }}>
            <IcoEdit />
          </div>
        </div>
        
        <div className="agent-profile__info">
          {isEditingName ? (
              <input
              ref={nameInputRef}
              className="agent-profile__name-input"
              value={editNameValue}
              onChange={(e) => setEditNameValue(e.target.value)}
              onBlur={saveName}
              onKeyDown={handleKeyDown}
              style={{
                fontSize: '1.2rem', fontWeight: 600, background: 'var(--bg-surface-3)',
                color: 'var(--text-primary)', border: '1px solid var(--border)',
                borderRadius: '4px', padding: '0.2rem 0.5rem', width: '250px'
              }}
            />
          ) : (
            <h2 className="agent-profile__name" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {meta.name}
              <button 
                className="btn btn--ghost btn--sm" 
                onClick={startEditingName} 
                style={{ padding: '4px', color: 'var(--text-muted)' }}
                title="이름 편집"
              >
                <IcoEdit />
              </button>
            </h2>
          )}
          <p className="agent-profile__role">{meta.role}</p>
          <p className="agent-profile__model" style={{ opacity: 0.5, fontSize: '0.75rem' }}>{meta.model}</p>
        </div>
        
        <div className="agent-profile__status" style={{ display: 'flex', flexDirection: 'column', gap: '0.8rem', alignItems: 'center', marginLeft: 'auto', paddingRight: '2rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className={`sidebar__agent-dot sidebar__agent-dot--${isActive ? 'active' : 'idle'}`} />
            <span style={{ fontSize: '0.85rem', fontWeight: '500', opacity: 0.8 }}>{isActive ? 'Engine Active' : 'Engine Idle'}</span>
          </div>
          
          <div className="agent-profile__controls" style={{ display: 'flex', gap: '0.5rem', background: 'var(--bg-surface-3)', padding: '0.4rem 0.6rem', borderRadius: '8px' }}>
            <button className="btn btn--ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--status-active)' }} title="Action">
              <IcoPlay /> Action
            </button>
            <button className="btn btn--ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: '#ffb963' }} title="Pause">
              <IcoPause /> Pause
            </button>
            <button className="btn btn--ghost" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--status-error)' }} title="Stop">
              <IcoStop /> Stop
            </button>
          </div>
        </div>
        
        <div className="agent-profile__skills">
          {meta.skills.map((skill) => (
            <span key={skill} className="skill-badge">{skill}</span>
          ))}
          {/* 스킬 추가하기 버튼 */}
          <button
            onClick={() => setShowSkillDrawer(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
              padding: '0.25rem 0.65rem',
              borderRadius: '99px',
              border: '1px dashed rgba(100,135,242,0.45)',
              background: 'rgba(100,135,242,0.06)',
              color: 'var(--brand)',
              fontSize: '0.72rem', fontWeight: 700,
              cursor: 'pointer', transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,135,242,0.14)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,135,242,0.06)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add</span>
            스킬 추가하기
          </button>
        </div>
      </div>

      {/* ── 2. 탭 네비게이션 ──────────────────────────────── */}
      <div className="agent-detail-tabs">
        <button
          className={`agent-tab-btn ${activeTab === 'PERFORMANCE' ? 'agent-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('PERFORMANCE')}
        >
          PERFORMANCE
        </button>
        <button
          className={`agent-tab-btn ${activeTab === 'TASK' ? 'agent-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('TASK')}
        >
          TASK
        </button>
      </div>

      {/* ── 3. 탭 컨텐츠 ─────────────────────────────────── */}
      <div className="agent-detail-content">

        {/* PERFORMANCE 탭: 스킬 및 인프라 분리 섹션 */}
        {activeTab === 'PERFORMANCE' && (
          <div className="performance-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', animation: 'fadeIn 0.3s' }}>
            
            {/* 1. 핵심 지표 섹션 (High-level KPIs) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', borderLeft: '4px solid var(--status-active)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Resolved & Closed</span>
                <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem', fontFamily: 'Space Grotesk' }}>
                  {performanceMock.tasksResolved} <span style={{ fontSize: '1rem', color: 'var(--status-active)', fontWeight: 500, marginLeft: '4px' }}>↑ +2</span>
                </span>
                <p style={{ margin: 0, marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>누적 업무 해결 수 (월간 기준)</p>
              </div>
              <div className="glass-panel" style={{ display: 'flex', flexDirection: 'column', padding: '1.5rem', borderLeft: '4px solid var(--brand)' }}>
                <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700 }}>Avg. Velocity</span>
                <span style={{ fontSize: '2.4rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '0.5rem', fontFamily: 'Space Grotesk' }}>
                  {performanceMock.avgSpeed}s <span style={{ fontSize: '1rem', color: 'var(--brand)', fontWeight: 500, marginLeft: '4px' }}>/ task</span>
                </span>
                <p style={{ margin: 0, marginTop: '0.4rem', fontSize: '0.75rem', color: 'var(--text-muted)' }}>평균 지능 연산 속도</p>
              </div>
            </div>

            {/* 2. 엔진 인프라 섹션 (Infrastructure & Tokens) */}
            <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', marginBottom: '0.5rem' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--brand)', fontSize: '1.3rem' }}>hub</span>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Engine Infrastructure</h3>
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '2rem' }}>
                <div>
                  <h4 style={{ margin: 0, marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>LLM Engine Adapter</h4>
                  <select 
                    className="modal-select" 
                    value={meta.model} 
                    onChange={(e) => updateAgentMeta(agentId, { model: e.target.value })}
                    style={{ background: 'var(--bg-surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border)', padding: '0.6rem', borderRadius: '6px', width: '100%', outline: 'none' }}
                  >
                    {/* ── ARI 전용: Gemini API 직접 호출 (소켓 + OAuth 스트리밍) ── */}
                    {agentId === 'ari' && (<>
                      <option value="gemini-2.5-flash">⚡ Gemini 2.5 Flash — 실시간 스트리밍 기본</option>
                      <option value="gemini-2.5-pro">🧠 Gemini 2.5 Pro — 고성능 추론</option>
                    </>)}
                    {/* ── 브릿지 크루: AntiGravity 구독 모델 풀 (nova, lumi, lily, pico, ollie, luna) ── */}
                    {agentId !== 'ari' && (<>
                      <optgroup label="✦ Gemini (AntiGravity 구독)">
                        <option value="anti-gemini-3.1-pro-high">🚀 Gemini 3.1 Pro (High) — 최고성능</option>
                        <option value="anti-gemini-3.1-pro-low">⚖️ Gemini 3.1 Pro (Low) — 균형</option>
                        <option value="anti-gemini-3-flash">⚡ Gemini 3 Flash — 고속</option>
                      </optgroup>
                      <optgroup label="✦ Claude (AntiGravity 구독)">
                        <option value="anti-claude-sonnet-4.6-thinking">💡 Claude Sonnet 4.6 (Thinking)</option>
                        <option value="anti-claude-opus-4.6-thinking">🏛️ Claude Opus 4.6 (Thinking)</option>
                      </optgroup>
                      <optgroup label="✦ 기타 (AntiGravity 구독)">
                        <option value="anti-gpt-oss-120b">🌐 GPT-OSS 120B (Medium)</option>
                      </optgroup>
                    </>)}
                  </select>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem', lineHeight: 1.4 }}>
                    {agentId === 'ari' ? 'ARI는 소켓 스트리밍 전용 — Gemini API 직접 호출' : 'AntiGravity 구독 모델 풀 — 파일 브릿지 경유'}
                  </p>
                </div>

                <div>
                  <h4 style={{ margin: 0, marginBottom: '0.6rem', fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>Token Allocation Map</h4>
                  <div style={{ width: '100%', height: '10px', background: 'var(--bg-surface-highest)', borderRadius: '10px', overflow: 'hidden', marginBottom: '0.5rem', border: '1px solid var(--border)' }}>
                    <div style={{ 
                      height: '100%', 
                      width: `${(performanceMock.tokensUsed / performanceMock.tokenLimit) * 100}%`,
                      background: 'linear-gradient(90deg, var(--brand), #9B8BFB)',
                      boxShadow: '0 0 10px var(--brand-glow)',
                    }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', fontWeight: 600 }}>
                    <span style={{ color: 'var(--brand)' }}>{performanceMock.tokensUsed.toLocaleString()} USED</span>
                    <span style={{ color: 'var(--text-muted)' }}>{performanceMock.tokenLimit.toLocaleString()} LIMIT</span>
                  </div>
                  <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>일일 할당량 초과 시 저사양 모델로 자동 강등됩니다.</p>
                </div>
              </div>
            </div>

            {/* 3. 스킬 라이브러리 섹션 → SkillSection 컴포넌트 */}
            <SkillSection
              agentId={agentId}
              onOpenDrawer={() => setShowSkillDrawer(true)}
            />
          </div>
        )}

        {/* TASK 탭: 개인 칸반 보드 */}
        {activeTab === 'TASK' && (
          <>
            <div className="board-header" style={{ marginBottom: '1rem' }}>
              <h3 className="board-header__title" style={{ fontSize: '1rem' }}>{meta.name}의 Task Board</h3>
              <p className="board-header__subtitle">이 팀원에게 할당된 업무 및 큐(Queue) 상태입니다.</p>
            </div>
            
            {myTasks.length === 0 ? (
              <div className="view-empty" style={{ marginTop: '1rem' }}>
                <IcoInbox />
                <p>할당된 업무가 없습니다.</p>
              </div>
            ) : (
              <div className="kanban-board" style={{ marginTop: '0.5rem' }}>
                {COLUMNS.map((col) => (
                  <div key={col} className="column">
                    <div className="column__header">
                      <div className="column__header-left">
                        <h3 className="column__title">{COLUMN_LABELS[col]}</h3>
                        <span className="column__count">{String(tasksByColumn[col].length).padStart(2, '0')}</span>
                      </div>
                    </div>
                    <div className="column__cards">
                      {tasksByColumn[col].map((task) => (
                        <div key={task.id} className="task-card">
                          <p className="task-card__title">{task.title || task.content}</p>
                          <span className={`task-card__priority task-card__priority--${task.priority || 'medium'}`}>
                            {task.priority || 'medium'}
                          </span>
                        </div>
                      ))}
                      {tasksByColumn[col].length === 0 && (
                        <div style={{ padding: '0.5rem', opacity: 0.3, fontSize: '0.75rem', textAlign: 'center' }}>
                          비어있음
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}


      </div>


      {/* 스킬 상세 팝업 → SkillSection 내부로 이동됨 */}

      {/* 스킬 추가 드로어 (프로필 헤더 버튼 & 퍼포먼스 탭 버튼 공통) */}
      <SkillAddDrawer
        isOpen={showSkillDrawer}
        onClose={() => setShowSkillDrawer(false)}
        agentId={agentId}
      />

    </div>
  );
}
