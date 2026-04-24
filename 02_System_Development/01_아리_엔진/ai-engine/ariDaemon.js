import express from 'express';
import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import contextInjector from './tools/contextInjector.js';
import { MODEL } from './modelRegistry.js';

// ─── ARI_BRAIN.md 로드 (아리의 핵심 두뇌) ────────────────────────────────────
const ARI_BRAIN_PATH = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../docs/ARI_BRAIN.md'
);
let ARI_BRAIN = '';
try {
  ARI_BRAIN = fs.readFileSync(ARI_BRAIN_PATH, 'utf-8');
  console.log('[AriDaemon] 🧠 ARI_BRAIN.md 로드 성공:', ARI_BRAIN_PATH);
} catch (e) {
  console.warn('[AriDaemon] ⚠️ ARI_BRAIN.md 로드 실패 — 내장 프롬프트로 폴백:', e.message);
}

// database.js는 상위 디렉토리에 위치
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// database.js 동적 로드 (ESM 상대경로)
let dbManager;
try {
  const dbModule = await import(path.resolve(__dirname, '../database.js'));
  dbManager = dbModule.default;
  console.log('[AriDaemon] ✅ DB 연결 성공');
} catch (e) {
  console.warn('[AriDaemon] ⚠️ DB 연결 실패 — 칸반 도구 비활성화:', e.message);
  dbManager = null;
}

dotenv.config();

const app = express();
app.use(express.json());

const PORT = 5050;

// ─── API 키 관리 ───────────────────────────────────────────────────────────
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

// ─── 대화 히스토리 (in-memory) ───────────────────────────────────────────
let conversationHistory = [];

// ─── 크루원 정보 SSOT ────────────────────────────────────────────────────
const CREW_INFO = {
  luca:  { name: 'Luca',  role: 'CTO / 시스템 아키텍트', model: 'Antigravity(Claude)', specialties: ['시스템 설계', '코드 구현', '아키텍처', '백엔드 개발'] },
  nova:  { name: 'Nova',  role: 'CMO / 마케팅 전략가',   model: MODEL.FLASH,           specialties: ['SNS 전략', '콘텐츠 기획', '바이럴', '릴스/쇼츠'] },
  pico:  { name: 'Pico',  role: '영상 디렉터',            model: MODEL.SONNET,          specialties: ['영상 제작', '릴스 시나리오', '숏폼 스크립트', '편집'] },
  lumi:  { name: 'Lumi',  role: '이미지 디렉터',          model: MODEL.FLASH,           specialties: ['이미지 생성', '디자인', '비주얼 기획', '썸네일'] },
  luna:  { name: 'Luna',  role: '최종 합성자',             model: 'Claude Opus',         specialties: ['종합 분석', '전략 합성', '보고서', '최종 검토'] },
  ollie: { name: 'Ollie', role: '적대적 판관',             model: 'Claude Opus',         specialties: ['크리티컬 리뷰', '품질 검증', '반론 제시'] },
  lily:  { name: 'Lily',  role: '영상 담당 (Team A)',      model: MODEL.SONNET,          specialties: ['영상', '시나리오'] },
};

