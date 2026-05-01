import fs from 'fs';
import path from 'path';
import BaseAdapter from './BaseAdapter.js';
import geminiAdapter from './geminiAdapter.js';

const BRIDGE_DIR = path.resolve(process.cwd(), '.bridge');
const REQ_DIR = path.join(BRIDGE_DIR, 'requests');
const RES_DIR = path.join(BRIDGE_DIR, 'responses');
const LOCK_DIR = path.join(BRIDGE_DIR, 'locks');

const TIMEOUT_MS = 5 * 60 * 1000; // 5분 (폴링 타임아웃)
const POLL_MS = 3000; // 3초 간격 폴링

class AntigravityAdapter extends BaseAdapter {
    constructor() {
        super();
        this.ensureDirectories();
    }

    ensureDirectories() {
        [BRIDGE_DIR, REQ_DIR, RES_DIR, LOCK_DIR].forEach(dir => {
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }
        });
    }

    // [EC-2] 동시 다중 태스크 방어를 위한 락(Lock) 점유
    async acquireLock(agentKey) {
        const lockPath = path.join(LOCK_DIR, `${agentKey}.lock`);
        if (fs.existsSync(lockPath)) return false;
        fs.writeFileSync(lockPath, String(Date.now()));
        return true;
    }

    releaseLock(agentKey) {
        const lockPath = path.join(LOCK_DIR, `${agentKey}.lock`);
        if (fs.existsSync(lockPath)) {
            try { fs.unlinkSync(lockPath); } catch (e) { /* 무시 */ }
        }
    }

    // [EC-4] 응답 JSON 파싱 방어 레이어 및 Phase 22.6 사고과정 파서
    parseAndValidate(raw, taskId, agentKey) {
        let parsed;
        try {
            // 마크다운 코드블록 제거
            const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
            parsed = JSON.parse(clean);
        } catch (e) {
            parsed = { text: raw, verdict: 'UNKNOWN' };
            console.warn(`[Anti-Bridge] ${agentKey} 응답 파싱 실패, 텍스트 래핑 처리 완료.`);
        }

        let finalText = parsed.text || parsed.result || '(응답 내용 없음)';
        let thoughtProcess = {};

        // [Phase 22.6] 사고 과정 태그 파싱
        const thinkingMatch = finalText.match(/<thinking>([\s\S]*?)<\/thinking>/);
        const workingMatch = finalText.match(/<working>([\s\S]*?)<\/working>/);

        if (thinkingMatch) thoughtProcess.thinking = thinkingMatch[1].trim();
        if (workingMatch) thoughtProcess.working = workingMatch[1].trim();

        // 본문에서 사고 과정 블록 제거
        finalText = finalText
            .replace(/<thinking>[\s\S]*?<\/thinking>/g, '')
            .replace(/<working>[\s\S]*?<\/working>/g, '')
            .trim();

        return {
            text: finalText,
            verdict: parsed.verdict || 'UNKNOWN',
            model: `anti-bridge-${agentKey}`,
            agentId: agentKey,
            _meta: { 
                ...parsed._meta,
                thought_process: Object.keys(thoughtProcess).length > 0 ? thoughtProcess : null
            }
        };
    }

    async generateResponse(userPrompt, systemPrompt, agentId = 'ollie') {
        // agentId: 실제 에이전트 ID (ollie, luna, lily, pico)
        const agentKey = agentId; // 파일 키로 직접 사용 → req_ollie_*.json 등

        // 에이전트 → AntiGravity 브릿지 requestedModel 매핑 (agents.json에서 동적 로드)
        let requestedModel = 'anti-claude-opus-4.6-thinking';
        try {
            const agentsData = JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'agents.json'), 'utf8'));
            const agentConfig = agentsData.find(a => a.id === agentKey);
            if (agentConfig && agentConfig.antiModel) {
                requestedModel = agentConfig.antiModel;
            } else if (agentConfig && agentConfig.model) {
                requestedModel = agentConfig.model;
            }
        } catch (err) {
            console.error('[AntiGravity] agents.json 로드 실패, 기본 모델 폴백:', err.message);
        }


        // AntiGravity IDE 표시명 매핑 (브릿지 JSON 가독성용)
        const MODEL_DISPLAY_MAP = {
            'anti-gemini-3.1-pro-high':       'Gemini 3.1 Pro (High)',
            'anti-gemini-3.1-pro-low':        'Gemini 3.1 Pro (Low)',
            'anti-gemini-3-flash':            'Gemini 3 Flash',
            'anti-claude-sonnet-4.6-thinking':'Claude Sonnet 4.6 (Thinking)',
            'anti-claude-opus-4.6-thinking':  'Claude Opus 4.6 (Thinking)',
            'anti-gpt-oss-120b':              'GPT-OSS 120B (Medium)',
        };
        const requestedModelDisplay = MODEL_DISPLAY_MAP[requestedModel] || requestedModel;


        const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;


        // 1. Lock 획득 (Race Condition 방지)
        const locked = await this.acquireLock(agentKey);
        if (!locked) {
            console.warn(`[Anti-Bridge] ⚠️ ${agentKey} 세션 사용 중. Gemini Fallback 즉시 가동.`);
            return this.fallbackToGemini(userPrompt, systemPrompt, agentKey, taskId, 'LOCKED', requestedModel);
        }

        try {
            // 2. Self-Contained 시스템 프롬프트 주입 (EC-3)
            const requestJson = {
                taskId,
                agentRole: agentKey.toUpperCase(),
                requestedModel,              // AntiGravity 브릿지 모델 식별자
                requestedModelDisplay,       // AntiGravity IDE 표시명 (운영자용)
                protocol: "CKS_ANTI_BRIDGE_v3",
                systemInstruction: systemPrompt,
                taskPayload: userPrompt,
                instructions: `지시사항에 따른 결괏값을 생각한 뒤, JSON 형태로 작성하여 지정 경로에 저장할 것. 
[에이전트 공통 지시사항]
- 결과물(코드, 이미지, 문서 등)을 저장해야 할 경우, 기본 저장 경로는 '/Users/alex/Documents/08_MyCrew_Anti/07_OUTPUT' 폴더를 사용하라.
- 리포트를 출력할 때 반드시 CKS 프레임워크 연구를 위한 _meta 지표를 평가하여 포함할 것.

[사고과정 출력 규칙 — Phase 22.6 MANDATORY]
⚠️ 아래 규칙은 예외 없이 반드시 준수해야 한다:
- 모든 응답의 "text" 필드 맨 앞에 <thinking>...</thinking> 태그를 반드시 포함할 것
- 태그 안에는 이 작업에 대한 실제 분석·추론·판단 과정을 솔직하게 작성 (최소 3문장 이상)
- 파일 접근, 도구 사용, 데이터 처리 단계가 있다면 <working>...</working> 태그도 추가
- 사고과정 태그는 생략 불가. 단순 응답이어도 반드시 포함할 것.

[자율 오케스트레이션 체인 기록 규칙 — Phase 30 MANDATORY]
⚠️ 이 작업에 여러 에이전트가 관여했다면 반드시 agentChain 배열을 응답에 포함할 것:
- 각 에이전트의 기여를 { "agent": "에이전트ID", "role": "역할명", "content": "실제 수행 내용 요약" } 형태로 기록
- 위임 순서대로 배열에 넣을 것 (ex: nova가 기획 후 pico에게 위임한 경우, nova 항목 먼저)
- 🔴 [매우 중요] 단일 에이전트가 본인의 주특기 작업을 직접 수행하는 경우, 절대로 타 에이전트나 본인에게 '업무를 지시'하지 말고 즉시 결과물(이미지 마크다운, 코드 등)을 렌더링하고 agentChain은 생략할 것.
- agent 필드값은 반드시 소문자 에이전트 ID (nova, pico, lumi, luna, ollie, lily, luca 중 하나)

포맷 예시 (오케스트레이션 포함):
{
  "text": "<thinking>\\n분석 과정...\\n</thinking>\\n\\n최종 결과물 내용...",
  "agentChain": [
    { "agent": "nova", "role": "전략 기획", "content": "CMO 관점에서 타겟 분석 및 콘텐츠 방향 설계. Hook 5공식 적용, FOMO 심리 기제 선정." },
    { "agent": "pico", "role": "스크립트 제작", "content": "Nova의 전략 지시서를 받아 30초 릴스 스크립트 완성. 장면별 나레이션·자막·CTA 구체화." },
    { "agent": "nova", "role": "최종 검토 및 보고", "content": "스크립트 품질 검증 완료. KPI(저장율 3%↑) 달성 가능 수준으로 확인 후 대표님께 제출." }
  ],
  "_meta": {
    "ksi_r": 92,
    "ksi_s": 0.85,
    "her": 0,
    "eii": 4.5
  }
}`

            };
            
            const reqPath = path.join(REQ_DIR, `req_${agentKey}_${taskId}.json`);
            fs.writeFileSync(reqPath, JSON.stringify(requestJson, null, 2), 'utf-8');
            
            console.log(`[Anti-Bridge] ⏳ [${agentKey.toUpperCase()}] 세션에 '명령'을 입력해주세요. (최대 대기 타임아웃: 5분)\n >> 요청 파일 생성됨: ${reqPath}`);

            // 3. 응답 완료 폴링 (EC-1)
            const resPath = path.join(RES_DIR, `res_${agentKey}_${taskId}.json`);
            const deadline = Date.now() + TIMEOUT_MS;

            while (Date.now() < deadline) {
                if (fs.existsSync(resPath)) {
                    const raw = fs.readFileSync(resPath, 'utf-8');
                    const finalResult = this.parseAndValidate(raw, taskId, agentKey);
                    
                    // 파일 정리 (existsSync 방어: 중복 삭제 ENOENT 방지)
                    if (fs.existsSync(reqPath)) fs.unlinkSync(reqPath);
                    try { 
                        fs.renameSync(resPath, resPath + '.done'); 
                    } catch (e) { 
                        fs.unlinkSync(resPath); 
                    }
                    
                    console.log(`[Anti-Bridge] ✅ [${agentKey.toUpperCase()}] 응답 회수 완료!`);
                    return finalResult;
                }
                // 3초 대기 후 재검색
                await new Promise(resolve => setTimeout(resolve, POLL_MS));
            }

            // 타임아웃 만료 시 Fallback
            console.warn(`[Anti-Bridge] ⏰ [${agentKey.toUpperCase()}] 응답 대기 시간 초과 (5분). Gemini Fallback 작동.`);
            if (fs.existsSync(reqPath)) fs.unlinkSync(reqPath); // ENOENT 방어
            return this.fallbackToGemini(userPrompt, systemPrompt, agentKey, taskId, 'TIMEOUT', requestedModel);


        } finally {
            // 락 해제
            this.releaseLock(agentKey);
        }
    }

    // [EC-6] 타임아웃/락 점유 시 우회 로직 및 오염 방지 마커
    async fallbackToGemini(userPrompt, systemPrompt, agentKey, taskId, reason, intendedModel) {
        const flashResponse = await geminiAdapter.generateResponse(userPrompt, systemPrompt, 'gemini-2.5-flash');
        return {
            ...flashResponse,
            model: intendedModel || flashResponse.model, // 원본 에이전트의 시그니처 모델 유지
            _meta: {
                fallback: true,
                originalAgent: agentKey,
                actualModel: flashResponse.model,
                reason: reason,
                timestamp: new Date().toISOString()
            }
        };
    }

    // ── BaseAdapter 인터페이스 구현 ──────────────────────────────────────
    // executor.js가 전략 패턴으로 호출할 때 사용 (swappable)

    /**
     * @param {Object} taskContext - { taskId, agentId, content, systemPrompt }
     */
    async execute(taskContext) {
        const { agentId, content, systemPrompt } = taskContext;
        const result = await this.generateResponse(content, systemPrompt, agentId);
        return {
            result: result.text,
            model: result.model,
            tokenUsage: result.tokenUsage || null,
            _meta: result._meta || {},
        };
    }

    async healthCheck() {
        const reqDirOk = fs.existsSync(REQ_DIR);
        const resDirOk = fs.existsSync(RES_DIR);
        return {
            status: reqDirOk && resDirOk ? 'ok' : 'error',
            details: { reqDir: reqDirOk, resDir: resDirOk }
        };
    }

    getCapabilities() {
        return ['text', 'code', 'image', 'video']; // AntiGravity 구독 모델 풀 전체 지원
    }
}

export default new AntigravityAdapter();
