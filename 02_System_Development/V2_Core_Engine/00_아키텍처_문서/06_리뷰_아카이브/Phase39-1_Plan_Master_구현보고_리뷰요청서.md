# 👑 Phase 39-1 Plan Master 종합 구현 보고 및 리뷰 요청서

**리뷰 요청일**: 2026-05-11
**작성자**: Luca
**대상 아키텍처**: Phase 39-1 (Plan Master) 전체 구현 + Phase 40 (My-Graph) 연동
**기준 문서**: [Phase39-1_Plan_Master_관련_기획서](../01_PRD/Phase39-1_Plan_Master_관련_기획서.md)

---

## 1. 구현 범위 요약

### 1.1 백엔드 (`mcp_server.js`) — MCP 도구 3종 실제 로직 구현
| 도구 | 변경 내용 |
|---|---|
| `analyze_scope` | Sequential Thinking 구조화 반환 강제 (`thought`, `thoughtNumber`, `nextThoughtNeeded`). `needs_clarification` 분기 + `must_have`/`nice_to_have` 분류 |
| `make_roadmaps` | `.mycrew/docs/roadmaps/` 물리적 PRD 파일 I/O (`v1.0_MVP_PRD.txt`, `v2.0_ScaleUp_PRD.txt`) + Graphify `graph_nodes` 연동 |
| `confirm_mvp` | `pending_user_confirm` 상태 전환 + `action_required: 'confirm_or_revise'` 프론트엔드 트리거 필드 |

### 1.2 백엔드 (`server.js`) — API 엔드포인트 + 모델 라우팅
| 엔드포인트 | 변경 내용 |
|---|---|
| `POST /plan-master/analyze` | (유지) `anti-claude-sonnet-4.6-thinking` 1차 스코프 분류 |
| `POST /plan-master/generate-roadmaps` | Sonnet → **Opus 4.6 Thinking 승격** + `io.emit('task:bulk_created')` 소켓 브로드캐스트 추가 |
| `POST /plan-master/confirm` **(신규)** | `action: 'confirm'` → `.locked` 파일 락온, `action: 'revise'` → Iterative Review 루프 |

### 1.3 프론트엔드 (`TaskDetailModal.jsx`)
| 기능 | 변경 내용 |
|---|---|
| Sequential Thinking 타임라인 | `thoughtNumber` 그라디언트 뱃지 + '사고 진행 중/완료' 상태 텍스트 + `status` 컬러 태그 |
| Confirm/Revise 액션블록 | `pending_user_confirm` 감지 시 인라인 액션블록 자동 생성 (확정/수정 요청 버튼) |
| 탭 이름 변경 | `Graphify Report` → `Graph Report` |

---

## 2. Smoke Test 결과 (15개 항목)

| # | 검증 항목 | 결과 |
|---|---|---|
| 1 | mcp_server.js 구문 검증 (ESM) | ✅ PASS (ESM 모듈이므로 정상) |
| 2 | graphifyWatchdog.js Path Traversal 방어 (C-002) | ✅ PASS |
| 3 | PRD 파일 I/O 파이프라인 | ✅ PASS |
| 4 | /plan-master/confirm API 엔드포인트 | ✅ PASS |
| 5 | PRD Lock-on 파일 생성 로직 | ✅ PASS |
| 6 | 1차 스코프 Sonnet 라우팅 | ✅ PASS |
| 7 | 심층 로드맵 Opus 승격 | ✅ PASS |
| 8 | Sequential Thinking 타임라인 UI | ✅ PASS |
| 9 | Confirm/Revise 액션블록 UI | ✅ PASS |
| 10 | Selective Tool Loading (ARCHITECT/PLAN_MASTER) | ✅ PASS |
| 11 | 환각 유발 .catch() 제거 (C-001) | ✅ PASS |
| 12 | query_architecture 입력 검증 (H-002) | ✅ PASS |
| 13 | Quota Defender Dead Code 해소 (H-003) | ✅ PASS |
| 14 | 칸반 카드 bulk_created 소켓 이벤트 | ✅ PASS |
| 15 | Graph Report 탭 이름 변경 | ✅ PASS |

**결과: 15/15 전량 PASS**

---

## 3. 변경된 핵심 소스코드

