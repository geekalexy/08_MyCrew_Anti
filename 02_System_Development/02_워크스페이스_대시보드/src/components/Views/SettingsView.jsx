// src/components/Views/SettingsView.jsx — 워크스페이스 설정
import { useEffect, useState } from 'react';
import { useUiStore } from '../../store/uiStore';
import IntegrationVault from './IntegrationVault';
import AdapterStatusPanel from '../Sidebar/AdapterStatusPanel';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

/* ── SVG 아이콘 ─────────────────────────────────────────── */
const IcoPalette = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/>
    <circle cx="18" cy="9" r="1"/><circle cx="18" cy="15" r="1"/>
    <circle cx="12" cy="19" r="1"/><circle cx="6" cy="15" r="1"/>
    <circle cx="6" cy="9" r="1"/>
  </svg>
);

const IcoHub = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
  </svg>
);

const IcoWarning = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
    <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
  </svg>
);

const IcoSun = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="5"/>
    <line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/>
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
    <line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/>
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
  </svg>
);

const IcoMoon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>
  </svg>
);

const IcoTrash = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/>
    <path d="M10 11v6"/><path d="M14 11v6"/>
    <path d="M9 6V4h6v2"/>
  </svg>
);

const IcoTelegram = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 2L11 13"/>
    <path d="M22 2L15 22L11 13L2 9L22 2z"/>
  </svg>
);

const IcoFolder = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
  </svg>
);

const REPORT_MODES = [
  { value: 'disabled', label: '보고 안 함',      hint: '텔레그램 자동 보고를 끕니다.' },
  { value: '6h',      label: '6시간마다',         hint: '서버 기동 후 최소 6시간 이후 첫 발송됩니다.' },
  { value: '12h',     label: '12시간마다',        hint: '서버 기동 후 최소 12시간 이후 첫 발송됩니다.' },
  { value: 'daily',   label: '매일 지정 시각',    hint: '지정한 시각에 하루 1회 발송됩니다.' },
];

const HOURS   = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