// ─── 도구(Function Calling) 정의 ─────────────────────────────────────────
const ARI_TOOLS = [
  {
    functionDeclarations: [

      // ── [도구 1] 칸반 카드 생성 ──────────────────────────────────────
      {
        name: 'createKanbanTask',
        description: `칸반 보드에 새 태스크 카드를 생성하고 크루원에게 할당합니다.
사용자가 '루카한테 시켜', '태스크 만들어줘', '피코가 릴스 만들어줘' 등을 말할 때 호출합니다.
중요: 사용자의 간단한 지시를 전문적인 업무 지시서로 업그레이드하여 작성합니다.`,
        parameters: {
          type: 'object',
          properties: {
            title: {
              type: 'string',
              description: '태스크 제목. 명확하고 행동지향적으로. 예: "[마케팅] 소시안 Plan C 인스타 릴스 3편 기획"',
            },
            assigneeId: {
              type: 'string',
              enum: ['luca', 'nova', 'pico', 'lumi', 'luna', 'ollie', 'lily'],
              description: '담당 크루원 ID. 업무 성격에 따라 최적 담당자를 선택합니다.',
            },
            content: {
              type: 'string',
              description: `태스크 본문 내용.
기계적인 템플릿(목적, 배경 등)에 얽매일 필요 없이, 요청의 맥락과 복잡도에 따라 유연하고 스마트하게 작성합니다.
간단한 지시일 경우 스스로 판단하여 전문적인 형태로 보완합니다.`,
            },
            priority: {
              type: 'string',
              enum: ['high', 'medium', 'low'],
              description: '우선순위. 긴급/중요하면 high, 일반은 medium, 나중에 해도 되면 low.',
            },
            category: {
              type: 'string',
              enum: ['DEEP_WORK', 'CONTENT', 'MARKETING', 'DESIGN', 'ANALYSIS', 'MEDIA', 'RESEARCH'],
              description: '작업 카테고리. 업무 성격에 맞게 선택.',
            },
          },
          required: ['title', 'assigneeId', 'content', 'priority', 'category'],
        },
      },

      // ── [도구 2] 칸반 카드 수정 ──────────────────────────────────────
      {
        name: 'updateKanbanTask',
        description: `기존 칸반 태스크를 수정하거나 상태(status), 담당자 등을 변경합니다.
사용자가 '72번 카드 진행열로 옮겨줘', '#72 상태 바꿔줘', '담당자 바꿔줘', '내용 업데이트해줘' 등을 말할 때 이 도구를 반드시 사용합니다.
새 카드를 생성하지 않고 기존 카드를 수정해야 할 때 적합합니다.`,
        parameters: {
          type: 'object',
          properties: {
            taskId: {
              type: 'number',
              description: '수정할 태스크 ID (숫자)',
            },
            content: {
              type: 'string',
              description: '수정할 새 내용 (없으면 기존 유지)',
            },
            assigneeId: {
              type: 'string',
              description: '새 담당자 ID (없으면 기존 유지)',
            },
            status: {
              type: 'string',
              enum: ['PENDING', 'in_progress', 'done', 'CANCELLED'],
              description: '변경할 상태 (없으면 상태 유지)',
            },
          },
          required: ['taskId'],
        },
      },

      // ── [도구 3] 칸반 카드 삭제 ──────────────────────────────────────
      {
        name: 'deleteKanbanTask',
        description: `칸반 태스크를 삭제(소프트 딜리트)합니다.
사용자가 '카드 지워줘', '태스크 삭제해줘', '#{ID} 없애' 등을 말할 때 호출합니다.`,
        parameters: {
          type: 'object',
          properties: {
            taskId: {
              type: 'number',
              description: '삭제할 태스크 ID',
            },
            reason: {
              type: 'string',
              description: '삭제 이유 (선택)',
            },
          },
          required: ['taskId'],
        },
      },

      // ── [도구 4] 크루 현황 조회 ───────────────────────────────────────
      {
        name: 'getCrewStatus',
        description: `크루원의 현재 진행 중인 태스크와 보드 현황을 조회합니다.
사용자가 '루카 뭐 해?', '지금 진행 중인 태스크?', '크루 상태 알려줘' 등을 말할 때 호출합니다.`,
        parameters: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: '특정 크루원 ID. 없으면 전체 크루 조회.',
            },
            statusFilter: {
              type: 'string',
              enum: ['in_progress', 'PENDING', 'done', 'all'],
              description: '필터할 상태. 기본값 all.',
            },
          },
          required: [],
        },
      },

    ],
  },
];

