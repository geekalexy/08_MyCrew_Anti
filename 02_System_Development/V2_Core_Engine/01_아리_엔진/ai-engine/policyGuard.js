/**
 * 🛡️ policyGuard.js — MyCrew Policy Enforcement Engine
 * Phase B | POLICY_INDEX v1.0 기준 (18개 정책)
 * 
 * 역할:
 *   1. WARN  — 콘솔 경고 출력 후 진행 허용
 *   2. REF   — 위반 시 관련 문서 경로 출력
 *   3. QUERY — O(1) Set/Map 기반 빠른 검증
 *   4. BLOCK — STRICT 정책 위반 시 PolicyViolationError 발생
 */

// ─── 금지 에이전트 ID 목록 (P-001) ─────────────────────────────────────────
const FORBIDDEN_AGENT_IDS = new Set([
  'marketing_lead', 'visual_director', 'copywriter',
  'researcher', 'data_analyst', 'strategy_advisor',
  // 레거시 닉네임 기반 ID
  'nova', 'lumi', 'lily', 'pico', 'ollie', 'luna',
  'ari',  // 'ari' → 'assistant'로 교체됨
]);

// ─── 유효한 팀 코드 접두사 (P-002) ──────────────────────────────────────────
const VALID_TEAM_PREFIXES = ['dev_', 'mkt_', 'sales_', 'ops_', 'hr_'];

// ─── 플랫폼 예외 ID (팀 코드 불필요) ────────────────────────────────────────
const PLATFORM_IDS = new Set(['assistant', 'system_bot', 'dev_lead', 'frontend_dev', 'code_reviewer']);

// ─── 금지 모델 패턴 (P-004) ──────────────────────────────────────────────────
const FORBIDDEN_MODEL_PATTERNS = ['-preview', '-exp', '-experimental'];

// ─── 금지 모델 식별자 (P-005) ────────────────────────────────────────────────
const FORBIDDEN_MODEL_IDS = new Set([
  'gemini-' + '2.0-flash',
  'gemini-' + '1.5-flash',
  'gemini-' + '1.5-pro',
  'gemini-' + '1.5-flash-latest',
]);

// ─── 금지 파괴적 함수명 패턴 (P-016) ────────────────────────────────────────
// 파괴적 함수는 'dangerously' 접두사 필수
const DESTRUCTIVE_TERMS = ['purge', 'clearAll', 'resetAll', 'wipeAll', 'deleteAll', 'truncate'];

// ─── 정책 참조 문서 맵 ───────────────────────────────────────────────────────
const POLICY_DOCS = {
  'P-001': '02_System_Development/01_아리_엔진/ai-engine/AGENT_ID_SPEC.md',
  'P-002': '02_System_Development/00_아키텍처_문서/03_운영가이드/에이전트_ID_체계_운영가이드_v2.md',
  'P-003': '02_System_Development/00_아키텍처_문서/03_운영가이드/에이전트_ID_체계_운영가이드_v2.md',
  'P-004': '01_Company_Operations/04_HR_온보딩/strategic_memory.md',
  'P-005': '01_Company_Operations/04_HR_온보딩/strategic_memory.md',
  'P-006': '02_System_Development/01_아리_엔진/ai-engine/modelRegistry.js',
  'P-016': '01_Company_Operations/04_HR_온보딩/POLICY_INDEX.md',
  'P-017': '01_Company_Operations/04_HR_온보딩/POLICY_INDEX.md',
  'P-018': '01_Company_Operations/04_HR_온보딩/POLICY_INDEX.md',
};

// ─── 커스텀 에러 클래스 ───────────────────────────────────────────────────────
export class PolicyViolationError extends Error {
  constructor(policyId, message, docPath) {
    super(`[${policyId} STRICT] ${message}`);
    this.name = 'PolicyViolationError';
    this.policyId = policyId;
    this.docPath = docPath;
  }
}

// ─── 핵심 검증 함수 ───────────────────────────────────────────────────────────

