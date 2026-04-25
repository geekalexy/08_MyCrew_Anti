import fetch from 'node-fetch';
import { NaverDataLabHarvester } from './NaverDataLabHarvester.js';
import geminiAdapter from '../../adapters/geminiAdapter.js';

/**
 * [InterestAnalyzer] 관심사 분석 통합 모듈
 *
 * 세 가지 소스를 합산하여 채널 타입에 최적화된 수집 키워드를 동적으로 생성합니다.
 *
 * [수집 소스]
 *   1. 네이버 DataLab   — 검색어 트렌드 Top 5 (한국인 실검 기반)
 *   2. 인기 채널 분석   — 벤치마크 채널 최신 영상 주제 (수요 검증된 콘텐츠)
 *   3. YouTube 급상승   — mostPopular 인기 동영상 키워드 (영상 플랫폼 트렌드)
 *
 * [사용 API]
 *   - 네이버 DataLab API (이미 완성)
 *   - YouTube Data API v3 (API Key: YOUTUBE_DATA_API_KEY)
 *     → search.list (채널 최신 영상)
 *     → videos.list?chart=mostPopular (급상승 동영상)
 *
 * [Gemini 정제]
 *   - 세 소스 합산 후 중복/유사어 병합, 채널 방향성 부합 여부 판단
 *   - 최종 10~15개 핵심 키워드 반환
 *
 * [Strategic Memory 원칙 준수]
 *   - ESM 가드 적용
 *   - 환경변수는 process.env를 통해서만 참조
 *   - 실패 시 빈 배열 반환 (파이프라인 중단 없음 — 다른 소스로 보완)
 */
export class InterestAnalyzer {
    constructor() {
        this.dataLab    = new NaverDataLabHarvester();
        this.ytApiKey   = process.env.YOUTUBE_DATA_API_KEY;
        this.YT_BASE    = 'https://www.googleapis.com/youtube/v3';

        // ── 채널 타입별 벤치마크 유튜브 채널 ────────────────────────────
        // 실제로 잘 되고 있는 채널이 다루는 주제 = 수요 검증된 콘텐츠
        this.BENCHMARK_CHANNELS = {
            'finance-viral': [
                { name: '슈카월드',     id: 'UCsJ6RuBiTVWRX156FVbeaGg' },
                { name: '삼프로TV',     id: 'UCKDNof1GGlnTVFKMhSgFiJg' },
                { name: '박곰희TV',     id: 'UCpDOEG7cjPXMb_pkU7NAMHQ' },
                { name: '신사임당',     id: 'UCOSWOxJvhGFyHpkFMx0jRlw' },
                { name: '머니인사이드', id: 'UCqR1e7VrqJn9GH_9DZhFBag' },
            ],
            'finance': [
                { name: '슈카월드',  id: 'UCsJ6RuBiTVWRX156FVbeaGg' },
                { name: '삼프로TV',  id: 'UCKDNof1GGlnTVFKMhSgFiJg' },
                { name: '박곰희TV',  id: 'UCpDOEG7cjPXMb_pkU7NAMHQ' },
            ],
            'ai-tips': [
                { name: 'AI 활용법 채널', id: 'UCKvNBruWrBsFRBn-hBZyHoA' },
                { name: 'DALL이오',       id: 'UCXAGaGFatRnOuEJ9UmTBhFQ' },
                { name: '생성AI클럽',     id: 'UCw5xC7gNkgCXYBCy0n1pVpg' },
            ],
        };

        // ── YouTube 카테고리 ID (mostPopular 필터용) ───────────────────
        this.YT_CATEGORY = {
            'finance-viral': '25',  // 뉴스 & 정치
            'finance':       '25',
            'ai-tips':       '28',  // 과학 & 기술
        };
    }

    // ─────────────────────────────────────────────────────────────────
    // [내부] YouTube API 공통 호출
    // ─────────────────────────────────────────────────────────────────

    isYtConfigured() {
        return !!this.ytApiKey;
    }

