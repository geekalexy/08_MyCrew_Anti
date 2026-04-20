import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import keyProvider from '../tools/keyProvider.js';
import requestQueue from '../tools/requestQueue.js';

class GeminiAdapter {
    constructor() {
        this.ai = null;
    }

    async _ensureClient() {
        if (this.ai) return;
        
        const apiKey = await keyProvider.getKey('GEMINI_API_KEY');
        if (apiKey && apiKey !== 'undefined') {
            this.ai = new GoogleGenAI(apiKey);
        } else {
            console.warn("⚠️ [GeminiAdapter] API Key가 아직 등록되지 않았습니다. 온보딩 혹은 .env를 확인해주세요.");
        }
    }

    async _switchToBackupKey() {
        console.warn("🔄 [GeminiAdapter] 메인 API 제한(429/503) 도달. 예비 키(GEMINI_API_KEY_2)로 스위칭 시도...");
        const backupKey = process.env.GEMINI_API_KEY_2;
        if (backupKey && backupKey !== 'undefined') {
            this.ai = new GoogleGenAI(backupKey);
            console.log("✅ [GeminiAdapter] 예비 키로 갱신 완료.");
            return true;
        }
        console.warn("❌ [GeminiAdapter] 예비 키가 등록되어 있지 않습니다. 실패.");
        return false;
    }

    /**
     * 제미나이 모델을 사용하여 응답을 생성합니다.
     */
    async generateResponse(userPrompt, systemPrompt, modelName = 'gemini-2.5-flash') {
        await this._ensureClient();
        if (!this.ai) throw new Error("GEMINI_API_KEY를 찾을 수 없습니다.");

        return requestQueue.enqueue(async () => {
            try {
                console.log(`[Gemini Adapter] 스킬 실행 중... (Model: ${modelName})`);
                
                // @google/genai 패키지의 모델 호출 방식 (models.generateContent)
                let response;
                try {
                    response = await this.ai.models.generateContent({
                        model: modelName,
                        contents: userPrompt,
                        config: {
                            systemInstruction: systemPrompt,
                            temperature: 0.7
                        }
                    });
                } catch (firstErr) {
                    // 제한에 걸렸을 경우(429/500/503 등) Backup 키로 재시도
                    if (firstErr.message?.includes('429') || firstErr.message?.includes('Quota') || firstErr.status === 429) {
                        const switched = await this._switchToBackupKey();
                        if (switched) {
                            response = await this.ai.models.generateContent({
                                model: modelName,
                                contents: userPrompt,
                                config: { systemInstruction: systemPrompt, temperature: 0.7 }
                            });
                        } else {
                            throw firstErr; // 예비 키 실패 시 원본 에러 던짐 -> 라우터단에서 Flash 모델로 우회
                        }
                    } else {
                        throw firstErr;
                    }
                }

                return {
                    text: response.text,
                    model: modelName.includes('pro') ? 'Gemini 3.1 Pro' : 'Gemini 3 Flash',
                    tokenUsage: response.usageMetadata?.totalTokenCount || 0
                };
            } catch (error) {
                console.error('[Gemini Adapter] 오류 발생:', error);
                throw new Error(`Gemini 오류: ${error.message}`);
            }
        });
    }

    /**
     * [Image Lab] 이미지를 분석하여 7항목 JSON을 추출합니다.
     */
    async analyzeImage(imagePath, systemPrompt) {
        await this._ensureClient();
        if (!this.ai) throw new Error("GEMINI_API_KEY를 찾을 수 없습니다.");

        return requestQueue.enqueue(async () => {
            try {
                console.log(`[Gemini Adapter] 이미지 분석 중... (Model: gemini-2.5-flash)`);
                
                const imageData = fs.readFileSync(imagePath);
                const base64Image = imageData.toString('base64');

                const response = await this.ai.models.generateContent({
                    model: 'gemini-2.5-flash',
                    contents: [
                        { text: "이 이미지를 분석해서 정해진 JSON 형식으로 출력하세요." },
                        {
                            inlineData: {
                                data: base64Image,
                                mimeType: 'image/jpeg'
                            }
                        }
                    ],
                    config: {
                        systemInstruction: systemPrompt,
                        temperature: 0.2, // 분석 정확도를 위해 낮게 조정
                        responseMimeType: 'application/json'
                    }
                });

                return {
                    text: response.text,
                    model: 'Gemini 3.0 Flash (Vision)'
                };
            } catch (error) {
                console.error('[Gemini Adapter] 이미지 분석 오류:', error);
                throw new Error(`Vision 오류: ${error.message}`);
            }
        });
    }
}

export default new GeminiAdapter();
