# Phase 36b — 카드 링크 (Card Link) 기능 기획서

**문서 버전**: v3.0  
**작성일**: 2026-05-05  
**작성자**: 소넷 (Sonnet, Claude Sonnet 4.6)  
**상태**: ✅ **CEO 전체 확정 완료 — 구현 시작 승인**  
**연관 Phase**: Phase 36 (파이프라인), Phase 37 (ZeroBase)

---

## 변경 이력

| 버전 | 날짜 | 변경 내용 |
|------|------|---------|
| v1.0 | 2026-05-04 | 초안 작성 (유형 A/B 분리 설계) |
| v2.0 | 2026-05-04 | **태그 문법 확정**: `#01C3` / `#01F1` 단위 참조 방식으로 전면 재설계. 복사 아이콘 UX 채택 |
| v3.0 | 2026-05-05 | **Q1~Q4 CEO 전체 확정**: 가변 카드번호 / Vision 즉시 분석 포함 / isolation_scope 기반 참조 / 인라인 언더라인+블루 렌더링 이번 Phase 포함 |

---

## 1. 배경 및 목적

### 1.1 문제 정의

현재 MyCrew에서 카드 간 관계는 **파이프라인 자동 릴레이**(V2 컨텍스트 주입)로만 연결된다.  
그러나 파이프라인 외부에서 수동으로 카드를 만들어 다른 담당자에게 지시할 때:

> "#1 PRD 내용을 참고해서 와이어프레임 작성해줘"  
> → 이전 카드의 특정 코멘트나 첨부 파일을 복사·붙여넣기 없이 **정밀하게 참조**하고 싶다.

### 1.2 목표

- 코멘트 단위 / 파일 단위의 **정밀 참조 링크** 생성
- **복사 아이콘 방식** UX — 클릭 한 번으로 참조 태그를 클립보드 복사
- 에이전트 실행 시 참조 태그를 자동 해석해 **컨텍스트 주입**

---

## 2. 확정 태그 문법 (CEO 최종 v3.0)

```
#1C3    = 카드 #1 의 3번째 코멘트 텍스트
#1F1    = 카드 #1 의 1번째 첨부 파일
#12F3   = 카드 #12 의 3번째 첨부 파일
```

### 2.1 문법 구조

```
# {카드 project_task_num (가변)} {타입} {순번}
│                                 │      │
│                                 │      └── 1부터 시작하는 정수
│                                 └── C = Comment(코멘트 텍스트)
│                                     F = File(첨부 파일)
└── 카드 번호 (가변 자릿수: #1, #12, #123 ...)
```

> ✅ **Q1 확정**: 카드번호 **가변 자릿수** (`#1` 형식)  
> 파싱 정규식: `/#(\d+)(C|F)(\d+)/g` (2자리 고정 아님)

### 2.2 실사용 예시

```
카드 #1 (PRD 기능정의서) 상황:
  코멘트 1: dev_senior가 작성한 기능 목록 초안
  코멘트 2: CEO의 피드백 코멘트
  코멘트 3: dev_senior의 최종 수정본  ← 가장 많이 참조
  첨부 파일 1: wireframe_ref.png
  첨부 파일 3: prd_v2.md

사용 태그:
  #1C3    → 최종 수정본 텍스트 참조 (가장 일반적)
  #1F1    → 와이어프레임 참고 이미지 참조
  #1F3    → PRD v2 문서 참조

→ 새 카드 내용: "#1C3 참고해서 와이어프레임 작성해줘"
              = 카드 #1 세번째 코멘트를 컨텍스트로 주입
```

> 📌 **실사용 통계 예측**: `#카드번호C순번` (코멘트 참조)이 전체 사용의 약 80% 예상

---

## 3. UX 설계 — 복사 아이콘 방식

### 3.1 코멘트 단위 복사 (C 태그)