    /**
     * YouTube Data API v3 호출 (GET)
     * @param {string} endpoint - 예: '/search', '/videos'
     * @param {object} params   - 쿼리 파라미터
     * @returns {Promise<object|null>}
     */
    async _ytFetch(endpoint, params) {
        if (!this.isYtConfigured()) return null;
        const qs = new URLSearchParams({ ...params, key: this.ytApiKey });
        const url = `${this.YT_BASE}${endpoint}?${qs.toString()}`;
        try {
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                console.warn(`[InterestAnalyzer/YT] HTTP ${res.status}: ${err?.error?.message || '오류'}`);
                return null;
            }
            return await res.json();
        } catch (e) {
            console.error('[InterestAnalyzer/YT] 호출 실패:', e.message);
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // [소스 1] 네이버 DataLab 트렌드 키워드
    // ─────────────────────────────────────────────────────────────────

    /**
     * 네이버 DataLab에서 채널 타입별 트렌드 Top 5 키워드 수집
     * @param {string} channelType
     * @returns {Promise<string[]>}
     */
    async _getNaverTrends(channelType) {
        try {
            const keywords = await this.dataLab.getTopTrendKeywords(channelType, 5);
            console.log(`[InterestAnalyzer] 📊 DataLab 트렌드: [${keywords.join(', ')}]`);
            return keywords;
        } catch (e) {
            console.warn('[InterestAnalyzer] DataLab 실패:', e.message);
            return [];
        }
    }

    // ─────────────────────────────────────────────────────────────────
    // [소스 2] 인기 채널 최신 영상 주제 분석
    // ─────────────────────────────────────────────────────────────────

    /**
     * 채널의 최신 영상 N개 제목+설명 수집
     * @param {string} channelId
     * @param {number} maxResults
     * @returns {Promise<Array<{title, description, tags}>>}
     */
    async _fetchRecentVideos(channelId, maxResults = 5) {
        const data = await this._ytFetch('/search', {
            part:       'snippet',
            channelId,
            order:      'date',
            type:       'video',
            maxResults: String(maxResults),
        });
        if (!data?.items) return [];
        return data.items.map(item => ({
            title:       item.snippet?.title || '',
            description: item.snippet?.description?.slice(0, 200) || '',
            tags:        [],
        }));
    }

    /**
     * 벤치마크 채널들의 최신 영상 주제를 Gemini로 키워드 추출
     * Gemini 실패 시 영상 제목에서 직접 명사 추출(fallback)
     * @param {string} channelType
     * @returns {Promise<string[]>}
     */
    async _getChannelTopics(channelType) {
        if (!this.isYtConfigured()) {
            console.warn('[InterestAnalyzer] YOUTUBE_DATA_API_KEY 미설정 — 채널 분석 스킵');
            return [];
        }

        const channels = this.BENCHMARK_CHANNELS[channelType] || [];
        const allVideos = [];

        for (const ch of channels) {
            const videos = await this._fetchRecentVideos(ch.id, 5);
            if (videos.length > 0) {
                allVideos.push({ channelName: ch.name, videos });
            }
            await new Promise(r => setTimeout(r, 100)); // 채널 간 100ms
        }

        if (allVideos.length === 0) return [];

        // Gemini로 각 채널 영상 제목에서 핵심 키워드 추출
        const channelSummary = allVideos.map(ch =>
            `채널명: ${ch.channelName}\n최신 영상:\n${ch.videos.map(v => `- ${v.title}`).join('\n')}`
        ).join('\n\n');

        const keywords = await this._extractKeywordsWithGemini(channelSummary, channelType, 'channel');

        // Gemini 실패 시: 영상 제목에서 직접 명사 추출 (fallback)
        if (keywords.length === 0 && allVideos.length > 0) {
            console.warn('[InterestAnalyzer] Gemini 실패 → 제목 직접 파싱 fallback');
            return this._extractTitleKeywordsFallback(allVideos);
        }

        console.log(`[InterestAnalyzer] 📺 채널 주제 키워드: [${keywords.join(', ')}]`);
        return keywords;
    }

    /**
     * Gemini 없이 영상 제목에서 명사성 키워드 추출 (fallback)
     * - 부제어(의/은/이/가 등) 제거 후 2자 이상 명사성 어절 수집
     * @param {Array} allVideos
     * @returns {string[]}
     */
    _extractTitleKeywordsFallback(allVideos) {
        const STOP_WORDS = new Set(['뉴스', '오늘', '지금', '정말', '이거', '드디어', '결국', '근데', '그리고', '하지만', '때문', '이후', '이전']);
        const counter = {};
        for (const ch of allVideos) {
            for (const v of ch.videos) {
                // 한글 2~6자 명사형 단어 추출
                const words = v.title.match(/[가-힣]{2,6}/g) || [];
                for (const w of words) {
                    if (!STOP_WORDS.has(w)) {
                        counter[w] = (counter[w] || 0) + 1;
                    }
                }
            }
        }
        return Object.entries(counter)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8)
            .map(([k]) => k);
    }

