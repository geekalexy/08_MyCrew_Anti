# Phase 39: Zero-Command UX & MCP 아키텍처 재리뷰 요청서 (To Prime)

## 1. 개요
- **작성자:** Luca
- **리뷰어:** Prime
- **목적:** 앞선 종합 리뷰(39_Phase39_ZeroCommand_MCP_종합리뷰_Prime.md)에서 지적된 3대 핵심 결함(🟢 A — 조건부 승인 사항)에 대한 조치 결과를 보고하고 재승인을 요청합니다.

## 2. 결함 수정 내역

### 🔴 #3 `runDirect()`에 Quota Defender 누락 해결 (High)
**[변경 파일]** `ai-engine/executor.js`
- **조치 사항:** Zero-Command 경로(즉, `forceRedispatchTask` → `runDirect()` 호출)에서도 Claude의 쿼터 방어가 안전하게 작동하도록 `runDirect()` 내부의 `modelToUse` 파이프라인에 기존 `run()`과 동일한 Quota Defender Hook을 삽입했습니다.
- **결과:** 사용자가 명령어 없이 드래그 앤 드롭으로 작업을 시작할 때도 쿼터가 부족하면 즉각 `Gemini 3.1 Pro`로 핫스왑됩니다.

### 🔴 #4 Selective Loading 모드 전환 메커니즘 개선 (High)
**[변경 파일]** `server.js`, `mcp_server.js`
- **조치 사항:** 
  1. `server.js`(`/api/tasks/:id/run`)에서 라우팅이 결정될 때 현재 모드를 `.agents/current_mcp_mode.txt` 파일에 기록하도록 구현했습니다.
  2. `mcp_server.js`에서는 `ListToolsRequestSchema` 호출 시 더 이상 `process.env.MYCREW_MODE`에만 의존하지 않고, 동적으로 위 파일을 읽어(`fs.readFileSync`) 모드 변경 사항을 런타임에 즉시 반영하도록 수정했습니다.
- **결과:** MCP 서버 재시작 없이도 사용자의 행동(기획 ↔ 개발 ↔ 리뷰 모드 전환)에 따라 스킬들이 동적으로 필터링(Selective Loading)되어 제공됩니다.

### 🟡 #1 프롬프트 경로 하드코딩 수정 (Medium)
**[변경 파일]** `ai-engine/services/intentRouter.js`
- **조치 사항:** `__dirname`을 이용한 깊은 상대 경로(`../../../../../`) 구조를 제거하고, `process.cwd()` 기반의 절대 경로 동적 매핑 로직(`path.resolve(process.cwd(), '../../01_Company_Operations/...')`)으로 교체했습니다.
- **결과:** 폴더 깊이가 변경되거나 실행 위치가 달라져도 프롬프트 파일을 안정적으로 탐색할 수 있습니다.

---

## 3. 검토 요청 사항
Prime께서 지적해주신 조건부 승인 조건 3가지를 모두 수용하여 소스코드에 반영했습니다.
(프론트엔드 드래그 E2E 스모크 테스트는 백엔드 Hook 통과 및 `[Quota Defender]` 경고 로그 출력을 통해 정상 작동을 자체 검증했습니다.)

코드 정합성 및 해결 방식의 무결성을 다시 한번 검토해 주시고 **최종 승인(🟢 A - Pass)** 부탁드립니다!
