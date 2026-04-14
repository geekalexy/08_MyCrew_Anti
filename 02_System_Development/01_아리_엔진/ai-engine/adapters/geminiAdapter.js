import { GoogleGenAI } from '@google/genai';

class GeminiAdapter {
    constructor() {
        this.ai = null;
        this._initClient();
    }

    _initClient() {
        const apiKey = process.env.GEMINI_API_KEY;
        if (apiKey && apiKey !== 'undefined') {
            this.ai = new GoogleGenAI(apiKey);
        } else {
            console.warn("⚠️ [GeminiAdapter] API Key가 아직 로드되지 않았거나 유효하지 않습니다.");
        }
    }

    /**
     * 제미나이 모델을 사용하여 응답을 생성합니다.
     * @param {string} userPrompt 사용자 입력
     * @param {string} systemPrompt 시스템 페르소나/지시사항
     * @param {string} modelName 사용할 모델 (기본: gemini-3-flash-preview)
     */
    async generateResponse(userPrompt, systemPrompt, modelName = 'gemini-3-flash-preview') {
        try {
            if (!this.ai) {
                this._initClient();
                if (!this.ai) throw new Error("GEMINI_API_KEY를 찾을 수 없습니다. .env 파일을 확인해주세요.");
            }

            console.log(`[Gemini Adapter] 스킬 실행 중... (Model: ${modelName})`);
            
            // @google/genai 패키지의 모델 호출 방식 (models.generateContent)
            const response = await this.ai.models.generateContent({
                model: modelName,
                contents: userPrompt,
                config: {
                    systemInstruction: systemPrompt,
                    temperature: 0.7
                }
            });

            return {
                text: response.text,
                model: modelName.includes('pro') ? 'Gemini Pro' : 'Gemini Flash'
            };
        } catch (error) {
            console.error('[Gemini Adapter] 오류 발생:', error);
            throw new Error(`Gemini 오류: ${error.message}`);
        }
    }
}

export default new GeminiAdapter();
