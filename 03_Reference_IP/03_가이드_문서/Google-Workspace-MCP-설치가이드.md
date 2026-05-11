# Google Workspace MCP 설치 가이드 (비개발자용)

> Claude Code에서 구글 캘린더, 지메일, 드라이브 등을 직접 사용할 수 있게 해주는 도구입니다.
> 이 가이드는 개발 경험이 없는 분도 따라할 수 있도록 작성되었습니다.

---

## STEP 1: 사전 준비 (처음 한 번만)

Mac 터미널(또는 Ghostty)을 열고 아래 명령어를 **한 줄씩 복사-붙여넣기** 합니다.

### 1-1. Homebrew 설치 확인
```bash
brew --version
```
- 버전 번호가 나오면 → 이미 설치됨, 다음으로
- `command not found` 가 나오면 → 아래 명령어로 설치:
```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```
> 설치 중 비밀번호를 물으면 Mac 로그인 비밀번호를 입력하세요 (입력해도 화면에 안 보이는 게 정상)

### 1-2. uv 설치
```bash
brew install uv
```
> uv는 Python 패키지를 쉽게 실행해주는 도구입니다.

### 1-3. 설치 확인
```bash
uvx --version
```
- 버전 번호가 나오면 성공
- `command not found` 가 나오면 → 터미널을 완전히 닫고 다시 열어서 재시도

---

## STEP 2: Claude Code에 구글 MCP 등록

### 2-1. 설정 파일 만들기

터미널에서 아래 명령어를 **그대로** 복사-붙여넣기 합니다:

```bash
cat > ~/.claude/.mcp.json << 'EOF'
{
  "mcpServers": {
    "workspace-mcp": {
      "command": "/opt/homebrew/bin/uvx",
      "args": [
        "workspace-mcp",
        "--single-user",
        "--tools", "gmail", "drive", "docs", "sheets", "calendar", "forms"
      ]
    }
  }
}
EOF
```

### 2-2. 잘 저장됐는지 확인
```bash
cat ~/.claude/.mcp.json
```
위에서 입력한 내용이 그대로 출력되면 성공입니다.

### 2-3. Claude Code 재시작
- 현재 열린 Claude Code를 완전히 종료합니다
- 터미널에서 `claude` 를 입력해 다시 실행합니다
- 시작 시 하단에 `workspace-mcp` 가 로드되는 메시지가 보이면 정상

---

## STEP 3: 구글 계정 인증 (OAuth)

### 이 단계에서 일어나는 일
Claude Code에서 구글 관련 명령을 처음 실행하면, 자동으로 브라우저가 열리면서 구글 로그인 화면이 나타납니다.

### 3-1. Claude Code에서 테스트 명령 입력
Claude Code 안에서 아래처럼 입력합니다:
```
오늘 캘린더 일정 보여줘. 이메일은 내이메일@gmail.com
```

### 3-2. 브라우저에서 인증
1. 자동으로 브라우저가 열립니다
2. 사용할 **Google 계정을 선택**합니다
3. "이 앱은 Google에서 확인하지 않았습니다" 경고가 나올 수 있음
   - `고급` 클릭 → `(앱이름)(으)로 이동(안전하지 않음)` 클릭
4. 권한 목록이 나오면 → **모두 허용** 클릭
5. 화면에 **"Authentication Successful"** 메시지가 나오면 성공!

### 3-3. Claude Code로 돌아가기
- 브라우저 탭을 닫습니다
- Claude Code에서 **같은 명령을 다시 입력**합니다
- 이번에는 정상적으로 결과가 나옵니다

---

## 자주 발생하는 에러와 해결법

### 에러 1: "localhost:8000 페이지를 찾을 수 없음" (가장 흔함)

**화면**: 권한 허용 후 브라우저에 "Not Found" 또는 "사이트에 연결할 수 없음" 표시

**원인**: Claude Code가 인증 응답을 받을 준비가 안 된 상태

**해결 방법**:
1. 브라우저 탭을 닫습니다
2. Claude Code를 완전히 종료합니다 (`Ctrl+C` 또는 창 닫기)
3. 터미널에서 `claude` 를 다시 실행합니다
4. 구글 관련 명령을 다시 입력합니다
5. 브라우저가 다시 열리면 인증을 다시 진행합니다

> **핵심**: Claude Code가 실행 중인 상태에서 인증해야 합니다. 인증 도중 Claude Code가 꺼지면 이 에러가 납니다.

---

### 에러 2: "API is not enabled for your project"

**화면**: Claude Code에서 "Calendar API is not enabled" 등의 메시지

**원인**: 구글 클라우드에서 해당 서비스의 API가 꺼져 있음

**해결 방법**:
1. 에러 메시지에 포함된 링크를 클릭합니다 (AI 비서에게 "링크 열어줘"라고 하면 됩니다)
2. 구글 클라우드 콘솔이 열립니다
3. **"사용"** 또는 **"Enable"** 버튼을 클릭합니다
4. 1~2분 기다립니다
5. Claude Code에서 다시 시도합니다

**자주 켜야 하는 API 목록** (각각 별도로 활성화 필요):
| 사용 기능 | 활성화할 API |
|----------|------------|
| 캘린더 | Google Calendar API |
| 메일 | Gmail API |
| 드라이브 | Google Drive API |
| 문서 | Google Docs API |
| 스프레드시트 | Google Sheets API |

