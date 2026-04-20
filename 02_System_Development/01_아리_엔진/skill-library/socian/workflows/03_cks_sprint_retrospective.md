---
name: socian-cks-retrospective
type: workflow
trigger: "스프린트 회고|Done 승인 후|룰 동기화|팀 그라운드룰 업데이트"
agents: [ARI, B4_SystemAgent]
layer: CKS_EXPERIMENT
---

# CKS 스프린트 회고 & 룰 동기화 워크플로우

> **발동 조건**: 칸반 카드가 'Done'으로 이동하고, 대표님의 최종 승인(수정 포함)이 완료된 시점

---

## 📋 실행 단계

### Step 1: 수정 로그 수집 (B4_System)
```
담당: B4 System Meta-Agent
수집 대상:
  - 대표님이 직접 수정한 텍스트 diff
  - 재작업 지시가 있었던 코멘트
  - 승인 속도 (즉시 / 1회 수정 / 2회 이상)
출력: 수정 패턴 요약 JSON
{
  "card_id": "SOC-XX",
  "approval_rounds": 2,
  "changes": ["톤 과도하게 친근함 → 더 신뢰감 있게", "CTA 위치 본문 중간으로 이동"],
  "success_pattern": "FOMO형 Hook + 의문형 자막 조합"
}
```

### Step 2: 성찰 일지 작성 (ARI)
```
담당: ARI (오케스트레이터)
입력: Step 1 수정 패턴 JSON
출력: 성찰 일지 (다음 구조):
  [잘한 것] 이번 카드에서 효과 있었던 패턴
  [개선할 것] 대표님이 수정한 패턴 → 원인 분석
  [다음에 적용할 것] 구체적 행동 변경 사항
```

### Step 3: 그라운드룰 동기화 (B4_System)
```
담당: B4 System
대상 파일: socian/templates/팀_그라운드룰.md
동작:
  - "하지 말 것" → [금지] 항목으로 추가
  - "잘된 것" → [승자 레시피] 항목으로 강화
  - 3번 반복된 실패 패턴 → SKILL.md 금지 규칙에 반영 요청
```

### Step 4: KSI-R 지표 업데이트
```
측정: 이번 Sprint에서 이전 Sprint 금지 조항이 반영된 비율
공식: 반영된 금지 조항 수 / 전체 금지 조항 수 × 100
기록 위치: socian/templates/팀_그라운드룰.md 하단 지표 섹션
목표: KSI-R ≥ 80%
```

---

## 📎 연결 파일
- `socian/templates/팀_그라운드룰.md` — 룰 누적 파일
- `mycrew-core-protocol/SKILL.md` — 스킬 성장 메커니즘 정책
- CKS 연구 프레임워크: `04_Dual-Model Insights_v1/`
