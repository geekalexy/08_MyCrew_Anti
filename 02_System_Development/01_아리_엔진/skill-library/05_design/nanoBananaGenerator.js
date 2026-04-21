import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

/**
 * 나노바나나 (Gemini Imagen 3) 이미지 생성 스킬
 * @param {string} prompt 이미지 생성을 위한 프롬프트
 * @param {string} style 추가 스타일 지시 (옵션)
 * @returns {Promise<string>} 생성된 이미지의 로컬 파일 URL
 */
export async function generateImage(prompt, style = '', width = 1080, height = 1080) {
  try {
    // 구글 AI Studio 모드 강제 실행을 위해 명시적으로 apiKey 주입
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const fullPrompt = `${prompt} ${style}`.trim();
    
    console.log(`[LUMI Skill] NanoBanana(FLUX) 이미지 생성 요청: ${width}×${height} — "${fullPrompt.slice(0,60)}..."`);

    // Imagen 3는 제거하고 전적으로 NanoBanana (Flux) 모델로 생성
    let base64Data = null;
    
    // Pollinations API — 콘텐츠 유형에 맞는 실제 픽셀 크기 적용
    const fallbackUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(fullPrompt)}?width=${width}&height=${height}&nologo=true&model=flux`;


    // POLLINATIONS_API_KEY가 있으면 Seed 티어(안정적), 없으면 Anonymous(제한적)
    const pollinationsKey = process.env.POLLINATIONS_API_KEY;
    const pollinationsHeaders = pollinationsKey
      ? { 'Authorization': `Bearer ${pollinationsKey}` }
      : {};

    if (pollinationsKey) {
      console.log('[LUMI Skill] Pollinations Seed 계정으로 인증 호출 중...');
    } else {
      console.warn('[LUMI Skill] POLLINATIONS_API_KEY 없음 → 익명 호출 (제한적)');
    }

    const fetch = (await import('node-fetch')).default || globalThis.fetch;
    const fbResponse = await fetch(fallbackUrl, { headers: pollinationsHeaders });
    if (!fbResponse.ok) throw new Error(`NanoBanana 이미지 생성 실패 (HTTP ${fbResponse.status})`);

    const arrayBuffer = await fbResponse.arrayBuffer();
    base64Data = Buffer.from(arrayBuffer).toString('base64');

    // 저장할 경로 설정 (server/outputs 폴더)
    const outputsDir = path.resolve(process.cwd(), 'outputs');
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    // 고유 파일명 생성
    const fileName = `nanobanana_${crypto.randomBytes(4).toString('hex')}_${Date.now()}.jpg`;
    const filePath = path.join(outputsDir, fileName);

    // Base64 디코딩 후 파일 시스템에 저장
    fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));
    
    console.log(`[LUMI Skill] NanoBanana 이미지 저장 완료: ${filePath}`);
    
    // 상대 경로로 반환 — 프론트엔드에서 `${SERVER_URL}${imageUrl}` 형태로 조립
    const fileUrl = `/outputs/${fileName}`;
    
    return fileUrl;

  } catch (error) {
    console.error('[LUMI Skill] NanoBanana 이미지 생성 최종 실패:', error);
    return `❌ 나노바나나(Gemini Imagen) 생성 중 에러가 발생했습니다: ${error.message}`;
  }
}
