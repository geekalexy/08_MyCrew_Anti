// src/components/Board/TaskCard.jsx — Phase 15 v2.2: 정밀 좌측 정렬 + 톤다운
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

  // 공통 좌측 기준선 — 모든 행이 동일한 left 시작점 유지
  const rowStyle = {
    display: 'flex',
    alignItems: 'center',
    gap: '0.45rem',
    width: '100%',        // 전체 너비 사용
    marginLeft: 0,        // 절대 들쑥날쑥 방지
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
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

      {/* ── L1. Metadata ───────────────────────────────────── */}
      <div style={{ ...rowStyle, marginBottom: '0.55rem' }}>

        {/* 포커스 아이콘 + #ID — padding 0으로 기준선 맞춤, 톤다운 */}
        <button
          onClick={handleFocusClick}
          title={isFocused ? '포커스 해제' : '타임라인 포커스'}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: '0.2rem',
            padding: 0, margin: 0,                          // ← 기준선 오프셋 제거
            color: isFocused ? 'var(--brand)' : 'var(--text-muted)',
            opacity: isFocused ? 1 : 0.6,                  // ← 비포커스 시 톤다운
            transition: 'color 0.15s, opacity 0.15s',
            flexShrink: 0,
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>
            {isFocused ? 'target' : 'adjust'}
          </span>
          <span style={{
            fontSize: '0.72rem', fontWeight: 500,           // ← 폰트 웨이트 다운
            fontFamily: 'Space Grotesk, sans-serif',
            letterSpacing: '0.03em',
          }}>
            #{task.id}
          </span>
        </button>

        {/* 우선순위 Dot + 레이블 */}
        {task.priority && (
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
        
        {/* Phase 17-2: HELP_USER_ACTION 점멸등 (우측 상단 고정) */}
        {task.status === 'HELP_USER_ACTION' && (
          <div className="help-user-action-dot" title="대표님의 결제/권한 승인이 필요합니다" />
        )}
      </div>

      {/* ── L2. 제목 (2줄 최대) — margin 0으로 기준선 통일 ── */}
      {task.title && (
        <p
          className="task-card__title line-clamp-2"
          style={{ margin: 0, marginBottom: '0.35rem', padding: 0 }}
        >
          {task.title}
        </p>
      )}

      {/* ── L3. 最신 코멘트 미리보기 ────────────────────────── */}
      {task.latestComment && (
        <div className="task-card__latest-comment">
          <span className="material-symbols-outlined task-card__latest-comment-icon">chat_bubble</span>
          <span className="line-clamp-1">{task.latestComment}</span>
        </div>
      )}

      {/* ── L5. Footer: 담당자 + Risk ─────────────────────── */}
      <div style={{ ...rowStyle, marginTop: '0.5rem' }}>
        {hasAssignee && (
          <>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: 'var(--brand-glow)',
              border: '1px solid rgba(180,197,255,0.2)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '0.6rem', fontWeight: 700,
              color: 'var(--brand)',
              fontFamily: 'Space Grotesk, sans-serif', flexShrink: 0,
            }}>
              {task.assignee.charAt(0).toUpperCase()}
            </div>
            <span style={{
              fontSize: '0.8rem', fontWeight: 500,
              color: 'var(--text-muted)',
              fontFamily: 'Space Grotesk, sans-serif',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
            }}>
              {task.assignee}
            </span>
          </>
        )}

        {task.riskLevel === 'CRITICAL' && (
          <span
            title="Critical"
            style={{
              width: 5, height: 5, borderRadius: '50%',
              background: 'var(--text-muted)',
              display: 'inline-block', flexShrink: 0,
            }}
          />
        )}
      </div>
    </div>
  );
}
