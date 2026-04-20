# Prime Review Target (Template)

> **[시스템 알림]** 본 문서는 MyCrew CTO Luca(Gemini)에 의해 자동 생성된 '피어 리뷰(Peer Review) 요청서'입니다. 대표님께서는 안티그래비티 모델을 Opus(또는 Sonnet 3.5)로 변경하신 뒤, 본 파일을 분석해달라고 요청해 주십시오.

---

## 1. 🎯 컨텍스트 (Sprint & Phase Context)
* **목적**: [현재 진행 중인 작업의 비즈니스적/기술적 목적 기재]
* **핵심 고려사항**: [성능, 멀티테넌트, 보안 등]

## 2. 🧩 아키텍처 및 로직 변경점
* **주요 변경 패턴**: (예: JWT 도입, 4계층 카드 레이아웃 정규화, 어댑터 패턴 등)
* **주요 타겟 파일**:
    - `/src/target/file/path.js`

## 3. 💻 대상 소스 코드 (Review Target)
```javascript
// 여기에 리뷰가 필요한 핵심 소스코드가 삽입됩니다.
```

## 4. ⚖️ Review Requestor's Point of Concern (작업자의 취약점 우려 포인트)
* **작업 주체**: [Luca 또는 Sonnet]
* **보안 한계점**: [스스로 생각했을 때 뚫릴 가능성이 있는 로직]
* **성능 병목 우려**: [데이터 많아지면 어떻게 될지 예상]

---
**Dear Prime Advisor (Opus/Sonnet),**
위 설계를 철저히 비판(Red Teaming)해 주십시오. 오직 **보안 취약점**, **의존성 결함**, **아키텍처 확장성 부족** 관점에서만 평가하고, 더 나은 대안 코드를 제안해주십시오.
