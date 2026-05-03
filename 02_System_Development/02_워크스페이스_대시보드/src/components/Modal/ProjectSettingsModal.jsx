// src/components/Modal/ProjectSettingsModal.jsx
// PRD#32 — 프로젝트 설정 모달 (Delta Score + 딥씽크 애니메이션 + 타입 B 유도)
// Prime 리뷰 A- 승인 반영: CP-1~5 모두 적용
import { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';
import NewProjectModal from './NewProjectModal';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4005';

/* ── Levenshtein 거리 (CP-1: 성능 0.1ms 이하 확인) ── */
function levenshtein(a = '', b = '') {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function calcDelta(original = '', updated = '') {
  if (!original && !updated) return 0;
  if (!original || !updated) return 1.0;
  const longer = Math.max(original.length, updated.length);
  if (longer === 0) return 0;
  return levenshtein(original, updated) / longer;
}

/* ── Delta Score → 변경 레벨 계산 (CP-5: C→A/B 전환 = 자동 DANGER) ── */
function getChangeLevel(project, fields) {
  const { name, objective, workflow, isolationType } = fields;

  // 기존 objective_raw/workflow_raw가 없으면 objective 파싱으로 fallback (CP-1)
  const origObjective = project.objective_raw
    || (project.objective || '').split('[업무 흐름]')[0].replace('[목적]', '').trim();
  const origWorkflow = project.workflow_raw
    || (project.objective || '').split('[업무 흐름]')[1]?.trim() || '';

  const origType = (() => {
    try { return JSON.parse(project.isolation_scope || '{}').type || 'strict_isolation'; } catch { return 'strict_isolation'; }
  })();

  // [CP-5] C타입 → A/B 전환 즉시 DANGER
  if (origType === 'global_knowledge' && isolationType !== 'global_knowledge') return 'DANGER';
  // 타입 변경은 자동 DANGER
  if (origType !== isolationType) return 'DANGER';

  const nameDelta = calcDelta(project.name, name);
  const objDelta  = calcDelta(origObjective, objective);
  const wfDelta   = calcDelta(origWorkflow, workflow);
  const maxDelta  = Math.max(objDelta, wfDelta);

  const nameOnly = maxDelta === 0 && nameDelta > 0;
  if (nameOnly || maxDelta < 0.3) return 'SAFE';
  if (maxDelta < 0.7) return 'CAUTION';
  return 'DANGER';
}

/* ── 딥씽크 분석 메시지 컴포넌트 (Level 3 Step 1) ── */
function DeepThinkAnimation({ onComplete }) {
  const MESSAGES = [
    '변경 범위를 분석하고 있습니다...',
    '에이전트 컨텍스트 충돌 여부 검토 중...',
    '프로젝트 방향성 변화량 측정 중...',
  ];
  const [visible, setVisible] = useState([]);

  useEffect(() => {
    MESSAGES.forEach((_, i) => {
      setTimeout(() => {
        setVisible(prev => [...prev, i]);
      }, i * 220);
    });
    // Step 2로 전환 타이밍
    setTimeout(() => { onComplete(); }, 2200);
  }, []);

  return (
    <div style={{ padding: '1rem 1.25rem', borderRadius: '8px', background: 'rgba(100,135,242,0.06)', border: '1px solid rgba(100,135,242,0.2)', animation: 'fadeIn 0.3s' }}>
      {MESSAGES.map((msg, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: '0.6rem',
          fontSize: '0.82rem', color: 'var(--text-secondary)',
          opacity: visible.includes(i) ? 1 : 0,
          transform: visible.includes(i) ? 'translateY(0)' : 'translateY(4px)',
          transition: 'opacity 0.3s, transform 0.3s',
          marginBottom: i < MESSAGES.length - 1 ? '0.5rem' : 0,
        }}>
          <span style={{ color: 'var(--brand)', fontSize: '0.6rem', animation: visible.includes(i) ? 'deepPulse 1.2s infinite' : 'none' }}>◌</span>
          {msg}
        </div>
      ))}
      <style>{`
        @keyframes deepPulse { 0%,100%{opacity:0.3} 50%{opacity:1} }
        @keyframes fadeIn { from{opacity:0} to{opacity:1} }
      `}</style>
    </div>
  );
}

