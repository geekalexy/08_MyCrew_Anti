export const SKILL_REGISTRY = {
  // ─── Layer 1: Engine Skills ───
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
