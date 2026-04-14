// src/components/Modal/TaskDetailModal.jsx — Phase 11 태스크 상세 제어 모달
import { useState, useEffect, useCallback, useRef } from 'react';
import { useUiStore } from '../../store/uiStore';
import { useKanbanStore } from '../../store/kanbanStore';

const STATUS_LABEL = {
  PENDING:    { text: '대기 중',    color: 'var(--text-muted)' },
  in_progress:{ text: '진행 중',   color: 'var(--status-active)' },
  REVIEW:     { text: '승인 대기', color: 'var(--brand)' },
  COMPLETED:  { text: '완료',      color: 'var(--brand)' },
  FAILED:     { text: '실패',      color: 'var(--text-muted)' },
  PAUSED:     { text: '중단됨',    color: 'var(--status-active)' },
};

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

export default function TaskDetailModal() {
  const { activeDetailTaskId, setActiveDetailTaskId, setFocusedTaskId, focusedTaskId } = useUiStore();
  const tasks = useKanbanStore((s) => s.tasks);
  const removeTask = useKanbanStore((s) => s.removeTask);
  const updateTaskStatus = useKanbanStore((s) => s.updateTaskStatus);
  const patchTask = useKanbanStore((s) => s.patchTask);

  const [comments, setComments] = useState([]);
  const [commentText, setCommentText] = useState('');
  const [isLoadingComments, setIsLoadingComments] = useState(false);
  
  // 편집 기능 상태 
  const [isEditing, setIsEditing] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [reworkReason, setReworkReason] = useState('');
  const [showReworkInput, setShowReworkInput] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const textareaRef = useRef(null);
  const moreMenuRef = useRef(null);

  const [displayLang, setDisplayLang] = useState('KOR'); // KOR | ENG
  const [translatedText, setTranslatedText] = useState(null);
  const [isTranslating, setIsTranslating] = useState(false);

  const task = activeDetailTaskId ? (tasks[String(activeDetailTaskId)] || null) : null;
  const isFocused = String(focusedTaskId) === String(activeDetailTaskId);

  // 댓글 로드
  useEffect(() => {
    if (!activeDetailTaskId) return;
    setIsLoadingComments(true);
    fetch(`${SERVER_URL}/api/tasks/${activeDetailTaskId}/comments`)
      .then((r) => r.json())
      .then((data) => setComments(Array.isArray(data.comments) ? data.comments : []))
      .catch(() => setComments([]))
      .finally(() => setIsLoadingComments(false));
  }, [activeDetailTaskId]);

  // 텍스트에어리어 자동 높이 조절
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [commentText]);

  const handleClose = useCallback(() => {
    setActiveDetailTaskId(null);
    setIsConfirmingDelete(false);
    setIsEditing(false);
    setShowReworkInput(false);
    setReworkReason('');
  }, [setActiveDetailTaskId]);

  const handleEditTask = () => {
    setEditTitle(task.title);
    setEditContent(task.content || '');
    setIsEditing(true);
    setShowMoreMenu(false);
  };

  const handleSaveEdit = () => {
    if (!editTitle.trim()) return;
    patchTask(task.id, { title: editTitle.trim(), content: editContent.trim() });
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

  // 댓글 전송 (소켓 경유 → 실시간 브로드캐스트)
  const handleSubmitComment = () => {
    if (!commentText.trim() || !task) return;
    // 소켓으로 서버에 전달 (useSocket의 싱글턴 직접 접근)
    import('../../hooks/useSocket').then(({ useSocket }) => {
      // 소켓 직접 emit — 모달에서 socket ref 인스턴스 사용
    });
    // REST fallback (간단한 구현)
    fetch(`${SERVER_URL}/api/tasks/${task.id}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ author: '대표님', content: commentText.trim() }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.status === 'ok') {
          setComments((prev) => [...prev, { author: '대표님', content: commentText.trim(), created_at: new Date().toISOString() }]);
          setCommentText('');
        }
      })
      .catch(console.error);
  };

  // Kill 실행
  const handleKill = () => {
    fetch(`${SERVER_URL}/api/tasks/${task.id}/kill`, { method: 'POST' })
      .then((r) => r.json())
      .then(() => updateTaskStatus(task.id, 'PAUSED'))
      .catch(console.error);
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

  // [Phase 16] 실시간 번역 로직 추가
  const handleTranslate = async (lang) => {
    setDisplayLang(lang);
    if (lang === 'ENG' && (!translatedText || translatedText.taskId !== task.id)) {
      setIsTranslating(true);
      try {
        const res = await fetch(`${SERVER_URL}/api/system/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            text: task.content || task.title,
            target: 'english',
            taskId: task.id
          }),
        });
        const data = await res.json();
        setTranslatedText({ taskId: task.id, text: data.translated });
      } catch (err) {
        console.error('번역 실패:', err);
      } finally {
        setIsTranslating(false);
      }
    }
  };

  // 태스크 변경 시 번역 캐시 초기화
  useEffect(() => {
    setTranslatedText(null);
    setDisplayLang('KOR');
  }, [activeDetailTaskId]);

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

        {/* 헤더 */}
        <div className="modal__header" style={{ alignItems: 'flex-start', gap: '0.75rem' }}>
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

          {/* 랭귀지 탭 컨트롤 (KOR/ENG) */}
          <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '1.2rem', padding: '0.3rem', background: 'var(--bg-surface-3)', borderRadius: '8px', width: 'fit-content' }}>
            <button 
              onClick={() => handleTranslate('KOR')}
              style={{
                padding: '0.3rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px',
                border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk',
                background: displayLang === 'KOR' ? 'var(--brand)' : 'none',
                color: displayLang === 'KOR' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            >KOR</button>
            <button 
              onClick={() => handleTranslate('ENG')}
              style={{
                padding: '0.3rem 0.8rem', fontSize: '0.75rem', fontWeight: 700, borderRadius: '6px',
                border: 'none', cursor: 'pointer', fontFamily: 'Space Grotesk',
                background: displayLang === 'ENG' ? 'var(--brand)' : 'none',
                color: displayLang === 'ENG' ? '#fff' : 'var(--text-muted)',
                transition: 'all 0.2s'
              }}
            >ENG</button>
          </div>

          {/* 태스크 내용 */}
          {isEditing ? (
            <div style={{ marginBottom: '1.25rem' }}>
              <textarea 
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={5}
                style={{ width: '100%', background: 'var(--bg-surface-3)', color: 'var(--text-primary)', border: '1px solid var(--border)', borderRadius: '6px', padding: '0.8rem', outline: 'none', resize: 'vertical', fontSize: '0.96rem', lineHeight: 1.6 }}
                placeholder="태스크 상세 내용..."
              />
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
                <button className="btn btn--ghost btn--sm" onClick={() => setIsEditing(false)}>취소</button>
                <button className="btn btn--primary btn--sm" onClick={handleSaveEdit}>저장</button>
              </div>
            </div>
          ) : (
            <div className="task-content-area" style={{ position: 'relative', minHeight: '60px' }}>
              {isTranslating ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', color: 'var(--brand)', fontSize: '0.9rem', padding: '1rem 0' }}>
                  <span className="material-symbols-outlined rotating" style={{ fontSize: '1.2rem' }}>sync</span>
                  번역 엔진 구동 중...
                </div>
              ) : (
                <p style={{ fontSize: '0.96rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.25rem', whiteSpace: 'pre-wrap' }}>
                  {displayLang === 'ENG' ? (translatedText?.text || 'Translation not available.') : (task.content || task.title)}
                </p>
              )}
            </div>
          )}

          {/* 메타 정보 */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
            {task.assignee && task.assignee !== '미할당' && (
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>person</span>
                {task.assignee}
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
            <h3 style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk, sans-serif', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '0.75rem' }}>
              Discussion ({comments.length})
            </h3>
            {isLoadingComments ? (
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>댓글 불러오는 중...</p>
            ) : comments.length === 0 ? (
              <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                아직 댓글이 없습니다. 지시사항이나 피드백을 남겨보세요.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                {comments.map((c, i) => (
                  <div key={i} style={{
                    background: 'var(--bg-surface-2)', borderRadius: '10px',
                    padding: '0.7rem 0.9rem', border: '1px solid var(--border)'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--brand)' }}>{c.author}</span>
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
                    </div>
                    <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>{c.content}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 댓글 입력 */}
          <div style={{
            background: 'var(--bg-surface-2)', border: '1px solid var(--border)',
            borderRadius: '12px', padding: '0.65rem', display: 'flex', flexDirection: 'column', gap: '0.5rem'
          }}>
            <textarea
              ref={textareaRef}
              value={commentText}
              onChange={(e) => setCommentText(e.target.value)}
              placeholder="지시사항 또는 피드백을 입력하세요..."
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmitComment(); }}
              style={{
                background: 'none', border: 'none', resize: 'none', outline: 'none',
                color: 'var(--text-primary)', fontSize: '1.15rem', fontFamily: 'inherit',
                lineHeight: 1.5, minHeight: '60px', maxHeight: '140px', padding: '0.2rem 0.3rem'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem' }}>keyboard_command_key</span>
                +Enter 전송
              </span>
              <button
                onClick={handleSubmitComment}
                disabled={!commentText.trim()}
                style={{
                  background: commentText.trim() ? 'var(--brand-dim, #2668ff)' : 'var(--bg-surface-highest, #323459)',
                  color: commentText.trim() ? '#ffffff' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: '8px',
                  padding: '0.4rem 1rem',
                  cursor: commentText.trim() ? 'pointer' : 'default',
                  fontSize: '0.9rem',
                  fontWeight: 700,
                  fontFamily: 'Space Grotesk, sans-serif',
                  transition: 'all 0.18s ease',
                  letterSpacing: '0.02em',
                  boxShadow: commentText.trim() ? '0 2px 8px rgba(38,104,255,0.35)' : 'none',
                }}
                onMouseEnter={(e) => { if (commentText.trim()) e.currentTarget.style.background = '#1a52e8'; }}
                onMouseLeave={(e) => { if (commentText.trim()) e.currentTarget.style.background = 'var(--brand-dim, #2668ff)'; }}
              >
                전송
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
