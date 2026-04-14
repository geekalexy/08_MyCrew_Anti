import fs from 'fs';
import path from 'path';
import router from './router.js';
import geminiAdapter from './adapters/geminiAdapter.js';
import modelSelector from './modelSelector.js';
import dbManager from '../database.js';
import systemShieldSkill from './skills/systemShieldSkill.js';
import scrubber from './tools/scrubbing.js';

// ─── SKILL.md 캐시 (서버 생존 주기 동안 유지) ─────────────────────────
const skillCache = new Map();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5분 TTL

function loadSkillDocument(category) {
  const now = Date.now();
  const cached = skillCache.get(category);
  
  // Hit: 캐시가 유효하면 즉시 반환
  if (cached && (now - cached.loadedAt) < CACHE_TTL_MS) {
    return cached.content;
  }
  
  // Miss: 파일 로드 후 캐시에 저장
  const SKILL_PATH_MAP = {
    'MARKETING':  'skill-library/02_marketing/SKILL.md',
    'CONTENT':    'skill-library/03_content/SKILL.md',
    'ANALYSIS':   'skill-library/04_analysis/SKILL.md',
    'DESIGN':     'skill-library/05_design/SKILL.md',
    'ROUTING':    'skill-library/01_routing/SKILL.md',
    'KNOWLEDGE':  'skill-library/06_research/SKILL.md',
  };
  
  const relativePath = SKILL_PATH_MAP[category];
  if (!relativePath) return null;
  
  try {
    const fullPath = path.resolve(process.cwd(), relativePath);
    if (!fs.existsSync(fullPath)) return null;
    const raw = fs.readFileSync(fullPath, 'utf-8');
    
    // L2 추출: YAML frontmatter 제거 후 본문만
    const bodyStart = raw.indexOf('---', raw.indexOf('---') + 3);
    const body = bodyStart > 0 ? raw.slice(bodyStart + 3).trim() : raw;
    
    // 토큰 예산 제어: 최대 2000자로 트렁케이션
    const truncated = body.length > 2000 
      ? body.slice(0, 2000) + '\n\n[...truncated for token budget]' 
      : body;
    
    skillCache.set(category, { content: truncated, loadedAt: now });
    return truncated;
  } catch (err) {
    console.warn(`[SkillLoader] ${category} SKILL.md 로드 실패:`, err.message);
    return null; // 실패 시 기존 getSystemPrompt() 폴백
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

// ─── [Week 1: SOUL 흡수] ───────────────────────────────────────────────
function loadSoulContext() {
  const files = ['MYCREW.md', 'IDENTITY.md'];
  const parts = [];
  for (const f of files) {
    try {
      // 1) Root 검색을 위해 상위 이동 적용 (아리 엔진 cwd가 하위 경로이므로)
      let p = path.resolve(process.cwd(), '../../', f);
      if (!fs.existsSync(p)) p = path.resolve(process.cwd(), f);
      
      if (fs.existsSync(p)) {
        parts.push(fs.readFileSync(p, 'utf-8').slice(0, 2000));
      }
    } catch (e) {
      // Ignore
    }
  }
  return parts.join('\n---\n');
}

class Executor {
  async run(taskContent, preEvaluated = null, agentId = 'ari') {
    console.log(`[Executor] 작업 시작: ${taskContent} (Assigned To: ${agentId})`);

    // 0. 🚨 System Shield (Layer 3 Infra Guard) 발동 여부 검사
    const shieldBlock = systemShieldSkill.applyShield(taskContent, agentId);
    if (shieldBlock) {
      return shieldBlock; // 즉시 API 호출 중단 및 차단 메시지 반환
    }

    // ── Intent Mapping Gate ──────────────────────────────────────────────────
    // 일상어 승인 감지 & PENDING Task 존재 확인 (오탐 방지 이중 잠금)
    if (isApprovalIntent(taskContent)) {
      const pendingTask = await dbManager.getFirstPendingTask();
      if (pendingTask) {
        console.log(`[Executor] ✅ 승인 인텐트 감지 → 보류 Task #${pendingTask.id} RESUME 처리`);
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
    let modelToUse = evaluation.recommended_model || 'gemini-3-flash-preview';
    let actualContent = taskContent;

    if (taskContent.includes('--pro') || taskContent.includes('--deep')) {
      modelToUse = 'gemini-3.1-pro-preview';
      actualContent = taskContent.replace(/--pro|--deep/g, '').trim();
    } else if (taskContent.includes('--flash') || taskContent.includes('--lite')) {
      modelToUse = 'gemini-3-flash-preview';
      actualContent = taskContent.replace(/--flash|--lite/g, '').trim();
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

    // 3. 🚨 스킬 장착 권한 검증 (Phase B) 🚨
    const BUILTIN_CATEGORIES = ['QUICK_CHAT', 'DEEP_WORK', 'ROUTING'];
    if (!BUILTIN_CATEGORIES.includes(evaluation.category)) {
      try {
        const activeSkills = await dbManager.getAgentSkills(agentId);
        
        // Category -> skillId 매핑 (evaluation.category는 대문자, skillId는 소문자 기반)
        const categoryMap = {
          'MARKETING': 'marketing',
          'CONTENT': 'content',
          'DESIGN': 'design',
          'ANALYSIS': 'analysis',
          'KNOWLEDGE': 'research',
          'MEDIA': 'design' // 임시 맵핑
        };
        const requiredSkillId = categoryMap[evaluation.category];

        if (requiredSkillId) {
          // 장착 여부 확인
          const isEquipped = activeSkills.some(s => s.skill_id === requiredSkillId && s.is_active === 1);
          if (!isEquipped) {
            console.warn(`[Executor] 권한 방어벽 발동: ${agentId}는 ${requiredSkillId} 스킬이 없습니다.`);
            return {
              text: `🔒 보안 알림: 저(${agentId})는 현재 이 요청을 수행할 수 있는 스킬(\`${requiredSkillId}\`)을 장착하지 않았습니다. 원활한 수행을 위해 대시보드 프로필에서 필요한 스킬 스위치를 **ON(활성화)** 해주세요!`,
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

    // 4. 라우터를 통해 적절한 스킬(전용 프롬프트) 선택
    const skill = router.route(actualContent, evaluation.category);
    let systemPrompt = loadSkillDocument(evaluation.category);
    if (!systemPrompt) {
      systemPrompt = skill.getSystemPrompt(); // 기존 Fallback 보장
    }

    // [Week 1: SOUL 흡수] 시스템 프롬프트 최상단에 영구 기억(SOUL) 강제 주입
    const soulContext = loadSoulContext();
    const finalSystemPrompt = soulContext.trim() !== '' 
      ? `[GLOBAL ENTITY/SOUL CONTEXT]\n${soulContext}\n\n[TASK INSTRUCTIONS]\n${systemPrompt}`
      : systemPrompt;

    try {
      console.log(`[Executor] 투입 모델: ${modelToUse}, 카테고리: ${evaluation.category}`);

      // 5. 어댑터를 통해 실행
      const result = await geminiAdapter.generateResponse(actualContent, finalSystemPrompt, modelToUse);

      console.log(`[Executor] 작업 완료 성공 (사용모델: ${result.model})`);

      // [Week 2: Self-Learning 흡수] - 성공적인 응답을 SKILL.md에 로깅하여 자가성장 유도
      if (result.text && evaluation.score >= 0.8) {
        const SKILL_PATH_MAP = {
          'MARKETING':  'skill-library/02_marketing/SKILL.md',
          'CONTENT':    'skill-library/03_content/SKILL.md',
          'ANALYSIS':   'skill-library/04_analysis/SKILL.md',
          'DESIGN':     'skill-library/05_design/SKILL.md',
          'ROUTING':    'skill-library/01_routing/SKILL.md',
          'KNOWLEDGE':  'skill-library/06_research/SKILL.md',
        };
        const activeSkillPath = SKILL_PATH_MAP[evaluation.category];
        if (activeSkillPath) {
          try {
            const fullSkillPath = path.resolve(process.cwd(), activeSkillPath);
            if (fs.existsSync(fullSkillPath)) {
              // LLM 평가 사유에도 기밀(회사명 등)이 있을 수 있으므로 Regex Scrubbing 적용
              const scrubbedReason = scrubber.sanitize(evaluation.reason || '패턴화됨');
              const logEntry = `\n### [${new Date().toISOString().slice(0,10)}] Self-Learning Pattern 🧠\n` +
                `- **패턴**: [${evaluation.category}] ${scrubbedReason}\n` +
                `- **모델**: ${result.model}\n` +
                `- **카테고리**: ${evaluation.category}\n` +
                `- **스코어**: ${evaluation.score}\n`;
              fs.appendFileSync(fullSkillPath, logEntry);
              console.log(`[Self-Learning] 성공 패턴 캡슐화 완료: ${activeSkillPath}`);
            }
          } catch(err) {
            console.warn('[Self-Learning] 스킬 파일 자동 기록 실패:', err.message);
          }
        }
      }

      return {
        text: result.text,
        model: result.model,
        category: evaluation.category,
        score: evaluation.score,
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
}

export default new Executor();

