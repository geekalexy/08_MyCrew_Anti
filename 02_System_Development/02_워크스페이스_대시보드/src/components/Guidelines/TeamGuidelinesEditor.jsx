// src/components/Guidelines/TeamGuidelinesEditor.jsx
// Phase 21 — Task 2: 팀 가이드라인 마크다운 에디터 (team.md)
import { useState, useEffect, useRef } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

const Icon = ({ name, size = '1rem', style = {} }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1, ...style }}>{name}</span>
);

/* ── 기본 팀 가이드라인 템플릿 (SOCIAN_TEAM.md 기반) ──────── */
const DEFAULT_MD = `# 소시안 MyCrew 팀 플레이북 (Team Playbook)

> 이 문서는 AI 크루 전원이 작업을 수행할 때 따르는 SOP(표준 운영 절차)입니다.
> **다음 태스크부터 적용**되며, 진행 중인 태스크는 기존 규칙을 따릅니다.
> 버전: v2.0 | 최종 갱신: 2026-04-18

---

## 1. 크루 구성 & 역할

### 공통 — ARI (오케스트레이터)
- 대표님의 지시를 받아 두 팀에 동일 태스크를 동시 배분합니다.
- 발행 전 5-Points QA를 통과한 결과물만 보고합니다.
- 내부 멀티에이전트 복잡성을 사용자에게 노출하지 않습니다.

### 프로젝트 A팀 (초안·검증 라인)
- **NOVA** — 전략 마케터: 컨텍스트 로드 후 첫 기획안을 빠르게 제출합니다.
- **OLLIE** — 데이터 전략가: NOVA 기획안의 치명적 약점 3개 이상을 먼저 지목한 후 대안을 제시합니다.
- **ARI** — 판관: 양측을 채점하고 최상의 요소를 병합하여 최종안을 도출합니다.

### 프로젝트 B팀 (협력·발전 라인)
- **PICO** — 카피라이터: 제약 없이 창의적 카피·아이디어 뼈대를 발산합니다.
- **LUMI** — 비주얼 디렉터: PICO의 원시 텍스트를 SEO·포맷 규격에 맞춰 정제합니다.
- **ARI** — 어드바이저: 두 크루가 지나치게 비슷해질 때 개입하여 다양성을 유지합니다.
- **B4 회고자** (System): 태스크 완료 후 수정 내역을 분석하여 그라운드룰을 자동 갱신합니다.

---

## 2. 스킬 & 전문 영역

| 크루 | 핵심 스킬 | 출력 포맷 |
|------|-----------|-----------|
| NOVA | 3초 Hook 기획, 콘텐츠 피라미드, FOMO 전략 | 기획안 마크다운 |
| OLLIE | KPI 3계층 분석, 역설계, A/B 테스트 설계 | 분석 리포트 |
| PICO | 릴스 초단위 대본, 바이럴 트리거, 해시태그 3단계 | 플랫폼별 카피 |
| LUMI | Midjourney 프롬프트, 플랫폼 비율 규격, 즉시 렌더링 | 디자인 시안 |
| ARI | 발행 전 QA, CCB 인수인계, 에러 복구 계약 | 종합 보고서 |

---

## 3. 워크플로우 — 프로젝트 A팀 (3턴)

\`\`\`
[태스크 입력]
  ↓
NOVA (T+0): 컨텍스트 로드 → 템플릿 기반 초안 제출
  ↓
OLLIE (T+1): 약점 3개 이상 지목 → 대안 제시
  ↓
ARI (T+2): 채점 → 최상 요소 병합 → 최종안 → 대표님 보고
\`\`\`

**규칙**: OLLIE는 반드시 약점을 먼저 열거한 후 대안을 제시합니다. 순서 역전 불가.

---

## 4. 워크플로우 — 프로젝트 B팀 (4단계)

\`\`\`
[태스크 입력] + [팀 그라운드룰 자동 로드]
  ↓
Phase 1 (병렬): PICO 창의 발산 / LUMI 정밀 구조화 (상호 차단)
  ↓
Phase 2: ARI 방향 가이드 (판정 없음, 개선 방향만 제시)
  ↓
Phase 3 (병렬 교차): PICO가 LUMI 구조 흡수 / LUMI가 PICO 창의성 흡수
  ↓
Phase 4: ARI 동조 방지 + 최종 통합 → 대표님 보고
  ↓
[B4 자동 실행] 회고 일지 생성 → 팀 그라운드룰 갱신
\`\`\`

**규칙**: Phase 3 교차 흡수 시 단순 복사 금지. 반드시 자신의 관점으로 재해석합니다.

---

## 5. 인수인계 프로토콜 (CCB)

태스크를 다음 크루에게 넘길 때 반드시 아래 블록을 사용합니다:

\`\`\`
## [CCB] 카드 컨텍스트 블록
태스크 ID: SOC-XX
원래 요청: (대표님의 첫 지시 원문)
담당 히스토리:
  - @NOVA: 기획안 초안 작성 완료
  - @OLLIE: 약점 3개 지적 + 대안 제시 완료
핵심 결정:
  - 플랫폼: 인스타그램 릴스
  - Hook 패턴: FOMO형
제약 조건:
  - 발행 기한: [날짜]
  - 필수 포함: #소시안 #SaaS
다음 담당자 전달 사항: [내용]
\`\`\`

---

## 6. 발행 전 5-Points QA (ARI 필수 수행)

ARI는 모든 결과물을 대표님께 보고하기 전 아래 5가지를 점검합니다:

- [ ] 3초 Hook 유무 — 첫 문장이 시청자를 멈추게 하는가?
- [ ] 명확한 CTA — "저장 필수", "댓글 달아주세요" 등 행동 유도가 있는가?
- [ ] 플랫폼 규격 매칭 — 비율, 길이, 글자 수가 각 플랫폼 스펙에 맞는가?
- [ ] 해시태그 10개 이상 — 대·중·소 믹스로 구성됐는가?
- [ ] 브랜드 톤앤매너 — 소시안의 톤과 일관성이 있는가?

---

## 7. 팀 운영 원칙

- **최우선**: 대표님 승인 없이 결제·계약 관련 액션 절대 불가
- **개인정보**: PII 데이터 외부 API 전송 절대 불가
- **에러 발생 시**: 즉시 멈춤 → 원인 진단 → 자연어로 대표님 보고 → 승인 후 재개
- **보고 언어**: 기술 용어 금지. "NOVA 에이전트가 스킬 발동" ❌ → "기획안이 완성됐습니다" ✅

---

## 8. 팀 그라운드룰 (시드 v0)

1. 컨텍스트 폴더의 최신 정보를 반드시 참조한다.
2. 소시안의 공식 가격·기능은 추측하지 않고 확인한다.
3. 이전 태스크의 대표님 피드백을 다음 태스크에 반영한다.
4. 약점 지적 후에만 대안을 제시한다 (순서 역전 금지).
5. Phase 3 교차 흡수 시 단순 복사 금지 — 반드시 재해석한다.

---

*v2.0 업데이트: 크루 전체 로스터, 워크플로우, CCB 프로토콜, 5-Points QA 통합*
*B4 회고자가 스프린트 완료 시 이 문서의 섹션 8을 자동 갱신합니다.*
`;

