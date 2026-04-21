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

import ytSearch from 'yt-search';
import { extractTranscripts } from '../ai-engine/services/youtubeScraper.js';
import GeminiAdapter from '../ai-engine/adapters/GeminiAdapter.js';
import NotebookLMAdapter from '../ai-engine/adapters/NotebookLMAdapter.js';

/** [POST] /discover-trend: (Step 1) 카테고리/주제 검색 및 유튜브 트렌드 데이터 리스팅 */
router.post('/discover-trend', async (req, res) => {
    try {
        const { topic } = req.body;
        if (!topic) return res.status(400).json({ error: '주제 또는 카테고리가 필요합니다.' });

        // ESM 호환성 대비: ytSearch가 default 객체로 래핑되어 있을 경우 내부 함수 호출
        let searchResult;
        if (typeof ytSearch === 'function') {
            searchResult = await ytSearch(topic);
        } else if (ytSearch && typeof ytSearch.search === 'function') {
            searchResult = await ytSearch.search(topic);
        } else if (ytSearch && ytSearch.default && typeof ytSearch.default === 'function') {
            searchResult = await ytSearch.default(topic);
        } else {
            throw new Error(`yt-search 초기화 실패: ${typeof ytSearch}`);
        }

        if (!searchResult || !searchResult.videos) {
            throw new Error('검색 결과 데이터(videos)를 찾을 수 없습니다.');
        }

        const videos = searchResult.videos.slice(0, 10).map((v, idx) => ({
            rank: idx + 1,
            title: v.title,
            url: v.url,
            duration: v.timestamp,
            views: v.views,
            thumbnail: v.thumbnail || v.image || '',
            author: v.author?.name || v.author || '정보 없음'
        }));

        if (videos.length === 0) {
            return res.status(404).json({ error: '결과를 찾을 수 없습니다.' });
        }

        // 2. 검색된 제목들을 기반으로 거시적(Macro) 트렌드 분석 요약 (Gemini)
        const titlesText = videos.map(v => `${v.rank}. ${v.title} (조회수: ${v.views})`).join('\n');
        const systemPrompt = `You are a Trend Analyst for YouTube Shorts/Reels.
Summarize the current macro trend based on the titles of top videos below. Output in Korean.
Keep it strictly under 3 sentences. Emphasize what kind of content works best for this topic.`;

        const aiOutput = await GeminiAdapter.generateResponse(
            `주제: ${topic}\n\n최상위 영상 목록:\n${titlesText}\n\n위 리스트를 바탕으로 핵심 트렌드를 짧게 요약해줘.`,
            systemPrompt,
            'gemini-2.5-flash'
        );

        res.json({
            status: 'ok',
            trendSummary: aiOutput.text || aiOutput,
            videos
        });
    } catch (err) {
        console.error('[VideoLab] Discover Trend Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/** [POST] /analyze-script: (Step 2) 유튜브 링크 배열에서 자막을 추출하고 심층 훅(Hook) 분석 (기존 analyze-trend) */
router.post('/analyze-script', async (req, res) => {
    try {
        const { urls, brandGuideline } = req.body;
        if (!Array.isArray(urls) || urls.length < 2) {
            return res.status(400).json({ error: '최소 2개 이상의 유튜브 링크가 필요합니다.' });
        }

        // 1. 자막 추출
        const transcripts = await extractTranscripts(urls);
        const failed = transcripts.filter(t => t.isError);
        if (failed.length > 0) {
            // 한 개라도 실패 시 사용자에게 폴백 가이드로 리턴
            return res.status(422).json({ 
                error: 'TRANSCRIPT_EXTRACTION_FAILED', 
                message: '자막 자동 추출에 실패했습니다. 유튜브 설명란에서 직접 스크립트를 복사하여 입력해주세요.',
                failedUrls: failed.map(f => f.url)
            });
        }

        // 2. 여러 자막들을 하나로 합쳐 분석 프롬프트 구성
        const combinedText = transcripts.map((t, idx) => `[영상 ${idx+1} (${t.url}) 스크립트]\n${t.transcript}\n`).join('\n');
        
        const systemPrompt = `You are an elite video marketing strategist. Analyze the provided YouTube transcripts of viral videos.
Extract and output the following analysis in Korean:
1. 핵심 주제 및 소구점 (Core Topic & Selling points)
2. 가장 시청자를 잘 붙잡은 공통 Hook 패턴 (Common Hook Patterns)
3. 영상 간 서사 전개 방식의 차이점 (Differences in storytelling)
4. 우리가 브랜드 계정에 적용할 수 있는 베스트 프랙티스 (Best Practices for our brand)`;

        const aiOutput = await GeminiAdapter.generateResponse(
            `다음은 인기 영상들의 자막입니다. 심층 분석 리포트를 작성해주세요.\n\n${combinedText}`,
            systemPrompt,
            'gemini-2.5-pro'
        );

        res.json({
            status: 'ok',
            analysisReport: aiOutput.text || aiOutput,
            transcripts // 향후 스크립트 작성 시 참조용으로 반환
        });

    } catch (err) {
        console.error('[VideoLab] Analyze Trend Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/** [POST] /generate-script: (Step 2) 분석 리포트 기반 씬 분할 스크립트 생성 */
router.post('/generate-script', async (req, res) => {
    try {
        const { analysisReport, customInstructions } = req.body;
        if (!analysisReport) return res.status(400).json({ error: '분석 리포트가 필요합니다.' });

        const systemPrompt = `You are a top-tier video creative director & scriptwriter.
Based on the viral trend analysis report and user instructions, generate a highly engaging video script.
        
Return ONLY a valid JSON object with two keys: "titles" and "scenes".
Schema:
{
  "titles": ["Title 1", "Title 2", "Title 3"],
  "scenes": [
    { "sceneId": 1, "duration": 3, "text": "voiceover or caption text", "visualPrompt": "detailed visual prompt" }
  ]
}

Critical rules:
1. Apply the winning hooks identified in the report.
2. Provide exactly 3 highly engaging, click-bait style titles in the "titles" array.
3. Keep the format strict JSON.
4. ABSOLUTE MATH CONSTRAINT: You MUST calculate the exact total seconds requested by the user. The SUM of all scene "duration" values MUST strictly equal that total target. If the user asks for "1분 30초", the sum must be 90. If "2분 0초", the sum must be 120. Check your math!`;

        let promptText = `분석 리포트:\n${analysisReport}\n\n`;
        if (customInstructions) {
            promptText += `추가 지침 (Brand Guidelines / Topic / Target Duration):\n${customInstructions}\n`;
        }
        promptText += `\n위 내용을 반영하여 3개의 타이틀 후보와 씬으로 분할된 JSON 스크립트를 생성해주세요.`;

        const aiOutput = await GeminiAdapter.generateResponse(
            promptText,
            systemPrompt,
            'gemini-2.5-pro'
        );

        let jsonStr = aiOutput.text || aiOutput;
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(jsonStr);

        res.json({ status: 'ok', scriptScenes: parsed.scenes || parsed, scriptTitles: parsed.titles || [] });
    } catch (err) {
        console.error('[VideoLab] Generate Script Error:', err);
        res.status(500).json({ error: err.message });
    }
});

/** [POST] /regenerate-scene: (Step 4) 특정 씬만 AI로 다시 생성 (교체 기능) */
router.post('/regenerate-scene', async (req, res) => {
    try {
        const { originalScene, fullScriptStr, analysisReport, customInstructions } = req.body;
        if (!originalScene || !fullScriptStr) return res.status(400).json({ error: '필수 데이터가 없습니다.' });

        const prompt = `
당신은 최고의 영상 콘텐츠 크리에이티브 디렉터입니다.
아래 전체 스크립트 진행 흐름과 분석 리포트를 참고하여, 특정 씬(Scene)의 내용이 마음에 들지 않아 "완전히 다른 느낌이나 더 매력적인 대안"으로 1개만 다시 작성하려 합니다.

[분석 리포트 및 지시사항]
${analysisReport.slice(0, 1000)}...
추가요구사항: ${customInstructions || '없음'}

[전체 스크립트 흐름 (참고용)]
${fullScriptStr}

[다시 작성해야 할 기존 씬 정보]
- Scene 번호: ${originalScene.sceneId}
- 길이(초): ${originalScene.duration}초
- 기존 텍스트: ${originalScene.text}
- 기존 비주얼: ${originalScene.visualPrompt}

위 기존 씬과 "명확히 차별화되면서도 전체 흐름에 자연스럽게 녹아드는" 새로운 대안 씬을 작성해주세요.
반드시 아래 JSON 포맷 1개만 반환하세요. (백틱 없이 형태만 유지)

{
  "text": "새로운 내레이션 또는 자막",
  "visualPrompt": "새로운 화면 구성 지시어"
}
`;
        const response = await GeminiAdapter.generateResponse(prompt, '당신은 크리에이티브 시니어 디렉터입니다.', 'gemini-2.5-pro');
        let jsonStr = response.text || response;
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const altScene = JSON.parse(jsonStr);

        res.json({ status: 'ok', altScene });
    } catch (err) {
        console.error('[VideoLab] Regenerate Scene Error:', err);
        res.status(500).json({ error: err.message });
    }
});

import { exec } from 'child_process';
import util from 'util';
const execPromise = util.promisify(exec);

/** [POST] /export-notebooklm: (Step 4) 생성된 스크립트를 노트북LM으로 쏴줍니다 (notebooklm-mcp-cli 활용) */
router.post('/export-notebooklm', async (req, res) => {
    try {
        const { title, scriptScenes } = req.body;
        if (!scriptScenes) return res.status(400).json({ error: '스크립트 데이터가 없습니다.' });
        
        // 1. 임시 텍스트 파일 생성
        const fs = await import('fs');
        const path = await import('path');
        const tmpFilePath = path.resolve(process.cwd(), `notebook_output_${Date.now()}.txt`);
        
        const scriptContent = scriptScenes.map(s => 
            `[Scene ${s.sceneId}] (${s.duration}초)\n텍스트: ${s.text}\n비주얼 기획: ${s.visualPrompt}\n`
        ).join('\n');
        
        fs.writeFileSync(tmpFilePath, scriptContent);

        const safeTitle = (title || "Video Lab Script").replace(/"/g, '\\"');
        
        // 2. Custom NotebookLM Adapter를 사용해 Node.js 네이티브 통신 (CLI 우회)
        console.log(`[VideoLab] 자체 NotebookLM 어댑터 동기화 시작: ${safeTitle}`);
        
        try {
            await NotebookLMAdapter.createNotebookAndUpload(safeTitle, tmpFilePath);
            console.log('[VideoLab] 자체 NotebookLM 동기화 완료!');
        } catch (adapterErr) {
            console.error('[VideoLab] 어댑터 수행 실패:', adapterErr);
            throw adapterErr;
        }

        // 3. 사용 완료된 텍스트 삭제
        if (fs.existsSync(tmpFilePath)) {
            fs.unlinkSync(tmpFilePath);
        }

        res.json({ status: 'ok', message: 'NotebookLM Native Sync Process Initiated' });
    } catch (err) {
        console.error('[VideoLab] Export NotebookLM Error:', err);
        res.status(500).json({ error: err.message || 'NotebookLM CLI 실행 실패 (nlm이 설치되었는지 확인하세요)' });
    }
});

/** [POST] /save-script: 생성된 스크립트를 서버 파일(outputs/video-scripts)로 저장합니다 */
router.post('/save-script', async (req, res) => {
    try {
        const { title, scriptScenes } = req.body;
        if (!scriptScenes) return res.status(400).json({ error: '스크립트 데이터가 없습니다.' });

        const fs = await import('fs');
        const path = await import('path');
        const outputDir = path.resolve(process.cwd(), 'outputs', 'video-scripts');
        
        if (!fs.existsSync(outputDir)) {
            fs.mkdirSync(outputDir, { recursive: true });
        }

        const safeTitle = (title || "Video Lab Script").replace(/\//g, '_');
        const fileName = `${safeTitle.replace(/\s+/g, '_')}_${Date.now()}.json`;
        const filePath = path.join(outputDir, fileName);
        
        fs.writeFileSync(filePath, JSON.stringify({ title: safeTitle, scriptScenes, createdAt: new Date() }, null, 2), 'utf-8');

        res.json({ status: 'ok', message: '스크립트가 성공적으로 저장되었습니다.', path: filePath });
    } catch (err) {
        console.error('[VideoLab] Save Script Error:', err);
        res.status(500).json({ error: err.message || '스크립트 저장에 실패했습니다.' });
    }
});

/** [POST] /task/request: (기존 Legacy) 프롬프트를 받아 백그라운드 렌더링 큐에 등록 (비동기) */
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
