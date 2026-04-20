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
  const key = await keyProvider.getKey();
  if (key) _ai = new GoogleGenAI({ apiKey: key });
}

/**
 * 이미지를 분석하여 구조화된 JSON을 추출합니다.
 *
 * @param {string} imagePath  - 로컬 파일 절대경로
 * @param {string} systemPrompt - 분석 지침 (7항목 JSON 추출 형식)
 * @param {string} [mimeType='image/jpeg'] - 이미지 MIME 타입
 * @returns {{ text: string, model: string }}
 */
export async function analyzeImageForPrompt(imagePath, systemPrompt, mimeType = 'image/jpeg') {
  await _ensureClient();
  if (!_ai) throw new Error('GEMINI_API_KEY를 찾을 수 없습니다.');

  return requestQueue.enqueue(async () => {
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
