# 📋 사전 리뷰 아카이브 #32 — ProjectSettingsModal
**리뷰 대상**: ProjectSettingsModal 신규 구현 (PRD 기반)  
**리뷰어**: Prime (Supreme Advisor)  
**등급**: 🟢 A-  
**작성일**: 2026-05-03  
**요청자**: 소넷 (Claude Sonnet 4.6 / Antigravity)  
**기반 문서**: `project_settings_prd.md`

---

## 🏆 최종 등급: 🟢 A-

> 핵심 아키텍처 설계는 탄탄하다.  
> CP-5 인증 미확인과 CP-6 즉시 버그 수정이 완료되면 A로 상향 가능.

---

## ✅ 7개 체크포인트 판정

| CP | 항목 | 판정 | 핵심 결정 |
|----|------|------|-----------|
| CP-1 | Delta Score fallback | ✅ 승인 | 기존 프로젝트는 `objective` 파싱으로 fallback. Levenshtein 성능 0.1ms 이하로 프론트 계산 허용. `isolation_scope` 변경은 다음 태스크부터 즉시 반영 |
| CP-2 | 딥씽크 트리거 시점 | ✅ 승인 | **저장 버튼 클릭 시점** 확정. blur 트리거는 입력 중 방해 요소로 부적합 |
| CP-3 | NewProjectModal preload | ✅ 승인 | `props initialValues` 전달 방식 채택 (전역 store 경유 아님). 모달 순차 열림 구조로 z-index 충돌 없음 |
| CP-4 | DB 마이그레이션 | ✅ 승인 | `initDB()` 내 `ALTER TABLE ADD COLUMN` 기존 패턴 사용. **백필 불필요** — 설정 모달 첫 열기 시 자동 채움으로 처리 |
| CP-5 | API 인증 | 🟡 조건부 | 단일 사용자 환경으로 인증 미들웨어 없음 허용. **단, C→A/B 타입 전환 차단 로직 추가 필수** |
| CP-6 | AnalyticsTab Hook | 🔴 즉시 수정 | `OrgView.jsx` 상단 import에 `useEffect` 누락 → 동적 import 우회로 Hook 규칙 위반. **L2에 `useEffect` 추가로 해결** |
| CP-7 | 백로그 14건 우선순위 | ✅ 확인 | `#21/#22/#23`이 격리 위반으로 최우선. 나머지는 중/낮 처리 |

---

## 🔴 즉시 조치 항목

### CP-6: OrgView.jsx Hook 버그
- **파일**: `src/components/Views/OrgView.jsx`
- **위치**: L1 import 라인 (`import { useState, useMemo } from 'react'`)
- **수정**: `useEffect` 추가 후 `AnalyticsTab` 내부 동적 import 패턴 제거
- **영향**: CKS 메트릭이 전혀 로드되지 않는 근본 원인

---

## 🟡 조건부 항목

### CP-5: C타입 → A/B 전환 차단
- `isolation_scope.type === 'global_knowledge'` (C타입)인 프로젝트에서  
  A 또는 B 타입으로 변경 시도 시 → Level 3(DANGER) 동일하게 차단  
- 이유: C타입에서 데이터가 이미 전체 공유된 상태에서 격리 전환 시 데이터 일관성 파괴 위험

---

## 📌 구현 시 반영 사항 (Prime 피드백 기반)

1. **Delta Score**: `isolation_scope.type` C→A/B 전환을 자동 DANGER 처리
2. **DB**: `initDB()`에 `ALTER TABLE projects ADD COLUMN IF NOT EXISTS objective_raw TEXT`
3. **NewProjectModal**: `initialValues` prop 추가, 내부 state를 initialValues로 초기화
4. **딥씽크 트리거**: `handleSaveClick` 내부에서만 발생, 필드 입력 중 미발생
5. **백필 전략**: 설정 모달 최초 열기 시 `objective`를 파싱하여 `objective_raw`/`workflow_raw` 자동 채움

---

*리뷰 요청 문서: `/brain/.../artifacts/review_request_project_settings.md`*  
*구현 담당: 소넷 (Claude Sonnet 4.6)*
