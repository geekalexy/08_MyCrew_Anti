/**
 * 네이버 뉴스 API + DataLab 연동 테스트
 * 실행: node --experimental-vm-modules test_naver_api.js
 * (또는 package.json에 "type":"module" 설정 시 node test_naver_api.js)
 */
import 'dotenv/config';
import { NaverNewsHarvester }    from './ai-engine/agents/youtube-autopilot/NaverNewsHarvester.js';
import { NaverDataLabHarvester } from './ai-engine/agents/youtube-autopilot/NaverDataLabHarvester.js';
import { DataHarvester }         from './ai-engine/agents/youtube-autopilot/DataHarvester.js';

const LINE = '─'.repeat(60);

async function main() {
    console.log(`\n${LINE}`);
    console.log('🧪 네이버 API 연동 테스트 시작');
    console.log(LINE);

    // ── 1. 키 설정 확인 ────────────────────────────────────────────
    const newsHarvester = new NaverNewsHarvester();
    const datalabHarvester = new NaverDataLabHarvester();

    console.log('\n[설정 확인]');
    console.log(`  NAVER_CLIENT_ID    : ${process.env.NAVER_CLIENT_ID ? '✅ 설정됨' : '❌ 미설정'}`);
    console.log(`  NAVER_CLIENT_SECRET: ${process.env.NAVER_CLIENT_SECRET ? '✅ 설정됨' : '❌ 미설정'}`);

    if (!newsHarvester.isConfigured()) {
        console.error('\n❌ 키가 설정되지 않았습니다. .env 파일을 확인하세요.');
        process.exit(1);
    }

    // ── 2. 뉴스 검색 API 테스트 ────────────────────────────────────
    console.log(`\n${LINE}`);
    console.log('[Test 1] 뉴스 검색 API — "삼성전자" 최신 5건');
    console.log(LINE);

    const newsItems = await newsHarvester.searchNews('삼성전자', { display: 5, sort: 'date' });
    if (newsItems.length > 0) {
        newsItems.forEach((item, i) => {
            console.log(`\n  [${i + 1}] ${item.title}`);
            console.log(`      📅 ${item.pubDate}`);
            console.log(`      🔗 ${item.originallink || item.link}`);
        });
        console.log(`\n✅ 뉴스 검색 API 정상 동작 (${newsItems.length}건)`);
    } else {
        console.log('❌ 결과 없음 — API 키 또는 네트워크를 확인하세요.');
    }

    // ── 3. DataLab 트렌드 API 테스트 ───────────────────────────────
    console.log(`\n${LINE}`);
    console.log('[Test 2] DataLab 트렌드 API — finance-viral 채널 Top 3 키워드');
    console.log(LINE);

    const trendKeywords = await datalabHarvester.getTopTrendKeywords('finance-viral', 3);
    if (trendKeywords.length > 0) {
        console.log(`\n  🔥 트렌드 Top 3: [${trendKeywords.join(', ')}]`);
        console.log('\n✅ DataLab 트렌드 API 정상 동작');
    } else {
        console.log('⚠️  트렌드 결과 없음 (키 문제 또는 한도 초과일 수 있음)');
    }

    // ── 4. DataHarvester 통합 테스트 ───────────────────────────────
    console.log(`\n${LINE}`);
    console.log('[Test 3] DataHarvester v2 통합 — finance-viral 채널 수집');
    console.log(LINE);

    const harvester = new DataHarvester();
    const result = await harvester.harvestDailySources('finance-viral');

    console.log(`\n  📊 수집 결과:`);
    console.log(`     - 총 건수   : ${result.totalCount}건`);
    console.log(`     - 수집 출처 : ${result.sourceType}`);
    console.log(`     - 키워드    : [${result.keywords.join(', ')}]`);
    console.log(`     - 실패 여부 : ${result.failed ? '❌ 실패' : '✅ 성공'}`);

    if (!result.failed && result.sources.length > 0) {
        console.log('\n  최신 기사 Top 3:');
        result.sources.slice(0, 3).forEach((s, i) => {
            console.log(`  [${i + 1}] ${s.title}`);
            console.log(`      keyword: ${s.keyword} | source: ${s.source}`);
        });
    }

    console.log(`\n${LINE}`);
    console.log('🎉 테스트 완료');
    console.log(LINE);
}

// ESM 가드 — CLI 직접 실행 시에만 동작
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
if (process.argv[1] && process.argv[1] === __filename) {
    main().catch(err => {
        console.error('❌ 테스트 실패:', err);
        process.exit(1);
    });
}