    // ─────────────────────────────────────────────────────────────────
    // [소스 3] YouTube 급상승 동영상 키워드
    // ─────────────────────────────────────────────────────────────────

    /**
     * YouTube mostPopular 급상승 동영상에서 키워드 추출
     * @param {string} channelType
     * @returns {Promise<string[]>}
     */
    async _getYouTubeTrending(channelType) {
        if (!this.isYtConfigured()) return [];

        const categoryId = this.YT_CATEGORY[channelType] || '25';
        const data = await this._ytFetch('/videos', {
            part:           'snippet',
            chart:          'mostPopular',
            regionCode:     'KR',
            videoCategoryId: categoryId,
            maxResults:     '10',
        });

        if (!data?.items) return [];

        const titles = data.items.map(v => v.snippet?.title || '').filter(Boolean);
        if (titles.length === 0) return [];

        const prompt = `다음은 한국 YouTube 급상승 동영상 제목 목록입니다:\n${titles.map(t => `- ${t}`).join('\n')}\n\n이 중에서 "${channelType}" 채널 콘텐츠에 활용할 수 있는 핵심 주제 키워드 3~5개만 추출해주세요. 키워드만 쉼표로 구분하여 출력하세요.`;

        const keywords = await this._callGemini(prompt);
        console.log(`[InterestAnalyzer] 🔥 YouTube 급상승 키워드: [${keywords.join(', ')}]`);
        return keywords;
    }

    // ─────────────────────────────────────────────────────────────────
    // [내부] Gemini 키워드 추출
    // ─────────────────────────────────────────────────────────────────

    /**
     * 영상 목록 텍스트에서 Gemini로 핵심 키워드 추출
     * @param {string} text
     * @param {string} channelType
     * @param {'channel'|'trending'} mode
     * @returns {Promise<string[]>}
     */
    async _extractKeywordsWithGemini(text, channelType, mode) {
        const prompt = mode === 'channel'
            ? `다음은 "${channelType}" 분야 인기 유튜브 채널들의 최신 영상 제목 목록입니다:\n\n${text}\n\n이 채널들이 공통적으로 다루는 핵심 주제 키워드 5~8개를 추출해주세요. 뉴스 검색어로 활용할 수 있는 구체적인 키워드여야 합니다. 키워드만 쉼표로 구분하여 출력하세요.`
            : `다음 텍스트에서 핵심 키워드를 추출해주세요:\n\n${text}\n\n키워드만 쉼표로 구분하여 출력하세요.`;

        return this._callGemini(prompt);
    }

