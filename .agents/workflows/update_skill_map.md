---
description: Luca 또는 Prime에게 새 스킬을 장착(또는 해제)할 때마다 AI 팀 스킬 맵을 업데이트하는 워크플로우
---

# AI Tech Team 스킬 맵 업데이트 워크플로우

새 스킬을 장착하거나 제거할 때마다 **반드시** 아래 절차를 따릅니다.

## 대상 파일
```
02_System_Development/01_아리_엔진/skill-library/AI_CREW_TECH_TEAM_SKILL_MAP.md
```

---

## 📌 트리거 조건 (언제 실행하나?)

다음 중 하나라도 해당되면 이 워크플로우를 실행합니다:

- Luca 또는 Prime에게 **새 스킬 장착** 요청이 들어온 경우
- Luca 또는 Prime의 **스킬을 제거/비활성화** 하는 경우
- `skill-library/` 에 **새 SKILL.md 파일이 추가**된 경우
- 기존 스킬의 **역할·설명이 변경**된 경우

---

## 🔄 실행 절차

### Step 1. 현재 스킬 맵 확인
```
view_file: skill-library/AI_CREW_TECH_TEAM_SKILL_MAP.md
```
현재 어떤 스킬이 등록되어 있는지 파악합니다.

### Step 2. 변경 내용 결정

장착(추가) 시:
- 어떤 팀원(Luca / Prime)의 스킬인가?
- 어느 레이어인가? (L3 INFRA / L1 ENGINE / L2 DOMAIN)
- 스킬 이름, 툴/경로, 한 줄 설명

해제(제거) 시:
- 제거 이유 기록 (deprecation 사유)

### Step 3. 스킬 맵 업데이트
// turbo
해당 팀원 섹션의 레이어 테이블에 스킬 추가 또는 삭제:
```
replace_file_content: AI_CREW_TECH_TEAM_SKILL_MAP.md
```
- 🆕 태그 붙이기 (신규 장착 항목)
- 커버리지 비교표도 함께 업데이트

### Step 4. 업데이트 날짜 갱신
// turbo
파일 하단 메타데이터 업데이트:
```
*마지막 업데이트: YYYY-MM-DD by [장착 담당자]*
```

---

## 📋 스킬 항목 작성 형식

### L1 ENGINE / L2 DOMAIN 신규 스킬:
```markdown
| **스킬명** 🆕 | `툴 이름 또는 경로` | 한 줄 설명. 핵심 역할 + 발동 조건 간략히 |
```

### L3 INFRA 신규 스킬:
```markdown
| **스킬명** 🆕 | `툴 이름` | 상시 내장 실행 능력. 어떤 작업을 자동으로 수행하는가 |
```

---

## ✅ 체크리스트

- [ ] 올바른 팀원 섹션에 추가했는가? (Luca vs Prime)
- [ ] 올바른 레이어(L1/L2/L3)에 배치했는가?
- [ ] 커버리지 비교표가 반영되었는가?
- [ ] 🆕 태그가 붙어있는가? (신규 항목)
- [ ] 파일 하단 날짜가 업데이트되었는가?
- [ ] SKILL.md 원본 파일이 `skill-library/` 내에 존재하는가? (L1 ENGINE 한정)
