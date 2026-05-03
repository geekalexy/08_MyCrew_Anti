// src/components/Guidelines/TeamGuidelinesEditor.jsx
// Phase 21 — Task 2: 팀 가이드라인 마크다운 에디터 (team.md)
import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { useProjectStore } from '../../store/projectStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

const Icon = ({ name, size = '1rem', style = {} }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1, ...style }}>{name}</span>
);

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
  const { projects, allCrews, selectedProjectId } = useProjectStore();
  
  // 동적 기본값 생성 (Phase 33 Role ID 및 선택된 프로젝트 반영)
  const defaultMd = useMemo(() => {
    const project = projects.find(p => p.id === (agentId === 'team' ? selectedProjectId : agentId?.replace('guidelines_', '')));
    const assignedCrew = allCrews[project?.id] || [];
    
    let md = `# ${project ? project.name : agentName || '팀'} 플레이북\n\n`;
    if (project?.objective) {
      md += `> **목적**: ${project.objective}\n`;
    }
    md += `> 이 문서는 이 프로젝트에 배정된 AI 크루 전원이 작업을 수행할 때 따르는 SOP(표준 운영 절차)입니다.\n\n---\n\n`;
    
    md += `## 1. 크루 구성 & 역할\n\n`;
    if (assignedCrew.length > 0) {
      assignedCrew.forEach(c => {
        const agId = c.id || c.agent_id;
        const role = c.role_description || c.experiment_role || c.role || '팀원';
        md += `- **${c.nickname || agId}** (${agId}) — ${role}\n`;
      });
    } else {
      md += `- 프로젝트에 배정된 크루가 아직 없습니다.\n`;
    }
    
    md += `\n---\n\n## 2. 기본 워크플로우 & 규칙\n\n`;
    md += `1. **컨텍스트 확인**: 작업 시작 전 반드시 폴더의 최신 정보를 참조한다.\n`;
    md += `2. **인수인계**: 다음 담당자에게 넘길 때 [CCB] 카드 컨텍스트 블록 양식을 사용하여 핵심 결정사항을 전달한다.\n`;
    md += `3. **QA 필수**: 발행 전 요구사항(규격, 톤앤매너 등)이 충족되었는지 점검한다.\n`;
    md += `4. **승인 우선**: 대표님 승인 없이 독단적인 결제/배포 액션은 절대 불가하다.\n`;
    
    return md;
  }, [agentId, agentName, projects, allCrews, selectedProjectId]);

  const [content, setContent]     = useState(defaultMd);
  const [original, setOriginal]   = useState(defaultMd);
  const [mode, setMode]           = useState('split'); // 'edit' | 'preview' | 'split'
  const [showModal, setShowModal] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null); // null | 'saving' | 'saved' | 'error'
  const [versions, setVersions]   = useState([]); // 버전 리스트
  const textareaRef = useRef(null);

  const isDirty = content !== original;
  const isTeamPlaybook = agentId === selectedProjectId || agentId === 'team';

  // 버전 목록 로드 함수
  const fetchVersions = useCallback(() => {
    if (!isTeamPlaybook || !selectedProjectId) return;
    fetch(`${SERVER_URL}/api/projects/${selectedProjectId}/project_md/versions`)
      .then(r => r.json())
      .then(data => {
        if (data.versions) setVersions(data.versions);
      })
      .catch(() => {});
  }, [isTeamPlaybook, selectedProjectId]);

  /* ── 초기 데이터 및 버전 목록 로드 ── */
  useEffect(() => {
    if (!agentId) return;

    if (isTeamPlaybook && selectedProjectId) {
      fetch(`${SERVER_URL}/api/projects/${selectedProjectId}/project_md`)
        .then(r => r.json())
        .then(data => {
          if (data && data.content) {
            setContent(data.content);
            setOriginal(data.content);
          } else {
            setContent(defaultMd);
            setOriginal(defaultMd);
          }
          fetchVersions(); // 버전 목록도 같이 로드
        })
        .catch(() => {});
    } else {
      fetch(`${SERVER_URL}/api/settings?key=guidelines_${agentId}`)
        .then((r) => r.json())
        .then((data) => {
          const saved = data?.settings?.[`guidelines_${agentId}`];
          if (saved) { 
            setContent(saved); 
            setOriginal(saved); 
          } else {
            setContent(defaultMd);
            setOriginal(defaultMd);
          }
        })
        .catch(() => {});
    }
  }, [agentId, defaultMd, selectedProjectId, isTeamPlaybook, fetchVersions]);

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

  const handleSaveClick = useCallback(async () => {
    if (!isDirty) return;
    try {
      setSaveStatus('saving');
      
      let res;
      if (isTeamPlaybook && selectedProjectId) {
        res = await fetch(`${SERVER_URL}/api/projects/${selectedProjectId}/project_md`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content }),
        });
        // 저장 성공 시 버전 목록 갱신
        if (res.ok) fetchVersions();
      } else {
        res = await fetch(`${SERVER_URL}/api/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: `guidelines_${agentId}`, value: content }),
        });
      }

      if (!res.ok) throw new Error('Save failed');
      setOriginal(content);
      setSaveStatus('saved');
    } catch (err) {
      console.error(err);
      setSaveStatus('error');
    }
    setTimeout(() => setSaveStatus(null), 2500);
  }, [isDirty, content, selectedProjectId, agentId]);

  // ── 자동저장 (Auto-save) 로직 (수정 발생 후 2초 뒤 자동 저장)
  useEffect(() => {
    if (!isDirty) return;
    const timer = setTimeout(() => {
      handleSaveClick();
    }, 2000);
    return () => clearTimeout(timer);
  }, [content, isDirty, handleSaveClick]);

  // ── 브라우저 종료 시 보호 로직
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (isDirty) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [isDirty]);

  const handleReset = () => {
    if (window.confirm('모든 변경사항을 되돌릴까요?')) setContent(original);
  };

  const handleLoadVersion = (versionFileName) => {
    if (isDirty && !window.confirm('저장되지 않은 변경사항이 있습니다. 이전 버전을 불러오시겠습니까?')) return;
    
    fetch(`${SERVER_URL}/api/projects/${selectedProjectId}/project_md?version=${versionFileName}`)
      .then(r => r.json())
      .then(data => {
        if (data && data.content) {
          setContent(data.content);
          // original을 업데이트하여 바로 저장(isDirty=true)되게 만들지는 않음
        }
      })
      .catch(e => console.error(e));
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

      {/* ── 버전 리스트 (프로젝트 플레이북인 경우만 표시) ── */}
      {isTeamPlaybook && versions.length > 0 && (
        <div className="tge-versions-panel">
          <div className="tge-versions-header">
            <Icon name="history" size="0.8rem" /> 이전 버전 기록
          </div>
          <div className="tge-versions-list">
            {versions.map(v => (
              <div key={v.filename} className="tge-version-item">
                <span>{v.label}</span>
                <button 
                  className="tge-version-btn"
                  onClick={() => handleLoadVersion(v.filename)}
                  title="이 버전의 내용으로 즉시 복원합니다"
                >
                  Rollback
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

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

  /* ── 버전 리스트 ── */
  .tge-versions-panel {
    border-top: 1px solid var(--border);
    background: rgba(0,0,0,0.1);
    padding: 0.6rem 1rem;
    flex-shrink: 0;
  }
  .tge-versions-header {
    font-size: 0.75rem; font-weight: 600; color: var(--text-muted);
    margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.3rem;
  }
  .tge-versions-list {
    display: flex; gap: 0.5rem; overflow-x: auto; padding-bottom: 0.3rem;
  }
  .tge-version-item {
    display: flex; align-items: center; gap: 0.5rem;
    background: rgba(255,255,255,0.03); border: 1px solid var(--border);
    padding: 0.3rem 0.6rem; border-radius: 6px;
    font-size: 0.75rem; color: var(--text-secondary); white-space: nowrap;
  }
  .tge-version-btn {
    background: var(--brand-glow); color: var(--brand);
    border: none; border-radius: 4px; padding: 0.2rem 0.4rem;
    font-size: 0.65rem; cursor: pointer; font-weight: 600;
  }
  .tge-version-btn:hover { background: var(--brand); color: #000; }
`;
