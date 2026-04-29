import fs from 'fs';
import path from 'path';
import router from './router.js';
import geminiAdapter from './adapters/geminiAdapter.js';
import antigravityAdapter from './adapters/antigravityAdapter.js';
import filePollingAdapter from './adapters/FilePollingAdapter.js';
import modelSelector from './modelSelector.js';
import dbManager from '../database.js';
import systemShieldSkill from './skills/systemShieldSkill.js';
import scrubber from './tools/scrubbing.js';
import { MODEL } from './modelRegistry.js';
import { generateImage } from '../skill-library/05_design/nanoBananaGenerator.js';
import { generateVideo } from '../skill-library/05_design/remotionRenderer.js';
import ruleHarvester from './tools/ruleHarvester.js';
import workflowOrchestrator from './tools/workflowOrchestrator.js';
import contextInjector from './tools/contextInjector.js';




// [v3.2 SMART PARITY] 에이전트별 시능 수준에 따른 시그니처 모델 매핑 (v4.7 최신화)
// [구독 티어 분기] USER_MODEL_TIER=pro → Gemini Pro, 미설정(디폴트) → Flash
// 사용자의 Gemini 구독 상태에 따라 nova/lumi 모델이 자동 전환됨
// API 사용자: Flash 유지 / Gemini Pro·Ultra 구독자: Pro 격상
const IS_PRO_TIER = process.env.USER_MODEL_TIER === 'pro';

// [Phase 26] agents.json 기반 동적 파생 — 하드코딩 BRIDGE_AGENTS 대체
// bridge:true 인 에이전트 = AntiGravity 파일 브릿지 대상
const BRIDGE_AGENTS = new Set();

// [Phase 26] agents.json 기반 동적 파생 — 하드코딩 AGENT_SIGNATURE_MODELS 대체
// anti-* 식별자를 antiModel 필드에서 읽음 → antigravityAdapter로 라우팅
const AGENT_SIGNATURE_MODELS = {};

try {
  const _agentsRaw = fs.readFileSync(path.resolve(process.cwd(), 'agents.json'), 'utf-8');
  const _agents = JSON.parse(_agentsRaw);
  _agents.forEach(a => {
    const id = a.id.toLowerCase();
    if (a.bridge === true) {
      BRIDGE_AGENTS.add(id);
      AGENT_SIGNATURE_MODELS[id] = a.antiModel || MODEL.ANTI_GEMINI_PRO_HIGH;
    } else {
      // 브릿지 에이전트 아님: 시그니처 모델 = ARI는 Flash, 그 외 에이전트는 Flash
      if (id === 'ari') AGENT_SIGNATURE_MODELS[id] = MODEL.PRO; // ARI 기본 Pro
    }
  });
  console.log(`[Executor] 동적 BRIDGE_AGENTS: [${[...BRIDGE_AGENTS].join(', ')}]`);
} catch (e) {
  // agents.json 로드 실패 시 폴백 하드코딩 (SLA 보장)
  console.warn('[Executor] agents.json 로드 실패, 폴백 BRIDGE_AGENTS 사용:', e.message);
  ['luna', 'ollie', 'lily', 'pico', 'nova', 'lumi'].forEach(id => BRIDGE_AGENTS.add(id));
  Object.assign(AGENT_SIGNATURE_MODELS, {
    'luna':  MODEL.OPUS,
    'ollie': MODEL.OPUS,
    'lily':  MODEL.SONNET,
    'pico':  MODEL.SONNET,
    'nova':  MODEL.PRO,
    'lumi':  MODEL.PRO,
    'ari':   MODEL.PRO,
  });
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

// [DRY Fix] Prime 9th Review 권고 대응: SKILL_PATH_MAP 중복 선언 모듈 스코프로 통합
export const SKILL_PATH_MAP = {
  'MARKETING':  'skill-library/02_marketing/SKILL.md',
  'CONTENT':    'skill-library/03_content/SKILL.md',
  'ANALYSIS':   'skill-library/04_analysis/SKILL.md',
  'DESIGN':     'skill-library/05_design/SKILL.md',
  'ROUTING':    'skill-library/01_routing/SKILL.md',
  'KNOWLEDGE':  'skill-library/06_research/SKILL.md',
  'WORKFLOW':   'skill-library/08_workflow/SKILL.md',
};

/** SKILL.md 로드 함수 (외부 도구에서도 사용 가능하도록 내보내기) */
export function loadSkillDocument(category) {
  const now = Date.now();
  const cached = skillCache.get(category);
  
  // Hit: 캐시가 유효하면 즉시 반환
  if (cached && (now - cached.loadedAt) < CACHE_TTL_MS) {
    return cached.content;
  }
  
  // Miss: 파일 로드 후 캐시에 저장
  const relativePath = SKILL_PATH_MAP[category];
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
    
    skillCache.set(category, { content: truncated, loadedAt: now });
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
    const skill = router.route(actualContent, evaluation.category);
    let systemPrompt = loadSkillDocument(evaluation.category);
    if (!systemPrompt) {
      systemPrompt = skill.getSystemPrompt(); // 기존 Fallback 보장
    }

    // [Phase 22] 🧠 Context Injector를 통한 완벽한 문맥 캡슐화
    const livingRules = ruleHarvester.getAppliedRules();
    const finalSystemPrompt = contextInjector.buildInjectionPayload(systemPrompt, livingRules);

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
      const activeSkillPath = SKILL_PATH_MAP[evaluation.category];
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

    // _meta 기존 필드 보존 (thinking_tokens, bridge_id 등 어댑터 필드 유실 방지)
    const _metaOut = { ..._metaIn, thought_process: thoughtProcess || null };

    return { finalText, thoughtProcess, _meta: _metaOut };
  }

  /**
   * runDirect — 파일 큐(FilePollingAdapter) 없이 현재 프로세스에서 AI를 직접 호출.
   * dispatchNextTaskForAgent가 크루 작업을 실행할 때 사용.
   * executor.run()과 동일하되 ASYNC_CATEGORIES 우회 없음.
   */
  async runDirect(taskContent, agentId = null, taskId = null) {
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
    const modelToUse = signatureModel || evaluation.recommended_model || MODEL.FLASH;

    // 2. 스킬 문서 로드
    const skill = router.route(taskContent, evaluation.category);
    let systemPrompt = loadSkillDocument(evaluation.category) || skill.getSystemPrompt();
    const livingRules = ruleHarvester.getAppliedRules();
    const finalSystemPrompt = contextInjector.buildInjectionPayload(systemPrompt, livingRules);

    this._log('info', `> [${evaluation.category}] 모듈 로드 완료. ${modelToUse} 엔진으로 생성을 시작합니다...`, agentId || 'system', taskId);

    // 3. 모델 직접 호출 (filePollingAdapter 미경유)
    // 라우팅: BRIDGE_AGENTS → antigravityAdapter(파일 브릿지), 나머지 → Gemini API 직접
    let result;
    try {
      if (BRIDGE_AGENTS.has(agentId?.toLowerCase())) {
        result = await antigravityAdapter.generateResponse(taskContent, finalSystemPrompt, agentId.toLowerCase());
      } else {
        result = await geminiAdapter.generateResponse(taskContent, finalSystemPrompt, modelToUse);
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

    return {
      text: parsed.finalText,
      model: result.model,
      category: evaluation.category,
      score: evaluation.score,
      _meta: parsed._meta,
    };
  }
}

// ─── [Boot Wiring] 순환 의존성 해결을 위한 콜백 주입 ────────────────────────
workflowOrchestrator.setClearCacheCallback(clearSkillCache);

export default new Executor();

