// src/components/Views/ArtifactViewer.jsx
// Phase 21 — Task 3: 산출물 몰입형 풀스크린 뷰어 + 사이드 챗 패널
import { useState, useRef, useEffect, useCallback } from 'react';
import { useUiStore } from '../../store/uiStore';

const Icon = ({ name, size = '1rem', style = {} }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, lineHeight: 1, ...style }}>{name}</span>
);

/* ── 간이 마크다운 렌더러 ─────────────────────────────────── */
function MdRender({ content }) {
  const html = content
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/^### (.+)$/gm, '<h3 class="av-md-h3">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="av-md-h2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="av-md-h1">$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/`([^`\n]+)`/g, '<code class="av-md-code">$1</code>')
    .replace(/^&gt; (.+)$/gm, '<blockquote class="av-md-bq">$1</blockquote>')
    .replace(/^---$/gm, '<hr class="av-md-hr" />')
    .replace(/^- (.+)$/gm, '<li class="av-md-li">$1</li>')
    .replace(/(<li[^>]*>.*<\/li>\n?)+/g, (m) => `<ul class="av-md-ul">${m}</ul>`)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" style="max-width:100%; border-radius:12px; margin:1rem 0; border:1px solid var(--border);" />')
    .replace(/\n\n/g, '</p><p class="av-md-p">')
    .replace(/\n/g, '<br />');
  return <div className="av-md-root" dangerouslySetInnerHTML={{ __html: `<p class="av-md-p">${html}</p>` }} />;
}

/* ── 스켈레톤 로딩 메시지 ─────────────────────────────────── */
function SkeletonMessage() {
  return (
    <div className="av-chat-msg av-chat-msg--skeleton">
      <div className="av-skeleton-avatar" />
      <div className="av-skeleton-lines">
        <div className="av-skeleton-line" style={{ width: '80%' }} />
        <div className="av-skeleton-line" style={{ width: '60%' }} />
        <div className="av-skeleton-line" style={{ width: '72%' }} />
      </div>
    </div>
  );
}