    /**
     * Gemini API 호출 → 쉼표 구분 키워드 파싱
     *
     * [구독 인증 및 보안 방어 적용]
     * 루카가 구축한 엔진 공식 geminiAdapter를 재사용하여, 구독 모드(OAuth) 시 
     * 무단 과금 발생을 방어하고, 에러나 한도 초과 시 올바른 Fallback을 보장합니다.
     *
     * @param {string} prompt
     * @returns {Promise<string[]>}
     */
    async _callGemini(prompt) {
        try {
            const systemPrompt = "당신은 트렌드 키워드 추출기입니다. 불필요한 설명 없이 키워드만 쉼표로 구분하여 출력하세요.";
            const response = await geminiAdapter.generateResponse(prompt, systemPrompt, 'gemini-2.5-flash');
            
            const text = response.text?.trim() || '';
            return text
                .split(/[,，\n]/)
                .map(k => k.replace(/^[-\s*•\d\.]+/, '').trim())
                .filter(k => k.length > 0 && k.length < 20);
        } catch (e) {
            console.error('[InterestAnalyzer] Gemini 호출 실패:', e.message);
            // 보안 차단(구독인증 풀림 시 개인 API 과금 방어) 에러는 숨기지 않고 상위로 던져서 시스템 즉각 중지(Halt)
            if (e.message.includes('[보안 차단]')) throw e;
            return [];
        }
    }

    /**
     * 세 소스 합산 후 Gemini로 최종 정제
     * - 유사어 병합 (주식, 주식시장 → 주식시장)
     * - 채널 방향성과 맞지 않는 키워드 제거
     * - 최종 10~15개 반환
     *
     * @param {string[]} raw         - 합산된 원본 키워드
     * @param {string}   channelType
     * @returns {Promise<string[]>}
     */
    async _refineWithGemini(raw, channelType) {
        if (raw.length === 0) return [];

        const prompt = `다음은 "${channelType}" 채널을 위해 여러 소스에서 수집한 키워드 목록입니다:
${raw.join(', ')}

아래 기준으로 최종 뉴스 검색 키워드 10~15개를 선별해주세요:
1. 유사어/중복 병합 (예: '주식', '주식시장' → '주식시장')
2. 너무 광범위하거나 모호한 키워드 제거
3. "${channelType}" 채널 방향성에 부합하는 키워드 우선
4. 뉴스 검색어로 실용적인 것 우선 (2~5글자 명사형)

키워드만 쉼표로 구분하여 출력하세요.`;

        const refined = await this._callGemini(prompt);
        console.log(`[InterestAnalyzer] ✨ Gemini 정제 완료: [${refined.join(', ')}]`);
        return refined;
    }

    // ─────────────────────────────────────────────────────────────────
    // [메인] analyze — 세 소스 통합 분석
    // ─────────────────────────────────────────────────────────────────

    /**
     * 채널 타입에 최적화된 수집 키워드를 동적으로 생성합니다.
     *
     * 수집 흐름:
     *   1. 네이버 DataLab 트렌드 Top 5
     *   2. 벤치마크 YouTube 채널 최신 영상 주제 (5채널 × 3키워드)
     *   3. YouTube 급상승 동영상 키워드 (3~5개)
     *   4. Gemini 정제 → 최종 10~15개
     *
     * @param {string} channelType - 'finance-viral' | 'finance' | 'ai-tips'
     * @returns {Promise<{ keywords: string[], sources: object }>}
     */
    async analyze(channelType) {
        console.log(`\n[InterestAnalyzer] 🔍 관심사 분석 시작 — 채널: ${channelType}`);

        // 세 소스 병렬 수집
        const [naverTrends, channelTopics, ytTrending] = await Promise.all([
            this._getNaverTrends(channelType),
            this._getChannelTopics(channelType),
            this._getYouTubeTrending(channelType),
        ]);

        // 합산 (순서: DataLab 트렌드 > 채널 주제 > YouTube 급상승)
        const raw = [...new Set([...naverTrends, ...channelTopics, ...ytTrending])];
        console.log(`[InterestAnalyzer] 합산 원본 키워드 ${raw.length}개: [${raw.join(', ')}]`);

        // Gemini 정제
        const keywords = await this._refineWithGemini(raw, channelType);

        return {
            keywords,
            sources: {
                naverDataLab:    naverTrends,
                youtubeChannels: channelTopics,
                youtubeTrending: ytTrending,
                refined:         keywords,
            },
        };
    }
}
