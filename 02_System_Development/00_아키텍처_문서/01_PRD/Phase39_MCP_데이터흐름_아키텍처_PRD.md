# Phase 39: MCP V2 데이터 흐름(Data Flow) 아키텍처 설계서
**작성일**: 2026-05-09  
**작성자**: 루카 (Luca)  
**상태**: ✅ 확정  

---

## 1. 개요 (Overview)
과거 아리 엔진 중심의 파일 입출력(Polling) 아키텍처에서 벗어나, **Antigravity(고성능 LLM 에이전트)**가 주도권을 쥐고 **MyCrew(MCP 서버)**를 보조 도구로 활용하는 체제로의 데이터 흐름(Data Flow)을 재설계합니다.

본 설계서는 트리거(지시), 실행 및 저장(파일 쓰기), 전달(상태 업데이트), 출력(화면 표시)의 4단계 라이프사이클을 정의합니다.

---

## 2. 아키텍처 직관적 구조도 (Box & Line)

```text
[ 1. 트리거 (작업 시작) ]
   ┌───────────────────────┐            ┌───────────────────────┐
   │ Chrome Extension (웹) │            │ MyCrew Kanban (웹)    │
   │ "로그인 페이지 짜줘"  │            │ - [새 태스크 카드 생성] │
   └─────────┬─────────────┘            └───────────┬───────────┘
             │ (실시간 Socket 주입)                 │
             ▼                                      ▼ (DB 저장)
   ┌───────────────────────┐            ┌───────────────────────┐
   │ Antigravity (LLM)     │◀─(MCP 조회)─│ MyCrew MCP Server     │
   │ (메인 실행자/두뇌)    │            │ (resources://tasks)   │
   └─────────┬─────────────┘            └───────────────────────┘
             │
┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
[ 2. 실행 및 3. 상태 업데이트 ]
             │
             ├─▶ [ 산출물 저장 ]
             │   write_to_file / run_command
             │   (로컬 파일 시스템에 직접 파일 생성)
             │
             └─▶ [ 상태 업데이트 ]
                 call_tool: update_task_status
                 (MCP 서버를 통해 완료 상태 보고)
┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈┈
[ 4. 출력 및 후처리 ]
                 ┌─────────────────────────────────┐
                 │ MyCrew Dashboard & Graphify     │
                 │ - Kanban 카드 'Done' 자동 이동  │
                 │ - Live Preview (Iframe 렌더링)  │
                 │ - Graph.json 지식망 업데이트    │
                 └─────────────────────────────────┘
```

---

## 3. 데이터 플로우 다이어그램 (Flowchart)

채팅창에서 확인하신 직관적인 색상과 구조가 적용된 다이어그램입니다. 이제 외부 이미지 링크가 아닌 마크다운 네이티브(Mermaid)로 렌더링됩니다.

