# 🛡️ Prime Advisor 검수 요청서 — Phase 32 Bugdog 자동화 파이프라인

**요청자:** Sonnet (Claude Sonnet 4.6, Antigravity)  
**요청 대상:** Prime (Supreme Advisor)  
**문서 유형:** 구현 전 설계 검수 요청  
**일시:** 2026-05-02  
**리뷰 번호:** 26th Review  
**연관 Phase:** Phase 27 (Bugdog 기반) → Phase 32 (Dogfooding 파이프라인 확장)

---

## 📌 한 줄 요약

> `@bugdog 기록` 한마디로 → 컨텍스트 자동 수집 → CASE 파일 초안 생성 → 칸반 카드 자동 생성까지 이어지는 **Dogfooding 자동화 파이프라인** 설계에 대한 Prime의 비판적 검수를 요청합니다.

---

## 📂 검수 대상 문서

- **기획서 원본:**  
  `02_System_Development/00_아키텍처_문서/01_PRD/Phase32_Bugdog_Dogfooding_파이프라인_기획서.md`

- **연관 케이스 파일 (Dogfooding 아카이브):**  
  `01_Company_Operations/05_PR_마케팅/03_Dogfooding_케이스/`

- **Phase 27 Bugdog 기반 리뷰 (참고):**  
  `리뷰_아카이브/15_Phase27_Bugdog_자율형CS_리뷰_Prime.md`

---

## 🎯 검수 요청 배경

### 왜 지금 설계 검수인가?

Phase 27에서 Prime이 `bugdogRunner.js` 독립 프로세스 분리를 강력 권고한 것처럼,  
이번 Phase 32는 **트리거 파싱 → LLM 호출 → 파일 쓰기 → DB 카드 생성**이 한 흐름으로 연결되는 복합 파이프라인입니다.

구현 후 구조 변경은 비용이 큽니다. **구현 착수 전 Prime의 설계 검수를 선행**합니다.

### 전략적 맥락

- Phase 27의 Bugdog은 **수동 CS 리포트** 중심이었습니다.
- Phase 32는 **능동적 Dogfooding 자동화**로 확장합니다.
- 이 파이프라인이 안정화되면, MyCrew는 "버그를 기록하는 AI"에서 **"버그를 마케팅 자산으로 전환하는 AI"** 포지셔닝이 가능해집니다.

---

## 🔍 소넷이 사전 식별한 Edge Case 및 불확실 사항

Prime께서 특히 집중해 주실 부분입니다:

### [불확실 1] 트리거 파싱 위치 — server.js vs. ariDaemon.js

```
현재 기획서: "server.js 또는 ariDaemon.js"
```

Phase 27 때 Prime이 지적했던 것처럼, **"또는"은 위험한 모호성**입니다.  
- `server.js`에 두면: HTTP 채널 및 칸반 코멘트 트리거 처리 가능. 그러나 ARI 채팅 채널과의 통합이 어색해짐.
- `ariDaemon.js`에 두면: ARI 채팅 채널 자연스러움. 그러나 Daemon 재시작 시 트리거 소실 위험.

**→ Prime의 판단: 어느 레이어에 두는 것이 아키텍처적으로 옳은가?**

---

### [불확실 2] LLM 초안 생성 호출 방식

```js
// 기획서 내 명시된 방식
// "Claude Sonnet에게 컨텍스트 패키지 전달 → CASE 초안 생성"
```

- **AntiGravity 브릿지(파일 폴링)** 방식으로 Sonnet 호출: 비동기, 최대 30초 대기.
- **동기 HTTP 방식**: 응답 즉시 파일 저장 가능. 그러나 타임아웃 위험.
- **`gemini-2.5-pro` 직접 API 호출**: 낮은 지연. 그러나 초안 품질이 Sonnet 대비 어떤가?

**→ Prime의 판단: 초안 생성 모델과 호출 방식의 최적 조합은?**

---

### [불확실 3] 파일 쓰기 경쟁 조건 (Race Condition)

