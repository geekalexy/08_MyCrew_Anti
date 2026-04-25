# 네이버 오픈API 통합 개발 가이드 — MyCrew DataHarvester 적용

> **작성일**: 2026-04-25 | **정리자**: Sonnet (Claude Sonnet 4.6)  
> **용도**: DataHarvester 고도화 — 네이버 API 연동 실전 가이드

---

## 1. 즉시 적용 체크리스트

```
[ ] Step 1: 네이버 개발자 계정 생성 및 앱 등록
[ ] Step 2: .env에 NAVER_CLIENT_ID, NAVER_CLIENT_SECRET 추가
[ ] Step 3: NaverNewsHarvester 모듈 생성
[ ] Step 4: NaverDataLabHarvester 모듈 생성
[ ] Step 5: DataHarvester 통합 (기존 Google RSS와 병행)
[ ] Step 6: 키 동작 테스트
```

---

## 2. 앱 등록 상세 절차

### Step 1: 네이버 개발자 센터 앱 등록
1. https://developers.naver.com/apps/#/wizard/register 접속
2. 네이버 로그인 (계정 없으면 신규 가입)
3. 이용약관 동의 → 휴대폰 인증 (최초 1회)
4. 애플리케이션 등록 폼:
   - **애플리케이션 이름**: `MyCrew` (10자 이내 권장)
   - **사용 API**: 
     - ✅ `검색` (뉴스, 블로그 검색용)
     - ✅ `데이터랩(검색어트렌드)` (트렌드 키워드용)
     - ✅ `데이터랩(쇼핑인사이트)` (선택, 쇼핑 채널 추후)
   - **비로그인 오픈API 서비스 환경**: WEB 설정
     - 웹 서비스 URL: `http://localhost:3000` (개발용), `https://your-domain.com` (운영용)
5. **등록하기** 클릭
6. 발급된 **Client ID** / **Client Secret** 메모

### Step 2: .env 파일 설정

```bash
# /02_System_Development/01_아리_엔진/.env
# ====== 네이버 오픈API (비로그인 방식) ======
NAVER_CLIENT_ID=발급받은_클라이언트_아이디_입력
NAVER_CLIENT_SECRET=발급받은_클라이언트_시크릿_입력
```

> ⚠️ `.env`는 `.gitignore`에 이미 포함되어 있어 안전

---

## 3. API 한도 요약표

| API | 일일 한도 | 예상 사용량 | 여유율 |
|-----|----------|------------|--------|
| 뉴스 검색 | **25,000회** | 키워드 10개 × 1회 = 10회 | 99.96% |
| 블로그 검색 | **25,000회** | 필요 시 사용 | 99.9%+ |
| DataLab 트렌드 | **1,000회** | 채널 2개 × 1회 = 2회 | 99.8% |
| DataLab 쇼핑 | **1,000회** | 미사용 (예비) | 100% |

→ **실질적으로 한도 문제 없음** ✅

---

## 4. 비로그인 방식 API 호출 공통 패턴

### GET 방식 (검색 API)

```javascript
const response = await fetch(
  `https://openapi.naver.com/v1/search/news.json?query=${encodeURIComponent(keyword)}&display=100&sort=date`,
  {
    headers: {
      'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
      'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
    },
  }
);
```

### POST 방식 (DataLab API)

```javascript
const response = await fetch('https://openapi.naver.com/v1/datalab/search', {
  method: 'POST',
  headers: {
    'X-Naver-Client-Id': process.env.NAVER_CLIENT_ID,
    'X-Naver-Client-Secret': process.env.NAVER_CLIENT_SECRET,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ /* ... */ }),
});
```

---

## 5. DataHarvester 고도화 아키텍처 (v2)

```
DataHarvester v2 (고도화)
├── [신규] NaverDataLabHarvester
│   └── getTopTrendKeywords(channelType)
│       → 실시간 트렌드 Top 3 키워드 반환 (일 1회, 한도 2/1000)
│
├── [신규] NaverNewsHarvester  
│   └── searchNews(keyword, { display: 100, sort: 'date' })
│       → 네이버 뉴스 JSON 반환 (한도 10/25000)
│
└── [기존 유지] GoogleNewsHarvester (Fallback)
    └── fetchGoogleNews(keyword) — 네이버 API 실패 시 폴백
```

### harvestDailySources() 신규 흐름

```javascript
async harvestDailySources(channelType, seedKeywords = []) {
    // 1. DataLab에서 실시간 트렌드 키워드 수집
    const trendKeywords = await this.datalabHarvester.getTopTrendKeywords(channelType);
    
    // 2. 채널별 기본 키워드 + 트렌드 + 외부 시드 합산
    const baseKeywords = CHANNEL_KEYWORDS[channelType];
    const allKeywords = [...new Set([...trendKeywords, ...seedKeywords, ...baseKeywords])];
    
    // 3. 네이버 뉴스 API로 수집 (구글 RSS 대체)
    let allSources = [];
    for (const kw of allKeywords) {
        const items = await this.naverHarvester.searchNews(kw, { display: 100, sort: 'date' });
        allSources.push(...items);
        await sleep(100); // 100ms 간격
    }
    
    // 4. 네이버 실패 시 구글 RSS Fallback
    if (allSources.length === 0) {
        console.warn('[DataHarvester] 네이버 API 실패 → 구글 RSS Fallback');
        for (const kw of allKeywords) {
            const items = await this.fetchGoogleNews(kw);
            allSources.push(...items);
        }
    }
    
    // 5. 중복 제거 (originallink 기준)
    return dedup(allSources);
}
```

---

## 6. 오류 처리 공통 패턴

```javascript
// 인증 실패 감지
if (response.status === 401) {
    throw new Error('[NaverAPI] 인증 실패 — NAVER_CLIENT_ID/SECRET 확인 필요');
}

// 한도 초과 감지
if (response.status === 429) {
    console.warn('[NaverAPI] 일일 한도 초과 → Google RSS Fallback 실행');
    return this.fetchGoogleNews(keyword); // fallback
}

// JSON 오류 응답 파싱
const err = await response.json().catch(() => ({}));
// err.errorCode, err.errorMessage 확인
```

---

## 7. 참고 링크

| 자료 | URL |
|------|-----|
| 개발자 센터 메인 | https://developers.naver.com |
| 앱 등록 | https://developers.naver.com/apps/#/wizard/register |
| 내 앱 관리 | https://developers.naver.com/apps/#/list |
| 뉴스 검색 API 공식 문서 | https://developers.naver.com/docs/serviceapi/search/news/v1/news.md |
| DataLab 검색어트렌드 공식 문서 | https://developers.naver.com/docs/serviceapi/datalab/search/search.md |
| 오픈API 종류 목록 | https://developers.naver.com/docs/common/openapiguide/apilist.md |
| 오류 코드 목록 | https://developers.naver.com/docs/common/openapiguide/errorcode.md |
| 시연 GitHub (참고) | https://github.com/corazzon/st_navers |
| 네이버 데이터랩 웹 | https://datalab.naver.com/keyword/trendSearch.naver |

---

*정리: Sonnet (Claude Sonnet 4.6 / Antigravity) | 2026-04-25*
