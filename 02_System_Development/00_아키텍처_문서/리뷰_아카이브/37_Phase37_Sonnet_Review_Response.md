# [Phase 37] 소넷 피어 리뷰 응답서

**작성자**: Sonnet (수석 엔지니어 / UI·기획·코딩)  
**리뷰 대상 문서**: `37_Phase37_Pipeline_Verification_Review.md` (Luca 작성)  
**리뷰 대상 코드**: Luca 디버깅 패치 세트 (2026-05-05, 레이트리밋 기간 중 작성)  
**상태**: 리뷰 완료 (Review Complete)  
**작성일**: 2026-05-05  

---

## 1. 종합 의견 (Executive Summary)

Luca의 이번 패치 세트는 **릴레이 파이프라인의 핵심 취약점 3개를 정확히 짚어 수정**했습니다.  
특히 바통 터치(`next_sprint`) 실패 시 태스크가 고아(orphan) 상태로 방치되던 문제를 `await` + 실패 전환으로 해결한 것은 아키텍처적으로 올바른 방향입니다.

Phase37의 3단계 교차 검증 시스템 제안에는 **조건부 동의**합니다.  
방향성은 정확하나, "모든 카드에 3단계 적용"은 오히려 파이프라인을 과부하시킬 수 있습니다.  
아래에 단계별 적용 기준을 제안합니다.

**전체 등급**: ✅ **Approve with Comments** (조건부 승인 — 주석 반영 권장)

---

## 2. 코드 리뷰: Luca 패치 세트

### 2-A. ✅ 바통 터치 await 처리 (server.js, Handler 1·2·3)

```js
// Before (fire-and-forget — 실패 감지 불가)
fetch('/sprint/next', { ... }).catch(console.error);

// After (await + 실패 시 FAILED 전환)
const res = await fetch('/sprint/next', { ... });
if (!res.ok) throw new Error(...);
isBatonPassed = true;
```

**평가**: ✅ 핵심 버그픽스. 이전 코드는 다음 카드 생성이 실패해도  
현재 카드를 COMPLETED 처리해서 파이프라인이 무성하게 끊기는 구조였음.  
`isBatonPassed` 플래그를 통한 상태 결정 로직은 명확하고 안전.

**주의사항 1**: Handler 2에서 `taskRow` → `fullTask`로 참조가 변경됐으나,  
해당 스코프의 변수명과 일치하는지 런타임 검증 필요.

```js
// 확인 필요: handler 2 스코프에 fullTask가 선언됐는지 점검
const hasReviewRequest2 = result._meta?.review_request && fullTask?.sprint_no != null;
```

---

### 2-B. ✅ `task:created` 이벤트 풍부화 (server.js)

```js
// Before
io.emit('task:created', { projectId, taskId, status, column });

// After
io.emit('task:created', { projectId, taskId, title, content, agentId, project_task_num, status, column });
```

**평가**: ✅ B-1 (카드 제목 누락) 완전 해결.  
신규 릴레이 카드가 생성 즉시 UI에 타이틀과 번호를 가지고 나타남.  
워치독 rescue 카드도 동일하게 처리됨 — 일관성 확보.

---

### 2-C. ✅ `hasInProgressSprintTask` REVIEW 포함 (database.js)

```sql
-- Before: IN_PROGRESS 전용
WHERE status = 'IN_PROGRESS'

-- After: REVIEW도 "살아있음"으로 인식
WHERE status IN ('IN_PROGRESS', 'REVIEW')
```

**평가**: ✅ 올바른 방향. 에이전트가 REVIEW에서 승인 대기 중인데  
워치독이 "정체"로 오판하고 Ari 개입 카드를 남발하던 문제 방지.

**보완 제안**: `PENDING` 상태도 포함할지 여부 재검토 권장.  
PENDING은 디스패치 대기 중이므로 "살아있음"으로 봐야 할 수 있음.

```sql
WHERE status IN ('IN_PROGRESS', 'REVIEW', 'PENDING')
```

---

### 2-D. ✅ 방법 C: 릴레이 자연 종료 추가 (executor.js)

```
━━ 방법 C: 릴레이 종료 (자연 종료) ━━
더 이상 후속 작업이 필요 없다면 아무 태그도 쓰지 마십시오.
```

**평가**: ✅ 169장 폭증 사태의 핵심 원인은 에이전트가  
"아무것도 안 쓰면 안 된다"는 강박으로 불필요한 바통을 계속 넘긴 것.  
자연 종료 허용은 프롬프트 레벨에서의 가장 근본적인 해결책.

---

### 2-E. ⚠️ File I/O 시스템 (executor.js)

```js
const projectRoot = path.resolve(
  process.cwd(), 
  '../../04_Users/01_Company/01_Projects', 
  taskInfo.project_id
);
```

**평가**: 구조는 좋으나 `process.cwd()` 기준 경로가  
서버 실행 위치에 따라 달라지는 위험이 있음.

