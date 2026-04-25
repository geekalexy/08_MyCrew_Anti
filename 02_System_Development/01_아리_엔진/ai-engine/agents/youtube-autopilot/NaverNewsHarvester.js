import fetch from 'node-fetch';

/**
 * [NaverNewsHarvester] 네이버 뉴스 검색 API 기반 수집 모듈
 *
 * - API: GET https://openapi.naver.com/v1/search/news.json
 * - 인증: 비로그인 방식 (X-Naver-Client-Id / X-Naver-Client-Secret 헤더)
 * - 일일 한도: 25,000회 (키워드당 1회 기준 사실상 무제한)
 * - 네이버 앱 등록 시 '검색' API 체크 필요
 *
 * [구글 뉴스 RSS 대비 장점]
 * - JSON 응답 (XML 파싱 불필요)
 * - 날짜순 정렬 지원 (sort=date)
 * - 원문 URL(originallink) + 네이버 뉴스 URL(link) 모두 제공
 * - 한국 뉴스 특화 (네이버 인덱스 기사 전체 대상)
 * - 응답 title/description의 <b> 태그 자동 제거 처리
 *
 * [Strategic Memory 원칙 준수]
 * - ESM 가드 적용 (모듈 import 시 side-effect 없음)
 * - 환경변수는 process.env를 통해서만 참조 (하드코딩 금지)
 */
export class NaverNewsHarvester {
    constructor() {
        this.clientId     = process.env.NAVER_CLIENT_ID;
        this.clientSecret = process.env.NAVER_CLIENT_SECRET;
        this.BASE_URL     = 'https://openapi.naver.com/v1/search/news.json';
    }

    /**
     * 인증 키 유효성 체크
     * @returns {boolean}
     */
    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    }

    /**
     * HTML 태그 제거 (<b>검색어</b> → 검색어)
     * @param {string} str
     */
    _stripHtml(str = '') {
        return str.replace(/<[^>]*>/g, '').trim();
    }

    /**
     * 네이버 뉴스 검색
     *
     * @param {string} keyword - 검색 키워드
     * @param {object} options
     * @param {number} options.display  - 한 번에 가져올 결과 수 (1~100, 기본 100)
     * @param {number} options.start    - 검색 시작 위치 (1~1000, 기본 1)
     * @param {'sim'|'date'} options.sort - 정렬: sim=정확도, date=날짜순 (기본 date)
     * @returns {Promise<Array>} 정규화된 뉴스 아이템 배열 (실패 시 [])
     */
    async searchNews(keyword, { display = 100, start = 1, sort = 'date' } = {}) {
        if (!this.isConfigured()) {
            console.warn('[NaverNews] ⚠️  NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정 — 수집 스킵');
            return [];
        }

        const params = new URLSearchParams({
            query:   keyword,
            display: String(display),
            start:   String(start),
            sort,
        });

        const url = `${this.BASE_URL}?${params.toString()}`;
        console.log(`[NaverNews] "${keyword}" 검색 중... (display=${display}, sort=${sort})`);

        try {
            const response = await fetch(url, {
                headers: {
                    'X-Naver-Client-Id':     this.clientId,
                    'X-Naver-Client-Secret': this.clientSecret,
                },
                signal: AbortSignal.timeout(8000),
            });

            if (response.status === 401) {
                console.error('[NaverNews] ❌ 인증 실패 — 네이버 개발자 센터에서 "검색" API가 앱에 추가되었는지 확인하세요.');
                return [];
            }
            if (response.status === 429) {
                console.warn('[NaverNews] ⚠️  일일 호출 한도 초과 (25,000회)');
                return [];
            }
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.warn(`[NaverNews] HTTP ${response.status} 오류: ${err.errorMessage || '알 수 없는 오류'} (코드: ${err.errorCode || '-'})`);
                return [];
            }

            const data  = await response.json();
            const items = (data.items || []).map(item => ({
                title:        this._stripHtml(item.title),
                description:  this._stripHtml(item.description),
                link:         item.link,          // 네이버 뉴스 URL
                originallink: item.originallink,  // 언론사 원문 URL
                pubDate:      item.pubDate,
                source:       'naver_news',
                keyword,
            }));

            console.log(`[NaverNews] "${keyword}" → ${items.length}건 수집`);
            return items;

        } catch (error) {
            console.error(`[NaverNews] "${keyword}" 수집 실패:`, error.message);
            return [];
        }
    }
}
