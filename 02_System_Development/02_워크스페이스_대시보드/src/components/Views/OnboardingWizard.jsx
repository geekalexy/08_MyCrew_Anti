// src/components/Views/OnboardingWizard.jsx
// Phase 20: Premium Onboarding Wizard — Full Visual Redesign + Model Selector
import { useState, useEffect, useRef } from 'react';
import { useUiStore } from '../../store/uiStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

/* ─────────────────────────────────────────────────────────────
   아이콘 컴포넌트
───────────────────────────────────────────────────────────── */
const Icon = ({ name, size = '1.4rem', style = {} }) => (
  <span className="material-symbols-outlined" style={{ fontSize: size, ...style }}>{name}</span>
);

const CheckIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/* ─────────────────────────────────────────────────────────────
   상수: 팀 타입
───────────────────────────────────────────────────────────── */
const TEAM_TYPES = [
  { id: 'marketing',   icon: 'campaign',  title: '마케팅 / 분석 전문팀', desc: '콘텐츠 생성, 시장 분석, 캠페인 기획을 자동화합니다.', accent: '#b4c5ff', glow: 'rgba(180,197,255,0.18)' },
  { id: 'development', icon: 'terminal',  title: 'IT / 프로덕트 개발팀', desc: '코드 리뷰, 버그 탐지, 기술 문서 작성을 전담합니다.',   accent: '#a5f3bd', glow: 'rgba(165,243,189,0.16)' },
  { id: 'general',     icon: 'smart_toy', title: '범용 개인 비서팀',     desc: '일정 관리, 리서치, 보고서 작성까지 무엇이든 처리합니다.', accent: '#ffb963', glow: 'rgba(255,185,99,0.18)' },
];

/* ─────────────────────────────────────────────────────────────
   상수: AI 모델 제공사
   sub-flow: 연결방식(engineMode) → 제공사(provider) → 입력 폼
───────────────────────────────────────────────────────────── */
const PROVIDERS = [
  {
    id: 'gemini',
    name: 'Google Gemini',
    logo: 'auto_awesome',           // material icon
    accent: '#4285F4',
    glow: 'rgba(66,133,244,0.16)',
    tagSub: ['Gemini Advanced', '2.5 Flash'],
    tagKey: ['AIza...  형식', 'Flash / Pro 선택'],
    keyPlaceholder: 'AIzaSy...',
    keyLabel: 'Gemini API Key',
    secretKey: 'GEMINI_API_KEY',
  },
  {
    id: 'claude',
    name: 'Anthropic Claude',
    logo: 'psychology',
    accent: '#c07e5e',
    glow: 'rgba(192,126,94,0.16)',
    tagSub: ['Claude Pro / Max', 'Sonnet / Opus 지원'],
    tagKey: ['sk-ant-  형식', 'Sonnet / Haiku 선택'],
    keyPlaceholder: 'sk-ant-...',
    keyLabel: 'Anthropic API Key',
    secretKey: 'ANTHROPIC_API_KEY',
  },
];

