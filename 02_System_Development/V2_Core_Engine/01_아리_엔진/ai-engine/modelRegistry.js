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

  /** 최고 지능 — Claude Opus 4.6 (Antigravity IDE 기준 확정판) */
  OPUS: 'claude-opus-4-6',

  /** 전문가급 균형 — Claude Sonnet 4.6 (GA 안정판) */
  SONNET: 'claude-sonnet-4-6',

  /** modelSelector 자가 분류 전용 (경량 Flash) */
  CLASSIFIER: 'gemini-2.5-flash',

  /** 429 Quota Exceeded 시 Failover 대상 (Flash-Lite로 격하) */
  FAILOVER: 'gemini-2.5-flash-lite',

  /**
   * AntiGravity 파일 브릿지 에이전트 모델 (executor는 agentId 기반 라우팅 사용)
   * BRIDGE_AGENTS Set(['luna','ollie','lily','pico','nova','lumi']) 에 해당하면 antigravityAdapter 호출
   */
  ANTIGRAVITY_PRIME:  'claude-opus-4-6',   // OLLIE 에이전트 브릿지
  ANTIGRAVITY_NEXUS:  'claude-opus-4-6',   // LUNA  에이전트 브릿지
  ANTIGRAVITY_SONNET: 'claude-sonnet-4-6', // LILY / PICO 에이전트 브릿지

  /**
   * AntiGravity 구독 모델 풀 (파일 브릿지 requestedModel 필드 기준)
   * 출처: AntiGravity IDE 모델 선택 UI (2026-04-28 확인)
   */
  ANTI_GEMINI_PRO_HIGH: 'anti-gemini-3.1-pro-high',   // Gemini 3.1 Pro (High) — 최고성능
  ANTI_GEMINI_PRO_LOW:  'anti-gemini-3.1-pro-low',    // Gemini 3.1 Pro (Low)  — 균형
  ANTI_GEMINI_FLASH:    'anti-gemini-3-flash',         // Gemini 3 Flash        — 고속
  ANTI_SONNET_THINK:    'anti-claude-sonnet-4.6-thinking', // Claude Sonnet 4.6 (Thinking)
  ANTI_OPUS_THINK:      'anti-claude-opus-4.6-thinking',   // Claude Opus 4.6 (Thinking)
  ANTI_GPT_OSS:         'anti-gpt-oss-120b',           // GPT-OSS 120B (Medium)
};

/** 유효한 모델명 화이트리스트 (GA 안정판 한정) */
export const VALID_MODELS = [
  // Gemini API 직접 (ARI 전용)
  'gemini-2.5-pro',
  'gemini-2.5-flash',
  'gemini-2.5-flash-lite',
  // AntiGravity 브릿지 구독 모델 풀 (크루 에이전트 전용)
  'anti-gemini-3.1-pro-high',
  'anti-gemini-3.1-pro-low',
  'anti-gemini-3-flash',
  'anti-claude-sonnet-4.6-thinking',
  'anti-claude-opus-4.6-thinking',
  'anti-gpt-oss-120b',
  // 하위 호환 (직접 Claude 식별자)
  'claude-opus-4-6',
  'claude-sonnet-4-6',
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
