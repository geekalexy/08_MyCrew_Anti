import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import keyProvider from '../tools/keyProvider.js';
import requestQueue from '../tools/requestQueue.js';
import { PRO_FALLBACK_CHAIN, FLASH_FALLBACK_CHAIN, MODEL } from '../modelRegistry.js';

class GeminiAdapter {
    constructor() {
        this.ai = null;
    }

    // ─── OAuth 토큰으로 Gemini REST API 직접 호출 (구독인증 모드) ──────────────
    async _generateWithOAuth(oauthToken, model, userPrompt, systemPrompt) {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
        const body = {
            contents: [{ role: 'user', parts: [{ text: userPrompt }] }],
            systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
            generationConfig: { temperature: 0.7 },
        };

        const resp = await fetch(url, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${oauthToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
        });

        if (!resp.ok) {
            const errBody = await resp.text();
            throw new Error(`OAuth Gemini API 오류 (${resp.status}): ${errBody}`);
        }

        const data = await resp.json();
        const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const tokens = data?.usageMetadata?.totalTokenCount || 0;
        return { text, model: `${model} (OAuth)`, tokenUsage: tokens, _meta: { fallback: false } };
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
    async generateResponse(userPrompt, systemPrompt, initialModelName = 'gemini-2.5-flash') {
        // ── [구독인증 우선] OAuth 토큰이 유효하면 API Key 없이 직접 호출 ──────────
        try {
            const { getGoogleOAuthToken } = await import('../../server.js');
            const oauthToken = getGoogleOAuthToken?.();
            if (oauthToken) {
                console.log(`[GeminiAdapter] 🔐 구독인증 모드로 호출 (${initialModelName})`);
                return await this._generateWithOAuth(oauthToken, initialModelName, userPrompt, systemPrompt);
            }
        } catch (_) { /* server.js import 실패 시 무시 — API Key 방식으로 폴백 */ }

        await this._ensureClient();
        if (!this.ai) throw new Error("GEMINI_API_KEY를 찾을 수 없습니다.");


        return requestQueue.enqueue(async () => {
            // [Phase 0] 모델 자동 Fallback 체인 (modelRegistry.js의 공식 배열 사용)
            let fallbackChain;
            if (initialModelName.includes('pro')) {
                fallbackChain = PRO_FALLBACK_CHAIN;
            } else if (initialModelName.includes('flash')) {
                fallbackChain = FLASH_FALLBACK_CHAIN;
            } else {
                fallbackChain = [initialModelName];
            }

            let lastError;
            let retryCount = 0; // 단일 모델당 재시도(Retry) 횟수

            for (let i = 0; i < fallbackChain.length; i++) {
                const currentModel = fallbackChain[i];
                console.log(`[Gemini Adapter] 스킬 실행 시도 중... (Model: ${currentModel}, Step: ${i+1}/${fallbackChain.length}, Retry: ${retryCount})`);
                
                try {
                    const response = await this.ai.models.generateContent({
                        model: currentModel,
                        contents: userPrompt,
                        config: {
                            systemInstruction: systemPrompt,
                            temperature: 0.7
                        }
                    });

                    return {
                        text: response.text,
                        model: currentModel.includes('flash') ? 'Gemini 2.5 Flash' : 'Gemini Pro',
                        tokenUsage: response.usageMetadata?.totalTokenCount || 0,
                        _meta: { fallback: (i > 0) } // Fallback 발동 여부 기록
                    };
                } catch (err) {
                    lastError = err;
                    const isRateLimit = err.message?.includes('429') || err.message?.includes('Quota') || err.status === 429;
                    const isServerError = err.message?.includes('503') || err.status === 503;
                    
                    if (isRateLimit || isServerError) {
                        console.warn(`⚠️ [GeminiAdapter] ${currentModel} 호출 실패 (${err.message})`);
                        
                        // 1. 503 등 일시적 오류 시, 동일 모델로 1회 재시도 (2초 대기)
                        if (retryCount < 1) {
                            console.log(`⏳ [GeminiAdapter] 일시적 과부하(503/429) 감지. 2초 후 동일 모델(${currentModel}) 재시도...`);
                            await new Promise(r => setTimeout(r, 2000));
                            retryCount++;
                            i--; // 현재 모델 재시도
                            continue;
                        }

                        // 2. 재시도 실패 및 백업 키 사용 시도
                        if (i === fallbackChain.length - 1) {
                            const switched = await this._switchToBackupKey();
                            if (switched) {
                                retryCount = 0; // 예비 키로 갱신했으므로 카운트 리셋
                                i--; // 현재 모델 재시도
                                continue;
                            }
                        }
                        
                        // 3. 재시도 실패 시 다음 모델로 Fallback 넘어감
                        console.log(`🔄 [GeminiAdapter] 다음 하위 모델로 Fallback 시도 예정...`);
                        retryCount = 0;
                        continue;
                    } else {
                        // 권한 오류(400)나 파싱 오류는 Fallback 없이 즉시 중단
                        throw err;
                    }
                }
            }
            
            // 모든 Fallback 루프가 실패했을 경우
            console.error('[Gemini Adapter] Fallback 체인 최종 실패:', lastError);
            throw new Error(`Gemini 오류: 모든 가용 모델 호출 실패. (${lastError?.message})`);
        });
    }

    /**
     * [Image Lab] 이미지를 분석하여 7항목 JSON을 추출합니다.
     */
    async analyzeImage(imagePath, systemPrompt) {
        await this._ensureClient();
        if (!this.ai) throw new Error("GEMINI_API_KEY를 찾을 수 없습니다.");

        return requestQueue.enqueue(async () => {
            const imageData = fs.readFileSync(imagePath);
            const base64Image = imageData.toString('base64');
            
            let lastError;
            let retryCount = 0; // 단일 모델당 재시도 횟수
            
            // Vision 분석은 Flash 계열이 적합하므로 FLASH_FALLBACK_CHAIN을 기본 사용
            const fallbackChain = FLASH_FALLBACK_CHAIN && FLASH_FALLBACK_CHAIN.length > 0 ? FLASH_FALLBACK_CHAIN : [MODEL.FLASH];

            for (let i = 0; i < fallbackChain.length; i++) {
                const currentModel = fallbackChain[i];
                console.log(`[Gemini Adapter] 이미지 분석 시도 중... (Model: ${currentModel}, Step: ${i+1}/${fallbackChain.length}, Retry: ${retryCount})`);
                
                try {
                    const response = await this.ai.models.generateContent({
                        model: currentModel,
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
                        model: `${currentModel} (Vision)`
                    };
                } catch (err) {
                    lastError = err;
                    const isRateLimit = err.message?.includes('429') || err.message?.includes('Quota') || err.status === 429;
                    const isServerError = err.message?.includes('503') || err.status === 503;
                    
                    if (isRateLimit || isServerError) {
                        console.warn(`⚠️ [GeminiAdapter] Vision 호출 실패 (${currentModel}): ${err.message}`);
                        
                        // 1. 503 등 일시적 오류 시, 2초 대기 후 동일 모델 재시도
                        if (retryCount < 1) {
                            console.log(`⏳ [GeminiAdapter] Vision 과부하 감지. 2초 후 동일 모델(${currentModel}) 재시도...`);
                            await new Promise(r => setTimeout(r, 2000));
                            retryCount++;
                            i--; // 현재 모델 다시
                            continue;
                        }

                        // 2. 재시도 실패 및 백업 키 사용 시도
                        if (i === fallbackChain.length - 1) {
                            const switched = await this._switchToBackupKey();
                            if (switched) {
                                retryCount = 0; // 예비 키로 카운트 리셋
                                i--; // 현재 모델 다시
                                continue;
                            }
                        }
                        
                        // 3. 재시도 실패 시 다음 모델로
                        console.log(`🔄 [GeminiAdapter] 다음 하위 모델로 Fallback 시도...`);
                        retryCount = 0;
                        continue;
                    } else {
                        // 그 외 권한 오류나 기타 오류는 즉시 중단
                        throw new Error(`Vision 오류 (${currentModel}): ${err.message}`);
                    }
                }
            }
            
            console.error('[Gemini Adapter] Vision Fallback 체인 최종 실패:', lastError);
            throw new Error(`Vision 최종 오류: 모든 가용 모델 호출 실패. (${lastError?.message})`);
        });
    }
}

export default new GeminiAdapter();
