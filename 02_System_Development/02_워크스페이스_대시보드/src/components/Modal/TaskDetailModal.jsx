// src/components/Modal/TaskDetailModal.jsx — Phase 11 태스크 상세 제어 모달
import { useState, useEffect, useCallback, useRef } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useKanbanStore } from '../../store/kanbanStore';
import { useAgentStore } from '../../store/agentStore';
import { useLogStore } from '../../store/logStore';
import { useSocket } from '../../hooks/useSocket';

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

const SERVER_URL_TL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

function WorkflowTimeline({ taskId }) {
  const logs = useLogStore((s) => s.logs);

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

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export default function TaskDetailModal() {
  const { activeDetailTaskId, setActiveDetailTaskId, setFocusedTaskId, focusedTaskId, openArtifact } = useUiStore();
  const tasks = useKanbanStore((s) => s.tasks);
  const removeTask = useKanbanStore((s) => s.removeTask);
  const updateTaskStatus = useKanbanStore((s) => s.updateTaskStatus);
  const patchTask = useKanbanStore((s) => s.patchTask);

  const { socket } = useSocket();
  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  const [activeCommentTab, setActiveCommentTab] = useState('discussion'); // [S4-2] 탭: 'discussion' | 'activity' | 'output'
  const [isStarting, setIsStarting] = useState(false); // [Sprint4+] 실행 시작 로딩
  const [outputFiles, setOutputFiles] = useState([]); // [Phase 28] 에이전트 결과물 파일 목록
  
  // 패스 21: 댓글 전송 시 함께 업데이트할 필드 상태
  const [commentColumn, setCommentColumn] = useState('');
  const [commentAssignee, setCommentAssignee] = useState('');
  const [commentPriority, setCommentPriority] = useState('medium');
  
  // 편집 기능 상태 
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editAssignee, setEditAssignee] = useState('');
  const [editModel, setEditModel] = useState('');
  
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [reworkReason, setReworkReason] = useState('');
  const [showReworkInput, setShowReworkInput] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isArchived, setIsArchived] = useState(false); // 아카이빙 완료 상태 (API 호출 후 모달 유지)
  const textareaRef = useRef(null);
  const moreMenuRef = useRef(null);
  const fileInputRef = useRef(null); // [Phase 28] 파일 첨부
  const [isUploading, setIsUploading] = useState(false); // [Phase 28] 파일 업로드 상태

  const task = activeDetailTaskId ? (tasks[String(activeDetailTaskId)] || null) : null;
  const isFocused = String(focusedTaskId) === String(activeDetailTaskId);

  // 댓글 로드 및 초기 폼 세팅
  useEffect(() => {
    if (!activeDetailTaskId) return;
    setIsLoadingComments(true);
    fetch(`${SERVER_URL}/api/tasks/${activeDetailTaskId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(Array.isArray(data.comments) ? data.comments : []))
      .catch(() => setComments([]))
      .finally(() => setIsLoadingComments(false));
      
    // 초기 폼 상태 동기화 (최초 1회만)
    if (task) {
      setCommentColumn(task.column || '');
      setCommentAssignee(task.assignee || '');
      setCommentPriority(task.priority || 'medium');
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

  // [Phase 28] output:created 소켓 — 에이전트 결과물 파일 도착 감지
  useEffect(() => {
    if (!socket || !activeDetailTaskId) return;
    const handler = ({ taskId, fileName, filePath }) => {
      if (String(taskId) !== String(activeDetailTaskId)) return;
      setOutputFiles(prev => {
        // 중복 방지
        if (prev.some(f => f.filePath === filePath)) return prev;
        return [{ fileName, filePath, arrivedAt: new Date().toISOString() }, ...prev];
      });
      setActiveCommentTab('output'); // 결과물 도착 시 Output 탭 자동 전환
    };
    socket.on('output:created', handler);
    return () => socket.off('output:created', handler);
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
      setActiveCommentTab('activity'); // Activity 탭 자동 전환
    };
    socket.on('task:updated', onTaskUpdated);
    return () => socket.off('task:updated', onTaskUpdated);
  }, [socket, activeDetailTaskId]);

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
  }, [setActiveDetailTaskId, isArchived, activeDetailTaskId, removeTask]);

  const handleEditTask = () => {
    setEditTitle(task.title);
    setEditContent(task.content || '');
    setEditAssignee(task.assignee || '');
    setEditModel(task.model || '');
    setIsEditing(true);
    setShowMoreMenu(false);
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    
    const payload = {
      title: editTitle.trim(), 
      content: editContent.trim(),
      assignee: editAssignee || '미할당',
      model: editModel || '미지정'
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

  // [Phase 28] 첨부파일 업로드 핸들러
  const handleAttach = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file || !task) return;
    e.target.value = ''; // reset for re-select same file
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`${SERVER_URL}/api/input/${task.id}`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.success) {
        const tag = `[\ucca8\ubd80: ${data.filePath}]`;
        setCommentText(prev => prev ? `${prev}\n${tag}` : tag);
      } else {
        alert(data.message || '\uc5c5\ub85c\ub4dc \uc2e4\ud328');
      }
    } catch (err) {
      console.error('[Attach] \uc5c1\ub85c\ub4dc \uc624\ub958:', err.message);
    } finally {
      setIsUploading(false);
    }
  }, [task, SERVER_URL]);

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

    let finalColumn = commentColumn;
    if (commentPriority === 'high' && commentColumn === 'todo') {
      finalColumn = 'in_progress';
      setCommentColumn('in_progress');
    }

    const finalAssignee = finalColumn === 'review' ? '대표님 (나)' : commentAssignee;
    const hasUpdates = (commentPriority !== task.priority) || (finalAssignee !== task.assignee) || (finalColumn !== task.column);

    if (hasUpdates) {
       patchTask(task.id, {
         priority: commentPriority,
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
           priority: commentPriority,
           assignee: finalAssignee,
           column: finalColumn
         })
       }).catch(console.error);
    }

    setCommentAssignee(finalAssignee);

    // Optimistic update: target 결정 원칙
    // CEO 댓글은 항상 현재(또는 새로 지정된) assignedAgent에게 지시
    // → assignee를 바꾸면 새 담당자, 그대로면 기존 담당자
    const assigneeChanged = finalAssignee && finalAssignee !== task.assignee && finalAssignee !== '미할당';
    const targetName = assigneeChanged
      ? finalAssignee                                    // 담당자 변경 → 새 담당자
      : (commentAssignee || task.assignee || 'ARI');    // 담당자 유지 → 현재 담당자
    const newComment = {
      author: 'CEO',
      source: { id: 'user-1', name: 'CEO' },
      target: { id: 'agent', name: targetName },
      content: commentText.trim(),
      created_at: new Date().toISOString()
    };
    // Optimistic update — 즉시 반영
    setComments((prev) => [...prev, newComment]);
    setCommentText('');

    // REST 동기화 (백그라운드)
    fetch(`${SERVER_URL}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: 'CEO', content: newComment.content, assignedAgent: finalAssignee }),
    }).catch(console.error);
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
    setIsStarting(true);
    // PATCH → server가 task:updated 소켓 emit → 모달의 onTaskUpdated에서 Activity 자동 추가
    fetch(`${SERVER_URL}/api/tasks/${task.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ column: 'in_progress' }),
    })
      .then((r) => r.json())
      .then(() => patchTask(task.id, { column: 'in_progress', status: 'IN_PROGRESS' }))
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

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-label={`Task #${task.id} 상세`}
      onClick={(e) => { if (e.target === e.currentTarget) handleClose(); }}
    >
      <div className="modal modal--detail">

      <div className="modal__header" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>

          {/* ↗ 결과물 프리뷰 버튼 — 아티팩트가 있을 때만 활성화 */}
          {task.has_artifact === 1 && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                // artifact_url이 있으면 이미지/파일 뷰어, 없으면 latestComment 텍스트 뷰
                const artifactContent = task.artifact_url
                  ? `# ${task.title || 'Task Result'}\n\n![결과물](${task.artifact_url})\n\n---\n\n*Task ID: #${task.id} | Agent: ${task.assignee || 'AI'}*`
                  : `# ${task.title || 'Task Result'}\n\n${task.latestComment || '결과물이 여기에 표시됩니다.'}\n\n---\n\n*Task ID: #${task.id} | Agent: ${task.assignee || 'AI'}*`;
                openArtifact({
                  id: task.id,
                  title: task.title || task.content || `Task #${task.id}`,
                  content: artifactContent,
                  type: task.artifact_url ? 'Image' : 'Document',
                  agentName: task.assignee || 'AI Agent',
                  artifactUrl: task.artifact_url || null,
                });
              }}
              title="결과물 미리보기"
              style={{
                background: 'rgba(180,197,255,0.07)',
                border: '1px solid rgba(180,197,255,0.18)',
                cursor: 'pointer', padding: '6px 8px',
                color: 'var(--brand)',
                display: 'flex', alignItems: 'center',
                transition: 'all 0.15s',
                borderRadius: '8px',
                flexShrink: 0,
                alignSelf: 'flex-start',
                marginTop: '2px',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(180,197,255,0.14)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(180,197,255,0.07)'; }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.15rem' }}>open_in_full</span>
            </button>
          )}

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
              <span style={{ 
                fontSize: '0.76rem', fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700,
                letterSpacing: '0.08em', color: 'var(--text-muted)' 
              }}>Task #{task.id}</span>
              <span style={{
                fontSize: '0.76rem', fontWeight: 700, padding: '2px 9px', borderRadius: '4px',
                background: 'rgba(180,197,255,0.08)', color: statusInfo.color,
                fontFamily: 'Space Grotesk, sans-serif'
              }}>
                {statusInfo.text}
              </span>
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

        {/* 본문 (스크롤 가능) */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1rem 1.5rem' }}>

          {/* 태스크 내용 */}
          {isEditing ? (
            <div style={{ marginBottom: '1.25rem' }}>
              <textarea 
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                style={{ width: '100%', background: 'var(--bg-surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem', outline: 'none', resize: 'vertical', fontSize: '1.05rem', lineHeight: 1.6 }}
                placeholder="태스크 상세 내용..."
              />
              <div style={{ display: 'flex', gap: '1rem', marginTop: '0.8rem', flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>담당자 (Assignee)</label>
                  <select 
                    value={editAssignee} 
                    onChange={(e) => setEditAssignee(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem', outline: 'none', fontSize: '0.85rem' }}
                  >
                    <option value="">미할당</option>
                    {Object.values(useAgentStore.getState().agentMeta || {}).map((m) => (
                      <option key={m.name} value={m.name}>{m.name} ({m.role})</option>
                    ))}
                  </select>
                </div>
                <div style={{ flex: 1, minWidth: '140px' }}>
                  <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>모델 (Model)</label>
                  <select 
                    value={editModel} 
                    onChange={(e) => setEditModel(e.target.value)}
                    style={{ width: '100%', background: 'var(--bg-surface-2)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.5rem', outline: 'none', fontSize: '0.85rem' }}
                  >
                    <option value="">선택 안함</option>
                    <option value="Claude Opus 4.6 (Thinking)">Claude Opus 4.6 (Thinking)</option>
                    <option value="Claude Sonnet 4.6 (Thinking)">Claude Sonnet 4.6 (Thinking)</option>
                    <option value="Gemini 3.1 Pro (High)">Gemini 3.1 Pro (High)</option>
                    <option value="Gemini 3 Flash">Gemini 3 Flash</option>
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '1rem', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost btn--sm" onClick={() => setIsEditing(false)}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={handleSaveEdit}>저장</button>
              </div>
            </div>
          ) : (
            <div className="task-content-area" style={{ position: 'relative', minHeight: '60px' }}>
              <p style={{
                fontSize: '1.05rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.75,
                marginBottom: '20px',
                whiteSpace: 'pre-wrap',
                background: 'transparent',
                border: 'none',
                padding: 0,
              }}>
                {(task.content || task.title)}
              </p>
            </div>
          )}

          {/* 메타 정보 */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>edit_square</span>
              작성: {task.author || '시스템'}
            </div>
            {task.assignee && task.assignee !== '미할당' && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '0.3rem', background: 'rgba(0,0,0,0.2)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.1)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>person</span>
                담당: {task.assignee}
              </div>
            )}
            {task.createdAt && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>calendar_today</span>
                {new Date(task.createdAt).toLocaleDateString('ko-KR')}
              </div>
            )}
            {/* [Phase 14] 실제 투입된 LLM 모델 정보 노출 */}
            {task.model && !['ari', 'luca', 'sonnet', 'opus'].includes(task.model.toLowerCase()) && (
              <div style={{ 
                fontSize: '0.72rem', fontWeight: 700, padding: '2px 8px', borderRadius: '4px',
                background: 'rgba(180,197,255,0.1)',
                color: 'var(--brand)',
                border: '1px solid rgba(180,197,255,0.2)',
                fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase', letterSpacing: '0.04em',
                display: 'flex', alignItems: 'center', gap: '0.3rem'
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>memory</span>
                {task.model.replace(/-preview|-latest/g, '')}
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

          {/* todo: 실행 시작 CTA */}
          {(task.column === 'todo' || task.status === 'PENDING') && (
            <div style={{
              background: isStarting ? 'rgba(180,197,255,0.1)' : 'rgba(180,197,255,0.06)',
              border: `1px solid ${isStarting ? 'rgba(180,197,255,0.4)' : 'rgba(180,197,255,0.18)'}`,
              borderRadius: '12px', padding: '0.8rem 1rem', marginBottom: '1.25rem',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              gap: '1rem', transition: 'all 0.3s',
            }}>
              <div style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span className="material-symbols-outlined" style={{
                  fontSize: '1.1rem', color: 'var(--brand)', opacity: 0.85,
                  animation: isStarting ? 'spin 1s linear infinite' : 'none',
                }}>
                  {isStarting ? 'sync' : 'pending_actions'}
                </span>
                {isStarting
                  ? <span style={{ color: 'var(--brand)' }}><strong>{task.assignee}</strong>에게 태스크를 전달하는 중...</span>
                  : task.assignee && task.assignee !== '미할당'
                    ? <><strong style={{ color: 'var(--text-primary)' }}>{task.assignee.toUpperCase()}</strong>에게 즉시 실행을 시작할 수 있습니다.</>
                    : <span style={{ color: 'var(--text-muted)' }}>담당자를 지정하면 실행시킬 수 있습니다.</span>
                }
              </div>
              <button
                onClick={handleStartTask}
                disabled={!task.assignee || task.assignee === '미할당' || isStarting}
                style={{
                  background: isStarting
                    ? 'rgba(180,197,255,0.15)'
                    : (!task.assignee || task.assignee === '미할당')
                      ? 'var(--bg-surface-3)'
                      : 'linear-gradient(135deg, rgba(180,197,255,0.25), rgba(120,140,255,0.35))',
                  color: (!task.assignee || task.assignee === '미할당') ? 'var(--text-muted)' : 'var(--brand)',
                  border: '1px solid rgba(180,197,255,0.3)', borderRadius: '8px',
                  padding: '0.45rem 1rem',
                  cursor: (!task.assignee || task.assignee === '미할당' || isStarting) ? 'not-allowed' : 'pointer',
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

          {/* 댓글 목록 */}
          <div style={{ marginBottom: '1rem' }}>
            {/* [S4-2] Discussion / Activity 탭 */}
            {(() => {
              const isSystemComment = (c) => {
                const a = (c.author || '').toLowerCase();
                const s = (c.source?.name || '').toLowerCase();
                return a === 'system' || s === 'system';
              };
              const discussionComments = comments.filter(c => !isSystemComment(c));
              const activityComments   = comments.filter(c =>  isSystemComment(c));
              // output 탭은 visibleComments와 무관하게 별도 렌더링
              const visibleComments    = activeCommentTab === 'discussion' ? discussionComments : activityComments;
              return (
                <>
                  {/* 탭 버튼 */}
                  <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', marginBottom: '0.75rem' }}>
                    {[
                     { key: 'discussion', icon: 'forum',    label: 'Discussion', count: discussionComments.length },
                      { key: 'activity',   icon: 'history',  label: 'Activity',   count: activityComments.length },
                      { key: 'output',     icon: 'folder_open', label: 'Output',  count: outputFiles.length },
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
                  {isLoadingComments ? (
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
                  const isAgentComment = !isCeo && !isAriDelegate && c.author !== 'CEO' && c.author !== '대표님';
                  // CEO: 초록 / ARI(위임): 주황 / 에이전트: 브랜드색
                  const srcColor = isCeo ? '#4ade80' : isAriDelegate ? '#fb923c' : 'var(--brand)';
                  const tgtColor = isAgentComment ? 'var(--status-active)' : (isCeo || isAriDelegate) ? 'var(--brand)' : 'var(--text-muted)';
                  return (
                  <div key={i} style={{
                    background: 'var(--bg-surface-2)', borderRadius: '10px',
                    padding: '0.7rem 0.9rem', border: '1px solid var(--border)'
                  }}>
                     <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.35rem', alignItems: 'center' }}>
                       <span style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem' }}>
                         {activeCommentTab === 'activity' ? (
                           <span style={{
                             fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)',
                             fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase',
                             letterSpacing: '0.07em', background: 'rgba(255,255,255,0.06)',
                             border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '1px 6px',
                           }}>System Log</span>
                         ) : (
                           <span style={{ fontSize: '0.82rem', fontWeight: 700, color: srcColor }}>{srcName}</span>
                         )}
                       </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>
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
                    </div>
                    <div style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0, wordBreak: 'break-word' }}>
                      {(() => {
                        // ── 미디어 + 마크다운 통합 렌더러 ──────────────────────────────
                        // 처리 순서: <video> 태그 → ![img] 마크다운 → 다운로드 링크 → 굵게/기울임/줄바꿈
                        const raw = c.content || '';
                        const parts = [];
                        let remaining = raw;
                        let keyIdx = 0;

                        // 1) <video ...> 태그 파싱 (remotionRenderer.js 출력 포맷 대응)
                        const videoTagRegex = /<video([^>]*)>([\s\S]*?)<\/video>/gi;
                        // 2) 이미지 마크다운 ![alt](url)
                        const imgMdRegex = /!\[([^\]]*)\]\(([^)]+)\)/g;
                        // 3) 마크다운 링크 [text](url) — 다운로드 링크
                        const linkMdRegex = /\[([^\]]+)\]\(([^)]+)\)/g;

                        // 통합 토크나이저: 위치 기반으로 먼저 등장하는 토큰 우선 처리
                        const tokenize = (text) => {
                          const tokens = [];
                          const patterns = [
                            { re: /<video([^>]*)>([\s\S]*?)<\/video>/gi, type: 'video' },
                            { re: /!\[([^\]]*)\]\(([^)]+)\)/g,           type: 'img' },
                            { re: /> 🎬[^\n]*/g,                          type: 'caption' },
                            { re: /\[([^\]]+)\]\(([^)]+)\)/g,            type: 'link' },
                          ];
                          let cursor = 0;
                          while (cursor < text.length) {
                            let earliest = null;
                            for (const { re, type } of patterns) {
                              re.lastIndex = cursor;
                              const m = re.exec(text);
                              if (m && (earliest === null || m.index < earliest.index)) {
                                earliest = { ...m, type, re };
                              }
                            }
                            if (!earliest) {
                              tokens.push({ type: 'text', value: text.slice(cursor) });
                              break;
                            }
                            if (earliest.index > cursor) {
                              tokens.push({ type: 'text', value: text.slice(cursor, earliest.index) });
                            }
                            tokens.push({ type: earliest.type, match: earliest });
                            cursor = earliest.index + earliest[0].length;
                          }
                          return tokens;
                        };

                        // 인라인 마크다운 렌더(굵게/기울임/줄바꿈) — 텍스트 노드에만 적용
                        const renderInline = (text, baseKey) => {
                          const lines = text.split('\n');
                          return lines.map((line, li) => {
                            const boldParts = line.split(/\*\*([^*]+)\*\*/g);
                            const rendered = boldParts.map((seg, si) =>
                              si % 2 === 1
                                ? <strong key={si} style={{ color: 'var(--text-primary)', fontWeight: 700 }}>{seg}</strong>
                                : seg
                            );
                            return (
                              <span key={`${baseKey}-l${li}`}>
                                {rendered}
                                {li < lines.length - 1 && <br />}
                              </span>
                            );
                          });
                        };

                        const tokens = tokenize(raw);
                        tokens.forEach((tok, ti) => {
                          const k = `tok-${ti}`;
                          if (tok.type === 'text') {
                            parts.push(<span key={k}>{renderInline(tok.value, k)}</span>);
                          } else if (tok.type === 'video') {
                            // <video> 태그에서 src 추출
                            const srcMatch = /<source\s+src="([^"]+)"/i.exec(tok.match[0]);
                            const videoSrc = srcMatch ? srcMatch[1] : null;
                            if (videoSrc) {
                              parts.push(
                                <div key={k} style={{ margin: '1rem 0', borderRadius: '10px', overflow: 'hidden', border: '1px solid rgba(180,197,255,0.2)', background: '#000' }}>
                                  <video controls width="100%" style={{ display: 'block', maxHeight: '320px' }}>
                                    <source src={videoSrc} type="video/mp4" />
                                    브라우저가 비디오 태그를 지원하지 않습니다.
                                  </video>
                                </div>
                              );
                            }
                          } else if (tok.type === 'img') {
                            parts.push(
                              <div key={k} style={{ margin: '1rem 0', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                                <img src={tok.match[2]} alt={tok.match[1]} style={{ width: '100%', display: 'block' }} loading="lazy" />
                              </div>
                            );
                          } else if (tok.type === 'caption') {
                            // > 🎬 캡션 라인 스킵 (video 카드 아래 중복 방지)
                          } else if (tok.type === 'link') {
                            parts.push(
                              <a key={k} href={tok.match[2]} target="_blank" rel="noopener noreferrer"
                                style={{ color: 'var(--brand)', textDecoration: 'underline', wordBreak: 'break-all' }}>
                                {tok.match[1]}
                              </a>
                            );
                          }
                        });

                        return parts.length > 0 ? parts : raw;
                      })()}
                    </div>
                  </div>
                ); })}
              </div>
            )}
                </>
              );
            })()}

            {/* [Phase 28] Output 탭 콘텐츠 — 에이전트 결과물 파일 뷰어 */}
            {activeCommentTab === 'output' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', minHeight: '80px' }}>
                {outputFiles.length === 0 ? (
                  <div style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    justifyContent: 'center', padding: '2rem',
                    color: 'var(--text-muted)', fontSize: '0.85rem', gap: '0.5rem',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '2rem', opacity: 0.4 }}>folder_open</span>
                    <span>아직 에이전트 결과물이 없습니다.</span>
                    <span style={{ fontSize: '0.75rem', opacity: 0.6 }}>에이전트가 작업을 완료하면 여기에 파일이 표시됩니다.</span>
                  </div>
                ) : outputFiles.map((f, idx) => {
                  const ext = f.fileName.split('.').pop().toLowerCase();
                  const isImage = ['png','jpg','jpeg','gif','webp'].includes(ext);
                  // /io/outputs/{taskId}/{filename} 정적 서빙 경로
                  const parts = f.filePath.replace('07_OUTPUT/outputs/', '').split('/');
                  const serveUrl = `${SERVER_URL}/io/outputs/${parts.join('/')}`;
                  return (
                    <div key={idx} style={{
                      background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
                      borderRadius: '10px', padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem',
                    }}>
                      {/* 파일 헤더 */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--brand)' }}>
                            {isImage ? 'image' : 'description'}
                          </span>
                          {f.fileName}
                        </span>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {new Date(f.arrivedAt).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <a
                            href={serveUrl}
                            download={f.fileName}
                            style={{ display: 'flex', alignItems: 'center', gap: '0.2rem', fontSize: '0.75rem', color: 'var(--brand)', textDecoration: 'none' }}
                          >
                            <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>download</span>
                          </a>
                        </div>
                      </div>
                      {/* 이미지 미리보기 */}
                      {isImage && (
                        <img
                          src={serveUrl}
                          alt={f.fileName}
                          style={{
                            maxWidth: '100%', maxHeight: '320px', borderRadius: '6px',
                            objectFit: 'contain', border: '1px solid var(--border)',
                          }}
                        />
                      )}
                      {/* 비이미지 파일: 경로 + 열기 링크 */}
                      {!isImage && (
                        <a
                          href={serveUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ fontSize: '0.78rem', color: 'var(--text-muted)', wordBreak: 'break-all', textDecoration: 'underline' }}
                        >
                          {f.filePath}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
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
                  value={commentColumn === 'review' ? '대표님 (나)' : commentAssignee}
                  onChange={(e) => setCommentAssignee(e.target.value)}
                  disabled={commentColumn === 'review'}
                  style={{ background: 'var(--bg-surface-1)', color: commentColumn === 'review' ? 'var(--brand)' : 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.3rem 0.5rem', outline: 'none', fontSize: '0.82rem', fontWeight: commentColumn === 'review' ? 700 : 400 }}
                >
                  <option value="">미할당</option>
                  <option value="대표님 (나)">대표님 (나)</option>
                  {Object.values(useAgentStore.getState().agentMeta || {}).map((m) => (
                    <option key={m.name} value={m.name}>{m.name}</option>
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
                  <option value="low">낮음</option>
                  <option value="medium">보통</option>
                  <option value="high">높음</option>
                </select>
              </div>
            </div>

            <textarea
              ref={textareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="업무 지시나 피드백을 전달하세요..."
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment(); }}
              disabled={isArchived}
              style={{
                background: 'var(--bg-surface-1)', border: '1px solid var(--border)', borderRadius: '8px',
                resize: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: '1.05rem', fontFamily: 'inherit',
                lineHeight: 1.5, minHeight: '80px', maxHeight: '200px', padding: '0.8rem',
                opacity: isArchived ? 0.45 : 1,
              }}
            />
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
            {/* [Phase 28] 첨부 아이콘 + 전송 버튼 행 */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
              {/* 첨부 아이콘 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.md,.json"
                  style={{ display: 'none' }}
                  onChange={handleAttach}
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isArchived || isUploading}
                  title="파일 첨부 (이미지, PDF, 문서)"
                  style={{
                    background: 'none', border: '1px solid var(--border)', borderRadius: '6px',
                    padding: '0.3rem 0.5rem', cursor: isUploading ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', gap: '0.25rem',
                    color: 'var(--text-muted)', fontSize: '0.78rem',
                    opacity: isUploading ? 0.6 : 1, transition: 'all 0.15s',
                  }}
                  onMouseEnter={(e) => { if (!isUploading) e.currentTarget.style.color = 'var(--brand)'; }}
                  onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; }}
                >
                  {isUploading
                    ? <span className="material-symbols-outlined" style={{ fontSize: '1rem', animation: 'spin 1s linear infinite' }}>sync</span>
                    : <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>attach_file</span>
                  }
                  {isUploading ? '업로드 중...' : '첨부'}
                </button>
              </div>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>keyboard_command_key</span>
                +Enter 업데이트 전송
              </span>
              <button
                onClick={handleSubmitComment}
                disabled={
                  isArchived ||           // 아카이빙 완료 시 전송 비활성
                  commentColumn === 'archive' ||
                  (!commentText.trim() && Object.keys(task).length > 0 && commentColumn === task.column && commentAssignee === task.assignee && commentPriority === task.priority)
                }
                style={{
                  background: 'var(--brand-dim, #2668ff)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.4rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  fontFamily: 'Space Grotesk, sans-serif',
                  transition: 'all 0.18s ease',
                  letterSpacing: '0.02em',
                  boxShadow: '0 2px 8px rgba(38,104,255,0.35)',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1a52e8'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--brand-dim, #2668ff)'; }}
              >
                전송 및 반영
              </button>
            </div>
          </div>
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
    </div>
  );
}
