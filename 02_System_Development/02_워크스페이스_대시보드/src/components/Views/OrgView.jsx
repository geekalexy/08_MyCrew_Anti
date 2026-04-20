// src/components/Views/OrgView.jsx — v2.2: Y-Shape 조직도 + 상용화 UI + 분석 탭 + 크루 영입
import { useState, useMemo } from 'react';
import { useAgentStore, TEAMS_REGISTRY } from '../../store/agentStore';
import { useUiStore } from '../../store/uiStore';
import { useKanbanStore } from '../../store/kanbanStore';
import TeamGuidelinesEditor from '../Guidelines/TeamGuidelinesEditor';
import RecruitTalentModal from '../Recruit/RecruitTalentModal';

/* ── 아이콘 ─ */
const IcoPlay  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"/></svg>;
const IcoPause = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>;
const IcoStop  = () => <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12"/></svg>;
const IcoPlus  = () => <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>;

/* ── 에이전트 카드 ─ */
function AgentRosterCard({ agentId, meta, isActive, onSelect, isRoot = false }) {
  return (
    <div
      className={`agent-roster-card${isRoot ? ' agent-roster-card--root' : ''}`}
      onClick={() => onSelect(agentId)}
    >
      <span
        className="agent-roster-card__status-dot"
        style={{ background: isActive ? 'var(--status-active)' : 'var(--border)' }}
      />
      <div className="agent-roster-card__avatar">
        {meta.avatar?.startsWith('/') ? (
          <img src={meta.avatar} alt={meta.name} />
        ) : (
          <span style={{ fontSize: isRoot ? '2.5rem' : '2rem' }}>{meta.avatar}</span>
        )}
      </div>
      <span className="agent-roster-card__name">{meta.name}</span>
      <span className="agent-roster-card__role">{meta.role}</span>
      <span style={{ fontSize: '0.58rem', color: 'var(--text-muted)', opacity: 0.6, fontFamily: 'Space Grotesk, sans-serif' }}>
        {meta.model}
      </span>
    </div>
  );
}

/* ── 채용 슬롯 카드 ─ */
function RecruitSlotCard({ onClick }) {
  return (
    <div className="recruit-slot-card" onClick={onClick}>
      <span className="recruit-slot-card__icon"><IcoPlus /></span>
      <span className="recruit-slot-card__label">크루 영입하기</span>
    </div>
  );
}

