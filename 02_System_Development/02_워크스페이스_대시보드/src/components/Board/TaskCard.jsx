// src/components/Board/TaskCard.jsx — Phase 15 v2.2 + [S2-3/S2-5] 배지 규칙 명확화
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useUiStore } from '../../store/uiStore';
import { useAgentStore } from '../../store/agentStore';

const PRIORITY_DOT_COLOR = {
  urgent: '#ffb4ab',
  high:   '#ffb963',
  medium: '#b4c5ff',
  low:    'var(--text-muted)',
};

const PRIORITY_LABEL = {
  urgent: 'URGENT', high: 'HIGH', medium: 'MED', low: 'LOW',
};

// [S2-3] 상태 배지 규칙 — 조건이 true일 때만 배지 표시
// FAILED: 에이전트 실행 실패 → 재시도/재할당 필요 알림
// PAUSED: 수동/자동 kill로 중단됨 → 중단 중 표시
// HELP_USER_ACTION: 대표님 결제/승인 대기 → 점멸 dot
// CRITICAL: 위험 키워드 포함 → 경고 배지
const STATUS_BADGE = {
  FAILED: { label: 'FAILED', bg: 'rgba(255,82,82,0.12)', color: '#ff5449', border: 'rgba(255,82,82,0.35)', icon: 'error' },
  PAUSED: { label: 'PAUSED', bg: 'rgba(251,191,36,0.1)', color: '#fbbf24', border: 'rgba(251,191,36,0.35)', icon: 'pause_circle' },
};

