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

// ─── API 키 관리 (keyProvider 연동) ───────────────────────────────────────────────────────────
import keyProvider from './tools/keyProvider.js';

let API_KEYS = [];
const key1 = await keyProvider.getKey('GEMINI_API_KEY');
const key2 = await keyProvider.getKey('GEMINI_API_KEY_2');

if (key1) API_KEYS.push(key1);
if (key2) API_KEYS.push(key2);

if (API_KEYS.length === 0) {
  console.error('[AriDaemon] 🚨 GEMINI_API_KEY가 없습니다. 환경 변수(.env)나 온보딩 설정을 확인해주세요.');
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
  pico:  { name: 'Pico',  role: '영상 디렉터',            model: MODEL.ANTIGRAVITY_SONNET, specialties: ['영상 제작', '릴스 시나리오', '숏폼 스크립트', '편집'] },
  lumi:  { name: 'Lumi',  role: '이미지 디렉터',          model: MODEL.FLASH,              specialties: ['이미지 생성', '디자인', '비주얼 기획', '썸네일'] },
  luna:  { name: 'Luna',  role: '최종 합성자',             model: MODEL.ANTIGRAVITY_NEXUS,  specialties: ['종합 분석', '전략 합성', '보고서', '최종 검토'] },
  ollie: { name: 'Ollie', role: '적대적 판관',             model: MODEL.ANTIGRAVITY_PRIME,  specialties: ['크리티컬 리뷰', '품질 검증', '반론 제시'] },
  lily:  { name: 'Lily',  role: '영상 담당 (Team A)',      model: MODEL.ANTIGRAVITY_SONNET, specialties: ['영상', '시나리오'] },
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
              description: '담당 크루원 ID. 업무 성격에 따라 최적 담당자를 선택합니다. 절대로 enum 목록에 없는 이름(예: luma)을 임의로 생성하거나 할당하지 마십시오. 오직 명시된 크루원만 사용 가능합니다.',
            },
            content: {
              type: 'string',
              description: `태스크 본문 내용.
반드시 마크다운(Markdown) 포맷으로 구체적인 목적, 배경, 그리고 세부 지시사항을 상세하고 풍부하게 작성하세요.
절대 사용자의 짧은 요청을 그대로 복사붙여넣기 하지 마십시오. 당신은 전문 프롬프트 엔지니어입니다. 담당자가 읽고 즉시 실행할 수 있는 수준의 구체적인 가이드라인과 컨텍스트가 포함된 완벽한 업무 지시서 형태로 기획안을 작성해야 합니다.`,
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
        description: `기존 칸반 태스크를 수정하거나 상태(status), 담당자, 내용을 변경합니다.
중요(CRITICAL): 사용자가 카드 내용에 대한 추가/수정을 지시하거나 피드백을 줄 때, **절대 채팅창에 말(텍스트)로만 "네 추가하겠습니다"라고 대답해서는 안 됩니다.** 반드시 이 도구를 즉시 호출하여 DB의 카드 내용(content)을 실제로 풍부하게 업데이트 하십시오.
사용자가 '72번 카드 진행열로 옮겨줘', '#72 상태 바꿔줘', '담당자 바꿔줘', '이 내용을 추가해줘' 등을 말할 때 이 도구를 반드시 사용합니다.`,
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
              enum: ['PENDING', 'in_progress', 'done', 'CANCELLED', 'archive', 'ARCHIVED'],
              description: '변경할 상태 (없으면 상태 유지). 아카이빙은 archive를 사용합니다.',
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

      // ── [도구 3.5] 특정 칸반 카드 상세 조회 ──────────────────────────────────
      {
        name: 'getTaskDetails',
        description: `특정 칸반 태스크 카드의 상세 내용, 담당자, 현재 상태를 조회합니다.
중요: 사용자가 '93번 카드 내용 봐봐', '이 태스크 상태가 어때?' 등 특정 카드를 지칭할 때, "직접 접근이 불가하다"고 대답하지 말고 반드시 이 도구를 호출하여 내용을 확인하십시오. 당신은 전권을 가진 비서입니다.`,
        parameters: {
          type: 'object',
          properties: {
            taskId: {
              type: 'number',
              description: '조회할 태스크 ID (숫자)',
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

      // ── [도구 5] 로컬 폴더 조회 ───────────────────────────────────────
      {
        name: 'listDirectoryContents',
        description: `로컬 시스템의 폴더 내용을 조회합니다.
사용자가 'outputs 폴더 확인해봐', '어떤 파일들이 있어?' 등을 말할 때 호출합니다.`,
        parameters: {
          type: 'object',
          properties: {
            dirPath: {
              type: 'string',
              description: '조회할 폴더 경로 (예: "outputs", "skill-library/05_design/lab-assets")',
            },
          },
          required: ['dirPath'],
        },
      },
      // ── [도구 6] 로컬 이미지 인식 (Vision) ───────────────────────────
      {
        name: 'analyzeLocalImage',
        description: `로컬에 저장된 이미지 파일(.png, .jpg 등)을 시각적으로 분석(Vision)합니다.
사용자가 '저장된 결과물 파일 확인해봐', '이미지 어떤지 봐줘' 등을 말할 때 파일 경로를 넣어 호출합니다.`,
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '분석할 이미지 파일 경로 (예: "outputs/result.png")',
            },
            prompt: {
              type: 'string',
              description: '이미지에 대해 알고 싶은 구체적인 질문 (예: "이 이미지의 전반적인 분위기와 객체들을 상세히 묘사해줘")',
            },
          },
          required: ['filePath', 'prompt'],
        },
      },
      // ── [도구 7] 에이전트 스킬 관리 (장착/해제) ───────────────────────
      {
        name: 'manageAgentSkills',
        description: `본인(아리) 또는 다른 에이전트의 스킬을 장착(equip)하거나 해제(unequip)합니다.
사용자가 '스킬 빼줘', '마케팅 스킬 장착해' 등을 말하거나, 아리 스스로 상황에 맞게 스킬 조정이 필요할 때 자율적으로 판단해 호출합니다.`,
        parameters: {
          type: 'object',
          properties: {
            agentId: {
              type: 'string',
              description: '스킬을 변경할 에이전트 ID (예: "ari", "nova", "lumi")',
            },
            skillId: {
              type: 'string',
              description: '장착/해제할 스킬 ID (예: "marketing", "content", "design", "analysis", "socian-analysis")',
            },
            action: {
              type: 'string',
              enum: ['equip', 'unequip'],
              description: '장착할지 해제할지 여부',
            },
          },
          required: ['agentId', 'skillId', 'action'],
        },
      },
      // ── [도구 8] 대표님 관찰 에세이 작성 ───────────────────────
      {
        name: 'writeCEOLog',
        description: `대표님이 요청할 때 관찰 에세이를 작성하거나 대화 내용을 파일로 저장합니다. 코드 수정 없이 05_My_history 폴더에 저장합니다.`,
        parameters: {
          type: 'object',
          properties: {
            essayContent: {
              type: 'string',
              description: '저장할 내용 (대표님의 관찰 에세이 또는 기록)',
            },
            fileName: {
              type: 'string',
              description: '(선택) 저장할 파일명. 확장자 포함 (예: ESSAY_Alex_2026-04-28_Ari.md). 지정하지 않으면 CEO_ESSAY_YYYY-MM-DD.md 형식으로 자동 생성.',
            },
            targetDir: {
              type: 'string',
              description: '(선택) 저장 하위 폴더 이름 (05_My_history 하위). 예: Ari, Luca. 기본값: Ari',
            },
          },
          required: ['essayContent'],
        },
      },
      // ── [도구 9] 파일 생성 / 수정 ────────────────────────────────────────
      {
        name: 'writeFile',
        description: `대표님이 지정한 경로에 파일을 생성하거나 내용을 수정합니다. MyCrew 프로젝트 폴더 내에서만 동작합니다.`,
        parameters: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: '08_MyCrew_Anti 프로젝트 루트 기준 상대 경로. 예: 05_My_history/Ari/ESSAY_2026-04-28.md',
            },
            content: {
              type: 'string',
              description: '파일에 저장할 내용 (마크다운 형식 권장)',
            },
            overwrite: {
              type: 'boolean',
              description: '이미 존재하는 파일 덮어쓰기 허용 여부. 기본값: false (안전)',
            },
          },
          required: ['filePath', 'content'],
        },
      },
      // ── [도구 10] 파일 이동 ───────────────────────────────────────────────
      {
        name: 'moveFile',
        description: `파일을 한 위치에서 다른 위치로 이동합니다. 대상 폴더가 없으면 자동 생성합니다.`,
        parameters: {
          type: 'object',
          properties: {
            sourcePath: { type: 'string', description: '이동할 파일의 현재 경로 (프로젝트 루트 기준)' },
            destPath: { type: 'string', description: '이동할 목적지 경로 (파일명 포함)' },
          },
          required: ['sourcePath', 'destPath'],
        },
      },
      // ── [도구 11] 파일 이름 변경 ──────────────────────────────────────────
      {
        name: 'renameFile',
        description: `파일의 이름을 변경합니다 (같은 폴더 내에서).`,
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: '이름을 바꿀 파일의 현재 경로' },
            newName: { type: 'string', description: '새 파일명 (확장자 포함, 예: ESSAY_Alex_2026-04-28_Ari.md)' },
          },
          required: ['filePath', 'newName'],
        },
      },
      // ── [도구 12] 파일 삭제 ───────────────────────────────────────────────
      {
        name: 'deleteFile',
        description: `파일을 영구 삭제합니다. 대상 확인 후 실행 권장.`,
        parameters: {
          type: 'object',
          properties: {
            filePath: { type: 'string', description: '삭제할 파일의 경로 (프로젝트 루트 기준)' },
            reason: { type: 'string', description: '삭제 이유 (로그용)' },
          },
          required: ['filePath'],
        },
      },


    ],
  },
];

