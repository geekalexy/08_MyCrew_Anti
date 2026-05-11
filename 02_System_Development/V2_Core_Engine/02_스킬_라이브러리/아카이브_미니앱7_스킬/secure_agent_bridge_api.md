---
displayName: 보안 에이전트 브릿지 API 설계
description: strict_isolation 원칙에 기반하여 사용자 데이터와 제어 권한을 완벽히 분리하는 API를 설계하는 능력
---
# Skill: SecureAgentBridgeAPI

`strict_isolation` 원칙을 최우선으로 고려하여 API를 설계하는 능력. 모든 API 엔드포인트는 JWT 또는 텔레그램 세션 기반의 강력한 인증/인가 메커니즘을 통과해야 함. 사용자 ID를 기반으로 리소스 접근을 완벽하게 격리하고, 에이전트 제어 명령의 유효성을 검증하는 로직을 포함해야 함. 이 스킬은 `dev_fullstack`의 핵심 역량임.