/**
 * P-001, P-002, P-003: 에이전트 ID 검증
 * @param {string} agentId
 * @throws {PolicyViolationError} STRICT 위반 시
 * @returns {{ valid: boolean, warning?: string }}
 */
export function validateAgentId(agentId) {
  if (!agentId || typeof agentId !== 'string') {
    throw new PolicyViolationError('P-002', '에이전트 ID는 비어있을 수 없습니다.', POLICY_DOCS['P-002']);
  }

  const id = agentId.toLowerCase().trim();

  // P-001: 금지 ID 체크
  if (FORBIDDEN_AGENT_IDS.has(id)) {
    const msg = `금지된 에이전트 ID "${id}" 사용 불가 (Phase 33 폐기). 참조: ${POLICY_DOCS['P-001']}`;
    console.error(`❌ [P-001 STRICT] ${msg}`);
    console.error(`   → 개발팀이면 dev_fullstack/dev_ux 등, 마케팅팀이면 mkt_lead/mkt_planner 등을 사용하세요.`);
    throw new PolicyViolationError('P-001', msg, POLICY_DOCS['P-001']);
  }

  // 플랫폼 예외 ID는 팀 코드 불필요
  if (PLATFORM_IDS.has(id)) {
    return { valid: true };
  }

  // P-002: 팀 코드 접두사 체크
  const hasValidPrefix = VALID_TEAM_PREFIXES.some(prefix => id.startsWith(prefix));
  if (!hasValidPrefix) {
    const msg = `에이전트 ID "${id}"는 팀 코드 접두사가 없습니다. {팀코드}_{역할코드} 형식 필수. 참조: ${POLICY_DOCS['P-002']}`;
    console.error(`❌ [P-002 STRICT] ${msg}`);
    console.error(`   → 유효한 접두사: ${VALID_TEAM_PREFIXES.join(', ')}`);
    throw new PolicyViolationError('P-002', msg, POLICY_DOCS['P-002']);
  }

  // P-003: 역할코드 부분이 비어있으면 안 됨
  const prefix = VALID_TEAM_PREFIXES.find(p => id.startsWith(p));
  const rolePart = id.slice(prefix.length);
  if (!rolePart || rolePart.length === 0) {
    const msg = `에이전트 ID "${id}"에 역할 코드가 없습니다. 예: dev_fullstack, mkt_lead`;
    console.error(`❌ [P-003 STRICT] ${msg}`);
    throw new PolicyViolationError('P-003', msg, POLICY_DOCS['P-003']);
  }

  console.log(`✅ [policyGuard] 에이전트 ID 검증 통과: ${id}`);
  return { valid: true };
}

/**
 * P-004, P-005: 모델 식별자 검증
 * @param {string} modelId
 * @throws {PolicyViolationError} STRICT 위반 시
 * @returns {{ valid: boolean }}
 */
export function validateModel(modelId) {
  if (!modelId || typeof modelId !== 'string') return { valid: true }; // null은 허용 (기본값 사용 케이스)

  const id = modelId.toLowerCase().trim();

  // P-004: 금지 패턴 (-preview 등)
  const forbiddenPattern = FORBIDDEN_MODEL_PATTERNS.find(p => id.includes(p));
  if (forbiddenPattern) {
    const msg = `모델 식별자 "${modelId}"에 금지 패턴 "${forbiddenPattern}"이 포함됩니다. 참조: ${POLICY_DOCS['P-004']}`;
    console.error(`❌ [P-004 STRICT] ${msg}`);
    throw new PolicyViolationError('P-004', msg, POLICY_DOCS['P-004']);
  }

  // P-005: 폐기된 모델
  if (FORBIDDEN_MODEL_IDS.has(id)) {
    const msg = `Deprecated 모델 "${modelId}" 사용 금지. 참조: ${POLICY_DOCS['P-005']}`;
    console.error(`❌ [P-005 STRICT] ${msg}`);
    throw new PolicyViolationError('P-005', msg, POLICY_DOCS['P-005']);
  }

  console.log(`✅ [policyGuard] 모델 식별자 검증 통과: ${modelId}`);
  return { valid: true };
}