```
[TaskDetailModal 코멘트 영역]

┌──────────────────────────────────────────────────────────┐
│  dev_senior                  2026-05-04 15:42  [📋 #01C3] │  ← 복사 아이콘 (우상단)
│  ─────────────────────────────────────────────────────  │
│  ## 기능 정의서 최종본                                    │
│  - 로그인/회원가입                                        │
│  - 대시보드 메인                                          │
│  - 설정 페이지                                            │
└──────────────────────────────────────────────────────────┘

         ↓ [📋 #01C3] 클릭

  클립보드에 복사: "#01C3"
  툴팁: "✅ #01C3 복사됨"
```

### 3.2 파일 단위 복사 (F 태그)

```
[TaskDetailModal 첨부 파일 영역]

┌──────────────────────────────────────────────────────────┐
│  📎 첨부 파일                                             │
│  ┌──────────────────────────────────────────────────┐    │
│  │  F1  wireframe_ref.png          234KB  [📋 #01F1] │    │
│  │  F2  meeting_notes.txt           12KB  [📋 #01F2] │    │
│  │  F3  prd_v2.md                   45KB  [📋 #01F3] │    │
│  └──────────────────────────────────────────────────┘    │
└──────────────────────────────────────────────────────────┘
```

### 3.3 붙여넣기 → 태그 인식

```
[다른 카드 생성/편집 텍스트에리어에 붙여넣기]

  입력: "#01C3 참고해서 와이어프레임 작성해줘"

  시스템 감지: #01C3 태그 → 인라인 미리보기 렌더링

  ┌──────────────────────────────────────────────────────┐
  │  📎 #01C3 — PRD 기능정의서 / 코멘트 3                  │
  │  dev_senior | 2026-05-04 15:42                       │
  │  "## 기능 정의서 최종본\n- 로그인/회원가입..."          │
  │  [태그 제거]                                          │
  └──────────────────────────────────────────────────────┘
```

### 3.4 복수 태그 사용

```
카드 내용:
  "#01C3 기능 정의 참고하고, #01F3 PRD 문서도 같이 봐서 와이어프레임 작성해줘"

  → 에이전트에게 2가지 컨텍스트 블록 주입
  → 코멘트 텍스트 + 파일 내용 모두 포함
```

---

## 4. 에이전트 컨텍스트 주입

### 4.1 태그 파싱 로직

```javascript
// server.js 또는 contextInjector.js

// ✅ Q1 확정: 가변 자릿수 정규식
const TAG_REGEX = /#(\d+)(C|F)(\d+)/g;

async function buildLinkedContext(taskContent, projectId, currentProject) {
  const tags = [...taskContent.matchAll(TAG_REGEX)];
  // tags: [['#1C3', '1', 'C', '3'], ['#1F3', '1', 'F', '3'], ...]
  
  const sections = [];
  for (const [fullTag, cardNum, type, index] of tags) {
    // ✅ Q3 확정: isolation_scope 기반 참조 허용 여부 확인
    const refTask = await resolveCardWithIsolation(projectId, parseInt(cardNum), currentProject);
    if (!refTask) continue;

    if (type === 'C') {
      // 코멘트 N번째 조회
      const comment = await db.getTaskCommentByIndex(refTask.id, parseInt(index));
      if (!comment) continue;
      sections.push(`
<!-- [CARD LINK: ${fullTag}] -->
## 📎 참조: ${refTask.title} (#${cardNum}) / 코멘트 ${index}번
작성: ${comment.author} | ${comment.created_at}

${comment.content.slice(0, 3000)}
---`);

    } else if (type === 'F') {
      // 첨부 파일 N번째 조회
      const attachment = await db.getTaskAttachmentByIndex(refTask.id, parseInt(index));
      if (!attachment) continue;

      // ✅ Q2 확정: 이미지 파일은 Vision 즉시 분석
      const fileContent = await resolveFileContent(attachment.file_path, attachment.file_type);
      sections.push(`
<!-- [FILE LINK: ${fullTag}] -->
## 📄 참조 파일: ${attachment.file_label} (#${cardNum} / F${index})

