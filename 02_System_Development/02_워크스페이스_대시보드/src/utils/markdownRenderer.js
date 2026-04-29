// src/utils/markdownRenderer.js — [T-07] 경량 마크다운 렌더러 (외부 의존성 없음)
// marked/remark 대신 정규식 기반 변환 (MyCrew 내부 사용 패턴 커버)

/**
 * 마크다운 텍스트를 안전한 HTML로 변환합니다.
 * XSS 방지: script 태그 및 이벤트 핸들러 제거
 * @param {string} markdown
 * @returns {string} HTML string
 */
export function renderMarkdown(markdown) {
  if (!markdown || typeof markdown !== 'string') return '';

  let html = markdown;

  // 1. XSS 방어 — 스크립트/이벤트 제거 (dangerouslySetInnerHTML 사용 전)
  html = html.replace(/<script[\s\S]*?<\/script>/gi, '');
  html = html.replace(/\bon\w+\s*=/gi, '');

  // 2. 코드 블록 (``` ... ```) — 먼저 처리 (이후 변환 대상에서 제외)
  const codeBlocks = [];
  html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
    const idx = codeBlocks.length;
    codeBlocks.push(
      `<pre class="md-code-block"><code class="md-code${lang ? ` language-${lang}` : ''}">${escapeHtml(code.trimEnd())}</code></pre>`
    );
    return `%%CODE_BLOCK_${idx}%%`;
  });

  // 3. 인라인 코드 (`code`)
  const inlineCodes = [];
  html = html.replace(/`([^`]+)`/g, (_, code) => {
    const idx = inlineCodes.length;
    inlineCodes.push(`<code class="md-inline-code">${escapeHtml(code)}</code>`);
    return `%%INLINE_CODE_${idx}%%`;
  });

  // 4. 제목 (### ## #)
  html = html.replace(/^#{4}\s+(.+)$/gm, '<h4 class="md-h4">$1</h4>');
  html = html.replace(/^#{3}\s+(.+)$/gm, '<h3 class="md-h3">$1</h3>');
  html = html.replace(/^#{2}\s+(.+)$/gm, '<h2 class="md-h2">$1</h2>');
  html = html.replace(/^#{1}\s+(.+)$/gm, '<h1 class="md-h1">$1</h1>');

  // 5. 수평선 (---)
  html = html.replace(/^(-{3,}|\*{3,})$/gm, '<hr class="md-hr" />');

  // 6. 굵게 + 이탤릭 (***text***)
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  // 7. 굵게 (**text**)
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>');
  // 8. 이탤릭 (*text*)
  html = html.replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em class="md-italic">$1</em>');
  // 9. 취소선 (~~text~~)
  html = html.replace(/~~(.+?)~~/g, '<del class="md-del">$1</del>');

  // 10. 링크 ([text](url))
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
    '<a class="md-link" href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  // 11. 체크박스 (- [x] / - [ ])
  html = html.replace(/^- \[x\]\s+(.+)$/gm, '<li class="md-checkbox md-checked"><span class="md-checkbox-icon">☑</span> $1</li>');
  html = html.replace(/^- \[ \]\s+(.+)$/gm, '<li class="md-checkbox"><span class="md-checkbox-icon">☐</span> $1</li>');

  // 12. 순서 없는 목록 (- item / * item)
  html = html.replace(/^[*-]\s+(.+)$/gm, '<li class="md-li md-uli">$1</li>');
  // 순서 있는 목록 (1. item)
  html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li class="md-li md-oli" value="$1">$2</li>');

  // li 그룹화 (ul과 ol 분리)
  html = html.replace(/(<li class="md-li md-uli[^"]*">.*<\/li>\n?)+/g, (match) => `<ul class="md-ul">${match}</ul>`);
  html = html.replace(/(<li class="md-li md-oli[^"]*">.*<\/li>\n?)+/g, (match) => `<ol class="md-ol">${match}</ol>`);

  // 13. 인용문 (> text)
  html = html.replace(/^&gt;\s*(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');
  html = html.replace(/^>\s*(.+)$/gm, '<blockquote class="md-blockquote">$1</blockquote>');

  // 14. 줄바꿈 — 빈 줄을 <p> 구분으로, 나머지는 <br>
  html = html
    .split(/\n{2,}/)
    .map((block) => {
      // 블록 요소 태그로 시작하면 그대로 유지
      if (/^<(h[1-6]|ul|ol|li|blockquote|pre|hr)/.test(block.trim())) return block;
      // 일반 텍스트는 <p>로 감싸기
      const inner = block.replace(/\n/g, '<br />');
      return inner ? `<p class="md-p">${inner}</p>` : '';
    })
    .join('\n');

  // 15. 코드 블록 / 인라인 코드 복원
  inlineCodes.forEach((code, idx) => {
    html = html.replace(`%%INLINE_CODE_${idx}%%`, code);
  });
  codeBlocks.forEach((block, idx) => {
    html = html.replace(`%%CODE_BLOCK_${idx}%%`, block);
  });

  return html;
}

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
