/**
 * imageAnalysisService.js — Phase 22 Phase 0 클린업
 *
 * [목적]
 * imageLabRouter가 geminiAdapter를 직접 import하던 의존성을 제거하기 위한
 * 서비스 레이어 추상화. 라우터는 AI 어댑터 구현체를 몰라도 됩니다.
 *
 * [아키텍처]
 * imageLabRouter ──► imageAnalysisService ──► GeminiAdapter (Vision)
 *                    (서비스 레이어)             (어댑터 레이어)
 *
 * 동기 처리 유지 이유:
 * - 분석 결과가 즉시 다음 UI 단계(프롬프트 조립)의 입력값으로 필요
 * - 처리 시간 2~5초 (비동기 큐 투입 대비 오버헤드가 불필요)
 * - 이미지 파일을 메모리에서 직접 읽어야 해서 FilePolling 부적합
 */

import fs from 'fs';
import { GoogleGenAI } from '@google/genai';
import keyProvider from '../tools/keyProvider.js';
import requestQueue from '../tools/requestQueue.js';
import { MODEL } from '../modelRegistry.js';

let _ai = null;

async function _ensureClient() {
  if (_ai) return;
  const key = await keyProvider.getKey('GEMINI_API_KEY');
  if (key) _ai = new GoogleGenAI({ apiKey: key });
}

/**
 * 이미지를 분석하여 구조화된 JSON을 추출합니다.
 * imagePath = null이면 텍스트 전용 생성 (Lumi 크리에이티브 디렉팅용)
 *
 * @param {string|null} imagePath  - 로컬 파일 절대경로 (null이면 텍스트 전용)
 * @param {string} systemPrompt - 분석 지침
 * @param {string} [userText=''] - 텍스트 전용 모드에서 사용하는 사용자 메시지
 * @param {string} [mimeType='image/jpeg'] - 이미지 MIME 타입
 * @returns {{ text: string, model: string }}
 */
export async function analyzeImageForPrompt(imagePath, systemPrompt, userText = '', mimeType = 'image/jpeg') {
  // ── 1순위: 구독인증 OAuth 토큰 (동적 임포트로 자동 갱신 지원 적용) ──
  let oauthToken = null;
  try {
    const { getGoogleOAuthToken } = await import('../../server.js');
    oauthToken = await getGoogleOAuthToken?.();
  } catch (_) { /* 무시 - 폴백 */ }

  if (oauthToken) {
    console.log(`[ImageAnalysisService] 🔐 구독인증 모드 (Model: ${MODEL.FLASH})`);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL.FLASH}:generateContent`;

    let contents;
    if (!imagePath) {
      contents = [{ role: 'user', parts: [{ text: userText || '창의적인 이미지 프롬프트를 생성해주세요.' }] }];
    } else {
      const imageData = fs.readFileSync(imagePath);
      const base64Image = imageData.toString('base64');
      // 업로드된 파일의 실제 MIME 타입 감지 (PNG/WEBP 대응)
      const detectedMime = imagePath.endsWith('.png') ? 'image/png'
                         : imagePath.endsWith('.webp') ? 'image/webp'
                         : mimeType;
      contents = [{
        role: 'user',
        parts: [
          { text: '이 이미지를 분석해서 정해진 JSON 형식으로 출력하세요.' },
          { inlineData: { data: base64Image, mimeType: detectedMime } }
        ]
      }];
    }

    const body = {
      contents,
      systemInstruction: systemPrompt ? { parts: [{ text: systemPrompt }] } : undefined,
      generationConfig: {
        temperature: !imagePath ? 0.7 : 0.2,
        responseMimeType: !imagePath ? 'text/plain' : 'application/json',
      },
    };

    const MAX_RETRIES = 3;
    let lastErr;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${oauthToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      // 503/429 — 일시적 과부하: 재시도
      if (resp.status === 503 || resp.status === 429) {
        const errBody = await resp.text();
        // 429는 Retry-After 헤더 또는 retryDelay 필드 파싱
        let waitMs = Math.pow(2, attempt) * 1000; // 기본: 2s, 4s, 8s
        try {
          const parsed = JSON.parse(errBody);
          const retryDelay = parsed?.error?.details
            ?.find(d => d['@type']?.includes('RetryInfo'))
            ?.retryDelay;
          if (retryDelay) {
            const secs = parseFloat(retryDelay.replace('s', ''));
            if (!isNaN(secs)) waitMs = Math.ceil(secs * 1000) + 500;
          }
        } catch (_) {}

        const waitSec = (waitMs / 1000).toFixed(1);
        console.warn(`[ImageAnalysisService] ${resp.status} 과부하 — ${waitSec}s 후 재시도 (${attempt}/${MAX_RETRIES})...`);

        if (attempt < MAX_RETRIES) {
          await new Promise(r => setTimeout(r, waitMs));
          continue;
        }
        lastErr = new Error(`OAuth Vision API 오류 (${resp.status}): ${errBody}`);
        break;
      }

      if (!resp.ok) {
        const errBody = await resp.text();
        console.error(`[ImageAnalysisService] OAuth API 오류 (${resp.status}):`, errBody);
        throw new Error(`OAuth Vision API 오류 (${resp.status}): ${errBody}`);
      }

      const data = await resp.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      return { text, model: `Gemini ${MODEL.FLASH} (Vision OAuth)` };
    }

    throw lastErr ?? new Error('OAuth Vision API: 최대 재시도 횟수 초과');

  }

  // ── 2순위: API Key 폴백 ───────────────────────────────────────────────────────
  console.log('[ImageAnalysisService] OAuth 토큰 없음 → API Key 모드로 전환');
  await _ensureClient();
  if (!_ai) throw new Error('GEMINI_API_KEY를 찾을 수 없습니다.');


  return requestQueue.enqueue(async () => {
    // ── 텍스트 전용 모드 (Lumi 크리에이티브 디렉팅) ───────────────────────
    if (!imagePath) {
      console.log(`[ImageAnalysisService] 텍스트 생성 시작 (Lumi 디렉팅, Model: ${MODEL.FLASH})`);
      const response = await _ai.models.generateContent({
        model: MODEL.FLASH,
        contents: [{ text: userText || '창의적인 이미지 프롬프트를 생성해주세요.' }],
        config: {
          systemInstruction: systemPrompt,
          temperature: 0.7,  // 창의성을 위해 높게
        },
      });
      return { text: response.text, model: `Gemini ${MODEL.FLASH} (Text)` };
    }

    // ── 이미지 분석 모드 (기존 API_KEY) ────────────────────────────────────────────
    console.log(`[ImageAnalysisService] 이미지 분석 시작 (Model: ${MODEL.FLASH})`);

    const imageData   = fs.readFileSync(imagePath);
    const base64Image = imageData.toString('base64');

    const response = await _ai.models.generateContent({
      model: MODEL.FLASH,               // ← modelRegistry SSOT 참조 (하드코딩 제거)
      contents: [
        { text: '이 이미지를 분석해서 정해진 JSON 형식으로 출력하세요.' },
        {
          inlineData: {
            data:     base64Image,
            mimeType,
          },
        },
      ],
      config: {
        systemInstruction:  systemPrompt,
        temperature:        0.2,                     // 분석 정확도를 위해 낮게 고정
        responseMimeType:   'application/json',
      },
    });

    return {
      text:  response.text,
      model: `Gemini ${MODEL.FLASH} (Vision)`,
    };
  });
}
