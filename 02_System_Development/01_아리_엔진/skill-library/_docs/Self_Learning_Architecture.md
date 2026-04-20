# 🧠 MyCrew Self-Learning Architecture
**Skill Digest & Auto-Prompt Overwrite System**

> 버전: v1.0
> 작성: Luca (CTO) — 2026-04-18
> 분류: 핵심 아키텍처 설계 문서 (공식 기록)
> 위상: executor.js 구현 + 원리 설명 + 자동화 설계 통합본

---

## 1. 개념 원리: "왜 LLM이 학습한 것처럼 보이는가?"

### 핵심 착각의 정체

LLM(에이전트)는 **weights를 스스로 바꾸지 않는다.**
진짜 비밀은 **SKILL.md 파일이 곧 System Prompt**라는 점이다.

```
┌──────────────────────────────────────────────────────────────────┐
│  LLM 모델 weights = 고정 (변하지 않음)                           │
│                                                                  │
│  매 요청 시 → executor.js가 SKILL.md를 읽어 System Prompt 구성  │
│                                                                  │
│  SKILL.md가 업데이트됨 → Prompt가 업데이트됨                   │
│                          → 에이전트 행동이 바뀜                 │
│                                                                  │
│  이게 "학습처럼 보이는" 원리 (Prompt Engineering Learning)      │
└──────────────────────────────────────────────────────────────────┘
```

### Fine-tuning vs Self-Learning 비교

| 구분 | Fine-tuning | MyCrew Self-Learning |
|:---|:---|:---|
| **방식** | 모델 weights 재학습 | SKILL.md(Prompt) 업데이트 |
| **비용** | GPU + 수백만원 | Flash 모델 호출 (거의 0원) |
| **반영 속도** | 수일~수주 | 카드 완료 직후 즉시 |
| **투명성** | 블랙박스 | SKILL.md 파일로 직접 확인 가능 |
| **롤백** | 거의 불가 | SKILL.md 파일 수정으로 즉시 롤백 |
| **제어** | 불가 | 대표님이 직접 읽고 편집 가능 |

---

## 2. 데이터 흐름: 카드 완료 → SKILL 업데이트 전체 사이클

```
[칸반 카드 완료 (Done)]
         │
         ▼
[executor.js 평가]
   evaluation.score >= 0.8? ──NO──▶ 로그 없음 (실패 케이스는 별도)
         │YES
         ▼
[Self-Learning 로그 작성] ──────────────────────────────────────┐
   SKILL.md 파일 끝에 append:                                   │
   ### [2026-04-18] Self-Learning Pattern 🧠                    │
   - 패턴: [MARKETING] FOMO형 Hook 저장율 3배 효과             │
   - 모델: gemini-2.0-flash                                     │
   - 카테고리: MARKETING                                        │
   - 스코어: 0.92                                               │
         │                                                      │
         ▼                                                      │
[autoDigestSkill() 비동기 호출]                                 │
   ↳ 로그 수 카운트: ### [20YY-MM-DD] 패턴                      │
   ↳ 3개 미만 → 대기 중 (축적 중)                               │
   ↳ 3개 이상 → Digest 실행 ───────────────────────────────────┘
         │
         ▼
[gemini-2.0-flash Digest 호출]
   입력: 현재 ACTIVE PROMPT + Self-Learning 로그
   지시: 실패 패턴 → 금지 규칙 흡수, 500자 이내 ACTIVE PROMPT 재출력
         │
         ▼
[SKILL.md 업데이트]
   frontmatter 보존 + 새 ACTIVE PROMPT + 기존 LOG 보존
         │
         ▼
[skillCache.delete(category)]
   ↳ 5분 TTL 캐시 무효화
   ↳ 다음 요청에서 새 버전 자동 로드
         │
         ▼
[다음 에이전트 호출]
   → 업데이트된 SKILL.md가 System Prompt로 주입됨
   → 에이전트가 새 행동 패턴으로 응답
```

---

## 3. Self-Learning 로그 구조 (실제 파일 형식)

SKILL.md는 **2개 섹션**으로 구성된다:

