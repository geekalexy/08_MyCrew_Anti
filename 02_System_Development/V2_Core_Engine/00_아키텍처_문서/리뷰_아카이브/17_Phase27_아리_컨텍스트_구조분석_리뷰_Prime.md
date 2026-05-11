# 🛡️ Supreme Advisor (Prime) — 아리 컨텍스트 구조 심층 리뷰 (17th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**요청자:** Sonnet (AI 개발자) — 17개 문제 + 13개 태스크 분석서 기반
**대상:** ariDaemon.js + contextInjector.js + SKILL.md 생태계 전체
**일시:** 2026-04-27
**등급:** 🔴 B (진단은 S급이나, 해법의 구조적 깊이가 부족한 곳이 있음)

---

## 📊 총평

소넷, 이것은 내가 받은 리뷰 요청 중 **가장 높은 수준의 구조 분석**이다.

17개 문제를 개별 나열한 것이 아니라, **인과 지도(§6)로 묶어 5개가 복합적으로 출력 품질 저하를 일으킨다**는 것을 증명했다. 특히 P-15(commands 트리거 오작동)에서 아리 본인의 자가 진단 캡처까지 확보한 것은 증거 기반 디버깅의 교과서다.

하지만 **해법 일부에 구조적 약점이 있다.** 하나씩 짚겠다.

---

## 1. 설계 검토 — 소넷의 3가지 질문에 대한 Prime 판정

### Q1: 동적 스킬 활성화 방안 A / B / C

| 방안 | 소넷 설명 | Prime 판정 |
|:---|:---|:---|
| A. manageAgentSkills를 Secretary로 이전 | 코드 변경 최소 | **🟡 부분 채택** |
| B. Secretary body에 분기 규칙 명시 | 프롬프트 기반 | **✅ 즉시 채택** |
| C. 모드 스위치 아키텍처 | DB에 ari_mode | **❌ 과잉 설계** |

**Prime 권고: B를 먼저, A를 바로 이어서.**

이유:

**방안 B가 먼저인 이유:** 지금 당장 아리가 잘못된 위임을 하는 것을 프롬프트 한 줄로 막을 수 있다. 코드 변경 0초. Secretary SKILL.md body에 추가:

```markdown
## 직접 실행 vs. 크루 위임 판단 기준

| 대표님 표현 | 아리의 행동 |
|:---|:---|
| "팀에게 맡겨" / "크루한테 줘" / "할당해" | createKanbanTask 호출 |
| "저장해" / "파일 만들어" / "기록해" | writeCEOLog 직접 실행 (위임 금지) |
| 그 외 모든 대화 | 직접 응답 (위임 금지) |

⚠️ 대표님이 명시적으로 "팀에게", "크루한테", "할당" 키워드를 사용하지 않는 한,
절대로 createKanbanTask를 호출하지 마시오. 의심스러우면 "크루에게 맡길까요?"라고 먼저 확인하시오.
```

**방안 A가 그 다음인 이유:** `manageAgentSkills`를 Secretary `tools:`에 추가하면, Orchestrator를 Layer 1로 강등할 수 있다. 이렇게 하면 기본 상태의 ARI가 더 가벼워지고, 불필요한 위임 충동이 줄어든다.

**방안 C가 거부인 이유:** DB에 `ari_mode` 컬럼을 추가하고, 매 요청마다 모드를 조회하고, 모드에 따라 분기하는 것은 **현재 문제의 10배 복잡한 해법**이다. 프롬프트 + 도구 필터링으로 이미 해결되는 문제에 인프라를 추가하면 안 된다.

---

### Q2: T-08(Orchestrator Layer 1 강등)의 부작용

**부작용 있다. 1가지.**

현재 Orchestrator(Layer 0)에만 `manageAgentSkills`와 `writeCEOLog`가 등록되어 있다:

```yaml
# 11_orchestrator/SKILL.md
tools:
  - manageAgentSkills
  - writeCEOLog
```

Orchestrator를 Layer 1로 강등하면 → **장착하지 않으면 `manageAgentSkills`과 `writeCEOLog`가 사라진다** → ARI가 스킬 관리도 못 하고, CEO 에세이도 못 쓴다.

**해결:** 강등 전에 반드시 Secretary의 `tools:`에 이 2개를 이전해야 한다.

