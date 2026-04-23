import fetch from 'node-fetch';

/**
 * [에이전트 1] 정보 수집 담당 에이전트 (Data Harvester)
 * 구글 뉴스 RSS를 실시간으로 수집합니다.
 *
 * [Phase 26 수정]
 * - Twitter 하드코딩 Mock 완전 제거 (가짜 데이터로 CurationAgent 오염 방지)
 * - 구글뉴스 실패 시 빈 배열 반환 → 파이프라인 명시적 중단
 * - seedKeywords 파라미터 추가: Legacy Lab 분석 결과(키워드)를 주입받아 수집 정밀도 향상
 */
export class DataHarvester {
    constructor() {
        this.cache = [];
    }

    /**
     * 구글 뉴스 RSS에서 특정 키워드의 최신 24시간 뉴스를 수집합니다.
     * @param {string} keyword - 검색 키워드
     * @returns {Array} items - 수집된 뉴스 아이템 배열 (실패 시 [])
     */
    async fetchGoogleNews(keyword) {
        console.log(`[DataHarvester] "${keyword}" 구글뉴스 RSS 수집 중...`);
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword + ' when:1d')}&hl=ko&gl=KR&ceid=KR:ko`;
        
        try {
            const response = await fetch(url, { timeout: 8000 });
            if (!response.ok) {
                console.warn(`[DataHarvester] RSS 응답 실패 (${response.status}) — 키워드: "${keyword}"`);
                return [];
            }
            const xml = await response.text();
            
            const items = [];
            const itemRegex = /<item>([\s\S]*?)<\/item>/g;
            let match;
            
            while ((match = itemRegex.exec(xml)) !== null) {
                const itemBlock = match[1];
                const titleMatch = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/.exec(itemBlock);
                const linkMatch = /<link>([\s\S]*?)<\/link>/.exec(itemBlock);
                const pubDateMatch = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(itemBlock);
                
                if (titleMatch) {
                    const title = (titleMatch[1] || titleMatch[2] || '').trim();
                    if (title) {
                        items.push({
                            title,
                            link:   linkMatch    ? linkMatch[1].trim()    : '',
                            pubDate: pubDateMatch ? pubDateMatch[1].trim() : '',
                            source: 'google_news',
                            keyword,
                        });
                    }
                }
            }
            
            console.log(`[DataHarvester] "${keyword}" → ${items.length}건 수집`);
            return items;
            
        } catch (error) {
            console.error(`[DataHarvester] "${keyword}" 수집 실패:`, error.message);
            return [];
        }
    }

    /**
     * 채널 타입과 외부 seed 키워드(Legacy Lab 결과 등)를 받아 뉴스를 수집합니다.
     *
     * @param {string} channelType - 'finance-viral' | 'ai-tips' | ...
     * @param {string[]} [seedKeywords=[]] - Legacy Lab 분석 결과나 수동 입력 키워드
     * @returns {{ sources: Array, totalCount: number, keywords: string[] }}
     */
    async harvestDailySources(channelType, seedKeywords = []) {
        // 채널별 기본 키워드
        const CHANNEL_KEYWORDS = {
            'finance-viral': ['주식', '코스피', '증시', '엔비디아', '삼성전자', '금리', '부동산'],
            'finance':        ['주식', '코스피', '증시 폭락', '엔비디아', '삼성전자'],
            'ai-tips':        ['챗GPT', '생성형 AI', 'AI 도구', '직장인 꿀팁', 'Claude', 'Gemini'],
        };

        const baseKeywords = CHANNEL_KEYWORDS[channelType] || CHANNEL_KEYWORDS['finance-viral'];
        // seedKeywords(Legacy Lab 주입)가 있으면 앞쪽 우선 배치
        const allKeywords = [...new Set([...seedKeywords, ...baseKeywords])];

        console.log(`[DataHarvester] 수집 시작 — 채널: ${channelType}, 키워드 ${allKeywords.length}개`);
        if (seedKeywords.length > 0) {
            console.log(`[DataHarvester] 🎯 Legacy Lab 시드 키워드 주입됨: [${seedKeywords.join(', ')}]`);
        }

        let allSources = [];
        
        for (const kw of allKeywords) {
            const items = await this.fetchGoogleNews(kw);
            allSources = allSources.concat(items);
        }

        if (allSources.length === 0) {
            console.error('[DataHarvester] ❌ 모든 키워드에서 수집 실패 — 0건. 파이프라인을 중단합니다.');
            return { sources: [], totalCount: 0, keywords: allKeywords, failed: true };
        }

        // 중복 제거 (제목 기준)
        const seen = new Set();
        const unique = allSources.filter(a => {
            if (!a?.title || seen.has(a.title)) return false;
            seen.add(a.title);
            return true;
        });
            
        console.log(`[DataHarvester] ✅ 최종 고유 소스 ${unique.length}건 (중복 ${allSources.length - unique.length}건 제거)`);
        return { sources: unique, totalCount: unique.length, keywords: allKeywords, failed: false };
    }
}
