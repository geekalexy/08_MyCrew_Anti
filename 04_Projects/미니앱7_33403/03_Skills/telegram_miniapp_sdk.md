---
displayName: Telegram Mini App SDK
description: 텔레그램 미니앱 개발을 위한 공식 SDK 및 관련 라이브러리(React, Vue 등)를 활용하여 사용자 인터페이스를 구축하는 스킬입니다.
---
# Telegram Mini App Development Guide

## 1. Initialization
- `window.Telegram.WebApp.ready()`를 호출하여 앱 초기화
- 사용자 정보, 테마 등 초기 데이터 로드: `window.Telegram.WebApp.initDataUnsafe`

## 2. UI/UX Components
- MainButton, BackButton 등 텔레그램 네이티브 컴포넌트 제어
- HapticFeedback을 활용한 사용자 경험 향상

## 3. API Communication
- MyCrew 백엔드 API와 안전하게 통신하기 위한 인증 및 데이터 교환 로직 구현