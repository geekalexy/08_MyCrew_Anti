import 'dotenv/config';
import { TTSAgent } from './ai-engine/agents/youtube-autopilot/TTSAgent.js';
import path from 'path';

async function testTTS() {
    console.log('🗣️ 새로운 Neural2 성우(1.25x 속도) 테스트 시작...');
    const text = "글로벌 1위 주식의 몰락? 알고 보니 세력들의 개미털기! 어제까지 90% 팔아치운 한국인들, 오늘 땅을 치며 후회 중입니다.";
    const outputPath = path.resolve(process.cwd(), 'test_tts_sample.mp3');
    
    try {
        await TTSAgent.fetchPremiumTTS(text, outputPath);
        console.log(`✅ 성공! 오디오 파일이 생성되었습니다.`);
        console.log(`📁 파일 다운로드/확인 경로: ${outputPath}`);
    } catch (err) {
        console.error(`❌ 에러 발생:`, err.message);
        console.log(`💡 (앗! 혹시 아까 말씀드린 Google Cloud 콘솔에서 'TTS API 사용(Enable)' 버튼을 아직 안 누르셨다면 에러가 날 수 있습니다!)`);
    }
}

testTTS();
