# 📐 PRD: Phase 26 — AI 콘텐츠 팩토리 파이프라인 (관심사 분석 → 멀티포맷 자동 생산)

> **작성자**: Sonnet | **날짜**: 2026-04-25  
> **상태**: 기획 확정 / 구현 진행 중 | **선행**: Phase 24 YouTube, Phase 25 Instagram  
> **NotebookLM**: 구조 완성, 핵심 로직 미완성 → 대표님 설정 필요 항목 있음 (Section 9 참고)

---

## 1. 전략 배경

> "뉴스 20개 → NotebookLM → 팟캐스트 → STT → 시나리오 → 롱폼/숏폼/카드뉴스"

현재 파이프라인은 키워드 → 뉴스 수집 → 시나리오 생성을 **Gemini가 직접** 처리.  
Phase 26은 **NotebookLM을 콘텐츠 두뇌**로 활용하여 더 깊이 있는 분석과 자연스러운 스크립트를 확보한다.

### 핵심 전환

| 항목 | AS-IS (현재) | TO-BE (Phase 26) |
|------|-------------|-----------------|
| 시나리오 소스 | Gemini가 뉴스 요약 후 직접 생성 | NotebookLM 팟캐스트 → STT → 시나리오 |
| 콘텐츠 깊이 | 단발성 AI 생성 | 실제 뉴스 20개 심층 분석 기반 |
| 출력 포맷 | YouTube Shorts 중심 | 롱폼 + 숏폼 + 카드뉴스 동시 생산 |
| 트렌드 소스 | 하드코딩 키워드 | 실시간 관심사 분석 → 자동 키워드 |

---

## 2. 관심사 분석 소스 리서치 결과

### 2-1. 플랫폼별 API 현황

| 플랫폼 | API 존재 | 상태 | 비용 | MyCrew 적용 |
|--------|---------|------|------|------------|
| **네이버 DataLab** | ✅ 공식 API | GA Stable | **무료** (1,000회/일) | ✅ **이미 완성** |
| **Google Trends** | ⚠️ 알파 | 초대 전용 | 미정 | ❌ 접근 불가 |
| **Twitter/X** | ✅ 있음 | Pay-per-use | $0.005/read, 트렌드는 고급 플랜 | ❌ 비용 과다 |
| **YouTube Trending** | ✅ Data API v3 | GA Stable | **무료** (할당량 내) | ✅ 추가 가능 |
| **인기 채널 분석** | ✅ Data API v3 | GA Stable | **무료** | ✅ 신규 추가 |

### 2-2. 결론

```
관심사 분석 소스 (확정):
  Primary   → 네이버 DataLab (이미 완성, 무료, 한국 트렌드 특화)
  Secondary → YouTube 인기 채널 최신 영상 주제 분석 (신규)
  Tertiary  → YouTube 인기 급상승 동영상 (mostPopular, 무료)
  
  ❌ Google Trends — 알파, 접근 불가
  ❌ Twitter/X — 비용 과다, 트렌드 데이터 제한적
```

### 2-3. YouTube 인기 채널 분석 전략 (신규)

**핵심 아이디어**: 이미 잘 되고 있는 채널이 다루는 주제 = 수요가 검증된 콘텐츠

#### 분석 대상 채널 (finance-viral 채널 기준)

| 채널명 | 채널 ID | 특징 |
|--------|---------|------|
| 슈카월드 | `UCsJ6RuBiTVWRX156FVbeaGg` | 경제/금융 스토리텔링 |
| 삼프로TV | `UCKDNof1GGlnTVFKMhSgFiJg` | 주식/시장 분석 |
| 박곰희TV | `UCpDOEG7cjPXMb_pkU7NAMHQ` | 재테크/ETF |
| 신사임당 | `UCOSWOxJvhGFyHpkFMx0jRlw` | 부동산/투자 |
| 머니인사이드 | `UCqR1e7VrqJn9GH_9DZhFBag` | 주식 분석 |

#### 수집 방식
```
YouTube Data API v3:
  search.list (channelId=채널ID, order=date, maxResults=5)
  → 최신 영상 5개 title + description + tags
  → Gemini로 핵심 키워드 3개 추출
  → 5개 채널 × 3개 = 최대 15개 보완 키워드
```

#### 기대 효과
- 실제로 뷰가 나오는 주제 = 우리 채널에도 유효
- 언론 뉴스가 놓친 커뮤니티/실용 주제 포착
- 채널 정체성 경쟁 벤치마킹

---

## 3. 새로운 파이프라인 전체 구조