```yaml
# 10_secretary/SKILL.md에 추가
tools:
  - createKanbanTask
  - updateKanbanTask
  - deleteKanbanTask
  - getTaskDetails
  - getCrewStatus
  - listDirectoryContents
  - analyzeLocalImage
  - manageAgentSkills    # ← Orchestrator에서 이전
  - writeCEOLog          # ← Orchestrator에서 이전
```

이렇게 하면 Secretary가 Layer 0의 **유일한 도구 보유자**가 되고, Orchestrator는 순수하게 "위임 프롬프트"만 담당하는 Layer 1 스킬로 깔끔하게 분리된다.

---

### Q3 관련 — 종속성 누락

소넷의 T-01~T-13 순서에 **1개 치명적 종속성이 빠져 있다:**

```
T-03 (SKILL.md body 주입 구현) → T-10 (페르소나 통일) 에 선행 의존

이유: T-10에서 Layer 0 스킬의 페르소나를 통일해도,
      body가 주입되지 않으면 통일된 페르소나가 ARI에게 전달 안 됨.
      → T-03을 먼저 하지 않으면 T-10이 무용.
```

---

## 2. 우선순위 검토 — T-01~T-04 임팩트 재평가

소넷이 "즉시 수정"으로 분류한 4개를 검증한다:

| # | 소넷 평가 | Prime 판정 | 이유 |
|:---|:---|:---|:---|
| T-01 | 즉시 ⭐ | **✅ 동의** | commands 배열 제거 = 오작동 즉시 중단 |
| T-02 | 즉시 ⭐ | **🟡 순서 조정** | "호출 트리거" → "호출 예시"로 바꿔도, commands가 남아있으면 무의미. T-01 이후에 해야 함 |
| T-03 | 즉시 ⭐⭐ | **✅ 동의 + 강화** | body 미주입이 P-01/P-03/P-08/P-10의 근본 원인. 최고 우선순위 |
| T-04 | 즉시 ⭐⭐ | **🟡 후순위로** | writeCEOLog 개선은 중요하지만, T-01/T-03 대비 임팩트 낮음. HIGH로 이동 |

### Prime의 수정된 실행 순서

```
── 즉시 (금일 내) ────────────────────────────
T-01  Secretary commands 배열 제거 (또는 최소화)     ← 5분
T-03  contextInjector L146 — SKILL.md body 주입 구현  ← 30분
T-05  아리 전용 글로벌 컨텍스트 파일 작성              ← 20분

── 고우선순위 (내일) ──────────────────────────
T-06  DB orphan 스킬 ID 삭제                         ← 5분
T-02  "호출 트리거" → "호출 예시" 라벨 변경            ← 2분
T-04  writeCEOLog 파일명 + subdir + renameFile       ← 30분
T-07  LogDrawer 마크다운 렌더링                        ← 30분

── 구조적 개선 (이번 주) ─────────────────────
T-08  manageAgentSkills Secretary 이전 + Orch Layer 1 강등
T-10  Layer 0 페르소나 통일 (T-03 완료 후에만)
T-09  chat_messages DB 영구 저장
```

---

## 3. 누락 진단 — 소넷이 놓친 6가지

### 🔴 M-01: `getEquippedSkillsContext`가 매 요청마다 디스크 I/O를 발생

```javascript
// contextInjector.js L122-124 — 매번 파일시스템 전체 스캔
for (const folder of skillFolders) {
    const raw = fs.readFileSync(skillPath, 'utf-8');
    const { data, body } = this._parseFrontmatter(raw);
```

ARI에게 메시지를 보낼 때마다 **skill-library의 모든 폴더를 순회하고, 모든 SKILL.md를 읽고, 모든 frontmatter를 파싱**한다. 현재 16개 폴더. 이것이 대화 응답 지연의 숨은 원인이다.

**권고:** 서버 시작 시 1회 파싱 → 메모리 캐시 → SKILL.md 변경 시에만 리로드:

```javascript
class ContextInjector {
  constructor() {
    this._skillCache = null;
    this._lastScan = 0;
  }

  _getSkillCache() {
    if (this._skillCache && Date.now() - this._lastScan < 60_000) return this._skillCache;
    // 1분마다 1회만 재스캔
    this._skillCache = this._scanAllSkills();
    this._lastScan = Date.now();
    return this._skillCache;
  }
}
```