// ─── 시스템 프롬프트 생성 (ARI_BRAIN.md 기반 3-Layer + Phase 26 스킬 주입) ─────
async function getAriSystemInstruction(agentId = 'ari') {
  const globalContext = contextInjector.getGlobalContext();
  const now = new Date();
  const dateCtx = now.toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  });

  // ── Layer 1: ARI_BRAIN.md — 핵심 정체성 (정적, 고품질) ──────────────────
  const coreBrain = ARI_BRAIN ||
    `당신은 MyCrew의 비서 아리(Ari)입니다. Gemini 2.5 Pro 기반 자율 행동형 비서입니다.`;

  // ── Layer 2: 런타임 컨텍스트 — 매 요청마다 최신화 ──────────────────────
  const runtimeCtx = [
    `━━━ [런타임 — ${dateCtx} KST] ━━━`,
    globalContext ? `[워크스페이스 현황]\n${globalContext}` : '',
  ].filter(Boolean).join('\n\n');

  // ── Layer 3: [Phase 26] 장착된 스킬 컨텍스트 — 동적 주입 (스킬 body 포함) ────────────────
  let skillCtx = '';
  // M-02: 결과를 며모에 저장하여 getActiveTools에서 재사용 (2회 호출 제거)
  let _cachedSkillResult = null;
  try {
    if (dbManager) {
      _cachedSkillResult = await contextInjector.getEquippedSkillsContext(agentId, dbManager);
      skillCtx = _cachedSkillResult.context;
    }
  } catch (e) {
    console.warn('[AriDaemon] 스킬 컨텍스트 로드 실패 (폴백):', e.message);
  }

  // 캐시를 클로저로 노출 — getActiveTools가 동일 요청 안에서 재사용
  getAriSystemInstruction._skillCache = _cachedSkillResult;

  return `${coreBrain}\n\n${runtimeCtx}${skillCtx ? '\n\n' + skillCtx : ''}`.trim();
}

