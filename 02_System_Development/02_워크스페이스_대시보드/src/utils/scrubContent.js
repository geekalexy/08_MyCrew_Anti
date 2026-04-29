// src/utils/scrubContent.js
// [S1-4] 에이전트 응답에서 내부 태그·도구 코드 필터링 유틸
// 사용자에게 노출되면 안 되는 디버그용 식별자를 제거하거나 정제한다.

/**
 * 에이전트 응답 텍스트에서 내부 메타 태그를 제거하고 사용자 친화적 텍스트를 반환.
 *
 * 제거 대상:
 *  - [QUICK_CHAT], [CONTENT], [WORKED], [TOOL_CODE], [TOOL_RESULT] 태그
 *  - (anti-bridge-xxxx) 어댑터 식별자
 *  - <thinking>...</thinking>, <working>...</working> 미파싱 잔여 태그
 *    (executor가 정상 처리했으면 이미 없지만, 누락 방어용)
 *
 * 접힌 아코디언으로 분리:
 *  - TOOL_CODE 블록 (```json ... ```) → 제거 (LogDrawer의 사고과정 토글로 대체)
 *
 * @param {string} text - 원본 에이전트 응답 텍스트
 * @returns {string} - 정제된 텍스트
 */
export function scrubContent(text) {
  if (!text || typeof text !== 'string') return text || '';

  let result = text;

  // 1) 섹션 태그 제거: [QUICK_CHAT], [CONTENT], [WORKED], [TOOL_CODE], [TOOL_RESULT]
  //    형식: [TAG_NAME] ... 다음 태그 또는 문서 끝까지
  result = result.replace(/\[(?:QUICK_CHAT|CONTENT|WORKED|TOOL_CODE|TOOL_RESULT)\]/g, '').trim();

  // 2) TOOL_CODE JSON 코드블록 제거 (```json ... ```)
  //    에이전트가 내부 도구 호출 JSON을 그대로 출력한 경우
  result = result.replace(/```json[\s\S]*?```/gi, '').trim();

  // 3) (anti-bridge-xxxx) 어댑터 식별자 제거
  result = result.replace(/\(anti-bridge-[a-zA-Z0-9_-]+\)/gi, '').trim();

  // 4) 미파싱 <thinking>, <working> 태그 제거 (방어 코드)
  result = result.replace(/<thinking>[\s\S]*?<\/thinking>/gi, '').trim();
  result = result.replace(/<working>[\s\S]*?<\/working>/gi, '').trim();

  // 5) 연속 빈 줄 정리 (최대 2줄)
  result = result.replace(/\n{3,}/g, '\n\n').trim();

  return result;
}