```
┌─────────────────────────────────────────────────────────────────┐
│          PHASE 26 — AI 콘텐츠 팩토리 파이프라인                  │
└─────────────────────────────────────────────────────────────────┘

[STEP 1] 관심사 분석 (Interest Analyzer)
    [1A] 네이버 DataLab    → 검색어 트렌드 Top 5 키워드 ← ✅ 완성
    [1B] 인기 유튜브 채널   → 최신 영상 주제 키워드 (5채널 × 3개) ← 🔲 신규
    [1C] YouTube 급상승    → mostPopular 영상 키워드 ← 🔲 신규
    ↓ 합산 + Gemini 정제 → 최종 수집 키워드 10~15개

[STEP 2] 뉴스 수집 (DataHarvester v2 — 완성)
    네이버 뉴스 API → 키워드별 100건 수집
    중복 제거 → 후보 풀 확보
    ↓

[STEP 3] 핵심 뉴스 선별 (CurationAgent — 기존)
    Gemini 2.5 Pro → 후보 풀에서 최종 20개 선별
    선별 기준: 임팩트 + 신뢰도 + 바이럴 가능성
    ↓ 20개 기사 링크

[STEP 4] NotebookLM 분석 (NotebookLMAdapter — ⚠️ 미완성)
    20개 뉴스 링크 → NotebookLM API (Discovery Engine)
    → 팟캐스트(Audio Overview) 생성 요청
    ↓ 오디오 파일 (.wav/.mp3)
    
    ⚠️ 미완성 항목:
    - GOOGLE_CLOUD_PROJECT_NUMBER .env 미등록
    - 소스 업로드 API (notebooks-sources) 미구현
    - Google Workspace Enterprise 라이선스 필요

[STEP 5] STT 변환 (SpeechToTextAgent — 신규)
    Google Cloud Speech-to-Text API
    → 팟캐스트 오디오 → 텍스트 스크립트
    ↓ 완성 스크립트 (대화 형식, 심층 분석 포함)

[STEP 6] 시나리오 생성 (ScenarioAgent — 개선)
    STT 스크립트 기반으로 Gemini가 재가공:
    → 롱폼 시나리오 (5~10분 유튜브)
    → 숏폼 시나리오 (60초 Shorts)
    → 카드뉴스 5장 카피 (Phase 25 InstagramCardAgent 입력)
    ↓

[STEP 7A] 롱폼 생산
    TTS(Google Cloud) → 영상(VideoAdapter) → YouTube 업로드

[STEP 7B] 숏폼 생산
    기존 YouTube Shorts 파이프라인

[STEP 7C] 카드뉴스 생산
    InstagramCardAgent(Phase 25) → 인스타 Carousel 게시

[OPTIONAL] NotebookLM 슬라이드
    NotebookLM API → 슬라이드 생성 (지원 여부 확인 필요)
    → 블로그/LinkedIn 포스트용
```

---

## 4. 각 스텝 상세 설계

### STEP 1 — 관심사 분석 (Interest Analyzer)

```javascript
// InterestAnalyzer.js (신규)
class InterestAnalyzer {
    // 채널 타입별 분석 대상 인기 유튜브 채널 목록
    BENCHMARK_CHANNELS = {
        'finance-viral': [
            { name: '슈카월드',   id: 'UCsJ6RuBiTVWRX156FVbeaGg' },
            { name: '삼프로TV',   id: 'UCKDNof1GGlnTVFKMhSgFiJg' },
            { name: '박곰희TV',   id: 'UCpDOEG7cjPXMb_pkU7NAMHQ' },
            { name: '신사임당',   id: 'UCOSWOxJvhGFyHpkFMx0jRlw' },
            { name: '머니인사이드', id: 'UCqR1e7VrqJn9GH_9DZhFBag' },
        ],
        'ai-tips': [
            { name: '생성AI연구소', id: 'UC_xxx1' },
            { name: 'AI 활용법',   id: 'UC_xxx2' },
        ],
    };

    async analyze(channelType) {
        // [1] 네이버 DataLab 트렌드 (완성)
        const naverTrends = await this.dataLab.getTopTrendKeywords(channelType, 5);
        
        // [2] 인기 유튜브 채널 최신 영상 주제 추출 (신규)
        const channelTopics = await this.getChannelTopics(channelType);
        
        // [3] YouTube 급상승 동영상 키워드 (신규)
        const trendingTopics = await this.getYouTubeTrending(channelType);
        
        // [4] 합산 + Gemini 중복/유사어 정제
        const raw = [...new Set([...naverTrends, ...channelTopics, ...trendingTopics])];
        return await this.refineWithGemini(raw, channelType); // 최종 10~15개
    }
    
    async getChannelTopics(channelType) {
        // 채널별 최신 영상 5개 → title+description+tags → Gemini 키워드 추출
        const channels = this.BENCHMARK_CHANNELS[channelType] || [];
        const allKeywords = [];
        for (const ch of channels) {
            const videos = await this.fetchRecentVideos(ch.id, 5);
            const kws = await this.extractKeywords(videos, ch.name);
            allKeywords.push(...kws.slice(0, 3)); // 채널당 최대 3개
        }
        return allKeywords;
    }
    
    async getYouTubeTrending(channelType) {
        // GET /videos?chart=mostPopular&regionCode=KR&videoCategoryId=25&maxResults=10
        // → 한국 뉴스/정치 카테고리 인기 영상 키워드
    }
    
    async refineWithGemini(keywords, channelType) {
        // 유사어 병합, 너무 광범위한 키워드 제거
        // 예: ['주식', '주식 시장', '증시'] → ['주식시장']
    }
}
```

