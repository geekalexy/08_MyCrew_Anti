/**
 * [test_interest_analyzer.js] InterestAnalyzer 통합 테스트
 *
 * 실행: node test_interest_analyzer.js
 */

import dotenv from 'dotenv';
dotenv.config({ path: './.env' });

import { InterestAnalyzer } from './ai-engine/agents/youtube-autopilot/InterestAnalyzer.js';

const analyzer = new InterestAnalyzer();

console.log('=' .repeat(60));
console.log('[Test] InterestAnalyzer — finance-viral 채널 분석');
console.log('=' .repeat(60));

const result = await analyzer.analyze('finance-viral');

console.log('\n' + '─'.repeat(60));
console.log('📊 최종 분석 결과:');
console.log('─'.repeat(60));
console.log(`  소스별 수집:`);
console.log(`    - DataLab 트렌드:    [${result.sources.naverDataLab.join(', ')}]`);
console.log(`    - 채널 주제 분석:    [${result.sources.youtubeChannels.join(', ')}]`);
console.log(`    - YouTube 급상승:    [${result.sources.youtubeTrending.join(', ')}]`);
console.log(`\n  🎯 Gemini 정제 완료 키워드 (${result.keywords.length}개):`);
console.log(`    [${result.keywords.join(', ')}]`);
console.log('\n🎉 테스트 완료');