![Architecture Flowchart](https://mermaid.ink/img/pako:eJydVF1rGkEU_SvD5EUhltD0JVsMJGrz0IQIKe2DU8LqzuoS3Q2zGz_IBgyah6qllUi_WIMBm1DIgzam2ELp_3Fm_0OZHTeaDwvNPszevffMuXfOGXYfpgwFQwmmibybAS-iSAcAgFRWNs0oVsGeiQlQtWxWmlOX1HnTIsYOluYWFxfHcaigKVZGerxbnE8ZWYNIcwsLC09vs2hjjmTywRxyGuuWP4q6NJvmyT9pzJJp4Zw_jpp86DimZRA5jcdEiqL8B5GgisQ2AwHaKLtNh9Y_BYOSJHG1RVGs5l5S-OLWhvTsYtTviTx_YkUrgWAkQ4wc5h8B1q-6jaMggq85kzZBPpf1pKwnEBRBgP0c0GOHVdqs2r8Fx7rij3fdm9W77oc327T3bpt1yuzk64R5Rbe0tX0E-TtN5LxmlcAK9wnBA0mSPMtmE9Nhg579YeflCeFGJJ5AcCMSB1uY5DER0wnPJqhnWhZvlcxEAMF1IyVnvQTYEigY9LYIeyZ7oqscvlGKEFwA0dX7YPce_odDO1MnXuNZTS0lEPRD8Eq2UhnFSN8_7LqWxy81XEggyEMQJziv4cJM3SOxTRAKLdvCTnZeZnXH5gbfLLsVh9W67uEFPe7T07Y9dnn69sSKloC2qvT0wm1V3drQFp4JgNgCQo94O89am0ujC738vDO6vLK5M6LAzRGV0577pXGDUKxeAoTDAEH2u8Wv2kmTVfsIgnB42TdvGhoKcWjl0K049HIwuuwgyAef9JzqzBt_PKJve6w98M4zPTAvtgf0e9er3FVk3NsDjnrv2XnZvvbnLoLVuuxXy772fJrJl47L-7lFvw1GvT6rd2zuz031WbtJ61deAc7DHCY5WVOgtA-tDM7xP68ikx14cPAXJkUAlw==?bgColor=222)

---

## 4. 단계별 데이터 흐름 상세

### Step 1. 트리거 (Trigger)
*   **크롬 익스텐션**: 대표님이 브라우저 화면을 보며 실시간으로 채팅 지시를 내리면, 해당 내용이 소켓을 통해 직접 Antigravity 에이전트로 전달됩니다.
*   **칸반 보드**: 대시보드에서 카드를 생성하면, Antigravity가 MCP `resources://mycrew/tasks/pending` 리소스를 호출하여 스스로 작업 큐(Queue)를 인지하고 착수합니다.

### Step 2. 실행 및 저장 (Execution & Storage)
*   **직접 파일 제어**: 아리 엔진을 거치지 않고, Antigravity에 내장된 파일 시스템 도구(예: `write_to_file`)를 사용하여 `outputs/` 등 로컬 스토리지에 산출물을 **직접 기록**합니다.
*   **무손실 저장**: 텍스트 파싱을 거치지 않아 LLM 환각(Hallucination)에 의한 데이터 누락이 없습니다.

### Step 3. 결과물 전달 및 상태 동기화 (Delivery & Sync)
*   **MCP Tool 호스팅**: 작업이 완료되면 Antigravity는 MyCrew가 제공하는 `update_task_status` MCP 도구를 호출하여 칸반 상태를 '완료(Done)'로 업데이트합니다.
*   **비동기 소켓 동기화**: 업데이트된 데이터는 `server.js`를 통해 프론트엔드 대시보드로 Socket.io 이벤트로 쏘아집니다.

### Step 4. 출력 및 시각화 (Display)
*   **다중 출력 채널**:
    1.  **크롬 익스텐션**: 채팅창에 작업 완료 보고 텍스트가 즉각 노출됩니다.
    2.  **대시보드 (Live Preview)**: 칸반 보드의 카드가 이동함과 동시에 우측 Live Split Preview Iframe이 새로 작성된 HTML/결과물을 렌더링합니다.
    3.  **지식망 (Graphify)**: 파일 시스템 변경을 백그라운드 워치독이 감지하여, 즉각적으로 의존성 지식 그래프(`graph.json`)를 최신화합니다.

---

## 5. 결론 및 Next Steps
본 아키텍처를 통해 **"실행은 Antigravity가, 상태 관리는 MyCrew가"** 하는 명확한 R&R이 완성되었습니다. 
다음 스텝으로는 Antigravity가 MyCrew에 상태 변경을 직접 보고할 수 있도록, `mcp_server.js` 내에 `update_task_status` 등의 핵심 제어 도구(Tools)를 추가 구현해야 합니다.

---

## 6. 핵심 UI/UX 정책 확정: 6단계 칸반 보드 아키텍처

Task 관리 및 에이전트 파이프라인의 시각적 기준점이 되는 메인 칸반 보드는 아래의 **6단계 컬럼 + 아카이브 탭** 구조로 최종 확정(Lock-on) 되었습니다.

1.  **Backlog**: 기획 단계에서 도출되었으나, 이번 버전에 포함할지 보류할지 대기 중인 상태.
2.  **To Do**: 이번 스프린트(버전)에 개발하기로 확정된 태스크 대기열.
3.  **In Progress**: 현재 개발 에이전트(Claude Sonnet 등)가 코딩을 진행 중인 상태.
4.  **Review**: 에이전트의 코딩이 끝났으나, 리뷰 에이전트(Gemini Pro)의 스캔 및 Graphify 갱신, 에러 테스트가 진행 중인 상태.
5.  **Done**: 모든 코드 검증과 기능 구현이 처리 완료된 상태 (개발자 관점의 끝).
6.  **Finalized**: 개별 태스크(프론트, 백, 기획 등)들이 하나로 모여 완전한 기능(Epic)으로 조립되어 최종 출시 준비가 끝난 상태 (사용자/대표님 관점의 최종 완성).
*   **[🗄️ Archive Tab]**: 취소되거나 보류(Drop)된 태스크는 메인 컬럼에서 제거되어 우측 상단의 아카이브 탭에서 별도로 관리 및 복구 가능.

---

## 7. 🔗 연관 문서 및 기획서 (Backlinks)
본 문서는 Phase 39의 메인 아키텍처 문서이며, 세부적인 기능 및 분석 기획은 다음 문서들과 유기적으로 연결됩니다.

*   [Phase39_태스크_도구_분류_기획서.md](./Phase39_태스크_도구_분류_기획서.md): 도구별(프론트엔드, 백엔드, 파일시스템) 분류 체계
*   [Phase39_MCP_온보딩_UX_기획서.md](./Phase39_MCP_온보딩_UX_기획서.md): MCP 초기 연동 시 4단계 설정(보안, 룰, 모델 할당) UX 기획
*   [Phase39_Shrimp_Task_Manager_벤치마킹_기획서.md](./Phase39_Shrimp_Task_Manager_벤치마킹_기획서.md): Shrimp의 UX와 모듈형 프롬프트 아키텍처 학습
*   [Phase39_Sequential_Thinking_벤치마킹_분석서.md](./Phase39_Sequential_Thinking_벤치마킹_분석서.md): 추론 과정의 API화 및 자기 교정 메커니즘 분석
*   [Phase39_Claude_Task_Master_벤치마킹_분석서.md](./Phase39_Claude_Task_Master_벤치마킹_분석서.md): 다중 모델 라우팅 및 토큰 최적화(도구 모듈화) 설계 분석
*   [Phase39_PRD_Architect_MCP_기획서.md](./Phase39_PRD_Architect_MCP_기획서.md): 3종 MCP 벤치마킹을 융합한 'AI 기획자(스코프 및 버전 관리)' MCP 아키텍처 설계
*   [Phase39_Command_UX_개편_기획서.md](./Phase39_Command_UX_개편_기획서.md): 명령어 오버로드 해결을 위한 상위 모드(Mode) 전환 및 인텐트 라우팅 UX 기획
*   [Phase39_MCP_스킬_및_모델배정_기획서.md](./Phase39_MCP_스킬_및_모델배정_기획서.md): 2시간 쿼터 제약을 방어하기 위한 모드별 최적 모델(Gemini/Claude) 및 스킬 배정표
*   [Phase39_Archive_지식베이스허브_기획서.md](./Phase39_Archive_지식베이스허브_기획서.md): 산출물 및 추론 히스토리의 지식망(Graphify) 구축 계획
*   [Phase39_AutoGit_VersionControl_Draft.md](./Phase39_AutoGit_VersionControl_Draft.md): 파일 변경 감지 및 자동 버전 관리(Git) 체계
