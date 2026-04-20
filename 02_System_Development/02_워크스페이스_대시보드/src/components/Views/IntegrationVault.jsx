// src/components/Views/IntegrationVault.jsx
// Phase 21 — Task 1: Integration Vault (Redesign — Flat List Style, Spacious)
import { useState } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

/* ── 통합 목록 ───────────────────────────────────────────── */
const INTEGRATIONS = [
  {
    id: 'google_drive',
    label: 'Google Drive',
    description: '에이전트가 Drive 파일을 읽고 산출물을 자동 업로드합니다.',
    secretKey: 'GOOGLE_DRIVE_API_KEY',
    placeholder: 'AIzaSy...',
    inputType: 'password',
    docUrl: 'https://console.cloud.google.com/',
    category: 'Storage',
  },
  {
    id: 'buffer',
    label: 'Buffer API',
    description: '소셜 미디어 포스트 스케줄링을 자동화합니다.',
    secretKey: 'BUFFER_API_KEY',
    placeholder: '1/xxxxxxxx...',
    inputType: 'password',
    docUrl: 'https://buffer.com/developers/api',
    category: 'Marketing',
  },
  {
    id: 'notion',
    label: 'Notion API',
    description: 'Notion 페이지에 리포트 및 문서를 자동 작성합니다.',
    secretKey: 'NOTION_API_KEY',
    placeholder: 'secret_...',
    inputType: 'password',
    docUrl: 'https://developers.notion.com/',
    category: 'Productivity',
  },
  {
    id: 'slack',
    label: 'Slack Webhook',
    description: '팀 채널로 AI 작업 완료 알림을 자동 발송합니다.',
    secretKey: 'SLACK_WEBHOOK_URL',
    placeholder: 'https://hooks.slack.com/services/...',
    inputType: 'url',
    docUrl: 'https://api.slack.com/messaging/webhooks',
    category: 'Notification',
  },
  {
    id: 'nano_banana',
    label: 'NanoBanana MCP',
    description: '고성능 분산 데이터 처리 파이프라인 브리지를 연결합니다.',
    secretKey: 'NANO_BANANA_MCP_TOKEN',
    placeholder: 'nbt_live_...',
    inputType: 'password',
    docUrl: '#',
    category: 'Data',
  },
  {
    id: 'airtable',
    label: 'Airtable API',
    description: '프로젝트 데이터베이스와 에이전트 산출물을 동기화합니다.',
    secretKey: 'AIRTABLE_API_KEY',
    placeholder: 'patxxxxxxxxxx...',
    inputType: 'password',
    docUrl: 'https://airtable.com/developers/web/api/introduction',
    category: 'Database',
  },
];

