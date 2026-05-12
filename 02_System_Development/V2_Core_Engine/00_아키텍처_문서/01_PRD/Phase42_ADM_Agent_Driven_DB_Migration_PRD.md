# Phase 42: ADM (Agent-driven DB Migration) 기획서

**작성일**: 2026-05-13  
**작성자**: Sonnet (기획·설계)  
**상태**: 🟡 B+ 조건부 승인 → 보정 완료 · 재승인 대기

---

## 1. 개요 (Overview)

### 1.1 목적
`database.js`에 하드코딩된 **~504줄의 인라인 마이그레이션 로직**(PRAGMA 검사 → ALTER TABLE)을 정식 버전 관리 체계인 `db_migrator.js` + `migrations/*.sql` 아키텍처로 이관합니다.

### 1.2 배경
현재 `database.js`의 L50~L510 구간은 **Phase 4부터 Phase 42.5까지 축적된 20개 이상의 인라인 마이그레이션**이 뒤섞여 있습니다:

| 문제 | 현상 |
|---|---|
| **가독성 붕괴** | 2263줄 중 ~504줄이 스키마 코드 — 비즈니스 로직 탐색 불가 |
| **이력 부재** | 어떤 컬럼이 언제 추가되었는지 Git 히스토리 추적 필요 |
| **롤백 불가** | 실패 시 수동 복구만 가능 |
| **중복 실행** | 매 서버 시작마다 전체 PRAGMA 검사 반복 (불필요한 오버헤드) |
| **에이전트 제약** | AI 에이전트가 새 기능 개발 시 `database.js` 직접 수정 필요 → 위험 |

### 1.3 기존 자산
이전 세션에서 이미 구현된 기반:
- ✅ `db_migrator.js` — 트랜잭션 기반 순차 실행 엔진 (147줄, 완성도 높음)
- ✅ `_migrations` 이력 테이블 — 적용된 마이그레이션 추적
- ✅ `migrations/` 디렉토리 — `001_dummy_test.sql` 테스트 파일 존재
- ✅ `database.js` L7, L13~19 — 이미 `runMigrations()` 호출 통합 완료

---

## 2. 기술 스펙 (Technical Specification)

### 2.1 이관 범위 분류 (Prime 리뷰 반영)

**~504줄 중 이관 가능/불가 분류:**

| 구분 | 줄 수 | 처리 방식 |
|---|---|---|
| **SQL 이관 가능** (정적 DDL) | ~350줄 | `migrations/*.sql`로 추출 |
| **JS 잔류 필수** (동적 로직) | ~150줄 | `database.js`에 격리 블록으로 유지 |

### 2.2 SQL 이관 불가 항목 (JS 잔류) — Prime W-001~003

| ID | 항목 | 위치 | 이유 | 잔류 방식 |
|---|---|---|---|---|
| **W-001** | Phase 35 project_agents 복제 | L366~415 (~66줄) | `agents.json` 파싱 + 동적 INSERT | `_initDynamicSeeds()` 메서드로 격리 |
| **W-002** | agent_profiles 시드 | L529~563 (~35줄) | `agents.json` 파싱 + 동적 INSERT/UPDATE | `_initDynamicSeeds()` 메서드로 격리 |
| **W-003** | 고아 스킬 클린업 | L238~248 (~11줄) | 런타임 `AGENT_IDS` Set 의존 | `_cleanupOrphanSkills()` 메서드로 격리 |

**잔류 코드 처리 원칙:**
- 모든 동적 로직은 `db.serialize()` 블록 밖으로 추출하여 **명명된 private 메서드**로 분리
- 각 메서드에 `// [ADM 잔류: W-00N]` 주석을 달아 향후 추적 가능하게 유지
- 잔류 코드는 `runMigrations()` 완료 후 순차 실행

### 2.3 마이그레이션 파일 컨벤션
```
migrations/
  001_initial_schema.sql          ← 핵심 테이블 CREATE (Task, Log, TaskComment, projects, teams, ...)
  002_task_columns.sql            ← Task 테이블 ALTER 모음 (risk_level ~ context_chain)
  003_comment_columns.sql         ← TaskComment ALTER 모음
  004_project_columns.sql         ← projects ALTER 모음 (objective ~ plan_master)
  005_agent_skill_table.sql       ← AgentSkill, project_agents, FTS 관련
  006_phase36_pipeline.sql        ← 파이프라인 관련 (pipeline_step, sprint_no, task_attachments)
  007_utility_tables.sql          ← user_settings, CksMetrics, image_lab, cs_reports
  008_indexes_and_triggers.sql    ← 인덱스 + FTS 트리거
  009_seed_data.sql               ← team_agents 정적 시드 데이터 (INSERT OR IGNORE)
  010_legacy_backfill.sql         ← global_mycrew 백필
```

### 2.4 파일 명명 규칙
- `NNN_description.sql` — 3자리 순번 + 언더스코어 + 설명
- 에이전트가 새 마이그레이션을 만들 때: `NNN+1_feature_name.sql`

### 2.5 마이그레이션 SQL 작성 규칙
```sql
-- 모든 CREATE TABLE은 IF NOT EXISTS 필수
-- ALTER TABLE ADD COLUMN은 _migrations 이력으로 중복 실행 방지
-- SQL 파일 내에서 PRAGMA 검사 불필요 — 한 번만 실행됩니다.

CREATE TABLE IF NOT EXISTS Task ( ... );
ALTER TABLE Task ADD COLUMN new_column TEXT DEFAULT NULL;
```

