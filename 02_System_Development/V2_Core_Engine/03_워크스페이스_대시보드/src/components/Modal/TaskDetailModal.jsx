// src/components/Modal/TaskDetailModal.jsx — Phase 11 태스크 상세 제어 모달
import { useState, useEffect, useCallback, useRef } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useKanbanStore } from '../../store/kanbanStore';
import { useAgentStore } from '../../store/agentStore';
import { useTimelineStore } from '../../store/timelineStore';
import { useSocket } from '../../hooks/useSocket';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { renderTaggedText, renderChainRefText } from '../../utils/TagRenderer';
import { useContextChain, extractChainRefs } from '../../hooks/useContextChain';
import ContextChainPanel from './ContextChainPanel';
import PlanMasterModal from './PlanMasterModal';

// ── [CKS] 워크플로우 타임라인 컴포넌트 ─────────────────────────────────
const WORKFLOW_STEPS = [
  { step: 0, label: '엔진 가동',         icon: 'rocket_launch',  color: '#b4c5ff' },
  { step: 1, label: 'Phase 1 병렬 생성', icon: 'fork_right',     color: '#4ade80' },
  { step: 2, label: 'Phase 2 합성/검토', icon: 'merge',          color: '#fbbf24' },
  { step: 3, label: '완료',              icon: 'check_circle',   color: '#4ade80' },
];

const TEAM_AGENTS = {
  team_A: { img: 'NOVA', vid: 'LILY', brain: 'OLLIE', protocol: '적대적 검토' },
  team_B: { img: 'LUMI', vid: 'PICO', brain: 'LUNA',  protocol: 'CKS 협력'   },
};

const SERVER_URL_TL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4010';