/* ─────────────────────────────────────────────────────────────
   메인 컴포넌트
───────────────────────────────────────────────────────────── */
export default function OnboardingWizard() {
  const { completeOnboarding, updateWorkspace } = useUiStore();

  const [step, setStep]           = useState(1);
  const [animDir, setAnimDir]     = useState('forward');
  const [animKey, setAnimKey]     = useState(0);   // 변경 시마다 증가 → key prop으로 애니메이션 재시작 (깜빡임 없음)
  const [loading, setLoading]     = useState(false);
  const [submitDone, setSubmitDone] = useState(false);

  // Step 1
  const [wsName, setWsName] = useState('');
  const inputRef = useRef(null);

  // Step 2 — sub-flow: engineMode → provider → credentials
  const [engineMode, setEngineMode]   = useState(null);  // null | 'subscription' | 'manual'
  const [provider, setProvider]       = useState(null);  // null | 'gemini' | 'claude'
  const [apiKey, setApiKey]           = useState('');
  const [subEmail, setSubEmail]       = useState('');
  const [testStatus, setTestStatus]   = useState(null);  // null | 'testing' | 'success' | 'error'
  const [testErrorMsg, setTestErrorMsg] = useState('');

  // Step 3
  const [teamType, setTeamType] = useState('general');

  const currentProvider = PROVIDERS.find((p) => p.id === provider);
  const credValue = engineMode === 'manual' ? apiKey : subEmail;

  /* ── 자동 포커스 ── */
  useEffect(() => {
    if (step === 1 && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [step]);

  /* ── 애니메이션 트리거 ── */
  const bump = (direction = 'forward') => {
    setAnimDir(direction);
    setAnimKey((k) => k + 1);
  };

  /* ── 단계 전환 ── */
  const goToStep = (target, direction = 'forward') => {
    bump(direction);
    setStep(target);
  };

  /* ── 뒤로 가기 로직 ── */
  const handleBack = () => {
    if (provider && engineMode) {
      // 제공사 선택 해제 → 제공사 선택 화면으로
      setProvider(null);
      setApiKey('');
      setSubEmail('');
      setTestStatus(null);
      setTestErrorMsg('');
      bump('backward');
    } else if (engineMode) {
      // 연결방식 선택 해제 → 연결방식 선택 화면으로
      setEngineMode(null);
      bump('backward');
    } else if (step > 1) {
      goToStep(step - 1, 'backward');
    }
  };

  /* ── Step 2: 연결 방식 선택 ── */
  const handleEngineSelect = (mode) => {
    setEngineMode(mode);
    setProvider(null);
    setApiKey('');
    setSubEmail('');
    setTestStatus(null);
    bump();
  };

  /* ── Step 2: 제공사 선택 ── */
  const handleProviderSelect = (pid) => {
    setProvider(pid);
    setApiKey('');
    setSubEmail('');
    setTestStatus(null);
    bump();
  };

  /* ── 연동 테스트 ── */
  const testConnection = async () => {
    if (!credValue.trim()) return;
    setTestStatus('testing');
    setTestErrorMsg('');
    try {
      const res = await fetch(`${SERVER_URL}/api/onboarding/test-connection`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: engineMode === 'manual' ? 'key' : 'sub',
          provider: provider,
          value: credValue,
        }),
      });
      if (res.ok) {
        setTestStatus('success');
      } else {
        const data = await res.json().catch(() => ({}));
        setTestStatus('error');
        setTestErrorMsg(data.message || '정보를 다시 확인해 주세요.');
      }
    } catch {
      setTestStatus('error');
      setTestErrorMsg('서버 연결에 실패했습니다. 잠시 후 다시 시도해 주세요.');
    }
  };

  /* ── 다음 / 제출 ── */
  const handleNext = async () => {
    if (step === 1) {
      if (!wsName.trim()) return;
      updateWorkspace({ workspaceName: wsName.trim() });
      goToStep(2);

    } else if (step === 2) {
      if (testStatus !== 'success') return;
      setLoading(true);
      try {
        await fetch(`${SERVER_URL}/api/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'workspace_name', value: wsName }),
        });
        if (engineMode === 'manual') {
          await fetch(`${SERVER_URL}/api/secrets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: currentProvider?.secretKey || 'API_KEY', value: apiKey }),
          });
        } else {
          await fetch(`${SERVER_URL}/api/secrets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'AI_BRIDGE_MODE', value: `DIRECT_SUBSCRIPTION_${provider?.toUpperCase()}` }),
          });
          await fetch(`${SERVER_URL}/api/secrets`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: 'SUBSCRIBED_ACCOUNT', value: subEmail }),
          });
        }
        // 선택한 제공사 저장
        await fetch(`${SERVER_URL}/api/settings`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key: 'ai_provider', value: provider }),
        });
      } catch (e) { console.error(e); }
      setLoading(false);
      goToStep(3);

    } else if (step === 3) {
      setLoading(true);
      try {
        await fetch(`${SERVER_URL}/api/onboarding/activate-team`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ teamType }),
        });
        await fetch(`${SERVER_URL}/api/onboarding/finish`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userName: '대표님', teamName: wsName }),
        });
      } catch (e) { console.error(e); }
      setLoading(false);
      setSubmitDone(true);
      setTimeout(() => completeOnboarding(), 1800);
    }
  };

  /* ── canGoNext 판정 ── */
  const step2Ready = step === 2 && testStatus === 'success';
  const canGoNext =
    (step === 1 && wsName.trim().length > 0) ||
    step2Ready ||
    step === 3;

  /* ── Step 2 헤더 타이틀 계산 ── */
  const step2Title = () => {
    if (!engineMode) return 'AI 엔진 연결 설정';
    if (!provider)   return engineMode === 'subscription' ? '구독 중인 서비스 선택' : '연결할 AI 제공사 선택';
    return engineMode === 'subscription' ? `${currentProvider?.name} 구독 연동` : `${currentProvider?.name} API 키 연결`;
  };
  const step2Subtitle = () => {
    if (!engineMode) return '기존 구독을 활용하거나 개인 키를 연결할 수 있습니다.';
    if (!provider)   return '사용 중인 AI 서비스를 선택해 주세요.';
    return '정확한 정보를 입력하고 Test 버튼으로 연동을 확인해 주세요.';
  };

  const showBack = step > 1 || engineMode;

  /* ── 제출 완료 화면 ── */
  if (submitDone) {
    return (
      <div className="ow-overlay">
        <div className="ow-card ow-card--success">
          <div className="ow-success-icon"><CheckIcon /></div>
          <h2 className="ow-success-title">MyCrew 준비 완료!</h2>
          <p className="ow-success-subtitle">AI 팀이 배치되고 있습니다.<br />잠시 후 대시보드로 이동합니다.</p>
          <div className="ow-success-dots"><span /><span /><span /></div>
        </div>
        <style dangerouslySetInnerHTML={{ __html: wizardCSS }} />
      </div>
    );
  }

  return (
    <div className="ow-overlay">
      {/* 배경 장식 오브 */}
      <div className="ow-bg-orb ow-bg-orb--1" />
      <div className="ow-bg-orb ow-bg-orb--2" />

      <div className="ow-card">
        {/* 진행 바 */}
        <div className="ow-progress-bar">
          <div className="ow-progress-fill" style={{ width: `${(step / 3) * 100}%` }} />
        </div>

        {/* 상단 행 */}
        <div className="ow-top-row">
          {showBack ? (
            <button className="ow-back-btn" onClick={handleBack} disabled={loading} aria-label="뒤로 가기">
              <Icon name="arrow_back" size="1.1rem" />
            </button>
          ) : (
            <div className="ow-logo-mark">
              <Icon name="hub" size="1.1rem" />
            </div>
          )}
          <span className="ow-step-chip">STEP {step} OF 3</span>
        </div>

        {/* 컨텐츠 래퍼 — key 변경 시 animation 자동 재시작 → 깜빡임 없음 */}
        <div
          key={animKey}
          className={`ow-content-wrap ${animDir === 'forward' ? 'ow-anim-in-fwd' : 'ow-anim-in-bwd'}`}
        >
          {/* 헤더 */}
          <div className="ow-header">
            <h1 className="ow-title">
              {step === 1 && '팀의 이름을 정해주세요'}
              {step === 2 && step2Title()}
              {step === 3 && '당신의 AI 팀 목표는?'}
            </h1>
            <p className="ow-subtitle">
              {step === 1 && '입력하신 팀명은 추후 고유한 접속 URL로 사용됩니다.'}
              {step === 2 && step2Subtitle()}
              {step === 3 && '목표에 맞춰 가장 유능한 에이전트들이 자동으로 배치됩니다.'}
            </p>
          </div>

          {/* 바디 */}
          <div className="ow-body">

            {/* ── STEP 1: 팀명 입력 ── */}
            {step === 1 && (
              <div className="ow-input-group">
                <input
                  ref={inputRef}
                  id="ws-name-input"
                  type="text"
                  className="ow-input ow-input--lg"
                  placeholder="예: MyTeam, AcmeCorp..."
                  value={wsName}
                  onChange={(e) => setWsName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && canGoNext && handleNext()}
                  autoComplete="off"
                />
                <p className="ow-url-preview">
                  <Icon name="link" size="0.85rem" style={{ verticalAlign: 'middle', opacity: 0.5, marginRight: '0.3rem' }} />
                  {wsName.trim()
                    ? <><span className="ow-url-dim">https://mycrew.run/</span><span className="ow-url-hl">{wsName.trim().toLowerCase().replace(/\s+/g, '-')}</span></>
                    : <span className="ow-url-dim">https://mycrew.run/your-team</span>
                  }
                  <span className="ow-url-dim"> 으로 발급됩니다</span>
                </p>
              </div>
            )}

            {/* ── STEP 2-A: 연결 방식 선택 ── */}
            {step === 2 && !engineMode && (
              <div className="ow-engine-grid">
                <div className="ow-engine-card" onClick={() => handleEngineSelect('subscription')} role="button" tabIndex={0}>
                  <div className="ow-engine-card__badge">추천</div>
                  <div className="ow-engine-card__icon-wrap ow-engine-card__icon-wrap--sub">
                    <Icon name="workspace_premium" size="1.8rem" />
                  </div>
                  <h3 className="ow-engine-card__title">구독 연동</h3>
                  <p className="ow-engine-card__desc">모델 개별 구독 중<br />(Pro / Max 플랜)</p>
                  <div className="ow-engine-card__tags">
                    <span className="ow-tag">이중지출 없음</span>
                    <span className="ow-tag">구독 계정 연결</span>
                  </div>
                  <div className="ow-engine-card__arrow"><Icon name="arrow_forward" size="1rem" /></div>
                </div>

                <div className="ow-engine-card" onClick={() => handleEngineSelect('manual')} role="button" tabIndex={0}>
                  <div className="ow-engine-card__icon-wrap ow-engine-card__icon-wrap--key">
                    <Icon name="key" size="1.8rem" />
                  </div>
                  <h3 className="ow-engine-card__title">개인 API 키</h3>
                  <p className="ow-engine-card__desc">개별 키 직접 연결<br />(Pay-as-you-go)</p>
                  <div className="ow-engine-card__tags">
                    <span className="ow-tag">개발자</span>
                    <span className="ow-tag">파워유저</span>
                  </div>
                  <div className="ow-engine-card__arrow"><Icon name="arrow_forward" size="1rem" /></div>
                </div>
              </div>
            )}

            {/* ── STEP 2-B: 모델 제공사 선택 (NEW) ── */}
            {step === 2 && engineMode && !provider && (
              <div className="ow-provider-grid">
                {PROVIDERS.map((pv) => (
                  <div
                    key={pv.id}
                    className="ow-provider-card"
                    style={{ '--pv-accent': pv.accent, '--pv-glow': pv.glow }}
                    onClick={() => handleProviderSelect(pv.id)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="ow-provider-card__icon">
                      <Icon name={pv.logo} size="1.6rem" />
                    </div>
                    <div className="ow-provider-card__info">
                      <h3 className="ow-provider-card__title">{pv.name}</h3>
                      <div className="ow-provider-card__tags">
                        {(engineMode === 'subscription' ? pv.tagSub : pv.tagKey).map((t) => (
                          <span key={t} className="ow-tag">{t}</span>
                        ))}
                      </div>
                    </div>
                    <div className="ow-provider-card__arrow">
                      <Icon name="arrow_forward" size="1rem" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── STEP 2-C: 자격증명 입력 폼 ── */}
            {step === 2 && engineMode && provider && (
              <div className="ow-engine-form">
                {/* 선택 요약 뱃지 */}
                <div className="ow-breadcrumb">
                  <span className="ow-breadcrumb__item">
                    <Icon name={engineMode === 'subscription' ? 'workspace_premium' : 'key'} size="0.85rem" />
                    {engineMode === 'subscription' ? '구독 연동' : 'API 키'}
                  </span>
                  <Icon name="chevron_right" size="0.9rem" style={{ opacity: 0.4 }} />
                  <span className="ow-breadcrumb__item ow-breadcrumb__item--active"
                    style={{ '--pv-accent': currentProvider?.accent }}>
                    <Icon name={currentProvider?.logo || 'auto_awesome'} size="0.85rem" />
                    {currentProvider?.name}
                  </span>
                </div>

                <div className="ow-input-group">
                  <label className="ow-label">
                    {engineMode === 'manual' ? currentProvider?.keyLabel : '구독 중인 계정 이메일'}
                  </label>
                  <div className="ow-input-row">
                    <input
                      id="engine-input"
                      type={engineMode === 'manual' ? 'password' : 'email'}
                      className={`ow-input ow-input--engine ${testStatus === 'success' ? 'ow-input--success' : testStatus === 'error' ? 'ow-input--error' : ''}`}
                      placeholder={engineMode === 'manual' ? currentProvider?.keyPlaceholder : 'example@gmail.com'}
                      value={credValue}
                      onChange={(e) => {
                        if (engineMode === 'manual') setApiKey(e.target.value);
                        else setSubEmail(e.target.value);
                        if (testStatus) setTestStatus(null);
                      }}
                      disabled={testStatus === 'success'}
                      autoFocus
                      autoComplete="off"
                    />
                    <button
                      id="test-btn"
                      className={`ow-test-btn ${testStatus || ''}`}
                      onClick={testConnection}
                      disabled={testStatus === 'testing' || testStatus === 'success' || !credValue.trim()}
                    >
                      {testStatus === 'testing' && <span className="ow-spinner" />}
                      {testStatus === 'success' && <span className="ow-check-wrap"><CheckIcon /></span>}
                      {testStatus === 'error'   && <Icon name="refresh" size="1rem" />}
                      {!testStatus && 'Test'}
                    </button>
                  </div>

                  {testStatus === 'success' && (
                    <div className="ow-status-msg ow-status-msg--success">
                      <Icon name="check_circle" size="0.9rem" />
                      연동 완료! 다음 단계로 진행해 주세요.
                    </div>
                  )}
                  {testStatus === 'error' && (
                    <div className="ow-status-msg ow-status-msg--error">
                      <Icon name="error" size="0.9rem" />
                      {testErrorMsg || '정보를 다시 확인해 주세요.'}
                    </div>
                  )}
                  {testStatus === 'testing' && (
                    <div className="ow-status-msg ow-status-msg--testing">
                      <Icon name="sync" size="0.9rem" style={{ animation: 'owSpin 1s linear infinite' }} />
                      연결 확인 중...
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── STEP 3: 팀 목표 선택 ── */}
            {step === 3 && (
              <div className="ow-team-grid">
                {TEAM_TYPES.map((opt) => (
                  <div
                    key={opt.id}
                    className={`ow-team-card ${teamType === opt.id ? 'ow-team-card--active' : ''}`}
                    style={{ '--team-accent': opt.accent, '--team-glow': opt.glow }}
                    onClick={() => setTeamType(opt.id)}
                    role="radio"
                    aria-checked={teamType === opt.id}
                    tabIndex={0}
                    onKeyDown={(e) => e.key === 'Enter' && setTeamType(opt.id)}
                  >
                    <div className="ow-team-card__check">{teamType === opt.id && <CheckIcon />}</div>
                    <div className="ow-team-card__icon"><Icon name={opt.icon} size="1.6rem" /></div>
                    <div>
                      <h4 className="ow-team-card__title">{opt.title}</h4>
                      <p className="ow-team-card__desc">{opt.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

          </div>{/* /ow-body */}
        </div>{/* /ow-content-wrap */}

        {/* 푸터 */}
        <div className="ow-footer">
          <button
            id="ow-next-btn"
            className={`ow-next-btn ${canGoNext && !loading ? 'ow-next-btn--active' : ''}`}
            onClick={handleNext}
            disabled={!canGoNext || loading || (step === 2 && (!engineMode || !provider))}
          >
            {loading ? (
              <><span className="ow-spinner ow-spinner--dark" />설정 중...</>
            ) : step === 3 ? (
              <><Icon name="rocket_launch" size="1.1rem" />MyCrew 시작하기</>
            ) : (
              <>다음 단계로<Icon name="arrow_forward" size="1.1rem" /></>
            )}
          </button>

          <div className="ow-dots">
            {[1, 2, 3].map((s) => (
              <span key={s} className={`ow-dot ${step === s ? 'ow-dot--active' : ''}`} />
            ))}
          </div>

          {/* 🛠️ DEV ONLY — 프로덕션 빌드에서는 완전히 사라짐 */}
          {import.meta.env.DEV && (
            <button
              className="ow-dev-skip"
              onClick={completeOnboarding}
              title="개발 모드 전용 — 프로덕션에서는 노출되지 않습니다"
            >
              🛠️ 개발자 모드 건너뛰기
            </button>
          )}
        </div>

      </div>{/* /ow-card */}

      <style dangerouslySetInnerHTML={{ __html: wizardCSS }} />
    </div>
  );
}

/* ─────────────────────────────────────────────────────────────
   인라인 CSS
───────────────────────────────────────────────────────────── */
const wizardCSS = `
  /* ── 키프레임 ──────────────────────────────────────────── */
  @keyframes owFadeSlideUp {
    from { opacity: 0; transform: translateY(18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes owFadeSlideDown {
    from { opacity: 0; transform: translateY(-18px); }
    to   { opacity: 1; transform: translateY(0); }
  }
  @keyframes owSpin {
    to { transform: rotate(360deg); }
  }
  @keyframes owPop {
    0%  { transform: scale(0.82); opacity: 0; }
    60% { transform: scale(1.04); opacity: 1; }
    100%{ transform: scale(1); }
  }
  @keyframes owOrbFloat {
    0%, 100% { transform: translateY(0) scale(1); }
    50%       { transform: translateY(-28px) scale(1.04); }
  }
  @keyframes owDotBlink {
    0%, 80%, 100% { opacity: 0.2; transform: scale(0.8); }
    40%            { opacity: 1;   transform: scale(1.1); }
  }
  @keyframes owProgressGlow {
    0%, 100% { box-shadow: 0 0 8px rgba(180,197,255,0.2); }
    50%       { box-shadow: 0 0 18px rgba(180,197,255,0.12); }
  }
  @keyframes owCheckPop {
    0%  { transform: scale(0) rotate(-20deg); opacity: 0; }
    60% { transform: scale(1.2) rotate(4deg); opacity: 1; }
    100%{ transform: scale(1) rotate(0); }
  }

  /* ── 오버레이 ────────────────────────────────────────── */
  .ow-overlay {
    position: fixed; inset: 0;
    background: var(--bg-base);
    display: flex; align-items: center; justify-content: center;
    padding: 1.5rem;
    z-index: 9999;
    overflow: hidden;
  }
  .ow-bg-orb {
    position: absolute; border-radius: 50%;
    filter: blur(80px); pointer-events: none;
    animation: owOrbFloat 8s ease-in-out infinite;
  }
  .ow-bg-orb--1 {
    width: 500px; height: 500px;
    background: radial-gradient(circle, rgba(180,197,255,0.07) 0%, transparent 70%);
    top: -150px; left: -150px;
  }
  .ow-bg-orb--2 {
    width: 400px; height: 400px;
    background: radial-gradient(circle, rgba(255,185,99,0.05) 0%, transparent 70%);
    bottom: -120px; right: -120px;
    animation-delay: -4s;
  }

  /* ── 카드 ────────────────────────────────────────────── */
  .ow-card {
    width: 100%; max-width: 520px;
    background: rgba(20,21,30,0.88);
    backdrop-filter: blur(24px) saturate(1.4);
    -webkit-backdrop-filter: blur(24px) saturate(1.4);
    border: 1px solid rgba(255,255,255,0.06);
    border-radius: 28px;
    padding: 0 0 2.5rem 0;
    box-shadow:
      0 40px 80px rgba(0,0,0,0.55),
      0 0 0 1px rgba(180,197,255,0.04) inset,
      0 1px 0 rgba(255,255,255,0.06) inset;
    position: relative; overflow: hidden;
    animation: owPop 0.5s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  .ow-card--success {
    display: flex; flex-direction: column; align-items: center;
    padding: 4rem 3rem; text-align: center;
    border-color: rgba(74,222,128,0.15);
  }

  /* ── 진행 바 ─────────────────────────────────────────── */
  .ow-progress-bar {
    position: absolute; top: 0; left: 0; right: 0; height: 3px;
    background: rgba(255,255,255,0.04); border-radius: 3px 3px 0 0;
  }
  .ow-progress-fill {
    height: 100%;
    background: linear-gradient(90deg, var(--brand-dim), var(--brand));
    transition: width 0.55s cubic-bezier(0.4,0,0.2,1);
    border-radius: inherit;
    animation: owProgressGlow 2.5s ease-in-out infinite;
  }

  /* ── 상단 행 ─────────────────────────────────────────── */
  .ow-top-row {
    display: flex; align-items: center; justify-content: space-between;
    padding: 1.8rem 2rem 0 2rem;
  }
  .ow-back-btn {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 10px;
    background: rgba(255,255,255,0.05);
    border: 1px solid rgba(255,255,255,0.06);
    color: var(--text-secondary); cursor: pointer; transition: all 0.18s;
  }
  .ow-back-btn:hover { background: rgba(255,255,255,0.09); color: var(--text-primary); }
  .ow-back-btn:disabled { opacity: 0.35; cursor: not-allowed; }
  .ow-logo-mark {
    display: flex; align-items: center; justify-content: center;
    width: 34px; height: 34px; border-radius: 10px;
    background: linear-gradient(135deg, var(--brand-dim), var(--brand));
    color: #090a0d;
  }
  .ow-step-chip {
    font-size: 0.68rem; font-weight: 700; letter-spacing: 0.12em;
    color: var(--brand); background: var(--brand-glow);
    border: 1px solid rgba(180,197,255,0.2);
    padding: 0.3rem 0.7rem; border-radius: 100px; text-transform: uppercase;
  }

  /* ── 컨텐츠 래퍼 (애니메이션 타깃) ─────────────────── */
  .ow-content-wrap { padding: 0; }
  .ow-anim-in-fwd  { animation: owFadeSlideUp   0.30s cubic-bezier(0.2,0,0,1) both; }
  .ow-anim-in-bwd  { animation: owFadeSlideDown 0.30s cubic-bezier(0.2,0,0,1) both; }

  /* ── 헤더 ────────────────────────────────────────────── */
  .ow-header { padding: 1.5rem 2rem 0 2rem; }
  .ow-title {
    font-size: clamp(1.3rem, 3vw, 1.6rem);
    font-weight: 800; letter-spacing: -0.02em;
    color: var(--text-primary); margin: 0 0 0.4rem 0; line-height: 1.2;
  }
  .ow-subtitle {
    font-size: 0.875rem; line-height: 1.6; color: var(--text-muted); margin: 0;
  }

  /* ── 바디 ────────────────────────────────────────────── */
  .ow-body { padding: 1.6rem 2rem 0 2rem; }

  /* ── 공통 인풋 ───────────────────────────────────────── */
  .ow-input-group { display: flex; flex-direction: column; gap: 0.5rem; }
  .ow-label {
    font-size: 0.75rem; font-weight: 600; letter-spacing: 0.05em;
    color: var(--text-secondary); text-transform: uppercase;
  }
  .ow-input {
    width: 100%; padding: 0.9rem 1.1rem;
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.08);
    border-radius: 14px; color: var(--text-primary);
    font-size: 0.95rem; outline: none; transition: all 0.2s; box-sizing: border-box;
  }
  .ow-input::placeholder { color: var(--text-muted); }
  .ow-input:focus {
    border-color: rgba(180,197,255,0.4);
    background: rgba(180,197,255,0.04);
    box-shadow: 0 0 0 3px rgba(180,197,255,0.08);
  }
  .ow-input--lg    { font-size: 1.1rem; padding: 1rem 1.2rem; font-weight: 600; }
  .ow-input--success { border-color: rgba(74,222,128,0.4) !important; background: rgba(74,222,128,0.04) !important; }
  .ow-input--error   { border-color: rgba(248,113,113,0.4) !important; background: rgba(248,113,113,0.04) !important; }

  /* URL 미리보기 */
  .ow-url-preview {
    font-size: 0.78rem; margin: 0.4rem 0 0 0;
    display: flex; align-items: center; flex-wrap: wrap; gap: 0.1em;
  }
  .ow-url-dim { color: var(--text-muted); }
  .ow-url-hl  { color: var(--brand); font-weight: 700; }

  /* ── STEP 2-A: 연결 방식 카드 ────────────────────────── */
  .ow-engine-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
  .ow-engine-card {
    position: relative; padding: 1.4rem; border-radius: 18px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
    cursor: pointer; transition: all 0.22s cubic-bezier(0.2,0,0,1);
    display: flex; flex-direction: column; gap: 0.5rem; outline: none;
    overflow: hidden;
  }
  .ow-engine-card::before {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, rgba(180,197,255,0.05) 0%, transparent 60%);
    opacity: 0; transition: opacity 0.22s;
  }
  .ow-engine-card:hover { border-color: rgba(180,197,255,0.3); transform: translateY(-4px); }
  .ow-engine-card:hover::before { opacity: 1; }
  .ow-engine-card:hover .ow-engine-card__arrow { opacity: 1; transform: translateX(3px); }
  .ow-engine-card__badge {
    position: absolute; top: 0.7rem; right: 0.7rem;
    font-size: 0.62rem; font-weight: 800; letter-spacing: 0.08em;
    color: #090a0d; background: var(--brand);
    padding: 0.18rem 0.5rem; border-radius: 100px; text-transform: uppercase;
  }
  .ow-engine-card__icon-wrap {
    width: 44px; height: 44px; border-radius: 12px;
    display: flex; align-items: center; justify-content: center; margin-bottom: 0.3rem;
  }
  .ow-engine-card__icon-wrap--sub { background: rgba(180,197,255,0.1); color: var(--brand); }
  .ow-engine-card__icon-wrap--key { background: rgba(255,185,99,0.1);  color: var(--status-active); }
  .ow-engine-card__title { font-size: 0.92rem; font-weight: 700; margin: 0; color: var(--text-primary); }
  .ow-engine-card__desc  { font-size: 0.75rem; color: var(--text-muted); margin: 0; line-height: 1.4; }
  .ow-engine-card__tags  { display: flex; flex-wrap: wrap; gap: 0.3rem; margin-top: 0.2rem; }
  .ow-engine-card__arrow { color: var(--text-muted); opacity: 0; transition: all 0.22s; margin-top: auto; }

  /* ── STEP 2-B: 제공사 선택 카드 (NEW) ──────────────── */
  .ow-provider-grid { display: flex; flex-direction: column; gap: 0.75rem; }
  .ow-provider-card {
    display: flex; align-items: center; gap: 1rem;
    padding: 1rem 1.2rem; border-radius: 16px;
    border: 1px solid rgba(255,255,255,0.07);
    background: rgba(255,255,255,0.03);
    cursor: pointer; transition: all 0.22s cubic-bezier(0.2,0,0,1);
    outline: none; position: relative; overflow: hidden;
  }
  .ow-provider-card::after {
    content: ''; position: absolute; inset: 0;
    background: linear-gradient(135deg, var(--pv-glow, rgba(180,197,255,0.06)) 0%, transparent 70%);
    opacity: 0; transition: opacity 0.22s;
  }
  .ow-provider-card:hover {
    border-color: var(--pv-accent, var(--brand));
    transform: translateX(4px);
    box-shadow: 0 0 20px var(--pv-glow, rgba(180,197,255,0.1));
  }
  .ow-provider-card:hover::after { opacity: 1; }
  .ow-provider-card:hover .ow-provider-card__arrow { opacity: 1; transform: translateX(3px); }
  .ow-provider-card__icon {
    width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05);
    color: var(--pv-accent, var(--brand));
    position: relative; z-index: 1;
    transition: background 0.2s;
  }
  .ow-provider-card:hover .ow-provider-card__icon { background: var(--pv-glow, rgba(180,197,255,0.1)); }
  .ow-provider-card__info { flex: 1; position: relative; z-index: 1; }
  .ow-provider-card__title { font-size: 0.95rem; font-weight: 700; margin: 0 0 0.35rem 0; color: var(--text-primary); }
  .ow-provider-card__tags  { display: flex; flex-wrap: wrap; gap: 0.3rem; }
  .ow-provider-card__arrow {
    color: var(--text-muted); opacity: 0;
    transition: all 0.22s; flex-shrink: 0; position: relative; z-index: 1;
  }

  /* ── STEP 2-C: 자격증명 폼 ──────────────────────────── */
  .ow-engine-form { display: flex; flex-direction: column; gap: 1.2rem; }

  /* 브레드크럼 */
  .ow-breadcrumb {
    display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;
    font-size: 0.75rem;
  }
  .ow-breadcrumb__item {
    display: inline-flex; align-items: center; gap: 0.3rem;
    color: var(--text-muted);
    background: rgba(255,255,255,0.04);
    border: 1px solid rgba(255,255,255,0.06);
    padding: 0.25rem 0.6rem; border-radius: 100px; font-weight: 500;
  }
  .ow-breadcrumb__item--active {
    color: var(--pv-accent, var(--brand));
    background: rgba(255,255,255,0.06);
    border-color: rgba(255,255,255,0.1);
  }

  .ow-input-row { display: flex; gap: 0.6rem; align-items: center; margin-top: 0.5rem; }
  .ow-input--engine { flex: 1; }

  /* Test 버튼 */
  .ow-test-btn {
    flex-shrink: 0; min-width: 76px; height: 48px; padding: 0 1rem;
    border-radius: 12px; border: 1px solid rgba(255,255,255,0.1);
    background: rgba(255,255,255,0.05); color: var(--text-primary);
    font-size: 0.82rem; font-weight: 600; cursor: pointer; transition: all 0.2s;
    display: flex; align-items: center; justify-content: center; gap: 0.4rem;
  }
  .ow-test-btn:hover:not(:disabled) {
    background: rgba(180,197,255,0.1); border-color: rgba(180,197,255,0.35); color: var(--brand);
  }
  .ow-test-btn:disabled { opacity: 0.45; cursor: not-allowed; }
  .ow-test-btn.success {
    background: rgba(74,222,128,0.1); border-color: rgba(74,222,128,0.35); color: #4ade80;
    animation: owCheckPop 0.4s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  .ow-test-btn.error  { background: rgba(248,113,113,0.1); border-color: rgba(248,113,113,0.3); color: #f87171; }
  .ow-test-btn.testing { cursor: wait; }
  .ow-check-wrap { display: flex; align-items: center; }

  /* 상태 메시지 */
  .ow-status-msg {
    display: flex; align-items: center; gap: 0.4rem;
    font-size: 0.78rem; font-weight: 500; margin-top: 0.5rem;
    animation: owFadeSlideUp 0.25s ease both;
  }
  .ow-status-msg--success { color: #4ade80; }
  .ow-status-msg--error   { color: #f87171; }
  .ow-status-msg--testing { color: var(--text-muted); }

  /* 공용 태그 */
  .ow-tag {
    font-size: 0.67rem; padding: 0.15rem 0.45rem; border-radius: 6px;
    background: rgba(255,255,255,0.05); color: var(--text-muted);
    border: 1px solid rgba(255,255,255,0.06);
  }

  /* ── STEP 3: 팀 타입 ─────────────────────────────────── */
  .ow-team-grid { display: flex; flex-direction: column; gap: 0.75rem; }
  .ow-team-card {
    position: relative; display: flex; align-items: center; gap: 1rem;
    padding: 1rem 1.2rem; background: rgba(255,255,255,0.03);
    border: 1px solid rgba(255,255,255,0.07); border-radius: 16px;
    cursor: pointer; transition: all 0.22s cubic-bezier(0.2,0,0,1); outline: none;
  }
  .ow-team-card:hover { border-color: rgba(255,255,255,0.14); transform: translateX(4px); }
  .ow-team-card--active {
    border-color: var(--team-accent, var(--brand)) !important;
    box-shadow: 0 0 0 1px var(--team-accent, var(--brand)),
                0 0 20px var(--team-glow, var(--brand-glow)),
                inset 0 0 30px var(--team-glow, var(--brand-glow));
  }
  .ow-team-card__check {
    position: absolute; top: 0.75rem; right: 0.9rem;
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid rgba(255,255,255,0.12);
    display: flex; align-items: center; justify-content: center;
    color: var(--team-accent, var(--brand)); transition: all 0.2s;
  }
  .ow-team-card--active .ow-team-card__check {
    border-color: var(--team-accent, var(--brand));
    background: var(--team-glow, var(--brand-glow));
    animation: owCheckPop 0.35s cubic-bezier(0.34,1.56,0.64,1) both;
  }
  .ow-team-card__icon {
    width: 44px; height: 44px; border-radius: 12px; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    background: rgba(255,255,255,0.05); color: var(--team-accent, var(--brand));
    transition: background 0.2s;
  }
  .ow-team-card--active .ow-team-card__icon { background: var(--team-glow, var(--brand-glow)); }
  .ow-team-card__title { font-size: 0.92rem; font-weight: 700; margin: 0 0 0.2rem 0; color: var(--text-primary); }
  .ow-team-card__desc  { font-size: 0.75rem; color: var(--text-muted); margin: 0; line-height: 1.35; }

  /* ── 푸터 ────────────────────────────────────────────── */
  .ow-footer {
    padding: 2rem 2rem 0 2rem;
    display: flex; flex-direction: column; gap: 1.2rem; align-items: center;
  }
  .ow-next-btn {
    width: 100%; padding: 0.95rem 1.5rem; border-radius: 14px; border: none;
    cursor: pointer; font-size: 0.95rem; font-weight: 700; letter-spacing: 0.01em;
    display: flex; align-items: center; justify-content: center; gap: 0.5rem;
    background: rgba(255,255,255,0.06); color: var(--text-muted);
    border: 1px solid rgba(255,255,255,0.06);
    transition: all 0.25s cubic-bezier(0.2,0,0,1);
  }
  .ow-next-btn--active {
    background: linear-gradient(135deg, #678bf7 0%, #b4c5ff 100%);
    color: #090a0d; border-color: transparent;
    box-shadow: 0 8px 30px rgba(103,139,247,0.35), 0 2px 8px rgba(0,0,0,0.3);
  }
  .ow-next-btn--active:hover {
    transform: translateY(-2px);
    box-shadow: 0 12px 40px rgba(103,139,247,0.45), 0 2px 8px rgba(0,0,0,0.3);
  }
  .ow-next-btn--active:active { transform: translateY(0); }
  .ow-next-btn:disabled:not(.ow-next-btn--active) { cursor: not-allowed; }

  .ow-dots { display: flex; gap: 0.4rem; align-items: center; }
  .ow-dot {
    width: 6px; height: 6px; border-radius: 50%;
    background: rgba(255,255,255,0.12); transition: all 0.3s;
  }
  .ow-dot--active { width: 20px; border-radius: 4px; background: var(--brand); box-shadow: 0 0 8px var(--brand-glow); }

  /* 🛠️ DEV ONLY 스킵 버튼 */
  .ow-dev-skip {
    background: none; border: none; cursor: pointer;
    font-size: 0.72rem; color: var(--text-muted);
    opacity: 0.45; padding: 0.2rem 0.5rem; border-radius: 6px;
    transition: opacity 0.18s;
    font-family: inherit; letter-spacing: 0.02em;
  }
  .ow-dev-skip:hover { opacity: 0.85; }

  /* ── 스피너 ──────────────────────────────────────────── */
  .ow-spinner {
    display: inline-block; width: 16px; height: 16px;
    border: 2px solid rgba(255,255,255,0.2); border-top-color: currentColor;
    border-radius: 50%; animation: owSpin 0.75s linear infinite; flex-shrink: 0;
  }
  .ow-spinner--dark { border-color: rgba(9,10,13,0.2); border-top-color: #090a0d; }

  /* ── 성공 화면 ───────────────────────────────────────── */
  .ow-success-icon {
    width: 72px; height: 72px; border-radius: 50%;
    background: rgba(74,222,128,0.12); border: 2px solid rgba(74,222,128,0.3);
    display: flex; align-items: center; justify-content: center; color: #4ade80;
    margin-bottom: 1.5rem;
    animation: owCheckPop 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.1s both;
    box-shadow: 0 0 30px rgba(74,222,128,0.2);
  }
  .ow-success-icon svg { width: 32px; height: 32px; }
  .ow-success-title {
    font-size: 1.5rem; font-weight: 800; margin: 0 0 0.6rem 0; color: var(--text-primary);
    animation: owFadeSlideUp 0.4s 0.3s both;
  }
  .ow-success-subtitle {
    font-size: 0.875rem; color: var(--text-muted); margin: 0 0 2rem 0; line-height: 1.6;
    animation: owFadeSlideUp 0.4s 0.45s both;
  }
  .ow-success-dots { display: flex; gap: 0.5rem; animation: owFadeSlideUp 0.4s 0.6s both; }
  .ow-success-dots span { width: 8px; height: 8px; border-radius: 50%; background: var(--brand); }
  .ow-success-dots span:nth-child(1) { animation: owDotBlink 1.2s 0.0s ease-in-out infinite; }
  .ow-success-dots span:nth-child(2) { animation: owDotBlink 1.2s 0.2s ease-in-out infinite; }
  .ow-success-dots span:nth-child(3) { animation: owDotBlink 1.2s 0.4s ease-in-out infinite; }

  /* ── 반응형 ──────────────────────────────────────────── */
  @media (max-width: 480px) {
    .ow-card { border-radius: 20px; }
    .ow-engine-grid { grid-template-columns: 1fr; }
    .ow-title { font-size: 1.25rem; }
  }
`;
