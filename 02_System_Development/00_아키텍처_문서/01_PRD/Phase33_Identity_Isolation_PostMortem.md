# 📄 Post-Mortem & Architecture Update: 메타 플랫폼 자아 혼선 및 프로젝트 격리 완수 (Phase 33)

**작성일자:** 2026-05-03  
**작성자:** Antigravity 팀 (Luca)  
**공유 대상:** 전사 개발팀 및 AI 크루 전원

---

## 🚨 1. 문제 정의 (Problem Statement)

마이크루(MyCrew) 플랫폼의 멀티테넌시 확장이 진행됨에 따라, **플랫폼을 개발하는 주체(메타 팀)**와 **플랫폼을 사용하는 유저(사용자 프로젝트 팀)** 간의 경계가 무너지면서 심각한 '자아 혼선(Identity Crisis)'과 '보안 취약점'이 발견되었습니다.

1. **정체성 오염 (Identity Crisis & Pollution)**
   - 시스템 아키텍트인 'Opus', 플랫폼 개발자인 'Luca', 'Sonnet' 등의 메타 에이전트 이름이 사용자 프로젝트 템플릿에 하드코딩되어 있었습니다.
   - 사용자가 새로운 미니앱 프로젝트를 생성하면, 플랫폼 메타 에이전트들이 강제로 유저 프로젝트의 팀원으로 배정되면서 글로벌 DB(AgentSkill) 상태가 덮어씌워지고, 에이전트들이 자신의 본분(플랫폼 개발)을 잊어버리는 치명적 오염이 발생했습니다.
2. **샌드박스 붕괴 (Sandbox Boundary Collapse)**
   - 아리 엔진(`ariDaemon.js`)의 파일 입출력 도구들이 전역 워크스페이스 Root(`/08_MyCrew_Anti`)를 가리키고 있었습니다.
   - 사용자 프로젝트 소속 에이전트가 `../../../01_Company_Operations` 와 같은 상위 디렉토리로 이동해 플랫폼 내부 설계도를 열람하거나 변조할 수 있는 'Path Traversal' 취약점이 존재했습니다.
3. **로직의 전역 침범 (Global State Bleeding)**
   - `tutorialManager.js`가 신규 유저용 가이드 카드를 생성할 때, 특정 프로젝트(`projectId`)를 명시하지 않고 글로벌 보드에 태스크를 덤프하여 데이터 격리 원칙을 위반했습니다.

---

## 🗺️ 2. M-FDS 폴더 맵 구조 (Before & After)

**[Before] 메타 공간과 유저 공간의 혼재 (오염 상태)**
```text
/08_MyCrew_Anti
 ├── 01_Company_Operations/  (메타 팀 공간 - Luca, Sonnet 거주지)
 ├── 02_System_Development/  (엔진 코어 로직)
 ├── 04_Projects/            (사용자 미니앱 프로젝트 공간)
 │    └── [문제점] 유저 에이전트가 04_Projects를 벗어나 상위 폴더(01, 02)로 자유롭게 접근 가능
```

**[After] 완벽한 샌드박스 격리 (Phase 33 적용 완료)**
```text
/08_MyCrew_Anti
 ├── 01_Company_Operations/  (메타 시스템 전용, 유저 접근 완전 차단)
 ├── 02_System_Development/  (아리 엔진 및 코어, 유저 접근 완전 차단)
 └── 04_Projects/            (사용자 테넌트 전용 공간)
      ├── proj-1/            (사용자 A의 격리된 샌드박스)
      └── proj-2/            (사용자 B의 격리된 샌드박스)
          └── [개선] 유저 에이전트의 Root는 무조건 자신이 속한 proj 폴더로 고정됨
```

---

## 🔍 3. 주요 오염 원인 파일 위치 및 패치 내역

