// src/components/Views/ImageLabView.jsx — 🧪 Image Lab v2 (Phase 1~C)
// 풀스크린 디자인 스튜디오 | 스타일 프리셋(A) + 충실도 슬라이더(B) + 인라인 재생성(C)
// Claude Design UX 인사이트 반영 | 2026-04-19
import { useState, useRef, useCallback, useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';


const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

// ── A. 스타일 프리셋 ─────────────────────────────────────────────────────────
const STYLE_PRESETS = [
  {
    id: 'nanobanana',
    label: 'NanoBanana',
    icon: '🎮',
    anchor: 'chibi pixel art character, chunky pixel style, bold black outlines, flat colors, cute expressive face, big round eyes, game sprite',
    skillTag: 'nanobanana',
    desc: 'MyCrew 픽셀아트 치비',
  },
  {
    id: 'illustration',
    label: '일러스트',
    icon: '🖌️',
    anchor: '2D illustration, soft cel shading, clean lineart, anime style, vibrant colors',
    skillTag: 'illustration',
    desc: '2D 소프트 일러스트',
  },
  {
    id: 'toy3d',
    label: '3D 토이',
    icon: '🧊',
    anchor: '3D render, chibi toy figurine, smooth plastic surface, studio lighting, Funko Pop style, subsurface scattering',
    skillTag: 'toy3d',
    desc: '3D 피규어 렌더',
  },
  {
    id: 'flatminimal',
    label: '미니멀',
    icon: '⬜',
    anchor: 'flat design vector art, minimal shapes, solid color blocks, no gradient, geometric simplicity',
    skillTag: 'flatminimal',
    desc: '플랫 벡터 미니멀',
  },
  {
    id: 'custom',
    label: '커스텀',
    icon: '✏️',
    anchor: '',
    skillTag: 'custom',
    desc: '자유 프롬프트',
  },
];

// B. 충실도 슬라이더 → 프롬프트 suffix
function getFidelityInstruction(value) {
  if (value <= 30)  return 'inspired by the reference color palette only, free creative interpretation';
  if (value <= 60)  return 'matching reference color palette, pose, and proportions';
  return 'closely matching reference image — preserve color palette, pose, proportions, and key visual elements';
}

// ── 5차원 평가 ───────────────────────────────────────────────────────────────
const RUBRIC_DIMS = [
  { id: 'fidelity', label: '충실도', icon: 'image_search',    desc: '원본 요소를 정확히 재현했는가' },
  { id: 'style',    label: '스타일', icon: 'palette',          desc: '선택 스타일 일치도' },
  { id: 'color',    label: '색상',   icon: 'colorize',         desc: '팔레트·강도 일치도' },
  { id: 'ratio',    label: '비율',   icon: 'aspect_ratio',     desc: '캐릭터 비율, 규격 준수' },
  { id: 'brand',    label: '브랜드', icon: 'verified',         desc: '소시안 브랜드 톤 적합성' },
];

// ── 별점 컴포넌트 ────────────────────────────────────────────────────────────
function StarRating({ value, onChange, dimId }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          id={`star-${dimId}-${star}`}
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          aria-label={`${star}점`}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '1px',
            color: star <= (hovered || value) ? '#F9CE34' : 'rgba(255,255,255,0.12)',
            fontSize: '1.1rem', transition: 'all 0.1s', lineHeight: 1,
          }}
        >★</button>
      ))}
      <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginLeft: '4px', fontFamily: 'Space Grotesk' }}>
        {value > 0 ? `${value}/5` : '—'}
      </span>
    </div>
  );
}

// ── AI 분석 애니메이션 오버레이 ──────────────────────────────────────────────
function AnalyzingOverlay() {
  const [dots, setDots] = useState('');
  const [phase, setPhase] = useState(0);
  const phases = [
    '이미지 스캔 중',
    '색상 팔레트 추출 중',
    '스타일 패턴 분석 중',
    '캐릭터 속성 매핑 중',
    '프롬프트 초안 생성 중',
  ];

  useEffect(() => {
    const dotTimer = setInterval(() => {
      setDots(d => d.length >= 3 ? '' : d + '.');
    }, 400);
    const phaseTimer = setInterval(() => {
      setPhase(p => (p + 1) % phases.length);
    }, 2000);
    return () => { clearInterval(dotTimer); clearInterval(phaseTimer); };
  }, []);

  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 10,
      background: 'rgba(8,10,18,0.88)',
      backdropFilter: 'blur(8px)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: '1.5rem',
      borderRadius: '12px',
    }}>
      {/* 뇌 파동 애니메이션 */}
      <div style={{ position: 'relative', width: '80px', height: '80px' }}>
        {[0, 1, 2].map(i => (
          <div key={i} style={{
            position: 'absolute', inset: `${i * 10}px`,
            borderRadius: '50%',
            border: `2px solid rgba(180,197,255,${0.6 - i * 0.15})`,
            animation: `analyzing-pulse 1.8s ease-in-out ${i * 0.3}s infinite`,
          }} />
        ))}
        <div style={{
          position: 'absolute', inset: '50%',
          transform: 'translate(-50%, -50%)',
          fontSize: '2rem', lineHeight: 1,
        }}>🧠</div>
      </div>

      {/* 상태 텍스트 */}
      <div style={{ textAlign: 'center' }}>
        <div style={{
          fontSize: '1rem', fontWeight: 700,
          color: '#b4c5ff', fontFamily: 'Space Grotesk, sans-serif',
          marginBottom: '0.4rem',
          transition: 'opacity 0.3s',
        }}>
          {phases[phase]}{dots}
        </div>
        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
          Gemini Vision이 이미지를 분석하고 있어요
        </div>
      </div>

      {/* 진행바 */}
      <div style={{
        width: '200px', height: '3px',
        background: 'rgba(255,255,255,0.08)',
        borderRadius: '2px', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', borderRadius: '2px',
          background: 'linear-gradient(90deg, #6464F6, #b4c5ff, #6464F6)',
          backgroundSize: '200% 100%',
          animation: 'analyzing-slide 1.5s linear infinite',
        }} />
      </div>

      <style>{`
        @keyframes analyzing-pulse {
          0%, 100% { transform: scale(1); opacity: 0.6; }
          50% { transform: scale(1.08); opacity: 1; }
        }
        @keyframes analyzing-slide {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }
      `}</style>
    </div>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────────