/* ── 팀 브랜치 섹션 (Y-Shape 브랜치 내부) ─ */
function TeamBranch({ teamKey, agents, agentMeta, agentStatus, onSelectAgent, onRecruit }) {
  const { teamsRegistry, updateTeamRegistry } = useAgentStore();
  const reg = teamsRegistry?.[teamKey] || TEAMS_REGISTRY[teamKey];

  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState('');

  if (!reg) return null;

  const displayName = reg.name || `프로젝트 ${teamKey}팀`;

  const startEdit = () => { setEditName(displayName); setIsEditing(true); };
  const commitEdit = () => {
    if (editName.trim()) updateTeamRegistry(teamKey, { name: editName.trim() });
    setIsEditing(false);
  };
  const handleKey = (e) => {
    if (e.key === 'Enter')  { e.preventDefault(); commitEdit(); }
    if (e.key === 'Escape') { setIsEditing(false); }
  };

  return (
    <div className="team-group-section">
      {/* 클릭 편집 가능한 팀명 라벨 */}
      {isEditing ? (
        <input
          autoFocus
          value={editName}
          onChange={e => setEditName(e.target.value)}
          onBlur={commitEdit}
          onKeyDown={handleKey}
          style={{
            display: 'block', width: '100%', textAlign: 'center',
            background: 'transparent', border: 'none',
            borderBottom: '1px solid var(--brand)',
            color: 'var(--text-muted)', fontSize: '0.72rem',
            fontWeight: 700, textTransform: 'uppercase',
            letterSpacing: '0.06em', fontFamily: 'Space Grotesk, sans-serif',
            outline: 'none', marginBottom: '0.75rem', padding: '0 0.5rem 2px',
          }}
        />
      ) : (
        <p
          onClick={startEdit}
          title="클릭하여 팀명 수정"
          style={{
            fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
            textTransform: 'uppercase', letterSpacing: '0.06em',
            marginBottom: '0.75rem', fontFamily: 'Space Grotesk, sans-serif',
            textAlign: 'center', cursor: 'pointer',
            borderBottom: '1px dashed transparent',
            transition: 'border-color 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.borderBottomColor = 'rgba(100,135,242,0.35)'}
          onMouseLeave={e => e.currentTarget.style.borderBottomColor = 'transparent'}
        >
          {displayName}
        </p>
      )}

      {/* 에이전트 그리드 */}
      <div className="roster-grid">
        {agents.map(id => {
          const meta = agentMeta[id];
          if (!meta) return null;
          return (
            <AgentRosterCard
              key={id}
              agentId={id}
              meta={meta}
              isActive={agentStatus[id]?.status === 'active'}
              onSelect={onSelectAgent}
            />
          );
        })}

      </div>
    </div>
  );
}

/* ── Y-Shape 조직도 컴포넌트 ─ */
function YShapeOrg({ teamGroups, agentMeta, agentStatus, onSelectAgent, onRecruit }) {
  return (
    <div className="y-org">
      {/* 최상단: 독립 심사관 (ARI) */}
      <div className="y-org__root">
        {teamGroups.independent.map(id => {
          const meta = agentMeta[id];
          if (!meta) return null;
          return (
            <AgentRosterCard
              key={id}
              agentId={id}
              meta={meta}
              isActive={agentStatus[id]?.status === 'active'}
              onSelect={onSelectAgent}
              isRoot
            />
          );
        })}
      </div>
      <p className="y-org__root-label">오케스트레이터</p>

      {/* 수직 커넥터 */}
      <div className="y-org__connector-v" />

      {/* 수평 분기선 */}
      <div className="y-org__hline-wrap">
        <div className="y-org__hline" />
        <div className="y-org__branch-connectors">
          <div className="y-org__branch-connector-v" />
          <div className="y-org__branch-connector-v" />
        </div>
      </div>

      {/* 좌우 브랜치 + 중간 점선 구분선 */}
      <div className="y-org__branches">
        {/* 좌측: Team A */}
        <div className="y-org__branch">
          <TeamBranch
            teamKey="A"
            agents={teamGroups.A}
            agentMeta={agentMeta}
            agentStatus={agentStatus}
            onSelectAgent={onSelectAgent}
            onRecruit={onRecruit}
          />
        </div>

        {/* 중간 세로 점선 구분선 */}
        <div style={{
          width: '1px',
          alignSelf: 'stretch',
          borderLeft: '1.5px dashed rgba(100,135,242,0.25)',
          margin: '0 0.5rem',
          flexShrink: 0,
        }} />

        {/* 우측: Team B */}
        <div className="y-org__branch">
          <TeamBranch
            teamKey="B"
            agents={teamGroups.B}
            agentMeta={agentMeta}
            agentStatus={agentStatus}
            onSelectAgent={onSelectAgent}
            onRecruit={onRecruit}
          />
        </div>
      </div>
    </div>
  );
}

/* ── 새 팀 만들기 모달 ─ */
function NewTeamModal({ projects = [], onClose, onCreate }) {
  const [teamName, setTeamName] = useState('');
  const [selectedProjectId, setSelectedProjectId] = useState(projects?.[0]?.id || '');
  const [isLoading, setIsLoading] = useState(false);

  const handleCreate = async () => {
    if (!teamName.trim()) return;
    setIsLoading(true);
    try {
      await fetch('http://localhost:4000/api/teams', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: teamName, groupType: '협력적', icon: '🟡', color: '#b4c5ff', projectId: selectedProjectId }),
      });
      onCreate({ name: teamName, projectId: selectedProjectId });
    } catch (err) {
      console.error('[NewTeamModal] 팀 생성 실패:', err);
    } finally {
      setIsLoading(false);
      onClose();
    }
  };

  return (
    <div className="new-team-modal__overlay" onClick={onClose}>
      <div className="new-team-modal__card" onClick={e => e.stopPropagation()}>
        <h3 className="new-team-modal__title">🟡 새 팀 만들기</h3>

        <label className="new-team-modal__label">팀 이름</label>
        <input
          type="text"
          value={teamName}
          onChange={e => setTeamName(e.target.value)}
          placeholder="예: 마케팅 지원 스쿼드"
          autoFocus
          onKeyDown={e => { if (e.key === 'Enter') handleCreate(); if (e.key === 'Escape') onClose(); }}
          style={{
            width: '100%', background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
            color: 'var(--text-primary)', padding: '0.5rem 0.7rem', borderRadius: '8px',
            fontSize: '0.9rem', outline: 'none', marginBottom: '1.25rem', boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = 'var(--brand)'}
          onBlur={e => e.target.style.borderColor = 'var(--border)'}
        />

        {projects.length > 0 && (
          <>
            <label className="new-team-modal__label">프로젝트 배치</label>
            <div className="new-team-modal__project-options">
              {projects.map(p => (
                <div
                  key={p.id}
                  className={`new-team-modal__project-option${selectedProjectId === p.id ? ' new-team-modal__project-option--selected' : ''}`}
                  onClick={() => setSelectedProjectId(p.id)}
                >
                  <span style={{ fontSize: '0.7rem', color: 'var(--brand)' }}>●</span>
                  {p.name}
                </div>
              ))}
            </div>
          </>
        )}

        <div className="new-team-modal__footer">
          <button className="btn btn--ghost btn--sm" onClick={onClose}>취소</button>
          <button
            className="btn btn--primary btn--sm"
            onClick={handleCreate}
            disabled={isLoading || !teamName.trim()}
          >
            {isLoading ? '생성 중...' : '팀 생성 →'}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   분석 탭 컴포넌트
══════════════════════════════════════════════════════════ */
function AnalyticsTab() {
  const [dbMetrics, setDbMetrics] = useState(null);

  // 컴포넌트 마운트 시 실DB 통계 조회
  import('react').then(({ useEffect }) => {
    useEffect(() => {
      fetch('http://localhost:4000/api/metrics/cks')
        .then(res => res.json())
        .then(data => {
          if (data.status === 'ok') setDbMetrics(data.metrics);
        })
        .catch(err => console.error('[AnalyticsTab] 메트릭 로드 실패:', err));
    }, []);
  });

  const tasks = useKanbanStore(s => s.tasks);
  const { agents, agentMeta } = useAgentStore();

  // ── 비즈니스 지표 계산 (실데이터) ─────────────────────────
  const taskList = useMemo(() => Object.values(tasks), [tasks]);
  const total     = taskList.length;
  const done      = taskList.filter(t => t.column === 'done').length;
  const inProg    = taskList.filter(t => t.column === 'in-progress').length;
  const todo      = taskList.filter(t => t.column === 'todo').length;
  const doneRate  = total > 0 ? Math.round((done / total) * 100) : 0;

  const agentIds  = Object.keys(agentMeta);
  const activeCount = agentIds.filter(id => agents[id]?.status === 'active').length;
  const activeRate = agentIds.length > 0 ? Math.round((activeCount / agentIds.length) * 100) : 0;

  // ── CKS 연구 실데이터 연동 (Phase 4) ─────────────────────────────────────────
  const cksMetrics = [
    {
      key: 'TEI', label: 'Token Efficiency Index',
      desc: 'API 토큰 소모 평균 (효율화 지수)',
      value: dbMetrics ? dbMetrics.TEI : 0, unit: '토큰', trend: dbMetrics ? '' : '로드 중...', color: '#6487f2',
      bar: false,
      detail: '통제군 대비 다중 에이전트 협업으로 최적화된 누적 토큰 소모량.',
    },
    {
      key: 'KSI-R', label: 'Rule Survival Rate',
      desc: '팀 룰 스프린트 반영률',
      value: dbMetrics ? dbMetrics.KSI_R : 0, unit: '%', trend: '', color: '#4ecb71',
      bar: true, barColor: '#4ecb71',
      detail: 'N번째 스프린트 금지 조항이 N+1 결과에 자연 반영된 비율.',
    },
    {
      key: 'HER', label: 'Hallucination Elim. Rate',
      desc: '사전 차단된 오류 평균 건수',
      value: dbMetrics ? dbMetrics.HER : 0, unit: '건', trend: '', color: '#ffb963',
      bar: false,
      detail: '교차 검증 과정에서 사전에 걸러낸 논리적/사실적 오류 건수.',
    },
    {
      key: 'EII', label: 'Evolution & Iteration Index',
      desc: '창의 아이디어 파생 점수 (1–5)',
      value: dbMetrics ? dbMetrics.EII : 0, unit: '/ 5', trend: '', color: '#c084fc',
      bar: true, barColor: '#c084fc',
      detail: '단순 지시를 넘어선 창의적 워크플로우 제안 수치 (Opus 심사).',
    },
    {
      key: 'IRC', label: 'Iterative Revision Count',
      desc: '칸반 반복 수정 횟수',
      value: dbMetrics ? dbMetrics.IRC : 0, unit: '회', trend: '', color: '#ff5449',
      bar: false,
      detail: '최종 승인(Done) 도달 전 반송되어 반복 수정된 평균 횟수.',
    },
    {
      key: 'UXS', label: 'User Experience Satisfaction',
      desc: '단위 스프린트 체감 만족도 (1–5)',
      value: dbMetrics ? dbMetrics.UXS : 0, unit: '/ 5', trend: '', color: '#ffd166',
      bar: true, barColor: '#ffd166',
      detail: '작업 완료 후 사용자가 체감 퀄리티를 기준으로 부여한 정성 평가.',
    }
  ];

  const KpiCard = ({ label, value, unit, sub, color }) => (
    <div className="glass-panel" style={{ padding: '1.2rem 1.5rem', flex: 1, minWidth: '140px' }}>
      <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.6rem' }}>{label}</p>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.3rem' }}>
        <span style={{ fontSize: '2rem', fontWeight: 800, color: color || 'var(--text-primary)', fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{value}</span>
        {unit && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', fontWeight: 500 }}>{unit}</span>}
      </div>
      {sub && <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.4rem' }}>{sub}</p>}
    </div>
  );

  return (
    <div style={{ animation: 'fadeIn 0.2s' }}>

      {/* ── Section 1: 비즈니스 KPI ── */}
      <div style={{ marginBottom: '2rem' }}>
        <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '0.9rem', fontFamily: 'Space Grotesk, sans-serif' }}>
          팀 생산성 지표
        </p>
        <div style={{ display: 'flex', gap: '0.85rem', flexWrap: 'wrap' }}>
          <KpiCard label="태스크 완료율" value={`${doneRate}`} unit="%" sub={`완료 ${done} / 전체 ${total}`} color="#4ecb71" />
          <KpiCard label="진행 중" value={inProg} unit="건" sub="현재 처리 중" color="#6487f2" />
          <KpiCard label="대기 중" value={todo} unit="건" sub="시작 전" color="#ffb963" />
          <KpiCard label="에이전트 활성도" value={`${activeRate}`} unit="%" sub={`활성 ${activeCount} / 전체 ${agentIds.length}`} color="#c084fc" />
        </div>

        {/* 완료율 바 */}
        <div style={{ marginTop: '1rem', background: 'var(--bg-surface-2)', borderRadius: '6px', overflow: 'hidden', height: '6px' }}>
          <div style={{ width: `${doneRate}%`, height: '100%', background: 'linear-gradient(90deg, #4ecb71, #6487f2)', borderRadius: '6px', transition: 'width 0.6s ease' }} />
        </div>
        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>전체 태스크 완료 진행률 {doneRate}%</p>
      </div>

      {/* ── Section 2: CKS 연구 지표 (Mock) ── */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
          <p style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', fontFamily: 'Space Grotesk, sans-serif', margin: 0 }}>
            CKS 연구 지표
          </p>
          <span style={{ fontSize: '0.6rem', fontWeight: 700, background: 'rgba(100,135,242,0.15)', color: 'var(--brand)', padding: '2px 7px', borderRadius: '99px', border: '1px solid rgba(100,135,242,0.3)', letterSpacing: '0.05em' }}>BETA</span>
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7 }}>— Mock 데이터 · 백엔드 연동 예정</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {cksMetrics.map(m => (
            <div key={m.key} className="glass-panel" style={{ padding: '1rem 1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                    <span style={{ fontSize: '0.7rem', fontWeight: 800, color: m.color, fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.04em' }}>{m.key}</span>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{m.label}</span>
                  </div>
                  <p style={{ fontSize: '0.68rem', color: 'var(--text-muted)', margin: '0 0 0.5rem' }}>{m.detail}</p>
                  {m.bar && (
                    <div style={{ background: 'var(--bg-surface-3)', borderRadius: '4px', overflow: 'hidden', height: '4px', maxWidth: '200px' }}>
                      <div style={{ width: `${Math.min(m.value / (m.key === 'EII' ? 5 : 1), 1) * 100}%`, height: '100%', background: m.barColor, borderRadius: '4px', opacity: 0.7 }} />
                    </div>
                  )}
                </div>
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.2rem', justifyContent: 'flex-end' }}>
                    <span style={{ fontSize: '1.6rem', fontWeight: 800, color: m.color, fontFamily: 'Space Grotesk, sans-serif', lineHeight: 1 }}>{m.value}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{m.unit}</span>
                  </div>
                  <span style={{ fontSize: '0.65rem', color: m.trend?.startsWith('+') ? '#4ecb71' : m.trend?.startsWith('-') && m.key !== 'HER' ? '#ff5449' : '#4ecb71', fontWeight: 600 }}>{m.trend}</span>
                </div>
              </div>
            </div>
          ))}
        </div>

        <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.6, marginTop: '1rem', textAlign: 'center' }}>
          현재 누적된 CKS 데이터 샘플: {dbMetrics ? dbMetrics.totalSamples : 0}건
        </p>
      </div>
    </div>
  );
}


