import fs from 'fs/promises';
import path from 'path';
import { execSync } from 'child_process';
import { keyProvider } from '../../utils/keyProvider.js';

/**
 * [TTS Agent]
 * CurationAgent가 작성한 시나리오 대본(Text)을 Google Cloud TTS API를 통해 오디오(.mp3)로 변환하고,
 * 각 씬(Scene)의 영상 길이(durationFrames)를 생성된 음성 길이에 맞춰 동적으로 계산합니다.
 *
 * [Prime P1 수정 — 2026-04-23]
 * - API 키: GOOGLE_CLOUD_TTS_KEY || GEMINI_API_KEY (서비스 분리)
 * - originalDurationFrames: 원본값 보존 후 재계산 (규칙 2 준수)
 * - ffprobe 실측: 실제 오디오 길이 측정 → 글자 수 추정식 Fallback
 */

export const TTS_PROFILES = {
    A: { name: "ko-KR-Neural2-A", pitch: 1.5,  speakingRate: 1.25, label: "여성 꿀보이스 (Neural2-A)" },
    B: { name: "ko-KR-Neural2-C", pitch: -1.0, speakingRate: 1.3,  label: "남성 극초저음 (Neural2-C)" },
    C: { name: "ko-KR-Wavenet-C", pitch: 0,    speakingRate: 1.25, label: "표준 (Wavenet-C)" }
};

/**
 * ffprobe로 오디오 파일의 실제 재생 길이(초)를 측정합니다.
 * ffprobe가 없는 환경에서는 null 반환 → 기존 추정식 Fallback.
 */
function getAudioDurationSec(filePath) {
    try {
        const result = execSync(
            `ffprobe -v quiet -show_entries format=duration -of csv=p=0 "${filePath}"`,
            { encoding: 'utf8', timeout: 5000 }
        );
        const duration = parseFloat(result.trim());
        return isNaN(duration) ? null : duration;
    } catch {
        return null; // ffprobe 미설치 또는 파일 이슈 → Fallback
    }
}

export class TTSAgent {
    /**
     * Google Cloud TTS API를 통해 텍스트를 MP3 파일로 저장합니다.
     * @param {string} text 읽을 텍스트
     * @param {string} outputPath 저장할 절대 경로
     * @param {object} profile 적용할 TTS 프로필
     */
    static async fetchPremiumTTS(text, outputPath, profile = TTS_PROFILES.C) {
        // P1: 서비스별 API 키 분리 (GCP TTS 전용 키 우선, 없으면 Gemini 키 Fallback)
        const apiKey = process.env.GOOGLE_CLOUD_TTS_KEY || keyProvider.getKey('GEMINI_API_KEY');
        if (!apiKey) throw new Error('GOOGLE_CLOUD_TTS_KEY 또는 GEMINI_API_KEY가 등록되지 않았습니다.');

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
        const payload = {
            input: { text },
            voice: { languageCode: 'ko-KR', name: profile.name },
            audioConfig: {
                audioEncoding: 'MP3',
                speakingRate: profile.speakingRate,
                pitch: profile.pitch
            }
        };

        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errData = await res.json();
                throw new Error(`Google Cloud TTS API Error: ${errData.error?.message || res.status}`);
            }

            const data = await res.json();
            const audioBuffer = Buffer.from(data.audioContent, 'base64');
            await fs.writeFile(outputPath, audioBuffer);
        } catch (err) {
            console.error('[TTS Agent] 오디오 렌더링 실패:', err);
            throw err;
        }
    }

    /**
     * 전체 시나리오를 순회하며 씬별 MP3 파일을 굽고, 프레임 길이를 동적 맵핑합니다.
     */
    static async generateAudioForScenario(scenarioJSON, remotionPublicDir, voiceKey = 'C', feedback = '') {
        const profile = TTS_PROFILES[voiceKey] || TTS_PROFILES.C;
        console.log(`\n🎙️ [TTS Agent] 성우 오디오 믹싱 시작 (Voice: ${profile.label})... 피드백: ${feedback}`);

        const audioDir = path.join(remotionPublicDir, `audio_${voiceKey}`);
        try { await fs.mkdir(audioDir, { recursive: true }); } catch (e) {}

        const timestamp = Date.now();
        let totalFrames = 0;

        for (let i = 0; i < scenarioJSON.scenes.length; i++) {
            const scene = scenarioJSON.scenes[i];
            const textToSpeak = (scene.textLines || []).join(' ');

            if (textToSpeak.trim().length > 0) {
                const fileName = `scene_${i}_v${voiceKey}_${timestamp}.mp3`;
                const absolutePath = path.join(audioDir, fileName);

                // 1. 구글 서버에서 고품질 MP3 다운로드
                process.stdout.write(`   - Scene ${i+1} [${scene.type}] 오디오 렌더링 중... `);
                await this.fetchPremiumTTS(textToSpeak, absolutePath, profile);

                // 2. Remotion용 로컬 에셋 경로 주입
                scene.audioFile = `audio_${voiceKey}/${fileName}`;

                // 3. P1: 원본 durationFrames 보존 (규칙 2 준수)
                if (scene.originalDurationFrames === undefined) {
                    scene.originalDurationFrames = scene.durationFrames;
                }

                // 4. 실제 오디오 길이 측정 (ffprobe) → 없으면 글자 수 추정식 Fallback
                const actualSec = getAudioDurationSec(absolutePath);
                let estimatedSeconds;
                if (actualSec !== null) {
                    estimatedSeconds = actualSec + 0.5; // 0.5초 여유
                    console.log(`완료! (실측: ${actualSec.toFixed(1)}초 + 여유 0.5s)`);
                } else {
                    const charDuration = 0.24 / profile.speakingRate;
                    estimatedSeconds = (textToSpeak.length * charDuration) + 1.2;
                    console.log(`완료! (추정: ${estimatedSeconds.toFixed(1)}초 — ffprobe 없음)`);
                }

                const dynamicFrames = Math.ceil(estimatedSeconds * 30); // 30 FPS 기준
                scene.durationFrames = dynamicFrames;
                totalFrames += dynamicFrames;

            } else {
                console.log(`   - Scene ${i+1} [${scene.type}] 대사 없음 (BGM만 재생)`);
                totalFrames += (scene.durationFrames || 90);
            }
        }

        scenarioJSON.totalDurationFrames = totalFrames;
        const totalSec = (totalFrames / 30).toFixed(1);
        console.log(`   ✅ [오디오 싱크 완료] 총 길이: ${totalSec}초 (${totalFrames}프레임)`);

        // 품질 체크: Shorts 규격 (15~58초)
        if (parseFloat(totalSec) < 15 || parseFloat(totalSec) > 58) {
            console.warn(`   ⚠️ [품질 경고] 영상 길이 부적합: ${totalSec}초 (Shorts 규격: 15~58초)`);
        }

        return scenarioJSON;
    }
}
