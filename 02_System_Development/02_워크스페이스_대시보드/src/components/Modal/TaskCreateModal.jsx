// src/components/Modal/TaskCreateModal.jsx
// [#8 Fix] 현재 프로젝트 team_agents 스토어와 연결 — Assignee 목록 동적 렌더링
import { useState } from 'react';
import { useProjectStore } from '../../store/projectStore';

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '🔴 Urgent' },
  { value: 'high',   label: '🟠 High' },
  { value: 'medium', label: '🟡 Medium' },
  { value: 'low',    label: '🔵 Low' },
];

const CATEGORY_OPTIONS = [
  { value: 'QUICK_CHAT', label: '💬 일반 (단순 요청)', tpl: '' },
  { value: 'FEATURE_DEV', label: '✨ 기능 개발', tpl: '### 요구사항\n- \n\n### 제약조건\n- ' },
  { value: 'BUG_FIX', label: '🐛 버그 수정', tpl: '### 버그 증상\n- \n\n### 재현 경로\n- \n\n### 기대 결과\n- ' },
  { value: 'DEEP_WORK', label: '🔍 심층 리서치/기획', tpl: '### 리서치 목표\n- \n\n### 필수 포함 내용\n- ' },
];

export default function TaskCreateModal({ isOpen, onClose }) {
  const [content, setContent] = useState('');
  const [assignee, setAssignee] = useState('CEO');
  const [priority, setPriority] = useState('medium');
  const [category, setCategory] = useState('QUICK_CHAT');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCategoryChange = (e) => {
    const newCat = e.target.value;
    const oldTpl = CATEGORY_OPTIONS.find(c => c.value === category)?.tpl || '';
    const newTpl = CATEGORY_OPTIONS.find(c => c.value === newCat)?.tpl || '';
    
    setCategory(newCat);
    
    if (!content.trim() || content.trim() === oldTpl.trim()) {
      setContent(newTpl);
    }
  };

  // [#8 Fix] 현재 프로젝트의 팀원 목록 → Assignee select 옵션
  const assignedCrew = useProjectStore((s) => s.assignedCrew);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim()) return;
    setIsSubmitting(true);

    try {
      const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4005';
      const res = await fetch(`${SERVER_URL}/webhook/antigravity/command`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'ISSUE_CREATE',
          payload: {
            title:    content.trim(),
            assignee: assignee || 'CEO',
            priority: priority || 'medium',
            category: category || 'QUICK_CHAT',
          },
        }),
      });
      if (res.ok) {
        setContent('');
        setAssignee('CEO');
        setPriority('medium');
        onClose();
      }
    } catch (err) {
      console.error('[Modal] Task create failed:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-label="새 이슈 생성">
      <div className="modal">
        <div className="modal__header">
          <h2 className="modal__title">✍️ 새 업무 지시</h2>
          <button className="modal__close" onClick={onClose} aria-label="닫기">×</button>
        </div>
        <form onSubmit={handleSubmit} className="modal__body">
          <textarea
            className="modal__textarea"
            placeholder="아리에게 지시할 업무 내용을 입력하세요..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={4}
            autoFocus
          />

          {/* [#8 Fix] Assignee + Priority + Category 선택 행 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem', marginTop: '0.75rem' }}>
            {/* 담당자 */}
            <div>
              <label style={{
                display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)',
                fontWeight: 600, marginBottom: '0.3rem',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                담당자
              </label>
              <select
                className="modal-select"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg-surface-3)',
                  color: 'var(--text-primary)', border: '1px solid var(--border)',
                  padding: '0.5rem 0.6rem', borderRadius: '6px',
                  outline: 'none', fontSize: '0.82rem',
                }}
              >
                {/* CEO(나) 항상 최상단 */}
                <option value="CEO">👤 CEO (나)</option>
                {/* [#8 Fix] 현재 프로젝트 크루 목록 */}
                {assignedCrew.map((member) => {
                  const display = member.nickname || member.agent_id || 'Unknown';
                  const roleLabel = member.experiment_role
                    ? member.experiment_role.split(/[.\-–—(]/)[0].trim()
                    : member.agent_id;
                  return (
                    <option key={member.agent_id} value={member.agent_id}>
                      🤖 {display.toUpperCase()}
                      {roleLabel && roleLabel !== display ? ` — ${roleLabel}` : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* 우선순위 */}
            <div>
              <label style={{
                display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)',
                fontWeight: 600, marginBottom: '0.3rem',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                우선순위
              </label>
              <select
                className="modal-select"
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                style={{
                  width: '100%', background: 'var(--bg-surface-3)',
                  color: 'var(--text-primary)', border: '1px solid var(--border)',
                  padding: '0.5rem 0.6rem', borderRadius: '6px',
                  outline: 'none', fontSize: '0.82rem',
                }}
              >
                {PRIORITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            {/* 카테고리 */}
            <div>
              <label style={{
                display: 'block', fontSize: '0.72rem', color: 'var(--text-muted)',
                fontWeight: 600, marginBottom: '0.3rem',
                letterSpacing: '0.05em', textTransform: 'uppercase',
              }}>
                유형
              </label>
              <select
                className="modal-select"
                value={category}
                onChange={handleCategoryChange}
                style={{
                  width: '100%', background: 'var(--bg-surface-3)',
                  color: 'var(--text-primary)', border: '1px solid var(--border)',
                  padding: '0.5rem 0.6rem', borderRadius: '6px',
                  outline: 'none', fontSize: '0.82rem',
                }}
              >
                {CATEGORY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal__actions">
            <button type="button" className="btn btn--ghost" onClick={onClose}>
              취소
            </button>
            <button
              type="submit"
              className="btn btn--primary"
              disabled={!content.trim() || isSubmitting}
            >
              {isSubmitting ? '전송 중...' : '🚀 업무 지시'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
