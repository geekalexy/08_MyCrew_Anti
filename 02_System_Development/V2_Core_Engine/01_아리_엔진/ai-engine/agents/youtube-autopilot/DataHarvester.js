import fetch from 'node-fetch';
import { NaverNewsHarvester }     from './NaverNewsHarvester.js';
import { NaverDataLabHarvester }  from './NaverDataLabHarvester.js';

/**
 * [에이전트 1] 정보 수집 담당 에이전트 (Data Harvester) v2
 *
 * [v2 변경사항 — 네이버 API 고도화]
 * - 주 수집원: 네이버 뉴스 검색 API (NaverNewsHarvester)
 *   → 구글 뉴스 RSS 대비 JSON 응답, 날짜순 정렬, 원문 URL, 한국 뉴스 특화
 * - 트렌드 키워드: 네이버 DataLab API (NaverDataLabHarvester)
 *   → 실시간 검색어 트렌드 Top 3를 seedKeywords로 자동 주입 (하드코딩 제거)
 * - Fallback: 네이버 API 인증 미설정 또는 실패 시 구글 뉴스 RSS로 자동 전환
 *
 * [Phase 26 수정 유지]
 * - Twitter 하드코딩 Mock 완전 제거
 * - 수집 실패 시 빈 배열 반환 → 파이프라인 명시적 중단
 * - seedKeywords 파라미터: Legacy Lab / DataLab / 수동 키워드 통합 지원
 */
export class DataHarvester {
    constructor() {
        this.cache      = [];
        this.naverNews  = new NaverNewsHarvester();
        this.dataLab    = new NaverDataLabHarvester();
    }

