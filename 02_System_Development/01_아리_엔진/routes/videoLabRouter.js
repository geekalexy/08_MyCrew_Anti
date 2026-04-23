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
import { DataHarvester } from '../ai-engine/agents/youtube-autopilot/DataHarvester.js';
import { CurationAgent } from '../ai-engine/agents/youtube-autopilot/CurationAgent.js';
import { ImageLabAgent } from '../ai-engine/agents/youtube-autopilot/ImageLabAgent.js';
import { TTSAgent } from '../ai-engine/agents/youtube-autopilot/TTSAgent.js';

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

// ─────────────────────────────────────────────────────────────────────────────
// [Phase 25] AI 에이전트 판정 연동 엔드포인트
//
// 사용법:
//   Antigravity(Sonnet/Prime/Luca) 또는 Gemini 멀티페르소나가
//   POST /api/videolab/review/agent-verdict 를 호출하면
//   판정 내용을 파일로 저장 후 Socket.io로 VideoLab UI에 실시간 전달합니다.
//
// Request Body:
//   {
//     agent:      "Sonnet" | "Prime" | "Luca",
//     sessionId:  string,             // 어떤 리뷰 세션인지 식별
//     focusedCard: number | null,     // 포커스된 씬/카드 인덱스 (null = 전체)
//     verdict:    "PASS" | "FAIL" | "COMMENT",
//     content:    string,             // 판정 메시지 / 분석 내용
//     metadata:   object              // 추가 데이터 (optional)
//   }
// ─────────────────────────────────────────────────────────────────────────────

const VERDICTS_DIR = path.resolve(process.cwd(), 'outputs/review_verdicts');
if (!fs.existsSync(VERDICTS_DIR)) fs.mkdirSync(VERDICTS_DIR, { recursive: true });

// io 인스턴스를 router에서 접근하기 위한 미들웨어 주입용 setter
let _ioInstance = null;
export function setIoForVideoLabRouter(io) { _ioInstance = io; }