### 3.1 mcp_server.js — `make_roadmaps` (PRD 파일 I/O)
```javascript
if (name === "make_roadmaps") {
    const result = {
      status: 'roadmaps_generated',
      thought: args.thought || '',
      thoughtNumber: args.thoughtNumber || 2,
      nextThoughtNeeded: args.nextThoughtNeeded || false,
      mvp_tasks: args.mvp_tasks || [],
      future_scope: args.future_scope || [],
    };

    // (A) PRD 파일 I/O — .mycrew/docs/roadmaps/ 에 버전별 분리 저장
    try {
      const fs = await import('fs');
      const path = await import('path');
      const roadmapDir = path.resolve(process.cwd(), '.mycrew/docs/roadmaps');
      fs.mkdirSync(roadmapDir, { recursive: true });

      const mvpContent = `# v1.0 MVP PRD\n## 필수 기능 (Must-have)\n${(args.mvp_tasks || []).map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n생성일: ${new Date().toISOString()}`;
      fs.writeFileSync(path.join(roadmapDir, 'v1.0_MVP_PRD.txt'), mvpContent, 'utf-8');

      if (args.future_scope && args.future_scope.length > 0) {
        const futureContent = `# v2.0 Scale-Up PRD\n## 확장 기능 (Future Scope)\n${args.future_scope.map((t, i) => `${i + 1}. ${t}`).join('\n')}\n\n생성일: ${new Date().toISOString()}`;
        fs.writeFileSync(path.join(roadmapDir, 'v2.0_ScaleUp_PRD.txt'), futureContent, 'utf-8');
      }
      result.prd_files = ['v1.0_MVP_PRD.txt'];
      if (args.future_scope?.length > 0) result.prd_files.push('v2.0_ScaleUp_PRD.txt');
    } catch (ioErr) {
      result.prd_io_error = ioErr.message;
    }
    return { content: [{ type: "text", text: JSON.stringify(result) }] };
}
```

### 3.2 server.js — `/plan-master/confirm` (신규 API)
```javascript
app.post('/api/projects/:id/plan-master/confirm', async (req, res) => {
  const { id: projectId } = req.params;
  const { action, feedback } = req.body;
  try {
    if (action === 'confirm') {
      // PRD 락온
      const lockPath = path.resolve(process.cwd(), '.mycrew/docs/roadmaps/v1.0_MVP_PRD.locked');
      const lockDir = path.dirname(lockPath);
      if (!fs.existsSync(lockDir)) fs.mkdirSync(lockDir, { recursive: true });
      fs.writeFileSync(lockPath, `Locked at ${new Date().toISOString()} by CEO`, 'utf-8');
      res.json({ status: 'confirmed', message: 'MVP 기획이 확정되었습니다.' });
    } else if (action === 'revise') {
      // Iterative Review 루프
      res.json({ status: 'revision_requested', message: '피드백을 반영하여 스코프를 재분석합니다.', feedback });
    }
  } catch (err) { ... }
});
```

### 3.3 TaskDetailModal.jsx — Confirm/Revise 액션블록
```jsx
{parsed.status === 'pending_user_confirm' && parsed.message_to_user && (
  <div style={{ /* 액션블록 컨테이너 */ }}>
    <div>{parsed.message_to_user}</div>
    <div style={{ display: 'flex', gap: '0.5rem' }}>
      <button onClick={() => {
        fetch(`${SERVER_URL}/api/projects/${task?.project_id}/plan-master/confirm`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'confirm' })
        }).then(() => showToast('✅ MVP 기획이 확정되었습니다!'));
      }}>✅ 확정하고 개발 시작</button>
      <button onClick={() => {
        const fb = prompt('수정 요청 내용을 입력해주세요:');
        if (fb) {
          fetch(`${SERVER_URL}/api/projects/${task?.project_id}/plan-master/confirm`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'revise', feedback: fb })
          }).then(() => showToast('🔄 피드백을 반영하여 재분석합니다.'));
        }
      }}>📝 기획 수정 요청</button>
    </div>
  </div>
)}
```

---

## 4. 작업자(Luca) 자체 검토: Edge Case 및 리뷰 포인트

Prime Advisor님, 다음 사항들을 중점적으로 비판적 리뷰(Red Teaming) 부탁드립니다:

### 🔴 보안 검토 요청
1. **PRD 파일 I/O 경로 안전성**: `mcp_server.js`의 `make_roadmaps`에서 `path.resolve(process.cwd(), '.mycrew/docs/roadmaps')`로 고정 경로를 사용하고 있으나, `process.cwd()`가 예상과 다른 디렉토리일 경우 의도치 않은 위치에 PRD가 생성될 가능성이 있습니다. executor.js의 Path Traversal 방어와 동일한 수준의 이중 검증이 필요한지 평가해 주십시오.

2. **confirm 엔드포인트 인증/권한**: 현재 `/plan-master/confirm`에 별도의 인증 미들웨어가 없어, 누구든 POST 요청을 보내면 PRD가 락온됩니다. 향후 CEO 전용 토큰 검증이 필요한지 아키텍처적 조언을 부탁드립니다.

### 🟠 아키텍처 검토 요청
3. **Iterative Review 루프의 상태 관리**: 현재 `revise` 응답은 단순히 "다시 analyze를 호출하세요"라는 안내 메시지만 반환합니다. 서버 사이드에서 `revision_count`를 추적하거나, 이전 스코프를 캐시하여 diff 기반 재분석을 지원하는 것이 더 효율적인지 검토해 주십시오.

4. **Opus 모델 3분 타임아웃**: `generate-roadmaps`에서 Opus에 3분 타임아웃을 설정했으나, 복잡한 로드맵의 경우 이 시간이 부족할 수 있습니다. 적정 타임아웃 값과 타임아웃 시 Sonnet 폴백 전략이 필요한지 검토 부탁드립니다.

5. **프론트엔드 `prompt()` 사용**: 수정 요청 시 `window.prompt()`를 사용하여 피드백을 받고 있습니다. 프로덕션 환경에서는 커스텀 모달로 교체해야 하는지, 현재 단계에서는 충분한지 판단 부탁드립니다.
