// src/components/Modal/CategoryPreviewModal.jsx
// Phase 43-6 — Task Master Dry-Run 프리뷰 모달
// 담당: 소넷 (Claude Sonnet 4.6)

import { useState } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4010';

const CATEGORY_ICONS = {
  architecture:  { icon: 'schema',           color: '#b4c5ff', label: '아키텍처' },
  backend:       { icon: 'dns',              color: '#60a5fa', label: '백엔드' },
  frontend:      { icon: 'web',              color: '#34d399', label: '프론트엔드' },
  integration:   { icon: 'cable',            color: '#a78bfa', label: '인테그레이션' },
  security:      { icon: 'security',         color: '#f87171', label: '보안' },
  testing:       { icon: 'fact_check',       color: '#fbbf24', label: '테스팅' },
  devops:        { icon: 'rocket_launch',    color: '#fb923c', label: '데브옵스' },
  data:          { icon: 'storage',          color: '#38bdf8', label: '데이터' },
  documentation: { icon: 'menu_book',        color: '#94a3b8', label: '문서화' },
  refactoring:   { icon: 'cleaning_services', color: '#e879f9', label: '리팩토링' },
};

/**
 * CategoryPreviewModal
 * Task Master의 Dry-Run 분석 결과를 프리뷰 형태로 보여주고 승인/수정/취소를 처리.
 *
 * @param {string}   taskId       - 원본 카드 ID
 * @param {Array}    previewCards - [{ category, title, taskCount, description }]
 * @param {Function} onClose      - 모달 닫기
 * @param {Function} onConfirmed  - 승인 후 childTaskIds 반환
 */
