// src/components/Views/ImageLabView.jsx — 🎨 Image Lab v2.0
// Mode A: 트레이닝 랩 (NanoBanana 학습, LoRA 데이터 수집)
// Mode B: 브랜드 스튜디오 (고지능 모델 활용, 소시안 브랜드 에셋 생성)
// 2026-04-21 v2.0
import { useState, useRef, useCallback, useEffect } from 'react';
import { useUiStore } from '../../store/uiStore';
// html-to-image: npm install html-to-image 설치 후 사용
import { toPng } from 'html-to-image';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:4000';

// ── Brand Studio 데이터 (프론트 표시용) ─────────────────────────────────────
// 브랜드 커스텀 컬러 레이블 (3슬롯)
const CUSTOM_COLOR_LABELS = ['주색', '강조색', '보조색'];
const DEFAULT_CUSTOM_COLORS = ['#1A1A2E', '#E94560', '#F5F5F5'];


const CONTENT_TYPES = [
  { id: 'feed',    label: '인스타 피드',  icon: 'grid_on',       ratio: '1:1',  badge: '1080×1080' },
  { id: 'reels',   label: '릴스 썸네일', icon: 'play_circle',   ratio: '9:16', badge: '1080×1920' },
  { id: 'product', label: '제품 광고',   icon: 'shopping_bag',  ratio: '4:5',  badge: '1080×1350' },
  { id: 'blog',    label: '블로그 헤더', icon: 'article',       ratio: '16:9', badge: '1280×720'  },
  { id: 'carousel', label: '인스타 캐러셀', icon: 'view_carousel', ratio: '4:5', badge: '1080×1350' },
];

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

