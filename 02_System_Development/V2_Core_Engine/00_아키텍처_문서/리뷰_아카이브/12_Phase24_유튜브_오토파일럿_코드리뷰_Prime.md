# 🛡️ Supreme Advisor (Prime) — YouTube Autopilot 파이프라인 코드 리뷰 (12th Review)

**리뷰어:** Prime (Claude Opus 4.7) — Supreme Advisor
**대상:** MyCrew YouTube Autopilot — 6-Stage Multi-Agent Pipeline
**일시:** 2026-04-23 (Phase 24.5 코드 리뷰)
**참조:** Sonnet 브리핑 문서 (PRIME_BRIEFING_20260423.md)

---

## 📊 총평: 놀라운 진전. 파이프라인 골격은 건실하나, 핵심 1곳이 시한폭탄

8일 전(4/15) 에이전트 전원 마비 상태에서, 지금은 **6-Stage 완전자동화 파이프라인이 실제 YouTube 업로드까지 성공**했습니다. 대표님과 Sonnet의 전진 속도는 인상적입니다.

하지만 **CurationAgent.js에 4월 15일 이전의 유령이 그대로 살아있습니다.** 이것이 지금 가장 위험합니다.

---

## 🔴 P0-1: CurationAgent — 구버전 SDK + 환각 모델명 (가장 위험)

### 현재 코드 (CurationAgent.js L1 + L54)

```javascript
// L1: 구버전 SDK 사용! 엔진 나머지는 @google/genai로 전환 완료됨
import { GoogleGenerativeAI } from '@google/generative-ai';

// L54: 환각 모델명! strategic_memory.md에서 금지된 식별자
const model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
```

### 왜 위험한가

| 항목 | CurationAgent (현재) | 엔진 나머지 (정상) |
|:---|:---|:---|
| SDK | `@google/generative-ai` (구버전) | `@google/genai` v1.49+ |
| 모델명 | `gemini-1.5-flash` ❌ 환각 | `gemini-2.5-flash` ✅ |
| API 호출 | `getGenerativeModel()` 구형 | `ai.models.generateContent()` 신형 |
| 키 관리 | `process.env` 직접 참조 | `keyProvider` 브릿지 |

**`gemini-1.5-flash`는 strategic_memory.md에서 명시적으로 금지된 환각 식별자입니다.** 현재 작동하는 것은 구글이 레거시 호환을 유지해주고 있기 때문이며, 언제든 404로 전환될 수 있습니다.

### 수정 코드

```javascript
// CurationAgent.js — 전면 교체
import { GoogleGenAI } from '@google/genai';
import keyProvider from '../../tools/keyProvider.js';
import { MODEL } from '../../modelRegistry.js';

export class CurationAgent {
    constructor() {
        this.ai = null;
    }

    async _ensureClient() {
        if (this.ai) return;
        const apiKey = await keyProvider.getKey('GEMINI_API_KEY');
        if (apiKey) this.ai = new GoogleGenAI(apiKey);
        else throw new Error('GEMINI_API_KEY 미등록');
    }

    async analyzeAndSelectTop3(rawSources, channelType) {
        await this._ensureClient();
        // ... 기존 프롬프트 로직 유지 ...

        const result = await this.ai.models.generateContent({
            model: MODEL.FLASH,  // gemini-2.5-flash (중앙 관리)
            contents: prompt,
            config: { temperature: 0.8 }
        });

        let responseText = result.text.trim();
        // ... 파싱 로직 유지 ...
    }
}
```

**변경 포인트 3가지:**
1. `@google/generative-ai` → `@google/genai` (엔진 통일)
2. `"gemini-1.5-flash"` → `MODEL.FLASH` (modelRegistry 중앙 관리)
3. `process.env.GEMINI_API_KEY` → `keyProvider.getKey()` (3-Tier 브릿지)

---

## 🔴 P0-2: CurationAgent — Fallback 데이터가 항상 동일한 뉴스

```javascript
// L67-81: 429 에러 시 항상 같은 "엔비디아 젠슨황" 뉴스 반환
const fallbackTop3 = [{
    selectedSourceTitle: "엔비디아 젠슨황 깜짝 발언, '진짜 수혜주' 밝혀졌다",
    totalScore: 98,
    scenario: { /* 3개 씬만 존재 (5개여야 함) */ }
}];
```

**문제 2가지:**
1. **Fallback이 3개 씬만 포함** — 정상 시나리오는 5개 씬(hook/problem/proof/climax/cta)인데, Fallback은 3개(hook/problem/proof)만 있음. ImageLabAgent/TTSAgent가 5개를 기대하면 영상이 불완전
2. **항상 같은 뉴스** — 채널이 매일 같은 "엔비디아" 영상만 올라감