/** [POST] /review/agent-verdict — AI 에이전트 판정 수신 및 실시간 브로드캐스트 */
router.post('/review/agent-verdict', async (req, res) => {
    try {
        const {
            agent     = 'Sonnet',
            sessionId = `session_${Date.now()}`,
            focusedCard = null,
            verdict   = 'COMMENT',        // PASS | FAIL | COMMENT
            content   = '',
            metadata  = {}
        } = req.body;

        if (!content.trim()) {
            return res.status(400).json({ status: 'error', message: '판정 내용(content)이 필요합니다.' });
        }

        // 유효한 판정값 검증
        const VALID_VERDICTS = ['PASS', 'FAIL', 'COMMENT'];
        if (!VALID_VERDICTS.includes(verdict)) {
            return res.status(400).json({ status: 'error', message: `verdict는 ${VALID_VERDICTS.join('|')} 중 하나여야 합니다.` });
        }

        const verdictRecord = {
            id:          `verdict_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            agent,
            sessionId,
            focusedCard,
            verdict,
            content,
            metadata,
            createdAt:   new Date().toISOString()
        };

        // 1. 파일로 영구 저장 (세션별 누적)
        const verdictFilePath = path.join(VERDICTS_DIR, `${sessionId}.json`);
        let existing = [];
        if (fs.existsSync(verdictFilePath)) {
            try { existing = JSON.parse(fs.readFileSync(verdictFilePath, 'utf8')); } catch {}
        }
        existing.push(verdictRecord);
        fs.writeFileSync(verdictFilePath, JSON.stringify(existing, null, 2));

        // 2. Socket.io로 VideoLab에 실시간 브로드캐스트
        if (_ioInstance) {
            _ioInstance.of('/review').emit('review:agent_verdict', verdictRecord);
            console.log(`[VideoLab/Review] 판정 브로드캐스트 → [${agent}] ${verdict}: "${content.slice(0, 50)}..."`);
        } else {
            console.warn('[VideoLab/Review] io 인스턴스 미등록 — Socket 브로드캐스트 스킵');
        }

        res.json({ status: 'ok', verdictId: verdictRecord.id, record: verdictRecord });

    } catch (err) {
        console.error('[VideoLab/Review] agent-verdict 에러:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/** [GET] /review/verdicts/:sessionId — 세션의 모든 판정 이력 조회 */
router.get('/review/verdicts/:sessionId', (req, res) => {
    try {
        const verdictFilePath = path.join(VERDICTS_DIR, `${req.params.sessionId}.json`);
        if (!fs.existsSync(verdictFilePath)) {
            return res.json({ status: 'ok', verdicts: [] });
        }
        const verdicts = JSON.parse(fs.readFileSync(verdictFilePath, 'utf8'));
        res.json({ status: 'ok', sessionId: req.params.sessionId, verdicts });
    } catch (err) {
        res.status(500).json({ status: 'error', message: err.message });
    }
});

/** [POST] /review/auto-analyze — 텍스트 + Vision 이미지 병행 검수 */
router.post('/review/auto-analyze', async (req, res) => {
    try {
        const { sessionId, scriptScenes, ttsMetadata } = req.body;

        if (!sessionId || !scriptScenes) {
            return res.status(400).json({ status: 'error', message: 'sessionId와 scriptScenes가 필요합니다.' });
        }

        // ── 1단계: Vision 이미지 품질 검수 (이미지가 있는 씬만) ──────────────────
        const { analyzeImageForPrompt } = await import('../ai-engine/services/imageAnalysisService.js');
        const OUTPUTS_DIR = path.resolve(process.cwd(), 'outputs');

        const visionPrompt = `당신은 유튜브 쇼츠 콘텐츠 품질 검수 전문가입니다.
이 이미지가 유튜브 쇼츠 썸네일/씬 이미지로 사용될 때 품질을 평가하세요.

반드시 아래 JSON 형식으로만 반환하세요 (백틱 없이):
{
  "visualScore": 1~10,
  "readability": "높음" | "보통" | "낮음",
  "issues": ["문제점1", "문제점2"],
  "verdict": "PASS" | "FAIL",
  "comment": "한 줄 코멘트"
}`;

        const visionResults = [];
        for (let i = 0; i < scriptScenes.length; i++) {
            const scene = scriptScenes[i];
            const assetImage = scene.assetImage;
            if (!assetImage) continue;

            // URL → 로컬 파일 경로 변환
            const localPath = assetImage.startsWith('http')
                ? path.join(OUTPUTS_DIR, assetImage.replace(/^https?:\/\/[^/]+\/outputs\//, ''))
                : assetImage;

            if (!fs.existsSync(localPath)) continue;

            try {
                const ext = path.extname(localPath).toLowerCase();
                const mimeType = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
                const visionResult = await analyzeImageForPrompt(localPath, visionPrompt, '', mimeType);
                let parsed;
                try { parsed = JSON.parse(visionResult.text.replace(/^```json?\s*/i, '').replace(/\s*```$/, '').trim()); } catch { continue; }
                visionResults.push({ sceneIndex: i, ...parsed });
                console.log(`[VideoLab/AutoAnalyze] Scene ${i+1} Vision: ${parsed.verdict} (점수: ${parsed.visualScore})`);
            } catch (vErr) {
                console.warn(`[VideoLab/AutoAnalyze] Scene ${i+1} Vision 분석 실패 (스킵):`, vErr.message);
            }
        }

        // ── 2단계: 텍스트+TTS 기반 멀티페르소나 검수 ──────────────────────────────
        const visionSummary = visionResults.length > 0
            ? `\n\n[Vision 이미지 검수 결과]\n${visionResults.map(v =>
                `Scene ${v.sceneIndex+1}: ${v.verdict} (시각점수 ${v.visualScore}/10, 가독성 ${v.readability}) — ${v.comment}${v.issues?.length ? ' 문제: ' + v.issues.join(', ') : ''}`
              ).join('\n')}`
            : '';

        const systemPrompt = `당신은 모델 gemini-2.5-flash로서 Prime(전략), Sonnet(비주얼), Luca(기술)의 3인 전문가 그룹 역할을 수행합니다.

[페르소나 1: Prime - 콘텐츠 전략 총괄]
- Hook 씬 텍스트 15자 이내 확인 (초과 시 FAIL)
- 5단계 시나리오 흐름(Hook→Problem→Proof→Climax→CTA) 완성도
- CTA의 시리즈 연결 후킹 파워

[페르소나 2: Sonnet - 비주얼 아트 디렉터]
- Vision 이미지 검수 결과를 반드시 반영하여 코멘트 (이미지가 없으면 텍스트 기반 예측)
- 시각적 품질 FAIL이 있으면 해당 씬 인덱스를 focusedCard에 명시하고 FAIL 판정
- 가독성, 대비율, 브랜드 일관성 평가

[페르소나 3: Luca - 파이프라인 엔지니어]
- 오디오 프레임 총합 → 초 단위 확인 (60초 이내 쇼츠 규격)
- 씬 수 5개 확인

반드시 JSON 배열로만 반환 (백틱 없이):
[{ "agent": "Prime"|"Sonnet"|"Luca", "verdict": "PASS"|"FAIL"|"COMMENT", "content": "코멘트", "focusedCard": null|number }]`;

        const userPrompt = `[대본 시나리오]\n${JSON.stringify(scriptScenes, null, 2)}\n\n[TTS 메타데이터]\n${JSON.stringify(ttsMetadata || {}, null, 2)}${visionSummary}`;

        console.log(`[VideoLab/AutoAnalyze] 멀티페르소나 + Vision 검수 시작 (Session: ${sessionId}, Vision씬: ${visionResults.length}개)`);
        const aiOutput = await GeminiAdapter.generateResponse(userPrompt, systemPrompt, 'gemini-2.5-flash');

        let jsonStr = (aiOutput.text || aiOutput).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const reviews = JSON.parse(jsonStr);

        const verdictFilePath = path.join(VERDICTS_DIR, `${sessionId}.json`);
        let existing = [];
        if (fs.existsSync(verdictFilePath)) {
            try { existing = JSON.parse(fs.readFileSync(verdictFilePath, 'utf8')); } catch {}
        }

        const generatedRecords = [];
        for (const rev of reviews) {
            const verdictRecord = {
                id:          `verdict_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
                agent:       rev.agent,
                sessionId,
                focusedCard: rev.focusedCard !== undefined ? rev.focusedCard : null,
                verdict:     rev.verdict,
                content:     rev.content,
                createdAt:   new Date().toISOString()
            };
            existing.push(verdictRecord);
            generatedRecords.push(verdictRecord);
        }

        fs.writeFileSync(verdictFilePath, JSON.stringify(existing, null, 2));

        if (_ioInstance) {
            for (const rec of generatedRecords) {
                _ioInstance.of('/review').emit('review:agent_verdict', rec);
            }
        }

        res.json({ status: 'ok', records: generatedRecords, visionResults });
    } catch (err) {
        console.error('[VideoLab/AutoAnalyze] 에러:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [Phase 25] 씬별 이미지 재생성 엔드포인트
//
// FAIL 판정을 받은 특정 씬 하나만 골라서 이미지를 재생성합니다.
// ImageLabAgent의 _generateAIImage / _generateHTMLCard 로직을 직접 재사용합니다.
//
// Request Body:
//   {
//     sessionId:   string,           // 리뷰 세션 식별자
//     sceneIndex:  number,           // 재생성할 씬 인덱스 (0-based)
//     scene:       object,           // 해당 씬 데이터 { type, textLines, ... }
//     theme:       object,           // 채널 테마 { brandColors, brandPreset }
//     channelType: string            // 채널 유형 ('finance' | 'ai-tips' | ...)
//   }
//
// Response:
//   { status: 'ok', sceneIndex, newImageUrl, verdictRecord }
// ─────────────────────────────────────────────────────────────────────────────

/** [POST] /review/regenerate-scene-image — 특정 씬 이미지만 재생성 */
router.post('/review/regenerate-scene-image', async (req, res) => {
    try {
        const {
            sessionId,
            sceneIndex,
            scene,
            theme        = {},
            channelType  = 'general',
            feedback     = ''
        } = req.body;

        if (sessionId === undefined || sceneIndex === undefined || !scene) {
            return res.status(400).json({ status: 'error', message: 'sessionId, sceneIndex, scene 필드가 필요합니다.' });
        }

        // ImageLabAgent 로직을 직접 재활용 (서버 내부 호출이므로 fetch 대신 직접 import)
        const { ImageLabAgent } = await import('../ai-engine/agents/youtube-autopilot/ImageLabAgent.js');
        const agent = new ImageLabAgent(`http://localhost:${process.env.PORT || 4000}`);

        const SCENE_STRATEGY = {
            hook:    'ai-image',
            problem: 'html-card',
            proof:   'html-card',
            climax:  'ai-image',
            cta:     'html-card',
        };

        const strategy = SCENE_STRATEGY[scene.type] || 'html-card';
        const brandColors = theme?.brandColors || ['#1A1A2E', '#E94560'];

        console.log(`[VideoLab/Regen] Scene ${sceneIndex} (${scene.type}) 재생성 시작 — 전략: ${strategy}`);

        let newImageUrl;
        try {
            if (strategy === 'ai-image') {
                newImageUrl = await agent._generateAIImage(scene, theme, channelType, feedback);
            } else {
                newImageUrl = await agent._generateHTMLCard(scene, theme, brandColors);
            }
        } catch (imgErr) {
            console.error('[VideoLab/Regen] 이미지 생성 실패:', imgErr.message);
            return res.status(500).json({ status: 'error', message: `이미지 생성 실패: ${imgErr.message}` });
        }

        console.log(`[VideoLab/Regen] ✅ Scene ${sceneIndex} 재생성 완료: ${newImageUrl}`);

        // 재생성 완료를 판정 레코드로 기록
        const verdictRecord = {
            id:          `regen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            agent:       'System',
            sessionId,
            focusedCard: sceneIndex,
            verdict:     'COMMENT',
            content:     `🔁 Scene ${sceneIndex + 1} 이미지가 재생성되었습니다.`,
            metadata:    { newImageUrl, regenerated: true },
            createdAt:   new Date().toISOString(),
        };

        // 판정 파일에 누적 저장
        const verdictFilePath = path.join(VERDICTS_DIR, `${sessionId}.json`);
        let existing = [];
        if (fs.existsSync(verdictFilePath)) {
            try { existing = JSON.parse(fs.readFileSync(verdictFilePath, 'utf8')); } catch {}
        }
        existing.push(verdictRecord);
        fs.writeFileSync(verdictFilePath, JSON.stringify(existing, null, 2));

        // Socket.io로 두 이벤트 동시 전송:
        //   1. 재생성 알림 채팅 버블
        //   2. 씬 이미지 교체 신호 (프론트엔드가 sceneIndex의 이미지를 바꿔치기)
        if (_ioInstance) {
            _ioInstance.of('/review').emit('review:agent_verdict', verdictRecord);
            _ioInstance.of('/review').emit('review:scene_image_updated', {
                sessionId,
                sceneIndex,
                newImageUrl,
            });
        }

        res.json({ status: 'ok', sceneIndex, newImageUrl, verdictRecord });

    } catch (err) {
        console.error('[VideoLab/Regen] 씬 이미지 재생성 에러:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [Phase 25.5] 텍스트 대본 재생성 (Script Correction)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/review/regenerate-scene-text', async (req, res) => {
    try {
        const { sessionId, sceneIndex, scene, feedback } = req.body;
        if (sessionId === undefined || sceneIndex === undefined || !scene || !feedback) {
            return res.status(400).json({ status: 'error', message: '필수 파라미터가 누락되었습니다.' });
        }

        const systemPrompt = `당신은 유튜브 쇼츠 전문 스크립터입니다.
주어진 기존 대본과 검수자의 교정 피드백(Feedback)을 바탕으로 대본 텍스트를 수정하세요.
수정된 대본 텍스트만을 문자열 배열(string[]) 형태의 JSON으로 반환하세요.
예시: ["이전보다 더 강렬해진 새로운 훅입니다.", "구독 좋아요 부탁드려요"]`;

        const userPrompt = `[기존 대본]\n${JSON.stringify(scene.textLines)}\n\n[검수자 피드백]\n${feedback}`;
        
        console.log(`[VideoLab/RegenText] Scene ${sceneIndex} 텍스트 교정 시작...`);
        const aiOutput = await GeminiAdapter.generateResponse(userPrompt, systemPrompt, 'gemini-2.5-flash');
        
        let jsonStr = aiOutput.text || aiOutput;
        jsonStr = jsonStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const newTextLines = JSON.parse(jsonStr);

        console.log(`[VideoLab/RegenText] ✅ 교정 완료:`, newTextLines);

        const verdictRecord = {
            id:          `regen_txt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            agent:       'System',
            sessionId,
            focusedCard: sceneIndex,
            verdict:     'COMMENT',
            content:     `📝 Scene ${sceneIndex + 1} 텍스트가 교정되었습니다.`,
            createdAt:   new Date().toISOString(),
        };

        if (_ioInstance) {
            _ioInstance.of('/review').emit('review:agent_verdict', verdictRecord);
            _ioInstance.of('/review').emit('review:scene_text_updated', {
                sessionId,
                sceneIndex,
                newTextLines
            });
        }

        res.json({ status: 'ok', sceneIndex, newTextLines });
    } catch (err) {
        console.error('[VideoLab/RegenText] 대본 교정 에러:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [Phase 25.5] TTS 오디오 재생성 (Audio Correction)
// ─────────────────────────────────────────────────────────────────────────────
router.post('/review/regenerate-tts', async (req, res) => {
    try {
        const { sessionId, sceneIndex, scene, voiceKey = 'A', feedback = '' } = req.body;
        // TTSAgent를 동적으로 가져옵니다
        const { TTSAgent } = await import('../ai-engine/agents/youtube-autopilot/TTSAgent.js');
        
        console.log(`[VideoLab/RegenTTS] Scene ${sceneIndex} 음성 재생성 시작 (버전: ${voiceKey})... 피드백: ${feedback}`);
        
        const publicDir = process.env.REMOTION_PUBLIC_DIR || path.resolve(process.cwd(), 'remotion-poc/public');
        
        // 단일 씬에 대해 TTS를 다시 생성 (TTSAgent의 generateAudioForScenario 재활용을 위해 래핑)
        const dummyScenario = { scenes: [scene] };
        const updatedScenario = await TTSAgent.generateAudioForScenario(dummyScenario, publicDir, voiceKey, feedback);
        
        const updatedScene = updatedScenario.scenes[0];
        
        console.log(`[VideoLab/RegenTTS] ✅ 음성 재생성 완료. 길이: ${updatedScene.durationFrames}프레임`);

        const verdictRecord = {
            id:          `regen_tts_${Date.now()}`,
            agent:       'System',
            sessionId,
            focusedCard: sceneIndex,
            verdict:     'COMMENT',
            content:     `🎙️ Scene ${sceneIndex + 1} 음성이 갱신되었습니다.`,
            createdAt:   new Date().toISOString(),
        };

        if (_ioInstance) {
            _ioInstance.of('/review').emit('review:agent_verdict', verdictRecord);
            _ioInstance.of('/review').emit('review:scene_tts_updated', {
                sessionId,
                sceneIndex,
                audioFile: updatedScene.audioFile,
                durationFrames: updatedScene.durationFrames
            });
        }

        res.json({ status: 'ok', sceneIndex, updatedScene });
    } catch (err) {
        console.error('[VideoLab/RegenTTS] 음성 교정 에러:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [Phase 25.5] 최종 컴포지션 마스터 렌더링 (Finalize)
// 교정된 최종 Scenario 배열 전체를 받아 단일 MP4를 굽습니다.
// ─────────────────────────────────────────────────────────────────────────────
router.post('/review/finalize-render', async (req, res) => {
    try {
        const { sessionId, finalScenario, channelType, voiceKey = 'A' } = req.body;
        if (!finalScenario) return res.status(400).json({ status: 'error', message: 'finalScenario가 누락되었습니다.' });

        console.log(`[VideoLab/Finalize] 🚀 세션 ${sessionId} 최종 마스터 비디오 렌더링 시작...`);
        const { VideoAdapter } = await import('../ai-engine/adapters/VideoAdapter.js');
        
        const outputFileName = `final-autopilot-${sessionId}.mp4`;
        const remotionProps = {
            theme: finalScenario.theme,
            scenes: finalScenario.scenes,
            totalDurationFrames: finalScenario.scenes.reduce((acc, s) => acc + (s.durationFrames || 150), 0)
        };

        const outputPath = await VideoAdapter.renderVideo(remotionProps, outputFileName);
        console.log(`[VideoLab/Finalize] ✅ 마스터 비디오 렌더링 완료: ${outputPath}`);

        res.json({ status: 'ok', videoUrl: `http://localhost:${process.env.PORT || 4000}/outputs/${outputFileName}` });
    } catch (err) {
        console.error('[VideoLab/Finalize] 최종 렌더링 에러:', err);
        res.status(500).json({ status: 'error', message: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [Phase 26] 통합 워크플로우: Mock 제거 및 라이브 수집/에셋 생성
// ─────────────────────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────────────────────
// [Phase 26] Legacy Lab 경쟁 채널 분석 엔드포인트 (복원 + DataHarvester 시드 연동)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * [POST] /analyze-competitor
 * 유튜브 URL 2개를 받아 핵심 키워드와 Hook 패턴을 추출합니다.
 * 추출된 키워드는 DataHarvester seedKeywords로 주입되어 뉴스 수집 정밀도를 높입니다.
 */
router.post('/analyze-competitor', async (req, res) => {
    try {
        const { urls } = req.body;
        if (!Array.isArray(urls) || urls.length < 1) {
            return res.status(400).json({ error: '최소 1개 이상의 유튜브 링크가 필요합니다.' });
        }

        const transcripts = await extractTranscripts(urls);
        const successTranscripts = transcripts.filter(t => !t.isError);

        if (successTranscripts.length === 0) {
            return res.status(422).json({
                error: 'TRANSCRIPT_EXTRACTION_FAILED',
                message: '자막 추출에 실패했습니다. URL을 확인하거나 수동으로 키워드를 입력해주세요.',
                failedUrls: transcripts.map(t => t.url)
            });
        }

        const combinedText = successTranscripts
            .map((t, idx) => `[영상 ${idx+1}]\n${t.transcript}`)
            .join('\n\n');

        const systemPrompt = `당신은 유튜브 쇼츠 트렌드 분석 전문가입니다.
주어진 영상 자막에서 다음을 추출하세요:
1. 핵심 키워드 3~5개 (뉴스 검색에 쓸 수 있는 명사)
2. Hook 패턴 (첫 3초 구조)
3. 채널 전략 요약 (1~2줄)

반드시 아래 JSON 포맷으로만 반환하세요:
{
  "seedKeywords": ["키워드1", "키워드2", "키워드3"],
  "hookPattern": "훅 패턴 설명",
  "strategySummary": "전략 요약"
}`;

        const aiOutput = await GeminiAdapter.generateResponse(
            combinedText,
            systemPrompt,
            'gemini-2.5-flash'
        );

        let jsonStr = (aiOutput.text || aiOutput).replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
        const analysis = JSON.parse(jsonStr);

        res.json({
            status: 'ok',
            seedKeywords: analysis.seedKeywords || [],
            hookPattern: analysis.hookPattern || '',
            strategySummary: analysis.strategySummary || '',
            analyzedCount: successTranscripts.length
        });

    } catch (err) {
        console.error('[VideoLab/Competitor] 경쟁 분석 오류:', err);
        res.status(500).json({ error: err.message });
    }
});

// ─────────────────────────────────────────────────────────────────────────────
// [Phase 26] 통합 워크플로우: 실데이터 수집 + Vision 검수
// ─────────────────────────────────────────────────────────────────────────────
router.post('/run-pipeline', async (req, res) => {
    try {
        const { channelType, sessionId, seedKeywords = [] } = req.body;
        
        // HTTP 응답은 즉시 반환
        res.json({ status: 'started', sessionId });

        (async () => {
            const emitProgress = (step, log) => {
                console.log(`[VideoLab/Pipeline] ${log}`);
                if (_ioInstance) {
                    _ioInstance.of('/review').emit('review:pipeline_progress', { step, log, sessionId });
                }
            };

            try {
                const harvester    = new DataHarvester();
                const curator      = new CurationAgent();
                const imageLabAgent = new ImageLabAgent(`http://localhost:${process.env.PORT || 4000}`);

                // 1단계: DataHarvester (Legacy Lab 시드 키워드 포함)
                const seedInfo = seedKeywords.length > 0 ? ` (경쟁 분석 시드 ${seedKeywords.length}개 포함)` : '';
                emitProgress(10, `🔍 [1단계] DataHarvester — 구글뉴스 수집 중${seedInfo}...`);

                const harvestResult = await harvester.harvestDailySources(channelType || 'finance-viral', seedKeywords);

                if (harvestResult.failed || harvestResult.totalCount === 0) {
                    throw new Error(`DataHarvester 실패: 수집된 뉴스 소스 0건 (구글뉴스 RSS 연결을 확인하세요)`);
                }

                emitProgress(30, `✅ [DataHarvester] 실제 뉴스 ${harvestResult.totalCount}건 수집 완료`);

                // 2단계: CurationAgent
                emitProgress(40, '🧠 [2단계] CurationAgent — 실제 뉴스 기반 시나리오 구성 중...');
                const topScenarios = await curator.analyzeAndSelectTop3(harvestResult.sources, channelType || 'finance-viral');
                const top1 = topScenarios?.[0];
                if (!top1) throw new Error('시나리오 추출에 실패했습니다.');
                emitProgress(60, `✅ [CurationAgent] Top1 채택: "${top1.selectedSourceTitle.slice(0, 30)}..."`);

                // 소켓으로 Top3 큐레이션 데이터 전송 (큐레이션 검수 뷰 진입용)
                if (_ioInstance) {
                    _ioInstance.of('/review').emit('review:curation_ready', {
                        sessionId,
                        sources: harvestResult.sources.slice(0, 10), // 상위 10건 출처 표시
                        topScenarios: topScenarios.map(s => ({
                            title: s.selectedSourceTitle,
                            score: s.totalScore,
                            hook:  s.scenario?.scenes?.[0]?.textLines?.[0] || ''
                        }))
                    });
                }

                // 3단계: ImageLabAgent
                emitProgress(70, '🎨 [3단계] ImageLabAgent — 씬별 AI 이미지 생성 중...');
                const scenarioWithImages = await imageLabAgent.generateAssetsForScenario(top1.scenario, channelType || 'finance-viral');

                // 4단계: TTS
                emitProgress(85, '🎙️ [4단계] TTSAgent — 오디오 프레임 동기화 중...');
                const publicDir = process.env.REMOTION_PUBLIC_DIR || path.resolve(process.cwd(), 'remotion-poc/public');
                const scenarioWithAudio = await TTSAgent.generateAudioForScenario(scenarioWithImages, publicDir, 'C');

                emitProgress(100, '🎉 파이프라인 완료. 리뷰 스튜디오로 이동합니다.');

                if (_ioInstance) {
                    _ioInstance.of('/review').emit('review:pipeline_ready', {
                        sessionId,
                        scenario: scenarioWithAudio
                    });
                }

            } catch (err) {
                console.error('[VideoLab/Pipeline] 에러:', err);
                emitProgress(0, `❌ 파이프라인 중단: ${err.message}`);
                if (_ioInstance) _ioInstance.of('/review').emit('review:pipeline_error', { sessionId, message: err.message });
            }
        })();

    } catch (error) {
        res.status(500).json({ status: 'error', message: error.message });
    }
});

export default router;
