# Phase 34: Codex Bridge (ChatGPT/Images 2) 연동 아키텍처 기획서

## 1. 기획 배경 (Background)
* **문제점:** 자체 이미지 생성 솔루션(MediaLab / NanoBanana 등) 개발을 시도했으나, 실무에 즉시 적용하기에는 완성도가 현저히 낮음.
* **해결책 (Pivot):** 자체 솔루션 고도화를 중단하고, 최근 압도적인 퀄리티(의도 반영률 최상)를 보여주는 **ChatGPT의 Images 2 (DALL-E 3 기반 등)** 모델을 도입하기로 결정.
* **목표:** 기존 **Antigravity Bridge**(Claude/Gemini 브릿지)와 병렬로 작동하는 **Codex Bridge**(ChatGPT/Images 2 브릿지)를 구축하여, API 추가 과금 없이 최고 성능의 이미지를 마이크루 내에서 생성 가능하게 함.

---

## 2. 듀얼 브릿지 아키텍처 (Dual Bridge Architecture)

기존 `.bridge` 폴더 기반의 파일 폴링 시스템을 확장하여, Antigravity(Google/Anthropic)와 Codex(OpenAI/ChatGPT)를 동시 지원합니다.

### 2.1 파일 시스템 라우팅 구조
안전한 분리 통신을 위해 브릿지 디렉토리를 다음과 같이 나눕니다 (혹은 파일 접두사로 구분).
* `.bridge/requests/req_anti_xxx.json` ➡️ **Antigravity App**이 감시 및 처리
* `.bridge/requests/req_codex_xxx.json` ➡️ **Codex App (ChatGPT 기반)**이 감시 및 처리

### 2.2 식별자(Identifier) 확장 체계
새로운 라우팅을 위해 `executor.js`와 `modelRegistry.js`에 식별자를 추가합니다.
* `anti-bridge-sonnet` (기존, Claude 계열)
* `anti-bridge-prime` (기존, Gemini/Opus 계열)
* **`codex-bridge-gpt4o`** (신규, ChatGPT 텍스트 처리용)
* **`codex-bridge-images2`** (신규, Images 2 이미지 생성 전용)

---

## 3. 구현 상세 (Implementation Steps)

### Step 1: `codexAdapter.js` 개발
기존 `antigravityAdapter.js`를 복제 및 수정하여 `codexAdapter.js`를 생성합니다.
* **역할:** `modelToUse`가 `codex-bridge-*`로 시작할 경우, `req_codex_` 접두사가 붙은 JSON을 `.bridge/requests/`에 떨굽니다.
* **이미지 페이로드 처리:** 텍스트 응답뿐만 아니라, ChatGPT가 생성한 이미지의 **Base64 데이터 또는 로컬 저장 경로**를 파싱할 수 있도록 응답 파서 로직을 강화합니다.

### Step 2: `executor.js` 라우팅 분기
```javascript
// executor.js 
if (modelToUse.startsWith('anti-bridge-')) {
    result = await antigravityAdapter.generateResponse(taskContent, finalSystemPrompt, agentKey);
} else if (modelToUse.startsWith('codex-bridge-')) {
    // Codex (ChatGPT) 브릿지로 요청 전달
    result = await codexAdapter.generateResponse(taskContent, finalSystemPrompt, agentKey);
} else {
    // 기존 Gemini API Direct 호출 로직
}
```

### Step 3: Media/Design 에이전트 재할당
* 이미지 생성 업무를 전담하는 에이전트(예: PICO, 혹은 신규 에이전트 PICASSO)의 서명 모델(Signature Model)을 `codex-bridge-images2`로 변경.
* 칸반 보드에서 디자인/이미지 기획 태스크가 해당 에이전트에게 할당되면, 텍스트가 아닌 이미지 페이로드가 즉각 반환되도록 워크플로우를 구성합니다.

---

## 4. 아키텍처의 장점 (Impact)

1. **최고의 품질과 비용 절감의 양립:** ChatGPT Plus 구독 등 이미 보유한 에셋을 브릿지로 연결하므로, OpenAI API에 건당 비용을 내지 않으면서도 세계 최고 수준의 이미지(Images 2)를 실무에 즉시 투입할 수 있습니다.
2. **모듈형 브릿지 확장성 보장:** `Anti-Bridge`와 `Codex-Bridge`가 병렬로 깔리면서, 향후 `Midjourney-Bridge`나 `Sora-Bridge` 등 어떤 클라이언트 기반 앱이 나오더라도 동일한 파일 폴링 방식으로 무한 확장이 가능한 **플러그인 아키텍처**가 완성됩니다.
3. **자체 개발 매몰 비용 회피:** 로컬 렌더링(Remotion 등)으로 고통받던 이미지/영상 렌더링 퀄리티 이슈를 완벽히 해결하고 기획과 운영에 집중할 수 있습니다.
