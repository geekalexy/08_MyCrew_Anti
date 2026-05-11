# [08] Phase 20: 제품화 최종 구현 계획 (TutorialManager & Test API)

**작성:** Luca | **Phase:** 20 완료 | **Prime 참조 리뷰:** 8차

---

## 목표
온보딩 완료 직후 **고객이 즉시 가치를 체감**할 수 있도록, 에이전트 자동 배치 및 가이드 미션 생성까지 자동화한다. 또한 실시간 연동 테스트로 사용자 신뢰를 확보한다.

---

## 핵심 설계

### 1. TeamActivator: 팀 목표별 에이전트 스킬 일괄 배포
```javascript
// 세 가지 프리셋: marketing / development / general
await teamActivator.activate(teamType);
// → Promise.all()로 병렬 스킬 활성화
// → io.emit('agent:skills_bulk_updated') 브로드캐스트
```
- 선택한 팀 유형에 따라 가장 적합한 스킬 조합을 즉시 에이전트에게 장착.

### 2. TutorialManager: 아리의 가이드 미션 자동 생성
```javascript
await tutorialManager.bootstrap(userName, teamName, io);
// → DB에 가이드 카드(Task) 2건 생성
// → io.emit('task:created')로 칸반 보드에 즉시 표시
```
- "텔레그램 연동하는 법", "학습 데이터 폴더 연결" 등 즉시 해야 할 행동 안내.
- 순환 참조 방지: `io`를 파라미터로 전달(DI 패턴).

### 3. /api/onboarding/test-connection: 실시간 검증 API
- `type: 'key'` → `AIzaSy` 또는 `sk-` 접두사 검증
- `type: 'sub'` → `@` 포함 이메일 형식 검증
- 1.2초 딜레이로 "실제 점검 중" 느낌 제공 → 성공/실패 즉시 피드백.
- **MVP 이후:** 실제 API 호출로 교체 예정 (Prime 권고사항 반영).
