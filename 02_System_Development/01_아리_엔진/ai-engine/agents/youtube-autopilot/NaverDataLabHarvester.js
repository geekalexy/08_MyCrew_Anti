import fetch from 'node-fetch';

/**
 * [NaverDataLabHarvester] 네이버 DataLab 검색어 트렌드 API 기반 키워드 수집 모듈
 *
 * - API: POST https://openapi.naver.com/v1/datalab/search
 * - 인증: 비로그인 방식 (X-Naver-Client-Id / X-Naver-Client-Secret 헤더)
 * - 일일 한도: 1,000회 (MyCrew 예상 사용량: 채널당 1회 → 여유 충분)
 * - 역할: 실시간 트렌드 키워드를 동적으로 추출 → DataHarvester seedKeywords에 주입
 *         기존 하드코딩된 채널 키워드 의존성 제거
 *
 * [ratio 해석]
 * - 조회 기간 내 최다 검색일 = 100 기준, 나머지는 상대적 비율 (0.0 ~ 100.0)
 * - 절대값이 아닌 상대값이므로 그룹 간 비교 가능
 *
 * [Strategic Memory 원칙 준수]
 * - ESM 가드 적용 (모듈 import 시 side-effect 없음)
 * - 환경변수는 process.env를 통해서만 참조 (하드코딩 금지)
 */
export class NaverDataLabHarvester {
    constructor() {
        this.clientId     = process.env.NAVER_CLIENT_ID;
        this.clientSecret = process.env.NAVER_CLIENT_SECRET;
        this.BASE_URL     = 'https://openapi.naver.com/v1/datalab/search';
    }

    /**
     * 인증 키 유효성 체크
     * @returns {boolean}
     */
    isConfigured() {
        return !!(this.clientId && this.clientSecret);
    }

    /**
     * YYYY-MM-DD 형식 날짜 문자열 반환
     * @param {Date} d
     */
    _formatDate(d) {
        return d.toISOString().split('T')[0];
    }

    /**
     * 채널 타입별 DataLab 키워드 그룹 정의
     * - 각 그룹 내 keywords는 OR 조건으로 합산됨 (최대 20개)
     * - 최대 5개 그룹까지 한 번에 조회 가능
     */
    _getKeywordGroups(channelType) {
        const GROUPS = {
            'finance-viral': [
                { groupName: '주식시장',   keywords: ['주식', '코스피', '증시', '주가'] },
                { groupName: '글로벌주식', keywords: ['나스닥', '다우존스', '엔비디아', 'S&P500'] },
                { groupName: '국내대형주', keywords: ['삼성전자', 'SK하이닉스', 'LG에너지솔루션'] },
                { groupName: '금리부동산', keywords: ['금리', '부동산', '아파트', '전세'] },
                { groupName: '가상화폐',   keywords: ['비트코인', '이더리움', '코인', '암호화폐'] },
            ],
            'finance': [
                { groupName: '주식시장',   keywords: ['주식', '코스피', '증시 폭락'] },
                { groupName: '글로벌주식', keywords: ['나스닥', '엔비디아', 'S&P500'] },
                { groupName: '국내대형주', keywords: ['삼성전자', 'SK하이닉스'] },
                { groupName: '금리',       keywords: ['금리', '기준금리', '한국은행'] },
                { groupName: '부동산',     keywords: ['부동산', '아파트', '전세', '청약'] },
            ],
            'ai-tips': [
                { groupName: 'AI도구',     keywords: ['챗GPT', 'Claude', 'Gemini', 'Copilot'] },
                { groupName: '생성형AI',   keywords: ['생성형AI', '인공지능', 'LLM', 'AI에이전트'] },
                { groupName: '직장인팁',   keywords: ['직장인', '업무효율', '생산성', '자동화'] },
                { groupName: 'AI뉴스',     keywords: ['OpenAI', 'Anthropic', 'Google AI', 'AI규제'] },
                { groupName: '기술트렌드', keywords: ['스타트업', '빅테크', '반도체', 'GPU'] },
            ],
        };
        return GROUPS[channelType] || GROUPS['finance-viral'];
    }

