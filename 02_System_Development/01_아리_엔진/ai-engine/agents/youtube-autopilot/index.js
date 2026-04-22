import { DataHarvester } from './DataHarvester.js';
import { CurationAgent } from './CurationAgent.js';
import { ImageLabAgent } from './ImageLabAgent.js';       // Phase 24.5 ⭐
import { TTSAgent } from './TTSAgent.js';
import { VideoAdapter } from '../../adapters/VideoAdapter.js';
import { YouTubeUploader } from '../../services/youtubeUploader.js'; // Phase 24 ✅

/**
 * [Youtube Autopilot Master Daemon]
 * 크론잡(Cron) 등으로 주기적으로 실행되며, 수집 → 채택 → 이미지생성 → 렌더링 → 무인 업로드
 * 전 과정을 통제하는 마스터 파이프라인 엔진입니다.
 */
export async function runAutopilotPipeline(channelType = 'finance') {
    console.log(`\n======================================================`);
    console.log(`🚀 [Phase 24] 제로터치 무인 유튜브 공장 가동 (Target: ${channelType})`);
    console.log(`======================================================\n`);

    const harvester     = new DataHarvester();
    const curator       = new CurationAgent();
    const imageLabAgent = new ImageLabAgent('http://localhost:4000'); // Phase 24.5

    // 1. 정보 수집 로직 (Harvester)
    const rawSources = await harvester.harvestDailySources(channelType);
    if (!rawSources || rawSources.length === 0) {
        console.error('수집된 소스가 없습니다. 파이프라인 중단.');
        return;
    }

    // 2. 스코어링 및 시나리오 변환 로직 (Curator)
    const topScenarios = await curator.analyzeAndSelectTop3(rawSources, channelType);
    if (!topScenarios || topScenarios.length === 0) {
        console.error('시나리오 추출 실패. 파이프라인 중단.');
        return;
    }

    console.log(`\n✨ [채택된 오늘의 Top 3 영상 시나리오 목록]`);
    topScenarios.forEach((item, index) => {
        console.log(`\n[Rank ${index + 1}] 스코어: ${item.totalScore}점`);
        console.log(`- 원본 소스: ${item.selectedSourceTitle}`);
        console.log(`- 훅(Hook) 텍스트: "${item.scenario.scenes[0].textLines.join(' ')}"`);
    });

    // ── Phase 24.5: 이미지 자산 자동 생성 (ImageLabAgent) ────────────────────
    // 규칙 2 보장: imageLabAgent는 원본 scenes 불변 유지, 새 객체 반환
    console.log(`\n🎨 [ImageLabAgent] 시나리오별 비주얼 에셋 자동 생성 시작...`);
    const enrichedScenarios = [];
    for (const item of topScenarios) {
        const enriched = await imageLabAgent.generateAssetsForScenario(
            item.scenario,
            channelType
        );
        enrichedScenarios.push({ ...item, scenario: enriched });
    }

    // 3. 음성 합성(TTS) 및 자막 립싱크(Sync) 매핑 (Luca - TTSAgent)
    console.log(`\n🎙️ [TTSAgent] 성우 음성 실제 변환 및 자막 싱크 매핑 중...`);
    const publicDir = '/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/remotion-poc/public';
    for (let i = 0; i < enrichedScenarios.length; i++) {
        enrichedScenarios[i].scenario = await TTSAgent.generateAudioForScenario(enrichedScenarios[i].scenario, publicDir);
    }

    // 4. 비주얼 렌더링 및 물리적 MP4 추출 (Top 1만 즉시 렌더)
    console.log(`\n🛠️ [비주얼 렌더링 및 유튜브 업로드 큐 진입]`);
    const top1 = enrichedScenarios[0];
    if (top1) {
        console.log(`\n>> [${top1.selectedSourceTitle}] VideoAdapter 인코딩 시작...`);
        const outputFileName = 'auto-autopilot-test.mp4';
        const remotionProps = {
            theme:  top1.scenario.theme,
            scenes: top1.scenario.scenes,
            totalDurationFrames: top1.scenario.totalDurationFrames
        };
        try {
            const outputPath = await VideoAdapter.renderVideo(remotionProps, outputFileName);

            // 5. YouTube 자동 업로드 ────────────────────────────────────────────
            console.log(`\n📤 [Step 5] YouTube 쇼츠 자동 업로드 시작...`);
            const uploader = new YouTubeUploader();
            const hookText = top1.scenario.scenes[0]?.textLines?.join(' ') || top1.selectedSourceTitle;
            const allText  = top1.scenario.scenes.map(s => s.textLines?.join(' ')).join('\n');

            const { videoId, url: videoUrl } = await uploader.uploadShorts({
                filePath:    outputPath,
                title:       hookText.slice(0, 90),
                description: `${allText}\n\n#MyCrew #소시안 #Shorts`,
                tags:        [channelType === 'finance' ? '주식' : 'AI', '쇼츠', '자동화'],
                dryRun:      true,      // ⚠️ 파인튜닝 완료 후 false로 전환
                privacy:     'private', // ⚠️ 실제 공개 시 'public'으로 전환
            });

            console.log(`\n🎉 [완료] 유튜브 업로드 성공!`);
            console.log(`   📺 ${videoUrl}`);

        } catch (e) {
            console.error('렌더링 또는 업로드 중 에러 발생:', e.message);
        }
    }

    console.log(`\n✅ 오늘자 유튜브 무인 공장 1사이클 처리가 성공적으로 완료되었습니다.`);
}

// 직접 터미널에서 테스트 실행을 위한 진입점 (ESM 경로 이슈 회피)
console.log('초기화 중...');
try {
    await runAutopilotPipeline('finance');
} catch(e) {
    console.error('실행 중 문제 발생:', e);
}
