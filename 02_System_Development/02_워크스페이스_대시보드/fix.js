const fs = require('fs');
const path = '/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/02_워크스페이스_대시보드/src/components/Guidelines/TeamGuidelinesEditor.jsx';
let content = fs.readFileSync(path, 'utf8');

// The file got corrupted somewhere around "/* ── 기본 팀 가const DEFAULT_MD" and "*마지막 수정: 기본 템플릿 업데이트 완료*`;고 원칙"

const beforeStr = `/* ── 기본 팀 가`;
const afterStr = `- 실패/블로커 발생 시 즉시 로그 기록 + 대표 알림`;

const idx1 = content.indexOf(`/* ── 기본 팀`);
const idx2 = content.indexOf(`- 실패/블로커 발생 시`);

if (idx1 !== -1 && idx2 !== -1) {
    const chunkToReplace = content.substring(idx1, idx2);
    
    const correctStr = `/* ── 기본 팀 가이드라인 템플릿 ──────────────────────────── */
const DEFAULT_MD = \`# 팀 운영 가이드라인 (Team Guidelines)

> 이 문서는 AI 에이전트 팀이 작업을 수행할 때 따르는 SOP(표준 운영 절차)입니다.
> **다음 태스크부터 적용**되며, 진행 중인 기존 태스크는 기존 규칙을 따릅니다.

---

## 1. 최우선 작동 원칙 (Core Principles)
- **Review & Approval (승인 절차)**: 파괴력이나 주요 결정이 필요한 일은 반드시 **review 상태 전환**해 수동 컨펌을 받습니다.
- **Collaboration & Handoff (협업 이관)**: 본인의 전문 분야가 아닐 땐 즉시 담당자를 **분야별 지정 요원(Agent)**으로 바꿔 이관합니다.

## 2. 우선순위 기준 (Priority Policy)
- **Critical**: 고객사 임원급 요청, 장애 대응 → 다른 작업 중단 후 즉시 처리
- **High**: 당일 마감 업무 → 2시간 내 착수
- **Medium**: 이번 주 마감 → 배분 큐에 추가
- **Low**: 아이디어 및 리서치성 업무 → 여유 시간 활용

## 3. 작동 금지 목록 (Off-Limits)
- 개인정보(PII) 포함 데이터 외부 API 전송 금지
- 인증 없는 외부 URL 직접 호출 금지
- 사용자 확인 없는 결제·계약 관련 액션 금지

## 4. 글쓰기 스타일 (Writing Style)
- 보고서: 간결한 불릿 포인트 위주, 3문장 이내 요약 포함
- 리뷰: 개선 제안은 "이렇게 하면 어떨까요?" 형식으로

---

*마지막 수정: 기본 템플릿 업데이트 완료*
\`;

/* ── 간이 마크다운 미리보기 렌더러 ─────────────────────── */
function MdPreview({ content }) {
`;

    // Actually, I should just replace from /* ── 기본 팀 가이드라인 템플릿 to function MdPreview
    const newContent = content.substring(0, idx1) + correctStr + content.substring(content.indexOf('function MdPreview', idx1) || idx2);
    fs.writeFileSync(path, newContent, 'utf8');
    console.log("Fixed successfully.");
} else {
    console.log("Could not find boundaries", idx1, idx2);
}
