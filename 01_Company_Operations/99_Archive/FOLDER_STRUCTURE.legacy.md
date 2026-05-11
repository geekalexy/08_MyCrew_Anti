# MyCrew v1.5 프로젝트 디렉토리 매핑 구조

이 문서는 `실행계획-1.5.md`에 명시된 단계별 로드맵(Phase 0 ~ Phase 4)과 실제 파일 시스템(`Mycrew` 폴더)이 어떻게 연결구조를 가지는지 설계한 매핑 맵입니다.

---

## 📂 폴더 구조 체계 (Directory Tree)

```text
Mycrew/
├── docs/                      # [공통] 기획 및 설계 문서 보관
│   ├── 아키텍처-1.0
│   ├── 아키텍처-1.5
│   └── 실행계획-1.5.md
│
├── context/                   # [Phase 1] 지능 자산화 및 장기 기억
│   ├── ARI_MASTER_SOP.md      <- (생성됨) 아리의 마스터 헌법/레시피
│   └── templates/             <- 각종 에이전트 인스트럭션 템플릿
│
├── paperclip_sandbox/         # [Phase 0] 로컬 코어 엔진 
│   └── (npx onboard 파일들)     <- 페이퍼클립 백엔드 및 로컬 DB 구동 공간
│
├── bridge-server/             # [Phase 2] 신경망 라우터 
│   ├── src/                   <- 텔레그램 Webhook 및 Antigravity 통신 API 코드
│   └── package.json           <- 브릿지 서버 종속성
│
├── infra/                     # [Phase 2/3] 보안 및 무중단 시스템
│   ├── pm2-ecosystem.config.js<- (예정) 루카(Luca)가 SRE로서 감시할 백그라운드 설정
│   ├── tailscale/             <- (예정) 모바일 원격 제어를 위한 리버스 터널망 설정
│   └── install.sh             <- (Phase 4) SaaS 분양을 위한 원클릭 설치 스크립트
│
└── dashboard-ui/              # [Phase 4] GUI 추상화 컴포넌트
    └── components/            <- Antigravity에 임베딩될 진행바, A/B 승인 카드 뷰 등
```

---

## 🧭 개발 진행 방식 가이드 (Rule of Thumb)

1. **지식 주입 작업 (Phase 1)**: 아리의 메모리나 에이전트들의 행동 지침 수정이 필요할 때는 모두 `context/` 하위의 마크다운 파일을 건드립니다.
2. **명령어 중계 작업 (Phase 2)**: 텔레그램 버튼이 안 눌리거나 Antigravity API 연결 로직을 짤 때는 `bridge-server/` 하위 코드만 작업합니다.
3. **데몬/설치 작업 (Phase 3)**: 컴퓨터가 재부팅되어도 봇이 자동으로 돌게 만들거나 인증망을 세팅하려면 `infra/` 스크립트를 만집니다.
