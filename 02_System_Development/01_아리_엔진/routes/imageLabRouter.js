// imageLabRouter.js — Phase 22 Phase 0 클린업
// geminiAdapter 직접 의존성 제거 → imageAnalysisService 서비스 레이어 사용
import express from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import fs from 'fs';
import puppeteer from 'puppeteer-core';
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

// ── 스타일별 시스템 프롬프트 맵 ──────────────────────────────────────────────
const STYLE_ANALYSIS_CONFIGS = {
  nanobanana: {
    // 콘텐츠에 제한 없는 범용 픽셀아트 / 게임 스프라이트 스타일
    systemPrompt: `You are an expert pixel art director and game graphic designer.
Analyze the reference image and extract design attributes to faithfully recreate it in pixel art style.

Pixel art production rules:
- Chunky pixel aesthetic with bold outlines
- Flat colors, minimal shading
- HIGH FIDELITY to the original subject — do NOT transform into chibi unless the original is chibi
- Preserve the original composition, subject count, and layout

Extract these 7 attributes as JSON (keys must be exactly as listed):
1. subjectDescription: Precise description of the main subject(s) in the image (be faithful, don't add chibi)
2. colorPalette: Array of 4-6 dominant HEX colors (extract real HEX values from the image)
3. detailLevel: Pixel art detail level - "low detail (8-bit)", "medium detail (16-bit)", or "high detail (32-bit with dithering)"
4. composition: Layout and framing description
5. background: Background description or HEX color
6. artworkMood: Overall mood or theme (e.g. "retro game scene", "cute shop icon", "battle sprite")
7. forbiddenElements: Array of elements to AVOID when recreating this image

Return ONLY valid JSON, no explanation.`,
    buildPrompt: (analysis, _hint) => {
      const palette = Array.isArray(analysis.colorPalette) ? analysis.colorPalette : [];
      const forbidden = Array.isArray(analysis.forbiddenElements) && analysis.forbiddenElements.length
        ? analysis.forbiddenElements : ['smooth gradients', 'photorealism', 'anti-aliasing', 'blurry edges', 'soft shading', '3D render'];
      // 🎮 픽셀아트 스타일 앵커 — 모델이 실제 픽셀 처리를 하도록 매우 명시적으로 지시
      const styleAnchor = [
        'pixel art',
        '8-bit retro game style',
        'pixelated',
        'low resolution pixel grid',
        'chunky pixels',
        'bold black outlines',
        'flat colors no gradient',
        'crisp pixel edges',
        'visible pixel grid texture',
      ].join(', ');
      return [
        styleAnchor,  // ← 가장 먼저, 가장 강하게
        analysis.subjectDescription || '',
        analysis.composition || '',
        palette.length > 0 ? `color palette: ${palette.join(', ')}` : '',
        analysis.detailLevel || 'medium detail (16-bit)',
        analysis.artworkMood ? `mood: ${analysis.artworkMood}` : '',
        `background: ${analysis.background || 'simple solid pixel background'}`,
        'high quality retro pixel art, game sprite sheet style',
        `NO ${forbidden.join(', NO ')}`,
      ].filter(Boolean).join('. ');
    },

  },

  illustration: {
    systemPrompt: `You are an expert art director specializing in 2D flat illustration and cel-shading styles.
Analyze the reference image and extract design attributes to generate a MATCHING 2D illustration.

Illustration style rules:
- Soft cel shading with clean lineart
- Anime-inspired proportions
- Vibrant, harmonious color palette
- Smooth gradients and soft shadows

Extract these 7 attributes as JSON (keys must be exactly as listed):
1. composition: Main visual composition and layout description
2. mainSubject: Primary subject or character description
3. colorPalette: Array of 4-6 dominant HEX colors from the image
4. lightingMood: Lighting style and mood (e.g. "soft backlighting, warm afternoon", "cool studio lighting")
5. background: Background style and description
6. styleKeywords: Array of 3-5 style keywords that best describe the image
7. forbiddenElements: Array of elements to AVOID in the generated image

Return ONLY valid JSON, no explanation.`,
    buildPrompt: (analysis) => {
      const palette = Array.isArray(analysis.colorPalette) ? analysis.colorPalette : [];
      const keywords = Array.isArray(analysis.styleKeywords) ? analysis.styleKeywords.join(', ') : '';
      const forbidden = Array.isArray(analysis.forbiddenElements) && analysis.forbiddenElements.length
        ? analysis.forbiddenElements : ['Photorealism', 'Pixel art', '3D render'];
      // 컨러 수치를 프롬프트 앞단에 명시적으로 법제
      const colorDirective = palette.length > 0
        ? `USE EXACTLY THESE HEX COLORS: ${palette.join(', ')}. Primary color: ${palette[0]}${palette[1] ? '. Secondary color: ' + palette[1] : ''}`
        : '';
      return [
        '2D flat illustration, soft cel shading, clean lineart, anime style',
        colorDirective,
        analysis.mainSubject || '',
        analysis.composition || '',
        analysis.lightingMood || '',
        `background: ${analysis.background || 'gradient background'}`,
        keywords ? `style: ${keywords}` : '',
        'vibrant colors, high quality illustration',
        `NO ${forbidden.join(', NO ')}`,
      ].filter(Boolean).join('. ');
    },
  },

  toy3d: {
    systemPrompt: `You are an expert art director specializing in 3D toy and figurine rendering.
Analyze the reference image and extract design attributes to generate a MATCHING 3D toy render.

3D Toy style rules:
- Chibi figurine proportions (Funko Pop / Nendoroid style)
- Smooth plastic surface with subsurface scattering
- Studio lighting setup
- Clean, polished render

Extract these 7 attributes as JSON (keys must be exactly as listed):
1. figureDescription: Physical description of the figure/character to recreate
2. colorPalette: Array of 4-5 dominant HEX colors from the image
3. surfaceMaterial: Material description (e.g. "glossy plastic", "matte vinyl", "soft fabric details")
4. lightingSetup: Studio lighting description (e.g. "3-point studio lighting, soft shadows")
5. background: Background style (e.g. "clean white studio", "gradient pastel", "minimal shelf")
6. accessories: Notable accessories or props to include
7. forbiddenElements: Array of elements to AVOID

Return ONLY valid JSON, no explanation.`,
    buildPrompt: (analysis) => {
      const palette = Array.isArray(analysis.colorPalette) ? analysis.colorPalette : [];
      const forbidden = Array.isArray(analysis.forbiddenElements) && analysis.forbiddenElements.length
        ? analysis.forbiddenElements : ['Pixel art', '2D illustration', 'Photographic realism'];
      const colorDirective = palette.length > 0
        ? `USE EXACTLY THESE COLORS: ${palette.join(', ')}. Primary figure color: ${palette[0]}`
        : '';
      return [
        '3D render, chibi toy figurine, smooth plastic surface, Funko Pop style, subsurface scattering',
        colorDirective,
        analysis.figureDescription || '',
        `material: ${analysis.surfaceMaterial || 'glossy plastic vinyl'}`,
        `lighting: ${analysis.lightingSetup || '3-point studio lighting, soft shadows'}`,
        `background: ${analysis.background || 'clean gradient studio background'}`,
        analysis.accessories ? `accessories: ${analysis.accessories}` : '',
        'high quality 3D render, professional product photography style',
        `NO ${forbidden.join(', NO ')}`,
      ].filter(Boolean).join('. ');
    },
  },

  flatminimal: {
    systemPrompt: `You are an expert art director specializing in flat design and minimalist vector illustration.
Analyze the reference image and extract design attributes to generate a MATCHING flat minimal graphic.

Flat minimal style rules:
- Pure geometric shapes, no gradients
- Solid color blocks, bold typography-inspired layouts
- Maximum 5-6 colors
- Negative space as a design element

Extract these 7 attributes as JSON (keys must be exactly as listed):
1. layout: Overall layout and composition description
2. colorPalette: Array of 3-6 dominant HEX colors (most important — keep them exact)
3. primaryShape: Main geometric shape or visual motif
4. mood: Overall mood and brand feel
5. background: Background color (HEX preferred)
6. textElements: Any text, labels, or typographic elements present
7. forbiddenElements: Array of elements to AVOID

Return ONLY valid JSON, no explanation.`,
    buildPrompt: (analysis) => {
      const palette = Array.isArray(analysis.colorPalette) ? analysis.colorPalette : [];
      const forbidden = Array.isArray(analysis.forbiddenElements) && analysis.forbiddenElements.length
        ? analysis.forbiddenElements : ['Gradients', 'Shadows', 'Photorealism', '3D effects', 'Pixel art'];
      // 플랫미니멀은 컨러 정확도가 관건 — 배경색 + 주조색을 앞단에 법제
      const bgColor    = analysis.background || (palette[0] || '#FFFFFF');
      const colorBlock = palette.length > 0
        ? `STRICTLY USE ONLY THESE EXACT HEX COLORS — fill every shape with only these colors: ${palette.join(', ')}. Background must be filled with: ${bgColor}. Primary dominant color: ${palette[0] || bgColor}. Accent color: ${palette[1] || palette[0] || '#000000'}`
        : `background color: ${bgColor}`;
      return [
        'flat design vector art, minimal shapes, solid color blocks, no gradient, geometric simplicity',
        colorBlock,
        analysis.layout || '',
        analysis.primaryShape ? `primary motif: ${analysis.primaryShape}` : '',
        analysis.mood ? `mood: ${analysis.mood}` : '',
        analysis.textElements ? `include text elements: ${analysis.textElements}` : '',
        'professional graphic design, clean vector, app icon style',
        `NO ${forbidden.join(', NO ')}`,
      ].filter(Boolean).join('. ');
    },
  },

  realistic: {
    systemPrompt: `You are an expert art director specializing in professional photography and photorealistic imagery.
Analyze the reference image and extract design attributes to generate a MATCHING photorealistic image.

Realistic style rules:
- Photorealistic rendering or professional photography aesthetic
- Natural lighting and accurate colors
- Realistic textures and materials
- Professional composition and framing

Extract these 7 attributes as JSON (keys must be exactly as listed):
1. subject: Detailed description of the main subject(s)
2. colorTone: Overall color grading and tone (e.g. "warm golden hour", "cool neutral studio", "desaturated cinematic")
3. colorPalette: Array of 3-5 dominant HEX colors from the image
4. lighting: Lighting setup and direction
5. background: Background description
6. composition: Framing and compositional technique (e.g. "rule of thirds, shallow depth of field")
7. forbiddenElements: Array of elements to AVOID

Return ONLY valid JSON, no explanation.`,
    buildPrompt: (analysis) => {
      const palette = Array.isArray(analysis.colorPalette) ? analysis.colorPalette : [];
      const forbidden = Array.isArray(analysis.forbiddenElements) && analysis.forbiddenElements.length
        ? analysis.forbiddenElements : ['Cartoon', 'Illustration', 'Pixel art', 'Flat design'];
      const colorDirective = palette.length > 0
        ? `color grading matching these tones: ${palette.join(', ')}. Overall tone: ${analysis.colorTone || 'natural'}`
        : `color tone: ${analysis.colorTone || 'natural color grading'}`;
      return [
        'photorealistic, professional photography, high resolution',
        analysis.subject || '',
        colorDirective,
        `lighting: ${analysis.lighting || 'natural lighting'}`,
        `background: ${analysis.background || 'contextual background'}`,
        `composition: ${analysis.composition || 'rule of thirds'}`,
        'sharp focus, professional quality, Canon 5D style',
        `NO ${forbidden.join(', NO ')}`,
      ].filter(Boolean).join('. ');
    },
  },

  custom: {
    // 사용자가 직접 입력한 스타일 힌트를 반영하는 자유형 분석
    buildSystemPrompt: (styleHint) => `You are an expert art director with deep knowledge of all visual art styles.
Analyze the reference image and extract design attributes for faithful reproduction.
${ styleHint ? `\nTarget output style requested by user: "${styleHint}"\nBias your analysis and attribute extraction to best serve this target style.` : '' }

Extract these 7 attributes as JSON (keys must be exactly as listed):
1. visualStyle: Detected art style and medium. ${ styleHint ? `(If compatible, incorporate the user-requested style: ${styleHint})` : '' }
2. mainSubject: Primary subject and its detailed description
3. colorPalette: Array of 4-6 dominant HEX colors from the image
4. composition: Layout and compositional description
5. mood: Emotional tone and atmosphere
6. background: Background description or color
7. forbiddenElements: Array of elements to AVOID in the output

Return ONLY valid JSON, no explanation.`,
    buildPrompt: (analysis, styleHint) => {
      const palette = Array.isArray(analysis.colorPalette) ? analysis.colorPalette : [];
      const forbidden = Array.isArray(analysis.forbiddenElements) && analysis.forbiddenElements.length
        ? analysis.forbiddenElements : [];
      return [
        // 사용자 스타일 힌트가 있으면 최우선
        styleHint ? styleHint : (analysis.visualStyle || ''),
        analysis.mainSubject || '',
        analysis.composition || '',
        `color palette: ${palette.join(', ')}`,
        analysis.mood ? `mood: ${analysis.mood}` : '',
        `background: ${analysis.background || ''}`,
        'high quality',
        forbidden.length > 0 ? `NO ${forbidden.join(', NO ')}` : '',
      ].filter(Boolean).join('. ');
    },
  },
};

