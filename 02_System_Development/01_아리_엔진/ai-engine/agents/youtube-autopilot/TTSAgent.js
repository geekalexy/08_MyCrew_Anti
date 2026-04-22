import fs from 'fs/promises';
import path from 'path';

/**
 * [TTS Agent]
 * CurationAgent가 작성한 시나리오 대본(Text)을 무료 Google TTS API를 통해 오디오(.mp3)로 변환하고,
 * 각 씬(Scene)의 영상 길이(durationFrames)를 생성된 음성 길이에 맞춰 동적으로 계산합니다.
 */
export class TTSAgent {
    /**
     * Google Cloud TTS API (고품질 Neural2 성우)를 통해 텍스트를 MP3 파일로 저장합니다.
     * @param {string} text 읽을 텍스트
     * @param {string} outputPath 저장할 절대 경로
     */
    static async fetchPremiumTTS(text, outputPath) {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error("GEMINI_API_KEY가 등록되지 않았습니다.");

        const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apiKey}`;
        const payload = {
            input: { text: text },
            // Google Cloud 최고품질 한국어 성우 (Neural2 계열)
            // ko-KR-Neural2-A (여성), ko-KR-Neural2-C (남성) 등이 있습니다.
            voice: { languageCode: "ko-KR", name: "ko-KR-Neural2-C" },
            audioConfig: { 
                audioEncoding: "MP3",
                speakingRate: 1.25, // 유튜브 쇼츠용 빠른 템포 (1.25배속)
                pitch: 1.5          // 귀에 쏙쏙 박히도록 약간 경쾌한 톤업
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
            // Google TTS API는 base64 문자열로 오디오를 반환합니다.
            const audioBuffer = Buffer.from(data.audioContent, 'base64');
            await fs.writeFile(outputPath, audioBuffer);
        } catch (err) {
            console.error('[TTS Agent] 고품질 오디오 렌더링 실패:', err);
            throw err;
        }
    }

    /**
     * 전체 시나리오를 순회하며 씬별 MP3 파일을 굽고, 프레임 길이를 동적 맵핑합니다.
     */
    static async generateAudioForScenario(scenarioJSON, remotionPublicDir) {
        console.log(`\n🎙️ [TTS Agent] 성우 오디오 믹싱 및 타임라인 동기화 시작...`);
        const audioDir = path.join(remotionPublicDir, 'audio');
        
        // audio 폴더가 없으면 생성
        try { await fs.mkdir(audioDir, { recursive: true }); } catch (e) {}

        const timestamp = Date.now();
        let totalFrames = 0;

        for (let i = 0; i < scenarioJSON.scenes.length; i++) {
            const scene = scenarioJSON.scenes[i];
            const textToSpeak = (scene.textLines || []).join(' ');
            
            if (textToSpeak.trim().length > 0) {
                const fileName = `scene_${i}_${timestamp}.mp3`;
                const absolutePath = path.join(audioDir, fileName);
                
                // 1. 구글 서버에서 고품질 MP3 다운로드
                process.stdout.write(`   - Scene ${i+1} 오디오 렌더링 중 ("${textToSpeak.substring(0,10)}...")... `);
                await this.fetchPremiumTTS(textToSpeak, absolutePath);
                
                // 2. Remotion용 로컬 에셋 경로 주입
                scene.audioFile = `audio/${fileName}`;
                
                // 3. 오디오 길이에 맞춘 영상 길이(Frames) 동적 계산
                // 고품질 성우 기본 속도(0.24초/글자)이나, speakingRate 1.25를 적용했으므로 0.19초/글자로 단축
                // 영상 여유분(앞뒤 호흡 및 시각적 안정감) 1.5초 부가
                const estimatedSeconds = (textToSpeak.length * 0.19) + 1.5;
                const dynamicFrames = Math.ceil(estimatedSeconds * 30); // 30 FPS 기준
                
                scene.durationFrames = dynamicFrames;
                totalFrames += dynamicFrames;
                
                console.log(`완료! (예상 길이: ${estimatedSeconds.toFixed(1)}초 / ${dynamicFrames}프레임)`);
            } else {
                console.log(`   - Scene ${i+1} 대사 없음 (BGM만 재생)`);
                totalFrames += (scene.durationFrames || 90);
            }
        }

        // 전체 완성된 총 비디오 길이(프레임)를 최상단에 세팅
        scenarioJSON.totalDurationFrames = totalFrames;
        console.log(`   ✅ [오디오 싱크 완료] 최종 생성된 트랙을 비디오랩 JSON에 이식했습니다. 총길이: ${(totalFrames/30).toFixed(1)}초`);
        
        return scenarioJSON;
    }
}
