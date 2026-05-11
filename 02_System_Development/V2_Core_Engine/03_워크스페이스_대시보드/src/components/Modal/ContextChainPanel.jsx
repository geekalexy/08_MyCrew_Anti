/**
 * ContextChainPanel.jsx — [Phase 37] 컨텍스트 체이닝 우측 패널
 *
 * - 체인에 속한 모든 컨텍스트를 개별 카드로 렌더링
 * - 접기/펼치기 (expand/collapse)
 * - 중첩 [#ID] 클릭 시 navigateTo 호출
 * - 순환참조/에러 시 붉은 배너 표시
 */

import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const TYPE_LABEL = {
  comment: '💬 코멘트',
  task:    '📋 태스크',
};

// 체인 아이템 내 [#ID] 패턴 감지
const NESTED_REF_REGEX = /\[(#\d+(?:C\d+)?)\]/g;

function NestedRefChip({ refId, onNavigate }) {
  return (
    <button
      onClick={() => onNavigate(refId)}
      title={`${refId} 체인 탐색`}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '3px',
        background: 'rgba(100,135,242,0.15)',
        border: '1px solid rgba(100,135,242,0.35)',
        borderRadius: '5px',
        padding: '1px 7px',
        color: 'var(--brand)',
        fontSize: '0.78rem',
        fontWeight: 700,
        cursor: 'pointer',
        fontFamily: 'Space Grotesk, sans-serif',
        letterSpacing: '0.03em',
        transition: 'all 0.15s',
        verticalAlign: 'middle',
        margin: '0 2px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(100,135,242,0.28)';
        e.currentTarget.style.borderColor = 'rgba(100,135,242,0.6)';
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(100,135,242,0.15)';
        e.currentTarget.style.borderColor = 'rgba(100,135,242,0.35)';
      }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>link</span>
      {refId}
    </button>
  );
}

/**
 * 텍스트 내 [#ID] 패턴을 NestedRefChip으로 치환하여 React 노드 배열 반환
 */
function renderWithNestedRefs(text, onNavigate) {
  if (!text || !onNavigate) return text;
  const regex = new RegExp(NESTED_REF_REGEX.source, 'g');
  const parts = [];
  let lastIndex = 0;
  let match;
  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <NestedRefChip
        key={`nested-${match.index}`}
        refId={match[1]}
        onNavigate={onNavigate}
      />
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts.length > 0 ? parts : text;
}

function ChainItemCard({ item, index, isLast, onNavigate }) {
  const [isExpanded, setIsExpanded] = useState(false);

  const previewText = (item.summary || item.content || '').slice(0, 150);
  const hasMore = (item.content || '').length > 150;

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      gap: '0.65rem',
    }}>
      {/* 타임라인 라인 */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: isLast
            ? 'linear-gradient(135deg, rgba(100,135,242,0.5), rgba(74,222,128,0.3))'
            : 'rgba(180,197,255,0.1)',
          border: `2px solid ${isLast ? 'rgba(100,135,242,0.6)' : 'rgba(180,197,255,0.2)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 800,
            color: isLast ? '#b4c5ff' : 'var(--text-muted)',
            fontFamily: 'Space Grotesk, sans-serif',
          }}>
            {index + 1}
          </span>
        </div>
        {!isLast && (
          <div style={{
            flex: 1, width: '2px', marginTop: '4px',
            background: 'linear-gradient(to bottom, rgba(180,197,255,0.2), rgba(180,197,255,0.05))',
            minHeight: '16px',
          }} />
        )}
      </div>

      {/* 카드 본문 */}
      <div style={{
        flex: 1, minWidth: 0,
        background: isLast
          ? 'linear-gradient(135deg, rgba(100,135,242,0.06), rgba(74,222,128,0.03))'
          : 'rgba(255,255,255,0.03)',
        border: `1px solid ${isLast ? 'rgba(100,135,242,0.25)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius: '10px',
        padding: '0.65rem 0.75rem',
        marginBottom: '0.5rem',
        transition: 'border-color 0.2s',
      }}>
        {/* 카드 헤더 */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          marginBottom: '0.4rem',
        }}>
          <span style={{
            fontSize: '0.65rem', fontWeight: 700,
            background: isLast ? 'rgba(100,135,242,0.2)' : 'rgba(255,255,255,0.07)',
            border: `1px solid ${isLast ? 'rgba(100,135,242,0.3)' : 'rgba(255,255,255,0.1)'}`,
            borderRadius: '4px', padding: '1px 6px',
            color: isLast ? '#b4c5ff' : 'var(--text-muted)',
            fontFamily: 'Space Grotesk, sans-serif',
            letterSpacing: '0.06em',
          }}>
            {item.id}
          </span>
          <span style={{
            fontSize: '0.68rem', color: 'var(--text-muted)',
          }}>
            {TYPE_LABEL[item.type] || item.type}
          </span>
          {item.card_title && (
            <span style={{
              fontSize: '0.72rem', color: 'var(--text-secondary)',
              fontWeight: 600, flex: 1, overflow: 'hidden',
              textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {item.card_title}
            </span>
          )}
          {isLast && (
            <span style={{
              fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em',
              color: '#4ade80', fontFamily: 'Space Grotesk, sans-serif',
              background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.25)',
              borderRadius: '4px', padding: '1px 5px', flexShrink: 0,
            }}>
              최신
            </span>
          )}
        </div>

        {/* 내용 (접기/펼치기) */}
        <div style={{
          fontSize: '0.82rem',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
          wordBreak: 'break-word',
        }}>
          {isExpanded ? (
            <div>
              <ReactMarkdown
                className="notion-md"
                remarkPlugins={[remarkGfm]}
                components={{
                  p: ({ children }) => {
                    const processText = (child) => {
                      if (typeof child !== 'string') return child;
                      return renderWithNestedRefs(child, onNavigate);
                    };
                    const processed = Array.isArray(children)
                      ? children.flatMap(processText)
                      : processText(children);
                    return <p style={{ margin: '0.2rem 0' }}>{processed}</p>;
                  },
                }}
              >
                {item.content || ''}
              </ReactMarkdown>
            </div>
          ) : (
            <p style={{ margin: 0 }}>
              {renderWithNestedRefs(previewText, onNavigate)}
              {hasMore && <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem' }}>...</span>}
            </p>
          )}
        </div>

        {/* 펼치기/닫기 버튼 */}
        {hasMore && (
          <button
            onClick={() => setIsExpanded(v => !v)}
            style={{
              marginTop: '0.45rem',
              background: 'none', border: 'none',
              color: 'var(--brand)', fontSize: '0.72rem',
              fontWeight: 700, cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: '3px',
              padding: '2px 0',
              fontFamily: 'Space Grotesk, sans-serif',
              letterSpacing: '0.03em',
              opacity: 0.85,
              transition: 'opacity 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = 1}
            onMouseLeave={e => e.currentTarget.style.opacity = 0.85}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>
              {isExpanded ? 'expand_less' : 'expand_more'}
            </span>
            {isExpanded ? '접기' : `전체 보기 (${item.content?.length || 0}자)`}
          </button>
        )}
      </div>
    </div>
  );
}

export default function ContextChainPanel({
  activeRef,
  chainData,
  isLoading,
  canGoBack,
  onNavigate,
  onBack,
  onClose,
}) {
  if (!activeRef) return null;

  const chain = chainData?.chain || [];
  const error = chainData?.error || null;

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100%', overflow: 'hidden',
    }}>
      {/* 패널 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.5rem',
        padding: '0.55rem 0.85rem',
        background: 'var(--bg-surface-2)',
        borderBottom: '1px solid var(--border)',
        flexShrink: 0,
      }}>
        {/* 뒤로가기 */}
        {canGoBack && (
          <button
            id="btn-chain-back"
            onClick={onBack}
            title="이전 체인으로"
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
              gap: '3px', padding: '3px 6px', borderRadius: '6px',
              fontSize: '0.75rem', fontWeight: 700,
              fontFamily: 'Space Grotesk, sans-serif',
              transition: 'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>arrow_back</span>
            뒤로
          </button>
        )}

        {/* 헤더 아이콘 */}
        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color: 'var(--brand)', opacity: 0.85 }}>
          account_tree
        </span>

        {/* 제목 */}
        <span style={{
          fontSize: '0.72rem', fontWeight: 700,
          color: 'var(--text-secondary)',
          fontFamily: 'Space Grotesk, sans-serif',
          letterSpacing: '0.06em',
          textTransform: 'uppercase',
          flex: 1,
        }}>
          컨텍스트 체인 —&nbsp;
          <span style={{ color: 'var(--brand)', textTransform: 'none' }}>{activeRef}</span>
        </span>

        {/* 체인 길이 뱃지 */}
        {chain.length > 0 && (
          <span style={{
            fontSize: '0.62rem', fontWeight: 700,
            background: 'rgba(100,135,242,0.15)',
            border: '1px solid rgba(100,135,242,0.3)',
            borderRadius: '10px', padding: '1px 7px',
            color: 'var(--brand)',
            fontFamily: 'Space Grotesk, sans-serif',
          }}>
            {chain.length}개
          </span>
        )}

        {/* 닫기 */}
        <button
          id="btn-chain-close"
          onClick={onClose}
          title="체인 패널 닫기"
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
            padding: '4px', borderRadius: '6px', transition: 'all 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.07)'}
          onMouseLeave={e => e.currentTarget.style.background = 'none'}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>close</span>
        </button>
      </div>

      {/* 패널 바디 */}
      <div style={{
        flex: 1, overflowY: 'auto',
        padding: '0.85rem 0.9rem',
      }}>

        {/* 에러 배너 */}
        {error && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'rgba(255,82,82,0.08)',
            border: '1px solid rgba(255,82,82,0.3)',
            borderRadius: '8px', padding: '0.6rem 0.85rem',
            marginBottom: '0.75rem',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: '#ff5449', flexShrink: 0 }}>
              error
            </span>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#ff5449' }}>
                유효하지 않은 참조
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                {error}
              </div>
            </div>
          </div>
        )}

        {/* 로딩 */}
        {isLoading && !chainData && (
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', gap: '0.6rem',
            padding: '2.5rem 1rem', color: 'var(--text-muted)',
          }}>
            <span className="material-symbols-outlined" style={{
              fontSize: '2rem', opacity: 0.4,
              animation: 'spin 1.2s linear infinite',
            }}>
              sync
            </span>
            <span style={{ fontSize: '0.8rem' }}>체인 불러오는 중...</span>
          </div>
        )}

        {/* 빈 체인 */}
        {!isLoading && !error && chain.length === 0 && (
          <div style={{
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            gap: '0.5rem', padding: '2.5rem 1rem',
            color: 'var(--text-muted)', textAlign: 'center',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '2rem', opacity: 0.3 }}>
              link_off
            </span>
            <div style={{ fontSize: '0.8rem' }}>체인에 연결된 항목이 없습니다.</div>
          </div>
        )}

        {/* 체인 아이템 목록 */}
        {chain.length > 0 && (
          <div>
            {/* 체인 설명 */}
            <div style={{
              fontSize: '0.72rem', color: 'var(--text-muted)',
              marginBottom: '0.75rem',
              display: 'flex', alignItems: 'center', gap: '0.3rem',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>info</span>
              상속된 컨텍스트 체인 — 오래된 것부터 최신 순
            </div>

            {chain.map((item, index) => (
              <ChainItemCard
                key={item.id || index}
                item={item}
                index={index}
                isLast={index === chain.length - 1}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
