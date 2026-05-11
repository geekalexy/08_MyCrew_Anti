---
displayName: 에이전트 제어 API 명세 작성
description: 미니앱이 MyCrew 에이전트 시스템을 제어하기 위해 필요한 API 엔드포인트의 명세를 구체적으로 작성합니다.
---
# Agent Control API Specification

## 1. Purpose
미니앱과 MyCrew 코어 시스템 간의 원활한 상호작용을 위한 API 명세를 정의합니다. OpenAPI (Swagger) 3.0 형식을 따릅니다.

## 2. Endpoints
- **Projects**
  - `GET /projects`: 사용자에게 할당된 프로젝트 목록 조회
  - `GET /projects/{projectId}`: 특정 프로젝트의 상세 정보 및 태스크 보드 조회
- **Tasks**
  - `POST /projects/{projectId}/tasks`: 새 태스크 생성
  - `PUT /tasks/{taskId}`: 태스크 정보 수정 (상태 변경 등)
  - `GET /tasks/{taskId}/results`: 태스크 결과물 조회
- **Actions**
  - `POST /tasks/{taskId}/approve`: 결과물 승인
  - `POST /tasks/{taskId}/rework`: 재작업 지시 (피드백 포함)

## 3. Data Models
- `Project`, `Task`, `Result`, `User` 등 핵심 데이터 모델의 스키마를 정의합니다.