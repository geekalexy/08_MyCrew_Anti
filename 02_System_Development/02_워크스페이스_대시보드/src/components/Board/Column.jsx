// src/components/Board/Column.jsx — Phase 15: 컬럼 이름 인라인 편집
import { useState, useEffect, useRef } from 'react';
import TaskCard from './TaskCard';
import { useDroppable } from '@dnd-kit/core';
import { useSocket } from '../../hooks/useSocket';
import { useAgentStore } from '../../store/agentStore';

const COLUMN_LABELS = {
  todo:        'To Do',
  in_progress: 'In Progress',
  review:      'Review',
  done:        'Done',
};

const PRIORITY_OPTIONS = ['urgent', 'high', 'medium', 'low'];

export default function Column({ columnId, tasks, disableDnD }) {
  const { setNodeRef, isOver } = useDroppable({ id: columnId });
  const { emitTaskCreate } = useSocket();
  const agentMeta = useAgentStore((s) => s.agentMeta) || {};

  // ── 태스크 생성 폼 상태
  const [isAdding, setIsAdding] = useState(false);
  const [form, setForm] = useState({
    title: '', content: '', assignee: 'CEO', priority: '',
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
    setForm({ title: '', content: '', assignee: 'CEO', priority: '' });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    emitTaskCreate({
      title: form.title.trim(),
      content: '', // content is now empty by default
      assignee: 'CEO',
      priority: '',
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

  const countLabel = tasks.length;

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
          <form 
            className="task-card task-card--focused" 
            onSubmit={handleSubmit}
            style={{ cursor: 'text' }}
          >
            <div className="task-card__meta-row" style={{ marginBottom: '0.35rem' }}>
              <div className="task-card__label" style={{ margin: 0 }}>새로운 작업</div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>person</span>
                CEO
              </div>
            </div>
            
            <input
              ref={titleRef}
              style={{ width: '100%', border: 'none', background: 'transparent', outline: 'none', color: 'var(--text-secondary)', fontSize: '0.95rem', fontWeight: 500 }}
              placeholder="태스크 타이틀 입력 후 Enter..."
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              onBlur={(e) => {
                if (form.title.trim()) handleSubmit(e);
                else cancelForm();
              }}
              onKeyDown={(e) => {
                if (e.key === 'Escape') cancelForm();
              }}
              required
            />
            <button type="submit" style={{ display: 'none' }} />
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