export default function TaskCard({ task, isDragging }) {
  const { focusedTaskId, setFocusedTaskId, setActiveDetailTaskId } = useUiStore();
  const isFocused = String(focusedTaskId) === String(task.id);

  const activityType = useAgentStore((s) => s.activeTaskMap.get(String(task.id))?.type ?? null);
  const isThinking = activityType === 'THINKING' || activityType === 'EXPLORED' || activityType === 'EDIT';
  const isWorked   = activityType === 'WORKED';

  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({
    id: String(task.id),
    disabled: isFocused,
  });

  const style = { transform: CSS.Transform.toString(transform), transition };

  const handleFocusClick = (e) => {
    e.stopPropagation();
    setFocusedTaskId(isFocused ? null : task.id);
  };

  const handleCardClick = () => setActiveDetailTaskId(task.id);

  const hasAssignee = task.assignee && task.assignee !== '미할당';
  const priorityDot = PRIORITY_DOT_COLOR[task.priority] || 'var(--text-muted)';

  // [S2-3] 상태 배지 결정: status 기준 우선, column 보조
  const statusBadge = STATUS_BADGE[task.status] || null;

  // 공통 좌측 기준선 — 모든 행이 동일한 left 시작점 유지
  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    width: '100%',
    marginLeft: 0,
  };

  const agentMetaMap = useAgentStore((s) => s.agentMeta) || {};
  const baseAssigneeId = task.assignee?.toLowerCase().replace(/^proj-\d+-/, '');
  const assigneeMeta = baseAssigneeId ? agentMetaMap[baseAssigneeId] : null;
  const roleDisplay = assigneeMeta?.role || task.assignee;


  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      onClick={handleCardClick}
      className={[
        'task-card',
        isDragging  ? 'task-card--dragging' : '',
        isThinking  ? 'task-card--thinking' : '',
        isWorked    ? 'task-card--worked'   : '',
        task.status === 'PAUSED' ? 'task-card--paused' : '',
        isFocused   ? 'task-card--focused'  : '',
      ].filter(Boolean).join(' ')}
      data-task-id={task.id}
    >
      {/* ── 드래그 핸들 (listeners 분리 — 클릭 이벤트 충돌 방지) ── */}
      <div
        {...listeners}
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute', top: 0, left: 0, right: 0, height: '12px',
          cursor: 'grab', borderRadius: '8px 8px 0 0',
        }}
        title="드래그하여 이동"
      />

      {/* ── L1. Metadata ───────────────────────────────────── */}
      <div style={{ ...rowStyle, marginBottom: '0.55rem' }}>

        {/* 포커스 아이콘 + #ID */}
        <button
          onClick={handleFocusClick}
          title={isFocused ? '포커스 해제' : '타임라인 포커스'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.2rem',
            padding: 0, margin: 0,
            color: isFocused ? 'var(--brand)' : 'var(--text-muted)',
            opacity: isFocused ? 1 : 0.6,
            transition: 'color 0.15s, opacity 0.15s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            if (!isFocused) {
              e.currentTarget.style.color = 'var(--text-primary)';
              e.currentTarget.style.opacity = 1;
            }
          }}
          onMouseLeave={(e) => {
            if (!isFocused) {
              e.currentTarget.style.color = 'var(--text-muted)';
              e.currentTarget.style.opacity = 0.6;
            }
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>
            {isFocused ? 'target' : 'adjust'}
          </span>
          <span style={{
            fontSize: '0.72rem', fontWeight: 500,
            fontFamily: 'Space Grotesk, sans-serif',
            letterSpacing: '0.03em',
          }}
            title={task.id ? `Full ID: ${task.id}` : ''}
          >
            {/* [PROJECT-SEQ] project_task_num 있으면 프로젝트 순번, fallback은 뒤 6자리 */}
            {task.project_task_num != null ? `#${task.project_task_num}` : (task.id ? `#${String(task.id).slice(-6)}` : '#—')}
          </span>
        </button>

        {/* 우선순위 Dot + 레이블 — FAILED/PAUSED 시에는 숨기고 상태 배지로 대체 */}
        {task.priority && !statusBadge && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.28rem',
            fontSize: '0.68rem', fontWeight: 600,
            fontFamily: 'Space Grotesk, sans-serif',
            letterSpacing: '0.05em', textTransform: 'uppercase',
            color: 'var(--text-muted)',
          }}>
            <span style={{
              width: 5, height: 5, borderRadius: '50%',
              background: priorityDot, flexShrink: 0,
              display: 'inline-block',
            }} />
            {PRIORITY_LABEL[task.priority] || task.priority.toUpperCase()}
          </span>
        )}

        {/* [S2-3] 상태 배지: FAILED / PAUSED — 명확한 텍스트+아이콘으로 노출 */}
        {statusBadge && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: '0.2rem',
            fontSize: '0.62rem', fontWeight: 700,
            fontFamily: 'Space Grotesk, sans-serif',
            letterSpacing: '0.05em',
            background: statusBadge.bg,
            color: statusBadge.color,
            border: `1px solid ${statusBadge.border}`,
            borderRadius: '4px',
            padding: '1px 5px',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>
              {statusBadge.icon}
            </span>
            {statusBadge.label}
            {/* [S4-3] 실패 이력 카운터 — 2회 이상 실패 시 숫자 표시 */}
            {task.status === 'FAILED' && task.failureCount > 1 && (
              <span style={{
                background: 'rgba(255,82,82,0.25)',
                borderRadius: '3px',
                padding: '0 3px',
                fontSize: '0.58rem',
                fontWeight: 800,
                marginLeft: '1px',
              }}>
                ×{task.failureCount}
              </span>
            )}
          </span>
        )}

        {/* HELP_USER_ACTION 점멸등 */}
        {task.status === 'HELP_USER_ACTION' && (
          <div className="help-user-action-dot" title="대표님의 결제/권한 승인이 필요합니다" />
        )}

      </div>


      {/* ── L2. 제목 (2줄 최대) ── */}
      {task.title && (
        <p
          className="task-card__title line-clamp-2"
          style={{ margin: 0, marginBottom: '0.35rem', padding: 0 }}
        >
          {task.title}
        </p>
      )}

      {/* ── L5. Footer: 담당자 + Risk ─────────────────────── */}
      <div style={{ ...rowStyle, marginTop: '0.5rem' }}>
        {hasAssignee && (
          // [B-11 Fix] 담당자 영역 전체에 overflow 제어 + maxWidth 제한
          <div
            title={task.assignee.toUpperCase()}
            style={{
              display: 'flex', alignItems: 'center', gap: '0.35rem',
              maxWidth: '70%', overflow: 'hidden', flexShrink: 1,
            }}
          >
            {/* 아바타 원형 배지 — 첫 글자 */}
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: 'var(--brand-glow)',
              border: '1px solid rgba(180,197,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', fontWeight: 700,
              color: 'var(--brand)',
              fontFamily: 'Space Grotesk, sans-serif', flexShrink: 0,
            }}>
              {roleDisplay.charAt(0).toUpperCase()}
            </div>
            {/* [B-11 Fix] 에이전트 ID만 표시 — role 텍스트 제거, overflow ellipsis 적용 */}
            <span style={{
              fontSize: '0.75rem', fontWeight: 500,
              color: 'var(--text-muted)',
              fontFamily: 'Space Grotesk, sans-serif',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {roleDisplay}
            </span>
          </div>
        )}

        {/* [S2-3] CRITICAL 위험 배지 — 점 대신 명확한 경고 텍스트 */}
        {task.riskLevel === 'CRITICAL' && (
          <span
            title="위험 키워드 포함 — 실행 전 승인 필요"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: '0.15rem',
              fontSize: '0.6rem', fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              color: '#ffb4ab',
              background: 'rgba(255,82,82,0.08)',
              border: '1px solid rgba(255,82,82,0.2)',
              borderRadius: '3px', padding: '0px 4px',
              letterSpacing: '0.04em', marginLeft: 'auto',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.65rem' }}>warning</span>
            CRITICAL
          </span>
        )}

      </div>
    </div>
  );
}


