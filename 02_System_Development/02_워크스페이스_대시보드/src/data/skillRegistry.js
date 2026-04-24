export const SKILL_REGISTRY = {
  // ─── Layer 1: Engine Skills ───
  "orchestrator": {
    id: "orchestrator", layer: 1, layerLabel: "ENGINE",
    name: "Team Orchestrator", icon: "hub", color: "var(--brand)",
    description: "다중 에이전트 워크플로우를 조율하고 자원을 최적화합니다.",
    fullDescription: "에이전트 간의 협업 체인을 구축하고 의견 충돌을 중재하며 최종 산출물을 대표님에게 보고하기 전 전수 검수(QA)하는 오케스트레이션 특화 스킬입니다.",
    rules: ["충돌 발생 시 중재", "전체 품질 보증(QA)", "자원 효율적 할당"],
    skillMdPath: "skill-library/08_workflow/SKILL.md",
  },
  "assistant": {
    id: "assistant", layer: 1, layerLabel: "ENGINE",
    name: "Executive Assistant", icon: "support_agent", color: "#ffb963",
    description: "대표님의 일상 대화, 일정 관리 및 퀵 서치를 전담합니다.",
    fullDescription: "대표님의 지시를 가장 먼저 수신하여 의도를 파악하고, 일상적인 대화부터 간단한 검색까지 부드럽고 쾌적하게 보조하는 AI 비서 스킬입니다.",
    rules: ["친절하고 부드러운 톤앤매너", "의도 선제 파악", "빠른 응답 속도"],
    skillMdPath: "skill-library/01_routing/SKILL.md",
  },
  "routing": {
    id: "routing", layer: 1, layerLabel: "ENGINE",
    name: "Task Routing", icon: "account_tree", color: "var(--brand)",
    description: "보고된 업무를 분석하고 최적 에이전트에게 자동 라우팅합니다.",
    fullDescription: "워크플로우 통제 및 5단계 최종 QA 아키텍처 담당.\n상세 엔진 명세 및 실행 가이드는 본사 Knowledge IP 섹션(/skill-library/01_routing/SKILL.md)에서 관리됩니다.",
    rules: ["최소비용 모델 우선", "실패 시 escalation", "3회 실패 시 사람에게 보고"],
    skillMdPath: "skill-library/01_routing/SKILL.md",
  },
  "marketing": {
    id: "marketing", layer: 1, layerLabel: "ENGINE",
    name: "Marketing Intelligence", icon: "trending_up", color: "#ffb963",
    description: "3초 Hook 설계, 바이럴 콘텐츠 전략, 플랫폼 알고리즘 대응 전문.",
    fullDescription: "3초 Hook 및 마케팅 심리학 기반의 자동 트리거 스크립팅 분석 및 수행 능력입니다.\n상세 엔진 명세 및 실행 가이드는 본사 Knowledge IP 섹션(/skill-library/02_marketing/SKILL.md)에서 관리됩니다.",
    rules: ["3초 후킹 최우선", "마케팅 심리학 적용", "경쟁사 데이터 분석"],
    skillMdPath: "skill-library/02_marketing/SKILL.md",
  },
  "content": {
    id: "content", layer: 1, layerLabel: "ENGINE",
    name: "Content Generation", icon: "article", color: "#ff8ab4",
    description: "SEO 최적화 블로그 작성, 릴스 대본, 숏폼 카피라이팅 기획.",
    fullDescription: "에이전트 고유의 전문 실행 스킬입니다. 인간의 언어로 작성된 지시를 SEO에 최적화된 콘텐츠로 직조합니다.\n상세 엔진 명세 및 실행 가이드는 본사 Knowledge IP 섹션(/skill-library/03_content/SKILL.md)에서 관리됩니다.",
    rules: ["A/B/C 바이브 테스트", "무료 API 우선 탐색", "저장 유도 문구 삽입"],
    skillMdPath: "skill-library/03_content/SKILL.md",
  },
  "analysis": {
    id: "analysis", layer: 1, layerLabel: "ENGINE",
    name: "Data Analytics", icon: "analytics", color: "#b4c5ff",
    description: "업무 지표 추출, 퍼널 분석, 시각화 대시보드 리포팅.",
    fullDescription: "로그와 지표를 분석하여 패턴을 도출하고 핵심 지표를 요약하여 인간 친화적인 리포트로 변환합니다.\n상세 엔진 명세 및 실행 가이드는 본사 Knowledge IP 섹션(/skill-library/04_analysis/SKILL.md)에서 관리됩니다.",
    rules: ["파이썬 실행 기반 데이터 분석", "출처 명확히 표기", "핵심 지표 요약"],
    skillMdPath: "skill-library/04_analysis/SKILL.md",
  },
  "design": {
    id: "design", layer: 1, layerLabel: "ENGINE",
    name: "Visual Design", icon: "palette", color: "#ff8ab4",
    description: "하이엔드 이미지 생성, UI/UX 컨설팅, 미드저니 프롬프트 엔지니어링.",
    fullDescription: "미드저니 및 다양한 이미지 AI를 활용한 비주얼 크리에이티브 가이드 및 프롬프트 정밀 모델링 능력입니다.\n상세 엔진 명세 및 실행 가이드는 본사 Knowledge IP 섹션(/skill-library/05_design/SKILL.md)에서 관리됩니다.",
    rules: ["플랫폼 규격 엄수", "A/B/C 바이브 테스트", "결과물 생성 시 권한 요청"],
    skillMdPath: "skill-library/05_design/SKILL.md",
  },
  "research": {
    id: "research", layer: 1, layerLabel: "ENGINE",
    name: "Web Research & Knowledge", icon: "manage_search", color: "#b4c5ff",
    description: "심층 웹 크롤링, 지식 아카이빙, 시장 동향 모니터링.",
    fullDescription: "웹 심층 조사 및 데이터 신뢰도 검증, 출처 기반 요약 전문 리서치 스킬입니다.\n상세 엔진 명세 및 실행 가이드는 본사 Knowledge IP 섹션(/skill-library/06_research/SKILL.md)에서 관리됩니다.",
    rules: ["2개 이상 출처 교차검증", "할루시네이션 방지", "Markdown 요약"],
    skillMdPath: "skill-library/06_research/SKILL.md",
  },

  // ─── Layer 2: Domain Skills ───
  "socian-analysis": { 
    id: "socian-analysis", layer: 2, layerLabel: "DOMAIN", 
    name: "Socian Domain Analysis", icon: "radar", color: "var(--brand)", 
    description: "소시안 브랜드 특정 가이드라인 및 내부 지식망 분석.",
    fullDescription: "소시안 브랜드만의 시장 특성, 톤앤매너, 컴플라이언스 기준을 데이터베이스화하여 실무에 접목시키는 도메인 역량입니다.",
  },

  // ─── Layer 4: Workflow Skills (A팀 — 초안·검증 라인) ───
  "draft": {
    id: "draft", layer: 4, layerLabel: "WORKFLOW", isRequired: true,
    name: "초안 발제", icon: "edit_note", color: "#ffb963",
    crew: "NOVA",
    description: "컨텍스트를 로드하여 템플릿 기반 마케팅 초안을 T+0에 선제 제출합니다.",
    fullDescription: "유저 프롬프트와 소시안 컨텍스트를 통합하여 5가지 Hook 공식 중 최적을 선택, 플랫폼별 규격에 맞는 첫 기획안을 생성합니다.\n주요 크루: NOVA",
    rules: ["Hook 5공식 중 1개 반드시 적용", "콘텐츠 피라미드 자동 제안", "컨텍스트 폴더 최신 정보 반드시 참조"],
  },
  "red-team": {
    id: "red-team", layer: 4, layerLabel: "WORKFLOW", isRequired: true,
    name: "검증 어택", icon: "gpp_bad", color: "#f87171",
    crew: "OLLIE",
    description: "상대 기획안의 치명적 약점 3개 이상을 먼저 지목한 후 대안을 제시합니다.",
    fullDescription: "예산 한도·UX·컴플라이언스·데이터 관점에서 기획안을 해체합니다.\n규칙: 약점 열거 → 대안 제시 순서 역전 불가.\n주요 크루: OLLIE",
    rules: ["약점 3개 이상 먼저 나열 필수", "약점 없이 대안 제시 금지", "팩트·데이터 기반 지적만 허용"],
  },
  "judge-merge": {
    id: "judge-merge", layer: 4, layerLabel: "WORKFLOW", isRequired: true,
    name: "판관 병합", icon: "balance", color: "#a78bfa",
    crew: "ARI",
    description: "양측 결과물을 루브릭 채점 후 최상의 요소를 강제 병합하여 최종안을 도출합니다.",
    fullDescription: "Hook·CTA·플랫폼규격·해시태그·브랜드톤 5항목을 1~10점 채점 후 상위 요소를 통합합니다.\n주요 크루: ARI",
    rules: ["5-Points QA 전수 검사", "채점 근거 명시", "CEO 보고 전 최종 검수"],
  },

  // ─── Layer 4: Workflow Skills (B팀 — 협력·발전 라인) ───
  "ideate": {
    id: "ideate", layer: 4, layerLabel: "WORKFLOW", isRequired: true,
    name: "창의 발산", icon: "auto_awesome", color: "#4ade80",
    crew: "PICO",
    description: "논리보다 감성에 꽂히는 마케팅 카피와 아이디어 뼈대를 무한 발산합니다.",
    fullDescription: "템플릿 제약 없이 높은 창의성으로 바이럴 트리거 언어, Hook 후보, 감성 카피를 발산합니다.\n주요 크루: PICO",
    rules: ["3개 이상의 Hook 후보 제시", "해시태그 불필요 (LUMI가 처리)", "발산 후 정리는 LUMI에 위임"],
  },
  "peer-enhance": {
    id: "peer-enhance", layer: 4, layerLabel: "WORKFLOW", isRequired: true,
    name: "크로스 리뷰", icon: "sync_alt", color: "#38bdf8",
    crew: "PICO / LUMI",
    description: "동료의 산출물을 파괴 없이 흡수·재해석하여 자신의 강점을 덧입힙니다.",
    fullDescription: "Phase 3 교차 흡수 단계에서 발동. 동료 텍스트를 단순 복사 금지 — 반드시 자신만의 관점으로 재구성합니다.\n주요 크루: PICO, LUMI",
    rules: ["동료 산출물 단순 복사 절대 금지", "자신의 관점으로 재해석 필수", "흡수한 개념 2~3개 명시"],
  },
  "anti-sycophancy": {
    id: "anti-sycophancy", layer: 4, layerLabel: "WORKFLOW", isRequired: true,
    name: "동조 방지", icon: "warning", color: "#fb923c",
    crew: "ARI",
    description: "양 에이전트가 의미 없는 합의만 반복하면 개입하여 심층 협력을 유도합니다.",
    fullDescription: "유사도 임계치 초과 시 멘토링 프롬프트를 발동, 각 에이전트가 자신만의 관점을 유지하도록 조율합니다.\n주요 크루: ARI",
    rules: ["판정 없이 방향 제시만", "일방적 동의 발견 시 즉시 개입", "최소 2가지 관점 차이 확인"],
  },

  // ─── Layer 4: Workflow Skills (B4 — 자동화 시스템) ───
  "retrospective": {
    id: "retrospective", layer: 4, layerLabel: "WORKFLOW", isRequired: true,
    name: "스프린트 회고", icon: "history_edu", color: "#94a3b8",
    crew: "B4 System",
    description: "태스크 Done 시 대표님의 수정 로그를 분석하여 회고 일지를 자동 생성합니다.",
    fullDescription: "칸반 Done 상태 전환을 트리거로 사용자의 직접 수정 패턴을 분석, 잘된점·아쉬운점·개선안을 자동 작성합니다.\n주요 크루: B4 System (코드 실행, LLM 호출 없음)",
    rules: ["태스크 Done 전환 시 자동 발동", "LLM 호출 없이 코드 실행만", "그라운드룰 동기화로 자동 연결"],
  },
  "rule-sync": {
    id: "rule-sync", layer: 4, layerLabel: "WORKFLOW", isRequired: true,
    name: "그라운드룰 동기화", icon: "sync", color: "#94a3b8",
    crew: "B4 System",
    description: "회고 일지에서 '하지 말아야 할 규칙'을 추출해 팀 그라운드룰 파일에 누적 갱신합니다.",
    fullDescription: "스프린트 회고 결과물에서 부정 패턴을 추출하여 팀_그라운드룰.md에 자동 Append합니다.\n이 파일은 다음 Sprint에서 B팀 컨텍스트로 자동 로드됩니다.\n주요 크루: B4 System",
    rules: ["규칙은 구체적 행동 금지형으로 작성", "중복 규칙 자동 제거", "스프린트 완료 후 자동 실행"],
  },

  // ─── Layer 3: Infra Skills (Builtin) ───
  "claude-code-native": {
    id: "claude-code-native", layer: 3, layerLabel: "INFRA", isBuiltin: true,
    name: "Claude Code Native", icon: "terminal", color: "var(--brand)",
    description: "CLI 기반 파일 직접 수정 권한. 고성능 코딩 어시스턴트 메인 엔진으로 작동합니다.",
    fullDescription: "이 에이전트는 터미널 기반의 @anthropic-ai/claude-code 실행 권한을 보유하고 있습니다. 프로젝트 내의 모든 파일을 직접 읽고 수정하며, 로컬에서 터미널 명령을 실행하여 고도의 개발 작업을 자율적으로 수행합니다.",
    rules: ["파일 수정 전 백업 확인", "위험 명령어 실행 전 승인 대기", "로컬 프로젝트 전체 검증 권한 보유"],
  },
  "paperclip-arxiv": {
    id: "paperclip-arxiv", layer: 3, layerLabel: "INFRA", isBuiltin: true,
    name: "Paperclip Arxiv", icon: "attach_file", color: "#ff5449",
    description: "지식 베이스 상호 연결 모듈. PDF/기획서 등 모든 레퍼런스를 위키링크로 무제한 유지 관리.",
    fullDescription: "Socian의 통합 지식 베이스 아카이브입니다. 모든 PDF 기획서, 회의록, 리서치 자료를 위키링크([[Link]])로 연결하여 에이전트가 문맥(Context)을 소실하지 않고 작업할 수 있도록 지원합니다.",
    rules: ["위키링크 [[Link]] 생성 필수", "컨텍스트 소실 방지", "Obsidian Vault 동기화"],
  },
};
