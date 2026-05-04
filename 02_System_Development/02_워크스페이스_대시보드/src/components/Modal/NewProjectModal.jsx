import React, { useState, useEffect, useRef } from 'react';
import { useProjectStore } from '../../store/projectStore';

// ── 파이프라인 단계 정의 ─────────────────────────────────────────────────────
const STAGES = [
  { id: 'analyze',  label: '프로젝트 목적 및 기능 분석',        estSec: 5  },
  { id: 'team',     label: 'Gemini가 팀 구성 및 스킬 설계 중',  estSec: 20 },
  { id: 'policy',   label: '정책 검증 및 에이전트 ID 확인',      estSec: 3  },
  { id: 'db',       label: 'DB 등록 및 프로젝트 초기화',         estSec: 4  },
  { id: 'scaffold', label: '워크스페이스 파일 구성 완료',         estSec: 3  },
];
const TOTAL_EST_SEC = STAGES.reduce((s, st) => s + st.estSec, 0);

// ── 추가 기능 제안 풀 ────────────────────────────────────────────────────────
const SUGGEST_POOL = {
  dev: [
    '실시간 알림 및 푸시 기능', 'API 연동 및 외부 서비스 통합', '사용자 인증 및 권한 관리',
    '데이터 시각화 대시보드', '파일 업로드 및 관리', '검색 및 필터링 기능',
    '반응형 모바일 지원', '다크모드 UI 테마', '로그 및 감사 추적',
  ],
  mkt: [
    'SNS 자동 포스팅 연동', 'A/B 테스트 설계', 'KPI 리포트 자동 생성',
    '이메일 뉴스레터 발송', '고객 세그먼트 분석', '콘텐츠 캘린더 관리',
    '광고 성과 추적', '인플루언서 협업 관리', '브랜드 가이드라인 문서화',
  ],
};