1. **`02_System_Development/01_아리_엔진/ai-engine/teamActivator.js` (팀 프리셋 파일)**
   - **문제:** 프리셋 설정에 `luca`, `sonnet`, `nova` 등의 시스템 메타 에이전트 이름이 하드코딩되어, 사용자가 팀을 세팅할 때 메타 에이전트의 권한과 역할이 오염되었습니다.
   - **개선:** `dev_lead`, `frontend_dev` 등 범용 역할(Role) ID로 전부 교체하여 메타 에이전트 자아를 보호했습니다.

2. **`02_System_Development/01_아리_엔진/ai-engine/tutorialManager.js` (튜토리얼 자동화 로직)**
   - **문제:** 신규 유저용 태스크 생성 시 `projectId`가 지정되지 않아 허공(Global)에 태스크가 뿌려지는 컨텍스트 오염이 발생했습니다.
   - **개선:** `bootstrap` 함수에 `projectId`를 주입받도록 수정하고, DB 태스크 생성 로직에 명시적으로 프로젝트를 할당했습니다.

3. **`02_System_Development/01_아리_엔진/ai-engine/ariDaemon.js` (엔진 백그라운드 관리자)**
   - **문제:** `writeFile`, `listDirectoryContents` 등 파일 제어 도구가 전역 워크스페이스 권한을 가지고 동작했습니다.
   - **개선:** 각 파일 제어 도구에 `projectId` 파라미터 검증 로직을 추가하고, 상위 폴더로 이동(`../`)하려는 시도를 `403 에러`로 차단하는 로직(Path Traversal Block)을 구현했습니다.

4. **`02_System_Development/01_아리_엔진/agents.json` 및 `database.js` (글로벌 레지스트리 및 시더)**
   - **문제:** 에이전트 식별자(ID) 자체가 '닉네임'으로 등록되어 시스템 권한 설계와 사용자 커스텀 닉네임이 단단히 결합되어 있었습니다.
   - **개선:** `agents.json`의 ID를 모두 범용 역할명으로 교체하고, `database.js` 시딩 코드가 닉네임을 별도의 `nickname` 컬럼으로 파싱하여 처리하도록 마이그레이션했습니다.

---

## 🛠️ 4. 시스템 패치 요약 (Implemented Solutions)

대표님의 핵심 지침인 **"사용자가 만든 닉네임을 Agent ID로 쓰지 말 것"**과 **"프로젝트별 완벽한 물리적 샌드박스 보장"**을 원칙으로 시스템 전반을 패치했습니다.

### ✅ A. 에이전트 식별자(ID)와 닉네임의 완전 분리
- **개선 내용:** 더 이상 `nova`, `lumi`, `luca`와 같은 닉네임을 시스템 식별자로 사용하지 않습니다. 대신 `brand_marketer`, `visual_director`, `dev_lead`와 같은 **범용 역할명(Role ID)**을 채택했습니다.
- **데이터베이스 아키텍처 정립:**
  ```text
  [DB Hierarchy]
  Project ID 
   ↳ Team ID 
      ↳ Agent ID (역할명: dev_lead, copywriter 등)
         ↳ Model (기본: Antigravity 고사양 모델, 사용자 변경 가능)
         ↳ Nickname (사용자가 부여한 애칭: '루카', '루미' - UI/프로필에만 표출)
  ```
- **조치 사항:** `agents.json` 글로벌 레지스트리와 `database.js` 시딩 로직을 수정하여, 시스템 구조상 닉네임과 권한(Role)이 완벽히 분리되도록 마이그레이션했습니다.

### ✅ B. 아리 엔진 샌드박스 제일링 (Directory Jailing) 도입
- **개선 내용:** 아리 엔진(`ariDaemon.js`)의 모든 파일 I/O 도구(`writeFile`, `moveFile`, `deleteFile`, `listDirectoryContents` 등)에 **Path Traversal Block** 로직을 적용했습니다.
- **동작 원리:** 요청된 `projectId`를 기반으로 Base Path를 `04_Projects/{projectId}`로 동적 매핑합니다.
- **결과:** 어떠한 사용자 에이전트도 자신이 속한 프로젝트 폴더 상위(예: 플랫폼 메타 영역)로 벗어나거나 접근할 수 없습니다(`403 Forbidden` 강제 반환).

