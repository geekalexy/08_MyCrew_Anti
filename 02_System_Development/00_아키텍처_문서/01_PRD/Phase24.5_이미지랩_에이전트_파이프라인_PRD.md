# Phase 24.5: ImageLab 에이전트 자동화 파이프라인 PRD
> 작성: Luca / 2026-04-22 23:25 KST

## 🎯 핵심 아이디어

**"에이전트가 이미지랩 스튜디오를 직접 쓴다"**

사람이 UI를 클릭하는 대신, 에이전트가 기존 ImageLab API를 HTTP로 직접 호출.
이미지 생성 → HTML 편집 → 아카이브 → 비디오 소스 토스까지 완전 자동화.

---

## 📐 전체 파이프라인 아키텍처

```
CurationAgent (시나리오 확정)
       │
       │ scenes[] + theme 정보 전달
       ▼
ImageLabAgent (NEW ⭐)
   ├─ 씬별 visuals 분석 (How many images? What type?)
   ├─ POST /api/imagelab/brand-generate  (AI 이미지)
   ├─ POST /api/imagelab/html-generate   (HTML 코딩 카드)
   ├─ POST /api/imagelab/archive         (아카이브 저장 + htmlCode 보관)
   └─ 아카이브 파일 경로 배열 반환
       │
       │ imageAssets[] = [ { sceneType, filePath, archiveUrl } ]
       ▼
VideoAdapter (Remotion Render)
   └─ remotionProps.scenes[i].assetImage = filePath
       │
       ▼
YouTube Upload ← 완성된 MP4
```

---

## 🧩 ImageLabAgent 설계 (NEW)

### 역할
CurationAgent가 만든 시나리오 JSON을 받아, 각 씬에 필요한 이미지를 자동 생성하고 아카이브에 저장. 파일 경로 배열을 VideoAdapter에 전달.

### 씬 타입별 이미지 전략

| 씬 타입 | 생성 방식 | 설명 |
|---------|-----------|------|
| `hook` | `brand-generate` | 임팩트 강한 AI 이미지 (FLUX/Imagen3) |
| `problem` | `html-generate` | 텍스트+그래픽 조합 HTML 카드 |
| `proof` | `html-generate` | 데이터/차트 느낌 HTML 인포그래픽 |
| `climax` | `brand-generate` | 클라이맥스용 강렬한 AI 이미지 |
| `cta` | `html-generate` | "구독↑좋아요" CTA 버튼 HTML 카드 |

### API 호출 흐름
```js
// 1. AI 이미지 생성 (hook, climax)
POST /api/imagelab/brand-generate
{
  description: scene.textLines.join(' '),
  contentType: 'feed',        // 1:1 비율
  brandPresetId: 'signature',
  lumiDirecting: true         // Lumi 크리에이티브 디렉팅 ON
}

// 2. HTML 카드 생성 (problem, proof, cta)
POST /api/imagelab/html-generate
{
  description: scene.textLines.join('\n'),
  width: 1080, height: 1080,
  colors: theme.colors,
  brandName: 'Socian',
  contentLabel: scene.type
}
// → 반환된 html 코드 그대로 아카이브 저장

// 3. 아카이브 저장 (모든 씬)
POST /api/imagelab/archive
{
  imageUrl: result.imageUrl,  // AI 이미지 URL
  htmlCode: result.html,      // HTML 코드 (html-generate의 경우)
  contentType: scene.type,
  description: scene.textLines[0],
  tags: ['autopilot', channelType, today]
}
// → { archived: { url, filePath } } 반환
```

---

## 🔌 VideoAdapter 수정사항

현재 `remotionProps.scenes[i]`에 `assetImage` 없음. 추가 필요:

```js
// Before (현재)
{ type: 'hook', durationFrames: 150, textLines: [...] }

// After (수정)
{ type: 'hook', durationFrames: 150, textLines: [...],
  assetImage: '/outputs/brand-archive/socian_hook_1776900000.png',
  assetImageLocal: true  // Remotion이 로컬 파일 직접 읽음
}
```

---

## 📁 새로 생성할 파일

```
01_아리_엔진/
└── ai-engine/
    └── agents/
        └── youtube-autopilot/
            ├── ImageLabAgent.js    ⭐ NEW — 이미지 생성 에이전트
            ├── CurationAgent.js   ✅ 기존
            ├── DataHarvester.js   ✅ 기존
            └── index.js           🔧 수정 — ImageLabAgent 파이프라인 삽입
```

---

## 🚀 구현 우선순위

1. **[P0] `ImageLabAgent.js` 구현** — 씬→이미지 생성 루프
2. **[P0] `index.js` 수정** — CurationAgent → ImageLabAgent → VideoAdapter 연결
3. **[P1] VideoAdapter Remotion 씬에 이미지 경로 주입** — `assetImage` 필드 처리
4. **[P2] 대시보드 연동** — 생성된 아카이브 이미지 VideoLab에서 미리보기

---

## 💡 핵심 장점

- **병목 제거**: 시나리오 확정 즉시 이미지도 자동 생성. 사람 대기 시간 0.
- **인프라 재사용**: 이미지랩 API 그대로 활용. 추가 서버 없음.
- **품질 보장**: Lumi 크리에이티브 디렉팅으로 브랜드 일관성 자동 유지.
- **HTML 코드 보관**: 아카이브에 htmlCode 저장됨 (세션 2에서 구현 완료) → 에이전트가 나중에 불러와 재편집 가능.
