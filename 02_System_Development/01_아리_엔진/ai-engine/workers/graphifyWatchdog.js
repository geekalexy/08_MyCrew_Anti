import { exec } from 'child_process';
import util from 'util';

const execPromise = util.promisify(exec);

/**
 * Graphify 워치독 (백그라운드 그래프 갱신 데몬)
 * 칸반 태스크가 DONE으로 변경되거나 OUTPUT 파일이 생성될 때 호출되어
 * 프로젝트의 지식 그래프(AST 등)를 최신화합니다.
 */
export async function triggerGraphifyUpdate(projectDir) {
  console.log(`[GraphifyWatchdog] 🔄 지식 그래프 갱신 시작: ${projectDir}`);
  
  try {
    // 실제 운영 시 'graphify --update' 명령어로 교체
    // 현재는 목업 실행
    console.log(`[GraphifyWatchdog] 실행: graphify --update ${projectDir}`);
    
    // const { stdout, stderr } = await execPromise(`graphify --update "${projectDir}"`);
    // if (stderr) console.warn('[GraphifyWatchdog] 경고:', stderr);
    
    // 성공 시 graph.json이 갱신되었다고 가정
    console.log(`[GraphifyWatchdog] ✅ 지식 그래프(AST) 갱신 완료!`);
    return true;
  } catch (error) {
    console.error(`[GraphifyWatchdog] ❌ 그래프 갱신 실패:`, error.message);
    return false;
  }
}

// 개발/테스트용 단독 실행 블록
if (process.argv[1] === new URL(import.meta.url).pathname) {
  triggerGraphifyUpdate('./outputs');
}
