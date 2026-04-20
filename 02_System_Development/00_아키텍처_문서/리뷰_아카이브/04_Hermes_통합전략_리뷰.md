# 🛡️ Prime Advisor (Prime) — Hermes Agent 통합 아키텍처 리뷰

**리뷰어:** Prime (Claude Opus) — Prime Advisor  
**대상:** Hermes Agent Fork/Integration Architecture  
**일시:** 2026-04-14 (4th Review Session)  

---

## 📊 총평: ⚠️ 전략적 재고 필요 (Option A도 B도 아닌 "Option C" 제안)

Luca, 이것은 지금까지의 리뷰 중 가장 **중대한 아키텍처 결정**입니다. Phase 17의 스킬 문서나 UI 컴포넌트와는 차원이 다릅니다 — 이것은 **엔진 교체 수준의 판단**이므로, 기술적 흥분보다 냉정한 비용-편익 분석이 선행되어야 합니다.

---

## 🔬 Hermes Agent 실체 분석 (코드 레벨)

GitHub 레포를 전수 스캔한 결과:

```
NousResearch/hermes-agent (★82.8K, Fork 11.1K)
├── agent/              ← 에이전트 코어 로직
├── gateway/            ← Telegram/Discord/Slack/WhatsApp/Signal 통합
├── skills/             ← 자가 생성 스킬 저장소
├── tools/              ← 내장 도구 (web search, file ops, etc.)
├── plugins/            ← MCP 플러그인 시스템
├── cron/               ← 자동 스케줄링
├── run_agent.py        ← 메인 실행 루프
├── model_tools.py      ← LLM 오케스트레이션
├── hermes_state.py     ← 상태 관리
├── mcp_serve.py        ← MCP 서버
├── AGENTS.md           ← 프로젝트별 지시사항
└── pyproject.toml      ← Python (uv 기반)
```

**Hermes의 핵심 가치 3가지:**
1. **SOUL.md** — 세션 간 지속되는 에이전트 정체성 파일
2. **Self-Learning Loop** — 성공한 작업을 자동으로 스킬 파일로 추출·개선
3. **Multi-Gateway** — Telegram/Discord 등 네이티브 게이트웨이 통합

---

## 🔴 Option A 비판: 마이크로서비스 연동의 숨겨진 비용

> [!CAUTION]
> **Luca가 "마찰이 적다"고 평가한 Option A가 실제로는 가장 마찰이 큰 선택입니다.**

### 문제 1: 프로세스 생명주기 관리의 악몽

```
[현재]
대표님이 서버 켤 때: node server.js  ← 1개 프로세스

[Option A 적용 후]
대표님이 서버 켤 때:
  1. node server.js          ← Node 브릿지 서버
  2. python run_agent.py     ← Hermes 메인 루프
  3. hermes gateway start    ← Hermes 텔레그램 게이트웨이

→ 3개 프로세스를 동시에 관리해야 함
→ Python이 죽으면? Node가 죽으면? 게이트웨이만 죽으면?
→ 각각 다른 에러 로그, 다른 디버깅 환경, 다른 재시작 방법
→ PM2/Supervisor/Docker Compose 같은 프로세스 매니저가 반드시 필요
→ 현재 MyCrew에는 이 인프라가 없음
```

### 문제 2: 통신 인터페이스 정의의 모호성

기획서에서 "로컬 API 또는 MCP를 통해 통신"이라고 했는데, 이것이 구체적으로 어떤 프로토콜인지 결정되지 않았습니다:

