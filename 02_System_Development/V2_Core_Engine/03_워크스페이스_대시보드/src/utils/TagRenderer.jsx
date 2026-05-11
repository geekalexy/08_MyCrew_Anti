/**
 * [Phase 36b / Phase 37] TagRenderer.jsx — 인라인 태그 렌더링 유틸
 *
 * [Phase 36b] #NCN / #NF N 카드링크 → 언더라인+파란 span
 * [Phase 37]  [#ID], [#NCN] 컨텍스트 체인 참조 → 클릭 가능한 버튼 칩
 *             - API 검증 완료: 보라색 칩 (유효한 체인)
 *             - API 오류:      붉은 칩  (유효하지 않은 참조)
 *             - 검증 대기:     회색 칩  (debounce 중)
 *
 * 사용법:
 *   import { renderTaggedText, renderChainRefText } from '../utils/TagRenderer';
 */

import React from 'react';

// ── [Phase 36b] 기존 카드링크 정규식 (#NCN / #NFN) ──────────────────────────
const TAG_REGEX = /#(\d+)(C|F)(\d+)/g;

/**
 * 텍스트 내의 카드링크 태그를 언더라인+블루 span으로 변환 (Phase 36b)
 * @param {string} text
 * @param {function} onTagClick - (cardNum, type, idx) => void
 * @returns {Array<React.ReactNode>}
 */
export function renderTaggedText(text, onTagClick) {
  if (!text) return [text];

  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(TAG_REGEX.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const [fullTag, cardNumStr, type, idxStr] = match;
    const cardNum = parseInt(cardNumStr, 10);
    const idx = parseInt(idxStr, 10);
    const typeLabel = type === 'C' ? '코멘트' : '파일';
    parts.push(
      <span
        key={`tag-${match.index}`}
        style={{
          color: '#3b82f6',
          textDecoration: 'underline',
          cursor: onTagClick ? 'pointer' : 'default',
          fontWeight: 500,
        }}
        title={`카드 #${cardNum} ${typeLabel} ${idx}번 참조`}
        onClick={onTagClick ? (e) => { e.stopPropagation(); onTagClick(cardNum, type, idx); } : undefined}
      >
        {fullTag}
      </span>
    );
    lastIndex = match.index + fullTag.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

// ── [Phase 37] 컨텍스트 체인 [#ID] 정규식 ─────────────────────────────────
const CHAIN_REF_REGEX = /\[(#\d+(?:C\d+)?)\]/g;

/**
 * [Phase 37] 텍스트 내 [#ID] 참조를 클릭 가능한 버튼 칩으로 변환
 *
 * @param {string}   text        - 렌더링할 텍스트
 * @param {object}   chainCache  - { "#5C6": { chain, error } } 형태 캐시
 * @param {function} onChipClick - (refId: string) => void  클릭 시 패널 열기
 * @returns {Array<React.ReactNode>}
 */
export function renderChainRefText(text, chainCache = {}, onChipClick) {
  if (!text) return [text];

  const parts = [];
  let lastIndex = 0;
  let match;
  const regex = new RegExp(CHAIN_REF_REGEX.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const fullMatch = match[0]; // "[#5C6]"
    const refId     = match[1]; // "#5C6"
    const cached    = chainCache[refId];
    const isValid   = cached && !cached.error;
    const isError   = cached && cached.error;
    const isPending = !cached;

    parts.push(
      <button
        key={`chain-${match.index}`}
        id={`chain-ref-${refId.replace('#', '').replace(/\D/g, '')}-${match.index}`}
        onClick={(e) => {
          e.stopPropagation();
          if (onChipClick) onChipClick(refId);
        }}
        title={
          isError   ? `유효하지 않은 참조: ${cached.error}` :
          isPending ? `${refId} — 검증 중...` :
                     `${refId} 체인 보기 (${cached.chain?.length || 0}개 항목)`
        }
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '3px',
          background: isError   ? 'rgba(255,82,82,0.12)'     :
                      isValid   ? 'rgba(100,135,242,0.15)'   :
                                  'rgba(255,255,255,0.06)',
          border: `1px solid ${
            isError   ? 'rgba(255,82,82,0.4)'       :
            isValid   ? 'rgba(100,135,242,0.4)'     :
                        'rgba(255,255,255,0.15)'
          }`,
          borderRadius: '5px',
          padding: '1px 7px',
          color: isError   ? '#ff5449'       :
                 isValid   ? 'var(--brand)'  :
                             'var(--text-muted)',
          fontSize: '0.78rem',
          fontWeight: 700,
          cursor: isError ? 'not-allowed' : 'pointer',
          fontFamily: 'Space Grotesk, sans-serif',
          letterSpacing: '0.03em',
          verticalAlign: 'middle',
          margin: '0 2px',
          transition: 'all 0.15s',
        }}
        onMouseEnter={e => {
          if (!isError) {
            e.currentTarget.style.background = isValid
              ? 'rgba(100,135,242,0.28)'
              : 'rgba(255,255,255,0.1)';
            e.currentTarget.style.borderColor = isValid
              ? 'rgba(100,135,242,0.6)'
              : 'rgba(255,255,255,0.25)';
          }
        }}
        onMouseLeave={e => {
          e.currentTarget.style.background = isError   ? 'rgba(255,82,82,0.12)'   :
                                             isValid   ? 'rgba(100,135,242,0.15)' :
                                                         'rgba(255,255,255,0.06)';
          e.currentTarget.style.borderColor = isError ? 'rgba(255,82,82,0.4)'     :
                                              isValid ? 'rgba(100,135,242,0.4)'   :
                                                        'rgba(255,255,255,0.15)';
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>
          {isError ? 'error' : isValid ? 'account_tree' : 'hourglass_empty'}
        </span>
        {refId}
        {isValid && cached.chain?.length > 0 && (
          <span style={{
            fontSize: '0.58rem', fontWeight: 800,
            background: 'rgba(100,135,242,0.25)',
            borderRadius: '8px', padding: '0px 4px',
            color: 'var(--brand)',
          }}>
            {cached.chain.length}
          </span>
        )}
      </button>
    );

    lastIndex = match.index + fullMatch.length;
  }

  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}

/**
 * 텍스트 내 카드링크 태그 파싱 결과 반환 (API 없이 구조만 추출)
 */
export function extractCardTags(text) {
  if (!text) return [];
  const regex = new RegExp(TAG_REGEX.source, 'g');
  const tags = [];
  let match;
  while ((match = regex.exec(text)) !== null) {
    tags.push({
      fullTag: match[0],
      cardNum: parseInt(match[1], 10),
      type: match[2],
      idx: parseInt(match[3], 10),
    });
  }
  return tags;
}

export default renderTaggedText;

