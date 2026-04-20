import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import geminiAdapter from '../ai-engine/adapters/geminiAdapter.js';
import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);
const router = express.Router();

// ── 디렉토리 셋업 ───────────────────────────────────────────
const TEMP_DIR = path.resolve(process.cwd(), 'outputs/video_lab');
const WINNERS_DIR = path.resolve(process.cwd(), 'outputs/video_winners');

[TEMP_DIR, WINNERS_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── 로컬 Remotion 실행기 (Timeout 및 JSON 파싱 포함) ────────────────
async function renderRemotionVideo(jsonProps) {
    const remotionDir = path.resolve(process.cwd(), 'remotion-poc');
    const fileName = `video_${Date.now()}_${crypto.randomBytes(4).toString('hex')}.mp4`;
    const outputPath = path.join(TEMP_DIR, fileName);
    
    // JSON Props 주입 파일
    const propsPath = path.join(remotionDir, `input-props-${Date.now()}.json`);
    fs.writeFileSync(propsPath, JSON.stringify(jsonProps));

    const renderCommand = `./node_modules/.bin/remotion render src/index.ts MyComp ${outputPath} --props=${propsPath}`;
    
    // 렌더링 실행 (타임아웃은 Express 레벨에서 방어하지만 빌드 실패 시 catch 용)
    await execPromise(renderCommand, { cwd: remotionDir });
    
    // 임시 props 파일 정리
    if (fs.existsSync(propsPath)) fs.unlinkSync(propsPath);
    
    return `/outputs/video_lab/${fileName}`;
}

// ── 라우트 핸들러 ───────────────────────────────────────────

/** [POST] /generate: 프롬프트를 받아 Gemini로 Props를 짜고 Remotion MP4 렌더링 */
router.post('/generate', async (req, res) => {
    // 504 Timeout 방어: 서버 처리 시간 3분 (180초) 강제 연장
    req.setTimeout(180000); 
    res.setTimeout(180000);

    try {
        const { prompt, templateId = "socian-reels" } = req.body;
        if (!prompt) return res.status(400).json({ error: '프롬프트가 필요합니다.' });

        const systemPrompt = `You are Lily, Chief Video Engineer for MyCrew.
Your task is to convert the user's video prompt into valid JSON Props for a production-level Remotion Shorts/Reels composition.

Return ONLY a valid JSON object. Do NOT wrap it in markdown block quotes like \`\`\`json.
The JSON must strictly match the frontend Remotion component's expected Props structure for a dynamic Vertical Short (1080x1920).
Use standard Marketing Frameworks (Hook -> Solution -> Value -> CTA).

YOUR CRITICAL JOB IS ART DIRECTION: You must decide the visual layout and assets for EACH scene!
Available layoutTypes: "centered" (classic bold text), "chat-bubble" (simulates Instagram DM), "notification" (iOS banner style).
Available assetTypes: "emoji" (pass an emoji character), "imageUrl" (pass a valid URL).

Example expected keys for a Reels Template:
{
  "durationInSeconds": 15,
  "fps": 30,
  "theme": {
    "primaryColor": "#1E90FF",
    "secondaryColor": "#FAFAFA",
    "bgGradient": ["#0F172A", "#1E1B4B"]
  },
  "scenes": [
    {
      "type": "hook",
      "durationFrames": 90,
      "layoutType": "notification",
      "assetType": "emoji",
      "assetContent": "✉️",
      "textLines": ["댓글 문의,", "매출로 연결하는 방법"],
      "animationType": "bounceIn"
    },
    {
      "type": "solution",
      "durationFrames": 120,
      "layoutType": "chat-bubble",
      "assetType": "emoji",
      "assetContent": "💬",
      "textLines": ["제품링크/문의,", "DM 자동화로 해결!"],
      "animationType": "slideLeft"
    },
    {
      "type": "value",
      "durationFrames": 120,
      "layoutType": "centered",
      "assetType": "emoji",
      "assetContent": "💳",
      "textLines": ["업계 최저가,", "단 2,900원"],
      "animationType": "zoomIn",
      "highlightColor": "#FBBF24"
    },
    {
      "type": "cta",
      "durationFrames": 120,
      "layoutType": "centered",
      "assetType": "emoji",
      "assetContent": "🎁",
      "textLines": ["\\"최고\\" 댓글 달고,", "시크릿 쿠폰 받기"],
      "animationType": "pulse",
      "interactionElement": "comment_icon"
    }
  ]
}`;
        // 타겟 모델 설정 (gemini-2.0-pro 로 상향)
        const targetModel = 'gemini-2.0-pro-exp-0205'; // 안정판을 가리키도록 설정, 실패시 geminiAdapter가 flash로 폴백 (PRD 참조)
        
        let aiResult;
        try {
            aiResult = await geminiAdapter.generateResponse(prompt, systemPrompt, 'gemini-2.5-pro'); // Google GenAI Model alias 대응
        } catch (err) {
            // Flash 폴백 시뮬레이션
            console.warn('[VideoLab] Main model quota exceeded or failed. Falling back to Flash...');
            aiResult = await geminiAdapter.generateResponse(prompt, systemPrompt, 'gemini-2.5-flash');
        }

        // 마크다운 찌꺼기 제거 (Sanitizer)
        let rawText = aiResult.text || '';
        rawText = rawText.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        
        let jsonProps;
        try {
            jsonProps = JSON.parse(rawText);
        } catch (parseErr) {
            console.error("[VideoLab] JSON Parsing Error on text:", rawText);
            throw new Error("AI가 생성한 JSON 형식이 올바르지 않습니다.");
        }

        // Remotion 엔진 렌더링
        const videoUrl = await renderRemotionVideo(jsonProps);

        res.json({
            status: 'success',
            videoUrl: videoUrl,
            generatedProps: jsonProps,
            inferenceTimeMs: 0 // TODO: Add real measurement if needed
        });

    } catch (err) {
        console.error('[VideoLab] Generate Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/** [POST] /learn: 피드백 반영 및 Winner 보관 */
router.post('/learn', async (req, res) => {
    try {
        const { score, memo, videoUrl, generatedProps, promptUsed } = req.body;
        const avg = parseFloat(score);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        const skillPath = path.resolve(process.cwd(), 'skill-library/09_video/SKILL.md');
        
        const isWinner = avg >= 4.0;
        const logHeader = isWinner 
            ? `### [${timestamp}] 🏆 Winner Pattern (Score: ${avg})` 
            : `### [${timestamp}] ⛔ Failure Case (Score: ${avg})`;
        
        // SKILL.md 지식 축적
        const logEntry = `\n${logHeader}\n- **Prompt**: ${promptUsed}\n- **Feedback**: ${memo || '없음'}\n- **Props Snapshot**: ${JSON.stringify(generatedProps)}\n`;
        fs.appendFileSync(skillPath, logEntry);

        let winnerSaved = false;
        // Winner일 경우 파일 보관
        if (isWinner && videoUrl) {
            const relPath = videoUrl.replace(/^\//, ''); // /outputs... -> outputs...
            const srcPath = path.resolve(process.cwd(), relPath);
            const winnerName = `winner_${Date.now()}`;
            
            const destMp4 = path.join(WINNERS_DIR, `${winnerName}.mp4`);
            const destJson = path.join(WINNERS_DIR, `${winnerName}.json`);

            if (fs.existsSync(srcPath)) {
                fs.copyFileSync(srcPath, destMp4);
                fs.writeFileSync(destJson, JSON.stringify({
                    score: avg,
                    memo: memo,
                    prompt: promptUsed,
                    props: generatedProps
                }, null, 2));
                winnerSaved = true;
            }
        }

        res.json({ status: 'ok', winnerSaved });
    } catch (err) {
        console.error('[VideoLab] Learn Error:', err);
        res.status(500).json({ error: err.message });
    }
});

export default router;
