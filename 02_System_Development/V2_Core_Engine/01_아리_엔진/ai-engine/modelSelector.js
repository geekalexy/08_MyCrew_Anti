import geminiAdapter from './adapters/geminiAdapter.js';
import { MODEL, VALID_MODELS } from './modelRegistry.js';

const LOCAL_QUICK_PATTERNS = [
  /^.{0,5}$/,                                    // 5자 이하 단답
  /^(안녕|하이|반가워|hello|hi|hey)/i,             // 인사
  /^(고마워|감사|thx|thanks)/i,                    // 감사
  /^(어때|뭐해|심심|잘|좋아)/i,                    // 일상
];

class ModelSelector {
    /**
     * 사용자의 지시를 분석하여 최적의 수행 모드를 결정합니다.
     * @param {string} taskContent 
     * @returns {Object} { recommended_model, score, reason, category }
     */
    async selectModel(taskContent) {
        // 로컬 프리필터: LLM 호출 없이 즉시 판정하여 API 비용 및 속도 최적화
        if (LOCAL_QUICK_PATTERNS.some(p => p.test(taskContent.trim()))) {
            console.log(`[ModelSelector] 로컬 프리필터 통과: QUICK_CHAT`);
            return {
                recommended_model: MODEL.FLASH,
                score: 1,
                reason: 'Local classifier',
                category: 'QUICK_CHAT'
            };
        }

        try {
            const systemPrompt = `당신은 대표님의 비서실장으로서, 유입되는 요청의 복잡도와 전문 분야를 분석하여 최적의 에이전트 라우팅 전략을 결정하는 전략가입니다.
            현재 대표님은 **울트라(Ultra) 구독자**이므로, 최고 수준의 지식과 추론을 제공해야 합니다.
            
[분석 카테고리 - 9가지]
1. QUICK_CHAT: 일상 대화, 인사, 간단한 질문, 승인/거절, *워크스페이스 보드 관리(태스크/카드 생성수정/이동)*, 1:1 비서 대응 업무.
2. KNOWLEDGE: 지식 검색, 옵시디언/웹 자료 조회, 내용 요약, 리서치 요청.
3. DEEP_WORK: 코드 수정, 프로그래밍, 터미널 작업, 시스템 설계, 복잡한 디버깅.
4. MARKETING: SNS 콘텐츠 기획, 릴스/쇼츠 전략, Hook 설계, 마케팅 캠페인 기획, 카피라이팅 전략.
5. CONTENT: 인스타 캡션 작성, 릴스 대본, 유튜브 스크립트, 캐러셀 문구, 블로그 포스팅, 해시태그.
6. DESIGN: 비주얼 디자인 기획, AI 이미지/영상 프롬프트(미드저니/Veo), 썸네일, 플랫폼 규격.
7. ANALYSIS: SNS KPI 분석, 성과 리포트, 경쟁사 역설계, A/B 테스트, 트렌드 데이터 분석.
8. MEDIA: 이미지·영상 AI 생성, 미디어 에셋 프롬프트 엔지니어링 전용.
9. WORKFLOW: *실제 문서/에셋 초안을 만드는 다수 에이전트 간 논의/합성 (태스크 보드 이동 자체는 WORKFLOW가 아님)*.

[모델 배정 원칙 (v4.7 울트라 구독 기준)]
- QUICK_CHAT, MARKETING, CONTENT, DESIGN: 'gemini-2.5-flash' (최신 초고속/경량 모델)
- KNOWLEDGE, ANALYSIS, DEEP_WORK, WORKFLOW: 'gemini-2.5-pro' (최신 고성능 추론 모델)

당신의 분석 결과를 오직 다음 JSON 형식으로만 응답하시오. 다른 말은 절대 금지:
결과 예시: { "recommended_model": "gemini-2.5-pro", "score": 10, "reason": "심층 분석 및 복잡한 추론이 필요하므로 고성능 프로 티어 모델 배정", "category": "DEEP_WORK" }`;

            const userPrompt = `다음 요청의 의도를 분석하고 최적의 모드를 추천하세요: "${taskContent}"`;
            
            // 분석 작업은 항상 빠르고 저렴한 Flash를 사용합니다. (modelRegistry.js에서 중앙 관리)
            const result = await geminiAdapter.generateResponse(userPrompt, systemPrompt, MODEL.CLASSIFIER);
            
            // JSON 응답 정제 및 파싱
            const cleanJson = result.text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            
            // Validation Layer (환각 방지) — VALID_MODELS는 modelRegistry.js에서 중앙 관리
            // [Phase 32] DOGFOODING 추가 — Prime 27th Review 판정 #4 (TEXT 컬럼, ENUM 없음, 직접 삽입 가능)
            const VALID_CATEGORIES = ['QUICK_CHAT', 'KNOWLEDGE', 'DEEP_WORK', 'MARKETING', 'CONTENT', 'DESIGN', 'ANALYSIS', 'MEDIA', 'ROUTING', 'WORKFLOW', 'DOGFOODING'];
            
            const validated = {
                recommended_model: VALID_MODELS.includes(parsed.recommended_model) ? parsed.recommended_model : MODEL.FLASH,
                category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'QUICK_CHAT',
                score: Math.min(10, Math.max(1, parseInt(parsed.score) || 1)),
                reason: parsed.reason || 'auto-classified'
            };
            
            console.log(`[ModelSelector] 분석 결과: ${validated.category} (Score: ${validated.score}) -> ${validated.recommended_model}`);
            return validated;
        } catch (error) {
            console.error('[ModelSelector] 분석 중 오류 발생, 기본 모델로 회귀:', error);
            return { 
                recommended_model: MODEL.FLASH, 
                score: 1, 
                reason: '자가 진단 시스템 오류로 기본 모델 사용', 
                category: 'QUICK_CHAT' 
            };
        }
    }

