import express from 'express';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import filePollingAdapter from '../ai-engine/adapters/FilePollingAdapter.js';
import dbManager from '../database.js';

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

/** [POST] /task/request: 프롬프트를 받아 백그라운드 렌더링 큐에 등록 (비동기) */
router.post('/task/request', async (req, res) => {
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
Available assetTypes: "emoji" (pass an emoji character), "imageUrl" (pass a valid URL).`;

        // 고유 태스크 ID 발급
        const taskId = `vid_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        
        // 데이터베이스에 레코드 기록 (옵션)
        // await dbManager.createTask(...);

        // File Polling Adapter로 비동기 큐에 위임 (geminiAdapter 직접 호출 제거)
        const result = await filePollingAdapter.execute({
            taskId,
            agentId: 'lily',
            category: 'MEDIA',
            content: prompt,
            systemPrompt: systemPrompt + `\nTemplate: ${templateId}`,
            modelToUse: 'gemini-2.5-pro' // 고성능 어댑터에게 위임
        });

        // 클라이언트에게 즉시 202 Accepted 및 임시 ID 반환
        res.status(202).json({
            status: 'queued',
            taskId: taskId,
            message: result.message
        });

    } catch (err) {
        console.error('[VideoLab] Queue Request Error:', err);
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