export default function CategoryPreviewModal({ taskId, previewCards: initialCards, onClose, onConfirmed }) {
  const [cards, setCards] = useState(initialCards || []);
  const [isLoading, setIsLoading] = useState(false);
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedbackText, setFeedbackText] = useState('');
  const [reviseCount, setReviseCount] = useState(0);
  const [error, setError] = useState('');

  // 승인 — 실제 카드 생성 요청
  const handleConfirm = async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/tasks/${taskId}/run/confirm`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '카드 생성에 실패했습니다.');
      onConfirmed?.(data.childTaskIds || []);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  // 수정 요청 — Task Master 재분석
  const handleRevise = async () => {
    if (!feedbackText.trim()) return;
    setIsLoading(true);
    setError('');
    try {
      const res = await fetch(`${SERVER_URL}/api/tasks/${taskId}/run/revise`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feedback: feedbackText.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '재분석에 실패했습니다.');
      setCards(data.previewCards || []);
      setFeedbackText('');
      setShowFeedback(false);
      setReviseCount((c) => c + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      {/* 백드롭 */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.65)',
          backdropFilter: 'blur(4px)', zIndex: 2000,
        }}
      />

      {/* 모달 */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 'min(620px, 92vw)',
        background: 'linear-gradient(145deg, #1a1f2e, #141825)',
        border: '1px solid rgba(180,197,255,0.18)',
        borderRadius: '20px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.6), 0 0 0 1px rgba(180,197,255,0.06)',
        zIndex: 2001,
        overflow: 'hidden',
        fontFamily: 'Inter, sans-serif',
      }}>

        {/* 헤더 */}
        <div style={{
          padding: '1.25rem 1.5rem',
          background: 'linear-gradient(135deg, rgba(100,135,242,0.12), rgba(74,222,128,0.06))',
          borderBottom: '1px solid rgba(180,197,255,0.1)',
          display: 'flex', alignItems: 'center', gap: '0.75rem',
        }}>
          <span className="material-symbols-outlined" style={{ fontSize: '1.3rem', color: '#b4c5ff' }}>
            account_tree
          </span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '0.95rem', fontWeight: 700, color: '#e2e8f0' }}>
              Task Master 분기 분석 완료
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
              아래 카드를 생성하기 전에 검토해주세요
              {reviseCount > 0 && (
                <span style={{ marginLeft: '0.5rem', color: '#fbbf24' }}>
                  · 수정 {reviseCount}회
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', padding: '4px',
              borderRadius: '6px', display: 'flex', alignItems: 'center',
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = '#e2e8f0'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
          </button>
        </div>

        {/* 카드 목록 */}
        <div style={{ padding: '1.25rem 1.5rem', maxHeight: '55vh', overflowY: 'auto' }}>
          <div style={{
            fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-muted)',
            letterSpacing: '0.1em', textTransform: 'uppercase', marginBottom: '0.75rem',
          }}>
            생성 예정 카드 ({cards.length}장)
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
            {cards.map((card, i) => {
              const meta = CATEGORY_ICONS[card.category?.toLowerCase()] || {
                icon: 'task_alt', color: '#94a3b8', label: card.category,
              };
              return (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: `1px solid rgba(${hexToRgb(meta.color)},0.2)`,
                  borderRadius: '12px',
                  padding: '0.85rem 1rem',
                  display: 'flex', alignItems: 'flex-start', gap: '0.8rem',
                  transition: 'background 0.2s',
                }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                >
                  {/* 카테고리 아이콘 */}
                  <div style={{
                    width: '34px', height: '34px', flexShrink: 0,
                    borderRadius: '8px',
                    background: `rgba(${hexToRgb(meta.color)},0.12)`,
                    border: `1px solid rgba(${hexToRgb(meta.color)},0.25)`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: meta.color }}>
                      {meta.icon}
                    </span>
                  </div>

                  {/* 내용 */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem' }}>
                      <span style={{
                        fontSize: '0.67rem', fontWeight: 700, color: meta.color,
                        background: `rgba(${hexToRgb(meta.color)},0.12)`,
                        padding: '1px 7px', borderRadius: '10px', letterSpacing: '0.05em',
                        textTransform: 'uppercase',
                      }}>
                        {meta.label}
                      </span>
                      {card.taskCount !== undefined && (
                        <span style={{ fontSize: '0.67rem', color: 'var(--text-muted)' }}>
                          태스크 {card.taskCount}개
                        </span>
                      )}
                    </div>
                    <div style={{
                      fontSize: '0.82rem', fontWeight: 600, color: '#d1d5db',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>
                      {card.title}
                    </div>
                    {card.description && (
                      <div style={{
                        fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px',
                        display: '-webkit-box', WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical', overflow: 'hidden',
                      }}>
                        {card.description}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 피드백 입력창 */}
        {showFeedback && (
          <div style={{
            padding: '0 1.5rem 1rem',
            borderTop: '1px solid rgba(255,255,255,0.06)',
            paddingTop: '1rem',
          }}>
            {reviseCount >= 5 && (
              <div style={{
                fontSize: '0.72rem', color: '#fbbf24',
                background: 'rgba(251,191,36,0.08)',
                border: '1px solid rgba(251,191,36,0.2)',
                borderRadius: '8px', padding: '0.5rem 0.75rem',
                marginBottom: '0.65rem',
              }}>
                ⚠️ 수정 횟수가 {reviseCount}회입니다. 계속 진행하시겠습니까?
              </div>
            )}
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              placeholder='예: "Backend 카드를 인증/비즈니스 로직으로 나눠줘" 또는 "Security 카드는 제거해줘"'
              rows={3}
              style={{
                width: '100%', background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(180,197,255,0.2)', borderRadius: '10px',
                color: '#e2e8f0', fontSize: '0.82rem', padding: '0.65rem 0.85rem',
                resize: 'vertical', outline: 'none', boxSizing: 'border-box',
                fontFamily: 'Inter, sans-serif', lineHeight: 1.6,
              }}
              onFocus={(e) => e.target.style.borderColor = 'rgba(180,197,255,0.45)'}
              onBlur={(e) => e.target.style.borderColor = 'rgba(180,197,255,0.2)'}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleRevise();
              }}
            />
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', justifyContent: 'flex-end' }}>
              <button
                onClick={() => { setShowFeedback(false); setFeedbackText(''); }}
                style={btnStyle('ghost')}
              >
                취소
              </button>
              <button
                onClick={handleRevise}
                disabled={!feedbackText.trim() || isLoading}
                style={btnStyle('primary', !feedbackText.trim() || isLoading)}
              >
                {isLoading ? '재분석 중...' : '재분석 요청 ⌘↵'}
              </button>
            </div>
          </div>
        )}

        {/* 에러 */}
        {error && (
          <div style={{
            margin: '0 1.5rem',
            padding: '0.6rem 0.85rem',
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.3)',
            borderRadius: '8px', fontSize: '0.78rem', color: '#f87171',
          }}>
            ❌ {error}
          </div>
        )}

        {/* 액션 버튼 */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', gap: '0.65rem', justifyContent: 'flex-end', alignItems: 'center',
        }}>
          {!showFeedback && (
            <button
              onClick={onClose}
              style={btnStyle('danger')}
              disabled={isLoading}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>close</span>
              취소
            </button>
          )}
          {!showFeedback && (
            <button
              onClick={() => setShowFeedback(true)}
              style={btnStyle('ghost')}
              disabled={isLoading}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>edit</span>
              수정
            </button>
          )}
          {!showFeedback && (
            <button
              onClick={handleConfirm}
              disabled={isLoading || cards.length === 0}
              style={btnStyle('confirm', isLoading || cards.length === 0)}
            >
              {isLoading ? (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', animation: 'spin 1s linear infinite' }}>progress_activity</span>
                  처리 중...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>check_circle</span>
                  승인하고 실행 ({cards.length}장 생성)
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </>
  );
}

// ── 유틸리티 ──────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result
    ? `${parseInt(result[1], 16)},${parseInt(result[2], 16)},${parseInt(result[3], 16)}`
    : '255,255,255';
}

function btnStyle(variant, disabled = false) {
  const base = {
    display: 'flex', alignItems: 'center', gap: '0.35rem',
    padding: '0.5rem 1rem', borderRadius: '9px',
    fontSize: '0.82rem', fontWeight: 600, cursor: disabled ? 'not-allowed' : 'pointer',
    border: 'none', transition: 'all 0.2s', fontFamily: 'Inter, sans-serif',
    opacity: disabled ? 0.5 : 1,
  };
  if (variant === 'confirm') return { ...base,
    background: 'linear-gradient(135deg, #4ade80, #22c55e)',
    color: '#0a1628',
    boxShadow: disabled ? 'none' : '0 4px 14px rgba(74,222,128,0.3)',
  };
  if (variant === 'danger') return { ...base,
    background: 'rgba(248,113,113,0.12)',
    border: '1px solid rgba(248,113,113,0.25)',
    color: '#f87171',
  };
  if (variant === 'primary') return { ...base,
    background: 'linear-gradient(135deg, #6487f2, #818cf8)',
    color: '#fff',
  };
  return { ...base,
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.1)',
    color: '#94a3b8',
  };
}