### STEP 3 — 뉴스 선별 기준 (20개 선택 로직)

```
선별 기준 (CurationAgent 프롬프트):
  1. 임팩트: 조회수 추정, 감정 반응 유도 가능성
  2. 신뢰도: 언론사 신뢰도 (대형 언론 우선)
  3. 다양성: 동일 사건 중복 기사 제거
  4. 시의성: pubDate 기준 최신 24시간 우선
  5. 채널 적합성: 금융/AI 채널 방향성 일치 여부
  → 최종 20개 링크만 NotebookLM에 전달
```

### STEP 5 — STT 변환 (SpeechToTextAgent)

```javascript
// SpeechToTextAgent.js (신규)
// Google Cloud Speech-to-Text API v2 사용
// - 모델: latest_long (장시간 오디오)
// - 언어: ko-KR
// - 화자 분리(diarizationConfig): true → 두 진행자 구분
// → 화자 A/B 레이블로 대화 스크립트 구조화

class SpeechToTextAgent {
    async transcribe(audioFilePath) {
        // 1. 오디오 파일 → GCS 업로드 (5분 초과 시 필요)
        // 2. LongRunningRecognize API 호출
        // 3. 결과: [{ speaker: 'A', text: '...' }, { speaker: 'B', text: '...' }]
        // 4. 화자 A/B → 진행자1/진행자2 역할 매핑
    }
}
```

### STEP 6 — 멀티포맷 시나리오 분기

```javascript
// ScenarioAgent 개선
async generateMultiFormat(sttScript, channelType) {
    // NotebookLM STT 스크립트 기반으로 세 포맷 동시 생성
    return await Promise.all([
        this.generateLongform(sttScript),    // 롱폼 (5~10분)
        this.generateShortform(sttScript),   // 숏폼 (60초)
        this.generateCardnews(sttScript),    // 카드뉴스 5장 카피
    ]);
}
```

---

## 5. 구현 우선순위 (Sprint 계획)

### Sprint 1 — 관심사 분석 고도화 (소넷)
| 순위 | 작업 | 파일 | 예상 시간 |
|------|------|------|---------|
| P0 | YouTube Data API Key 발급 ← **대표님 선행 필요** | 설정 | 30m |
| P0 | InterestAnalyzer.js — 채널 분석 + 트렌딩 통합 | 신규 | 3h |
| P1 | DataHarvester와 통합 테스트 | 수정 | 1h |

### Sprint 2 — NotebookLM 완성 (루카 주도)
| 순위 | 작업 | 파일 | 예상 시간 |
|------|------|------|---------|
| P0 | GOOGLE_CLOUD_PROJECT_NUMBER .env 등록 ← **대표님 선행 필요** | 설정 | 10m |
| P0 | NotebookLM 소스 업로드 API 구현 | NotebookLMAdapter.js | 3h |
| P0 | Enterprise 라이선스 확인 ← **대표님 확인 필요** | — | — |
| P1 | 팟캐스트 생성 → 오디오 파일 반환 검증 | 테스트 | 1h |

### Sprint 3 — STT 에이전트 (소넷)
| 순위 | 작업 | 파일 | 예상 시간 |
|------|------|------|---------|
| P0 | SpeechToTextAgent.js 구현 | 신규 | 3h |
| P1 | 화자 분리 + 스크립트 구조화 | 수정 | 2h |

