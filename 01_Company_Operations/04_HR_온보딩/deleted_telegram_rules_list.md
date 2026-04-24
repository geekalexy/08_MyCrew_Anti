# 텔레그램 하드코딩 규칙 삭제 내역 (2026-04-24)

과거 아리(Ari) 엔진이 텔레그램 메신저에서 기계적인 봇처럼 동작하도록 강제했던 레거시 규칙 파일들을 삭제하고, `MEMORY.md`에서의 종속성을 해제한 목록입니다.

## 🗑️ 삭제된 레거시 파일 목록 (총 10개)
위치: `01_Company_Operations/04_HR_온보딩/` 내

1. **`feedback_telegram_response_ux.md`**
   - 내용: 텔레그램 내 코드/경로 노출 절대 금지, 자연어로만 응답할 것을 강제했던 구형 룰.
2. **`feedback_new_tools.md`** 
   - 내용: 브라우저 대신 CLI와 `tg_send.sh` 스크립트만을 사용하여 텔레그램에 전송하라는 룰.
3. **`feedback_always_tg_send.md`**
   - 내용: 대표님은 터미널을 보지 않으므로 무조건 `tg_send.sh`로 전송해야 한다는 하드코딩.
4. **`feedback_no_narration.md`**
   - 내용: "~하겠습니다" 등 사람 같은 나레이션을 금지하고 기계적으로 결과만 내뱉게 한 룰.
5. **`feedback_no_confirm.md`**
   - 내용: 텔레그램으로 지시가 오면 중간 확인(질문) 없이 무조건 즉시 수행하라는 제약.
6. **`feedback_announce_before_action.md`**
   - 내용: 긴 작업 전에는 무조건 텔레그램으로 먼저 선포해야 한다는 매뉴얼.
7. **`feedback_message_routing.md`**
   - 내용: 구형 시스템의 일반 메시지 라우팅 및 상태 보고(즉시/요약/스킵) 강제 규칙.
8. **`feedback_live_status.md`**
   - 내용: 에이전트 동작을 Live로 감시하여 텔레그램으로 억지 송신하던 규칙.
9. **`project_telegram_bridge.md`**
   - 내용: 과거 Cmux 터미널 패널과 텔레그램을 연결하던 복잡한 아키텍처 문서.
10. **`project_chatops.md`**
    - 내용: 구버전의 텔레그램 봇 기반 ChatOps 원격 제어 및 명령어 체계.

## 🔗 해제 완료 위치
- `01_Company_Operations/04_HR_온보딩/MEMORY.md` 내부의 해당 규칙 참조 링크 일괄 제거 및 연결 고리 완전 해제.
