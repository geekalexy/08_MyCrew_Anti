# Instagram 스크래핑 에이전트 구현 문서

> 작성일: 2026-05-06  
> 작성자: Sonnet (MyCrew)  
> 상태: ✅ POC 검증 완료 / MyCrew 엔진 통합 완료

---

## 1. 개요

MyCrew 마케팅팀(`mkt_analyst`)이 Instagram 공개 계정을 분석할 수 있도록
**아리(Ari)**가 직접 데이터를 수집하는 파이프라인을 구현했습니다.

### 핵심 설계 원칙
- 별도 API 없이 **Puppeteer 기반 브라우저 자동화**로 수집
- 로그인 세션을 `outputs/ig_session/`에 **영구 저장** → 최초 1회만 로그인
- **On-demand 실행** (상시 프로세스 없음, 요청 시만 크롬 실행)
- **headless 모드**로 엔진 환경에서 백그라운드 실행

---

## 2. 아키텍처

```
대표님 채팅
  │
  ▼
아리 (Gemini 2.5 Flash)
  │  "socian_official 인스타 분석해줘"
  │
  ▼
instagramAnalyze / instagramBatchAnalyze (Function Calling)
  │
  ▼
Puppeteer + Chrome (headless)
  │  outputs/ig_session/ 세션 재사용
  │
  ▼
Instagram 프로필 페이지
  │  og:description, og:title, 게시물 캡션 추출
  │
  ▼
결과 포맷 → 아리가 대표님에게 보고
```

### 분업 구조 (규모 확장 시)

| 단계 | 담당 | 모델 |
|------|------|------|
| 데이터 수집 | 아리 | Gemini 2.5 Flash |
| 심층 분석 · 전략 도출 | mkt_analyst | Gemini Pro / Opus |

> **현재**: 아리가 수집 + 기본 요약까지 처리 (소규모에 최적)  
> **확장 시**: 아리가 수집 → 태스크 카드에 데이터 담아 mkt_analyst에게 위임

---

## 3. 구현 파일 목록

| 파일 | 역할 |
|------|------|
| `tests/test_ig_login_scrape.js` | POC 스크립트 (수동 로그인 + 스크래핑 검증) |
| `ai-engine/tools/instagramAdapter.js` | MyCrew 엔진 통합 어댑터 |
| `ai-engine/ariDaemon.js` | Tool 스키마 + executeTool 핸들러 등록 |
| `skill-library/instagram-analysis/SKILL.md` | 아리 스킬 등록 (툴 활성화) |
| `docs/ARI_BRAIN.md` | 아리 브레인 도구 목록 업데이트 |
| `outputs/ig_session/` | 로그인 세션 저장 경로 (삭제 금지) |

---

## 4. 수집 데이터 항목

| 항목 | 방법 | 안정성 |
|------|------|--------|
| 팔로워 수 | `og:description` 파싱 | ⭐⭐⭐ 높음 |
| 팔로잉 수 | `og:description` 파싱 | ⭐⭐⭐ 높음 |
| 게시물 수 | `og:description` 파싱 | ⭐⭐⭐ 높음 |
| 계정명 | `og:title` 파싱 | ⭐⭐⭐ 높음 |
| 바이오 | CSS 셀렉터 (`header section`) | ⭐⭐ 중간 |
| 최근 게시물 캡션 | `article img[alt]` | ⭐⭐ 중간 |
| 인증 뱃지 | SVG aria-label | ⭐⭐ 중간 |

> **왜 og:description이 안정적인가?**  
> Instagram이 SEO용으로 제공하는 메타태그라 HTML 구조가 바뀌어도 유지됨.  
> CSS 셀렉터는 Instagram의 내부 클래스 변경 시 깨질 수 있음.

---

## 5. 아리에게 사용하는 방법

### 스킬 장착 (최초 1회)
```
"아리야, instagram-analysis 스킬 장착해줘"
```

### 단일 계정 분석
```
"socian_official 인스타 분석해줘"
"@nike 팔로워 얼마야?"
"https://www.instagram.com/samsung_korea/ 분석해줘"
```

### 배치 분석 (최대 10개)
```
"socian_official, nike, adidas, zara 4개 계정 한번에 인스타 분석해줘"
"경쟁사 SNS 리스트 분석해줘: abc, def, ghi"
```

---

## 6. 세션 관리

### 최초 로그인 (1회만)
```bash
cd /Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진
~/.nvm/versions/node/v24.14.1/bin/node tests/test_ig_login_scrape.js socian_official
```
→ 크롬 열림 → 아이디/비밀번호 자동 입력 → 로그인 버튼 클릭 → 자동 스크래핑

### 세션 만료 시
아리가 "세션이 만료되었습니다" 안내 → 위 명령 재실행

### 세션 저장 경로
```
outputs/ig_session/   ← 절대 삭제 금지
```

---

## 7. 제한 사항

| 항목 | 내용 |
|------|------|
| 비공개 계정 | 수집 불가 (og:description 미제공) |
| 응답 시간 | 계정당 10~15초 (headless 브라우저 실행 시간) |
| 배치 최대 | 10개 |
| 로그인 계정 | 개인 인스타 계정 1개 세션 사용 |
| 봇 감지 위험 | 과도한 반복 요청 시 Instagram 계정 제한 가능성 |

---

## 8. 안티브릿지 에이전트 (mkt_analyst 등)가 직접 못 쓰는 이유

**아리**는 Gemini Function Calling Loop를 통해 툴을 실행.  
**안티브릿지 에이전트**는 `executor.js`에서 텍스트 출력만 — Function Calling 루프 없음.

→ 현재 구조에서 데이터 수집은 아리가 담당, 에이전트는 분석만 담당하는 것이 맞음.  
→ 에이전트 자율 수집은 executor.js에 Function Calling 루프 추가 필요 (향후 고도화 옵션).

