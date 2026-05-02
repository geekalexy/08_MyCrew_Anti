import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../store/projectStore';
import { useUiStore } from '../../store/uiStore';

export default function NewProjectModal({ isOpen, onClose }) {
  const addProject = useProjectStore((s) => s.addProject);
  const projects = useProjectStore((s) => s.projects);

  const [title, setTitle] = useState('');
  const [objective, setObjective] = useState('');
  const [workflow, setWorkflow] = useState(''); // 업무
  const [isolationType, setIsolationType] = useState('strict_isolation'); // strict_isolation, global_knowledge, cross_project_link
  const [sharedProjects, setSharedProjects] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setObjective('');
      setWorkflow('');
      setIsolationType('strict_isolation');
      setSharedProjects([]);
      setIsSubmitting(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleToggleProject = (id) => {
    setSharedProjects((prev) => 
      prev.includes(id) ? prev.filter((pid) => pid !== id) : [...prev, id]
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!title.trim() || !objective.trim() || !workflow.trim()) return;

    setIsSubmitting(true);
    try {
      const isolation_scope = {
        type: isolationType,
        shared_projects: isolationType === 'cross_project_link' ? sharedProjects : []
      };
      
      const combinedObjective = `[목적]\n${objective.trim()}\n\n[업무 흐름]\n${workflow.trim()}`;
      
      await addProject(title.trim(), combinedObjective, isolation_scope);
      // 서버 응답은 바로 떨어지며, 실제 처리는 백그라운드에서 진행됨.
      // 소켓에서 처리 완료 알림이 오면 프로젝트 목록이 갱신되고 화면이 넘어갑니다.
    } catch (err) {
      console.error('Project creation failed:', err);
      alert('프로젝트 생성에 실패했습니다.');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" onClick={(e) => { if(e.target === e.currentTarget && !isSubmitting) onClose(); }}>
      <div className="modal modal--detail" style={{ maxWidth: '650px', height: 'auto', maxHeight: '90dvh' }}>
        
        {/* 모달 헤더 (TaskDetailModal 동일 구조) */}
        <div className="modal__header" style={{ alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex' }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2 className="modal__title" style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>프로젝트 설정</h2>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
            <button className="modal__close" onClick={onClose} disabled={isSubmitting} aria-label="닫기" style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', display: 'flex' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>close</span>
            </button>
          </div>
        </div>
        
        {/* 모달 바디 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem' }}>
          <form id="new-project-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
            
            {/* 프로젝트명 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.4rem', color: 'var(--text-primary)' }}>프로젝트명</label>
              <input
                type="text"
                className="new-project-input"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="프로젝트명을 입력하세요"
                required
                disabled={isSubmitting}
                style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg-surface-3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
              />
            </div>

            {/* 목적 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem', color: 'var(--text-primary)' }}>목적</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem', marginTop: 0 }}>목적에 맞는 팀빌더 에이전트가 최적의 팀을 세팅해 드립니다.</p>
              <input
                type="text"
                className="new-project-input"
                value={objective}
                onChange={(e) => setObjective(e.target.value)}
                placeholder="프로젝트의 목적을 입력하세요"
                required
                disabled={isSubmitting}
                style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg-surface-3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', fontSize: '0.95rem' }}
              />
            </div>

            {/* 업무 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem', color: 'var(--text-primary)' }}>업무</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.6rem', marginTop: 0 }}>얻고자 하는 결과물 종류(웹사이트, 블로그, 분석 등)와 업무 흐름을 기입해 주세요.</p>
              <textarea
                className="new-project-input"
                value={workflow}
                onChange={(e) => setWorkflow(e.target.value)}
                placeholder="업무 흐름과 결과물을 상세히 적어주세요"
                required
                disabled={isSubmitting}
                rows={3}
                style={{ width: '100%', padding: '0.6rem 0.8rem', background: 'var(--bg-surface-3)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', outline: 'none', resize: 'vertical', fontSize: '0.95rem', fontFamily: 'inherit' }}
              />
            </div>

            {/* 프로젝트 범위 설정 */}
            <div>
              <label style={{ display: 'block', fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.2rem', color: 'var(--text-primary)' }}>프로젝트 범위 설정</label>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', marginTop: 0 }}>AI 에이전트의 Task 로그, 메모리, 컨텍스트, 파일 데이터 등 활용 및 공유 범위 지정</p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="isolationType" 
                    value="strict_isolation" 
                    checked={isolationType === 'strict_isolation'} 
                    onChange={(e) => setIsolationType(e.target.value)}
                    disabled={isSubmitting}
                    style={{ marginTop: '3px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>A. 독립적 공간</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>다른 프로젝트와 격리된 독립된 공간에서 프로젝트 목적에 최적화된 컨텍스로 에이전트가 작업 수행</div>
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="isolationType" 
                    value="cross_project_link" 
                    checked={isolationType === 'cross_project_link'} 
                    onChange={(e) => setIsolationType(e.target.value)}
                    disabled={isSubmitting}
                    style={{ marginTop: '3px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>B. 부분적 독립 공간</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>선택 프로젝트의 로그, 메모리 등 데이터를 활용하지만, 새 프로젝트에 최적화된 에이전트 작업 수행</div>
                    
                    {isolationType === 'cross_project_link' && (
                      <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-surface-3)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                        <div style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>참조할 기존 프로젝트 선택:</div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                          {projects.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => handleToggleProject(p.id)}
                              disabled={isSubmitting}
                              style={{
                                padding: '6px 12px',
                                fontSize: '0.85rem',
                                borderRadius: '4px',
                                border: `1px solid ${sharedProjects.includes(p.id) ? 'var(--text-primary)' : 'var(--border)'}`,
                                background: sharedProjects.includes(p.id) ? 'var(--bg-surface-highest)' : 'transparent',
                                color: sharedProjects.includes(p.id) ? 'var(--text-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                            >
                              {p.name}
                            </button>
                          ))}
                          {projects.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>가져올 기존 프로젝트가 없습니다.</span>}
                        </div>
                      </div>
                    )}
                  </div>
                </label>

                <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                  <input 
                    type="radio" 
                    name="isolationType" 
                    value="global_knowledge" 
                    checked={isolationType === 'global_knowledge'} 
                    onChange={(e) => setIsolationType(e.target.value)}
                    disabled={isSubmitting}
                    style={{ marginTop: '3px' }}
                  />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>C. 상호 공유 공간</div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>모든 프로젝트의 데이터를 활용하며, 새 프로젝트의 데이터도 상호 공유하는 오픈된 업무 수행 공간</div>
                  </div>
                </label>
              </div>
            </div>
          </form>
        </div>

        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', background: 'var(--bg-surface-2)' }}>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="modal-btn modal-btn--ghost">
            취소
          </button>
          <button type="submit" form="new-project-form" disabled={isSubmitting || !title.trim() || !objective.trim() || !workflow.trim()} className="modal-btn modal-btn--approve" style={{ opacity: (isSubmitting || !title.trim() || !objective.trim() || !workflow.trim()) ? 0.5 : 1 }}>
            {isSubmitting ? (
               <>
                 <span className="material-symbols-outlined" style={{ animation: 'spin 2s linear infinite', fontSize: '1.1rem' }}>autorenew</span>
                 AI가 프로젝트 설계 중...
               </>
            ) : '프로젝트 생성'}
          </button>
        </div>
      </div>
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        .new-project-input::placeholder {
          color: var(--text-muted);
          opacity: 0.45;
        }
      `}</style>
    </div>
  );
}
