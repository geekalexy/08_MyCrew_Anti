// src/components/TerminalLog.jsx
// 실시간 로그 패널 (최대 200건 GC는 Zustand에서 처리)
import { useKanbanStore } from '../store/kanbanStore';
import { useEffect, useRef } from 'react';

const LOG_LEVEL_EMOJI = {
  info:    'ℹ️',
  success: '✅',
  error:   '❌',
  warn:    '⚠️',
};

export default function TerminalLog() {
  const logs = useKanbanStore((s) => s.logs);
  const bottomRef = useRef(null);

  // 새 로그 추가 시 자동 스크롤
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs.length]);

  return (
    <div className="terminal-log" role="log" aria-live="polite" aria-label="에이전트 작업 로그">
      <div className="terminal-log__header">
        <span className="terminal-log__title">🖥️ Agent Terminal</span>
        <span className="terminal-log__count">{logs.length}/200</span>
      </div>
      <div className="terminal-log__body">
        {logs.map((log, i) => (
          <div key={i} className={`terminal-log__entry terminal-log__entry--${log.level}`}>
            <span className="terminal-log__ts">
              {new Date(log.timestamp).toLocaleTimeString('ko-KR')}
            </span>
            <span className="terminal-log__agent">[{log.agentId}]</span>
            <span className="terminal-log__emoji">{LOG_LEVEL_EMOJI[log.level] || 'ℹ️'}</span>
            <span className="terminal-log__msg">{log.message}</span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}
