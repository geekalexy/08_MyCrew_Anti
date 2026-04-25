// src/components/Log/LogDrawer.jsx — Phase 22 Sprint 1: Ari Socket 스트리밍
import { useLogStore } from '../../store/logStore';
import { useUiStore } from '../../store/uiStore';
import { useKanbanStore } from '../../store/kanbanStore';
import { useSocket } from '../../hooks/useSocket';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

// ── Ari 전용 Socket 싱글턴 (/ari 네임스페이스) ───────────────────────────────
// HTTP REST /api/chat 완전 대체 (Phase 22 Sprint 1)
let ariSocketInstance = null;
function getAriSocket() {
  if (!ariSocketInstance) {
    ariSocketInstance = io(`${SERVER_URL}/ari`, {
      withCredentials: true,
      reconnectionAttempts: 5,
    });
    ariSocketInstance.on('connect', () => console.log('[AriSocket] ✅ /ari 네임스페이스 연결됨'));
    ariSocketInstance.on('connect_error', (e) => console.warn('[AriSocket] 연결 실패:', e.message));
  }
  return ariSocketInstance;
}

// 입력창 우측 버튼 상태 머신
// 'idle'   → 카드 미선택: dimmed send 버튼
// 'stop'   → 카드 선택됨: Stop 버튼 (Kill用)
// 'send'   → Kill 후: Send 버튼 활성화
// 'sending'→ 전송 중: dimmed