${fileContent}
---`);
    }
  }
  return sections.join('\n');
}

// ✅ Q3: isolation_scope 기반 참조 해석
async function resolveCardWithIsolation(requestingProjectId, cardNum, currentProject) {
  // isolation_type A → 타 프로젝트 참조 전면 불허
  if (currentProject.isolation_type === 'A') {
    return await db.getTaskByProjectNum(requestingProjectId, cardNum);
  }
  // B / C → 타 프로젝트 카드 참조 허용 (프로젝트 범위 자동 탐색)
  return await db.getTaskByProjectNumAcrossScopes(requestingProjectId, cardNum, currentProject.isolation_type);
}

// ✅ Q2: 파일 타입별 컨텐츠 해석
async function resolveFileContent(filePath, fileType) {
  if (['png', 'jpg', 'jpeg', 'gif', 'webp'].includes(fileType)) {
    // 이미지 → Vision 분석 (개발팀원 전원 Vision 지원)
    const visionResult = await imageAnalysisService.analyze(filePath);
    return `[이미지 Vision 분석 결과]\n${visionResult}`;
  }
  // 텍스트 파일 → 내용 직접 읽기 (최대 5,000자)
  const content = fs.readFileSync(filePath, 'utf8');
  return content.slice(0, 5000);
}
```

### 4.2 최종 프롬프트 구조

```markdown
<!-- [LINKED CONTEXT] -->

## 📎 참조: PRD 기능정의서 (#01) / 코멘트 3번
작성: dev_senior | 2026-05-04 15:42

## 기능 정의서 최종본
- 로그인/회원가입
- 대시보드 메인
- 설정 페이지
---

## 📄 참조 파일: prd_v2.md (#01 / F3)
[파일 내용 — 최대 5,000자]
---

<!-- [작업 지시] -->
## 📋 현재 작업: 와이어프레임 설계 (#3)

#01C3 참고하고 #01F3 PRD 문서도 봐서 와이어프레임 작성해줘
```

---

## 5. DB 스키마

### 5.1 task_attachments 테이블 (신규)

파일 순번(`F1`, `F3` 등) 조회를 위해 첨부 파일 별도 테이블 관리:

```sql
CREATE TABLE IF NOT EXISTS task_attachments (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      INTEGER NOT NULL REFERENCES Task(id) ON DELETE CASCADE,
  comment_id   INTEGER DEFAULT NULL REFERENCES TaskComment(id) ON DELETE SET NULL,
  file_idx     INTEGER NOT NULL,        -- 카드 내 파일 순번 (1부터)
  file_label   TEXT NOT NULL,           -- UI 표시 파일명
  file_path    TEXT NOT NULL,           -- 절대 경로 (로컬 파일)
  file_type    TEXT,                    -- 'md' | 'txt' | 'image' | 'pdf' | 기타
  file_size    INTEGER,                 -- bytes
  created_at   DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_attachments_task ON task_attachments(task_id, file_idx);
```

### 5.2 TaskComment — 코멘트 순번 필드 추가

```sql
-- 기존 TaskComment에 순번 컬럼 추가
ALTER TABLE TaskComment ADD COLUMN comment_idx INTEGER DEFAULT NULL;
-- 소급: 카드별 생성 순서대로 순번 부여
UPDATE TaskComment SET comment_idx = (
  SELECT COUNT(*) FROM TaskComment t2
  WHERE t2.task_id = TaskComment.task_id AND t2.id <= TaskComment.id
) WHERE comment_idx IS NULL;
```

### 5.3 DB 메서드 (database.js 추가)

```javascript
// 코멘트 순번으로 조회
getTaskCommentByIndex(taskId, commentIdx)     // #01C3 → 카드1, 3번 코멘트

// 첨부파일 순번으로 조회  
getTaskAttachmentByIndex(taskId, fileIdx)      // #01F1 → 카드1, 1번 파일

// 파일 등록 (코멘트에 파일 첨부 시)
createTaskAttachment(taskId, commentId, fileLabel, filePath, fileType, fileSize)

// 카드의 전체 첨부파일 목록
getTaskAttachments(taskId)
```

