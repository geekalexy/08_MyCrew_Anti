# 네이버 DataLab 검색어 트렌드 API — 상세 레퍼런스

> **원본 출처**: https://developers.naver.com/docs/serviceapi/datalab/search/search.md  
> **데이터랩 서비스**: https://datalab.naver.com/keyword/trendSearch.naver  
> **작성일**: 2026-04-25 | **정리자**: Sonnet (Claude Sonnet 4.6)  
> **용도**: DataHarvester 고도화 — 실시간 트렌드 키워드 자동 수집 (하드코딩 제거)

---

## 1. API 개요

| 항목 | 내용 |
|------|------|
| **명칭** | 네이버 DataLab 검색어 트렌드 API |
| **설명** | 네이버 통합검색에서 특정 키워드가 얼마나 많이 검색되었는지 기간별 트렌드(상대적 비율 0~100)를 반환 |
| **서비스 출처** | 네이버 데이터랩 검색어 트렌드 (https://datalab.naver.com) |
| **인증 방식** | 비로그인 방식 (Client-ID + Client-Secret 헤더) |
| **일일 호출 한도** | **1,000회/일** |
| **HTTP 메서드** | `POST` |
| **Content-Type** | `application/json` |
| **응답 형식** | JSON |

---

## 2. 요청 명세

### 2-1. 요청 URL

```
POST https://openapi.naver.com/v1/datalab/search
```

### 2-2. 요청 헤더

| 헤더명 | 필수 | 설명 |
|--------|------|------|
| `X-Naver-Client-Id` | Y | 클라이언트 아이디 |
| `X-Naver-Client-Secret` | Y | 클라이언트 시크릿 |
| `Content-Type` | Y | `application/json` |

### 2-3. 요청 Body (JSON)

| 필드명 | 타입 | 필수 | 설명 |
|--------|------|------|------|
| `startDate` | String | **Y** | 조회 시작 날짜 (형식: `YYYY-MM-DD`, 최소 `2016-01-01` 이후) |
| `endDate` | String | **Y** | 조회 종료 날짜 (형식: `YYYY-MM-DD`, 오늘 날짜까지) |
| `timeUnit` | String | **Y** | 시간 단위: `date`(일별) / `week`(주별) / `month`(월별) |
| `keywordGroups` | Array | **Y** | 최대 5개 키워드 그룹 |
| `keywordGroups[].groupName` | String | **Y** | 그룹명 (결과에서 식별자로 사용) |
| `keywordGroups[].keywords` | Array | **Y** | 그룹 내 키워드 목록 (최대 20개, 서로 OR 조건으로 합산) |
| `device` | String | N | 기기 구분: `pc` / `mo` / (빈 문자열=전체) |
| `ages` | Array | N | 연령대 필터: `1`~`10` (아래 코드 참조) |
| `gender` | String | N | 성별 필터: `m`(남성) / `f`(여성) / (빈 문자열=전체) |

#### ages 코드표
| 코드 | 연령대 |
|------|--------|
| `1` | 0~12세 |
| `2` | 13~18세 |
| `3` | 19~24세 |
| `4` | 25~29세 |
| `5` | 30~34세 |
| `6` | 35~39세 |
| `7` | 40~44세 |
| `8` | 45~49세 |
| `9` | 50~54세 |
| `10` | 55세 이상 |

### 2-4. 요청 예시 (JSON Body)

```json
{
  "startDate": "2026-04-18",
  "endDate": "2026-04-25",
  "timeUnit": "date",
  "keywordGroups": [
    {
      "groupName": "주식",
      "keywords": ["주식", "코스피", "증시"]
    },
    {
      "groupName": "AI",
      "keywords": ["챗GPT", "생성형AI", "Claude"]
    },
    {
      "groupName": "부동산",
      "keywords": ["부동산", "아파트", "전세"]
    }
  ],
  "device": "",
  "ages": [],
  "gender": ""
}
```

---

## 3. 응답 명세 (JSON)

### 3-1. 응답 구조

```json
{
  "startDate": "2026-04-18",
  "endDate": "2026-04-25",
  "timeUnit": "date",
  "results": [
    {
      "title": "주식",
      "keywords": ["주식", "코스피", "증시"],
      "data": [
        { "period": "2026-04-18", "ratio": 45.26 },
        { "period": "2026-04-19", "ratio": 62.80 },
        { "period": "2026-04-20", "ratio": 100.00 },
        { "period": "2026-04-21", "ratio": 38.15 },
        { "period": "2026-04-22", "ratio": 22.50 },
        { "period": "2026-04-23", "ratio": 30.90 },
        { "period": "2026-04-24", "ratio": 55.70 },
        { "period": "2026-04-25", "ratio": 70.10 }
      ]
    },
    {
      "title": "AI",
      "keywords": ["챗GPT", "생성형AI", "Claude"],
      "data": [ ... ]
    }
  ]
}
```

### 3-2. 응답 필드 상세

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `startDate` | String | 조회 시작 날짜 |
| `endDate` | String | 조회 종료 날짜 |
| `timeUnit` | String | 조회 시간 단위 |
| `results` | Array | 키워드 그룹별 트렌드 결과 |
| `results[].title` | String | 요청 시 입력한 `groupName` |
| `results[].keywords` | Array | 그룹 내 키워드 목록 |
| `results[].data` | Array | 기간별 검색량 데이터 |
| `results[].data[].period` | String | 날짜 (YYYY-MM-DD) 또는 주/월 시작일 |
| `results[].data[].ratio` | Float | 조회 기간 내 최고 검색량을 100으로 기준화한 상대값 (0.0 ~ 100.0) |

> 💡 **ratio 해석**: 조회 기간 전체에서 가장 많이 검색된 날을 100으로 설정. 절대적 검색 수가 아닌 **상대적 비율**이므로 그룹 간 직접 비교 가능.

---

## 4. Node.js 구현 코드

```javascript
import fetch from 'node-fetch';

class NaverDataLabHarvester {
    constructor() {
        this.clientId = process.env.NAVER_CLIENT_ID;
        this.clientSecret = process.env.NAVER_CLIENT_SECRET;
        this.BASE_URL = 'https://openapi.naver.com/v1/datalab/search';
    }

    /**
     * 최근 N일 트렌드 키워드 조회
     * @param {Array} keywordGroups - [{ groupName: '주식', keywords: ['주식', '코스피'] }]
     * @param {number} days - 조회 기간 (기본 7일)
     * @returns {Array} 트렌드 결과 (ratio 높은 순 정렬)
     */
    async getTrends(keywordGroups, days = 7) {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - days);

        const formatDate = (d) => d.toISOString().split('T')[0]; // YYYY-MM-DD

        const body = {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate),
            timeUnit: 'date',
            keywordGroups,
            device: '',
            ages: [],
            gender: '',
        };

        try {
            const response = await fetch(this.BASE_URL, {
                method: 'POST',
                headers: {
                    'X-Naver-Client-Id': this.clientId,
                    'X-Naver-Client-Secret': this.clientSecret,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
                signal: AbortSignal.timeout(10000),
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(`[DataLab] HTTP ${response.status}: ${err.errorMessage || 'unknown'}`);
            }

            const data = await response.json();

            // 각 그룹의 최근 7일 평균 ratio 계산 → 높은 순 정렬
            return data.results.map(group => {
                const avgRatio = group.data.reduce((sum, d) => sum + d.ratio, 0) / group.data.length;
                return {
                    keyword: group.title,
                    keywords: group.keywords,
                    avgRatio: Math.round(avgRatio * 100) / 100,
                    latestRatio: group.data[group.data.length - 1]?.ratio || 0,
                    trend: group.data,
                };
            }).sort((a, b) => b.avgRatio - a.avgRatio);

        } catch (error) {
            console.error('[DataLab] 트렌드 조회 실패:', error.message);
            return [];
        }
    }

    /**
     * 채널 타입별 트렌드 키워드 Top 3 추출
     * → DataHarvester.harvestDailySources()의 seedKeywords로 주입
     */
    async getTopTrendKeywords(channelType) {
        const CHANNEL_GROUPS = {
            'finance-viral': [
                { groupName: '주식시장', keywords: ['주식', '코스피', '증시', '주가'] },
                { groupName: '글로벌주식', keywords: ['나스닥', '다우존스', '엔비디아', 'S&P500'] },
                { groupName: '국내기업', keywords: ['삼성전자', 'SK하이닉스', 'LG에너지솔루션', 'POSCO'] },
                { groupName: '금리부동산', keywords: ['금리', '부동산', '아파트', '전세'] },
                { groupName: '가상화폐', keywords: ['비트코인', '이더리움', '코인', '암호화폐'] },
            ],
            'ai-tips': [
                { groupName: 'AI도구', keywords: ['챗GPT', 'Claude', 'Gemini', 'Copilot'] },
                { groupName: '생성형AI', keywords: ['생성형AI', 'AI', '인공지능', 'LLM'] },
                { groupName: '직장인팁', keywords: ['직장인', '업무효율', '생산성', '자동화'] },
            ],
        };

        const groups = CHANNEL_GROUPS[channelType] || CHANNEL_GROUPS['finance-viral'];
        const trends = await this.getTrends(groups, 3); // 최근 3일 트렌드

        // avgRatio 상위 3개 키워드 반환
        return trends.slice(0, 3).map(t => t.keyword);
    }
}

export { NaverDataLabHarvester };
```

---

## 5. DataHarvester 통합 설계

```
DataHarvester.harvestDailySources() 호출 시:
    ↓
[신규] NaverDataLabHarvester.getTopTrendKeywords(channelType)
    → 실시간 트렌드 Top 3 키워드 반환
    ↓
seedKeywords에 주입 (기존 Legacy Lab 시드 방식 동일)
    ↓
NaverNewsHarvester.searchNews(keyword, { display: 100, sort: 'date' })
    → 뉴스 기사 수집 (구글 RSS 대체)
    ↓
CurationAgent → InstagramCardAgent → YouTube
```

### 한도 계산 (daily budget)
- DataLab 트렌드 조회: 채널 2개 × 1회 = **2회/일** (한도 1,000회 중 0.2%)
- 뉴스 검색: 키워드 10개 × display 100 = **10회/일** (한도 25,000회 중 0.04%)
- **총 여유 한도 매우 충분** ✅

---

## 6. 쇼핑인사이트 API (확장용)

| API | 엔드포인트 | 용도 |
|-----|-----------|------|
| 쇼핑 카테고리 트렌드 | `POST /v1/datalab/shopping/categories` | 쇼핑 카테고리 검색 추이 |
| 쇼핑 키워드 트렌드 | `POST /v1/datalab/shopping/category/keywords` | 카테고리 내 키워드 트렌드 |

> 쇼핑인사이트도 동일한 Client-ID/Secret으로 호출 가능 (별도 한도)

---

*정리: Sonnet (Claude Sonnet 4.6 / Antigravity) | 2026-04-25*
