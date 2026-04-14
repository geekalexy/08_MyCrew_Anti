import geminiAdapter from './adapters/geminiAdapter.js';

class ModelSelector {
    /**
     * 사용자의 지시를 분석하여 최적의 수행 모드를 결정합니다.
     * @param {string} taskContent 
     * @returns {Object} { recommended_model, score, reason, category }
     */
    async selectModel(taskContent) {
        try {
            const systemPrompt = `당신은 대표님의 비서실장으로서, 유입되는 요청의 복잡도와 전문 분야를 분석하여 최적의 에이전트 라우팅 전략을 결정하는 전략가입니다.
            
[분석 카테고리 - 8가지]
1. QUICK_CHAT: 일상 대화, 인사, 간단한 질문, 승인/거절 의사표시.
2. KNOWLEDGE: 지식 검색, 옵시디언/웹 자료 조회, 내용 요약, 리서치 요청.
3. DEEP_WORK: 코드 수정, 프로그래밍, 터미널 작업, 시스템 설계, 복잡한 디버깅.
4. MARKETING: SNS 콘텐츠 기획, 릴스/쇼츠 전략, Hook 설계, 마케팅 캠페인 기획, 카피라이팅 전략.
5. CONTENT: 인스타 캡션 작성, 릴스 대본, 유튜브 스크립트, 캐러셀 문구, 블로그 포스팅, 해시태그.
6. DESIGN: 비주얼 디자인 기획, AI 이미지/영상 프롬프트(미드저니/Veo), 썸네일, 플랫폼 규격.
7. ANALYSIS: SNS KPI 분석, 성과 리포트, 경쟁사 역설계, A/B 테스트, 트렌드 데이터 분석.
8. MEDIA: 이미지·영상 AI 생성, 미디어 에셋 프롬프트 엔지니어링 전용.

[모델 배정 원칙]
- QUICK_CHAT: 'gemini-3-flash-preview' (빠른 응답 우선)
- KNOWLEDGE, ANALYSIS: 'gemini-3.1-pro-preview' (높은 이해력 필요)
- MARKETING, CONTENT, DESIGN, MEDIA: 'gemini-3-flash-preview' (창의적 생성 작업)
- DEEP_WORK: 'claude-sonnet' 또는 'gemini-3.1-pro-preview' (코드/시스템 전문)
- 오직 JSON 형식으로만 응답하세요.

결과 예시: { "recommended_model": "gemini-3-flash-preview", "score": 7, "reason": "릴스 기획 요청으로 NOVA CMO 스킬 발동 필요", "category": "MARKETING" }`;

            const userPrompt = `다음 요청의 의도를 분석하고 최적의 모드를 추천하세요: "${taskContent}"`;
            
            // 분석 작업은 항상 빠르고 저렴한 Flash를 사용합니다.
            const result = await geminiAdapter.generateResponse(userPrompt, systemPrompt, 'gemini-3-flash-preview');
            
            // JSON 응답 정제 및 파싱
            const cleanJson = result.text.replace(/```json|```/g, '').trim();
            const parsed = JSON.parse(cleanJson);
            
            // Validation Layer (환각 방지)
            const VALID_MODELS = ['gemini-3-flash-preview', 'gemini-3.1-pro-preview', 'claude-sonnet'];
            const VALID_CATEGORIES = ['QUICK_CHAT', 'KNOWLEDGE', 'DEEP_WORK', 'MARKETING', 'CONTENT', 'DESIGN', 'ANALYSIS', 'MEDIA', 'ROUTING'];
            
            const validated = {
                recommended_model: VALID_MODELS.includes(parsed.recommended_model) ? parsed.recommended_model : 'gemini-3-flash-preview',
                category: VALID_CATEGORIES.includes(parsed.category) ? parsed.category : 'QUICK_CHAT',
                score: Math.min(10, Math.max(1, parseInt(parsed.score) || 1)),
                reason: parsed.reason || 'auto-classified'
            };
            
            console.log(`[ModelSelector] 분석 결과: ${validated.category} (Score: ${validated.score}) -> ${validated.recommended_model}`);
            return validated;
        } catch (error) {
            console.error('[ModelSelector] 분석 중 오류 발생, 기본 모델로 회귀:', error);
            return { 
                recommended_model: 'gemini-3-flash-preview', 
                score: 1, 
                reason: '자가 진단 시스템 오류로 기본 모델 사용', 
                category: 'QUICK_CHAT' 
            };
        }
    }
}

export default new ModelSelector();
