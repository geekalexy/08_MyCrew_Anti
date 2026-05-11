# 🛸 Antigravity Session Log: v1.5 아키텍처 구축기

**이 로그 문서는 안티그래비티와 대표님 간의 핵심 설계 논의와 아키텍처 결정 사항(Context)이 시스템 재부팅이나 세션 종료 시에도 절대 휘발되지 않도록 박제해 두는 "실시간 지식 저장소"입니다.**

---

## [Session 01] 로컬 인프라 확보 및 브릿지 라우팅 구조 확립

### 1. 주요 결정 사항 (Decisions)
* **목표**: 기존 클로드코드(Luca) 단일 체제에서 **Antigravity(SaaS 관제) + Paperclip(엔진) 듀얼 체제로 전환** (v1.5 아키텍처).
* **개발 한계 우회 (Luca's Hack)**: 
  페이퍼클립의 내장 백엔드 API(포트 3100)의 스펙을 뜯고 분석하는 데 시간을 낭비하는 대신, 브릿지 서버(Node.js)가 호스트 OS 권한으로 서브 터미널을 띄워 `npx paperclipai ...` **CLI 명령어를 직접 쳐주는 "CLI Wrapper" 구조**로 아키텍처를 전격 선회함. 이로 인해 통신 개발 속도가 극단적으로 압축됨.

### 2. 단계별 마일스톤 완료 현황 (Milestones)
* **[Phase 0] 가벼운 인프라 검증 (완료)**
  * `~/paperclip_sandbox`에 임베디드 Postgres 기반 페이퍼클립 설치 성공.
  * 서버 3100번 포트 정상 가동 및 API 헬스체크 응답 200 OK 확보.
* **[Phase 1] 지능 자산화 (작업 대기 중)**
  * 아리(Ari)의 헌법이 담길 `context/ARI_MASTER_SOP.md` 뼈대 스캐폴딩 생성.
  * (별도 PC에서 기존 메모리가 확보되는 즉시 주입 및 고도화 예정)
* **[Phase 2] 브릿지 라우팅 설정 (성공적 완료)**
  * `bridge-server/` 디렉토리에 Express 기반의 양방향 중계기 설치 및 포트 4000 구동.
  * 텔레그램 `node-telegram-bot-api` 연동을 통해 외부 터널링 없이 모바일 ↔ Mac 터미널 제어망(Long-Polling) 개통 완료.
  * **중요 발견 (Paperclip Local 한계)**: 페이퍼클립 로컬 엔진(3100번)은 클라우드와 달리 Issue/Company 조작 API가 대부분 비활성화(404 Not Found) 되어 있음이 증명됨. 따라서 향후 Task Queue는 페이퍼클립 CLI 억지 연동 대신, 브릿지 서버에서 직접 SQLite 등을 활용해 가벼운 독자 DB 구조로 선회하는 것이 유리함.

### 3. 디렉토리 설계 현황 (Folder Structure)
* `docs/`: 기획 및 실행계획 문서
* `context/`: 에이전트 SOP 및 프롬프트 에셋
* `paperclip_sandbox/`: 실제 에이전트 런타임
* `bridge-server/`: 통신 중계기 라우터 소스코드
* `infra/`: 데몬 및 터널링 세팅 공간
* `dashboard-ui/`: 클라우드 추상화 대시보드
* `session-logs/`: (현재 위치) 안티그래비티 대화 세션 보호 공간

### 4. 다음 액션 플랜 (Next Actions)
1. **[Phase 2 마무리]**: 브릿지 서버와 텔레그램 연동 봇 API 키 적용 (Webhook 엔드포인트 정의)
2. **[Phase 3 선행]**: 모바일 환경에서 이 맥북(Bridge Server 4000 포트)을 편하게 찌를 수 있도록 Tailscale 또는 Ngrok 터널링 인프라 구축
3. **[Phase 1 귀환]**: 퓨즈가 풀리는 대로 아리의 코어 메모리를 가져와 프롬프트화 진행