---

## 6. API 설계

```
# 첨부 파일 관리
POST   /api/tasks/:id/attachments
  body: { file_path, file_label, comment_id? }
  → 파일 등록 + file_idx 자동 부여

GET    /api/tasks/:id/attachments
  → 첨부 파일 목록 (file_idx 포함)

DELETE /api/tasks/:id/attachments/:attachmentId
  → 첨부 파일 제거

# 코멘트 순번 조회 (복사 아이콘용)
GET    /api/tasks/:id/comments/:idx
  → 특정 순번 코멘트 반환 (tag: "#01C{idx}" 생성용)
```

---

## 7. UI 상세

### 7.1 TaskDetailModal — 복사 아이콘 위치

```
[코멘트 버블]
  우상단 호버 시 아이콘 그룹 표시:
    [📋 복사] [✏️ 수정] [🗑️ 삭제]
    
  [📋 복사] 클릭:
    → "#01C{comment_idx}" 클립보드 복사
    → 툴팁 "✅ #01C3 복사됨" (2초 후 사라짐)

[첨부 파일 아이템]
  우측 [📋 #01F1] 아이콘:
    → "#01F{file_idx}" 클립보드 복사
```

### 7.2 TaskCard.jsx — 링크 배지

```
┌──────────────────────────────────────────────────────┐
│  #3 와이어프레임 설계                    dev_ux  🔄    │
│  ─────────────────────────────────────────────────  │
│  #01C3 참고해서 와이어프레임 작성해줘                  │
│                                                      │
│  🔗 [#01C3]  [#01F3]                                 │  ← 태그 배지
└──────────────────────────────────────────────────────┘

배지 클릭 시: 해당 참조 카드의 TaskDetailModal 열기
```

### 7.3 태그 인라인 렌더링 (✅ Q4 확정 — 이번 Phase 포함)

> **Q4 결정**: Phase 36b에서 **언더라인 + 블루 컬러** 표시 우선 구현  
> 클릭 가능한 칩 형태·호버 툴팁은 Phase 37로 미룸

```
[태스크 내용 표시 영역 / 코멘트 텍스트]

  원문: "#1C3 참고해서 와이어프레임 작성해줘"

  렌더링 (Phase 36b):
    #1C3 참고해서 와이어프레임 작성해줘
    ↑↑↑
    언더라인 + 파란색(#3b82f6) 텍스트로만 표시
    스타일: color: #3b82f6; text-decoration: underline; cursor: pointer;
```

**구현 방식**: 정규식으로 태그 감지 → React span으로 치환

```jsx
// TagRenderer.jsx (신규 유틸)
const TAG_REGEX = /#(\d+)(C|F)(\d+)/g;

function renderTaggedText(text) {
  const parts = [];
  let lastIndex = 0;
  let match;
  TAG_REGEX.lastIndex = 0;

  while ((match = TAG_REGEX.exec(text)) !== null) {
    // 태그 앞 텍스트
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    // 태그 → 파란 언더라인 span
    parts.push(
      <span
        key={match.index}
        style={{ color: '#3b82f6', textDecoration: 'underline', cursor: 'pointer' }}
        onClick={() => onTagClick(match[1], match[2], match[3])}
      >
        {match[0]}
      </span>
    );
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts;
}
```

**적용 범위**: TaskDetailModal 코멘트 영역 + TaskCard 내용 텍스트

---

## 8. 파이프라인 V2 컨텍스트 주입과의 관계

| 구분 | 파이프라인 V2 자동 주입 | 카드 링크 (이번 기능) |
|------|---------------------|-------------------|
| 트리거 | 릴레이 시 자동 | 복사 아이콘 클릭 → 붙여넣기 |
| 참조 단위 | 마지막 코멘트 전체 | **코멘트 단위 / 파일 단위** |
| 정밀도 | 낮음 (전체 자동) | 높음 (특정 코멘트 지정) |
| 파일 참조 | ❌ | ✅ `#01F1` |
| 적합 상황 | 자율 파이프라인 | 수동 카드·크로스 참조 |

