# Bugdog 확장 기획서: @bugdog 기록 자동화 파이프라인

**문서 유형:** 기능 기획서 (구현 전 검토용)  
**담당:** Sonnet  
**작성일:** 2026-05-02  
**검수 요청:** Prime (구현 전 설계 검수 권고)  
**연관 Phase:** Phase 27 (Bugdog 기반) → Phase 32 (Dogfooding 파이프라인 확장)

---

## 1. 배경 및 목적

### 현재 상황 (As-Is)
전략적 Dogfooding 채택 이후, 이슈 발견 → 케이스 문서화 프로세스가 **완전 수동**으로 운영 중:

```
[대표님] 이슈 발견 → 루카/소넷에게 전달 → 수동 분석 → CASE_NNN.md 수작업 작성
```

**문제점:**
- 이슈 발생 순간과 기록 시점 사이 컨텍스트 손실
- 케이스 작성에 소요되는 루카/소넷 리소스 낭비
- 대표님이 이슈를 발견할 때마다 직접 에스컬레이션해야 하는 부담
- 소규모 이슈(버그 아닌 UX 불편)는 기록되지 않고 소실

### 목표 (To-Be)
```
[대표님 또는 ARI] "@bugdog 기록" 한마디
    ↓
[Bugdog] 자동으로 컨텍스트 수집 → CASE 파일 초안 생성 → 칸반 카드 생성
    ↓
[소넷] 초안 검토 및 보완 → Prime 검수 요청 (필요시)
    ↓
[노바] 마케팅 앵글 작성 → 블로그/SNS 소재화
```

---

## 2. 트리거 설계

### 2-1. 지원 채널
| 채널 | 트리거 형식 | 예시 |
|:---|:---|:---|
| ARI 채팅 (대시보드) | `@bugdog 기록` | `@bugdog 기록 타임라인에서 텍스트 전송이 안됨` |
| 텔레그램 | `@bugdog 기록` | 동일 |
| 칸반 코멘트 | `@bugdog 기록` | 태스크 코멘트에서 직접 트리거 |

### 2-2. 트리거 파싱
```js
// server.js 또는 ariDaemon.js
const BUGDOG_TRIGGER = /^@bugdog\s+기록\s*(.*)/i;

function detectBugdogTrigger(message) {
  const match = message.content?.match(BUGDOG_TRIGGER);
  if (!match) return null;
  return {
    description: match[1]?.trim() || '', // 이슈 한줄 설명 (선택)
    taskId: message.taskId || null,       // 연관 태스크 ID
    channel: message.channel,
    timestamp: new Date().toISOString(),
  };
}
```

---

## 3. 자동 수집 데이터 (컨텍스트 패키지)

트리거 발화 시 Bugdog이 자동 수집하는 항목:

| 항목 | 수집 방법 | 용도 |
|:---|:---|:---|
| 최근 대화 5턴 | `logStore` 또는 `task:comments` | 증상 재현 |
| 관련 태스크 정보 | `GET /api/tasks/:id` | 발생 컨텍스트 |
| 최근 서버 에러 로그 | `server.log` 마지막 100줄 | 원인 분석 |
| 에이전트 상태 | `agentStates` Map | 오작동 에이전트 특정 |
| 현재 활성 프로젝트 | `activeProjectId` | 프로젝트 격리 확인 |

---

## 4. CASE 파일 자동 초안 생성

### 4-1. 케이스 ID 자동 채번
```js
// 기존 CASE_NNN.md 파일 개수를 읽어 다음 번호 채번
async function getNextCaseId(caseDir) {
  const files = await fs.readdir(caseDir);
  const caseFiles = files.filter(f => f.startsWith('CASE_') && f.endsWith('.md'));
  return String(caseFiles.length + 1).padStart(3, '0');
}
```

### 4-2. 파일 생성 위치
```
01_Company_Operations/05_PR_마케팅/03_Dogfooding_케이스/
  CASE_{NNN}_{자동생성_제목}.md
```

### 4-3. LLM 초안 생성 프롬프트
Bugdog이 수집한 컨텍스트 패키지를 Claude Sonnet에게 전달하여 CASE 포맷 초안을 자동 생성:

