# Claude Code 전용 탭 설정 가이드 (Antigravity IDE)

Antigravity IDE에서 구독 중인 **Claude Code**를 전용 탭으로 고정하여 사용하는 방법입니다.

## 1. 터미널에서 Claude Code 실행
1.  Antigravity 하단 패널의 **Terminal** 탭을 클릭합니다.
2.  아래 명령어를 입력하고 엔터를 누릅니다:
    ```bash
    export PATH=$PATH:/Users/alex/.nvm/versions/node/v24.14.1/bin
    npx -y @anthropic-ai/claude-code
    ```
    *(또는 이미 설치되어 있다면 `claude`만 입력)*

## 2. 전용 탭으로 고정하기
1.  실행된 터미널 탭의 제목("**bash**" 또는 "**zsh**")을 **우클릭**합니다.
2.  `Rename`을 선택하고 이름을 **"Claude Code"**로 변경합니다.
3.  다시 우클릭하여 **"Pin Tab"** (또는 고정 아이콘)을 선택합니다.

## 3. 사이드바(Activity Bar)로 이동
1.  이름을 변경한 **Claude Code** 탭을 마우스로 잡고 **활동 표시줄(왼쪽/오른쪽 아이콘 바)** 영역으로 드래그합니다.
2.  이제 독립적인 아이콘 탭으로 고정되어 다른 파일을 보면서도 언제든지 클로드와 대화할 수 있습니다.

## 4. (선택) 모델 선택창에 Claude 추가
1.  Antigravity 우측 하단이나 설정(`Cmd+,`)에서 **Model Selection**을 클릭합니다.
2.  `Add Provider` -> `Anthropic`을 선택하고 **API Key**를 입력합니다.
3.  이제 Antigravity 기본 채팅에서도 클로드 모델을 사용할 수 있습니다.
