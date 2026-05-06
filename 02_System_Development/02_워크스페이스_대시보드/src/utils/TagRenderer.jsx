/**
 * [Phase 36b] TagRenderer.jsx — 카드링크 인라인 태그 렌더링 유틸
 *
 * Q1: 가변 자릿수 (#1, #12, #123 모두 지원)
 * Q4: 언더라인 + 파란색(#3b82f6) 텍스트 표시 (Phase 36b 확정)
 *     클릭 가능한 칩 형태·호버 툴팁은 Phase 37에서 구현 예정
 *
 * 사용법:
 *   import { renderTaggedText } from '../utils/TagRenderer';
 *
 *   <p>{renderTaggedText(text, (cardNum, type, idx) => openCardModal(cardNum))}</p>
 */

import React from 'react';

// Q1 확정: 가변 자릿수 정규식
const TAG_REGEX = /#(\d+)(C|F)(\d+)/g;

/**
 * 텍스트 내의 카드링크 태그를 언더라인+블루 span으로 변환
 *
 * @param {string} text - 렌더링할 텍스트
 * @param {function} onTagClick - (cardNum: number, type: 'C'|'F', idx: number) => void
 * @returns {Array<React.ReactNode>} — React 노드 배열
 */
export function renderTaggedText(text, onTagClick) {
  if (!text) return [text];

  const parts = [];
  let lastIndex = 0;
  let match;

  // 매번 새 RegExp 인스턴스 사용 (lastIndex 오염 방지)
  const regex = new RegExp(TAG_REGEX.source, 'g');

  while ((match = regex.exec(text)) !== null) {
    // 태그 앞 일반 텍스트
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }

    const [fullTag, cardNumStr, type, idxStr] = match;
    const cardNum = parseInt(cardNumStr, 10);
    const idx = parseInt(idxStr, 10);
    const typeLabel = type === 'C' ? '코멘트' : '파일';

    // Q4 확정: 언더라인 + 파란색(#3b82f6) 텍스트만 — 칩/툴팁은 Phase 37
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
        onClick={onTagClick ? (e) => {
          e.stopPropagation();
          onTagClick(cardNum, type, idx);
        } : undefined}
      >
        {fullTag}
      </span>
    );

    lastIndex = match.index + fullTag.length;
  }

  // 마지막 남은 텍스트
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

/**
 * 텍스트 내 카드링크 태그 파싱 결과 반환 (API 없이 구조만 추출)
 * @param {string} text
 * @returns {Array<{fullTag: string, cardNum: number, type: 'C'|'F', idx: number}>}
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
