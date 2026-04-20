// src/components/Views/VideoLabView.jsx
// 🎬 Video Lab Studio — Phase 1: Remotion Training Environment
// ImageLabView v2 패턴 완전 계승 | 4열 풀스크린 | Auto-Loop 자기학습
// Luca 백엔드 인프라 위에 올라가는 순수 프론트엔드 컴포넌트
// Sonnet 작성 | 2026-04-20

import { useState, useRef, useCallback, useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

// ── A. 비디오 템플릿 프리셋 ─────────────────────────────────────────────────
const VIDEO_PRESETS = [
  {
    id: 'reels-30',
    label: '소시안 30초 릴스',
    icon: '🎬',
    templateId: 'socian-reels',
    basePrompt: `다음 문구를 사용해서 인스타그램 DM 자동화 솔루션을 파는 숏폼 릴스를 만들어줘.
1. 훅: "댓글 문의, 매출로 연결하는 방법"
2. 솔루션: "제품링크/문의, DM 자동화로 해결하세요."
3. 소구점: 업계최저가, 2900원
4. CTA: "최고" 댓글 달고, 시크릿 무료 쿠폰 받기`,
  },
  {
    id: 'motion-simple',
    label: '심플 모션 그래픽',
    icon: '✨',
    templateId: 'motion-graphic',
    desc: '클린 모션 타이포그래피',
    basePrompt: 'Create a clean motion graphic video with minimal typography animation. Smooth text fade-in effects, brand color palette, and professional timing cues.',
  },
  {
    id: 'brand-intro',
    label: '브랜드 인트로',
    icon: '🏷️',
    templateId: 'brand-intro',
    desc: '3~5초 로고 스팅어',
    basePrompt: 'Create a 5-second brand intro sting with logo reveal animation, whoosh sound cue marker, and brand gradient background. Punchy and memorable.',
  },
  {
    id: 'reels-highlight',
    label: '릴스 하이라이트',
    icon: '⚡',
    templateId: 'highlight-reel',
    desc: '에너지 넘치는 하이라이트',
    basePrompt: 'Create a high-energy highlight reel with rapid cuts, kinetic text effects, neon accent colors, and trending social media-style captions with emoji overlays.',
  },
  {
    id: 'custom',
    label: '커스텀',
    icon: '✏️',
    templateId: 'custom',
    desc: '자유 프롬프트 입력',
    basePrompt: '',
  },
];

// ── B. 무작위 마케팅 시나리오 배열 (다양성 훈련용) ──────────────────────────
const RANDOM_SCENARIOS = [
  // 1. 기존 B2B 자동화 (이성적/수치적 어조)
  `다음 문구를 사용해서 인스타그램 DM 자동화 솔루션을 파는 숏폼 릴스를 만들어줘.
1. 훅: "댓글 문의, 매출로 연결하는 방법"
2. 솔루션: "제품링크/문의, DM 자동화로 해결하세요."
3. 소구점: 업계최저가, 2900원
4. CTA: "최고" 댓글 달고, 시크릿 무료 쿠폰 받기`,

  // 2. 이커머스 패션 프로모션 (감각적/트렌디 어조)
  `다음 문구를 사용해서 패션 이커머스 신상 니트를 파는 숏폼 릴스를 만들어줘.
1. 훅: "지금 안 입으면 품절각! 여리여리 오프숄더"
2. 솔루션: "어깨라인 완벽 커버, 슬림핏 자동 연출"
3. 소구점: 1+1 특별 할인, 오늘 출발 무료배송
4. CTA: 링크 클릭하고 코디 좌표 바로 확인하기`,

  // 3. 다이어트/건강기능식품 앱 홍보 (시급성/감성적 어조)
  `다음 문구를 사용해서 다이어트 식단 관리 앱을 홍보하는 틱톡 영상을 만들어줘.
1. 훅: "여름 3주 남았는데 아직도 고민만 해?"
2. 솔루션: "AI가 내 체형에 맞춰 짜주는 초간단 식단표"
3. 소구점: 4주 평균 3kg 감량 성공률 87%
4. CTA: "도전" 댓글 달고 1개월 무료 VIP 리포트 받기`
];

// ── C. 5차원 비디오 평가 루브릭 ─────────────────────────────────────────────
const VIDEO_RUBRIC = [
  { id: 'timing',      label: '타이밍',      icon: 'timer',       desc: '컷 타이밍, 시간 흐름 자연스러움' },
  { id: 'readability', label: '자막 가독성', icon: 'text_fields', desc: '폰트, 크기, 색상 대비' },
  { id: 'trend',       label: '트렌드',      icon: 'trending_up', desc: '현재 릴스/쇼츠 트렌드 적합도' },
  { id: 'motion',      label: '모션 품질',   icon: 'animation',   desc: '애니메이션 부드러움, 이징' },
  { id: 'brand',       label: '브랜드',      icon: 'verified',    desc: '소시안 브랜드 아이덴티티 일치도' },
];

// ── 별점 컴포넌트 ────────────────────────────────────────────────────────────
function StarRating({ value, onChange, dimId, disabled }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          id={`videolab-star-${dimId}-${star}`}
          onClick={() => !disabled && onChange(star)}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          disabled={disabled}
          aria-label={`${star}점`}
          style={{
            background: 'none', border: 'none',
            cursor: disabled ? 'not-allowed' : 'pointer',
            padding: '1px',
            color: star <= (hovered || value) ? '#F9CE34' : 'rgba(255,255,255,0.12)',
            fontSize: '1.1rem', transition: 'all 0.1s', lineHeight: 1,
            opacity: disabled ? 0.4 : 1,
          }}
        >★</button>
      ))}
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px', fontFamily: 'Space Grotesk' }}>
        {value > 0 ? `${value}/5` : '—'}
      </span>
    </div>
  );
}

