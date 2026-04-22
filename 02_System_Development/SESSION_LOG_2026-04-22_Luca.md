# 🚀 MyCrew Development Record

## 📅 오늘 수행한 작업 (세션로그_26.04.21 )
1. **Video Lab UI/UX 및 데이터 바인딩 버그 수정**
   - 썸네일(Thumbnail) 이미지 깨짐 및 채널명(Author) '정보 없음' 노출 문제 해결 (`yt-search` 파싱 로직 개선).
   - 심층 분석 리포트 확인 패널에 **[복사]** 및 **[다운로드/저장]** 기능 추가.
   - Step 4(씬 검수) 상단에 AI가 추천하는 시선을 끄는 **훅킹 타이틀 후보 3종** 노출 UI 구현.

2. **프롬프트 엔지니어링 고도화**
   - 스크립트 작성 시 사용자가 요청한 총 영상 길이(Target Length)와 개별 씬의 시간(Duration) 총합이 수학적으로 오차 없이 일치하도록 절대적 제약 조건(Absolute Math Constraint) 추가.

3. **NotebookLM 자동화 파이프라인 개조 시도 (Native Node.js vs Python MCP)**
   - 불안정하고 터미널 PATH 설정 문제를 일으키던 하드코딩된 파이썬 서드파티(`nlm` CLI)를 거둬내고, **아리엔진 자체 내장 Node.js 어댑터(`NotebookLMAdapter.js`)**를 스캐폴딩.
   - Mac의 구글 로그인 봇 차단(Bot-detection) 방어를 위해 전용 독립 프로필(`.socian-notebook-profile`) 우회 방법(Puppeteer 제어)을 실험하여 유의미한 수동 세션 인증 매커니즘 확보.

---

## 🎯 내일 진행할 작업 (Tomorrow's Next Steps)
**목표:** B2B/B2C 서비스 상용화(Commercialization)를 대비한 아키텍처 재설계

1. **마이크루 전용 독립 NotebookLM MCP 서버 구축**
   - 화면이 팝업되거나 사용자 단말의 쿠키에 의존하는 스크래핑 방식 버리기.
   - `@modelcontextprotocol/sdk`를 사용하여 `mycrew-notebooklm-mcp` 패키지 구축.
2. **Headless & HTTP Reverse-API 통신 구현**
   - 브라우저 제어가 아닌 HTTP 리퀘스트 레벨에서 세션 통신 로직을 구현하여 속도 향상시키기.
3. **토큰 및 멀티테넌트 세션 관리 시스템 설계**
   - 사용자 계정별로 NotebookLM 세션 토큰을 관리할 수 있는 체계 기획.