### ✅ C. 글로벌 오염원 정화 및 Zero-Config 격리
- **`teamActivator.js` 리팩토링:** 마케팅팀/개발팀 프리셋 활성화 시 플랫폼 메타 에이전트를 강제 배정하던 하드코딩을 전부 `marketing_lead`, `frontend_dev` 등의 가상 Role ID로 교체했습니다.
- **`tutorialManager.js` 리팩토링:** 태스크 생성 시 사용자별 고유 `projectId`를 넘겨주도록 파이프라인을 수정하여 튜토리얼 퀘스트가 공중에 붕 뜨지 않고 격리 공간 내에 안전하게 생성되도록 조치했습니다.

---

## ⚠️ 5. 향후 개발 시 핵심 주의 사항 (Hardcoding vs Dynamic Design)

본 사태의 근본적인 원인은 **"특정 사용자 또는 특정 시스템의 식별자를 코드와 스키마에 하드코딩한 것"**이었습니다. 향후 모든 MyCrew 및 Ari Engine 개발에 있어 다음 사항을 반드시 준수해야 합니다.

1. **사용자 부여 데이터(Nickname)와 시스템 식별자(Agent ID)의 분리**
   - 어떠한 경우에도 코드 로직 분기에 `nova`, `lumi` 등 사용자가 커스텀할 수 있는 닉네임을 사용해서는 안 됩니다.
   - 로직 분기가 필요할 경우 반드시 `marketing_lead`, `visual_director` 등 절대 변하지 않는 **시스템 역할(Role ID)**을 기준으로 동적 설계(Dynamic Design)해야 합니다.
2. **모든 I/O 및 데이터 생성 로직의 Tenant(프로젝트) 격리**
   - 새로운 기능(태스크 생성, 파일 기록, 폴더 스캔 등)을 개발할 때, **글로벌 스코프(Global Scope)**를 사용하는 것을 엄격히 금지합니다.
   - 반드시 해당 요청이 어느 프로젝트(`projectId`)에서 발생했는지 파라미터로 주입받고, 해당 경로(`04_Projects/{projectId}`) 내부에서만 실행되도록 샌드박스를 강제해야 합니다.
3. **Zero-Config 및 템플릿 설계 시 범용성 확보**
   - 템플릿 파일이나 초기 세팅 스크립트에 고정된 모델명이나 에이전트 닉네임을 하드코딩하지 마세요.
   - 데이터베이스 스키마와 참조 테이블을 통해 런타임에 **동적으로 매핑(Dynamic Mapping)**되도록 설계하여 템플릿의 확장성을 유지해야 합니다.

---

## 🚀 6. 기대 효과 및 Next Steps

이로써 MyCrew 플랫폼은 **완전한 형태의 멀티테넌시(Multi-Tenancy) 구조**를 달성했습니다. 
수천 개의 사용자 미니앱 프로젝트가 생성되더라도, 플랫폼의 자아(안티그래비티 팀)는 혼들림 없이 코어 개발에만 집중할 수 있으며, 사용자 데이터와 시스템 데이터가 안전하게 격리됩니다.

* **Next Action 1:** 스캐폴딩 생성 시 `team_agents`에 매핑된 `nickname`과 `agent_id`가 프론트엔드 UI의 좌측 햄버거 사이드바와 프로필 모달에 정확하게(짧은 역할명 vs 상세 역할명) 나뉘어 표출되도록 프론트엔드 연동 상태 점검.
* **Next Action 2:** 잔존하는 레거시 파일 브릿지 로직 중 닉네임 하드코딩 흔적이 있는지 `adapters` 영역 추가 검수.
