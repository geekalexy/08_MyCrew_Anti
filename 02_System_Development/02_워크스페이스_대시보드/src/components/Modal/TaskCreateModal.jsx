import { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../hooks/useSocket';
import { useAgentStore } from '../../store/agentStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4005';
const ALLOWED    = '.png,.jpg,.jpeg,.gif,.webp,.pdf,.txt,.csv,.md,.json';

const PRIORITY_OPTIONS = [
  { value: 'urgent', label: '🔴 긴급', color: '#ef4444' },
  { value: 'high',   label: '🟠 높음', color: '#f97316' },
  { value: 'medium', label: '🟡 보통', color: '#eab308' },
  { value: 'low',    label: '🔵 낮음', color: '#3b82f6' },
];

const COLUMN_OPTIONS = [
  { value: 'todo',        label: 'To Do' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review',      label: 'Review' },
];

export default function TaskCreateModal({ isOpen, onClose, initialColumn = 'todo', initialForm = {} }) {
  const { emitTaskCreate } = useSocket();
  const agentMeta = useAgentStore((s) => s.agentMeta) || {};

  const [form, setForm] = useState({
    title:    '',
    content:  '',
    column:   initialColumn,
    priority: 'medium',
    assignee: '미할당',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading,  setIsUploading]  = useState(false);
  const fileInputRef = useRef(null);
  const tempId       = useRef(`temp_${Date.now()}`);
  const titleRef     = useRef(null);

  // initialForm에서 값 인계 (인라인 폼 → 모달 전환 시)
  useEffect(() => {
    if (isOpen) {
      setForm({
        title:    initialForm.title    || '',
        content:  initialForm.content  || '',
        column:   initialForm.column   || initialColumn,
        priority: initialForm.priority || 'medium',
        assignee: initialForm.assignee || '미할당',
      });
      tempId.current = `temp_${Date.now()}`;
      setTimeout(() => titleRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // ESC 닫기
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const set = (field, val) => setForm(prev => ({ ...prev, [field]: val }));

  // 파일 첨부
  const handleAttach = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setIsUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res  = await fetch(`${SERVER_URL}/api/input/${tempId.current}`, { method: 'POST', body: fd });
      const data = await res.json();
      if (data.success) {
        const tag = `[첨부: ${data.filePath}]`;
        set('content', form.content ? `${form.content}\n${tag}` : tag);
      } else alert(data.message || '업로드 실패');
    } catch (err) {
      console.error('[TaskCreateModal] 첨부 오류:', err.message);
    } finally {
      setIsUploading(false);
    }
  };

  // 제출
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      emitTaskCreate({
        title:    form.title.trim(),
        content:  form.content.trim(),
        assignee: form.assignee,
        priority: form.priority,
        column:   form.column,
      });
      onClose();
    } catch (err) {
      console.error('[TaskCreateModal] 생성 오류:', err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const labelStyle = {
    fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
    fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase',
    letterSpacing: '0.07em', marginBottom: '0.35rem', display: 'block',
  };
  const inputBase = {
    width: '100%', background: 'var(--bg-surface-1)',
    border: '1px solid var(--border)', borderRadius: '8px',
    color: 'var(--text-primary)', outline: 'none',
    fontFamily: 'inherit', boxSizing: 'border-box',
    transition: 'border-color 0.15s',
  };

  const assigneeOptions = [
    { value: '미할당',     label: '미할당' },
    { value: 'CEO(나)',    label: '👤 CEO (나)' },
    ...Object.values(agentMeta).map(m => ({ value: m.name, label: m.name })),
  ];

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '1rem',
      }}
    >
      <div style={{
        background: 'var(--bg-surface-0, #1a1a2e)',
        border: '1px solid var(--border)',
        borderRadius: '16px',
        width: '100%', maxWidth: '560px',
        boxShadow: '0 24px 60px rgba(0,0,0,0.5)',
        display: 'flex', flexDirection: 'column',
        maxHeight: '90vh', overflow: 'hidden',
      }}>
        {/* 헤더 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '1.1rem 1.4rem 0.9rem',
          borderBottom: '1px solid var(--border)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem', color: 'var(--brand)' }}>add_task</span>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, fontFamily: 'Space Grotesk, sans-serif', color: 'var(--text-primary)' }}>
              새 태스크 만들기
            </h2>
          </div>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '1.2rem', lineHeight: 1,
            padding: '0.2rem 0.4rem', borderRadius: '6px',
            transition: 'color 0.15s',
          }}>×</button>
        </div>

        {/* 바디 */}
        <form onSubmit={handleSubmit} style={{
          padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column',
          gap: '1rem', overflowY: 'auto',
        }}>

          {/* 제목 */}
          <div>
            <label style={labelStyle}>제목 *</label>
            <input
              ref={titleRef}
              value={form.title}
              onChange={(e) => set('title', e.target.value)}
              placeholder="태스크 제목을 입력하세요"
              required
              style={{ ...inputBase, padding: '0.6rem 0.9rem', fontSize: '1rem' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--brand)'}
              onBlur={(e)  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* 내용 */}
          <div>
            <label style={labelStyle}>내용 / 지시사항</label>
            <textarea
              value={form.content}
              onChange={(e) => set('content', e.target.value)}
              placeholder="에이전트에게 전달할 상세 내용을 입력하세요..."
              rows={4}
              style={{ ...inputBase, padding: '0.7rem 0.9rem', fontSize: '0.92rem', resize: 'vertical', lineHeight: 1.6, minHeight: '90px' }}
              onFocus={(e) => e.target.style.borderColor = 'var(--brand)'}
              onBlur={(e)  => e.target.style.borderColor = 'var(--border)'}
            />
          </div>

          {/* 상태 · 우선순위 · 담당자 — 3열 그리드 */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
            {/* 상태 */}
            <div>
              <label style={labelStyle}>상태</label>
              <select
                value={form.column}
                onChange={(e) => set('column', e.target.value)}
                style={{ ...inputBase, padding: '0.5rem 0.7rem', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {COLUMN_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* 우선순위 */}
            <div>
              <label style={labelStyle}>우선순위</label>
              <select
                value={form.priority}
                onChange={(e) => set('priority', e.target.value)}
                style={{ ...inputBase, padding: '0.5rem 0.7rem', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {PRIORITY_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>

            {/* 담당자 */}
            <div>
              <label style={labelStyle}>담당자</label>
              <select
                value={form.assignee}
                onChange={(e) => set('assignee', e.target.value)}
                style={{ ...inputBase, padding: '0.5rem 0.7rem', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                {assigneeOptions.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 푸터: 첨부 + 취소/생성 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '0.3rem' }}>
            {/* 첨부 버튼 */}
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ALLOWED}
                style={{ display: 'none' }}
                onChange={handleAttach}
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: '7px', padding: '0.35rem 0.7rem',
                  cursor: isUploading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '0.3rem',
                  color: 'var(--text-muted)', fontSize: '0.8rem',
                  opacity: isUploading ? 0.6 : 1,
                  transition: 'all 0.15s',
                }}
                onMouseEnter={(e) => { if (!isUploading) { e.currentTarget.style.color = 'var(--brand)'; e.currentTarget.style.borderColor = 'var(--brand)'; }}}
                onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', animation: isUploading ? 'spin 1s linear infinite' : 'none' }}>
                  {isUploading ? 'sync' : 'attach_file'}
                </span>
                {isUploading ? '업로드 중...' : '파일 첨부'}
              </button>
            </div>

            {/* 액션 버튼 */}
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={onClose}
                style={{
                  background: 'none', border: '1px solid var(--border)',
                  borderRadius: '8px', padding: '0.45rem 1rem',
                  color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.88rem',
                  transition: 'all 0.15s',
                }}
              >취소</button>
              <button
                type="submit"
                disabled={!form.title.trim() || isSubmitting}
                style={{
                  background: form.title.trim() ? 'var(--brand-dim, #2668ff)' : 'var(--bg-surface-1)',
                  border: 'none', borderRadius: '8px', padding: '0.45rem 1.2rem',
                  color: form.title.trim() ? '#fff' : 'var(--text-muted)',
                  cursor: form.title.trim() ? 'pointer' : 'not-allowed',
                  fontSize: '0.88rem', fontWeight: 700,
                  fontFamily: 'Space Grotesk, sans-serif',
                  transition: 'all 0.18s',
                  boxShadow: form.title.trim() ? '0 2px 8px rgba(38,104,255,0.35)' : 'none',
                }}
              >
                {isSubmitting ? '생성 중...' : '✅ 태스크 생성'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