```
당신은 MyCrew의 Dogfooding 케이스 기록 담당자입니다.
다음 컨텍스트를 분석하여 CASE_NNN.md 형식으로 초안을 작성하세요.

[컨텍스트 패키지]
- 트리거 시점 대화: {최근 5턴}
- 에러 로그: {서버 로그}
- 관련 태스크: {태스크 정보}

[작성 형식]
1. 발견 일시 및 발견자
2. 증상 (사용자 관점)
3. 원인 (기술 관점, 추정 가능한 경우)
4. AI 자가 진단 (대화 중 AI 발언 인용)
5. 해결 방안 (미정인 경우 "분석 필요"로 표기)
6. 마케팅 앵글 (1줄)
7. 파생된 기능/Phase (미정인 경우 "TBD"로 표기)
8. 관련 코드/자료
```

---

## 5. 칸반 카드 자동 생성

CASE 파일 생성 후, 즉시 칸반 카드를 자동 생성:

```js
await createKanbanTask({
  title: `[Dogfooding] CASE_${caseId}: ${shortDescription}`,
  content: `자동 생성된 케이스 파일: ${caseFilePath}\n\n초안 검토 및 마케팅 앵글 보완 필요`,
  assignee: 'sonnet',           // 소넷이 초안 검토
  category: 'dogfooding',
  tags: ['#dogfooding', `#case-${caseId}`],
  priority: 'medium',
  column: 'todo',
});
```

---

## 6. CASE_INDEX.md 자동 업데이트

새 케이스 추가 시 인덱스 파일의 테이블에 자동으로 행 추가:

```js
async function updateCaseIndex(caseId, title, date, angle, phase) {
  const indexPath = '...03_Dogfooding_케이스/CASE_INDEX.md';
  const newRow = `| **[CASE_${caseId}](./CASE_${caseId}_${slug}.md)** | ${title} | ${date} | ${angle} | ${phase} |`;
  // 테이블 마지막 행 이후에 삽입
}
```

---

## 7. 프로젝트 분기 및 미니앱 고려사항

향후 **멀티 프로젝트 분기** 환경에서의 Bugdog 동작:

| 시나리오 | 대응 방안 |
|:---|:---|
| 프로젝트 A에서 트리거 발화 | 프로젝트 A 컨텍스트만 수집, 케이스에 `projectId` 태그 |
| 미니앱(외부 서비스) 오류 보고 | 미니앱 전용 CASE 카테고리 분리, 마케팅 앵글 별도 |
| 고객사 환경에서 발생한 이슈 | 익명화 처리 후 케이스화 (개인정보 포함 여부 사전 검토) |

**Bugdog 확장 로드맵:**

```
Phase 27 (현재): 기본 헬스체크 + CS 리포트
    ↓
Phase 32 (본 기획): @bugdog 기록 트리거 + CASE 자동 생성
    ↓
Phase 33 (미래): Bugdog이 CASE 패턴 분석 → 유사 이슈 사전 탐지 (예측형 QA)
```

---

## 8. 구현 우선순위 및 범위

### MVP (최소 구현)
- [ ] `@bugdog 기록` 트리거 파싱 (server.js)
- [ ] 최근 대화 5턴 + 에러 로그 수집
- [ ] LLM 초안 생성 → CASE_NNN.md 파일 저장
- [ ] 칸반 카드 자동 생성

### V2 (이후 단계)
- [ ] CASE_INDEX.md 자동 업데이트
- [ ] 텔레그램 채널 지원
- [ ] 케이스 심각도 자동 분류 (critical / bug / ux / insight)
- [ ] 소넷 검토 완료 시 → 노바에게 마케팅 앵글 작성 자동 위임

---

## 9. 구현 전 체크리스트

> Prime 검수 요청 전 소넷이 확인할 항목:

- [ ] `03_Dogfooding_케이스/` 경로 접근 권한 (Ari Engine 서버 CWD 기준)
- [ ] LLM 초안 생성에 사용할 모델 결정 (Claude Sonnet 권장)
- [ ] 칸반 카드 `category: 'dogfooding'` 컬럼 DB 스키마 존재 여부 확인
- [ ] 텔레그램 트리거와 칸반 코멘트 트리거 동시 지원 여부 (Phase 1에서 제외 가능)
- [ ] 에러 로그 파일 경로 및 접근 방식 (`fs.readFile` vs. `pm2 logs`)

---

**— 소넷 (Sonnet), 담당 기획자**  
*구현 착수 전 Prime 설계 검수를 권고합니다.*