export default function ImageLabView() {
  const { setLogPanelOpen, setCurrentView } = useUiStore();

  // ─ 소시안 이미지 풀 (Full Auto Loop용)
  const [refPool,       setRefPool]       = useState([]);   // { name, url }[]
  const [poolIndex,     setPoolIndex]     = useState(0);
  const [fullAutoMode,  setFullAutoMode]  = useState(false); // 완전 자동 루프 ON/OFF
  const [autoPhase,     setAutoPhase]     = useState('idle'); // 'idle'|'analyzing'|'generating'|'waiting'
  const [cooldownSec,   setCooldownSec]   = useState(0);    // 루프 주기 전 쿼다운 (Rate Limit 방어)

  useEffect(() => {
    setLogPanelOpen(false);
    // ── 마운트 시 누적 Winner 수 복구 (휘발 방지) ─────────────────
    fetch(`${SERVER_URL}/api/imagelab/winners/count`)
      .then(r => r.json())
      .then(d => { if (d.count > 0) setWinnerCount(d.count); })
      .catch(() => {});
    // ── 소시안 이미지 풀 로드 ────────────────────────────────────
    fetch(`${SERVER_URL}/api/imagelab/reference-pool`)
      .then(r => r.json())
      .then(d => { if (d.files?.length) setRefPool(d.files); })
      .catch(() => {});
  }, []);


  // ─ 레퍼런스
  const [refFile,    setRefFile]    = useState(null);
  const [refPreview, setRefPreview] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

  // ─ 파이프라인
  const [analysis,       setAnalysis]       = useState(null);
  const [prompt,         setPrompt]         = useState('');
  const [inlineEdit,     setInlineEdit]     = useState('');      // C: 인라인 재생성

  // ─ A. 스타일 프리셋
  const [stylePreset, setStylePreset] = useState('nanobanana');

  // ─ B. 충실도 슬라이더
  const [fidelity, setFidelity] = useState(50);

  // ─ 히스토리 (D 확장 대비: 단일 URL → 배열)
  const [history,      setHistory]      = useState([]);          // string[]
  const [historyIndex, setHistoryIndex] = useState(-1);
  const generatedUrl = history[historyIndex] ?? null;

  // ─ 로딩
  const [isAnalyzing,  setIsAnalyzing]  = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isLearning,   setIsLearning]   = useState(false);
  const [isAutoLearning, setIsAutoLearning] = useState(false); // 자동학습 대기 상태
  const [autoLearnMode,  setAutoLearnMode]  = useState(true);  // AUTO(true) / MANUAL(false)

  // ─ 평가
  const [scores, setScores] = useState({ fidelity: 0, style: 0, color: 0, ratio: 0, brand: 0 });
  const [memo,   setMemo]   = useState('');

  // ─ 결과
  const [learnResult, setLearnResult] = useState(null);
  const [errorMsg,    setErrorMsg]    = useState('');
  const [isWinnerMsg, setIsWinnerMsg] = useState(false);
  const [winnerCount, setWinnerCount] = useState(0);     // 4점이상 우수 패턴 수
  const [totalLearnCount, setTotalLearnCount] = useState(0); // 전체 학습 횟수
  const [runningAvgScore, setRunningAvgScore] = useState(0); // 누적 평균 품질점수 (5점 만점)
  const [activeTab,   setActiveTab]   = useState('ref');

  const avgScore = (() => {
    const vals = Object.values(scores).filter(v => v > 0);
    return vals.length > 0 ? (vals.reduce((a,b)=>a+b,0)/vals.length).toFixed(1) : null;
  })();
  const scoreColor = avgScore >= 4 ? '#4ade80' : avgScore >= 3 ? '#F9CE34' : '#ff5449';
  const currentPreset = STYLE_PRESETS.find(p => p.id === stylePreset) || STYLE_PRESETS[0];

  // ── 자동 학습: AUTO 모드 + 별점 변경 → 2초 디바운스 후 자동 실행 ──────────
  useEffect(() => {
    if (!autoLearnMode) return;
    if (!generatedUrl || learnResult === 'ok' || isLearning) return;
    const isFullyScored = Object.values(scores).every(v => v > 0);
    if (!isFullyScored) return;

    setIsAutoLearning(true);
    const timer = setTimeout(() => {
      setIsAutoLearning(false);
      handleLearn();
    }, 2000);

    return () => {
      clearTimeout(timer);
      setIsAutoLearning(false);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scores, generatedUrl, autoLearnMode, learnResult]);

  // ── Full Auto Loop ①: 학습 완료 → 쿼다운 후 다음 이미지 로드 ─────────────────
  useEffect(() => {
    if (!fullAutoMode || learnResult !== 'ok') return;
    if (refPool.length === 0) return;

    // 쿼다운 45초: Gemini Flash 무료티어 RPM 한도 방어
    const COOLDOWN = 45;
    setCooldownSec(COOLDOWN);
    setAutoPhase('cooldown');

    const interval = setInterval(() => {
      setCooldownSec(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          // 쿼다운 종료 → 다음 이미지 로드
          const nextIdx = (poolIndex + 1) % refPool.length;
          setPoolIndex(nextIdx);
          setAutoPhase('analyzing');
          const nextImg = refPool[nextIdx];
          fetch(`${SERVER_URL}${nextImg.url}`)
            .then(r => r.blob())
            .then(blob => {
              const file = new File([blob], nextImg.name, { type: blob.type || 'image/png' });
              setRefFile(file);
              setRefPreview(URL.createObjectURL(blob));
              setAnalysis(null); setPrompt(''); setHistory([]); setHistoryIndex(-1);
              setScores({ fidelity:0, style:0, color:0, ratio:0, brand:0 });
              setMemo(''); setLearnResult(null); setActiveTab('ref');
              setErrorMsg('');
            })
            .catch(err => {
              setErrorMsg(`자동 루프 이미지 로드 오류: ${err.message}`);
              setAutoPhase('idle');
            });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [learnResult, fullAutoMode]);

  // ── Full Auto Loop ②: 분석 단계 → 자동 분석 실행 ───────────────────────────
  useEffect(() => {
    if (!fullAutoMode || autoPhase !== 'analyzing') return;
    if (!refFile || isAnalyzing) return;
    // refFile이 세팅된 직후 자동 분석 킥오프 (약간의 딜레이로 상태 안정화)
    const t = setTimeout(() => { handleAnalyze(); }, 400);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refFile, autoPhase, fullAutoMode]);

  // ── Full Auto Loop ③: 분석 완료 → 자동 생성 ───────────────────────────────
  useEffect(() => {
    if (!fullAutoMode || autoPhase !== 'analyzing') return;
    if (!analysis || !prompt.trim() || isAnalyzing || isGenerating) return;
    setAutoPhase('generating');
    const t = setTimeout(() => { handleGenerate(); }, 300);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [analysis, fullAutoMode, autoPhase]);

  // ── Full Auto Loop ④: 생성 완료 → 평가 대기 상태 ─────────────────────────
  useEffect(() => {
    if (!fullAutoMode) return;
    if (autoPhase === 'generating' && !isGenerating && generatedUrl) {
      setAutoPhase('waiting'); // 이제 사용자 별점 입력 대기
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isGenerating, generatedUrl, fullAutoMode]);

  // ── 파일 선택 ─────────────────────────────────────────────────────────────
  const handleFileSelect = useCallback((file) => {
    if (!file || !file.type.startsWith('image/')) return;
    setRefFile(file);
    setRefPreview(URL.createObjectURL(file));
    setAnalysis(null); setPrompt(''); setHistory([]); setHistoryIndex(-1);
    setScores({ fidelity:0, style:0, color:0, ratio:0, brand:0 });
    setMemo(''); setLearnResult(null); setActiveTab('ref');
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault(); setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  // ── Step 1: 분석 ─────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!refFile) return;
    setIsAnalyzing(true); setErrorMsg('');
    try {
      const formData = new FormData();
      formData.append('image', refFile);
      const res = await fetch(`${SERVER_URL}/api/imagelab/analyze`, { method:'POST', body:formData });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석 실패');

      // ── 데이터 정규화: Gemini가 배열 대신 문자열로 반환할 경우 대응
      const raw = data.analysis || {};

      // colorPalette: 문자열이면 쉼표 분리 후 배열화
      if (!Array.isArray(raw.colorPalette)) {
        raw.colorPalette = raw.colorPalette
          ? String(raw.colorPalette).split(',').map(c => c.trim()).filter(Boolean)
          : [];
      }
      // forbiddenElements: 문자열이면 쉼표 분리 후 배열화
      if (!Array.isArray(raw.forbiddenElements)) {
        raw.forbiddenElements = raw.forbiddenElements
          ? String(raw.forbiddenElements).split(',').map(s => s.trim()).filter(Boolean)
          : [];
      }

      setAnalysis(raw);
      if (data.generatedPrompt) setPrompt(data.generatedPrompt);

    } catch (err) {
      setErrorMsg(`분석 오류: ${err.message}`);
    } finally {
      setIsAnalyzing(false);
    }
  };


  // ── Step 2: 생성 (A+B 적용) ──────────────────────────────────────────────
  const buildFinalPrompt = (base, editHint = '') => {
    const preset = STYLE_PRESETS.find(p => p.id === stylePreset);
    const styleAnchor = preset?.anchor || '';
    const fidelityHint = getFidelityInstruction(fidelity);
    const editSuffix = editHint.trim() ? `, ${editHint.trim()}` : '';
    // 커스텀 모드는 앵커 없이 base만 사용
    if (stylePreset === 'custom') return `${base}${editSuffix}`;
    return `${styleAnchor}, ${base}, ${fidelityHint}${editSuffix}`;
  };

  const handleGenerate = async (editHint = '') => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setErrorMsg('');
    // ── 새 이미지 생성 시 평가 상태 완전 리셋 ───────────────────────────
    setLearnResult(null);
    setScores({ fidelity:0, style:0, color:0, ratio:0, brand:0 });
    setMemo('');
    try {
      const finalPrompt = buildFinalPrompt(prompt, editHint);
      const res = await fetch(`${SERVER_URL}/api/imagelab/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: finalPrompt, sessionId: `lab_${Date.now()}`, stylePreset }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      // 히스토리에 추가
      setHistory(prev => {
        const next = [...prev.slice(0, historyIndex + 1), data.imageUrl];
        setHistoryIndex(next.length - 1);
        return next;
      });
      setInlineEdit('');
      setActiveTab('gen');
    } catch (err) {
      setErrorMsg(`생성 오류: ${err.message}`);
    } finally {
      setIsGenerating(false);
    }
  };


  // ── Step 3: 학습 ─────────────────────────────────────────────────────────
  const handleLearn = async () => {
    if (!avgScore) return;
    setIsLearning(true); setLearnResult(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/imagelab/learn`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId:    `lab_${Date.now()}`,
          score:         parseFloat(avgScore),
          scores,
          memo:          memo.trim(),
          winnerPrompt:  avgScore >= 4 ? prompt : null,
          failedPrompt:  avgScore < 3  ? prompt : null,
          styleTag:      currentPreset.skillTag,
          // ─ 파인튜닝 데이터셋 수집용 ─
          generatedUrl,
          prompt,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '저장 실패');
      setLearnResult('ok');

      // ── 누적 통계 업데이트 ───────────────────────────────────────────
      const newTotal = totalLearnCount + 1;
      setTotalLearnCount(newTotal);
      // 누적 평균 점수: (이전평균 * 이전횟수 + 현재점수) / 새횟수
      const newRunningAvg = ((runningAvgScore * totalLearnCount) + parseFloat(avgScore)) / newTotal;
      setRunningAvgScore(parseFloat(newRunningAvg.toFixed(2)));

      // 🏆 Winner 저장 피드백
      if (data.winnerSaved) {
        const cnt = data.winnerCount;
        setWinnerCount(cnt);
        setIsWinnerMsg(true);
        setErrorMsg(`🏆 Winner #${cnt} 저장! 누적 평균 ${newRunningAvg.toFixed(1)}점`);
        setTimeout(() => { setErrorMsg(''); setIsWinnerMsg(false); }, 4000);
      }
    } catch (err) {
      setLearnResult('error'); setErrorMsg(`학습 오류: ${err.message}`);
    } finally {
      setIsLearning(false);
    }
  };


  // ═══════════════════════════════════════════════════════════════════════════
  // 렌더 — 풀스크린 오버레이
  // ═══════════════════════════════════════════════════════════════════════════
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
    }}>

      {/* ══ 탑바 ══════════════════════════════════════════════════════════ */}
      <div style={{
        height: '52px', flexShrink: 0,
        borderBottom: '1px solid var(--border)',
        display: 'flex', alignItems: 'center',
        padding: '0 1.25rem', gap: '0.75rem',
        background: 'rgba(255,255,255,0.02)',
      }}>
        {/* 돌아가기 버튼 */}
        <button
          id="imagelab-back-btn"
          onClick={() => setCurrentView('projects')}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            background: 'none', border: '1px solid var(--border)',
            borderRadius: '7px', padding: '4px 10px',
            cursor: 'pointer', color: 'var(--text-secondary)',
            fontSize: '0.78rem', fontWeight: 500,
            transition: 'all 0.15s',
            marginRight: '0.25rem',
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
          onMouseLeave={e => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>arrow_back</span>
          대시보드
        </button>

        <div style={{ width: '1px', height: '18px', background: 'var(--border)', marginRight: '0.25rem' }} />

        <span className="material-symbols-outlined" style={{ fontSize: '1.2rem', color: 'var(--brand)' }}>experiment</span>
        <span style={{ fontWeight: 700, fontSize: '1rem', fontFamily: 'Space Grotesk, sans-serif' }}>Image Lab</span>
        <span style={{
          fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em',
          padding: '2px 6px', borderRadius: '4px',
          background: 'rgba(100,100,246,0.2)', color: '#a0a8ff',
        }}>BETA</span>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk' }}>
          LUMI 프롬프트 트레이닝 · NanoBanana 이미지 벤치마크
        </span>

        {/* 에러 뱃지 */}
        {errorMsg && (
          <span style={{
            marginLeft: '0.5rem', fontSize: '0.75rem',
            color:      isWinnerMsg ? '#ffd700' : '#ff6b6b',
            background: isWinnerMsg ? 'rgba(255,215,0,0.1)' : 'rgba(255,100,100,0.1)',
            padding: '3px 8px', borderRadius: '6px',
          }}>{isWinnerMsg ? errorMsg : `⚠ ${errorMsg}`}</span>
        )}


        <div style={{ marginLeft: 'auto', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>

          {/* ⏱️ 쿨다운 카운터 (Rate Limit 대기 중) */}
          {fullAutoMode && autoPhase === 'cooldown' && cooldownSec > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '6px',
              padding: '3px 10px', borderRadius: '20px',
              background: 'rgba(251,146,60,0.08)',
              border: '1px solid rgba(251,146,60,0.25)',
              fontSize: '0.65rem', color: '#fb923c',
              fontFamily: 'Space Grotesk', fontWeight: 700,
            }}>
              <span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⏱</span>
              API 쿨다운 {cooldownSec}초 후 재개
            </div>
          )}

          {/* 📊 학습 품질 트래커: 첫 학습부터 항상 표시 */}
          {totalLearnCount > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '4px 12px', borderRadius: '20px',
              background: 'rgba(255,215,0,0.06)',
              border: '1px solid rgba(255,215,0,0.18)',
            }}>
              <span style={{ fontSize: '0.75rem' }}>🏆</span>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                {/* 4점이상 / 총학습횟수 */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 700, color: '#ffd700', fontFamily: 'Space Grotesk', whiteSpace: 'nowrap' }}>
                    우수 {winnerCount}/{totalLearnCount}회
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.35)', fontFamily: 'Space Grotesk' }}>
                    품질 {runningAvgScore.toFixed(1)}/5
                  </span>
                </div>
                {/* 프로그래스 바: 누적 평균 품질 점수 / 5.0 */}
                <div style={{ width: '80px', height: '4px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(100, (runningAvgScore / 5) * 100)}%`,
                    background: runningAvgScore >= 4 ? '#4ade80'
                              : runningAvgScore >= 3 ? 'linear-gradient(90deg, #ffd700, #ffaa00)'
                              : 'linear-gradient(90deg, #ff6b6b, #ffd700)',
                    borderRadius: '2px',
                    transition: 'width 0.5s ease, background 0.3s',
                  }} />
                </div>
              </div>
              {runningAvgScore >= 4 && (
                <span style={{ fontSize: '0.62rem', color: '#4ade80', fontWeight: 700, whiteSpace: 'nowrap' }}>↑ 안정권</span>
              )}
            </div>
          )}
          {/* 히스토리 탐색 */}
          {history.length > 1 && (
            <>
              <button onClick={() => setHistoryIndex(i => Math.max(0, i-1))}
                disabled={historyIndex <= 0}
                style={{ background:'none', border:'1px solid var(--border)', borderRadius:'6px', padding:'4px 8px', color:'var(--text-secondary)', cursor:'pointer', fontSize:'0.8rem', opacity: historyIndex <= 0 ? 0.4 : 1 }}>
                ← 이전
              </button>
              <span style={{ fontSize:'0.75rem', color:'var(--text-muted)' }}>
                {historyIndex+1}/{history.length}
              </span>
              <button onClick={() => setHistoryIndex(i => Math.min(history.length-1, i+1))}
                disabled={historyIndex >= history.length-1}
                style={{ background:'none', border:'1px solid var(--border)', borderRadius:'6px', padding:'4px 8px', color:'var(--text-secondary)', cursor:'pointer', fontSize:'0.8rem', opacity: historyIndex >= history.length-1 ? 0.4 : 1 }}>
                다음 →
              </button>
            </>
          )}
        </div>
      </div>


      {/* ══ 메인 4컬럼 ════════════════════════════════════════════════════ */}
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '240px 300px 1fr 280px', overflow: 'hidden' }}>

        {/* ══ COL 1: 컨트롤 패널 */}
        <div style={{
          borderRight: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
          overflowY: 'auto', padding: '1.25rem 1rem',
          gap: '1.1rem', background: 'rgba(255,255,255,0.01)',
        }}>
          <div>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.55rem', fontFamily: 'Space Grotesk' }}>
              레퍼런스 이미지
            </div>
            {/* 🔁 Full Auto Loop 토글 */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
              <span style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: 'Space Grotesk' }}>
                Full Auto Loop
              </span>
              <button
                onClick={() => {
                  const next = !fullAutoMode;
                  setFullAutoMode(next);
                  if (next && refPool.length > 0 && !refFile) {
                    // 최초 시작: 풀에서 첫 이미지 자동 로드
                    const img = refPool[poolIndex];
                    fetch(`${SERVER_URL}${img.url}`)
                      .then(r => r.blob())
                      .then(blob => {
                        const file = new File([blob], img.name, { type: blob.type || 'image/png' });
                        setRefFile(file);
                        setRefPreview(URL.createObjectURL(blob));
                        setAnalysis(null); setPrompt(''); setHistory([]); setHistoryIndex(-1);
                        setScores({ fidelity:0, style:0, color:0, ratio:0, brand:0 });
                        setMemo(''); setLearnResult(null); setActiveTab('ref');
                        setAutoPhase('analyzing');
                      }).catch(() => {});
                  }
                }}
                style={{
                  display: 'flex', alignItems: 'center', gap: '5px',
                  padding: '3px 8px', borderRadius: '20px',
                  border: `1px solid ${fullAutoMode ? 'rgba(249,206,52,0.4)' : 'rgba(255,255,255,0.12)'}`,
                  background: fullAutoMode ? 'rgba(249,206,52,0.1)' : 'rgba(255,255,255,0.04)',
                  cursor: 'pointer', transition: 'all 0.2s',
                  fontSize: '0.62rem', fontWeight: 700,
                  color: fullAutoMode ? '#F9CE34' : 'var(--text-muted)',
                }}
              >
                <div style={{
                  width: '22px', height: '12px', borderRadius: '6px',
                  background: fullAutoMode ? 'rgba(249,206,52,0.4)' : 'rgba(255,255,255,0.1)',
                  position: 'relative', transition: 'background 0.2s',
                }}>
                  <div style={{
                    position: 'absolute', top: '2px',
                    left: fullAutoMode ? '12px' : '2px',
                    width: '8px', height: '8px', borderRadius: '50%',
                    background: fullAutoMode ? '#F9CE34' : '#666',
                    transition: 'left 0.18s',
                  }} />
                </div>
                {fullAutoMode ? '🔁 ON' : 'OFF'}
              </button>
            </div>
            {fullAutoMode && (
              <div style={{
                padding: '5px 8px', borderRadius: '7px', marginBottom: '0.5rem',
                background: 'rgba(249,206,52,0.06)', border: '1px solid rgba(249,206,52,0.2)',
                fontSize: '0.63rem', color: '#fde68a', lineHeight: 1.6,
              }}>
                {autoPhase === 'idle'      && `🟡 대기 중 · 풀 ${refPool.length}장`}
                {autoPhase === 'cooldown'  && `⏱ API 쿨다운 ${cooldownSec}초 대기 중...`}
                {autoPhase === 'analyzing' && `🔵 이미지 분석 중... (${poolIndex + 1}/${refPool.length})`}
                {autoPhase === 'generating' && `🟣 이미지 생성 중...`}
                {autoPhase === 'waiting'   && `⭐ 별점 평가 후 자동 다음 루프`}
              </div>
            )}

          <div id="imagelab-dropzone" onDrop={handleDrop}
              onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onClick={() => !fullAutoMode && fileInputRef.current?.click()}
              style={{
                border: `2px dashed ${isDragging ? 'var(--brand)' : refPreview ? 'rgba(180,197,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: '10px', cursor: 'pointer',
                background: isDragging ? 'rgba(100,100,246,0.06)' : 'rgba(255,255,255,0.02)',
                transition: 'all 0.2s', overflow: 'hidden',
                minHeight: refPreview ? 'auto' : '120px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
              {refPreview ? (
                <img src={refPreview} alt="레퍼런스" style={{ width: '100%', display: 'block', maxHeight: '170px', objectFit: 'contain' }} />
              ) : (
                <div style={{ textAlign: 'center', padding: '1.5rem 0.75rem', color: 'var(--text-muted)' }}>
                  <span className="material-symbols-outlined" style={{ fontSize: '2rem', opacity: 0.35 }}>add_photo_alternate</span>
                  <div style={{ fontSize: '0.73rem', marginTop: '0.4rem', fontWeight: 500 }}>이미지 드래그 또는 클릭</div>
                  <div style={{ fontSize: '0.63rem', marginTop: '3px', opacity: 0.5 }}>PNG/JPG/WebP · 최대 5MB</div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }}
              onChange={e => handleFileSelect(e.target.files[0])} />
          </div>

          {refFile && (
            <>
              <div>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '0.55rem', fontFamily: 'Space Grotesk' }}>
                  어떤 결과물을 원하세요?
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  {STYLE_PRESETS.map(p => (
                    <button key={p.id} onClick={() => setStylePreset(p.id)} title={p.desc}
                      style={{
                        padding: '0.5rem 0.75rem', borderRadius: '9px',
                        border: `1px solid ${stylePreset === p.id ? 'rgba(100,100,246,0.55)' : 'rgba(255,255,255,0.07)'}`,
                        cursor: 'pointer',
                        background: stylePreset === p.id ? 'rgba(100,100,246,0.18)' : 'rgba(255,255,255,0.03)',
                        color: stylePreset === p.id ? '#c4caff' : 'var(--text-muted)',
                        fontSize: '0.78rem', fontWeight: stylePreset === p.id ? 700 : 400,
                        transition: 'all 0.15s',
                        display: 'flex', alignItems: 'center', gap: '0.45rem', textAlign: 'left',
                      }}>
                      <span style={{ fontSize: '0.95rem' }}>{p.icon}</span>
                      <div>
                        <div style={{ lineHeight: 1.2 }}>{p.label}</div>
                        <div style={{ fontSize: '0.62rem', opacity: 0.55, fontWeight: 400 }}>{p.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ background: 'rgba(255,255,255,0.025)', border: '1px solid var(--border)', borderRadius: '10px', padding: '0.85rem 0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.55rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Space Grotesk' }}>창의도</span>
                  <span style={{ fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: '20px', color: fidelity <= 30 ? '#a78bfa' : fidelity <= 70 ? 'var(--brand)' : '#60a5fa', background: 'rgba(100,100,246,0.12)' }}>
                    {fidelity <= 30 ? '자유 창작' : fidelity <= 70 ? '균형' : '원본 충실'}
                  </span>
                </div>
                <input type="range" min="0" max="100" value={fidelity}
                  onChange={e => setFidelity(Number(e.target.value))}
                  style={{ width: '100%', accentColor: 'var(--brand)', cursor: 'pointer' }} />
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.3rem' }}>
                  <span style={{ fontSize: '0.6rem', color: '#a78bfa' }}>자유 창작</span>
                  <span style={{ fontSize: '0.6rem', color: '#60a5fa' }}>원본 충실</span>
                </div>
              </div>

              <button id="imagelab-analyze-btn" onClick={handleAnalyze} disabled={isAnalyzing}
                style={{
                  width: '100%', padding: '0.65rem',
                  background: isAnalyzing ? 'rgba(180,197,255,0.06)' : 'rgba(180,197,255,0.1)',
                  border: '1px solid rgba(180,197,255,0.22)',
                  borderRadius: '9px', cursor: isAnalyzing ? 'not-allowed' : 'pointer',
                  color: isAnalyzing ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontSize: '0.82rem', fontWeight: 600,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  transition: 'all 0.2s',
                }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
                  {isAnalyzing ? 'hourglass_empty' : 'auto_fix_high'}
                </span>
                {isAnalyzing ? 'AI 분석 중...' : (analysis ? '재분석' : 'Gemini로 분석하기')}
              </button>
            </>
          )}
        </div>

        {/* ══ COL 2: 분석결과 + 프롬프트 + 생성버튼 */}
        <div style={{ borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', background: 'rgba(255,255,255,0.01)' }}>
          {isAnalyzing && <AnalyzingOverlay />}

          <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem 1rem' }}>
            {!analysis && !isAnalyzing && (
              <div style={{ textAlign: 'center', paddingTop: '3rem', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '2.5rem', opacity: 0.18 }}>analytics</span>
                <p style={{ fontSize: '0.78rem', marginTop: '0.75rem', lineHeight: 1.7, opacity: 0.55 }}>
                  좌측에서 이미지를 업로드하고<br />Gemini 분석을 실행하세요
                </p>
              </div>
            )}

            {analysis && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.7rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', paddingBottom: '0.5rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: '#4ade80', display: 'block' }} />
                  <span style={{ fontSize: '0.7rem', color: '#4ade80', fontWeight: 700, fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.06em' }}>분석 완료</span>
                </div>



                {Array.isArray(analysis.colorPalette) && analysis.colorPalette.length > 0 && (
                  <div style={{ background: 'rgba(180,197,255,0.04)', border: '1px solid rgba(180,197,255,0.1)', borderRadius: '9px', padding: '0.6rem 0.75rem' }}>
                    <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '7px' }}>추출된 팔레트</div>
                    <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                      {analysis.colorPalette.map((c, i) => (
                        <div key={i} title={c} style={{ width: '28px', height: '28px', borderRadius: '6px', background: c.startsWith('#') ? c : '#555', border: '1px solid rgba(255,255,255,0.12)' }} />
                      ))}
                    </div>
                  </div>
                )}

                {[
                  { label: '비율', icon: 'aspect_ratio', value: analysis.headBodyRatio },
                  { label: '배경', icon: 'wallpaper', value: analysis.background },
                  { label: '자세', icon: 'accessibility', value: analysis.pose },
                  { label: '피부톤', icon: 'palette', value: analysis.skinTone },
                  { label: '디테일', icon: 'tune', value: analysis.detailDensity },
                ].filter(a => a.value && !a.value.toLowerCase?.().includes('n/a')).map(({ label, icon, value }) => (
                  <div key={label} style={{ background: 'rgba(180,197,255,0.04)', border: '1px solid rgba(180,197,255,0.09)', borderRadius: '8px', padding: '0.45rem 0.7rem', display: 'flex', gap: '0.5rem', alignItems: 'flex-start' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '2px', flexShrink: 0 }}>{icon}</span>
                    <div>
                      <div style={{ fontSize: '0.58rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '1px' }}>{label}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 600, lineHeight: 1.3 }}>{value}</div>
                    </div>
                  </div>
                ))}

                {Array.isArray(analysis.forbiddenElements) && analysis.forbiddenElements.length > 0 && (
                  <div style={{ background: 'rgba(255,80,80,0.05)', border: '1px solid rgba(255,80,80,0.14)', borderRadius: '8px', padding: '0.45rem 0.7rem' }}>
                    <div style={{ fontSize: '0.58rem', color: '#ff8a80', fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '4px' }}>🚫 금지 요소</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>
                      {analysis.forbiddenElements.join(' · ')}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 프롬프트 + 생성버튼 하단 고정 */}
          <div style={{ borderTop: '1px solid var(--border)', flexShrink: 0, padding: '1rem', background: 'rgba(255,255,255,0.015)', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.63rem', fontWeight: 700, color: 'var(--text-muted)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.82rem' }}>edit_note</span>
                생성 프롬프트
                {analysis && <span style={{ color: '#4ade80', fontWeight: 700, fontSize: '0.58rem' }}>· 자동 생성됨</span>}
              </span>
              <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>{prompt.length}자</span>
            </div>
            <textarea id="imagelab-prompt-editor" value={prompt} onChange={e => setPrompt(e.target.value)} rows={5}
              placeholder={!refFile ? '이미지를 먼저 업로드하세요.' : !analysis ? 'Gemini 분석 후 자동 생성됩니다. 직접 입력도 가능합니다.' : '분석 완료. 프롬프트를 자유롭게 수정하세요.'}
              style={{
                width: '100%', padding: '0.7rem 0.8rem',
                background: 'var(--bg-surface-2)',
                border: `1px solid ${prompt.trim() ? 'rgba(180,197,255,0.22)' : 'var(--border)'}`,
                borderRadius: '9px', color: 'var(--text-primary)', fontSize: '0.78rem',
                fontFamily: 'Inter, sans-serif', resize: 'none', outline: 'none',
                lineHeight: 1.6, boxSizing: 'border-box', transition: 'border-color 0.2s',
              }} />
            <button id="imagelab-generate-btn" onClick={() => handleGenerate()} disabled={!prompt.trim() || isGenerating}
              style={{
                width: '100%', padding: '0.72rem',
                borderRadius: '10px',
                background: (!prompt.trim() || isGenerating) ? 'rgba(180,197,255,0.07)' : 'linear-gradient(135deg, #6228D7 0%, #EE2A7B 100%)',
                color: (!prompt.trim() || isGenerating) ? 'var(--text-muted)' : '#fff',
                border: 'none', cursor: (!prompt.trim() || isGenerating) ? 'not-allowed' : 'pointer',
                fontWeight: 700, fontSize: '0.87rem',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.45rem',
                boxShadow: (!prompt.trim() || isGenerating) ? 'none' : '0 3px 18px rgba(98,40,215,0.4)',
                transition: 'all 0.2s',
              }}>
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>
                {isGenerating ? 'hourglass_empty' : 'auto_awesome'}
              </span>
              {isGenerating ? '생성 중...' : `✦ ${currentPreset.icon} ${currentPreset.label} 생성`}
            </button>
          </div>
        </div>

        {/* ══ COL 3: 이미지 생성 결과 */}
        <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'rgba(0,0,0,0.12)' }}>
          <div style={{ height: '44px', flexShrink: 0, borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', padding: '0 1.25rem', background: 'rgba(255,255,255,0.015)' }}>
            <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--brand)', marginRight: '0.4rem' }}>auto_fix_high</span>
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>생성 결과</span>
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

          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'auto', padding: '2rem' }}>
            {generatedUrl ? (
              <img src={generatedUrl} alt="생성 결과" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: '14px', boxShadow: '0 10px 48px rgba(0,0,0,0.5)' }} />
            ) : isGenerating ? (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '3rem', marginBottom: '1rem', animation: 'thinking-glow-pulse 1.5s ease-in-out infinite' }}>🎨</div>
                <div style={{ fontWeight: 700, color: '#b4c5ff', marginBottom: '0.4rem', fontSize: '1rem' }}>{currentPreset.icon} 생성 중...</div>
                <div style={{ fontSize: '0.78rem' }}>Imagen 3가 렌더링하고 있어요</div>
              </div>
            ) : (
              <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '4rem', opacity: 0.1 }}>image</span>
                <p style={{ fontSize: '0.82rem', marginTop: '1rem', lineHeight: 1.7, opacity: 0.45 }}>
                  프롬프트를 확인하고<br />생성 버튼을 눌러주세요
                </p>
              </div>
            )}
          </div>

          {generatedUrl && (
            <div style={{ padding: '0.7rem 1.25rem', borderTop: '1px solid var(--border)', background: 'rgba(255,255,255,0.02)', flexShrink: 0, display: 'flex', gap: '0.6rem', alignItems: 'center' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.9rem', color: 'var(--text-muted)', flexShrink: 0 }}>edit</span>
              <input value={inlineEdit} onChange={e => setInlineEdit(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && inlineEdit.trim() && handleGenerate(inlineEdit)}
                placeholder="수정 요청 입력 후 Enter... (예: 눈을 더 크게)"
                style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: 'var(--text-primary)', fontSize: '0.8rem', fontFamily: 'Inter, sans-serif' }} />
              <button onClick={() => inlineEdit.trim() && handleGenerate(inlineEdit)} disabled={!inlineEdit.trim() || isGenerating}
                style={{ padding: '4px 12px', borderRadius: '6px', border: 'none', background: inlineEdit.trim() ? 'var(--brand)' : 'rgba(255,255,255,0.05)', color: inlineEdit.trim() ? '#fff' : 'var(--text-muted)', cursor: inlineEdit.trim() ? 'pointer' : 'not-allowed', fontSize: '0.75rem', fontWeight: 600, flexShrink: 0 }}>
                재생성 →
              </button>
            </div>
          )}
        </div>

        {/* ══ COL 4: 품질 평가 패널 */}
        <div style={{ borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '1.25rem 1rem', gap: '0.8rem', background: 'rgba(255,255,255,0.01)' }}>
          {/* 헤더 + AUTO/MANUAL 토글 */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <span className="material-symbols-outlined" style={{ fontSize: '0.88rem' }}>star</span>
              품질 평가 루브릭
            </div>

            {/* AUTO / MANUAL 토글 */}
            <button
              onClick={() => setAutoLearnMode(m => !m)}
              title={autoLearnMode ? '자동학습 ON → 클릭하면 수동 전환' : '수동학습 → 클릭하면 자동 전환'}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                padding: '3px 8px', borderRadius: '20px',
                border: `1px solid ${autoLearnMode ? 'rgba(100,246,150,0.35)' : 'rgba(255,255,255,0.12)'}`,
                background: autoLearnMode ? 'rgba(74,222,128,0.1)' : 'rgba(255,255,255,0.04)',
                cursor: 'pointer', transition: 'all 0.2s',
                fontSize: '0.62rem', fontWeight: 700,
                color: autoLearnMode ? '#4ade80' : 'var(--text-muted)',
              }}
            >
              {/* 토글 스위치 도트 */}
              <div style={{
                width: '22px', height: '12px', borderRadius: '6px',
                background: autoLearnMode ? 'rgba(74,222,128,0.4)' : 'rgba(255,255,255,0.1)',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{
                  position: 'absolute', top: '2px',
                  left: autoLearnMode ? '12px' : '2px',
                  width: '8px', height: '8px', borderRadius: '50%',
                  background: autoLearnMode ? '#4ade80' : '#666',
                  transition: 'left 0.18s',
                }} />
              </div>
              {autoLearnMode ? 'AUTO' : 'MANUAL'}
            </button>
          </div>

          <div style={{ padding: '5px 10px', borderRadius: '7px', fontSize: '0.72rem', fontWeight: 700, background: 'rgba(100,100,246,0.12)', color: '#a0a8ff', border: '1px solid rgba(100,100,246,0.25)', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {currentPreset.icon} {currentPreset.label}
            <span style={{ opacity: 0.55, fontWeight: 400 }}>· {currentPreset.desc}</span>
          </div>

          {RUBRIC_DIMS.map(dim => (
            <div key={dim.id} style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)', borderRadius: '9px', padding: '0.65rem 0.75rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.4rem' }}>
                <span className="material-symbols-outlined" style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{dim.icon}</span>
                <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>{dim.label}</span>
              </div>
              <StarRating value={scores[dim.id]} onChange={v => setScores(s => ({ ...s, [dim.id]: v }))} dimId={dim.id} />
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '4px' }}>{dim.desc}</div>
            </div>
          ))}

          {avgScore && (
            <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '0.75rem', border: `1px solid ${scoreColor}44`, textAlign: 'center' }}>
              <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', marginBottom: '3px' }}>평균 점수</div>
              <div style={{ fontSize: '1.9rem', fontWeight: 800, color: scoreColor, fontFamily: 'Space Grotesk' }}>{avgScore}</div>
              <div style={{ fontSize: '0.72rem', color: scoreColor, marginTop: '3px' }}>
                {avgScore >= 4 ? '🏆 Winner 후보' : avgScore >= 3 ? '🔄 개선 필요' : '⛔ Failure Case'}
              </div>
            </div>
          )}

          <div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', fontFamily: 'Space Grotesk', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: '5px' }}>개선 메모</div>
            <textarea value={memo} onChange={e => setMemo(e.target.value)} rows={3}
              placeholder="예: 배경이 투명하지 않음, 눈 표현 다름..."
              style={{ width: '100%', padding: '0.55rem 0.7rem', background: 'var(--bg-surface-2)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '0.75rem', fontFamily: 'Inter', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
          </div>

          <button
            id="imagelab-learn-btn"
            onClick={autoLearnMode ? undefined : handleLearn}
            disabled={autoLearnMode || !avgScore || isLearning || learnResult === 'ok'}
            style={{
              width: '100%', padding: '0.65rem',
              borderRadius: '9px',
              border: learnResult === 'ok'
                ? '1px solid rgba(74,222,128,0.3)'
                : isAutoLearning
                  ? '1px solid rgba(180,197,255,0.25)'
                  : autoLearnMode
                    ? '1px solid rgba(255,255,255,0.06)'
                    : '1px solid var(--border)',
              background: learnResult === 'ok'
                ? 'rgba(74,222,128,0.12)'
                : isAutoLearning
                  ? 'rgba(180,197,255,0.08)'
                  : isLearning
                    ? 'rgba(255,255,255,0.04)'
                    : !avgScore || autoLearnMode
                      ? 'rgba(255,255,255,0.03)'
                      : 'rgba(180,197,255,0.1)',
              cursor: (!autoLearnMode && avgScore && !isLearning && learnResult !== 'ok') ? 'pointer' : 'not-allowed',
              color: learnResult === 'ok'
                ? '#4ade80'
                : isAutoLearning || isLearning
                  ? '#b4c5ff'
                  : !avgScore
                    ? 'var(--text-muted)'
                    : autoLearnMode
                      ? 'rgba(255,255,255,0.25)'
                      : 'var(--text-primary)',
              fontSize: '0.82rem', fontWeight: 600,
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
              transition: 'all 0.2s',
            }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
              {learnResult === 'ok' ? 'check_circle' : isAutoLearning ? 'hourglass_empty' : isLearning ? 'sync' : 'school'}
            </span>
            {learnResult === 'ok'
              ? (autoLearnMode ? '⚡ 자동 학습 완료' : '✅ 학습 완료')
              : isLearning
                ? '저장 중...'
                : isAutoLearning
                  ? '⚡ 2초 후 자동 학습...'
                  : autoLearnMode
                    ? '⚡ AUTO 학습 대기 중'
                    : 'SKILL.md에 학습'
            }
          </button>

          {learnResult === 'error' && (
            <div style={{ fontSize: '0.72rem', color: '#ff6b6b', textAlign: 'center' }}>⚠ {errorMsg}</div>
          )}
        </div>

      </div>
    </div>
  );
}