export default function SettingsView() {
  const { theme, toggleTheme } = useUiStore();
  const [serverOnline, setServerOnline] = useState(null);
  const [workspaceInfo, setWorkspaceInfo] = useState({ path: '', isObsidian: false });
  const [settingsTab, setSettingsTab] = useState('general'); // 'general' | 'integrations'

  // 텔레그램 보고 설정 상태
  const [reportMode,   setReportMode]   = useState('daily');
  const [reportHour,   setReportHour]   = useState(8);
  const [reportMinute, setReportMinute] = useState(30);
  const [saveStatus,   setSaveStatus]   = useState('idle'); // idle | saving | saved | error

  // 서버 상태 확인 + 현재 설정값 로드
  useEffect(() => {
    fetch(`${SERVER_URL}/health`)
      .then((r) => setServerOnline(r.ok))
      .catch(() => setServerOnline(false));

    fetch(`${SERVER_URL}/api/settings`)
      .then((r) => r.json())
      .then(({ settings }) => {
        if (settings['telegram_report_mode'])   setReportMode(settings['telegram_report_mode']);
        if (settings['telegram_report_hour'])   setReportHour(parseInt(settings['telegram_report_hour'], 10));
        if (settings['telegram_report_minute']) setReportMinute(parseInt(settings['telegram_report_minute'], 10));
      })
      .catch(() => {});

    fetch(`${SERVER_URL}/api/system/workspace`)
      .then((r) => r.json())
      .then((data) => setWorkspaceInfo({ path: data.workspacePath, isObsidian: data.isObsidianVault }))
      .catch(() => {});
  }, []);

  const handleReset = () => {
    if (!window.confirm('로컬 캐시(칸반 보드 데이터)를 초기화할까요? 이 작업은 되돌릴 수 없습니다.')) return;
    localStorage.removeItem('mycrew-kanban');
    localStorage.removeItem('mycrew-ui');
    window.location.reload();
  };

  const handleSaveReport = async () => {
    setSaveStatus('saving');
    try {
      const pairs = [
        { key: 'telegram_report_mode',   value: reportMode },
        { key: 'telegram_report_hour',   value: String(reportHour) },
        { key: 'telegram_report_minute', value: String(reportMinute) },
      ];
      await Promise.all(pairs.map((p) =>
        fetch(`${SERVER_URL}/api/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(p),
        })
      ));
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    } catch {
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const pad = (n) => String(n).padStart(2, '0');

  return (
    <div className="settings-view">
      <div className="board-header">
        <h2 className="board-header__title">Settings</h2>
        <p className="board-header__subtitle">워크스페이스 환경 설정</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="agent-detail-tabs" style={{ marginTop: '1rem' }}>
        <button
          className={`agent-tab-btn ${settingsTab === 'general' ? 'agent-tab-btn--active' : ''}`}
          onClick={() => setSettingsTab('general')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>tune</span>
          General
        </button>
        <button
          className={`agent-tab-btn ${settingsTab === 'integrations' ? 'agent-tab-btn--active' : ''}`}
          onClick={() => setSettingsTab('integrations')}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', verticalAlign: 'middle', marginRight: '0.25rem' }}>extension</span>
          Integrations
        </button>
      </div>

      {/* Integrations 탭 */}
      {settingsTab === 'integrations' && (
        <div style={{ marginTop: '1.5rem', animation: 'fadeIn 0.25s', display: 'flex', flexDirection: 'column', gap: '0' }}>
          {/* Phase 22: AI 어댑터 실시간 상태 패널 (IntegrationVault 상단 고정) */}
          <AdapterStatusPanel />
          <IntegrationVault />
        </div>
      )}

      {/* General 탭 */}
      {settingsTab === 'general' && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem' }}>
        {/* 테마 설정 */}
        <div className="settings-card glass-panel">
          <div className="settings-card__header">
            <IcoPalette />
            <span>테마</span>
          </div>
          <div className="settings-card__body">
            <p style={{ opacity: 0.6, fontSize: '0.85rem' }}>현재: <strong>{theme === 'dark' ? '다크 모드' : '라이트 모드'}</strong></p>
            <button className="btn btn--ghost btn--sm" onClick={toggleTheme} style={{ marginTop: '0.5rem' }}>
              {theme === 'dark' ? <IcoSun /> : <IcoMoon />}
              {theme === 'dark' ? '라이트 모드로 전환' : '다크 모드로 전환'}
            </button>
          </div>
        </div>

        {/* 진행 중인 로컬 워크스페이스 정보 */}
        <div className="settings-card glass-panel">
          <div className="settings-card__header">
            <IcoFolder />
            <span>로컬 워크스페이스 정보</span>
          </div>
          <div className="settings-card__body">
            <p style={{ opacity: 0.6, fontSize: '0.82rem', margin: '0 0 0.5rem 0' }}>
              현재 아리(Ari) 엔진이 구동되며 매핑된 로컬 폴더입니다.
            </p>
            <div style={{
              background: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: '8px',
              border: workspaceInfo.isObsidian ? '1px solid var(--brand)' : '1px solid var(--border)',
              display: 'flex', alignItems: 'center', gap: '0.5rem', wordBreak: 'break-all'
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: workspaceInfo.isObsidian ? 'var(--brand)' : 'var(--text-muted)' }}>
                {workspaceInfo.isObsidian ? 'book_2' : 'folder_open'}
              </span>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                {workspaceInfo.path || '로딩 중...'}
              </span>
              {workspaceInfo.isObsidian && (
                <span style={{
                  marginLeft: 'auto', background: 'var(--brand-glow)', color: 'var(--brand)', 
                  border: '1px solid var(--brand-glow)',
                  padding: '2px 6px', borderRadius: '4px', fontSize: '0.65rem', fontWeight: 600, flexShrink: 0
                }}>
                  Obsidian Vault
                </span>
              )}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', opacity: 0.8 }}>
              💡 폴더를 변경하려면 터미널에서 작업 폴더로 이동한 뒤 엔진을 다시 시작하세요.
            </p>
          </div>
        </div>

        {/* 서버 상태 */}
        <div className="settings-card glass-panel">
          <div className="settings-card__header">
            <IcoHub />
            <span>백엔드 연결 상태</span>
          </div>
          <div className="settings-card__body" style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{
              width: 10, height: 10, borderRadius: '50%',
              background: serverOnline === null ? 'var(--text-muted)' : serverOnline ? 'var(--status-active)' : '#ff5449',
              boxShadow: serverOnline ? '0 0 8px var(--status-active-glow)' : 'none',
              flexShrink: 0, display: 'inline-block',
            }} />
            <span style={{ fontSize: '0.85rem', opacity: 0.8 }}>
              {serverOnline === null ? '확인 중...' : serverOnline ? `연결됨 (${SERVER_URL})` : `오프라인 — 서버를 확인해주세요`}
            </span>
          </div>
        </div>

        {/* 텔레그램 보고 설정 ← 신규 */}
        <div className="settings-card glass-panel">
          <div className="settings-card__header">
            <IcoTelegram />
            <span>텔레그램 보고 설정</span>
          </div>
          <div className="settings-card__body" style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <p style={{ opacity: 0.6, fontSize: '0.82rem', margin: 0 }}>
              아리의 일간 활동 요약 보고를 텔레그램으로 받는 주기를 설정합니다.
            </p>

            {/* 모드 선택 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {REPORT_MODES.map((m) => (
                <label key={m.value} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.5rem', cursor: 'pointer' }}>
                  <input
                    type="radio"
                    name="reportMode"
                    value={m.value}
                    checked={reportMode === m.value}
                    onChange={(e) => setReportMode(e.target.value)}
                    style={{ accentColor: 'var(--accent)', width: 15, height: 15, marginTop: '2px', flexShrink: 0 }}
                  />
                  <div>
                    <span style={{ fontSize: '0.875rem' }}>{m.label}</span>
                    {reportMode === m.value && (
                      <p style={{
                        margin: '2px 0 0 0',
                        fontSize: '0.75rem',
                        opacity: 0.55,
                        color: (m.value === '6h' || m.value === '12h')
                          ? 'var(--status-warn, #f5a623)'
                          : 'inherit',
                      }}>
                        {(m.value === '6h' || m.value === '12h') ? '⚠️ ' : ''}{m.hint}
                      </p>
                    )}
                  </div>
                </label>
              ))}
            </div>

            {/* 매일 지정 시각 선택 (daily 모드일 때만 노출) */}
            {reportMode === 'daily' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingLeft: '1.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.82rem', opacity: 0.7 }}>보고 시각</span>
                <select
                  id="report-hour"
                  value={reportHour}
                  onChange={(e) => setReportHour(Number(e.target.value))}
                  style={{
                    background: 'var(--bg-surface-3)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h}>{pad(h)}시</option>
                  ))}
                </select>
                <select
                  id="report-minute"
                  value={reportMinute}
                  onChange={(e) => setReportMinute(Number(e.target.value))}
                  style={{
                    background: 'var(--bg-surface-3)',
                    color: 'var(--text-primary)',
                    border: '1px solid var(--border)',
                    borderRadius: '6px',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.875rem',
                    cursor: 'pointer',
                  }}
                >
                  {MINUTES.map((min) => (
                    <option key={min} value={min}>{pad(min)}분</option>
                  ))}
                </select>
                <span style={{ fontSize: '0.78rem', opacity: 0.5 }}>(KST 기준)</span>
              </div>
            )}

            {/* 저장 버튼 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginTop: '0.25rem' }}>
              <button
                id="save-report-settings"
                className="btn btn--sm"
                onClick={handleSaveReport}
                disabled={saveStatus === 'saving'}
                style={{
                  background: saveStatus === 'saved'  ? '#1a3a2a' :
                              saveStatus === 'error'  ? '#3a1a1a' : 'var(--brand)',
                  color: 'var(--bg-base)',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.4rem 1rem',
                  cursor: saveStatus === 'saving' ? 'not-allowed' : 'pointer',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  transition: 'background 0.2s',
                }}
              >
                {saveStatus === 'saving' ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', animation: 'spin 1s linear infinite' }}>progress_activity</span>
                    저장 중...
                  </>
                ) : saveStatus === 'saved' ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>check_circle</span>
                    저장 완료
                  </>
                ) : saveStatus === 'error' ? (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>error</span>
                    저장 실패
                  </>
                ) : (
                  <>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>save</span>
                    저장
                  </>
                )}
              </button>
              {saveStatus === 'saved' && (
                <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>
                  다음 와치독 사이클(최대 5분 후)부터 적용됩니다.
                </span>
              )}
            </div>
          </div>
        </div>

        {/* 위험 구역 */}
        <div className="settings-card settings-card--danger glass-panel">
          <div className="settings-card__header">
            <IcoWarning />
            <span>위험 구역</span>
          </div>
          <div className="settings-card__body">
            <p style={{ opacity: 0.6, fontSize: '0.85rem', marginBottom: '0.5rem' }}>
              로컬 브라우저 캐시(칸반 보드, UI 설정)를 초기화합니다. 백엔드 DB 데이터는 유지됩니다.
            </p>
            <button
              className="btn btn--sm"
              style={{ background: '#ff544922', color: '#ff5449', border: '1px solid #ff544940' }}
              onClick={handleReset}
            >
              <IcoTrash />
              로컬 캐시 초기화
            </button>
          </div>
        </div>
      </div>
      )} {/* /general tab */}
    </div>
  );
}

