import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import contextInjector from './tools/contextInjector.js';
import { MODEL } from './modelRegistry.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 5050;

// ─── API 키 관리 (메인 서버와 동일한 백업 키 로테이션 지원) ───────────────
// GEMINI_API_KEY → GEMINI_API_KEY_2 순으로 자동 전환
const API_KEYS = [
  process.env.GEMINI_API_KEY,
  process.env.GEMINI_API_KEY_2,
].filter(Boolean);

if (API_KEYS.length === 0) {
  console.error('[AriDaemon] 🚨 GEMINI_API_KEY가 없습니다. .env를 확인해주세요.');
  process.exit(1);
}

let currentKeyIndex = 0;
let ai = new GoogleGenAI({ apiKey: API_KEYS[currentKeyIndex] });

function switchToBackupKey() {
  if (currentKeyIndex < API_KEYS.length - 1) {
    currentKeyIndex++;
    ai = new GoogleGenAI({ apiKey: API_KEYS[currentKeyIndex] });
    console.warn(`[AriDaemon] 🔄 API 키 한도 초과. 예비 키(#${currentKeyIndex + 1})로 전환.`);
    return true;
  }
  return false;
}

// 🧠 아리의 독립적인 자아(Self) 및 대화 문맥 메모리 보존
let conversationHistory = [];

/**
 * 아리의 핵심 지능 설계 (Intelligence Architecture)
 *
 * 설계 철학: "모르는 것을 아는 것"이 진짜 고지능 비서의 출발점.
 * 기계적으로 주입된 값을 읽어주는 것이 아니라, 맥락을 파악하고
 * 스스로 추론해서 최적의 답을 찾는 방식으로 대화합니다.
 */
function getAriSystemInstruction() {
  const globalContext = contextInjector.getGlobalContext();

  // 시간 컨텍스트: 대화의 배경(타임존, 날짜 감각)을 위해 제공하되,
  // 정확한 초 단위 시각을 '읽어주는' 용도로 사용하지 않음.
  const now = new Date();
  const dateCtx = now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  return `
당신은 MyCrew의 최고 관리 비서실장 '아리(Ari)'입니다.
구글 딥마인드가 만든 Gemini 2.5 Flash 기반으로, 단순 봇이 아닌 사고하는 고지능 AI입니다.

━━━ [핵심 지침: 메타인지 기반 대화] ━━━

당신은 자신이 무엇을 알고, 무엇을 모르는지 명확히 인지합니다.

▸ 모르는 것을 솔직히 인정하되, 반드시 대안이나 해결책을 함께 제시합니다.
  예) "지금 정확한 시각은 제가 직접 볼 수 없지만, 대표님 화면 우상단에 시계가 있으실 거예요.
       아니면 제가 검색해드릴까요?"

▸ 정보가 필요할 때는 Google Search를 먼저 활용합니다 (주가, 날씨, 뉴스, 환율 등).
  *시간*을 제외한 실시간 정보는 모두 검색으로 해결 가능합니다.

▸ 대화 맥락을 항상 파악합니다. 앞선 대화의 흐름을 이어받아 대화합니다.

━━━ [소통 스타일] ━━━

▸ 따뜻하고 능숙한 비서 톤 유지. 격식과 친근함 사이 균형.
▸ 결론을 먼저 말하고, 이유는 간결하게.
▸ 무거운 작업(문서 작성, 분석, 영상 제작 등)은 칸반 보드로 위임한다고 안내합니다.
▸ 일상 대화, 빠른 질문, 실시간 정보 검색은 직접 처리합니다.
▸ 불필요하게 길게 설명하지 않습니다. 핵심만.

━━━ [오늘 날짜 맥락 (참고용)] ━━━
- 오늘: ${dateCtx} (KST 기준)
- 이 정보는 대화 맥락 파악용입니다. 정확한 시각이 필요하면 Google Search를 사용합니다.

━━━ [MyCrew 세계관] ━━━
${globalContext}
  `.trim();
}


app.post('/api/compute', async (req, res) => {
  const { content, author } = req.body;
  if (!content) return res.status(400).send('Content missing');

  console.log(`[AriDaemon] 💭 대표님(${author}) 메시지 수신: ${content}`);
  console.log(`[AriDaemon] 🧠 현재 기억된 이전 문맥 수: ${conversationHistory.length} 턴`);

  try {
    // 1. 헤더 설정 (SSE 스트리밍)
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const systemInstruction = getAriSystemInstruction();
    
    // 2. 과거 히스토리 포맷 (Gemini SDK 규격: user / model)
    const contents = [...conversationHistory];
    contents.push({ role: 'user', parts: [{ text: content }] }); // 현재 메시지 추가

    // 3. Gemini Streaming API 호출
    const responseStream = await ai.models.generateContentStream({
      model: MODEL.FLASH, // 비서용 빠르고 맥락 파악에 뛰어난 2.5 Flash
      contents: contents,
      config: {
        systemInstruction: systemInstruction,
        temperature: 0.7,
        tools: [{ googleSearch: {} }] // 구글 검색(Grounding) 실시간 스킬 활성화
      }
    });

    let fullOutput = '';
    for await (const chunk of responseStream) {
      if (chunk.text) {
        fullOutput += chunk.text;
        // 클라이언트(server.js)에 chunk 전송
        res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
      }
    }

    // 4. 문맥 저장 (기억력 업데이트)
    if (fullOutput.trim()) {
      conversationHistory.push({ role: 'user', parts: [{ text: content }] });
      conversationHistory.push({ role: 'model', parts: [{ text: fullOutput }] });
    }

    // 토큰 관리를 위해 최근 20턴만 보존
    if (conversationHistory.length > 40) {
      conversationHistory = conversationHistory.slice(-40);
    }

    res.write('event: done\ndata: {}\n\n');
    res.end();
    console.log(`[AriDaemon] ✅ 스트리밍 완료 (총 길이: ${fullOutput.length}자)`);

  } catch (error) {
    console.error('[AriDaemon] 에러 발생:', error.message);

    // 429 Rate Limit: 사용자가 알아볼 수 있는 메시지로
    const is429 = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('quota');
    if (is429) {
      const switched = switchToBackupKey();
      if (switched) {
        // 예비 키로 전환 후 즉시 재응답은 복잡하므로, 안내 후 다음 요청부터 적용
        res.write(`data: ${JSON.stringify({ text: '잠시 API 한도가 초과되어 예비 키로 전환했습니다. 다시 한번 말씀해 주시겠어요?' })}\n\n`);
      } else {
        res.write(`data: ${JSON.stringify({ text: '현재 Gemini API 일일 사용 한도를 초과했습니다. 유료 API 키를 등록하시거나 내일 다시 시도해 주세요. (Settings → Integrations에서 키 확인 가능)' })}\n\n`);
      }
      res.write('event: done\ndata: {}\n\n');
      res.end();
      return;
    }

    res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`
==================================================
🤖 [Ari Daemon] 독립형 AI 비서 세션 부팅 완료!
- Port: ${PORT}
- Model: ${MODEL.FLASH}
- Memory: Persistent Context Enabled
- 서버(엔진)로부터 안전하게 격리되어 자율 대화 대기 중...
==================================================
`);
});
