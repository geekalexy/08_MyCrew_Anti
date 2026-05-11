import { exec } from 'child_process';
import path from 'path';
import fs from 'fs';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * 리모션(Remotion)을 이용한 숏폼 비디오 생성 스킬 (OLLIE/LUMI 연결용)
 * @param {string} text 영상에 들어갈 핵심 타이틀 문구
 * @returns {Promise<string>} 생성된 영상의 로컬 파일 URL
 */
export async function generateVideo(text = "MyCrew Remotion POC") {
  try {
    console.log(`[Video Skill] Remotion 렌더링 엔진 가동 시작... (문구: ${text})`);

    // 리모션 프로젝트 폴더 경로
    const remotionDir = path.resolve(process.cwd(), 'remotion-poc');
    
    // 저장할 경로 설정 (server/outputs 폴더에 mp4 저장)
    const outputsDir = path.resolve(process.cwd(), 'outputs');
    if (!fs.existsSync(outputsDir)) {
      fs.mkdirSync(outputsDir, { recursive: true });
    }

    const fileName = `video_${Date.now()}.mp4`;
    const outputPath = path.join(outputsDir, fileName);

    // props 주입용 임시 JSON 파일 생성 (입력받은 텍스트 전달)
    const propsPath = path.join(remotionDir, 'input-props.json');
    fs.writeFileSync(propsPath, JSON.stringify({ titleText: text }));

    // npx remotion render 명령어 대신 로컬 바이너리 명시 호출 (npx 이슈 우회)
    // 템플릿의 기본 Composition ID는 'MyComp'이며, 진입점은 src/index.ts 입니다.
    const renderCommand = `./node_modules/.bin/remotion render src/index.ts MyComp ${outputPath} --props=./input-props.json`;
    
    console.log(`[Video Skill] 렌더링 명령어 실행 중: ${renderCommand}`);
    
    // cwd를 remotion-poc 폴더로 잡고 렌더링 실행
    const { stdout, stderr } = await execPromise(renderCommand, { cwd: remotionDir });
    
    console.log(`[Video Skill] 렌더링 완료! stdout: ${stdout}`);
    
    const serverPort = process.env.PORT || 4000;
    const fileUrl = `http://localhost:${serverPort}/outputs/${fileName}`;
    
    // 타임라인 출력을 위한 비디오 마크다운/HTML 태그 반환
    return `<video controls width="100%"><source src="${fileUrl}" type="video/mp4">브라우저가 비디오 태그를 지원하지 않습니다.</video>\n\n> 🎬 **비디오 렌더링 완료**: [다운로드 링크](${fileUrl})`;

  } catch (error) {
    console.error('[Video Skill] Remotion 비디오 생성 실패:', error);
    return `❌ 리모션(Remotion) 렌더링 중 에러가 발생했습니다: ${error.message}`;
  }
}