/* ── 채팅 메시지 버블 ─────────────────────────────────────── */
function ChatMessage({ msg }) {
  const isUser = msg.role === 'user';
  return (
    <div className={`av-chat-msg ${isUser ? 'av-chat-msg--user' : 'av-chat-msg--agent'}`}>
      {!isUser && (
        <div className="av-chat-avatar">
          <Icon name="smart_toy" size="0.9rem" />
        </div>
      )}
      <div className={`av-chat-bubble ${isUser ? 'av-chat-bubble--user' : 'av-chat-bubble--agent'}`}>
        {msg.content}
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ───────────────────────────────────────── */
export default function ArtifactViewer() {
  const { activeArtifact, closeArtifact } = useUiStore();
  const [messages, setMessages] = useState([
    {
      id: 1,
      role: 'agent',
      content: `안녕하세요! **${activeArtifact?.agentName || 'AI 에이전트'}**입니다.\n이 문서에 대해 수정 요청이나 질문이 있으시면 말씀해 주세요.`,
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [docContent, setDocContent] = useState(activeArtifact?.content || '');
  const [editingChunkIdx, setEditingChunkIdx] = useState(null);
  const [editingChunkVal, setEditingChunkVal] = useState('');
  const [chatPulse, setChatPulse] = useState(false);
  const chatEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  /* 청크 단위로 분할 (\n\n 기준 문단) */
  const chunks = docContent.split('\n\n');

  const startEdit = (idx) => {
    setEditingChunkIdx(idx);
    setEditingChunkVal(chunks[idx]);
    setChatPulse(true);
    setTimeout(() => setChatPulse(false), 1800);
  };

  const saveChunk = () => {
    const next = [...chunks];
    next[editingChunkIdx] = editingChunkVal;
    setDocContent(next.join('\n\n'));
    setEditingChunkIdx(null);
  };

  /* ESC 키로 닫기 */
  useEffect(() => {
    const handleKey = (e) => { if (e.key === 'Escape') closeArtifact(); };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [closeArtifact]);

  /* 새 메시지 오면 스크롤 */
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isTyping]);

  const handleSend = useCallback(async () => {
    const text = input.trim();
    if (!text || isTyping) return;
    setInput('');
    setMessages((prev) => [...prev, { id: Date.now(), role: 'user', content: text }]);
    setIsTyping(true);

    /* Mock: 1.8초 후 에이전트 응답 */
    await new Promise((r) => setTimeout(r, 1800));
    setIsTyping(false);
    setMessages((prev) => [
      ...prev,
      {
        id: Date.now() + 1,
        role: 'agent',
        content: `"${text.slice(0, 30)}${text.length > 30 ? '…' : ''}" 내용을 반영하여 문서를 업데이트했습니다. 추가 수정이 필요하시면 말씀해 주세요.`,
      },
    ]);
  }, [input, isTyping]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
  };

  if (!activeArtifact) return null;

  return (
    <div className="av-root">
      <style dangerouslySetInnerHTML={{ __html: viewerCSS }} />

      {/* ── 좌상단 플로팅 뒤로가기 ── */}
      <button className="av-back-btn" onClick={closeArtifact} title="대시보드로 돌아가기 (ESC)">
        <Icon name="arrow_back" size="0.95rem" />
        대시보드로
      </button>

      {/* ── 메인 그리드: 좌(70%) + 우(30%) ── */}
      <div className="av-layout">

        {/* ── 좌측: 아티팩트 캔버스 ── */}
        <div className="av-canvas">
          <div className="av-canvas__inner">
            {/* 문서 헤더 */}
            <div className="av-doc-header">
              <div className="av-doc-header__meta">
                <span className="av-doc-header__tag">
                  <Icon name="description" size="0.8rem" />
                  {activeArtifact.type || 'Document'}
                </span>
                <span className="av-doc-header__agent">
                  <Icon name="smart_toy" size="0.8rem" style={{ color: 'var(--brand)' }} />
                  {activeArtifact.agentName || 'AI Agent'}
                </span>
              </div>
              <h1 className="av-doc-header__title">{activeArtifact.title}</h1>
            </div>

            {/* 데이터 레이어— 이미지는 그대로, 텍스트는 첨크단 변환 Click-to-Edit */}
            <div className="av-doc-body">
              {activeArtifact.type === 'image' ? (
                <img src={docContent} alt={activeArtifact.title} className="av-doc-image" />
              ) : (
                <div className="av-md-root" style={{ color: 'var(--text-secondary)' }}>
                  {chunks.map((chunk, idx) => (
                    editingChunkIdx === idx ? (
                      <textarea
                        key={idx}
                        autoFocus
                        value={editingChunkVal}
                        onChange={(e) => setEditingChunkVal(e.target.value)}
                        onBlur={saveChunk}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setEditingChunkIdx(null);
                          if (e.key === 'Enter' && e.metaKey) saveChunk();
                        }}
                        style={{
                          width: '100%', background: 'rgba(180,197,255,0.05)',
                          border: '1px solid rgba(180,197,255,0.25)',
                          borderRadius: '6px', color: 'var(--text-primary)',
                          fontSize: '0.92rem', lineHeight: 1.8, padding: '0.6rem 0.8rem',
                          resize: 'vertical', outline: 'none', fontFamily: 'inherit',
                          minHeight: '80px', marginBottom: '1rem',
                        }}
                      />
                    ) : (
                      <p
                        key={idx}
                        className="av-md-p av-editable-chunk"
                        onClick={() => startEdit(idx)}
                        title="클릭하여 편집 (⌘+Enter로 저장)"
                        style={{ cursor: 'text' }}
                      >
                        {chunk || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>빈 단락 (Click to edit)</span>}
                      </p>
                    )
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* ── 우측: 챗 패널 ── */}
        <div className="av-chat-panel" style={{
          transition: 'box-shadow 0.4s',
          boxShadow: chatPulse ? '0 0 0 2px var(--brand), 0 0 30px rgba(100,135,242,0.25)' : 'none',
        }}>
          {/* 챗 헤더 */}
          <div className="av-chat-header">
            <div className="av-chat-header__info">
              <div className="av-chat-header__dot" />
              <span className="av-chat-header__name">
                {activeArtifact.agentName || 'AI Agent'}
              </span>
            </div>
            <span className="av-chat-header__hint">
              <Icon name="edit_note" size="0.85rem" />
              문서 수정 요청
            </span>
          </div>

          {/* 메시지 목록 */}
          <div className="av-chat-messages">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} msg={msg} />
            ))}
            {isTyping && (
              <div className="av-chat-typing">
                <SkeletonMessage />
                <p className="av-chat-typing__label">에이전트가 문서를 수정 중입니다...</p>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* 입력창 — 하단 고정 (LogDrawer 동일 구조) */}
          <div className="av-chat-input-area">
            <div
              className="av-chat-input-wrap"
              style={{
                borderColor: input.trim() ? 'rgba(124,110,248,0.45)' : undefined,
                boxShadow:   input.trim() ? '0 0 14px rgba(124,110,248,0.08)' : 'none',
              }}
            >
              {/* 하이라이트 백드롭 (LogDrawer 스타일) */}
              <div
                style={{
                  position: 'absolute', inset: 0, padding: '0.2rem 0.4rem',
                  fontSize: '1.15rem', fontFamily: 'inherit', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  color: 'var(--text-primary)', pointerEvents: 'none', overflow: 'hidden',
                }}
              >
                {input || ''}
              </div>

              {/* 실제 입력 textarea */}
              <textarea
                ref={inputRef}
                className="av-chat-input"
                placeholder="수정 요청이나 질문을 입력하세요..."
                value={input}
                onChange={(e) => {
                  setInput(e.target.value);
                  if (inputRef.current) {
                    inputRef.current.style.height = 'auto';
                    inputRef.current.style.height = `${inputRef.current.scrollHeight}px`;
                  }
                }}
                onKeyDown={handleKeyDown}
                disabled={isTyping}
              />

              {/* 하단 행: 파일 첨부(좌) + 전송 버튼(우) */}
              <div className="av-input-actions">
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setInput((prev) => prev + `[\uccca8부: ${file.name}]`);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="파일 첨부"
                  className="av-clip-btn"
                  tabIndex={-1}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>attach_file</span>
                </button>

                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isTyping}
                  title="전송 (Enter)"
                  className="av-send-btn"
                  style={{
                    background: input.trim() && !isTyping
                      ? 'linear-gradient(135deg, #7C6EF8 0%, #9B8BFB 100%)'
                      : 'rgba(124,110,248,0.2)',
                    boxShadow: input.trim() && !isTyping ? '0 2px 12px rgba(124,110,248,0.45)' : 'none',
                    cursor: input.trim() && !isTyping ? 'pointer' : 'not-allowed',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_upward</span>
                </button>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

/* ── CSS ─────────────────────────────────────────────────── */
const viewerCSS = `
  @keyframes avFadeIn  { from { opacity: 0; } to { opacity: 1; } }
  @keyframes avSlideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes avPulse   { 0%,100%{ opacity:0.4; } 50%{ opacity:1; } }
  @keyframes avSkeletonShimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }

  /* ── 루트 (fullscreen overlay) ── */
  .av-root {
    position: fixed; inset: 0; z-index: 8000;
    background: var(--bg-base);
    animation: avFadeIn 0.25s ease both;
    display: flex; flex-direction: column;
  }

  /* ── 뒤로가기 플로팅 버튼 ── */
  .av-back-btn {
    position: fixed; top: 1.2rem; left: 1.4rem; z-index: 9000;
    display: flex; align-items: center; gap: 0.5rem;
    padding: 0.5rem 1.1rem; border-radius: 8px;
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    color: var(--text-secondary); font-size: 0.95rem; font-weight: 700;
    cursor: pointer; transition: all 0.18s; backdrop-filter: blur(8px);
    font-family: 'Space Grotesk', 'Inter', sans-serif;
    letter-spacing: -0.01em;
  }
  .av-back-btn:hover {
    background: rgba(255,255,255,0.1); color: var(--text-primary);
    border-color: rgba(255,255,255,0.18);
  }

  /* ── 메인 그리드 레이아웃 ── */
  .av-layout {
    display: grid;
    grid-template-columns: 1fr 340px;
    height: 100vh;
  }

  /* ── 좌측 캔버스 ── */
  .av-canvas {
    height: 100vh; overflow-y: auto;
    padding: 3.5rem 4rem 4rem 4rem;
    border-right: 1px solid var(--border);
    scroll-behavior: smooth;
  }
  .av-canvas__inner {
    max-width: 780px; margin: 0 auto;
    animation: avSlideUp 0.35s 0.1s ease both;
  }

  /* 문서 헤더 */
  .av-doc-header {
    margin-bottom: 2rem; padding-bottom: 1.5rem;
    border-bottom: 1px solid var(--border);
  }
  .av-doc-header__meta {
    display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.8rem;
  }
  .av-doc-header__tag {
    display: flex; align-items: center; gap: 0.3rem;
    font-size: 0.72rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;
    color: var(--text-muted); background: rgba(255,255,255,0.05);
    border: 1px solid var(--border); border-radius: 6px; padding: 0.2rem 0.55rem;
  }
  .av-doc-header__agent {
    display: flex; align-items: center; gap: 0.3rem;
    font-size: 0.72rem; color: var(--brand); font-weight: 600;
  }
  .av-doc-header__title {
    font-size: clamp(1.5rem, 3vw, 2.2rem); font-weight: 800;
    color: var(--text-primary); margin: 0; letter-spacing: -0.02em; line-height: 1.2;
  }

  /* 문서 본문 */
  .av-doc-body { color: var(--text-secondary); }
  .av-doc-image { max-width: 100%; border-radius: 12px; border: 1px solid var(--border); }

  /* 마크다운 스타일 */
  .av-md-root { }
  .av-md-h1 { font-size: 1.5rem; font-weight: 800; margin: 2rem 0 0.75rem; color: var(--text-primary); border-bottom: 1px solid var(--border); padding-bottom: 0.5rem; }
  .av-md-h2 { font-size: 1.15rem; font-weight: 700; margin: 1.75rem 0 0.6rem; color: var(--text-primary); }
  .av-md-h3 { font-size: 0.98rem; font-weight: 700; margin: 1.25rem 0 0.4rem; color: var(--brand); }
  .av-md-p  { font-size: 0.92rem; line-height: 1.8; color: var(--text-secondary); margin: 0.6rem 0; }
  .av-editable-chunk {
    border-radius: 4px; transition: background 0.15s;
    padding: 0.15rem 0.3rem; margin: 0.6rem -0.3rem;
  }
  .av-editable-chunk:hover {
    background: rgba(180,197,255,0.07);
    outline: 1px dashed rgba(180,197,255,0.2);
  }
  .av-md-ul { margin: 0.5rem 0; padding-left: 1.5rem; }
  .av-md-li { font-size: 0.92rem; line-height: 1.7; color: var(--text-secondary); margin: 0.2rem 0; }
  .av-md-code {
    font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.8rem;
    background: rgba(255,255,255,0.07); color: var(--brand);
    border: 1px solid var(--border); border-radius: 4px; padding: 0.1em 0.4em;
  }
  .av-md-bq {
    border-left: 3px solid var(--brand); margin: 0.8rem 0; padding: 0.5rem 1rem;
    background: var(--brand-glow); border-radius: 0 6px 6px 0;
    font-size: 0.88rem; color: var(--text-secondary);
  }
  .av-md-hr { border: none; border-top: 1px solid var(--border); margin: 1.5rem 0; }

  /* ── 우측 챗 패널 ── */
  .av-chat-panel {
    display: flex; flex-direction: column;
    height: 100vh; background: rgba(255,255,255,0.015);
  }

  /* 챗 헤더 */
  .av-chat-header {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1rem 1.1rem; border-bottom: 1px solid var(--border); flex-shrink: 0;
    padding-top: clamp(1rem, 3.5vh, 1.5rem);
  }
  .av-chat-header__info { display: flex; align-items: center; gap: 0.5rem; }
  .av-chat-header__dot {
    width: 7px; height: 7px; border-radius: 50%;
    background: var(--status-active);
    box-shadow: 0 0 6px var(--status-active-glow);
    animation: avPulse 2s ease-in-out infinite;
  }
  .av-chat-header__name { font-size: 0.85rem; font-weight: 700; color: var(--text-primary); }
  .av-chat-header__hint {
    display: flex; align-items: center; gap: 0.3rem;
    font-size: 0.7rem; color: var(--text-muted);
  }

  /* 메시지 목록 */
  .av-chat-messages {
    flex: 1; overflow-y: auto; padding: 1rem;
    display: flex; flex-direction: column; gap: 0.85rem;
  }

  /* 메시지 */
  .av-chat-msg {
    display: flex; gap: 0.6rem; align-items: flex-start;
    animation: avSlideUp 0.22s ease both;
  }
  .av-chat-msg--user { flex-direction: row-reverse; }
  .av-chat-avatar {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    background: rgba(180,197,255,0.12); color: var(--brand);
    display: flex; align-items: center; justify-content: center;
    border: 1px solid rgba(180,197,255,0.15);
  }
  .av-chat-bubble {
    max-width: 82%; padding: 0.6rem 0.85rem; border-radius: 12px;
    font-size: 0.82rem; line-height: 1.55;
  }
  .av-chat-bubble--agent {
    background: rgba(255,255,255,0.05); color: var(--text-secondary);
    border: 1px solid var(--border); border-radius: 4px 12px 12px 12px;
  }
  .av-chat-bubble--user {
    background: var(--brand); color: #090a0d;
    font-weight: 500; border-radius: 12px 4px 12px 12px;
  }

  /* 타이핑 인디케이터 */
  .av-chat-typing { display: flex; flex-direction: column; gap: 0.4rem; }
  .av-chat-typing__label {
    font-size: 0.72rem; color: var(--brand); margin: 0;
    animation: avPulse 1.4s ease-in-out infinite;
    padding-left: 2.2rem;
  }

  /* 스켈레톤 */
  .av-chat-msg--skeleton { pointer-events: none; }
  .av-skeleton-avatar {
    width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
    background: rgba(255,255,255,0.06);
  }
  .av-skeleton-lines { flex: 1; display: flex; flex-direction: column; gap: 0.45rem; padding-top: 0.2rem; }
  .av-skeleton-line {
    height: 12px; border-radius: 6px;
    background: linear-gradient(90deg,
      rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.09) 50%, rgba(255,255,255,0.04) 75%
    );
    background-size: 800px 100%;
    animation: avSkeletonShimmer 1.4s linear infinite;
  }

  /* 입력창 */
  .av-chat-input-area {
    flex-shrink: 0; padding: 0.75rem 0.85rem 0.9rem;
    border-top: 1px solid var(--border);
    background: var(--bg-surface);
  }
  .av-chat-input-wrap {
    display: flex; flex-direction: column; gap: 0.5rem;
    background: var(--bg-surface-2); border-radius: 14px; padding: 0.6rem;
    border: 1px solid var(--border);
    transition: border-color 0.2s, box-shadow 0.2s;
    position: relative;
  }
  .av-chat-input-wrap:focus-within {
    border-color: rgba(124,110,248,0.45);
    box-shadow: 0 0 14px rgba(124,110,248,0.08);
  }
  .av-chat-input {
    position: relative; width: 100%; background: none; border: none; resize: none;
    color: transparent; caret-color: var(--text-primary);
    font-size: 1.15rem; outline: none;
    max-height: 150px; min-height: 30px; padding: 0.2rem 0.4rem;
    font-family: inherit; line-height: 1.5;
    display: block; z-index: 1; overflow-y: auto;
  }
  .av-chat-input::placeholder { color: var(--text-muted); font-size: 1rem; }
  .av-chat-input:disabled { opacity: 0.5; }

  /* 하단 액션 행 */
  .av-input-actions {
    display: flex; justify-content: space-between; align-items: center;
  }
  .av-clip-btn {
    background: none; border: none; cursor: pointer;
    width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
    color: var(--text-secondary); opacity: 0.7; transition: opacity 0.2s;
    border-radius: 6px;
  }
  .av-clip-btn:hover { opacity: 1; }
  .av-send-btn {
    flex-shrink: 0; width: 30px; height: 30px; border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: none; transition: all 0.2s; color: white;
  }
  .av-send-btn:disabled { cursor: not-allowed; }

  /* ── 스크롤바 얇게 ── */
  .av-canvas::-webkit-scrollbar,
  .av-chat-messages::-webkit-scrollbar { width: 4px; }
  .av-canvas::-webkit-scrollbar-track,
  .av-chat-messages::-webkit-scrollbar-track { background: transparent; }
  .av-canvas::-webkit-scrollbar-thumb,
  .av-chat-messages::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 2px; }
`;
