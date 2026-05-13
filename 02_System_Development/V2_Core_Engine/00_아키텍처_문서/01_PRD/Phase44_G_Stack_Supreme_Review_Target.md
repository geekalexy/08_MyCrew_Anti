# 🛡️ Supreme Review Target: Phase 44-3 G-Stack 아키텍처 내재화 설계안

**작성자**: Luca (Gemini 3.1 Pro High)
**리뷰 요청 대상**: Prime Advisor (Claude Opus 4.6 Thinking / Sonnet 4.6 Thinking)

## 1. 🎯 설계 개요 (Architecture Overview)
Antigravity의 Phase 44 자율 검증(QA) 파이프라인의 속도 및 토큰 오버헤드를 극단적으로 최적화하기 위해, Garry Tan의 G-Stack 아키텍처 핵심 요소를 내재화하는 방향으로 `Phase44-3_Auto_QA_개발구현계획서.md`를 기획했습니다.

**핵심 설계 도입안**:
1. **Node.js 메인 루프와의 디커플링**: QA 브라우저를 `executor.js`나 MCP에 통합하지 않고, **Bun 기반의 독립된 데몬(Sub-process)**으로 분리하여 Playwright를 백그라운드에 에페머럴(Ephemeral)하게 유지시킵니다. (30분 유휴 시 Auto-Kill)
2. **Zero-MCP 통신**: 무거운 JSON 스키마 기반의 도구 통신을 버리고, STDIN/STDOUT 파이프를 통한 단순 Plain Text 입출력을 사용합니다.
3. **접근성 트리(AOM) 브라우징**: DOM(React/Shadow DOM/CSP) 장벽을 피하기 위해, 크로미움의 시각 장애인용 접근성 트리를 파싱하여 텍스트 매핑(`[@E1]`) 방식으로 화면을 읽습니다.

## 2. 📝 예상되는 코드 변경점 (Pseudocode / Logic)

### A. `toolExecutor.js` (데몬 관리 및 Zero-MCP 통신)
```javascript
export async function executeTool(name, args, options = { mode: 'DEV' }) {
    // QA 모드에서 브라우징 도구 호출 시 데몬 연결
    if (name === 'browse' && mode === 'QA') {
        let daemon = checkDaemonStatus();
        if (!daemon) {
           // 데몬이 없으면 Bun 바이너리 백그라운드 실행
           daemon = child_process.spawn('bun', ['mycrew-browser.ts'], { detached: true });
           saveDaemonPort(daemon.port);
        }
        // Zero-MCP: Plain Text 전송 및 AOM 트리 반환
        const aomResult = await sendToDaemon(daemon.port, `BROWSE ${args.url}`);
        return { output: aomResult };
    }
}
```

### B. `mycrew-browser.ts` (Bun 기반 AOM 파서)
```typescript
import { chromium } from 'playwright';

// STDIN 리스너
process.stdin.on('data', async (data) => {
    const command = data.toString();
    // Playwright를 이용해 접근성 트리 스냅샷 추출
    const snapshot = await page.accessibility.snapshot();
    const parsedTextTree = traverseAndMap(snapshot); // [@E1] Button 형태로 변환
    process.stdout.write(parsedTextTree);
});

// 30분 타이머
setTimeout(() => process.exit(0), 30 * 60 * 1000);
```

## 3. ⚠️ 작업자(Luca)가 우려하는 취약점 및 고민 포인트

Supreme Reviewer(Prime/Sonnet)님께 다음 3가지 관점에서 신랄한 리뷰를 요청합니다.

1. **좀비 데몬 프로세스 (Zombie Process Leak)**
   - Bun 데몬이 `{ detached: true }`로 실행됩니다. 만약 관제탑인 Node.js(`server.js`)가 OOM(Out of Memory)이나 기타 이유로 강제 종료될 경우, 30분 타이머가 끝날 때까지 Bun 데몬이 메모리에 좀비로 남아있을 수 있습니다. OS 단에서 확실하게 묶어버리는 더 나은 PID 관리 방법이 있을까요?
2. **접근성 트리(AOM) 브라우징의 치명적 맹점 (Blind Spot)**
   - AOM 트리는 철저히 '시맨틱'만 봅니다. 즉, CSS 버그로 인해 투명도(`opacity: 0`)가 되거나 `z-index`가 꼬여서 다른 div에 완전히 가려져 유저가 클릭할 수 없는 버튼도 AOM에는 "클릭 가능한 버튼"으로 멀쩡하게 뜹니다. UI/UX "레이아웃" 테스트를 QA 해야 하는데 이 AOM만 믿고 가면 거짓 양성(False Positive) QA 통과가 남발하지 않을까요?
3. **보안: 로컬호스트 IPC 채널 탈취 가능성**
   - 데몬이 무작위 Localhost 포트로 통신 채널을 엽니다. 악의적인 페이로드를 주입받은 다른 로컬 에이전트 스크립트가 해당 포트를 찾아내어 STDIN을 통해 임의의 URL이나 악성 스크립트 인젝션을 시도할 가능성은 없을까요? Token 인증 방식을 어떻게 강화하는 것이 가장 경량(Overhead 0)일까요?

---
*리뷰어는 이 문서를 바탕으로 아키텍처의 결함을 파헤쳐 주시고, 대안을 제시해 주시기 바랍니다.*
