# [CKS v3.3] Anti-Bridge 아키텍처 기획서 (최종 통합본)

> **💡 기획 (대표님/Luca) + 보완 (Sonnet) + 총괄 리뷰 (Prime)** 

## 💡 아이디어 개요 (Core Concept)
현재 MyCrew 서버는 구글(Gemini) API만 가동 가능한 상태입니다. 그러나 CKS 연구 프레임워크의 무결성을 위해서는 다양한 지능망(Claude Opus, GPT-OSS 120B 등)의 교차 검증이 필수적입니다.
이에 대표님께서 제안하신 **'가상 세션 대역(Surrogate)'** 메커니즘을 기반으로, API 연동 없이 파일 시스템만으로 통신하는 **Anti-Bridge** 망을 구축합니다.

이 방식은 학계의 'API 필수' 전제를 깨고, **"IDE/에이전트 환경의 파일 I/O 능력을 활용한 비API 브릿지 오케스트레이션"**이라는 독자적인 논문 기여(Contribution) 요소를 갖습니다.

---

## 🔄 워크플로우 메커니즘 (Anti-Bridge Flow)

### 1. 사전 셋업: 1-Click Trigger 
대표님이 안티그래비티 상에 **프라임(Prime, Opus 4.6)**과 **넥서스(Nexus, GPT-120B)** 세션을 엽니다. 복잡한 컨텍스트 없이 "명령"이라는 단어에 파일 I/O를 수행하도록 약속만 해둡니다.

### 2. 서버의 셀프 컨테인드(Self-Contained) 요청 할당
서버가 올리/루나의 차례에 `.bridge/requests/req_prime_[ID].json` 파일을 씁니다. 
* **[중요]** 이때 프롬프트와 컨텍스트를 통째로 JSON 안에 담아, 대역 에이전트의 세션 기억 소실(Context Loss) 우려를 원천 차단합니다.

### 3. 지능 발현 및 결과 릴레이
대표님의 "명령" 입력 → 에이전트 스스로 파일 Read & Think → `.bridge/responses/`에 Write 수행 → 서버 폴링(Polling) 후 회수

---

## 🛡️ 프로덕션 레벨 방어 체계 (Edge Cases & Defenses)

소넷과 프라임의 리뷰를 반영하여 다음의 안전장치를 코드 レ벨(`antigravityAdapter.js`)에 내장합니다.

1. **Lock 파일 패턴 (Race Condition 방지)**: `.bridge/locks/` 폴더를 운영하여 동시 다발적 요청의 충돌을 방지합니다.
2. **타임아웃 및 Gemini Flash Fallback**: 대표님 부재 시 교착 상태(Deadlock)를 막기 위해, 5분(300초) 이상 응답이 없으면 즉시 Flash 모델이 대역을 맡습니다.
3. **실험 데이터 오염 방지 마커**: Fallback 발동 시, 결과 JSON에 `_meta.fallback = true` 플래그를 박아 CKS 논문 통계(TEI 효율 등)에서 아웃라이어로 자동 필터링 되도록 합니다.
4. **파싱 방어 레이어**: 에이전트가 마크다운 코드블록(` ```json `)을 섞어 쓰더라도 안전하게 제거하고 파싱합니다.

---

## 🛠️ 권장 구현 단계 (Timeline)

- **Phase 1**: 폴더 루트 구조 생성 (`.bridge/requests, responses, locks`)
- **Phase 2**: 코어 엔진 `antigravityAdapter.js` 신설 (폴링, 락, 펄백 로직 집대성)
- **Phase 3**: 라우팅 맵핑 (`executor.js` 및 `modelRegistry.js` 가상 식별자)
- **Phase 4**: 파일럿 테스트 및 로그 UI 연동

> 총 실행 예상 시간: **약 4~5시간 소요**. 대표님의 최종 승인이 떨어지면 Phase 1부터 개발을 시작합니다.