export default function OrgView() {
  const { agents, selectAgent, agentMeta, addAgent } = useAgentStore();
  const { setCurrentView, workspaceName, workspaceLogo, updateWorkspace, projects, addTeam, teamPageTitle, teamPageSubtitle } = useUiStore();

  const [activeTab, setActiveTab] = useState('roster');
  const [showNewTeamModal, setShowNewTeamModal] = useState(false);
  const [showRecruit, setShowRecruit] = useState(false);

  // ── 타이틀 편집
  const [isTitleEditing, setIsTitleEditing] = useState(false);
  const [titleInput, setTitleInput] = useState('');
  const startTitleEdit = () => { setTitleInput(teamPageTitle || 'Team'); setIsTitleEditing(true); };
  const commitTitleEdit = () => { if (titleInput.trim()) updateWorkspace({ teamPageTitle: titleInput.trim() }); setIsTitleEditing(false); };
  const handleTitleKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); commitTitleEdit(); } if (e.key === 'Escape') setIsTitleEditing(false); };

  // ── 서브타이틀 편집
  const [isSubEditing, setIsSubEditing] = useState(false);
  const [subInput, setSubInput] = useState('');
  const startSubEdit = () => { setSubInput(teamPageSubtitle || 'AI 팀 구성원 및 프로젝트 현황'); setIsSubEditing(true); };
  const commitSubEdit = () => { if (subInput.trim()) updateWorkspace({ teamPageSubtitle: subInput.trim() }); setIsSubEditing(false); };
  const handleSubKey = (e) => { if (e.key === 'Enter') { e.preventDefault(); commitSubEdit(); } if (e.key === 'Escape') setIsSubEditing(false); };

  // teamGroup 기준 에이전트 분류
  const teamGroups = {
    A:           Object.entries(agentMeta).filter(([, m]) => m.teamGroup === 'A').map(([id]) => id),
    B:           Object.entries(agentMeta).filter(([, m]) => m.teamGroup === 'B').map(([id]) => id),
    independent: Object.entries(agentMeta).filter(([, m]) => m.teamGroup === 'independent').map(([id]) => id),
  };

  const handleSelectAgent = (agentId) => {
    selectAgent(agentId);
    setCurrentView('agent-detail');
  };

  const handleRecruit = (teamKey) => {
    const role = prompt('새 크루의 역할을 입력하세요:');
    if (role) addAgent(role, teamKey);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => updateWorkspace({ workspaceLogo: ev.target.result });
      reader.readAsDataURL(file);
    }
  };

  const handleNewTeamCreate = (teamDef) => {
    addTeam({ id: `team_${Date.now()}`, group: 'B', name: teamDef.name, projectId: teamDef.projectId });
  };

  return (
    <div className="org-view">

      {/* ── 헤더 ── */}
      <div className="board-header">
        {/* Row 1: 타이틀 + 연필 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isTitleEditing ? (
            <input
              autoFocus
              value={titleInput}
              onChange={e => setTitleInput(e.target.value)}
              onBlur={commitTitleEdit}
              onKeyDown={handleTitleKey}
              style={{
                fontSize: '1.75rem', fontWeight: 800,
                background: 'transparent', border: 'none',
                borderBottom: '2px solid var(--brand)',
                color: 'var(--text-primary)', outline: 'none',
                fontFamily: 'inherit', width: '260px',
              }}
            />
          ) : (
            <h2 className="board-header__title" style={{ margin: 0 }}>
              {teamPageTitle || 'Team'}
            </h2>
          )}
          <button
            onClick={isTitleEditing ? commitTitleEdit : startTitleEdit}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', color: 'var(--text-muted)', opacity: 0.55, display: 'flex', alignItems: 'center', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = '0.55'}
            title={isTitleEditing ? '저장' : '팀명 수정'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{isTitleEditing ? 'check' : 'edit'}</span>
          </button>
        </div>

        {/* Row 2: 서브타이틀 + 작은 연필 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', marginTop: '0.25rem' }}>
          {isSubEditing ? (
            <input
              autoFocus
              value={subInput}
              onChange={e => setSubInput(e.target.value)}
              onBlur={commitSubEdit}
              onKeyDown={handleSubKey}
              style={{
                fontSize: '0.875rem', background: 'transparent', border: 'none',
                borderBottom: '1px solid var(--brand)',
                color: 'var(--text-secondary)', outline: 'none',
                fontFamily: 'inherit', width: '320px',
              }}
            />
          ) : (
            <p className="board-header__subtitle" style={{ margin: 0 }}>
              {teamPageSubtitle || 'AI 팀 구성원 및 프로젝트 현황'}
            </p>
          )}
          <button
            onClick={isSubEditing ? commitSubEdit : startSubEdit}
            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)', opacity: 0, display: 'flex', alignItems: 'center', transition: 'opacity 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.opacity = '1'}
            onMouseLeave={e => e.currentTarget.style.opacity = isSubEditing ? '1' : '0'}
            title={isSubEditing ? '저장' : '설명 수정'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>{isSubEditing ? 'check' : 'edit'}</span>
          </button>
        </div>
      </div>

      {/* ── 탭 ── */}
      <div className="agent-detail-tabs" style={{ marginTop: '1rem', marginBottom: '1.75rem' }}>
        <button
          className={`agent-tab-btn ${activeTab === 'roster' ? 'agent-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('roster')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>groups</span>
          조직도
        </button>
        <button
          className={`agent-tab-btn ${activeTab === 'analytics' ? 'agent-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('analytics')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>bar_chart</span>
          분석
        </button>
        <button
          className={`agent-tab-btn ${activeTab === 'manage' ? 'agent-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('manage')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>settings</span>
          팀 관리
        </button>
      </div>

      {/* ═══ 탭 1: 조직도 — Y-Shape ════════════════════════ */}
      {activeTab === 'roster' && (
        <div style={{ animation: 'fadeIn 0.2s' }}>
          <YShapeOrg
            teamGroups={teamGroups}
            agentMeta={agentMeta}
            agentStatus={agents}
            onSelectAgent={handleSelectAgent}
            onRecruit={handleRecruit}
          />

          {/* [+ 크루 영입하기] 슬롯 카드 */}
          <div
            onClick={() => setShowRecruit(true)}
            style={{
              marginTop: '2rem',
              border: '1.5px dashed rgba(100,135,242,0.35)',
              borderRadius: '14px',
              padding: '1.1rem',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.6rem',
              cursor: 'pointer',
              color: 'var(--brand)',
              fontSize: '0.82rem', fontWeight: 600,
              transition: 'all 0.18s',
              background: 'rgba(100,135,242,0.03)',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(100,135,242,0.08)';
              e.currentTarget.style.borderColor = 'rgba(100,135,242,0.6)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'rgba(100,135,242,0.03)';
              e.currentTarget.style.borderColor = 'rgba(100,135,242,0.35)';
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>person_add</span>
            + 크루 영입하기
          </div>
        </div>
      )}

      {/* ═══ 탭 2: 분석 ══════════════════════════════════════ */}
      {activeTab === 'analytics' && <AnalyticsTab />}

      {activeTab === 'manage' && (
        <div style={{ animation: 'fadeIn 0.2s' }}>

          {/* 워크스페이스 설정 */}
          <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', marginBottom: '1.75rem' }}>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1rem' }}>
              워크스페이스 설정
            </p>
            <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
              {/* 로고 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>회사 로고</label>
                <input type="file" id="logo-upload" accept="image/*" onChange={handleLogoUpload} style={{ display: 'none' }} />
                <label htmlFor="logo-upload" className="btn btn--ghost btn--sm" style={{ cursor: 'pointer', borderStyle: 'dashed' }}>
                  이미지 업로드
                </label>
              </div>
              <div style={{ width: '1px', height: '36px', background: 'var(--border)' }} />
              {/* 회사명 */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>회사명</label>
                <input
                  type="text"
                  value={workspaceName}
                  onChange={e => updateWorkspace({ workspaceName: e.target.value })}
                  placeholder="소시안"
                  style={{
                    background: 'var(--bg-surface-3)', border: '1px solid var(--border)',
                    color: 'var(--text-primary)', padding: '0.4rem 0.6rem', borderRadius: '6px',
                    width: '160px', fontSize: '0.85rem', outline: 'none',
                  }}
                  onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>
          </div>

          {/* 팀 그라운드룰 */}
          <div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '0.75rem' }}>
              Team Guidelines
            </p>
            <TeamGuidelinesEditor agentId="team" agentName={workspaceName} />
          </div>
        </div>
      )}

      {/* ── 새 팀 모달 ── */}
      {showNewTeamModal && (
        <NewTeamModal
          projects={projects}
          onClose={() => setShowNewTeamModal(false)}
          onCreate={handleNewTeamCreate}
        />
      )}

      {/* ── 크루 영입 모달 ── */}
      {showRecruit && (
        <RecruitTalentModal onClose={() => setShowRecruit(false)} />
      )}
    </div>
  );
}