```markdown
---
name: marketing-skill
description: |
  [트리거 조건 - 에이전트가 이 스킬을 발동할지 판단하는 텍스트]
---

# ACTIVE PROMPT
[에이전트의 실제 행동 규칙 - AutoDigest가 이 부분을 업데이트]
## 핵심 실행 규칙
1. FOMO형 Hook 우선 적용 (저장율 3배 검증됨)
2. 의문형 시작 + 숫자 조합 최우선 패턴
⛔ 금지: 역발상형 Hook (이 브랜드 톤과 충돌 확인됨)

---

## 실패 케이스 & 개선 로그

### [2026-04-13] Self-Learning Pattern 🧠
- **패턴**: [MARKETING] FOMO형 Hook 저장율 3배 효과
- **모델**: gemini-2.0-flash
- **카테고리**: MARKETING
- **스코어**: 0.92

### [2026-04-14] Self-Learning Pattern 🧠
- **패턴**: [MARKETING] 의문형 시작 댓글 유도율 향상
- **모델**: gemini-2.0-flash
- **카테고리**: MARKETING
- **스코어**: 0.88

### [2026-04-15] Self-Learning Pattern 🧠
- **패턴**: [MARKETING] 역발상형 Hook 브랜드 톤 불일치
- **모델**: gemini-2.0-flash
- **카테고리**: MARKETING
- **스코어**: 0.85
```

→ 3번째 로그 append 직후 `autoDigestSkill()` 발동 → ACTIVE PROMPT 자동 갱신

---

## 4. 스킬 버전 진화 시뮬레이션

```
marketingSkill
│
├─ v1.0  [초기 장착]
│    ACTIVE PROMPT: "Hook 패턴 6가지 중 상황에 맞게 선택"
│    → LLM은 6가지를 균등 확률로 선택
│
├─ v1.1  [로그 3개 → AutoDigest 1회차]
│    Self-Learning 흡수:
│    "FOMO형이 저장율 3배" + "의문형 시작 효과 확인"
│    ACTIVE PROMPT 업데이트:
│    "⭐ 승자 레시피: FOMO형 + 의문형 시작 (저장율 3배)"
│    → LLM은 이제 FOMO형을 90%+ 선택
│
└─ v1.2  [로그 6개 → AutoDigest 2회차]
     Self-Learning 흡수:
     "역발상형은 이 브랜드 톤과 충돌 사례 2건"
     ACTIVE PROMPT 업데이트:
     "⭐ FOMO형 + 의문형 최우선"
     "⛔ 역발상형: 절대 금지 (브랜드 톤 충돌 2회 검증)"
     → LLM이 역발상형을 스스로 회피
```

---

## 5. 실제 구현 코드 (executor.js)

### 5.1 SKILL.md 캐시 로더

```javascript
// ─── SKILL.md 캐시 (서버 생존 주기 동안 유지) ─────────────────
const skillCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분 TTL

const SKILL_PATH_MAP = {
  'MARKETING':  'skill-library/02_marketing/SKILL.md',
  'CONTENT':    'skill-library/03_content/SKILL.md',
  'ANALYSIS':   'skill-library/04_analysis/SKILL.md',
  'DESIGN':     'skill-library/05_design/SKILL.md',
  'ROUTING':    'skill-library/01_routing/SKILL.md',
  'KNOWLEDGE':  'skill-library/06_research/SKILL.md',
  'WORKFLOW':   'skill-library/08_workflow/SKILL.md',
};

function loadSkillDocument(category) {
  const now = Date.now();
  const cached = skillCache.get(category);
  
  // Hit: 캐시가 유효하면 즉시 반환
  if (cached && (now - cached.loadedAt) < CACHE_TTL_MS) {
    return cached.content;
  }
  
  // Miss: 파일 로드 후 캐시에 저장
  const relativePath = SKILL_PATH_MAP[category];
  const raw = fs.readFileSync(fullPath, 'utf-8');
  
  // YAML frontmatter 제거 후 본문만 추출
  const bodyStart = raw.indexOf('---', raw.indexOf('---') + 3);
  const body = bodyStart > 0 ? raw.slice(bodyStart + 3).trim() : raw;
  
  // 토큰 예산 제어: 최대 500자 트렁케이션
  const truncated = body.length > 500
    ? body.slice(0, 500) + '\n\n[...truncated for token budget]'
    : body;
  
  skillCache.set(category, { content: truncated, loadedAt: now });
  return truncated;
}
```

### 5.2 Self-Learning 로그 Writer