export default function LogDrawer() {
  const logs = useLogStore((s) => s.logs);
  const {
    isLogPanelOpen, activeLogTab, setLogPanelOpen, setActiveLogTab,
    focusedTaskId, setFocusedTaskId, currentView,
  } = useUiStore();
  const tasks = useKanbanStore((s) => s.tasks);
  const { socket } = useSocket();

  const [panelWidth, setPanelWidth]   = useState(340);
  const [isResizing, setIsResizing]   = useState(false);
  const [inputText, setInputText]     = useState('');
  const [btnMode, setBtnMode]         = useState('idle'); // idle | stop | send | sending
  const [isDragOver, setIsDragOver]   = useState(false);  // 드래그&드롭 오버레이
  const [timelineComments, setTimelineComments] = useState([]); // [Fix Bug2] Timeline DB 댓글

  // ── Phase 22: Ari 스트리밍 상태 ──────────────────────────────────────────
  const [streamingText, setStreamingText] = useState('');   // 누적 청크
  const [isStreaming, setIsStreaming]     = useState(false); // 타이핑 중 여부

  const bottomRef       = useRef(null);
  const textareaRef     = useRef(null);
  const fileInputRef    = useRef(null);
  const asideRef        = useRef(null);
  const prevBtnModeRef  = useRef('idle');
  const backdropRef     = useRef(null); // [Fix] 하이라이트 백드롭 스크롤 동기화용

  const focusedTask = focusedTaskId
    ? Object.values(tasks).find((t) => String(t.id) === String(focusedTaskId))
    : null;

  // 카드 선택 상태가 바뀔 때 버튼 모드 리셋
  useEffect(() => {
    if (activeLogTab === 'time') {
      setBtnMode(focusedTask ? 'stop' : 'idle');
    } else {
      setBtnMode('send');
    }
  }, [focusedTaskId, activeLogTab, focusedTask]);

  // [UX] 전송 후 textarea 자동 포커스 복귀
  // sending → send/stop/idle 전환 시 (네트워크 응답 완료 후) 포커스 복원
  useEffect(() => {
    if (prevBtnModeRef.current === 'sending' && btnMode !== 'sending') {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
    prevBtnModeRef.current = btnMode;
  }, [btnMode]);

  // [UX] 스트리밍 종료 시에도 포커스 복귀 (Ari 채팅 응답 완료 후)
  useEffect(() => {
    if (!isStreaming) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  }, [isStreaming]);

  // 팀 상세 페이지, 프로필 페이지에서는 Chatting 탭을 디폴트로 활성화
  useEffect(() => {
    if (currentView === 'organization' || currentView === 'agent-detail') {
      setActiveLogTab('interaction');
    }
  }, [currentView, setActiveLogTab]);

  // [UX] 카드 포커스 시 → Timeline 탭 자동 전환
  useEffect(() => {
    if (focusedTaskId) {
      setActiveLogTab('time');
    }
  }, [focusedTaskId, setActiveLogTab]);

  // 로그 필터링: 타임라인은 선택된 태스크 기준, 채팅은 taskId가 부여되지 않은 글로벌(Ari 1:1 독대) 로그만 표시
  const displayLogs = activeLogTab === 'time'
    ? (focusedTaskId ? logs.filter((log) => String(log.taskId) === String(focusedTaskId)) : [])
    : logs.filter((log) => !log.taskId); // taskId가 있는 타임라인 전용 로그는 채팅방에서 격리

  // 타임라인용 필터 (하위 호환성 및 스크롤 감지용)
  const filteredLogs = focusedTaskId
    ? logs.filter((log) => String(log.taskId) === String(focusedTaskId))
    : logs;

  // [Fix Bug2] DB 댓글 + 실시간 로그 병합 (시간순, 중복 제거)
  const mergedTimeline = activeLogTab === 'time' ? [
    ...timelineComments.map(c => ({
      level: 'info', message: c.content, agentId: c.author,
      taskId: String(focusedTaskId || ''), timestamp: c.created_at, isComment: true,
    })),
    ...displayLogs,
  ].sort((a, b) => new Date(a.timestamp || 0) - new Date(b.timestamp || 0))
    .filter((item, idx, arr) =>
      arr.findIndex(x => x.message === item.message && x.agentId === item.agentId) === idx
    ) : displayLogs;

  // [Fix Bug2] focusedTaskId 변경 시 DB 댓글 로드
  useEffect(() => {
    if (!focusedTaskId) { setTimelineComments([]); return; }
    fetch(`${SERVER_URL}/api/tasks/${focusedTaskId}/comments`)
      .then(r => r.json())
      .then(data => setTimelineComments(Array.isArray(data.comments) ? data.comments : []))
      .catch(() => setTimelineComments([]));
  }, [focusedTaskId]);

  // [Fix Bug2] 소켓: 새 댓글 → timelineComments에 실시간 추가
  useEffect(() => {
    if (!socket) return;
    const handler = ({ taskId, author, text, createdAt }) => {
      if (String(taskId) === String(focusedTaskId)) {
        setTimelineComments(prev => {
          const exists = prev.some(c => c.content === text && c.author === author);
          if (exists) return prev;
          return [...prev, { author, content: text, created_at: createdAt || new Date().toISOString() }];
        });
      }
    };
    socket.on('task:comment_added', handler);
    return () => socket.off('task:comment_added', handler);
  }, [socket, focusedTaskId]);

  // 리사이즈
  const startResizing = useCallback((e) => { e.preventDefault(); setIsResizing(true); }, []);
  const stopResizing  = useCallback(() => setIsResizing(false), []);
  const resize = useCallback((e) => {
    if (!isResizing) return;
    const w = window.innerWidth - e.clientX;
    if (w > 320 && w < window.innerWidth * 0.65) setPanelWidth(w);
  }, [isResizing]);

  useEffect(() => {
    if (isResizing) {
      window.addEventListener('mousemove', resize);
      window.addEventListener('mouseup', stopResizing);
    }
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [isResizing, resize, stopResizing]);

  // 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayLogs.length, activeLogTab]);

  // textarea 자동 높이
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [inputText]);

  // ── 드래그 앤 드롭 ──────────────────────────────────────────
  const handleDragOver  = useCallback((e) => { e.preventDefault(); if (focusedTask) setIsDragOver(true); }, [focusedTask]);
  const handleDragLeave = useCallback((e) => {
    if (!asideRef.current?.contains(e.relatedTarget)) setIsDragOver(false);
  }, []);
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (!focusedTask) return;
    const file = e.dataTransfer.files?.[0];
    if (file) setInputText((prev) => prev + `[첨부: ${file.name}]`);
  }, [focusedTask]);

  // ── Kill 핸들러 ─────────────────────────────────────────────
  const handleKill = useCallback(() => {
    if (!focusedTask) return;
    fetch(`${SERVER_URL}/api/tasks/${focusedTask.id}/kill`, { method: 'POST' })
      .then(() => setBtnMode('send'))
      .catch(console.error);
  }, [focusedTask]);

  // ── Phase 22: Ari Socket 스트리밍 이벤트 구독 ──────────────────────────
  useEffect(() => {
    const ariSocket = getAriSocket();

    const onChunk = ({ text }) => {
      setStreamingText(prev => prev + text);
    };

    const onDone = ({ fullText, error } = {}) => {
      setIsStreaming(false);
      setStreamingText('');
      setBtnMode('send');
      // 완료된 응답은 로그 스토어에 추가 (서버 broadcastLog에서도 오지만 즉각 반영)
      if (fullText && !error) {
        useLogStore.getState().appendLog({
          level: 'info',
          message: fullText,
          agentId: 'ari',
          timestamp: new Date().toISOString(),
        });
      }
    };

    ariSocket.on('ari:stream_chunk', onChunk);
    ariSocket.on('ari:stream_done', onDone);

    return () => {
      ariSocket.off('ari:stream_chunk', onChunk);
      ariSocket.off('ari:stream_done', onDone);
    };
  }, []);

  const handleSend = useCallback(() => {
    if (!inputText.trim() || btnMode === 'sending') return;
    setBtnMode('sending');

    let fetchPromise;
    const trimmedText = inputText.trim();
    // 타임라인 탭이면서 태스크가 선택된 경우에만 해당 태스크의 코멘트로 전송
    if (focusedTask && activeLogTab === 'time') {
      // 1. 특정 태스크 내부의 코멘트 작성
      fetchPromise = fetch(`${SERVER_URL}/api/tasks/${focusedTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ author: '대표님', content: trimmedText }),
      });
    } else {
      // 2. 글로벌/채팅/타임라인(카드미선택) 처리
      if (activeLogTab === 'interaction') {
        // ── [Phase 22 Sprint 1] fetch → Socket 스트리밍 교체 ──────────────
        // HTTP REST /api/chat (블로킹, 10초 대기) 완전 폐기
        // 멘션(@) 파싱 제거: 이제 채팅은 오직 Ari와의 1:1로만 이루어집니다.
        const finalContent = trimmedText;

        // 서버의 broadcastLog가 소켓(log:append)으로 글로벌 갱신해주므로
        // 클라이언트 로컬에서 중복으로 appendLog를 쏘지 않도록 제거. (버그 픽스)

        // Ari Socket으로 메시지 발송 → 스트리밍 응답 수신
        setIsStreaming(true);
        setStreamingText('');
        getAriSocket().emit('ari:message', {
          content: finalContent,
          channel: 'dashboard',
          author: '대표님',
        });

        // 입력창 즉시 초기화 및 포커스 유지
        setInputText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          // 전송 후에도 계속해서 바로 타이핑할 수 있도록 포커스 강제 유지
          setTimeout(() => {
            if (textareaRef.current) textareaRef.current.focus();
          }, 0);
        }
        // btnMode는 ari:stream_done에서 'send'로 복귀
        return;
      } else if (activeLogTab === 'time') {
        // [Phase 14] Timeline 탭: #번호 소환 및 전환 기능
        const summonMatch = trimmedText.match(/^#(\d+)\s*(.*)/);
        if (summonMatch) {
          const targetId = summonMatch[1];
          const messageAfter = summonMatch[2];
          
          // 1. 해당 카드로 포커스 전환
          setFocusedTaskId(targetId);
          
          // 2. 메시지가 있다면 해당 카드에 코멘트로 전송
          if (messageAfter.trim()) {
            fetchPromise = fetch(`${SERVER_URL}/api/tasks/${targetId}/comments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ author: '대표님', content: messageAfter }),
            });
          } else {
            // 전환만 하는 경우 (no-op fetch)
            fetchPromise = Promise.resolve();
          }
        } else {
          // #번호 없이 입력한 경우 (Timeline에서는 아무 일도 일어남)
          // 혹은 일반 지시사항(Paperclip)으로 보낼 것인지 결정 필요 -> 일단 보류
          fetchPromise = Promise.resolve();
        }
      } else {
        // 기타 대화 (Legacy)
        fetchPromise = fetch(`${SERVER_URL}/webhook/antigravity/command`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'ISSUE_CREATE', payload: { title: trimmedText } }),
        });
      }
    }

    fetchPromise
      .then(() => {
        setInputText('');
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          setTimeout(() => {
            if (textareaRef.current) textareaRef.current.focus();
          }, 0);
        }
      })
      .catch(console.error)
      .finally(() => setBtnMode(activeLogTab === 'time' ? (focusedTask ? 'stop' : 'idle') : 'send'));
  }, [inputText, focusedTask, btnMode, activeLogTab]);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); handleSend(); }
  }, [handleSend]);

  // 동적 멘션 키워드 로드 (Phase 22: 아리 1:1 독대 체제로 인해 멘션 기능 제거)

  if (!isLogPanelOpen) return null;

  // ── 우측 액션 버튼 렌더 ────────────────────────────────────
  const renderActionBtn = () => {
    if (btnMode === 'idle') {
      return (
        <button
          disabled
          style={{
            background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.2)',
            border: 'none', borderRadius: '50%', width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'not-allowed',
          }}
          title="카드를 선택하면 활성화됩니다"
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_upward</span>
        </button>
      );
    }

    if (btnMode === 'stop') {
      // 텍스트가 입력되면 Kill 대신 Send 버튼 표시 (UX 보호)
      if (inputText.trim()) {
        // fall-through: 아래 send 버튼으로 표시
      } else {
        return (
          <button
            onClick={handleKill}
            title="실행 프로세스 중단 (Kill)"
            style={{
              background: 'rgba(255,82,82,0.12)', color: '#ff6b6b',
              border: '1px solid rgba(255,82,82,0.25)', borderRadius: '50%',
              width: 30, height: 30, display: 'flex', alignItems: 'center',
              justifyContent: 'center', cursor: 'pointer', transition: 'all 0.15s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>stop_circle</span>
          </button>
        );
      }
    }

    if (btnMode === 'sending') {
      return (
        <button
          disabled
          style={{
            background: 'rgba(124,110,248,0.3)', color: 'rgba(255,255,255,0.4)',
            border: 'none', borderRadius: '50%', width: 30, height: 30,
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'not-allowed',
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_upward</span>
        </button>
      );
    }

    // 'send' — 활성 Send
    return (
      <button
        onClick={handleSend}
        disabled={!inputText.trim()}
        title="전송 (Enter)"
        style={{
          background: inputText.trim()
            ? 'linear-gradient(135deg, #7C6EF8 0%, #9B8BFB 100%)'
            : 'rgba(124,110,248,0.2)',
          color: 'white', border: 'none', borderRadius: '50%',
          width: 30, height: 30, display: 'flex', alignItems: 'center',
          justifyContent: 'center', cursor: inputText.trim() ? 'pointer' : 'not-allowed',
          boxShadow: inputText.trim() ? '0 2px 12px rgba(124,110,248,0.45)' : 'none',
          transition: 'all 0.2s',
        }}
      >
        <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_upward</span>
      </button>
    );
  };

  return (
    <>
      <div
        className="log-drawer-backdrop"
        onClick={() => setLogPanelOpen(false)}
        style={{ pointerEvents: isResizing ? 'auto' : 'none' }}
      />

      <aside
        ref={asideRef}
        className="log-drawer"
        role="complementary"
        aria-label="작업 로그 패널"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          width: `${panelWidth}px`, height: '100dvh',
          transition: isResizing ? 'none' : 'transform 0.2s, width 0.1s',
          display: 'flex', flexDirection: 'column', position: 'relative',
        }}
      >
        {/* 리사이즈 핸들 */}
        <div
          onMouseDown={startResizing}
          style={{
            position: 'absolute', left: -3, top: 0, bottom: 0, width: 6,
            cursor: 'ew-resize', zIndex: 100,
            background: isResizing ? 'var(--brand)' : 'transparent',
            transition: 'background 0.2s',
          }}
        />

        {/* ── 드래그&드롭 오버레이 ─── */}
        {isDragOver && (
          <div
            style={{
              position: 'absolute', inset: 0, zIndex: 200, borderRadius: 'inherit',
              background: 'rgba(124,110,248,0.12)',
              border: '2px dashed rgba(124,110,248,0.6)',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
              backdropFilter: 'blur(4px)', pointerEvents: 'none',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', color: '#7C6EF8' }}>upload_file</span>
            <p style={{ color: '#9B8BFB', fontWeight: 700, fontSize: '0.9rem', textAlign: 'center' }}>
              Task #{focusedTask?.id}에 파일 첨부
            </p>
            <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.75rem' }}>여기에 놓으세요</p>
          </div>
        )}

        {/* ── 포커스 태스크 헤더 ─────────────────────────────── */}
        {focusedTask && (
          <div style={{
            background: 'var(--bg-surface-2)', padding: '0.6rem 1rem',
            borderBottom: '1px solid var(--border)', display: 'flex',
            alignItems: 'center', gap: '0.6rem', animation: 'fadeIn 0.2s',
          }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--brand)' }}>target</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginBottom: '0.1rem' }}>FOCUSED TASK</p>
              <p className="line-clamp-1" style={{ fontSize: '0.78rem', fontWeight: 600 }}>{focusedTask.title}</p>
            </div>
            <button
              onClick={() => setFocusedTaskId(null)}
              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '0.2rem' }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>close</span>
            </button>
          </div>
        )}

        {/* ── 탭 헤더 ───────────────────────────────────────── */}
        <div className="log-drawer__header">
          <div className="log-drawer__tabs">
            <button
              className={`log-drawer__tab ${activeLogTab === 'time' ? 'log-drawer__tab--active' : ''}`}
              onClick={() => setActiveLogTab('time')}
            >Timeline</button>
            <button
              className={`log-drawer__tab ${activeLogTab === 'interaction' ? 'log-drawer__tab--active' : ''}`}
              onClick={() => setActiveLogTab('interaction')}
            >Chatting</button>
          </div>
          <button className="log-drawer__collapse" onClick={() => setLogPanelOpen(false)}>
            <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>chevron_right</span>
          </button>
        </div>

        {/* ── 타임라인/채팅: 채팅 버블 UI ──────────────────── */}
        <div className="log-drawer__body" style={{ flex: 1, overflowY: 'auto' }}>
          {(activeLogTab === 'time' || activeLogTab === 'interaction') && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', padding: '1rem 0.8rem' }}>
              {mergedTimeline.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', paddingTop: '2rem' }}>
                  {activeLogTab === 'time' 
                    ? (focusedTaskId ? '이 태스크의 대화 내역이 없습니다.' : '테스크 카드를 선택하여 대화를 시작하세요.')
                    : 'AI Crew와의 대화가 없습니다.'}
                </div>
              ) : (
                <>
                  {mergedTimeline.length >= 15 && (
                    <div style={{ display: 'flex', justifyContent: 'center', margin: '1rem 0' }}>
                      <div style={{
                        display: 'inline-flex', alignItems: 'center', gap: '0.5rem',
                        background: 'rgba(124,110,248,0.08)', borderRadius: 20,
                        padding: '0.4rem 1rem', border: '1px solid rgba(124,110,248,0.2)',
                      }}>
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--brand)' }}>auto_awesome</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                          대화가 길어져 오래된 내용은 시야에서 사라져요.<br/>
                          하지만 질문하시면 아리가 기억해요! ✨
                        </span>
                      </div>
                    </div>
                  )}
                  {mergedTimeline.map((log, i) => {
                  const isUser   = log.agentId === '대표님' || log.agentId === 'user';
                  const isSystem = log.agentId === 'system';
                  const time     = new Date(log.timestamp).toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
                  const prevLog  = i > 0 ? mergedTimeline[i - 1] : null;
                  const sameAuthor = prevLog && prevLog.agentId === log.agentId;
                  // 메시지 내 '💬 XXX: ' 또는 'XXX: ' 프리픽스 제거 (레거시 형식 대응)
                  const cleanMsg = log.message.replace(/^💬\s*[\w가-힣]+:\s*/, '').replace(/^[\w가-힣]+:\s*/, (m) =>
                    isUser ? '' : m
                  );

                  // 시스템 이벤트: 중앙 뱃지
                  if (isSystem) {
                    return (
                      <div key={i} style={{ display: 'flex', justifyContent: 'center', margin: '0.6rem 0' }}>
                        <div style={{
                          display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                          background: 'rgba(255,255,255,0.04)', borderRadius: 20,
                          padding: '0.2rem 0.75rem', border: '1px solid rgba(255,255,255,0.06)',
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>info</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{log.message}</span>
                          <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', opacity: 0.5 }}>{time}</span>
                        </div>
                      </div>
                    );
                  }

                  // 사용자 발화: 우측 버블
                  if (isUser) {
                    return (
                      <div key={i} style={{
                        display: 'flex', justifyContent: 'flex-end',
                        marginTop: sameAuthor ? '0.15rem' : '0.8rem', animation: 'slideRight 0.2s forwards',
                      }}>
                        <div style={{ maxWidth: '78%' }}>
                          {!sameAuthor && (
                            <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', textAlign: 'right', marginBottom: '0.2rem', marginRight: '0.4rem' }}>
                              나 · {time}
                            </p>
                          )}
                          <div style={{
                            background: 'rgba(124,110,248,0.18)', color: 'var(--text-primary)',
                            borderRadius: '14px 4px 14px 14px', padding: '0.55rem 0.85rem',
                            fontSize: '1rem', lineHeight: 1.55, wordBreak: 'break-word',
                            border: '1px solid rgba(124,110,248,0.25)',
                          }}>
                            {cleanMsg}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // AI 에이전트 발화: 말풍선 없이 텍스트만 좌측 정렬
                  const agentInitial = (log.agentId || 'A').charAt(0).toUpperCase();
                  const agentColors  = { ari: '#7C6EF8', sonnet: '#4ECDC4', opus: '#F7D94C', luca: '#78C896' };
                  const agentColor   = agentColors[log.agentId] || '#9B8BFB';

                  return (
                    <div key={i} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                      marginTop: sameAuthor ? '0.1rem' : '0.9rem',
                    }}>
                      {/* 에이전트 아바타 */}
                      {!sameAuthor ? (
                        <div style={{
                          width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                          background: `${agentColor}1A`, border: `1.5px solid ${agentColor}55`,
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          fontSize: '0.6rem', fontWeight: 700, color: agentColor, marginTop: '0.1rem',
                        }}>
                          {agentInitial}
                        </div>
                      ) : (
                        <div style={{ width: 24, flexShrink: 0 }} />
                      )}

                      {/* 텍스트만 — 말풍선 없음 */}
                      <div style={{ flex: 1 }}>
                        {!sameAuthor && (
                          <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                            {log.agentId} <span style={{ opacity: 0.5 }}>· {time}</span>
                          </p>
                        )}
                        <p style={{
                          fontSize: '1rem', lineHeight: 1.6,
                          color: 'var(--text-secondary)', wordBreak: 'break-word',
                          margin: 0,
                        }}>
                          {cleanMsg}
                        </p>
                      </div>
                    </div>
                  );
                })}

                {/* ── Ari 스트리밍 버블: 생각 중 애니메이션 + 실시간 타이핑 ── */}
                {isStreaming && activeLogTab === 'interaction' && (
                  <div style={{
                    display: 'flex', alignItems: 'flex-start', gap: '0.5rem',
                    marginTop: '0.9rem', animation: 'fadeIn 0.15s',
                  }}>
                    <div style={{
                      width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
                      background: 'rgba(124,110,248,0.1)', border: '1.5px solid rgba(124,110,248,0.4)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.6rem', fontWeight: 700, color: '#7C6EF8', marginTop: '0.1rem',
                    }}>A</div>
                    <div style={{ flex: 1 }}>
                      <p style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: '0.15rem' }}>
                        ari <span style={{ opacity: 0.5 }}>· 방금</span>
                      </p>
                      {streamingText ? (
                        /* 텍스트 수신 중: 스트리밍 텍스트 + 커서 */
                        <p style={{ fontSize: '1rem', lineHeight: 1.6, color: 'var(--text-secondary)', wordBreak: 'break-word', margin: 0 }}>
                          {streamingText}
                          <span style={{
                            display: 'inline-block', width: '2px', height: '1em',
                            background: '#7C6EF8', marginLeft: '2px', verticalAlign: 'text-bottom',
                            animation: 'blink 0.8s step-end infinite',
                          }} />
                        </p>
                      ) : (
                        /* 대기 중: '생각 중...' 바운싱 닷 */
                        <p style={{ display: 'flex', alignItems: 'center', gap: '4px', margin: 0, height: '1.6rem' }}>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginRight: '2px' }}>생각 중</span>
                          {[0, 0.18, 0.36].map((delay, i) => (
                            <span key={i} style={{
                              display: 'inline-block', width: 5, height: 5, borderRadius: '50%',
                              background: '#7C6EF8', opacity: 0.7,
                              animation: `thinking-glow-pulse 1.2s ease-in-out ${delay}s infinite`,
                            }} />
                          ))}
                        </p>
                      )}
                    </div>
                  </div>
                )}
                </>
              )}
              <div ref={bottomRef} />
            </div>
          )}
        </div>

        {/* ── 프리미엄 커맨드 바 ──────────────────────────────── */}
        <div
          className="log-drawer__footer"
          style={{
            paddingBottom: 'max(1.2rem, env(safe-area-inset-bottom))',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg-surface)',
          }}
        >
          <div style={{
            display: 'flex', flexDirection: 'column', gap: '0.5rem', width: '100%',
            background: 'var(--bg-surface-2)', borderRadius: 14, padding: '0.6rem',
            border: `1px solid ${focusedTask ? 'rgba(124,110,248,0.45)' : 'var(--border)'}`,
            boxShadow: focusedTask ? '0 0 14px rgba(124,110,248,0.08)' : 'none',
            transition: 'all 0.2s',
          }}>
            <div style={{ position: 'relative', width: '100%', minHeight: 30 }}>
              {/* 하이라이트용 백드롭 — textarea와 스크롤 동기화 */}
              <div
                ref={backdropRef}
                style={{
                  position: 'absolute', inset: 0, padding: '0.2rem 0.4rem',
                  fontSize: '1.15rem', fontFamily: 'inherit', lineHeight: 1.5,
                  whiteSpace: 'pre-wrap', wordBreak: 'break-word',
                  color: 'var(--text-primary)', pointerEvents: 'none',
                  overflow: 'hidden',   // 스크롤바 숨김, scrollTop은 JS로 동기화
                }}
              >
                {activeLogTab === 'interaction' ? (
                  // [Chatting 탭] @멘션 하이라이트
                  inputText.split(/(@[a-zA-Z가-힣]+)/g).map((part, i) =>
                    part.match(/^@[a-zA-Z가-힣]+$/)
                      ? <span key={i} style={{ color: '#4ECDC4', fontWeight: 600 }}>{part}</span>
                      : part
                  )
                ) : (
                  // [Timeline 탭] @멘션(초록) + #번호(보라) 동시 하이라이트
                  inputText.split(/(@[a-zA-Z가-힣]+|#\d+)/g).map((part, i) => {
                    if (part.match(/^@[a-zA-Z가-힣]+$/))
                      return <span key={i} style={{ color: '#4ECDC4', fontWeight: 600 }}>{part}</span>;
                    if (part.match(/^#\d+$/))
                      return <span key={i} style={{ color: 'var(--brand)', fontWeight: 500 }}>{part}</span>;
                    return part;
                  })
                )}
                {/* 마지막에 공백이 있으면 줄바꿈 정렬을 위해 추가 */}
                {inputText.endsWith('\n') ? '\n' : ''}
              </div>

              <textarea
                ref={textareaRef}
                className="log-drawer__textarea"
                placeholder={
                  activeLogTab === 'time'
                    ? (focusedTask ? `Task #${focusedTask.id} 지시사항...` : '번호(#)를 입력하거나 카드를 선택하여 대화를 시작하세요...')
                    : 'AI Crew와 채팅하기...'
                }
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                onScroll={(e) => {
                  // [Fix] 백드롭과 스크롤 동기화 → 입력 중 텍스트 잘림 버그 해결
                  if (backdropRef.current) backdropRef.current.scrollTop = e.target.scrollTop;
                }}
                style={{
                  position: 'relative', width: '100%', background: 'none', border: 'none', resize: 'none',
                  color: 'transparent', caretColor: 'var(--text-primary)',
                  fontSize: '1.15rem', outline: 'none',
                  maxHeight: 150, minHeight: 30, padding: '0.2rem 0.4rem',
                  fontFamily: 'inherit', lineHeight: 1.5,
                  display: 'block', zIndex: 1
                }}
              />
            </div>

            {/* 버튼 행: [📎 clip] ────────────── [우측 액션 버튼] */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* 좌측: 클립 버튼 */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setInputText((prev) => prev + `[첨부: ${file.name}]`);
                    e.target.value = '';
                  }}
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="파일 첨부 (또는 드래그&드롭)"
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: (focusedTask || activeLogTab === 'interaction') ? 'var(--text-secondary)' : 'var(--text-muted)',
                    opacity: (focusedTask || activeLogTab === 'interaction') ? 1 : 0.4, transition: 'opacity 0.2s',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>attach_file</span>
                </button>

              </div>

              {/* 우측: 상태 머신 버튼 */}
              {activeLogTab === 'interaction' ? (
                <button
                  onClick={handleSend}
                  disabled={!inputText.trim() || btnMode === 'sending'}
                  title="전송 (Enter)"
                  style={{
                    background: inputText.trim()
                      ? 'linear-gradient(135deg, #7C6EF8 0%, #9B8BFB 100%)'
                      : 'rgba(124,110,248,0.2)',
                    color: 'white', border: 'none', borderRadius: '50%',
                    width: 30, height: 30, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', cursor: inputText.trim() ? 'pointer' : 'not-allowed',
                    boxShadow: inputText.trim() ? '0 2px 12px rgba(124,110,248,0.45)' : 'none',
                    transition: 'all 0.2s',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>arrow_upward</span>
                </button>
              ) : renderActionBtn()}
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