// ─── [Phase 26] 동적 Tools 조립 — 장착된 스킬 기반 Function Calling 필터링 ──
async function getActiveTools(agentId = 'ari') {
  if (!dbManager) return ARI_TOOLS;

  try {
    // M-02: 동일 요청 주기 내 캡시 재사용 (이중 호출 방지)
    let skillResult = getAriSystemInstruction._skillCache;
    if (!skillResult) {
      skillResult = await contextInjector.getEquippedSkillsContext(agentId, dbManager);
    }
    const toolNames = skillResult.activeTools;

    if (!toolNames || toolNames.length === 0) return ARI_TOOLS;

    const activeSet = new Set(toolNames);
    const filtered = ARI_TOOLS[0].functionDeclarations.filter(fd => activeSet.has(fd.name));

    // 최소 1개 보장 (빈 배열 방지 — Gemini API 오류 예방)
    if (filtered.length === 0) {
      console.warn('[AriDaemon] getActiveTools: 필터 결과 0개 — 전체 ARI_TOOLS 폴백');
      return ARI_TOOLS;
    }

    console.log(`[AriDaemon] 🎛️ 활성 도구 (${filtered.length}개): ${filtered.map(f => f.name).join(', ')}`);
    return [{ functionDeclarations: filtered }];
  } catch (e) {
    console.warn('[AriDaemon] getActiveTools 실패 — 전체 ARI_TOOLS 폴백:', e.message);
    return ARI_TOOLS;
  }
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

      if (!CREW_INFO[assigneeId]) {
        return { success: false, message: `할당 실패: '${assigneeId}'는 존재하지 않는 크루원입니다. 유효한 담당자 목록: ${Object.keys(CREW_INFO).join(', ')}` };
      }

      const taskId = await dbManager.createTask(
        title,
        content,
        'ARI(위임)',   // requester: 대표님 지시를 위임받아 ARI가 생성
        MODEL.FLASH,       // model
        assigneeId,        // assigned_agent
        category           // category
      );

      // priority 업데이트 (updateTaskDetails 활용)
      await dbManager.updateTaskDetails(taskId, title, content, assigneeId, MODEL.FLASH);

      // priority 직접 업데이트 (별도 SQL 필요 — run 직접)
      // priority는 getAllTasksLight에서 쓰이므로 별도 처리
      const crewMember = CREW_INFO[assigneeId] || { name: assigneeId };

      // [Phase 25] 할당 이벤트 발생 (서버의 Dispatcher 트리거)
      try {
        fetch(`http://localhost:4000/api/tasks/dispatch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agentId: assigneeId })
        }).catch(err => console.warn('[AriDaemon] Dispatch trigger failed:', err.message));
      } catch (e) {}

      // [버그 패치] 실시간 UI 갱신을 위한 socket.io 브로드캐스트 트리거
      try {
        fetch(`http://localhost:4000/api/tasks/notify-created`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            taskId,
            title,
            content,
            column: 'todo',
            agentId: assigneeId,
            priority
          })
        }).catch(err => console.warn('[AriDaemon] notify-created trigger failed:', err.message));
      } catch (e) {}

      return {
        success: true,
        taskId,
        message: `✅ 태스크 카드 생성 완료!\n\n**#${taskId} — ${title}**\n- 담당: ${crewMember.name}\n- 카테고리: ${category}\n- 우선순위: ${priority}\n\n칸반 보드에서 확인하세요.`,
      };
    }

    // ── updateKanbanTask ──────────────────────────────────────────────────
    if (toolName === 'updateKanbanTask') {
      const { taskId, content, assigneeId, status } = args;

      if (assigneeId && !CREW_INFO[assigneeId]) {
        return { success: false, message: `수정 실패: '${assigneeId}'는 존재하지 않는 크루원입니다. 유효한 담당자 목록: ${Object.keys(CREW_INFO).join(', ')}` };
      }

      // status -> column 매핑 (프론트엔드 API 호환용)
      const statusToColumn = {
        'PENDING': 'todo',
        'in_progress': 'in_progress',
        'done': 'done',
        'CANCELLED': 'todo',
        'archive': 'archive',
        'ARCHIVED': 'archive'
      };
      const column = status ? statusToColumn[status] : undefined;

      // server.js의 REST API 호출 (Socket.io 브로드캐스트를 위해)
      const updatePayload = {};
      if (content) updatePayload.content = content;
      if (assigneeId) updatePayload.assignee = assigneeId;
      if (column) updatePayload.column = column;

      // [아카이빙] status가 done 또는 archive로 변경되는 경우 /archive API 호출
      // approve는 Review→Done 전용이며 상태 가드가 있음 → ARI는 항상 /archive 사용
      if (column === 'done' || column === 'archive') {
        try {
          const archiveResp = await fetch(`http://localhost:4000/api/tasks/${taskId}/archive`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ archivedBy: 'ARI(위임)' }),
          });
          if (archiveResp.ok) {
            return {
              success: true,
              taskId,
              message: `✅ #${taskId} 태스크 아카이브 완료!\n- 상태: COMPLETED (Done)\n- Obsidian 아카이브 저장됨\n- 칸반 보드에서 Done 열로 이동됨`,
            };
          }
        } catch (archiveErr) {
          console.warn('[AriDaemon] archive API 실패, 일반 업데이트로 폴백:', archiveErr.message);
        }
      }

      // 일반 수정 (done 아닌 경우)
      try {
        const resp = await fetch(`http://localhost:4000/api/tasks/${taskId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updatePayload)
        });
        
        if (!resp.ok) {
          const errBody = await resp.text();
          return { success: false, message: `#${taskId} 수정 실패 (서버 에러): ${errBody}` };
        }
      } catch (err) {
        return { success: false, message: `#${taskId} 서버 통신 오류: ${err.message}` };
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
      try {
        const resp = await fetch(`http://localhost:4000/api/tasks/${taskId}`, {
          method: 'DELETE'
        });
        if (!resp.ok) {
          const errBody = await resp.text();
          return { success: false, message: `#${taskId} 삭제 실패 (서버 에러): ${errBody}` };
        }
      } catch (err) {
        return { success: false, message: `#${taskId} 서버 통신 오류: ${err.message}` };
      }
      return {
        success: true,
        taskId,
        message: `🗑️ #${taskId} 태스크가 삭제되었습니다.${reason ? ` (이유: ${reason})` : ''}`,
      };
    }

    // ── getTaskDetails ─────────────────────────────────────────────────────
    if (toolName === 'getTaskDetails') {
      const { taskId } = args;
      const task = await dbManager.getTaskByIdFull(taskId);
      if (!task) {
        return { success: false, message: `#${taskId} 태스크를 찾을 수 없습니다.` };
      }
      return { 
        success: true, 
        message: `📋 **[Task #${task.id}] 상세 내용**\n- 상태: ${task.status}\n- 담당: ${task.assigned_agent || '미할당'}\n- 카테고리: ${task.category || 'N/A'}\n\n**내용**:\n${task.content}`
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
          const title = t.title || `Task #${t.id}`;
          summary += `  - #${t.id} [${t.status}] ${title.slice(0, 40)}${title.length > 40 ? '...' : ''}\n`;
        });
        if (tasks.length > 3) summary += `  ...외 ${tasks.length - 3}건\n`;
        summary += '\n';
      }

      return { success: true, message: summary, tasks: filtered };
    }

    // ── listDirectoryContents ────────────────────────────────────────────────
    if (toolName === 'listDirectoryContents') {
      const { dirPath } = args;
      const targetPath = path.resolve(process.cwd(), dirPath);
      if (!fs.existsSync(targetPath)) return { success: false, message: `경로를 찾을 수 없습니다: ${dirPath}` };
      
      const files = fs.readdirSync(targetPath);
      return { success: true, message: `📂 ${dirPath} 폴더 내용:\n${files.join('\n')}` };
    }

    // ── analyzeLocalImage ────────────────────────────────────────────────────
    if (toolName === 'analyzeLocalImage') {
      const { filePath, prompt } = args;
      const targetPath = path.resolve(process.cwd(), filePath);
      if (!fs.existsSync(targetPath)) return { success: false, message: `파일을 찾을 수 없습니다: ${filePath}` };
      
      try {
        const mimeType = filePath.toLowerCase().endsWith('.png') ? 'image/png' : 'image/jpeg';
        const imageBase64 = fs.readFileSync(targetPath).toString('base64');
        
        // Gemini API를 직접 호출하여 Vision 분석
        const response = await ai.models.generateContent({
            model: MODEL.FLASH,
            contents: [
                {
                    role: 'user',
                    parts: [
                        { inlineData: { mimeType, data: imageBase64 } },
                        { text: prompt }
                    ]
                }
            ]
        });
        const resultText = response.text;
        return { success: true, message: `👁️ 이미지 분석 결과:\n${resultText}` };
      } catch(err) {
        return { success: false, message: `Vision 분석 실패: ${err.message}` };
      }
    }

    // ── manageAgentSkills ────────────────────────────────────────────────────
    if (toolName === 'manageAgentSkills') {
      const { agentId, skillId, action } = args;
      const isActive = action === 'equip';
      await dbManager.toggleAgentSkill(agentId, skillId, isActive);
      
      // REST API로도 변경 사실을 알리기 (프론트 실시간 동기화를 위해)
      fetch(`http://localhost:4000/api/agents/${agentId}/skills`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ skillId, active: isActive })
      }).catch(() => {});
      
      return { success: true, message: `✅ ${agentId}의 ${skillId} 스킬이 ${action === 'equip' ? '장착' : '해제'}되었습니다.` };
    }

    // ── writeCEOLog ──────────────────────────────────────────────────────────
    if (toolName === 'writeCEOLog') {
      const { essayContent, fileName, targetDir = 'Ari' } = args;
      const baseHistoryDir = '/Users/alex/Documents/08_MyCrew_Anti/05_My_history';
      const historyDir = path.join(baseHistoryDir, targetDir);
      if (!fs.existsSync(historyDir)) {
        fs.mkdirSync(historyDir, { recursive: true });
      }
      const dateStr = new Date().toLocaleDateString('sv-SE', { timeZone: 'Asia/Seoul' });
      const finalFileName = fileName || `CEO_ESSAY_${dateStr}.md`;
      const filePath = path.join(historyDir, finalFileName);
      const fileBody = `# CEO Observation Essay (${dateStr})\n\n${essayContent}\n`;
      fs.writeFileSync(filePath, fileBody, 'utf-8');
      // M-04: 사후 검증
      if (!fs.existsSync(filePath)) {
        return { success: false, message: `파일 저장에 실패했습니다: ${filePath}` };
      }
      return { success: true, message: `✅ 저장 완료: ${filePath}` };
    }

    // ── writeFile ────────────────────────────────────────────────────────────
    if (toolName === 'writeFile') {
      const { filePath, content, overwrite = false } = args;
      const ROOT = '/Users/alex/Documents/08_MyCrew_Anti';
      const absPath = path.resolve(ROOT, filePath);
      if (!absPath.startsWith(ROOT)) {
        return { success: false, message: '접근 불가: MyCrew 프로젝트 외부 경로입니다.' };
      }
      if (!overwrite && fs.existsSync(absPath)) {
        return { success: false, message: `이미 존재하는 파일입니다: ${filePath}. overwrite: true로 덮어쓸 수 있습니다.` };
      }
      fs.mkdirSync(path.dirname(absPath), { recursive: true });
      fs.writeFileSync(absPath, content, 'utf-8');
      if (!fs.existsSync(absPath)) return { success: false, message: `파일 저장 실패: ${filePath}` };
      return { success: true, message: `✅ 파일 저장 완료: ${filePath}` };
    }

    // ── moveFile ─────────────────────────────────────────────────────────────
    if (toolName === 'moveFile') {
      const { sourcePath, destPath } = args;
      const ROOT = '/Users/alex/Documents/08_MyCrew_Anti';
      const absSrc = path.resolve(ROOT, sourcePath);
      const absDest = path.resolve(ROOT, destPath);
      if (!absSrc.startsWith(ROOT) || !absDest.startsWith(ROOT)) {
        return { success: false, message: '접근 불가: MyCrew 프로젝트 외부 경로입니다.' };
      }
      if (!fs.existsSync(absSrc)) return { success: false, message: `원본 파일이 없습니다: ${sourcePath}` };
      fs.mkdirSync(path.dirname(absDest), { recursive: true });
      fs.renameSync(absSrc, absDest);
      if (!fs.existsSync(absDest)) return { success: false, message: `이동 실패: ${sourcePath} → ${destPath}` };
      return { success: true, message: `✅ 파일 이동 완료: ${sourcePath} → ${destPath}` };
    }

    // ── renameFile ───────────────────────────────────────────────────────────
    if (toolName === 'renameFile') {
      const { filePath, newName } = args;
      const ROOT = '/Users/alex/Documents/08_MyCrew_Anti';
      const absSrc = path.resolve(ROOT, filePath);
      if (!absSrc.startsWith(ROOT)) return { success: false, message: '접근 불가 경로입니다.' };
      if (!fs.existsSync(absSrc)) return { success: false, message: `파일이 없습니다: ${filePath}` };
      const absDest = path.join(path.dirname(absSrc), newName);
      fs.renameSync(absSrc, absDest);
      if (!fs.existsSync(absDest)) return { success: false, message: `이름 변경 실패` };
      return { success: true, message: `✅ 이름 변경 완료: ${path.basename(filePath)} → ${newName}` };
    }

    // ── deleteFile ───────────────────────────────────────────────────────────
    if (toolName === 'deleteFile') {
      const { filePath, reason } = args;
      const ROOT = '/Users/alex/Documents/08_MyCrew_Anti';
      const absPath = path.resolve(ROOT, filePath);
      if (!absPath.startsWith(ROOT)) return { success: false, message: '접근 불가 경로입니다.' };
      if (!fs.existsSync(absPath)) return { success: false, message: `파일이 없습니다: ${filePath}` };
      fs.unlinkSync(absPath);
      if (fs.existsSync(absPath)) return { success: false, message: `삭제 실패: ${filePath}` };
      return { success: true, message: `🗑️ 삭제 완료: ${filePath}${reason ? ` (${reason})` : ''}` };
    }


  } catch (err) {
    console.error(`[AriDaemon] 도구 실행 에러 (${toolName}):`, err.message);
    return { success: false, message: `도구 실행 중 오류: ${err.message}` };
  }
}

