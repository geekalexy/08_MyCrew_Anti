// src/data/roleRegistry.js
// ── 에이전트 역할 사전 v2.0 ────────────────────────────────────
//
// ★ 새 ID 체계 (Phase 34)
//   형식: {팀코드}_{역할코드}
//   - 팀코드가 ID 자체에 포함되어 팀 간 완전 격리
//   - 같은 역할이라도 팀이 다르면 완전히 다른 객체 (다른 메모리/컨텍스트)
//   - 확장: sales_, ops_, hr_ 등 팀코드 추가만으로 확장
//
//   platform: assistant          (ARI — 전체 공유 라우터, 유일한 예외)
//   dev_*   : 개발팀 전용 에이전트
//   mkt_*   : 마케팅팀 전용 에이전트
//
// ── 사전 구조 (v2.0 — 평탄화)
//   v1.0: REGISTRY[agent_id][project_type] = { ... }  ← project_type 추론 필요
//   v2.0: REGISTRY[agent_id] = { ... }               ← ID 자체가 팀 포함
//
// ── 각 항목 필드
//   mainRole    : 간결한 메인 역할명  (사이드바 + 프로필 h2)
//   description : 한 줄 부연 설명    (프로필 서브텍스트)
//   subTags     : 서브 역할 태그     (한 명이 2개 이상 역할 수행 가능)
//   team        : 소속 팀 코드       (팀 그룹핑·필터링용)
// ──────────────────────────────────────────────────────────────

export const ROLE_REGISTRY = {

  // ── Platform (전체 공유 — 팀 외부 독립) ─────────────────────
  assistant: {
    mainRole:    'ARI',
    description: '사용자 ↔ 팀 가교 · 태스크 접수 · 크루 라우팅',
    subTags:     ['Routing', 'Coordination', 'Chat'],
    team:        'platform',
  },

  // ════════════════════════════════════════════════════════════
  //  개발팀 (dev_*)  —  Harness Engineering 스타일
  //  각 에이전트는 독립된 메모리와 컨텍스트를 가짐
  // ════════════════════════════════════════════════════════════

  dev_fullstack: {
    mainRole:    '풀스택 엔지니어',
    description: '프론트엔드 · 백엔드 통합 개발 · 기능 구현 · 배포 자동화',
    subTags:     ['Frontend', 'Backend', 'DevOps', 'CI/CD'],
    team:        'dev',
  },

  dev_ux: {
    mainRole:    'UI/UX 디자이너',
    description: '사용자 인터페이스 설계 · 인터랙션 디자인 · 디자인 시스템 구축',
    subTags:     ['Figma', 'Interaction Design', 'Design System', 'Prototyping'],
    team:        'dev',
  },

  dev_senior: {
    mainRole:    '시니어 엔지니어',
    description: '핵심 기능 구현 · 코드 리뷰 · 기술 표준 수립 · 주니어 멘토링',
    subTags:     ['Full Stack', 'Code Review', 'Mentoring', 'Tech Standard'],
    team:        'dev',
  },

  dev_backend: {
    mainRole:    '백엔드 엔지니어',
    description: 'API 설계 · 서버 로직 구현 · 데이터베이스 · 인증/보안',
    subTags:     ['API Design', 'Node.js', 'Database', 'Auth & Security'],
    team:        'dev',
  },

  dev_qa: {
    mainRole:    'QA 엔지니어',
    description: '테스트 설계 · 버그 트래킹 · 품질 지표 관리 · 릴리스 검증',
    subTags:     ['Test Design', 'Bug Tracking', 'E2E Test', 'Quality Metrics'],
    team:        'dev',
  },

  dev_advisor: {
    mainRole:    '테크 어드바이저',
    description: '아키텍처 검토 · 기술 의사결정 자문 · 리스크 평가 · 코드 품질 심사',
    subTags:     ['Architecture Review', 'Tech Advisory', 'Risk Assessment', 'Code Quality'],
    team:        'dev',
  },

  // ════════════════════════════════════════════════════════════
  //  마케팅팀 (mkt_*)
  //  개발팀과 완전히 다른 메모리·컨텍스트 객체
  // ════════════════════════════════════════════════════════════

  mkt_lead: {
    mainRole:    '마케팅 리더',
    description: '전체 마케팅 캠페인 총괄 · 브랜드 전략 · 채널 믹스 최적화',
    subTags:     ['Campaign Lead', 'Brand Strategy', 'Channel Mix', 'Performance'],
    team:        'mkt',
  },

  mkt_planner: {
    mainRole:    '기획자',
    description: '캠페인 기획 · 콘텐츠 전략 · 마케팅 로드맵 수립',
    subTags:     ['Campaign Planning', 'Content Strategy', 'Roadmap', 'Copywriting'],
    team:        'mkt',
  },

  mkt_designer: {
    mainRole:    '디자이너',
    description: '브랜드 비주얼 · 광고 소재 · SNS 콘텐츠 디자인',
    subTags:     ['Brand Design', 'Ad Creative', 'SNS Visual', 'Motion'],
    team:        'mkt',
  },

  mkt_analyst: {
    mainRole:    '분석가',
    description: '성과 지표 분석 · A/B 테스트 · 채널별 ROAS · 리포팅',
    subTags:     ['Analytics', 'A/B Test', 'ROAS', 'Data Dashboard'],
    team:        'mkt',
  },

  mkt_video: {
    mainRole:    '영상 디렉터',
    description: '영상 기획 · 제작 · 편집 · 유튜브/숏폼 채널 최적화',
    subTags:     ['Video Production', 'Editing', 'YouTube', 'Shorts', 'Script'],
    team:        'mkt',
  },

  mkt_pm: {
    mainRole:    'PM',
    description: '마케팅 프로젝트 관리 · 일정 조율 · KPI 추적 · 팀 커뮤니케이션',
    subTags:     ['Project Management', 'KPI', 'Sprint', 'Stakeholder Mgmt'],
    team:        'mkt',
  },

  // ════════════════════════════════════════════════════════════
  //  확장 예약 — 추가 팀은 팀코드_ 접두사만 붙여 확장
  //  예: sales_closer, ops_analyst, hr_recruiter
  // ════════════════════════════════════════════════════════════
};