function WorkflowTimeline({ taskId }) {
  const logs = useTimelineStore((s) => s.timelines);

  // Anti-Bridge 대기 상태
  const [bridgeWaiting, setBridgeWaiting] = useState([]);

  // 워크플로우 로그 필터
  const wfLogs = logs.filter(
    (l) => String(l.taskId) === String(taskId) && l.step !== undefined
  );
  const currentStep = wfLogs.length > 0
    ? Math.max(...wfLogs.map((l) => l.step ?? 0))
    : -1;

  const teamLog = wfLogs.find((l) => l.message?.includes('team_'));
  const teamId  = teamLog?.message?.includes('team_A') ? 'team_A' : 'team_B';
  const agents  = TEAM_AGENTS[teamId] || TEAM_AGENTS['team_B'];

  const phase1Logs = wfLogs.filter((l) => l.step === 1);
  const imgDone   = phase1Logs.some((l) => l.agentId === agents.img.toLowerCase() && l.message?.includes('완료'));
  const vidDone   = phase1Logs.some((l) => l.agentId === agents.vid.toLowerCase() && l.message?.includes('완료'));
  const imgActive = phase1Logs.some((l) => l.agentId === agents.img.toLowerCase());
  const vidActive = phase1Logs.some((l) => l.agentId === agents.vid.toLowerCase());

  const phase2Logs  = wfLogs.filter((l) => l.step === 2);
  const brainDone   = phase2Logs.some((l) => l.message?.includes('완료'));
  const brainActive = phase2Logs.length > 0;

  // ── Anti-Bridge 폴링 (Phase 2 활성 시 3초 간격) ───────────────────────
  useEffect(() => {
    if (currentStep !== 2 || brainDone) {
      setBridgeWaiting([]);
      return;
    }
    let cancelled = false;
    const poll = async () => {
      try {
        const res  = await fetch(`${SERVER_URL_TL}/api/bridge/status`);
        const data = await res.json();
        if (!cancelled) setBridgeWaiting(data.waiting || []);
      } catch { /* 서버 미응답 시 무시 */ }
    };
    poll();
    const id = setInterval(poll, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [currentStep, brainDone]);

  if (currentStep < 0) return null;

  const AGENT_LABEL = { prime: 'PRIME (Opus)', nexus: 'NEXUS (GPT)' };

  return (
    <div style={{
      background: 'linear-gradient(135deg, rgba(100,135,242,0.06), rgba(74,222,128,0.04))',
      border: '1px solid rgba(180,197,255,0.15)',
      borderRadius: '14px',
      padding: '1rem 1.1rem',
      marginBottom: '1.25rem',
    }}>
      {/* 헤더 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.9rem' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#b4c5ff' }}>account_tree</span>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#b4c5ff', letterSpacing: '0.08em', fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase' }}>
          3인 협업 워크플로우 · {agents.protocol}
        </span>
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk, sans-serif' }}>
          {teamId === 'team_A' ? '⛔ Team A' : '🌙 Team B'}
        </span>
      </div>

      {/* 스텝 프로그레스바 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '1rem' }}>
        {WORKFLOW_STEPS.map((s, i) => {
          const isDone    = currentStep > s.step;
          const isActive  = currentStep === s.step;
          return (
            <div key={s.step} style={{ display: 'flex', alignItems: 'center', flex: i < 3 ? 1 : 'none' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.3rem' }}>
                <div style={{
                  width: '30px', height: '30px', borderRadius: '50%',
                  background: isDone ? s.color : isActive ? 'rgba(180,197,255,0.2)' : 'rgba(255,255,255,0.05)',
                  border: `2px solid ${isDone || isActive ? s.color : 'rgba(255,255,255,0.1)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  boxShadow: isActive ? `0 0 12px ${s.color}55` : 'none',
                  transition: 'all 0.3s ease',
                  animation: isActive ? 'thinking-glow-pulse 2s ease-in-out infinite' : 'none',
                }}>
                  <span className="material-symbols-outlined" style={{
                    fontSize: '0.9rem',
                    color: isDone || isActive ? (isDone ? 'var(--bg-base)' : s.color) : 'var(--text-muted)',
                  }}>{isDone ? 'check' : s.icon}</span>
                </div>
                <span style={{
                  fontSize: '0.6rem', fontWeight: 600, color: isDone || isActive ? s.color : 'var(--text-muted)',
                  fontFamily: 'Space Grotesk, sans-serif', whiteSpace: 'nowrap', textAlign: 'center',
                  letterSpacing: '0.04em',
                }}>{s.label}</span>
              </div>
              {i < 3 && (
                <div style={{
                  flex: 1, height: '2px', margin: '0 4px', marginBottom: '18px',
                  background: isDone ? `linear-gradient(to right, ${s.color}, ${WORKFLOW_STEPS[i+1].color})` : 'rgba(255,255,255,0.08)',
                  transition: 'background 0.4s ease',
                }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Phase 1: 병렬 에이전트 미니 상태바 */}
      {currentStep >= 1 && (
        <div style={{ display: 'flex', gap: '0.6rem', marginBottom: currentStep >= 2 ? '0.6rem' : 0 }}>
          {[
            { id: agents.img, role: '🖼 이미지', done: imgDone, active: imgActive && !imgDone },
            { id: agents.vid, role: '🎬 영상',   done: vidDone, active: vidActive && !vidDone },
          ].map((ag) => (
            <div key={ag.id} style={{
              flex: 1, background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.45rem 0.65rem',
              border: `1px solid ${ag.done ? 'rgba(74,222,128,0.3)' : ag.active ? 'rgba(180,197,255,0.25)' : 'rgba(255,255,255,0.07)'}`,
              transition: 'border-color 0.3s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.3rem' }}>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{ag.role}</span>
                <span style={{
                  fontSize: '0.65rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif',
                  color: ag.done ? '#4ade80' : ag.active ? '#b4c5ff' : 'var(--text-muted)',
                  marginLeft: 'auto',
                }}>{ag.done ? '✓ 완료' : ag.active ? '● 작업중' : '대기'}</span>
              </div>
              <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{
                  height: '100%', borderRadius: '2px',
                  width: ag.done ? '100%' : ag.active ? '60%' : '0%',
                  background: ag.done ? '#4ade80' : 'var(--brand)',
                  transition: 'width 0.5s ease',
                }} />
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.2rem', fontFamily: 'SF Mono, monospace' }}>
                {ag.id}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Phase 2: 합성자 상태 */}
      {currentStep >= 2 && (
        <div style={{
          background: 'rgba(0,0,0,0.2)', borderRadius: '8px', padding: '0.45rem 0.65rem',
          border: `1px solid ${brainDone ? 'rgba(74,222,128,0.3)' : brainActive ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.07)'}`,
          display: 'flex', alignItems: 'center', gap: '0.5rem',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: brainDone ? '#4ade80' : '#fbbf24' }}>
            {brainDone ? 'check_circle' : 'psychology'}
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                {teamId === 'team_B' ? '🌙 LUNA' : '⛔ OLLIE'} · {agents.protocol}
              </span>
              <span style={{
                fontSize: '0.65rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif',
                color: brainDone ? '#4ade80' : brainActive ? '#fbbf24' : 'var(--text-muted)',
                marginLeft: 'auto',
              }}>{brainDone ? '✓ 통합 완료' : brainActive ? '● 분석 중' : '대기'}</span>
            </div>
            <div style={{ height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden', marginTop: '0.3rem' }}>
              <div style={{
                height: '100%', borderRadius: '2px',
                width: brainDone ? '100%' : brainActive ? '45%' : '0%',
                background: '#fbbf24',
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        </div>
      )}

      {/* ── [Anti-Bridge] 대기 인디케이터 ── */}
      {bridgeWaiting.length > 0 && (
        <div style={{ marginTop: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {bridgeWaiting.map((b) => {
            const mins = Math.floor(b.elapsedSec / 60);
            const secs = b.elapsedSec % 60;
            const elapsed = mins > 0 ? `${mins}분 ${secs}초` : `${secs}초`;
            return (
              <div key={b.agentKey} style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: b.timedOut ? 'rgba(255,82,82,0.07)' : 'rgba(251,191,36,0.07)',
                border: `1px solid ${b.timedOut ? 'rgba(255,82,82,0.25)' : 'rgba(251,191,36,0.25)'}`,
                borderRadius: '8px', padding: '0.5rem 0.75rem',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: b.timedOut ? '#ff5449' : '#fbbf24', flexShrink: 0 }}>
                  {b.timedOut ? 'warning' : 'hourglass_top'}
                </span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: b.timedOut ? '#ff5449' : '#fbbf24', fontFamily: 'Space Grotesk, sans-serif' }}>
                    {b.timedOut ? `⏰ 대기 시간 초과 → Flash Fallback 전환 중` : `⏳ ${AGENT_LABEL[b.agentKey] || b.agentKey} — 대표님의 트리거 대기 중`}
                  </div>
                  <div style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '1px' }}>
                    {b.timedOut ? '5분 초과 — 자동으로 Gemini Flash가 대역 실행합니다' : `경과: ${elapsed} / 최대 5분`}
                  </div>
                </div>
                {!b.timedOut && (
                  <div style={{ fontSize: '0.68rem', color: '#fbbf24', fontFamily: 'SF Mono, monospace', flexShrink: 0 }}>
                    {elapsed}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
// ── 워크플로우 타임라인 끝 ──────────────────────────────────────────────


const STATUS_LABEL = {
  PENDING:    { text: '대기 중',    color: 'var(--text-muted)' },
  in_progress:{ text: '진행 중',   color: 'var(--status-active)' },
  REVIEW:     { text: '승인 대기', color: 'var(--brand)' },
  COMPLETED:  { text: '완료',      color: 'var(--brand)' },
  done:       { text: '완료',      color: 'var(--brand)' },
  ARCHIVED:   { text: '아카이브',  color: '#F59E0B' },  // 주황색
  FAILED:     { text: '실패',      color: 'var(--text-muted)' },
  PAUSED:     { text: '중단됨',    color: 'var(--status-active)' },
};

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4010';

const formatModelName = (modelStr, agentMeta = {}) => {
  if (!modelStr) return '';
  const lowerStr = modelStr.toLowerCase();

  // 브릿지 에이전트인 경우 프론트엔드 프로필 설정값 동기화 반영
  let resolvedModel = lowerStr;
  if (lowerStr.startsWith('anti-bridge-')) {
    const agentId = lowerStr.replace('anti-bridge-', '');
    const profileModel = agentMeta[agentId]?.model;
    if (profileModel) {
      resolvedModel = profileModel.toLowerCase();
    }
  }

  const map = {
    'anti-gemini-3.1-pro-high': 'Gemini 3.1 Pro',
    'anti-gemini-3.1-pro-low': 'Gemini 3.1 Pro',
    'anti-gemini-3-flash': 'Gemini 3 Flash',
    'anti-claude-sonnet-4.6-thinking': 'Claude Sonnet 4.6',
    'anti-claude-opus-4.6-thinking': 'Claude Opus 4.6',
    'anti-gpt-oss-120b': 'GPT-OSS 120B',
    'gemini-2.5-flash': 'Gemini 2.5 Flash',
    'gemini-2.5-pro': 'Gemini 2.5 Pro',
    'gemini-exp-1206': 'Gemini Exp 1206',
    
    // [Bridge 에이전트 매핑] (프로필 모델이 없을 경우 대비 기본 폴백)
    'anti-bridge-nova': 'Gemini 3.1 Pro',
    'anti-bridge-lumi': 'Gemini 3.1 Pro',
    'anti-bridge-lily': 'Claude Sonnet 4.6',
    'anti-bridge-pico': 'Claude Sonnet 4.6',
    'anti-bridge-ollie': 'Claude Opus 4.6',
    'anti-bridge-luna': 'Claude Opus 4.6'
  };
  return map[resolvedModel] || resolvedModel.replace(/-preview|-latest/g, '').replace('anti-bridge-', '');
};

export default function TaskDetailModal() {
  const { activeDetailTaskId, setActiveDetailTaskId, setFocusedTaskId, focusedTaskId, openArtifact } = useUiStore();
  const tasks = useKanbanStore((s) => s.tasks);
  const removeTask = useKanbanStore((s) => s.removeTask);
  const updateTaskStatus = useKanbanStore((s) => s.updateTaskStatus);
  const patchTask = useKanbanStore((s) => s.patchTask);
  const agentMeta = useAgentStore((s) => s.agentMeta);

  const { socket } = useSocket();
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState('discussion'); // [S4-2] 탭: 'discussion' | 'activity' | 'graph'
  const [graphReport, setGraphReport] = useState(null);
  

  const [isStarting, setIsStarting] = useState(false); // [Sprint4+] 실행 시작 로딩
  // [Phase 43] Auto Run 상태 추적
  const [autoRunStatus, setAutoRunStatus] = useState(null); // null | { taskTitle, step, maxSteps }
  const [commentColumn, setCommentColumn] = useState('');
  const [commentAssignee, setCommentAssignee] = useState('');
  const [commentPriority, setCommentPriority] = useState('medium');
  
  // 편집 기능 상태 
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editColumn, setEditColumn] = useState('todo');
  const [editPriority, setEditPriority] = useState('');

  // [Phase 39] Toast & Auto-Fallback 상태
  const [toastMsg, setToastMsg] = useState('');
  const showToast = useCallback((msg, duration = 4000) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), duration);
  }, []);

  const checkAutoFallback = () => {
    if (!task?.content || task.content.trim().length < 5) {
      if (['DEV', 'QA', 'DEBUG'].includes(task?.mode)) {
        patchTask(task.id, { mode: 'ARCHITECT', model: 'Claude Opus 4.6 (Thinking)' });
        fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: 'ARCHITECT', model: 'Claude Opus 4.6 (Thinking)' })
        }).catch(console.error);
        
        showToast('📋 상세 내용이 없어 기획 모드로 자동 전환되었습니다.');
        return 'ARCHITECT';
      }
    }
    return task?.mode || 'DEV';
  };
  
  // [Phase 39] 통합 UI 모드/모델 상태
  const [isCommentExpanded, setIsCommentExpanded] = useState(false);
  const [showModeSelector, setShowModeSelector] = useState(false);
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [editAssignee, setEditAssignee] = useState('');
  const [editModel, setEditModel] = useState('');
  
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [reworkReason, setReworkReason] = useState('');
  const [showReworkInput, setShowReworkInput] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isArchived, setIsArchived] = useState(false); // 아카이빙 완료 상태 (API 호출 후 모달 유지)
  const [isExpanded, setIsExpanded] = useState(false); // 노션 스타일 확장 뷰 토글
  const [copiedCommentIdx, setCopiedCommentIdx] = useState(null); // [Phase 36b] 복사 피드백 상태
  // [Plan Master Fix] ARCHITECT 모드 실행 시 PlanMasterModal 제어
  const [showPlanMasterModal, setShowPlanMasterModal] = useState(false);

  // ── [Phase 37] Live Split Preview ────────────────────────────────────────
  const [isPreviewMode, setIsPreviewMode] = useState(false);
  const [splitRatio, setSplitRatio] = useState(50);      // 좌측 패널 % 비율
  const [previewError, setPreviewError] = useState(false); // iframe 로드 실패 여부
  const [hasPreviewData, setHasPreviewData] = useState(false); // OUTPUT/index.html 존재 여부
  const iframeRef  = useRef(null);
  const resizerRef = useRef(null);
  const isDragging = useRef(false);

  const task = activeDetailTaskId ? (tasks[String(activeDetailTaskId)] || null) : null;
  const isFocused = String(focusedTaskId) === String(activeDetailTaskId);

  // [Phase B] Right Pane 탭 상태 ('preview' | 'graph')
  const [rightPaneTab, setRightPaneTab] = useState(task?.status === 'BACKLOG' ? 'graph' : 'preview');
  const [graphPaneExists, setGraphPaneExists] = useState(false);
  const [graphPaneChecked, setGraphPaneChecked] = useState(false);
  const graphIframeRef = useRef(null);

  // [Phase 37 Context Chain 훅은 task 선언 이후로 이동됨 — 아래 참고]

  const textareaRef = useRef(null);
  const editAreaRef = useRef(null);
  const moreMenuRef = useRef(null);

  // ── /슬래시 커맨드 자동완성 ──────────────────────────────────────────────────
  const [slashQuery, setSlashQuery]           = useState('');
  const [showSlash, setShowSlash]             = useState(false);
  const [slashTarget, setSlashTarget]         = useState(null); // 'comment' | 'edit'
  const slashRef = useRef(null);
  
  const getSlashCommands = (status) => {
    const commands = [
      { id: '/코드',  label: '코드 블록 삽입', icon: 'data_object' },
      { id: '/bugdog기록', label: '버그독 자동화 기록', icon: 'bug_report' },
      { id: '/stop',  label: '파이프라인 강제 종료 (Stuck 해제)', icon: 'stop' },
    ];
    
    if (status === 'BACKLOG' || status === 'TODO') {
      commands.push(
        { id: '/init', label: '기획서 초안 작성', icon: 'edit_document' },
        { id: '/plan_master', label: '스코프 분석 및 로드맵 생성', icon: 'psychology_alt' },
        { id: '/split', label: '태스크 분할', icon: 'call_split' }
      );
    } else if (status === 'IN_PROGRESS') {
      commands.push(
        { id: '/plan_master', label: '추가 기획 및 스코프 분석', icon: 'psychology_alt' },
        { id: '/auto_run', label: '자율 연속 파이프라인 실행', icon: 'rocket_launch' },
        { id: '/debug', label: '버그 수정', icon: 'bug_report' },
        { id: '/refactor', label: '리팩토링', icon: 'cleaning_services' },
        { id: '/trace', label: '로그 역추적', icon: 'manage_search' }
      );
    } else if (status === 'REVIEW') {
      commands.push(
        { id: '/review', label: '코드 검토', icon: 'rate_review' },
        { id: '/auto_test', label: '시나리오 자율 테스트', icon: 'fact_check' },
        { id: '/linter', label: '정적 분석', icon: 'spellcheck' }
      );
    } else if (status === 'DONE' || status === 'FINALIZED') {
      commands.push(
        { id: '/deploy', label: '배포', icon: 'cloud_upload' }
      );
    }
    return commands;
  };

  const SLASH_COMMANDS = getSlashCommands(task?.status);
  const filteredSlash = SLASH_COMMANDS.filter(c => c.id.includes(slashQuery));

  const getAvailableModes = (status) => {
    const s = (status || '').toUpperCase();
    const allModes = [
      { value: 'NONE', label: '선택하지 않음' },
      { value: 'ARCHITECT', label: '📐 기획 모드' },
      { value: 'DEV', label: '💻 개발 모드' },
      { value: 'QA', label: '🕵️‍♂️ 리뷰 모드' },
      { value: 'DEBUG', label: '🧰 디버깅 모드' },
    ];
    
    if (s === 'BACKLOG' || s === 'TODO') {
      return allModes.filter(m => ['NONE', 'ARCHITECT', 'DEV'].includes(m.value));
    } else if (s === 'IN_PROGRESS') {
      return allModes.filter(m => ['NONE', 'ARCHITECT', 'DEV', 'DEBUG'].includes(m.value));
    } else if (s === 'REVIEW') {
      return allModes.filter(m => ['NONE', 'QA', 'DEBUG'].includes(m.value));
    } else if (s === 'DONE' || s === 'COMPLETED' || s === 'FINALIZED' || s === 'ARCHIVED') {
      return allModes.filter(m => ['NONE'].includes(m.value));
    }
    return allModes;
  };
  const availableModes = getAvailableModes(task?.status);


  useEffect(() => {
    if (activeCommentTab === 'graph' && !graphReport) {
      const projectId = task?.projectId || task?.project_id;
      if (projectId) {
        fetch(`${SERVER_URL}/preview/${projectId}/OUTPUT/GRAPH_REPORT.md`)
          .then(r => r.ok ? r.text() : '지식망 리포트가 아직 생성되지 않았거나 워치독 스캔 전입니다.')
          .then(text => setGraphReport(text))
          .catch(() => setGraphReport('리포트를 불러오지 못했습니다.'));
      }
    }
  }, [activeCommentTab, task, SERVER_URL, graphReport]);

  // ── [Phase 37] Context Chaining — task 선언 이후 (ReferenceError 방지) ───
  const projectId = task?.projectId || task?.project_id || null;
  const contextChain = useContextChain(projectId);
  const isChainMode = !!contextChain.activeRef;
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!activeDetailTaskId) return;
    setComments([]);
    setActiveCommentTab('discussion');
    setIsLoadingComments(true);
    fetch(`${SERVER_URL}/api/tasks/${activeDetailTaskId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(Array.isArray(data.comments) ? data.comments : []))
      .catch(() => setComments([]))
      .finally(() => setIsLoadingComments(false));

    // 초기 폼 상태 동기화
    setCommentColumn('NO_CHANGE');
    setCommentAssignee('NO_CHANGE');
    setCommentPriority('NO_CHANGE');

    // [Phase 37] OUTPUT/index.html 존재 여부 사전 체크
    setHasPreviewData(false);
    setIsPreviewMode(false);
    const projectId = tasks[String(activeDetailTaskId)]?.projectId
      || tasks[String(activeDetailTaskId)]?.project_id;
    if (projectId) {
      fetch(`${SERVER_URL}/preview/${projectId}/OUTPUT/index.html`, { method: 'HEAD' })
        .then((r) => setHasPreviewData(r.ok))
        .catch(() => setHasPreviewData(false));
    }
    
    // Auto-edit mode & Comment Expanded state for tasks
    const t = tasks[String(activeDetailTaskId)];
    if (t) {
      import('../../store/uiStore').then(module => {
        const uiStore = module.useUiStore.getState();
        const isManual = uiStore.lastManualTaskTitle === t.title;
        
        // 대표님의 말씀대로, "내용이 비어있는지(!t.content)" + "만들기 버튼 클릭(isManual)" 결합
        if (!t.content && isManual) {
          setIsEditing(true);
          setEditContent('');
          setEditTitle(t.title);
          setEditAssignee(t.assignee || '');
          setEditModel(t.model || '');
          setEditColumn(t.column || 'todo');
          setEditPriority(t.priority || '');
          setIsCommentExpanded(false); // 내용 저장 전단계는 접힘 상태
          
          // 1회성 사용 후 플래그 초기화
          uiStore.setLastManualTaskTitle(null);
          
          setTimeout(() => editAreaRef.current?.focus(), 150);
        } else {
          setIsEditing(false);
          setIsCommentExpanded(true); // 내용이 있는 카드나 에이전트 생성 카드는 기본 열림 상태
        }
      });
    }
  }, [activeDetailTaskId]);

  // 텍스트에어리어 자동 높이 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [commentText]);

  // 실시간 소켓: 에이전트 댓글 자동 수신
  useEffect(() => {
    if (!socket || !activeDetailTaskId) return;
    const KNOWN_AGENTS = ['ari','nova','lumi','pico','ollie','lily','luna','devteam','system'];
    const handler = ({ taskId, author, text, createdAt }) => {
      if (String(taskId) !== String(activeDetailTaskId)) return;
      // CEO가 작성한 댓글은 optimistic update로 이미 추가된 것이멐 중복 방지
      if (author === 'CEO') return;
      const isAgent = KNOWN_AGENTS.includes(author?.toLowerCase());
      setComments((prev) => {
        const targetName = prev.length > 0
          ? prev[prev.length - 1].source?.name || prev[prev.length - 1].author
          : 'CEO';
        const newC = {
          author,
          source: isAgent
            ? { id: `agent-${author.toLowerCase()}`, name: author }
            : { id: 'user-1', name: author || 'CEO' },
          target: { id: 'user-1', name: targetName },
          content: text,
          created_at: createdAt || new Date().toISOString(),
        };
        return [...prev, newC];
      });
    };
    socket.on('task:comment_added', handler);
    return () => socket.off('task:comment_added', handler);
  }, [socket, activeDetailTaskId]);

  // [Phase 39-3] Plan Master 트리거 수신 (Zero-Command UX)
  useEffect(() => {
    if (!socket || !activeDetailTaskId) return;
    const onPlanMasterTrigger = ({ taskId }) => {
      if (String(taskId) === String(activeDetailTaskId)) {
        setShowPlanMasterModal(true);
      }
    };
    socket.on('plan-master:trigger', onPlanMasterTrigger);
    return () => socket.off('plan-master:trigger', onPlanMasterTrigger);
  }, [socket, activeDetailTaskId]);

  // [Sprint4+] 이벤트 드리븐: task:updated 수신 → IN_PROGRESS 시 Activity 자동 기록
  useEffect(() => {
    if (!socket || !activeDetailTaskId) return;
    const onTaskUpdated = ({ taskId, status, column }) => {
      if (String(taskId) !== String(activeDetailTaskId)) return;
      if (status !== 'IN_PROGRESS' && column !== 'in_progress') return;

      const currentTask = useKanbanStore.getState().tasks[String(activeDetailTaskId)];
      const assignee = currentTask?.assignee || '담당자';

      setComments((prev) => {
        const last = prev[prev.length - 1];
        if (last?.author === 'system' && last?.content?.includes('시작')) return prev; // 중복 방지
        return [...prev, {
          author: 'system',
          source: { id: 'system', name: 'system' },
          target: { id: 'user-1', name: 'CEO' },
          content: `▶️ ${assignee}이(가) 작업을 시작했습니다.`,
          created_at: new Date().toISOString(),
        }];
      });
      // setActiveCommentTab('activity'); // [버그수정] 디스커션 탭 기본 유지 요청으로 인해 자동 전환 기능 제거
    };
    socket.on('task:updated', onTaskUpdated);
    return () => socket.off('task:updated', onTaskUpdated);
  }, [socket, activeDetailTaskId]);

  // [Phase 43] Auto Run 상태 추적 — log:append에서 Step 정보 파싱
  useEffect(() => {
    if (!socket || !activeDetailTaskId) return;

    const onLogAppend = (payload) => {
      if (String(payload.taskId) !== String(activeDetailTaskId)) return;
      const msg = payload.message || '';

      // "⏳ [AutoRun] Step N: ..." 패턴 감지
      const stepMatch = msg.match(/\[AutoRun\] Step (\d+)/i);
      if (stepMatch) {
        setAutoRunStatus(prev => ({
          taskTitle: prev?.taskTitle || task?.title || '',
          step: parseInt(stepMatch[1], 10),
          maxSteps: 15,
        }));
        // 활성 시 Activity 탭으로 자동 전환
        setActiveCommentTab('activity');
      }

      // 🛑 종료 메시지 감지
      if (msg.includes('🛑') || msg.includes('✅') && msg.includes('REVIEW') || msg.includes('🏁')) {
        setAutoRunStatus(null);
      }
    };

    const onAutoRunStopped = (payload) => {
      if (String(payload.projectId) === String(task?.project_id)) {
        setAutoRunStatus(null);
      }
    };

    socket.on('log:append', onLogAppend);
    socket.on('autorun:stopped', onAutoRunStopped);
    return () => {
      socket.off('log:append', onLogAppend);
      socket.off('autorun:stopped', onAutoRunStopped);
    };
  }, [socket, activeDetailTaskId, task?.project_id, task?.title]);

  const handleClose = useCallback(() => {
    // 아카이빙 완료 후 닫힉 시 카드를 스토어에서 제거
    if (isArchived && activeDetailTaskId) {
      removeTask(String(activeDetailTaskId));
    }
    setActiveDetailTaskId(null);
    setIsConfirmingDelete(false);
    setIsEditing(false);
    setShowReworkInput(false);
    setReworkReason('');
    setIsArchived(false);
    setIsPreviewMode(false);
    setIsExpanded(false); // [버그수정] 확장 페이지 상태 초기화
    contextChain.closePanel(); // [버그수정] 체인 패널 상태 초기화
    setSplitRatio(50);
    setRightPaneTab('preview'); // [Phase B] 탭 초기화
  }, [setActiveDetailTaskId, isArchived, activeDetailTaskId, removeTask, contextChain]);

  // ── [Phase 37] Resizer 드래그 핸들러 ─────────────────────────────────────
  const handleResizerMouseDown = useCallback((e) => {
    e.preventDefault();
    isDragging.current = true;
    // iframe 위에서 mousemove 이벤트 끊김 방지
    if (iframeRef.current) iframeRef.current.style.pointerEvents = 'none';

    const onMouseMove = (ev) => {
      if (!isDragging.current) return;
      const container = resizerRef.current?.parentElement;
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const newRatio = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplitRatio(Math.min(Math.max(newRatio, 20), 80)); // 20~80% 클램핑
    };
    const onMouseUp = () => {
      isDragging.current = false;
      if (iframeRef.current) iframeRef.current.style.pointerEvents = 'auto';
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
  }, []);

  const previewUrl = (() => {
    const projectId = task?.projectId || task?.project_id;
    if (!projectId) return null;
    return `${SERVER_URL}/preview/${projectId}/OUTPUT/index.html`;
  })();

  // [Phase B] 지식 그래프 URL
  const graphUrl = (() => {
    const projectId = task?.projectId || task?.project_id;
    if (!projectId) return null;
    return `${SERVER_URL}/preview/${projectId}/OUTPUT/graph.html`;
  })();

  // [Phase B] Graph 탭 클릭 시 graph.html 존재 확인
  const handleGraphTabClick = () => {
    setRightPaneTab('graph');
    if (!graphPaneChecked && graphUrl) {
      setGraphPaneChecked(false);
      fetch(graphUrl, { method: 'HEAD' })
        .then((r) => setGraphPaneExists(r.ok))
        .catch(() => setGraphPaneExists(false))
        .finally(() => setGraphPaneChecked(true));
    }
  };

  const handlePreviewRefresh = () => {
    setPreviewError(false);
    if (iframeRef.current) {
      iframeRef.current.src = iframeRef.current.src;
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleEditTask = () => {
    setEditTitle(task.title);
    setEditContent(task.content || '');
    setEditAssignee(task.assignee || '');
    setEditModel(task.model || '');
    setEditColumn(task.column || 'todo');
    setEditPriority(task.priority || '');
    setIsEditing(true);
    setShowMoreMenu(false);
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    
    const trimmedContent = editContent.trim();

    // ── [Phase 36/32] 내용 편집 창에서도 커맨드 인터셉트 (내용 저장 대신 실행) ────────────
    if (trimmedContent.startsWith('/run') || trimmedContent.startsWith('/run-b')) {
      const pipelineMode = trimmedContent.startsWith('/run-b') ? 'run-b' : 'run';
      const projectId = task.projectId || task.project_id;
      if (projectId) {
        fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(projectId)}/pipeline/${pipelineMode}`, { 
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ taskId: String(task.id) })
        })
          .then(async (res) => {
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || '파이프라인 시작 실패');
            const msg = pipelineMode === 'run'
              ? `🚀 /run 파이프라인 시작 — ${data.title || 'PRD'}부터 Advisor 리뷰까지 자율 완주`
              : `⏸ /run-b 단계별 확인 모드 시작`;
            useTimelineStore.getState().appendTimeline({
              level: 'info', message: msg, agentId: 'system',
              timestamp: new Date().toISOString(), projectId,
              taskId: String(task.id),
            });
            fetch(`${SERVER_URL}/api/tasks/${task.id}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ author: 'system', content: msg }),
            }).catch(console.error);
          })
          .catch(err => alert(err.message));
      }
      setIsEditing(false);
      return;
    }

    if (trimmedContent.startsWith('/bugdog기록')) {
      socket.emit('task:message', { taskId: task.id, text: trimmedContent, author: 'CEO' });
      setIsEditing(false);
      return;
    }
    
    const payload = {
      title: editTitle.trim(), 
      content: trimmedContent
    };
    
    patchTask(task.id, payload);
    
    // REST API로 Backend(DB)에 동기화
    fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    }).catch(console.error);

    setIsEditing(false);
  };

  // ESC 키로 모달 닫기
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') handleClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [handleClose]);

  // 더보기 메뉴 외부 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target)) {
        setShowMoreMenu(false);
        setIsConfirmingDelete(false);
      }
    };
    if (showMoreMenu) window.addEventListener('mousedown', handleClickOutside);
    return () => window.removeEventListener('mousedown', handleClickOutside);
  }, [showMoreMenu]);

  // 댓글 전송 (REST → 실시간 반영)
  const handleSubmitComment = () => {
    if (!commentText.trim() || !task) return;

    const trimmedText = commentText.trim();
    const finalMode = checkAutoFallback();

    let finalColumn = commentColumn === 'NO_CHANGE' ? task.column : commentColumn;
    const finalPriority = commentPriority === 'NO_CHANGE' ? task.priority : commentPriority;
    
    if (finalPriority === 'high' && finalColumn === 'todo') {
      finalColumn = 'in_progress';
    }

    const finalAssignee = commentAssignee === 'NO_CHANGE' ? task.assignee : commentAssignee;
    
    // [UX 고도화] Handoff (담당자 변경) 시 칼럼을 명시하지 않았다면 새 담당자의 todo 큐로 자동 이동
    const isHandoff = finalAssignee && finalAssignee !== task.assignee && finalAssignee !== '미할당';
    if (isHandoff && commentColumn === 'NO_CHANGE' && ['in_progress', 'review'].includes(task.column)) {
      finalColumn = 'todo';
    }
    
    const hasUpdates = (finalPriority !== task.priority) || (finalAssignee !== task.assignee) || (finalColumn !== task.column);

    if (hasUpdates) {
       patchTask(task.id, {
         priority: finalPriority,
         assignee: finalAssignee,
         column: finalColumn
       });
       if (finalColumn && finalColumn !== task.column) {
         useKanbanStore.getState().moveTask(task.id, finalColumn);
       }
       
       // REST 동기화
       fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
         method: 'PATCH',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify({
           priority: finalPriority,
           assignee: finalAssignee,
           column: finalColumn
         })
       }).catch(console.error);
    }

    // Optimistic update: target 결정 원칙
    // CEO 댓글은 항상 현재(또는 새로 지정된) assignedAgent에게 지시
    // → assignee를 바꾸면 새 담당자, 그대로면 기존 담당자
    const assigneeChanged = finalAssignee && finalAssignee !== task.assignee && finalAssignee !== '미할당';
      const targetName = assigneeChanged
        ? finalAssignee
        : (commentAssignee || task.assignee || 'ARI');
      const newComment = {
        author: 'CEO',
        source: { id: 'user-1', name: 'CEO' },
        target: { id: 'agent', name: targetName },
        content: commentText.trim(),
        created_at: new Date().toISOString()
      };
      
      setComments((prev) => [...prev, newComment]);
      setIsCommentExpanded(false); // Reset comment expansion
      
      // REST 동기화
      fetch(`${SERVER_URL}/api/tasks/${task.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: 'CEO',
          content: newComment.content,
          source: newComment.source,
          target: newComment.target,
          mode: finalMode,
          model: task.model || 'Claude Sonnet 4.6 (Thinking)',
          assignedAgent: finalAssignee,
        })
      }).then(() => {
        if (finalMode === 'NONE' || trimmedText.startsWith('/')) {
           fetch(`${SERVER_URL}/api/tasks/${task.id}/run`, {
             method: 'POST',
             headers: { 'Content-Type': 'application/json' },
             body: JSON.stringify({ mode: 'NONE', intent: trimmedText })
           })
           .then(r => r.json())
           .then(data => {
             if (data.status === 'redirect') {
               setActiveDetailTaskId(null);
               setTimeout(() => setActiveDetailTaskId(data.redirectTaskId), 100);
             }
           })
           .catch(console.error);
        }
      }).catch(console.error);

      setCommentText('');
    setCommentColumn('NO_CHANGE');
    setCommentAssignee('NO_CHANGE');
    setCommentPriority('NO_CHANGE');
  };

  // Kill 실행
  const handleKill = () => {
    fetch(`${SERVER_URL}/api/tasks/${task.id}/kill`, { method: 'POST' })
      .then((r) => r.json())
      .then(() => updateTaskStatus(task.id, 'PAUSED'))
      .catch(console.error);
  };

  // [Sprint4+] Todo → In Progress 즉시 실행 핸들러
  const handleStartTask = () => {
    if (!task.assignee || task.assignee === '미할당') {
      alert('담당자를 먼저 지정해주세요.');
      return;
    }
    const finalMode = checkAutoFallback();

    // [Bug 3 Fix] ARCHITECT 모드: Plan Master 전용 기획 파이프라인 실행
    // → PlanMasterModal 오픈 (1차 Sonnet 분석 → 2차 Opus 로드맵 생성 → 백로그 카드 자동 생성)
    if (finalMode === 'ARCHITECT') {
      setShowPlanMasterModal(true);
      return;
    }

    // 그 외 모드: /api/tasks/:id/run 엔드포인트로 모드 기반 실행 (Zero-Command Router)
    setIsStarting(true);
    fetch(`${SERVER_URL}/api/tasks/${task.id}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: finalMode }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'redirect') {
          // [Phase 44] Immutable Rerun Forking: 기존 카드 닫고 새 카드로 이동
          setActiveDetailTaskId(null);
          setTimeout(() => setActiveDetailTaskId(data.redirectTaskId), 100);
        } else {
          patchTask(task.id, { column: 'in_progress', status: 'IN_PROGRESS' });
        }
      })
      .catch(console.error)
      .finally(() => setIsStarting(false));
  };

  // [Phase 14 S2] 승인 핸들러 (Review → Done)
  const handleApprove = () => {
    fetch(`${SERVER_URL}/api/tasks/${task.id}/approve`, { method: 'PATCH' })
      .catch(console.error);
    handleClose();
  };

  // [Phase 14 S2] 재작업 핸들러 (Review → In Progress)
  const handleRework = () => {
    fetch(`${SERVER_URL}/api/tasks/${task.id}/rework`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason: reworkReason.trim() || '추가 검토 후 재작업이 필요합니다.' }),
    }).catch(console.error);
    handleClose();
  };

  // Soft Delete 실행
  const handleDelete = () => {
    if (!isConfirmingDelete) {
      setIsConfirmingDelete(true);
      return;
    }
    fetch(`${SERVER_URL}/api/tasks/${task.id}`, { method: 'DELETE' })
      .then((r) => r.json())
      .then(() => {
        removeTask(task.id);
        if (String(focusedTaskId) === String(task.id)) setFocusedTaskId(null);
        handleClose();
      })
      .catch(console.error);
  };

  if (!task) return null;

  const statusInfo = STATUS_LABEL[task.status] || STATUS_LABEL['PENDING'];
  const isReview = task.column === 'review';

  // [Phase 37 Bugfix] 태스크 본문이나 댓글에 웹 프론트엔드(HTML/CSS/JS 등) 코드 블록이 있는 경우에만 프리뷰 버튼 노출
  const uiCodeRegex = /```(html|css|js|jsx|ts|tsx|javascript|typescript)(?:\s|$)/i;
  const hasCodeBlock = (typeof task.content === 'string' && uiCodeRegex.test(task.content)) || 
                       (Array.isArray(comments) && comments.some(c => typeof c.content === 'string' && uiCodeRegex.test(c.content)));

  return (
    <div
      className={`modal-overlay ${isExpanded ? 'modal-overlay--expanded' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={`Task #${task.project_task_num != null ? task.project_task_num : String(task.id).slice(-6)} 상세`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className={`modal modal--detail ${isExpanded ? 'modal--expanded' : ''}`}>

      <div className="modal__header" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <button
                onClick={() => setIsExpanded(!isExpanded)}
                title={isExpanded ? '축소' : '전체 화면으로 확장'}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  display: 'flex',
                  alignItems: 'center',
                  padding: '2px',
                  borderRadius: '4px',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
                  {isExpanded ? 'close_fullscreen' : 'open_in_full'}
                </span>
              </button>
              <span style={{ 
                fontSize: '0.76rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
                letterSpacing: '0.08em', color: 'var(--text-muted)' 
              }}>Task #{task.project_task_num != null ? task.project_task_num : String(task.id).slice(-6)}</span>
             </div>
            {isEditing ? (
              <input 
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                style={{ fontSize: '1.5rem', margin: '0.5rem 0', width: '100%', background: 'var(--bg-surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.4rem 0.6rem', outline: 'none' }}
              />
            ) : (
              <h2 className="modal__title" style={{ fontSize: '1.5rem', margin: 0 }}>{task.title}</h2>
            )}
          </div>
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexShrink: 0 }}>

            {/* 👀 Live Preview 버튼 — OUTPUT/index.html 존재 및 코드 블록 포함 여부에 따라 노출 (또는 플랜모드 카드일 때 Graphify 지원) */}
            {((previewUrl && hasPreviewData && hasCodeBlock) || task.status === 'BACKLOG') && (
              <button
                id="btn-live-preview"
                onClick={() => {
                  setIsPreviewMode(v => {
                    const nextV = !v;
                    if (nextV) setIsExpanded(true);
                    return nextV;
                  });
                  setPreviewError(false);
                  if (isChainMode) contextChain.closePanel();
                }}
                title={isPreviewMode ? '프리뷰 닫기' : '결과물 미리보기'}
                style={{
                  background: isPreviewMode
                    ? 'linear-gradient(135deg, rgba(100,135,242,0.3), rgba(74,222,128,0.15))'
                    : 'rgba(180,197,255,0.07)',
                  border: `1px solid ${isPreviewMode ? 'rgba(100,135,242,0.55)' : 'rgba(180,197,255,0.18)'}`,
                  color: isPreviewMode ? '#b4c5ff' : 'var(--text-secondary)',
                  cursor: 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  padding: '0.35rem 0.75rem', borderRadius: '8px',
                  fontSize: '0.78rem', fontWeight: 700,
                  fontFamily: 'Space Grotesk, sans-serif',
                  letterSpacing: '0.03em',
                  boxShadow: isPreviewMode ? '0 0 10px rgba(100,135,242,0.25)' : 'none',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={e => {
                  if (!isPreviewMode) {
                    e.currentTarget.style.background = 'rgba(180,197,255,0.13)';
                    e.currentTarget.style.borderColor = 'rgba(180,197,255,0.35)';
                    e.currentTarget.style.color = 'var(--text-primary)';
                  }
                }}
                onMouseLeave={e => {
                  if (!isPreviewMode) {
                    e.currentTarget.style.background = 'rgba(180,197,255,0.07)';
                    e.currentTarget.style.borderColor = 'rgba(180,197,255,0.18)';
                    e.currentTarget.style.color = 'var(--text-secondary)';
                  }
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                  {isPreviewMode ? 'close' : 'preview'}
                </span>
                {isPreviewMode ? '닫기' : '미리보기'}
              </button>
            )}

            {/* 더보기 메뉴 드롭다운 */}
            <div style={{ position: 'relative' }} ref={moreMenuRef}>
              <button
                onClick={() => setShowMoreMenu(!showMoreMenu)}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-muted)',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  width: '32px', height: '32px', borderRadius: '50%',
                  transition: 'background 0.2s'
                }}
                className={showMoreMenu ? 'more-active' : ''}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>more_vert</span>
              </button>

              {showMoreMenu && (
                <div style={{
                  position: 'absolute', top: '100%', right: 0, marginTop: '0.5rem',
                  background: 'var(--bg-surface-3)', backdropFilter: 'blur(10px)',
                  border: '1px solid var(--border)', borderRadius: '12px',
                  boxShadow: 'none', minWidth: '160px',
                  zIndex: 200, padding: '0.4rem', overflow: 'hidden'
                }}>
                  <button
                    onClick={handleEditTask}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.7rem 1rem', background: 'none',
                      border: 'none', color: 'var(--text-primary)',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem',
                      fontWeight: 600, transition: 'all 0.2s', textAlign: 'left',
                      marginBottom: '0.2rem'
                    }}
                    onMouseOver={(e) => e.currentTarget.style.background = 'var(--bg-surface-highest)'}
                    onMouseOut={(e) => e.currentTarget.style.background = 'none'}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>edit</span>
                    편집하기
                  </button>
                  <button
                    onClick={handleDelete}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', gap: '0.6rem',
                      padding: '0.7rem 1rem', background: isConfirmingDelete ? 'rgba(255,82,82,0.1)' : 'none',
                      border: 'none', color: isConfirmingDelete ? '#ff5449' : 'var(--text-secondary)',
                      borderRadius: '8px', cursor: 'pointer', fontSize: '0.9rem',
                      fontWeight: 600, transition: 'all 0.2s', textAlign: 'left'
                    }}
                    onMouseOver={(e) => { if (!isConfirmingDelete) e.currentTarget.style.background = 'var(--bg-surface-highest)' }}
                    onMouseOut={(e) => { if (!isConfirmingDelete) e.currentTarget.style.background = 'none' }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>
                      {isConfirmingDelete ? 'priority_high' : 'delete'}
                    </span>
                    {isConfirmingDelete ? '정말 삭제할까요?' : '삭제하기'}
                  </button>
                </div>
              )}
            </div>

            {/* 닫기 X */}
            <button className="modal__close" onClick={handleClose} aria-label="닫기">
              <span className="material-symbols-outlined" style={{ fontSize: '1.3rem' }}>close</span>
            </button>
          </div>
        </div>

        {/* ── [Phase 37] Split View 컨테이너 ── */}
        <div style={{
          flex: 1, display: 'flex', overflow: 'hidden',
          // 프리뷰 또는 체인 패널 모드에선 row, 일반 모드에선 column
          flexDirection: (isPreviewMode || isChainMode) ? 'row' : 'column',
        }}>

        {/* Left Pane — 기존 본문 (스크롤 가능) */}
        <div style={{
          flex: isPreviewMode ? `0 0 ${splitRatio}%` : '1 1 auto',
          overflowY: 'auto',
          padding: '1rem 1.5rem',
          paddingRight: '0.5rem', // 우측 스크롤바 정렬을 위해 패딩 조정
          minWidth: 0,
          transition: isDragging.current ? 'none' : 'flex-basis 0.05s',
        }}>

          {/* 태스크 내용 */}
          {isEditing ? (
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ position: 'relative' }}>
                <textarea 
                  ref={editAreaRef}
                  value={editContent}
                  onChange={(e) => {
                    const val = e.target.value;
                    setEditContent(val);
                    const slashIdx = val.lastIndexOf('/');
                    if (slashIdx !== -1) {
                      const afterSlash = val.slice(slashIdx + 1);
                      if (!afterSlash.includes(' ') && !afterSlash.includes('\n')) {
                        setSlashQuery(afterSlash);
                        setSlashTarget('edit');
                        setShowSlash(true);
                      } else {
                        setShowSlash(false);
                      }
                    } else {
                      setShowSlash(false);
                    }
                  }}
                  onKeyDown={(e) => {
                    if (showSlash && slashTarget === 'edit' && e.key === 'Escape') { e.preventDefault(); setShowSlash(false); return; }
                    
                    if (showSlash && slashTarget === 'edit' && e.key === 'Enter' && filteredSlash.length > 0) {
                      e.preventDefault();
                      const cmd = filteredSlash[0];
                      if (cmd.id === '/코드') {
                        const sIdx = editContent.lastIndexOf('/');
                        const newText = editContent.slice(0, sIdx) + '\n```typescript\n// 여기에 코드를 작성하세요\n\n```\n';
                        setEditContent(newText);
                      } else {
                        const sIdx = editContent.lastIndexOf('/');
                        const newText = editContent.slice(0, sIdx) + `${cmd.id} `;
                        setEditContent(newText);
                      }
                      setShowSlash(false);
                      return;
                    }
                  }}
                  onBlur={() => setTimeout(() => setShowSlash(false), 150)}
                  rows={5}
                  style={{ width: '100%', background: 'var(--bg-surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem', outline: 'none', resize: 'vertical', fontSize: '1.05rem', lineHeight: 1.6 }}
                  placeholder="태스크 상세 내용... (/커맨드 호출 가능)"
                />
                {/* ── /슬래시 커맨드 자동완성 (Edit용) ────────────────────────── */}
                {showSlash && slashTarget === 'edit' && filteredSlash.length > 0 && (
                  <div
                    ref={slashRef}
                    style={{
                      position: 'absolute', top: '100%', left: 0, right: 0, marginTop: 6,
                      background: 'var(--bg-surface-2)', border: '1px solid rgba(124,110,248,0.4)',
                      borderRadius: 10, overflow: 'hidden', zIndex: 200,
                      boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                    }}
                  >
                    {filteredSlash.map(cmd => (
                      <button
                        key={cmd.id}
                        onMouseDown={(e) => {
                          e.preventDefault();
                          if (cmd.id === '/코드') {
                            const sIdx = editContent.lastIndexOf('/');
                            const newText = editContent.slice(0, sIdx) + '\n```typescript\n// 여기에 코드를 작성하세요\n\n```\n';
                            setEditContent(newText);
                          } else {
                            const sIdx = editContent.lastIndexOf('/');
                            const newText = editContent.slice(0, sIdx) + `${cmd.id} `;
                            setEditContent(newText);
                          }
                          setShowSlash(false);
                          setTimeout(() => editAreaRef.current?.focus(), 0);
                        }}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '0.6rem',
                          width: '100%', padding: '0.6rem 0.8rem',
                          background: 'transparent', border: 'none', cursor: 'pointer',
                          color: 'var(--text-primary)', fontSize: '0.88rem', textAlign: 'left',
                          transition: 'background 0.12s',
                          borderBottom: '1px solid var(--border)'
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,110,248,0.15)'}
                        onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--brand)' }}>{cmd.icon}</span>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cmd.id}</span>
                          <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{cmd.label}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost btn--sm" onClick={() => setIsEditing(false)}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={handleSaveEdit} disabled={!editContent.trim()} style={{ opacity: !editContent.trim() ? 0.5 : 1, cursor: !editContent.trim() ? 'not-allowed' : 'pointer' }}>저장</button>
              </div>
            </div>
          ) : (
            <div className="task-content-area" style={{ position: 'relative', minHeight: '60px' }}>
              <div style={{
                fontSize: '1.05rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.75,
                marginBottom: '20px',
                wordBreak: 'break-word',
              }}>
                <ReactMarkdown
                  className="notion-md"
                  remarkPlugins={[remarkGfm]}

                >
                  {task.content || ''}
                </ReactMarkdown>
              </div>
            </div>
          )}

          {/* 메타 정보 */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit_square</span>
              작성: {task.author || '시스템'}
            </div>
            {task.createdAt && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>calendar_today</span>
                {new Date(task.createdAt).toLocaleDateString('ko-KR')}
              </div>
            )}
            {task.executionMode && task.executionMode !== 'ari' && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>smart_toy</span>
                {task.executionMode.toUpperCase()}
              </div>
            )}
          </div>

          {/* [CKS] WORKFLOW 태스크 — 3인 협업 실시간 타임라인 */}
          {task.category === 'WORKFLOW' && (
            <WorkflowTimeline taskId={task.id} />
          )}

          {/* todo: 실행 시작 CTA — column과 status 모두 todo/PENDING일 때만 표시 */}
          {(task.column === 'todo' && task.status !== 'IN_PROGRESS' && task.status !== 'REVIEW' && task.status !== 'COMPLETED') && (
            <div style={{
              background: isStarting ? 'rgba(180,197,255,0.1)' : 'rgba(180,197,255,0.06)',
              border: `1px solid ${isStarting ? 'rgba(180,197,255,0.4)' : 'rgba(180,197,255,0.18)'}`,
              borderRadius: '12px', padding: '0.8rem 1rem', marginBottom: '1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '1rem', transition: 'all 0.3s',
            }}>
              {(() => {
                const assigneeKey = task.assignee?.toLowerCase().replace(/^proj-\d+-/, '');
                const displayAssignee = (agentMeta[assigneeKey]?.role || task.assignee || '').toUpperCase();
                return (
                  <>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="material-symbols-outlined" style={{
                  fontSize: '1.1rem', color: 'var(--brand)', opacity: 0.85,
                  animation: isStarting ? 'spin 1s linear infinite' : 'none',
                }}>
                  {isStarting ? 'sync' : 'pending_actions'}
                </span>
                {isStarting
                  ? <span style={{ color: 'var(--brand)' }}><strong>{displayAssignee}</strong>에게 태스크를 전달하는 중...</span>
                  : task.assignee && task.assignee !== '미할당'
                    ? (task.assignee.toLowerCase() === 'ceo' 
                        ? <><strong style={{ color: 'var(--text-primary)' }}>CEO</strong>님은 직접 작업을 수행합니다. (AI 에이전트에게 할당하세요)</>
                        : <><strong style={{ color: 'var(--text-primary)' }}>{displayAssignee}</strong>에게 즉시 실행을 시작할 수 있습니다.</>)
                    : <span style={{ color: 'var(--text-muted)' }}>담당자를 지정하면 실행시킬 수 있습니다.</span>
                }
              </div>
              <button
                onClick={handleStartTask}
                disabled={!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo' || isStarting}
                style={{
                  background: isStarting
                    ? 'rgba(180,197,255,0.15)'
                    : (!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo')
                      ? 'var(--bg-surface-3)'
                      : 'linear-gradient(135deg, rgba(180,197,255,0.25), rgba(120,140,255,0.35))',
                  color: (!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo') ? 'var(--text-muted)' : 'var(--brand)',
                  border: '1px solid rgba(180,197,255,0.3)', borderRadius: '8px',
                  padding: '0.45rem 1rem',
                  cursor: (!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo' || isStarting) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', gap: '0.35rem',
                  fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.04em',
                  whiteSpace: 'nowrap', transition: 'all 0.2s', flexShrink: 0,
                  opacity: isStarting ? 0.7 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                  {isStarting ? 'hourglass_empty' : 'play_arrow'}
                </span>
                {isStarting ? '전달 중...' : '실행 시작'}
              </button>
                  </>
                );
              })()}
            </div>
          )}

          {/* in_progress: KILL 컨트롤 */}
          {task.status === 'in_progress' && (
            <div style={{ 
              background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
              borderRadius: '12px', padding: '0.8rem 1rem', marginBottom: '1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between'
            }}>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--status-active)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>bolt</span>
                  실행 중
                </strong> — 이 태스크의 AI 프로세스를 중단할 수 있습니다.
              </div>
              <button
                onClick={handleKill}
                style={{
                  background: 'var(--bg-surface-3)', color: 'var(--text-secondary)',
                  border: '1px solid var(--border)', borderRadius: '8px',
                  padding: '0.4rem 0.9rem', cursor: 'pointer', fontWeight: 700,
                  fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.3rem',
                  fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.04em'
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>stop_circle</span>
                KILL
              </button>
            </div>
          )}

          {/* 인라인 상태 및 메타 변경 컨트롤 */}
          <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.25rem', flexWrap: 'wrap', padding: '0.6rem 0.8rem', background: 'var(--bg-surface-2)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '130px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>모드 (Mode)</label>
              <select
                value={task.mode || 'NONE'}
                onChange={(e) => {
                  const newModeRaw = e.target.value;
                  const newMode = newModeRaw === 'NONE' ? null : newModeRaw;
                  const prevMode = task.mode || 'NONE';
                  
                  // [Bug 1+2 Fix] 모드에 따른 LLM 및 담당자 강제 할당 (Phase 39)
                  let newModel = task.model;
                  let newAssignee = null; // null = 현재 값 유지

                  if (newMode === 'ARCHITECT') {
                    newModel = 'Claude Opus 4.6 (Thinking)';
                    // CEO 또는 미할당 상태면 자동으로 dev_senior 배정 → 실행 버튼 활성화
                    if (!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo') {
                      newAssignee = 'dev_senior';
                    }
                  } else if (newMode === 'DEV') {
                    newModel = 'Gemini 3.1 Pro (High)';
                    if (!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo') {
                      newAssignee = 'dev_senior';
                    }
                  } else if (newMode === 'QA') {
                    newModel = 'Claude Opus 4.6 (Thinking)';
                    if (!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo') {
                      newAssignee = 'dev_advisor';
                    }
                  } else if (newMode === 'DEBUG') {
                    newModel = 'Claude Sonnet 4.6 (Thinking)';
                    if (!task.assignee || task.assignee === '미할당' || task.assignee.toLowerCase() === 'ceo') {
                      newAssignee = 'dev_senior';
                    }
                  }

                  const patch = { mode: newMode, model: newModel };
                  if (newAssignee) patch.assignee = newAssignee;

                  // 모드 변경 API 및 Store 업데이트
                  patchTask(task.id, patch);
                  fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(patch)
                  }).catch(console.error);

                  // 담당자 변경 토스트 알림
                  if (newAssignee) {
                    showToast(`✅ ${newModeRaw === 'NONE' ? '선택안함' : newModeRaw} 모드: 모델·담당자가 자동 설정되었습니다.`);
                  }
                  // 모드 변경 시 타임라인(액티비티) 시스템 로그 기록
                  if (prevMode !== newModeRaw) {
                    const modeNames = { 'NONE': '선택하지 않음', 'ARCHITECT': '기획 모드', 'DEV': '개발 모드', 'QA': '리뷰 모드', 'DEBUG': '디버깅 모드' };
                    const logMsg = `🔄 모드 전환: ${modeNames[prevMode]} ➡️ ${modeNames[newModeRaw]} (으)로 변경되었습니다.`;
                    
                    const newLog = {
                      author: 'system', source: { id: 'system', name: 'system' }, target: { id: 'user-1', name: 'CEO' },
                      content: logMsg, created_at: new Date().toISOString()
                    };
                    setComments(prev => [...prev, newLog]);
                    
                    fetch(`${SERVER_URL}/api/tasks/${task.id}/comments`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ author: 'system', content: logMsg, source: newLog.source, target: newLog.target })
                    }).catch(console.error);
                  }
                }}
                style={{ 
                  background: 'var(--bg-surface-3)', color: 'var(--text-primary)', 
                  border: '1px solid var(--border)', borderRadius: '6px', 
                  padding: '0.4rem 0.5rem', outline: 'none', fontSize: '0.8rem',
                  cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif'
                }}
              >
                {availableModes.map(m => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '130px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>담당자 (Assignee)</label>
              <select
                value={task.assignee || ''}
                onChange={(e) => {
                  const newAssignee = e.target.value;
                  patchTask(task.id, { assignee: newAssignee || '미할당' });
                  fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ assignee: newAssignee || '미할당' })
                  }).catch(console.error);
                }}
                style={{ 
                  background: 'var(--bg-surface-3)', color: 'var(--text-primary)', 
                  border: '1px solid var(--border)', borderRadius: '6px', 
                  padding: '0.4rem 0.5rem', outline: 'none', fontSize: '0.8rem',
                  cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif'
                }}
              >
                <option value="">미할당</option>
                <option value="CEO">CEO</option>
                {Object.entries(useAgentStore.getState().agentMeta || {}).map(([id, m]) => (
                   <option key={id} value={id}>{m.name || m.role || id}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '130px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>모델 (Model)</label>
              <div style={{ height: '32px', display: 'flex', alignItems: 'center' }}>
                {(() => {
                  const assigneeKey = task.assignee?.toLowerCase();
                  const profileModel = assigneeKey ? Object.values(agentMeta).find(
                    m => m.id?.toLowerCase() === assigneeKey || m.name?.toLowerCase() === assigneeKey
                  )?.model : null;
                  const displayModel = profileModel || task.model;
                  
                  if (!displayModel || ['ari', 'luca', 'sonnet', 'opus'].includes(displayModel.toLowerCase())) {
                    return <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>자동 할당</span>;
                  }
                  
                  return (
                    <div style={{ 
                      fontSize: '0.72rem', fontWeight: 700, padding: '4px 8px', borderRadius: '4px',
                      background: 'rgba(180,197,255,0.1)',
                      color: 'var(--brand)',
                      border: '1px solid rgba(180,197,255,0.2)',
                      fontFamily: 'Space Grotesk, sans-serif', letterSpacing: '0.04em',
                      display: 'flex', alignItems: 'center', gap: '0.3rem',
                      width: 'fit-content'
                    }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>memory</span>
                      {formatModelName(displayModel, agentMeta)}
                    </div>
                  );
                })()}
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '130px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>상태 (Status)</label>
              <select
                value={task.status === 'ARCHIVED' ? 'archived' : (task.column || 'todo')}
                onChange={(e) => {
                  const newColumn = e.target.value;
                  if (newColumn === 'archived') {
                    if (!window.confirm('이 태스크를 아카이브(보관)하시겠습니까?')) return;
                    patchTask(task.id, { status: 'ARCHIVED' });
                    fetch(`${SERVER_URL}/api/tasks/${task.id}/archive`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ archivedBy: 'CEO (Manual)' })
                    }).then(() => handleClose()).catch(console.error);
                  } else {
                    patchTask(task.id, { column: newColumn });
                    fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ column: newColumn })
                    }).catch(console.error);
                  }
                }}
                style={{ 
                  background: 'var(--bg-surface-3)', color: 'var(--text-primary)', 
                  border: '1px solid var(--border)', borderRadius: '6px', 
                  padding: '0.4rem 0.5rem', outline: 'none', fontSize: '0.8rem',
                  cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif'
                }}
              >
                <option value="todo">To Do</option>
                <option value="in_progress">In Progress</option>
                <option value="review">Review</option>
                <option value="done">Done</option>
                <option value="archived">Archive</option>
              </select>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flex: 1, minWidth: '130px' }}>
              <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>우선순위 (Priority)</label>
              <select
                value={task.priority || ''}
                onChange={(e) => {
                  const newPriority = e.target.value;
                  patchTask(task.id, { priority: newPriority });
                  fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ priority: newPriority })
                  }).catch(console.error);
                }}
                style={{ 
                  background: 'var(--bg-surface-3)', color: 'var(--text-primary)', 
                  border: '1px solid var(--border)', borderRadius: '6px', 
                  padding: '0.4rem 0.5rem', outline: 'none', fontSize: '0.8rem',
                  cursor: 'pointer', fontFamily: 'Space Grotesk, sans-serif'
                }}
              >
                <option value="">선택 안함</option>
                <option value="urgent">Urgent</option>
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </div>
          </div>

          {/* 모드 선택 시 매크로 라벨 노출 (메타 속성 아래 위치) */}
          {task?.mode === 'ARCHITECT' && (
            <div style={{ marginBottom: '16px', padding: '8px 14px', background: (task.status === 'ARCHIVED' || task.status === 'DONE') ? 'rgba(148, 163, 184, 0.1)' : 'rgba(124, 110, 248, 0.1)', border: (task.status === 'ARCHIVED' || task.status === 'DONE') ? '1px solid rgba(148, 163, 184, 0.2)' : 'none', color: (task.status === 'ARCHIVED' || task.status === 'DONE') ? '#94a3b8' : '#7c6ef8', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>{ (task.status === 'ARCHIVED' || task.status === 'DONE') ? 'check_circle' : 'psychology_alt' }</span>
              <span style={{ opacity: (task.status === 'ARCHIVED' || task.status === 'DONE') ? 0.8 : 1 }}>
                {(task.status === 'ARCHIVED' || task.status === 'DONE') ? '✅ Plan Master 기획 완료 — (읽기 전용)' : '[ /plan_master : 스코프 분석 및 로드맵 자동 생성 ]'}
              </span>
            </div>
          )}
          {task?.mode === 'DEV' && (
            autoRunStatus ? (
              // [Phase 43] Auto Run 가동 중 → 동적 상태 배너
              <div style={{ marginBottom: '16px', padding: '8px 14px', background: 'rgba(46, 204, 113, 0.15)', border: '1px solid rgba(46,204,113,0.3)', color: '#2ecc71', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', animation: 'spin 2s linear infinite' }}>robot_2</span>
                <span style={{ flex: 1 }}>
                  🤖 Auto Run 가동 중 — &quot;{autoRunStatus.taskTitle}&quot; Step {autoRunStatus.step}/{autoRunStatus.maxSteps}
                </span>
                <button
                  id="autorun-stop-btn"
                  onClick={async () => {
                    try {
                      await fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(task.project_id)}/autorun/stop`, { method: 'POST' });
                    } catch (e) { console.error('Auto Run stop 실패:', e); }
                  }}
                  style={{ background: 'rgba(231,76,60,0.15)', border: '1px solid rgba(231,76,60,0.4)', color: '#e74c3c', borderRadius: '4px', padding: '3px 10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>stop_circle</span>
                  Stop
                </button>
              </div>
            ) : task?.last_autorun_status === 'COMPLETED' ? (
              // [Phase 44] 이력 영속성 (Banner Persistence & Gateway) - 비활성화 느낌의 UI
              <div style={{ marginBottom: '16px', padding: '8px 14px', background: 'rgba(148, 163, 184, 0.1)', border: '1px solid rgba(148, 163, 184, 0.2)', color: '#94a3b8', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>check_circle</span>
                <span style={{ flex: 1, opacity: 0.8 }}>
                  ✅ Auto Run 완료 — Step {task.last_autorun_step}/{task.last_autorun_max_steps}
                </span>
                <button
                  id="autotest-start-btn"
                  onClick={() => {
                    // [Phase 44] /auto_test 트리거 (게이트웨이)
                    fetch(`${SERVER_URL}/api/tasks/${task.id}/run`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ mode: 'QA', intent: '/auto_test' }),
                    })
                    .then(r => r.json())
                    .then(data => {
                      if (data.status === 'redirect') {
                        setActiveDetailTaskId(null);
                        setTimeout(() => setActiveDetailTaskId(data.redirectTaskId), 100);
                      }
                    })
                    .catch(console.error);
                  }}
                  style={{ background: 'rgba(52,152,219,0.15)', border: '1px solid rgba(52,152,219,0.4)', color: '#3498db', borderRadius: '4px', padding: '3px 10px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>science</span>
                  /auto_test 시작
                </button>
              </div>
            ) : (
              // 정적 레이블
              <div style={{ marginBottom: '16px', padding: '8px 14px', background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>rocket_launch</span>
                [ /auto_run : 태스크 기반 자율 연속 파이프라인 실행 ]
              </div>
            )
          )}
          {task?.mode === 'QA' && (
            <div style={{ marginBottom: '16px', padding: '8px 14px', background: 'rgba(241, 196, 15, 0.1)', color: '#f1c40f', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>fact_check</span>
              [ /auto_test : 시나리오 기반 자율 테스트 및 검증 ]
            </div>
          )}
          {task?.mode === 'DEBUG' && (
            <div style={{ marginBottom: '16px', padding: '8px 14px', background: 'rgba(231, 76, 60, 0.1)', color: '#e74c3c', borderRadius: '6px', fontSize: '0.88rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>bug_report</span>
              [ /auto_debug : 로그 추적 및 에러 자율 수정 ]
            </div>
          )}

          {/* 댓글 목록 */}
          <div style={{ marginBottom: '1rem' }}>
            {/* [S4-2] Discussion / Activity 탭 */}
            {(() => {
              const isSystemComment = (c) => {
                const a = (c.author || '').toLowerCase();
                const s = (c.source?.name || '').toLowerCase();
                return a === 'system' || s === 'system';
              };
              const activityComments = comments.filter(c => isSystemComment(c));
              // [UX] 시스템 알림은 Discussion 탭에서 완전히 제외하고 Activity 탭에만 노출
              const discussionComments = comments.filter(c => !isSystemComment(c));
              const visibleComments    = activeCommentTab === 'discussion' ? discussionComments : activityComments;
              return (
                <>
                  {/* 탭 버튼 */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem' }}>
                    {[
                      { key: 'discussion', icon: 'forum',    label: 'Discussion', count: discussionComments.length },
                      { key: 'activity',   icon: 'history',  label: 'Activity',   count: activityComments.length },
                      { key: 'graph',      icon: 'account_tree', label: 'Graph Report', count: 0 },
                    ].map(tab => (
                      <button key={tab.key} onClick={() => setActiveCommentTab(tab.key)} style={{
                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                        padding: '0.35rem 0.8rem',
                        fontSize: '0.74rem', fontWeight: 600,
                        fontFamily: 'Space Grotesk, sans-serif',
                        letterSpacing: '0.04em',
                        border: 'none',
                        borderBottom: activeCommentTab === tab.key ? '2px solid var(--brand)' : '2px solid transparent',
                        borderRadius: 0, background: 'none',
                        color: activeCommentTab === tab.key ? 'var(--brand)' : 'var(--text-muted)',
                        cursor: 'pointer', transition: 'color 0.15s',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>{tab.icon}</span>
                        {tab.label}
                        {tab.count > 0 && (
                          <span style={{
                            marginLeft: '0.2rem', fontSize: '0.62rem', fontWeight: 700,
                            background: activeCommentTab === tab.key ? 'rgba(180,197,255,0.15)' : 'rgba(255,255,255,0.07)',
                            borderRadius: '10px', padding: '1px 5px',
                          }}>{tab.count}</span>
                        )}
                      </button>
                    ))}
                  </div>

                  {/* 탭 콘텐츠 */}
                  {activeCommentTab === 'graph' ? (
                    <div style={{ padding: '0.5rem', fontSize: '0.82rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                      {graphReport ? (
                        <div className="markdown-body" style={{ background: 'transparent' }}>
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {graphReport}
                          </ReactMarkdown>
                        </div>
                      ) : (
                        <p style={{ fontStyle: 'italic', color: 'var(--text-muted)' }}>리포트 데이터를 불러오는 중...</p>
                      )}
                    </div>
                  ) : isLoadingComments ? (
                    <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>댓글 불러오는 중...</p>
                  ) : visibleComments.length === 0 ? (
                    <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      {activeCommentTab === 'discussion'
                        ? '아직 댓글이 없습니다. 지시사항이나 피드백을 남겨보세요.'
                        : '시스템 활동 기록이 없습니다.'}
                    </p>
                  ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {visibleComments.map((c, i) => {
                  // source / target 정보 추출 (서버 응답 또는 optimistic update 모두 대응)
                  const srcName = c.source?.name || c.author || '알 수 없음';
                  const tgtName = c.target?.name || (
                    i === 0
                      ? (task.assignee || 'ARI')
                      : (comments[i - 1]?.source?.name || comments[i - 1]?.author || '대표님')
                  );
                  // author 구분 로직:
                  // - CEO: 대표님이 직접 작성
                  // - ARI(위임): ARI가 대표님 지시 위임받아 작성
                  // - 에이전트(lumi/nova 등): 크루 자체 작성
                  const isCeo = srcName === 'CEO';
                  const isAriDelegate = srcName === 'ARI(위임)';
                  const isAgentComment = !isCeo && !isAriDelegate && c.author !== 'CEO' && c.author !== '대표님' && c.author !== 'system';

                  // [Phase 39] System Log MCP Terminal Parsing
                  const isSystemLog = c.author === 'system';
                  let mcpToolName = null;
                  let logContent = c.content || '';
                  if (isSystemLog) {
                    const match = logContent.match(/^\[([a-zA-Z0-9_]+)\]\s*(.*)/s);
                    if (match) {
                      mcpToolName = match[1];
                      logContent = match[2];
                    }
                  }
                  const getToolIcon = (name) => {
                    if (name === 'trace_bug') return 'bug_report';
                    if (name === 'run_tasks') return 'terminal';
                    if (name === 'search_web') return 'travel_explore';
                    if (name.includes('graph')) return 'account_tree';
                    return 'build';
                  };
                  // CEO: 초록 / ARI(위임): 주황 / 에이전트: 브랜드색
                  const srcColor = isCeo ? '#4ade80' : isAriDelegate ? '#fb923c' : 'var(--brand)';
                  const tgtColor = isAgentComment ? 'var(--status-active)' : (isCeo || isAriDelegate) ? 'var(--brand)' : 'var(--text-muted)';
                  
                  // ── [Phase 30] agentChain 오케스트레이션 파이프 커넥터 ──
                  // [역할명] 패턴으로 시작하는 에이전트 댓글이 연속될 때 → 화살표 삽입
                  const isChainComment = isAgentComment && /^\[.+\]\n/.test(c.content || '');
                  const prevC = visibleComments[i - 1];
                  const prevIsChain = prevC && !['CEO', '대표님', 'system'].includes(prevC.author) && /^\[.+\]\n/.test(prevC.content || '');
                  const showPipe = isChainComment && prevIsChain && i > 0;

                  return (
                  <div key={i} style={{ display: 'contents' }}>
                  {showPipe && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0 0.5rem' }}>
                      <div style={{ width: '2px', height: '18px', background: 'linear-gradient(to bottom, rgba(180,197,255,0.3), rgba(180,197,255,0.1))', marginLeft: '0.9rem', flexShrink: 0 }} />
                      <span style={{ fontSize: '0.65rem', color: 'rgba(180,197,255,0.4)', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' }}>
                        {prevC.author?.toUpperCase()} → {c.author?.toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div style={{
                    background: isSystemLog ? '#0d0f14' : (isChainComment ? 'rgba(180,197,255,0.04)' : 'var(--bg-surface-2)'),
                    borderRadius: '10px',
                    padding: '0.7rem 0.9rem',
                    border: isSystemLog ? '1px solid #333' : (isChainComment ? '1px solid rgba(180,197,255,0.15)' : '1px solid var(--border)'),
                    color: isSystemLog ? '#e5e7eb' : 'inherit',
                  }}>

                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', alignItems: 'center' }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                         {isSystemLog ? (
                           <span style={{
                             display: 'inline-flex', alignItems: 'center', gap: '0.4rem',
                             fontSize: '0.68rem', fontWeight: 700, color: '#9ca3af',
                             fontFamily: 'SF Mono, Space Grotesk, sans-serif', textTransform: 'uppercase',
                             letterSpacing: '0.05em', background: 'rgba(255,255,255,0.08)',
                             border: '1px solid rgba(255,255,255,0.12)', borderRadius: '6px', padding: '2px 8px',
                           }}>
                             <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: mcpToolName ? '#60a5fa' : '#9ca3af' }}>
                               {mcpToolName ? getToolIcon(mcpToolName) : 'memory'}
                             </span>
                             {mcpToolName ? `MCP Tool: ${mcpToolName}` : 'System Log'}
                           </span>
                         ) : (
                           <span style={{ fontSize: '0.82rem', fontWeight: 700, color: srcColor }}>{srcName}</span>
                         )}
                       </span>
                       {/* [Phase 36b] 날짜 + 복사 아이콘 그룹 */}
                       <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.4rem', flexShrink: 0 }}>
                         <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                           {(() => {
                             const d = new Date(c.created_at);
                             const yy = String(d.getFullYear()).slice(2);
                             const mm = String(d.getMonth() + 1).padStart(2, '0');
                             const dd = String(d.getDate()).padStart(2, '0');
                             const hh = String(d.getHours()).padStart(2, '0');
                             const min = String(d.getMinutes()).padStart(2, '0');
                             return `${yy}.${mm}.${dd} ${hh}:${min}`;
                           })()}
                         </span>
                         {/* [Phase 36b] 📋 복사 아이콘 — #카드번호C순번 클립보드 복사 */}
                         {c.author !== 'system' && task?.project_task_num != null && (
                           (() => {
                             const commentIdx = c.comment_idx ?? (i + 1);
                             const tag = `#${task.project_task_num}C${commentIdx}`;
                             const isCopied = copiedCommentIdx === tag;
                             return (
                               <button
                                 title={`태그 복사: ${tag}`}
                                 onClick={() => {
                                   navigator.clipboard.writeText(tag).then(() => {
                                     setCopiedCommentIdx(tag);
                                     setTimeout(() => setCopiedCommentIdx(null), 800);
                                   });
                                 }}
                                 style={{
                                   background: 'none', border: 'none', cursor: 'pointer',
                                   display: 'inline-flex', alignItems: 'center', gap: '0.25rem',
                                   padding: '2px 6px', borderRadius: '4px',
                                   color: isCopied ? '#4ade80' : 'var(--text-muted)',
                                   fontSize: '0.8rem', fontFamily: 'Space Grotesk, sans-serif',
                                   fontWeight: 600, letterSpacing: '0.03em',
                                   transition: 'color 0.2s',
                                   opacity: 0.8,
                                 }}
                                 onMouseEnter={e => e.currentTarget.style.opacity = 1}
                                 onMouseLeave={e => e.currentTarget.style.opacity = 0.8}
                               >
                                 <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>
                                   {isCopied ? 'check' : 'content_copy'}
                                 </span>
                                 {isCopied ? '복사됨' : tag}
                               </button>
                             );
                           })()
                         )}
                       </span>
                     </div>
                    <div style={{ 
                      fontSize: isSystemLog ? '0.78rem' : '1.05rem', 
                      color: isSystemLog ? '#e5e7eb' : 'var(--text-secondary)', 
                      lineHeight: 1.5, margin: 0, wordBreak: 'break-word',
                      marginTop: isSystemLog ? '0.6rem' : '0'
                    }}>
                      {isSystemLog ? (
                        <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'SF Mono, monospace' }}>
                          {(() => {
                            try {
                              // JSON 파싱 시도 (MCP 도구 응답 등)
                              const parsed = JSON.parse(logContent);
                              if (parsed.thought) {
                                return (
                                  <>
                                    <details open style={{ marginBottom: '0.6rem' }}>
                                      <summary style={{
                                        cursor: 'pointer', fontSize: '0.72rem',
                                        color: '#60a5fa', userSelect: 'none',
                                        fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
                                        textTransform: 'uppercase', letterSpacing: '0.06em',
                                        display: 'flex', alignItems: 'center', gap: '0.3rem',
                                        listStyle: 'none',
                                      }}>
                                        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>psychology</span>
                                        사고과정 (Thinking)
                                      </summary>
                                      <div style={{
                                        fontFamily: '"JetBrains Mono", "SF Mono", monospace',
                                        fontSize: '0.75rem', color: '#9ca3af',
                                        marginTop: '0.45rem', whiteSpace: 'pre-wrap', lineHeight: 1.5,
                                        background: 'rgba(0,0,0,0.2)',
                                        border: '1px solid #333',
                                        borderRadius: '8px', padding: '0.6rem 0.8rem',
                                      }}>
                                        {parsed.thought}
                                      </div>
                                    </details>
                                    {/* [Task 2.3] Sequential Thinking 타임라인 시각화 */}
                                    {parsed.thoughtNumber && (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                                        <div style={{
                                          width: '22px', height: '22px', borderRadius: '50%',
                                          background: 'linear-gradient(135deg, #7c6ef8, #60a5fa)',
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: '0.65rem', fontWeight: 800, color: '#fff',
                                          fontFamily: 'Space Grotesk, sans-serif',
                                          flexShrink: 0,
                                        }}>{parsed.thoughtNumber}</div>
                                        <span style={{ fontSize: '0.7rem', color: '#9ca3af', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600 }}>
                                          {parsed.nextThoughtNeeded ? '사고 진행 중...' : '사고 완료'}
                                        </span>
                                        {parsed.status && (
                                          <span style={{
                                            fontSize: '0.62rem', padding: '1px 6px', borderRadius: '4px',
                                            background: parsed.status === 'pending_user_confirm' ? 'rgba(251,146,60,0.15)' : 'rgba(74,222,128,0.15)',
                                            color: parsed.status === 'pending_user_confirm' ? '#fb923c' : '#4ade80',
                                            fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif',
                                          }}>{parsed.status}</span>
                                        )}
                                      </div>
                                    )}
                                    {/* [Task 2.4] Confirm/Revise 액션블록 (Plan Master 협상 UX) */}
                                    {parsed.status === 'pending_user_confirm' && parsed.message_to_user && (
                                      <div style={{
                                        marginTop: '0.6rem', padding: '0.7rem 0.9rem',
                                        background: 'rgba(124,110,248,0.08)',
                                        border: '1px solid rgba(124,110,248,0.25)',
                                        borderRadius: '10px',
                                      }}>
                                        <div style={{ fontSize: '0.82rem', color: '#e5e7eb', marginBottom: '0.6rem', lineHeight: 1.5 }}>
                                          {parsed.message_to_user}
                                        </div>
                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                          <button
                                            onClick={() => {
                                              fetch(`${SERVER_URL}/api/projects/${task?.project_id}/plan-master/confirm`, {
                                                method: 'POST',
                                                headers: { 'Content-Type': 'application/json' },
                                                body: JSON.stringify({ action: 'confirm' })
                                              }).then(() => showToast('✅ MVP 기획이 확정되었습니다!')).catch(console.error);
                                            }}
                                            style={{
                                              padding: '0.4rem 1rem', fontSize: '0.78rem', fontWeight: 700,
                                              background: 'linear-gradient(135deg, #4ade80, #22c55e)',
                                              color: '#000', border: 'none', borderRadius: '8px', cursor: 'pointer',
                                              fontFamily: 'Space Grotesk, sans-serif',
                                            }}
                                          >✅ 확정하고 개발 시작</button>
                                          <button
                                            onClick={() => {
                                              const fb = prompt('수정 요청 내용을 입력해주세요:');
                                              if (fb) {
                                                fetch(`${SERVER_URL}/api/projects/${task?.project_id}/plan-master/confirm`, {
                                                  method: 'POST',
                                                  headers: { 'Content-Type': 'application/json' },
                                                  body: JSON.stringify({ action: 'revise', feedback: fb })
                                                }).then(() => showToast('🔄 피드백을 반영하여 재분석합니다.')).catch(console.error);
                                              }
                                            }}
                                            style={{
                                              padding: '0.4rem 1rem', fontSize: '0.78rem', fontWeight: 700,
                                              background: 'transparent',
                                              color: '#fb923c', border: '1px solid rgba(251,146,60,0.4)', borderRadius: '8px', cursor: 'pointer',
                                              fontFamily: 'Space Grotesk, sans-serif',
                                            }}
                                          >📝 기획 수정 요청</button>
                                        </div>
                                      </div>
                                    )}
                                    <div>
                                      {JSON.stringify({ ...parsed, thought: undefined, thoughtNumber: undefined, nextThoughtNeeded: undefined, message_to_user: undefined, status: undefined, action_required: undefined, instructions: undefined }, null, 2).replace(/"undefined",?\n?/g, '')}
                                    </div>
                                  </>
                                );
                              }
                            } catch (e) {
                              // JSON이 아니면 그냥 텍스트 렌더링
                            }
                            return logContent;
                          })()}
                        </div>
                      ) : (
                        <ReactMarkdown
                          className="notion-md"
                          remarkPlugins={[remarkGfm]}
                          components={{
                            // [Phase 36b/37] 카드링크 + 컨텍스트 체인 [#ID] 인라인 렌더링
                            p: ({ children }) => {
                              const processChild = (child) => {
                                if (typeof child !== 'string') return child;
                                // [#ID] 체인 칩 먼저 처리 (대괄호 문법)
                                const chainParts = renderChainRefText(
                                  child,
                                  contextChain.chainCache,
                                  (refId) => {
                                    contextChain.openPanel(refId);
                                    setIsPreviewMode(false);
                                    if (!isExpanded) setIsExpanded(true);
                                  }
                                );
                                // 남은 string 노드에 #NCN 처리
                                return chainParts.flatMap(part =>
                                  typeof part === 'string' ? renderTaggedText(part, null) : [part]
                                );
                              };
                              const processed = Array.isArray(children)
                                ? children.flatMap(processChild)
                                : processChild(children);
                              return <p>{processed}</p>;
                            },
                          }}
                        >
                          {logContent}
                        </ReactMarkdown>
                      )}
                    </div>

                    {/* ── [사고과정] 에이전트 댓글에만 표시 ── */}
                    {isAgentComment && c.thought_process && (
                      <div style={{
                        marginTop: '0.75rem',
                        borderTop: '1px solid rgba(180,197,255,0.12)',
                        paddingTop: '0.6rem',
                      }}>
                        {c.thought_process.thinking && (
                          <details open style={{ marginBottom: '0.4rem' }}>
                            <summary style={{
                              cursor: 'pointer', fontSize: '0.72rem',
                              color: 'rgba(180,197,255,0.6)', userSelect: 'none',
                              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: '0.06em',
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              listStyle: 'none',
                            }}>
                              <span style={{
                                display: 'inline-block', width: '6px', height: '6px',
                                borderRadius: '50%', background: 'rgba(180,197,255,0.5)',
                                flexShrink: 0,
                              }} />
                              사고과정 (Thinking)
                            </summary>
                            <div style={{
                              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
                              fontSize: '0.78rem', color: 'rgba(200,210,255,0.7)',
                              marginTop: '0.45rem', whiteSpace: 'pre-wrap', lineHeight: 1.65,
                              background: 'rgba(180,197,255,0.04)',
                              border: '1px solid rgba(180,197,255,0.1)',
                              borderRadius: '8px', padding: '0.6rem 0.8rem',
                            }}>
                              {c.thought_process.thinking}
                            </div>
                          </details>
                        )}
                        {c.thought_process.working && (
                          <details open>
                            <summary style={{
                              cursor: 'pointer', fontSize: '0.72rem',
                              color: 'rgba(251,191,36,0.6)', userSelect: 'none',
                              fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
                              textTransform: 'uppercase', letterSpacing: '0.06em',
                              display: 'flex', alignItems: 'center', gap: '0.3rem',
                              listStyle: 'none',
                            }}>
                              <span style={{
                                display: 'inline-block', width: '6px', height: '6px',
                                borderRadius: '50%', background: 'rgba(251,191,36,0.5)',
                                flexShrink: 0,
                              }} />
                              실행 과정 (Working)
                            </summary>
                            <div style={{
                              fontFamily: '"JetBrains Mono", "SF Mono", monospace',
                              fontSize: '0.78rem', color: 'rgba(251,191,36,0.7)',
                              marginTop: '0.45rem', whiteSpace: 'pre-wrap', lineHeight: 1.65,
                              background: 'rgba(251,191,36,0.04)',
                              border: '1px solid rgba(251,191,36,0.12)',
                              borderRadius: '8px', padding: '0.6rem 0.8rem',
                            }}>
                              {c.thought_process.working}
                            </div>
                          </details>
                        )}
                      </div>
                    )}
                   </div>
                   </div>
                 ); })}


              </div>
            )}
                </>
              );
            })()}
          </div>

          {/* 댓글 입력 영역과 함께 상태/할당 컨트롤 */}
          <div style={{
            background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '0.8rem', display: 'flex', flexDirection: 'column', gap: '0.6rem'
          }}>
            {/* 업무 이관 및 상태 컨트롤 (Phase 21 요구사항) */}
            <div style={{ display: 'flex', gap: '0.8rem', flexWrap: 'wrap', marginBottom: '0.4rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>view_column</span>
                <select
                  value={commentColumn}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === 'archive') {
                      // 아카이빙: API 즉시 호출 + 모달 유지 (isArchived 상태로 전환)
                      fetch(`${SERVER_URL}/api/tasks/${task.id}/archive`, {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ archivedBy: 'CEO' }),
                      }).catch(console.error);
                      // 스토어 즉시 반영 (socket 도착 전 빠른 UI 업데이트)
                      patchTask(task.id, { status: 'ARCHIVED' });
                      setIsArchived(true);
                      return; // 모달 유지 (자동 onClose 안 함)
                    }
                    setCommentColumn(val);
                  }}
                  disabled={isArchived}
                  style={{ background: 'var(--bg-surface-1)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem 0.5rem', outline: 'none', fontSize: '0.82rem', opacity: isArchived ? 0.5 : 1 }}
                >
                  <option value="NO_CHANGE" style={{ color: 'var(--text-muted)' }}>상태</option>
                  <option value="todo">진행 전 (To Do)</option>
                  <option value="in_progress">진행 중 (In Progress)</option>
                  <option value="review">승인 대기 (Review)</option>
                  <option value="done">완료 (Done)</option>
                  <option value="archive" style={{ color: '#F59E0B', fontWeight: 600 }}>📦 아카이빙</option>
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>person</span>
                <select
                  value={commentAssignee}
                  onChange={(e) => setCommentAssignee(e.target.value)}
                  disabled={isArchived}
                  style={{ background: 'var(--bg-surface-1)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem 0.5rem', outline: 'none', fontSize: '0.82rem' }}
                >
                  <option value="NO_CHANGE" style={{ color: 'var(--text-muted)' }}>담당</option>
                  <option value="">미할당</option>
                  <option value="CEO">CEO</option>
                  {Object.entries(useAgentStore.getState().agentMeta || {}).map(([id, m]) => (
                    <option key={id} value={id}>{m.name || m.role || id}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>flag</span>
                <select
                  value={commentPriority}
                  onChange={(e) => setCommentPriority(e.target.value)}
                  style={{ background: 'var(--bg-surface-1)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem 0.5rem', outline: 'none', fontSize: '0.82rem' }}
                >
                  <option value="NO_CHANGE" style={{ color: 'var(--text-muted)' }}>우선순위</option>
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                </select>
              </div>
            </div>
            {/* 코멘트 작성 토글 영역 */}
            {!isCommentExpanded ? (
              <button 
                onClick={() => {
                  setIsCommentExpanded(true);
                  setTimeout(() => textareaRef.current?.focus(), 100);
                }}
                style={{
                  width: '100%', background: 'var(--bg-surface-1)', border: '1px dashed var(--border)', 
                  borderRadius: '8px', padding: '0.8rem', color: 'var(--text-muted)', fontSize: '0.95rem',
                  textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s', marginTop: '0.4rem'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'rgba(124,110,248,0.5)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
              >
                업무 지시나 피드백을 전달하세요... (/커맨드 호출 가능)
              </button>
            ) : (
              <>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={textareaRef}
                value={commentText}
                onChange={(e) => {
                  const val = e.target.value;
                  setCommentText(val);
                  // ── [Phase 37] [#ID] 디바운스 검증 ──
                  const refs = extractChainRefs(val);
                  refs.forEach(refId => contextChain.debouncedValidate(refId));
                  // ─────────────────────────────────────
                  const slashIdx = val.lastIndexOf('/');
                  if (slashIdx !== -1) {
                    const afterSlash = val.slice(slashIdx + 1);
                    if (!afterSlash.includes(' ') && !afterSlash.includes('\n')) {
                      setSlashQuery(afterSlash);
                      setSlashTarget('comment');
                      setShowSlash(true);
                    } else {
                      setShowSlash(false);
                    }
                  } else {
                    setShowSlash(false);
                  }
                }}
                placeholder="업무 지시나 피드백을 전달하세요... (/커맨드 호출 가능)"
                onKeyDown={(e) => { 
                  if (showSlash && slashTarget === 'comment' && e.key === 'Escape') { e.preventDefault(); setShowSlash(false); return; }
                  
                  if (showSlash && slashTarget === 'comment' && e.key === 'Enter' && filteredSlash.length > 0) {
                    e.preventDefault();
                    const cmd = filteredSlash[0];
                    setShowSlash(false);

                    // 파이프라인 명령어: 즉시 실행 + activity 로그
                    if (cmd.id === '/run' || cmd.id === '/run-b') {
                      const pipelineMode = cmd.id === '/run-b' ? 'run-b' : 'run';
                      const projectId = task?.project_id;
                      const pendingMsg = pipelineMode === 'run'
                        ? `🚀 /run 파이프라인 시작 요청 — PRD→Advisor 자율 완주 모드`
                        : `⏸ /run-b 파이프라인 시작 요청 — 단계별 CEO 확인 모드`;
                      setComments(prev => [...prev, {
                        author: 'system', source: { id: 'system', name: 'system' },
                        target: { id: 'user-1', name: 'CEO' },
                        content: pendingMsg, created_at: new Date().toISOString(),
                      }]);
                      setActiveCommentTab('activity');
                      setCommentText('');
                      if (projectId) {
                        fetch(`${SERVER_URL}/api/projects/${encodeURIComponent(projectId)}/pipeline/${pipelineMode}`, { 
                          method: 'POST',
                          headers: { 'Content-Type': 'application/json' },
                          body: JSON.stringify({ taskId: String(task.id) })
                        })
                          .then(async (res) => {
                            const data = await res.json();
                            if (!res.ok) throw new Error(data.error || '실패');
                            const msg = pipelineMode === 'run'
                              ? `🚀 /run 파이프라인 시작됨 — ${data.title || 'PRD'}부터 자율 완주`
                              : `⏸ /run-b 단계별 확인 모드 시작됨`;
                            useTimelineStore.getState().appendTimeline({
                              level: 'info', message: msg, agentId: 'system',
                              timestamp: new Date().toISOString(), projectId,
                            });
                            setComments(prev => [...prev, {
                              author: 'system', source: { id: 'system', name: 'system' },
                              target: { id: 'user-1', name: 'CEO' },
                              content: `✅ ${msg}`, created_at: new Date().toISOString(),
                            }]);
                          })
                          .catch(err => {
                            setComments(prev => [...prev, {
                              author: 'system', source: { id: 'system', name: 'system' },
                              target: { id: 'user-1', name: 'CEO' },
                              content: `❌ 파이프라인 실패: ${err.message}`, created_at: new Date().toISOString(),
                            }]);
                          });
                      }
                      return;
                    }

                    if (cmd.id === '/코드') {
                      const sIdx = commentText.lastIndexOf('/');
                      const newText = commentText.slice(0, sIdx) + '\n```typescript\n// 여기에 코드를 작성하세요\n\n```\n';
                      setCommentText(newText);
                      return;
                    }

                    // 그 외: 자동완성
                    const sIdx = commentText.lastIndexOf('/');
                    const newText = commentText.slice(0, sIdx) + `${cmd.id} `;
                    setCommentText(newText);
                    return;
                  }

                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment(); 
                }}
                onBlur={() => setTimeout(() => setShowSlash(false), 150)}
                disabled={isArchived}
                style={{
                  width: '100%',
                  background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: '8px',
                  resize: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: '1.05rem', fontFamily: 'inherit',
                  lineHeight: 1.5, minHeight: '80px', maxHeight: '200px', padding: '0.8rem',
                  opacity: isArchived ? 0.45 : 1,
                }}
              />
              {/* ── /슬래시 커맨드 자동완성 (Comment용) ────────────────────────── */}
              {showSlash && slashTarget === 'comment' && filteredSlash.length > 0 && (
                <div
                  ref={slashRef}
                  style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
                    background: 'var(--bg-surface-2)', border: '1px solid rgba(124,110,248,0.4)',
                    borderRadius: 10, overflow: 'hidden', zIndex: 200,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                  }}
                >
                  {filteredSlash.map(cmd => (
                    <button
                      key={cmd.id}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        if (cmd.id === '/코드') {
                          const sIdx = commentText.lastIndexOf('/');
                          const newText = commentText.slice(0, sIdx) + '\n```typescript\n// 여기에 코드를 작성하세요\n\n```\n';
                          setCommentText(newText);
                        } else {
                          const sIdx = commentText.lastIndexOf('/');
                          const newText = commentText.slice(0, sIdx) + `${cmd.id} `;
                          setCommentText(newText);
                        }
                        setShowSlash(false);
                        setTimeout(() => textareaRef.current?.focus(), 0);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.6rem',
                        width: '100%', padding: '0.6rem 0.8rem',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-primary)', fontSize: '0.88rem', textAlign: 'left',
                        transition: 'background 0.12s',
                        borderBottom: '1px solid var(--border)'
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,110,248,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--brand)' }}>{cmd.icon}</span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{cmd.id}</span>
                        <span style={{ opacity: 0.6, fontSize: '0.75rem' }}>{cmd.label}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
            {/* 아카이빙 완료 배너 */}
            {isArchived && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.5rem',
                background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.35)',
                borderRadius: '8px', padding: '0.55rem 0.9rem',
                color: '#F59E0B', fontSize: '0.85rem', fontWeight: 600,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>inventory_2</span>
                📦 아카이빙 완료 — Obsidian에 저장됩니다. X 버튼으로 닫으면 칸반에서 제거됩니다.
              </div>
            )}
            
            {/* 하단 툴바: 우측 전송 및 취소 버튼 */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', marginTop: '0.2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>keyboard_command_key</span>
                  +Enter 업데이트 전송
                </span>
                <button
                  onClick={() => { setIsCommentExpanded(false); setCommentText(''); }}
                  style={{ background: 'transparent', color: 'var(--text-muted)', border: 'none', padding: '0.4rem 0.8rem', cursor: 'pointer', fontSize: '0.85rem' }}
                >
                  접기
                </button>
                <button
                  onClick={handleSubmitComment}
                  disabled={
                    isArchived ||
                    commentColumn === 'archive' ||
                    (!commentText.trim() && Object.keys(task).length > 0 && commentColumn === task.column && commentAssignee === task.assignee && commentPriority === task.priority)
                  }
                  style={{
                    background: 'var(--brand-dim, #2668ff)', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '0.4rem 1rem', cursor: 'pointer', fontSize: '0.9rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', transition: 'all 0.18s ease', letterSpacing: '0.02em', boxShadow: '0 2px 8px rgba(38,104,255,0.35)',
                  }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#1a52e8'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand-dim, #2668ff)'; }}
                >
                  전송
                </button>
              </div>
              </div>
            </>
            )}
          </div>
        </div>

        {/* ── [Phase 37] Resizer 핸들 ── */}
        {(isPreviewMode || isChainMode) && (
          <div
            ref={resizerRef}
            onMouseDown={handleResizerMouseDown}
            title="드래그해서 크기 조절"
            style={{
              width: '5px', flexShrink: 0,
              background: 'rgba(180,197,255,0.12)',
              cursor: 'col-resize',
              transition: 'background 0.15s',
              position: 'relative',
              zIndex: 10,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,135,242,0.35)'}
            onMouseLeave={e => { if (!isDragging.current) e.currentTarget.style.background = 'rgba(180,197,255,0.12)'; }}
          >
            {/* 핸들 시각 표시 점 */}
            <div style={{
              position: 'absolute', top: '50%', left: '50%',
              transform: 'translate(-50%,-50%)',
              display: 'flex', flexDirection: 'column', gap: '4px',
            }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: '3px', height: '3px', borderRadius: '50%', background: 'rgba(180,197,255,0.5)' }} />
              ))}
            </div>
          </div>
        )}

        {/* ── [Phase 37] Right Pane — 컨텍스트 체인 패널 ── */}
        {isChainMode && !isPreviewMode && (
          <div style={{
            flex: `0 0 ${100 - splitRatio}%`,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', minWidth: 0,
            background: 'var(--bg-base)',
            borderLeft: '1px solid var(--border)',
          }}>
            <ContextChainPanel
              activeRef={contextChain.activeRef}
              chainData={contextChain.chainData}
              isLoading={contextChain.isLoading}
              canGoBack={contextChain.canGoBack}
              onNavigate={(refId) => contextChain.navigateTo(refId)}
              onBack={contextChain.navigateBack}
              onClose={contextChain.closePanel}
            />
          </div>
        )}

        {/* ── [Phase B] Right Pane — iframe 프리뷰 (Preview / Graph 탭) ── */}
        {isPreviewMode && (
          <div style={{
            flex: `0 0 ${100 - splitRatio}%`,
            display: 'flex', flexDirection: 'column',
            overflow: 'hidden', minWidth: 0,
            background: 'var(--bg-base)',
            borderLeft: '1px solid var(--border)',
          }}>
            {/* [Phase B] 탭 헤더: [Preview] / [Graph] */}
            <div style={{
              display: 'flex', alignItems: 'center',
              borderBottom: '1px solid var(--border)',
              background: 'var(--bg-surface-2)',
              flexShrink: 0,
              padding: '0 0.5rem',
            }}>
              {[
                { key: 'preview', icon: 'preview',      label: 'Preview' },
                { key: 'graph',   icon: 'account_tree', label: 'Graph'   },
              ].map(tab => (
                <button
                  key={tab.key}
                  id={`btn-right-pane-tab-${tab.key}`}
                  onClick={() => tab.key === 'graph' ? handleGraphTabClick() : setRightPaneTab('preview')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '0.3rem',
                    padding: '0.45rem 0.75rem',
                    fontSize: '0.72rem', fontWeight: 700,
                    fontFamily: 'Space Grotesk, sans-serif',
                    letterSpacing: '0.04em',
                    border: 'none',
                    borderBottom: rightPaneTab === tab.key ? '2px solid var(--brand)' : '2px solid transparent',
                    borderRadius: 0,
                    background: 'none',
                    color: rightPaneTab === tab.key ? 'var(--brand)' : 'var(--text-muted)',
                    cursor: 'pointer',
                    transition: 'color 0.15s',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>{tab.icon}</span>
                  {tab.label}
                </button>
              ))}

              {/* 공통 툴 버튼 (새로고침, 새 탭) */}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px' }}>
                <button
                  id="btn-preview-refresh"
                  onClick={() => {
                    if (rightPaneTab === 'preview') {
                      setPreviewError(false);
                      if (iframeRef.current) iframeRef.current.src = iframeRef.current.src;
                    } else {
                      // Graph 탭 재확인
                      setGraphPaneChecked(false);
                      if (graphUrl) {
                        fetch(graphUrl, { method: 'HEAD' })
                          .then((r) => setGraphPaneExists(r.ok))
                          .catch(() => setGraphPaneExists(false))
                          .finally(() => setGraphPaneChecked(true));
                      }
                      if (graphIframeRef.current) graphIframeRef.current.src = graphIframeRef.current.src;
                    }
                  }}
                  title="새로고침"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                    padding: '4px', borderRadius: '6px', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>refresh</span>
                </button>
                <button
                  id="btn-preview-new-tab"
                  onClick={() => {
                    const url = rightPaneTab === 'preview' ? previewUrl : graphUrl;
                    if (url) window.open(url, '_blank');
                  }}
                  title="새 탭에서 열기"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                    padding: '4px', borderRadius: '6px', transition: 'all 0.15s',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
                  onMouseLeave={e => e.currentTarget.style.background = 'none'}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.05rem' }}>open_in_new</span>
                </button>
              </div>
            </div>

            {/* URL 표시 바 */}
            <div style={{
              padding: '0.2rem 0.8rem',
              background: 'var(--bg-surface-2)',
              borderBottom: '1px solid var(--border)',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'SF Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'block' }}>
                {rightPaneTab === 'preview' ? previewUrl : graphUrl}
              </span>
            </div>

            {/* ── Preview 탭 콘텐츠 ── */}
            {rightPaneTab === 'preview' && (
              previewError ? (
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '0.75rem', padding: '2rem',
                  color: 'var(--text-muted)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', opacity: 0.4 }}>web_asset_off</span>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.35rem', color: 'var(--text-secondary)' }}>
                      아직 OUTPUT/index.html이 없어요
                    </div>
                    <div style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
                      에이전트가 코드를 생성하면 자동으로 표시됩니다.<br />
                      생성 후 <strong>새로고침</strong> 버튼을 눌러주세요.
                    </div>
                  </div>
                  <button
                    onClick={() => { setPreviewError(false); if (iframeRef.current) iframeRef.current.src = iframeRef.current.src; }}
                    style={{
                      marginTop: '0.5rem', padding: '0.5rem 1.2rem',
                      background: 'rgba(100,135,242,0.12)',
                      border: '1px solid rgba(100,135,242,0.3)',
                      borderRadius: '8px', color: 'var(--brand)',
                      cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                      transition: 'all 0.15s',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                    다시 시도
                  </button>
                </div>
              ) : (
                <iframe
                  ref={iframeRef}
                  src={previewUrl}
                  title={`프리뷰 — ${task?.title || 'Task'}`}
                  style={{ flex: 1, width: '100%', border: 'none', background: '#fff' }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                  onError={() => setPreviewError(true)}
                />
              )
            )}

            {/* ── Graph 탭 콘텐츠 ── */}
            {rightPaneTab === 'graph' && (
              !graphPaneChecked ? (
                /* 로딩 */
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '0.75rem', color: 'var(--text-muted)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2rem', opacity: 0.5, animation: 'spin 1.2s linear infinite' }}>sync</span>
                  <span style={{ fontSize: '0.82rem' }}>그래프 확인 중...</span>
                </div>
              ) : graphPaneExists ? (
                /* 그래프 존재: Iframe 렌더링 */
                <iframe
                  ref={graphIframeRef}
                  src={graphUrl}
                  title={`지식 그래프 — ${task?.title || 'Task'}`}
                  style={{ flex: 1, width: '100%', border: 'none', background: '#0d0f14' }}
                  sandbox="allow-scripts allow-same-origin"
                />
              ) : (
                /* 그래프 없음: Empty State */
                <div style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: '1rem', padding: '2rem', color: 'var(--text-muted)',
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '3rem', opacity: 0.3 }}>account_tree</span>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: '0.4rem', color: 'var(--text-secondary)' }}>
                      지식 그래프가 아직 없어요
                    </div>
                    <div style={{ fontSize: '0.78rem', lineHeight: 1.6 }}>
                      태스크가 <strong>Done</strong> 처리되면<br />
                      Graphify 워치독이 자동으로 생성합니다.
                    </div>
                  </div>
                  <button
                    onClick={handleGraphTabClick}
                    style={{
                      padding: '0.5rem 1.2rem',
                      background: 'rgba(100,135,242,0.1)',
                      border: '1px solid rgba(100,135,242,0.3)',
                      borderRadius: '8px', color: 'var(--brand)',
                      cursor: 'pointer', fontSize: '0.82rem', fontWeight: 600,
                      display: 'flex', alignItems: 'center', gap: '0.4rem',
                    }}
                  >
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                    다시 확인
                  </button>
                </div>
              )
            )}
          </div>
        )}

        {/* Split View 컨테이너 닫기 */}
        </div>

          {/* Review 상태: 승인/재작업 영역만 유지 */}
          {isReview && (

            <div className="modal__footer">
              <div className="modal__review-zone">
                {showReworkInput ? (
                  <div className="modal__rework-input-row">
                    <input
                      className="modal__rework-input"
                      placeholder="재작업 사유 (선택)"
                      value={reworkReason}
                      onChange={(e) => setReworkReason(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') handleRework(); if (e.key === 'Escape') setShowReworkInput(false); }}
                      autoFocus
                    />
                    <button className="modal-btn modal-btn--rework" onClick={handleRework}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                      전송
                    </button>
                    <button className="modal-btn modal-btn--ghost" onClick={() => setShowReworkInput(false)}>
                      취소
                    </button>
                  </div>
                ) : (
                  <div className="modal__review-btns">
                    <button className="modal-btn modal-btn--approve" onClick={handleApprove}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>check_circle</span>
                      승인
                    </button>
                    <button className="modal-btn modal-btn--rework" onClick={() => setShowReworkInput(true)}>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>refresh</span>
                      재작업
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
      </div>

      {toastMsg && (
        <div style={{
          position: 'absolute', bottom: '30px', left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(30,30,30,0.95)', border: '1px solid rgba(255,255,255,0.15)',
          color: '#fff', padding: '12px 24px', borderRadius: '8px', zIndex: 9999,
          boxShadow: '0 8px 30px rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', gap: '8px',
          fontFamily: 'Space Grotesk, sans-serif', fontSize: '0.9rem', fontWeight: 500,
          animation: 'fadeInUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <span className="material-symbols-outlined" style={{ color: 'var(--brand)', fontSize: '1.2rem' }}>info</span>
          {toastMsg}
        </div>
      )}

      {/* [Bug 3 Fix] ARCHITECT 모드 실행 시 Plan Master 기획 파이프라인 전용 모달 */}
      {showPlanMasterModal && task && (
        <PlanMasterModal
          projectId={task.projectId || task.project_id}
          taskId={task.id}
          onClose={() => setShowPlanMasterModal(false)}
          onSubmit={(roadmap) => {
            // 기획 완료 → 현재 태스크를 REVIEW로 이동 (CEO 검토 요청)
            setShowPlanMasterModal(false);
            patchTask(task.id, { column: 'review', status: 'REVIEW' });
            fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ column: 'review' }),
            }).catch(console.error);
            showToast(`✅ Plan Master 기획 완료! ${roadmap?.mvp_tasks?.length || 0}개 MVP 카드가 백로그에 생성되었습니다.`);
          }}
        />
      )}
    </div>
  );
}
