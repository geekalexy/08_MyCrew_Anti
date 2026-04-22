import { exec } from 'child_process';
import fs from 'fs/promises';
import path from 'path';

/**
 * [VideoAdapter]
 * Remotion 기반의 렌더링 엔진과 백엔드를 연결하는 브릿지 어댑터입니다.
 * 에이전트가 만든 JSON 시나리오를 물리적인 MP4 영상으로 뽑아냅니다.
 */
export class VideoAdapter {
    static async renderVideo(scenarioJSON, outputFileName = 'auto-output.mp4') {
        return new Promise(async (resolve, reject) => {
            const remotionDir = path.resolve('/Users/alex/Documents/08_MyCrew_Anti/02_System_Development/01_아리_엔진/remotion-poc');
            const propsFilePath = path.join(remotionDir, 'auto-input.json');
            const outputFilePath = path.join(remotionDir, 'public', outputFileName);

            try {
                // 1. 시나리오 객체를 Remotion이 읽을 수 있는 파일(auto-input.json)로 저장
                await fs.writeFile(propsFilePath, JSON.stringify(scenarioJSON, null, 2), 'utf-8');
                console.log(`[VideoAdapter] ➡️ 시나리오 변수 매핑 완료 (${propsFilePath})`);

                // 2. Remotion 터미널 명령어 조립
                const command = `npx remotion render src/index.ts MyComp public/${outputFileName} --props=./auto-input.json`;
                console.log(`[VideoAdapter] ⚙️ 렌더링 엔진 시동 중... 명령어: ${command}`);

                // 3. 자식 프로세스(Child Process)를 통해 실제 렌더링 구동
                const renderProcess = exec(command, { cwd: remotionDir });

                // 4. 실시간 렌더링 로깅 출력 (진행률 확인용)
                renderProcess.stdout.on('data', (data) => {
                    const output = data.toString();
                    if (output.includes('Progress') || output.includes('Rendering:')) {
                        process.stdout.write(`\r[VideoLab Rendering] ${output.trim()}`);
                    }
                });

                renderProcess.stderr.on('data', (data) => {
                    // Remotion은 정상 로그도 가끔 stderr로 뱉으므로 강제 종료는 피함
                    const err = data.toString();
                    if (err.toLowerCase().includes('error')) {
                        console.error(`\n[VideoAdapter Error] ${err}`);
                    }
                });

                renderProcess.on('close', (code) => {
                    if (code === 0) {
                        console.log(`\n[VideoAdapter] ✅ 렌더링 100% 완료! 영상이 추출되었습니다: ${outputFilePath}`);
                        resolve(outputFilePath);
                    } else {
                        console.error(`\n[VideoAdapter] ❌ 렌더링 실패. (Exit Code: ${code})`);
                        reject(new Error('Remotion 컴파일 및 인코딩 중 오류가 발생했습니다.'));
                    }
                });

            } catch (error) {
                console.error('[VideoAdapter] 파이프라인 초기화 중 에러:', error);
                reject(error);
            }
        });
    }
}