// ── 팀 메타데이터 ─────────────────────────────────────────────
export const TEAM_META = {
  platform: { label: '플랫폼',    color: 'var(--brand)',       icon: 'hub' },
  dev:      { label: '개발팀',    color: '#4ade80',            icon: 'code' },
  mkt:      { label: '마케팅팀',  color: '#f472b6',            icon: 'campaign' },
  // 확장 예약
  // sales:  { label: '영업팀',   color: '#fb923c',            icon: 'handshake' },
  // ops:    { label: '운영팀',   color: '#a78bfa',            icon: 'settings' },
};

// ── 헬퍼 함수 ─────────────────────────────────────────────────

/**
 * agent_id → 구조화된 역할 데이터 반환 (v2.0 — projectType 불필요)
 *
 * @param {string} agentId  예: 'dev_fullstack', 'mkt_lead', 'assistant'
 * @returns {{ mainRole, description, subTags, team } | null}
 */
export function getRoleData(agentId) {
  if (!agentId) return null;
  return ROLE_REGISTRY[agentId] || null;
}

/**
 * agent_id에서 팀 코드 추출
 * 'dev_fullstack' → 'dev'
 * 'mkt_lead'      → 'mkt'
 * 'assistant'     → 'platform'
 *
 * @param {string} agentId
 * @returns {string}
 */
export function getTeamCode(agentId) {
  if (!agentId) return 'platform';
  const parts = agentId.split('_');
  if (parts.length >= 2) return parts[0];  // 'dev', 'mkt', 'sales' ...
  return 'platform';
}

/**
 * 팀 코드에 해당하는 모든 agent_id 목록 반환
 * getAgentsByTeam('dev') → ['dev_fullstack', 'dev_ux', ...]
 *
 * @param {string} teamCode
 * @returns {string[]}
 */
export function getAgentsByTeam(teamCode) {
  return Object.keys(ROLE_REGISTRY).filter(id => getTeamCode(id) === teamCode);
}

/**
 * [하위 호환] 프로젝트명에서 팀 코드 추론 (ZeroConfig LLM 할당 시 사용)
 * 신규 ID 체계(dev_*, mkt_*)에서는 ID 자체가 팀을 내포하므로 불필요.
 * 단, LLM이 구 ID를 반환할 경우 fallback 용도로 유지.
 *
 * @param {string} [projectName='']
 * @param {string} [isolationScope='']
 * @returns {'dev' | 'mkt' | 'platform'}
 */
export function inferTeamCode(projectName = '', isolationScope = '') {
  const combined = `${projectName} ${isolationScope}`.toLowerCase();
  if (/개발|dev|engineer|build|product|miniapp|미니앱|harness/.test(combined)) return 'dev';
  if (/마케팅|marketing|brand|campaign|sns|콘텐츠|content|광고/.test(combined)) return 'mkt';
  return 'platform';
}

// 하위 호환 alias (구 코드에서 inferProjectType 참조 시)
export const inferProjectType = inferTeamCode;