// ─── OAuth 토큰 우회를 위한 로컬 프록시 라우터 ──────────────────────────────────
// 구글 SDK가 자체 fetch를 강제하여 인터셉터를 무시하는 문제를 해결하기 위해,
// SDK의 요청을 로컬에서 가로채 가짜 API 키를 제거한 후 구글 서버로 직접 포워딩합니다.
app.post('/v1beta/models/:model::action', async (req, res) => {
  try {
    const { model, action } = req.params;
    
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${action}`;
    const urlObj = new URL(targetUrl);
    
    // 원본 요청에서 쿼리 파라미터가 있으면 전달 (특히 alt=sse)
    for (const [key, value] of Object.entries(req.query)) {
      if (key !== 'key') { // 가짜 key 제거
        urlObj.searchParams.set(key, value);
      }
    }

    const headers = { ...req.headers };
    delete headers['host'];
    delete headers['x-goog-api-client'];
    delete headers['x-goog-api-key']; // 가짜 키 삭제
    delete headers['content-length'];

    const response = await fetch(urlObj.toString(), {
      method: 'POST',
      headers,
      body: JSON.stringify(req.body)
    });

    res.status(response.status);
    response.headers.forEach((v, k) => {
      if (k.toLowerCase() !== 'content-encoding') {
        res.setHeader(k, v);
      }
    });
    
    if (response.body) {
      for await (const chunk of response.body) {
        res.write(chunk);
      }
      res.end();
    } else {
      res.send(await response.text());
    }
  } catch (err) {
    console.error("[AriDaemon Proxy] 에러:", err);
    res.status(500).json({ error: err.message });
  }
});

// ─── 메인 대화 엔드포인트 ─────────────────────────────────────────────────
app.post('/api/compute', async (req, res) => {
  const { content, author, oauthToken } = req.body;
  if (!content) return res.status(400).send('Content missing');

  // 구독 인증 토큰이 있으면 해당 토큰 기반 구독형 클라이언트 사용, 없으면 레거시 글로벌 클라이언트 사용
  let localAi = ai;
  if (oauthToken) {
    try {
      localAi = new GoogleGenAI({
        apiKey: 'empty', 
        httpOptions: {
          baseUrl: `http://localhost:${PORT}`,
          headers: { 'Authorization': `Bearer ${oauthToken}` }
        }
      });
      console.log(`[AriDaemon] 🔐 구독인증(OAuth) 모드로 호출 (Model: ${MODEL.FLASH})`);
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

    // [Phase 26] 장착된 스킬 기반 시스템 프롬프트 + 동적 Tools 조립
    const [systemInstruction, activeTools] = await Promise.all([
      getAriSystemInstruction('ari'),
      getActiveTools('ari'),
    ]);
    const contents = [...conversationHistory, { role: 'user', parts: [{ text: content }] }];

    // ── Gemini API 호출 (Function Calling 지원) ─────────────────
    let response;

    response = await localAi.models.generateContent({
      model: MODEL.PRO,
      contents,
      config: {
        systemInstruction,
        temperature: 0.7,
        tools: activeTools,  // ← [Phase 26] 장착된 스킬의 도구만 전달
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

      let finalStream;

      finalStream = await localAi.models.generateContentStream({
        model: MODEL.PRO,
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
    if (error.status === 429) {
      if (switchToBackupKey()) {
        console.log('[AriDaemon] 🔄 예비 키로 재요청 시도 중...');
        res.write(`event: quota\ndata: {"message": "키를 교체했습니다. 다시 시도해주세요!"}\n\n`);
      } else {
        res.write(`event: quota\ndata: {"message": "현재 Gemini API 일일 사용 한도를 초과했습니다."}\n\n`);
      }
    } else {
      console.error('[AriDaemon] 에러 발생:', error.message || error);
      res.write(`event: error\ndata: {"message": ${JSON.stringify(error.message || 'Unknown Error')}}\n\n`);
    }
    res.end();
  }
});

// ─── 헬스체크 ─────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    port: PORT,
    model: MODEL.PRO,
    historyTurns: conversationHistory.length,
    dbConnected: !!dbManager,
    tools: ['googleSearch', 'createKanbanTask', 'updateKanbanTask', 'deleteKanbanTask', 'getTaskDetails', 'getCrewStatus'],
  });
});