/* ── 변경 영향 배너 ── */
function ChangeBanner({ level, step, onTypeBClick }) {
  if (level === 'SAFE') return (
    <div style={{ display:'flex', alignItems:'center', gap:'0.6rem', padding:'0.7rem 1rem', borderRadius:'8px', background:'rgba(74,222,128,0.08)', border:'1px solid rgba(74,222,128,0.25)', fontSize:'0.8rem', color:'#4ade80' }}>
      <span className="material-symbols-outlined" style={{ fontSize:'1rem' }}>check_circle</span>
      안전한 변경입니다. 에이전트 동작에 영향이 없습니다.
    </div>
  );

  if (level === 'CAUTION') return (
    <div style={{ padding:'0.9rem 1.1rem', borderRadius:'8px', background:'rgba(251,191,36,0.08)', border:'1px solid rgba(251,191,36,0.3)', fontSize:'0.8rem' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem', color:'#fbbf24', fontWeight:700, marginBottom:'0.5rem' }}>
        <span className="material-symbols-outlined" style={{ fontSize:'1rem' }}>warning</span>
        주의: 에이전트 컨텍스트가 갱신됩니다.
      </div>
      <ul style={{ margin:0, padding:'0 0 0 1.1rem', color:'var(--text-secondary)', lineHeight:1.7 }}>
        <li>team.md의 목적·업무 흐름 섹션이 업데이트됩니다.</li>
        <li>에이전트가 <strong>다음 태스크부터</strong> 변경된 목적으로 작업합니다.</li>
        <li>현재 진행 중인 태스크는 완료 후 적용됩니다.</li>
      </ul>
    </div>
  );

  // DANGER: 딥씽크(Step 1) → 결론(Step 2)
  if (level === 'DANGER') {
    if (step === 1) return <DeepThinkAnimation onComplete={() => {}} />;
    return (
      <div style={{ padding:'1rem 1.1rem', borderRadius:'8px', background:'rgba(248,113,113,0.07)', border:'1px solid rgba(248,113,113,0.3)', fontSize:'0.82rem', animation:'fadeIn 0.5s' }}>
        <p style={{ margin:'0 0 0.6rem', fontWeight:700, color:'var(--text-primary)' }}>
          이 변경은 현재 프로젝트에 적용하기 어렵습니다.
        </p>
        <p style={{ margin:'0 0 0.75rem', color:'var(--text-secondary)', lineHeight:1.65 }}>
          에이전트들은 이미 기존 목적과 업무 흐름에 맞춰
          역할·메모리·컨텍스트가 형성되어 있습니다.
          방향이 크게 바뀌면 에이전트가 혼란을 일으키거나
          이전 기억을 기반으로 잘못된 작업을 수행할 수 있습니다.
        </p>
        <div style={{ borderTop:'1px solid rgba(248,113,113,0.25)', paddingTop:'0.75rem' }}>
          <p style={{ margin:'0 0 0.5rem', color:'var(--text-muted)', fontSize:'0.78rem' }}>
            대신 이 방법을 권장합니다.
          </p>
          <button
            onClick={onTypeBClick}
            style={{
              display:'flex', alignItems:'center', gap:'0.4rem',
              background:'rgba(100,135,242,0.12)', border:'1px solid rgba(100,135,242,0.4)',
              color:'var(--brand)', borderRadius:'8px', padding:'0.5rem 0.9rem',
              fontSize:'0.82rem', fontWeight:600, cursor:'pointer', fontFamily:'inherit',
              transition:'all 0.15s',
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(100,135,242,0.22)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(100,135,242,0.12)'}
          >
            <span className="material-symbols-outlined" style={{ fontSize:'0.9rem' }}>link</span>
            타입 B로 새 프로젝트 생성 →
          </button>
          <p style={{ margin:'0.4rem 0 0', fontSize:'0.7rem', color:'var(--text-muted)' }}>
            현재 프로젝트가 참조 프로젝트로 자동 연결됩니다.
          </p>
        </div>
        <style>{`@keyframes fadeIn{from{opacity:0;transform:translateY(6px)}to{opacity:1;transform:translateY(0)}}`}</style>
      </div>
    );
  }
  return null;
}

/* ══ 메인 모달 ══════════════════════════════════════════════════════ */
export default function ProjectSettingsModal({ isOpen, onClose, project }) {
  const updateProjectStore = useProjectStore(s => s.updateProject);
  const deleteProject      = useProjectStore(s => s.deleteProject);
  const projects           = useProjectStore(s => s.projects);

  // 폼 state
  const [name,          setName]          = useState('');
  const [objective,     setObjective]     = useState('');
  const [workflow,      setWorkflow]      = useState('');
  const [isolationType, setIsolationType] = useState('strict_isolation');
  const [sharedProjects, setSharedProjects] = useState([]);

  // 딥씽크 단계 (0=없음, 1=분석중, 2=결론)
  const [dangerStep,  setDangerStep]  = useState(0);
  const [changeLevel, setChangeLevel] = useState(null);
  const [isSaving,    setIsSaving]    = useState(false);
  const [saveStatus,  setSaveStatus]  = useState(null); // null | 'saved' | 'error'

  // 타입 B 유도 모달
  const [showNewProject,      setShowNewProject]      = useState(false);
  const [newProjectInitVals,  setNewProjectInitVals]  = useState(null);

  // 프로젝트 데이터 preload
  useEffect(() => {
    if (!isOpen || !project) return;
    setName(project.name || '');

    // CP-1: objective_raw / workflow_raw 없으면 objective 파싱으로 fallback
    const objRaw = project.objective_raw
      || (project.objective || '').split('[업무 흐름]')[0].replace('[목적]', '').trim();
    const wfRaw  = project.workflow_raw
      || (project.objective || '').split('[업무 흐름]')[1]?.trim() || '';
    setObjective(objRaw);
    setWorkflow(wfRaw);

    const type = (() => {
      try { return JSON.parse(project.isolation_scope || '{}').type || 'strict_isolation'; } catch { return 'strict_isolation'; }
    })();
    setIsolationType(type);
    const shared = (() => {
      try { return JSON.parse(project.isolation_scope || '{}').shared_projects || []; } catch { return []; }
    })();
    setSharedProjects(shared);

    setChangeLevel(null);
    setDangerStep(0);
    setSaveStatus(null);
  }, [isOpen, project]);

  // 필드 변경 시 실시간 Delta 계산
  useEffect(() => {
    if (!project) return;
    const level = getChangeLevel(project, { name, objective, workflow, isolationType });
    setChangeLevel(level);

    if (level !== 'DANGER') {
      if (dangerStep > 0) setDangerStep(0);
    } else {
      // DANGER이고 격리 타입이 변경된 경우 자동 딥씽크 (버튼 클릭 대기 없음)
      const origType = (() => { try { return JSON.parse(project.isolation_scope || '{}').type || 'strict_isolation'; } catch { return 'strict_isolation'; } })();
      if (isolationType !== origType && dangerStep === 0) {
        setDangerStep(1);
        setTimeout(() => {
          setDangerStep(prev => (prev === 1 ? 2 : prev));
        }, 2300);
      }
    }
  }, [name, objective, workflow, isolationType, project, dangerStep]);

  if (!isOpen) return null;

  const isDirty = changeLevel !== null && (name !== project?.name
    || objective !== (project?.objective_raw || '')
    || workflow !== (project?.workflow_raw || '')
    || isolationType !== (() => { try { return JSON.parse(project?.isolation_scope||'{}').type||'strict_isolation'; } catch{return 'strict_isolation';} })()
  );

  // 저장 버튼 클릭 (CP-2: 클릭 시점에 딥씽크 트리거)
  const handleSaveClick = async () => {
    if (!isDirty || changeLevel === 'DANGER') return;

    if (changeLevel === 'SAFE') {
      await doSave();
      return;
    }

    // CAUTION: 확인 후 저장
    if (changeLevel === 'CAUTION') {
      if (window.confirm('에이전트 컨텍스트가 갱신됩니다. 다음 태스크부터 변경된 목적으로 작업합니다. 저장하시겠습니까?')) {
        await doSave();
      }
    }
  };

  // 저장 실행 시 DANGER 감지 → 딥씽크 트리거 (저장 버튼 클릭 이후)
  const handleDangerAttempt = () => {
    if (dangerStep !== 0) return;
    setDangerStep(1);
    setTimeout(() => setDangerStep(2), 2300); // Step 1 완료 후 Step 2
  };

  const doSave = async () => {
    setIsSaving(true);
    try {
      const cleanObjective = objective.trim();
      const isolationScope = JSON.stringify({ type: isolationType, shared_projects: isolationType === 'cross_project_link' ? sharedProjects : [] });

      await updateProjectStore(
        project.id,
        name.trim(),
        cleanObjective,
        isolationScope,
        cleanObjective,
        workflow.trim()
      );
      setSaveStatus('saved');
      setTimeout(() => { setSaveStatus(null); onClose(); }, 1000);
    } catch {
      setSaveStatus('error');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = () => {
    if (window.confirm(`'${project.name}' 프로젝트를 삭제할까요? 삭제 후 복구할 수 없습니다.`)) {
      deleteProject?.(project.id);
      onClose();
    }
  };

  // 타입 B 새 프로젝트 유도
  const handleTypeBClick = () => {
    setNewProjectInitVals({
      isolationType: 'cross_project_link',
      sharedProjects: [project.id],
    });
    setShowNewProject(true);
  };

  const isSaveDisabled = !isDirty || isSaving || changeLevel === 'DANGER';

  return (
    <>
      <div
        className="modal-overlay"
        role="dialog"
        aria-modal="true"
        aria-label="프로젝트 설정"
        onClick={(e) => { if (e.target === e.currentTarget && !isSaving) onClose(); }}
        style={{ zIndex: 1200 }}
      >
        <div className="modal modal--detail" style={{ maxWidth: '620px', height: 'auto', maxHeight: '92dvh', zIndex: 1201 }}>

          {/* 헤더 */}
          <div className="modal__header" style={{ alignItems:'center', padding:'1.25rem 1.5rem', borderBottom:'1px solid var(--border)', display:'flex' }}>
            <span className="material-symbols-outlined" style={{ color:'var(--brand)', marginRight:'0.5rem', fontSize:'1.3rem' }}>settings</span>
            <div style={{ flex:1 }}>
              <h2 className="modal__title" style={{ fontSize:'1.25rem', margin:0, fontWeight:700 }}>프로젝트 설정</h2>
              {project?.name && <p style={{ margin:0, fontSize:'0.78rem', color:'var(--text-muted)' }}>{project.name}</p>}
            </div>
            <button className="modal__close" onClick={onClose} disabled={isSaving} aria-label="닫기" style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', display:'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize:'1.4rem' }}>close</span>
            </button>
          </div>

          {/* 바디 */}
          <div style={{ flex:1, overflowY:'auto', padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1.25rem' }}>

            {/* 변경 영향 배너 */}
            {changeLevel && changeLevel !== 'SAFE' && dangerStep === 0 && (
              <ChangeBanner level={changeLevel} step={0} onTypeBClick={handleTypeBClick} />
            )}
            {changeLevel === 'SAFE' && isDirty && (
              <ChangeBanner level="SAFE" step={0} />
            )}
            {dangerStep === 1 && <DeepThinkAnimation onComplete={() => setDangerStep(2)} />}
            {dangerStep === 2 && <ChangeBanner level="DANGER" step={2} onTypeBClick={handleTypeBClick} />}

            {/* 프로젝트명 */}
            <div>
              <label style={{ display:'block', fontSize:'0.88rem', fontWeight:600, marginBottom:'0.4rem', color:'var(--text-primary)' }}>프로젝트명</label>
              <input
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="프로젝트명"
                style={{ width:'100%', padding:'0.6rem 0.8rem', background:'var(--bg-surface-3)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--text-primary)', outline:'none', fontSize:'0.92rem', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* 목적 */}
            <div>
              <label style={{ display:'block', fontSize:'0.88rem', fontWeight:600, marginBottom:'0.25rem', color:'var(--text-primary)' }}>목적</label>
              <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', margin:'0 0 0.5rem' }}>프로젝트가 달성하고자 하는 핵심 목적</p>
              <input
                type="text"
                value={objective}
                onChange={e => setObjective(e.target.value)}
                placeholder="예: 텔레그램 미니앱을 개발하여 사용자 유입을 늘린다"
                style={{ width:'100%', padding:'0.6rem 0.8rem', background:'var(--bg-surface-3)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--text-primary)', outline:'none', fontSize:'0.92rem', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* 업무 흐름 */}
            <div>
              <label style={{ display:'block', fontSize:'0.88rem', fontWeight:600, marginBottom:'0.25rem', color:'var(--text-primary)' }}>업무 흐름</label>
              <p style={{ fontSize:'0.78rem', color:'var(--text-muted)', margin:'0 0 0.5rem' }}>결과물 종류와 작업 단계·흐름</p>
              <textarea
                value={workflow}
                onChange={e => setWorkflow(e.target.value)}
                placeholder="예: 기획 → UI 설계 → 개발 → QA → 배포"
                rows={3}
                style={{ width:'100%', padding:'0.6rem 0.8rem', background:'var(--bg-surface-3)', border:'1px solid var(--border)', borderRadius:'6px', color:'var(--text-primary)', outline:'none', fontSize:'0.92rem', resize:'vertical', fontFamily:'inherit', boxSizing:'border-box' }}
                onFocus={e => e.target.style.borderColor = 'var(--brand)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {/* 프로젝트 범위 */}
            <div>
              <label style={{ display:'block', fontSize:'0.88rem', fontWeight:600, marginBottom:'0.4rem', color:'var(--text-primary)' }}>프로젝트 범위</label>
              <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem' }}>
                {[
                  { value:'strict_isolation', label:'A. 독립적 공간', desc:'다른 프로젝트와 격리된 독립 공간' },
                  { value:'cross_project_link', label:'B. 부분적 독립 공간', desc:'선택 프로젝트 데이터를 참조하지만 독립 운영' },
                  { value:'global_knowledge', label:'C. 상호 공유 공간', desc:'모든 프로젝트 데이터를 상호 공유' },
                ].map(opt => (
                  <label key={opt.value} style={{ display:'flex', alignItems:'flex-start', gap:'0.6rem', cursor:'pointer' }}>
                    <input
                      type="radio"
                      name="psm-isolation"
                      value={opt.value}
                      checked={isolationType === opt.value}
                      onChange={() => setIsolationType(opt.value)}
                      style={{ marginTop:'3px' }}
                    />
                    <div>
                      <div style={{ fontSize:'0.9rem', fontWeight:600, color:'var(--text-primary)' }}>{opt.label}</div>
                      <div style={{ fontSize:'0.8rem', color:'var(--text-muted)' }}>{opt.desc}</div>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            {/* 저장 상태 */}
            {saveStatus === 'saved' && (
              <div style={{ textAlign:'center', color:'#4ade80', fontSize:'0.82rem', fontWeight:600 }}>✓ 저장되었습니다.</div>
            )}
            {saveStatus === 'error' && (
              <div style={{ textAlign:'center', color:'#f87171', fontSize:'0.82rem' }}>저장에 실패했습니다. 다시 시도해 주세요.</div>
            )}
          </div>

          {/* 푸터 */}
          <div style={{ padding:'1.1rem 1.5rem', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--bg-surface-2)' }}>
            <button
              type="button"
              onClick={handleDelete}
              className="modal-btn modal-btn--ghost"
              style={{ color: '#ef4444', padding: '0.4rem 0.8rem' }}
            >
              프로젝트 삭제
            </button>

            <div style={{ display:'flex', gap:'0.6rem' }}>
              <button type="button" onClick={onClose} disabled={isSaving} className="modal-btn modal-btn--ghost">
                취소
              </button>
            {/* DANGER: 저장 대신 딥씽크 트리거 버튼 */}
            {changeLevel === 'DANGER' && dangerStep === 0 ? (
              <button
                type="button"
                onClick={handleDangerAttempt}
                disabled={!isDirty}
                className="modal-btn modal-btn--approve"
                style={{ opacity: isDirty ? 1 : 0.4 }}
              >
                변경사항 저장
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSaveClick}
                disabled={isSaveDisabled}
                className="modal-btn modal-btn--approve"
                style={{ opacity: isSaveDisabled ? 0.4 : 1 }}
              >
                {isSaving ? '저장 중...' : saveStatus === 'saved' ? '✓ 저장 완료' : '변경사항 저장'}
              </button>
            )}
            </div>
          </div>
        </div>
      </div>

      {/* 타입 B 유도 NewProjectModal (CP-3: 순차 열림, z-index 충돌 없음) */}
      {showNewProject && (
        <NewProjectModal
          isOpen={showNewProject}
          onClose={() => { setShowNewProject(false); onClose(); }}
          initialValues={newProjectInitVals}
        />
      )}
    </>
  );
}