### Sprint 4 — 파이프라인 통합 (소넷 + 루카)
| 순위 | 작업 | 파일 | 예상 시간 |
|------|------|------|---------|
| P0 | NotebookLM → STT → ScenarioAgent 연결 | index.js | 3h |
| P0 | 멀티포맷 시나리오 분기 구현 | ScenarioAgent.js | 2h |
| P1 | Phase 25 카드뉴스와 연동 | 통합 | 2h |

---

## 6. 기술 스택 및 API 목록

| API | 용도 | 비용 | 상태 |
|-----|------|------|------|
| 네이버 DataLab | 트렌드 키워드 | 무료 | ✅ 완성 |
| 네이버 뉴스 검색 | 뉴스 수집 | 무료 | ✅ 완성 |
| YouTube Data API v3 (읽기용 Key) | 채널 분석 + 트렌딩 | 무료 (10,000유닛/일) | 🔲 Sprint 1 |
| NotebookLM Enterprise API | 팟캐스트 생성 | GCP 과금 | ⚠️ 미완성 |
| Google Cloud STT v2 | 팟캐스트 → 텍스트 | $0.016/분 | 🔲 Sprint 3 |
| Gemini 2.5 Pro | 키워드 정제 + 시나리오 | GCP 과금 | ✅ 기존 |
| Google Cloud TTS | 영상 나레이션 | GCP 과금 | ✅ 기존 |

### STT 비용 추정
- NotebookLM 팟캐스트 평균 길이: 10~15분
- STT 비용: 15분 × $0.016 = **$0.24/회** (약 350원)
- 일 1회 기준: 월 $7.2 ≈ 약 1만원 → **허용 범위**

---

## 7. 미결 사항

> [!IMPORTANT]
> **NotebookLM 슬라이드 API 지원 여부 확인 필요** — 루카에게 확인 요청  
> Discovery Engine API에 슬라이드 생성 엔드포인트 존재 여부

> [!NOTE]
> STT 화자 분리: NotebookLM 팟캐스트는 2명의 AI 진행자 → 화자 A/B 레이블로  
> 시나리오에서 "진행자1/진행자2 대화 → 단일 나레이션" 변환 전처리 필요

> [!NOTE]
> YouTube 채널 ID 확인: 위 벤치마크 채널 목록의 채널 ID는 추정값 — 실제 ID 검증 필요

---

## 9. 🔴 대표님이 하실 일 (순서대로)

### [즉시] Google Cloud 프로젝트 번호 확인 → .env 등록

1. https://console.cloud.google.com 접속
2. 상단 프로젝트 선택 → 대시보드에서 **프로젝트 번호** (12자리) 확인
3. `.env`에 추가:
```
GOOGLE_CLOUD_PROJECT_NUMBER=123456789012
GOOGLE_CLOUD_LOCATION=global
```

### [즉시] NotebookLM Enterprise 사용 가능 여부 확인

> ⚠️ NotebookLM API는 **Google Workspace Business/Enterprise** 계정 +  
> **Gemini Enterprise 부가기능** 라이선스가 있어야 사용 가능합니다.

- Google Cloud Console → **API 및 서비스 → 라이브러리** 에서
  - `Discovery Engine API` 검색 → **사용 설정** 확인
- 만약 라이선스 없으면: **현재 OAuth 토큰 방식으로 대체 불가** → 루카와 별도 논의 필요

### [오늘 중] YouTube Data API Key 발급 (읽기 전용)

> 기존 `YOUTUBE_CLIENT_ID`(업로드용 OAuth)와 **다른 키** 필요

1. Google Cloud Console → **API 및 서비스 → 라이브러리**
2. `YouTube Data API v3` 검색 → 사용 설정
3. **사용자 인증정보 → API 키 만들기** → 복사
4. `.env`에 추가:
```
YOUTUBE_DATA_API_KEY=발급받은_API_키
```

### [확인 후] 루카에게 전달할 사항
- `GOOGLE_CLOUD_PROJECT_NUMBER` 등록 완료 여부
- NotebookLM Enterprise 라이선스 유무
- NotebookLM 소스 업로드 API 구현 요청 (현재 TODO 상태)

---

## 10. 다음 단계

```
대표님 설정 완료 후:
  [ ] InterestAnalyzer.js 구현 (소넷)
  [ ] NotebookLM 소스 업로드 완성 (루카)
  [ ] E2E 크루 작업 테스트 (아리 → 태스크 카드)
```

---

*작성: Sonnet (Claude Sonnet 4.6 / Antigravity) | 2026-04-25 14:54 KST*  
*Phase 25 (Instagram) → Phase 26 (AI 콘텐츠 팩토리) → Phase 27 (반응 기반 최적화)*
