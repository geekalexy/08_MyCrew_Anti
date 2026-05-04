---
displayName: Real-time Push Notification Architecture
description: WebSocket 또는 서버 푸시 기술을 사용하여 MyCrew에서 발생한 중요 변경사항을 사용자에게 실시간으로 알리는 시스템을 설계하고 구현하는 스킬입니다.
---
# Real-time Push System Design

## 1. Technology Stack
- **Primary**: WebSocket (Socket.IO)을 사용하여 서버와 클라이언트 간 양방향 통신 채널 유지
- **Fallback**: Web Push API를 통한 서비스 워커 기반 푸시 알림

## 2. Event Flow
1.  사용자가 미니앱에 접속하면 WebSocket 연결 수립 및 사용자 ID 등록
2.  MyCrew 백엔드에서 태스크 상태 변경, 새 코멘트 등 이벤트 발생 시 RabbitMQ 같은 메시지 큐에 이벤트 발행
3.  Push 서버가 메시지 큐를 구독하여 이벤트를 수신
4.  Push 서버는 해당 이벤트를 수신해야 할 사용자의 WebSocket 채널로 메시지 전송

## 3. Scalability
- Push 서버는 수평 확장이 가능하도록 상태 비저장(stateless)으로 설계