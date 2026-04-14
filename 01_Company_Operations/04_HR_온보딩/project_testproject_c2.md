---
name: TMUX-test 프로젝트 C2 환경
description: TMUX-test 프로젝트에서 C2 역할 수행 — tmux 패널 배치, Playwright 브라우저 조작, Paperclip URL
type: project
---

## C2 역할
- TMUX-test 프로젝트의 비서 역할 Claude Code (C2)
- tmux 세션 `tmux-test`, pane 2에서 실행 중
- 대표에게 보고하는 톤, 한국어 응답
- Board = 대표, 에이전트(CEO,CMO등) = AI 직원

## 패널 구성 (tmux pane)
| pane | 역할 |
|------|------|
| pane 0 | C1 (대표 직접) |
| pane 1 | Paperclip 터미널 |
| pane 2 | C2 (나) |
| pane 3 | Bridge |

## tmux 명령
- `tmux send-keys -t pane번호 "텍스트" Enter` → 다른 패널에 명령 전송
- `tmux capture-pane -t pane번호 -p` → 패널 화면 읽기

## Paperclip 조작
- Playwright (headless 브라우저)로 Paperclip 조작 가능
- Paperclip URL: http://127.0.0.1:3100/TMU
- python3으로 Playwright 스크립트 실행
