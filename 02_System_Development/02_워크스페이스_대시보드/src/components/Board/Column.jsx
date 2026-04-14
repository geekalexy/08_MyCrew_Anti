// src/components/Board/Column.jsx — Phase 15: 컬럼 이름 인라인 편집
import { useState, useEffect, useRef } from 'react';
import TaskCard from './TaskCard';
import { useDroppable } from '@dnd-kit/core';
import { useSocket } from '../../hooks/useSocket';

const COLUMN_LABELS = {
  todo:        'To Do',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
};

const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low'];
const ASSIGNEE_OPTIONS = ['ari', 'sonnet', 'opus', 'luca', '미할당'];

export default function Column({ columnId, tasks, disableDnD }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const { emitTaskCreate } = useSocket();

  // ── 태스크 생성 폼 상태
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    title: '', content: '', assignee: '미할당', priority: 'medium',
  });
  const titleRef = useRef(null);

  // ── 컬럼 이름 편집 상태
  const defaultLabel = COLUMN_LABELS[columnId] || columnId;
  const [columnLabel, setColumnLabel] = useState(defaultLabel);
  const [isEditingLabel, setIsEditingLabel] = useState(false);
  const [editingValue, setEditingValue] = useState(columnLabel);
  const labelInputRef = useRef(null);

  useEffect(() => {
    if (isAdding) titleRef.current?.focus();
  }, [isAdding]);

  useEffect(() => {
    if (isEditingLabel) labelInputRef.current?.focus();
  }, [isEditingLabel]);

  useEffect(() => {
    if (!isAdding) return;
    const onKey = (e) => { if (e.key === 'Escape') cancelForm(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isAdding]);

  // 편집 모드 ESC 처리
  useEffect(() => {
    if (!isEditingLabel) return;
    const onKey = (e) => {
      if (e.key === 'Escape') { setIsEditingLabel(false); setEditingValue(columnLabel); }
      if (e.key === 'Enter') handleSaveLabel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isEditingLabel, editingValue, columnLabel]);

  const cancelForm = () => {
    setIsAdding(false);
    setForm({ title: '', content: '', assignee: '미할당', priority: 'medium' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    emitTaskCreate({
      title: form.title.trim(),
      content: form.content.trim(),
      assignee: form.assignee,
      priority: form.priority,
      column: columnId,
    });
    cancelForm();
  };

  // 더보기 → 편집 모드 시작
  const handleMoreClick = () => {
    setEditingValue(columnLabel);
    setIsEditingLabel(true);
  };

  // 저장
  const handleSaveLabel = () => {
    const trimmed = editingValue.trim();
    if (trimmed) setColumnLabel(trimmed);
    setIsEditingLabel(false);
  };

  const countLabel = String(tasks.length).padStart(2, '0');

  return (
    <div
      ref={setNodeRef}
      className={`column${isOver && !disableDnD ? ' column--over' : ''}`}
    >
      {/* ── 컬럼 헤더 ────────────────────────────────── */}
      <div className="column__header">
        <div className="column__header-left" style={{ flex: 1, minWidth: 0 }}>
          {isEditingLabel ? (
            /* 편집 모드: 제목이 input으로 변환 */
            <input
              ref={labelInputRef}
              value={editingValue}
              onChange={(e) => setEditingValue(e.target.value)}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--brand)',
                outline: 'none',
                color: 'var(--text-primary)',
                fontSize: '0.78rem',
                fontWeight: 700,
                fontFamily: 'Space Grotesk, sans-serif',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                width: '100%',
                padding: '0 0 2px 0',
              }}
            />
          ) : (
            <h3 className="column__title">{columnLabel}</h3>
          )}
          <span className="column__count">{countLabel}</span>
        </div>

        {/* 더보기 ↔ 저장 토글 버튼 */}
        {isEditingLabel ? (
          <button
            className="column__more"
            title="저장"
            aria-label="컬럼 이름 저장"
            onClick={handleSaveLabel}
            style={{ color: 'var(--brand)', fontSize: '0.72rem', letterSpacing: '0.04em' }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>check</span>
          </button>
        ) : (
          <button
            className="column__more"
            title="컬럼 이름 편집"
            aria-label="컬럼 옵션"
            onClick={handleMoreClick}
          >
            ···
          </button>
        )}
      </div>

      {/* ── 카드 목록 ─────────────────────────────── */}
      <div className="column__cards">
        {tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}

        {isAdding && (
          <form className="inline-task-form" onSubmit={handleSubmit}>
            <input
              ref={titleRef}
              className="inline-task-form__input"
              placeholder="태스크 타이틀 *"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              required
            />
            <textarea
              className="inline-task-form__textarea"
              placeholder="상세 내용 (선택)"
              rows={2}
              value={form.content}
              onChange={(e) => setForm({ ...form, content: e.target.value })}
            />
            <div className="inline-task-form__row">
              <select
                className="inline-task-form__select"
                value={form.assignee}
                onChange={(e) => setForm({ ...form, assignee: e.target.value })}
              >
                {ASSIGNEE_OPTIONS.map((a) => (
                  <option key={a} value={a}>{a}</option>
                ))}
              </select>
              <select
                className="inline-task-form__select"
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value })}
              >
                {PRIORITY_OPTIONS.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="inline-task-form__actions">
              <button type="submit" className="btn btn--primary btn--sm">추가</button>
              <button type="button" className="btn btn--ghost btn--sm" onClick={cancelForm}>취소</button>
            </div>
          </form>
        )}
      </div>

      {!isAdding && columnId === 'todo' && (
        <button
          className="column__add-btn"
          onClick={() => setIsAdding(true)}
        >
          <span className="add-icon material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add</span>
          만들기
        </button>
      )}
    </div>
  );
}
