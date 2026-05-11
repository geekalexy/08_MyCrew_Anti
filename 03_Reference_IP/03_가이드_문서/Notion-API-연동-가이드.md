# Notion API 연동 가이드

## 목적
C2(자비스)가 Notion 업무 문서를 직접 읽어 맥락 기반 판단을 할 수 있도록 연동합니다.
분양 시 고객에게 이 가이드를 전달합니다.

---

## 1단계: Notion Integration 생성 (API 키 발급)

1. **https://www.notion.so/my-integrations** 접속
2. **"새 인테그레이션"** (New Integration) 클릭
3. 설정:
   - 이름: `mycrew-assistant` (자유롭게)
   - 워크스페이스: 업무 노션이 있는 워크스페이스 선택
   - 기능: **읽기 전용** (Read content) 체크
4. **제출** 클릭
5. **Internal Integration Secret** 복사
   - `ntn_` 또는 `secret_`로 시작하는 긴 문자열
   - 이 키를 안전하게 보관

---

## 2단계: 노션 페이지에 Integration 연결

C2가 읽어야 할 **최상위 페이지**에서:

1. 페이지 우측 상단 **···** (더보기) 클릭
2. **"연결"** 또는 **"Connections"** 클릭
3. 1단계에서 만든 Integration 이름 검색 → 선택
4. **확인** 클릭

> 최상위 페이지에 연결하면 하위 페이지 모두 자동으로 접근 가능합니다.
> 여러 최상위 페이지가 있으면 각각 연결해야 합니다.

---

## 3단계: API 키 전달

발급받은 Integration Secret을 mycrew 설정에 입력합니다.

### 설치형 (모델 1)
bootstrap.sh 실행 시 프롬프트에서 입력:
```
Notion API 키를 입력하세요 (선택사항): ntn_xxxxx...
```

### 대행형 (모델 2)
텔레그램으로 API 키를 전달하면 세팅해드립니다.

---

## 4단계: C2 활용

연동 완료 후 C2가 할 수 있는 것:

| 기능 | 설명 |
|---|---|
| 업무 문서 참조 | 에이전트 보고 판단 시 관련 노션 문서를 읽고 맥락 파악 |
| 이슈 연결 | Paperclip 이슈와 관련된 노션 페이지 자동 매칭 |
| 요약 보고 | 노션 문서 기반으로 현황 요약 → 텔레그램 전달 |
| 판단 보조 | 에이전트 승인 요청 시 관련 정책/기준 문서 참조 후 의견 제시 |

---

## 주의사항

- API 키는 **절대 외부에 공유하지 마세요**
- 읽기 전용으로 설정하므로 노션 내용이 수정되지 않습니다
- 워크스페이스 소유자 또는 관리자 권한이 필요합니다
- Integration을 연결하지 않은 페이지는 API로 접근할 수 없습니다

---

## 기술 참고 (개발용)

### API 호출 예시
```python
import requests

NOTION_API_KEY = "ntn_xxxxx..."
headers = {
    "Authorization": f"Bearer {NOTION_API_KEY}",
    "Notion-Version": "2022-06-28",
    "Content-Type": "application/json"
}

# 페이지 검색
response = requests.post(
    "https://api.notion.com/v1/search",
    headers=headers,
    json={"query": "소시안 마케팅"}
)

# 페이지 내용 읽기
page_id = "xxxxx"
response = requests.get(
    f"https://api.notion.com/v1/blocks/{page_id}/children",
    headers=headers
)
```

### Bridge 통합 위치
`cmux_telegram_bridge.py` 또는 별도 `notion_reader.py` 모듈로 구현.
C2가 필요 시 `Bash`로 호출하거나, Bridge가 인박스 알림 시 자동 참조.

---

*작성일: 2026-04-05*
*프로젝트: mycrew*
*용도: 분양 시 고객 전달 + C2 자비스 기능 활성화*
