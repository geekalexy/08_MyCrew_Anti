---
displayName: Agent Control API Specification
description: 텔레그램 미니앱과 백엔드 서버 간의 에이전트 제어용 API 명세를 OpenAPI 3.0 형식으로 작성합니다.
---
# Agent Control API Specification

## Goal
에이전트의 상태 조회, 명령 전송, 로그 확인 등 원격 제어에 필요한 모든 기능을 명확하고 일관된 API 엔드포인트로 정의한다.

## Core Endpoints
- `GET /api/v1/agents/{agentId}/status`: 특정 에이전트의 현재 상태(대기, 작업 중, 오류 등)를 조회한다.
- `POST /api/v1/agents/{agentId}/commands`: 특정 에이전트에게 작업을 지시하는 명령을 전송한다. (Request Body: `{ "command": "run_script", "params": { "script_name": "analyze.py" } }`)
- `GET /api/v1/agents/{agentId}/logs`: 특정 에이전트의 최근 작업 로그를 조회한다.

## Security & Data Schema
- 모든 API 요청은 JWT(JSON Web Token) 기반의 인증을 거쳐야 한다.
- 요청 및 응답 데이터 모델을 JSON Schema 형식으로 명확히 정의한다.
- 오류 응답 코드를 표준화하여(401, 403, 404, 500 등) 클라이언트가 예외 처리를 용이하게 하도록 설계한다.

## Output
OpenAPI 3.0 규격에 맞는 YAML 파일을 생성하여 반환한다. 이 파일은 API 문서 자동 생성 및 클라이언트 코드 생성에 사용될 수 있다.