/**
 * P-016: 파괴적 함수명 체크 — 'dangerously' 접두사 필수
 * @param {string} functionName
 * @returns {{ valid: boolean, warning?: string }}
 */
export function validateFunctionName(functionName) {
  if (!functionName) return { valid: true };

  const isDestructive = DESTRUCTIVE_TERMS.some(term =>
    functionName.toLowerCase().includes(term.toLowerCase())
  );

  if (isDestructive && !functionName.startsWith('dangerously')) {
    const warning = `⚠️ [P-016 WARN→STRICT] 파괴적 함수 "${functionName}"에는 'dangerously' 접두사가 필요합니다. (예: dangerously${functionName.charAt(0).toUpperCase() + functionName.slice(1)})`;
    console.warn(warning);
    return { valid: false, warning };
  }

  return { valid: true };
}

/**
 * P-018: 시스템 에이전트 제외 로직 — ID 배열 기반 체크
 * 하드코딩된 조건문 대신 SYSTEM_AGENT_IDS 배열을 사용해야 함을 강제
 * @param {string[]} excludedIds — 제외할 에이전트 ID 배열
 * @param {string} contextName — 호출 컨텍스트 이름 (디버깅용)
 */
export function validateSystemAgentExclusion(excludedIds, contextName = 'unknown') {
  if (!Array.isArray(excludedIds)) {
    const warning = `⚠️ [P-018 WARN] "${contextName}": 시스템 에이전트 제외는 배열 기반이어야 합니다. 하드코딩된 조건문 사용 금지.`;
    console.warn(warning);
    return { valid: false, warning };
  }
  return { valid: true };
}

/**
 * 배치 검증 — crew 배열 전체의 에이전트 ID를 한번에 검증
 * createZeroConfigProject, teamActivator.activate 등에서 사용
 * @param {Array<{agent_id?: string, agent_name?: string}>} crew
 * @returns {{ valid: boolean, errors: string[], passed: string[] }}
 */
export function validateCrewIds(crew) {
  const errors = [];
  const passed = [];

  for (const agent of crew) {
    const id = (agent.agent_id || agent.agent_name || '').toLowerCase().trim();
    try {
      validateAgentId(id);
      passed.push(id);
    } catch (err) {
      errors.push(`${id}: ${err.message}`);
    }
  }

  if (errors.length > 0) {
    console.error(`❌ [policyGuard] 크루 ID 검증 실패 (${errors.length}건):`);
    errors.forEach(e => console.error(`   - ${e}`));
  }

  return { valid: errors.length === 0, errors, passed };
}

// ─── 빠른 조회 헬퍼 ───────────────────────────────────────────────────────────

/** 에이전트가 금지된 구 ID인지 빠르게 확인 (throw 없이) */
export const isForbiddenId  = (id) => FORBIDDEN_AGENT_IDS.has((id || '').toLowerCase());

/** 에이전트가 유효한 팀 ID인지 빠르게 확인 (throw 없이) */
export const isValidTeamId  = (id) => {
  const lower = (id || '').toLowerCase();
  return PLATFORM_IDS.has(lower) || VALID_TEAM_PREFIXES.some(p => lower.startsWith(p));
};

/** 모델이 금지 패턴을 포함하는지 빠르게 확인 (throw 없이) */
export const isForbiddenModel = (modelId) => {
  const id = (modelId || '').toLowerCase();
  return FORBIDDEN_MODEL_IDS.has(id) || FORBIDDEN_MODEL_PATTERNS.some(p => id.includes(p));
};

export default {
  validateAgentId,
  validateModel,
  validateFunctionName,
  validateSystemAgentExclusion,
  validateCrewIds,
  isForbiddenId,
  isValidTeamId,
  isForbiddenModel,
  PolicyViolationError,
};
