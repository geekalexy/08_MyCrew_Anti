// promptInjectionGuard.js - [Phase 43-4] Prompt Injection 방어 모듈 (GAP-S1 보완)

/**
 * 사용자 입력(Task Content, Comment 등)에서 악의적인 Prompt Injection 시도를 탐지하고 무력화합니다.
 */
const INJECTION_PATTERNS = [
  /IGNORE\s+ALL\s+PREVIOUS\s+INSTRUCTIONS/i,
  /IGNORE\s+PREVIOUS\s+INSTRUCTIONS/i,
  /FORGET\s+PREVIOUS\s+INSTRUCTIONS/i,
  /SYSTEM\s+PROMPT/i,
  /NEW\s+INSTRUCTIONS:/i,
  /BYPASS\s+RULES/i,
  /YOU\s+ARE\s+NOW/i,
  /ACT\s+AS/i,
  /DROP\s+TABLE/i,
  /RM\s+-RF/i
];

/**
 * 텍스트 내 인젝션 패턴이 발견되면 해당 패턴을 안전한 문자열로 치환(Sanitize)합니다.
 * @param {string} text - 검사할 원본 텍스트
 * @returns {string} - 새니타이즈된 텍스트
 */
export function sanitizeInput(text) {
  if (!text || typeof text !== 'string') return '';
  
  let sanitized = text;
  for (const pattern of INJECTION_PATTERNS) {
    sanitized = sanitized.replace(pattern, '[REDACTED_INJECTION_ATTEMPT]');
  }
  
  return sanitized;
}

/**
 * 인젝션 시도가 있는지 여부만 반환합니다.
 * @param {string} text 
 * @returns {boolean}
 */
export function containsInjection(text) {
  if (!text || typeof text !== 'string') return false;
  return INJECTION_PATTERNS.some(pattern => pattern.test(text));
}
