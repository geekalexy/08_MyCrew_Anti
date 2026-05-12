# Phase 42.4: WikiEngine 리팩토링 기획서 (Graphify 로컬 CLI 연동)

**작성일**: 2026-05-13  
**작성자**: Luca (CTO/아키텍처)  
**상태**: ✅ 구현 완료 (2026-05-13)

---

## 1. 개요 (Overview)
- **목적**: `wikiEngine.js`에서 실행하던 `uvx` 기반 Graphify 호출 로직을 폐기하고, CEO 로컬 환경에 설치된 정식 `graphify` CLI를 직접 호출하도록 백엔드 파이프라인을 리팩토링합니다.
- **배경**: 이전 방식(`uvx --from git+...`)은 Antigravity 샌드박스의 캐시 권한 차단으로 인해 실행되지 않아, 지식 그래프가 백그라운드에서 자동 업데이트되지 않는 문제가 있었습니다. Phase 42.5에서 Homebrew와 pipx를 통해 로컬 터미널 환경에 Graphify를 성공적으로 이식했으므로, 이제 Node.js 서버가 이를 직접 트리거할 수 있도록 연결해야 합니다.

---

## 2. 작업 상세 내용 (Implementation Details)

### 2.1 대상 파일
- `/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/V2_Core_Engine/01_아리_엔진/ai-engine/services/wikiEngine.js`

### 2.2 핵심 수정 사항
1. **로컬 Graphify 바이너리 경로 매핑**
   - Node.js `execFile` 환경에서는 환경 변수 PATH가 터미널과 다를 수 있습니다.
   - 따라서 안전하게 절대 경로(`/Users/alex/.local/bin/graphify`) 또는 쉘 환경을 통한 호출을 사용하도록 변경합니다.
   
2. **`update` 파이프라인 리팩토링 (L44-47)**
   - **AS-IS**:
     ```javascript
     await execFileAsync('uvx', [
       '--from', 'git+https://github.com/safishamsi/graphify.git',
       'graphify', 'update', projectRoot
     ]);
     ```
   - **TO-BE**:
     ```javascript
     await execFileAsync('/Users/alex/.local/bin/graphify', ['update', projectRoot]);
     ```

3. **`global add` 파이프라인 리팩토링 (L66-69)**
   - **AS-IS**:
     ```javascript
     await execFileAsync('uvx', [ ... 'graphify', 'global', 'add', graphJsonPath, '--as', path.basename(projectRoot) ]);
     ```
   - **TO-BE**:
     ```javascript
     await execFileAsync('/Users/alex/.local/bin/graphify', [
       'global', 'add', graphJsonPath, '--as', path.basename(projectRoot)
     ]);
     ```

### 2.3 에러 로깅 및 예외 처리 강화
- CLI 호출 실패 시 오류가 발생할 경우, 단순 실패 처리로 끝나지 않도록 `stdout` 및 `stderr`를 캡처하여 터미널(로그)에 명확히 출력하도록 보완합니다.
- 예: `catch (e) { console.error('[WikiEngine] Graphify update CLI Error:', e.message, e.stderr); }`

---

## 3. 기대 효과 (Impact)
1. **완전 자동화**: 에이전트나 사용자가 코드를 수정/저장할 때마다 디바운스(10초) 이후 백그라운드에서 `graphify update`가 자동으로 실행됩니다.
2. **항상 최신화된 그래프**: 1200+ 노드의 시스템 아키텍처 및 도메인 지식이 코드와 정확히 동기화된 상태를 유지합니다.
3. **비용 절감**: AST 기반의 `update` 명령어는 변경된 파일만 식별하여 시맨틱(LLM) 파싱을 최소화하므로, 빠르고 경제적으로 그래프를 갱신합니다.

---

## 4. 진행 계획
- [x] 본 기획서 승인 즉시 `wikiEngine.js` 리팩토링 진행
- [x] 서버 재시작 후 디바운스 타이머 로직과 함께 백그라운드 그래프 추출 테스트
- [x] `Graphify 자동화` 파이프라인 최종 점검 후 Phase 42(ADM 도입) 본 작업 진입
