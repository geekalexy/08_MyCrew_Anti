import fs from 'fs';
import path from 'path';
import geminiAdapter from './geminiAdapter.js';

const BRIDGE_DIR = path.resolve(process.cwd(), '.bridge');
const REQ_DIR = path.join(BRIDGE_DIR, 'requests');
const RES_DIR = path.join(BRIDGE_DIR, 'responses');
const LOCK_DIR = path.join(BRIDGE_DIR, 'locks');

const TIMEOUT_MS = 5 * 60 * 1000; // 5분 (폴링 타임아웃)
const POLL_MS = 3000; // 3초 간격 폴링

class AntigravityAdapter {
    constructor() {
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

    // [EC-4] 응답 JSON 파싱 방어 레이어
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

        return {
            text: parsed.text || parsed.result || '(응답 내용 없음)',
            verdict: parsed.verdict || 'UNKNOWN',
            model: `anti-bridge-${agentKey}`,
            agentId: agentKey,
            _meta: { ...parsed._meta }
        };
    }

    async generateResponse(userPrompt, systemPrompt, modelName = 'anti-bridge-prime') {
        const agentKey = modelName.replace('anti-bridge-', ''); // 'prime' 또는 'nexus'
        const taskId = `task_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

        // 1. Lock 획득 (Race Condition 방지)
        const locked = await this.acquireLock(agentKey);
        if (!locked) {
            console.warn(`[Anti-Bridge] ⚠️ ${agentKey} 세션 사용 중. Gemini Fallback 즉시 가동.`);
            return this.fallbackToGemini(userPrompt, systemPrompt, agentKey, taskId, 'LOCKED');
        }

        try {
            // 2. Self-Contained 시스템 프롬프트 주입 (EC-3)
            const requestJson = {
                taskId,
                agentRole: agentKey.toUpperCase(),
                protocol: "CKS_ANTI_BRIDGE_v3",
                systemInstruction: systemPrompt,
                taskPayload: userPrompt,
                instructions: `지시사항에 따른 결괏값을 생각한 뒤, JSON 형태로 작성하여 지정 경로에 저장할 것. 리포트를 출력할 때 반드시 CKS 프레임워크 연구를 위한 _meta 지표를 평가하여 포함할 것.
포맷 예시:
{
  "text": "...최종 리포트 결과...",
  "_meta": {
    "ksi_r": 92,     // (0-100) 이전 스프린트 룰이나 가이드라인 반영률
    "ksi_s": 0.85,   // (0.0-1.0) 텍스트 문맥 동기화 완성도
    "her": 0,        // 오류 혹은 룰 위반 지적/차단 건수
    "eii": 4.5       // (1.0-5.0) 단순 명령을 넘어서 발휘된 창의적 파생 점수
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
                    
                    // 파일 정리
                    fs.unlinkSync(reqPath);
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
            fs.unlinkSync(reqPath);
            return this.fallbackToGemini(userPrompt, systemPrompt, agentKey, taskId, 'TIMEOUT');

        } finally {
            // 락 해제
            this.releaseLock(agentKey);
        }
    }

    // 타임아웃/락 점유 시 우회 로직 및 오염 방지 마커 (EC-6)
    async fallbackToGemini(userPrompt, systemPrompt, agentKey, taskId, reason) {
        // Fallback 시에는 상용 Flash 모델을 사용하여 워크플로우 단절 방지
        const flashResponse = await geminiAdapter.generateResponse(userPrompt, systemPrompt, 'gemini-2.5-flash');
        
        return {
            ...flashResponse,
            _meta: {
                fallback: true,
                originalAgent: agentKey,
                reason: reason,
                timestamp: new Date().toISOString()
            }
        };
    }
}

export default new AntigravityAdapter();
