# 네이버 뉴스 검색 API — 상세 레퍼런스

> **원본 출처**: https://developers.naver.com/docs/serviceapi/search/news/v1/news.md
> **작성일**: 2026-04-25 | **정리자**: Sonnet (Claude Sonnet 4.6)
> **용도**: DataHarvester 고도화 — 구글 뉴스 RSS → 네이버 뉴스 API 전환

---

## 1. API 개요

| 항목 | 내용 |
|------|------|
| **명칭** | 네이버 뉴스 검색 API |
| **설명** | 네이버 검색의 뉴스 검색 결과를 XML 또는 JSON 형식으로 반환하는 RESTful API |
| **인증 방식** | 비로그인 방식 (Client-ID + Client-Secret 헤더) |
| **일일 호출 한도** | **25,000회/일** |
| **초당 호출 한도** | 별도 명시 없음 (과도한 호출 시 차단 가능) |
| **응답 형식** | JSON 또는 XML (URL에 `.json` / `.xml` 명시) |

---

## 2. 요청 명세

### 2-1. 요청 URL

```
JSON:  GET https://openapi.naver.com/v1/search/news.json
XML:   GET https://openapi.naver.com/v1/search/news.xml
```

### 2-2. 요청 헤더

| 헤더명 | 필수 | 설명 |
|--------|------|------|
| `X-Naver-Client-Id` | Y | 애플리케이션 등록 후 발급받은 클라이언트 아이디 |
| `X-Naver-Client-Secret` | Y | 애플리케이션 등록 후 발급받은 클라이언트 시크릿 |

### 2-3. 요청 파라미터 (Query String)

| 파라미터 | 타입 | 필수 | 기본값 | 범위 | 설명 |
|---------|------|------|--------|------|------|
| `query` | String | **Y** | — | — | 검색어. **반드시 UTF-8로 인코딩**하여 전송 |
| `display` | Integer | N | 10 | 1 ~ 100 | 한 번에 표시할 검색 결과 개수 |
| `start` | Integer | N | 1 | 1 ~ 1000 | 검색 시작 위치 (페이지네이션) |
| `sort` | String | N | `sim` | `sim` / `date` | 정렬 방식: `sim`=정확도순, `date`=날짜순 |

> ⚠️ **start 최대값**: 1000. `display=100` 기준 최대 10,000개 수집 가능  
> ⚠️ **query 인코딩**: `encodeURIComponent(keyword)` 필수

---

## 3. 응답 명세 (JSON)

### 3-1. 응답 구조

```json
{
  "lastBuildDate": "Fri, 25 Apr 2026 12:00:00 +0900",
  "total": 152390,
  "start": 1,
  "display": 10,
  "items": [
    {
      "title": "삼성전자, 1분기 영업이익 <b>6조</b> 돌파",
      "originallink": "https://www.hankyung.com/article/...",
      "link": "https://n.news.naver.com/article/...",
      "description": "삼성전자가 올해 1분기 영업이익이 6조원을 돌파했다...",
      "pubDate": "Fri, 25 Apr 2026 09:30:00 +0900"
    }
  ]
}
```

### 3-2. 응답 필드 상세

| 필드명 | 타입 | 설명 |
|--------|------|------|
| `lastBuildDate` | dateTime | 검색 결과를 생성한 시간 (RFC 822 형식) |
| `total` | Integer | 총 검색 결과 개수 (실제 접근 가능 최대치: start 1000 × display 100 = 100,000건) |
| `start` | Integer | 검색 시작 위치 |
| `display` | Integer | 이번 응답에서 표시된 결과 개수 |
| `items` | Array | 개별 뉴스 기사 목록 |
| `items[].title` | String | 뉴스 기사 제목. **검색어는 `<b>` 태그로 강조됨** → 사용 시 HTML 태그 제거 필요 |
| `items[].originallink` | String | 언론사 원문 기사 URL |
| `items[].link` | String | 네이버 뉴스 서비스 URL. 네이버 뉴스에 없으면 원문 URL과 동일 |
| `items[].description` | String | 뉴스 기사 요약 내용 (최대 약 300자). **`<b>` 태그 포함** |
| `items[].pubDate` | dateTime | 뉴스 기사 발행 시간 (RFC 822 형식) |

> 💡 **`<b>` 태그 제거**: `title.replace(/<[^>]*>/g, '')` 로 처리

---

## 4. 오류 코드 (뉴스 검색 전용)