### 권고

```javascript
// 최소한 5개 씬을 완비한 Fallback + 날짜 기반 다변화
const fallbackScenarios = {
    finance: [ /* 3~5개의 다른 금융 시나리오 */ ],
    'ai-tips': [ /* 3~5개의 AI 시나리오 */ ],
};
// 실패 시: 날짜 % 개수 로 로테이션
const idx = new Date().getDate() % fallbackScenarios[channelType].length;
return [fallbackScenarios[channelType][idx]];
```

---

## 🟡 P1-1: TTSAgent — API 키 혼용 위험

```javascript
// TTSAgent.js L23-26
const apiKey = process.env.GEMINI_API_KEY;
const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
```

**Gemini API 키와 Google Cloud TTS API 키는 별개 서비스입니다.** 현재 동일한 키로 작동하고 있다면, 이것은 해당 GCP 프로젝트에서 두 API가 모두 활성화되어 있기 때문이지 보장된 동작이 아닙니다.

### 권고

```javascript
// 별도 환경변수 분리 (Fallback으로 GEMINI_API_KEY 허용)
const apiKey = process.env.GOOGLE_CLOUD_TTS_KEY || process.env.GEMINI_API_KEY;
```

그리고 `keyProvider` 브릿지도 사용하세요:

```javascript
const apiKey = await keyProvider.getKey('GOOGLE_CLOUD_TTS_KEY')
            || await keyProvider.getKey('GEMINI_API_KEY');
```

---

## 🟡 P1-2: TTSAgent — `durationFrames` 덮어쓰기 (규칙 2 위배)

```javascript
// TTSAgent.js L94
scene.durationFrames = dynamicFrames;  // 원본 값 소실!
```

ImageLabAgent는 **규칙 2(기존 scenes 배열 불변 보존)**를 완벽히 준수합니다(`{ ...scene, assetImage }`). 하지만 TTSAgent는 `scene.durationFrames`를 직접 덮어씁니다.

현재는 의도적 설계(음성 길이에 맞춤)이므로 기능적 버그는 아니지만, **CurationAgent가 설정한 원래 durationFrames 값이 영구 소실**됩니다.

### 권고

```javascript
scene.originalDurationFrames = scene.durationFrames; // 원본 보존
scene.durationFrames = dynamicFrames;                 // 음성 기반 재계산
```

---

## 🟡 P1-3: TTSAgent — 글자 수 기반 프레임 추정의 한계

```javascript
// L90-92
const charDuration = 0.24 / profile.speakingRate;
const estimatedSeconds = (textToSpeak.length * charDuration) + 1.2;
```

한글/영문 혼합, 숫자, 쉼표 등에 따라 실제 TTS 길이와 추정치가 최대 30% 이상 차이날 수 있습니다.

### 장기 권고: ffprobe 실제 측정 도입

```javascript
import { execSync } from 'child_process';

function getAudioDuration(filePath) {
    try {
        const result = execSync(
            `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
            { encoding: 'utf8' }
        );
        return parseFloat(result.trim());
    } catch {
        return null; // ffprobe 없으면 기존 추정식 Fallback
    }
}

// TTS 파일 저장 후:
const actualDuration = getAudioDuration(absolutePath);
const estimatedSeconds = actualDuration || (textToSpeak.length * charDuration) + 1.2;
```

**효과:** 영상-음성 싱크 정밀도가 비약적으로 개선됨. ffprobe가 없는 환경에서는 기존 추정식으로 자동 Fallback.

---

## 🟢 P2: DataHarvester — engagementScore 시뮬레이션

```javascript
// L37: 랜덤 점수
engagementScore: Math.floor(Math.random() * 500) + 50

