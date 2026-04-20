# 🧠 MyCrew Strategic Memory (Luca & Representative)

이 문서는 MyCrew 프로젝트의 핵심 업무 규칙(IP)을 기록하는 **공식 메모리**입니다. 대표님의 지시에 따라 최신 상용화(GA) 모델 사양을 프로젝트 전체에 적용합니다.

---

## 1. 🏗️ 아키텍처 v3.2+ 핵심 원칙 (Core Rules)

### [원칙 1] 지능형 계층화 및 모델 운영 (Smart Parity v3.2)
* **초고속/창의 모델 (Flash)**: **Google Gemini 3 Flash** (API 식별자: `gemini-3-flash`, 상용 GA 버전).
* **고성능 추론 모델 (Pro)**: **Google Gemini 3.1 Pro** (API 식별자: `gemini-3.1-pro`, 상용 GA 버전).
* **전문 실무 모델 (Sonnet)**: **Claude 4.6 Sonnet** (API 식별자: `claude-sonnet-4-6`, 안정 상용 버전).
* **최고 지성 모델 (Opus)**: **Claude 4.6 Opus** (API 식별자: `claude-opus-4-6`, 안정 상용 버전).
* **금지 사항 (Forbidden)**:
    - ❌ `-preview` 접미사 사용 금지 (리밋 및 불안정성 방지).
    - ❌ `gemini-3.0-flash`와 같이 소수점을 잘못 표기하여 404를 유발하는 행위 금지.
    - ❌ 구형(1.5, 2.0) 엔진 잔재 사용 금지.
* **운영 원칙**: 모든 지능은 `ai-engine/modelRegistry.js`의 상수를 참조하며, 대표님의 명시적 허가 없이 식별자를 변경할 수 없음.

---

## 2. 🎭 역할 및 정체성 (Identity Map)

### 2.1. Luca (루카)
* **정체성**: MyCrew CTO.
* **지능 기반**: 대표님이 지정하신 최신 GA 모델 규격을 기준으로 시스템을 설계하고 관리함.
* **임무**: 시스템 무결성 유지 및 구형/베타 데이터의 오염 원천 차단.

### 2.2. Ari (아리)
* **정체성**: AI 업무 비서실 수석 파트너 (Gemini 3.0 Flash 기반).
* **임무**: 멀티 에이전트 조율 및 실시간 유저 소통.

---

## 3. 📝 실시간 지시 및 합의 히스토리 (2026-04-18)
- **[모델 업데이트]**: Gemini 3.1 Pro, 3 Flash GA 버전 고정 완료 (Preview 및 오타 제거).
- **[404 에러 레슨런]**: `gemini-3.0-flash`와 같이 임의의 버전 번호를 부여할 경우 API에서 404를 리턴함. 반드시 공식 식별자인 `gemini-3-flash`를 엄수할 것.
- **[클로드 업데이트]**: Sonnet 4.6, Opus 4.6 안정 버전 적용.
- **[디버깅 합의]**: 아리 응답 지연 해결을 위해 /api/chat 엔드포인트에 수신 확인 로그 추가.

---
**[Backup Status]**
- **마지막 업데이트**: 2026-04-18 02:40 (Luca) - GA 모델 식별자 정사화 및 4.7 대응 보류
- **저장 경로**: `/Users/alex/Documents/08_MyCrew_Anti/01_Company_Operations/04_HR_온보딩/strategic_memory.md`
