/**
 * 🚨 [CRITICAL: MODEL SSOT] 🚨
 * 이 파일은 프로젝트 전체의 상용 모델 식별자를 관리하는 최상위 의존성(Single Source of Truth)입니다.
 *
 * [2026-04-20] 공식 API 문서 직접 검증 완료 (Sonnet 이중점검)
 * 검증 출처: https://ai.google.dev/gemini-api/docs/models
 *            https://docs.anthropic.com/en/docs/about-claude/models
 *
 * [운영 규칙]
 * 1. preview / experimental / exp 꼬리표 모델 식별자 기재 금지.
 * 2. deprecated 판정 모델 즉시 제거 (gemini-2.0-flash 계열 해당).
 * 3. 대표님의 별도 지시 없이 임의 변경 금지.
 * 4. 분기 1회 공식 문서 재검증 필수.
 *
 * [2026-04-20 변경 내역]
 * - claude-opus-4-6 → claude-opus-4-7 (Anthropic 공식 최신판으로 마이그레이션)
 * - gemini-2.5-flash-lite 추가 (GA 안정판, Fallback 최종 단계 대체용)
 * - gemini-2.0-flash 제거 (공식 Deprecated 판정됨)
 */

export const MODEL = {
  /** 초고속/창의 — Gemini 2.5 Flash (GA 안정판, 기본 운영 모델) */
  FLASH: 'gemini-2.5-flash',

  /** 경량 고속 — Gemini 2.5 Flash-Lite (GA 안정판, Fallback 최종 단계) */
  FLASH_LITE: 'gemini-2.5-flash-lite',

  /** 고성능 추론 — Gemini 2.5 Pro (GA 안정판 최상위) */
  PRO: 'gemini-2.5-pro',

  /** 최고 지능 — Claude Opus 4.7 (2026-04 출시, 에이전트 코딩 강화) */
  OPUS: 'claude-opus-4-7',

  /** 전문가급 균형 — Claude Sonnet 4.6 (GA 안정판) */
  SONNET: 'claude-sonnet-4-6',

  /** modelSelector 자가 분류 전용 (경량 Flash) */
  CLASSIFIER: 'gemini-2.5-flash',

  /** 429 Quota Exceeded 시 Failover 대상 (Flash-Lite로 격하) */
  FAILOVER: 'gemini-2.5-flash-lite',

  /** Anti-Bridge 가상 모델 식별자 (CKS 논문 연구용) */
  ANTIGRAVITY_PRIME:  'anti-bridge-prime',
  ANTIGRAVITY_NEXUS:  'anti-bridge-nexus',
  ANTIGRAVITY_SONNET: 'anti-bridge-sonnet',  // [2026-04-25] lily/pico 전용 — Claude Sonnet급
};

/** 유효한 모델명 화이트리스트 (GA 안정판 한정) */
export const VALID_MODELS = [
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  'claude-opus-4-7',
  'claude-sonnet-4-6',
  'anti-bridge-prime',
  'anti-bridge-nexus',
  'anti-bridge-sonnet',  // [2026-04-25] lily/pico 전용
];

/**
 * Pro 요청 시 Fallback 체인 (공식 검증 완료)
 * gemini-2.5-pro → gemini-2.5-flash → gemini-2.5-flash-lite
 *
 * ❌ 제거된 항목: gemini-2.0-flash (공식 Deprecated)
 * ❌ 제거된 항목: gemini-2.5-pro-preview (존재하지 않는 식별자, 루카 환각)
 */
export const PRO_FALLBACK_CHAIN = Object.freeze([
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]);

/** Flash 요청 시 Fallback 체인 */
export const FLASH_FALLBACK_CHAIN = Object.freeze([
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
]);