    /**
     * 지정 기간의 검색어 트렌드 조회
     *
     * @param {Array}  keywordGroups - [{ groupName, keywords[] }] (최대 5개 그룹)
     * @param {number} days          - 조회 기간 일수 (기본 7일)
     * @param {'date'|'week'|'month'} timeUnit - 집계 단위 (기본 'date')
     * @returns {Promise<Array>} 트렌드 결과 배열 (avgRatio 내림차순 정렬)
     */
    async getTrends(keywordGroups, days = 7, timeUnit = 'date') {
        if (!this.isConfigured()) {
            console.warn('[DataLab] ⚠️  NAVER_CLIENT_ID / NAVER_CLIENT_SECRET 미설정 — 트렌드 조회 스킵');
            return [];
        }

        const endDate   = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const body = {
            startDate: this._formatDate(startDate),
            endDate:   this._formatDate(endDate),
            timeUnit,
            keywordGroups,
            device: '',   // 전체 기기
            ages:   [],   // 전체 연령
            gender: '',   // 전체 성별
        };

        console.log(`[DataLab] 트렌드 조회 — 기간: ${body.startDate} ~ ${body.endDate}, 그룹 ${keywordGroups.length}개`);

        try {
            const response = await fetch(this.BASE_URL, {
                method: 'POST',
                headers: {
                    'X-Naver-Client-Id':     this.clientId,
                    'X-Naver-Client-Secret': this.clientSecret,
                    'Content-Type':          'application/json',
                },
                body:   JSON.stringify(body),
                signal: AbortSignal.timeout(10000),
            });

            if (response.status === 401) {
                console.error('[DataLab] ❌ 인증 실패 — NAVER_CLIENT_ID/SECRET을 확인하세요.');
                return [];
            }
            if (response.status === 429) {
                console.warn('[DataLab] ⚠️  일일 호출 한도 초과 (1,000회)');
                return [];
            }
            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                console.warn(`[DataLab] HTTP ${response.status} 오류: ${err.errorMessage || '알 수 없는 오류'}`);
                return [];
            }

            const data = await response.json();

            // 각 그룹의 평균 ratio 계산 → 내림차순 정렬
            return (data.results || [])
                .map(group => {
                    const ratios   = group.data.map(d => d.ratio);
                    const avgRatio = ratios.length
                        ? Math.round((ratios.reduce((s, r) => s + r, 0) / ratios.length) * 100) / 100
                        : 0;
                    const latestRatio = ratios[ratios.length - 1] ?? 0;

                    return {
                        keyword:     group.title,
                        keywords:    group.keywords,
                        avgRatio,
                        latestRatio,
                        trend:       group.data,
                    };
                })
                .sort((a, b) => b.avgRatio - a.avgRatio);

        } catch (error) {
            console.error('[DataLab] 트렌드 조회 실패:', error.message);
            return [];
        }
    }

    /**
     * 채널 타입별 트렌드 Top N 키워드 추출
     * → DataHarvester.harvestDailySources()의 seedKeywords로 주입
     *
     * @param {string} channelType - 'finance-viral' | 'finance' | 'ai-tips'
     * @param {number} topN        - 반환할 키워드 개수 (기본 3)
     * @returns {Promise<string[]>} 트렌드 키워드 배열 (예: ['주식시장', '글로벌주식', 'AI도구'])
     */
    async getTopTrendKeywords(channelType, topN = 3) {
        const groups = this._getKeywordGroups(channelType);
        const trends = await this.getTrends(groups, 3); // 최근 3일 기준

        if (trends.length === 0) {
            console.warn('[DataLab] 트렌드 데이터 없음 — 빈 배열 반환');
            return [];
        }

        const topKeywords = trends.slice(0, topN).map(t => t.keyword);
        console.log(`[DataLab] ✅ 트렌드 Top ${topN} 키워드: [${topKeywords.join(', ')}]`);
        return topKeywords;
    }
}
