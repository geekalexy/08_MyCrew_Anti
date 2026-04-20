// imageLabRouter.js — Phase 22 Phase 0 클린업
// geminiAdapter 직접 의존성 제거 → imageAnalysisService 서비스 레이어 사용
import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import dbManager from '../database.js';
import { analyzeImageForPrompt } from '../ai-engine/services/imageAnalysisService.js';
import { generateImage } from '../skill-library/05_design/nanoBananaGenerator.js';
import { clearSkillCache } from '../ai-engine/executor.js';

const router = express.Router();

// ── 용도별 저장 디렉토리 설정 ──────────────────────────────────
const REFS_DIR = path.resolve(process.cwd(), 'outputs/lab_refs');
const GEN_DIR = path.resolve(process.cwd(), 'outputs/lab');

[REFS_DIR, GEN_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, REFS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `ref_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ── API 엔드포인트 ─────────────────────────────────────────────

/** [POST] /api/imagelab/analyze - 이미지 분석 (Step 1) */
router.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '이미지 파일이 필요합니다.' });
    
    const sessionId = crypto.randomUUID();
    const imagePath = req.file.path;
    const imageUrl = `/outputs/lab_refs/${req.file.filename}`;

    const systemPrompt = `You are an expert art director for MyCrew's NanoBanana pixel art character system.
Your task: analyze the reference image and extract design attributes to generate a MATCHING NanoBanana chibi pixel art character.

NanoBanana style rules (MUST follow):
- Chibi proportions: large head (1:1 to 1:1.5 head-to-body ratio)
- Chunky pixel art aesthetic with bold outlines
- Flat colors with minimal shading
- Transparent or simple background
- Cute, expressive face with simple features

Extract these 7 attributes as JSON (keys must be exactly as listed):
1. headBodyRatio: Chibi head-to-body ratio (e.g. "1:1", "1:1.2")
2. skinTone: Dominant character/brand color to use as skin or main body color (extract from brand palette if no character)
3. detailDensity: Visual complexity level - "Low pixel art", "Medium pixel art", or "High pixel art with glow effects"
4. colorPalette: Array of 3-5 dominant HEX colors from the image (most important!)
5. background: Recommended background type for the chibi character ("Transparent", "Solid [color]", "Simple gradient")
6. pose: Recommended pose for a cute chibi character ("Standing, arms at sides", "Waving", "Holding object")
7. forbiddenElements: Array of elements to AVOID (e.g. "Realistic proportions", "Natural skin tones", "Complex textures")

CRITICAL: If the image has no character, treat the brand colors and style as the design palette for a NEW chibi character.
Always extract real HEX colors from the image for colorPalette.
Return ONLY valid JSON, no explanation.`;

    const result = await analyzeImageForPrompt(imagePath, systemPrompt);

    // Gemini가 ```json ... ``` 코드블록으로 감싸는 경우 방어 처리
    const rawText = result.text?.trim() || '';
    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/,          '')
      .trim();
    const analysis = JSON.parse(cleanJson);

    // DB에 세션 시작 기록
    await dbManager.createImageLabSession({
      sessionId,
      refPath: imageUrl,
      analysisJson: JSON.stringify(analysis)
    });

    // 분석 결과로 NanoBanana 생성 프롬프트 자동 조립 (브랜드 팔레트 우선 반영)
    const palette = Array.isArray(analysis.colorPalette) && analysis.colorPalette.length
      ? analysis.colorPalette
      : (analysis.colorPalette ? [analysis.colorPalette] : []);

    // 주 색상 → 캐릭터 의상/신체 색상으로 매핑
    const primaryColor   = palette[0] || '#4A90E2';
    const secondaryColor = palette[1] || '#FFFFFF';
    const accentColor    = palette[2] || primaryColor;

    const forbidden = Array.isArray(analysis.forbiddenElements) && analysis.forbiddenElements.length
      ? analysis.forbiddenElements
      : ['Realistic proportions', 'Natural skin tones', 'Complex textures', 'Photorealism'];

    const generatedPrompt = [
      // 🎯 NanoBanana 핵심 스타일 앵커 (항상 고정)
      'NanoBanana chibi pixel art character',
      `${analysis.headBodyRatio || '1:1'} head-to-body ratio`,
      'chunky pixel art style, bold black outlines, flat colors',
      'cute expressive face, big round eyes',

      // 🎨 브랜드 팔레트 직접 주입
      `primary color: ${primaryColor}, secondary color: ${secondaryColor}, accent: ${accentColor}`,
      palette.length > 0 ? `brand palette: ${palette.join(' ')}` : '',

      // 🧩 분석 기반 디테일
      analysis.skinTone && !analysis.skinTone.toLowerCase().includes('n/a')
        ? `skin tone inspired by: ${analysis.skinTone}` : '',
      analysis.detailDensity && !analysis.detailDensity.toLowerCase().includes('n/a')
        ? analysis.detailDensity : 'Low pixel art detail',
      analysis.pose && !analysis.pose.toLowerCase().includes('n/a')
        ? `pose: ${analysis.pose}` : 'pose: Standing, waving',

      // 🖼️ 배경
      `background: ${analysis.background || 'Transparent'}`,

      // 🚫 금지 요소
      `NO ${forbidden.join(', NO ')}`,

      // ✨ Imagen 품질 키워드
      'game sprite style, high quality pixel art, crisp edges',
    ].filter(Boolean).join(', ');

    res.json({ status: 'ok', sessionId, imageUrl, analysis, generatedPrompt });


  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** [POST] /api/imagelab/generate - 이미지 생성 (Step 3) */
router.post('/generate', async (req, res) => {
  try {
    const { sessionId, prompt } = req.body;
    if (!prompt) return res.status(400).json({ error: '프롬프트가 필요합니다.' });

    // NanoBanana 엔진 호출
    const imageUrl = await generateImage(prompt, '1:1'); 
    
    // DB 업데이트
    await dbManager.updateImageLabSession(sessionId, { prompt, resultUrl: imageUrl });

    res.json({ status: 'ok', imageUrl });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** [POST] /api/imagelab/learn - 학습 반영 Step */
router.post('/learn', async (req, res) => {
  try {
    const {
      sessionId, scores, score, memo,
      isWinner, category = 'DESIGN',
      styleTag = 'nanobanana',
      generatedUrl,   // ← 프론트에서 전달하는 생성 이미지 URL
      prompt,         // ← 사용된 프롬프트 (파인튜닝 메타데이터용)
      refImageUrl,    // ← 레퍼런스 이미지 URL
    } = req.body;

    const avg = score ?? (Object.values(scores).reduce((a, b) => a + b, 0) / Object.values(scores).length);
    const isWinnerAuto = avg >= 4 || isWinner;
    const timestamp   = new Date().toISOString().slice(0, 10);

    // ── 1. DB 점수 기록 ────────────────────────────────────────────
    await dbManager.finalizeImageLabSession(sessionId, { scoreAvg: avg });

    // ── 2. SKILL.md 기록 (Self-Learning) ──────────────────────────
    const skillPath = path.resolve(process.cwd(), 'skill-library/05_design/SKILL.md');
    const logHeader = isWinnerAuto
      ? `### [${timestamp}] 🏆 Winner Pattern [style:${styleTag}]`
      : `### [${timestamp}] ⛔ Failure Case [style:${styleTag}]`;
    const logEntry = `\n${logHeader}\n- **분석**: ${memo || '패턴화됨'}\n- **평균점수**: ${avg.toFixed(1)}\n`;
    fs.appendFileSync(skillPath, logEntry);

    // ── 3. Winner 이미지 보존 (파인튜닝 데이터셋 수집) ─────────────
    let winnerSaved = false;
    if (isWinnerAuto && generatedUrl) {
      const WINNERS_DIR = path.resolve(process.cwd(), 'outputs/winners');
      if (!fs.existsSync(WINNERS_DIR)) fs.mkdirSync(WINNERS_DIR, { recursive: true });

      // URL → 실제 파일 경로 변환 (예: /outputs/lab/gen_xxx.png → outputs/lab/gen_xxx.png)
      const relPath    = generatedUrl.replace(/^\//, '');
      const srcPath    = path.resolve(process.cwd(), relPath);
      const winnerName = `winner_${styleTag}_${Date.now()}.png`;
      const destPath   = path.join(WINNERS_DIR, winnerName);

      if (fs.existsSync(srcPath)) {
        fs.copyFileSync(srcPath, destPath);

        // 파인튜닝 메타데이터 JSON 저장
        const metaPath = path.join(WINNERS_DIR, winnerName.replace('.png', '.json'));
        fs.writeFileSync(metaPath, JSON.stringify({
          file:        winnerName,
          style:       styleTag,
          score:       avg,
          scores,
          prompt:      prompt || '',
          refImageUrl: refImageUrl || '',
          memo:        memo || '',
          savedAt:     new Date().toISOString(),
        }, null, 2));

        winnerSaved = true;
        console.log(`[ImageLab] 🏆 Winner 저장: ${winnerName} (score: ${avg})`);
      }
    }

    // ── 4. 캐시 무효화 ────────────────────────────────────────────
    clearSkillCache(category);

    // Winner 폴더 현황 카운트
    const WINNERS_DIR = path.resolve(process.cwd(), 'outputs/winners');
    const winnerCount = fs.existsSync(WINNERS_DIR)
      ? fs.readdirSync(WINNERS_DIR).filter(f => f.endsWith('.png')).length
      : 0;

    res.json({
      status: 'ok',
      message: '학습 완료 및 캐시 초기화됨',
      winnerSaved,
      winnerCount,   // 누적 Winner 수 반환
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// ── 소시안 이미지 풀 경로 ──────────────────────────────────────────────────
const SOCIAN_POOL_DIR = path.resolve(
  process.cwd(),
  '../../06_소시안자료/소시안 이미지'
);

/** [GET] /api/imagelab/reference-pool - 소시안 이미지 풀 목록 반환 */
router.get('/reference-pool', (req, res) => {
  try {
    if (!fs.existsSync(SOCIAN_POOL_DIR)) {
      return res.status(404).json({ error: '이미지 풀 폴더를 찾을 수 없습니다.', path: SOCIAN_POOL_DIR });
    }
    const files = fs.readdirSync(SOCIAN_POOL_DIR)
      .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
      .map(f => ({ name: f, url: `/api/imagelab/reference-pool/${encodeURIComponent(f)}` }));
    res.json({ status: 'ok', total: files.length, files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** [GET] /api/imagelab/reference-pool/:filename - 개별 이미지 파일 서빙 */
router.get('/reference-pool/:filename', (req, res) => {
  try {
    const filename = decodeURIComponent(req.params.filename);
    const filePath = path.join(SOCIAN_POOL_DIR, filename);
    // 경로 탈출 방어
    if (!filePath.startsWith(SOCIAN_POOL_DIR)) {
      return res.status(403).json({ error: '접근 거부' });
    }
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일 없음' });
    }
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** [GET] /api/imagelab/assets - 자산 라이브러리 목록 조회 */
router.get('/assets', async (req, res) => {
  try {
    const assetDir = path.resolve(process.cwd(), 'skill-library/05_design/lab-assets');
    if (!fs.existsSync(assetDir)) fs.mkdirSync(assetDir, { recursive: true });

    const files = fs.readdirSync(assetDir)
      .filter(file => /\.(png|jpg|jpeg|webp)$/i.test(file))
      .map(file => ({
        name: file,
        url: `/lab-assets/${file}`
      }));

    res.json({ status: 'ok', assets: files });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/** [GET] /api/imagelab/winners/count - Winner 누적 수 조회 (페이지 마운트 시 상태 복구용) */
router.get('/winners/count', (req, res) => {
  try {
    const WINNERS_DIR = path.resolve(process.cwd(), 'outputs/winners');
    const count = fs.existsSync(WINNERS_DIR)
      ? fs.readdirSync(WINNERS_DIR).filter(f => f.endsWith('.png')).length
      : 0;
    res.json({ status: 'ok', count });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

