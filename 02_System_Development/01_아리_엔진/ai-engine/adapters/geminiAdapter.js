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



    /**
     * 제미나이 모델을 사용하여 응답을 생성합니다.
     */
    async generateResponse(userPrompt, systemPrompt, initialModelName = 'gemini-2.5-flash') {
        // ── [구독인증 우선] OAuth 토큰이 유효하면 API Key 없이 직접 호출 ──────────
        try {
            process.env.NO_SERVER = 'true';
            const server = await import('../../server.js');
            const oauthToken = await server.getGoogleOAuthToken?.();
            
            if (oauthToken) {
                console.log(`[GeminiAdapter] 🔐 구독인증 모드로 호출 (${initialModelName})`);
                return await this._generateWithOAuth(oauthToken, initialModelName, userPrompt, systemPrompt);
            } else if (server.hasOAuthSetup && server.hasOAuthSetup()) {
                // 토큰 만료 시 몰래 개인 API Key를 사용하는 것을 원천 차단 (과금 방어)
                throw new Error("🔒 [보안 차단] 구독인증 연결이 해제되었습니다. 의도치 않은 API 요금 과금을 막기 위해 시스템이 작업을 멈췄습니다. 대시보드에서 다시 연결해주세요.");
            }
        } catch (e) { 
            if (e.message.includes('[보안 차단]')) throw e;
            /* 그 외 import 실패 등은 API Key 방식으로 폴백 */ 
        }

        await this._ensureClient();
        if (!this.ai) throw new Error("GEMINI_API_KEY를 찾을 수 없습니다.");


        return requestQueue.enqueue(async () => {
            // [Phase 26] 단일 모델 / 단일 키 정책 (폴백 폐기)
            const fallbackChain = [initialModelName];

            let lastError;
            let retryCount = 0; // 단일 모델당 재시도(Retry) 횟수

            for (let i = 0; i < fallbackChain.length; i++) {
                const currentModel = fallbackChain[i];
                console.log(`[Gemini Adapter] 스킬 실행 시도 중... (Model: ${currentModel}, Retry: ${retryCount})`);
                
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
                        _meta: { fallback: false } 
                    };
                } catch (err) {
                    lastError = err;
                    const isRateLimit = err.message?.includes('429') || err.message?.includes('Quota') || err.status === 429;
                    const isServerError = err.message?.includes('503') || err.status === 503;
                    
                    if (isRateLimit || isServerError) {
                        console.warn(`⚠️ [GeminiAdapter] ${currentModel} 호출 실패 (${err.message})`);
                        
                        // 1. 503/429 등 일시적 오류 시, 1회만 재시도
                        if (retryCount < 1) {
                            console.log(`⏳ [GeminiAdapter] 일시적 과부하 감지. 2초 후 동일 모델(${currentModel}) 재시도...`);
                            await new Promise(r => setTimeout(r, 2000));
                            retryCount++;
                            i--; // 현재 모델 재시도
                            continue;
                        }

                        // 2. 재시도 실패 시 예비 키 폴백 없음 -> 즉시 중단 (과금 방지 원칙)
                        console.error(`❌ [GeminiAdapter] 재시도 실패. 단일 키 정책에 따라 우회(Fallback) 없이 중단합니다.`);
                        throw err;
                    } else {
                        // 권한 오류(400)나 파싱 오류는 즉시 중단
                        throw err;
                    }
                }
            }
            
            // 루프 종료 시 에러
            throw new Error(`Gemini 오류: (${lastError?.message})`);
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
            
            // [Phase 26] 단일 모델 / 단일 키 정책 (Vision도 폴백 폐기)
            const fallbackChain = [MODEL.FLASH];

            for (let i = 0; i < fallbackChain.length; i++) {
                const currentModel = fallbackChain[i];
                console.log(`[Gemini Adapter] 이미지 분석 시도 중... (Model: ${currentModel}, Retry: ${retryCount})`);
                
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
                        
                        // 1. 503/429 등 오류 시 1회 재시도
                        if (retryCount < 1) {
                            console.log(`⏳ [GeminiAdapter] Vision 과부하 감지. 2초 후 동일 모델(${currentModel}) 재시도...`);
                            await new Promise(r => setTimeout(r, 2000));
                            retryCount++;
                            i--; // 현재 모델 재시도
                            continue;
                        }

                        // 2. 재시도 실패 시 예비 키 폴백 없음 -> 즉시 중단
                        console.error(`❌ [GeminiAdapter] Vision 재시도 실패. 단일 키 정책에 따라 우회(Fallback) 없이 중단합니다.`);
                        throw err;
                    } else {
                        throw new Error(`Vision 오류 (${currentModel}): ${err.message}`);
                    }
                }
            }
            
            throw new Error(`Vision 최종 오류: (${lastError?.message})`);
        });
    }
}

export default new GeminiAdapter();