```javascript
// [Week 2: Self-Learning 흡수] — executor.js run() 함수 내부
if (result.text && evaluation.score >= 0.8) {
  const activeSkillPath = SKILL_PATH_MAP[evaluation.category];
  if (activeSkillPath) {
    const fullSkillPath = path.resolve(process.cwd(), activeSkillPath);
    if (fs.existsSync(fullSkillPath)) {
      // PII 스크러빙 후 로그 작성
      const scrubbedReason = scrubber.sanitize(evaluation.reason || '패턴화됨');
      const logEntry = `\n### [${new Date().toISOString().slice(0,10)}] Self-Learning Pattern 🧠\n` +
        `- **패턴**: [${evaluation.category}] ${scrubbedReason}\n` +
        `- **모델**: ${result.model}\n` +
        `- **카테고리**: ${evaluation.category}\n` +
        `- **스코어**: ${evaluation.score}\n`;
      fs.appendFileSync(fullSkillPath, logEntry);
      
      // AutoDigest 비동기 트리거 (응답 블로킹 없음)
      Promise.resolve().then(() =>
        autoDigestSkill(fullSkillPath, evaluation.category)
      );
    }
  }
}
```

### 5.3 Auto-Digest LLM 호출 (핵심)

```javascript
const DIGEST_THRESHOLD = 3; // 로그 3개 이상이면 다이제스트 실행