```
[통신 시나리오 — 실제로 구현해야 하는 것]

1. 텔레그램 메시지 → Hermes 수신
2. Hermes가 "이건 카드 생성이 필요하다"고 판단
3. Hermes → Node.js API 호출: POST /api/tasks (여기까진 기획서에 있음)
4. Node.js가 카드 생성 후 Socket.io로 대시보드에 푸시

그런데:
5. Hermes가 스킬 자가 생성을 시작함 → 이 이벤트를 대시보드에 보여줘야 하나?
6. Hermes의 SOUL.md가 업데이트됨 → Node.js가 이걸 알아야 하나?
7. 대시보드에서 대표님이 에이전트 스킬을 OFF → Hermes에 어떻게 전달?
8. Hermes의 에러 로그 → Node.js의 LogDrawer에 어떻게 스트리밍?

→ 쌍방향 통신 인터페이스를 0에서 설계해야 합니다.
→ 이것이 "마찰이 적다"는 평가와 정면으로 충돌합니다.
```

### 문제 3: 텔레그램 게이트웨이 이전의 위험성

기획서 Step 4에서 "텔레그램 메시지 수신부(`bot.on`)를 Node.js에서 빼고 Hermes Gateway로 이관"이라고 했는데:

```javascript
// 현재 server.js — 텔레그램이 트리거하는 전체 파이프라인:
bot.on('message', async (msg) => {
  // 1. 메시지 수신
  // 2. DB에 Task 생성 (createTask)
  // 3. Socket.io로 대시보드에 실시간 알림
  // 4. executor.run() → AI 응답 생성
  // 5. DB에 응답 저장
  // 6. Socket.io로 응답 스트리밍
  // 7. 텔레그램으로 응답 발송
});
```

이 7단계 파이프라인에서 **Step 1만 Hermes로 빼면** 나머지 2~7은 어디서 실행됩니까? 전부 Hermes에서? 그러면 Socket.io 통신은? DB 접근은? SQLite 파일을 Python과 Node.js가 동시에 열면 **file lock 충돌**은?

> [!WARNING]
> **SQLite는 동시 쓰기를 지원하지 않습니다.** Node.js와 Python이 같은 `database.sqlite` 파일에 동시에 쓰려고 하면 `SQLITE_BUSY` 에러가 발생합니다. 이를 해결하려면 WAL 모드 + 재시도 로직이 필요하며, 이것만으로도 별도 작업이 됩니다.

---

## 🔴 Option B 비판: 매몰 비용 함정

> [!CAUTION]
> **"지금까지 만든 거 다 버리자"는 감정적으로 통쾌하지만 경제적으로 재앙입니다.**

현재 Node.js 코드베이스의 투자 규모:

| 파일 | LOC | 가치 |
|:---|:---|:---|
| `server.js` | 1,029줄 | Telegram + Socket.io + API + Watchdog 전체 파이프라인 |
| `executor.js` | 208줄 | Progressive Injection + Skill Guard + URL Parser 통합 |
| `database.js` | 376줄 | Task/Comment/AgentSkill/Settings 스키마 + 마이그레이션 |
| `LogDrawer.jsx` | 623줄 | 실시간 채팅 UI + 드래그&드롭 + 멘션 시스템 |
| `AgentDetailView.jsx` | 488줄 | 에이전트 프로필 + 스킬 관리 패널 |
| 기타 컴포넌트 | ~3,000줄 | 칸반보드, 설정, 모달, 사이드바 등 |

**총 약 6,000줄의 프로덕션 코드**를 Python으로 재작성한다는 것은:
- 최소 2주~4주의 순수 포팅 작업
- 포팅 과정에서 발생하는 새로운 버그
- 대시보드의 실시간성(Socket.io) 품질 저하 가능성
- **이 기간 동안 Socian 비즈니스 개발 완전 정지**

---

## 🟢 Prime 제안: Option C — "전략적 흡수 (Strategic Absorption)"

> [!IMPORTANT]
> **Hermes의 경험을 훔치되, 코드를 훔치지 마십시오.**

Hermes의 3대 핵심 기능을 **현재 Node.js 엔진 위에 네이티브로 구현**하는 것이 가장 합리적입니다.

### 이유: Hermes의 혁신은 "코드"가 아니라 "아키텍처 패턴"에 있습니다

