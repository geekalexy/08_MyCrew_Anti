# Phase 42: Agent-driven DB Migration Architecture (에이전트 주도형 DB 마이그레이션)

**작성일**: 2026-05-12
**작성자**: Luca (CTO·아키텍처)
**상태**: 📋 Draft (기획안 초안)

---

## 1. 개요 및 문제 정의

MyCrew 시스템은 V2 Core Engine 기반의 MCP 아키텍처, 지식 그래프, 자율 파이프라인 등으로 급격하게 고도화되고 있습니다. 이에 따라 새로운 메타데이터, 칼럼, 테이블(`project_type`, `verdict_logs`, 등)이 빈번하게 요구되고 있습니다. 

현재 MyCrew의 데이터베이스(`database.js`)는 `CREATE TABLE IF NOT EXISTS` 패턴에 의존하고 있어, **기존 테이블에 새로운 컬럼을 추가하거나 스키마를 변경(ALTER)할 때 기존 데이터가 유실되거나 수동으로 DB를 조작해야 하는 위험**이 존재합니다. 

이러한 문제를 해결하기 위해, AI 에이전트(루카)가 직접 스키마 변경을 감지하고, 안전하게 마이그레이션 스크립트를 생성 및 검증하며, 시스템이 이를 자동 적용하는 **Agent-driven DB Migration (ADM)** 파이프라인을 구축합니다.

---

## 2. 해결 방안: 에이전트 주도형 마이그레이션

1. **자동 백업 및 원자적 처리(Atomic)**: 스키마 변경 전 `mycrew.db`를 안전한 `.bak` 또는 `.tmp` 파일로 격리 복사하여, 실패 시 즉각 롤백(Rollback)합니다.
2. **이력 관리 테이블(`_migrations`)**: 데이터베이스 내부적으로 어떤 마이그레이션 스크립트가 적용되었는지 추적하여 중복 실행을 방지합니다.
3. **AI 스키마 생성 및 적용**: 에이전트가 새로운 PRD나 로직을 적용할 때 데이터베이스 스키마 변경이 필요하면, 하드코딩으로 `database.js`를 수정하는 대신 `migrations/` 디렉토리에 버전별 SQL 스크립트(`v1_add_project_type.sql`)를 생성합니다.

---

## 3. 시스템 아키텍처

### 3.1 디렉토리 및 파일 구조 설계

```text
02_System_Development/V2_Core_Engine/01_아리_엔진/
├── database.js               ← 기존 인터페이스 (DB 연결, 기본 쿼리)
├── db_migrator.js            ← [New] 마이그레이션 코어 엔진
└── migrations/               ← [New] 에이전트가 생성하는 마이그레이션 파일 보관소
    ├── 001_init_schema.sql
    ├── 002_add_project_type.sql
    └── 003_add_verdict_logs.sql
```

### 3.2 데이터 흐름 (Workflow)

1. **에이전트 감지 (Detection)**
   - 새로운 기능 기획이나 PRD를 분석 중, 기존 `database.js` 스키마와 충돌/부족함이 발견되면 AI 에이전트가 마이그레이션의 필요성을 판단합니다.
2. **스크립트 생성 (Generation)**
   - AI 에이전트가 순차적 번호(예: `004_...sql`)를 붙여 안전한 `ALTER TABLE` 또는 백업 복구 쿼리가 포함된 SQL 스크립트를 작성하여 `migrations/`에 저장합니다.
3. **서버 시작 시 무결성 검증 (Execution)**
   - `server.js` 구동 시 `database.js`에 앞서 `db_migrator.js`가 실행됩니다.
   - DB 백업본 생성 → `_migrations` 테이블 검사 → 미적용 `.sql` 파일 순차적 실행 → 성공 시 Commit, 실패 시 Rollback을 수행합니다.

---

## 4. 코어 컴포넌트 명세

### 4.1 `db_migrator.js` (마이그레이션 엔진)

- **`backupDatabase()`**: 마이그레이션을 시작하기 전에 현재 `mycrew.db`를 `mycrew.db.YYYYMMDD_HHMM.bak` 형식으로 복사.
- **`initMigrationTable()`**: DB에 `CREATE TABLE IF NOT EXISTS _migrations (id INTEGER PRIMARY KEY, filename TEXT UNIQUE, applied_at DATETIME DEFAULT CURRENT_TIMESTAMP)` 생성.
- **`runMigrations()`**: 
  1. `migrations/` 폴더 내의 `.sql` 파일 목록을 이름순(버전순)으로 정렬하여 읽음.
  2. `_migrations` 테이블에 존재하지 않는 파일만 실행.
  3. 트랜잭션(Transaction) 내에서 쿼리를 실행하여 무결성 보장.

### 4.2 `database.js` 연동
기존 `database.js` 내부의 하드코딩된 대규모 `CREATE TABLE` 로직들을 점진적으로 `migrations/001_init_schema.sql`로 이관하여 코드베이스를 경량화합니다.

---

## 5. 단계별 구현 로드맵 (Phase 42)

- [ ] **Sprint 1: 기반 인프라 구축**
  - `db_migrator.js` 모듈 작성 (백업, 트랜잭션, 롤백 메커니즘).
  - `server.js`에 마이그레이션 훅(Hook) 연결.
- [ ] **Sprint 2: 기존 스키마 이관**
  - 현재 `database.js`의 스키마를 `migrations/001_init_schema.sql`로 추출.
- [ ] **Sprint 3: 최초의 에이전트 주도 스키마 변경 테스트**
  - 이전 페이즈(Phase 41)에서 논의된 `project_type` 컬럼을 추가하는 `002_add_project_type.sql`을 테스트용으로 생성하고 무결성 테스트.

---

## 6. 보안 및 정책 (Policy Compliance)
- **STRICT Policy**: M-FDS (Multi-tenant File Directory System) 원칙에 따라, `.bak` 파일은 사용자 폴더가 아닌 시스템의 안전한 로컬 저장소(`/tmp` 또는 지정된 시스템 디렉토리)에 암호화/격리 저장합니다.
- 데이터 유실 제로 보장을 위해, `DROP TABLE`과 같은 파괴적 명령어는 에이전트 수준에서 생성되지 못하도록 제어합니다.