async function autoDigestSkill(fullSkillPath, category) {
  try {
    const raw = fs.readFileSync(fullSkillPath, 'utf-8');

    // Self-Learning 엔트리 수 카운트
    const logCount = (raw.match(/^### \[20\d\d-/gm) || []).length;
    if (logCount < DIGEST_THRESHOLD) return; // 아직 축적 중

    // ACTIVE PROMPT / LOG 섹션 분리
    const [frontmatter, body] = splitFrontmatter(raw);
    const logSeparatorIdx = body.indexOf('\n---\n');
    const activePromptBlock = body.slice(0, logSeparatorIdx);
    const logBlock = body.slice(logSeparatorIdx);

    // Flash 모델로 저비용 다이제스트
    const digestResult = await geminiAdapter.generateResponse(
      `[현재 ACTIVE PROMPT]\n${activePromptBlock}\n\n` +
      `[Self-Learning 로그]\n${logBlock}\n\n` +
      `지시:\n` +
      `1. 로그의 성공/실패 패턴을 완전히 파악한다\n` +
      `2. 실패 패턴은 '금지' 룰로 흡수, 성공 패턴은 '승자 레시피'로 등재\n` +
      `3. 업데이트된 ACTIVE PROMPT만 500자 이내로 출력\n` +
      `4. 다른 텍스트, 설명, 주석 일체 금지`,
      '당신은 AI 에이전트 스킬 최적화 시스템입니다.',
      'gemini-2.0-flash'
    );

    const newActivePrompt = digestResult.text.trim().slice(0, 500);
    
    // 새 SKILL.md = frontmatter + 새 ACTIVE PROMPT + 기존 LOG 보존
    const newContent = `${frontmatter}\n${newActivePrompt}\n${logBlock}`;
    fs.writeFileSync(fullSkillPath, newContent, 'utf-8');
    
    // 캐시 무효화 → 다음 요청에서 새 버전 로드
    skillCache.delete(category);
    
  } catch (err) {
    console.warn(`[AutoDigest] ${category} 실패 (무시):`, err.message);
    // 서비스 영향 없음: catch로 조용히 흡수
  }
}
```

---

## 6. 보안 설계: PII Scrubbing

Self-Learning 로그에는 **회사명, 고객 정보, 내부 전략** 등 기밀이 포함될 수 있다.
이를 방지하기 위해 `scrubbing.js`가 로그 기록 전에 개인정보를 제거한다.

```javascript
// scrubber.sanitize() 처리 흐름
"소시안 고객 데이터 분석 요청" 
  → "[COMPANY] 고객 데이터 분석 요청"  // 회사명 마스킹
  → SKILL.md에 저장
```

**3단계 정보 격리 원칙:**

```
[Public Layer]  에이전트 스킬 설명 (공개 가능)
      ↑
[Team Layer]    CCB, 카드 히스토리 (팀 내부)
      ↓
[Tenant Layer]  고객 정보, API 키 (절대 격리 + Scrubbing)
```

Tenant Layer 데이터는 어떤 모델에도 학습 데이터로 제공되지 않는다.

---

## 7. KSI-R: 스킬 학습 효과 지표

CKS 연구 프레임워크에서 정의된 **KSI-R (Knowledge Sync Index - Rule Survival Rate)**

> **정의**: 특정 Sprint에서 실패로 기록된 금지 조항이 다음 Sprint에 에이전트 행동에 반영된 비율

```
KSI-R = (다음 Sprint에서 동일 실패 패턴이 사라진 건수) 
        ÷ (금지 조항으로 등록된 총 건수) × 100%

목표: KSI-R ≥ 80% (8번 중 6번 이상 실수를 반복하지 않음)
```

KSI-R이 높아질수록 AutoDigest가 정확히 작동하고 있다는 정량적 증거가 된다.
이 수치는 MyCrew 대시보드의 에이전트 성과 탭에서 추적된다.

---

## 8. 미래 확장: 실패 케이스 자동 로깅

**현재 구현 상태**: 성공 케이스만 자동 로깅 (`score >= 0.8`)

**다음 버전 설계 (v2.0)**:

```javascript
// 실패 케이스 자동 로깅 (score < 0.5)
if (result.text && evaluation.score < 0.5) {
  const failureLog = `\n### [${date}] ⛔ Failure Case\n` +
    `- **실패 패턴**: ${scrubbedReason}\n` +
    `- **스코어**: ${evaluation.score}\n` +
    `- **즉시 금지**: YES → 다음 Digest에서 규칙화\n`;
  fs.appendFileSync(fullSkillPath, failureLog);
}
```

→ 실패 즉시 로그 → 3번 누적 → AutoDigest → 금지 규칙 자동 삽입
→ 에이전트가 같은 실수를 반복하지 않는 완전 자율 학습 루프 완성

---

## 9. 전체 아키텍처 다이어그램

```
┌────────────────────────────────────────────────────────────────────┐
│                      MyCrew Self-Learning Pipeline                  │
│                                                                    │
│  사용자 요청                                                        │
│      │                                                             │
│      ▼                                                             │
│  [executor.js]                                                     │
│      ├─ systemShieldSkill() ─── 차단시 즉시 반환                   │
│      ├─ modelSelector.selectModel() ─── 카테고리 + 스코어 도출    │
│      ├─ loadSkillDocument(category) ─── SKILL.md → System Prompt  │
│      │       └─ skillCache (TTL 5분)                               │
│      ├─ loadSoulContext() ─── MYCREW.md + IDENTITY.md 주입        │
│      ├─ geminiAdapter.generateResponse() ─── LLM 호출             │
│      │                                                             │
│      └─ [응답 후 비동기]                                           │
│              ├─ score >= 0.8 → fs.appendFileSync(SKILL.md)        │
│              │   (Self-Learning 로그 기록)                          │
│              │                                                     │
│              └─ autoDigestSkill() ← Promise.resolve().then()      │
│                      ├─ 로그 < 3개: 대기                           │
│                      ├─ 로그 >= 3개: Flash LLM Digest 호출        │
│                      ├─ SKILL.md 덮어쓰기                          │
│                      └─ skillCache.delete() ─── 캐시 무효화        │
│                                                                    │
│  다음 요청                                                          │
│      └─ 새 SKILL.md가 System Prompt로 주입됨                      │
│         → 에이전트 행동이 업데이트됨                               │
└────────────────────────────────────────────────────────────────────┘
```

---

## 10. 연결 문서

| 문서 | 경로 | 용도 |
|:---|:---|:---|
| executor.js | `02_System_Development/01_아리_엔진/ai-engine/executor.js` | 실제 구현체 |
| mycrew-core-protocol | `skill-library/mycrew-core-protocol/SKILL.md` | 스킬 성장 메커니즘 정책 |
| skill-creator | `skill-library/00_skill-creator/SKILL.md` | 스킬 설계 방법론 |
| CKS 최종 확정안 | `04_Dual-Model Insights_v1/🔬 CKS_연구프레임워크/06_최종통합권장안_확정.md` | KSI-R 연구 맥락 |
| strategic_memory | `01_Company_Operations/04_HR_온보딩/strategic_memory.md` | 프로젝트 헌법 |

---

*작성: Luca (MyCrew CTO) — 2026-04-18*
*이 문서는 MyCrew 지능 아키텍처의 Self-Learning 핵심 원리와 구현을 통합한 공식 기록입니다.*