> 두 기능은 **상호 보완**:  
> 파이프라인은 V2 자동 주입 유지 + 수동 카드에는 `#카드번호C순번` 태그 활용

---

## 9. 구현 순서 (v3.0 — Q1~Q4 확정 반영)

```
Step 1. database.js — 스키마 + 메서드 (~30분)
  └─ task_attachments 테이블 생성
  └─ TaskComment.comment_idx 컬럼 추가 + 소급
  └─ getTaskCommentByIndex(), getTaskAttachmentByIndex()
  └─ createTaskAttachment(), getTaskAttachments()
  └─ getTaskByProjectNumAcrossScopes() — Q3 isolation 지원

Step 2. server.js — API 엔드포인트 (~30분)
  └─ POST/GET/DELETE /api/tasks/:id/attachments
  └─ GET /api/tasks/:id/comments/:idx

Step 3. server.js — buildLinkedContext() 태그 파싱 주입 (~40분)
  └─ TAG_REGEX = /#(\d+)(C|F)(\d+)/g  [Q1: 가변 자릿수]
  └─ resolveCardWithIsolation() — isolation_type A 차단 [Q3]
  └─ resolveFileContent() — 이미지 Vision 자동 분석 포함 [Q2]
  └─ 에이전트 실행 전 자동 컨텍스트 prepend

Step 4. TaskDetailModal.jsx — 복사 아이콘 + 첨부파일 관리 (~45분)
  └─ 코멘트 우상단 [📋 복사] 아이콘 → 가변 번호 형식 (#1C3)
  └─ 첨부 파일 목록 + [📋 #1F1] 아이콘
  └─ 클립보드 복사 + 툴팁 피드백

Step 5. TagRenderer.jsx — 인라인 태그 렌더링 (~30분)  [Q4 확정]
  └─ 태그 → 언더라인 + 파란색(#3b82f6) span 렌더링
  └─ TaskDetailModal 코멘트 영역 적용
  └─ TaskCard 내용 텍스트 적용

Step 6. TaskCard.jsx — 태그 배지 렌더링 (~20분)
  └─ #카드번호C순번, #카드번호F순번 감지
  └─ 클릭 시 해당 카드 TaskDetailModal 열기
```

**예상 총 구현 시간**: 약 3.5시간 (6스텝 순차 진행)

---

## 10. CEO 확정 결정 사항 (v3.0 — 2026-05-05)

| # | 항목 | ✅ 확정 결정 |
|---|------|-------------|
| Q1 | 카드번호 자릿수 | **가변 자릿수** (`#1`, `#12`, `#123`) — 정규식: `/#(\d+)(C\|F)(\d+)/g` |
| Q2 | 이미지 Vision 분석 시점 | **이번 버전 즉시 포함** — 개발팀원 전원 Vision 지원, 파일 링크 시 자동 분석 |
| Q3 | 타 프로젝트 카드 참조 | **isolation_scope 기반** — `A타입 전면 차단`, B/C타입 허용 |
| Q4 | 인라인 태그 렌더링 | **이번 Phase 포함** — 언더라인 + 블루(`#3b82f6`) 텍스트 표시만. 칩/툴팁은 Phase 37 |

---

## 11. 승인 체크리스트

- [x] 태그 문법 CEO 확정: `#카드번호C코멘트순번` / `#카드번호F파일순번`
- [x] 복사 아이콘 UX 방식 채택
- [x] 유형 A/B 통합 → 단일 태그 체계로 재설계
- [x] **Q1 확정**: 가변 자릿수 (`#1` 형식)
- [x] **Q2 확정**: Vision 분석 이번 버전 포함
- [x] **Q3 확정**: isolation_scope 기반 (A타입 차단)
- [x] **Q4 확정**: 언더라인+블루 렌더링 이번 Phase 포함
- [x] **구현 시작 승인** — Step 1부터 진행

---

*v3.0 — Q1~Q4 CEO 전체 확정 | 소넷 작성 | 2026-05-05*
