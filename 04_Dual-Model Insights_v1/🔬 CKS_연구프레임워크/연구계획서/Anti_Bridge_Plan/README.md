# 📁 Anti-Bridge Plan

> **목적**: API 연동 없이 안티그래비티 세션을 다중 모델 크루 대역으로 활용하는 파일 동기화 브릿지 아키텍처 기획 및 검토

---

## 📄 파일 목록

| 파일 | 작성자 | 내용 |
|:---|:---|:---|
| `Anti_Bridge_아키텍처_기획서_Luca.md` | Luca | 핵심 아이디어 원본 — WHY & 전체 흐름 설계 |
| `Anti_Bridge_보완검토서_Sonnet.md` | Sonnet | 엣지 케이스 EC 1~5 식별 + 코드 레벨 해결책 |
| `Anti_Bridge_검토의견_Prime.md` | Prime | EC 6~7 추가 + 논문 기여 관점 피어 리뷰 |

---

## 🔑 핵심 개요

**NEXUS (크루 대역)**

| 코드명 | 실제 모델 | 역할 |
|:---|:---|:---|
| PRIME 세션 | Claude Opus 4.6 | OLLIE 대역 — Team A 적대적 판관 |
| NEXUS 세션 | GPT-OSS 120B | LUNA 대역 — Team B 협력 합성자 |

**Anti-Bridge 흐름**
```
서버 → .bridge/requests/req_[agent]_[id].json 쓰기
     → 대표님 1-Click 트리거 (복붙)
     → 에이전트 view_file → 추론 → write_to_file
     → 서버 폴링 회수 → DB 기록 → 워크플로우 재개
```

---

## ⚠️ 식별된 엣지 케이스 요약

| # | 리스크 | 심각도 | 해결책 |
|:--|:---|:---|:---|
| EC-1 | 폴링 타임아웃 → 교착 상태 | 🔴 High | Gemini Flash Fallback + 알림 |
| EC-2 | 동시 요청 Race Condition | 🟡 Mid | `.lock` 파일 패턴 |
| EC-3 | 세션 컨텍스트 소실 | 🟡 Mid | Self-Contained 트리거 JSON |
| EC-4 | 응답 스키마 미검증 | 🟡 Mid | 방어 파싱 레이어 |
| EC-5 | NEXUS 모델 정체 모호 | ✅ | GPT-OSS 120B로 확정 |
| EC-6 *(Prime)* | Fallback 시 실험 데이터 오염 | 🔴 High | `_meta.fallback` 플래그 |
| EC-7 *(Prime)* | 미래 자동화 전환 경로 | 🟢 Low | 어댑터 인터페이스 표준화 |

---

## 🏗️ 구현 순서 (Prime 재조정)

1. `.bridge/` 폴더 구조 생성 (5분)
2. `antigravityAdapter.js` 핵심 구현 (2시간)
3. `modelRegistry.js` 가상 식별자 등록 (15분)
4. `executor.js` 분기 로직 (30분)
5. Fallback 플래그 + 데이터 제외 로직 (30분)
6. 대시보드 브릿지 대기 인디케이터 UI (1시간)
7. 파일럿 테스트 (30분)

**총 예상 소요: 약 5시간** (루카 구현 / 소넷 코드 리뷰)
