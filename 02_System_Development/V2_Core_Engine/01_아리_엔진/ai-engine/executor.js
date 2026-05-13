import fs from 'fs';
import path from 'path';
import router from './router.js';
import geminiAdapter from './adapters/geminiAdapter.js';
import antigravityAdapter from './adapters/antigravityAdapter.js';
import filePollingAdapter from './adapters/FilePollingAdapter.js';
import modelSelector from './modelSelector.js';
import dbManager from '../database.js';
import systemShieldSkill from './skills/systemShieldSkill.js';
import contextInjector from './tools/contextInjector.js';
import { executeTool } from './tools/toolExecutor.js';
import contextChainService from './services/contextChainService.js';
import scrubber from './tools/scrubbing.js';
import { MODEL } from './modelRegistry.js';
import { generateImage } from '../skill-library/05_design/nanoBananaGenerator.js';
import { generateVideo } from '../skill-library/05_design/remotionRenderer.js';
import ruleHarvester from './tools/ruleHarvester.js';
import workflowOrchestrator from './tools/workflowOrchestrator.js';




// [v3.2 SMART PARITY] 에이전트별 시능 수준에 따른 시그니처 모델 매핑 (v4.7 최신화)
// [구독 티어 분기] USER_MODEL_TIER=pro → Gemini Pro, 미설정(디폴트) → Flash
// 사용자의 Gemini 구독 상태에 따라 nova/lumi 모델이 자동 전환됨
// API 사용자: Flash 유지 / Gemini Pro·Ultra 구독자: Pro 격상
const IS_PRO_TIER = process.env.USER_MODEL_TIER === 'pro';

// [Phase 30] BRIDGE_AGENTS / AGENT_SIGNATURE_MODELS 초기화 전략
// - 1단계(동기): agents.json 즉시 로드 → 서버 시작 즉시 라우팅 가능 (SLA 보장)
// - 2단계(async): DB agent_profiles로 갱신 → 사용자가 변경한 모델 즉시 반영
const BRIDGE_AGENTS = new Set();
const AGENT_SIGNATURE_MODELS = {};

const _HARDCODED_FALLBACK = {
  // [Phase 33] agents.json Role ID 마이그레이션 반영
  bridge_agents: [
    'dev_fullstack', 'dev_ux', 'dev_senior', 'dev_qa', 'dev_advisor',
    'mkt_lead', 'mkt_planner', 'mkt_designer', 'mkt_analyst', 'mkt_video', 'mkt_advisor',
  ],
  DEFAULT_MODELS: {
    // 개발팀
    dev_fullstack: MODEL.PRO,    dev_ux: MODEL.PRO,
    dev_senior:    MODEL.SONNET, dev_qa: MODEL.OPUS,
    dev_advisor:   MODEL.OPUS,
    // 마케팅팀
    mkt_lead:      MODEL.PRO,    mkt_designer: MODEL.PRO,
    mkt_planner:   MODEL.SONNET, mkt_video: MODEL.SONNET,
    mkt_analyst:   MODEL.OPUS,   mkt_advisor: MODEL.OPUS,
    // platform
    assistant:     MODEL.PRO,
  },
};

// ── 1단계: 동기 초기화 (agents.json 기반, 서버 시작 즉시) ──────────────
try {
  const _agentsRaw = fs.readFileSync(path.resolve(process.cwd(), 'agents.json'), 'utf-8');
  const _agents = JSON.parse(_agentsRaw);
  _agents.forEach(a => {
    const id = a.id.toLowerCase();
    if (a.bridge === true) {
      BRIDGE_AGENTS.add(id);
      AGENT_SIGNATURE_MODELS[id] = a.antiModel || MODEL.ANTI_GEMINI_PRO_HIGH;
    } else {
      // [Phase 33] ARI의 신규 Role ID = 'assistant'
      if (id === 'assistant') AGENT_SIGNATURE_MODELS[id] = MODEL.PRO;
    }
  });
  console.log(`[Executor] 동기 초기화 완료 (agents.json). BRIDGE_AGENTS: [${[...BRIDGE_AGENTS].join(', ')}]`);
} catch (e) {
  // agents.json 실패 시 하드코딩 폴백 (SLA 보장)
  console.warn('[Executor] agents.json 로드 실패, 하드코딩 폴백:', e.message);
  _HARDCODED_FALLBACK.bridge_agents.forEach(id => BRIDGE_AGENTS.add(id));
  Object.assign(AGENT_SIGNATURE_MODELS, _HARDCODED_FALLBACK.models);
}

// ── 2단계: async DB 갱신 (사용자 설정 모델 반영, 서버 시작 후 비동기) ──
async function _refreshFromDB() {
  try {
    const rows = await dbManager.getAllAgentProfiles();
    if (rows && rows.length > 0) {
      rows.forEach(a => {
        const id = a.id.toLowerCase();
        if (a.bridge) {
          BRIDGE_AGENTS.add(id);
          if (a.model) AGENT_SIGNATURE_MODELS[id] = a.model; // 사용자 설정 모델로 갱신
        } else {
          // [Phase 33] ARI의 신규 Role ID = 'assistant'
          if (id === 'assistant' && a.model) AGENT_SIGNATURE_MODELS[id] = a.model;
        }
      });
      console.log(`[Executor] Phase 30 — DB agent_profiles 갱신 완료.`);
    }
  } catch (e) {
    // DB 조회 실패 시 1단계 동기 초기화값 유지 (서비스 영향 없음)
    console.warn('[Executor] DB agent_profiles 갱신 실패 (1단계 값 유지):', e.message);
  }
}

// 비동기 갱신 실행 (서버 시작과 병렬, 실패해도 1단계 값으로 동작)
_refreshFromDB().catch(e => console.error('[Executor] _refreshFromDB 오류:', e.message));




export function updateAgentSignatureModel(agentId, model) {
  AGENT_SIGNATURE_MODELS[agentId.toLowerCase()] = model;
}

export function getAgentSignatureModel(agentId) {
  return AGENT_SIGNATURE_MODELS[agentId.toLowerCase()];
}

// ─── SKILL.md 캐시 (서버 생존 주기 동안 유지) ─────────────────────────
export const skillCache = new Map();

/** 캐시 무효화 (Image Lab 등에서 새로운 룰 학습 시 호출) */
export function clearSkillCache(category) {
  if (category) {
    skillCache.delete(category);
    console.log(`[Executor] Cache cleared for category: ${category}`);
  } else {
    skillCache.clear();
    console.log('[Executor] Entire skill cache cleared');
  }
}
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분 TTL

// [Phase 42.5 Step 4] 프로젝트별 SKILL 경로 분리
export function getSkillPathMap(projectId = null) {
  const prefix = projectId ? `${projectId}_` : 'LEGACY_GLOBAL_';
  return {
    'MARKETING':  `skill-library/02_marketing/${prefix}SKILL.md`,
    'CONTENT':    `skill-library/03_content/${prefix}SKILL.md`,
    'ANALYSIS':   `skill-library/04_analysis/${prefix}SKILL.md`,
    'DESIGN':     `skill-library/05_design/${prefix}SKILL.md`,
    'ROUTING':    `skill-library/01_routing/${prefix}SKILL.md`,
    'KNOWLEDGE':  `skill-library/06_research/${prefix}SKILL.md`,
    'WORKFLOW':   `skill-library/08_workflow/${prefix}SKILL.md`,
  };
}

/** SKILL.md 로드 함수 (외부 도구에서도 사용 가능하도록 내보내기) */
export function loadSkillDocument(category, projectId = null) {
  const now = Date.now();
  const cacheKey = `${projectId || 'LEGACY'}_${category}`;
  const cached = skillCache.get(cacheKey);
  
  // Hit: 캐시가 유효하면 즉시 반환
  if (cached && (now - cached.loadedAt) < CACHE_TTL_MS) {
    return cached.content;
  }
  
  // Miss: 파일 로드 후 캐시에 저장
  const relativePath = getSkillPathMap(projectId)[category];
  if (!relativePath) return null;
  
  try {
    const fullPath = path.resolve(process.cwd(), relativePath);
    if (!fs.existsSync(fullPath)) return null;
    const raw = fs.readFileSync(fullPath, 'utf-8');
    
    // L2 추출: YAML frontmatter 제거 후 본문만
    const bodyStart = raw.indexOf('---', raw.indexOf('---') + 3);
    const body = bodyStart > 0 ? raw.slice(bodyStart + 3).trim() : raw;
    
    // 토큰 예산 제어: 최대 500자로 트렁케이션 (SKILL.md는 500자 압축 포맷 준수)
    const truncated = body.length > 500
      ? body.slice(0, 500) + '\n\n[...truncated for token budget]'
      : body;
    
    skillCache.set(cacheKey, { content: truncated, loadedAt: now });
    return truncated;
  } catch (err) {
    console.warn(`[SkillLoader] ${category} SKILL.md 로드 실패:`, err.message);
    return null; // 실패 시 기존 getSystemPrompt() 폴백
  }
}

// ─── Auto-Digest: Self-Learning 로그 자동 소화 → ACTIVE PROMPT 자동 업데이트 ───────────────
// 조건: Self-Learning 엔트리가 DIGEST_THRESHOLD개 이상 쌓이면 자동 LLM 소화 실행
// 동작: 비동기 (메인 응답 없음 + 시작 도궤)
// 보안: 실패시 catch로 흡수, 기존 SKILL.md 백업 후 덮어씀
const DIGEST_THRESHOLD = 3; // 로그 3개 차면 다이제스트 실행
const DIGEST_SEPARATOR = '\n---\n\n## 환경 케이스'; // SKILL.md 구분선