```
[Hermes의 진짜 가치]           [현재 MyCrew에서의 대응물]
                               
SOUL.md (영속 정체성)    →     MYCREW.md + IDENTITY.md (이미 설계 완료!)
Self-Learning Loop       →     executor.js 성공 후 SKILL.md 자동 업데이트
Multi-Gateway            →     Telegram(완성) + Socket.io(완성) + 웹대시보드(완성)
스킬 파일 시스템          →     skill-library/ (이미 8개 스킬 + SKILL.md 완성!)
FTS5 검색               →     SQLite FTS5 확장 (Node.js sqlite3에서도 가능)
```

**Luca, 이것을 보십시오:** Phase 17에서 Prime이 요구한 것들 — Progressive Injection, MYCREW.md 강제 로드, Cold-Start 복구 — 이 **전부 Hermes의 SOUL 아키텍처와 동일한 개념**입니다. 이미 설계가 끝나있고, 일부는 코드까지 구현되어 있습니다.

### Option C 구체 실행 계획

```
[Week 1: SOUL 흡수 — 장기 기억]

현재 상태: executor.js에 loadSkillDocument() 구현 완료
추가할 것: MYCREW.md + IDENTITY.md를 같은 방식으로 부트 시 주입

구현 코드 (executor.js에 추가):
─────────────────────────────────────
function loadSoulContext() {
  const files = ['MYCREW.md', 'IDENTITY.md'];
  const parts = [];
  for (const f of files) {
    try {
      const p = path.resolve(process.cwd(), f);
      if (fs.existsSync(p)) {
        parts.push(fs.readFileSync(p, 'utf-8').slice(0, 1000));
      }
    } catch {}
  }
  return parts.join('\n---\n');
}
// run() 메서드 내부에서:
const soulContext = loadSoulContext();
const fullPrompt = soulContext + '\n\n' + systemPrompt;
─────────────────────────────────────
→ 10줄. Hermes의 SOUL.md 로딩과 동일한 기능.
→ Python 서버 불필요.
```

```
[Week 2: Self-Learning 흡수 — 스킬 자가 성장]

Hermes의 핵심: 작업 성공 → 실행 과정을 스킬 파일로 저장
MyCrew 구현: executor.run() 성공 후 → SKILL.md Changelog 자동 추가

구현 위치: executor.js의 try 블록 내부 (성공 후)
─────────────────────────────────────
if (result.text && evaluation.score >= 0.8) {
  // 고품질 응답이면 해당 스킬의 Changelog에 기록
  const skillPath = SKILL_PATH_MAP[evaluation.category];
  if (skillPath) {
    const logEntry = `\n### [${new Date().toISOString().slice(0,10)}] 성공 패턴\n` +
      `- **요청**: ${actualContent.slice(0, 100)}\n` +
      `- **모델**: ${modelToUse}\n` +
      `- **카테고리**: ${evaluation.category}\n`;
    fs.appendFileSync(
      path.resolve(process.cwd(), skillPath),
      logEntry
    );
  }
}
─────────────────────────────────────
→ 15줄. Hermes의 스킬 자가 생성 루프의 핵심 메카닉.
→ 복잡한 Python ML 파이프라인 없이, 텍스트 로그 기반으로 동일 효과.
```

```
[Week 3: Memory 흡수 — 대화 이력 검색]

Hermes의 핵심: SQLite FTS5로 과거 대화 전문 검색
MyCrew 구현: 기존 database.js에 FTS5 가상 테이블 추가

─────────────────────────────────────
// database.js에 추가
db.run(`CREATE VIRTUAL TABLE IF NOT EXISTS TaskFTS 
  USING fts5(content, tokenize='unicode61')`);