// L68: 트위터도 랜덤
engagementScore: Math.floor(Math.random() * 800) + 200
```

CurationAgent의 프롬프트에 `예상관심도: ${s.engagementScore}`로 전달되므로, **완전 랜덤 점수가 AI의 판단을 오염**시킵니다. 현재 MVP에서는 무해하지만, 실제 운영에서는 Google News의 실제 공유 수나 댓글 수를 파싱하거나, `engagementScore` 필드 자체를 제거하고 CurationAgent에게 제목만으로 판단하게 하는 것이 낫습니다.

---

## 🟢 P2: index.js — 구조적 개선점 2가지

### 1. 하드코딩된 경로

```javascript
// L59
const publicDir = '/Users/alex/Documents/08_MyCrew_Anti/...';
```

→ `path.resolve(process.cwd(), 'remotion-poc/public')` 또는 환경변수로 교체

### 2. 파일 실행 시 무조건 파이프라인 가동

```javascript
// L115-120: 모듈 스코프에서 즉시 실행
console.log('초기화 중...');
await runAutopilotPipeline('finance');
```

이 파일을 `import`하면 파이프라인이 즉시 가동됩니다. ESM에서는 이것이 사이드이펙트입니다.

→ `import.meta.url` 가드 추가:

```javascript
if (import.meta.url === `file://${process.argv[1]}`) {
    await runAutopilotPipeline('finance');
}
```

---

## 📺 콘텐츠 전략 제안: 5단계 시나리오 강화

현재 CurationAgent의 5단계(Hook/Problem/Proof/Climax/CTA) 구성 자체는 좋습니다. 개선 포인트:

| 씬 | 현재 | 개선 방향 |
|:---|:---|:---|
| **Hook** (0~3초) | 텍스트 2줄 | **숫자 + 감정**: "87%가 모르는 사실..." |
| **Problem** (3~10초) | 문제 제기 | **대비 구조**: "어제까지 vs 오늘" 시각적 대비 |
| **Proof** (10~18초) | 데이터 제시 | **출처 명시**: "JP모건 리포트" 신뢰성 강화 |
| **Climax** (18~25초) | AI 이미지 | **반전**: 예상과 반대되는 결론 |
| **CTA** (25~30초) | 구독 유도 | **다음 편 예고**: "내일은 더 충격적인..." 시리즈 후킹 |

---

## 🏆 품질 게이트 체크리스트 (채널 업로드 기준)

| # | 항목 | 기준 | 자동 검증 가능 |
|:---|:---|:---|:---|
| 1 | 영상 길이 | 15~58초 (Shorts 규격) | ✅ ffprobe |
| 2 | 음성-영상 싱크 | 오차 0.5초 이내 | ✅ ffprobe vs frames |
| 3 | 씬 수 | 정확히 5개 | ✅ scenes.length |
| 4 | Hook 텍스트 | 15자 이내 | ✅ textLines[0].length |
| 5 | 이미지 해상도 | 1080x1080 이상 | ✅ 파일 메타 |
| 6 | 제목 길이 | 90자 이내 | ✅ title.length |
| 7 | Fallback 사용 여부 | 경고 로그 | ⚠️ 수동 확인 |

```javascript
// index.js에 추가할 품질 게이트 함수
function qualityGate(scenario, mp4Path) {
    const checks = [];
    if (scenario.scenes.length !== 5) checks.push('씬 수 불일치');
    if (!scenario.scenes.every(s => s.audioFile)) checks.push('오디오 누락');
    const totalSec = scenario.totalDurationFrames / 30;
    if (totalSec < 15 || totalSec > 58) checks.push(`길이 부적합: ${totalSec}초`);
    
    if (checks.length > 0) {
        console.warn(`⚠️ [품질 게이트] 불합격: ${checks.join(', ')}`);
        return false;
    }
    console.log('✅ [품질 게이트] 통과 — 업로드 가능');
    return true;
}
```

---

## 📊 수정 우선순위

| 순위 | 항목 | 파일 | 소요 |
|:---|:---|:---|:---|
| **P0** | SDK + 모델명 + keyProvider 통합 | CurationAgent.js | 15분 |
| **P0** | Fallback 5개 씬 완비 | CurationAgent.js | 10분 |
| **P1** | TTS API 키 분리 | TTSAgent.js | 5분 |
| **P1** | ffprobe 실측 도입 | TTSAgent.js | 20분 |
| **P2** | 경로 하드코딩 제거 | index.js | 5분 |
| **P2** | 품질 게이트 함수 | index.js | 15분 |

---

## ✅ 잘된 것

1. **ImageLabAgent 규칙 준수** — 불변성(spread), fallback, transparent PNG 3규칙 완벽 이행
2. **HTML 로컬 템플릿 전환** — Gemini 의존성 제거 결정은 운영 안정성 관점에서 올바른 판단
3. **TTS A/B/C 다중 버전** — 목소리별 비교 테스트 구조는 실제 채널 운영에 매우 유용
4. **파이프라인 E2E 성공** — 6-Stage 완전 자동화가 실제 영상까지 나온 것은 큰 성과
5. **YouTube 업로드 안전장치** — `dryRun: true`, `privacy: 'private'` 기본값은 올바른 방어

---

**— Prime (Supreme Advisor)**
**"CurationAgent.js L1과 L54를 먼저 고치세요. 4월 15일의 유령이 아직 거기 있습니다."**
