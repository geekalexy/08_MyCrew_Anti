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

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    if (ariSocketInstance) {
      console.log('🔥 [HMR] Disconnecting old Ari socket instance');
      ariSocketInstance.disconnect();
      ariSocketInstance = null;
    }
  });
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
  const [attachedImages, setAttachedImages] = useState([]); // [ImageAttach] 첨부 이미지 [{dataUrl, name}]

  // ── Phase 22: Ari 스트리밍 상태 ──────────────────────────────────────────
  const [streamingText, setStreamingText] = useState('');   // 누적 청크
  const [isStreaming, setIsStreaming]     = useState(false); // 타이핑 중 여부

  // ── @멘션 자동완성 ────────────────────────────────────────────────────────
  // /api/agents에서 동적 로드 → role 필드 동기화
  const [crewList, setCrewList] = useState([
    { id: 'ari',   label: 'Ari',   role: '비서',               emoji: '🤖' },
    { id: 'nova',  label: 'Nova',  role: '브랜드 마케터',        emoji: '🌟' },
    { id: 'lumi',  label: 'Lumi',  role: '비주얼 아트 디렉터',  emoji: '✨' },
    { id: 'pico',  label: 'Pico',  role: '콘텐츠 카피라이터',  emoji: '🎬' },
    { id: 'ollie', label: 'Ollie', role: '그로스 데이터 분석가', emoji: '🔭' },
  ]);
  const EMOJI_MAP = { ari: '🤖', nova: '🌟', lumi: '✨', pico: '🎬', ollie: '🔭', lily: '🌸', luna: '🌙', luca: '🛠️', sonnet: '💡', opus: '🏛️', devteam: '👨‍💻' };

  useEffect(() => {
    fetch(`${SERVER_URL}/api/agents`)
      .then(r => r.json())
      .then(data => {
        const agents = data.agents || data;
        if (!Array.isArray(agents)) return;
        // 에이전트 목록을 CREW_LIST로 변환 (시스템 에이전트 제외)
        const SYSTEM_IDS = ['luca', 'sonnet', 'opus', 'devteam'];
        const list = agents
          .filter(a => !SYSTEM_IDS.includes(a.id))
          .map(a => ({
            id: a.id,
            label: a.nameKo || a.id,
            role: a.role || '',
            emoji: EMOJI_MAP[a.id] || '🤖',
          }));
        if (list.length > 0) setCrewList(list);
      })
      .catch(() => {}); // 오프라인 시 기본값 유지
  }, []);

  const [mentionQuery, setMentionQuery]       = useState('');   // @뒤 타이핑 중인 키워드
  const [showMention, setShowMention]         = useState(false); // 드롭다운 표시 여부
  const [mentionedAgent, setMentionedAgent]   = useState(null);  // 최종 선택된 에이전트
  const mentionRef = useRef(null);

  const filteredCrew = crewList.filter(c =>
    c.id.startsWith(mentionQuery.toLowerCase()) || c.label.toLowerCase().startsWith(mentionQuery.toLowerCase())
  );

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

  // ── [ImageAttach] Base64 변환 헬퍼 ───────────────────────────────────
  const readFileAsDataURL = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  // ── 드래그 앤 드롭: 이미지 base64 변환 ──────────────────────────────────
  const handleDragOver  = useCallback((e) => { e.preventDefault(); setIsDragOver(true); }, []);
  const handleDragLeave = useCallback((e) => {
    if (!asideRef.current?.contains(e.relatedTarget)) setIsDragOver(false);
  }, []);
  const handleDrop = useCallback(async (e) => {
    e.preventDefault();
    setIsDragOver(false);
    const files = Array.from(e.dataTransfer.files || []);
    const imageFiles = files.filter(f => f.type.startsWith('image/'));
    if (imageFiles.length > 0) {
      const results = await Promise.all(imageFiles.map(async (f) => ({
        dataUrl: await readFileAsDataURL(f),
        name: f.name,
      })));
      setAttachedImages(prev => [...prev, ...results].slice(0, 4)); // 최대 4장
    } else if (files.length > 0) {
      // 비이미지 파일은 텍스트로
      setInputText(prev => prev + files.map(f => `[첨부: ${f.name}]`).join(' '));
    }
  }, []);

  // ── [ImageAttach] 클립보드 블래시 붙여넣기 ────────────────────────────────
  const handlePaste = useCallback(async (e) => {
    const items = Array.from(e.clipboardData?.items || []);
    const imageItems = items.filter(item => item.type.startsWith('image/'));
    if (imageItems.length === 0) return; // 텍스트는 기본 동작
    e.preventDefault();
    const results = await Promise.all(
      imageItems.map(async (item) => {
        const file = item.getAsFile();
        if (!file) return null;
        return { dataUrl: await readFileAsDataURL(file), name: `클립보드_이미지_${Date.now()}.png` };
      })
    );
    const valid = results.filter(Boolean);
    if (valid.length > 0) {
      setAttachedImages(prev => [...prev, ...valid].slice(0, 4));
    }
  }, []);

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
    const hasText = inputText.trim().length > 0;
    const hasImages = attachedImages.length > 0;
    if ((!hasText && !hasImages) || btnMode === 'sending') return;
    
    setBtnMode('sending');

    const trimmedText = inputText.trim();
    setShowMention(false); // 전송 시 멘션 드롭다운 닫기

    // 이미지가 있으면 텍스트에 [IMAGE:n]을 놓는 대신 이미지를 직접 소켓에 포함 
    const imageDataUrls = attachedImages.map(img => img.dataUrl);
    let fetchPromise;
    // 타임라인 탭이면서 태스크가 선택된 경우에만 해당 태스크의 코멘트로 전송
    if (focusedTask && activeLogTab === 'time') {
      // 1. 특정 태스크 내부의 코멘튨 작성 (CEO 표기)
      const commentContent = imageDataUrls.length > 0
        ? [trimmedText, ...imageDataUrls.map(u => `![image](${u})`)].filter(Boolean).join('\n')
        : trimmedText;

      // @멘션 감지: 텍스트에서 @에이전트 추출 (서버 라우팅용)
      const mentionInText = trimmedText.match(/^@([a-zA-Z가-힣]+)/);
      const resolvedAgent = mentionedAgent
        || (mentionInText ? mentionInText[1].toLowerCase() : null);

      fetchPromise = fetch(`${SERVER_URL}/api/tasks/${focusedTask.id}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          author: 'CEO',
          content: commentContent,
          ...(resolvedAgent ? { assignedAgent: resolvedAgent } : {}),
        }),
      });
    } else {
      // 2. 글로벌/채팅/타임라인(카드미선택) 처리
      if (activeLogTab === 'interaction') {
        // ── [Phase 22 Sprint 1] fetch → Socket 스트리밍 교체 ──────────────
        // HTTP REST /api/chat (블로킹, 10초 대기) 완전 폐기

        // [ImageAttach] 이미지가 있는 경우에만 Optimistic append
        // - 텍스트 전용: 서버 broadcastLog(log:append)가 버블 생성 → 클라이언트 추가 불필요
        // - 이미지 포함: 서버는 broadcast 스킵(base64 데이터 없음) → 클라이언트가 직접 추가
        if (imageDataUrls.length > 0) {
          const imageMarkdown = imageDataUrls.map(u => `![image](${u})`).join('\n');
          const fullMessage = [trimmedText, imageMarkdown].filter(Boolean).join('\n');
          useLogStore.getState().appendLog({
            level: 'info',
            message: fullMessage,
            agentId: 'CEO',
            timestamp: new Date().toISOString(),
          });
        }

        const ariSocket = getAriSocket();
        
        // 소켓이 연결되지 않은 상태(오프라인/에러)라면 전송 차단 및 에러 안내
        if (!ariSocket.connected) {
          useLogStore.getState().appendLog({
            level: 'error',
            message: '서버 연결이 원활하지 않습니다. (소켓 오프라인) 잠시 후 다시 시도해주세요.',
            agentId: 'system',
            timestamp: new Date().toISOString(),
          });
          setBtnMode('send');
          return;
        }

        // Ari Socket으로 메시지 발송 → 스트리밍 응답 수신
        setIsStreaming(true);
        setStreamingText('');
        ariSocket.emit('ari:message', {
          content: trimmedText || '(이미지 전송)',
          channel: 'dashboard',
          author: 'CEO',
          images: imageDataUrls,
        });

        // 입력창 즉시 초기화 및 포커스 유지
        setInputText('');
        setAttachedImages([]);
        setMentionedAgent(null); // 전송 후 멘션 초기화
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          setTimeout(() => { if (textareaRef.current) textareaRef.current.focus(); }, 0);
        }
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

    fetchPromise = fetchPromise || Promise.resolve(); // fetchPromise 미설정 시 isSendingRef 잠금 방지

    fetchPromise
      .then(() => {
        setInputText('');
        setAttachedImages([]);
        setMentionedAgent(null); // 전송 후 멘션 초기화
        if (textareaRef.current) {
          textareaRef.current.style.height = 'auto';
          setTimeout(() => { if (textareaRef.current) textareaRef.current.focus(); }, 0);
        }
      })
      .catch(console.error)
      .finally(() => setBtnMode(activeLogTab === 'time' ? (focusedTask ? 'stop' : 'idle') : 'send'));
  }, [inputText, attachedImages, focusedTask, btnMode, activeLogTab, mentionedAgent]);

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
                  const isUser   = log.agentId === 'CEO' || log.agentId === '대표님' || log.agentId === 'user';
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
                          {/* 이미지 렌더링 (base64 또는 URL) */}
                          {(() => {
                            const imgRegex = /!\[image\]\((data:image\/[^)]+|https?:\/\/[^)]+)\)/g;
                            const imgs = [...cleanMsg.matchAll(imgRegex)].map(m => m[1]);
                            const textOnly = cleanMsg.replace(imgRegex, '').trim();
                            return (
                              <>
                                {textOnly && <span>{textOnly}</span>}
                                {imgs.map((src, ii) => (
                                  <img key={ii} src={src} alt="첨부 이미지"
                                    style={{ maxWidth: '100%', borderRadius: 8, marginTop: textOnly ? '0.4rem' : 0, display: 'block', border: '1px solid rgba(124,110,248,0.2)' }}
                                  />
                                ))}
                              </>
                            );
                          })()}
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
                    ? (focusedTask ? `Task #${focusedTask.id} 지시사항 (@멘션으로 에이전트 지정)...` : '번호(#)를 입력하거나 카드를 선택하여 대화를 시작하세요...')
                    : 'AI Crew와 채팅하기... (@에이전트명으로 직접 호출)'
                }
                value={inputText}
                onChange={(e) => {
                  const val = e.target.value;
                  setInputText(val);
                  // @멘션 감지: 마지막 @ 이후 텍스트 추출
                  const atIdx = val.lastIndexOf('@');
                  if (atIdx !== -1) {
                    const afterAt = val.slice(atIdx + 1);
                    // 공백이 없으면 아직 타이핑 중 → 드롭다운 표시
                    if (!afterAt.includes(' ') && !afterAt.includes('\n')) {
                      setMentionQuery(afterAt);
                      setShowMention(true);
                    } else {
                      setShowMention(false);
                    }
                  } else {
                    setShowMention(false);
                    setMentionedAgent(null);
                  }
                  // 높이 자동 조절
                  e.target.style.height = 'auto';
                  e.target.style.height = Math.min(e.target.scrollHeight, 150) + 'px';
                  if (backdropRef.current) backdropRef.current.scrollTop = e.target.scrollTop;
                }}
                onKeyDown={(e) => {
                  if (showMention && (e.key === 'Escape')) { e.preventDefault(); setShowMention(false); return; }
                  handleKeyDown(e);
                }}
                onBlur={() => setTimeout(() => setShowMention(false), 150)}
                onScroll={(e) => {
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

              {/* ── @멘션 자동완성 드롭다운 ────────────────────────────────── */}
              {showMention && filteredCrew.length > 0 && (
                <div
                  ref={mentionRef}
                  style={{
                    position: 'absolute', bottom: '100%', left: 0, right: 0, marginBottom: 6,
                    background: 'var(--bg-surface-2)', border: '1px solid rgba(124,110,248,0.4)',
                    borderRadius: 10, overflow: 'hidden', zIndex: 200,
                    boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                  }}
                >
                  {filteredCrew.map(crew => (
                    <button
                      key={crew.id}
                      onMouseDown={(e) => {
                        e.preventDefault(); // blur 방지
                        // @뒤 입력 부분을 선택한 에이전트로 대체
                        const atIdx = inputText.lastIndexOf('@');
                        const newText = inputText.slice(0, atIdx) + `@${crew.id} `;
                        setInputText(newText);
                        setMentionedAgent(crew.id);
                        setShowMention(false);
                        setTimeout(() => textareaRef.current?.focus(), 0);
                      }}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '0.5rem',
                        width: '100%', padding: '0.45rem 0.8rem',
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-primary)', fontSize: '0.88rem', textAlign: 'left',
                        transition: 'background 0.12s',
                      }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(124,110,248,0.15)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <span style={{ fontSize: '1rem' }}>{crew.emoji}</span>
                      <span style={{ fontWeight: 600, color: '#4ECDC4' }}>@{crew.id}</span>
                      <span style={{ opacity: 0.55, fontSize: '0.8rem' }}>{crew.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── [ImageAttach] 이미지 미리보기 스트립 ────────────────────────────────── */}
            {attachedImages.length > 0 && (
              <div style={{
                display: 'flex', gap: '0.4rem', flexWrap: 'wrap',
                padding: '0.3rem 0', borderBottom: '1px solid rgba(255,255,255,0.06)',
                marginBottom: '0.2rem',
              }}>
                {attachedImages.map((img, idx) => (
                  <div key={idx} style={{ position: 'relative', flexShrink: 0 }}>
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      style={{
                        width: 56, height: 56, objectFit: 'cover',
                        borderRadius: 8, border: '1px solid rgba(124,110,248,0.35)',
                        display: 'block',
                      }}
                    />
                    <button
                      onClick={() => setAttachedImages(prev => prev.filter((_, i) => i !== idx))}
                      title="제거"
                      style={{
                        position: 'absolute', top: -6, right: -6,
                        width: 18, height: 18, borderRadius: '50%',
                        background: 'rgba(40,40,60,0.92)', border: '1px solid rgba(255,255,255,0.18)',
                        color: 'rgba(255,255,255,0.8)', fontSize: '0.65rem',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        cursor: 'pointer', padding: 0,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: '0.7rem' }}>close</span>
                    </button>
                    {idx === 0 && attachedImages.length === 1 && (
                      <div style={{
                        position: 'absolute', bottom: 2, left: 2, right: 2,
                        background: 'rgba(0,0,0,0.55)', borderRadius: '0 0 6px 6px',
                        fontSize: '0.55rem', color: 'rgba(255,255,255,0.7)',
                        padding: '0 2px', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                      }}>{img.name.length > 12 ? img.name.slice(0, 12) + '…' : img.name}</div>
                    )}
                  </div>
                ))}
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', alignSelf: 'center', marginLeft: '0.2rem' }}>
                  {attachedImages.length}/4
                </div>
              </div>
            )}

            {/* 버튀 행: [📎 clip] ────────────── [우측 액션 버튀] */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              {/* 좌측: 클립 버튀 */}
              <div style={{ display: 'flex', gap: '0.4rem' }}>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  style={{ display: 'none' }}
                  onChange={async (e) => {
                    const files = Array.from(e.target.files || []);
                    const imageFiles = files.filter(f => f.type.startsWith('image/'));
                    if (imageFiles.length > 0) {
                      const results = await Promise.all(imageFiles.map(async (f) => ({
                        dataUrl: await readFileAsDataURL(f),
                        name: f.name,
                      })));
                      setAttachedImages(prev => [...prev, ...results].slice(0, 4));
                    }
                    e.target.value = '';
                  }}
                />
                {/* @ 멘션 아이콘 버튼 — 클릭 시 드롭다운 토글 (Timeline 탭에서만 표시) */}
                {activeLogTab === 'time' && (
                  <button
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setMentionQuery('');
                      setShowMention(prev => !prev);
                      setTimeout(() => textareaRef.current?.focus(), 0);
                    }}
                    title="@멘션으로 에이전트 지정"
                    style={{
                      background: showMention ? 'rgba(78,205,196,0.15)' : 'none',
                      border: showMention ? '1px solid rgba(78,205,196,0.35)' : 'none',
                      borderRadius: 8, cursor: 'pointer',
                      width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: showMention ? '#4ECDC4' : 'var(--text-secondary)',
                      transition: 'all 0.2s', fontWeight: 700, fontSize: '0.88rem',
                    }}
                  >
                    <span style={{ fontFamily: 'monospace', fontSize: '1rem', lineHeight: 1 }}>@</span>
                  </button>
                )}
                <button
                  onClick={() => fileInputRef.current?.click()}
                  title="이미지 첨부 (또는 드래그&드롭 / 붙여넣기)"
                  style={{
                    background: attachedImages.length > 0 ? 'rgba(124,110,248,0.15)' : 'none',
                    border: attachedImages.length > 0 ? '1px solid rgba(124,110,248,0.3)' : 'none',
                    borderRadius: 8, cursor: 'pointer',
                    width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: attachedImages.length > 0 ? 'var(--brand)' : 'var(--text-secondary)',
                    transition: 'all 0.2s',
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: '1.1rem' }}>attach_file</span>
                </button>
              </div>

              {/* 우측: 상태 머신 버튀 */}
              {activeLogTab === 'interaction' ? (
                <button
                  onClick={handleSend}
                  disabled={(inputText.trim().length === 0 && attachedImages.length === 0) || btnMode === 'sending'}
                  title="전송 (Enter)"
                  style={{
                    background: (inputText.trim() || attachedImages.length > 0)
                      ? 'linear-gradient(135deg, #7C6EF8 0%, #9B8BFB 100%)'
                      : 'rgba(124,110,248,0.2)',
                    color: 'white', border: 'none', borderRadius: '50%',
                    width: 30, height: 30, display: 'flex', alignItems: 'center',
                    justifyContent: 'center',
                    cursor: (inputText.trim() || attachedImages.length > 0) ? 'pointer' : 'not-allowed',
                    boxShadow: (inputText.trim() || attachedImages.length > 0) ? '0 2px 12px rgba(124,110,248,0.45)' : 'none',
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