    // ─────────────────────────────────────────────────────────────────────────
    // [구글 뉴스 RSS] — Fallback 전용 (네이버 API 미설정/실패 시)
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 구글 뉴스 RSS에서 특정 키워드의 최신 24시간 뉴스를 수집합니다. (Fallback)
     * @param {string} keyword
     * @returns {Promise<Array>}
     */
    async fetchGoogleNews(keyword) {
        console.log(`[DataHarvester] "${keyword}" 구글뉴스 RSS 수집 중... (Fallback)`);
        const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword + ' when:1d')}&hl=ko&gl=KR&ceid=KR:ko`;

        try {
            const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!response.ok) {
                console.warn(`[DataHarvester] RSS 응답 실패 (${response.status}) — 키워드: "${keyword}"`);
                return [];
            }
            const xml = await response.text();

            const items = [];
            const itemRegex = /<item>([\s\S]*?)<\/item>/g;
            let match;

            while ((match = itemRegex.exec(xml)) !== null) {
                const block       = match[1];
                const titleMatch  = /<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>|<title>([\s\S]*?)<\/title>/.exec(block);
                const linkMatch   = /<link>([\s\S]*?)<\/link>/.exec(block);
                const pubMatch    = /<pubDate>([\s\S]*?)<\/pubDate>/.exec(block);

                if (titleMatch) {
                    const title = (titleMatch[1] || titleMatch[2] || '').trim();
                    if (title) {
                        items.push({
                            title,
                            link:    linkMatch ? linkMatch[1].trim() : '',
                            pubDate: pubMatch  ? pubMatch[1].trim()  : '',
                            source:  'google_news',
                            keyword,
                        });
                    }
                }
            }

            console.log(`[DataHarvester] "${keyword}" → ${items.length}건 수집 (Google RSS)`);
            return items;

        } catch (error) {
            console.error(`[DataHarvester] "${keyword}" RSS 수집 실패:`, error.message);
            return [];
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // [내부 유틸] — 중복 제거
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * originallink → link → title 순으로 중복 제거
     * @param {Array} items
     * @returns {Array}
     */
    _deduplicate(items) {
        const seen = new Set();
        return items.filter(item => {
            const key = item.originallink || item.link || item.title;
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // [메인] harvestDailySources
    // ─────────────────────────────────────────────────────────────────────────

    /**
     * 채널 타입 기반으로 뉴스 소스를 수집합니다.
     *
     * 수집 흐름:
     *   1. DataLab API → 실시간 트렌드 Top 3 키워드 추출
     *   2. [트렌드 키워드] + [외부 seedKeywords] + [채널 기본 키워드] 합산
     *   3. 네이버 뉴스 API로 수집 (주 수집원)
     *   4. 네이버 미설정/실패 시 → 구글 뉴스 RSS Fallback
     *
     * @param {string}   channelType   - 'finance-viral' | 'finance' | 'ai-tips'
     * @param {string[]} [seedKeywords=[]] - 외부 주입 키워드 (Legacy Lab 등)
     * @returns {{ sources: Array, totalCount: number, keywords: string[], failed: boolean, sourceType: string }}
     */
    async harvestDailySources(channelType, seedKeywords = []) {
        // ── 채널별 기본 키워드 ─────────────────────────────────────────────
        const CHANNEL_KEYWORDS = {
            'finance-viral': ['주식', '코스피', '증시', '엔비디아', '삼성전자', '금리', '부동산'],
            'finance':        ['주식', '코스피', '증시 폭락', '엔비디아', '삼성전자'],
            'ai-tips':        ['챗GPT', '생성형 AI', 'AI 도구', '직장인 꿀팁', 'Claude', 'Gemini'],
        };
        const baseKeywords = CHANNEL_KEYWORDS[channelType] || CHANNEL_KEYWORDS['finance-viral'];

        // ── Step 1: DataLab 실시간 트렌드 키워드 ─────────────────────────
        let trendKeywords = [];
        if (this.dataLab.isConfigured()) {
            trendKeywords = await this.dataLab.getTopTrendKeywords(channelType, 3);
        } else {
            console.warn('[DataHarvester] DataLab 미설정 → 트렌드 키워드 스킵');
        }

        // ── Step 2: 키워드 합산 (트렌드 > 외부 시드 > 기본, 중복 제거) ──
        const allKeywords = [...new Set([...trendKeywords, ...seedKeywords, ...baseKeywords])];
        console.log(`[DataHarvester] 수집 시작 — 채널: ${channelType}, 키워드 ${allKeywords.length}개`);
        if (trendKeywords.length  > 0) console.log(`[DataHarvester] 🔥 DataLab 트렌드: [${trendKeywords.join(', ')}]`);
        if (seedKeywords.length   > 0) console.log(`[DataHarvester] 🎯 외부 시드: [${seedKeywords.join(', ')}]`);

        // ── Step 3: 네이버 뉴스 API (주 수집원) ───────────────────────────
        let allSources = [];
        let sourceType = 'naver_news';

        if (this.naverNews.isConfigured()) {
            for (const kw of allKeywords) {
                const items = await this.naverNews.searchNews(kw, { display: 100, sort: 'date' });
                allSources.push(...items);
                // API 보호: 키워드 간 100ms 간격
                await new Promise(r => setTimeout(r, 100));
            }
        }

        // ── Step 4: Fallback — 구글 뉴스 RSS ─────────────────────────────
        if (allSources.length === 0) {
            if (!this.naverNews.isConfigured()) {
                console.warn('[DataHarvester] 네이버 API 미설정 → 구글 RSS Fallback');
            } else {
                console.warn('[DataHarvester] 네이버 API 수집 0건 → 구글 RSS Fallback');
            }
            sourceType = 'google_news';

            for (const kw of allKeywords) {
                const items = await this.fetchGoogleNews(kw);
                allSources.push(...items);
            }
        }

        // ── 수집 완전 실패 ────────────────────────────────────────────────
        if (allSources.length === 0) {
            console.error('[DataHarvester] ❌ 모든 수집원에서 실패 — 0건. 파이프라인을 중단합니다.');
            return { sources: [], totalCount: 0, keywords: allKeywords, failed: true, sourceType: 'none' };
        }

        // ── 중복 제거 ────────────────────────────────────────────────────
        const unique = this._deduplicate(allSources);
        console.log(`[DataHarvester] ✅ 최종 고유 소스 ${unique.length}건 (중복 ${allSources.length - unique.length}건 제거) [출처: ${sourceType}]`);

        return {
            sources:    unique,
            totalCount: unique.length,
            keywords:   allKeywords,
            failed:     false,
            sourceType,
        };
    }
}