    /**
     * [Phase 39] Zero-Command Router
     * 모드를 명시적으로 선택하지 않고 텍스트만 입력했을 때, 문맥을 파악해 적절한 모드를 자동 할당합니다.
     */
    async routeZeroCommand(taskContent) {
        // 너무 짧거나 일상 대화인 경우 LLM 호출 없이 바로 통과 (비용 절감)
        if (LOCAL_QUICK_PATTERNS.some(p => p.test(taskContent.trim()))) {
            return 'NONE';
        }

        try {
            const systemPrompt = `당신은 초경량 인텐트 라우터입니다.
            사용자의 입력 텍스트를 분석하여, 다음 4가지 모드 중 가장 적합한 하나를 고르거나 해당하는 것이 없으면 NONE을 반환하세요.
            
            [모드 정의]
            1. ARCHITECT (기획 모드): 기능 정의, 스코프 분석, 전체 아키텍처 설계, "기획해줘", "구조 잡아줘"
            2. DEV (개발 모드): 실제 코드 작성 및 구현, "만들어줘", "추가해줘", "개발해줘", 기능 단위의 코딩
            3. QA (리뷰 모드): 완성된 코드 검토, 테스트 작성, "리뷰해줘", "최적화해줘", 보안 검토
            4. DEBUG (디버깅 모드): 에러/버그 해결, "에러 나", "안 돌아가", "고쳐줘", 로그 분석
            
            오직 다음 JSON 형식으로만 응답하시오:
            { "inferred_mode": "ARCHITECT" | "DEV" | "QA" | "DEBUG" | "NONE", "reason": "짧은 판단 이유" }`;

            const userPrompt = `다음 요청의 의도를 분석하고 최적의 모드를 추천하세요: "${taskContent}"`;
            
            const result = await geminiAdapter.generateResponse(userPrompt, systemPrompt, MODEL.FLASH);
            
            const cleanJson = result.text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            
            const VALID_MODES = ['ARCHITECT', 'DEV', 'QA', 'DEBUG', 'NONE'];
            const inferred_mode = VALID_MODES.includes(parsed.inferred_mode) ? parsed.inferred_mode : 'NONE';
            
            console.log(`[Zero-Command Router] 의도 분석: ${inferred_mode} (사유: ${parsed.reason})`);
            return inferred_mode;
        } catch (error) {
            console.error('[Zero-Command Router] 분석 중 오류 발생, NONE으로 회귀:', error);
            return 'NONE';
        }
    }
}

export default new ModelSelector();
