import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import geminiAdapter from '../adapters/geminiAdapter.js';
import { MODEL } from '../modelRegistry.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Phase 39: Intent Router
 * 사용자의 자연어(또는 이미지) 입력을 받아, 내부 명령어와 모드로 맵핑합니다.
 */
class IntentRouter {
  constructor() {
    this.promptCache = null;
  }

  getSystemPrompt() {
    if (this.promptCache) return this.promptCache;
    try {
      // [Phase 39] 리뷰 피드백 반영: 상대 경로 하드코딩 제거 및 process.cwd() 기반 동적 탐색
      const promptPath = path.resolve(process.cwd(), '../../01_Company_Operations/04_HR_온보딩/skills/Phase39_Intent_Router_Prompt.md');
      this.promptCache = fs.readFileSync(promptPath, 'utf-8');
      return this.promptCache;
    } catch (err) {
      console.warn('[IntentRouter] 시스템 프롬프트 로드 실패:', err.message);
      return 'You are the Intent Router. Output JSON only: { "mode": "DEV", "command": "/run", "extracted_payload": "" }';
    }
  }

  async routeIntent(userInput) {
    try {
      // 가장 가볍고 빠른 모델(Gemini Flash)로 의도 분석
      const response = await geminiAdapter.generateResponse(
        userInput,
        this.getSystemPrompt(),
        MODEL.FLASH
      );

      let jsonMatch = response.text;
      if (typeof jsonMatch === 'string') {
        const match = jsonMatch.match(/\{[\s\S]*\}/);
        if (match) jsonMatch = match[0];
      }

      const result = typeof jsonMatch === 'string' ? JSON.parse(jsonMatch) : jsonMatch;
      
      console.log(`[IntentRouter] 매핑 결과: Mode=${result.mode}, Command=${result.command}`);
      return {
        mode: result.mode || 'DEV',
        command: result.command || '/run',
        reasoning: result.reasoning || '',
        extractedPayload: result.extracted_payload || userInput
      };
    } catch (error) {
      console.error('[IntentRouter] 분석 실패, 기본값(DEV/run) 반환:', error);
      return {
        mode: 'DEV',
        command: '/run',
        reasoning: 'Fallback due to error',
        extractedPayload: userInput
      };
    }
  }
}

export default new IntentRouter();