// ─── 시스템 프롬프트 생성 (ARI_BRAIN.md 기반 3-Layer) ──────────────────────
function getAriSystemInstruction() {
  const globalContext = contextInjector.getGlobalContext();
  const now = new Date();
  const dateCtx = now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  // ── Layer 1: ARI_BRAIN.md — 핵심 정체성 (정적, 고품질) ──────────────────
  const coreBrain = ARI_BRAIN ||
    `당신은 MyCrew의 비서 아리(Ari)입니다. Gemini 2.5 Flash 기반 자율 행동형 비서입니다.`;

  // ── Layer 2: 런타임 컨텍스트 — 매 요청마다 최신화 ──────────────────────
  const runtimeCtx = [
    `━━━ [런타임 — ${dateCtx} KST] ━━━`,
    globalContext ? `[워크스페이스 현황]\n${globalContext}` : '',
  ].filter(Boolean).join('\n\n');

  return `${coreBrain}\n\n${runtimeCtx}`.trim();
}

// ─── 도구 실행 핸들러 ─────────────────────────────────────────────────────
async function executeTool(toolName, args) {
  console.log(`[AriDaemon] 🔧 도구 실행: ${toolName}`, JSON.stringify(args));



  if (!dbManager) {
    return { success: false, message: 'DB 연결 없음. 칸반 기능 사용 불가.' };
  }

  try {
    // ── createKanbanTask ──────────────────────────────────────────────────
    if (toolName === 'createKanbanTask') {
      const { title, assigneeId, content, priority, category } = args;

      // content에 title 헤더 포함하여 저장 (기존 DB 구조 활용)
      const fullContent = `# ${title}\n\n${content}`;
      const taskId = await dbManager.createTask(
        fullContent,
        '대표님(아리 위임)',  // requester
        MODEL.FLASH,           // model
        assigneeId,            // assigned_agent
        category               // category
      );

      // priority 업데이트 (updateTaskDetails 활용)
      await dbManager.updateTaskDetails(taskId, fullContent, assigneeId, MODEL.FLASH);

      // priority 직접 업데이트 (별도 SQL 필요 — run 직접)
      // priority는 getAllTasksLight에서 쓰이므로 별도 처리
      const crewMember = CREW_INFO[assigneeId] || { name: assigneeId };

      return {
        success: true,
        taskId,
        message: `✅ 태스크 카드 생성 완료!\n\n**#${taskId} — ${title}**\n- 담당: ${crewMember.name}\n- 카테고리: ${category}\n- 우선순위: ${priority}\n\n칸반 보드에서 확인하세요.`,
      };
    }

    // ── updateKanbanTask ──────────────────────────────────────────────────
    if (toolName === 'updateKanbanTask') {
      const { taskId, content, assigneeId, status } = args;

      // 현재 태스크 조회
      const existing = await dbManager.getTaskByIdFull(taskId);
      if (!existing) {
        return { success: false, message: `#${taskId} 태스크를 찾을 수 없습니다.` };
      }

      if (status) {
        await dbManager.updateTaskStatus(taskId, status);
      }

      if (content || assigneeId) {
        const newContent = content || existing.content;
        const newAgent   = assigneeId || existing.assigned_agent;
        const newModel   = existing.model || MODEL.FLASH;
        await dbManager.updateTaskDetails(taskId, newContent, newAgent, newModel);
      }

      return {
        success: true,
        taskId,
        message: `✅ #${taskId} 태스크 수정 완료!\n${status ? `- 상태: ${status}\n` : ''}${assigneeId ? `- 담당자: ${CREW_INFO[assigneeId]?.name || assigneeId}\n` : ''}${content ? '- 내용 업데이트됨\n' : ''}`,
      };
    }

    // ── deleteKanbanTask ──────────────────────────────────────────────────
    if (toolName === 'deleteKanbanTask') {
      const { taskId, reason } = args;
      const existing = await dbManager.getTaskByIdFull(taskId);
      if (!existing) {
        return { success: false, message: `#${taskId} 태스크를 찾을 수 없습니다.` };
      }
      await dbManager.deleteTask(taskId);
      return {
        success: true,
        taskId,
        message: `🗑️ #${taskId} 태스크가 삭제되었습니다.${reason ? ` (이유: ${reason})` : ''}`,
      };
    }

    // ── getCrewStatus ─────────────────────────────────────────────────────
    if (toolName === 'getCrewStatus') {
      const { agentId, statusFilter = 'all' } = args;
      const allTasks = await dbManager.getAllTasksLight();

      let filtered = allTasks.filter(t => {
        const agentMatch = agentId ? t.assigned_agent?.toLowerCase() === agentId.toLowerCase() : true;
        const statusMatch = statusFilter === 'all' ? true : t.status?.toLowerCase() === statusFilter.toLowerCase();
        return agentMatch && statusMatch;
      });

      if (filtered.length === 0) {
        return {
          success: true,
          message: agentId
            ? `${CREW_INFO[agentId]?.name || agentId}의 ${statusFilter === 'all' ? '활성' : statusFilter} 태스크가 없습니다.`
            : '현재 활성 태스크가 없습니다.',
          tasks: [],
        };
      }

      // 크루원별 그룹핑
      const grouped = {};
      for (const t of filtered) {
        const agent = t.assigned_agent || 'unassigned';
        if (!grouped[agent]) grouped[agent] = [];
        grouped[agent].push(t);
      }

      let summary = `📋 **크루 현황** (총 ${filtered.length}건)\n\n`;
      for (const [agent, tasks] of Object.entries(grouped)) {
        const crewName = CREW_INFO[agent]?.name || agent;
        summary += `**${crewName}** (${tasks.length}건)\n`;
        tasks.slice(0, 3).forEach(t => {
          const title = t.content?.split('\n')[0]?.replace(/^#\s*/, '') || `Task #${t.id}`;
          summary += `  - #${t.id} [${t.status}] ${title.slice(0, 40)}${title.length > 40 ? '...' : ''}\n`;
        });
        if (tasks.length > 3) summary += `  ...외 ${tasks.length - 3}건\n`;
        summary += '\n';
      }

      return { success: true, message: summary, tasks: filtered };
    }

    return { success: false, message: `알 수 없는 도구: ${toolName}` };

  } catch (err) {
    console.error(`[AriDaemon] 도구 실행 에러 (${toolName}):`, err.message);
    return { success: false, message: `도구 실행 중 오류: ${err.message}` };
  }
}

// ─── 메인 대화 엔드포인트 ─────────────────────────────────────────────────
app.post('/api/compute', async (req, res) => {
  const { content, author, oauthToken } = req.body;
  if (!content) return res.status(400).send('Content missing');

  // 구독 인증 토큰이 있으면 해당 토큰 기반 구독형 클라이언트 사용, 없으면 레거시 글로벌 클라이언트 사용
  let localAi = ai;
  if (oauthToken) {
    try {
      localAi = new GoogleGenAI({
        apiKey: 'empty', // @google/genai requires a string or ADC
        httpOptions: {
          headers: { 'Authorization': `Bearer ${oauthToken}` }
        }
      });
      console.log(`[AriDaemon] 🔐 구독인증 모드로 호출 (Model: ${MODEL.FLASH})`);
    } catch {
      console.warn(`[AriDaemon] 구독인증 초기화 실패, 기본 키로 폴백`);
    }
  }

  console.log(`[AriDaemon] 💭 대표님(${author}) 메시지: ${content}`);
  console.log(`[AriDaemon] 🧠 현재 컨텍스트: ${conversationHistory.length} 턴`);

  try {
    // SSE 스트리밍 헤더
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const systemInstruction = getAriSystemInstruction();
    const contents = [...conversationHistory, { role: 'user', parts: [{ text: content }] }];

    // ── Gemini API 호출 (Function Calling 지원, 스트리밍) ─────────────────
    const response = await localAi.models.generateContent({
      model: MODEL.FLASH,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: ARI_TOOLS,
      },
    });

    const candidate = response?.candidates?.[0];
    const parts = candidate?.content?.parts || [];

    // ── 도구 호출 처리 루프 ───────────────────────────────────────────────
    const toolCallParts   = parts.filter(p => p.functionCall);
    const textParts       = parts.filter(p => p.text);

    let finalText = '';

    if (toolCallParts.length > 0) {
      // 도구가 호출된 경우 — 실행 후 결과를 모델에 다시 넘겨 최종 응답 생성
      const toolResults = [];

      for (const part of toolCallParts) {
        const { name, args } = part.functionCall;
        const result = await executeTool(name, args);
        toolResults.push({
          functionResponse: {
            name,
            response: result,
          },
        });
      }

      // 도구 결과를 포함한 2차 대화 (최종 자연어 응답 생성)
      const followUpContents = [
        ...contents,
        { role: 'model', parts: toolCallParts },
        { role: 'user',  parts: toolResults },
      ];

      const finalStream = await localAi.models.generateContentStream({
        model: MODEL.FLASH,
        contents: followUpContents,
        config: {
          systemInstruction,
          temperature: 0.7,
          // 2차 응답에서는 도구 재귀 호출 방지 — 텍스트 응답만
        },
      });

      for await (const chunk of finalStream) {
        if (chunk.text) {
          finalText += chunk.text;
          res.write(`data: ${JSON.stringify({ text: chunk.text })}\n\n`);
        }
      }

      // 도구 실행 결과 중 success: false인 경우 직접 메시지 출력 (fallback)
      if (!finalText.trim()) {
        const fallback = toolResults.map(r => r.functionResponse.response.message).join('\n');
        finalText = fallback;
        res.write(`data: ${JSON.stringify({ text: fallback })}\n\n`);
      }

    } else {
      // 일반 텍스트 응답 — 그대로 스트리밍
      // (generateContent 사용 시 텍스트를 청크로 보내는 형식으로 변환)
      for (const part of textParts) {
        if (part.text) {
          finalText += part.text;
          // 300자 단위로 청크 분할하여 스트리밍 느낌 제공
          const chunks = part.text.match(/.{1,80}/gs) || [part.text];
          for (const chunk of chunks) {
            res.write(`data: ${JSON.stringify({ text: chunk })}\n\n`);
            await new Promise(r => setTimeout(r, 8)); // 자연스러운 타이핑 딜레이
          }
        }
      }
    }

    // ── 대화 히스토리 업데이트 ────────────────────────────────────────────
    if (finalText.trim()) {
      conversationHistory.push({ role: 'user',  parts: [{ text: content }] });
      conversationHistory.push({ role: 'model', parts: [{ text: finalText }] });
    }

    // 최근 30턴 보존 (60개 parts)
    if (conversationHistory.length > 60) {
      conversationHistory = conversationHistory.slice(-60);
    }

    res.write('event: done\ndata: {}\n\n');
    res.end();
    console.log(`[AriDaemon] ✅ 응답 완료 (${finalText.length}자, 히스토리: ${conversationHistory.length}턴)`);

  } catch (error) {
    console.error('[AriDaemon] 에러 발생:', error.message);

    const is429 = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED') || error.message?.includes('quota');
    if (is429) {
      const switched = switchToBackupKey();
      const msg = switched
        ? '잠시 API 한도가 초과되어 예비 키로 전환했습니다. 다시 한번 말씀해 주시겠어요?'
        : '현재 Gemini API 일일 사용 한도를 초과했습니다. 유료 API 키를 등록하시거나 내일 다시 시도해 주세요.';
      res.write(`data: ${JSON.stringify({ text: msg })}\n\n`);
      res.write('event: done\ndata: {}\n\n');
      res.end();
      return;
    }

    res.write(`event: error\ndata: ${JSON.stringify({ message: error.message })}\n\n`);
    res.end();
  }
});

// ─── 헬스체크 ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    model: MODEL.FLASH,
    historyTurns: conversationHistory.length,
    dbConnected: !!dbManager,
    tools: ['googleSearch', 'createKanbanTask', 'updateKanbanTask', 'deleteKanbanTask', 'getCrewStatus'],
  });
});

app.listen(PORT, () => {
  console.log(`
==================================================
🤖 [Ari Daemon v2] 지능형 비서 부팅 완료!
- Port   : ${PORT}
- Model  : ${MODEL.FLASH}
- DB     : ${dbManager ? '✅ 연결됨' : '⚠️ 미연결'}
- Tools  : googleSearch | createKanbanTask | updateKanbanTask | deleteKanbanTask | getCrewStatus
- Memory : Persistent Context (최근 30턴)
==================================================
`);
});
