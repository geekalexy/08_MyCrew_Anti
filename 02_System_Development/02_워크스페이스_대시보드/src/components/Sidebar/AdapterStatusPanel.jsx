// src/components/Sidebar/AdapterStatusPanel.jsx — Phase 22 Sprint 1
// Settings > Integrations 탭용 어댑터 실시간 상태 카드 패널

import { useEffect, useState, useRef } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

const ADAPTER_DEFS = [
  {
    id: 'antigravity',
    name: 'Antigravity CLI',
    icon: 'bolt',
    protocol: 'File Polling',
    phase: 'Phase 1',
    phaseColor: '#7C6EF8',
    description: 'Gemini Ultra 구독 에이전트. 복잡한 태스크를 비동기 큐로 처리합니다.',
  },
  {
    id: 'imagen3',
    name: 'Imagen 3',
    icon: 'image',
    protocol: 'Gemini Vision API',
    phase: 'Phase 1',
    phaseColor: '#7C6EF8',
    description: '소시안 브랜드 이미지 생성 모델. GEMINI_API_KEY 공유 사용.',
  },
  {
    id: 'claude_code',
    name: 'Claude Code',
    icon: 'code',
    protocol: 'File Polling',
    phase: 'Phase 2',
    phaseColor: '#4ECDC4',
    description: '자율 코딩 에이전트. ANTHROPIC_API_KEY 등록 후 활성화됩니다.',
  },
];

const STATUS_MAP = {
  active:   { label: '실행 중', dot: '#4ade80', glow: '0 0 8px #4ade8088', bg: 'rgba(74,222,128,0.07)',  border: 'rgba(74,222,128,0.18)'  },
  idle:     { label: '대기',    dot: 'rgba(255,255,255,0.4)', glow: 'none', bg: 'transparent',            border: 'var(--border)'          },
  error:    { label: '키 없음', dot: '#f87171', glow: '0 0 6px #f8717188',  bg: 'rgba(248,113,113,0.06)', border: 'rgba(248,113,113,0.2)'  },
  disabled: { label: '예정',    dot: 'rgba(255,255,255,0.15)', glow: 'none', bg: 'transparent',            border: 'var(--border)'          },
  fallback: { label: 'Fallback',dot: '#fbbf24', glow: '0 0 6px #fbbf2488',  bg: 'rgba(251,191,36,0.07)',  border: 'rgba(251,191,36,0.2)'   },
};

export default function AdapterStatusPanel() {
  const [states, setStates] = useState({
    antigravity: { status: 'idle', queueDepth: 0, configured: false },
    imagen3:     { status: 'idle', queueDepth: 0, configured: false },
    claude_code: { status: 'disabled', queueDepth: 0, configured: false },
  });
  const [loading, setLoading] = useState(true);
  const socketRef = useRef(null);

  // 초기 상태 로드
  useEffect(() => {
    fetch(`${SERVER_URL}/api/adapters/status`)
      .then(r => r.json())
      .then(data => {
        if (data.adapters) setStates(prev => ({ ...prev, ...data.adapters }));
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Socket 실시간 구독 (기존 연결 재사용)
  useEffect(() => {
    // 메인 소켓 이미 연결되어 있으면 그 이벤트를 직접 구독
    // window.__mycrewSocket이 있으면 그것을 사용하고, 없으면 독립 구독
    const globalSocket = window.__mycrewSocket;
    if (globalSocket) {
      const handler = ({ adapterId, status, queueDepth }) => {
        setStates(prev => ({
          ...prev,
          [adapterId]: { ...prev[adapterId], status, queueDepth: queueDepth ?? 0 },
        }));
      };
      globalSocket.on('adapter:status_change', handler);
      return () => globalSocket.off('adapter:status_change', handler);
    }
  }, []);

  return (
    <div style={{ marginBottom: '2rem' }}>
      {/* 섹션 헤더 */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: '0.45rem',
        marginBottom: '0.75rem',
      }}>
        <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color: '#7C6EF8' }}>
          electrical_services
        </span>
        <span style={{
          fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.1em',
          color: '#7C6EF8', textTransform: 'uppercase',
        }}>
          AI 어댑터 실시간 상태
        </span>
        <span style={{
          fontSize: '0.6rem', color: 'var(--text-muted)',
          padding: '1px 7px', background: 'rgba(124,110,248,0.08)',
          border: '1px solid rgba(124,110,248,0.15)', borderRadius: '10px',
        }}>Phase 22</span>
        {loading && (
          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginLeft: '0.2rem' }}>
            로딩 중...
          </span>
        )}
      </div>

      {/* 어댑터 카드 목록 */}
      <div style={{
        border: '1px solid var(--border)',
        borderRadius: '10px', overflow: 'hidden',
      }}>
        {ADAPTER_DEFS.map((def, idx) => {
          const state = states[def.id] || {};
          const cfg   = STATUS_MAP[state.status] || STATUS_MAP.idle;
          const isDisabled = state.status === 'disabled';

          return (
            <div
              key={def.id}
              style={{
                display: 'flex', alignItems: 'center', gap: '1rem',
                padding: '1rem 1.1rem',
                background: cfg.bg,
                borderBottom: idx < ADAPTER_DEFS.length - 1 ? '1px solid var(--border)' : 'none',
                opacity: isDisabled ? 0.55 : 1,
                transition: 'all 0.2s',
              }}
            >
              {/* 아이콘 */}
              <div style={{
                width: 36, height: 36, borderRadius: '8px', flexShrink: 0,
                background: `${def.phaseColor}15`,
                border: `1px solid ${def.phaseColor}30`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: def.phaseColor }}>
                  {def.icon}
                </span>
              </div>

              {/* 이름 + 설명 */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {def.name}
                  </span>
                  <span style={{
                    fontSize: '0.58rem', fontWeight: 700, padding: '1px 5px', borderRadius: '4px',
                    background: `${def.phaseColor}20`, color: def.phaseColor,
                    border: `1px solid ${def.phaseColor}35`,
                  }}>
                    {def.phase}
                  </span>
                </div>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
                  {def.protocol}
                  {state.queueDepth > 0 && (
                    <span style={{ color: '#fbbf24', marginLeft: '0.4rem', fontWeight: 600 }}>
                      · 큐 {state.queueDepth}건
                    </span>
                  )}
                </p>
              </div>

              {/* 상태 배지 */}
              <div style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.25rem 0.65rem',
                borderRadius: '20px',
                background: isDisabled ? 'rgba(255,255,255,0.04)' : cfg.bg,
                border: `1px solid ${cfg.border}`,
                flexShrink: 0,
              }}>
                <span style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: cfg.dot, flexShrink: 0,
                  boxShadow: cfg.glow,
                  animation: state.status === 'active' ? 'thinking-pulse 1.5s ease-in-out infinite' : 'none',
                }} />
                <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                  {isDisabled ? def.phase : cfg.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.5rem', opacity: 0.7 }}>
        💡 어댑터를 연결하려면 아래 '+ Add'에서 API 키를 등록하세요. 상태는 3초마다 자동 갱신됩니다.
      </p>
    </div>
  );
}
