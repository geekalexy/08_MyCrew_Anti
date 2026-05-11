# tmux + Playwright 테스트 결과 보고서

## 1. 테스트 환경

- 날짜: 2026-04-04
- 호스트: cmux(왕짱플젝) 유지한 채 tmux 병렬 실행
- Paperclip: TMUX-test 컴퍼니 (localhost:3100/TMU)
- cmux 환경 손상 여부: 없음 (완전 독립)

### 설치 항목

| 프로그램 | 버전 | 설치 명령 |
|---|---|---|
| tmux | 3.6a | `brew install tmux` |
| Playwright | 1.58.0 | `pip3 install playwright` |
| Chromium (Playwright) | headless | `python3 -m playwright install chromium` |

### tmux 세션 구성

```
세션: tmux-test
윈도우: main
패널 4개:
  pane 0 = C1 (Claude Code)
  pane 1 = Paperclip 터미널 (서버)
  pane 2 = C2 (Claude Code)
  pane 3 = Bridge
```

생성 명령:
```bash
tmux new-session -d -s tmux-test -n main
tmux split-window -v -t tmux-test:main      # pane 1
tmux split-window -h -t tmux-test:main.0    # pane 2
tmux split-window -v -t tmux-test:main.2    # pane 3
```

### Paperclip 접속 정보

- URL: `http://127.0.0.1:3100/TMU`
- 컴퍼니: TMUX-test
- cmux의 Paperclip 서버(surface:11)를 공유 사용
- 주의: tmux pane 1에서 별도 Paperclip 서버를 실행하지 않음 (AWS 전환 시 필요)

---

## 2. 테스트 결과

### 테스트 1: C1↔C2 패널 간 통신
- **결과: ✅ 성공**
- `tmux send-keys -t tmux-test:main.2 "메시지" Enter` → C2가 수신/응답
- C2가 `tmux display-message`로 자체 환경도 인식

### 테스트 2: 화면 읽기 정확도
- **결과: ✅ cmux와 동등**
- `tmux capture-pane -t pane -p -S -30` → 30줄 스크롤백 읽기
- cmux `read-screen`과 출력 품질 동일

### 테스트 3: Playwright 이슈 생성
- **결과: ✅ 성공 (TMU-1 생성)**
- 첫 시도: 모달 다이얼로그가 Create 버튼 가림 → 실패
- 수정: `force=True` 옵션 적용 → 성공
- 입력 필드: `textarea[placeholder="Issue title"]`
- Create 버튼: dialog 내부에서 찾아 `force=True`로 클릭

Playwright 이슈 생성 코드:
```python
page.goto("http://127.0.0.1:3100/TMU/issues")
page.click('text=New Issue')
page.fill('textarea[placeholder="Issue title"]', '이슈 제목')
dialog = page.query_selector('[role="dialog"]')
create_btn = dialog.query_selector('button:has-text("Create")')
create_btn.click(force=True)
```

### 테스트 4: Playwright 댓글 입력
- **결과: ✅ 성공**
- 댓글 입력 영역: `[contenteditable="true"]` (마지막 요소)
- 전송 버튼: `button` 중 텍스트가 정확히 "Comment"인 것 (y좌표 가장 큰 것)
- 주의: "Comments" (탭 버튼)과 "Comment" (전송 버튼) 구분 필요

Playwright 댓글 코드:
```python
editables = page.query_selector_all('[contenteditable="true"]')
editables[-1].click()
page.keyboard.type("댓글 내용")

# Comment 전송 버튼 (가장 하단)
buttons = page.query_selector_all('button')
comment_btns = [(btn.bounding_box()['y'], btn) for btn in buttons if btn.inner_text().strip() == 'Comment']
comment_btns.sort(key=lambda x: x[0], reverse=True)
comment_btns[0][1].click(force=True)
```

### 테스트 5: Playwright 장시간 안정성
- **결과: ✅ 10/10 성공, 메모리 16MB**
- 10회 페이지 이동 (dashboard→issues→inbox 반복)
- 에러 0건
- 메모리 누수 없음

### 테스트 6: tmux 세션 복구
- **결과: ✅ 성공**
- detached 상태에서도 `tmux send-keys` 동작
- Claude Code 세션 상태 유지
- re-attach 시 화면 그대로

### 테스트 7: cmux + tmux 동시 실행
- **결과: ✅ 충돌 없음**
- cmux 왕짱플젝: 정상 (모든 패널 동작)
- tmux 테스트: 정상 (C1, C2 동작)
- Paperclip: 양쪽 HTTP 200 (SOC + TMU 컴퍼니)

---

## 3. cmux → tmux 명령어 매핑 (검증됨)

| 기능 | cmux | tmux |
|---|---|---|
| 세션 생성 | `cmux new-workspace --name X` | `tmux new-session -s X` |
| 패널 분할 하단 | `cmux new-split down` | `tmux split-window -v` |
| 패널 분할 우측 | `cmux new-split right` | `tmux split-window -h` |
| 텍스트 전송 | `cmux send --surface X text` | `tmux send-keys -t X text Enter` |
| 화면 읽기 | `cmux read-screen --surface X` | `tmux capture-pane -t X -p -S -N` |
| 패널 목록 | `cmux list-panels` | `tmux list-panes` |

## 4. cmux browser → Playwright 매핑 (검증됨)

| 기능 | cmux browser | Playwright |
|---|---|---|
| 페이지 이동 | `cmux browser goto URL` | `page.goto(URL)` |
| 스냅샷 | `cmux browser snapshot --compact` | `page.inner_text("main")` |
| 텍스트 추출 | `cmux browser get text "main"` | `page.inner_text("main")` |
| 클릭 | `cmux browser click ref` | `page.click(selector)` |
| 텍스트 입력 | `cmux browser type ref text` | `page.keyboard.type(text)` |
| 필드 채우기 | `cmux browser fill ref text` | `page.fill(selector, text)` |
| 스크린샷 | 없음 | `page.screenshot(path=...)` |

---

## 5. 주요 파일 위치

| 파일 | 경로 |
|---|---|
| tmux Bridge 스크립트 | `~/Desktop/claude-3/tmux-test/tmux_telegram_bridge.py` |
| C2 로그 디렉토리 | `~/Desktop/claude-3/tmux-test/c2/` |
| Playwright 테스트 스크린샷 | `/tmp/pw_newissue.png`, `/tmp/pw_comment.png` |

---

## 6. 결론

**tmux + Playwright로 cmux 완전 대체 가능.**
- 터미널 통신: tmux send-keys/capture-pane → cmux와 동등
- 브라우저 조작: Playwright → cmux browser와 동등 이상 (더 빠르고 안정)
- 동시 실행: cmux와 충돌 없음
- AWS Linux 전환에 기술적 장애물 없음

### AWS 전환 시 추가 필요 작업
- tmux pane에서 Paperclip 서버 직접 실행 (`npx paperclipai`)
- 텔레그램 봇 토큰 설정
- C2 학습 프롬프트 자동 주입 (bootstrap.sh에 포함됨)

---

*작성일: 2026-04-04*
*프로젝트: 멀티에이전트회사-왕짱플젝*
