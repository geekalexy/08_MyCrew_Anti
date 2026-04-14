import { spawn } from 'child_process';

/**
 * Oh My OpenAgent(ultrawork) 프로세스를 안전한 백그라운드 환경에서 실행합니다.
 * @param {string} taskPrompt 사용자 명령 및 프롬프트
 * @param {string} cwd 실행할 대상 작업 디렉토리
 * @param {function} onLog 터미널 로그 스트리밍을 위한 콜백 함수
 * @param {function} onComplete 프로세스 종료 시 호출되는 콜백 함수
 * @returns {Object} { pid, kill } 컨트롤 객체 반환
 */
export function launchOmoTask(taskPrompt, cwd, onLog, onComplete) {
  // spawn을 사용하여 배열로 인자를 넘기면 Shell Injection 공격 원천 차단
  const child = spawn('ulw', [taskPrompt], {
    cwd: cwd || process.cwd(),
    // stdio: in(ignore), out(pipe), err(pipe)
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true, // 부모 프로세스 종료 시에도 독립적 수행 유지
  });

  const pid = child.pid;
  onLog(`🚀 [omoLauncher] Omo(ultrawork) 딥워크 프로세스 배정 (PID: ${pid})`);

  // 표준 출력 스트리밍
  child.stdout.on('data', (chunk) => {
    onLog(chunk.toString());
  });

  // 표준 에러 스트리밍
  child.stderr.on('data', (chunk) => {
    onLog(`[ERR] ${chunk.toString()}`);
  });

  // 종료 감지
  child.on('close', (code) => {
    onLog(`🛑 [omoLauncher] Omo 파견 종료 (Exit Code: ${code})`);
    if (onComplete) onComplete(code, pid);
  });

  // 실행 에러 감지 (바이너리 부재 등)
  child.on('error', (err) => {
    onLog(`[FATAL] Omo 실행 컨텍스트 실패: ${err.message}`);
    if (onComplete) onComplete(-1, pid);
  });

  // 부모 Node.js 프로세스의 이벤트 루프가 자식 때문에 유지되지 않도록 방지
  child.unref();

  return {
    pid,
    kill: async () => {
      try {
        // [Prime W1] SIGTERM -> SIGKILL 이중 전략
        console.log(`[omoLauncher] 프로세스 ${pid} 그룹 종료 시도 (SIGTERM)`);
        process.kill(-pid, 'SIGTERM'); 

        // 3초 대기 (프로세스가 스스로 정리할 시간을 줌)
        await new Promise(resolve => setTimeout(resolve, 3000));

        // 여전히 살아있는지 확인 (에러가 발생하지 않으면 살아있는 것)
        try {
          process.kill(-pid, 0); 
          console.warn(`[omoLauncher] 프로세스 ${pid}가 여전히 생존 중 → 강제 사살 (SIGKILL)`);
          process.kill(-pid, 'SIGKILL');
        } catch (e) {
          // 에러 발생 시 프로세스가 이미 종료된 것이므로 정상
          onLog(`[omoLauncher] 프로세스 ${pid} 그룹이 정상 종료되었습니다.`);
        }
      } catch (e) {
        onLog(`[omoLauncher] 종료 명령 중 에러: ${e.message}`);
      }
    }
  };
}