---

### 에러 3: "uvx: command not found"

**원인**: uv가 설치되지 않았거나, 터미널이 설치 사실을 아직 모름

**해결 방법**:
```bash
brew install uv
```
설치 후 **터미널을 완전히 닫고 다시 열기** (이게 중요!)

---

### 에러 4: 인증이 계속 반복됨

**화면**: 명령할 때마다 매번 브라우저가 열리며 로그인 요구

**원인**: 토큰(인증 정보)이 제대로 저장되지 않음

**해결 방법**:
Claude Code에서 아래처럼 요청:
```
구글 MCP 토큰 초기화해줘. 저장된 인증 파일 삭제하고 다시 인증할게.
```

---

### 에러 5: "이 앱은 Google에서 확인하지 않았습니다"

**화면**: 브라우저에서 경고 화면 표시

**이건 에러가 아닙니다!** 정상적인 과정입니다.

**해결 방법**:
1. `고급` 또는 `Advanced` 클릭
2. `(앱이름)(으)로 이동(안전하지 않음)` 클릭
3. 권한 허용 계속 진행

---

## AI 비서에게 도움 요청하는 방법

### 설치가 안 될 때
```
구글 워크스페이스 MCP 설치하고 싶어.
내 구글 이메일은 OOO@gmail.com 이야.
터미널에서 뭘 해야 하는지 하나씩 알려줘.
```

### 에러가 났을 때
```
구글 MCP 연결하다가 에러 났어.
[에러 메시지 또는 스크린샷 붙여넣기]
어떻게 해결하면 돼?
```

### 인증이 안 될 때
```
구글 MCP 인증하는데 브라우저에서 "사이트에 연결할 수 없음"이 떠.
localhost:8000 페이지가 안 열려. 도와줘.
```

### 특정 API 활성화가 필요할 때
```
구글 캘린더 API를 활성화해야 한다는데, 어디서 켜는 거야?
링크 열어줘.
```

### 기능 사용 요청
```
오늘 캘린더 일정 보여줘. 이메일은 OOO@gmail.com
```
```
지난주에 온 메일 중에 "견적서" 포함된 거 찾아줘.
```
```
구글 드라이브에서 "사업계획서" 검색해줘.
```

---

## 분양 시 가이드 전달 방법

### 방법 1: CLAUDE.md에 구글 이메일 미리 세팅
분양 전, 고객의 프로젝트 폴더에 `CLAUDE.md` 파일을 만들어 아래 내용을 포함시킵니다:
```markdown
# 환경 설정
- 구글 이메일: 고객이메일@gmail.com
- 구글 MCP 설치 가이드: 이 가이드 파일 경로
```
이렇게 하면 AI 비서가 고객 이메일을 매번 묻지 않고 자동으로 사용합니다.

### 방법 2: bootstrap.sh에 MCP 설정 포함
분양 패키지의 `bootstrap.sh`에 아래를 추가하면, 설치 스크립트 실행만으로 MCP 설정이 자동 완료됩니다:
```bash
# Google Workspace MCP 자동 등록
mkdir -p ~/.claude
cat > ~/.claude/.mcp.json << 'MCPEOF'
{
  "mcpServers": {
    "workspace-mcp": {
      "command": "/opt/homebrew/bin/uvx",
      "args": [
        "workspace-mcp",
        "--single-user",
        "--tools", "gmail", "drive", "docs", "sheets", "calendar", "forms"
      ]
    }
  }
}
MCPEOF
echo "구글 MCP 설정 완료. Claude Code 재시작 후 첫 구글 명령 시 브라우저 인증이 필요합니다."
```

### 방법 3: 노션/문서로 전달
이 가이드 파일을 그대로 고객에게 공유합니다:
- **노션 페이지**에 복사-붙여넣기
- **PDF로 변환**해서 전달
- **구글 드라이브**에 올려서 링크 공유

### 분양 체크리스트
| 순서 | 항목 | 담당 |
|------|------|------|
| 1 | uv 설치 확인 | 고객 (가이드 보고 직접) |
| 2 | MCP 설정 파일 생성 | bootstrap.sh 자동 또는 고객 직접 |
| 3 | Claude Code 재시작 | 고객 직접 |
| 4 | 구글 OAuth 인증 | 고객 직접 (브라우저에서) |
| 5 | API 활성화 | 고객 직접 (에러 시 AI 비서가 안내) |
| 6 | 테스트 명령 실행 | 고객 직접 → 성공 확인 |

> **핵심**: 2번까지는 자동화 가능하고, 3~6번은 고객이 직접 해야 합니다.
> 막히면 **스크린샷 찍어서 AI 비서에게 보내달라**고 안내하세요.

---

## 요약: 3줄 정리

1. **uv 설치** → `brew install uv`
2. **설정 파일 저장** → `~/.claude/.mcp.json` 에 JSON 붙여넣기
3. **Claude Code 재시작 → 첫 명령 → 브라우저 인증 → 완료**

> 막히면 스크린샷 찍어서 AI 비서에게 보내주세요. 대부분 해결됩니다.