/** [POST] /api/imagelab/analyze - 이미지 분석 (Step 1) — 스타일 인식 버전 */
router.post('/analyze', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: '이미지 파일이 필요합니다.' });

    // stylePresetId: multipart body field (기본: nanobanana — 하위 호환)
    const stylePresetId    = req.body?.stylePresetId    || 'nanobanana';
    const customStyleHint  = req.body?.customStyleHint  || '';   // 커스텀 스타일 힌트
    const config = STYLE_ANALYSIS_CONFIGS[stylePresetId] || STYLE_ANALYSIS_CONFIGS.nanobanana;

    // custom 스타일은 buildSystemPrompt(hint) 동적 생성, 나머지는 고정 systemPrompt
    const systemPrompt = stylePresetId === 'custom' && config.buildSystemPrompt
      ? config.buildSystemPrompt(customStyleHint)
      : config.systemPrompt;

    const sessionId = crypto.randomUUID();
    const imagePath = req.file.path;
    const imageUrl = `/outputs/lab_refs/${req.file.filename}`;

    // ── 스타일별(동적) 시스템 프롬프트로 Gemini Vision 호출 ─────────────────
    const result = await analyzeImageForPrompt(imagePath, systemPrompt);

    // Gemini가 ```json ... ``` 코드블록으로 감싸는 경우 방어 처리
    const rawText = result.text?.trim() || '';
    const cleanJson = rawText
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```$/,          '')
      .trim();
    const analysis = JSON.parse(cleanJson);

    // colorPalette / forbiddenElements 배열 정규화
    if (!Array.isArray(analysis.colorPalette)) {
      analysis.colorPalette = analysis.colorPalette
        ? String(analysis.colorPalette).split(',').map(c => c.trim()).filter(Boolean)
        : [];
    }
    if (!Array.isArray(analysis.forbiddenElements)) {
      analysis.forbiddenElements = analysis.forbiddenElements
        ? String(analysis.forbiddenElements).split(',').map(s => s.trim()).filter(Boolean)
        : [];
    }

    // DB에 세션 시작 기록
    await dbManager.createImageLabSession({
      sessionId,
      refPath: imageUrl,
      analysisJson: JSON.stringify(analysis)
    });

    // ── 스타일별 프롬프트 조립 (custom은 hint 함께 전달) ─────────────────────
    const generatedPrompt = config.buildPrompt(analysis, customStyleHint);

    console.log(`[ImageLab] 분석 완료 (style: ${stylePresetId}) → 프롬프트 ${generatedPrompt.length}자`);
    res.json({ status: 'ok', sessionId, imageUrl, analysis, generatedPrompt, stylePresetId });

  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


/** [POST] /api/imagelab/extract-colors - URL에서 색상 추출 */
router.post('/extract-colors', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'URL을 입력해주세요.' });

  let browser;
  try {
    const CHROME_PATH = process.platform === 'darwin'
      ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
      : '/usr/bin/google-chrome';

    browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--window-size=1280,1024']
    });

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 1024 });

    const targetUrl = url.startsWith('http') ? url : `https://${url}`;
    console.log(`[BrandStudio] 컬러 추출을 위한 스크린샷 캡쳐: ${targetUrl}`);
    await page.goto(targetUrl, { waitUntil: 'networkidle2', timeout: 15000 }).catch(() => console.warn('Navigation timeout, continuing...'));

    const screenshotName = `screenshot_${Date.now()}.png`;
    const screenshotPath = path.join(REFS_DIR, screenshotName);
    
    await page.screenshot({ path: screenshotPath });
    await browser.close();

    const systemPrompt = `You are a senior brand identity analyst with expertise in extracting corporate brand colors from websites.

Analyze the provided website screenshot and identify the 3 MOST DISTINCTIVE brand colors:
1. PRIMARY color: The dominant background or main brand color (could be dark, vivid, or neutral — whatever defines the brand)
2. ACCENT color: The most eye-catching button, CTA, or highlight color (usually vivid/saturated)
3. SECONDARY color: A supporting color used for text, borders, or secondary backgrounds

STRICT RULES:
- Return EXACTLY 3 HEX colors in order: [primary, accent, secondary]
- Prefer VIVID, SATURATED colors that define the brand identity over plain white/black
- AVOID pure white (#FFFFFF or near-white like #F8F8F8, #FAFAFA) UNLESS it is clearly the brand's primary background choice
- AVOID pure black (#000000 or #111111) unless it is a dominant brand color (e.g. luxury brands)
- Read actual CSS background-color, button colors, logo colors — not just dominant pixel colors
- If the site uses a dark theme → primary should be the dark bg, accent should be the vivid color
- If the site uses a light theme → primary should be the logo/brand color, accent the CTA color

Return ONLY a JSON array of exactly 3 HEX codes. No markdown. No explanation.
Example: ["#1A1A2E", "#E94560", "#F5F0FF"]`;

    const result = await analyzeImageForPrompt(screenshotPath, systemPrompt);
    let rawText = result?.text?.trim() || '[]';
    rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
    
    const colors = JSON.parse(rawText);
    if (!Array.isArray(colors) || colors.length === 0) throw new Error('색상 추출에 실패했습니다.');

    // 찌꺼기 파일 삭제
    fs.unlink(screenshotPath, () => {});

    res.json({ status: 'ok', colors });
  } catch (err) {
    if (browser) await browser.close().catch(() => {});
    console.error('[BrandStudio] 색상 추출 오류:', err.message);
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

// ─────────────────────────────────────────────────────────────────────────────
// 🎨 Image Lab v2.0 — Brand Studio API
// 고지능 모델(Gemini 2.5 Flash/Pro)을 활용한 소시안 브랜드 에셋 생성 파이프라인
// 프롬프트 최적화 학습 불필요 — 자연어 지시 → 브랜드 일관성 자동 적용
// ─────────────────────────────────────────────────────────────────────────────

const BRAND_ARCHIVE_DIR = path.resolve(process.cwd(), 'outputs/brand-archive');
if (!fs.existsSync(BRAND_ARCHIVE_DIR)) fs.mkdirSync(BRAND_ARCHIVE_DIR, { recursive: true });

// 소시안 브랜드 프리셋 정의 (SSOT)
const SOCIAN_BRAND_PRESETS = {
  signature: {
    id: 'signature',
    name: '소시안 시그니처',
    colors: ['#1A1A2E', '#16213E', '#0F3460', '#E94560'],
    mood: 'sophisticated, premium, tech-forward, Korean beauty',
    forbidden: 'cheap, cluttered, low-quality, pixel art, cartoonish',
    tone: 'clean minimal, dark luxury',
  },
  bright: {
    id: 'bright',
    name: '소시안 브라이트',
    colors: ['#FFFFFF', '#F8F9FA', '#4A90E2', '#E94560'],
    mood: 'fresh, energetic, youthful, modern Korean lifestyle',
    forbidden: 'dark, heavy, complex textures, vintage',
    tone: 'bright minimal, Korean influencer aesthetic',
  },
  warm: {
    id: 'warm',
    name: '소시안 웜',
    colors: ['#FFF8F3', '#F5CBA7', '#E59866', '#DC7633'],
    mood: 'warm, cozy, approachable, lifestyle brand',
    forbidden: 'cold, industrial, harsh contrast',
    tone: 'warm neutral, lifestyle photography',
  },
};

// 콘텐츠 유형별 스펙
const CONTENT_TYPE_SPECS = {
  feed: { label: '인스타그램 피드', ratio: '1:1', size: '1080x1080', tip: 'centered composition, clean background, minimal text area' },
  reels: { label: '릴스 썸네일', ratio: '9:16', size: '1080x1920', tip: 'bold visual hook, upper-third focus, room for caption at bottom' },
  product: { label: '제품 광고', ratio: '4:5', size: '1080x1350', tip: 'product hero shot, clean background, lifestyle context' },
  blog: { label: '블로그 헤더', ratio: '16:9', size: '1280x720', tip: 'wide format, atmospheric, readable with title overlay' },
  story: { label: '인스타 스토리', ratio: '9:16', size: '1080x1920', tip: 'full-bleed visual, swipe-worthy design, strong contrast' },
};

/**
 * POST /api/imagelab/brand-generate
 * 브랜드 에셋 직접 생성 (Lumi 크리에이티브 디렉팅 옵션 포함)
 */
router.post('/brand-generate', async (req, res) => {
  try {
    const {
      description,           // 사용자 자연어 지시
      brandPresetId = 'signature',
      contentType = 'feed',
      lumiDirecting = false, // true: Lumi가 창의적 컨셉 먼저 제안
      upgradeOnly = false,   // true: 이미지 생성 없이 Lumi 컨셉만 반환 (프롬프트 고도화 전용)
      aspectRatio,
      imageSize,             // { width, height } — 프론트에서 콘텐츠 유형에 맞게 전달
    } = req.body;

    if (!description?.trim()) {
      return res.status(400).json({ error: '생성할 이미지 설명을 입력해주세요.' });
    }

    const brand = SOCIAN_BRAND_PRESETS[brandPresetId] || SOCIAN_BRAND_PRESETS.signature;
    const contentSpec = CONTENT_TYPE_SPECS[contentType] || CONTENT_TYPE_SPECS.feed;
    const ratio = aspectRatio || contentSpec.ratio;

    let finalDescription = description.trim();
    let lumiConcept = null;

    // ── 스타일 자동 감지: 사용자 설명의 명시적 시각 스타일 키워드 ─────────────
    const descLower = finalDescription.toLowerCase();
    const isIllustration = /일러스트|illustration|vector|벡터|플랫|flat design|graphic|그래픽|2d|아이콘|icon/.test(descLower);
    const isPhoto        = /사진|photo|portrait|인물|촬영|realistic|리얼|photography/.test(descLower);

    // 감지된 스타일 우선 적용 — 없으면 브랜드 프리셋 tone 기본
    const styleTone  = isIllustration ? 'flat vector illustration, bold graphic design'
                     : isPhoto        ? 'professional photography, realistic'
                     : brand.tone;

    // 퀄리티 키워드: 스타일에 맞게 분기
    const qualityTag = isIllustration
      ? 'high quality vector illustration, crisp clean graphics, professional graphic design'
      : 'high quality, professional photography/design';

    // ── Lumi 크리에이티브 디렉팅: Gemini로 창의적 컨셉 생성 ────────────────
    if (lumiDirecting) {
      const lumiSystemPrompt = `You are Lumi, the creative art director for Socian brand.
Given a brief description, create a SPECIFIC, VIVID image prompt that:
1. STRICTLY PRESERVES the visual style stated in the description.
   - If description says "flat vector illustration" → keep it as flat vector illustration, NEVER substitute with photography.
   - Detected style: ${isIllustration ? 'illustration/graphic' : isPhoto ? 'photography' : 'general'}
2. Incorporates Socian brand color palette only if compatible: ${brand.colors.slice(0,2).join(', ')}
3. Optimizes composition for ${contentSpec.label} format (${contentSpec.tip})
4. Enhances visual impact without overriding the stated style

Return ONLY the enhanced image prompt (2-3 sentences, Korean or English), no explanation.`;

      try {
        const lumiResult = await analyzeImageForPrompt(null, lumiSystemPrompt, finalDescription);
        if (lumiResult?.text) {
          lumiConcept = lumiResult.text.trim();
          finalDescription = lumiConcept;
          console.log('[BrandStudio] 🌿 Lumi 컨셉:', lumiConcept.slice(0, 80) + '...');
        }
      } catch (e) {
        console.warn('[BrandStudio] Lumi directing 실패, 원본 설명 사용:', e.message);
      }
    }

    // ── 브랜드 일관성 프롬프트 조립 ──────────────────────────────────────────
    // 우선순위: 사용자 설명(스타일 포함) > 감지된 스타일 tone > 브랜드 색상 > 포맷
    // 일러스트 스타일이면 브랜드 무드(사람/뷰티) 오버라이드 금지
    const brandPrompt = [
      finalDescription,
      `Style: ${styleTone}`,
      !isIllustration ? `Brand mood: ${brand.mood}` : null,
      `Brand color accent: ${brand.colors.slice(0,2).join(', ')}`,
      `Format: ${contentSpec.label}`,
      qualityTag,
      `NO: ${brand.forbidden}`,
    ].filter(Boolean).join('. ');

    // ── upgradeOnly: 이미지 생성 없이 Lumi 컨셉만 즉시 반환 ─────────────────
    if (upgradeOnly) {
      return res.json({
        status: 'ok',
        lumiConcept: lumiConcept || finalDescription,
        finalPrompt: null,
        imageUrl: null,
      });
    }

    // ── 이미지 생성 — 콘텐츠 유형 사이즈 적용 ─────────────────────────────
    const genWidth  = imageSize?.width  || contentSpec.width  || 1080;
    const genHeight = imageSize?.height || contentSpec.height || 1080;
    const imageUrl = await generateImage(brandPrompt, ratio, genWidth, genHeight);

    res.json({
      status: 'ok',
      imageUrl,
      brandPreset: brand.name,
      contentType: contentSpec.label,
      lumiConcept,   // null이면 Lumi 미사용
      finalPrompt: brandPrompt,
    });

  } catch (err) {
    console.error('[BrandStudio] brand-generate 오류:', err.message);
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/imagelab/html-generate
 * Gemini로 HTML+CSS 디자인 카드 생성 (텍스트 자유 배치 모드)
 */
router.post('/html-generate', async (req, res) => {
  const {
    description,
    width  = 1080,
    height = 1080,
    colors = ['#E8294B', '#1A1A2E'],
    brandName = '브랜드',
    contentLabel = '피드',
  } = req.body;

  if (!description?.trim()) {
    return res.status(400).json({ error: '디자인 설명을 입력해주세요.' });
  }

  const colorList = Array.isArray(colors) ? colors.slice(0, 4) : ['#E8294B', '#1A1A2E'];
  const systemPrompt = `You are an expert HTML/CSS designer creating social media graphics.
Generate a COMPLETE, SELF-CONTAINED HTML document that renders a ${width}×${height}px design card.

RULES:
1. The root element must be exactly ${width}px wide and ${height}px tall.
2. Use ONLY these brand colors: ${colorList.join(', ')} — prioritize them for backgrounds, text, accents.
3. Include Google Fonts via <link>: use "Noto Sans KR" for Korean, "Inter" for English/numbers.
4. All CSS must be inline <style> within the <head>. NO external CSS files.
5. NO JavaScript — pure HTML+CSS only.
6. Make it visually stunning: use gradients, shadows, layered backgrounds, bold typography.
7. Text must be sharp, readable, and properly sized for the format (${contentLabel}).
8. CRITICAL: Add data-lumi-id="lumi-N" (N=1,2,3...) attribute to EVERY meaningful visible element — headings, paragraphs, buttons, divs with text/image, spans, img tags. Start from N=1 and increment. This enables click-to-code mapping. Every clickable/editable element must have this attribute.
9. Return ONLY the raw HTML code, no markdown, no explanation, no code fences.`;

  const userPrompt = `Create a ${contentLabel} design card (${width}×${height}px) with this concept:
${description.trim()}

Brand: ${brandName}
Brand colors: ${colorList.join(', ')}
Make it premium, modern, and visually impactful.`;

  // ── 429 재시도 헬퍼 ──────────────────────────────────────────────────────
  const parseRetryDelay = (errMsg = '') => {
    try {
      // JSON 형태 에러에서 retryDelay 추출
      const match = errMsg.match(/"retryDelay":"([\d.]+)s"/);
      if (match) return Math.ceil(parseFloat(match[1])) + 1;
    } catch (_) {}
    return null;
  };

  const MAX_ATTEMPTS = 2;
  let lastErr;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const result = await analyzeImageForPrompt(null, systemPrompt, userPrompt);
      let html = result?.text?.trim() || '';

      // 마크다운 코드 블록 제거
      html = html.replace(/^```html?\n?/i, '').replace(/```$/m, '').trim();

      if (!html.toLowerCase().includes('<html') && !html.toLowerCase().includes('<!doctype')) {
        html = `<!DOCTYPE html><html><head>
<meta charset="UTF-8">
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&family=Inter:wght@400;700;900&display=swap" rel="stylesheet">
<style>*{margin:0;padding:0;box-sizing:border-box;}body{width:${width}px;height:${height}px;overflow:hidden;}</style>
</head><body>${html}</body></html>`;
      }

      console.log(`[BrandStudio] HTML 디자인 생성 완료 (${width}×${height}): ${html.length} chars`);
      return res.json({ html });

    } catch (err) {
      lastErr = err;
      const errMsg = err.message || '';
      const is429 = errMsg.includes('429') || errMsg.includes('RESOURCE_EXHAUSTED');
      const is503 = errMsg.includes('503') || errMsg.includes('UNAVAILABLE');

      if ((is429 || is503) && attempt < MAX_ATTEMPTS) {
        const delaySec = parseRetryDelay(errMsg) || 40;
        console.warn(`[BrandStudio] html-generate ${is429 ? '429' : '503'} — ${delaySec}s 후 재시도 (${attempt}/${MAX_ATTEMPTS})...`);
        await new Promise(r => setTimeout(r, delaySec * 1000));
        continue;
      }

      // 재시도 소진 or 다른 에러 — retryAfterSec 포함해서 프론트에 전달
      const retrySec = parseRetryDelay(errMsg);
      console.error('[BrandStudio] html-generate 최종 오류:', errMsg.slice(0, 200));
      return res.status(is429 ? 429 : 500).json({
        error: is429
          ? `API 할당량 초과 — ${retrySec ? `${retrySec}초` : '잠시'} 후 다시 시도하세요.`
          : errMsg,
        retryAfterSec: retrySec,
      });
    }
  }
});


/**
 * POST /api/imagelab/archive
 * 생성된 이미지를 소시안 비주얼 DB(brand-archive)에 저장
 */
router.post('/archive', async (req, res) => {
  try {
    const { imageUrl, contentType, brandPresetId, description, tags = [] } = req.body;
    if (!imageUrl) return res.status(400).json({ error: 'imageUrl 필요' });

    // URL → 실제 파일 경로
    const relPath = imageUrl.replace(/^\//, '');
    const srcPath = path.resolve(process.cwd(), relPath);

    const timestamp = Date.now();
    const archiveName = `socian_${contentType || 'asset'}_${timestamp}.png`;
    const destPath = path.join(BRAND_ARCHIVE_DIR, archiveName);

    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
    } else {
      return res.status(404).json({ error: '원본 파일을 찾을 수 없습니다.' });
    }

    // 메타데이터 저장
    const meta = {
      id: timestamp,
      file: archiveName,
      url: `/api/imagelab/archive-file/${archiveName}`,
      contentType: contentType || 'feed',
      brandPreset: brandPresetId || 'signature',
      description: description || '',
      tags,
      archivedAt: new Date().toISOString(),
    };
    fs.writeFileSync(
      path.join(BRAND_ARCHIVE_DIR, `${archiveName}.meta.json`),
      JSON.stringify(meta, null, 2)
    );

    res.json({ status: 'ok', archived: meta });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/imagelab/archive
 * 소시안 비주얼 DB 전체 목록 조회 (최신순)
 */
router.get('/archive', (req, res) => {
  try {
    const { contentType, brandPreset } = req.query;

    const metas = fs.readdirSync(BRAND_ARCHIVE_DIR)
      .filter(f => f.endsWith('.meta.json'))
      .map(f => {
        try { return JSON.parse(fs.readFileSync(path.join(BRAND_ARCHIVE_DIR, f), 'utf-8')); }
        catch { return null; }
      })
      .filter(Boolean)
      .filter(m => !contentType || m.contentType === contentType)
      .filter(m => !brandPreset || m.brandPreset === brandPreset)
      .sort((a, b) => b.id - a.id);

    res.json({ status: 'ok', total: metas.length, items: metas });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/imagelab/archive-file/:filename
 * 아카이브 이미지 파일 서빙
 */
router.get('/archive-file/:filename', (req, res) => {
  try {
    const filePath = path.join(BRAND_ARCHIVE_DIR, req.params.filename);
    if (!filePath.startsWith(BRAND_ARCHIVE_DIR) || !fs.existsSync(filePath)) {
      return res.status(404).json({ error: '파일 없음' });
    }
    res.sendFile(filePath);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/imagelab/archive/:id
 * 아카이브에서 이미지 삭제
 */
router.delete('/archive/:id', (req, res) => {
  try {
    const id = req.params.id;
    const files = fs.readdirSync(BRAND_ARCHIVE_DIR).filter(f => f.includes(`_${id}`));
    files.forEach(f => {
      const fp = path.join(BRAND_ARCHIVE_DIR, f);
      if (fs.existsSync(fp)) fs.unlinkSync(fp);
    });
    res.json({ status: 'ok', deleted: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;