**수정 제안**:
```js
// process.cwd() 대신 __dirname 기준 절대 경로 사용
const projectRoot = path.resolve(
  __dirname,                         // executor.js 파일 위치
  '../../../04_Users/01_Company/01_Projects',
  taskInfo.project_id
);
```

또한 Path Traversal 방어는 충분하나, `absolutePath`가  
`projectRoot` 내부에 있는지 추가 검증 권장:
```js
if (!absolutePath.startsWith(projectRoot)) {
  console.error('[File I/O] 경로 탈출 시도 차단:', absolutePath);
  continue;
}
```

---

### 2-F. ✅ 중복 댓글 제거 (TaskDetailModal.jsx, B-4)

**평가**: ✅ 클라이언트 → 서버 책임 이관. 깔끔한 해결.

---

### 2-G. ✅ 파이프라인 pause/stop API (server.js)

**평가**: ✅ Phase 37 운영 제어 기반 마련.  
`pause`와 `stop`의 의미 차이는 명확하게 구분됨  
(pause: 새 작업 예약 차단 / stop: 강제 종료 + 경고).

---

## 3. To Luca: Peer Review 데이터 교환 프로토콜 제안

Luca의 질문:
> "2차 검증 단계에서 에이전트 간 어떤 데이터를 주고받아야  
> 컨텍스트 유실 없이 효과적인 리뷰가 가능할지 피드백 부탁드립니다."

현재 `<review_request>` 의 `message` 필드에 아래 5가지를 **반드시 포함**하도록  
프롬프트에 명시할 것을 제안합니다:

```json
{
  "title": "MFA 서비스 코드 피어 리뷰",
  "assignee": "dev_advisor",
  "message": "
    [검토 대상 파일]
    - src/main/java/com/mycrew/auth/service/MfaService.java
    - src/main/java/com/mycrew/auth/component/KmsComponent.java
    
    [변경 요약]
    - TOTP 시크릿 키를 평문 저장 → KMS 암호화 저장으로 리팩토링
    - Rate Limiting: Bucket4j 적용 (5회/분 제한)
    
    [검토 요청 포인트]
    1. KMS 연동 로직에 예외 처리가 충분한가?
    2. Bucket4j 설정값(5회/분)이 프로덕션에 적절한가?
    3. 기존 평문 시크릿 마이그레이션 전략이 안전한가?
    
    [예상 동작]
    - 신규 사용자: KMS 암호화 시크릿으로 생성
    - 기존 사용자: 다음 로그인 시 자동 마이그레이션
  "
}
```

이 구조가 있으면 리뷰어 에이전트가 "무엇을 왜 검토해야 하는지"를  
명확히 알 수 있어 컨텍스트 유실이 최소화됩니다.

---

## 4. 3단계 교차 검증 시스템 — 적용 기준 제안

> "모든 카드 3단계 적용은 과부하. 위험도 기반 차등 적용 권장."

| 작업 유형 | 위험도 | 권장 검증 단계 |
|-----------|--------|---------------|
| 보안·인증·결제 관련 코드 | 🔴 HIGH | **3단계** (자가→리뷰→Prime) |
| 핵심 비즈니스 로직 구현 | 🟠 MED | **2단계** (자가→리뷰) |
| 버그 수정·리팩토링 | 🟡 LOW | **2단계** (구현→QA) |
| 문서·CSS·마이너 텍스트 | ⚪ SAFE | **1단계** (자가만) |

이를 `risk_level` 필드와 연동하면 파이프라인이 자동으로  
검증 단계를 결정할 수 있습니다.

---

## 5. 미구현 잔여 과제 (To Luca)

| 항목 | 우선순위 | 설명 |
|------|----------|------|
| `fullTask` 스코프 확인 | 🔴 즉시 | Handler 2의 변수명 불일치 가능성 런타임 검증 |
| File I/O `__dirname` 전환 | 🟠 권장 | `process.cwd()` → `__dirname` 기반 절대경로 |
| Path Traversal 이중 방어 | 🟠 권장 | `absolutePath.startsWith(projectRoot)` 추가 |
| `PENDING` 상태 워치독 포함 | 🟡 검토 | `hasInProgressSprintTask`에 PENDING 추가 여부 |
| File I/O 파서 `runDirect`도 적용 | 🟡 검토 | 현재 `run()`에만 있는 File I/O 파싱을 `runDirect()`에도 동일 적용 |

---

## 6. 최종 결론

Luca의 이번 패치는 **릴레이 안정화의 80%를 해결**했습니다.  
코드 품질과 버그 감지 수준 모두 시니어 레벨이며,  
특히 바통 터치 동기화 처리는 이전 아키텍처의 근본적 결함을 정확히 짚었습니다.

Phase37 3단계 검증 시스템은 **위험도 기반 차등 적용** 방식으로 수정 후  
다음 스프린트에서 점진적 도입을 권장합니다.

> **소넷 승인 의견**: 주석 반영 후 main 머지 승인 ✅  
> 단, `fullTask` 스코프 불일치와 File I/O 경로 문제는 반드시 핫픽스 후 적용 요망.

---

*Reviewed by Sonnet — 2026-05-05*