// ── Imagen 3 스타일 카탈로그 ─────────────────────────────────────────────────
const IMAGEN_STYLE_CATALOG = [
  {
    id: 'photo', category: '사진 & 실사', icon: '📷',
    styles: [
      { label: '극사실주의',  backendId: 'realistic', hint: 'hyperrealism, ultra-detailed photorealistic render, skin pores visible, fabric texture, micro detail' },
      { label: '스튜디오',    backendId: 'realistic', hint: 'studio photography, clean background, professional product photo, perfect lighting setup' },
      { label: '필름 사진',   backendId: 'realistic', hint: '35mm analog film photography, film grain, vintage kodak look, soft halation, retro vibe' },
      { label: '흑백 사진',   backendId: 'realistic', hint: 'black and white photography, dramatic high contrast, monochrome, classic editorial' },
      { label: '매크로',      backendId: 'realistic', hint: 'macro photography, extreme close-up detail, shallow depth of field, beautiful bokeh' },
      { label: '야생/풍경',   backendId: 'realistic', hint: 'National Geographic wildlife photography, nature landscape, golden hour, natural light' },
    ]
  },
  {
    id: 'painting', category: '회화 & 미술', icon: '🎨',
    styles: [
      { label: '유화',   backendId: 'custom', hint: 'oil painting style, impasto brushstrokes, rich deep colors, expressive texture, Van Gogh style' },
      { label: '수채화', backendId: 'custom', hint: 'watercolor painting, soft transparent color washes, delicate bleeding edges, paper texture visible' },
      { label: '스케치', backendId: 'custom', hint: 'pencil sketch, hand-drawn illustration, ink pen line art, cross-hatching shading' },
      { label: '동양화', backendId: 'custom', hint: 'Korean traditional ink wash painting, sumi-e brush style, minhwa folk art, oriental calligraphy' },
      { label: '팝아트', backendId: 'custom', hint: 'pop art, halftone dots, Andy Warhol bold flat colors, Roy Lichtenstein comic style, screenprint' },
      { label: '판화',   backendId: 'custom', hint: 'woodblock print, linocut texture, etching style, vintage printmaking, hand-carved look' },
    ]
  },
  {
    id: 'illustration', category: '일러스트', icon: '🖌️',
    styles: [
      { label: '벡터 일러스트',   backendId: 'illustration', hint: null },
      { label: '플랫 아이콘',     backendId: 'flatminimal',  hint: null },
      { label: '3D 렌더',         backendId: 'toy3d',        hint: null },
      { label: '아이소메트릭',    backendId: 'custom', hint: 'isometric illustration, 2.5D axonometric projection, geometric 3D style, equal angle view' },
      { label: '동화책 일러스트', backendId: 'custom', hint: 'storybook illustration, children book art, soft whimsical colors, gentle fantasy scene' },
      { label: '클레이',          backendId: 'custom', hint: 'claymation style, clay texture, stop motion feel, handmade clay figures, soft matte plastic' },
    ]
  },
  {
    id: 'anime', category: '만화 & 애니', icon: '🌏',
    styles: [
      { label: '애니메이션',   backendId: 'custom', hint: 'anime style illustration, manga art, large expressive eyes, Japanese animation, clean cel shading' },
      { label: '카툰',         backendId: 'custom', hint: 'cartoon animation style, Disney Pixar look, cute exaggerated proportions, bright cheerful colors' },
      { label: '코믹북',       backendId: 'custom', hint: 'American comic book, bold black outlines, Marvel DC superhero art, dynamic dramatic shadows' },
      { label: '동화 일러스트', backendId: 'custom', hint: 'storybook fairy tale illustration, Pixar concept, magical world, soft color palette' },
    ]
  },
  {
    id: 'digital', category: 'SF & 디지털', icon: '🤖',
    styles: [
      { label: '사이버펑크',   backendId: 'custom', hint: 'cyberpunk aesthetic, neon lights, rain-soaked futuristic city, dark atmosphere, neon glow reflections' },
      { label: '컨셉 아트',    backendId: 'custom', hint: 'concept art, epic fantasy game art, cinematic dramatic lighting, world-building illustration' },
      { label: '스팀펑크',     backendId: 'custom', hint: 'steampunk, Victorian era gears and cogs, brass machinery, retro-futuristic, sepia tone' },
      { label: '베이퍼웨이브', backendId: 'custom', hint: 'vaporwave aesthetic, retro 80s 90s digital, pastel pink and blue, lo-fi nostalgia, CRT screen effect' },
      { label: '글리치 아트',  backendId: 'custom', hint: 'glitch art style, digital distortion, RGB color separation, scan lines, corrupted data visual' },
    ]
  },
  {
    id: 'material', category: '특수 소재', icon: '🏺',
    styles: [
      { label: '클레이메이션',  backendId: 'custom', hint: 'claymation, clay sculpture texture, plasticine material, stop motion animation feel' },
      { label: '종이 공예',     backendId: 'custom', hint: 'papercraft art, paper cutting, quilling layers, origami-inspired, layered paper depth' },
      { label: '자수/뜨개',     backendId: 'custom', hint: 'embroidery texture, knitting pattern, textile fabric art, thread stitching, handmade craft' },
      { label: '유리/크리스탈', backendId: 'custom', hint: 'glass crystal material, transparent refraction, light dispersion prism, crystal clear gem' },
    ]
  },
  {
    id: 'freeform', category: '직접 입력', icon: '✏️',
    styles: [
      { label: '커스텀', backendId: 'custom', hint: null, isCustomInput: true },
    ]
  },
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

  // ─ 모드: 'training' | 'studio'
  const [labMode, setLabMode] = useState('studio');

  // ─ 브랜드 스튜디오 상태 ─────────────────────────────────────────────────
  const [brandPalettes, setBrandPalettes] = useState(() => {
    try {
      const saved = localStorage.getItem('imagelab_brand_palettes');
      if (saved) return JSON.parse(saved);
    } catch (e) { console.error('Failed to load brand palettes', e); }
    return [{ id: 1, name: '기본 브랜드', colors: [...DEFAULT_CUSTOM_COLORS], active: true, folded: true }];
  });
  
  useEffect(() => {
    localStorage.setItem('imagelab_brand_palettes', JSON.stringify(brandPalettes));
  }, [brandPalettes]);

  const [editingHex, setEditingHex] = useState(null);
  const [extractingColor, setExtractingColor] = useState(false);

  const handleLinkExtractColors = async () => {
    const url = window.prompt("색상을 추출할 웹사이트 링크를 입력하세요:", "https://");
    if (!url) return;
    
    setExtractingColor(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/imagelab/extract-colors`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      let extractedColors = data.colors || [];
      while (extractedColors.length < 3) extractedColors.push('#ffffff');

      let hostname = '새 브랜드';
      try { hostname = new URL(url.startsWith('http') ? url : `https://${url}`).hostname; } catch(e){}

      const newPalette = {
        id: Date.now(),
        name: hostname,
        colors: extractedColors.slice(0, 3), // 딱 3개만 사용
        active: true,
        folded: false
      };
      
      setBrandPalettes(prev => prev.map(p => ({ ...p, active: false })).concat(newPalette));
    } catch (e) {
      alert(`색상 추출 실패: ${e.message}`);
    } finally {
      setExtractingColor(false);
    }
  };

  const addBrandPalette = () => {
    setBrandPalettes(prev => [...prev, {
      id: Date.now(), name: `새 브랜드 ${prev.length + 1}`,
      colors: [...DEFAULT_CUSTOM_COLORS],
      active: true, folded: false
    }]);
  };

  const handleStudioRefresh = () => {
    if (!window.confirm("모든 설정과 생성된 코드/결과가 초기화됩니다. 계속하시겠습니까?")) return;
    setStudioRefFile(null);
    setStudioRefPreview('');
    setStudioSelectedStyles([]);
    setStudioAnalysisOk(false);
    setBrandDesc('');
    setHtmlCode('');
    setBrandResult(null);
    setLumiDirecting(false);
    setHtmlEditMode(false);
    setGenMode('image');
    setResultTab('ai-image');
  };

  const codeTextareaRef = useRef(null); // 코드박스 스크롤용
  const [contentType,    setContentType]    = useState('feed');
  const [brandDesc,      setBrandDesc]      = useState('');
  const [lumiDirecting,  setLumiDirecting]  = useState(false);
  const [lumiUpgrading,  setLumiUpgrading]  = useState(false); // 프롬프트 고도화 진행 상태

  // 프롬프트 고도화: 현재 brandDesc를 Lumi API로 즉시 업그레이드
  const handleLumiUpgrade = async () => {
    if (!brandDesc.trim() || lumiUpgrading) return;
    setLumiUpgrading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/imagelab/brand-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: brandDesc,
          brandPresetId: 'custom',
          brandColors: brandPalettes.find(p => p.active)?.colors || DEFAULT_CUSTOM_COLORS,
          contentType,
          lumiDirecting: true, // 항상 Lumi 모드
          upgradeOnly: true,   // 서버에서 이미지 생성 안함, 컨셉만 요청
        }),
      });
      const data = await res.json();
      // lumiConcept가 있으면 textarea를 교체
      if (data.lumiConcept) {
        setBrandDesc(data.lumiConcept);
      }
      setLumiDirecting(true); // 고도화 후에는 Lumi 모드 ON 유지
    } catch (e) {
      console.error('[LumiUpgrade]', e.message);
    } finally {
      setLumiUpgrading(false);
    }
  };
  const [brandGenerating,setBrandGenerating]= useState(false);
  const [brandResult,    setBrandResult]    = useState(null);
  const [brandError,     setBrandError]     = useState('');
  const [archiveItems,   setArchiveItems]   = useState([]);
  const [archiveLoading, setArchiveLoading] = useState(false);
  const [archiveTab,     setArchiveTab]     = useState('generate');
  const [archivingSrc,   setArchivingSrc]   = useState(false);

  // ─ 브랜드 스튜디오: 레퍼런스 이미지 분석 상태 ──────────────────────────────
  const studioFileRef     = useRef(null);
  const [studioRefFile,   setStudioRefFile]   = useState(null);
  const [studioRefPreview,setStudioRefPreview]= useState(null);
  const [studioStyle,     setStudioStyle]     = useState('illustration'); // 분석 스타일
  const [studioAnalyzing, setStudioAnalyzing] = useState(false);
  const [studioAnalysisOk,setStudioAnalysisOk]= useState(false); // 분석 성공 상태 표시
  const [studioRefDragging,setStudioRefDragging]= useState(false);

  // ── 클립보드 이미지 붙여넣기 핸들러 (전역 + 드롭존 onPaste 공용) ──────────
  const handlePasteImage = useCallback((e) => {
    const items = (e.clipboardData || e.nativeEvent?.clipboardData)?.items;
    if (!items) return;
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) {
          setStudioRefFile(file);
          setStudioRefPreview(URL.createObjectURL(file));
          setStudioAnalysisOk(false);
          e.preventDefault();
        }
        break;
      }
    }
  }, []);

  // 어디서든 Ctrl+V 가능하도록 window에 paste 이벤트 등록
  useEffect(() => {
    window.addEventListener('paste', handlePasteImage);
    return () => window.removeEventListener('paste', handlePasteImage);
  }, [handlePasteImage]);
  const [studioCustomStyle,setStudioCustomStyle]= useState(''); // 커스텀 스타일 힌트 입력창
  const [studioCatId,      setStudioCatId]      = useState('illustration'); // 카탈로그 선택 카테고리
  const [studioSelectedStyles, setStudioSelectedStyles] = useState([
    { label: '벡터 일러스트', backendId: 'illustration', hint: null }
  ]); // 다중 선택(최대 2개)
  const [studioDropdownOpen, setStudioDropdownOpen] = useState(null); // 드롭다운 열린 카테고리 ID

  // ─ Brand Studio: HTML 디자인 모드 상태 ─────────────────────────────────
  const [genMode,         setGenMode]         = useState('image');  // 'image' | 'html'
  const [htmlCode,        setHtmlCode]        = useState('');
  const [htmlGenerating,  setHtmlGenerating]  = useState(false);
  const [htmlError,       setHtmlError]       = useState('');
  const [htmlRetryIn,     setHtmlRetryIn]     = useState(0);  // 카운트다운 (초)
  const htmlPreviewRef = useRef(null); // 이미지 캐청용 ref
  const [resultTab,     setResultTab]     = useState('ai-image'); // 'ai-image' | 'html'
  const [htmlEditMode,  setHtmlEditMode]  = useState(false);       // HTML 편집 모드

  // ─ Brand Studio: 아카이브 로드 ────────────────────────────────────────────
  const loadArchive = useCallback(async () => {
    setArchiveLoading(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/imagelab/archive`);
      const data = await res.json();
      if (data.items) setArchiveItems(data.items);
    } catch { /* 무시 */ }
    finally { setArchiveLoading(false); }
  }, []);

  // ─ 결과 탭 자동 전환 및 동기화 ───────────────────────────────────────────────
  useEffect(() => { if (brandResult?.imageUrl) { setResultTab('ai-image'); setGenMode('image'); } }, [brandResult]);
  useEffect(() => { if (htmlCode)              { setResultTab('html');     setGenMode('html');  } }, [htmlCode]);

  useEffect(() => {
    if (genMode === 'image') setResultTab('ai-image');
    else if (genMode === 'html') setResultTab('html');
  }, [genMode]);

  useEffect(() => {
    if (resultTab === 'ai-image') setGenMode('image');
    else if (resultTab === 'html') setGenMode('html');
  }, [resultTab]);

  // ─ HTML 편집모드: 진입 시 innerHTML 초기화 ─────────────────────────────────
  useEffect(() => {
    if (htmlEditMode && htmlPreviewRef.current) {
      htmlPreviewRef.current.innerHTML = htmlCode;
    }
  }, [htmlEditMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleHtmlEdit = () => {
    if (!htmlEditMode) {
      setHtmlEditMode(true);
      setHtmlElProps({ text: '', fontSize: 16, fontFamily: 'Inter', color: '#ffffff', background: '#000000', borderRadius: 0, tag: '', hasBg: false });
    } else {
      if (htmlSelectedElRef.current) {
        htmlSelectedElRef.current.style.outline = '';
        htmlSelectedElRef.current.style.outlineOffset = '';
        htmlSelectedElRef.current = null;
      }
      if (htmlPreviewRef.current) setHtmlCode(htmlPreviewRef.current.innerHTML);
      setHtmlEditMode(false);
      setHtmlElProps({ text: '', fontSize: 16, fontFamily: 'Inter', color: '#ffffff', background: '#000000', borderRadius: 0, tag: '', hasBg: false });
    }
  };

  // HTML 편집: 클릭 인스펙터 ─────────────────────────────────────────────────
  const htmlSelectedElRef = useRef(null);
  const [htmlElProps, setHtmlElProps] = useState({ text: '', fontSize: 16, fontFamily: 'Inter', color: '#ffffff', background: '#000000', borderRadius: 0, tag: '', hasBg: false, scaleX: 100, skewX: 0, scale: 100 });

  const rgbToHex = (rgb) => {
    if (!rgb || rgb === 'transparent' || rgb === 'rgba(0, 0, 0, 0)') return null;
    const m = rgb.match(/\d+/g);
    if (!m || m.length < 3) return null;
    if (m.length >= 4 && Number(m[3]) === 0) return null;
    return '#' + m.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
  };

  const dragState = useRef({ isDragging: false, startX: 0, startY: 0, elStartLeft: 0, elStartTop: 0, el: null, scale: 1 });

  const handleEditClick = (e) => {
    if (!htmlEditMode) return;
    const el = e.target;
    if (el === htmlPreviewRef.current) return;
    if (htmlSelectedElRef.current && htmlSelectedElRef.current !== el) {
      htmlSelectedElRef.current.style.outline = '';
      htmlSelectedElRef.current.style.outlineOffset = '';
    }
    el.style.outline = '2px solid #ff6b6b';
    el.style.outlineOffset = '2px';
    htmlSelectedElRef.current = el;
    const cs = window.getComputedStyle(el);
    let directText = '';
    for (const child of el.childNodes) {
      if (child.nodeType === Node.TEXT_NODE && child.textContent.trim()) { directText = child.textContent.trim(); break; }
    }
    if (!directText && el.children.length === 0) directText = el.textContent;
    const bgHex = rgbToHex(cs.backgroundColor);
    let scaleX = 100, skewX = 0, scale = 100;
    const transformStr = cs.transform !== 'none' ? cs.transform : el.style.transform;
    if (transformStr && transformStr !== 'none') {
      const scaleMatch = el.style.transform.match(/scale\(([^)]+)\)/);
      if (scaleMatch) scale = parseFloat(scaleMatch[1].split(',')[0]) * 100;
      const skewMatch = el.style.transform.match(/skewX\(([^deg)]+)deg\)/);
      if (skewMatch) skewX = parseFloat(skewMatch[1]);
      const scaleXMatch = el.style.transform.match(/scaleX\(([^)]+)\)/);
      if (scaleXMatch) scaleX = parseFloat(scaleXMatch[1]) * 100;
    }
    setHtmlElProps({
      text: directText,
      fontSize: Math.round(parseFloat(cs.fontSize)) || 16,
      fontFamily: cs.fontFamily ? cs.fontFamily.replace(/['"]/g, '').split(',')[0] : 'Inter',
      color: rgbToHex(cs.color) || '#ffffff',
      background: bgHex || '#111111',
      hasBg: !!bgHex,
      borderRadius: Math.round(parseFloat(cs.borderRadius)) || 0,
      tag: el.tagName.toLowerCase(),
      scaleX: Math.round(scaleX) || 100,
      skewX: Math.round(skewX) || 0,
      scale: Math.round(scale) || 100,
    });
    // 코드박스를 해당 요소 줄로 스크롤
    scrollCodeToElement(el);
  };

  const handlePointerDown = (e) => {
    if (!htmlEditMode) return;
    handleEditClick(e);
    const el = e.target;
    if (el === htmlPreviewRef.current) return;

    // Convert to relative position if static
    const cs = window.getComputedStyle(el);
    let left = parseFloat(cs.left);
    let top = parseFloat(cs.top);
    if (cs.position === 'static') {
      el.style.position = 'relative';
      left = 0;
      top = 0;
    } else {
      if (isNaN(left)) left = 0;
      if (isNaN(top)) top = 0;
    }

    // Get current preview scale
    const ct = CONTENT_TYPES.find(c => c.id === contentType);
    const w = ct ? Number(ct.badge.replace('×','x').split('x')[0]) || 1080 : 1080;
    const scale = Math.min(1, 520 / w);

    dragState.current = {
      isDragging: true,
      startX: e.clientX,
      startY: e.clientY,
      elStartLeft: left,
      elStartTop: top,
      el: el,
      scale: scale
    };
  };

  const handlePointerMove = useCallback((e) => {
    if (!dragState.current.isDragging || !dragState.current.el || !htmlEditMode) return;
    if (e.buttons !== 1) { // Left click released outside
      dragState.current.isDragging = false;
      return;
    }
    const { startX, startY, elStartLeft, elStartTop, el, scale } = dragState.current;
    const dx = (e.clientX - startX) / scale;
    const dy = (e.clientY - startY) / scale;
    el.style.left = `${elStartLeft + dx}px`;
    el.style.top = `${elStartTop + dy}px`;
  }, [htmlEditMode]);

  const handlePointerUp = useCallback(() => {
    if (dragState.current.isDragging) {
      dragState.current.isDragging = false;
    }
  }, []);

  useEffect(() => {
    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
    };
  }, [handlePointerMove, handlePointerUp]);


  const applyElProp = (prop, value) => {
    const el = htmlSelectedElRef.current;
    if (!el) return;
    switch (prop) {
      case 'fontSize': el.style.fontSize = value + 'px'; break;
      case 'fontFamily': el.style.fontFamily = value; break;
      case 'color': el.style.color = value; break;
      case 'background': el.style.backgroundColor = value; break;
      case 'borderRadius': el.style.borderRadius = value + 'px'; break;
      case 'scale': 
      case 'scaleX':
      case 'skewX': {
        const p = { ...htmlElProps, [prop]: value };
        // We preserve translation if any, by reading it, but for simplicity HTML designs use absolute/left so translate is generally unused.
        el.style.transform = `scale(${p.scale/100}) scaleX(${p.scaleX/100}) skewX(${p.skewX}deg)`;
        break;
      }
      case 'text': {
        let replaced = false;
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) { child.textContent = value; replaced = true; break; }
        }
        if (!replaced) el.textContent = value;
        break;
      }
      default: break;
    }
    setHtmlElProps(prev => ({ ...prev, [prop]: value }));
  };

  // ─ 코드박스 스크롤: 클릭한 요소에 해당하는 줄로 이동 ─────────────────────
  const scrollCodeToElement = useCallback((el) => {
    const ta = codeTextareaRef.current;
    if (!ta) return;
    // Edit 모드에서는 DOM live innerHTML 사용 (state가 stale할 수 있으므로)
    const liveCode = (htmlEditMode && htmlPreviewRef.current)
      ? htmlPreviewRef.current.innerHTML
      : htmlCode;
    if (!liveCode) return;
    const lines = liveCode.split('\n');
    let targetLine = -1;
    // 0순위: data-lumi-id — Gemini가 생성 시 부여한 1:1 식별자 (가장 정확)
    const lumiId = el.getAttribute?.('data-lumi-id');
    if (lumiId) targetLine = lines.findIndex(l => l.includes(`data-lumi-id="${lumiId}"`));
    // 1순위: id 속성
    if (targetLine === -1 && el.id) targetLine = lines.findIndex(l => l.includes(`id="${el.id}"`));
    // 2순위: class 첫 번째 값
    if (targetLine === -1 && el.className && typeof el.className === 'string') {
      const cls = el.className.trim().split(/\s+/)[0];
      if (cls) targetLine = lines.findIndex(l => l.includes(cls));
    }
    // 3순위: 텍스트 일치 (최대 40자)
    if (targetLine === -1) {
      const txt = el.textContent?.trim().slice(0, 40);
      if (txt) targetLine = lines.findIndex(l => l.includes(txt));
    }
    if (targetLine === -1) return;
    // 줄 높이 계산 후 스크롤
    const lineH = ta.scrollHeight / Math.max(lines.length, 1);
    ta.scrollTop = Math.max(0, (targetLine - 3) * lineH);
    // 해당 줄 선택 하이라이트
    const charStart = lines.slice(0, targetLine).join('\n').length + (targetLine > 0 ? 1 : 0);
    const charEnd = charStart + (lines[targetLine]?.length || 0);
    ta.focus({ preventScroll: true });
    ta.setSelectionRange(charStart, charEnd);
  }, [htmlCode, htmlEditMode]);

  // 스타일 선택은 IMAGEN_STYLE_CATALOG(외부 상수) 사용

  /** 스타일 칩 토글 — 최대 2개, 초과 시 가장 오래된 것 교체 */
  const toggleStyle = (item) => {
    setStudioSelectedStyles(prev => {
      const exists = prev.find(s => s.label === item.label);
      let next;
      if (exists) {
        next = prev.filter(s => s.label !== item.label);           // 선택 해제
      } else if (prev.length >= 2) {
        next = [prev[1], item];                                    // 오래된 것 빼고 추가
      } else {
        next = [...prev, item];                                    // 추가
      }
      // studioStyle / studioCustomStyle 동기화
      if (next.length === 0) {
        setStudioStyle('illustration'); setStudioCustomStyle('');
      } else if (next.length === 1) {
        setStudioStyle(next[0].backendId);
        setStudioCustomStyle(next[0].hint || '');
      } else {
        // 2개 조합 → custom 모드로, 두 힌트 결합
        setStudioStyle('custom');
        setStudioCustomStyle(next.map(s => s.hint || s.label).join('. '));
      }
      return next;
    });
    setStudioAnalysisOk(false);
  };

  const handleStudioAnalyze = async () => {
    if (!studioRefFile) return;
    setStudioAnalyzing(true); setStudioAnalysisOk(false);
    try {
      // studioSelectedStyles 기반으로 최종 스타일 파라미터 결정
      let finalStyleId, finalHint;
      if (studioSelectedStyles.length === 0) {
        finalStyleId = 'illustration'; finalHint = '';
      } else if (studioSelectedStyles.length === 1) {
        finalStyleId = studioSelectedStyles[0].backendId;
        finalHint    = studioSelectedStyles[0].hint || '';
      } else {
        // 2개 스타일 조합 → custom with combined prompt
        finalStyleId = 'custom';
        finalHint    = studioSelectedStyles.map(s => s.hint || s.label).join('. ');
      }
      const formData = new FormData();
      formData.append('image', studioRefFile);
      formData.append('stylePresetId', finalStyleId);
      if (finalStyleId === 'custom' && finalHint.trim()) {
        formData.append('customStyleHint', finalHint.trim());
      } else if (studioCatId === 'freeform' && studioCustomStyle.trim()) {
        formData.append('customStyleHint', studioCustomStyle.trim());
      }
      const res = await fetch(`${SERVER_URL}/api/imagelab/analyze`, { method: 'POST', body: formData });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '분석 실패');
      // 생성된 프롬프트를 브랜드 설명 input에 자동 주입
      if (data.generatedPrompt) {
        setBrandDesc(data.generatedPrompt);
        setStudioAnalysisOk(true);
        setTimeout(() => setStudioAnalysisOk(false), 3000);
      }
    } catch (err) {
      setBrandError(`분석 오류: ${err.message}`);
    } finally {
      setStudioAnalyzing(false);
    }
  };

  // ─ Brand Studio: 이미지 생성 ──────────────────────────────────────────────
  const handleBrandGenerate = async () => {
    if (!brandDesc.trim()) return;
    setBrandGenerating(true); setBrandError(''); setBrandResult(null);
    try {
      const res = await fetch(`${SERVER_URL}/api/imagelab/brand-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: brandDesc,
          brandPresetId: 'custom',
          brandColors: brandPalettes.find(p => p.active)?.colors || DEFAULT_CUSTOM_COLORS,
          contentType,
          lumiDirecting,
          // 콘텐츠 유형에 맞는 이미지 사이즈 전달
          imageSize: (() => {
            const ct = CONTENT_TYPES.find(c => c.id === contentType);
            if (!ct) return { width: 1080, height: 1080 };
            const [w, h] = ct.badge.replace('×','x').split('x').map(Number);
            return { width: w || 1080, height: h || 1080 };
          })(),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '생성 실패');
      setBrandResult(data);
    } catch (err) {
      setBrandError(err.message);
    } finally {
      setBrandGenerating(false);
    }
  };

  // ─ Brand Studio: HTML 디자인 생성 ────────────────────────────────────────
  const handleHtmlGenerate = async () => {
    if (!brandDesc.trim()) return;
    setHtmlGenerating(true); setHtmlError(''); setHtmlCode(''); setHtmlRetryIn(0);
    setResultTab('html'); // 즉시 HTML 탭으로 전환
    try {
      const ct = CONTENT_TYPES.find(c => c.id === contentType);
      const [w, h] = ct ? ct.badge.replace('×','x').split('x').map(Number) : [1080, 1080];
      // customColors 배열을 직접 사용

      const res = await fetch(`${SERVER_URL}/api/imagelab/html-generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: brandDesc,
          width: w, height: h,
          colors: brandPalettes.find(p => p.active)?.colors || DEFAULT_CUSTOM_COLORS,
          brandName: '\ube0c\ub79c\ub4dc',
          contentLabel: ct?.label || '\ud53c\ub4dc',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        // 429: retryAfterSec 카운트다운 시작
        if (data.retryAfterSec) {
          setHtmlRetryIn(data.retryAfterSec);
          const timer = setInterval(() => {
            setHtmlRetryIn(prev => {
              if (prev <= 1) { clearInterval(timer); return 0; }
              return prev - 1;
            });
          }, 1000);
        }
        throw new Error(data.error || 'HTML 생성 실패');
      }
      setHtmlCode(data.html);
    } catch (err) {
      setHtmlError(err.message);
    } finally {
      setHtmlGenerating(false);
    }
  };


  // ─ Brand Studio: HTML → PNG 다운로드 ────────────────────────────────────
  const handleHtmlDownload = async () => {
    if (!htmlPreviewRef.current) return;
    // ── ① 모든 outline 임시 제거 (선택 표시 + contentEditable 아웃라인) ────
    const allOutlined = [];
    htmlPreviewRef.current.querySelectorAll('*').forEach(el => {
      if (el.style.outline || el.style.outlineOffset) {
        allOutlined.push({ el, outline: el.style.outline, offset: el.style.outlineOffset });
        el.style.outline = 'none';
        el.style.outlineOffset = '0';
      }
    });
    if (htmlSelectedElRef.current) {
      htmlSelectedElRef.current.style.outline = 'none';
      htmlSelectedElRef.current.style.outlineOffset = '0';
    }
    try {
      const ct = CONTENT_TYPES.find(c => c.id === contentType);
      const [w, h] = ct ? ct.badge.replace('×','x').split('x').map(Number) : [1080, 1080];
      const dataUrl = await toPng(htmlPreviewRef.current, {
        width: w, height: h, pixelRatio: 2,
        style: { transform: 'none', transformOrigin: 'top left', outline: 'none' },
      });
      const a = document.createElement('a');
      a.download = `design-${contentType}-${Date.now()}.png`;
      a.href = dataUrl;
      a.click();
    } catch (err) {
      setHtmlError('이미지 저장 실패: ' + err.message);
    } finally {
      // ── ② 아웃라인 복원 (edit 모드 계속 중이라면 선택 상태 유지) ──────────
      allOutlined.forEach(({ el, outline, offset }) => {
        el.style.outline = outline;
        el.style.outlineOffset = offset;
      });
    }
  };


  const handleArchive = async () => {
    if (!brandResult?.imageUrl) return;
    setArchivingSrc(true);
    try {
      const res = await fetch(`${SERVER_URL}/api/imagelab/archive`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: brandResult.imageUrl, contentType, brandPresetId: brandPreset, description: brandDesc }),
      });
      if (res.ok) {
        await loadArchive();
        setArchiveTab('archive');
      }
    } catch { /* 무시 */ }
    finally { setArchivingSrc(false); }
  };

  // ─ Brand Studio: 아카이브 삭제 ────────────────────────────────────────────
  const handleArchiveDelete = async (id) => {
    await fetch(`${SERVER_URL}/api/imagelab/archive/${id}`, { method: 'DELETE' });
    setArchiveItems(prev => prev.filter(i => i.id !== id));
  };

  // 소시안 이미지 풀 (Full Auto Loop용)

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
    <div className="imagelab-root" style={{
      position: 'fixed', inset: 0, zIndex: 8000,
      background: 'var(--bg-base)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
    }}>

      {/* ══ 탑바 ══════════════════════════════════════════════════════════ */}
      <div className="imagelab-header" style={{
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
        }}>v2.0</span>

        {/* ── 모드 전환 탭 ── */}
        <div style={{ display: 'flex', gap: '2px', padding: '2px', borderRadius: '8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', marginLeft: '0.5rem' }}>
          {[
            { id: 'training', icon: 'model_training', label: '트레이닝 랩', tip: '학습 루프' },
            { id: 'studio',   icon: 'brush', label: '디자인 스튜디오', tip: '에셋 생성' },
          ].map(m => (
            <button
              key={m.id}
              id={`imagelab-mode-${m.id}`}
              title={m.tip}
              onClick={() => { setLabMode(m.id); if (m.id === 'studio') loadArchive(); }}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '4px 12px', borderRadius: '6px', border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', fontWeight: 600, transition: 'all 0.15s',
                background: labMode === m.id ? 'rgba(100,100,246,0.25)' : 'transparent',
                color: labMode === m.id ? '#c4caff' : 'var(--text-muted)',
              }}
            >
              <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>{m.icon}</span>
              {m.label}
            </button>
          ))}
        </div>

        {/* 리프레시 버튼 */}
        {labMode === 'studio' && (
          <button
            onClick={handleStudioRefresh}
            title="스튜디오 초기화"
            style={{
              display: 'flex', alignItems: 'center', gap: '4px',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '6px', padding: '4px 10px', marginLeft: '0.5rem',
              cursor: 'pointer', color: 'var(--text-muted)',
              fontSize: '0.72rem', fontWeight: 600, transition: 'all 0.15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = 'var(--text-muted)'; }}
          >
            <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>refresh</span>
            살제
          </button>
        )}

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



      {/* ══ BRAND STUDIO MODE ════════════════════════════════════════════════ */}
      {labMode === 'studio' && (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', gap: 0 }}>

          {/* ── 좌측 패널: 설정 */}
          <div style={{
            width: '260px', flexShrink: 0,
            borderRight: '1px solid var(--border)',
            overflowY: 'auto', padding: '1.25rem 1rem',
            display: 'flex', flexDirection: 'column', gap: '1.25rem',
            background: 'rgba(255,255,255,0.01)',
          }}>

            {/* ── 레퍼런스 이미지 분석 섹션 ── */}
            <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: '1.1rem' }}>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.55rem', fontFamily: 'Space Grotesk', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '0.82rem' }}>📸</span> 레퍼런스 이미지 분석
              </div>

              {/* 이미지 업로드 드롭존 */}
              <div
                onDrop={e => { e.preventDefault(); setStudioRefDragging(false); const f = e.dataTransfer.files[0]; if (f?.type.startsWith('image/')) { setStudioRefFile(f); setStudioRefPreview(URL.createObjectURL(f)); setStudioAnalysisOk(false); } }}
                onDragOver={e => { e.preventDefault(); setStudioRefDragging(true); }}
                onDragLeave={() => setStudioRefDragging(false)}
                onPaste={handlePasteImage}
                onClick={() => studioFileRef.current?.click()}
                tabIndex={0}
                style={{
                  border: `2px dashed ${studioRefDragging ? 'var(--brand)' : studioRefPreview ? 'rgba(180,197,255,0.35)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: '10px', cursor: 'pointer',
                  background: studioRefDragging ? 'rgba(100,100,246,0.06)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s', overflow: 'hidden',
                  minHeight: studioRefPreview ? 'auto' : '80px',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  marginBottom: '0.55rem',
                  outline: 'none',
                }}
              >
                {studioRefPreview ? (
                  <img src={studioRefPreview} alt="레퍼런스" style={{ width: '100%', display: 'block', maxHeight: '130px', objectFit: 'contain' }} />
                ) : (
                  <div style={{ textAlign: 'center', padding: '1rem 0.75rem', color: 'var(--text-muted)' }}>
                    <span className="material-symbols-outlined" style={{ fontSize: '1.5rem', opacity: 0.3 }}>add_photo_alternate</span>
                    <div style={{ fontSize: '0.65rem', marginTop: '0.3rem' }}>드래그 · 클릭 · Ctrl+V</div>
                  </div>
                )}
              </div>
              <input ref={studioFileRef} type="file" accept="image/*" style={{ display: 'none' }}
                onChange={e => { const f = e.target.files[0]; if (f) { setStudioRefFile(f); setStudioRefPreview(URL.createObjectURL(f)); setStudioAnalysisOk(false); } }} />

              {/* ── 스타일 선택: 3×2 그리드 버튼 + 드롭다운 ─────────────── */}
              <div style={{ fontSize: '0.6rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase', letterSpacing: '0.07em' }}>스타일 선택 <span style={{ opacity: 0.5 }}>(최대 2개 조합)</span></div>

              {/* 6개 카테고리 버튼 3×2 그리드 */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.25rem', marginBottom: '0.3rem' }}>
                {IMAGEN_STYLE_CATALOG.filter(c => c.id !== 'freeform').map(cat => {
                  const selInCat = studioSelectedStyles.find(s => cat.styles.some(cs => cs.label === s.label));
                  const isOpen = studioDropdownOpen === cat.id;
                  const btnLabel = selInCat ? selInCat.label : cat.icon;
                  return (
                    <div key={cat.id} style={{ position: 'relative' }}>
                      <button
                        onClick={() => setStudioDropdownOpen(isOpen ? null : cat.id)}
                        title={cat.category}
                        style={{
                          width: '100%', padding: '0.28rem 0.2rem',
                          borderRadius: '7px', cursor: 'pointer',
                          fontSize: selInCat ? '0.62rem' : '1rem',
                          fontWeight: selInCat ? 700 : 400,
                          background: selInCat ? 'rgba(100,100,246,0.18)' : isOpen ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.02)',
                          border: `1px solid ${selInCat ? 'rgba(100,100,246,0.5)' : isOpen ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.07)'}`,
                          color: selInCat ? '#c4caff' : 'var(--text-muted)',
                          transition: 'all 0.15s',
                          textAlign: 'center', overflow: 'hidden',
                          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          lineHeight: 1.2,
                        }}
                      >
                        {btnLabel}
                      </button>

                      {/* 드롭다운 */}
                      {isOpen && (
                        <div style={{
                          position: 'absolute', top: 'calc(100% + 3px)', left: 0,
                          minWidth: '130px', zIndex: 200,
                          background: '#13131f',
                          border: '1px solid rgba(100,100,246,0.35)',
                          borderRadius: '9px', overflow: 'hidden',
                          boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
                        }}>
                          <div style={{ padding: '0.3rem 0.6rem', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: '0.6rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                            {cat.icon} {cat.category}
                          </div>
                          {cat.styles.map(item => {
                            const selIdx = studioSelectedStyles.findIndex(s => s.label === item.label);
                            const isSelected = selIdx !== -1;
                            const is2nd = selIdx === 1;
                            return (
                              <button
                                key={item.label}
                                onClick={() => { toggleStyle(item); setStudioDropdownOpen(null); }}
                                style={{
                                  display: 'flex', alignItems: 'center', gap: '0.4rem',
                                  width: '100%', padding: '0.38rem 0.65rem',
                                  textAlign: 'left', cursor: 'pointer',
                                  background: isSelected
                                    ? is2nd ? 'rgba(251,191,36,0.12)' : 'rgba(100,100,246,0.15)'
                                    : 'transparent',
                                  border: 'none',
                                  borderBottom: '1px solid rgba(255,255,255,0.04)',
                                  color: isSelected ? (is2nd ? '#fbbf24' : '#c4caff') : 'var(--text-secondary)',
                                  fontSize: '0.72rem', fontWeight: isSelected ? 700 : 400,
                                  transition: 'background 0.1s',
                                }}
                              >
                                {isSelected && <span style={{ fontSize: '0.55rem', fontWeight: 900, opacity: 0.8 }}>{selIdx + 1}</span>}
                                {item.label}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* 직접 입력 버튼 (freeform) */}
              <div style={{ position: 'relative', marginBottom: '0.35rem' }}>
                <button
                  onClick={() => setStudioDropdownOpen(studioDropdownOpen === 'freeform' ? null : 'freeform')}
                  style={{
                    width: '100%', padding: '0.25rem 0.5rem',
                    borderRadius: '7px', cursor: 'pointer', fontSize: '0.67rem',
                    background: studioCatId === 'freeform' ? 'rgba(255,255,255,0.06)' : 'transparent',
                    border: '1px solid rgba(255,255,255,0.07)',
                    color: 'var(--text-muted)', textAlign: 'center',
                  }}
                >
                  ✏️ 직접 입력
                </button>
                {studioDropdownOpen === 'freeform' && (
                  <div style={{
                    position: 'absolute', top: 'calc(100% + 3px)', left: 0, right: 0, zIndex: 200,
                    background: '#13131f', border: '1px solid rgba(255,255,255,0.12)',
                    borderRadius: '9px', padding: '0.5rem',
                    boxShadow: '0 8px 28px rgba(0,0,0,0.6)',
                  }}>
                    <input
                      id="studio-custom-style-input"
                      autoFocus
                      value={studioCustomStyle}
                      onChange={e => { setStudioCustomStyle(e.target.value); setStudioStyle('custom'); setStudioCatId('freeform'); }}
                      onKeyDown={e => { if (e.key === 'Enter') setStudioDropdownOpen(null); }}
                      placeholder="스타일 입력 후 Enter (예: 80년대 레트로 포스터)"
                      style={{
                        width: '100%', boxSizing: 'border-box',
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(180,197,255,0.2)',
                        borderRadius: '6px', padding: '0.4rem 0.6rem',
                        color: 'var(--text-primary)', fontSize: '0.72rem',
                        fontFamily: 'Inter, sans-serif', outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>

              {/* 선택된 스타일 태그 표시 */}
              {studioSelectedStyles.length > 0 && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '0.25rem', flexWrap: 'wrap',
                  marginBottom: '0.4rem', padding: '0.2rem 0.45rem',
                  background: 'rgba(100,100,246,0.05)',
                  borderRadius: '6px', border: '1px solid rgba(100,100,246,0.12)',
                }}>
                  <span style={{ fontSize: '0.62rem', color: 'var(--text-muted)', flexShrink: 0 }}>선택:</span>
                  {studioSelectedStyles.map((s, i) => (
                    <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: '3px' }}>
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700,
                        color: i === 0 ? '#c4caff' : '#fbbf24',
                        padding: '1px 5px', borderRadius: '4px',
                        background: i === 0 ? 'rgba(100,100,246,0.15)' : 'rgba(251,191,36,0.12)',
                      }}>{s.label}</span>
                      {i < studioSelectedStyles.length - 1 && <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)' }}>+</span>}
                    </span>
                  ))}
                  {studioSelectedStyles.length === 2 && <span style={{ fontSize: '0.58rem', color: '#a78bfa', marginLeft: 'auto' }}>조합</span>}
                </div>
              )}

              {/* 이미지 분석 버튼 — 하단 고정 */}
              <button
                id="studio-analyze-btn"
                onClick={handleStudioAnalyze}
                disabled={!studioRefFile || studioAnalyzing}
                style={{
                  width: '100%', padding: '0.55rem',
                  borderRadius: '8px', cursor: !studioRefFile || studioAnalyzing ? 'not-allowed' : 'pointer',
                  background: studioAnalysisOk
                    ? 'rgba(74,222,128,0.15)'
                    : !studioRefFile || studioAnalyzing
                      ? 'rgba(255,255,255,0.04)'
                      : 'rgba(180,197,255,0.1)',
                  border: `1px solid ${ studioAnalysisOk ? 'rgba(74,222,128,0.35)' : 'rgba(180,197,255,0.18)' }`,
                  color: studioAnalysisOk ? '#4ade80' : !studioRefFile ? 'var(--text-muted)' : 'var(--text-primary)',
                  fontSize: '0.8rem', fontWeight: 700,
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem',
                  transition: 'all 0.2s', opacity: !studioRefFile ? 0.4 : 1,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
                  {studioAnalyzing ? 'hourglass_empty' : studioAnalysisOk ? 'check_circle' : 'image_search'}
                </span>
                {studioAnalyzing ? 'AI 분석 중...' : studioAnalysisOk ? '✅ 프롬프트 자동 입력됨!' : '이미지 분석'}
              </button>
            </div>


            {/* 브랜드 팔레트 */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', fontFamily: 'Space Grotesk' }}>브랜드 팔레트</div>
                <button onClick={addBrandPalette} style={{ background: 'none', border: 'none', color: '#a0a8ff', cursor: 'pointer', fontSize: '0.65rem', fontWeight: 700, display: 'flex', alignItems: 'center' }}><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>add</span> 추가</button>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                {brandPalettes.map(palette => (
                  <div key={palette.id} style={{ borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: `1px solid ${palette.active ? 'rgba(100,100,246,0.3)' : 'rgba(255,255,255,0.07)'}`, overflow: 'hidden' }}>
                    {/* 팔레트 헤더 (접힌 상태) */}
                    <div style={{ display: 'flex', alignItems: 'center', padding: '0.4rem 0.6rem', cursor: 'pointer' }} onClick={() => setBrandPalettes(prev => prev.map(p => p.id === palette.id ? { ...p, folded: !p.folded } : p))}>
                      <input type="checkbox" checked={palette.active}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setBrandPalettes(prev => prev.map(p => p.id === palette.id ? { ...p, active: e.target.checked } : p))}
                        style={{ marginRight: '0.4rem', cursor: 'pointer' }}
                      />
                      <input
                        value={palette.name}
                        onClick={e => e.stopPropagation()}
                        onChange={e => setBrandPalettes(prev => prev.map(p => p.id === palette.id ? { ...p, name: e.target.value } : p))}
                        style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '0.75rem', fontWeight: 600, outline: 'none', width: '90px' }}
                      />
                      <div style={{ display: 'flex', gap: '2px', marginRight: '0.3rem' }}>
                        {palette.colors.map((c, i) => <div key={i} style={{ width: '12px', height: '12px', borderRadius: '3px', background: c }} />)}
                      </div>
                      <span className="material-symbols-outlined" style={{ fontSize: '1rem', color: 'var(--text-muted)' }}>{palette.folded ? 'expand_more' : 'expand_less'}</span>
                      <div style={{ flex: 1 }} />
                    </div>

                    {/* 팔레트 본문 (펼친 상태) */}
                    {!palette.folded && (
                      <div style={{ padding: '0.5rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                          {palette.colors.map((color, idx) => (
                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <label style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}>
                                <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: color, border: '1px solid rgba(255,255,255,0.2)' }} />
                                <input type="color" value={color}
                                  onChange={e => setBrandPalettes(prev => prev.map(p => p.id === palette.id ? { ...p, colors: p.colors.map((c, i) => i === idx ? e.target.value : c) } : p))}
                                  style={{ position: 'absolute', top: 0, left: 0, width: '24px', height: '24px', opacity: 0, cursor: 'pointer' }}
                                />
                              </label>
                              <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                                {editingHex?.id === palette.id && editingHex?.idx === idx ? (
                                  <input autoFocus value={editingHex.val}
                                    onChange={e => setEditingHex({ ...editingHex, val: e.target.value })}
                                    onBlur={() => {
                                      const validHex = /^#[0-9A-Fa-f]{6}$/i.test(editingHex.val) ? editingHex.val : color;
                                      setBrandPalettes(prev => prev.map(p => p.id === palette.id ? { ...p, colors: p.colors.map((c, i) => i === idx ? validHex : c) } : p));
                                      setEditingHex(null);
                                    }}
                                    onKeyDown={e => { if (e.key === 'Enter') e.target.blur(); }}
                                    style={{ width: '60px', background: '#000', border: '1px solid var(--brand)', color: '#fff', fontSize: '0.65rem', padding: '2px', outline: 'none' }}
                                  />
                                ) : (
                                  <div
                                    onDoubleClick={() => setEditingHex({ id: palette.id, idx, val: color })}
                                    style={{ fontSize: '0.65rem', color: '#c4caff', fontFamily: 'monospace', cursor: 'text' }}
                                    title="더블클릭하여 수정"
                                  >
                                    {color.toUpperCase()}
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                        {brandPalettes.length > 1 && (
                          <div style={{ marginTop: '0.5rem', display: 'flex', justifyContent: 'space-between' }}>
                            <button onClick={() => setBrandPalettes(prev => prev.filter(p => p.id !== palette.id))} style={{ fontSize: '0.6rem', color: '#ff6b6b', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>삭제</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{ marginTop: '0.4rem' }}>
                <button
                  onClick={handleLinkExtractColors}
                  disabled={extractingColor}
                  style={{
                    width: '100%', padding: '0.4rem', borderRadius: '6px',
                    background: extractingColor ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.04)', 
                    border: '1px solid rgba(255,255,255,0.1)',
                    color: extractingColor ? '#c4caff' : 'var(--text-muted)', fontSize: '0.7rem', 
                    cursor: extractingColor ? 'not-allowed' : 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px', transition: 'background 0.2s',
                  }}
                  onMouseEnter={e => !extractingColor && (e.currentTarget.style.background = 'rgba(255,255,255,0.08)')}
                  onMouseLeave={e => !extractingColor && (e.currentTarget.style.background = 'rgba(255,255,255,0.04)')}
                >
                   <span className="material-symbols-outlined" style={{ fontSize: '0.95rem' }}>
                    {extractingColor ? 'sync' : 'link'}
                   </span> 
                   {extractingColor ? '추출 중...' : '링크로 추출'}
                </button>
              </div>
            </div>


            {/* 콘텐츠 유형 */}
            <div>
              <div style={{ fontSize: '0.65rem', fontWeight: 700, color: 'var(--text-muted)', letterSpacing: '0.09em', textTransform: 'uppercase', marginBottom: '0.55rem', fontFamily: 'Space Grotesk' }}>콘텐츠 유형</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {CONTENT_TYPES.map(ct => (
                  <button
                    key={ct.id}
                    id={`content-type-${ct.id}`}
                    onClick={() => setContentType(ct.id)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '0.45rem 0.75rem', borderRadius: '8px',
                      border: `1px solid ${contentType === ct.id ? 'rgba(100,100,246,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      background: contentType === ct.id ? 'rgba(100,100,246,0.12)' : 'transparent',
                      cursor: 'pointer', color: contentType === ct.id ? '#c4caff' : 'var(--text-muted)',
                      fontSize: '0.78rem', fontWeight: contentType === ct.id ? 600 : 400,
                      transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>{ct.icon}</span>
                      {ct.label}
                    </div>
                    <span style={{ fontSize: '0.6rem', background: 'rgba(255,255,255,0.06)', padding: '1px 5px', borderRadius: '4px', fontFamily: 'Space Grotesk', letterSpacing: '0.03em' }}>{ct.badge}</span>
                  </button>
                ))}
              </div>
            </div>

          </div>

          {/* ── 중앙 패널: 생성 영역 */}
          <div style={{ width: '380px', flexShrink: 0, borderRight: '1px solid var(--border)', overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>

            {/* 내부 탭 */}
            <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border)', paddingBottom: '0.75rem' }}>
              {[{ id: 'generate', label: '✨ 생성' }, { id: 'archive', label: `📦 아카이브 (${archiveItems.length})` }].map(t => (
                <button key={t.id} onClick={() => { setArchiveTab(t.id); if (t.id === 'archive') loadArchive(); }}
                  style={{
                    padding: '5px 14px', borderRadius: '7px', border: 'none', cursor: 'pointer',
                    background: archiveTab === t.id ? 'rgba(100,100,246,0.2)' : 'transparent',
                    color: archiveTab === t.id ? '#c4caff' : 'var(--text-muted)',
                    fontSize: '0.8rem', fontWeight: archiveTab === t.id ? 700 : 400,
                    transition: 'all 0.15s',
                  }}
                >{t.label}</button>
              ))}
            </div>

            {archiveTab === 'generate' && (
              <>
                {/* ── 생성 모드 토글 ─── */}
                <div style={{ display: 'flex', gap: '4px', marginBottom: '1rem', background: 'rgba(255,255,255,0.03)', borderRadius: '10px', padding: '3px' }}>
                  {[
                    { id: 'image', icon: '🖼', label: 'AI 이미지' },
                    { id: 'html',  icon: '💻', label: 'HTML 디자인' },
                  ].map(m => (
                    <button
                      key={m.id}
                      onClick={() => { setGenMode(m.id); setResultTab(m.id === 'image' ? 'ai-image' : 'html'); }}
                      style={{
                        flex: 1, padding: '0.4rem', borderRadius: '7px', border: 'none', cursor: 'pointer',
                        background: genMode === m.id ? 'rgba(100,100,246,0.25)' : 'transparent',
                        color: genMode === m.id ? '#c4caff' : 'var(--text-muted)',
                        fontSize: '0.8rem', fontWeight: genMode === m.id ? 700 : 400,
                        transition: 'all 0.15s',
                      }}
                    >{m.icon} {m.label}</button>
                  ))}
                </div>

                {/* 설명 입력 (공통) */}
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: '0.4rem' }}>
                    <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', fontFamily: 'Space Grotesk' }}>
                      {genMode === 'html' ? '어떤 디자인을 만들까요?' : '어떤 이미지를 만들까요?'}
                    </div>
                    {/* 프롬프트 고도화 버튼 */}
                    <button
                      onClick={handleLumiUpgrade}
                      disabled={lumiUpgrading || !brandDesc.trim()}
                      title={brandDesc.trim() ? 'Lumi가 입력한 프롬프트를 고급진으로 업그레이드' : '프롬프트를 먼저 입력하세요'}
                      className={lumiUpgrading ? 'lumi-rainbow-btn' : ''}
                      style={{
                        background: 'none', border: 'none',
                        cursor: lumiUpgrading || !brandDesc.trim() ? 'not-allowed' : 'pointer',
                        padding: '2px 4px', borderRadius: '4px',
                        display: 'flex', alignItems: 'center', gap: '3px',
                        fontSize: '0.65rem', fontWeight: 700,
                        color: lumiUpgrading ? 'transparent' : (lumiDirecting ? '#a4e8a7' : 'var(--text-muted)'),
                        transition: 'color 0.2s',
                        outline: 'none',
                        opacity: !brandDesc.trim() ? 0.4 : 1,
                        backgroundClip: lumiUpgrading ? 'text' : 'initial',
                        WebkitBackgroundClip: lumiUpgrading ? 'text' : 'initial',
                      }}
                    >
                      <span className="material-symbols-outlined" style={{
                        fontSize: '0.85rem',
                        animation: lumiUpgrading ? 'lumi-spin 1s linear infinite' : 'none',
                      }}>
                        {lumiUpgrading ? 'sync' : 'auto_awesome'}
                      </span>
                      {lumiUpgrading ? '고도화 중...' : '프롬프트 고도화'}
                    </button>
                  </div>
                  <textarea
                    id="brand-desc-input"
                    value={brandDesc}
                    onChange={e => setBrandDesc(e.target.value)}
                    placeholder={genMode === 'html'
                      ? '상단에 제품 이름, 중앙에 할인율 30%, 하단에 로고 추가. 핑크톤.'
                      : '한강변에서 휴식하는 여성. 봄 분위기.'}
                    rows={genMode === 'html' ? 5 : 9}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                        genMode === 'html' ? handleHtmlGenerate() : handleBrandGenerate();
                      }
                    }}
                    style={{
                      width: '100%', boxSizing: 'border-box',
                      background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: '10px', padding: '0.75rem 1rem',
                      color: 'var(--text-primary)', fontSize: '0.85rem', lineHeight: 1.6,
                      resize: 'vertical', fontFamily: 'Inter, sans-serif', outline: 'none',
                    }}
                  />
                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginTop: '4px' }}>Ctrl+Enter로 생성</div>
                </div>

                {/* ══ AI 이미지 모드 ══ */}
                {genMode === 'image' && (
                  <>
                    <button
                      id="brand-generate-btn"
                      onClick={handleBrandGenerate}
                      disabled={brandGenerating || !brandDesc.trim()}
                      style={{
                        padding: '0.75rem 1.5rem', borderRadius: '10px',
                        background: brandGenerating ? 'rgba(100,100,246,0.1)' : 'linear-gradient(135deg, rgba(100,100,246,0.3), rgba(180,197,255,0.2))',
                        border: '1px solid rgba(100,100,246,0.4)',
                        cursor: brandGenerating || !brandDesc.trim() ? 'not-allowed' : 'pointer',
                        color: '#c4caff', fontSize: '0.9rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        transition: 'all 0.2s', opacity: !brandDesc.trim() ? 0.5 : 1,
                      }}
                    >
                      {brandGenerating
                        ? <><span className="material-symbols-outlined" style={{ animation: 'spin 1s linear infinite' }}>sync</span> 생성 중...</>
                        : <><span className="material-symbols-outlined">brush</span> 디자인 에셋 생성</>}
                    </button>

                    {brandResult?.lumiConcept && (
                      <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(164,232,167,0.05)', border: '1px solid rgba(164,232,167,0.15)' }}>
                        <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a4e8a7', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🌿 Lumi 크리에이티브 컨셉</div>
                        <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.75)', lineHeight: 1.6 }}>{brandResult.lumiConcept}</div>
                      </div>
                    )}

                    {brandError && (
                      <div style={{ padding: '0.6rem 1rem', borderRadius: '8px', background: 'rgba(255,100,100,0.08)', border: '1px solid rgba(255,100,100,0.2)', fontSize: '0.8rem', color: '#ff8a8a' }}>
                        ⚠ {brandError}
                      </div>
                    )}
                  </>
                )}

                {/* ══ HTML 디자인 모드 ══ */}
                {genMode === 'html' && (
                  <>
                    {/* 생성 버튼 */}
                    <button
                      id="html-generate-btn"
                      onClick={handleHtmlGenerate}
                      disabled={htmlGenerating || !brandDesc.trim()}
                      style={{
                        padding: '0.75rem 1.5rem', borderRadius: '10px',
                        background: htmlGenerating ? 'rgba(100,100,246,0.1)' : 'linear-gradient(135deg, rgba(130,90,246,0.3), rgba(200,150,255,0.2))',
                        border: '1px solid rgba(150,100,246,0.45)',
                        cursor: htmlGenerating || !brandDesc.trim() ? 'not-allowed' : 'pointer',
                        color: '#d4b8ff', fontSize: '0.9rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                        transition: 'all 0.2s', opacity: !brandDesc.trim() ? 0.5 : 1,
                      }}
                    >
                      {htmlGenerating
                        ? <><span style={{ animation: 'spin 1s linear infinite', display: 'inline-block' }}>⟳</span> HTML 생성 중...</>
                        : <><span>💻</span> HTML 디자인 생성</>}
                    </button>

                    {htmlError && (
                      <div style={{ padding: '0.75rem 1rem', borderRadius: '8px', background: 'rgba(255,100,100,0.08)', border: '1px solid rgba(255,100,100,0.2)' }}>
                        <div style={{ fontSize: '0.8rem', color: '#ff8a8a', marginBottom: htmlRetryIn > 0 ? '0.5rem' : 0 }}>
                          ⚠ {htmlError}
                        </div>
                        {htmlRetryIn > 0 && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <div style={{ fontSize: '0.75rem', color: '#fbbf24', fontWeight: 700, background: 'rgba(251,191,36,0.1)', padding: '3px 10px', borderRadius: '20px', border: '1px solid rgba(251,191,36,0.3)' }}>
                              ⏱ {htmlRetryIn}초 후 재시도 가능
                            </div>
                          </div>
                        )}
                        {htmlRetryIn === 0 && htmlError && (
                          <button onClick={handleHtmlGenerate}
                            style={{ marginTop: '0.4rem', padding: '0.3rem 0.8rem', borderRadius: '6px', border: '1px solid rgba(150,100,246,0.4)', background: 'rgba(150,100,246,0.15)', color: '#d4b8ff', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600 }}
                          >↺ 다시 시도</button>
                        )}
                      </div>
                    )}

                    {/* ── 코드 에디터 (2열 고정) ── */}
                    {htmlCode && (
                      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>💡 HTML 코드 <span style={{ opacity: 0.5 }}>(직접 편집 가능)</span></span>
                          <span style={{ opacity: 0.5 }}>{htmlCode.length} chars</span>
                        </div>
                        <textarea
                          ref={codeTextareaRef}
                          value={htmlCode}
                          onChange={e => setHtmlCode(e.target.value)}
                          spellCheck={false}
                          style={{
                            flex: 1, minHeight: '240px', maxHeight: '420px',
                            width: '100%', boxSizing: 'border-box',
                            background: '#0a0a18', border: '1px solid rgba(150,100,246,0.2)',
                            borderRadius: '8px', padding: '0.65rem 0.75rem',
                            color: '#a4c8ff', fontSize: '0.72rem', lineHeight: 1.55,
                            fontFamily: '"Fira Code", "JetBrains Mono", monospace',
                            resize: 'vertical', outline: 'none',
                          }}
                        />
                        <div style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)', marginTop: '4px', textAlign: 'right' }}>
                          👆 우측 프리뷰 클릭 → 해당 줄 자동 이동
                        </div>
                      </div>
                    )}

                  </>
                )}

              </>
            )}


            {/* 아카이브 갤러리 */}
            {archiveTab === 'archive' && (
              <div>
                {archiveLoading ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.85rem' }}>로딩 중...</div>
                ) : archiveItems.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem', opacity: 0.4 }}>📦</div>
                    <div style={{ fontSize: '0.85rem' }}>아직 저장된 에셋이 없습니다</div>
                    <div style={{ fontSize: '0.72rem', marginTop: '0.4rem', opacity: 0.6 }}>생성 후 아카이브 저장을 눌러 보관하세요</div>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem' }}>
                    {archiveItems.map(item => (
                      <div key={item.id} style={{
                        borderRadius: '10px', overflow: 'hidden', position: 'relative',
                        border: '1px solid rgba(255,255,255,0.08)',
                        background: 'rgba(255,255,255,0.03)',
                        transition: 'all 0.15s',
                      }}>
                        <img src={`${SERVER_URL}${item.url}`} alt={item.description}
                          style={{ width: '100%', aspectRatio: '1', objectFit: 'cover', display: 'block' }} />
                        <div style={{ padding: '0.5rem 0.6rem' }}>
                          <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a0a8ff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{item.contentType}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '2px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.description || '—'}</div>
                          <div style={{ display: 'flex', gap: '4px', marginTop: '4px' }}>
                            <button
                              onClick={() => {
                                if (htmlPreviewRef.current) {
                                  const preview = htmlPreviewRef.current;
                                  const bgImg = preview.querySelector('img.bg-image') || preview.querySelector('img');
                                  if (bgImg) bgImg.src = `${SERVER_URL}${item.url}`;
                                  else {
                                    preview.style.backgroundImage = `url(${SERVER_URL}${item.url})`;
                                    preview.style.backgroundSize = 'cover';
                                    preview.style.backgroundPosition = 'center';
                                  }
                                  setHtmlCode(preview.innerHTML);
                                  setResultTab('html');
                                  setGenMode('html');
                                }
                              }}
                              style={{ flex: 1, fontSize: '0.6rem', color: '#4ade80', background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.2)', borderRadius: '4px', cursor: 'pointer', padding: '3px 0' }}
                            >배경 적용</button>
                            <button
                              onClick={() => handleArchiveDelete(item.id)}
                              style={{ flex: 1, fontSize: '0.6rem', color: '#ff6b6b', background: 'rgba(255,107,107,0.1)', border: '1px solid rgba(255,107,107,0.2)', borderRadius: '4px', cursor: 'pointer', padding: '3px 0' }}
                            >삭제</button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── 우측 패널: 결과 미리보기 (탭 분리) */}
          <div style={{
            flex: 1, minWidth: '460px',
            borderLeft: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            background: 'rgba(255,255,255,0.01)',
          }}>
            {/* 탭 헤더 */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', flexShrink: 0, alignItems: 'center' }}>
              {[{ id: 'ai-image', label: '🖼 AI 이미지' }, { id: 'html', label: '💻 HTML 디자인' }].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => { setResultTab(tab.id); if (htmlEditMode) { if (htmlPreviewRef.current) setHtmlCode(htmlPreviewRef.current.innerHTML); setHtmlEditMode(false); } }}
                  style={{
                    flex: 1, padding: '0.75rem 0.5rem',
                    background: resultTab === tab.id ? 'rgba(100,100,246,0.12)' : 'transparent',
                    border: 'none',
                    borderBottom: resultTab === tab.id ? '2px solid #6464F6' : '2px solid transparent',
                    color: resultTab === tab.id ? '#c4caff' : 'var(--text-muted)',
                    fontSize: '0.78rem', fontWeight: resultTab === tab.id ? 700 : 400,
                    cursor: 'pointer', transition: 'all 0.15s',
                  }}
                >{tab.label}</button>
              ))}
              {/* Edit / Save 버튼 — HTML 탭일 때만 + htmlCode가 있을 때 */}
              {resultTab === 'html' && htmlCode && (
                <button
                  onClick={toggleHtmlEdit}
                  title={htmlEditMode ? '편집 내용 저장' : '비주얼 편집 모드'}
                  style={{
                    padding: '0.45rem 0.85rem', marginRight: '0.5rem',
                    background: htmlEditMode ? 'rgba(74,222,128,0.18)' : 'rgba(100,100,246,0.15)',
                    border: `1px solid ${htmlEditMode ? 'rgba(74,222,128,0.45)' : 'rgba(100,100,246,0.4)'}`,
                    borderRadius: '6px', cursor: 'pointer',
                    color: htmlEditMode ? '#4ade80' : '#b4c5ff',
                    fontSize: '0.72rem', fontWeight: 700,
                    display: 'flex', alignItems: 'center', gap: '4px',
                    transition: 'all 0.15s', whiteSpace: 'nowrap',
                  }}
                >
                  {htmlEditMode
                    ? <><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>save</span> 저장</>
                    : <><span className="material-symbols-outlined" style={{ fontSize: '0.9rem' }}>edit</span> Edit</>}
                </button>
              )}
            </div>

            {/* AI 이미지 탭 */}
            {resultTab === 'ai-image' && (
            <div style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center' }}>
              {brandGenerating && (
                <div style={{ width: '100%', maxWidth: '480px', aspectRatio: '1', borderRadius: '16px', background: 'rgba(100,100,246,0.05)', border: '2px dashed rgba(100,100,246,0.2)', display: 'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.75rem' }}>
                  <span style={{ fontSize: '3rem', animation: 'spin 1.5s linear infinite', display:'inline-block' }}>✨</span>
                  <div style={{ fontSize: '1rem', color: '#a0a8ff', fontWeight: 700 }}>소시안 에셋 생성 중</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{lumiDirecting ? '🌿 Lumi 컨셉 → 이미지 변환 중...' : '브랜드 프롬프트 최적화 중...'}</div>
                </div>
              )}
              {brandResult?.imageUrl && !brandGenerating && (
                <div style={{ width: '100%', maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {brandResult.lumiConcept && (
                    <div style={{ padding: '0.75rem 1rem', borderRadius: '10px', background: 'rgba(164,232,167,0.06)', border: '1px solid rgba(164,232,167,0.18)' }}>
                      <div style={{ fontSize: '0.65rem', fontWeight: 700, color: '#a4e8a7', marginBottom: '0.3rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>🌿 Lumi 크리에이티브 컨셉</div>
                      <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.8)', lineHeight: 1.6 }}>{brandResult.lumiConcept}</div>
                    </div>
                  )}
                  <img
                    src={`${SERVER_URL}${brandResult.imageUrl}`}
                    alt="Brand Asset"
                    style={{ width: '100%', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.1)', display: 'block', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }}
                  />
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button
                      id="brand-archive-btn"
                      onClick={handleArchive}
                      disabled={archivingSrc}
                      style={{
                        flex: 1, padding: '0.7rem', borderRadius: '9px',
                        background: archivingSrc ? 'rgba(100,100,246,0.05)' : 'rgba(100,100,246,0.18)',
                        border: '1px solid rgba(100,100,246,0.35)',
                        cursor: archivingSrc ? 'not-allowed' : 'pointer',
                        color: '#c4caff', fontSize: '0.85rem', fontWeight: 700,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                        transition: 'all 0.15s',
                      }}
                      onMouseEnter={e => { if (!archivingSrc) e.currentTarget.style.background = 'rgba(100,100,246,0.28)'; }}
                      onMouseLeave={e => { if (!archivingSrc) e.currentTarget.style.background = 'rgba(100,100,246,0.18)'; }}
                    >
                      {archivingSrc ? '저장 중...' : <><span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>inventory_2</span> 아카이브 저장</>}
                    </button>
                    <a
                      href={`${SERVER_URL}${brandResult.imageUrl}`}
                      download="socian-asset.png"
                      style={{
                        padding: '0.7rem 1rem', borderRadius: '9px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        color: 'var(--text-secondary)', fontSize: '0.85rem', fontWeight: 600,
                        textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px',
                      }}
                    ><span className="material-symbols-outlined" style={{ fontSize: '1.2rem' }}>download</span> 다운로드</a>
                  </div>
                  {/* 프롬프트 정보 */}
                  <div style={{ padding: '0.6rem 0.75rem', borderRadius: '8px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
                    <div style={{ fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: '0.3rem' }}>
                      {brandResult.brandPreset} · {brandResult.contentType}
                    </div>
                    <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.35)', lineHeight: 1.5, wordBreak: 'break-word' }}>{brandResult.finalPrompt?.slice(0, 160)}...</div>
                  </div>
                </div>
              )}
              {!brandResult && !brandGenerating && (
                <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                  <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem', opacity: 0.25 }}>🎨</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.3rem' }}>소시안 에셋을 생성해보세요</div>
                  <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>컬러 톤 · 콘텐츠 유형 · 설명 입력 후 생성</div>
                </div>
              )}
            </div>
            )} {/* end resultTab === 'ai-image' */}

            {/* HTML 디자인 탭 */}
            {resultTab === 'html' && (() => {
              const ct = CONTENT_TYPES.find(c => c.id === contentType);
              const [pw, ph] = ct ? ct.badge.replace('×','x').split('x').map(Number) : [1080, 1080];
              const scale = Math.min(1, 520 / pw);
              const displayW = Math.round(pw * scale);
              const displayH = Math.round(ph * scale);
              return (
                <div style={{ flex: 1, overflowY: 'auto', padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {htmlGenerating && (
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', padding: '4rem 1rem' }}>
                      <span style={{ fontSize: '3rem', animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>💻</span>
                      <div style={{ fontSize: '1rem', color: '#d4b8ff', fontWeight: 700 }}>HTML 디자인 생성 중...</div>
                    </div>
                  )}
                  {!htmlCode && !htmlGenerating && (
                    <div style={{ textAlign: 'center', padding: '4rem 1rem', color: 'var(--text-muted)' }}>
                      <div style={{ fontSize: '3.5rem', marginBottom: '0.75rem', opacity: 0.25 }}>💻</div>
                      <div style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.3rem' }}>HTML 디자인을 생성해보세요</div>
                      <div style={{ fontSize: '0.75rem', opacity: 0.6 }}>2열에서 "HTML 디자인 생성" 버튼 클릭</div>
                    </div>
                  )}
                  {htmlCode && !htmlGenerating && (
                    <>
                      {/* 라이브 프리뷰 + 편집모드 툴바 */}

                      <div>
                        <div style={{ fontSize: '0.62rem', color: 'var(--text-muted)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{htmlEditMode ? '✏️ 편집 모드 — 클릭하여 텍스트 수정' : '👁 라이브 프리뷰'}</span>
                          <span style={{ opacity: 0.5 }}>{pw}×{ph}px (scale {Math.round(scale * 100)}%)</span>
                        </div>

                        {/* 클릭 인스펙터 패널 */}
                        {htmlEditMode && (
                          htmlElProps.tag ? (
                            <div style={{
                              padding: '0.65rem 0.85rem', marginBottom: '6px',
                              background: 'rgba(8,5,20,0.92)', borderRadius: '10px',
                              border: '1px solid rgba(255,107,107,0.35)',
                              display: 'flex', flexDirection: 'column', gap: '0.55rem',
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontSize: '0.6rem', fontWeight: 700, color: '#ff8a8a', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                                  ✓ 선택: &lt;{htmlElProps.tag}&gt;
                                </span>
                                <span style={{ fontSize: '0.6rem', color: 'rgba(255,255,255,0.25)' }}>Cmd+Z 실행취소</span>
                              </div>
                              {htmlElProps.text !== '' && (
                                <div>
                                  <div style={{ fontSize: '0.6rem', color: 'var(--text-muted)', marginBottom: '3px' }}>TT 텍스트</div>
                                  <input value={htmlElProps.text} onChange={e => applyElProp('text', e.target.value)}
                                    style={{ width: '100%', boxSizing: 'border-box', background: '#0d0d1a', border: '1px solid rgba(255,107,107,0.25)', borderRadius: '6px', padding: '0.35rem 0.6rem', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                                  />
                                </div>
                              )}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>서체</span>
                                <select
                                  value={htmlElProps.fontFamily}
                                  onChange={e => applyElProp('fontFamily', e.target.value)}
                                  style={{ flex: 1, background: '#0d0d1a', border: '1px solid rgba(255,107,107,0.25)', borderRadius: '4px', color: '#fff', fontSize: '0.7rem', padding: '3px 4px', outline: 'none' }}
                                >
                                  <option value="Inter">Inter</option>
                                  <option value="'Space Grotesk', sans-serif">Space Grotesk</option>
                                  <option value="'Noto Sans KR', sans-serif">Noto Sans KR</option>
                                  <option value="Pretendard, sans-serif">Pretendard</option>
                                  <option value="serif">Serif (클래식)</option>
                                </select>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>A 크기</span>
                                <input type="range" min="8" max="120" value={htmlElProps.fontSize}
                                  onChange={e => applyElProp('fontSize', Number(e.target.value))}
                                  style={{ flex: 1, accentColor: '#ff6b6b' }}
                                />
                                <span style={{ fontSize: '0.7rem', color: '#c4caff', width: '32px', textAlign: 'right' }}>{htmlElProps.fontSize}px</span>
                              </div>
                              <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                  글자색
                                  <input type="color" value={htmlElProps.color} onChange={e => applyElProp('color', e.target.value)}
                                    style={{ width: '30px', height: '22px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  />
                                </label>
                                <label style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '0.68rem', color: 'var(--text-muted)', cursor: 'pointer' }}>
                                  배경색
                                  <input type="color" value={htmlElProps.hasBg ? htmlElProps.background : '#111111'}
                                    onChange={e => { applyElProp('background', e.target.value); setHtmlElProps(p => ({ ...p, hasBg: true })); }}
                                    style={{ width: '30px', height: '22px', padding: 0, border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                  />
                                </label>
                                {htmlElProps.hasBg && (
                                  <button onClick={() => { applyElProp('background', 'transparent'); setHtmlElProps(p => ({ ...p, hasBg: false })); }}
                                    style={{ fontSize: '0.6rem', color: '#ff8a8a', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕ 배경 제거</button>
                                )}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>◻ 모서리</span>
                                <input type="range" min="0" max="60" value={htmlElProps.borderRadius}
                                  onChange={e => applyElProp('borderRadius', Number(e.target.value))}
                                  style={{ flex: 1, accentColor: '#a0a8ff' }}
                                />
                                <span style={{ fontSize: '0.7rem', color: '#c4caff', width: '32px', textAlign: 'right' }}>{htmlElProps.borderRadius}px</span>
                              </div>
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: '36px' }}>크기</span>
                                  <input type="range" min="30" max="300" value={htmlElProps.scale} onChange={e => applyElProp('scale', Number(e.target.value))} style={{ flex: 1, accentColor: '#ff6b6b' }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                                  <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: '36px' }}>가로비율</span>
                                  <input type="range" min="30" max="300" value={htmlElProps.scaleX} onChange={e => applyElProp('scaleX', Number(e.target.value))} style={{ flex: 1, accentColor: '#ff6b6b' }} />
                                </div>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.6rem', color: 'var(--text-muted)', width: '52px', flexShrink: 0 }}>기울기</span>
                                <input type="range" min="-60" max="60" value={htmlElProps.skewX} onChange={e => applyElProp('skewX', Number(e.target.value))} style={{ flex: 1, accentColor: '#ff6b6b' }} />
                                <span style={{ fontSize: '0.7rem', color: '#c4caff', width: '32px', textAlign: 'right' }}>{htmlElProps.skewX}°</span>
                              </div>
                            </div>
                          ) : (
                            <div style={{ padding: '0.6rem 0.75rem', marginBottom: '6px', borderRadius: '8px', background: 'rgba(0,0,0,0.2)', border: '1px dashed rgba(255,107,107,0.2)', fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
                              👆 클릭하여 요소를 선택하세요
                            </div>
                          )
                        )}

                        <div style={{
                          width: displayW, height: displayH,
                          overflow: 'hidden', borderRadius: '8px',
                          border: htmlEditMode ? '2px dashed #6464F6' : '1px solid rgba(150,100,246,0.2)',
                          position: 'relative',
                          boxShadow: htmlEditMode ? '0 0 0 3px rgba(100,100,246,0.15)' : 'none',
                          transition: 'all 0.2s',
                        }}>
                          <div
                            ref={htmlPreviewRef}
                            contentEditable={htmlEditMode}
                            suppressContentEditableWarning
                            onPointerDown={htmlEditMode ? handlePointerDown : undefined}
                            style={{
                              width: pw, height: ph,
                              transform: `scale(${scale})`,
                              transformOrigin: 'top left',
                              overflow: 'hidden',
                              outline: 'none',
                              cursor: htmlEditMode ? 'pointer' : 'default',
                            }}
                            {...(!htmlEditMode && { dangerouslySetInnerHTML: { __html: htmlCode } })}
                          />
                        </div>

                      </div>
                      {/* 다운로드 버튼 */}
                      <button
                        id="html-download-btn"
                        onClick={handleHtmlDownload}
                        style={{
                          padding: '0.65rem 1.2rem', borderRadius: '10px',
                          background: 'linear-gradient(135deg, rgba(74,222,128,0.2), rgba(34,197,94,0.15))',
                          border: '1px solid rgba(74,222,128,0.35)',
                          cursor: 'pointer', color: '#4ade80',
                          fontSize: '0.88rem', fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                          transition: 'all 0.2s',
                        }}
                      >
                        <span className="material-symbols-outlined" style={{ fontSize: '1rem' }}>download</span>
                        PNG로 다운로드 ({ct?.badge || '1080×1080'})
                      </button>
                    </>
                  )}
                </div>
              );
            })()}

          </div> {/* end 우측 패널 */}

          <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
        </div>
      )}


      {/* ══ TRAINING LAB MODE ════════════════════════════════════════════════ */}
      {labMode === 'training' && (
      <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '240px 300px 1fr 280px', overflow: 'hidden' }}>
        {/* ══ 메인 4컬럼 ════════════════════════════════════════════════════ */}

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
      )} {/* end labMode === 'training' */}
    </div>
  );
}
