import fs from 'fs/promises';
import path from 'path';

/**
 * [TTS Agent]
 * CurationAgent가 작성한 시나리오 대본(Text)을 무료 Google TTS API를 통해 오디오(.mp3)로 변환하고,
 * 각 씬(Scene)의 영상 길이(durationFrames)를 생성된 음성 길이에 맞춰 동적으로 계산합니다.
 */
export class TTSAgent {
    /**
     * 구글 비공식 TTS 엔드포인트를 통해 텍스트를 MP3 파일로 저장합니다. (100% 무료 우회)
     * @param {string} text 읽을 텍스트
     * @param {string} outputPath 저장할 절대 경로
     */
    static async fetchGoogleTTS(text, outputPath) {
        // 구글 번역기의 TTS 숨겨진 API를 활용 (client=tw-ob)
        const url = `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ko&client=tw-ob`;
        
        try {
            const res = await fetch(url);
            if (!res.ok) throw new Error(`Google TTS HTTP Error: ${res.status}`);
            
            const arrayBuffer = await res.arrayBuffer();
            await fs.writeFile(outputPath, Buffer.from(arrayBuffer));
        } catch (err) {
            console.error('[TTS Agent] 오디오 다운로드 실패:', err);
            // 에러 발생 시 방어코드 (빈 파일 쓰기 방지)
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
                
                // 1. 구글 서버에서 MP3 다운로드
                process.stdout.write(`   - Scene ${i+1} 오디오 렌더링 중 ("${textToSpeak.substring(0,10)}...")... `);
                await this.fetchGoogleTTS(textToSpeak, absolutePath);
                
                // 2. Remotion용 로컬 에셋 경로 주입
                scene.audioFile = `audio/${fileName}`;
                
                // 3. 오디오 길이에 맞춘 영상 길이(Frames) 동적 계산
                // 구글 TTS 한국어 평균 속도: 1글자 당 약 0.22초 소요
                // 영상 여유분(앞뒤 호흡) 1초(= 30프레임) 추가 부여
                const estimatedSeconds = (textToSpeak.length * 0.22) + 1.2;
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