app.listen(PORT, () => {
  console.log(`
==================================================
🤖 [Ari Daemon v2] 지능형 비서 부팅 완료!
- Port   : ${PORT}
- Model  : ${MODEL.PRO}
- DB     : ${dbManager ? '✅ 연결됨' : '⚠️ 미연결'}
- Tools  : googleSearch | createKanbanTask | updateKanbanTask | deleteKanbanTask | getTaskDetails | getCrewStatus
- Memory : Persistent Context (최근 30턴)
==================================================
`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 🌉 ANTI-BRIDGE MONITOR — .bridge/requests/ 폴더 감시자
// antigravityAdapter.js가 작성한 요청 파일을 읽고
// Gemini(구독 세션)으로 처리 → .bridge/responses/ 에 응답 저장
// ─────────────────────────────────────────────────────────────────────────────

const BRIDGE_REQ_DIR  = path.resolve(__dirname, '../.bridge/requests');
const BRIDGE_RES_DIR  = path.resolve(__dirname, '../.bridge/responses');
const BRIDGE_LOG_DIR  = path.resolve(__dirname, '../.bridge/logs');
const BRIDGE_POLL_MS  = 3000;  // 3초마다 폴링

// 디렉토리 보장
[BRIDGE_REQ_DIR, BRIDGE_RES_DIR, BRIDGE_LOG_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// agentKey별 크루 특성 시스템 보조 프롬프트
const BRIDGE_AGENT_HINTS = {
  prime:  '당신은 MyCrew의 Senior AI입니다. 깊이 있는 분석과 전문적인 판단을 제공하세요.',
  nexus:  '당신은 MyCrew의 최고 전략 AI입니다. 통합적 시각으로 최종 결론을 도출하세요.',
  sonnet: '당신은 MyCrew의 창의적 AI입니다. 감각적이고 구체적인 콘텐츠를 생성하세요.',
};

// 처리 중인 파일 추적 (중복 처리 방지)
const processingFiles = new Set();

async function processBridgeRequest(reqFile) {
  const reqPath = path.join(BRIDGE_REQ_DIR, reqFile);

  // 중복 처리 방지
  if (processingFiles.has(reqFile)) return;
  processingFiles.add(reqFile);

  let request;
  try {
    const raw = fs.readFileSync(reqPath, 'utf-8');
    request = JSON.parse(raw);
  } catch (e) {
    console.warn(`[Bridge] ⚠️ 요청 파일 읽기 실패: ${reqFile} —`, e.message);
    processingFiles.delete(reqFile);
    return;
  }

  const { taskId, agentKey, systemInstruction, taskPayload, requestedModel } = request;
  const resFile = reqFile.replace('req_', 'res_');
  const resPath = path.join(BRIDGE_RES_DIR, resFile);

  console.log(`[Bridge] 📨 요청 수신 | agentKey=${agentKey} | taskId=${taskId}`);

  try {
    // 시스템 프롬프트 조합: 크루 힌트 + 원래 systemInstruction
    const agentHint = BRIDGE_AGENT_HINTS[agentKey] || BRIDGE_AGENT_HINTS.prime;
    const fullSystem = `${agentHint}\n\n${systemInstruction || ''}`.trim();

    // Gemini로 처리
    const result = await ai.models.generateContent({
      model: MODEL.PRO,
      config: {
        systemInstruction: fullSystem,
        temperature: 0.7,
        maxOutputTokens: 8192,
      },
      contents: [{ role: 'user', parts: [{ text: taskPayload || '' }] }],
    });

    const responseText = result.candidates?.[0]?.content?.parts?.[0]?.text
      ?? result.text
      ?? '';

    if (!responseText) {
      throw new Error('Gemini로부터 빈 응답 수신');
    }

    // 응답 파일 작성
    const resData = {
      taskId,
      agentKey,
      requestedModel,
      text: responseText,
      processedBy: `ariDaemon-bridge (${MODEL.PRO})`,
      timestamp: new Date().toISOString(),
    };
    fs.writeFileSync(resPath, JSON.stringify(resData, null, 2), 'utf-8');

    // 요청 파일 삭제
    fs.unlinkSync(reqPath);

    // 브릿지 로그 기록
    const logEntry = `[${new Date().toISOString()}] ✅ ${agentKey} | ${taskId} | ${responseText.length}자\n`;
    fs.appendFileSync(path.join(BRIDGE_LOG_DIR, 'bridge.log'), logEntry);

    console.log(`[Bridge] ✅ 응답 완료 | agentKey=${agentKey} | ${responseText.length}자`);

  } catch (err) {
    console.error(`[Bridge] ❌ 처리 실패 | ${reqFile}:`, err.message);

    // 실패 응답 작성 (antigravityAdapter가 타임아웃으로 처리하지 않도록 오류 응답 명시)
    try {
      const errData = {
        taskId,
        agentKey,
        text: `[Bridge 오류] ${err.message}`,
        error: true,
        timestamp: new Date().toISOString(),
      };
      fs.writeFileSync(resPath, JSON.stringify(errData, null, 2), 'utf-8');
      fs.unlinkSync(reqPath);
    } catch (writeErr) {
      console.error('[Bridge] ❌ 오류 응답 파일 작성 실패:', writeErr.message);
    }
  } finally {
    processingFiles.delete(reqFile);
  }
}

async function runBridgeMonitor() {
  try {
    const files = fs.readdirSync(BRIDGE_REQ_DIR).filter(f => f.startsWith('req_') && f.endsWith('.json'));
    if (files.length > 0) {
      console.log(`[Bridge] 🔍 ${files.length}개 대기 중`);
      // 병렬 처리 (순서 무관)
      await Promise.allSettled(files.map(f => processBridgeRequest(f)));
    }
  } catch (err) {
    console.error('[Bridge] ❌ 모니터 오류:', err.message);
  }
  setTimeout(runBridgeMonitor, BRIDGE_POLL_MS);
}

// 브릿지 모니터 시작
runBridgeMonitor();
console.log(`[Bridge] 🌉 Anti-Bridge Monitor 시작 — ${BRIDGE_REQ_DIR} (${BRIDGE_POLL_MS / 1000}초 폴링)`);