// 검색 API
app.get('/api/search', async (req, res) => {
  const { q } = req.query;
  const results = await dbManager.searchTasks(q);
  res.json({ status: 'ok', results });
});
─────────────────────────────────────
→ 10줄. Node.js의 sqlite3 패키지는 FTS5를 네이티브 지원.
→ Python 전혀 불필요.
```

---

## 📊 3가지 Option 최종 비교

| 기준 | Option A (마이크로서비스) | Option B (전면 교체) | **Option C (전략적 흡수)** |
|:---|:---|:---|:---|
| **구현 기간** | 3~4주 | 4~6주 | **1~2주** |
| **프로세스 수** | 2~3개 (Node + Python + Gateway) | 1개 (Python) | **1개 (Node)** |
| **기존 코드 보존** | 부분 보존 | 전면 폐기 | **100% 보존** |
| **대시보드 실시간성** | ⚠️ 브릿지 지연 발생 | ⚠️ 재구현 필요 | **✅ 그대로 유지** |
| **SOUL 기능** | ✅ 네이티브 | ✅ 네이티브 | **✅ 10줄로 구현** |
| **Self-Learning** | ✅ 네이티브 | ✅ 네이티브 | **✅ 15줄로 구현** |
| **MCP 통합** | ✅ 내장 | ✅ 내장 | ⚠️ 별도 구현 필요 (향후) |
| **운영 복잡도** | 🔴 높음 | 🟡 중간 | **🟢 낮음 (현재와 동일)** |
| **Socian 비즈니스 중단** | 2~3일 | 4주+ | **0일** |
| **SQLite 동시 접근** | 🔴 충돌 위험 | ✅ 문제 없음 | **✅ 문제 없음** |

---

## 💬 Prime → 대표님 직접 코멘트

대표님, Hermes Agent는 **훌륭한 오픈소스**입니다. 82K 스타가 괜히 찍힌 것이 아닙니다.

하지만 Hermes를 "통째로 포크"하는 것과 "설계 철학을 배우는 것"은 완전히 다른 일입니다.

**Hermes의 SOUL.md가 하는 일은 MyCrew의 MYCREW.md가 이미 하도록 설계되어 있습니다.**
**Hermes의 스킬 자가 생성은 executor.js의 성공 후 로깅으로 동일하게 구현 가능합니다.**
**Hermes의 텔레그램 게이트웨이는 server.js의 `bot.on`이 이미 하고 있습니다.**

Python 서버를 하나 더 돌리면 얻는 것은 Hermes의 코드이고, 잃는 것은 **운영 단순성**입니다. 지금 MyCrew는 `node server.js` 한 줄로 전체 시스템이 구동됩니다. 이 단순함은 1인 CEO가 운영하는 스타트업에서 **매우 값진 자산**입니다.

> **권고: Hermes의 경험을 훔치되, 코드를 훔치지 마십시오.**

Option C로 가되, Hermes의 공식 문서([Skills System](https://hermes-agent.nousresearch.com/docs/user-guide/features/skills), [Memory](https://hermes-agent.nousresearch.com/docs/user-guide/features/memory), [Architecture](https://hermes-agent.nousresearch.com/docs/developer-guide/architecture))를 **설계 레퍼런스로 정독**하시고, 그 안의 패턴을 Node.js 위에 구현하는 것이 가장 빠르고 안전한 경로입니다.

단, **MCP(Model Context Protocol) 통합**만큼은 Hermes의 `mcp_serve.py`를 **참고할 가치가 있습니다.** MCP는 업계 표준이 되어가고 있으며, 향후 MyCrew가 외부 도구와 통합할 때 반드시 필요합니다. 이것은 Week 4 이후에 별도 검토하시면 됩니다.

---

## ✅ 최종 판정

| 결정 | 판정 |
|:---|:---|
| Option A (마이크로서비스) | 🔴 **비권고** — 운영 복잡도 대비 이득 불분명 |
| Option B (전면 교체) | 🔴 **비권고** — 매몰 비용 6,000줄+ 폐기 |
| **Option C (전략적 흡수)** | 🟢 **강력 권고** — 1~2주, 코드 25줄 추가로 핵심 기능 90% 달성 |

---

**— Prime (Prime Advisor)**  
**Hermes 통합 전략 리뷰 완료. 보드 최종 판단 대기.**
