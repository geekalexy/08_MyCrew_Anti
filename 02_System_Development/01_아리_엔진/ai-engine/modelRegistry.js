/**
 * 🚨 [CRITICAL: MODEL SSOT] 🚨
 * 이 파일은 프로젝트 전체의 상용 모델 식별자를 관리하는 최상위 의존성(Single Source of Truth)입니다.
 *
 * [2026-04-19] ListModels API 실측 기반 전면 업데이트 (총 52개 모델 확인)
 * - gemini-3-flash     → ❌ API에 존재하지 않음 (NOT_FOUND)
 * - gemini-2.5-flash   → ✅ GA 안정판 최신 Flash (실측 확인)
 * - gemini-3.1-pro-preview → ✅ 실측 확인된 최고 Pro 모델 (GA Preview)
 *
 * [운영 규칙]
 * 1. 이 파일 수정 전 반드시 list-models.sh 실측 결과를 먼저 확인하십시오.
 * 2. 대표님의 별도 지시 없이 임의 다운그레이드 금지.
 * 3. 검증되지 않은 식별자는 절대 사용 금지.
 */

export const MODEL = {
  /** 초고속/창의 — Gemini 2.5 Flash (GA 실측 최신) */
  FLASH: 'gemini-2.5-flash',

  /** 고성능 추론 — Gemini 3.1 Pro Preview (실측 최고 Pro) */
  PRO: 'gemini-3.1-pro-preview',

  /** 최고 지능 — Claude 4.6 Opus (안정 버전) */
  OPUS: 'claude-opus-4-6',

  /** 전문가급 성능 — Claude 4.6 Sonnet */
  SONNET: 'claude-sonnet-4-6',

  /** modelSelector 자가 분류 전용 (경량 Flash) */
  CLASSIFIER: 'gemini-2.5-flash',

  /** 429 Quota Exceeded 시 Failover 대상 */
  FAILOVER: 'gemini-2.5-flash',

  /** Anti-Bridge 가상 모델 식별자 (CKS 논문 연구용) */
  ANTIGRAVITY_PRIME: 'anti-bridge-prime',
  ANTIGRAVITY_NEXUS: 'anti-bridge-nexus'
};

/** 유효한 모델명 화이트리스트 (ListModels 실측 확인 기준) */
export const VALID_MODELS = [
  'gemini-2.5-flash',
  'gemini-3.1-pro-preview',
  'claude-sonnet-4-6',
  'claude-opus-4-6',
  'anti-bridge-prime',
  'anti-bridge-nexus'
];