async function autoDigestSkill(fullSkillPath, category) {
  try {
    const raw = fs.readFileSync(fullSkillPath, 'utf-8');

    // Self-Learning 엔트리 수 카운트 (### [20YY-MM-DD] 패턴)
    const logCount = (raw.match(/^### \[20\d\d-/gm) || []).length;
    if (logCount < DIGEST_THRESHOLD) {
      console.log(`[AutoDigest] ${category}: 로그 ${logCount}개 (${DIGEST_THRESHOLD}개 미만, 대기 중)`);
      return;
    }

    console.log(`[AutoDigest] ${category}: 로그 ${logCount}개 이상 다이제스트 시작...`);

    // 로그 섹션 분리 (YAML frontmatter + ACTIVE PROMPT + LOG 섹션)
    const yamlEnd = raw.indexOf('---', raw.indexOf('---') + 3);
    const frontmatter = yamlEnd > 0 ? raw.slice(0, yamlEnd + 3) : '';
    const body = yamlEnd > 0 ? raw.slice(yamlEnd + 3).trim() : raw;

    // LOG 섹션 분리 (가장 첫 번째 '---' 구분선 기준)
    const logSeparatorIdx = body.indexOf('\n---\n');
    const activePromptBlock = logSeparatorIdx > 0 ? body.slice(0, logSeparatorIdx) : body;
    const logBlock = logSeparatorIdx > 0 ? body.slice(logSeparatorIdx) : '';

    // Flash 모델로 저비용 다이제스트 LLM 호출
    const digestResult = await geminiAdapter.generateResponse(
      `아래 SKILL.md 파일을 분석한 후 ACTIVE PROMPT를 업그레이드하세요.\n\n` +
      `[현재 ACTIVE PROMPT]\n${activePromptBlock}\n\n` +
      `[Self-Learning 로그]\n${logBlock}\n\n` +
      `지시: \n` +
      `1. 로그의 성공/실패 패턴을 완전히 파악한다\n` +
      `2. 현재 ACTIVE PROMPT의 룰을 유지하되 실패 패턴을 '금지' 룰로 흡수한다\n` +
      `3. 업데이트된 ACTIVE PROMPT만 500자 이내로 출력한다\n` +
      `4. 다른 텍스트, 설명, 주석 일체 출력 금지 (ACTIVE PROMPT만 출력)`,
      '당신은 AI 에이전트 스킬 최적화 시스템입니다. 주어진 로그를 흡수하여 ACTIVE PROMPT를 업그레이드하세요.',
      MODEL.FLASH
    );

    if (!digestResult?.text?.trim()) {
      console.warn('[AutoDigest] LLM 응답 비어있음, 스킵');
      return;
    }

    const newActivePrompt = digestResult.text.trim();

    // 안전 체크: 500자 초과 시 경고 후 트렁케이션
    const safePart = newActivePrompt.length > 500
      ? newActivePrompt.slice(0, 500)
      : newActivePrompt;

    // 신규 SKILL.md = frontmatter + 업데이트된 ACTIVE PROMPT + 기존 LOG 보존
    const newContent = frontmatter
      ? `${frontmatter}\n${safePart}\n${logBlock}`
      : `${safePart}\n${logBlock}`;

    // 🗂️ 버전 히스토리 백업: 덮어쓰기 전 .bak 파일 생성
    const backupPath = fullSkillPath + '.bak';
    fs.writeFileSync(backupPath, raw, 'utf-8');

    // 파일 덮어쓰기
    fs.writeFileSync(fullSkillPath, newContent, 'utf-8');

    // 캐시 무효화 → 다음 호출에서 새 버전 로드
    skillCache.delete(category);

    console.log(`[AutoDigest] ✅ ${category} SKILL.md 자동 업데이트 완료 (로그 ${logCount}개 소화, 새 ACTIVE PROMPT ${safePart.length}자, 백업: ${backupPath})`);
  } catch (err) {
    // 실패시 조용히 무시 — 서비스 영향 없음
    console.warn(`[AutoDigest] ${category} 다이제스트 실패 (무시):`, err.message);
  }
}

// ─── 일상어 승인 Intent Mapping ─────────────────────────────────────────────
// Opus 경고 반영: PENDING Task가 존재할 때만 활성화 (오탐 방지)
const APPROVAL_PATTERNS = [
  /^(ㅇㅇ|ok|okay|yes|네|예|응|웅|어|고)$/i,
  /^(진행|시작|고(고)?|go|run|승인|ㄱ|ㄱㄱ|ㄱ{1,3})$/i,
  /^(계속해?|이어서|해줘|해봐|해|돼|됩니다?)$/i,
];

function isApprovalIntent(text) {
  const trimmed = text.trim();
  // 5자 이하 단답형 메시지만 승인 의도로 간주 (길면 일반 대화)
  if (trimmed.length > 10) return false;
  return APPROVAL_PATTERNS.some((pattern) => pattern.test(trimmed));
}

// ─── [Week 1: SOUL 흡수] 제거됨: ContextInjector로 이관 ─────────────────

class Executor {
  constructor() {
    this._broadcastLog = null;
    // [Phase 43] autoRun 활성 프로세스 관리 맵 (Escape Hatch)
    this.activeAutoRuns = new Map();
  }

  setBroadcastLog(fn) {
    this._broadcastLog = fn;
  }

  _log(level, message, agentId, taskId = null) {
    if (this._broadcastLog) {
      this._broadcastLog(level, message, agentId, taskId);
    } else {
      console.log(`[Executor:${agentId}] ${message}`);
    }
  }

  async run(taskContent, preEvaluated = null, agentId = 'ari', taskId = null) {
    console.log(`[Executor] 작업 시작: ${taskContent} (Assigned To: ${agentId}, Task: ${taskId})`);
    this._log('info', `> 작업을 수신했습니다. 방어요소 및 인텐트 파악을 시작합니다...`, 'system', taskId);

    // 0. 🚨 System Shield (Layer 3 Infra Guard) 발동 여부 검사
    const shieldBlock = systemShieldSkill.applyShield(taskContent, agentId);
    if (shieldBlock) {
      this._log('warn', `> 🚨 위험 감지: System Shield가 발동되어 작업을 차단했습니다.`, 'system', taskId);
      return shieldBlock; // 즉시 API 호출 중단 및 차단 메시지 반환
    }

    // ── Intent Mapping Gate ──────────────────────────────────────────────────
    // 일상어 승인 감지 & PENDING Task 존재 확인 (오탐 방지 이중 잠금)
    if (isApprovalIntent(taskContent)) {
      const pendingTask = await dbManager.getFirstPendingTask();
      if (pendingTask) {
        console.log(`[Executor] ✅ 승인 인텐트 감지 → 보류 Task #${pendingTask.id} RESUME 처리`);
        this._log('info', `> ✅ 승인 인텐트 감지 완료. 보류 중인 Task #${pendingTask.id}의 실행을 즉각 재개합니다.`, 'system', taskId);
        // 보류 Task를 in_progress로 전환
        await dbManager.updateTaskStatus(pendingTask.id, 'in_progress');
        return {
          text: '✅ 알겠습니다! 보류 중이던 작업을 재개합니다.',
          model: 'intent-engine',
          category: 'RESUME',
          score: 1,
        };
      }
    }

    // 1. 모델 및 작업 카테고리 자율 분석
    const evaluation = preEvaluated || await modelSelector.selectModel(taskContent);

    // 2. 기본값 설정 및 플래그 처리
    // [v3.2] 에이전트 시그니처 모델 우선권 부여 (캐릭터 지능 유지)
    const signatureModel = AGENT_SIGNATURE_MODELS[agentId?.toLowerCase()];
    let modelToUse = signatureModel || evaluation.recommended_model || MODEL.FLASH;
    let actualContent = taskContent;

    // ── [Phase 39] Quota Defender (Hotswap Engine) ───────────────────────────
    // Claude 4.6 계열 모델 사용 시, 일일 쿼터 초과 위험이 감지되면
    // 자동으로 Gemini 3.1 Pro로 Hotswap(우회)하여 파이프라인 중단을 방어합니다.
    if (modelToUse && modelToUse.toLowerCase().includes('claude')) {
      try {
        // [H-003] Quota Defender 연동 (향후 DB 쿼터 시스템과 완벽 연동 전까지 환경변수로 제어)
        const isQuotaCritical = process.env.QUOTA_CRITICAL === 'true'; 
        if (isQuotaCritical) {
          console.warn(`[Quota Defender] Claude 쿼터 임계점 도달 (<15분). Gemini 3.1 Pro로 Hotswap 진행.`);
          this._log('warn', `> ⚠️ Claude 4.6 일일 쿼터가 15분 미만으로 떨어졌습니다. 서비스 안정성을 위해 [Gemini 3.1 Pro] 엔진으로 핫스왑(Hotswap)하여 실행합니다.`, 'system', taskId);
          modelToUse = MODEL.PRO;
        }
      } catch (err) {
        console.warn('[Quota Defender] 쿼터 체크 에러 (무시):', err.message);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    if (taskContent.includes('--pro') || taskContent.includes('--deep')) {
      modelToUse = MODEL.PRO;
      actualContent = taskContent.replace(/--pro|--deep/g, '').trim();
    } else if (taskContent.includes('--flash') || taskContent.includes('--lite')) {
      modelToUse = MODEL.FLASH;
      actualContent = taskContent.replace(/--flash|--lite/g, '').trim();
    } else if (taskContent.includes('--opus')) {
      modelToUse = MODEL.OPUS;
      actualContent = taskContent.replace(/--opus/g, '').trim();
    }

    // [Phase 37] #N 카드 레퍼런스 자동 resolve — 환각 리뷰 차단
    // next_sprint로 생성된 카드 content에 "#3" 형태로 참조된 카드의 실제 산출물을 주입
    const cardRefMatches = [...new Set(actualContent.match(/#(\d+)/g) || [])];
    if (cardRefMatches.length > 0 && taskId) {
      try {
        const refInjections = [];
        // 현재 실행 중인 태스크의 project_id 조회
        const currentTask = await dbManager.getTaskById(taskId);
        const projectId = currentTask?.project_id;

        for (const ref of cardRefMatches) {
          const refNum = parseInt(ref.slice(1), 10);
          if (isNaN(refNum)) continue;

          // project_task_num → task.id 조회
          const refTaskId = await dbManager.getTaskIdByProjectNum(projectId, refNum);
          if (!refTaskId) continue;

          // 해당 카드의 마지막 에이전트 산출물(코멘트) 조회
          const lastOutput = await dbManager.getLastAgentComment(refTaskId);
          if (!lastOutput) continue;

          // 참조 카드의 타이틀도 조회 (컨텍스트 명확화)
          const refTask = await dbManager.getTaskById(refTaskId);
          const refTitle = refTask?.title || `Task #${refNum}`;

          refInjections.push(
            `\n\n---\n[🔗 참조 카드 #${refNum}: ${refTitle}]\n아래는 이전 담당자가 작성한 실제 산출물입니다. 이를 바탕으로 작업하세요:\n\n${lastOutput}\n---`
          );
          console.log(`[CardRef] #${refNum}(id:${refTaskId}) 산출물 ${lastOutput.length}자 주입 완료`);
        }

        if (refInjections.length > 0) {
          actualContent += refInjections.join('');
        }
      } catch (err) {
        console.warn('[CardRef] 카드 레퍼런스 resolve 중 오류 (무시):', err.message);
      }
    }

    // [Context Chaining] 컨텍스트 상속 프리뷰/주입 (PRD v1.3)
    const chainMatch = actualContent.match(/\[(#\d+(?:C\d+)?)\]/);
    if (chainMatch && taskId) {
      try {
        const refId = chainMatch[1];
        const currentTask = await dbManager.getTaskById(taskId);
        const projectId = currentTask?.project_id;
        if (projectId) {
          const chainDetails = await contextChainService.resolveChainDetails(refId, projectId);
          if (!chainDetails.error && chainDetails.chain.length > 0) {
            const compressedChainContext = contextChainService.compressChainForAgent(chainDetails.chain);
            actualContent += compressedChainContext;
            console.log(`[ContextChain/run] ${chainDetails.chain.length}개 체인 압축 주입 완료`);
          }
        }
      } catch (e) {
        console.warn('[ContextChain/run] 체인 주입 중 오류:', e.message);
      }
    }

    // [Phase 18-1 Ollie GAP-2] URL 스크래핑 및 Context 주입
    const urlMatches = actualContent.match(/https?:\/\/[^\s]+/g);
    if (urlMatches && urlMatches.length > 0) {
      try {
        const urlParser = (await import('./tools/urlParser.js')).default;
        const parsedContents = [];
        
        for (const url of urlMatches) {
          console.log(`[URL Parser] 웹 문서 다운로드 시도: ${url}`);
          const text = await urlParser.fetch(url);
          if (text) {
            parsedContents.push(`\n--- [웹페이지 추출 본문: ${url}] ---\n${text}\n-------------------`);
          }
        }
        
        if (parsedContents.length > 0) {
          actualContent += "\n\n[웹페이지 컨텍스트 참조 제공]\n다음은 사용자가 제공한 URL들에서 시스템이 파싱해온 본문 텍스트입니다. 이를 바탕으로 답변하세요:\n" + parsedContents.join("\n");
          console.log(`[URL Parser] ${parsedContents.length}개의 웹문서를 성공적으로 파싱하여 프롬프트에 주입 완료`);
        }
      } catch (err) {
        console.error('[URL Parser] 파싱 연동 중 오류 발생:', err.message);
      }
    }

    // [Instagram 스크래핑 바이패스]
    const igMatch = actualContent.match(/([a-zA-Z0-9._]{2,30}(?:\s*,\s*[a-zA-Z0-9._]{2,30})*)\s*(?:계정\s*|의\s*)?(?:인스타|인스타그램|instagram|ig)\s*(?:분석|수집|가져와|긁어와|조사)/i);
    if (igMatch) {
      this._log('info', `> [Instagram] 인스타그램 스크래퍼를 웜업합니다. 계정 데이터를 수집 중입니다... (약 5~15초 소요)`, agentId, taskId);
      try {
        const { instagramBatchAnalyze } = await import('./tools/instagramAdapter.js');
        const ids = igMatch[1].split(',').map(s => s.trim()).filter(Boolean);
        const scrapeResult = await instagramBatchAnalyze(ids);
        if (scrapeResult.success) {
           actualContent += `\n\n[인스타그램 분석 시스템 도구 결과]\n아래는 당신이 도구를 통해 수집한 실제 데이터입니다. 절대로 지어내지 말고, 이 데이터를 바탕으로 사용자에게 응답하세요:\n\n${scrapeResult.message}`;
           console.log(`[Executor] Instagram 데이터 ${ids.length}개 계정 수집 성공 및 프롬프트 주입 완료`);
        } else {
           actualContent += `\n\n[인스타그램 분석 시스템 도구 결과]\n수집에 실패했습니다: ${scrapeResult.message}`;
        }
      } catch (err) {
        console.error('[Instagram Bypass] 오류:', err.message);
      }
    }

    // [미디어 생성 바이패스 (NanoBanana POC)]
    if (actualContent.match(/(--image|그려줘|이미지 생성|썸네일 만들어줘)/)) {
      this._log('info', `> [MEDIA] 이미지 렌더링 요청을 감지했습니다. NanoBanana (Imagen 3) 엔진을 웜업하고 생성을 시작합니다...`, agentId, taskId);
      try {
        const imageMarkdown = await generateImage(actualContent);
        console.log(`[Executor] 이미지 생성 완료: 미디어 파이프라인 종료`);
        return {
          text: `요청하신 나노바나나 엔진 기반의 이미지가 렌더링 완료되었습니다.\n\n${imageMarkdown}`,
          model: 'nanoBanana (Imagen 3)',
          category: 'MEDIA',
          score: 1.0,
        };
      } catch (imgError) {
        throw imgError; // 아래 에러 캐치문으로 폴백
      }
    }

    // [영상 생성 바이패스 (Remotion POC)]
    if (actualContent.match(/(--video|영상 만들어줘|릴스 만들어줘|쇼츠 만들어줘)/)) {
      this._log('info', `> [MEDIA] 동영상 렌더링 요청을 감지했습니다. Remotion SSR 엔진을 웜업하고 MP4 빌드를 시작합니다... (약 10~20초 소요)`, agentId, taskId);
      try {
        const videoHtml = await generateVideo(actualContent);
        console.log(`[Executor] 비디오 생성 완료: 미디어 파이프라인 종료`);
        return {
          text: `요청하신 리모션 엔진 기반의 비디오(MP4)가 렌더링 완료되었습니다!\n\n${videoHtml}`,
          model: 'Remotion SSR',
          category: 'MEDIA',
          score: 1.0,
        };
      } catch (vidError) {
        throw vidError;
      }
    }

    // 3. 🚨 [Phase 26] 스킬 장착 권한 검증 — contextInjector 단일 소스
    // Prime Issue #4: ariDaemon/executor 양쪽 모두 동일한 기준으로 검증
    const BUILTIN_CATEGORIES = ['QUICK_CHAT', 'DEEP_WORK', 'ROUTING', 'MEDIA', 'WORKFLOW'];
    if (!BUILTIN_CATEGORIES.includes(evaluation.category)) {
      try {
        // evaluation.category(대문자) → SKILL.md name(소문자) 매핑
        const categoryToSkillName = {
          'MARKETING': 'marketing',
          'CONTENT':   'content',
          'DESIGN':    'design',
          'ANALYSIS':  'analysis',
          'KNOWLEDGE': 'research',
        };
        const requiredSkillName = categoryToSkillName[evaluation.category];

        if (requiredSkillName) {
          // [Phase 26] contextInjector와 동일한 소스(DB)로 검증
          // Layer 0 스킬은 항상 허용, Layer 1~2는 DB is_active 확인
          const agentSkills = await dbManager.getAgentSkills(agentId);
          const isEquipped = agentSkills.some(
            s => s.skill_id === requiredSkillName && s.is_active === 1
          );

          if (!isEquipped) {
            console.warn(`[Executor] 권한 방어벽 [Phase 26]: ${agentId}에게 '${requiredSkillName}' 스킬 미장착`);
            return {
              text: `🔒 보안 알림: 저(${agentId})는 현재 이 요청을 수행할 수 있는 스킬(\`${requiredSkillName}\`)을 장착하지 않았습니다. 대시보드 프로필에서 필요한 스킬 스위치를 **ON(활성화)** 해주세요!`,
              model: 'Guardrail',
              category: 'ACCESS_DENIED',
              score: 0,
            };
          }
        }
      } catch (err) {
        console.error('[Executor] 스킬 검증 중 오류 (무시하고 속행):', err.message);
      }
    }

    // [Phase 18-3] WORKFLOW 오케스트레이션 바이패스
    if (evaluation.category === 'WORKFLOW') {
      this._log('info', `> [WORKFLOW] 멀티 에이전트 협업 체인을 가동합니다. (Phase 1: 병렬 생성 -> Phase 2: 지능형 합성)`, 'system', taskId);
      
      // 임시: 실험 세팅에서 팀 ID는 보통 team_B(CKS)를 기본으로 함. 
      // (향후 유저 세팅이나 태스크 메타데이터에서 가져오도록 확장 가능)
      const teamId = (taskContent.includes('--teamA')) ? 'team_A' : 'team_B'; 
      
      try {
        const workflowResult = await workflowOrchestrator.runTeamWorkflow(taskId, teamId, actualContent, this._log.bind(this));
        return workflowResult;
      } catch (wfErr) {
        console.error('[Workflow Error]', wfErr);
        throw wfErr;
      }
    }

    // 4. 라우터를 통해 적절한 스킬(전용 프롬프트) 선택
    let taskInfo = null;
    if (taskId) {
      try { taskInfo = await dbManager.getTaskById(taskId); } catch(e) {}
    }
    const projectId = taskInfo ? taskInfo.project_id : null;

    const skill = router.route(actualContent, evaluation.category);
    let systemPrompt = loadSkillDocument(evaluation.category, projectId);
    if (!systemPrompt) {
      systemPrompt = skill.getSystemPrompt(); // 기존 Fallback 보장
    }

    // [Phase 22] 🧠 Context Injector를 통한 완벽한 문맥 캡슐화
    const livingRules = ruleHarvester.getAppliedRules(projectId);
    let finalSystemPrompt = contextInjector.buildInjectionPayload(systemPrompt, livingRules);

    if (agentId && agentId !== 'system' && agentId.toLowerCase() !== 'assistant') {
      let projectSpecificRole = '';
      if (taskId) {
        try {
          taskInfo = await dbManager.getTaskById(taskId);
          if (taskInfo && taskInfo.project_id) {
            const experimentRole = await dbManager.getAgentRoleInProject(agentId, taskInfo.project_id);
            if (experimentRole) {
              projectSpecificRole = `\n[해당 프로젝트에서의 귀하의 특별 임무 및 역할]\n${experimentRole}\n`;
            }
          }
        } catch (err) {
          console.warn('[Executor] 프로젝트별 페르소나 조회 실패:', err.message);
        }
      }

      const relayInstruction = `\n\n[자율 릴레이 바통 터치 규칙 — Phase 37 MANDATORY]\n작업 완료 후, 본문 최하단에 다음 목적에 맞는 태그를 작성하세요.\n\n🚨 [dev_advisor 필수 검수 규칙 — 모든 규칙보다 우선 적용]\n아래 상황에서는 반드시 review_request로 dev_advisor에게 넘겨야 합니다:\n  ✅ 코드(백엔드/프론트엔드/API)를 직접 작성하여 완료한 경우\n  ✅ 아키텍처 설계 문서를 완성한 경우\n  ✅ 데이터베이스 스키마를 설계/완성한 경우\n  ✅ 핵심 비즈니스 로직을 구현한 경우\n  ✅ QA 테스트를 완료하고 최종 결과를 보고하는 경우\n→ 위 경우 반드시: "assignee": "dev_advisor"\n\n━━ 방법 A: 핑퐁 (같은 카드, 다른 담당자에게) ━━\n사용 시점: 동일 산출물에 대한 반복 작업\n[핑퐁 키워드 패턴 — 아래 상황에서는 반드시 <review_request> 사용]\n  • 구현 완료 → 코드 리뷰 요청 → assignee: dev_advisor (필수)\n  • 코드 리뷰 완료 → 피드백 반영 → assignee: 원래 구현자\n  • 피드백 반영 완료 → 재검토 요청 → assignee: dev_advisor\n  • 재검토 통과 → QA 요청 → assignee: dev_qa\n  • QA 완료 → QA 결과 보고 → assignee: dev_advisor (최종 승인)\n  • 문서/설계 작성 완료 → 검토 요청 → assignee: dev_advisor\n<review_request>\n{\n  "title": "[리뷰] 작업 제목 (예: 텔레그램 미니앱 백엔드 API 코드 리뷰)",\n  "assignee": "dev_advisor",\n  "message": "검토 요청 내용 및 주요 구현 사항 요약"\n}\n</review_request>\n\n━━ 방법 B: 신규 카드 (완전히 새로운 업무 단위) ━━\n사용 시점: 새로운 기능·컴포넌트·시작\n주의: PRD/아키텍처 완료 후 바로 개발 카드를 만들지 말 것. 반드시 dev_advisor 검수 먼저.\n  • 아키텍처 승인 완료 → 백엔드 개발 시작\n  • 기능 A 완료 + 리뷰 통과 → 독립적인 기능 B 시작\n  • QA 중 신규 버그 발견 → 버그 수정 카드 생성\n<next_sprint>\n{\n  "title": "새 카드 제목",\n  "content": "새 담당자가 수행할 지시사항",\n  "assignee": "다음 담당자 역할 ID"\n}\n</next_sprint>\n\n━━ 방법 C: 릴레이 종료 (프로젝트/스프린트 완전 종료) ━━\n사용 시점: 모든 요구사항이 구현되고 QA까지 통과하여 더 이상 진행할 작업이 없는 경우.\n이 태그를 사용하면 자율 릴레이가 깔끔하게 종료되며 CEO의 최종 승인을 대기합니다.\n<pipeline_end>\n{\n  "message": "최종 완성되었습니다. 승인 부탁드립니다."\n}\n</pipeline_end>\n\n🔴 절대 금지 사항:\n- 본인(현재 담당자)에게 넘기는 것 금지\n- 코드 작성 완료 후 dev_advisor 검수 없이 next_sprint로 다음 개발 카드 생성 금지\n- dev_advisor 미거침 직행 개발 릴레이 금지\n`;
      const fileIOInstruction = `\n\n[파일 I/O 저장 규칙 — 물리적 파일 생성 도구]\n코드를 작성하거나 문서를 생성할 때, 반드시 아래 <file_operations> 태그를 사용하여 실제 파일로 디스크에 저장해야 합니다. (기본 출력 폴더명은 'OUTPUT' 입니다.)\n🚨 중요: HTML 기반의 프론트엔드 웹앱을 만들 때, 메인 파일은 반드시 하위 폴더 없이 최상위 경로인 \`index.html\` 로 저장하십시오! (예: path: "index.html") 그래야만 사용자의 Live Preview 버튼이 정상적으로 활성화됩니다.\n이 태그를 사용하면 프로젝트의 input/output 폴더 구조에 맞게 시스템이 물리적으로 파일을 자동 저장합니다.\n🚨 주의: <file_operations> 태그는 시스템 백그라운드에서 처리되므로 사용자 화면에는 코드가 보이지 않습니다.\n따라서 사용자(CEO)가 코드를 쉽게 읽고 리뷰할 수 있도록, **반드시 응답 본문(채팅창)에도 마크다운 코드 블록(\`\`\`언어명 ... \`\`\`)을 사용하여 작성된 코드를 예쁘게 출력**해 주어야 합니다!\n\n<file_operations>\n[\n  {\n    "action": "write",\n    "type": "output", // "input" 또는 "output"\n    "path": "index.html", // 하위 폴더 및 파일명\n    "content": "여기에 저장할 파일 내용 전체를 작성하세요..."\n  }\n]\n</file_operations>\n`;
      const graphifyInstruction = `\n\n[Phase 39 Graphify 하이퍼쿼리 필수 사용 규칙]\n코드를 탐색하거나 기존 프로젝트의 구조를 파악할 때, 무조건 파일을 텍스트로 읽기(grep 등) 전에 **Graphify MCP 서버의 query_graph, update_graph 도구**를 사용하여 프로젝트의 지식 신경망(Graph) 지형을 먼저 파악하십시오. 이를 통해 불필요한 토큰 낭비를 줄이고 파일 간의 의존성(Shortest Path)을 즉각적으로 추적해야 합니다.\n`;
      const handoffInstruction = `\n\n[Phase 39-3 Cross-Mode Handoff & Diff Analysis 규칙]\n당신이 현재 할당받은 작업(카드 ID: ${taskId || 'N/A'})에 대해, 이전에 기획 모드(ARCHITECT/Plan Master)나 타 모드에서 작성된 산출물(PRD, 히스토리)이 주어졌다면, **반드시 기존 기획 내용과 현재 시스템 코드 간의 차이(Diff)를 선행 분석**하십시오. 무작정 코딩을 시작하지 말고, "무엇을 변경/삭제/추가할지" 명확히 계획(Handoff 병합)한 후 작업을 수행하십시오. 이전 코멘트 ID나 카드 컨텍스트 링크가 있다면 반드시 참고해야 합니다.\n`;
      const executorPersona = `\n\n[절대 규칙: 실무자 페르소나 강제]\n당신은 현재 MyCrew의 실무자 에이전트 **${agentId.toUpperCase()}** 입니다. 사용자의 작업 지시를 받아 **즉시 실무 작업물을 생성**해야 합니다.\n절대로 자신을 제3자화하여 '~~에게 업무를 지시합니다'라고 말하거나 태스크 카드를 작성하는 흉내를 내지 마십시오. 당신은 관리자가 아니라 결과물을 만들어내는 직접 실행자입니다. 불필요한 인사말 없이 요구받은 최종 결과물(예: 코드, 디자인, 텍스트 등)만 즉시 작성하십시오.\n${projectSpecificRole}\n${relayInstruction}\n${fileIOInstruction}\n${graphifyInstruction}\n${handoffInstruction}`;
      finalSystemPrompt = executorPersona + finalSystemPrompt;
      try {
        if (taskId) {
          const tInfo = await dbManager.getTaskById(taskId);
          if (tInfo && tInfo.project_id) {
            const pRow = await dbManager.getProjectById(tInfo.project_id);
            if (pRow) {
              const pDirName = `${pRow.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_')}_${pRow.id.slice(-5)}`;
              // [Fix D-002] Use __dirname and correct depth (5) to guarantee folder hit.
              const pRoot = path.resolve(__dirname, '../../../../../04_Users/01_Company/01_Projects', pDirName);
              const wikiPath = path.resolve(pRoot, 'Project_WIKI/00_Index/PROJECT_WIKI.md');
              if (fs.existsSync(wikiPath)) {
                const wikiContent = fs.readFileSync(wikiPath, 'utf-8');
                // [Fix D-002] "Read Graph First" 프롬프트 인젝션
                finalSystemPrompt += `\n\n## 📚 프로젝트 구조화 지식 인덱스 (Read Graph First)\n아래 지식은 이 프로젝트의 중심 구조입니다. 작업을 시작하기 전 가장 먼저 참고하세요:\n${wikiContent}`;
                console.log(`[Executor] Project_WIKI.md (Read Graph First) 하드 인젝션 완료: ${wikiPath}`);
              } else {
                console.warn(`[Executor] Project_WIKI.md 파일을 찾을 수 없습니다: ${wikiPath}`);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Executor] Wiki 주입 실패:', err.message);
      }
    }

    try {
      console.log(`[Executor] 투입 모델: ${modelToUse}, 카테고리: ${evaluation.category}`);
      this._log('info', `> [${evaluation.category}] 카테고리에 해당하는 도구 모듈과 컨텍스트 로드를 완료했습니다.\n> 에이전트의 논리 회로를 가동하여 [${modelToUse}] 엔진을 통해 렌더링 및 생성을 시작합니다...`, 'system', taskId);

      // 5. [Phase 22] 비동기 어댑터 라우팅 (비서 대화 외의 무거운 작업은 File Polling 위임)
      const ASYNC_CATEGORIES = ['DEEP_WORK', 'CONTENT', 'MARKETING', 'DESIGN', 'MEDIA', 'ANALYSIS'];
      if (ASYNC_CATEGORIES.includes(evaluation.category) && taskId) {
        this._log('info', `> [비동기 위임] 이 작업은 시간이 소요되므로 고성능 백그라운드 어댑터에게 위임합니다.`, 'system', taskId);
        
        const taskContext = {
          taskId,
          agentId,
          category: evaluation.category,
          content: actualContent,
          systemPrompt: finalSystemPrompt,
          modelToUse
        };
        
        const queueResult = await filePollingAdapter.execute(taskContext);
        
        return {
          text: queueResult.message,
          model: 'AsyncAdapter',
          category: evaluation.category,
          score: 1.0
        };
      }

      // 6. 비서 레이어 또는 동기 처리 대상 (QUICK_CHAT, KNOWLEDGE 등)
      let result;
      try {
        // 라우팅: BRIDGE_AGENTS → antigravityAdapter(파일 브릿지), 나머지 → Gemini API 직접
        if (BRIDGE_AGENTS.has(agentId?.toLowerCase())) {
          result = await antigravityAdapter.generateResponse(actualContent, finalSystemPrompt, agentId.toLowerCase());
        } else {
          result = await geminiAdapter.generateResponse(actualContent, finalSystemPrompt, modelToUse);
        }
      } catch (firstTryError) {
        // [Resilience] Failover 모델 호출 오류 분석에서 지적된 "동일 모델 우회 문제" 개선 
        // -> Failover를 시도하기 전에 그냥 Error를 위임하여 중단
        throw firstTryError;
      }

      console.log(`[Executor] 작업 완료 성공 (사용모델: ${result.model}${result.isFailover ? ' - Failover Mode' : ''})`);

      // [Phase 4] CKS TEI 토큰 사용량 누적 로깅 (Null 가드 포함)
      if (taskId && result.tokenUsage) {
        await dbManager.accumulateCksTokens(taskId, result.tokenUsage, agentId).catch(e => console.error('[DB] TEI 토큰 누적 실패:', e));
      }

      // [Phase 4] CKS 평가 지표(Brain의 평가결과) 저장 (Null 가드 & Fallback 오염 방지)
      if (taskId && result._meta && !result._meta.fallback) {
        await dbManager.updateCksEvalMetrics(taskId, result._meta, agentId).catch(e => console.error('[DB] CKS 평가 지표 업데이트 실패:', e));
      }

      // [Week 2: Self-Learning 흡수] - 성공/실패 패턴을 SKILL.md에 로깅하여 자가성장 유도
      const activeSkillPath = getSkillPathMap(projectId)[evaluation.category];
      if (result.text && activeSkillPath) {
        try {
          const fullSkillPath = path.resolve(process.cwd(), activeSkillPath);
          if (fs.existsSync(fullSkillPath)) {
            // LLM 평가 사유에도 기밀(회사명 등)이 있을 수 있으므로 Regex Scrubbing 적용
            const scrubbedReason = scrubber.sanitize(evaluation.reason || '패턴화됨');
            const today = new Date().toISOString().slice(0, 10);

            if (evaluation.score >= 0.8) {
              // ✅ 성공 패턴 로깅
              const logEntry = `\n### [${today}] Self-Learning Pattern 🧠\n` +
                `- **패턴**: [${evaluation.category}] ${scrubbedReason}\n` +
                `- **모델**: ${result.model}\n` +
                `- **카테고리**: ${evaluation.category}\n` +
                `- **스코어**: ${evaluation.score}\n`;
              fs.appendFileSync(fullSkillPath, logEntry);
              console.log(`[Self-Learning] ✅ 성공 패턴 캡슐화 완료: ${activeSkillPath}`);

              // ❤️ 자동 다이제스트 트리거 (비동기 — 메인 응답 블로킹 없음)
              Promise.resolve().then(() =>
                autoDigestSkill(fullSkillPath, evaluation.category)
              );

            } else if (evaluation.score < 0.5) {
              // ⛔ 실패 패턴 즉시 로깅 (금지 규칙 후보)
              const failureLog = `\n### [${today}] ⛔ Failure Case\n` +
                `- **실패 패턴**: [${evaluation.category}] ${scrubbedReason}\n` +
                `- **모델**: ${result.model}\n` +
                `- **스코어**: ${evaluation.score} (임계값 0.5 미만)\n` +
                `- **처리**: 다음 Digest에서 금지 규칙으로 자동 흡수 예정\n`;
              fs.appendFileSync(fullSkillPath, failureLog);
              console.log(`[Self-Learning] ⛔ 실패 패턴 캡슐화 완료: ${activeSkillPath}`);

              // 실패도 Digest 트리거 대상 (금지 규칙 빠르게 반영)
              Promise.resolve().then(() =>
                autoDigestSkill(fullSkillPath, evaluation.category)
              );
            }
          }
        } catch(err) {
          console.warn('[Self-Learning] 스킬 파일 자동 기록 실패:', err.message);
        }
      }

      const parsed = this._extractThoughtProcess(result);

      // [B-2] File I/O 파서 및 물리적 저장 연동 (Hardcoding 타파)
      if (parsed.file_operations && Array.isArray(parsed.file_operations)) {
        if (!taskInfo && taskId) {
           taskInfo = await dbManager.getTaskById(taskId).catch(()=>null);
        }
        if (taskInfo && taskInfo.project_id) {
          // [Fix] 실제 생성된 물리적 프로젝트 폴더명 계산 로직 추가
          const projectRow = await dbManager.getProjectById(taskInfo.project_id).catch(()=>null);
          const projectDirName = projectRow ? `${projectRow.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_')}_${projectRow.id.slice(-5)}` : taskInfo.project_id;
          const projectRoot = path.resolve(process.cwd(), '../../04_Users/01_Company/01_Projects', projectDirName);
          const ioLogs = [];
          for (const op of parsed.file_operations) {
            if (op.action === 'write' && op.path) {
              // [Fix] 하드코딩된 폴더명 대신 실제 디스크 구조에 매핑
              const targetFolder = (op.type === 'input') ? 'INPUT' : 'OUTPUT';
              let safePath = path.normalize(op.path).replace(/^(\.\.[\\/])+/, '');
              // [Fix] 에이전트가 path에 'OUTPUT/...' 형식으로 폴더명을 중복 작성하는 경우 제거
              safePath = safePath.replace(/^(OUTPUT|INPUT|07_OUTPUT|08_IO\/inputs|outputs|inputs)[\\/]/i, '');
              const absolutePath = path.join(projectRoot, targetFolder, safePath);

              // [Fix] Path Traversal 이중 방어 — projectRoot 외부 접근 차단
              if (!absolutePath.startsWith(projectRoot)) {
                console.error(`[File I/O] 경로 탈출 시도 차단: ${absolutePath}`);
                ioLogs.push(`- ⛔ \`${op.path}\` 경로 탈출 시도 차단됨 (보안 정책)`);
                continue;
              }
              
              try {
                fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
                fs.writeFileSync(absolutePath, op.content || '', 'utf-8');
                ioLogs.push(`- 💾 \`${targetFolder}/${safePath}\` 물리 디스크 저장 완료`);
              } catch(e) {
                console.error(`[File I/O] 파일 쓰기 실패: ${absolutePath}`, e.message);
                ioLogs.push(`- ❌ \`${targetFolder}/${safePath}\` 디스크 저장 실패: ${e.message}`);
              }
            }
          }
          if (ioLogs.length > 0) {
            parsed.finalText = parsed.finalText + '\n\n**[File I/O System Result]**\n' + ioLogs.join('\n');
          }
        } else {
          console.warn('[File I/O] project_id를 찾을 수 없어 물리적 저장을 건너뜁니다.');
        }
      }

      return {
        text: parsed.finalText,
        model: result.model,
        category: evaluation.category,
        score: evaluation.score,
        _meta: parsed._meta,
      };
    } catch (error) {
      console.error('[Executor] 에러 발생', error);
      return {
        text: `앗, 대표님. 업무 처리 중 예기치 못한 에러가 발생했습니다: ${error.message}`,
        model: 'Error',
        category: 'ERROR',
        score: 0,
      };
    }
  }

  // [Phase 22.6 / S1-2 Fix] thought_process 파서 이중 실행 제거
  // AntiGravity 어댑터(antigravityAdapter.js)가 이미 <thinking>/<working> 태그를
  // 파싱·제거하고 _meta.thought_process에 저장함.
  // → 어댑터 경로: 텍스트 파싱 완전 바이패스, _meta 기존 필드 보존
  // → 직접 API 경로(geminiAdapter 등): 텍스트에서 태그 파싱 후 제거
  _extractThoughtProcess(result) {
    const _metaIn = result._meta || {};
    let finalText = result.text || '';
    let thoughtProcess = _metaIn.thought_process || null;

    // 어댑터가 이미 파싱된 결과를 _meta에 담았으면 재파싱 완전 생략
    // (antigravityAdapter.js: parseAndValidate에서 태그 제거 + _meta.thought_process 저장)
    const alreadyParsed = thoughtProcess &&
      (thoughtProcess.thinking || thoughtProcess.working);

    if (!alreadyParsed) {
      // 직접 API 경로(geminiAdapter 등) — 텍스트에서 직접 태그 파싱
      const thinkingMatch = finalText.match(/<thinking>([\s\S]*?)<\/thinking>/);
      const workingMatch  = finalText.match(/<working>([\s\S]*?)<\/working>/);

      if (thinkingMatch || workingMatch) {
        thoughtProcess = {};
        if (thinkingMatch) thoughtProcess.thinking = thinkingMatch[1].trim();
        if (workingMatch)  thoughtProcess.working  = workingMatch[1].trim();
      }
      // 태그를 최종 텍스트에서 제거
      finalText = finalText.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim();
      finalText = finalText.replace(/<working>[\s\S]*?<\/working>/g, '').trim();
    }

    // [Phase 36-A] 자율 릴레이 — next_sprint (신규 카드) 파싱
    let nextSprint = null;
    const sprintMatch = finalText.match(/<next_sprint>([\s\S]*?)<\/next_sprint>/i);
    if (sprintMatch) {
      try {
        nextSprint = JSON.parse(sprintMatch[1].trim());
      } catch (e) {
        console.warn('[Executor Parser] next_sprint JSON 파싱 실패:', e.message);
      }
      finalText = finalText.replace(/<next_sprint>[\s\S]*?<\/next_sprint>/ig, '').trim();
    }

    // [Phase 36-B] 자율 릴레이 — review_request (핑퐁: 같은 카드 재할당) 파싱
    let reviewRequest = null;
    const reviewMatch = finalText.match(/<review_request>([\s\S]*?)<\/review_request>/i);
    if (reviewMatch) {
      try {
        reviewRequest = JSON.parse(reviewMatch[1].trim());
      } catch (e) {
        console.warn('[Executor Parser] review_request JSON 파싱 실패:', e.message);
      }
      finalText = finalText.replace(/<review_request>[\s\S]*?<\/review_request>/ig, '').trim();
    }

    let pipelineEnd = false;
    const endMatch = finalText.match(/<pipeline_end>([\s\S]*?)<\/pipeline_end>/i);
    if (endMatch) {
      pipelineEnd = true;
      finalText = finalText.replace(/<pipeline_end>[\s\S]*?<\/pipeline_end>/ig, '').trim();
    }

    // [File I/O] 파일 물리 저장 파싱 추가
    let fileOperations = null;
    const fileOpMatch = finalText.match(/<file_operations>([\s\S]*?)<\/file_operations>/i);
    if (fileOpMatch) {
      try {
        fileOperations = JSON.parse(fileOpMatch[1].trim());
      } catch (e) {
        console.warn('[Executor Parser] file_operations JSON 파싱 실패:', e.message);
      }
      // 파일 컨텐츠는 너무 길 수 있으므로, 로그에 남기지 않고 제외함 (옵션)
      finalText = finalText.replace(/<file_operations>[\s\S]*?<\/file_operations>/ig, '\n[파일 I/O 저장 로직 수행됨]\n').trim();
    }

    // _meta 기존 필드 보존 (thinking_tokens, bridge_id 등 어댑터 필드 유실 방지)
    const _metaOut = { ..._metaIn, thought_process: thoughtProcess || null };
    if (nextSprint) _metaOut.next_sprint = nextSprint;
    if (reviewRequest) _metaOut.review_request = reviewRequest;
    if (pipelineEnd) _metaOut.pipeline_end = true;

    return { finalText, thoughtProcess, file_operations: fileOperations, _meta: _metaOut };
  }

  /**
   * runDirect — 파일 큐(FilePollingAdapter) 없이 현재 프로세스에서 AI를 직접 호출.
   * dispatchNextTaskForAgent가 크루 작업을 실행할 때 사용.
   * executor.run()과 동일하되 ASYNC_CATEGORIES 우회 없음.
   */
  async runDirect(taskContent, agentId = null, taskId = null, forceModel = null) {
    console.log(`[Executor.runDirect] Task #${taskId} 시작 (${agentId})`);
    this._log('info', `> [${agentId}] 사고 회로 가동 중...`, agentId || 'system', taskId);

    // 0. System Shield
    const shieldBlock = systemShieldSkill.applyShield(taskContent, agentId);
    if (shieldBlock) {
      this._log('warn', `> 🚨 System Shield 발동 — 작업 차단됨`, 'system', taskId);
      return shieldBlock;
    }



    // 1. 카테고리 & 모델 결정
    const evaluation = await modelSelector.selectModel(taskContent);

    // [S3-2] 카테고리 검증 — 알 수 없는 카테고리는 QUICK_CHAT으로 안전 폴백
    const VALID_CATEGORIES = new Set([
      'MARKETING', 'CONTENT', 'DESIGN', 'ANALYSIS', 'ROUTING',
      'KNOWLEDGE', 'MEDIA', 'DEEP_WORK', 'QUICK_CHAT'
    ]);
    if (!VALID_CATEGORIES.has(evaluation.category)) {
      this._log('warn',
        `> [S3-2] 알 수 없는 카테고리 "${evaluation.category}" — QUICK_CHAT으로 폴백`,
        agentId || 'system', taskId
      );
      evaluation.category = 'QUICK_CHAT';
    }

    const signatureModel = AGENT_SIGNATURE_MODELS[agentId?.toLowerCase()];
    let modelToUse = forceModel || signatureModel || evaluation.recommended_model || MODEL.FLASH;

    // ── [Phase 39] Quota Defender (Hotswap Engine) ───────────────────────────
    // Zero-Command (runDirect) 경로에서도 Claude 쿼터 초과를 방어합니다.
    if (modelToUse && modelToUse.toLowerCase().includes('claude')) {
      try {
        const isQuotaCritical = process.env.QUOTA_CRITICAL === 'true'; // [H-003]
        if (isQuotaCritical) {
          console.warn(`[Quota Defender] Claude 쿼터 임계점 도달 (<15분). Gemini 3.1 Pro로 Hotswap 진행 (runDirect).`);
          this._log('warn', `> ⚠️ Claude 4.6 일일 쿼터가 15분 미만으로 떨어졌습니다. 서비스 안정성을 위해 [Gemini 3.1 Pro] 엔진으로 핫스왑(Hotswap)하여 실행합니다.`, 'system', taskId);
          modelToUse = MODEL.PRO;
        }
      } catch (err) {
        console.warn('[Quota Defender] 쿼터 체크 에러 (무시):', err.message);
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    // 2. 스킬 문서 로드
    let taskInfo = null;
    if (taskId) {
      try { taskInfo = await dbManager.getTaskById(taskId); } catch(e) {}
    }
    const projectId = taskInfo ? taskInfo.project_id : null;

    const skill = router.route(taskContent, evaluation.category);
    let systemPrompt = loadSkillDocument(evaluation.category, projectId) || skill.getSystemPrompt();
    const livingRules = ruleHarvester.getAppliedRules(projectId);
    let finalSystemPrompt = contextInjector.buildInjectionPayload(systemPrompt, livingRules);

    if (agentId && agentId !== 'system' && agentId.toLowerCase() !== 'assistant') {
      let projectSpecificRole = '';
      if (taskId) {
        try {
          const taskInfo = await dbManager.getTaskById(taskId);
          if (taskInfo && taskInfo.project_id) {
            const experimentRole = await dbManager.getAgentRoleInProject(agentId, taskInfo.project_id);
            if (experimentRole) {
              projectSpecificRole = `\n[해당 프로젝트에서의 귀하의 특별 임무 및 역할]\n${experimentRole}\n`;
            }
          }
        } catch (err) {
          console.warn('[Executor] 프로젝트별 페르소나 조회 실패:', err.message);
        }
      }

      const relayInstruction = `\n\n[자율 릴레이 바통 터치 규칙 — Phase 37 MANDATORY]\n작업 완료 후, 본문 최하단에 다음 목적에 맞는 태그를 작성하세요.\n\n🚨 [dev_advisor 필수 검수 규칙 — 모든 규칙보다 우선 적용]\n아래 상황에서는 반드시 review_request로 dev_advisor에게 넘겨야 합니다:\n  ✅ 코드(백엔드/프론트엔드/API)를 직접 작성하여 완료한 경우\n  ✅ 아키텍처 설계 문서를 완성한 경우\n  ✅ 데이터베이스 스키마를 설계/완성한 경우\n  ✅ 핵심 비즈니스 로직을 구현한 경우\n  ✅ QA 테스트를 완료하고 최종 결과를 보고하는 경우\n→ 위 경우 반드시: "assignee": "dev_advisor"\n\n━━ 방법 A: 핑퐁 (같은 카드, 다른 담당자에게) ━━\n사용 시점: 동일 산출물에 대한 반복 작업\n[핑퐁 키워드 패턴 — 아래 상황에서는 반드시 <review_request> 사용]\n  • 구현 완료 → 코드 리뷰 요청 → assignee: dev_advisor (필수)\n  • 코드 리뷰 완료 → 피드백 반영 → assignee: 원래 구현자\n  • 피드백 반영 완료 → 재검토 요청 → assignee: dev_advisor\n  • 재검토 통과 → QA 요청 → assignee: dev_qa\n  • QA 완료 → QA 결과 보고 → assignee: dev_advisor (최종 승인)\n  • 문서/설계 작성 완료 → 검토 요청 → assignee: dev_advisor\n<review_request>\n{\n  "title": "[리뷰] 작업 제목 (예: 텔레그램 미니앱 백엔드 API 코드 리뷰)",\n  "assignee": "dev_advisor",\n  "message": "검토 요청 내용 및 주요 구현 사항 요약"\n}\n</review_request>\n\n━━ 방법 B: 신규 카드 (완전히 새로운 업무 단위) ━━\n사용 시점: 새로운 기능·컴포넌트·시작\n주의: PRD/아키텍처 완료 후 바로 개발 카드를 만들지 말 것. 반드시 dev_advisor 검수 먼저.\n  • 아키텍처 승인 완료 → 백엔드 개발 시작\n  • 기능 A 완료 + 리뷰 통과 → 독립적인 기능 B 시작\n  • QA 중 신규 버그 발견 → 버그 수정 카드 생성\n<next_sprint>\n{\n  "title": "새 카드 제목",\n  "content": "새 담당자가 수행할 지시사항",\n  "assignee": "다음 담당자 역할 ID"\n}\n</next_sprint>\n\n━━ 방법 C: 릴레이 종료 (프로젝트/스프린트 완전 종료) ━━\n사용 시점: 모든 요구사항이 구현되고 QA까지 통과하여 더 이상 진행할 작업이 없는 경우.\n이 태그를 사용하면 자율 릴레이가 깔끔하게 종료되며 CEO의 최종 승인을 대기합니다.\n<pipeline_end>\n{\n  "message": "최종 완성되었습니다. 승인 부탁드립니다."\n}\n</pipeline_end>\n\n🔴 절대 금지 사항:\n- 본인(현재 담당자)에게 넘기는 것 금지\n- 코드 작성 완료 후 dev_advisor 검수 없이 next_sprint로 다음 개발 카드 생성 금지\n- dev_advisor 미거침 직행 개발 릴레이 금지\n`;
      const fileIOInstruction = `\n\n[파일 I/O 저장 규칙 — 물리적 파일 생성 도구]\n코드를 작성하거나 문서를 생성할 때, 반드시 아래 <file_operations> 태그를 사용하여 실제 파일로 디스크에 저장해야 합니다. (기본 출력 폴더명은 'OUTPUT' 입니다.)\n🚨 중요: HTML 기반의 프론트엔드 웹앱을 만들 때, 메인 파일은 반드시 하위 폴더 없이 최상위 경로인 \`index.html\` 로 저장하십시오! (예: path: "index.html") 그래야만 사용자의 Live Preview 버튼이 정상적으로 활성화됩니다.\n🚨 주의: 사용자(CEO)가 코드를 쉽게 읽고 리뷰할 수 있도록, **반드시 응답 본문에도 마크다운 코드 블록(\`\`\`언어명 ... \`\`\`)을 사용하여 작성된 코드를 예쁘게 출력**해 주어야 합니다!\n\n<file_operations>\n[\n  {\n    "action": "write",\n    "type": "output",\n    "path": "index.html",\n    "content": "저장할 파일 내용 전체..."\n  }\n]\n</file_operations>\n`;
      const executorPersona = `\n\n[절대 규칙: 실무자 페르소나 강제]\n당신은 현재 MyCrew의 실무자 에이전트 **${agentId.toUpperCase()}** 입니다. \n만약 제공된 스킬 문서나 지시사항 내에 다른 에이전트 이름(예: NOVA, LILY 등)이 기재되어 있더라도 철저히 무시하고 오직 **${agentId.toUpperCase()}** 로서 임무를 수행하십시오.\n사용자의 작업 지시를 받아 **즉시 실무 작업물을 생성**해야 합니다.\n절대로 자신을 제3자화하여 '繞에게 업무를 지시합니다'라고 말하거나 태스크 카드를 작성하는 흔내를 내지 마십시오. 당신은 관리자나 기획자가 아니라 결과물을 만들어내는 직접 실행자입니다. 본인 스스로에게 지시를 내리는 행위도 엄격히 금지됩니다. 불필요한 인사말이나 서론 없이 요구받은 최종 결과물(예: 코드, 렌더링된 마크다운 이미지, 텍스트 본문 등)만 즉각적으로 출력하십시오.\n${projectSpecificRole}\n${relayInstruction}\n${fileIOInstruction}`;
      finalSystemPrompt = executorPersona + finalSystemPrompt;
      try {
        if (taskId) {
          const tInfo = await dbManager.getTaskById(taskId);
          if (tInfo && tInfo.project_id) {
            const pRow = await dbManager.getProjectById(tInfo.project_id);
            if (pRow) {
              const pDirName = `${pRow.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_')}_${pRow.id.slice(-5)}`;
              const pRoot = path.resolve(process.cwd(), '../../04_Users/01_Company/01_Projects', pDirName);
              const wikiPath = path.resolve(pRoot, '.mycrew/wiki/PROJECT_WIKI.md');
              if (fs.existsSync(wikiPath)) {
                const wikiContent = fs.readFileSync(wikiPath, 'utf-8');
                finalSystemPrompt += `\n\n## 📚 프로젝트 위키 (자동 로드)\n${wikiContent}`;
                console.log(`[Executor] Project LLM Wiki 자동 주입 완료 (runDirect): ${wikiPath}`);
              }
            }
          }
        }
      } catch (err) {
        console.warn('[Executor] Wiki 주입 실패 (runDirect):', err.message);
      }
    }

    this._log('info', `> [${evaluation.category}] 모듈 로드 완료. ${modelToUse} 엔진으로 생성을 시작합니다...`, agentId || 'system', taskId);

    // [Phase 37] #N 카드 레퍼런스 자동 resolve (run()과 동기화)
    let resolvedContent = taskContent;
    const cardRefMatchesDirect = [...new Set(taskContent.match(/#(\d+)/g) || [])];
    if (cardRefMatchesDirect.length > 0 && taskId) {
      try {
        const refInjections = [];
        const currentTask = await dbManager.getTaskById(taskId);
        const projectId = currentTask?.project_id;

        for (const ref of cardRefMatchesDirect) {
          const refNum = parseInt(ref.slice(1), 10);
          if (isNaN(refNum)) continue;

          const refTaskId = await dbManager.getTaskIdByProjectNum(projectId, refNum);
          if (!refTaskId) continue;

          const lastOutput = await dbManager.getLastAgentComment(refTaskId);
          if (!lastOutput) continue;

          const refTask = await dbManager.getTaskById(refTaskId);
          const refTitle = refTask?.title || `Task #${refNum}`;

          refInjections.push(
            `\n\n---\n[🔗 참조 카드 #${refNum}: ${refTitle}]\n아래는 이전 담당자가 작성한 실제 산출물입니다. 이를 바탕으로 작업하세요:\n\n${lastOutput}\n---`
          );
          console.log(`[CardRef/runDirect] #${refNum}(id:${refTaskId}) 산출물 ${lastOutput.length}자 주입 완료`);
        }

        if (refInjections.length > 0) {
          resolvedContent = taskContent + refInjections.join('');
        }
      } catch (err) {
        console.warn('[CardRef/runDirect] 카드 레퍼런스 resolve 중 오류 (무시):', err.message);
      }
    }

    // [Context Chaining] 컨텍스트 상속 프리뷰/주입 (PRD v1.3)
    const chainMatchDirect = resolvedContent.match(/\[(#\d+(?:C\d+)?)\]/);
    if (chainMatchDirect && taskId) {
      try {
        const refId = chainMatchDirect[1];
        const currentTask = await dbManager.getTaskById(taskId);
        const projectId = currentTask?.project_id;
        if (projectId) {
          const chainDetails = await contextChainService.resolveChainDetails(refId, projectId);
          if (!chainDetails.error && chainDetails.chain.length > 0) {
            const compressedChainContext = contextChainService.compressChainForAgent(chainDetails.chain);
            resolvedContent += compressedChainContext;
            console.log(`[ContextChain/runDirect] ${chainDetails.chain.length}개 체인 압축 주입 완료`);
          }
        }
      } catch (e) {
        console.warn('[ContextChain/runDirect] 체인 주입 중 오류:', e.message);
      }
    }

    // [Instagram 스크래핑 바이패스]
    const igMatchDirect = resolvedContent.match(/([a-zA-Z0-9._]{2,30}(?:\s*,\s*[a-zA-Z0-9._]{2,30})*)\s*(?:계정\s*|의\s*)?(?:인스타|인스타그램|instagram|ig)\s*(?:분석|수집|가져와|긁어와|조사)/i);
    if (igMatchDirect) {
      this._log('info', `> [Instagram] 인스타그램 스크래퍼를 웜업합니다. 계정 데이터를 수집 중입니다... (약 5~15초 소요)`, agentId, taskId);
      try {
        const { instagramBatchAnalyze } = await import('./tools/instagramAdapter.js');
        const ids = igMatchDirect[1].split(',').map(s => s.trim()).filter(Boolean);
        const scrapeResult = await instagramBatchAnalyze(ids);
        if (scrapeResult.success) {
           resolvedContent += `\n\n[인스타그램 분석 시스템 도구 결과]\n아래는 당신이 도구를 통해 수집한 실제 데이터입니다. 절대로 지어내지 말고, 이 데이터를 바탕으로 사용자에게 응답하세요:\n\n${scrapeResult.message}`;
           console.log(`[Executor/runDirect] Instagram 데이터 ${ids.length}개 계정 수집 성공 및 프롬프트 주입 완료`);
        } else {
           resolvedContent += `\n\n[인스타그램 분석 시스템 도구 결과]\n수집에 실패했습니다: ${scrapeResult.message}`;
        }
      } catch (err) {
        console.error('[Instagram Bypass] 오류:', err.message);
      }
    }

    // 3. 모델 직접 호출 (filePollingAdapter 미경유)
    // 라우팅: BRIDGE_AGENTS → antigravityAdapter(파일 브릿지), 나머지 → Gemini API 직접
    let result;
    try {
      if (BRIDGE_AGENTS.has(agentId?.toLowerCase())) {
        result = await antigravityAdapter.generateResponse(resolvedContent, finalSystemPrompt, agentId.toLowerCase());
      } else {
        result = await geminiAdapter.generateResponse(resolvedContent, finalSystemPrompt, modelToUse);
      }
    } catch (err) {
      throw err; // 호출부에서 처리
    }

    // 4. 토큰 사용량 기록
    if (taskId && result.tokenUsage) {
      await dbManager.accumulateCksTokens(taskId, result.tokenUsage, agentId).catch(() => {});
    }

    this._log('info', `> [WORKED] Task #${taskId} 생성 완료 (${result.model})`, agentId || 'system', taskId);

    const parsed = this._extractThoughtProcess(result);

    // [Hotfix #3] File I/O 파서 — runDirect()에도 동일 적용 (run()과 동기화)
    if (parsed.file_operations && Array.isArray(parsed.file_operations)) {
      let taskInfoForIO = null;
      if (taskId) {
        taskInfoForIO = await dbManager.getTaskById(taskId).catch(() => null);
      }
      if (taskInfoForIO && taskInfoForIO.project_id) {
        const projectRow = await dbManager.getProjectById(taskInfoForIO.project_id).catch(()=>null);
        const projectDirName = projectRow ? `${projectRow.name.replace(/[^a-zA-Z0-9가-힣]/g, '_').replace(/_+/g, '_')}_${projectRow.id.slice(-5)}` : taskInfoForIO.project_id;
        const projectRoot = path.resolve(process.cwd(), '../../04_Users/01_Company/01_Projects', projectDirName);
        const ioLogs = [];
        for (const op of parsed.file_operations) {
          if (op.action === 'write' && op.path) {
            const targetFolder = (op.type === 'input') ? 'INPUT' : 'OUTPUT';
            let safePath = path.normalize(op.path).replace(/^(\.\.[\\/])+/, '');
            // [Fix] 에이전트가 path에 'OUTPUT/...' 형식으로 폴더명을 중복 작성하는 경우 제거
            safePath = safePath.replace(/^(OUTPUT|INPUT|07_OUTPUT|08_IO\/inputs|outputs|inputs)[\\/]/i, '');
            const absolutePath = path.join(projectRoot, targetFolder, safePath);
            if (!absolutePath.startsWith(projectRoot)) {
              ioLogs.push(`- ⛔ \`${op.path}\` 경로 탈출 시도 차단됨 (보안 정책)`);
              continue;
            }
            try {
              fs.mkdirSync(path.dirname(absolutePath), { recursive: true });
              fs.writeFileSync(absolutePath, op.content || '', 'utf-8');
              ioLogs.push(`- 💾 \`${targetFolder}/${safePath}\` 저장 완료`);
            } catch(e) {
              ioLogs.push(`- ❌ \`${targetFolder}/${safePath}\` 저장 실패: ${e.message}`);
            }
          }
        }
        if (ioLogs.length > 0) {
          parsed.finalText = parsed.finalText + '\n\n**[File I/O System Result]**\n' + ioLogs.join('\n');
        }
      }
    }

    return {
      text: parsed.finalText,
      model: result.model,
      category: evaluation.category,
      score: evaluation.score,
      _meta: parsed._meta,
    };
  }

  // ─── [Phase 43] Continuous Mode & Auto Run Scheduler ──────────────────────
  /**
   * 프로젝트 내 대기 중인(todo/PENDING) 태스크를 순차적으로 실행하는 자율 루프
   * @param {number|string} projectId - 대상 프로젝트 ID
   * @param {string} agentId - 실행 에이전트 ID (기본: dev_senior)
   * @param {number|string} [startingTaskId=null] - 유저가 특정 카드(todo/in_progress)에서 명시적으로 시작을 요청한 경우
   */
  async autoRun(projectId, agentId = 'dev_senior', startingTaskId = null) {
    const runId = `${projectId}_${Date.now()}`;
    const abortController = new AbortController();
    this.activeAutoRuns.set(runId, abortController);

    console.log(`[AutoRun] 🚀 프로젝트 ${projectId} 자동 릴레이 시작 (RunID: ${runId}, StartTask: ${startingTaskId || 'Auto'})`);

    let nextTaskIdToRun = startingTaskId; // 시작 태스크가 지정되었다면 그것부터
    let currentTaskId = null;

    try {
      while (!abortController.signal.aborted) {
        let nextTask = null;

        // 1. 카드(태스크) 획득 로직 (Scheduler)
        if (nextTaskIdToRun) {
          // 사용자가 특정 카드(PRD, IN_PROGRESS 등)에서 바로 시작하라고 명령한 경우
          nextTask = await dbManager.getTaskById(nextTaskIdToRun);
          nextTaskIdToRun = null; // 1회성 소모
        } else {
          // 일반적인 큐 스케줄링 로직
          const tasks = await dbManager.getTasksByProjectId(projectId);
          // todo 또는 pending 상태인 것 중 최우선순위 1개 선택
          nextTask = tasks.find(t => t.status.toLowerCase() === 'todo' || t.status.toLowerCase() === 'pending');
        }

        if (!nextTask) {
          console.log(`[AutoRun] 🏁 더 이상 처리할 대기(todo) 태스크가 없습니다. 루프 종료.`);
          if (this._broadcastLog) this._broadcastLog('info', `🏁 처리할 태스크가 없어 자동 릴레이를 종료합니다.`, agentId, null);
          break;
        }

        currentTaskId = nextTask.id;
        console.log(`[AutoRun] 📌 태스크 선택: #${currentTaskId} (${nextTask.title})`);
        
        // 2. 상태 전이 (Lifecycle): 시작 시 todo -> IN_PROGRESS
        await dbManager.updateTaskStatus(currentTaskId, 'IN_PROGRESS');
        if (this._broadcastLog) {
          this._broadcastLog('info', `▶️ 태스크 #${currentTaskId} 실행 시작`, agentId, currentTaskId);
        }

        // 3. 루프 제어 변수 및 강제 종료 기제(Max Steps)
        let stepCount = 0;
        const MAX_STEPS = 15;
        let isTaskCompleted = false;
        let toolOutputs = [];

        // 모듈형 프롬프트 주입기 호출
        const autoRunContext = contextInjector.buildAutoRunContext({
          title: nextTask.title,
          description: nextTask.content || ''
        });

        // 4. 태스크 내 단일 루프 (Continuous Mode)
        while (!isTaskCompleted && !abortController.signal.aborted) {
          stepCount++;
          if (stepCount > MAX_STEPS) {
             throw new Error('Max steps exceeded');
          }

          let currentPrompt = autoRunContext;
          if (toolOutputs.length > 0) {
            currentPrompt += `\n\n[PREVIOUS TOOL OUTPUTS]\n${toolOutputs.join('\n\n')}\n`;
          }

          if (this._broadcastLog) {
            this._broadcastLog('info', `⏳ [AutoRun] Step ${stepCount}: 에이전트 사고 회로 가동 중...`, agentId, currentTaskId);
          }

          // [Step 5] LLM API 직접 호출 (여기서는 GeminiAdapter 활용)
          const result = await geminiAdapter.generateResponse(
            "주어진 태스크를 달성하기 위해 코딩을 진행하세요. 필요한 경우 반드시 <tool_calls>를 사용하십시오.",
            currentPrompt,
            MODEL.PRO
          );

          // [Step 4] DB에 로그(코멘트) 저장 및 UI 브로드캐스트
          await dbManager.createComment(currentTaskId, agentId.toUpperCase(), result.text);
          if (this._broadcastLog) {
            this._broadcastLog('info', result.text, agentId, currentTaskId);
          }

          // [Step 5] 도구(Tool Call) 파싱 로직
          let isBlocked = false;
          const toolCallMatch = result.text.match(/<tool_calls>([\s\S]*?)<\/tool_calls>/i);
          if (toolCallMatch) {
            try {
              const calls = JSON.parse(toolCallMatch[1].trim());
              for (const call of calls) {
                const { name, arguments: args } = call;

                if (this._broadcastLog) {
                  this._broadcastLog('info', `🔧 도구 실행 중: ${name}`, agentId, currentTaskId);
                }

                // 단일화된 toolExecutor 사용 (WARN-001, BUG-002 방어 포함)
                const resultObj = await executeTool(name, args);
                let output = resultObj.output;

                if (resultObj.action === 'FINISH') {
                  isTaskCompleted = true;
                } else if (resultObj.action === 'PAUSE') {
                  // BUG-001: ask_user 호출 시 BLOCKED 전환
                  isTaskCompleted = true; 
                  isBlocked = true;
                  await dbManager.updateTaskStatus(currentTaskId, 'BLOCKED');
                  if (this._broadcastLog) {
                    this._broadcastLog('warn', `⏸️ 사용자 응답 대기 (BLOCKED): ${resultObj.reason}`, agentId, currentTaskId);
                  }
                }

                // WARN-002: 대형 출력 방어 (3000자 제한)
                if (output.length > 3000) {
                  output = output.substring(0, 3000) + '\n... (Output truncated due to size limit)';
                }

                toolOutputs.push(`--- TOOL: ${name} ---\nARGS: ${JSON.stringify(args)}\nRESULT:\n${output}`);
                
                // WARN-002: 최근 3개의 도구 출력 이력만 유지
                if (toolOutputs.length > 3) {
                  toolOutputs.shift();
                }
                
                // 도구 실행 결과도 시스템 로그로 저장
                await dbManager.createComment(currentTaskId, 'SYSTEM', output);

                if (isBlocked) break; // BLOCKED 상태면 남은 도구 실행 중단
              }
            } catch(e) {
              console.warn('[AutoRun] tool_calls 파싱 실패:', e.message);
              toolOutputs.push(`Failed to parse <tool_calls> JSON: ${e.message}`);
              await dbManager.createComment(currentTaskId, 'SYSTEM', `❌ 도구 파싱 실패: ${e.message}`);
            }
          } else {
            // 도구를 안 썼고 종료 선언도 안 했으면 에러 문맥 주입
            if (!isTaskCompleted) {
              toolOutputs.push(`System Warning: No <tool_calls> found in your response. You must use tools to proceed, or call finish_task to complete.`);
            }
          }
        }

        // 5. 작업 완료 시 판정 (Lifecycle): 무조건 REVIEW 전환 및 CEO 할당 (단, BLOCKED 상태가 아닐 때만)
        // BUG-001 수정: isBlocked 확인
        if (!abortController.signal.aborted && isTaskCompleted && !isBlocked) {
          await dbManager.updateTaskStatus(currentTaskId, 'REVIEW');
          await dbManager.updateTaskAssignee(currentTaskId, 'ceo');
          console.log(`[AutoRun] ✅ 태스크 #${currentTaskId} 완료 → REVIEW 전환 및 CEO 할당`);
          if (this._broadcastLog) {
            this._broadcastLog('info', `✅ 태스크 #${currentTaskId} 완료. CEO의 최종 검토를 대기합니다 (REVIEW).`, agentId, currentTaskId);
          }
        }
        
        currentTaskId = null; // 루프 종료 후 리셋
      }
    } catch (err) {
      console.error(`[AutoRun] 🚨 에러 발생 (RunID: ${runId}):`, err.message);
      // 에러 발생 시 진행 중이던 카드가 있다면 FAILED 처리
      if (currentTaskId) {
        await dbManager.updateTaskStatus(currentTaskId, 'FAILED');
        if (this._broadcastLog) {
          this._broadcastLog('error', `🚨 태스크 #${currentTaskId} 실행 중 치명적 에러 발생: ${err.message}`, agentId, currentTaskId);
        }
      }
    } finally {
      this.activeAutoRuns.delete(runId);
      console.log(`[AutoRun] 🛑 프로세스 완전 종료 (RunID: ${runId})`);
    }
  }

  /**
   * [Phase 43] 사용자 주도 강제 종료 (Escape Hatch)
   * @param {string} runId - 종료할 Auto Run 프로세스 ID
   */
  stopAutoRun(runId) {
    if (this.activeAutoRuns.has(runId)) {
      this.activeAutoRuns.get(runId).abort();
      this.activeAutoRuns.delete(runId);
      console.log(`[AutoRun] 🛑 강제 종료 시그널 전송됨 (RunID: ${runId})`);
      
      // WARN-003: UI 브로드캐스트 누락 픽스
      if (this._broadcastLog) {
        this._broadcastLog('error', `🛑 사용자에 의해 AutoRun 프로세스가 강제 종료되었습니다.`, 'SYSTEM', null);
      }
      return true;
    }
    return false;
  }
}

// ─── [Boot Wiring] 순환 의존성 해결을 위한 콜백 주입 ────────────────────────
workflowOrchestrator.setClearCacheCallback(clearSkillCache);

export default new Executor();