### 2.6 `database.js` 정리 후 구조
```
database.js (정리 후, ~1910줄)
├── L1~19    : import + runMigrations() 호출 (유지)
├── L20~50   : 상수 정의, DB 연결, PRAGMA (유지)
├── L51~90   : [ADM 잔류] _initDynamicSeeds() — W-001, W-002
├── L91~105  : [ADM 잔류] _cleanupOrphanSkills() — W-003
├── L106~    : 비즈니스 로직 함수들 (getAllTasks, createTask, ...)
```

---

## 3. 작업 진행 순서 (Implementation Steps)

| 단계 | 작업 내용 | 리스크 | 게이트 조건 |
|---|---|---|---|
| **Step 1** | 현재 DB 스키마 스냅샷 (`.schema` 명령) | 없음 | — |
| **Step 2** | `migrations/001~010.sql` 파일 10개 생성 | 낮음 | — |
| **Step 3** | `db_migrator.js` 보강: 기존 DB 충돌 방어 | 중간 | — |
| **Step 3.5** | ⛔ **게이트**: 기존 DB 대상 마이그레이션 테스트 | — | SQL 10개 정합성 확인 필수 |
| **Step 4** | `database.js` 정적 DDL 코드 삭제 (~350줄) | ⚠️ 높음 | **Step 3.5 통과 후에만 진입** |
| **Step 4.5** | W-001~003 동적 로직 → 격리 메서드로 리팩토링 | 중간 | — |
| **Step 5** | 서버 시작 테스트 — `_migrations` 정합성 검증 | 중간 | — |
| **Step 6** | `001_dummy_test.sql` 삭제 + `_agent_migration_test` 정리 | 낮음 | — |

### 3.1 Step 4 진입 게이트 (차단 조건)
> **Step 3.5가 통과되지 않으면 Step 4 진입 절대 불가**

Step 3.5 통과 기준:
1. SQL 10개 파일이 모두 생성되어 있을 것
2. 기존 `database.sqlite`를 대상으로 `db_migrator.js`를 실행하여 에러 0건일 것
3. `_migrations` 테이블에 001~010 이력이 정상 기록될 것
4. 서버 시작 후 모든 테이블/컬럼이 기존과 동일하게 존재할 것 (`.schema` 비교)

### 3.2 Step 4 안전장치
- Step 4 실행 전 반드시 `database.sqlite` 백업 생성
- `db_migrator.js`의 기존 백업 메커니즘이 자동으로 `.bak` 파일 생성
- 마이그레이션 실패 시 `ROLLBACK` → `process.exit(1)` 으로 서버 구동 자체 차단

---

## 4. db_migrator.js 보강 사항

### 4.1 기존 스키마 감지 로직 (신규)
**문제**: 이미 운영 중인 DB에 `001_initial_schema.sql`을 처음 적용하면 `CREATE TABLE Task` 가 실패함 (이미 존재하므로).

**해결**: 모든 `CREATE TABLE`에 `IF NOT EXISTS` 사용 + 모든 `ALTER TABLE ADD COLUMN`은 `_migrations` 이력으로 관리 (PRAGMA 검사 불필요).

### 4.2 첫 실행 시 기존 DB 인식
```
IF _migrations 테이블이 비어 있고 Task 테이블이 이미 존재:
  → "레거시 DB 감지" 로그 출력
  → 001~010 마이그레이션을 실행하되, IF NOT EXISTS로 안전하게 처리
  → 실행 완료 후 _migrations에 전부 기록
```

---

## 5. 기대 효과 (Impact)

| 항목 | Before | After |
|---|---|---|
| `database.js` 크기 | ~2263줄 | **~1910줄** (-350줄 SQL이관, ~150줄 격리 잔류) |
| 스키마 변경 방법 | JS 코드 직접 수정 | `.sql` 파일 추가만 |
| 서버 시작 시 오버헤드 | 매번 20+ PRAGMA 검사 | `_migrations` 1회 조회 |
| 롤백 | 불가능 | 자동 백업 + ROLLBACK |
| 에이전트 스키마 변경 | database.js 수정 필요 | `migrations/NNN.sql` 추가 |
| 이력 추적 | Git 히스토리 의존 | `_migrations` 테이블 조회 |
| 동적 시딩 로직 | 스키마와 혼재 | **격리 메서드로 명확 분리** |

---

## 6. 리스크 및 대응

| 리스크 | 영향 | 대응 |
|---|---|---|
| 마이그레이션 순서 오류 | 테이블 참조 실패 | FK 의존성 순서대로 파일 번호 배정 |
| 기존 DB와 SQL 불일치 | 서버 구동 실패 | `IF NOT EXISTS` 전면 적용 + 백업 |
| 에이전트가 잘못된 SQL 생성 | 데이터 손상 | `CRITICAL` 리스크 태깅 + CEO 승인 필수 |
| W-001~003 잔류 코드 오작동 | 시드 데이터 누락 | `_initDynamicSeeds()` 실행 실패 시 경고만 (서버 차단 안함) |

---

## 7. 진행 조건
- [x] PRD 작성 완료
- [x] Prime 교차 검증 (B+ 조건부 → 차단 3건 보정 완료)
- [ ] CEO 재승인
- [ ] 구현 착수
