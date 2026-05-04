---
displayName: MyCrew API Integration
description: 텔레그램 미니앱이 MyCrew의 프로젝트, 태스크, 결과물 데이터에 안전하게 접근하고 조작하기 위한 API 연동 스킬입니다.
---
# MyCrew API Integration Protocol

## 1. Authentication
- Telegram `initData`를 서버로 전송하여 사용자 인증 및 세션 생성
- 모든 API 요청 헤더에 Bearer 토큰 포함

## 2. Core Endpoints
- `GET /api/v1/projects`: 사용자에게 할당된 프로젝트 목록 조회
- `GET /api/v1/projects/{projectId}/tasks`: 특정 프로젝트의 태스크 목록 조회
- `POST /api/v1/tasks/{taskId}/comment`: 태스크에 코멘트(지시) 추가
- `PUT /api/v1/tasks/{taskId}/status`: 태스크 상태 변경

## 3. Data Isolation
- API는 요청한 사용자가 접근 권한을 가진 데이터만 반환해야 함 (`strict_isolation` 준수)