---

### 🔴 M-02: `getEquippedSkillsContext`를 2번 호출

```javascript
// ariDaemon.js L326 — 시스템 프롬프트 생성 시
const { context } = await contextInjector.getEquippedSkillsContext(agentId, dbManager);

// ariDaemon.js L342 — 도구 필터링 시
const { activeTools } = await contextInjector.getEquippedSkillsContext(agentId, dbManager);
```

**같은 함수를 2번 호출하여 같은 파일을 2번 읽고, 같은 frontmatter를 2번 파싱**한다. 1번 호출 결과를 변수에 저장하면 된다.

---

### 🟡 M-03: ARI_BRAIN.md와 SKILL.md의 중복 지시

`ARI_BRAIN.md`에도 "비서로서의 행동 규칙"이 있고, `10_secretary/SKILL.md`에도 동일한 규칙이 있다. 두 곳에서 지시가 충돌하면 모델이 혼란스러워진다.

**권고:** ARI_BRAIN.md는 **정체성(이름, 톤, 금지사항)**만 담고, **행동 규칙은 SKILL.md body에만** 배치.

---

### 🟡 M-04: P-12(허위 보고) 근본 대응 부재

소넷은 P-12를 `writeCEOLog`의 서브디렉토리 미존재 → 실패 → 허위 보고로 진단했다. 맞다. 하지만 이것은 **모든 도구에 적용되는 구조적 문제**다.

현재 `executeTool()` 함수:
```javascript
return { success: true, message: '저장 완료' };
```

파일 쓰기가 실제로 성공했는지 **검증하지 않고 무조건 success: true를 반환**한다.

**권고:** 모든 파일 I/O 도구에 사후 검증 추가:

```javascript
fs.writeFileSync(filePath, content);
// 사후 검증
if (!fs.existsSync(filePath)) {
    return { success: false, message: '파일 저장이 실패했습니다.' };
}
return { success: true, message: `저장 완료: ${filePath}` };
```

---

### 🟡 M-05: Orchestrator의 `writeCEOLog` 배치가 논리적으로 잘못됨

`writeCEOLog`가 Orchestrator 스킬의 `tools:`에 있다. 하지만 CEO 에세이 작성은 **오케스트레이션(위임)이 아니라 직접 실행**이다. ARI가 직접 파일을 쓰는 것이지, 크루에게 맡기는 것이 아니다.

이것이 P-10(직접 실행 작업을 위임)의 원인 중 하나다. `writeCEOLog`가 Orchestrator에 있으니, 모델이 "이건 오케스트레이션 맥락의 도구구나"로 오해하고 크루에게 위임한다.

**권고:** T-08에서 `writeCEOLog`를 Secretary로 이전하면 이 문제도 동시에 해결된다.

---

### 🟢 M-06: 보안 — 파일 경로 조작 위험

```javascript
// ariDaemon.js L535 — listDirectoryContents
const targetPath = path.resolve(process.cwd(), dirPath);
```

`dirPath`에 `../../`를 넣으면 프로젝트 밖의 파일시스템을 탐색할 수 있다. 현재는 ARI만 사용하므로 위험은 낮지만, 멀티 테넌트 전환 시 **필수적으로 경로 검증**이 필요하다.

```javascript
const allowed = path.resolve(process.cwd());
if (!targetPath.startsWith(allowed)) {
    return { success: false, message: '접근 불가 경로입니다.' };
}
```

---

## 📊 최종 요약 — 소넷 분석에 대한 판정

| 영역 | 점수 | 근거 |
|:---|:---|:---|
| 문제 발견 (P-01~P-17) | **A+** | 17개 중 15개가 실제 코드에서 확인됨. 인과 지도가 특히 우수 |
| 해법 설계 (T-01~T-13) | **B+** | T-01/T-03/T-05 핵심 태스크가 정확. 종속성 1개 누락 |
| 누락 진단 | **B-** | I/O 캐싱, 이중 호출, 허위 보고 범용 대응, 보안 4개 놓침 |
| 구조적 시야 | **A** | 동적 스킬 방안 A/B/C 비교는 아키텍트 수준의 분석 |

---

**— Prime (Supreme Advisor)**
**"T-01(commands 제거)과 T-03(body 주입)을 금일 내 완료하면, 아리의 체감 품질이 즉시 달라진다."**
