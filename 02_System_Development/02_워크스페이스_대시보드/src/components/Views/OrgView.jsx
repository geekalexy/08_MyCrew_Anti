// src/components/Views/OrgView.jsx — 조직도 & 채용 시스템
import { useState } from 'react';
import { useAgentStore } from '../../store/agentStore';

/* ── SVG 아이콘 ─────────────────────────────────────────── */
const IcoPersonAdd = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
    <circle cx="9" cy="7" r="4"/>
    <line x1="19" y1="8" x2="19" y2="14"/>
    <line x1="22" y1="11" x2="16" y2="11"/>
  </svg>
);

const IcoCheckCircle = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--status-active)' }}>
    <circle cx="12" cy="12" r="10"/>
    <polyline points="9 12 11 14 15 10"/>
  </svg>
);

const IcoPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <polygon points="5 3 19 12 5 21 5 3"/>
  </svg>
);
const IcoPause = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>
  </svg>
);
const IcoStop = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
    <rect x="6" y="6" width="12" height="12"/>
  </svg>
);

import { useUiStore } from '../../store/uiStore';

export default function OrgView() {
  const { agents, selectAgent, agentMeta, addAgent } = useAgentStore();
  const { setCurrentView, workspaceName, workspaceLogo, updateWorkspace } = useUiStore();
  const [isRecruiting, setIsRecruiting] = useState(false);
  const [recruitInput, setRecruitInput] = useState('');
  const [recruitStatus, setRecruitStatus] = useState(null); // null | 'loading' | 'done'

  const agentList = Object.entries(agentMeta);

  const handleRecruit = async (e) => {
    e.preventDefault();
    if (!recruitInput.trim()) return;
    setRecruitStatus('loading');
    // 실제 채용 로직은 추후 백엔드 API 연동 — 현재는 3초 시뮬레이션
    await new Promise((res) => setTimeout(res, 1500));
    addAgent(recruitInput.trim()); // 입력된 역할 기반으로 새 에이전트 스토어에 추가
    setRecruitStatus('done');
    setRecruitInput('');
    setTimeout(() => { setRecruitStatus(null); setIsRecruiting(false); }, 2500);
  };

  const handleLogoUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => updateWorkspace({ workspaceLogo: event.target.result });
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="org-view">
      <div className="board-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div>
          <h2 className="board-header__title">Team</h2>
          <p className="board-header__subtitle">가상 기업 조직도 — CEO(나)를 중심으로 AI 팀이 구성됩니다</p>
        </div>
        
        {/* 회사명/로고 설정 패널 */}
        <div className="workspace-settings" style={{ display: 'flex', gap: '1.2rem', alignItems: 'center', background: 'var(--bg-surface-2)', padding: '0.8rem 1.2rem', borderRadius: '12px', border: '1px solid var(--border)', boxShadow: 'none' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>회사 로고 (Image)</label>
            <div style={{ position: 'relative' }}>
              <input 
                type="file" 
                id="workspace-logo-upload"
                accept="image/*" 
                onChange={handleLogoUpload}
                style={{ display: 'none' }}
              />
              <label 
                htmlFor="workspace-logo-upload" 
                className="btn btn--outline btn--sm" 
                style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.4rem', color: 'var(--text-primary)', borderStyle: 'dashed' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                이미지 업로드
              </label>
            </div>
          </div>
          <div style={{ width: '1px', height: '36px', background: 'var(--border)' }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            <label style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 500 }}>회사명 (Workspace)</label>
            <input 
              type="text" 
              value={workspaceName} 
              onChange={(e) => updateWorkspace({ workspaceName: e.target.value })}
              style={{ background: 'var(--bg-surface-3)', border: '1px solid var(--border)', color: 'var(--text-primary)', padding: '0.4rem 0.6rem', borderRadius: '6px', width: '140px', fontSize: '0.85rem', outline: 'none', transition: 'border-color 0.2s' }}
              placeholder="Socian"
              onFocus={(e) => e.target.style.borderColor = 'var(--brand)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
        </div>
      </div>

      {/* ── 팀 조직도 트리 ─────────────────────────────────── */}
      <div className="org-tree glass-panel">
        {/* CEO 노드 */}
        <div className="org-tree__ceo">
          <div className="org-node org-node--ceo">
            <span className="org-node__avatar">{workspaceLogo ? <img src={workspaceLogo} alt="CEO" style={{ width:'100%', height:'100%', borderRadius:'50%', objectFit:'cover' }} /> : <img src="/avatars/ollie.svg" alt="CEO" />}</span>
            <span className="org-node__name">{workspaceName} CEO (나)</span>
            <span className="org-node__role">최고 경영자</span>
          </div>
        </div>

        {/* CEO → Crew 수직 커넥터 */}
        <div className="org-tree__connector" />

        {/* 가로 라인 + Crew 노드들 */}
        <div className="org-tree__crew-wrapper">
          <div className="org-tree__hline" />
          <div className="org-tree__crew">
          {agentList.map(([id, meta]) => {
            const isActive = agents[id]?.status === 'active';
            return (
              <div
                key={id}
                className="org-node"
                style={{ cursor: 'pointer' }}
                onClick={() => {
                  selectAgent(id);
                  setCurrentView('agent-detail');
                }}
              >
                <span className="org-node__avatar">
                  {meta.avatar.startsWith('/') ? (
                    <img src={meta.avatar} alt={meta.name} />
                  ) : (
                    meta.avatar
                  )}
                </span>
                <span
                  className={`sidebar__agent-dot sidebar__agent-dot--${isActive ? 'active' : 'idle'}`}
                  style={{ position: 'absolute', top: '0.4rem', right: '0.4rem' }}
                />
                <span className="org-node__name">{meta.name}</span>
                <span className="org-node__role">{meta.role}</span>
                <span className="org-node__className">{meta.model}</span>
                
                {/* 에이전트 컨트롤 바 */}
                <div 
                  className="org-node__controls" 
                  style={{ 
                    display: 'flex', gap: '6px', marginTop: '10px', 
                    padding: '4px', background: 'var(--bg-surface-2)', borderRadius: '6px',
                    border: '1px solid var(--border)',
                    justifyContent: 'center'
                  }}
                  onClick={(e) => e.stopPropagation()} // 개별 노드 클릭 방지
                >
                  <button className="btn btn--ghost btn--sm" style={{ padding: '4px', color: 'var(--status-active)', minWidth: 0 }} title="Action (업무 강제 시작)">
                    <IcoPlay />
                  </button>
                  <button className="btn btn--ghost btn--sm" style={{ padding: '4px', color: '#ffb963', minWidth: 0 }} title="Pause (일시 중지)">
                    <IcoPause />
                  </button>
                  <button className="btn btn--ghost btn--sm" style={{ padding: '4px', color: 'var(--status-error)', minWidth: 0 }} title="Stop (하드 리셋)">
                    <IcoStop />
                  </button>
                </div>
              </div>
            );
          })}
          </div>        {/* /.org-tree__crew */}
        </div>          {/* /.org-tree__crew-wrapper */}
      </div>            {/* /.org-tree */}
    </div>
  );
}