```js
// 현재 채번 방식
const files = await fs.readdir(caseDir);
const caseFiles = files.filter(f => f.startsWith('CASE_') && f.endsWith('.md'));
return String(caseFiles.length + 1).padStart(3, '0');
```

- 동시에 2개의 `@bugdog 기록` 트리거가 발화되면 **같은 ID가 채번될 위험**이 있습니다.
- 현재 MyCrew는 단일 사용자 환경이지만, 향후 멀티 프로젝트·멀티 사용자 확장 시 문제 발생 가능.

**→ Prime의 판단: 단순 파일 카운팅 방식이 현 규모에서 허용 가능한가, 아니면 지금 DB 채번으로 바꿔야 하는가?**

---

### [불확실 4] 칸반 카드 `category: 'dogfooding'` DB 스키마

```js
await createKanbanTask({
  category: 'dogfooding',  // ← 이 값이 DB에 존재하는 컬럼인지 미확인
  ...
});
```

- `tasks` 테이블에 `category` 컬럼이 없거나 ENUM 제약이 있다면 **INSERT 실패** 가능.
- 구현 전 스키마 검토 vs. 구현 중 마이그레이션, 어느 접근이 맞는가?

**→ Prime의 판단: 신규 카테고리 추가 시 권장 처리 방법?**

---

### [불확실 5] 서버 로그 수집 (`server.log`) 접근 방식

```
현재 기획서: "server.log 마지막 100줄" fs.readFile 또는 pm2 logs
```

- `pm2 logs` 방식은 pm2 실행 환경에서만 유효. **개발 환경(npm run dev)에서 호환 안됨**.
- 로그 파일 경로가 환경별로 다를 수 있음 (CWD 기준 vs. 절대경로).

**→ Prime의 판단: 이식성 있는 로그 수집 방법의 권고?**

---

## 📋 검수 요청 항목 요약

| # | 항목 | 소넷 현재 입장 | Prime 판단 필요 |
|:---|:---|:---|:---|
| 1 | 트리거 파싱 레이어 | server.js 우선 검토 중 | 아키텍처 결정 필요 |
| 2 | LLM 초안 생성 방식 | AntiGravity 브릿지 우선 고려 | 모델·방식 조합 권고 |
| 3 | CASE ID 채번 Race Condition | 현 규모 허용 범위 추정 | 허용 여부 판단 |
| 4 | `category: 'dogfooding'` 스키마 | 마이그레이션 필요 예상 | 접근 방법 권고 |
| 5 | 서버 로그 수집 방식 | `fs.readFile` 우선 고려 | 이식성 검토 |

---

## 💬 소넷의 추가 메모

이 기획서는 **Phase 27 Bugdog의 자연스러운 확장**입니다.  
Phase 27 리뷰(15th)에서 Prime이 지적했던 `bugdogRunner.js` 독립 프로세스 원칙을 이번 설계에서도 계승합니다.

단, 이번 Phase 32는 **파일 쓰기 + LLM 호출 + DB 카드 생성이 한 흐름**으로 연결되어,  
Phase 27보다 실패 포인트가 더 많습니다. Prime의 날카로운 비판이 필요한 이유입니다.

---

## 📌 Prime에게 전달할 프롬프트 (대표님용)

> **대표님께:**  
> 아래 메시지를 Prime(Opus) 모델로 전송해 주시면 됩니다.

---

```
현재 생성된 리뷰 요청서를 읽어줘.

파일 위치:
02_System_Development/00_아키텍처_문서/리뷰_아카이브/26_Phase32_Bugdog_파이프라인_리뷰요청서_Prime.md

그리고 기획서 원본도 함께 읽어줘:
02_System_Development/00_아키텍처_문서/01_PRD/Phase32_Bugdog_Dogfooding_파이프라인_기획서.md

Prime Advisor로서 이 설계의 아키텍처 결함, 잠재적 버그, 그리고 더 나은 Best Practice를
비판적으로 검토해서 26th Review 리뷰 결과를 작성해줘.
특히 소넷이 명시한 5개 불확실 사항에 대해 명확한 판단을 내려줘.
```

---

**— Sonnet (소넷), 26th Review 요청 작성**  
*2026-05-02*
