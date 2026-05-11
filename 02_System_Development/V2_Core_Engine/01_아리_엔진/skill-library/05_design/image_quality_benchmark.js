/**
 * 🧪 NanoBanana Image Quality Benchmark
 * Sonnet 담당: Imagen 3 vs Pollinations AI 품질 비교 실험 프레임워크
 *
 * 실행: node image_quality_benchmark.js
 * 결과: benchmark_results/ 폴더에 이미지 + 리포트 저장
 *
 * 측정 지표:
 * - 생성 속도 (ms)
 * - 파일 크기 (KB)
 * - 프롬프트 충실도 (수동 점수 1~5)
 * - 브랜드 색감 일치도 (수동 점수 1~5)
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── 테스트 프롬프트 셋 (소시안 브랜드 기준) ────────────────────────
const TEST_PROMPTS = [
  {
    id: 'P1_product',
    label: '제품 기능 시각화',
    prompt: 'smartphone screen showing Instagram DM interface with automated message bubbles, clean B2B SaaS illustration, purple and white color scheme, flat design, isometric perspective',
    category: 'product',
  },
  {
    id: 'P2_fomo',
    label: 'FOMO 마케팅 카드',
    prompt: 'split screen comparison showing manual DM typing vs automated DMs running automatically, modern infographic style, gradient from yellow to pink to purple, vibrant colors, Korean SaaS brand aesthetic',
    category: 'marketing',
  },
  {
    id: 'P3_thumbnail',
    label: '릴스 썸네일',
    prompt: 'close-up of phone notification showing 1000 DMs sent automatically, dark navy background with purple neon glow, hyper-realistic product mockup, high contrast',
    category: 'thumbnail',
  },
  {
    id: 'P4_banner',
    label: '광고 배너',
    prompt: 'Korean small business owner smiling at laptop with Instagram growth chart, professional B2B advertising photorealistic style, bright white background, purple and gold accents',
    category: 'banner',
  },
];

// ── 출력 디렉토리 ───────────────────────────────────────────────────
const OUTPUT_DIR = path.resolve(__dirname, 'benchmark_results');
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });

// ── Imagen 3 생성기 ─────────────────────────────────────────────────
async function generateWithImagen(prompt) {
  const { GoogleGenAI } = await import('@google/genai');
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

  const start = Date.now();
  try {
    const response = await ai.models.generateImages({
      model: 'imagen-3.0-generate-001',
      prompt,
      config: { numberOfImages: 1, outputMimeType: 'image/jpeg' },
    });
    const elapsed = Date.now() - start;
    const base64 = response.generatedImages[0].image.imageBytes;
    return { success: true, base64, elapsed, engine: 'Imagen3' };
  } catch (err) {
    return { success: false, error: err.message, elapsed: Date.now() - start, engine: 'Imagen3' };
  }
}

// ── Pollinations 생성기 (fallback) ─────────────────────────────────
async function generateWithPollinations(prompt) {
  const fetch = (await import('node-fetch')).default;
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=1024&height=1024&nologo=true&seed=${Date.now()}`;

  const start = Date.now();
  try {
    const res = await fetch(url, { timeout: 30000 });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const buf = await res.arrayBuffer();
    const elapsed = Date.now() - start;
    const base64 = Buffer.from(buf).toString('base64');
    return { success: true, base64, elapsed, engine: 'Pollinations' };
  } catch (err) {
    return { success: false, error: err.message, elapsed: Date.now() - start, engine: 'Pollinations' };
  }
}

// ── 단일 프롬프트 벤치마크 ──────────────────────────────────────────
async function benchmarkPrompt(promptConfig) {
  console.log(`\n📸 [${promptConfig.id}] ${promptConfig.label} 테스트 시작...`);

  const results = {};

  // Imagen 3 테스트
  console.log(`  ⏳ Imagen 3 생성 중...`);
  const imagenResult = await generateWithImagen(promptConfig.prompt);
  results.imagen = imagenResult;

  if (imagenResult.success) {
    const fileName = `${promptConfig.id}_imagen3.jpg`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(imagenResult.base64, 'base64'));
    const stats = fs.statSync(filePath);
    results.imagen.fileSizeKB = Math.round(stats.size / 1024);
    results.imagen.filePath = filePath;
    console.log(`  ✅ Imagen 3: ${imagenResult.elapsed}ms, ${results.imagen.fileSizeKB}KB`);
  } else {
    console.log(`  ❌ Imagen 3 실패: ${imagenResult.error}`);
  }

  // 500ms 딜레이 (API 레이트 리밋 방지)
  await new Promise(r => setTimeout(r, 500));

  // Pollinations 테스트
  console.log(`  ⏳ Pollinations 생성 중...`);
  const pollResult = await generateWithPollinations(promptConfig.prompt);
  results.pollinations = pollResult;

  if (pollResult.success) {
    const fileName = `${promptConfig.id}_pollinations.jpg`;
    const filePath = path.join(OUTPUT_DIR, fileName);
    fs.writeFileSync(filePath, Buffer.from(pollResult.base64, 'base64'));
    const stats = fs.statSync(filePath);
    results.pollinations.fileSizeKB = Math.round(stats.size / 1024);
    results.pollinations.filePath = filePath;
    console.log(`  ✅ Pollinations: ${pollResult.elapsed}ms, ${results.pollinations.fileSizeKB}KB`);
  } else {
    console.log(`  ❌ Pollinations 실패: ${pollResult.error}`);
  }

  return { promptConfig, results };
}

// ── 리포트 생성 ─────────────────────────────────────────────────────
function generateReport(allResults) {
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    `# 🧪 NanoBanana 이미지 생성 품질 벤치마크`,
    `> 실행일: ${date} | 담당: Sonnet (소넷)`,
    ``,
    `## 측정 결과 요약`,
    ``,
    `| 프롬프트 | 카테고리 | Imagen3 속도 | Imagen3 크기 | Pollinations 속도 | Pollinations 크기 | 승자 |`,
    `|:---|:---|:---:|:---:|:---:|:---:|:---:|`,
  ];

  for (const { promptConfig, results } of allResults) {
    const im = results.imagen;
    const po = results.pollinations;
    const imSpeed = im.success ? `${im.elapsed}ms` : '❌';
    const imSize = im.success ? `${im.fileSizeKB}KB` : '-';
    const poSpeed = po.success ? `${po.elapsed}ms` : '❌';
    const poSize = po.success ? `${po.fileSizeKB}KB` : '-';

    let winner = '-';
    if (im.success && po.success) {
      winner = im.elapsed < po.elapsed ? '🏆 Imagen3 (속도)' : '🏆 Pollinations (속도)';
    } else if (im.success) {
      winner = '🏆 Imagen3 (유일 성공)';
    } else if (po.success) {
      winner = '🏆 Pollinations (유일 성공)';
    }

    lines.push(`| ${promptConfig.label} | ${promptConfig.category} | ${imSpeed} | ${imSize} | ${poSpeed} | ${poSize} | ${winner} |`);
  }

  lines.push(``);
  lines.push(`## 수동 품질 평가 (1~5점 — 대표님이 직접 채점)`);
  lines.push(``);
  lines.push(`| 프롬프트 | Imagen3 충실도 | Imagen3 브랜드 | Pollinations 충실도 | Pollinations 브랜드 |`);
  lines.push(`|:---|:---:|:---:|:---:|:---:|`);

  for (const { promptConfig } of allResults) {
    lines.push(`| ${promptConfig.label} | _/5 | _/5 | _/5 | _/5 |`);
  }

  lines.push(``);
  lines.push(`## 생성된 이미지 파일 목록`);
  lines.push(``);

  for (const { promptConfig, results } of allResults) {
    lines.push(`### ${promptConfig.label} (${promptConfig.id})`);
    if (results.imagen.filePath) {
      lines.push(`- **Imagen3**: \`${path.basename(results.imagen.filePath)}\``);
    }
    if (results.pollinations.filePath) {
      lines.push(`- **Pollinations**: \`${path.basename(results.pollinations.filePath)}\``);
    }
    lines.push(``);
  }

  lines.push(`---`);
  lines.push(`*이 리포트는 자동 생성됩니다. 품질 점수는 대표님이 직접 이미지를 보고 기입해 주세요.*`);

  const reportPath = path.join(OUTPUT_DIR, `benchmark_report_${date}.md`);
  fs.writeFileSync(reportPath, lines.join('\n'), 'utf-8');
  return reportPath;
}

// ── 메인 실행 ──────────────────────────────────────────────────────
async function main() {
  console.log('🧪 NanoBanana Image Quality Benchmark 시작');
  console.log(`📁 출력 디렉토리: ${OUTPUT_DIR}`);
  console.log(`🎯 테스트 프롬프트: ${TEST_PROMPTS.length}개\n`);

  if (!process.env.GEMINI_API_KEY) {
    console.warn('⚠️  GEMINI_API_KEY 없음 → Imagen3 테스트 스킵, Pollinations만 실행');
  }

  const allResults = [];
  for (const prompt of TEST_PROMPTS) {
    const result = await benchmarkPrompt(prompt);
    allResults.push(result);
    // 프롬프트 간 1초 딜레이
    await new Promise(r => setTimeout(r, 1000));
  }

  const reportPath = generateReport(allResults);
  console.log(`\n✅ 벤치마크 완료!`);
  console.log(`📋 리포트 저장: ${reportPath}`);
  console.log(`🖼  이미지 저장: ${OUTPUT_DIR}/`);
  console.log(`\n👉 다음 단계: 리포트의 수동 품질 점수를 대표님이 직접 채점해주세요.`);
}

main().catch(console.error);