export default function NewProjectModal({ isOpen, onClose, initialValues = null }) {
  const addProject = useProjectStore((s) => s.addProject);
  const projects   = useProjectStore((s) => s.projects);

  const [title, setTitle]               = useState('');
  const [projectType, setProjectType]   = useState('dev');
  const [coreFeature, setCoreFeature]   = useState('');         // dev: 핵심 기능
  const [suggestions, setSuggestions]   = useState([]);
  const [selectedSugs, setSelectedSugs] = useState([]);
  const [extraFeature, setExtraFeature] = useState('');
  // mkt 전용 필드
  const [mktProduct, setMktProduct]     = useState('');         // 홍보 대상 (필수)
  const [mktAdvantage, setMktAdvantage] = useState('');         // 핵심 경쟁력 (옵션)
  const [mktWebsite, setMktWebsite]     = useState('');         // 웹사이트 (옵션)
  const [isolationType, setIsolationType] = useState('strict_isolation');
  const [sharedProjects, setSharedProjects] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ── 타임라인 상태 ─────────────────────────────────────────────────────────
  const [elapsed, setElapsed]     = useState(0);   // 경과 초 (10초 tick)
  const [activeStage, setActive]  = useState(0);   // 현재 단계 인덱스
  const [stageTimes, setStageTimes] = useState([]); // 각 단계 시작 초
  const timerRef = useRef(null);
  const stageRef = useRef(null);
  const startRef = useRef(null);

  // 프로젝트 스토어의 projects 길이를 추적하여 생성이 완료되었는지 확인
  const prevProjectsLenRef = useRef(projects.length);

  // 목적 변경 시 제안 풀에서 랜덤 3개 추출
  useEffect(() => {
    const pool = SUGGEST_POOL[projectType] || SUGGEST_POOL.dev;
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 3);
    setSuggestions(shuffled);
    setSelectedSugs([]);
  }, [projectType]);

  useEffect(() => {
    if (isOpen) {
      setTitle(initialValues?.title || '');
      setProjectType('dev');
      setCoreFeature('');
      setExtraFeature('');
      setSelectedSugs([]);
      setMktProduct('');
      setMktAdvantage('');
      setMktWebsite('');
      setIsolationType(initialValues?.isolationType || 'strict_isolation');
      setSharedProjects(initialValues?.sharedProjects || []);
      setIsSubmitting(false);
      setElapsed(0);
      setActive(0);
      setStageTimes([]);
      prevProjectsLenRef.current = projects.length;
    }
  }, [isOpen, initialValues]);

  // 완료 감지: isSubmitting 중인데 projects 배열이 늘어났다면 성공적으로 추가된 것!
  useEffect(() => {
    if (isSubmitting && projects.length > prevProjectsLenRef.current) {
      setIsSubmitting(false);
      onClose();
    }
    prevProjectsLenRef.current = projects.length;
  }, [projects.length, isSubmitting, onClose]);

  useEffect(() => {
    if (!isSubmitting) {
      clearInterval(timerRef.current);
      clearInterval(stageRef.current);
      return;
    }

    startRef.current = Date.now();
    setElapsed(0);
    setActive(0);
    setStageTimes([0]);

    // 10초 tick — 경과 시간 업데이트
    timerRef.current = setInterval(() => {
      const sec = Math.round((Date.now() - startRef.current) / 1000);
      setElapsed(sec);
    }, 1000);

    // 단계 자동 진행 (estSec 기반)
    let cumSec = 0;
    STAGES.forEach((st, i) => {
      if (i === 0) return;
      cumSec += STAGES[i - 1].estSec;
      const delay = cumSec * 1000;
      setTimeout(() => {
        setActive(i);
        setStageTimes(prev => [...prev, Math.round((Date.now() - startRef.current) / 1000)]);
      }, delay);
    });

    return () => {
      clearInterval(timerRef.current);
    };
  }, [isSubmitting]);

  if (!isOpen) return null;

  const handleToggleProject = (id) =>
    setSharedProjects(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);

  const toggleSug = (s) =>
    setSelectedSugs(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const isMkt = projectType === 'mkt';
    if (!title.trim()) return;
    if (!isMkt && !coreFeature.trim()) return;
    if (isMkt && !mktProduct.trim()) return;
    setIsSubmitting(true);
    try {
      const isolation_scope = {
        type: isolationType,
        shared_projects: isolationType === 'cross_project_link' ? sharedProjects : [],
      };
      let combinedObjective;
      if (isMkt) {
        const lines = [
          `홍보 대상: ${mktProduct.trim()}`,
          ...(mktAdvantage.trim() ? [`핵심 경쟁력: ${mktAdvantage.trim()}`] : []),
          ...(mktWebsite.trim() ? [`서비스 웹사이트: ${mktWebsite.trim()}`] : []),
          ...(selectedSugs.length > 0 ? [`마케팅 전략 방향: ${selectedSugs.join(', ')}`] : []),
          ...(extraFeature.trim() ? [`추가 요청: ${extraFeature.trim()}`] : []),
        ].join('\n');
        combinedObjective = `[프로젝트 유형]\n마케팅 프로젝트\n\n[원하는 기능 목록]\n${lines}`;
      } else {
        const featureLines = [
          `핵심 기능: ${coreFeature.trim()}`,
          ...(selectedSugs.length > 0 ? [`추가 기능: ${selectedSugs.join(', ')}`] : []),
          ...(extraFeature.trim() ? [`직접 추가: ${extraFeature.trim()}`] : []),
        ].join('\n');
        combinedObjective = `[프로젝트 유형]\n개발(IT) 프로젝트\n\n[원하는 기능 목록]\n${featureLines}`;
      }
      await addProject(title.trim(), combinedObjective, isolation_scope);
    } catch (err) {
      console.error('Project creation failed:', err);
      alert('프로젝트 생성에 실패했습니다.');
      setIsSubmitting(false);
    }
  };

  // ── 막대 너비 계산 ──────────────────────────────────────────────────────
  // 각 단계의 막대: 완료 → 100%, 진행중 → 경과비율(estSec 기준), 대기 → 0%
  const getBarPct = (stageIdx) => {
    if (stageIdx < activeStage) return 100;
    if (stageIdx > activeStage) return 0;
    // 현재 단계: 이 단계에서 경과한 초 / estSec
    const stageStart = stageTimes[stageIdx] || 0;
    const inStage = Math.max(0, elapsed - stageStart);
    return Math.min(100, (inStage / STAGES[stageIdx].estSec) * 100);
  };

  // 10초 단위 눈금 (최대 예상 시간 기준)
  const MAX_SEC = Math.max(TOTAL_EST_SEC, elapsed + 5);
  const tickCount = Math.ceil(MAX_SEC / 10);

  const currentLabel = STAGES[activeStage]?.label ?? '완료 중...';

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => { if (e.target === e.currentTarget && !isSubmitting) onClose(); }}
    >
      <div
        className={`modal modal--detail npm-modal${isSubmitting ? ' npm-modal--building' : ''}`}
        style={{ maxWidth: '650px', height: 'auto', maxHeight: '92dvh', minHeight: isSubmitting ? '560px' : 'auto' }}
      >
        {/* 헤더 */}
        <div className="modal__header" style={{ alignItems: 'center', padding: '1.25rem 1.5rem', borderBottom: '1px solid var(--border)', display: 'flex' }}>
          <div style={{ flex: 1 }}>
            <h2 className="modal__title" style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>프로젝트 설정</h2>
          </div>
          <button
            onClick={onClose}
            disabled={isSubmitting}
            aria-label="닫기"
            style={{ background: 'none', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer', color: 'var(--text-muted)', display: 'flex', opacity: isSubmitting ? 0.3 : 1 }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '1.4rem' }}>close</span>
          </button>
        </div>

        {/* 바디 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', position: 'relative' }}>
          {/* ── 타임라인 로딩 오버레이 ── */}
          {isSubmitting && (
            <div className="npm-overlay">
              <div className="npm-tl-wrap">
                {/* 헤더 */}
                <div className="npm-tl-header">
                  <span className="npm-tl-title">⚙ 팀빌딩 파이프라인</span>
                  <span className="npm-tl-elapsed">{elapsed}s elapsed</span>
                </div>

                {/* 10초 눈금 */}
                <div className="npm-tl-ticks">
                  {Array.from({ length: tickCount + 1 }).map((_, i) => (
                    <div key={i} className="npm-tick" style={{ left: `${(i * 10 / MAX_SEC) * 100}%` }}>
                      <span className="npm-tick-label">{i * 10}s</span>
                    </div>
                  ))}
                  {/* 현재 시간 커서 */}
                  <div
                    className="npm-tl-cursor"
                    style={{ left: `${Math.min(100, (elapsed / MAX_SEC) * 100)}%` }}
                  />
                </div>

                {/* 단계별 막대 */}
                <div className="npm-tl-rows">
                  {STAGES.map((st, i) => {
                    const pct   = getBarPct(i);
                    const done  = i < activeStage;
                    const active = i === activeStage;
                    return (
                      <div key={st.id} className="npm-tl-row">
                        {/* 레이블 */}
                        <div className={`npm-tl-row-label${active ? ' npm-tl-row-label--active' : ''}`}>
                          <span className={`npm-tl-dot${done ? ' done' : active ? ' active' : ''}`} />
                          {st.label}
                        </div>
                        {/* 막대 트랙 */}
                        <div className="npm-tl-bar-track">
                          <div
                            className={`npm-tl-bar${done ? ' npm-tl-bar--done' : active ? ' npm-tl-bar--active' : ''}`}
                            style={{ width: `${pct}%` }}
                          />
                          {active && (
                            <div className="npm-tl-bar-shimmer" style={{ width: `${pct}%` }} />
                          )}
                          {/* 예상 시간 마커 */}
                          <div
                            className="npm-tl-est-marker"
                            style={{
                              left: `${Math.min(98, (STAGES.slice(0, i + 1).reduce((a, s) => a + s.estSec, 0) / MAX_SEC) * 100)}%`
                            }}
                          />
                        </div>
                        {/* 경과 표시 */}
                        <div className="npm-tl-row-time">
                          {done
                            ? `+${(stageTimes[i + 1] || stageTimes[i] || 0) - (stageTimes[i] || 0)}s`
                            : active
                            ? `~${st.estSec}s`
                            : '—'}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* 현재 단계 메시지 */}
                <div className="npm-tl-status" key={activeStage}>
                  <span className="npm-tl-status-dot" />
                  {currentLabel}
                </div>
              </div>
            </div>
          )}

          <form id="new-project-form" onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', opacity: isSubmitting ? 0.25 : 1, transition: 'opacity 0.4s', pointerEvents: isSubmitting ? 'none' : 'auto' }}>

            {/* 프로젝트명 */}
            <div>
              <label className="npm-label">프로젝트명</label>
              <input type="text" className="new-project-input npm-input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="프로젝트명을 입력하세요" required readOnly={isSubmitting} />
            </div>

            {/* 목적 선택 */}
            <div>
              <label className="npm-label">목적</label>
              <p className="npm-hint">프로젝트 성격에 맞는 팀과 스킬이 자동으로 구성됩니다.</p>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                {[{ val: 'dev', label: '🛠 개발 (IT)' }, { val: 'mkt', label: '📣 마케팅' }].map(({ val, label }) => (
                  <label key={val} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '0.65rem 1rem', border: `1.5px solid ${projectType === val ? 'var(--brand)' : 'var(--border)'}`, borderRadius: '8px', cursor: 'pointer', background: projectType === val ? 'rgba(100,135,242,0.1)' : 'transparent', transition: 'all 0.2s', fontWeight: 600, fontSize: '0.9rem' }}>
                    <input type="radio" name="projectType" value={val} checked={projectType === val} onChange={() => setProjectType(val)} disabled={isSubmitting} style={{ display: 'none' }} />
                    {label}
                  </label>
                ))}
              </div>
            </div>

            {/* 개발: 핵심 기능 입력 */}
            {projectType === 'dev' && (
              <div>
                <label className="npm-label">원하는 핵심 기능 <span style={{ color: 'var(--brand)', fontSize: '0.75rem' }}>*필수</span></label>
                <p className="npm-hint">만들고 싶은 핵심 기능을 구체적으로 입력해주세요.</p>
                <textarea className="new-project-input npm-input" value={coreFeature} onChange={(e) => setCoreFeature(e.target.value)} placeholder="예: 텔레그램 미니앱으로 프로젝트 태스크를 관리하고 결과물을 승인·거절하는 기능" required readOnly={isSubmitting} rows={3} style={{ resize: isSubmitting ? 'none' : 'vertical', fontFamily: 'inherit' }} />
              </div>
            )}

            {/* 마케팅: 서비스 컨텍스트 입력 */}
            {projectType === 'mkt' && (
              <>
                <div>
                  <label className="npm-label">무엇을 홍보하나요? <span style={{ color: 'var(--brand)', fontSize: '0.75rem' }}>*필수</span></label>
                  <p className="npm-hint">홍보할 기능이나 서비스를 간단히 설명해주세요.</p>
                  <textarea className="new-project-input npm-input" value={mktProduct} onChange={(e) => setMktProduct(e.target.value)} placeholder="예: AI 기반 자동화 크루 서비스 MyCrew — 에이전트 팀이 자율적으로 업무를 수행하는 SaaS" required readOnly={isSubmitting} rows={3} style={{ resize: isSubmitting ? 'none' : 'vertical', fontFamily: 'inherit' }} />
                </div>
                <div>
                  <label className="npm-label">핵심 경쟁력 <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 400 }}>옵션</span></label>
                  <input type="text" className="new-project-input npm-input" value={mktAdvantage} onChange={(e) => setMktAdvantage(e.target.value)} placeholder="예: 국내 유일 에이전트 자율 완주 방식, 월 구독형" readOnly={isSubmitting} />
                </div>
                <div>
                  <label className="npm-label">서비스 웹사이트 <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 400 }}>옵션</span></label>
                  <input type="url" className="new-project-input npm-input" value={mktWebsite} onChange={(e) => setMktWebsite(e.target.value)} placeholder="https://mycrew.run" readOnly={isSubmitting} />
                </div>
              </>
            )}

            {/* AI 추가 기능/전략 제안 */}
            {suggestions.length > 0 && (
              <div>
                <label className="npm-label">
                  {projectType === 'mkt' ? '마케팅 전략 방향 제안' : '추가 기능 제안'}{' '}
                  <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem', fontWeight: 400 }}>원하는 것만 선택하세요</span>
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {suggestions.map((s) => (
                    <label key={s} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '0.55rem 0.75rem', border: `1px solid ${selectedSugs.includes(s) ? 'var(--brand)' : 'var(--border)'}`, borderRadius: '6px', cursor: 'pointer', background: selectedSugs.includes(s) ? 'rgba(100,135,242,0.08)' : 'transparent', transition: 'all 0.18s', fontSize: '0.88rem' }}>
                      <input type="checkbox" checked={selectedSugs.includes(s)} onChange={() => toggleSug(s)} disabled={isSubmitting} style={{ accentColor: 'var(--brand)' }} />
                      {s}
                    </label>
                  ))}
                </div>
                <textarea className="new-project-input npm-input" value={extraFeature} onChange={(e) => setExtraFeature(e.target.value)} placeholder={projectType === 'mkt' ? '위에 없는 전략 방향을 입력하거나 비워두세요' : '위에 없는 기능을 추가로 입력하거나 비워두세요'} readOnly={isSubmitting} rows={2} style={{ marginTop: '0.6rem', resize: isSubmitting ? 'none' : 'vertical', fontFamily: 'inherit', fontSize: '0.88rem' }} />
              </div>
            )}

            {/* 격리 타입 */}
            <div>
              <label className="npm-label">프로젝트 범위 설정</label>
              <p className="npm-hint">AI 에이전트의 컨텍스트, 파일, 메모리 공유 범위 지정</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {[
                  { val: 'strict_isolation',   title: 'A. 독립적 공간',      desc: '다른 프로젝트와 격리된 독립된 공간에서 목적에 최적화된 컨텍스트로 작업 수행' },
                  { val: 'cross_project_link', title: 'B. 부분적 독립 공간', desc: '선택 프로젝트의 로그·메모리 데이터를 활용하지만 이 프로젝트에 최적화' },
                  { val: 'global_knowledge',   title: 'C. 상호 공유 공간',   desc: '모든 프로젝트의 데이터를 활용하며 이 프로젝트 데이터도 상호 공유' },
                ].map(({ val, title: t, desc }) => (
                  <label key={val} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                    <input type="radio" name="isolationType" value={val} checked={isolationType === val} onChange={(e) => setIsolationType(e.target.value)} disabled={isSubmitting} style={{ marginTop: '3px' }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '0.95rem', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>{t}</div>
                      <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4 }}>{desc}</div>
                      {val === 'cross_project_link' && isolationType === 'cross_project_link' && (
                        <div style={{ marginTop: '12px', padding: '12px', background: 'var(--bg-surface-3)', border: '1px solid var(--border)', borderRadius: '6px' }}>
                          <div style={{ fontSize: '0.85rem', marginBottom: '8px', color: 'var(--text-primary)', fontWeight: 500 }}>참조할 기존 프로젝트 선택:</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                            {projects.map(p => (
                              <button key={p.id} type="button" onClick={() => handleToggleProject(p.id)}
                                style={{ padding: '6px 12px', fontSize: '0.85rem', borderRadius: '4px', border: `1px solid ${sharedProjects.includes(p.id) ? 'var(--text-primary)' : 'var(--border)'}`, background: sharedProjects.includes(p.id) ? 'var(--bg-surface-highest)' : 'transparent', color: sharedProjects.includes(p.id) ? 'var(--text-primary)' : 'var(--text-secondary)', cursor: 'pointer', transition: 'all 0.2s' }}>
                                {p.name}
                              </button>
                            ))}
                            {projects.length === 0 && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>가져올 기존 프로젝트가 없습니다.</span>}
                          </div>
                        </div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          </form>
        </div>

        {/* 푸터 */}
        <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'flex-end', gap: '0.6rem', background: 'var(--bg-surface-2)', borderRadius: '0 0 12px 12px' }}>
          <button type="button" onClick={onClose} disabled={isSubmitting} className="modal-btn modal-btn--ghost">취소</button>
          <button
            type="submit"
            form="new-project-form"
            disabled={isSubmitting || !title.trim() || (projectType === 'dev' ? !coreFeature.trim() : !mktProduct.trim())}
            className="modal-btn modal-btn--approve"
            style={{ minWidth: '200px', justifyContent: 'center', opacity: (isSubmitting || !title.trim() || (projectType === 'dev' ? !coreFeature.trim() : !mktProduct.trim())) ? 0.55 : 1 }}
          >
            {isSubmitting ? currentLabel : '프로젝트 생성'}
          </button>
        </div>
      </div>

      <style>{`
        /* ── 모달 기본 ── */
        .npm-modal { border-radius: 12px !important; overflow: hidden; }

        /* ── Halo 애니메이션 ── */
        @keyframes npm_halo {
          0%   { box-shadow: 0 0 0 0  rgba(100,135,242,0),    0 12px 60px rgba(0,0,0,0.45); }
          45%  { box-shadow: 0 0 0 10px rgba(100,135,242,0.18), 0 12px 60px rgba(0,0,0,0.45); }
          75%  { box-shadow: 0 0 0 20px rgba(100,135,242,0.06), 0 12px 60px rgba(0,0,0,0.45); }
          100% { box-shadow: 0 0 0 0  rgba(100,135,242,0),    0 12px 60px rgba(0,0,0,0.45); }
        }
        @keyframes npm_border {
          0%, 100% { border-color: rgba(100,135,242,0.4); }
          50%       { border-color: rgba(100,135,242,0.9); }
        }
        .npm-modal--building {
          animation: npm_halo 2.4s ease-in-out infinite, npm_border 2.4s ease-in-out infinite !important;
          border: 1px solid rgba(100,135,242,0.4) !important;
        }

        /* ── 오버레이 ── */
        .npm-overlay {
          position: absolute; inset: 0; z-index: 10;
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          animation: npm_fadeIn 0.35s ease;
          background: rgba(10, 14, 26, 0.88);
          backdrop-filter: blur(6px);
          padding: 1.5rem;
        }
        [data-theme="light"] .npm-overlay,
        @media (prefers-color-scheme: light) {
          .npm-overlay { background: rgba(240, 243, 252, 0.90); }
        }
        @keyframes npm_fadeIn { from { opacity:0; } to { opacity:1; } }

        /* ── 타임라인 컨테이너 ── */
        .npm-tl-wrap {
          width: 100%; max-width: 540px;
          background: rgba(18, 24, 40, 0.95);
          border: 1px solid rgba(100,135,242,0.22);
          border-radius: 10px;
          padding: 1.6rem 1.8rem;
          font-family: 'Space Grotesk', 'JetBrains Mono', monospace;
          box-shadow: 0 8px 40px rgba(0,0,0,0.5);
        }

        /* ── 헤더 ── */
        .npm-tl-header {
          display: flex; justify-content: space-between; align-items: center;
          margin-bottom: 1.6rem;
        }
        .npm-tl-title {
          font-size: 0.8rem; font-weight: 700; letter-spacing: 0.04em;
          color: #9bb0ff; text-transform: uppercase;
        }
        .npm-tl-elapsed {
          font-size: 0.75rem; color: rgba(155,176,255,0.55);
          font-variant-numeric: tabular-nums;
        }

        /* ── 10초 눈금 ── */
        .npm-tl-ticks {
          position: relative; height: 22px; margin-bottom: 1rem;
          border-left: 1px solid rgba(100,135,242,0.2);
        }
        .npm-tick {
          position: absolute; top: 0; width: 1px;
          height: 8px; background: rgba(100,135,242,0.3);
        }
        .npm-tick-label {
          position: absolute; top: 10px; left: -10px;
          font-size: 0.62rem; color: rgba(155,176,255,0.45);
          font-variant-numeric: tabular-nums; white-space: nowrap;
        }
        .npm-tl-cursor {
          position: absolute; top: -3px; width: 1px; height: 28px;
          background: rgba(100,135,242,0.8);
          box-shadow: 0 0 8px rgba(100,135,242,0.6);
          transition: left 0.95s linear;
        }

        /* ── 막대 행 ── */
        .npm-tl-rows { display: flex; flex-direction: column; gap: 10px; margin-bottom: 1.4rem; }
        .npm-tl-row {
          display: grid;
          grid-template-columns: 210px 1fr 38px;
          align-items: center;
          gap: 12px;
        }

        /* 레이블 */
        .npm-tl-row-label {
          font-size: 0.76rem; color: rgba(155,176,255,0.5);
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          transition: color 0.3s;
          display: flex; align-items: center; gap: 7px;
        }
        .npm-tl-row-label--active { color: rgba(155,176,255,0.95); }
        .npm-tl-dot {
          width: 5px; height: 5px; border-radius: 50%; flex-shrink: 0;
          background: rgba(100,135,242,0.2); transition: background 0.3s;
        }
        .npm-tl-dot.done   { background: rgba(100,135,242,0.5); }
        .npm-tl-dot.active { background: #6487f2; box-shadow: 0 0 5px #6487f2; }

        /* 막대 트랙 — 사각형(border-radius: 0) */
        .npm-tl-bar-track {
          height: 12px; border-radius: 0;
          background: rgba(100,135,242,0.08);
          position: relative; overflow: hidden;
          border: 1px solid rgba(100,135,242,0.12);
        }
        .npm-tl-bar {
          height: 100%; border-radius: 0;
          background: rgba(100,135,242,0.25);
          transition: width 0.9s linear;
        }
        .npm-tl-bar--done   { background: rgba(100,135,242,0.42); }
        .npm-tl-bar--active {
          background: linear-gradient(90deg, rgba(80,115,230,0.55), #6487f2);
        }

        /* shimmer */
        @keyframes npm_barShimmer {
          0%   { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
        .npm-tl-bar-shimmer {
          position: absolute; top: 0; left: 0; height: 100%; width: 40%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.16), transparent);
          animation: npm_barShimmer 1.8s ease-in-out infinite;
          pointer-events: none;
        }

        /* 예상 시간 마커 */
        .npm-tl-est-marker {
          position: absolute; top: -2px; height: calc(100% + 4px);
          width: 1px; border-left: 1px dashed rgba(155,176,255,0.25);
        }

        /* 경과 시간 */
        .npm-tl-row-time {
          font-size: 0.66rem; color: rgba(155,176,255,0.45);
          text-align: right; font-variant-numeric: tabular-nums;
        }

        /* ── 현재 단계 상태 메시지 ── */
        @keyframes npm_statusPulse {
          0%, 100% { opacity: 1; } 50% { opacity: 0.45; }
        }
        .npm-tl-status {
          display: flex; align-items: center; gap: 9px;
          font-size: 0.82rem; color: rgba(155,176,255,0.88);
          padding-top: 1rem;
          border-top: 1px solid rgba(100,135,242,0.14);
          animation: npm_fadeIn 0.4s ease;
        }
        .npm-tl-status-dot {
          width: 7px; height: 7px; border-radius: 50%;
          background: #6487f2;
          animation: npm_statusPulse 1.4s ease-in-out infinite;
          flex-shrink: 0;
        }

        /* ── 공통 인풋 ── */
        .npm-label { display: block; font-size: 0.9rem; font-weight: 600; margin-bottom: 0.4rem; color: var(--text-primary); }
        .npm-hint  { font-size: 0.8rem; color: var(--text-muted); margin: 0 0 0.6rem; }
        .npm-input {
          width: 100%; padding: 0.6rem 0.8rem; box-sizing: border-box;
          background: var(--bg-surface-3); border: 1px solid var(--border);
          border-radius: 6px; color: var(--text-primary); outline: none; font-size: 0.95rem;
          display: block;
        }
        .new-project-input::placeholder { color: var(--text-muted); opacity: 0.45; }
      `}</style>
    </div>
  );
}