// ── 렌더링 오버레이 (Remotion 렌더링 대기) ──────────────────────────────────
function RenderingOverlay() {
  const [elapsed, setElapsed] = useState(0);
  const [phase, setPhase] = useState(0);
  const phases = [
    { text: 'Gemini Props 생성 중', icon: '🧠' },
    { text: 'Remotion 컴파일 시작', icon: '⚙️' },
    { text: '프레임 렌더링 중',    icon: '🎞️' },
    { text: 'MP4 인코딩 중',      icon: '🎬' },
    { text: '파일 최종화 중',      icon: '✅' },
  ];

  useEffect(() => {
    const tick = setInterval(() => setElapsed(s => s + 1), 1000);
    const phaseTimer = setInterval(() => setPhase(p => Math.min(p + 1, phases.length - 1)), 6000);
    return () => { clearInterval(tick); clearInterval(phaseTimer); };
  }, []);

  const progress = Math.min((elapsed / 30) * 100, 95);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'rgba(6,8,16,0.92)',
      backdropFilter: 'blur(12px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '2rem',
      borderRadius: '12px',
    }}>
      {/* 중심 애니메이션 */}
      <div style={{ position: 'relative', width: '100px', height: '100px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: `${i * 12}px`,
            borderRadius: '50%',
            border: `2px solid rgba(${i === 0 ? '238,42,123' : i === 1 ? '100,100,246' : '249,206,52'},${0.7 - i * 0.2})`,
            animation: `vlab-ring-spin ${1.8 + i * 0.6}s linear ${i % 2 === 0 ? '' : 'reverse'} infinite`,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', animation: 'vlab-bounce 1.5s ease-in-out infinite',
        }}>
          {phases[phase].icon}
        </div>
      </div>

      {/* 상태 텍스트 */}
      <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{
          fontSize: '1.05rem', fontWeight: 700,
          color: '#b4c5ff', fontFamily: 'Space Grotesk, sans-serif',
          animation: 'vlab-fade-cycle 6s ease-in-out infinite',
        }}>
          {phases[phase].text}...
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Remotion 렌더링 엔진 가동 중 ({elapsed}초 경과)
        </div>
      </div>

      {/* 진행바 */}
      <div style={{ width: '260px', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.65rem', color: 'var(--text-muted)' }}>
          <span style={{ fontFamily: 'Space Grotesk' }}>렌더링 진행률</span>
          <span style={{ color: '#b4c5ff', fontWeight: 700 }}>{Math.round(progress)}%</span>
        </div>
        <div style={{
          height: '5px', background: 'rgba(255,255,255,0.06)',
          borderRadius: '3px', overflow: 'hidden',
        }}>
          <div style={{
            height: '100%', borderRadius: '3px',
            width: `${progress}%`,
            background: 'linear-gradient(90deg, #EE2A7B, #6464F6, #F9CE34)',
            backgroundSize: '200% 100%',
            animation: 'vlab-progress-shimmer 2s linear infinite',
            transition: 'width 1s ease',
          }} />
        </div>
        <div style={{ fontSize: '0.62rem', color: 'rgba(255,255,255,0.2)', fontFamily: 'Space Grotesk', textAlign: 'center' }}>
          약 10~30초 소요 · 창을 닫지 마세요
        </div>
      </div>

      <style>{`
        @keyframes vlab-ring-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes vlab-bounce {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.15); }
        }
        @keyframes vlab-fade-cycle {
          0%, 90%, 100% { opacity: 1; }
          45%, 55%      { opacity: 0.5; }
        }
        @keyframes vlab-progress-shimmer {
          0%   { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ── 비디오 플레이어 컴포넌트 ─────────────────────────────────────────────────
function VideoPlayer({ url, isGenerating }) {
  const videoRef = useRef(null);

  // 새 URL 로드 시 재생 강제
  useEffect(() => {
    if (url && videoRef.current) {
      videoRef.current.load();
      videoRef.current.play().catch(() => {});
    }
  }, [url]);

  if (!url && !isGenerating) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1rem', color: 'var(--text-muted)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: '4.5rem', opacity: 0.08 }}>movie</span>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: 600, opacity: 0.4, marginBottom: '0.3rem' }}>렌더링 대기 중</div>
          <div style={{ fontSize: '0.72rem', opacity: 0.28, lineHeight: 1.7 }}>
            프롬프트를 선택하고<br />생성 버튼을 누르거나<br />Auto 모드를 활성화하세요
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1.5rem', position: 'relative', overflow: 'hidden' }}>
      {isGenerating && <RenderingOverlay />}
      {url && (
        <video
          ref={videoRef}
          // ❗️ 캐시 브레이킹: 타임스탬프 쿼리 파라미터 강제 주입
          src={`${SERVER_URL}${url}?t=${Date.now()}`}
          autoPlay
          loop
          controls
          playsInline
          style={{
            maxWidth: '100%', maxHeight: '100%',
            borderRadius: '14px',
            boxShadow: '0 12px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(255,255,255,0.05)',
            objectFit: 'contain',
            background: '#000',
          }}
        />
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// 🎬 메인 컴포넌트: VideoLabView
// ══════════════════════════════════════════════════════════════════════════════
export default function VideoLabView() {
  const { setLogPanelOpen, setCurrentView } = useUiStore();
  useEffect(() => { setLogPanelOpen(false); }, []);

  // ─ 프리셋 & 설정
  const [selectedPreset, setSelectedPreset]   = useState('reels-30');
  const [durationSec,    setDurationSec]      = useState(30);
  const [creativityPct,  setCreativityPct]    = useState(50);

  // ─ 프롬프트
  const [prompt,       setPrompt]       = useState('');
  const [isEditingPrompt, setIsEditingPrompt] = useState(false);
  const [inlineEdit,   setInlineEdit]   = useState('');

  // ─ 생성 히스토리
  const [history,      setHistory]      = useState([]);   // { videoUrl, props }[]
  const [historyIndex, setHistoryIndex] = useState(-1);
  const currentEntry = history[historyIndex] ?? null;

  // ─ 로딩 상태
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLearning,   setIsLearning]   = useState(false);
  const [isAutoLooping, setIsAutoLooping] = useState(false); // 2초 디바운스 대기

  // ─ AUTO / MANUAL 토글
  const [isAutoMode, setIsAutoMode] = useState(true);

  // ─ 5D 평가
  const [scores, setScores] = useState({ timing: 0, readability: 0, trend: 0, motion: 0, brand: 0 });
  const [memo,   setMemo]   = useState('');

  // ─ 학습 결과 & 알림
  const [learnResult,  setLearnResult]  = useState(null);
  const [toastMsg,     setToastMsg]     = useState('');
  const [toastType,    setToastType]    = useState('error'); // 'error' | 'winner'
  const [winnerCount,  setWinnerCount]  = useState(0);

  // ─ 현재 프리셋 객체
  const currentPreset = VIDEO_PRESETS.find(p => p.id === selectedPreset) || VIDEO_PRESETS[0];

  // ─ 평균 점수
  const avgScore = (() => {
    const vals = Object.values(scores).filter(v => v > 0);
    return vals.length > 0 ? (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1) : null;
  })();
  const scoreColor = avgScore >= 4 ? '#4ade80' : avgScore >= 3 ? '#F9CE34' : '#ff5449';

  // ── 프리셋 선택 시 기본 프롬프트 세팅 ────────────────────────────────────
  const handleSelectPreset = (preset) => {
    setSelectedPreset(preset.id);
    if (preset.id !== 'custom' && !isEditingPrompt) {
      setPrompt(preset.basePrompt);
    } else if (preset.id === 'custom') {
      setIsEditingPrompt(true);
    }
  };

  // ── 토스트 헬퍼 ──────────────────────────────────────────────────────────
  const showToast = useCallback((msg, type = 'error', duration = 4000) => {
    setToastMsg(msg);
    setToastType(type);
    setTimeout(() => setToastMsg(''), duration);
  }, []);

  // ── Step 1: 영상 생성 ────────────────────────────────────────────────────
  const handleGenerate = useCallback(async (overridePrompt = '', overrideOptions = null) => {
    const finalPrompt = overridePrompt.trim() || prompt.trim();
    if (!finalPrompt || isGenerating) return;

    const finalTemplateId = overrideOptions?.templateId || currentPreset.templateId;
    const finalCreativity = overrideOptions?.creativityPct ?? creativityPct;
    const finalDuration   = overrideOptions?.durationSec ?? durationSec;

    setIsGenerating(true);
    setLearnResult(null);
    setScores({ timing: 0, readability: 0, trend: 0, motion: 0, brand: 0 });
    setMemo('');

    try {
      const res = await fetch(`${SERVER_URL}/api/videolab/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: finalPrompt,
          templateId: finalTemplateId,
          durationSec: finalDuration,
          creativityPct: finalCreativity,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        // 504 Timeout 특별 처리
        if (res.status === 504 || res.status === 408) {
          throw new Error('504_TIMEOUT');
        }
        throw new Error(data.error || '생성 실패');
      }

      const newEntry = { videoUrl: data.videoUrl, generatedProps: data.generatedProps };
      setHistory(prev => {
        const next = [...prev.slice(0, historyIndex + 1), newEntry];
        setHistoryIndex(next.length - 1);
        return next;
      });
      setInlineEdit('');

    } catch (err) {
      if (err.message === '504_TIMEOUT') {
        showToast('⚠️ 렌더링 시간이 지연되었습니다. 서버가 여전히 처리 중일 수 있습니다.', 'error', 6000);
      } else {
        showToast(`⚠️ 생성 오류: ${err.message}`);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, isGenerating, currentPreset, durationSec, creativityPct, historyIndex, showToast]);

  // ── Step 2: 학습 반영 ───────────────────────────────────────────────────
  const handleLearn = useCallback(async () => {
    if (!avgScore || !currentEntry || isLearning) return;
    setIsLearning(true);
    setLearnResult(null);

    try {
      const res = await fetch(`${SERVER_URL}/api/videolab/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          score:         parseFloat(avgScore),
          scores,
          memo:          memo.trim(),
          videoUrl:      currentEntry.videoUrl,
          generatedProps: currentEntry.generatedProps,
          promptUsed:    prompt,
          templateId:    currentPreset.templateId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '학습 저장 실패');

      setLearnResult('ok');

      if (data.winnerSaved) {
        const cnt = (winnerCount + 1);
        setWinnerCount(cnt);
        showToast(
          `🏆 Winner #${cnt} 보관 완료! (${cnt}/25 수집${cnt >= 25 ? ' → Remotion 패턴 체화 완료!' : ''})`,
          'winner', 5000
        );
      }

    } catch (err) {
      setLearnResult('error');
      showToast(`⚠️ 학습 오류: ${err.message}`);
    } finally {
      setIsLearning(false);
    }
  }, [avgScore, currentEntry, isLearning, scores, memo, prompt, currentPreset, winnerCount, showToast]);

  // ── Auto-Loop 디바운서: '모든 등급' 평가 완료 시 → 2초 후 학습 + 풀 랜덤 재생성 ─────────────────
  useEffect(() => {
    if (!isAutoMode) return;
    if (!currentEntry || learnResult === 'ok' || isLearning || isGenerating) return;
    
    // 첫 항목만 누르는 실수를 막기 위해, 5개 루브릭 전체 평가가 끝나야 타이머가 돕니다.
    const isFullyScored = Object.values(scores).every(v => v > 0);
    if (!isFullyScored) return;

    setIsAutoLooping(true);

    const timer = setTimeout(async () => {
      setIsAutoLooping(false);
      await handleLearn();
      
      // Auto-loop 시 학습 데이터의 다양성을 극대화하기 위해 완전 무작위 환경을 주입합니다.
      const rp = RANDOM_SCENARIOS[Math.floor(Math.random() * RANDOM_SCENARIOS.length)];
      const rPreset = VIDEO_PRESETS[Math.floor(Math.random() * VIDEO_PRESETS.length)];
      const rCreativity = Math.floor(Math.random() * 80) + 10; // 10% ~ 90%
      const rDuration = [15, 30, 45, 60][Math.floor(Math.random() * 4)];
      
      // 화면 UI(슬라이더 등)도 바뀌어 보이도록 상태 동기화 (다음 렌더링에 반영됨)
      setPrompt(rp);
      setIsEditingPrompt(true);
      setSelectedPreset(rPreset.id);
      setCreativityPct(rCreativity);
      setDurationSec(rDuration);

      // 학습 완료 후 자동 재생성 (인라인 피드백 메모 힌트 포함)
      const nextHint = memo.trim()
        ? `${rp}. User feedback: ${memo.trim()}`
        : rp;
        
      await handleGenerate(nextHint, {
        templateId: rPreset.templateId,
        creativityPct: rCreativity,
        durationSec: rDuration
      });
    }, 2000);

    return () => {
      clearTimeout(timer);
      setIsAutoLooping(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, isAutoMode, currentEntry]);

  // ── 프리셋 초기값 세팅 ───────────────────────────────────────────────────
  useEffect(() => {
    if (!prompt && currentPreset.basePrompt) {
      setPrompt(currentPreset.basePrompt);
    }
  }, []);

  // ── 렌더링 중 패널 잠금 여부
  const isLocked = isGenerating;

  // ══════════════════════════════════════════════════════════════════════════
  // JSX 렌더
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
    }}>

      {/* ══ 탑바 ══════════════════════════════════════════════════════════════ */}
      <div style={{
        height: '52px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem', gap: '0.75rem',
        background: 'rgba(255,255,255,0.02)',
      }}>
        {/* 돌아가기 */}
        <button
          id="videolab-back-btn"
          onClick={() => setCurrentView('projects')}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: '7px', padding: '4px 10px',
            cursor: 'pointer', color: 'var(--text-secondary)',
            fontSize: '0.78rem', fontWeight: 500,
            transition: 'all 0.15s', marginRight: '0.25rem',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>arrow_back</span>
          대시보드
        </button>

        <div style={{ width: '1px', height: '18px', background: 'var(--border)', marginRight: '0.25rem' }} />

        <span style={{ fontSize: '1.1rem' }}>🎬</span>
        <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'Space Grotesk, sans-serif' }}>Video Lab</span>
        <span style={{
          fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
          padding: '2px 6px', borderRadius: '4px',
          background: 'rgba(238,42,123,0.2)', color: '#f472b6',
        }}>PHASE 1</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk' }}>
          Remotion 패턴 트레이닝 · Gemini 2.0 Pro 자동 훈련 루프
        </span>

        {/* 토스트 배너 */}
        {toastMsg && (
          <span style={{
            marginLeft: '0.5rem', fontSize: '0.75rem',
            color:      toastType === 'winner' ? '#ffd700' : '#ff6b6b',
            background: toastType === 'winner' ? 'rgba(255,215,0,0.1)' : 'rgba(255,100,100,0.1)',
            border:     `1px solid ${toastType === 'winner' ? 'rgba(255,215,0,0.25)' : 'rgba(255,100,100,0.2)'}`,
            padding: '3px 10px', borderRadius: '6px',
            animation: 'vlab-toast-in 0.2s ease',
            whiteSpace: 'nowrap',
          }}>{toastMsg}</span>
        )}

        {/* 우측: 통계 + 히스토리 */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>

          {/* Winner 카운터 */}
          {winnerCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '3px 10px', borderRadius: '20px',
              background: 'rgba(255,215,0,0.07)', border: '1px solid rgba(255,215,0,0.2)',
            }}>
              <span style={{ fontSize: '0.7rem' }}>🏆</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#ffd700', fontFamily: 'Space Grotesk', whiteSpace: 'nowrap' }}>
                  {winnerCount}/25 Patterns
                </span>
                <div style={{ width: '60px', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', width: `${Math.min(100, (winnerCount / 25) * 100)}%`, background: winnerCount >= 25 ? '#4ade80' : 'linear-gradient(90deg, #ffd700, #ffaa00)', borderRadius: '2px', transition: 'width 0.4s' }} />
                </div>
              </div>
              {winnerCount >= 25 && <span style={{ fontSize: '0.65rem', color: '#4ade80', fontWeight: 700 }}>졸업준비!</span>}
            </div>
          )}

          {/* AUTO 루프 인디케이터 */}
          {isAutoLooping && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              padding: '3px 10px', borderRadius: '20px',
              background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.3)',
              fontSize: '0.7rem', color: '#4ade80', fontWeight: 700,
              animation: 'vlab-pulse-badge 1s ease-in-out infinite',
            }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#4ade80', animation: 'vlab-dot-pulse 1s ease-in-out infinite' }} />
              Auto 루프 대기 중...
            </div>
          )}

          {/* 히스토리 탐색 */}
          {history.length > 1 && (
            <>
              <button
                id="videolab-prev-btn"
                onClick={() => setHistoryIndex(i => Math.max(0, i - 1))}
                disabled={historyIndex <= 0}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', opacity: historyIndex <= 0 ? 0.4 : 1 }}
              >← 이전</button>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                {historyIndex + 1}/{history.length}
              </span>
              <button
                id="videolab-next-btn"
                onClick={() => setHistoryIndex(i => Math.min(history.length - 1, i + 1))}
                disabled={historyIndex >= history.length - 1}
                style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '6px', padding: '4px 8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8rem', opacity: historyIndex >= history.length - 1 ? 0.4 : 1 }}
              >다음 →</button>
            </>
          )}
        </div>
      </div>

      {/* ══ 렌더링 중 전체 잠금 오버레이 (COL 1, 4 보호) ═════════════════════ */}

      {/* ══ 메인 4열 그리드 ════════════════════════════════════════════════════ */}
      <div style={{
        flex: 1,
        display: 'grid',
        gridTemplateColumns: '240px 300px 1fr 280px',
        overflow: 'hidden',
        position: 'relative',
      }}>

        {/* ══ COL 1: 설정 및 트리거 ══════════════════════════════════════════ */}
        <div style={{
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', padding: '1.25rem 1rem',
          gap: '1.1rem', background: 'rgba(255,255,255,0.01)',
          position: 'relative',
        }}>
          {/* 렌더링 중 잠금 오버레이 */}
          {isLocked && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 5,
              background: 'rgba(6,8,16,0.7)', backdropFilter: 'blur(2px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              borderRadius: '0',
            }}>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Space Grotesk' }}>렌더링 중...</span>
            </div>
          )}

          {/* 영상 길이 */}
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.55rem', fontFamily: 'Space Grotesk' }}>
              영상 길이
            </div>
            <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem 0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Space Grotesk' }}>길이</span>
                <span style={{
                  fontSize: '0.82rem', fontWeight: 800, color: '#b4c5ff',
                  padding: '2px 8px', borderRadius: '20px',
                  background: 'rgba(100,100,246,0.12)',
                  fontFamily: 'Space Grotesk',
                }}>{durationSec}초</span>
              </div>
              <input
                id="videolab-duration-slider"
                type="range" min="10" max="60" step="5"
                value={durationSec}
                onChange={e => setDurationSec(Number(e.target.value))}
                style={{ width: '100%', accentColor: 'var(--brand)', cursor: 'pointer' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>10초</span>
                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>60초</span>
              </div>
            </div>
          </div>

          {/* 창의도 슬라이더 */}
          <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.8rem 0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Space Grotesk' }}>창의도</span>
              <span style={{
                fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '20px',
                color: creativityPct <= 30 ? '#a78bfa' : creativityPct <= 70 ? 'var(--brand)' : '#60a5fa',
                background: 'rgba(100,100,246,0.12)',
              }}>
                {creativityPct <= 30 ? '자유 창작' : creativityPct <= 70 ? '균형' : '원본 충실'}
              </span>
            </div>
            <input
              id="videolab-creativity-slider"
              type="range" min="0" max="100"
              value={creativityPct}
              onChange={e => setCreativityPct(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--brand)', cursor: 'pointer' }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
              <span style={{ fontSize: '0.6rem', color: '#a78bfa' }}>자유 창작</span>
              <span style={{ fontSize: '0.6rem', color: '#60a5fa' }}>원본 충실</span>
            </div>
          </div>
          {/* 🎲 데이터셋 다양성 확보용: 창의도/시나리오 셔플 버튼 */}
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'Space Grotesk', marginBottom: '0.5rem', letterSpacing: '0.09em', textTransform: 'uppercase' }}>
              학습 데이터 다양화
            </div>
            <button
              onClick={() => {
                const randomPrompt = RANDOM_SCENARIOS[Math.floor(Math.random() * RANDOM_SCENARIOS.length)];
                setPrompt(randomPrompt);
                setIsEditingPrompt(true); // 커스텀 모드로 강제 전환
                setSelectedPreset('custom'); // 프리셋도 커스텀으로
              }}
              disabled={isLocked}
              style={{
                width: '100%', padding: '0.65rem', borderRadius: '10px',
                background: 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(236,72,153,0.12))',
                border: '1px solid rgba(236,72,153,0.3)',
                color: '#f472b6', fontSize: '0.78rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                transition: 'all 0.2s',
                opacity: isLocked ? 0.4 : 1,
                marginBottom: '1rem'
              }}
              onMouseEnter={e => !isLocked && (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168,85,247,0.2), rgba(236,72,153,0.2))')}
              onMouseLeave={e => !isLocked && (e.currentTarget.style.background = 'linear-gradient(135deg, rgba(168,85,247,0.12), rgba(236,72,153,0.12))')}
            >
              <span style={{ fontSize: '1.2rem' }}>🎲</span>
              무작위 마케팅 시나리오 주입
            </button>
          </div>

          {/* 템플릿 프리셋 */}
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.55rem', fontFamily: 'Space Grotesk' }}>
              템플릿 프리셋
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
              {VIDEO_PRESETS.map(p => (
                <button
                  key={p.id}
                  id={`videolab-preset-${p.id}`}
                  onClick={() => handleSelectPreset(p)}
                  title={p.desc}
                  style={{
                    padding: '0.5rem 0.75rem', borderRadius: '9px',
                    border: `1px solid ${selectedPreset === p.id ? 'rgba(238,42,123,0.5)' : 'rgba(255,255,255,0.07)'}`,
                    cursor: 'pointer',
                    background: selectedPreset === p.id ? 'rgba(238,42,123,0.12)' : 'rgba(255,255,255,0.03)',
                    color: selectedPreset === p.id ? '#f9a8d4' : 'var(--text-muted)',
                    fontSize: '0.78rem', fontWeight: selectedPreset === p.id ? 700 : 400,
                    transition: 'all 0.15s',
                    display: 'flex', alignItems: 'center', gap: '0.45rem', textAlign: 'left',
                  }}
                >
                  <span style={{ fontSize: '0.95rem' }}>{p.icon}</span>
                  <div>
                    <div style={{ lineHeight: 1.2 }}>{p.label}</div>
                    <div style={{ fontSize: '0.62rem', opacity: 0.5, fontWeight: 400 }}>{p.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* MANUAL 모드 생성 버튼 (Auto 모드에서는 숨김) */}
          {!isAutoMode && (
            <button
              id="videolab-generate-btn"
              onClick={() => handleGenerate()}
              disabled={!prompt.trim() || isGenerating}
              style={{
                width: '100%', padding: '0.72rem',
                borderRadius: '10px',
                background: (!prompt.trim() || isGenerating)
                  ? 'rgba(238,42,123,0.07)'
                  : 'linear-gradient(135deg, #EE2A7B 0%, #6228D7 100%)',
                color: (!prompt.trim() || isGenerating) ? 'var(--text-muted)' : '#fff',
                border: 'none',
                cursor: (!prompt.trim() || isGenerating) ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.87rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                boxShadow: (!prompt.trim() || isGenerating) ? 'none' : '0 3px 20px rgba(238,42,123,0.35)',
                transition: 'all 0.2s', marginTop: 'auto',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                {isGenerating ? 'hourglass_empty' : 'movie_filter'}
              </span>
              {isGenerating ? '렌더링 중...' : `✦ ${currentPreset.icon} 생성`}
            </button>
          )}

          {/* Auto 모드 안내 */}
          {isAutoMode && !isGenerating && !currentEntry && (
            <button
              id="videolab-auto-start-btn"
              onClick={() => handleGenerate()}
              disabled={!prompt.trim()}
              style={{
                width: '100%', padding: '0.72rem',
                borderRadius: '10px',
                background: !prompt.trim()
                  ? 'rgba(74,222,128,0.05)'
                  : 'linear-gradient(135deg, #16a34a 0%, #4ade80 100%)',
                color: !prompt.trim() ? 'var(--text-muted)' : '#fff',
                border: '1px solid rgba(74,222,128,0.3)',
                cursor: !prompt.trim() ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.82rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                boxShadow: !prompt.trim() ? 'none' : '0 3px 18px rgba(74,222,128,0.25)',
                transition: 'all 0.2s',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>play_circle</span>
              Auto 루프 시작
            </button>
          )}
        </div>

        {/* ══ COL 2: 프롬프트 상태 ══════════════════════════════════════════ */}
        <div style={{
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflow: 'hidden', background: 'rgba(255,255,255,0.01)',
        }}>
          {/* 상단 정보 영역 */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1rem', display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
            {/* 현재 프리셋 뱃지 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.6rem', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: '1.2rem' }}>{currentPreset.icon}</span>
              <div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.2 }}>{currentPreset.label}</div>
                <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)' }}>{currentPreset.desc}</div>
              </div>
              <div style={{
                marginLeft: 'auto', padding: '2px 8px', borderRadius: '20px',
                background: isAutoMode ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.05)',
                border: `1px solid ${isAutoMode ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`,
                fontSize: '0.62rem', fontWeight: 700,
                color: isAutoMode ? '#4ade80' : 'var(--text-muted)',
                fontFamily: 'Space Grotesk',
              }}>
                {isAutoMode ? '● AUTO' : '● MANUAL'}
              </div>
            </div>

            {/* 세팅 요약 */}
            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {[
                { label: '길이', value: `${durationSec}초` },
                { label: '창의도', value: `${creativityPct}%` },
                { label: '모델', value: 'G-2.0 Pro' },
              ].map(({ label, value }) => (
                <div key={label} style={{
                  flex: 1, minWidth: '70px',
                  background: 'rgba(180,197,255,0.04)', border: '1px solid rgba(180,197,255,0.09)',
                  borderRadius: '7px', padding: '0.4rem 0.55rem',
                }}>
                  <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '2px' }}>{label}</div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-primary)', fontWeight: 700 }}>{value}</div>
                </div>
              ))}
            </div>

            {/* 생성된 Props 미리보기 */}
            {currentEntry?.generatedProps && (
              <div style={{ background: 'rgba(0,0,0,0.2)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '9px', padding: '0.7rem 0.8rem' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '0.75rem' }}>data_object</span>
                  생성된 JSON Props
                </div>
                <pre style={{
                  fontSize: '0.65rem', color: '#7dd3fc', margin: 0,
                  fontFamily: '"JetBrains Mono", "Fira Code", monospace',
                  overflow: 'auto', maxHeight: '150px',
                  lineHeight: 1.5,
                }}>
                  {JSON.stringify(currentEntry.generatedProps, null, 2)}
                </pre>
              </div>
            )}

            {/* 히스토리 없을 때 안내 */}
            {!currentEntry && !isGenerating && (
              <div style={{ textAlign: 'center', paddingTop: '2.5rem', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', opacity: 0.15 }}>video_library</span>
                <p style={{ fontSize: '0.78rem', marginTop: '0.75rem', lineHeight: 1.7, opacity: 0.45 }}>
                  {isAutoMode
                    ? 'Auto 루프 시작 버튼을 눌러\n첫 번째 렌더링을 트리거하세요'
                    : '좌측 설정 후 생성 버튼을 클릭하세요'}
                </p>
              </div>
            )}

            {isGenerating && (
              <div style={{ textAlign: 'center', paddingTop: '2rem' }}>
                <div style={{ fontSize: '2rem', marginBottom: '0.75rem', animation: 'vlab-bounce 1.5s ease-in-out infinite' }}>🎬</div>
                <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#f9a8d4', marginBottom: '0.3rem' }}>Remotion 렌더링 중</div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Gemini가 Props를 생성하고<br />Remotion이 MP4를 굽고 있습니다</div>
              </div>
            )}
          </div>

          {/* 하단 고정: 프롬프트 에디터 + 생성 버튼 */}
          <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0, padding: '1rem', background: 'rgba(255,255,255,0.015)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.63rem', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.82rem' }}>edit_note</span>
                생성 프롬프트
              </span>
              <button
                onClick={() => setIsEditingPrompt(e => !e)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '0.65rem', fontFamily: 'Space Grotesk', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', transition: 'color 0.15s' }}
              >
                {isEditingPrompt ? '잠금' : '편집'}
              </button>
            </div>
            <textarea
              id="videolab-prompt-textarea"
              value={prompt}
              onChange={e => setPrompt(e.target.value)}
              readOnly={!isEditingPrompt}
              rows={5}
              placeholder="프리셋을 선택하거나 직접 입력하세요..."
              style={{
                width: '100%', padding: '0.7rem 0.8rem',
                background: isEditingPrompt ? 'var(--bg-surface-2)' : 'rgba(255,255,255,0.02)',
                border: `1px solid ${isEditingPrompt ? 'rgba(238,42,123,0.35)' : 'var(--border)'}`,
                borderRadius: '9px', color: 'var(--text-primary)', fontSize: '0.75rem',
                fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none',
                lineHeight: 1.6, boxSizing: 'border-box', transition: 'border-color 0.2s',
                cursor: isEditingPrompt ? 'text' : 'default',
                opacity: isEditingPrompt ? 1 : 0.75,
              }}
            />
            {/* MANUAL 모드의 Col2 생성 버튼 (이미 Col1에 있으나 편의용) */}
            {!isAutoMode && (
              <button
                onClick={() => handleGenerate()}
                disabled={!prompt.trim() || isGenerating}
                style={{
                  width: '100%', padding: '0.65rem',
                  borderRadius: '10px',
                  background: (!prompt.trim() || isGenerating)
                    ? 'rgba(238,42,123,0.07)'
                    : 'linear-gradient(135deg, #EE2A7B 0%, #6228D7 100%)',
                  color: (!prompt.trim() || isGenerating) ? 'var(--text-muted)' : '#fff',
                  border: 'none',
                  cursor: (!prompt.trim() || isGenerating) ? 'not-allowed' : 'pointer',
                  fontWeight: 700, fontSize: '0.85rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  transition: 'all 0.2s',
                  boxShadow: (!prompt.trim() || isGenerating) ? 'none' : '0 2px 14px rgba(238,42,123,0.3)',
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
                  {isGenerating ? 'hourglass_empty' : 'movie_filter'}
                </span>
                {isGenerating ? '렌더링 중...' : '✦ 영상 생성'}
              </button>
            )}
          </div>
        </div>

        {/* ══ COL 3: 메인 스테이지 ════════════════════════════════════════════ */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0,0,0,0.15)' }}>
          {/* 스테이지 헤더 */}
          <div style={{
            height: '44px', flexShrink: 0,
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'center',
            padding: '0 1.25rem',
            background: 'rgba(255,255,255,0.015)',
            gap: '0.5rem',
          }}>
            <span style={{ fontSize: '1rem' }}>📺</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              메인 스테이지
            </span>
            {currentEntry && (
              <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', padding: '1px 6px', background: 'rgba(255,255,255,0.05)', borderRadius: '4px', fontFamily: 'Space Grotesk' }}>
                {currentEntry.videoUrl?.split('/').pop()?.split('?')[0]}
              </span>
            )}
            {history.length > 1 && (
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.4rem', alignItems: 'center' }}>
                <button onClick={() => setHistoryIndex(i => Math.max(0, i - 1))} disabled={historyIndex <= 0}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '5px', padding: '3px 8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', opacity: historyIndex <= 0 ? 0.4 : 1 }}>←</button>
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{historyIndex + 1}/{history.length}</span>
                <button onClick={() => setHistoryIndex(i => Math.min(history.length - 1, i + 1))} disabled={historyIndex >= history.length - 1}
                  style={{ background: 'none', border: '1px solid var(--border)', borderRadius: '5px', padding: '3px 8px', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.75rem', opacity: historyIndex >= history.length - 1 ? 0.4 : 1 }}>→</button>
              </div>
            )}
          </div>

          {/* 비디오 플레이어 영역 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
            <VideoPlayer url={currentEntry?.videoUrl} isGenerating={isGenerating} />
          </div>

          {/* 인라인 피드백 바 */}
          {currentEntry && (
            <div style={{
              padding: '0.7rem 1.25rem',
              borderTop: '1px solid var(--border)',
              background: 'rgba(255,255,255,0.02)',
              flexShrink: 0,
              display: 'flex', gap: '0.6rem', alignItems: 'center',
            }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', flexShrink: 0 }}>edit</span>
              <input
                id="videolab-inline-edit"
                value={inlineEdit}
                onChange={e => setInlineEdit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && inlineEdit.trim() && !isGenerating && handleGenerate(`${prompt}. Modification: ${inlineEdit}`)}
                placeholder="수정 요청 입력 후 Enter... (예: 폰트 색깔 빨간색으로 바꿔)"
                disabled={isGenerating}
                style={{
                  flex: 1, background: 'transparent', border: 'none', outline: 'none',
                  color: 'var(--text-primary)', fontSize: '0.8rem',
                  fontFamily: 'Inter, sans-serif',
                  opacity: isGenerating ? 0.4 : 1,
                }}
              />
              <button
                id="videolab-inline-submit"
                onClick={() => inlineEdit.trim() && !isGenerating && handleGenerate(`${prompt}. Modification: ${inlineEdit}`)}
                disabled={!inlineEdit.trim() || isGenerating}
                style={{
                  padding: '4px 12px', borderRadius: '6px', border: 'none',
                  background: inlineEdit.trim() && !isGenerating ? 'rgba(238,42,123,0.8)' : 'rgba(255,255,255,0.05)',
                  color: inlineEdit.trim() && !isGenerating ? '#fff' : 'var(--text-muted)',
                  cursor: inlineEdit.trim() && !isGenerating ? 'pointer' : 'not-allowed',
                  fontSize: '0.75rem', fontWeight: 600, flexShrink: 0,
                  transition: 'all 0.15s',
                }}
              >
                재생성 →
              </button>
            </div>
          )}
        </div>

        {/* ══ COL 4: 품질 평가 패널 ══════════════════════════════════════════ */}
        <div style={{
          borderLeft: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', padding: '1.25rem 1rem',
          gap: '0.8rem', background: 'rgba(255,255,255,0.01)',
          position: 'relative',
        }}>
          {/* 렌더링 중 잠금 오버레이 */}
          {isLocked && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 5,
              background: 'rgba(6,8,16,0.7)', backdropFilter: 'blur(2px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <span style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.3)', fontFamily: 'Space Grotesk' }}>렌더링 완료 후 평가</span>
            </div>
          )}

          {/* AUTO / MANUAL 토글 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.88rem' }}>star</span>
              품질 평가
            </div>

            <button
              id="videolab-auto-toggle"
              onClick={() => setIsAutoMode(m => !m)}
              title={isAutoMode ? 'AUTO ON → 클릭하면 수동 전환' : 'MANUAL → 클릭하면 자동 전환'}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 8px', borderRadius: '20px',
                border: `1px solid ${isAutoMode ? 'rgba(74,222,128,0.35)' : 'rgba(255,255,255,0.12)'}`,
                background: isAutoMode ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                cursor: 'pointer', transition: 'all 0.2s',
                fontSize: '0.62rem', fontWeight: 700,
                color: isAutoMode ? '#4ade80' : 'var(--text-muted)',
              }}
            >
              <div style={{
                width: '22px', height: '12px', borderRadius: '6px',
                background: isAutoMode ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{
                  position: 'absolute', top: '2px',
                  left: isAutoMode ? '12px' : '2px',
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: isAutoMode ? '#4ade80' : '#666',
                  transition: 'left 0.18s',
                }} />
              </div>
              {isAutoMode ? 'AUTO' : 'MANUAL'}
            </button>
          </div>

          {/* Auto 모드 설명 */}
          {isAutoMode && (
            <div style={{
              padding: '6px 10px', borderRadius: '8px',
              background: 'rgba(74,222,128,0.05)', border: '1px solid rgba(74,222,128,0.15)',
              fontSize: '0.65rem', color: '#86efac', lineHeight: 1.6,
            }}>
              별점을 주는 순간 2초 후 자동으로
              학습하고 다음 영상이 생성됩니다.
            </div>
          )}

          {/* 🏆 마스터리 프로그래스 바 (시각적 보상) */}
          <div style={{
            background: 'linear-gradient(180deg, rgba(30,41,59,0.5) 0%, rgba(15,23,42,0.8) 100%)',
            border: '1px solid rgba(255,215,0,0.15)',
            borderRadius: '12px', padding: '0.85rem',
            position: 'relative', overflow: 'hidden'
          }}>
            {/* 배경 은은한 빛 */}
            <div style={{ position: 'absolute', top: '-50%', left: '-50%', right: '-50%', bottom: '-50%', background: 'radial-gradient(circle at center, rgba(255,215,0,0.08) 0%, transparent 60%)', zIndex: 0 }} />
            
            <div style={{ position: 'relative', zIndex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.6rem' }}>
              <div>
                <div style={{ fontSize: '0.65rem', color: '#fbbf24', fontWeight: 700, letterSpacing: '0.05em', marginBottom: '0.2rem' }}>
                  REMOTION SKILL MASTERY
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  완벽(5점) 평가 누적 달성도
                </div>
              </div>
              <div style={{ fontFamily: 'Space Grotesk', fontWeight: 800 }}>
                <span style={{ fontSize: '1.4rem', color: winnerCount >= 25 ? '#4ade80' : '#fff' }}>{winnerCount}</span>
                <span style={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.4)' }}>/25</span>
              </div>
            </div>

            {/* 게이지 바 */}
            <div style={{ width: '100%', height: '8px', background: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden', position: 'relative' }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: `${Math.min(100, (winnerCount / 25) * 100)}%`,
                background: winnerCount >= 25 ? '#4ade80' : 'linear-gradient(90deg, #f59e0b, #fbbf24)',
                borderRadius: '4px',
                transition: 'width 0.5s cubic-bezier(0.4, 0, 0.2, 1)',
                boxShadow: '0 0 10px rgba(251,191,36,0.5)'
              }} />
            </div>
            
            {/* 달성 메시지 */}
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.5)', marginTop: '0.5rem', textAlign: 'right' }}>
              {winnerCount >= 25 ? '🎉 훈련 목표 달성! 스킬이 완전히 체화되었습니다.' : '25건의 완벽한 템플릿 학습 시 스킬로 추출됩니다.'}
            </div>
          </div>

          {/* 5D 루브릭 */}
          {VIDEO_RUBRIC.map(dim => (
            <div key={dim.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '9px', padding: '0.65rem 0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{dim.icon}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{dim.label}</span>
              </div>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '0.4rem' }}>{dim.desc}</div>
              <StarRating
                value={scores[dim.id]}
                onChange={val => setScores(s => ({ ...s, [dim.id]: val }))}
                dimId={dim.id}
                disabled={!currentEntry || isGenerating}
              />
            </div>
          ))}

          {/* 평균 점수 표시 */}
          {avgScore && (
            <div style={{
              padding: '0.6rem 0.85rem', borderRadius: '9px',
              background: `rgba(${avgScore >= 4 ? '74,222,128' : avgScore >= 3 ? '249,206,52' : '255,80,80'},0.06)`,
              border: `1px solid rgba(${avgScore >= 4 ? '74,222,128' : avgScore >= 3 ? '249,206,52' : '255,80,80'},0.2)`,
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontFamily: 'Space Grotesk' }}>평균 품질 점수</span>
              <span style={{ fontSize: '1.1rem', fontWeight: 800, color: scoreColor, fontFamily: 'Space Grotesk' }}>
                {avgScore}
                <span style={{ fontSize: '0.65rem', opacity: 0.6 }}>/5</span>
              </span>
            </div>
          )}

          {/* 메모 입력 */}
          <div>
            <div style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.8rem' }}>comment</span>
              피드백 메모
            </div>
            <textarea
              id="videolab-memo"
              value={memo}
              onChange={e => setMemo(e.target.value)}
              disabled={!currentEntry || isGenerating}
              rows={3}
              placeholder={currentEntry ? "예: 자막이 너무 빠름, 배경색 어둡게" : "영상 생성 후 입력하세요"}
              style={{
                width: '100%', padding: '0.6rem 0.7rem',
                background: 'var(--bg-surface-2)',
                border: `1px solid ${memo.trim() ? 'rgba(180,197,255,0.22)' : 'var(--border)'}`,
                borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.75rem',
                fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none',
                lineHeight: 1.5, boxSizing: 'border-box',
                opacity: !currentEntry || isGenerating ? 0.4 : 1,
                cursor: !currentEntry || isGenerating ? 'not-allowed' : 'text',
              }}
            />
          </div>

          {/* 수동 학습 저장 버튼 (MANUAL 모드) */}
          {!isAutoMode && (
            <button
               id="videolab-learn-btn"
               onClick={handleLearn}
               disabled={!avgScore || !currentEntry || isLearning || isGenerating || learnResult === 'ok' || !Object.values(scores).every(v => v > 0)}
               style={{
                 width: '100%', padding: '0.65rem',
                 borderRadius: '10px',
                 border: 'none',
                 background: (!avgScore || !Object.values(scores).every(v => v > 0) || !currentEntry || isLearning || learnResult === 'ok')
                   ? 'rgba(255,215,0,0.05)'
                   : 'linear-gradient(135deg, #b45309, #F9CE34)',
                 color: (!avgScore || !Object.values(scores).every(v => v > 0) || !currentEntry || isLearning || learnResult === 'ok')
                   ? 'var(--text-muted)' : '#111',
                 cursor: (!avgScore || !Object.values(scores).every(v => v > 0) || !currentEntry || isLearning || learnResult === 'ok') ? 'not-allowed' : 'pointer',
                 fontWeight: 700, fontSize: '0.82rem',
                 display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                 transition: 'all 0.2s',
                 boxShadow: (!avgScore || !Object.values(scores).every(v => v > 0) || !currentEntry || isLearning || learnResult === 'ok') ? 'none' : '0 3px 16px rgba(249,206,52,0.25)',
               }}
             >
               {isLearning ? (
                 <><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>hourglass_empty</span>SKILL.md 기록 중...</>
               ) : learnResult === 'ok' ? (
                 <><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>check_circle</span>저장 완료</>
               ) : (
                 <><span style={{ fontSize: '0.9rem' }}>🏆</span>SKILL.md 평가 보관하기</>
               )}
             </button>
          )}

          {/* Auto 루프 중 상태 표시 */}
          {isAutoMode && isAutoLooping && (
            <div style={{
              padding: '0.6rem', borderRadius: '8px',
              background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.2)',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
            }}>
              <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#4ade80', animation: 'vlab-dot-pulse 1s ease-in-out infinite', flexShrink: 0 }} />
              <span style={{ fontSize: '0.7rem', color: '#86efac' }}>2초 후 Auto 학습 + 재생성 실행...</span>
            </div>
          )}

          {/* 학습 결과 피드백 */}
          {learnResult === 'error' && (
            <div style={{ padding: '6px 10px', borderRadius: '7px', background: 'rgba(255,80,80,0.06)', border: '1px solid rgba(255,80,80,0.15)', fontSize: '0.7rem', color: '#ff8a80' }}>
              ⚠️ 저장 중 오류가 발생했습니다
            </div>
          )}
        </div>
      </div>

      {/* ══ 전역 애니메이션 스타일 ══════════════════════════════════════════════ */}
      <style>{`
        @keyframes vlab-toast-in {
          from { opacity: 0; transform: translateY(-4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes vlab-pulse-badge {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.6; }
        }
        @keyframes vlab-dot-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.4); opacity: 0.6; }
        }
        @keyframes thinking-glow-pulse {
          0%, 100% { opacity: 0.7; transform: scale(1); }
          50%       { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}