---

## 9. POC 검증 결과

- **대상 계정**: `@socian_official`
- **수집 성공 항목**: 팔로워 36명, 팔로잉 8명, 게시물 13개, 바이오, 게시물 캡션 다수
- **로그인 방식**: 자동 입력 + 수동 버튼 클릭 하이브리드
- **세션 재사용**: ✅ 2회차부터 로그인 없이 즉시 스크래핑

---

## 10. 향후 개선 계획

- [ ] `mkt_analyst` 파이프라인 연동 (아리 수집 → 태스크 카드 자동 생성)
- [ ] 수집 결과 JSON 자동 저장 및 이력 관리
- [ ] 세션 만료 자동 감지 후 Slack/채팅 알림
- [ ] executor.js Function Calling 루프 추가 (에이전트 자율 수집, 장기 로드맵)

---

## 11. Q&A — 설계 의사결정 기록

> 실제 운영 중 발생한 질문과 결론을 기록합니다.

---

**Q1. 수집과 분석을 아리 혼자 하는 것인가? 나중에 분업이 가능한가?**

A. 현재는 아리가 수집 + 기본 요약까지 처리한다. 규모가 커지거나 분석 고도화가 필요하면 다음 파이프라인으로 전환한다.

```
아리 → 인스타 데이터 수집
  → 태스크 카드에 raw 데이터 포함
    → mkt_analyst → 심층 분석 · 전략 도출 → 보고
```

이 분업 구조는 코드 수정 없이 아리의 카드 생성 방식만 바꾸면 즉시 적용 가능하다.

---

**Q2. 안티브릿지 에이전트(mkt_analyst 등)는 왜 instagramAnalyze 툴을 직접 못 쓰나? 아리로 충분해서 안 준 것인가?**

A. '충분해서'가 아니라 **실행 경로(아키텍처)가 다르기 때문**이다.

| 구분 | 실행 방식 | 툴 사용 가능 여부 |
|------|---------|---------------|
| 아리 (ariDaemon.js) | Gemini Function Calling Loop | ✅ 가능 |
| 안티브릿지 에이전트 (executor.js) | 텍스트 출력 전용 | ❌ 불가 |

에이전트에게 툴을 주려면 executor.js에 Function Calling 루프를 별도 구현해야 한다. 현재 구조에서는 아리가 수집 → 에이전트가 분석하는 파이프라인이 가장 효율적이다.

---

**Q3. 아리의 모델(Gemini 2.5 Flash)이 수집 작업에 충분한가?**

A. 충분하다. 수집 시 LLM이 하는 일은 다음으로 제한된다.

1. 사용자 의도 파악 ("이 계정 분석해줘") → Flash 충분
2. 어떤 툴을 호출할지 판단 → Flash 충분
3. 실제 스크래핑 → **Puppeteer(Node.js)가 처리, LLM 무관**
4. 반환된 JSON 데이터 포맷 → Flash 충분

Gemini 2.5 Pro가 필요한 시점은 수집 데이터를 기반으로 **경쟁사 전략 분석, 콘텐츠 인사이트 도출** 같은 복잡한 추론이 필요할 때이며, 이때 mkt_analyst(Pro/Opus)에게 위임하는 분업이 의미있다.

---

**Q4. instagram-analysis 스킬을 항상 장착 상태로 두면 부작용이 있나?**

A. 실질적 부작용 두 가지가 있으나 모두 경미하다.

| 항목 | 영향 | 수준 |
|------|------|------|
| 토큰 증가 | SKILL.md (~300토큰)가 매 대화 시스템 프롬프트에 포함 | 무시할 수준 |
| 의도치 않은 툴 호출 | "인스타" 키워드에 반응해 원하지 않는 수집 가능성 | 매우 드문 경우 |

**권장 운영 방침**:
- 마케팅 프로젝트 → **항상 장착** (기본값)
- 개발팀 프로젝트 → **필요할 때만 장착**

---

**Q5. 개발팀만 있는 프로젝트에서도 스킬 라이브러리 UI로 아리에게 장착할 수 있나?**

A. ✅ 가능하다. `agentOnly: "assistant"` 설정은 "어느 에이전트의 스킬 드로어에 표시되냐"를 제한하는 것이지, 프로젝트 유형을 제한하는 것이 아니다.

개발팀 프로젝트에서도 **아리의 스킬 패널(+ 스킬 버튼)** 을 열면 `instagram-analysis`가 "장착 가능" 목록에 보이고 즉시 장착할 수 있다. 단, 마케팅 프리셋으로 생성한 프로젝트가 아니므로 **자동 장착은 되지 않고 수동으로 장착**해야 한다.

---

**Q6. 처음 아리에게 스킬 장착을 요청했을 때 실패한 이유는?**

A. 두 가지 원인이 복합 작용했다.

1. **DB write 후 T-06 orphan 체크 즉시 삭제**: 아리가 `manageAgentSkills` 툴로 DB에 스킬을 저장했지만, `contextInjector.js`가 다음 요청에서 skill-library를 스캔해 `instagram-analysis` 폴더가 없으면 orphan으로 분류해 삭제한다.
2. **아리가 "장착 완료" 응답 후 실제 수집 시 환각**: 툴 없이 일반 지식으로 답변 → 팔로워 수 등 수치 데이터 오류 발생.

**해결책으로 적용된 개선사항**:
- `manageAgentSkills` 핸들러에 사전 검증 로직 추가 → 존재하지 않는 스킬 ID 장착 시도 시 에러 + 유효 스킬 목록 즉시 반환
- skill-library에 SKILL.md 생성 후 DB에 직접 등록으로 즉시 해결

---

*최종 업데이트: 2026-05-06*