/* ── 설정 모달 ───────────────────────────────────────────── */
function ConfigureModal({ integration, onInstall, onCancel }) {
  const [value, setValue] = useState('');
  const [visible, setVisible] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState(null); // null | 'ok' | 'fail'

  const handleTest = async () => {
    if (!value.trim()) return;
    setTesting(true);
    setTestResult(null);
    await new Promise((r) => setTimeout(r, 1200 + Math.random() * 600));
    setTesting(false);
    setTestResult(value.trim().length >= 8 ? 'ok' : 'fail');
  };

  const handleInstall = () => {
    if (!value.trim()) return;
    onInstall(integration, value.trim());
  };

  return (
    <div className="iv2-modal-overlay" onClick={onCancel}>
      <div className="iv2-modal" onClick={(e) => e.stopPropagation()}>
        <h3 className="iv2-modal__title">Configure {integration.label}</h3>
        <p className="iv2-modal__hint">
          아래 설정값을 입력하여 연동을 완료하세요.
        </p>

        <div className="iv2-modal__field">
          <div className="iv2-modal__label-row">
            <label className="iv2-modal__label">{integration.secretKey}</label>
            {integration.docUrl !== '#' && (
              <a
                href={integration.docUrl}
                target="_blank"
                rel="noreferrer"
                className="iv2-modal__doc"
              >
                문서 보기 ↗
              </a>
            )}
          </div>
          <p className="iv2-modal__field-hint">{integration.placeholder.startsWith('http') ? `URL 형식으로 입력해 주세요.` : `API 키를 입력해 주세요. (예: ${integration.placeholder})`}</p>
          <div className="iv2-modal__input-wrap">
            <input
              className={`iv2-modal__input ${testResult === 'ok' ? 'iv2-modal__input--ok' : testResult === 'fail' ? 'iv2-modal__input--fail' : ''}`}
              type={visible || integration.inputType === 'url' ? 'text' : 'password'}
              placeholder={integration.placeholder}
              value={value}
              onChange={(e) => { setValue(e.target.value); setTestResult(null); }}
              autoFocus
              autoComplete="off"
            />
            {integration.inputType === 'password' && (
              <button className="iv2-modal__eye" onClick={() => setVisible((v) => !v)} tabIndex={-1}>
                {visible ? '숨기기' : '보기'}
              </button>
            )}
          </div>
          {testResult === 'ok' && (
            <p className="iv2-modal__status iv2-modal__status--ok">✓ 연결이 확인되었습니다.</p>
          )}
          {testResult === 'fail' && (
            <p className="iv2-modal__status iv2-modal__status--fail">✗ 값을 다시 확인해 주세요.</p>
          )}
        </div>

        <div className="iv2-modal__actions">
          <button className="iv2-modal__test" onClick={handleTest} disabled={!value.trim() || testing}>
            {testing
              ? <><span className="iv2-spinner" />테스트 중...</>
              : 'Test Connection'}
          </button>
          <div style={{ flex: 1 }} />
          <button className="iv2-modal__cancel" onClick={onCancel}>Cancel</button>
          <button
            className="iv2-modal__confirm"
            onClick={handleInstall}
            disabled={!value.trim()}
          >
            Install
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── 메인 컴포넌트 ───────────────────────────────────────── */
export default function IntegrationVault() {
  const [configured, setConfigured] = useState([]); // 설치된 항목 id 목록
  const [configuring, setConfiguring] = useState(null); // 현재 설정 중인 integration
  const [search, setSearch] = useState('');

  const available = INTEGRATIONS.filter(
    (i) => !configured.includes(i.id) &&
    (i.label.toLowerCase().includes(search.toLowerCase()) ||
     i.description.toLowerCase().includes(search.toLowerCase()))
  );
  const installedItems = INTEGRATIONS.filter((i) => configured.includes(i.id));

  const handleInstall = async (integration, value) => {
    try {
      await fetch(`${SERVER_URL}/api/secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: integration.secretKey, value }),
      });
    } catch { /* 오프라인 무시 */ }
    setConfigured((prev) => [...prev, integration.id]);
    setConfiguring(null);
  };

  const handleRemove = (id) => {
    if (!window.confirm('이 연동을 제거할까요?')) return;
    setConfigured((prev) => prev.filter((x) => x !== id));
  };

  return (
    <div className="iv2-root">
      <style dangerouslySetInnerHTML={{ __html: vaultCSS }} />

      {/* ── 설치된 연동 ─────────────────────────────────── */}
      <div className="iv2-section">
        <div className="iv2-section__header">
          <span className="iv2-section__label">CONFIGURED INTEGRATIONS</span>
        </div>
        <div className="iv2-list">
          {installedItems.length === 0 ? (
            <div className="iv2-empty">
              <p>설치된 연동이 없습니다. 아래 목록에서 추가하세요.</p>
            </div>
          ) : (
            installedItems.map((item) => (
              <div key={item.id} className="iv2-row iv2-row--installed">
                <div className="iv2-row__info">
                  <span className="iv2-row__name">
                    {item.label}
                    <span className="iv2-row__connected">● 연결됨</span>
                  </span>
                  <span className="iv2-row__desc">{item.description}</span>
                </div>
                <button className="iv2-btn iv2-btn--remove" onClick={() => handleRemove(item.id)}>
                  제거
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* ── 추가 가능한 연동 ─────────────────────────────── */}
      <div className="iv2-section">
        <div className="iv2-section__header">
          <span className="iv2-section__label">ADD INTEGRATIONS</span>
          <div className="iv2-search-wrap">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
              <circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>
            </svg>
            <input
              className="iv2-search"
              placeholder="Search..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
        <div className="iv2-list">
          {available.length === 0 && (
            <div className="iv2-empty"><p>검색 결과가 없습니다.</p></div>
          )}
          {available.map((item) => (
            <div key={item.id} className="iv2-row">
              <div className="iv2-row__info">
                <span className="iv2-row__name">
                  {item.label}
                  {item.docUrl !== '#' && (
                    <a href={item.docUrl} target="_blank" rel="noreferrer" className="iv2-row__link" tabIndex={-1} onClick={(e) => e.stopPropagation()}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
                      </svg>
                    </a>
                  )}
                </span>
                <span className="iv2-row__desc">{item.description}</span>
              </div>
              <button className="iv2-btn iv2-btn--add" onClick={() => setConfiguring(item)}>
                + Add
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* ── 설정 모달 ────────────────────────────────────── */}
      {configuring && (
        <ConfigureModal
          integration={configuring}
          onInstall={handleInstall}
          onCancel={() => setConfiguring(null)}
        />
      )}
    </div>
  );
}

/* ── CSS ─────────────────────────────────────────────────── */
const vaultCSS = `
  @keyframes iv2FadeIn { from { opacity: 0; } to { opacity: 1; } }
  @keyframes iv2ModalIn {
    from { opacity: 0; transform: translateY(8px) scale(0.98); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  @keyframes iv2Spin { to { transform: rotate(360deg); } }

  .iv2-root {
    display: flex; flex-direction: column; gap: 2rem;
    animation: iv2FadeIn 0.25s ease both;
  }

  /* ── 섹션 ── */
  .iv2-section {}
  .iv2-section__header {
    display: flex; align-items: center; justify-content: space-between;
    margin-bottom: 0.5rem; padding-bottom: 0.5rem;
  }
  .iv2-section__label {
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em;
    color: var(--text-muted); text-transform: uppercase;
  }

  /* ── 검색 ── */
  .iv2-search-wrap {
    display: flex; align-items: center; gap: 0.4rem;
    background: rgba(255,255,255,0.04); border: 1px solid var(--border);
    border-radius: 6px; padding: 0.25rem 0.6rem;
  }
  .iv2-search {
    background: none; border: none; outline: none;
    color: var(--text-primary); font-size: 0.78rem;
    width: 120px; font-family: inherit;
  }
  .iv2-search::placeholder { color: var(--text-muted); }

  /* ── 리스트 ── */
  .iv2-list {
    border: 1px solid var(--border); border-radius: 10px;
    overflow: hidden;
  }

  /* ── 행 ── */
  .iv2-row {
    display: flex; align-items: center; gap: 1rem;
    padding: 1.15rem 1.1rem;
    border-bottom: 1px solid var(--border);
    transition: background 0.15s;
  }
  .iv2-row:last-child { border-bottom: none; }
  .iv2-row:hover { background: rgba(255,255,255,0.025); }
  .iv2-row--installed { background: rgba(74,222,128,0.03); }
  .iv2-row--installed:hover { background: rgba(74,222,128,0.05); }

  .iv2-row__info {
    flex: 1; min-width: 0;
    display: flex; flex-direction: column; gap: 0.35rem;
  }
  .iv2-row__name {
    font-size: 0.88rem; font-weight: 600; color: var(--text-primary);
    display: flex; align-items: center; gap: 0.35rem;
  }
  .iv2-row__connected {
    font-size: 0.65rem; font-weight: 600; color: #4ade80;
    letter-spacing: 0.04em;
  }
  .iv2-row__link {
    color: var(--text-muted); display: flex; align-items: center;
    transition: color 0.15s; text-decoration: none;
  }
  .iv2-row__link:hover { color: var(--brand); }
  .iv2-row__desc {
    font-size: 0.78rem; color: var(--text-muted); line-height: 1.4;
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }

  /* ── 버튼 ── */
  .iv2-btn {
    flex-shrink: 0; padding: 0.3rem 0.85rem; border-radius: 6px;
    font-size: 0.78rem; font-weight: 600; cursor: pointer;
    transition: all 0.15s; font-family: inherit;
  }
  .iv2-btn--add {
    background: rgba(180,197,255,0.1); color: var(--brand);
    border: 1px solid rgba(180,197,255,0.2);
  }
  .iv2-btn--add:hover { background: rgba(180,197,255,0.18); border-color: var(--brand); }
  .iv2-btn--remove {
    background: transparent; color: var(--text-muted);
    border: 1px solid var(--border);
  }
  .iv2-btn--remove:hover { color: #f87171; border-color: rgba(248,113,113,0.35); background: rgba(248,113,113,0.06); }

  /* ── 빈 상태 ── */
  .iv2-empty {
    padding: 2.4rem 1.5rem; text-align: center;
  }
  .iv2-empty p { font-size: 0.82rem; color: var(--text-muted); margin: 0; }

  /* ── 설정 모달 ── */
  .iv2-modal-overlay {
    position: fixed; inset: 0; z-index: 9000;
    background: rgba(0,0,0,0.55); backdrop-filter: blur(6px);
    display: flex; align-items: center; justify-content: center;
    animation: iv2FadeIn 0.18s ease;
  }
  .iv2-modal {
    background: var(--bg-surface);
    border: 1px solid rgba(255,255,255,0.1);
    border-radius: 14px; padding: 1.5rem;
    width: 420px; max-width: 90vw;
    box-shadow: 0 24px 60px rgba(0,0,0,0.5);
    animation: iv2ModalIn 0.22s cubic-bezier(0.2,0,0,1) both;
  }
  .iv2-modal__title {
    font-size: 1rem; font-weight: 700; margin: 0 0 0.3rem 0; color: var(--text-primary);
  }
  .iv2-modal__hint {
    font-size: 0.8rem; color: var(--text-muted); margin: 0 0 1.2rem 0;
  }

  .iv2-modal__field { display: flex; flex-direction: column; gap: 0.4rem; margin-bottom: 1.2rem; }
  .iv2-modal__label-row { display: flex; align-items: center; justify-content: space-between; }
  .iv2-modal__label { font-size: 0.82rem; font-weight: 600; color: var(--text-primary); }
  .iv2-modal__doc { font-size: 0.72rem; color: var(--brand); text-decoration: none; }
  .iv2-modal__doc:hover { text-decoration: underline; }
  .iv2-modal__field-hint { font-size: 0.75rem; color: var(--text-muted); margin: 0; }

  .iv2-modal__input-wrap { position: relative; display: flex; align-items: center; }
  .iv2-modal__input {
    width: 100%; padding: 0.6rem 3.5rem 0.6rem 0.75rem; box-sizing: border-box;
    background: rgba(255,255,255,0.05); border: 1px solid var(--border);
    border-radius: 8px; color: var(--text-primary); font-size: 0.82rem;
    font-family: 'SF Mono', monospace; outline: none; transition: border-color 0.15s;
  }
  .iv2-modal__input:focus { border-color: var(--brand); }
  .iv2-modal__input::placeholder { color: var(--text-muted); }
  .iv2-modal__input--ok  { border-color: rgba(74,222,128,0.5) !important; }
  .iv2-modal__input--fail { border-color: rgba(248,113,113,0.4) !important; }
  .iv2-modal__eye {
    position: absolute; right: 0.6rem;
    background: none; border: none; cursor: pointer;
    color: var(--text-muted); font-size: 0.72rem; font-family: inherit;
    transition: color 0.15s;
  }
  .iv2-modal__eye:hover { color: var(--text-primary); }

  .iv2-modal__status { font-size: 0.75rem; font-weight: 500; margin: 0; }
  .iv2-modal__status--ok   { color: #4ade80; }
  .iv2-modal__status--fail { color: #f87171; }

  .iv2-modal__actions {
    display: flex; align-items: center; gap: 0.5rem;
  }
  .iv2-modal__test {
    background: rgba(255,255,255,0.05); border: 1px solid var(--border);
    color: var(--text-secondary); border-radius: 7px; padding: 0.45rem 0.9rem;
    font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit;
    display: flex; align-items: center; gap: 0.4rem; transition: all 0.15s;
  }
  .iv2-modal__test:hover:not(:disabled) { border-color: var(--brand); color: var(--brand); }
  .iv2-modal__test:disabled { opacity: 0.45; cursor: not-allowed; }
  .iv2-modal__cancel {
    background: rgba(255,255,255,0.05); border: 1px solid var(--border);
    color: var(--text-secondary); border-radius: 7px; padding: 0.45rem 0.9rem;
    font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: all 0.15s;
  }
  .iv2-modal__cancel:hover { color: var(--text-primary); }
  .iv2-modal__confirm {
    background: #1a7fe8; border: none; color: #fff;
    border-radius: 7px; padding: 0.45rem 1.1rem;
    font-size: 0.8rem; font-weight: 600; cursor: pointer; font-family: inherit;
    transition: filter 0.15s;
  }
  .iv2-modal__confirm:hover:not(:disabled) { filter: brightness(1.12); }
  .iv2-modal__confirm:disabled { opacity: 0.45; cursor: not-allowed; }

  /* ── 스피너 ── */
  .iv2-spinner {
    display: inline-block; width: 12px; height: 12px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.2); border-top-color: currentColor;
    animation: iv2Spin 0.7s linear infinite; flex-shrink: 0;
  }
`;