| 오류 코드 | HTTP 상태 | 설명 | 대응 방법 |
|----------|----------|------|---------|
| `SE01` | 400 | 잘못된 쿼리 요청 | query 파라미터 확인 |
| `SE02` | 400 | 부적절한 display 값 (1~100 초과) | display 범위 수정 |
| `SE03` | 400 | 부적절한 start 값 (1~1000 초과) | start 범위 수정 |
| `SE04` | 400 | 부적절한 sort 값 | `sim` 또는 `date`만 허용 |
| `SE06` | 400 | 잘못된 형식의 인코딩 | query를 UTF-8로 인코딩 |
| `024` | 401 | 인증 실패 | Client-ID, Secret 확인 |

---

## 5. Node.js 구현 코드

### 5-1. 기본 fetch 방식 (현재 DataHarvester 패턴)

```javascript
import fetch from 'node-fetch';

class NaverNewsHarvester {
    constructor() {
        this.clientId = process.env.NAVER_CLIENT_ID;
        this.clientSecret = process.env.NAVER_CLIENT_SECRET;
        this.BASE_URL = 'https://openapi.naver.com/v1/search/news.json';
    }

    /**
     * 네이버 뉴스 검색
     * @param {string} keyword - 검색 키워드 (UTF-8 자동 인코딩)
     * @param {object} options - { display: 100, start: 1, sort: 'date' }
     */
    async searchNews(keyword, options = {}) {
        const { display = 100, start = 1, sort = 'date' } = options;
        
        const params = new URLSearchParams({
            query: keyword,
            display: String(display),
            start: String(start),
            sort,
        });

        const url = `${this.BASE_URL}?${params.toString()}`;

        try {
            const response = await fetch(url, {
                headers: {
                    'X-Naver-Client-Id': this.clientId,
                    'X-Naver-Client-Secret': this.clientSecret,
                },
                signal: AbortSignal.timeout(8000), // 8초 타임아웃
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                throw new Error(`[NaverNews] HTTP ${response.status}: ${err.errorMessage || 'unknown'}`);
            }

            const data = await response.json();

            // <b> 태그 제거 + 필드 정규화
            return data.items.map(item => ({
                title: item.title.replace(/<[^>]*>/g, ''),
                description: item.description.replace(/<[^>]*>/g, ''),
                originallink: item.originallink,
                naverlink: item.link,
                pubDate: item.pubDate,
                source: 'naver_news',
                keyword,
            }));

        } catch (error) {
            console.error(`[NaverNews] "${keyword}" 수집 실패:`, error.message);
            return [];
        }
    }

    /**
     * 여러 키워드 병렬 수집 (단, API 한도 고려해 순차 처리 권장)
     * @param {string[]} keywords
     */
    async harvestMultiple(keywords) {
        const results = [];
        for (const kw of keywords) {
            const items = await this.searchNews(kw, { display: 100, sort: 'date' });
            results.push(...items);
            await new Promise(r => setTimeout(r, 100)); // 100ms 간격 (API 보호)
        }
        // 중복 제거 (originallink 기준)
        const seen = new Set();
        return results.filter(item => {
            if (seen.has(item.originallink)) return false;
            seen.add(item.originallink);
            return true;
        });
    }
}

export { NaverNewsHarvester };
```

### 5-2. 환경변수 설정 (.env)

```bash
# 네이버 오픈API 키 (비로그인 방식)
NAVER_CLIENT_ID=여기에_클라이언트_아이디_입력
NAVER_CLIENT_SECRET=여기에_클라이언트_시크릿_입력
```

---

## 6. 구글 뉴스 RSS vs 네이버 뉴스 API 비교

| 항목 | 구글 뉴스 RSS (현재) | 네이버 뉴스 API (신규) |
|------|-------------------|---------------------|
| **인증** | 불필요 | Client-ID + Secret 필요 |
| **한국어 뉴스** | 부분적 (글로벌 RSS) | ✅ 특화 (네이버 뉴스 전체) |
| **결과 품질** | 헤드라인 위주 | 요약 포함 (description) |
| **일일 한도** | 없음 (단, 차단 가능) | **25,000회** (키워드당) |
| **안정성** | 불안정 (503 빈번) | ✅ 안정적 (공식 API) |
| **날짜 정렬** | 불가 | ✅ `sort=date` 지원 |
| **원문 URL** | 링크 있음 | ✅ `originallink` + `naverlink` |
| **JSON 응답** | ❌ (XML만) | ✅ JSON 지원 |
| **속보 반응속도** | 빠름 (RSS 특성) | ✅ 실시간 |

---

*정리: Sonnet (Claude Sonnet 4.6 / Antigravity) | 2026-04-25*