/* ── 간이 마크다운 미리보기 렌더러 ─────────────────────── */
function MdPreview({ content }) {
  const html = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // headings
    .replace(/^### (.+)$/gm, '<h3 class="mdp-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="mdp-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="mdp-h1">$1</h1>')
    // bold / italic / inline code
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`]+)`/g, '<code class="mdp-code">$1</code>')
    // blockquote
    .replace(/^&gt; (.+)$/gm, '<blockquote class="mdp-blockquote">$1</blockquote>')
    // hr
    .replace(/^---$/gm, '<hr class="mdp-hr" />')
    // bullet list
    .replace(/^- (.+)$/gm, '<li class="mdp-li">$1</li>')
    .replace(/(\n?<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="mdp-ul">${m}</ul>`)
    // paragraphs (double newline)
    .replace(/\n\n/g, '</p><p class="mdp-p">')
    .replace(/\n/g, '<br />');

  return (
    <div
      className="mdp-root"
      dangerouslySetInnerHTML={{ __html: `<p class="mdp-p">${html}</p>` }}
    />
  );
}

/* ── 저장 확인 모달 ──────────────────────────────────────── */
function SaveConfirmModal({ onConfirm, onCancel }) {
  return (
    <div className="tge-modal-overlay" onClick={onCancel}>
      <div className="tge-modal" onClick={(e) => e.stopPropagation()}>
        <div className="tge-modal__icon">
          <Icon name="info" size="1.5rem" style={{ color: 'var(--brand)' }} />
        </div>
        <h3 className="tge-modal__title">가이드라인 저장</h3>
        <p className="tge-modal__body">
          변경사항은 <strong>다음 태스크부터 적용</strong>됩니다.<br />
          진행 중인 기존 태스크는 이전 규칙으로 계속 진행됩니다.<br /><br />
          저장하시겠습니까?
        </p>
        <div className="tge-modal__actions">
          <button className="tge-modal__cancel" onClick={onCancel}>취소</button>
          <button className="tge-modal__confirm" onClick={onConfirm}>
            <Icon name="save" size="0.9rem" />
            저장
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 메인 에디터 컴포넌트 ────────────────────────────────── */
export default function TeamGuidelinesEditor({ agentId, agentName }) {
  const [content, setContent]     = useState(DEFAULT_MD);
  const [original, setOriginal]   = useState(DEFAULT_MD);
  const [mode, setMode]           = useState('split'); // 'edit' | 'preview' | 'split'
  const [showModal, setShowModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const textareaRef = useRef(null);

  const isDirty = content !== original;

  /* 탭 진입 시 서버에서 기존 가이드라인 로드 (있으면) */
  useEffect(() => {
    if (!agentId) return;
    fetch(`${SERVER_URL}/api/settings?key=guidelines_${agentId}`)
      .then((r) => r.json())
      .then((data) => {
        const saved = data?.settings?.[`guidelines_${agentId}`];
        if (saved) { setContent(saved); setOriginal(saved); }
      })
      .catch(() => {});
  }, [agentId]);

  /* Tab 키 처리 — 들여쓰기 */
  const handleKeyDown = (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const { selectionStart: s, selectionEnd: en } = e.target;
      const next = content.slice(0, s) + '  ' + content.slice(en);
      setContent(next);
      requestAnimationFrame(() => {
        textareaRef.current.selectionStart = s + 2;
        textareaRef.current.selectionEnd   = s + 2;
      });
    }
  };

  const handleSaveClick = () => {
    if (!isDirty) return;
    setShowModal(true);
  };

  const handleConfirm = async () => {
    setShowModal(false);
    setSaveStatus('saving');
    try {
      await fetch(`${SERVER_URL}/api/settings`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: `guidelines_${agentId}`, value: content }),
      });
      setOriginal(content);
      setSaveStatus('saved');
    } catch {
      setSaveStatus('error');
    }
    setTimeout(() => setSaveStatus(null), 2500);
  };

  const handleReset = () => {
    if (window.confirm('모든 변경사항을 되돌릴까요?')) setContent(original);
  };

  const wordCount = content.trim().split(/\s+/).length;

  return (
    <div className="tge-root">
      <style dangerouslySetInnerHTML={{ __html: editorCSS }} />

      {/* 툴바 */}
      <div className="tge-toolbar">
        <div className="tge-toolbar__left">
          <span className="tge-filename">
            <Icon name="description" size="0.95rem" style={{ color: 'var(--brand)', opacity: 0.85 }} />
            {agentName ? `${agentName}/` : ''}
            <strong>team.md</strong>
          </span>
          {isDirty && <span className="tge-dirty-badge">수정됨</span>}
        </div>

        <div className="tge-toolbar__right">
          {/* 뷰 모드 토글 */}
          <div className="tge-view-toggle">
            {[
              { key: 'edit',    label: 'Edit',    icon: 'edit' },
              { key: 'split',   label: 'Split',   icon: 'view_column_2' },
              { key: 'preview', label: 'Preview', icon: 'visibility' },
            ].map(({ key, label, icon }) => (
              <button
                key={key}
                className={`tge-view-btn ${mode === key ? 'tge-view-btn--active' : ''}`}
                onClick={() => setMode(key)}
                title={label}
              >
                <Icon name={icon} size="0.9rem" />
                <span>{label}</span>
              </button>
            ))}
          </div>

          {/* 액션 버튼 */}
          {isDirty && (
            <button className="tge-btn tge-btn--ghost" onClick={handleReset} title="변경사항 되돌리기">
              <Icon name="undo" size="0.9rem" />
              되돌리기
            </button>
          )}
          <button
            className={`tge-btn tge-btn--save ${!isDirty ? 'tge-btn--disabled' : ''} ${saveStatus || ''}`}
            onClick={handleSaveClick}
            disabled={!isDirty || saveStatus === 'saving'}
          >
            {saveStatus === 'saving' && <span className="tge-spinner" />}
            {saveStatus === 'saved'  && <Icon name="check" size="0.9rem" />}
            {saveStatus === 'error'  && <Icon name="error" size="0.9rem" />}
            {!saveStatus && <Icon name="save" size="0.9rem" />}
            {saveStatus === 'saving' ? '저장 중...' :
             saveStatus === 'saved'  ? '저장 완료' :
             saveStatus === 'error'  ? '저장 실패' : 'Save'}
          </button>
        </div>
      </div>

      {/* 에디터 패널 */}
      <div className={`tge-panels tge-panels--${mode}`}>
        {/* 편집 패널 */}
        {(mode === 'edit' || mode === 'split') && (
          <div className="tge-panel tge-panel--edit">
            <div className="tge-panel__label">
              <Icon name="edit" size="0.75rem" />EDITOR
            </div>
            <textarea
              ref={textareaRef}
              className="tge-textarea"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              onKeyDown={handleKeyDown}
              spellCheck={false}
              autoComplete="off"
            />
          </div>
        )}

        {/* 미리보기 패널 */}
        {(mode === 'preview' || mode === 'split') && (
          <div className="tge-panel tge-panel--preview">
            <div className="tge-panel__label">
              <Icon name="visibility" size="0.75rem" />PREVIEW
            </div>
            <div className="tge-preview-scroll">
              <MdPreview content={content} />
            </div>
          </div>
        )}
      </div>

      {/* 상태 바 */}
      <div className="tge-statusbar">
        <span>{wordCount.toLocaleString()} words · {content.length.toLocaleString()} chars</span>
        {isDirty
          ? <span style={{ color: '#FBBF24' }}>● 미저장 변경사항</span>
          : <span style={{ color: 'var(--status-active)' }}>✓ 저장됨</span>
        }
      </div>

      {/* 저장 확인 모달 */}
      {showModal && (
        <SaveConfirmModal onConfirm={handleConfirm} onCancel={() => setShowModal(false)} />
      )}
    </div>
  );
}

/* ── 인라인 CSS ─────────────────────────────────────────── */
const editorCSS = `
  @keyframes tgeFadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes tgeModalIn {
    from { opacity: 0; transform: translateY(12px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes tgeSpin { to { transform: rotate(360deg); } }

  /* ── 루트 ── */
  .tge-root {
    display: flex; flex-direction: column;
    height: calc(100vh - 320px); min-height: 460px;
    border: 1px solid var(--border); border-radius: 14px;
    overflow: hidden; background: var(--bg-surface);
    animation: tgeFadeIn 0.25s ease both;
  }

  /* ── 툴바 ── */
  .tge-toolbar {
    display: flex; align-items: center; justify-content: space-between;
    padding: 0.55rem 0.85rem; border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,0.02); flex-shrink: 0; gap: 0.75rem; flex-wrap: wrap;
  }
  .tge-toolbar__left { display: flex; align-items: center; gap: 0.5rem; }
  .tge-toolbar__right { display: flex; align-items: center; gap: 0.5rem; }
  .tge-filename {
    font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 0.3rem;
  }
  .tge-filename strong { color: var(--text-primary); }
  .tge-dirty-badge {
    font-size: 0.65rem; background: rgba(251,191,36,0.12); color: #FBBF24;
    border: 1px solid rgba(251,191,36,0.25); border-radius: 100px; padding: 0.1rem 0.45rem;
    font-weight: 600;
  }

  /* ── 뷰 토글 ── */
  .tge-view-toggle {
    display: flex; gap: 0.15rem; background: rgba(255,255,255,0.04);
    border: 1px solid var(--border); border-radius: 8px; padding: 0.2rem;
  }
  .tge-view-btn {
    display: flex; align-items: center; gap: 0.3rem;
    padding: 0.25rem 0.55rem; border-radius: 6px; border: none;
    background: transparent; color: var(--text-muted); font-size: 0.72rem;
    font-weight: 500; cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .tge-view-btn--active {
    background: var(--brand-glow); color: var(--brand); font-weight: 700;
  }
  .tge-view-btn:hover:not(.tge-view-btn--active) { color: var(--text-primary); }

  /* ── 버튼 ── */
  .tge-btn {
    display: flex; align-items: center; gap: 0.3rem;
    padding: 0.4rem 0.8rem; border-radius: 8px; border: 1px solid var(--border);
    font-size: 0.78rem; font-weight: 600; cursor: pointer; transition: all 0.18s; font-family: inherit;
  }
  .tge-btn--ghost { background: transparent; color: var(--text-muted); }
  .tge-btn--ghost:hover { color: var(--text-primary); border-color: rgba(255,255,255,0.12); }
  .tge-btn--save {
    background: var(--brand); color: #090a0d; border-color: transparent;
  }
  .tge-btn--save:hover:not(.tge-btn--disabled) { filter: brightness(1.1); }
  .tge-btn--save.tge-btn--disabled { background: var(--border); color: var(--text-muted); cursor: default; }
  .tge-btn--save.saved { background: rgba(74,222,128,0.15); color: #4ade80; border-color: rgba(74,222,128,0.3); }
  .tge-btn--save.error { background: rgba(248,113,113,0.12); color: #f87171; border-color: rgba(248,113,113,0.3); }
  .tge-btn:disabled { cursor: not-allowed; }

  /* ── 스피너 ── */
  .tge-spinner {
    display: inline-block; width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid rgba(9,10,13,0.3); border-top-color: #090a0d;
    animation: tgeSpin 0.7s linear infinite;
  }

  /* ── 패널 레이아웃 ── */
  .tge-panels {
    display: grid; flex: 1; overflow: hidden;
  }
  .tge-panels--edit    { grid-template-columns: 1fr; }
  .tge-panels--preview { grid-template-columns: 1fr; }
  .tge-panels--split   { grid-template-columns: 1fr 1fr; }

  .tge-panel {
    display: flex; flex-direction: column; overflow: hidden;
    border-right: 1px solid var(--border);
  }
  .tge-panel:last-child { border-right: none; }
  .tge-panel--preview { border-right: none; }

  .tge-panel__label {
    padding: 0.3rem 0.85rem; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em;
    color: var(--text-muted); border-bottom: 1px solid var(--border);
    background: rgba(255,255,255,0.015); flex-shrink: 0;
    display: flex; align-items: center; gap: 0.3rem; text-transform: uppercase;
  }

  /* ── 텍스트에어리어 ── */
  .tge-textarea {
    flex: 1; resize: none; border: none; outline: none;
    padding: 1.2rem; font-family: 'SF Mono', 'Fira Code', monospace;
    font-size: 0.82rem; line-height: 1.7;
    background: transparent; color: var(--text-primary); tab-size: 2;
    overflow-y: auto;
  }
  .tge-textarea::selection { background: var(--brand-glow); }

  /* ── 미리보기 스크롤 ── */
  .tge-preview-scroll {
    flex: 1; overflow-y: auto; padding: 1.2rem 1.5rem;
  }

  /* ── 마크다운 스타일 ── */
  .mdp-root { animation: tgeFadeIn 0.2s ease; }
  .mdp-h1 { font-size: 1.35rem; font-weight: 800; margin: 0 0 0.75rem 0; color: var(--text-primary); border-bottom: 1px solid var(--border); padding-bottom: 0.4rem; }
  .mdp-h2 { font-size: 1.05rem; font-weight: 700; margin: 1.25rem 0 0.5rem 0; color: var(--text-primary); }
  .mdp-h3 { font-size: 0.95rem; font-weight: 700; margin: 1rem 0 0.4rem 0; color: var(--brand); }
  .mdp-p  { font-size: 0.85rem; line-height: 1.7; color: var(--text-secondary); margin: 0.4rem 0; }
  .mdp-ul { margin: 0.4rem 0; padding-left: 1.4rem; }
  .mdp-li { font-size: 0.85rem; line-height: 1.6; color: var(--text-secondary); margin: 0.15rem 0; }
  .mdp-code {
    font-family: 'SF Mono', monospace; font-size: 0.78rem;
    background: rgba(255,255,255,0.06); color: var(--brand);
    border: 1px solid var(--border); border-radius: 4px; padding: 0.1em 0.35em;
  }
  .mdp-blockquote {
    border-left: 3px solid var(--brand); margin: 0.75rem 0; padding: 0.4rem 0.9rem;
    background: var(--brand-glow); border-radius: 0 6px 6px 0;
    font-size: 0.83rem; color: var(--text-secondary); font-style: italic;
  }
  .mdp-hr { border: none; border-top: 1px solid var(--border); margin: 1rem 0; }

  /* ── 상태 바 ── */
  .tge-statusbar {
    display: flex; justify-content: space-between; align-items: center;
    padding: 0.35rem 0.85rem; border-top: 1px solid var(--border); flex-shrink: 0;
    font-size: 0.7rem; color: var(--text-muted); background: rgba(255,255,255,0.01);
  }

  /* ── 저장 확인 모달 ── */
  .tge-modal-overlay {
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(4px);
    display: flex; align-items: center; justify-content: center;
    animation: tgeFadeIn 0.2s ease;
  }
  .tge-modal {
    background: var(--bg-surface);
    border: 1px solid var(--border); border-radius: 18px;
    padding: 2rem; max-width: 400px; width: 90%;
    text-align: center; position: relative;
    animation: tgeModalIn 0.28s cubic-bezier(0.34,1.56,0.64,1) both;
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
  }
  .tge-modal__icon { margin-bottom: 0.75rem; }
  .tge-modal__title {
    font-size: 1.05rem; font-weight: 800; margin: 0 0 0.75rem 0; color: var(--text-primary);
  }
  .tge-modal__body {
    font-size: 0.85rem; color: var(--text-secondary); line-height: 1.65; margin: 0 0 1.5rem 0;
  }
  .tge-modal__body strong { color: var(--brand); }
  .tge-modal__actions { display: flex; gap: 0.6rem; justify-content: center; }
  .tge-modal__cancel {
    padding: 0.6rem 1.2rem; border-radius: 10px; border: 1px solid var(--border);
    background: transparent; color: var(--text-secondary); font-size: 0.875rem;
    font-weight: 600; cursor: pointer; transition: all 0.15s; font-family: inherit;
  }
  .tge-modal__cancel:hover { border-color: rgba(255,255,255,0.15); color: var(--text-primary); }
  .tge-modal__confirm {
    padding: 0.6rem 1.4rem; border-radius: 10px; border: none;
    background: var(--brand); color: #090a0d; font-size: 0.875rem;
    font-weight: 700; cursor: pointer; transition: filter 0.15s; font-family: inherit;
    display: flex; align-items: center; gap: 0.35rem;
  }
  .tge-modal__confirm:hover { filter: brightness(1.1); }
`;
